# Project Structure

```
careconnect/
├── public/
│   ├── favicon.svg
│   └── icons.svg
├── src/
│   ├── main.jsx              # React entry point, mounts <App />
│   ├── App.jsx               # Root component — auth state, Firestore subscription, view routing
│   ├── index.css             # Global styles (Tailwind base imports)
│   ├── assets/               # Static assets (images, svgs)
│   ├── firebase/
│   │   └── config.js         # Firebase app init; exports `auth` and `db`
│   └── components/
│       ├── Icons.jsx          # All SVG icons as named exports — no external icon library
│       ├── Navbar.jsx         # Sticky top nav; sign-out, user chip, auth buttons
│       ├── LandingPage.jsx    # Public marketing page with hero, features grid, CTA
│       ├── AuthModal.jsx      # Login / signup modal with role selection and Care Code input
│       ├── ElderlyDashboard.jsx  # Elderly user view: emergency button, check-in, medicines
│       └── FamilyDashboard.jsx   # Family view: status monitor, medicine management, activity log
├── index.html
├── vite.config.js
├── eslint.config.js
└── package.json
```

## Architecture Patterns

### View Routing
There is no router. `App.jsx` renders one of four views based on state:
1. Loading splash — `user === undefined` (auth initializing)
2. `<LandingPage />` — unauthenticated
3. `<ElderlyDashboard />` — `userProfile.role === 'elderly'`
4. `<FamilyDashboard />` — `userProfile.role === 'family'`

### Data Flow
- `App.jsx` owns all top-level state (`user`, `userProfile`, `groupData`)
- Firestore `onSnapshot` on `care_groups/{careCode}` keeps `groupData` live
- Dashboards receive data as props and call Firestore directly for writes (`updateDoc`, `arrayUnion`)

### Component Conventions
- All components are default exports, one per file
- Sub-components used only within a file are defined in the same file (e.g. `EmergencyPanel`, `AddMedicineForm` inside `FamilyDashboard.jsx`)
- Shared CSS class strings are extracted to `const` variables at the module level (e.g. `inputCls`, `labelCls`)
- Icons are all in `Icons.jsx` — add new icons there, never install an icon library

### Styling
- Tailwind utility classes only — no CSS modules, no styled-components
- Color palette: indigo/violet (primary), pink (accent), emerald (success/safe), red (emergency), slate (neutrals)
- Rounded corners: `rounded-xl` for inputs/small elements, `rounded-2xl` / `rounded-3xl` for cards and buttons
- Gradients used extensively for buttons (`from-indigo-600 to-violet-600`) and backgrounds
- Interactive elements always include `active:scale-95` and `focus-visible:outline-*` for accessibility

### Firebase Writes
- All Firestore mutations go through `updateDoc` with `arrayUnion` for appending to arrays
- Activity log entries always include: `{ type, emoji, message, time: ts(), id: Date.now() }`
- `ts()` helper returns a short locale time string — defined locally in each dashboard file
