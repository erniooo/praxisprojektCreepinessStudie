import os
import json
import requests
from concurrent.futures import ThreadPoolExecutor, as_completed
from openai import OpenAI
from services.json_utils import parse_json_response
from services.openai_config import (
    JSON_RESPONSE_FORMAT,
    OPENAI_TIMEOUT_SECONDS,
    PERSONALIZATION_MODEL,
    PERSONALIZATION_REASONING_EFFORT,
    SEARCH_QUERY_TOKEN_LIMIT,
)

SERPER_API_URL = "https://google.serper.dev/shopping"
SERPER_IMAGES_API_URL = "https://google.serper.dev/images"
MAX_SEARCH_QUERIES = {
    1: 3,
    2: 4,
    3: 4,
    4: 5,
    5: 5,
}
SEARCH_TIMEOUT_SECONDS = 6
IMAGE_SEARCH_TIMEOUT_SECONDS = 5
IMAGE_SEARCH_WORKERS = 7
MIN_IMAGE_AREA = 280_000


def extract_image_url(item):
    for key in ("imageUrl", "image", "thumbnail", "serpapi_thumbnail"):
        value = item.get(key)
        if isinstance(value, str) and value.startswith(("http://", "https://")):
            return value

    for key in ("images", "thumbnails"):
        values = item.get(key)
        if not isinstance(values, list):
            continue
        for value in values:
            if isinstance(value, str) and value.startswith(("http://", "https://")):
                return value
            if isinstance(value, dict):
                for nested_key in ("url", "imageUrl", "thumbnail"):
                    nested_value = value.get(nested_key)
                    if isinstance(nested_value, str) and nested_value.startswith(("http://", "https://")):
                        return nested_value

    return ""


def parse_dimension(value):
    try:
        return int(value or 0)
    except (TypeError, ValueError):
        return 0


def image_area(item):
    width = parse_dimension(item.get("imageWidth") or item.get("width"))
    height = parse_dimension(item.get("imageHeight") or item.get("height"))
    return width * height


def is_low_quality_google_thumbnail(url):
    return "encrypted-tbn" in url or "gstatic.com/images" in url


def image_quality_score(item):
    url = extract_image_url(item)
    if not url:
        return -1

    score = image_area(item)
    if score == 0 and not is_low_quality_google_thumbnail(url):
        score = MIN_IMAGE_AREA
    if is_low_quality_google_thumbnail(url):
        score -= MIN_IMAGE_AREA

    return score


def generate_search_queries(profile, level):
    client = OpenAI(api_key=os.environ.get('OPENAI_API_KEY'), timeout=OPENAI_TIMEOUT_SECONDS)
    
    response = client.chat.completions.create(
        model=PERSONALIZATION_MODEL,
        messages=[
            {
                "role": "system",
                "content": "Du generierst ein valides JSON-Objekt mit Google Shopping Suchbegriffen auf Deutsch."
            },
            {
                "role": "user",
                "content": f"""Erstelle {4 + level} Google Shopping Suchbegriffe basierend auf diesem Profil.

Profil:
{json.dumps(profile, ensure_ascii=False, indent=2)}

Personalisierungs-Level: {level}/5
- Level 1-2: Breite Suchbegriffe (z.B. "yoga matte", "laufschuhe")
- Level 3: Spezifischere Begriffe (z.B. "manduka yoga matte")
- Level 4-5: Sehr spezifisch, auch beiläufig erwähnte Dinge (z.B. "vegane proteinriegel münchen")

Antworte NUR mit einem JSON-Objekt in diesem Format:
{{"queries": ["suchbegriff 1", "suchbegriff 2"]}}"""
            }
        ],
        response_format=JSON_RESPONSE_FORMAT,
        reasoning_effort=PERSONALIZATION_REASONING_EFFORT,
        max_completion_tokens=SEARCH_QUERY_TOKEN_LIMIT
    )
    
    data = parse_json_response(response, "Suchbegriffe")
    queries = data.get("queries", []) if isinstance(data, dict) else data
    return [str(query).strip() for query in queries if str(query).strip()]


def fallback_search_queries(profile, level):
    values = []
    for key in ("mentioned_products", "keywords", "interests", "brands"):
        raw = profile.get(key) or []
        if isinstance(raw, str):
            raw = [raw]
        values.extend(str(item).strip() for item in raw if str(item).strip())

    if not values:
        values = ["lifestyle bestseller", "fitness tracker", "nachhaltige produkte"]

    queries = []
    city = profile.get("city")
    for value in values:
        query = value.lower()
        if level >= 4 and city:
            query = f"{query} {city}"
        queries.append(query)

    return queries


