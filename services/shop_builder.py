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


SIGNAL_LABELS = {
    "name": "Name",
    "city": "Stadt",
    "interests": "Interessen",
    "shopping_habits": "Shopping-Verhalten",
    "brands": "Genannte Marken",
    "life_events": "Aktuelle Lebenslage",
    "price_sensitivity": "Budgethinweis",
    "mentioned_products": "Erwähnte Produkte",
    "subtle_details": "Beiläufige Aussage",
    "keywords": "Interview-Keywords",
}


def _collect_used_signals(profile, level):
    keys_by_level = {
        1: [],
        2: ["name", "city", "interests"],
        3: ["name", "city", "interests", "price_sensitivity", "brands", "shopping_habits"],
        4: ["name", "city", "interests", "price_sensitivity", "brands", "shopping_habits", "mentioned_products", "life_events"],
        5: ["name", "city", "interests", "price_sensitivity", "brands", "shopping_habits", "mentioned_products", "life_events", "subtle_details"],
    }
    signals = []
    for key in keys_by_level.get(level, keys_by_level[3]):
        value = profile.get(key)
        if value is None or value == "null" or value == []:
            continue
        if isinstance(value, list):
            display = ", ".join(str(item).strip() for item in value[:3] if str(item).strip())
        else:
            display = str(value).strip()
        if not display:
            continue
        signals.append({
            "key": key,
            "label": SIGNAL_LABELS.get(key, key),
            "value": display,
            "sensitivity": "high" if key in ("life_events", "subtle_details") else "normal",
        })
    return signals


def _signal_values(signals):
    return [signal["value"] for signal in signals if signal.get("value")]


def _creepy_detail(profile):
    return _first_profile_item(profile, ["subtle_details", "life_events", "mentioned_products", "shopping_habits"])


def _stage_metadata(level):
    labels = {
        1: ("Baseline", "Neutraler Grundshop ohne sichtbare Interviewdetails."),
        2: ("Harmlos personalisiert", "Name, Stadt und grobe Interessen werden sichtbar."),
        3: ("Deutlich personalisiert", "Mehrere Interviewsignale werden kombiniert."),
        4: ("Hyperpersonalisiert", "Cross-Context aus Interviewaussagen wird angedeutet."),
        5: ("Creepy Peak", "Genau ein beiläufiger Interviewmoment wird sichtbar aufgegriffen."),
    }
    label, description = labels.get(level, labels[3])
    return {
        "level": level,
        "label": label,
        "description": description,
        "dimensions": ["Treffsicherheit", "Datensensitivität", "Transparenz", "Kontrolle", "Beobachtungsgefühl"],
        "stageScripts": {
            "generic": {
                "goal": "Baseline-Reaktion ohne Priming erfassen.",
                "questions": [
                    "Was fällt dir zuerst auf?",
                    "Wie normal oder glaubwürdig wirkt die Seite?",
                    "Was wirkt passend, was unpassend?"
                ]
            },
            "personalized": {
                "goal": "Treffsicherheit und vermutete Datengrundlage herausarbeiten.",
                "questions": [
                    "Welche Empfehlungen wirken auf dich zugeschnitten?",
                    "Woher glaubst du, hat das System diese Informationen?",
                    "Gab es etwas, das fast zu gut gepasst hat?"
                ]
            },
            "transparent": {
                "goal": "Transparenz, Kontrolle und mögliche Übertransparenz prüfen.",
                "questions": [
                    "Hilft dir die Erklärung oder macht sie es unangenehmer?",
                    "Welche Informationen sollte ein Shop nicht nutzen?",
                    "Was würdest du gern selbst steuern oder ausschalten?"
                ]
            }
        }
    }


def _control_options(level, signals):
    """Realistische Kontrollcenter-Optionen (Toggles), wie man sie in einem
    echten Datenschutz-/Personalisierungscenter erwarten wuerde."""
    signal_keys = {signal["key"] for signal in signals}
    return [
        {
            "id": "location",
            "label": "Standort verwenden",
            "description": "Empfehlungen und Lieferhinweise auf Stadt/Region abstimmen.",
            "enabled": level >= 2 and "city" in signal_keys,
        },
        {
            "id": "interests",
            "label": "Interessen verwenden",
            "description": "Im Interview genannte Interessen für die Produktauswahl nutzen.",
            "enabled": level >= 2,
        },
        {
            "id": "interview_details",
            "label": "Interviewdetails verwenden",
            "description": "Aussagen aus dem Gespräch für Produktauswahl und Texte nutzen.",
            "enabled": level >= 3,
        },
        {
            "id": "subtle_mentions",
            "label": "Beiläufig Erwähntes verwenden",
            "description": "Auch nebenbei erwähnte Details in Empfehlungen einbeziehen.",
            "enabled": level >= 5 and "subtle_details" in signal_keys,
        },
        {
            "id": "similar_customers",
            "label": "Ähnliche Kunden verwenden",
            "description": "Dein Profil mit ähnlichen Einkaufsmustern vergleichen.",
            "enabled": level >= 4,
        },
        {
            "id": "browsing_history",
            "label": "Klick- und Ansichtsverlauf verwenden",
            "description": "Verhalten im Shop für die Reihenfolge der Produkte berücksichtigen.",
            "enabled": True,
        },
        {
            "id": "ads_personalization",
            "label": "Personalisierte Werbung",
            "description": "Werbliche Hinweise und Banner auf dein Profil zuschneiden.",
            "enabled": level >= 3,
        },
    ]


