import os
import json
from openai import OpenAI

def build_shop(profile, products, level):
    client = OpenAI(api_key=os.environ.get('OPENAI_API_KEY'))
    
    name = profile.get('name', 'Gast')
    city = profile.get('city', '')
    
    response = client.chat.completions.create(
        model="gpt-4.1-mini",
        messages=[
            {
                "role": "system",
                "content": """Du bist ein E-Commerce Personalisierungs-Experte. Du erstellst ein vollständiges Shop-JSON das einen personalisierten Online-Shop beschreibt.

Alle Texte sollen natürlich und professionell klingen, wie bei einem echten Shopify-Shop.
Für den transparenten Modus: Erklärungstexte sollen zeigen WOHER die Info kommt (aus dem Gespräch)."""
            },
            {
                "role": "user",
                "content": f"""Erstelle ein vollständiges Shop-JSON.

PROFIL DER PERSON:
{json.dumps(profile, ensure_ascii=False, indent=2)}

VERFÜGBARE ECHTE PRODUKTE:
{json.dumps(products, ensure_ascii=False, indent=2)}

PERSONALISIERUNGS-LEVEL: {level}/5
Level-Guide:
- 1 (Subtil): Nur Name im Greeting, sonst generisch
- 2 (Moderat): Name + Stadt, grobe Kategorien
- 3 (Stark): Interessen-spezifisch, persönliche Nachrichten
- 4 (Hyper): Cross-context, Lebenslage eingebaut, "Kunden wie du"
- 5 (Extrem): Beiläufig Erwähntes nutzen, sehr spezifische Anspielungen

Antworte NUR mit diesem JSON:
{{
    "topBanner": {{
        "generic": "Kostenloser Versand ab 50€ | 30 Tage Rückgaberecht",
        "personalized": "Text mit Name/Stadt falls Level >= 2"
    }},
    "greeting": {{
        "generic": "",
        "personalized": "Hallo, [Name]"
    }},
    "hero": {{
        "generic": {{
            "headline": "Frühjahr Kollektion 2026",
            "subtext": "Entdecke die neuesten Trends",
            "cta": "Jetzt shoppen"
        }},
        "personalized": {{
            "headline": "Personalisierte Headline",
            "subtext": "Personalisierter Subtext",
            "cta": "CTA Text"
        }}
    }},
    "navCategories": {{
        "generic": ["Neu", "Bestseller", "Mode", "Sport", "Tech", "Lifestyle"],
        "personalized": ["KI-generierte Kategorien basierend auf Interessen"]
    }},
    "sections": [
        {{
            "id": "recommendations",
            "title": {{
                "generic": "Unsere Empfehlungen",
                "personalized": "Personalisierter Titel z.B. '[Name], für dich ausgewählt'"
            }},
            "subtitle": {{
                "generic": "Die beliebtesten Produkte dieser Woche",
                "personalized": "Personalisierter Untertitel"
            }},
            "products": [
                {{
                    "name": "Echter Produktname aus der Produktliste",
                    "price": "Echter Preis",
                    "image": "Echte Bild-URL aus der Produktliste",
                    "shop": "Echter Shop-Name",
                    "rating": 4.5,
                    "reviews": 120,
                    "personalLabel": "Label nur für personalisierten Modus (z.B. 'Perfekt für dein Yoga')",
                    "transparencyReason": "Erklärung für transparenten Modus (z.B. 'Sie haben erwähnt, dass...')"
                }}
            ]
        }},
        {{
            "id": "personal_picks",
            "title": {{
                "generic": null,
                "personalized": "[Name], das könnte dir gefallen"
            }},
            "subtitle": {{
                "generic": null,
                "personalized": "Untertitel"
            }},
            "products": []
        }},
        {{
            "id": "local",
            "title": {{
                "generic": "Beliebt diese Woche",
                "personalized": "Beliebt in [Stadt]"
            }},
            "subtitle": {{
                "generic": "Was andere Kunden kaufen",
                "personalized": "Was Kunden in [Stadt] kaufen"
            }},
            "products": []
        }}
    ],
    "trustBadges": [
        {{
            "icon": "truck",
            "title": {{
                "generic": "Schneller Versand",
                "personalized": "Schneller Versand nach [Stadt]"
            }},
            "text": {{
                "generic": "1-3 Werktage",
                "personalized": "1-3 Werktage nach [Stadt]"
            }}
        }},
        {{
            "icon": "return",
            "title": {{"generic": "Einfache Rückgabe", "personalized": "Einfache Rückgabe"}},
            "text": {{"generic": "30 Tage kostenlos", "personalized": "30 Tage kostenlos"}}
        }},
        {{
            "icon": "lock",
            "title": {{"generic": "Sicherer Kauf", "personalized": "Sicherer Kauf"}},
            "text": {{"generic": "SSL verschlüsselt", "personalized": "SSL verschlüsselt"}}
        }}
    ]
}}

WICHTIG:
- Verwende NUR Produkte aus der verfügbaren Produktliste oben
- Kopiere name, price, image, shop EXAKT aus der Liste
- Verteile die Produkte sinnvoll auf die Sektionen
- Die "recommendations" Sektion soll 6-8 Produkte haben
- "personal_picks" soll 4 Produkte haben (nur bei Level >= 2)
- "local" soll 4 Produkte haben (nur bei Level >= 2)
- Bei Level 1: nur "recommendations" Sektion befüllen
- personalLabel und transparencyReason für JEDES Produkt schreiben"""
            }
        ],
        temperature=0.6,
        max_tokens=4000
    )
    
    content = response.choices[0].message.content.strip()
    
    if content.startswith('```'):
        content = content.split('```')[1]
        if content.startswith('json'):
            content = content[4:]
    if content.endswith('```'):
        content = content[:-3]
    
    return json.loads(content)