def unique_queries(queries, level):
    result = []
    seen = set()
    for query in queries:
        cleaned = str(query).strip()
        key = cleaned.lower()
        if cleaned and key not in seen:
            seen.add(key)
            result.append(cleaned)

    limit = MAX_SEARCH_QUERIES.get(level, 4)
    return result[:limit]


def search_products(query):
    api_key = os.environ.get('SERPER_API_KEY')
    if not api_key:
        return []
    
    headers = {
        'X-API-KEY': api_key,
        'Content-Type': 'application/json'
    }
    
    payload = {
        'q': query,
        'gl': 'de',
        'hl': 'de',
        'num': 4
    }
    
    try:
        response = requests.post(SERPER_API_URL, json=payload, headers=headers, timeout=SEARCH_TIMEOUT_SECONDS)
        response.raise_for_status()
        data = response.json()
        
        products = []
        for item in data.get('shopping', []):
            products.append({
                'name': item.get('title', ''),
                'price': item.get('price', ''),
                'image': extract_image_url(item),
                'shop': item.get('source', ''),
                'link': item.get('link', ''),
                'rating': item.get('rating', None),
                'reviews': item.get('ratingCount', None)
            })
        
        return products
    except Exception as e:
        print(f"Serper API error for query '{query}': {e}")
        return []


def search_high_quality_image(product):
    api_key = os.environ.get('SERPER_API_KEY')
    if not api_key:
        return ""

    headers = {
        'X-API-KEY': api_key,
        'Content-Type': 'application/json'
    }
    payload = {
        'q': f'{product.get("name", "")} produktbild',
        'gl': 'de',
        'hl': 'de',
        'num': 6
    }

    try:
        response = requests.post(
            SERPER_IMAGES_API_URL,
            json=payload,
            headers=headers,
            timeout=IMAGE_SEARCH_TIMEOUT_SECONDS
        )
        response.raise_for_status()
        data = response.json()
    except Exception as e:
        print(f"Serper image API error for product '{product.get('name', '')}': {e}")
        return ""

    candidates = data.get('images', [])
    if not candidates:
        return ""

    best = max(candidates, key=image_quality_score)
    if image_quality_score(best) < MIN_IMAGE_AREA:
        return ""

    return extract_image_url(best)


def upgrade_product_images(products):
    if not products:
        return products

    # Keep the original Google Shopping image as a fallback. Image-search
    # results are often larger, but some source sites block server-side proxy
    # requests even though the Shopping thumbnail remains available.
    for product in products:
        original_image = str(product.get('image') or '').strip()
        if original_image:
            product['thumbnailImage'] = original_image

    max_workers = min(len(products), IMAGE_SEARCH_WORKERS)
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {executor.submit(search_high_quality_image, product): product for product in products}
        for future in as_completed(futures):
            product = futures[future]
            try:
                upgraded_image = future.result()
            except Exception as e:
                print(f"Image upgrade failed for product '{product.get('name', '')}': {e}")
                upgraded_image = ""

            if upgraded_image:
                product['image'] = upgraded_image

    return products


def search_product_batches(queries, context):
    """Search queries concurrently while retaining their original order."""
    batches = {}
    if not queries:
        return batches

    max_workers = min(len(queries), 5)
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {executor.submit(search_products, query): query for query in queries}
        for future in as_completed(futures):
            query = futures[future]
            try:
                batches[query] = future.result()
            except Exception as e:
                print(f"{context} product search failed for query '{query}': {e}")
                batches[query] = []

    return batches


def select_products_round_robin(queries, batches, max_products, per_query_limit=None):
    """Select products evenly across queries instead of by response speed."""
    prepared = {}
    for query in queries:
        valid = []
        for product in batches.get(query, []):
            if not product.get('name') or not product.get('image'):
                continue
            entry = dict(product)
            entry['search_query'] = query
            valid.append(entry)
        prepared[query] = valid[:per_query_limit] if per_query_limit else valid

    selected = []
    seen_names = set()
    max_rounds = max((len(items) for items in prepared.values()), default=0)
    for product_index in range(max_rounds):
        for query in queries:
            products = prepared.get(query, [])
            if product_index >= len(products):
                continue

            product = products[product_index]
            name_key = product['name'].lower()[:50]
            if name_key in seen_names:
                continue

            seen_names.add(name_key)
            selected.append(product)
            if len(selected) >= max_products:
                return selected

    return selected