def _control_actions(level):
    """Einmalige Steuerungs-Aktionen (Buttons), wie sie in einem
    Kontrollcenter zusätzlich zu den Schaltern vorkommen können."""
    return [
        {
            "id": "pause_personalization",
            "label": "Personalisierung pausieren",
            "description": "Den Shop vorübergehend ohne jede Personalisierung anzeigen.",
        },
        {
            "id": "less_category",
            "label": "Weniger Produkte dieser Art",
            "description": "Ähnliche Empfehlungen künftig seltener anzeigen.",
        },
        {
            "id": "reset_profile",
            "label": "Profildaten zurücksetzen",
            "description": "Alle aus dem Gespräch abgeleiteten Daten löschen.",
        },
        {
            "id": "view_data",
            "label": "Meine gespeicherten Daten ansehen",
            "description": "Übersicht aller Signale anzeigen, die der Shop nutzt.",
        },
    ]


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


def _default_product_copy(product, profile, level, copy_index):
    """Liefert (personalLabel, transparencyReason).

    - personalLabel: kurzer, dezenter Hinweis. Wird in der personalisierten UND
      der transparenten Ansicht gezeigt. Verraet NICHT die Datengrundlage.
    - transparencyReason: ehrliche Erklaerung der Datengrundlage. Wird NUR in der
      transparenten Ansicht (und im Erklaer-Fenster) gezeigt.
    """
    detail = _creepy_detail(profile)
    query = product.get("search_query")

    if level >= 5 and copy_index == 0 and detail:
        return (
            "Speziell für dich ausgewählt",
            f"Diese Empfehlung greift ein Detail aus deinem Gespräch auf: {detail}."
        )
    if level >= 4 and query:
        return (
            "Passend zu deinen Interessen",
            f"Diese Empfehlung wurde aus deinem abgeleiteten Suchkontext gebildet: {query}."
        )
    if level >= 2:
        return (
            "Für dich empfohlen",
            "Diese Empfehlung basiert auf den Interessen, die du im Interview genannt hast."
        )

    return "", ""


def _build_product(product, profile, level, copy_index):
    personal_label, transparency_reason = _default_product_copy(product, profile, level, copy_index)
    result = dict(product)
    result["_copy_index"] = copy_index
    result["personalLabel"] = _word_limit(personal_label, 10)
    result["transparencyReason"] = _word_limit(transparency_reason, 24)
    result["whyDetails"] = transparency_reason
    result["signalKeys"] = ["interests", "keywords"] if level >= 2 else []
    result["isCreepyMoment"] = level >= 5 and copy_index == 0 and bool(_creepy_detail(profile))
    return result


def _split_products(products, profile, level):
    if level <= 1:
        return {
            "recommendations": [
                _build_product(product, profile, level, index)
                for index, product in enumerate(products[:12])
            ],
            "personal_picks": [],
            "local": [],
        }

    selected = products[:20]
    rec_count = 8 if len(selected) > 10 else min(len(selected), 8)
    sections = {
        "recommendations": selected[:rec_count],
        "personal_picks": selected[rec_count:rec_count + 6],
        "local": selected[rec_count + 6:rec_count + 12],
    }

    copy_index = 0
    decorated = {}
    for section_id, section_products in sections.items():
        decorated[section_id] = []
        for product in section_products:
            decorated[section_id].append(_build_product(product, profile, level, copy_index))
            copy_index += 1

    return decorated


def _build_generic_sections(generic_products):
    """Baut neutrale Baseline-Sektionen aus NICHT personalisierten Produkten.

    Diese Produkte unterscheiden sich bewusst von den personalisierten
    Empfehlungen, damit Generic- und Personalisiert-Ansicht echt verschieden sind.
    """
    normalized = _normalize_products(generic_products)
    if not normalized:
        return []

    chunks = [
        ("generic_bestseller", "Bestseller diese Woche", "Die beliebtesten Produkte unserer Kundinnen und Kunden", normalized[:8]),
        ("generic_new", "Neu eingetroffen", "Frisch in unserem Sortiment", normalized[8:14]),
        ("generic_deals", "Beliebte Angebote", "Lohnenswerte Produkte rund um Alltag und Freizeit", normalized[14:20]),
    ]

    sections = []
    for section_id, title, subtitle, items in chunks:
        if not items:
            continue
        clean_items = []
        for product in items:
            entry = dict(product)
            entry["personalLabel"] = ""
            entry["transparencyReason"] = ""
            entry["whyDetails"] = ""
            entry["signalKeys"] = []
            entry["isCreepyMoment"] = False
            clean_items.append(entry)
        sections.append({
            "id": section_id,
            "title": title,
            "subtitle": subtitle,
            "products": clean_items,
        })
    return sections


