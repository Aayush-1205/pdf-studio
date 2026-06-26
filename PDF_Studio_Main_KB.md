# 📚 PDF Studio — Main Knowledge Base (KB)

**Repository:** [github.com/Aayush-1205/pdf-studio](https://github.com/Aayush-1205/pdf-studio)
**KB Type:** Main / Project-Level Knowledge Base
**Last Updated:** June 27, 2026
**Maintained By:** Active Development Team

---

## ⚠️ IMPORTANT NOTE FOR ALL CONTRIBUTORS

> **This is the Main Knowledge Base for PDF Studio.**
>
> Whenever a **major update** is made to the codebase — such as adding a new feature, introducing a new module, changing a core API route, replacing a major library, or restructuring the folder architecture — **the contributing agent or developer MUST update this KB accordingly**.
>
> Updates should reflect:
> - Any new module/feature added and which files/components/APIs it covers
> - Any component, hook, store, or worker that is modified significantly
> - Any changes to third-party library integrations
> - Any change to the authentication or cloud sync flow
>
> Additional, feature-specific Knowledge Bases may exist alongside this one (e.g., KB for the Canvas Editor, KB for Google Drive, KB for the PDF Worker Engine). Those KBs cover individual modules in depth. **This Main KB is the single source of truth for project-wide architecture and module-to-file mapping.**

---

## 🧭 Brief Project Description

**PDF Studio** is a professional, browser-based PDF editing and cloud management suite built with **Next.js 16 (App Router, Turbopack)** and **TypeScript**. It goes beyond simple PDF viewing — it enables users to permanently mutate PDF binary files directly in the browser using a rich annotation and editing toolkit. Edited PDFs are "baked" (permanently written) using `pdf-lib` and `pdfjs-dist`, with all heavy processing offloaded to **Web Workers** via `Comlink` to keep the UI responsive.

The application supports user authentication via **Clerk**, bidirectional **Google Drive** integration for cloud import/export, and a **Virtual File System (VFS)** backed by **IndexedDB** (`idb-keyval`) for browser-side persistence — so users can resume unfinished work even after closing the tab.

The editor canvas is built on **React Konva** (powered by `konva`) with **Zustand** for global state management and a robust undo/redo history stack. The UI is composed using **Radix UI**, **shadcn/ui**, **Tailwind CSS v4**, and **Lucide React** icons.

**Core Tech Stack at a Glance:**

| Category | Technologies |
|---|---|
| Framework | Next.js 16, React 19, TypeScript 5 |
| PDF Processing | `pdf-lib`, `pdfjs-dist`, `@pdf-lib/fontkit`, `fontkit` |
| Canvas & Drawing | `react-konva`, `konva`, `perfect-freehand` |
| State Management | `zustand` |
| Auth & Cloud | `@clerk/nextjs`, `googleapis` |
| Persistence | `idb-keyval` (IndexedDB) |
| Drag & Drop | `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` |
| UI Components | `radix-ui`, `shadcn`, `lucide-react`, `tailwindcss v4` |
| Worker Bridge | `comlink` |
| File Upload | Custom `UploadZone`, `react-easy-crop` (image cropping) |
| Word Import | `mammoth` (DOCX to HTML to PDF) |

---

## 🗂️ Module / Feature → Component / API / File Mapping

---

### 1. 🏠 Landing Page & Entry Point

**Purpose:** The public homepage where users can upload PDFs, access tools, and navigate to other sections.

| File/Component | Role |
|---|---|
| `app/page.tsx` | Main landing page — tool cards, file upload handler, navigation to editor/drive |
| `components/shared/Navbar.tsx` | Top navigation bar — links, auth state (Clerk), branding |
| `components/shared/ToolCard.tsx` | Reusable card component representing each PDF tool on the landing page |
| `components/shared/UploadZone.tsx` | Drag-and-drop file upload area — triggers navigation to `/editor` on file select |
| `components/pdf/LocalUploadModal.tsx` | **[NEW — commit ee9c87c]** Modal for local PDF file upload — handles drag-and-drop or click-to-browse, reads file as `ArrayBuffer`, initializes `useCanvasStore` with PDF bytes + extracted pages/text layers via `extractPdfPages()`, then redirects to `/editor?mode=edit`; renders via `createPortal` into `document.body` |
| `app/layout.tsx` | Root layout — wraps the app with ClerkProvider, sets global fonts and metadata |
| `app/globals.css` | Global Tailwind v4 CSS — theme variables, base styles, utility overrides |

---

### 2. ✏️ PDF Editor Module

**Purpose:** The main PDF editing workspace where users annotate, draw, add text, shapes, and images — then export a baked PDF.

#### Route & Page

| File | Role |
|---|---|
| `app/editor/page.tsx` | The `/editor` route — renders the full editor UI shell, loads PDF from IndexedDB state |

#### Canvas & Editor Components

| File | Role |
|---|---|
| `components/editor/Canvas.tsx` | Core rendering surface — hosts all Konva layers |
| `components/editor/LayerComponent.tsx` | Thin layer dispatcher routing props to specialized sub-renderers |
| `components/editor/renderers/ShapeLayer.tsx` | Renders standard vector shapes (rectangles, ellipses, lines, arrows) |
| `components/editor/renderers/TextLayer.tsx` | Renders customizable text layer nodes |
| `components/editor/renderers/ImageLayer.tsx` | Renders image layers with filters and non-destructive crops |
| `components/editor/renderers/PathLayer.tsx` | Renders freehand drawings |
| `components/editor/controllers/useCanvasPointerController.ts` | Orchestrates stage pointer events, drawing mode, and tools insertion |
| `components/editor/SelectionBox.tsx` | Transformer/selection box for resizing and rotating selected layers |
| `components/editor/LeftSidebar.tsx` | Tool picker panel — exposes all annotation tools |
| `components/editor/RightPropertyPanel.tsx` | Context-aware property inspector — dynamically shows font, color, opacity, size controls |
| `components/editor/BottomToolbar.tsx` | Bottom bar — zoom controls, page navigation, undo/redo buttons |
| `components/editor/DocumentStats.tsx` | Shows document metadata — page count, current page, file size info |

#### PDF Viewer & Thumbnails

| File | Role |
|---|---|
| `components/pdf/PDFViewer.tsx` | Renders PDF pages as rasterized canvas backgrounds using `pdfjs-dist` |
| `components/pdf/ThumbnailSidebar.tsx` | Left-side panel showing draggable page thumbnails using `dnd-kit` |
| `components/pdf/SortablePageThumbnail.tsx` | Individual sortable thumbnail — uses `@dnd-kit/sortable` to enable page drag-and-drop reordering |
| `components/pdf/PropertyInspector.tsx` | Alternative/overlay property inspector for PDF-layer-specific properties |

#### State Management (Editor)

| File | Role |
|---|---|
| `app/store/usePDFStore.ts` | Primary Zustand store — holds PDF bytes, page list, active tool, zoom level, overlay items, undo/redo history stack, and IndexedDB auto-save logic |
| `store/useCanvasStore.ts` | Combined composition facade bridging document, interaction, and history states |
| `store/editor/useDocumentStore.ts` | Document data store managing persistent layers, pages, selection, and document mutations |
| `store/editor/useInteractionStore.ts` | Interaction store managing transient UI state (translating, resizing, guides, Alt key pressed) |
| `store/editor/useHistoryStore.ts` | History store managing the linear command-based past/future stacks for undo and redo |

#### Hooks

| File | Role |
|---|---|
| `hooks/useExportPDF.ts` | Export hook — reads canvas store state, maps all Konva layers to `BakeOverlay` types, assembles base PDF via `pdf-lib`, sends data to Web Worker for final baking |
| `hooks/usePDFWorker.ts` | Worker lifecycle hook — initializes the `pdf.worker.ts` via Comlink, exposes worker methods to React components |

#### Library Utilities

| File | Role |
|---|---|
| `app/lib/overlayTypes.ts` | TypeScript discriminated union types for all bake overlay kinds — `BakeTextOverlay`, `BakeImageOverlay`, `BakeRectangleOverlay`, `BakeDrawingOverlay`, `BakeShapeOverlay` |
| `app/lib/pdfUtils.ts` | Helper functions — hex to RGB conversion (`hexToRgb01`), SVG path generation from freehand stroke (`getSvgPathFromStroke`), coordinate math |
| `app/lib/pdfRender.ts` | PDF page rendering helpers — wraps `pdfjs-dist` to render PDF pages to HTML canvases or blob URLs |
| `app/lib/ocr.ts` | OCR utility — text extraction layer (potentially using `pdfjs-dist` text layer) |
| `lib/coordinates.ts` | Bounding-rect container-aware coordinate space conversion |
| `lib/editor/pageLayout.ts` | Centralized page height stacking and page offset conversion math |
| `lib/utils.ts` | General utility functions — `cn()` class merge helper (using `clsx` + `tailwind-merge`) |

#### Web Workers

| File | Role |
|---|---|
| `workers/pdf.worker.ts` | Primary background worker — receives `BakeOverlay` array and base PDF bytes, burns all overlays permanently into PDF using `pdf-lib`; handles page merge, rotate, and bake operations |
| `workers/pdfAssembler.worker.ts` | Secondary assembler worker — handles multi-file PDF merging, page-level assembly operations |
| `proxy.ts` | Comlink worker proxy setup — configures the `Worker` instance and wraps it with Comlink for RPC-style calls from the main thread |

---

### 3. 📄 Page Management / Organizer Module

**Purpose:** Allows users to visually reorganize, add, delete, split, merge, and rotate pages of a PDF.

| File | Role |
|---|---|
| `components/pdf/OrganizerPDFModal.tsx` | Full-screen page organizer modal — drag-and-drop grid of all pages, multi-select, delete, rotate, insert blank page |
| `components/pdf/SortablePageThumbnail.tsx` | Shared sortable thumbnail component — used by both ThumbnailSidebar and OrganizerPDFModal |
| `components/pdf/ThumbnailSidebar.tsx` | In-editor sidebar for quick page navigation and reorder |
| `app/store/usePDFStore.ts` | Manages page array, handles page insert/delete/rotate mutations |
| `workers/pdfAssembler.worker.ts` | Executes the actual binary page assembly (merge, split, rotation) in the background thread |

---

### 4. 🔀 PDF Merge Module

**Purpose:** Allows users to combine multiple PDF files into a single document.

| File | Role |
|---|---|
| `components/pdf/MergePDFModal.tsx` | Merge modal UI — accepts multiple file uploads, shows file list with drag-to-reorder, triggers merge |
| `workers/pdfAssembler.worker.ts` | Worker that loads multiple `PDFDocument` instances via `pdf-lib` and copies all pages into a single output document |
| `app/store/usePDFStore.ts` | Stores merged PDF bytes and updates the application state post-merge |

---

### 5. 🗜️ PDF Compression Module

**Purpose:** Reduces the file size of a PDF for easier sharing.

| File | Role |
|---|---|
| `components/pdf/CompressorModal.tsx` | Compression modal with phase-based rendering, non-tech mode explanations, and Google Drive infinite scroll |
| `store/useCompressorStore.ts` | Zustand store specific to the compression module — holds settings, phases, progress, and errors |
| `workers/pdfCompressor.worker.ts` | Background Web Worker performing OffscreenCanvas page rasterization and sequential assembly |
| `hooks/usePDFCompressor.ts` | Worker lifecycle bridge hook with AbortController cancellation |

---

### 6. 📐 Page Resize Module

**Purpose:** Allows changing the paper dimensions (e.g., A4, Letter, custom) of PDF pages.

| File | Role |
|---|---|
| `components/pdf/PageResizeModal.tsx` | Page resize modal — preset size picker and custom dimension inputs |
| `store/useResizeStore.ts` | Zustand store for page resize — holds target dimensions and resize strategy |

---

### 7. ☁️ Google Drive Integration Module

**Purpose:** Lets users import PDFs from and export PDFs to their Google Drive.

#### Route & Page

| File | Role |
|---|---|
| `app/drive/page.tsx` | The `/drive` route — Drive file browser UI; lists user's Drive PDFs, allows selecting one to open in the editor; **updated (commit ee9c87c)** with pagination support (`nextPageToken`), infinite scroll via `IntersectionObserver`, search query filtering, "My Drive" vs "Shared" tab switching, and breadcrumb folder navigation |

#### Server Actions

| File | Role |
|---|---|
| `app/actions/drive.ts` | Next.js Server Action — handles all Drive API calls: `listDriveFiles()`, `downloadDriveFile()`, `uploadFileToDrive()`; manages Google OAuth token refresh via Clerk `privateMetadata` and `CLIENT_ID`/`CLIENT_SECRET` env vars |
| `app/actions/googleAuth.ts` | Server Action — generates the Google OAuth authorization URL (offline access, Drive scopes) and redirects the user to grant permissions |

#### API Routes

| File | Role |
|---|---|
| `app/api/auth/google-callback/` | OAuth callback handler — receives `code` from Google, exchanges it for `access_token` + `refresh_token`, saves `refresh_token` to Clerk user's `privateMetadata` |

#### UI Components

| File | Role |
|---|---|
| `components/pdf/DriveModal.tsx` | In-editor Drive modal — quick access to Drive import without leaving the editor |
| `components/pdf/UploadToDriveModal.tsx` | Export-to-Drive modal — folder picker, file naming, upload progress |

#### Auth Provider

| File | Role |
|---|---|
| `app/layout.tsx` | Wraps entire app with `<ClerkProvider>` — enables `auth()` in all server actions |

---

### 8. 🖊️ Rename & Export Module

**Purpose:** Handles the final PDF export flow — lets users rename the file and choose export format.

| File | Role |
|---|---|
| `components/pdf/RenameExportModal.tsx` | Export modal — filename input, format options, triggers `useExportPDF` hook for baked download |
| `hooks/useExportPDF.ts` | Orchestrates final PDF assembly — maps all canvas layers → overlays → sends to `pdf.worker.ts` → returns a `Blob` for download |

---

### 9. 🔐 Authentication Module

**Purpose:** Manages user sessions, Google OAuth, and secure token storage.

| File | Role |
|---|---|
| `app/layout.tsx` | `<ClerkProvider>` wrapper — activates Clerk session management globally |
| `app/actions/googleAuth.ts` | Generates Google Drive OAuth URL with offline scope; reads `userId` via `auth()` |
| `app/actions/drive.ts` | Uses `clerkClient` to read/write `privateMetadata` for Google refresh tokens; calls `getUserOauthAccessToken` |
| `app/api/auth/google-callback/` | Handles the OAuth redirect, persists `refresh_token` to Clerk metadata |

**Required Environment Variables:**
- `CLIENT_ID` — Google OAuth Client ID
- `CLIENT_SECRET` — Google OAuth Client Secret
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` — Clerk publishable key
- `CLERK_SECRET_KEY` — Clerk secret key

---

### 10. 💾 Persistence / Virtual File System (VFS) Module

**Purpose:** Auto-saves all editor state to IndexedDB so work is never lost on tab close or refresh.

| File | Role |
|---|---|
| `app/store/usePDFStore.ts` | Triggers `idb-keyval` `set()` on every edit — serializes PDF bytes + overlay state + page order into IndexedDB |
| `hooks/usePDFWorker.ts` | On editor load, reads from IndexedDB via `idb-keyval` `get()` to restore previous session |

**Library:** `idb-keyval` — simple `get(key)` / `set(key, value)` wrapper over IndexedDB.

---

### 11. 🎨 UI Component Library (Shared)

**Purpose:** Reusable, accessible UI primitives used across all modules.

| File | Role |
|---|---|
| `components/ui/button.tsx` | Button variants (primary, ghost, outline) via `class-variance-authority` |
| `components/ui/dialog.tsx` | Modal/dialog wrapper from Radix UI |
| `components/ui/input.tsx` | Styled text input |
| `components/ui/label.tsx` | Form label component |
| `components/ui/select.tsx` | Dropdown select from Radix UI |
| `components/ui/slider.tsx` | Opacity/size range slider from Radix UI |
| `components/ui/popover.tsx` | Popover overlay from Radix UI |
| `components/ui/tooltip.tsx` | Tooltip from Radix UI |
| `components/ui/checkbox.tsx` | Checkbox input from Radix UI |
| `components/ui/scroll-area.tsx` | Custom scroll container from Radix UI |
| `lib/utils.ts` | `cn()` utility — merges Tailwind class strings safely |

---

### 12. ⚙️ Configuration & Build

| File | Role |
|---|---|
| `next.config.ts` | Next.js config — enables 50MB server action body limit, disables canvas alias for webpack (required for `pdfjs-dist`) |
| `tsconfig.json` | TypeScript compiler config — path aliases, strict mode |
| `eslint.config.mjs` | ESLint config using `eslint-config-next` |
| `postcss.config.mjs` | PostCSS config for Tailwind CSS v4 |
| `components.json` | shadcn/ui component registry config — defines component style and import paths |
| `.gitignore` | Standard Next.js gitignore — excludes `.env`, `node_modules`, `.next/` |

---

### 13. 📖 Architecture & Documentation

| File | Role |
|---|---|
| `Architecture/Editor.md` | Deep-dive into the Konva canvas editor architecture |
| `Architecture/Canvas.md` | Canvas layer system, coordinate spaces, and rendering pipeline |
| `Architecture/Drive.md` | Google Drive integration architecture |
| `Architecture/Compressor-tool.md` | PDF compression implementation notes |
| `Architecture/Organizer.md` | Page organizer design decisions |
| `Architecture/Page-Ops.md` | Page operations (insert, delete, rotate, split) |
| `Architecture/Page-Resize.md` | Page resize implementation |
| `Architecture/Text-Editor.md` | Text layer editing and font embedding logic |
| `Architecture/Image-Tool.md` | Image layer, crop, filters pipeline |
| `Architecture/FigmaEditor-one.md` | Initial Figma-like editor design concepts |
| `Architecture/Feature-Plans.md` | Planned upcoming features |
| `Architecture/Report.md` | Architecture-level status report |
| `Architecture/libraries.md` | Library selection rationale |
| `Project-Report.md` | High-level project status report — feature list, technical stack overview |
| `Docs/Compression_KB.md` | Knowledge Base for the background worker PDF compression module |
| `Docs/Editor_Core_KB.md` | Knowledge Base for the decoupled state, history, and interaction core |

---

*This Knowledge Base is auto-structured from source analysis. Keep it updated with every major change.*

---

## 📋 KB Changelog

| Date | Commit | Changes | Updated By |
|---|---|---|---|
| June 27, 2026 | `d9d9d9d` | Implemented background worker PDF Compressor (`pdfCompressor.worker.ts`), decoupled Canvas Store (`store/editor/`), and created `Docs/` module KBs | AI Agent (Antigravity) |
| June 27, 2026 | [`ee9c87c`](https://github.com/Aayush-1205/pdf-studio/commit/ee9c87c42db633d4b6aa5fc269edd3ad29b2ca8f) | Added `LocalUploadModal.tsx` (new file); updated `DocumentStats.tsx` description; updated `app/drive/page.tsx` with pagination, infinite scroll, search, tabs, and breadcrumbs | AI Agent (Perplexity) |
| June 26, 2026 | `d6556a6` (baseline) | Initial KB created — full project analysis, all 13 modules documented | AI Agent (Perplexity) |
