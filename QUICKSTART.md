# 🚀 Schnellstart-Anleitung

## In 5 Minuten live gehen

### 1. OpenAI API Key besorgen

1. Gehe zu https://platform.openai.com/api-keys
2. Erstelle einen neuen API Key
3. Kopiere den Key (beginnt mit `sk-...`)
4. **Optional**: Lade Guthaben auf (~5€ reicht für 100+ Interviews)

### 2. Vercel Account erstellen

1. Gehe zu https://vercel.com/signup
2. Registriere dich (kostenlos mit GitHub)
3. Verifiziere deine E-Mail

### 3. Projekt deployen

**Option A: Mit Vercel CLI** (empfohlen für Entwickler)

```bash
# Vercel CLI installieren
npm install -g vercel

# In den Projektordner wechseln
cd nova-shop

# Git initialisieren (falls noch nicht geschehen)
git init
git add .
git commit -m "Initial commit"

# Deployen
vercel

# Bei der ersten Nutzung:
# - Link to existing project? No
# - Project name: nova-shop (oder eigener Name)
# - Which directory? ./ (Enter)

# Environment Variable setzen
vercel env add OPENAI_API_KEY production

# Füge deinen OpenAI Key ein und drücke Enter

# Production Deployment
vercel --prod
```

**Option B: Über GitHub + Vercel Dashboard** (empfohlen für Einsteiger)

```bash
# 1. Repository auf GitHub erstellen
# Gehe zu github.com → New Repository → "nova-shop"

# 2. Code pushen
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/DEIN-USERNAME/nova-shop.git
git push -u origin main

# 3. In Vercel Dashboard importieren
# - Gehe zu vercel.com/new
# - "Import Git Repository" → Wähle dein nova-shop Repo
# - Environment Variables → Add:
#   Key: OPENAI_API_KEY
#   Value: sk-...dein_key
# - Deploy klicken
```

### 4. Testen

Nach dem Deployment bekommst du eine URL wie:
```
https://nova-shop-xxx.vercel.app
```

1. Öffne die URL
2. Klicke "Zum Fragebogen"
3. Fülle die Fragen aus
4. Du wirst zum Moderator-Panel weitergeleitet
5. Kopiere den "Teilnehmer-Link" und öffne ihn in neuem Tab
6. Im Moderator-Panel: Wechsle zwischen Stages
7. Der Shop sollte sich automatisch updaten

### 5. Für Interviews nutzen

**Vor jedem Interview:**
1. Öffne `https://deine-url.vercel.app/fragebogen.html`
2. Teilnehmer füllt aus
3. Nach Submit: Moderator-Panel öffnet sich
4. Öffne Teilnehmer-Link in neuem Fenster (das sieht der Teilnehmer)
5. Wechsle Stages im Moderator-Panel während des Interviews

## ⚠️ Häufige Probleme

### "Session not found"
- Die Vercel Function hat möglicherweise neu gestartet
- **Lösung**: Neuen Fragebogen ausfüllen (Session wird neu erstellt)

### OpenAI Empfehlungen laden nicht
- Prüfe, ob `OPENAI_API_KEY` gesetzt ist: Vercel Dashboard → Dein Projekt → Settings → Environment Variables
- **Fallback**: System nutzt automatisch Fallback-Empfehlungen wenn OpenAI nicht verfügbar

### Shop aktualisiert sich nicht
- **Browser**: Drücke F12 → Network Tab → schaue auf Fehler
- **Vercel**: Dashboard → Functions → Logs → schaue auf Errors

### Kosten?
- **Vercel**: Kostenlos (Hobby Plan reicht)
- **OpenAI**: ~$0.01-0.02 pro Interview (bei 6-10 Interviews: <€1)

## 🎯 Bereit!

Du kannst jetzt mit den Interviews starten. Viel Erfolg! 🚀

Bei Problemen: Schaue ins README.md für Details.
