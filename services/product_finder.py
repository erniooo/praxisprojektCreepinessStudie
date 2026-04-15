import os
import json
import requests
from openai import OpenAI

SERPER_API_URL = "https://google.serper.dev/shopping"

def generate_search_queries(profile, level):
    client = OpenAI(api_key=os.environ.get('OPENAI_API_KEY'))
    
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {
                "role": "system",
                "content": "Du generierst Google Shopping Suchbegriffe auf Deutsch."
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

Antworte NUR mit einem JSON-Array von Strings, z.B.:
["suchbegriff 1", "suchbegriff 2", ...]"""
            }
        ],
        temperature=0.7,
        max_tokens=500
    )
    
    content = response.choices[0].message.content.strip()
    if content.startswith('```'):
        content = content.split('```')[1]
        if content.startswith('json'):
            content = content[4:]
    if content.endswith('```'):
        content = content[:-3]
    
    return json.loads(content)


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
        response = requests.post(SERPER_API_URL, json=payload, headers=headers, timeout=10)
        response.raise_for_status()
        data = response.json()
        
        products = []
        for item in data.get('shopping', []):
            products.append({
                'name': item.get('title', ''),
                'price': item.get('price', ''),
                'image': item.get('imageUrl', ''),
                'shop': item.get('source', ''),
                'link': item.get('link', ''),
                'rating': item.get('rating', None),
                'reviews': item.get('ratingCount', None)
            })
        
        return products
    except Exception as e:
        print(f"Serper API error for query '{query}': {e}")
        return []


def find_products(profile, level):
    queries = generate_search_queries(profile, level)
    
    all_products = []
    seen_names = set()
    
    for query in queries:
        results = search_products(query)
        for product in results:
            name_key = product['name'].lower()[:50]
            if name_key not in seen_names and product['image']:
                seen_names.add(name_key)
                product['search_query'] = query
                all_products.append(product)
    
    # Limit based on level
    max_products = 8 + (level * 2)  # Level 1: 10, Level 5: 18
    return all_products[:max_products]
