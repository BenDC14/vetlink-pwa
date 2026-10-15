# VetLink PWA — Antigravity Workspace Guidelines

## 1. Project Overview & Architecture
VetLink is an AI-assisted veterinary skin disease diagnosis support and clinical triage Progressive Web Application (PWA).

* **Core Stack**: React 19 (`react`, `react-dom`), Vite 8, `vite-plugin-pwa`.
* **Local Storage / Offline Engine**: IndexedDB via `idb` library ([`database.js`](file:///c:/Users/russe/vetlink-pwa/src/db/database.js)).
* **Styling**: Vanilla CSS using CSS variables in [`index.css`](file:///c:/Users/russe/vetlink-pwa/src/index.css) and [`App.css`](file:///c:/Users/russe/vetlink-pwa/src/App.css) with built-in light/dark theme support.
* **Key Modules**: Clinic Analysis, Patient Records, Staff Management, Offline Synchronization, Triage & Treatment.

---

## 2. Offline-First Data & IndexedDB Rules
All local persistent state resides in IndexedDB (`vetlink_local_db`) defined in [`database.js`](file:///c:/Users/russe/vetlink-pwa/src/db/database.js).

1. **Schema Integrity**:
   * Stores (`patients`, `consultations`, `screeningResults`, `uploadedImages`, `syncQueue`, `syncConflicts`, etc.) rely on critical indexes: `syncStatus`, `version`, `updatedAt`, and `createdAt`.
   * **Never modify existing store schemas or delete indexes** without bumping `DB_VERSION` and writing a backwards-compatible `upgrade(db, oldVersion, newVersion)` migration block.
2. **Sync Queue Protocol**:
   * Whenever creating, updating, or deleting clinical records while offline, update `syncStatus: 'pending'` and enqueue the event into `syncQueue`.
   * When handling cloud sync resolution in [`Sync.jsx`](file:///c:/Users/russe/vetlink-pwa/src/pages/Sync.jsx), write detected conflicts to `syncConflicts` instead of overwriting local veterinary clinical data silently.
3. **Data Safety**:
   * Wrap all IndexedDB transactions and async database calls in `try...catch` blocks with clear UI feedback.
   * Generate robust client-side unique IDs (e.g. `crypto.randomUUID()` or timestamped prefixes) for newly created offline records.

---

## 3. Component & State Management Conventions
1. **Views Organization**:
   * Keep views organized inside [`src/pages/`](file:///c:/Users/russe/vetlink-pwa/src/pages/).
   * Individual view components should manage their own form state, validation, and presentation, while delegating top-level routing and authentication transitions cleanly.
2. **Image & Memory Management**:
   * Medical lesion images are uploaded from cameras or galleries in components like [`Clinic.jsx`](file:///c:/Users/russe/vetlink-pwa/src/pages/Clinic.jsx) and [`App.jsx`](file:///c:/Users/russe/vetlink-pwa/src/App.jsx).
   * **Always clean up preview URLs** with `URL.revokeObjectURL(previewUrl)` when an image changes or when the component unmounts to prevent memory leaks on mobile devices.
3. **React 19 Best Practices**:
   * Use modern functional components, standard hooks (`useState`, `useEffect`, `useCallback`, `useMemo`), and avoid deprecated lifecycle patterns.

---

## 4. Mobile & PWA UX Standards
* **Field-Ready Usability**: VetLink is designed for veterinary staff on tablets and mobile phones. Interactive touch targets (buttons, select inputs, inputs) must be at least 44×44px.
* **Offline Transparency**: Always provide clear visual indicators when the application is operating in offline mode or has pending sync items.
* **Consistent Design Tokens**: Use established CSS variables from [`src/index.css`](file:///c:/Users/russe/vetlink-pwa/src/index.css) (`--accent`, `--text`, `--text-h`, `--bg`, `--border`, `--shadow`) rather than hardcoding ad-hoc hex values.
* **Preserve Lean Footprint**: Avoid introducing heavy UI component libraries. Leverage clean Vanilla CSS with modular styling.

---

## 5. Development & Testing Workflow
* **Dev Server**: `npm run dev` (starts Vite with HMR).
* **Build Verification**: `npm run build` (validates React compilation and service worker manifest generation via `vite-plugin-pwa`).
* **Linting**: `npm run lint` (ESLint 10 check).

---

## 6. Interaction & Execution Guardrails
1. **Answer-First Behavior**:
   * When the user asks a question, seeks clarification, or inquires if a feature is ready/working (e.g., "can I do X?", "how does Y work?"), provide a direct, concise text answer.
   * Do NOT proactively edit files or run background/terminal commands unless the user explicitly requests an action (e.g., "build this", "fix this", "run the server", "apply the changes").
2. **Permission Courtesy**:
   * Never trigger terminal executions or command approval dialogs during purely conversational or informational queries.

