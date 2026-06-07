# Tech Stack

## Core

- **React 19** — UI framework (JSX, functional components, hooks only)
- **Vite 8** — build tool and dev server
- **Tailwind CSS v4** — utility-first styling via `@tailwindcss/vite` plugin (no config file)
- **Firebase 12** — backend (Auth + Firestore)

## Firebase Services

- **Firebase Auth** — email/password authentication (`createUserWithEmailAndPassword`, `signInWithEmailAndPassword`, `onAuthStateChanged`)
- **Cloud Firestore** — real-time database with live `onSnapshot` subscriptions

### Firestore Collections

| Collection | Doc ID | Purpose |
|---|---|---|
| `users` | `uid` | User profile: `name`, `email`, `role`, `careCode` |
| `care_groups` | `careCode` | Group data: `status`, `medicines[]`, `activity_logs[]`, `members[]`, `elderlyUid/Name/Email`, `createdAt` |

## Linting

- **ESLint 10** with `eslint-plugin-react-hooks` and `eslint-plugin-react-refresh`

## Common Commands

```bash
npm run dev        # Start dev server (Vite HMR)
npm run build      # Production build → dist/
npm run preview    # Preview production build locally
npm run lint       # Run ESLint
```

## Notes

- No TypeScript — plain `.jsx` / `.js` throughout
- No routing library — view switching is handled by conditional rendering in `App.jsx`
- No state management library — React `useState` / `useEffect` only
- No test framework configured
- Tailwind v4 is configured entirely through the Vite plugin; there is no `tailwind.config.js`
