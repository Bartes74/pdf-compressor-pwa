### PDF Compressor PWA — Architecture Overview

This document describes the overall architecture, core modules, data flows, and extensibility points of the application.

#### Goals
- Client‑side PDF processing (no server upload)
- Non‑destructive operations: compress images, remove images while preserving text, split PDFs
- Responsive UX via progress reporting and background work where possible

#### High‑Level Layout
- `public/` — static shell (index, manifest, service worker)
- `src/js/` — application logic
  - `app.js` — entry point, state and orchestration
  - `ui-controller.js` — UI bindings and rendering
  - `engine/` — processing engines abstraction
    - `index.js` — factory selecting engine (query/localStorage flags)
    - `enhanced-engine.js` — non‑rasterizing logic for removal/compression/split
    - `legacy-engine.js` — fallback, minimal flow
  - `pdf-processor.js` — low‑level PDF operations using pdf-lib
  - `storage-manager.js` — persistence in IndexedDB (results/history)
  - `pdf-worker.js` — optional background worker (reserved)
- `src/css/` — styles and components

#### External Libraries
- `pdf-lib` — PDF manipulation (embed, copy pages, streams)
- `pdf.js` — optional rendering/analysis

#### Runtime Flow
1) User selects file → `app.js` validates and loads metadata via `pdf-processor.loadPDF`
2) User selects operation (compression/removal/split) → `engine.process` executes with progress callback
3) Engine delegates to `pdf-processor` functions (e.g., `compressImagesInMainThread`, `removeImagesPreserveText`, `splitByPagesFixed`, `splitBySize`)
4) Results returned as `File` or array of `File` → UI renders list with download actions

#### Engines Abstraction
- `createEngine(app)`: chooses `enhanced` or `legacy` using `?engine=` or localStorage
- `enhanced-engine`: implements
  - Remove Images (non‑rasterizing): first‑page trial + full removal (`removeImagesOnFirstPageWithoutRasterization`, `removeImagesPreserveText`)
  - Compress Images: traversal of page resources/XObjects (incl. Form XObjects), decode and re‑encode with heuristics and only if smaller
  - Split:
    - by pages (fixed pages per chunk)
    - by size (binary search per chunk, hard guard when min single‑page > limit; user error modal)

#### PDF Processor Responsibilities
- Initialization of pdf-lib, validation, metadata extraction
- Image analysis: estimate images (shallow/deep)
- Image removal: rewrite XObject dicts, clean content streams, rebuild doc to drop orphaned objects
- Image compression: recursive traversal, decode to ImageBitmap, optional downscale, JPEG re‑encode, replace only if smaller
- Split by pages: copy page ranges into new documents
- Split by size: iterative exponential + binary search to maximize pages under limit, with limit guard
- Optimize/save: `useObjectStreams: true`, optional compression flag to reduce size

#### UI Responsibilities
- `ui-controller.js`:
  - Tabs → processing options binding
  - Inputs: quality slider, split radios and inputs
  - Progress bar updates via `updateProgress`
  - Results list for multiple files (split)
  - Error modal: centered, blocking with OK

#### Error Handling
- Centralized try/catch in `app.processPDF`, shows error modal and hides progress
- Size‑split guard produces clear localized error

#### Extensibility
- Add new operation → implement in `pdf-processor.js`, expose via `enhanced-engine`, bind option in UI
- New engine variant → add under `src/js/engine/` and wire into `createEngine`
- Background processing → move heavy logic into `pdf-worker.js` and postMessage protocol

#### Security & Privacy
- No file upload; everything runs in browser
- IndexedDB optional storage; user controls downloads


