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
        generated_queries = generate_search_queries(profile, level)
    except Exception as e:
        print(f"OpenAI query generation error: {e}")
        generated_queries = []

    queries = unique_queries(generated_queries + fallback_search_queries(profile, level), level)
    
    all_products = []
    seen_names = set()
    
    if not queries:
        return []

    max_workers = min(len(queries), 5)
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {executor.submit(search_products, query): query for query in queries}
        for future in as_completed(futures):
            query = futures[future]
            try:
                results = future.result()
            except Exception as e:
                print(f"Product search failed for query '{query}': {e}")
                results = []

            for product in results:
                if not product.get('name') or not product.get('image'):
                    continue
                name_key = product['name'].lower()[:50]
                if name_key not in seen_names:
                    seen_names.add(name_key)
                    product['search_query'] = query
                    all_products.append(product)
    
    # Limit based on level
    max_products = 8 if level == 1 else 14
    return upgrade_product_images(all_products[:max_products])
