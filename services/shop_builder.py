import json
import os
from openai import OpenAI
from services.json_utils import parse_json_response
from services.openai_config import (
    JSON_RESPONSE_FORMAT,
    OPENAI_TIMEOUT_SECONDS,
    PERSONALIZATION_MODEL,
    PERSONALIZATION_REASONING_EFFORT,
    SHOP_TOKEN_LIMIT,
)


def _profile_value(profile, key, fallback=""):
    value = profile.get(key)
    if value is None or value == "null":
        return fallback
    return str(value).strip() or fallback


def _profile_items(profile, key):
    value = profile.get(key) or []
    if isinstance(value, str):
        value = [value]
    return [str(item).strip() for item in value if str(item).strip()]


def _first_profile_item(profile, keys):
    for key in keys:
        items = _profile_items(profile, key)
        if items:
            return items[0]
    return ""


def _word_limit(text, max_words):
    words = str(text or "").strip().split()
    return " ".join(words[:max_words])


def _normalize_products(products):
    normalized = []
    for product in products or []:
        name = str(product.get("name") or "").strip()
        if not name:
            continue

        rating = product.get("rating")
        try:
            rating = float(rating) if rating is not None else None
        except (TypeError, ValueError):
            rating = None

        reviews = product.get("reviews")
        try:
            reviews = int(reviews) if reviews is not None else None
        except (TypeError, ValueError):
            reviews = None

        normalized.append({
            "name": name,
            "price": str(product.get("price") or "Preis auf Anfrage").strip(),
            "image": str(product.get("image") or "").strip(),
            "shop": str(product.get("shop") or "NOVA").strip(),
            "rating": rating or 4.5,
            "reviews": reviews or 100,
            "link": str(product.get("link") or "").strip(),
            "search_query": str(product.get("search_query") or "").strip(),
        })

    return normalized


def _personalized_nav(profile):
    nav = []
    for key in ("interests", "mentioned_products", "keywords", "brands"):
        nav.extend(_profile_items(profile, key))

    seen = set()
    result = ["Neu", "Bestseller"]
    for item in nav:
        label = _word_limit(item.title(), 3)
        key = label.lower()
        if label and key not in seen:
            seen.add(key)
            result.append(label)
        if len(result) >= 6:
            break

    fallback = ["Mode", "Sport", "Tech", "Lifestyle"]
    for item in fallback:
        if len(result) >= 6:
            break
        if item.lower() not in seen:
            result.append(item)

    return result


def _default_product_copy(product, profile, level):
    detail = _first_profile_item(profile, ["subtle_details", "life_events", "interests"])
    query = product.get("search_query")

    if level >= 5 and detail:
        return (
            "Greift ein Interviewdetail auf",
            f"Im Interview wurde dieses Detail nutzbar: {detail}."
        )
    if level >= 4 and query:
        return (
            "Aus deinem Suchkontext abgeleitet",
            f"Diese Empfehlung folgt aus dem abgeleiteten Suchkontext: {query}."
        )
    if level >= 2:
        return (
            "Passt zu deinem Profil",
            "Diese Empfehlung basiert auf Interessen aus dem Interview."
        )

    return "", ""


def _build_product(product, profile, level, copy_index):
    personal_label, transparency_reason = _default_product_copy(product, profile, level)
    result = dict(product)
    result["_copy_index"] = copy_index
    result["personalLabel"] = _word_limit(personal_label, 10)
    result["transparencyReason"] = _word_limit(transparency_reason, 22)
    return result


def _split_products(products, profile, level):
    if level <= 1:
        return {
            "recommendations": [
                _build_product(product, profile, level, index)
                for index, product in enumerate(products[:8])
            ],
            "personal_picks": [],
            "local": [],
        }

    rec_count = 6 if len(products) > 8 else min(len(products), 8)
    selected = products[:14]
    sections = {
        "recommendations": selected[:rec_count],
        "personal_picks": selected[rec_count:rec_count + 4],
        "local": selected[rec_count + 4:rec_count + 8],
    }

    copy_index = 0
    decorated = {}
    for section_id, section_products in sections.items():
        decorated[section_id] = []
        for product in section_products:
            decorated[section_id].append(_build_product(product, profile, level, copy_index))
            copy_index += 1

    return decorated


