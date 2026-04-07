# NOVA Shop - Creepiness Forschungsprototyp

Ein interaktiver Prototyp für die Erforschung von wahrgenommener Creepiness bei hyperpersonalisierten KI-basierten Produktempfehlungen im Online-Shopping.

## 📋 Überblick

Dieser Prototyp ermöglicht es, in semi-strukturierten Interviews verschiedene Stufen der Personalisierung zu testen:

- **Stage A (Baseline)**: Generische Bestseller ohne Personalisierung
- **Stage B (Moderat)**: Interessenbasierte Empfehlungen
- **Stage C (Hyperpersonalisiert)**: Sehr präzise, "creepy" Empfehlungen ohne Erklärung
- **Stage D (Transparent)**: Identisch zu C, aber mit Transparenz-Erklärungen

## 🏗️ Architektur

```
Frontend:
├── fragebogen.html    → Teilnehmer füllt Daten vor dem Interview aus
├── shop.html          → Fake-Shop für Teilnehmer
└── moderator.html     → Verstecktes Panel für Interview-Moderator

Backend (Serverless Functions):
├── /api/session       → Erstellt Session, generiert KI-Empfehlungen
├── /api/stage         → Gibt aktuelle Stage und Daten zurück
└── /api/set-stage     → Moderator wechselt Stage
```

## 🚀 Setup & Deployment

### Voraussetzungen

