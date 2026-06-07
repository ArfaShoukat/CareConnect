# CareConnect — Product Overview

CareConnect is a real-time elderly care monitoring web app that connects elderly users with their family members through a shared "Care Circle."

## Core Concept

A unique **Care Code** (format: `CC-XXXX`) links an elderly user to their family group. All activity syncs live via Firestore — no refresh needed.

## User Roles

- **Elderly User** — simplified dashboard focused on safety actions
- **Family Member** — monitoring dashboard with management capabilities

## Key Features

| Feature | Elderly View | Family View |
|---|---|---|
| Emergency panic button | ✅ Trigger | ✅ Respond / resolve |
| Daily check-in | ✅ One-tap | ✅ View status |
| Medication reminders | ✅ Mark as taken | ✅ Add / remove |
| Activity log | — | ✅ Last 30 events |
| Care Code | ✅ Share | ✅ Display |

## Status States

`unknown` → `checked_in` / `emergency` → `safe` (resolved by family)

## Target Users

Non-technical elderly people who need simplicity, and family members who need real-time visibility without being physically present.
