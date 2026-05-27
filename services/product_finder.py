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
    1: 5,
    2: 7,
    3: 8,
    4: 9,
    5: 10,
}
SEARCH_TIMEOUT_SECONDS = 6
IMAGE_SEARCH_TIMEOUT_SECONDS = 5
IMAGE_SEARCH_WORKERS = 7
MIN_IMAGE_AREA = 280_000
MIN_QUERY_GROUPS = 4


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
                "content": "Du generierst ein valides JSON-Objekt mit diversen Google Shopping Suchbegriffen auf Deutsch."
            },
            {
                "role": "user",
                "content": f"""Erstelle diverse Google Shopping Suchbegriffe basierend auf diesem Profil.

Profil:
{json.dumps(profile, ensure_ascii=False, indent=2)}

Personalisierungs-Level: {level}/5
- Level 1-2: Breite Suchbegriffe (z.B. "yoga matte", "laufschuhe")
- Level 3: Spezifischere Begriffe (z.B. "manduka yoga matte")
- Level 4-5: Sehr spezifisch, auch beiläufig erwähnte Dinge (z.B. "vegane proteinriegel münchen")
- Wichtig: Decke mehrere Produktkategorien ab. Wenn jemand Sport macht und Schuhe/Kleidung erwähnt, suche z.B. Schuhe, Sportkleidung, Accessoires, Recovery/Equipment, nicht nur Schuhe.
- Nutze 4-6 unterschiedliche Kategorien. Pro Kategorie 1-3 Suchbegriffe.
- Jede Kategorie muss einen anderen Shopping-Winkel abdecken.

Antworte NUR mit einem JSON-Objekt in diesem Format:
{{
  "groups": [
    {{"category": "kurzer Kategoriename", "queries": ["suchbegriff 1", "suchbegriff 2"]}}
  ],
  "queries": ["fallback flache liste"]
}}"""
            }
        ],
        response_format=JSON_RESPONSE_FORMAT,
        reasoning_effort=PERSONALIZATION_REASONING_EFFORT,
        max_completion_tokens=SEARCH_QUERY_TOKEN_LIMIT
    )
    
    data = parse_json_response(response, "Suchbegriffe")
    if not isinstance(data, dict):
        return [{"category": "Profil", "queries": [str(query).strip() for query in data if str(query).strip()]}]

    groups = []
    for group in data.get("groups") or []:
        if not isinstance(group, dict):
            continue
        queries = [str(query).strip() for query in group.get("queries") or [] if str(query).strip()]
        if queries:
            groups.append({
                "category": str(group.get("category") or "Profil").strip()[:40],
                "queries": queries,
            })

    if groups:
        return groups

    queries = [str(query).strip() for query in data.get("queries", []) if str(query).strip()]
    return [{"category": "Profil", "queries": queries}] if queries else []


def profile_items(profile, key):
    raw = profile.get(key) or []
    if isinstance(raw, str):
        raw = [raw]
    return [str(item).strip() for item in raw if str(item).strip()]


def add_query_group(groups, category, queries):
    cleaned = []
    seen = set()
    for query in queries:
        value = str(query or "").strip().lower()
        if value and value not in seen:
            seen.add(value)
            cleaned.append(value)
    if cleaned:
        groups.append({"category": category, "queries": cleaned})