- [Vercel Account](https://vercel.com) (kostenlos)
- [OpenAI API Key](https://platform.openai.com/api-keys)
- Git installiert
- GitHub Account (optional, für Git-Deployment)

### Schritt 1: Repository vorbereiten

```bash
cd nova-shop
git init
git add .
git commit -m "Initial commit: NOVA Shop prototype"
```

Optional: Auf GitHub pushen für einfacheres Deployment.

### Schritt 2: Vercel CLI installieren (optional)

```bash
npm install -g vercel
```

Oder direkt über Vercel Dashboard deployen (ohne CLI).

### Schritt 3: Deployment über Vercel Dashboard

1. Gehe zu [vercel.com](https://vercel.com) und logge dich ein
2. Klicke auf "Add New" → "Project"
3. Importiere dein Git-Repository ODER wähle "Deploy from CLI"
4. Vercel erkennt automatisch die Konfiguration aus `vercel.json`
5. **Wichtig**: Setze Environment Variable:
   - Key: `OPENAI_API_KEY`
   - Value: Dein OpenAI API Key (sk-...)
6. Klicke "Deploy"

### Schritt 4: Deployment über CLI (Alternative)

```bash
cd nova-shop
vercel
```

Folge den Prompts. Beim ersten Deployment:
- Project name: `nova-shop` (oder eigener Name)
- Environment Variables setzen:

```bash
vercel env add OPENAI_API_KEY
```

Füge deinen OpenAI API Key ein.

Dann erneut deployen:

```bash
vercel --prod
```

### Lokales Testen (ohne Deployment)

Für lokale Tests kannst du einen einfachen Python-Server verwenden:

1. Erstelle `.env` Datei:
```
OPENAI_API_KEY=sk-...dein_key
```

2. Installiere Dependencies:
```bash
pip install -r requirements.txt
```

3. Für lokales Testen benötigst du einen lokalen Server, der die API-Routes handhabt. 
   **Hinweis**: Die Vercel Serverless Functions sind für lokales Testen kompliziert. 
   Am einfachsten: Direkt auf Vercel deployen (kostenlos).

## 📖 Nutzung im Interview

### Ablauf:

1. **Vor dem Interview**: 
   - Öffne `https://deine-url.vercel.app/fragebogen.html`
   - Teilnehmer füllt Fragebogen aus
   - System generiert Session-ID und KI-Empfehlungen

2. **Nach Fragebogen**:
   - Automatische Weiterleitung zum Moderator-Panel
   - Kopiere "Teilnehmer-Link" und öffne ihn in einem neuen Tab/Fenster
   - Das ist der Fake-Shop, den der Teilnehmer sieht

3. **Während des Interviews**:
   - Moderator-Panel: Wechsle zwischen Stages (A/B/C/D)
   - Shop aktualisiert sich automatisch alle 2 Sekunden
   - Stelle Fragen basierend auf der aktuellen Stage

### Beispiel-Interviewfragen pro Stage:

**Stage A (Baseline)**:
- "Was denken Sie über diese Empfehlungen?"
- "Wie relevant sind diese für Sie?"

**Stage B (Moderat)**:
- "Fühlen sich diese Empfehlungen passender an?"
- "Ist die Personalisierung hier angenehm oder unangenehm?"

**Stage C (Hyperpersonalisiert)**:
- "Was fällt Ihnen auf?"
- "Wie fühlen Sie sich, wenn Sie diese sehen?"
- "Woher könnte der Shop diese Informationen haben?"

**Stage D (Transparent)**:
- "Hat die Erklärung Ihre Wahrnehmung verändert?"
- "Fühlt sich das besser oder schlechter an als vorher?"

## 🔧 Troubleshooting

### API-Empfehlungen werden nicht geladen
- Prüfe, ob `OPENAI_API_KEY` in Vercel Environment Variables gesetzt ist
- Schaue in Vercel Logs: Dashboard → Dein Projekt → Functions → Logs
- Falls OpenAI nicht funktioniert, nutzt das System Fallback-Empfehlungen

### Shop zeigt keine personalisierten Produkte
- Stelle sicher, dass der Fragebogen vollständig ausgefüllt wurde
- Prüfe Browser Console (F12) auf JavaScript-Fehler
- Lade die Seite neu (Session-Daten bleiben im Arbeitsspeicher während der Vercel-Instanz läuft)

### Session "not found" nach einiger Zeit
- Vercel Functions sind stateless - Sessions werden im Arbeitsspeicher gehalten
- Bei Inaktivität kann die Function "cold start" machen und Sessions verlieren
- **Lösung für Produktion**: Redis oder Datenbank für Session-Storage nutzen
- **Für Interviews**: Sessions bleiben aktiv während eines Interviews (ca. 30-60 min)

## 🔒 Datenschutz & Ethik

- **Keine echten Produkte**: Alle Produkte sind fiktiv
- **Kein Tracking**: Keine Cookies, keine Analytics
- **Session-Daten**: Werden nur temporär im Serverless-Speicher gehalten
- **Debriefing**: Nach dem Interview den Mechanismus erklären
- **DSGVO**: Teilnehmer willigen ein, Fragebogen-Daten werden nur für das Interview genutzt

## 📊 Wissenschaftliche Hinweise

### Konstante Bedingungen:
- Shop-Design und Basis-Produkte sind für alle Teilnehmer identisch
- Nur Stage C/D Inhalte sind individualisiert
- Reihenfolge der Stages sollte dokumentiert werden

### Protokollierung:
Für die Auswertung kannst du notieren:
- Welche Stage war aktiv bei welcher Teilnehmer-Aussage
- Nonverbale Reaktionen beim Wechsel zu Stage C
- Wann wurde Unbehagen/Creepiness erstmals verbalisiert

### Vergleichbarkeit:
- Nutze dieselbe Stage-Reihenfolge für alle Interviews (z.B. A→B→C→D)
- Oder randomisiere die Reihenfolge und dokumentiere sie

## 🛠️ Erweiterte Anpassungen

### OpenAI Prompt anpassen
Editiere `api/session.py`, Funktion `generate_recommendations()`.

### Weitere Stages hinzufügen
1. Füge Stage E in `api/set-stage.py` hinzu
2. Erweitere `public/js/shop.js` um Stage E Rendering
3. Füge Button in `moderator.html` hinzu

### Design anpassen
Editiere `public/css/style.css` für Farben, Layouts etc.

## 📄 Lizenz & Nutzung

Dieser Prototyp wurde für die Bachelorarbeit von Ernest Are entwickelt.
Nutzung für akademische Forschung erlaubt. Bei Weiterverwendung bitte zitieren.

## 📬 Support

Bei Fragen oder Problemen während der Implementierung:
- Prüfe Vercel Function Logs
- Teste mit Browser Console (F12 → Network Tab)
- Stelle sicher, dass alle Dateien korrekt deployed wurden

---

**Viel Erfolg bei den Interviews! 🎓**
