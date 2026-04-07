# 🚀 Deployment: GitHub + Vercel (5 Minuten)

## Warum nicht GitHub Pages?

❌ **GitHub Pages** = nur statisches HTML (kein Python Backend)  
✅ **Vercel** = Static + Serverless Functions (Python Backend läuft sicher)

**Dein API Key bleibt geheim** weil OpenAI-Calls server-seitig laufen.

---

## Schritt-für-Schritt (kostenlos, 5 min)

### 1️⃣ Auf GitHub pushen

```bash
cd "C:\Users\ernes\Desktop\Prototyp Creepiness\nova-shop"

# Git initialisieren (falls noch nicht)
git init
git add .
git commit -m "NOVA Shop Prototyp fertig"

# Auf GitHub pushen
# Erstelle erst auf github.com ein neues Repository "nova-shop"
# Dann:
git remote add origin https://github.com/DEIN-USERNAME/nova-shop.git
git branch -M main
git push -u origin main
```

### 2️⃣ Mit Vercel verbinden

1. Gehe zu: https://vercel.com/signup
2. Klicke "Continue with GitHub"
3. Autorisiere Vercel

### 3️⃣ Projekt importieren

1. In Vercel Dashboard: **"Add New" → "Project"**
2. Wähle dein **"nova-shop"** Repository
3. Vercel erkennt automatisch die Config (aus `vercel.json`)
4. **WICHTIG**: Environment Variables hinzufügen:
   - Click "Environment Variables"
   - Name: `OPENAI_API_KEY`
   - Value: `sk-...dein_key` (von platform.openai.com)
   - Environments: Production, Preview, Development (alle 3 anhaken)
5. Klick **"Deploy"**

### 4️⃣ Fertig! 🎉

Nach ~2 Minuten:
- Bekommst du eine URL: `https://nova-shop-abc123.vercel.app`
- Öffne die URL → "Zum Fragebogen"
- Teste den kompletten Flow

---

## Auto-Deploy bei jedem Git Push

Ab jetzt: Jedes Mal wenn du `git push` machst, deployed Vercel automatisch!

```bash
# Änderung machen
git add .
git commit -m "Design angepasst"
git push

# Vercel deployed automatisch → neue Version in ~1-2 Minuten live
```

---

## Alternative: Vercel CLI (für Fortgeschrittene)

```bash
# Vercel CLI installieren
npm install -g vercel

# Einmalig: Projekt verbinden
vercel login
vercel

# API Key setzen
vercel env add OPENAI_API_KEY production
# Füge sk-... ein

# Production Deployment
vercel --prod
```

---

## ⚠️ Wichtig: API Key niemals committen!

Die `.gitignore` verhindert das bereits:
```
.env          # ← wird NICHT auf GitHub gepusht
.env.local
```

Dein API Key ist nur in Vercel Environment Variables → sicher! 🔒

---

## Kosten?

- **GitHub**: Kostenlos
- **Vercel**: Kostenlos (100GB Bandwidth, 100GB-Stunden Serverless)
- **OpenAI**: ~1-2 Cent pro Interview

**Für 10-20 Interviews: < €1 Gesamtkosten**

---

## Nächster Schritt

Folge den Schritten oben und teste dann:
1. Fragebogen ausfüllen
2. Moderator-Panel nutzen
3. Stages wechseln
4. Shop-Updates beobachten

✅ Wenn alles läuft → bereit für echte Interviews!
