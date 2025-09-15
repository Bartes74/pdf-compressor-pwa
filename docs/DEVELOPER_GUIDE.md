wypchnij xxxxxxxx### Developer Guide

This guide explains setup, development workflows, debugging, testing, and releasing.

#### Prerequisites

- Node.js 18+
- npm 9+

#### Install

```bash
npm ci
```

#### Run Dev

```bash
npm run dev
```

Serves the app with HMR at `http://localhost:3000` (per dev config).

#### Build

```bash
npm run build
```

Outputs to `dist/` with hashed assets.

#### Project Structure

- `src/js/app.js` — main app; do not add heavy logic here.
- `src/js/engine/` — engine layer; put new processing features behind engines.
- `src/js/pdf-processor.js` — low‑level PDF functions; keep pure and testable.
- `src/js/ui-controller.js` — event wiring and DOM updates only.

#### Adding a New Feature

1. Define option(s) in UI (tab, inputs) → update `ui-controller.js` to sync with `app.state.processingOptions`.
2. Implement processing in `pdf-processor.js` as a pure async function returning a new `PDFDocument` or `{ files: File[] }`.
3. Wire in `engine/enhanced-engine.js` under `process()` based on options.
4. Update `app.js` result handling if output shape changes (single vs. multiple files).

#### Progress Reporting

- Every long‑running method accepts `(progress) => { percentage, message }`.
- Keep updates between 0–100; reserve 90–100 for save/finishing.

#### Error Handling

- Throw `Error` with user‑friendly `message`; `app.js` catches and shows centered error modal.
- For size‑split, use guard messages in Polish.

#### Styling

- Add classes to `src/css/styles.css`.
- Avoid inline styles in JS; prefer class toggles.

#### Testing

- Unit tests in `src/tests/` (Jest). Run: `npm test`.
- E2E (Playwright) in `e2e/`. Run selectively when needed.
- Performance checks in `performance/`.

#### Linting

Run `npm run lint` (if configured). Keep code readable (see code style in repository).

#### Deployment

- Build artifacts in `dist/` are static. Host via Netlify/Vercel/Nginx.
- Service Worker in `public/service-worker.js` provides cache‑first offline.

#### Troubleshooting

- Libraries not loading: open DevTools console, run `window.loadPDFLibraries()`; check CDN scripts.
- “Minimalny rozmiar części …” during size split: raise limit or pre‑compress/remove images.
