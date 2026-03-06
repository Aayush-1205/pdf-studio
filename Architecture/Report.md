# 📄 PDF Studio: Project Status & Architecture Report

## 🛠 File & Feature Mapping

| Component / File                               | Primary Responsibility       | Key Features / Functions                                                                                                                                                                                       |
| :--------------------------------------------- | :--------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`workers/pdf.worker.ts`**                    | **Core PDF Engine**          | `bakeEdits`: Merges layers (Text, Shapes, Images) into the PDF. Handles Y-axis coordinate flipping (DOM to PDF).<br>`compressPdf`: PDF size reduction logic.<br>`resizePdfPages`: Page dimension manipulation. |
| **`store/useCanvasStore.ts`**                  | **Global State & Undo/Redo** | Manages `pages`, `layers`, and `history`.<br>`addBlankPage`: Supports single/bulk insertion (Odd/Even/Interval).<br>`insertLayer`: Universal layer insertion (Text, Shapes, Image).                            |
| **`hooks/useExportPDF.ts`**                    | **Export Workflow**          | Orchestrates the `generateBakedPDF` process. Normalizes colors and prepares overlay data for the Web Worker.                                                                                                   |
| **`app/lib/pdfRender.ts`**                     | **PDF Ingestion**            | `extractPdfPages`: Rasterizes PDF pages to images and extracts native text into editable `TEXT` layers with background color sampling.                                                                         |
| **`components/editor/LeftSidebar.tsx`**        | **Page/Tool Navigation**     | Manages page thumbnails, blank page insertion UI, and triggers for **Merge**, **Compress**, and **Resize** tools.                                                                                              |
| **`components/pdf/MergePDFModal.tsx`**         | **PDF Merging**              | Supports local file uploads and **Google Drive integration** for combining multiple documents.                                                                                                                 |
| **`components/pdf/PageResizeModal.tsx`**       | **Resize & Revert**          | UI for changing page sizes with a **"Revert to Original"** safety feature.                                                                                                                                     |
| **`components/editor/RightPropertyPanel.tsx`** | **Element Editing**          | Real-time editing of selected layers (Text content, font size, colors, opacity).                                                                                                                               |
| **`components/editor/Canvas.tsx`**             | **Visual Workspace**         | The primary Konva-based interaction area for moving, resizing, and drawing on pages.                                                                                                                           |
| **`app/lib/pdfUtils.ts`**                      | **Math & Logic**             | Coordinate conversion (`domYtoPdfY`), color normalization, and SVG path mirroring.                                                                                                                             |

---

## ✅ Accomplishments (What's Done)

1.  **Hybrid Merging**: Implemented a Merge tool that fetches files from both local storage and Google Drive.
2.  **Advanced Page Insertion**: Added logic to insert blank pages after every Odd/Even page or at custom intervals (e.g., every 3rd page).
3.  **Page Resize with Safety**: Built a resize tool with a "Revert" function to restore original dimensions if a mistake is made.
4.  **Vector Shape Support**: Added support for Rectangles, Circles, Lines, and Arrows with proper PDF coordinate translation.
5.  **Smart Text Extraction**: Native PDF text is automatically converted into editable layers, attempting to sample the background color to prevent "white ghosting" boxes.
6.  **Custom Export Naming**: Users are prompted to rename their file before downloading.

---