def _base_shop(profile, products, level):
    name = _profile_value(profile, "name", "Gast")
    city = _profile_value(profile, "city")
    interest = _first_profile_item(profile, ["interests", "mentioned_products", "keywords"])
    section_products = _split_products(products, profile, level)

    personalized_banner = "Kostenloser Versand ab 50 EUR | 30 Tage Rueckgaberecht"
    if level >= 2 and city:
        personalized_banner = f"Kostenloser Versand nach {city} | 30 Tage Rueckgaberecht"

    hero_focus = interest or "deinen Alltag"
    hero_headline = f"Ausgewaehlt fuer {hero_focus}"
    if level >= 5:
        hero_headline = f"{name}, wir haben die Details aus dem Gespraech aufgegriffen"

    return {
        "topBanner": {
            "generic": "Kostenloser Versand ab 50 EUR | 30 Tage Rueckgaberecht",
            "personalized": personalized_banner,
        },
        "greeting": {
            "generic": "",
            "personalized": f"Hallo, {name}" if name else "Hallo",
        },
        "hero": {
            "generic": {
                "headline": "Fruehjahr Kollektion 2026",
                "subtext": "Entdecke die neuesten Trends",
                "cta": "Jetzt shoppen",
            },
            "personalized": {
                "headline": hero_headline,
                "subtext": "Produkte, die zu deinem Interviewprofil passen.",
                "cta": "Empfehlungen ansehen",
            },
        },
        "navCategories": {
            "generic": ["Neu", "Bestseller", "Mode", "Sport", "Tech", "Lifestyle"],
            "personalized": _personalized_nav(profile),
        },
        "sections": [
            {
                "id": "recommendations",
                "title": {
                    "generic": "Unsere Empfehlungen",
                    "personalized": f"{name}, fuer dich ausgewaehlt",
                },
                "subtitle": {
                    "generic": "Die beliebtesten Produkte dieser Woche",
                    "personalized": "Aus echten Shopping-Ergebnissen zusammengestellt",
                },
                "products": section_products["recommendations"],
            },
            {
                "id": "personal_picks",
                "title": {
                    "generic": None,
                    "personalized": f"{name}, das koennte dir gefallen",
                },
                "subtitle": {
                    "generic": None,
                    "personalized": "Basierend auf Interessen und Details aus dem Interview",
                },
                "products": section_products["personal_picks"],
            },
            {
                "id": "local",
                "title": {
                    "generic": "Beliebt diese Woche",
                    "personalized": f"Beliebt in {city}" if city else "Beliebt bei aehnlichen Kunden",
                },
                "subtitle": {
                    "generic": "Was andere Kunden kaufen",
                    "personalized": "Was zu deinem Kontext passen koennte",
                },
                "products": section_products["local"],
            },
        ],
        "trustBadges": [
            {
                "icon": "truck",
                "title": {
                    "generic": "Schneller Versand",
                    "personalized": f"Schneller Versand nach {city}" if city else "Schneller Versand",
                },
                "text": {
                    "generic": "1-3 Werktage",
                    "personalized": "1-3 Werktage",
                },
            },
            {
                "icon": "return",
                "title": {"generic": "Einfache Rueckgabe", "personalized": "Einfache Rueckgabe"},
                "text": {"generic": "30 Tage kostenlos", "personalized": "30 Tage kostenlos"},
            },
            {
                "icon": "lock",
                "title": {"generic": "Sicherer Kauf", "personalized": "Sicherer Kauf"},
                "text": {"generic": "SSL verschluesselt", "personalized": "SSL verschluesselt"},
            },
        ],
    }


def _used_product_context(shop):
    context = []
    for section in shop["sections"]:
        for product in section["products"]:
            context.append({
                "index": product["_copy_index"],
                "name": product["name"],
                "price": product["price"],
                "shop": product["shop"],
                "search_query": product.get("search_query", ""),
            })
    return context