def _base_shop(profile, products, level, generic_products=None):
    name = _profile_value(profile, "name", "Gast")
    city = _profile_value(profile, "city")
    interest = _first_profile_item(profile, ["interests", "mentioned_products", "keywords"])
    signals = _collect_used_signals(profile, level)
    creepy_detail = _creepy_detail(profile)
    section_products = _split_products(products, profile, level)
    generic_sections = _build_generic_sections(generic_products or [])

    personalized_banner = "Kostenloser Versand ab 50 EUR | 30 Tage Rückgaberecht"
    if level >= 2 and city:
        personalized_banner = f"Kostenloser Versand nach {city} | 30 Tage Rückgaberecht"

    hero_focus = interest or "deinen Alltag"
    hero_headline = f"Ausgewählt für {hero_focus}"
    if level >= 5 and creepy_detail:
        hero_headline = f"{name}, für dich kuratiert"

    creepy_moment = None
    if level >= 5 and creepy_detail:
        creepy_moment = {
            "productIndex": 0,
            "signal": creepy_detail,
            "headline": "Auch kurz Erwähntes fließt ein",
            "text": f"Auch wenn du es nur kurz erwähnt hast: {creepy_detail} wurde bei diesen Empfehlungen berücksichtigt."
        }

    return {
        "level": level,
        "topBanner": {
            "generic": "Kostenloser Versand ab 50 EUR | 30 Tage Rückgaberecht",
            "personalized": personalized_banner,
        },
        "greeting": {
            "generic": "",
            "personalized": f"Hallo, {name}" if name else "Hallo",
        },
        "hero": {
            "generic": {
                "headline": "Frühjahr Kollektion 2026",
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
        "genericSections": generic_sections,
        "sections": [
            {
                "id": "recommendations",
                "title": {
                    "generic": "Unsere Empfehlungen",
                    "personalized": f"{name}, für dich ausgewählt",
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
                    "personalized": f"{name}, das könnte dir gefallen",
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
                    "personalized": f"Beliebt in {city}" if city else "Beliebt bei ähnlichen Kunden",
                },
                "subtitle": {
                    "generic": "Was andere Kunden kaufen",
                    "personalized": "Was zu deinem Kontext passen könnte",
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
                "title": {"generic": "Einfache Rückgabe", "personalized": "Einfache Rückgabe"},
                "text": {"generic": "30 Tage kostenlos", "personalized": "30 Tage kostenlos"},
            },
            {
                "icon": "lock",
                "title": {"generic": "Sicherer Kauf", "personalized": "Sicherer Kauf"},
                "text": {"generic": "SSL verschlüsselt", "personalized": "SSL verschlüsselt"},
            },
        ],
        "usedSignals": signals,
        "creepyMoment": creepy_moment,
        "explanationDetails": {
            "summary": "Dieser Shop wurde aus dem Interviewprofil und echten Shopping-Ergebnissen zusammengestellt.",
            "dataBasis": _signal_values(signals),
            "transparentIntro": "Genutzte Signale aus dem Interview",
            "productIntro": "Warum dieses Produkt angezeigt wird"
        },
        "controlOptions": _control_options(level, signals),
        "controlActions": _control_actions(level),
        "stageMetadata": _stage_metadata(level),
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
Gib niemals vollständige Produktobjekte zurück. Verwende nur die angegebenen Produkt-Indexnummern.
Verwende immer korrekte deutsche Umlaute (ä, ö, ü, ß) statt ae, oe, ue, ss."""
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
    {{"index": 0, "personalLabel": "max 10 Wörter", "transparencyReason": "max 22 Wörter"}}
  ]
}}

Regeln:
- Schreibe auf Deutsch mit korrekten Umlauten (ä, ö, ü, ß).
- personalLabel ist ein dezenter, verkaufsorientierter Hinweis und darf NICHT verraten, woher die Daten stammen.
- transparencyReason erklärt ehrlich die Datengrundlage (z. B. genannte Interessen oder Suchkontext).
- Bei Level 5 darf transparencyReason für Produktindex 0 einen beiläufigen oder invasiven Moment offenlegen.
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
        _apply_text(product, "transparencyReason", item.get("transparencyReason"), 24)
        reason = item.get("transparencyReason")
        if isinstance(reason, str) and reason.strip():
            product["whyDetails"] = reason.strip()


def _remove_internal_fields(shop):
    for section in shop["sections"]:
        for product in section["products"]:
            product.pop("_copy_index", None)
    for section in shop.get("genericSections", []):
        for product in section["products"]:
            product.pop("_copy_index", None)


def build_shop(profile, products, level, generic_products=None):
    normalized_products = _normalize_products(products)
    shop = _base_shop(profile, normalized_products, level, generic_products)

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
