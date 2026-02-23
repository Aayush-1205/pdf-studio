## 🏗️ 1. The High-Level System Architecture

This architecture relies on a **"Decoupled Processing"** model. The UI remains fluid (60fps) while heavy PDF heavy-lifting happens in background threads.

### A. The Core Engine (Next.js + Web Workers)

- **Next.js App Router:** Handles the routing, SEO-optimized landing pages, and API routes for user authentication or cloud storage.
- **Web Worker Thread:** When a user merges two 50MB PDFs, the main UI thread stays responsive because the `pdf-lib` logic runs in a separate `worker.ts` file.
- **Virtual File System (VFS):** Files are stored as `Blob` or `ArrayBuffer` in the browser's **IndexedDB** (via `idb-keyval`) to prevent data loss on page refresh.

### B. The State Layer (Zustand)

Instead of passing props, use a global store to track:

- `layers`: An array of text/image overlays added by the user.
- `history`: A stack of previous states for **Undo/Redo** functionality.
- `activePage`: The index of the page currently being edited.

---

## 🎨 2. The Multi-Function Sidebar (The Control Center)

The Sidebar is the most complex part of the UI. It must be **context-aware**, changing its tools based on what the user selects on the canvas.

### I. The "Master" Sidebar Sections:

1. **Page Manager (CRUD):** \* **Thumbnail View:** Drag-and-drop to reorder pages.

- **Insert/Delete:** Add blank pages or the "Template Page" before every existing page.

2. **Property Inspector:** \* If a **Text Block** is clicked: Show font family, size, color, and line height.

- If an **Image** is clicked: Show the **Crop/Filter** toolkit.

3. **Template Engine:** \* A library of pre-saved layouts (e.g., "Invoice Header," "Legal Disclaimer").

- Logic to "Auto-Inject" these templates based on page rules (e.g., "Every even page").

---

## 🔠 3. The "Font Matching" & Editing Logic

To solve your requirement for **font consistency**, the app follows a specific "Extraction-to-Injection" pipeline:

1. **Scanning:** When the user clicks a text area, `pdf.js` identifies the font metadata (e.g., `Subset-Roboto-Bold`).
2. **Font Mapping:** The app checks a local dictionary. If `Roboto` is found, it fetches the full `.ttf` version from a CDN (like Google Fonts).
3. **Embedding:** When the user types new text, `pdf-lib` embeds the _full_ font file into the new PDF version, ensuring the "Read/Write" result looks identical to the original.

---

## 🖼️ 4. Image Manipulation Pipeline

For a production-grade experience, image editing should be **non-destructive**.

- **Filter Logic:** Use CSS `backdrop-filter` or `canvas` filters for the UI preview. Only when saving the PDF do you apply these filters to the raw image data using a library like `canvas-filters`.
- **Cropping:** Use `react-easy-crop` to get the `{x, y, width, height}` coordinates. Store these coordinates in your State Layer.
- **The "Burn" Phase:** During the final export, the `pdf-lib` engine takes the original image, crops it according to the stored coordinates, and draws it onto the PDF page.

---

## 🛠️ 5. Implementation Roadmap (Step-by-Step)

| Phase       | Focus               | Key Technology                                                                         |
| ----------- | ------------------- | -------------------------------------------------------------------------------------- |
| **Phase 1** | **The Viewer**      | `pdf.js` + Next.js Canvas rendering.                                                   |
| **Phase 2** | **The State**       | Setting up `Zustand` to track page orders and deletions.                               |
| **Phase 3** | **The Interleaver** | Implementing the "Template Page Before Every Page" logic in a Web Worker.              |
| **Phase 4** | **The Editor**      | Adding the Sidebar with `react-hook-form` for metadata and `fontkit` for text editing. |
| **Phase 5** | **The Image Lab**   | Integrating the crop and filter tools into the sidebar.                                |

---

## 💡 Bonus: Advanced Features for the Architecture

To make this a "Pro" suite, consider these:

1. **Smart Redaction:** Allow users to search for a word (e.g., "Confidential") and have the app automatically black out every instance across 100 pages.
2. **Variable Data Printing (VDP):** Allow users to upload a CSV file and "Mail Merge" it into a PDF template (e.g., generating 500 personalized certificates at once).
3. **Collaborative Editing:** Use **Liveblocks** or **Yjs** (CRDTs) to allow two users to edit the same PDF template simultaneously.
4. **AcroForms Support:** Not just text editing, but the ability to create and fill out interactive PDF forms.