def _request_personalization(profile, product_context, level):
    client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"), timeout=OPENAI_TIMEOUT_SECONDS)
    response = client.chat.completions.create(
        model=PERSONALIZATION_MODEL,
        messages=[
            {
                "role": "system",
                "content": """Du personalisierst einen bestehenden Online-Shop. Erzeuge nur kurze Texte und kurze Produktlabels.
Gib niemals vollstaendige Produktobjekte zurueck. Verwende nur die angegebenen Produkt-Indexnummern."""
            },
            {
                "role": "user",
                "content": f"""Profil:
{json.dumps(profile, ensure_ascii=False)}

Personalisierungs-Level: {level}/5

Produkte im Grundshop:
{json.dumps(product_context, ensure_ascii=False)}

Antworte NUR als JSON-Objekt in diesem Format:
{{
  "topBanner": "kurzer personalisierter Banner",
  "greeting": "Hallo, Name",
  "hero": {{"headline": "kurz", "subtext": "kurz", "cta": "kurz"}},
  "navCategories": ["max", "6", "kurze", "kategorien"],
  "sections": {{
    "recommendations": {{"title": "kurz", "subtitle": "kurz"}},
    "personal_picks": {{"title": "kurz", "subtitle": "kurz"}},
    "local": {{"title": "kurz", "subtitle": "kurz"}}
  }},
  "productCopy": [
    {{"index": 0, "personalLabel": "max 10 Woerter", "transparencyReason": "max 22 Woerter"}}
  ]
}}

Regeln:
- Schreibe auf Deutsch.
- Bei Level 5 darf die Personalisierung bewusst sehr spezifisch wirken.
- productCopy darf nur Indizes aus der Produktliste enthalten.
- Wiederhole keine Produktdaten wie name, image, price oder shop."""
            },
        ],
        response_format=JSON_RESPONSE_FORMAT,
        reasoning_effort=PERSONALIZATION_REASONING_EFFORT,
        max_completion_tokens=SHOP_TOKEN_LIMIT,
    )
    return parse_json_response(response, "Shop-Personalisierung")


def _apply_text(target, key, value, max_words):
    if isinstance(value, str) and value.strip():
        target[key] = _word_limit(value, max_words)


def _apply_personalization(shop, personalization):
    if not isinstance(personalization, dict):
        return

    _apply_text(shop["topBanner"], "personalized", personalization.get("topBanner"), 16)
    _apply_text(shop["greeting"], "personalized", personalization.get("greeting"), 8)

    hero = personalization.get("hero")
    if isinstance(hero, dict):
        _apply_text(shop["hero"]["personalized"], "headline", hero.get("headline"), 14)
        _apply_text(shop["hero"]["personalized"], "subtext", hero.get("subtext"), 18)
        _apply_text(shop["hero"]["personalized"], "cta", hero.get("cta"), 5)

    nav = personalization.get("navCategories")
    if isinstance(nav, list):
        cleaned = [_word_limit(item, 3) for item in nav if str(item).strip()]
        if cleaned:
            shop["navCategories"]["personalized"] = cleaned[:6]

    section_copy = personalization.get("sections")
    if isinstance(section_copy, dict):
        for section in shop["sections"]:
            copy = section_copy.get(section["id"])
            if not isinstance(copy, dict):
                continue
            _apply_text(section["title"], "personalized", copy.get("title"), 10)
            _apply_text(section["subtitle"], "personalized", copy.get("subtitle"), 16)

    products_by_index = {}
    for section in shop["sections"]:
        for product in section["products"]:
            products_by_index[product["_copy_index"]] = product

    product_copy = personalization.get("productCopy")
    if not isinstance(product_copy, list):
        return

    for item in product_copy:
        if not isinstance(item, dict):
            continue
        try:
            index = int(item.get("index"))
        except (TypeError, ValueError):
            continue
        product = products_by_index.get(index)
        if not product:
            continue
        _apply_text(product, "personalLabel", item.get("personalLabel"), 10)
        _apply_text(product, "transparencyReason", item.get("transparencyReason"), 22)


def _remove_internal_fields(shop):
    for section in shop["sections"]:
        for product in section["products"]:
            product.pop("_copy_index", None)


def build_shop(profile, products, level):
    normalized_products = _normalize_products(products)
    shop = _base_shop(profile, normalized_products, level)

    if level <= 1 or not normalized_products:
        _remove_internal_fields(shop)
        return shop

    try:
        personalization = _request_personalization(profile, _used_product_context(shop), level)
        _apply_personalization(shop, personalization)
    except Exception as e:
        print(f"Shop personalization fallback used: {e}")

    _remove_internal_fields(shop)
    return shop
