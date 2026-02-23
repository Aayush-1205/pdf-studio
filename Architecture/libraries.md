Your current setup with `pdfjs-dist` (for rendering/viewing PDFs client-side), `pdf-lib` (for modifying/editing PDF content), `@dnd-kit/*` (drag-and-drop reordering), `react-easy-crop` (image cropping), `fontkit` (font handling), and state tools like `zustand` and `react-hook-form` provides a solid foundation for a basic PDF editor in Next.js, supporting viewing, basic edits, annotations, and UI interactions.

To expand into a more advanced editor (e.g., adding annotations, forms, signatures, text editing, or generation), consider these additional libraries. They build on your stack without major conflicts.

## Core PDF Enhancement Libraries

- **@react-pdf/renderer** (npm install @react-pdf/renderer): Enables declarative PDF generation using React components, ideal for creating/editing dynamic PDFs from templates. Advantage: Complements `pdf-lib` by allowing UI-driven PDF building (e.g., drag-drop to generate pages), reducing manual canvas code vs. imperative libs like jsPDF; works seamlessly in Next.js SSR with API routes. [v0](https://v0.app/chat/react-pdf-libraries-N4uHEUvJQKJ)
- **react-pdf**: High-fidelity PDF rendering with text selection, zooming, and page navigation. Advantage: Builds on your `pdfjs-dist` for better React integration, adding searchable text and multi-page support; lighter than commercial options for expanding viewer features. [reddit](https://www.reddit.com/r/nextjs/comments/1ehrhpy/pdf_reader_for_nextjs/)

## Annotation and Markup Tools

- **pdf-annotate.js** or **pdfjs-dist with custom annotations**: Extends `pdfjs-dist` for drawing, highlighting, and sticky notes. Advantage: Adds interactive markup (e.g., freehand drawing over pages) without replacing your renderer; pairs with `@dnd-kit` for reorderable annotations, enabling collaborative editing beyond basic crops.
- **pspdfkit** (commercial, via npm): Full-featured SDK for annotations, signatures, and form filling. Advantage: Production-ready with Next.js examples, outperforming open-source in mobile support and redaction; scales your basic editor to enterprise (free trial available). [reddit](https://www.reddit.com/r/nextjs/comments/1ehrhpy/pdf_reader_for_nextjs/)

## Advanced Editing and Generation

- **pdfmake** (npm install pdfmake): Server-side PDF generation with styling and tables. Advantage: Easier complex layouts (e.g., headers/footers) than `pdf-lib` alone; use in Next.js API routes for export, expanding to report-style editors without browser limitations. [reddit](https://www.reddit.com/r/reactjs/comments/1byummc/is_there_any_good_pdf_builder_out_there/)
- **PDFKit** (npm install pdfkit): Low-level PDF creation with vector graphics and embedding. Advantage: Superior font/image embedding over `pdf-lib` for print-quality outputs; enhances your `fontkit` for custom typography in multi-page editors. [dev](https://dev.to/handdot/generate-a-pdf-in-js-summary-and-comparison-of-libraries-3k0p)

## UI and Workflow Boosters

| Library                                            | Purpose                                             | Key Advantage Over Your Stack                                                                                                                                                                                                 |
| -------------------------------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **@pdfme/common** (pdfme)                          | Template-based PDF filling/editor with JSON schemas | Drag-drop form builder integrates with `react-hook-form`; faster prototyping of fillable PDFs vs. manual `pdf-lib` ops [dev](https://dev.to/handdot/generate-a-pdf-in-js-summary-and-comparison-of-libraries-3k0p)            |
| **ProseMirror** (via kendo-react-pdf or direct)    | Rich text editor for inline PDF text edits          | Embeddable WYSIWYG for page content; upgrades `zustand`-managed state to real-time collaboration, beyond basic drag-drop [reddit](https://www.reddit.com/r/reactjs/comments/1byummc/is_there_any_good_pdf_builder_out_there/) |
| **Puppeteer** (server-only, npm install puppeteer) | HTML-to-PDF conversion for complex designs          | Converts React components to PDFs via API routes; handles Tailwind styles your client libs can't, for export previews [v0](https://v0.app/chat/react-pdf-libraries-N4uHEUvJQKJ)                                               |

Start with `@react-pdf/renderer` and `pdfmake` for quick wins—they're lightweight, Next.js-friendly, and extend your editing without rewriting core logic. Test in a feature branch to avoid bundling issues with Webpack.