def fallback_search_queries(profile, level):
    groups = []
    values = []
    for key in ("mentioned_products", "keywords", "interests", "brands"):
        values.extend(profile_items(profile, key))

    if not values:
        values = ["lifestyle bestseller", "fitness tracker", "nachhaltige produkte"]

    add_query_group(groups, "Erwaehnte Produkte", profile_items(profile, "mentioned_products")[:4])
    add_query_group(groups, "Interessen", profile_items(profile, "interests")[:4])
    add_query_group(groups, "Marken", profile_items(profile, "brands")[:3])
    add_query_group(groups, "Profil-Keywords", profile_items(profile, "keywords")[:5])

    context = " ".join(values).lower()
    if any(word in context for word in ("sport", "fitness", "laufen", "running", "yoga", "training", "gym")):
        add_query_group(groups, "Sportschuhe", ["laufschuhe", "trainingsschuhe", "sportschuhe"])
        add_query_group(groups, "Sportkleidung", ["sport leggings", "training shirt", "sportjacke"])
        add_query_group(groups, "Sportzubehoer", ["sporttasche", "trinkflasche sport", "fitness tracker"])
        add_query_group(groups, "Recovery", ["faszienrolle", "massageball sport", "yoga block"])

    add_query_group(groups, "Subtile Details", profile_items(profile, "subtle_details")[:3])
    if not groups:
        add_query_group(groups, "Lifestyle", values[:5])

    return groups


def unique_query_groups(groups, level):
    result = []
    seen = set()
    for group in groups:
        if isinstance(group, str):
            category = "Profil"
            raw_queries = [group]
        elif isinstance(group, dict):
            category = str(group.get("category") or "Profil").strip()[:40] or "Profil"
            raw_queries = group.get("queries") or []
        else:
            continue

        cleaned_queries = []
        for query in raw_queries:
            cleaned = str(query).strip()
            key = cleaned.lower()
            if cleaned and key not in seen:
                seen.add(key)
                cleaned_queries.append(cleaned)

        if cleaned_queries:
            result.append({"category": category, "queries": cleaned_queries[:3]})

    if len(result) < MIN_QUERY_GROUPS:
        fallback = fallback_search_queries({}, level)
        for group in fallback:
            if len(result) >= MIN_QUERY_GROUPS:
                break
            result.append(group)

    return result


def select_queries_round_robin(groups, level):
    limit = MAX_SEARCH_QUERIES.get(level, 4)
    selected = []
    for query_index in range(3):
        for group in groups:
            queries = group.get("queries") or []
            if query_index >= len(queries):
                continue
            selected.append({
                "category": group.get("category") or "Profil",
                "query": queries[query_index],
            })
            if len(selected) >= limit:
                return selected
    return selected


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
        'num': 5
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
                product['thumbnailImage'] = product.get('image', '')
                product['image'] = upgraded_image

    return products


def find_products(profile, level):
    try:
        generated_groups = generate_search_queries(profile, level)
    except Exception as e:
        print(f"OpenAI query generation error: {e}")
        generated_groups = []

    groups = unique_query_groups(generated_groups + fallback_search_queries(profile, level), level)
    query_specs = select_queries_round_robin(groups, level)

    if not query_specs:
        return []

    products_by_category = {}
    category_order = []
    for spec in query_specs:
        category = spec["category"]
        if category not in products_by_category:
            products_by_category[category] = []
            category_order.append(category)

    max_workers = min(len(query_specs), 6)
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {executor.submit(search_products, spec["query"]): spec for spec in query_specs}
        for future in as_completed(futures):
            spec = futures[future]
            query = spec["query"]
            category = spec["category"]
            try:
                results = future.result()
            except Exception as e:
                print(f"Product search failed for query '{query}': {e}")
                results = []

            for product in results:
                if not product.get('name') or not product.get('image'):
                    continue
                product['search_query'] = query
                product['query_category'] = category
                products_by_category[category].append(product)

    all_products = []
    seen_names = set()
    max_products = 10 if level == 1 else 18
    max_category_size = max((len(products) for products in products_by_category.values()), default=0)
    for product_index in range(max_category_size):
        for category in category_order:
            products = products_by_category.get(category) or []
            if product_index >= len(products):
                continue
            product = products[product_index]
            name_key = product['name'].lower()[:60]
            if name_key in seen_names:
                continue
            seen_names.add(name_key)
            all_products.append(product)
            if len(all_products) >= max_products:
                return upgrade_product_images(all_products)

    return upgrade_product_images(all_products[:max_products])
