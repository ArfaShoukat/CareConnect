# CareConnect 🏥

> Real-time elderly care platform connecting elderly users to their families through AI, live alerts, and geolocation tracking.

---

## Overview

CareConnect is a full-stack web application that links elderly loved ones to their family members through a shared **Care Circle**. It combines real-time Firebase synchronization, Groq AI health guidance, Twilio voice calls, and browser geolocation into a single secure, mobile-friendly app.

---

## Live Demo

```
npm run dev        → http://localhost:5173
npm run server     → http://localhost:3001 (voice call backend)
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + Vite 8 |
| Styling | Tailwind CSS v4 + Framer Motion |
| Database | Firebase Firestore (real-time) |
| Auth | Firebase Authentication (email/password) |
| AI Chat | Groq API — Llama 3.3 70B Versatile |
| Voice Calls | Twilio Voice SDK |
| Hospital Data | OpenStreetMap Overpass API (free, no key) |
| Backend | Node.js + Express |

---

## Project Structure

```
careconnect/
├── src/
│   ├── App.jsx                  # Auth state + Firestore routing
│   ├── main.jsx                 # React entry point
│   ├── index.css                # Tailwind base
│   ├── firebase/
│   │   └── config.js            # Firebase init (auth + db exports)
│   ├── components/
│   │   ├── LandingPage.jsx      # Public marketing page
│   │   ├── AuthModal.jsx        # Login / signup modal
│   │   ├── Navbar.jsx           # Sticky top navigation
│   │   ├── ElderlyDashboard.jsx # Elder-facing view
│   │   ├── FamilyDashboard.jsx  # Family-facing view
│   │   └── Icons.jsx            # All SVG icons (no external icon lib)
│   └── utils/
│       └── geoUtils.js          # Haversine formula + formatDistance
├── server/
│   ├── index.js                 # Express backend (Twilio + Groq)
│   ├── package.json
│   └── .env.example             # Backend env template
├── public/
│   └── favicon.svg
├── .env.local                   # Frontend env (Groq key)
└── package.json
```

---

## Features

### Elder Dashboard
- 🔴 **Emergency Panic Button** — writes SOS to Firestore, triggers AI voice call to family
- 💚 **Daily Check-In** — one-tap "I Am Feeling Fine Today" with instant family notification
- 🤖 **AI Health Guardian** — Groq-powered symptom chat in English, Urdu, and Roman Urdu with voice input
- 💊 **Medication Alarm System** — background scheduler fires spoken TTS reminders at scheduled times with full-screen animated overlay
- 📍 **Live Geo-Fence Broadcasting** — streams GPS to Firestore; detects safe zone breaches and logs them
- 🌐 **English / Urdu Language Toggle** — switches all dashboard labels between English and Urdu script

### Family Dashboard
- 🚨 **Real-Time Emergency Panel** — instant alert with audio siren, Web Push notification, and Twilio phone call
- 🗺 **Live Location Tracker** — elder GPS from Firestore with distance indicator, safe zone configuration, and Google Maps routing
- 🏥 **Nearby Emergency Hospitals** — OpenStreetMap finds real hospitals within 15 km; Groq adds triage notes per result
- ✏️ **Medicine Log with Inline Edit** — add, edit (animated inline form), and remove medicines; syncs to elder's alarm scheduler
- 🧠 **AI Health Companion Insights** — analyses logs for missed medicines and emergency patterns; predictive HIGH RISK badge
- 📊 **Medication Adherence Ring** — animated SVG circular progress showing taken/total percentage
- 📋 **Elder Activity Feed** — filtered to elder-only events (SOS, check-ins, symptoms, geo-breach); clearable by family

### Landing Page
- Animated two-column hero with ambient glow and floating status chip
- Problem stats strip, How It Works cards, feature grid, testimonials

---

## Emergency Data Flow

```
Elder presses SOS
  │
  ├─→ Firestore: status = 'emergency'         (instant sync)
  │
  ├─→ server/ POST /call-emergency            (fire-and-forget)
  │     ├─→ Groq: generate personalised voice script
  │     └─→ Twilio: place phone call to family
  │
  └─→ Family Dashboard (via Firestore onSnapshot)
        ├─→ Emergency panel appears
        ├─→ Web Audio siren plays in browser
        ├─→ Web Push notification fires
        └─→ speechSynthesis loops spoken alert
```

---

## Firestore Schema

### `users/{uid}`
```json
{
  "name": "Ahmed",
  "email": "ahmed@example.com",
  "role": "elderly | family",
  "careCode": "CC-A3BX",
  "phone": "+923001234567"
}
```

### `care_groups/{careCode}`
```json
{
  "careCode": "CC-A3BX",
  "elderlyUid": "...",
  "elderlyName": "Ahmed",
  "elderlyEmail": "...",
  "phone": "+923001234567",
  "status": "unknown | checked_in | safe | emergency",
  "medicines": [],
  "activity_logs": [],
  "members": [],
  "live_location": { "lat": 24.8607, "lng": 67.0011, "updated_at": "..." },
  "safe_lat": 24.8607,
  "safe_lng": 67.0011,
  "safe_radius_meters": 200,
  "is_breached": false,
  "createdAt": "..."
}
```

---

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Create `.env.local` in the project root:

```env
# Get a free key at https://console.groq.com/keys
VITE_GROQ_API_KEY=gsk_your_key_here
```

### 3. Configure the backend

```bash
cd server
cp .env.example .env
npm install
```

Fill in `server/.env`:

```env
GROQ_API_KEY=gsk_your_key_here
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1xxxxxxxxxx
PORT=3001
```

### 4. Run

```bash
# Terminal 1 — Vite frontend
npm run dev

# Terminal 2 — Express backend (for voice calls)
cd server && npm start
```

---

## Environment Variables Reference

| Variable | Where | Description |
|---|---|---|
| `VITE_GROQ_API_KEY` | `.env.local` | Groq API key for AI Health Guardian |
| `GROQ_API_KEY` | `server/.env` | Groq key for voice call script generation |
| `TWILIO_ACCOUNT_SID` | `server/.env` | Twilio account SID |
| `TWILIO_AUTH_TOKEN` | `server/.env` | Twilio auth token |
| `TWILIO_PHONE_NUMBER` | `server/.env` | Twilio outbound number (e.g. +15551234567) |

---

## Security Notes

- Twilio credentials **never** touch the frontend — they live only in `server/.env`
- Firebase config is intentionally public (Firestore security rules control access)
- Geo-fence breach does **not** auto-trigger `status: emergency` — only an explicit SOS button press can do that
- All API keys should be rotated before any public deployment

---

## Scripts

```bash
npm run dev       # Start Vite dev server (port 5173)
npm run build     # Production build → dist/
npm run preview   # Preview production build
npm run lint      # ESLint
```

---

## Built With ❤️ for families everywhere

© 2026 CareConnect