def find_products(profile, level):
    try:
        generated_queries = generate_search_queries(profile, level)
    except Exception as e:
        print(f"OpenAI query generation error: {e}")
        generated_queries = []

    queries = unique_queries(generated_queries + fallback_search_queries(profile, level), level)
    
    if not queries:
        return []

    # Limit based on level (more products = more realistic shop)
    max_products = 16 if level == 1 else 20
    batches = search_product_batches(queries, "Personalized")
    selected = select_products_round_robin(queries, batches, max_products)
    return upgrade_product_images(selected)


# Neutrale, NICHT personalisierte Suchbegriffe fuer den Baseline-/Generic-Shop.
# Diese sollen sich bewusst von den profilbasierten Empfehlungen unterscheiden.
GENERIC_PRODUCT_QUERIES = [
    "kabellose kopfhoerer bestseller",
    "sneaker unisex bestseller",
    "rucksack alltag",
    "hautpflege set bestseller",
    "wohnzimmer deko modern",
    "gesellschaftsspiel bestseller",
    "schreibtischlampe modern",
    "kaffeemaschine bestseller",
]

# Fallback-Katalog, falls keine Bilder/Serper-Ergebnisse verfuegbar sind.
GENERIC_FALLBACK_PRODUCTS = [
    {"name": "Bluetooth Kopfhoerer Over-Ear", "price": "79,99 EUR", "shop": "NOVA", "rating": 4.6, "reviews": 214},
    {"name": "Sneaker Classic Low", "price": "59,99 EUR", "shop": "NOVA", "rating": 4.4, "reviews": 168},
    {"name": "Filterkaffeemaschine 1,2 L", "price": "49,99 EUR", "shop": "NOVA", "rating": 4.5, "reviews": 132},
    {"name": "Tagesrucksack 20 L", "price": "44,99 EUR", "shop": "NOVA", "rating": 4.7, "reviews": 251},
    {"name": "Smartwatch Fitness", "price": "89,99 EUR", "shop": "NOVA", "rating": 4.3, "reviews": 309},
    {"name": "Sonnenbrille UV400", "price": "24,99 EUR", "shop": "NOVA", "rating": 4.2, "reviews": 87},
    {"name": "Edelstahl Trinkflasche 750 ml", "price": "19,99 EUR", "shop": "NOVA", "rating": 4.6, "reviews": 176},
    {"name": "LED Schreibtischlampe dimmbar", "price": "34,99 EUR", "shop": "NOVA", "rating": 4.5, "reviews": 142},
    {"name": "Digitale Kuechenwaage", "price": "16,99 EUR", "shop": "NOVA", "rating": 4.6, "reviews": 198},
    {"name": "Bestseller Roman des Jahres", "price": "14,99 EUR", "shop": "NOVA", "rating": 4.8, "reviews": 421},
    {"name": "Baumwoll T-Shirt Basic", "price": "19,99 EUR", "shop": "NOVA", "rating": 4.4, "reviews": 263},
    {"name": "Powerbank 20.000 mAh", "price": "29,99 EUR", "shop": "NOVA", "rating": 4.5, "reviews": 188},
    {"name": "Yogamatte rutschfest", "price": "27,99 EUR", "shop": "NOVA", "rating": 4.6, "reviews": 154},
    {"name": "Duftkerze Vanille", "price": "12,99 EUR", "shop": "NOVA", "rating": 4.3, "reviews": 96},
    {"name": "Lederguertel Klassik", "price": "22,99 EUR", "shop": "NOVA", "rating": 4.5, "reviews": 119},
    {"name": "Thermosflasche 500 ml", "price": "21,99 EUR", "shop": "NOVA", "rating": 4.6, "reviews": 207},
]


def find_generic_products(max_products=16):
    """Sucht neutrale, nicht personalisierte Produkte fuer den Baseline-Shop.

    Faellt auf einen statischen Katalog zurueck, wenn keine API/Bilder vorliegen.
    """
    api_key = os.environ.get('SERPER_API_KEY')
    if not api_key:
        return GENERIC_FALLBACK_PRODUCTS[:max_products]

    queries = GENERIC_PRODUCT_QUERIES
    batches = search_product_batches(queries, "Generic")
    selected = select_products_round_robin(
        queries,
        batches,
        max_products,
        per_query_limit=2,
    )

    # Fill before image upgrade so fallback catalog entries also receive a
    # Serper image search instead of reaching the UI with an empty image.
    if len(selected) < max_products:
        seen_names = {product['name'].lower()[:50] for product in selected}
        for fb in GENERIC_FALLBACK_PRODUCTS:
            if len(selected) >= max_products:
                break
            if fb['name'].lower()[:50] not in seen_names:
                entry = dict(fb)
                entry['search_query'] = "neutraler Bestseller"
                selected.append(entry)
                seen_names.add(fb['name'].lower()[:50])

    return upgrade_product_images(selected[:max_products])
