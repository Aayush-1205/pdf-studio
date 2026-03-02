### 🧠 1. Solving the "White Background" (Ghosting) Issue

To natively edit text without leaving ugly white boxes, we must abandon the "whiteout mask" and implement **Context-Aware Background Sampling**.

**How it works:**

1. When the user double-clicks an existing PDF text node to edit it, we don't just create a white mask.
2. We use the hidden `pdf.js` background `<canvas>` (which rendered the original PDF visually).
3. We extract the exact bounding box of the text.
4. We sample the background colors exactly surrounding the text bounding box.
5. We create an **Inpainting Mask** (a patch that perfectly matches the background color/texture) and place _that_ below the new text, or we use `pdf-lib` to scrub the text from the binary stream entirely.

### ⚠️ 2. Crucial Factors to Keep in Mind (The "Gotchas")

Before writing the code, the Antigravity IDE needs to account for these PDF-specific realities:

- **Font Subsetting:** PDFs often embed "subsets" of fonts (e.g., only the letters A, B, and C are included in the file to save space). If a user edits the text and types "Z", it will show as a missing character box `[ ]`. **Solution:** Your editor must fallback to standard fonts (Helvetica/Arial) automatically if the original font is subsetted, or prompt the user to upload the `.ttf`.
- **No Native Text Wrapping:** If a user types a long sentence, `pdf-lib` will draw it right off the edge of the page. **Solution:** Your export engine must implement mathematical line-breaking (calculating the width of words and wrapping them based on the bounding box).
- **Scaling vs. Resizing:** In Figma, dragging the edge of a text box changes the _container width_ (wrapping the text differently). Dragging a text box from the corner while holding `Shift` scales the _font size_ up. Your tool must differentiate between container resizing and font scaling.

### ✨ 3. Advanced Features to Add to the Text Tool

To make this editor truly "Pro-level", incorporate these features into the right-hand Property Panel:

- **Rich Typography Engine:** Controls for `fontSize`, `fontFamily` (with Google Fonts integration), `fontWeight`, and `color` (Fill & Stroke).
- **Alignment & Justification:** Left, Center, Right, and Justify alignments.
- **Line Height & Letter Spacing:** Precise sliders to match the visual spacing of the original PDF text.
- **Auto-List Generation:** Detecting when a user types `- ` or `1. ` and automatically applying bullet-point indentations.

---

### 🚀 4. Detailed Implementation Plan (For Antigravity IDE)

Here is the step-by-step code architecture to build the flawless Text Tool.

#### Step 1: The Context-Aware Masking Utility (Fixing the White Box)

Instruct your IDE to create a utility that samples the background color from the `pdfjs-dist` canvas to create an invisible mask.

```typescript
// src/utils/colorSampling.ts
export function getBackgroundColorBehindText(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
): string {
  // Sample pixels exactly 2 pixels OUTSIDE the text bounding box
  // to grab the true background color, avoiding the text itself.
  const pixelData = ctx.getImageData(x - 2, y - 2, 1, 1).data;

  const r = pixelData[0];
  const g = pixelData[1];
  const b = pixelData[2];
  const alpha = pixelData[3] / 255;

  // Convert to HEX for Zustand/pdf-lib
  return alpha === 0
    ? "#FFFFFF"
    : `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}
```

#### Step 2: The Editable Text Component (UI Layer)

We use an SVG `<foreignObject>` containing a `contentEditable` div. This gives us native browser text wrapping, selection highlighting, and spellcheck.

```tsx
// src/components/canvas/TextLayer.tsx
import { useRef, useEffect } from "react";
import { useCanvasStore } from "@/store/useCanvasStore";

export default function TextLayer({ id, layer, isSelected }) {
  const updateLayer = useCanvasStore((state) => state.updateLayer);
  const textRef = useRef<HTMLDivElement>(null);

  // Auto-focus when newly created or selected for editing
  useEffect(() => {
    if (isSelected && textRef.current) {
      textRef.current.focus();
    }
  }, [isSelected]);

  const handleBlur = (e) => {
    // Save the new text back to Zustand when user clicks away
    updateLayer(id, { text: e.target.innerText });
  };

  return (
    <g transform={`translate(${layer.x}, ${layer.y})`}>
      {/* The Context-Aware Mask: Uses the sampled background color, not white! */}
      {layer.isNative && (
        <rect
          x={-2}
          y={-2}
          width={layer.width + 4}
          height={layer.height + 4}
          fill={layer.sampledBackgroundColor || "#FFFFFF"}
        />
      )}

      <foreignObject width={layer.width} height={layer.height}>
        <div
          ref={textRef}
          contentEditable={isSelected}
          suppressContentEditableWarning
          onBlur={handleBlur}
          style={{
            fontSize: `${layer.fontSize}px`,
            fontFamily: layer.fontFamily,
            color: layer.fill,
            lineHeight: layer.lineHeight || 1.2,
            letterSpacing: `${layer.letterSpacing || 0}px`,
            textAlign: layer.textAlign || "left",
            width: "100%",
            height: "100%",
            outline: isSelected ? "2px solid #0b99ff" : "none",
            wordWrap: "break-word",
            background: "transparent",
            cursor: isSelected ? "text" : "pointer",
          }}
        >
          {layer.text}
        </div>
      </foreignObject>
    </g>
  );
}
```

#### Step 3: The Text Reflow & Export Engine (Web Worker)

Because `pdf-lib` does not natively wrap text, your Comlink Web Worker must mathematically slice the text into multiple lines before saving the PDF.

Instruct the IDE to add this to `pdfWorker.ts`:

```typescript
// Inside the Web Worker Export logic
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

async function wrapAndDrawText(page, layer, customFont) {
  const words = layer.text.split(" ");
  let currentLine = "";
  let currentY = layer.y; // PDF bottom-left adjusted Y
  const lineHeight = layer.fontSize * (layer.lineHeight || 1.2);

  for (let i = 0; i < words.length; i++) {
    const testLine = currentLine + words[i] + " ";
    const testWidth = customFont.widthOfTextAtSize(testLine, layer.fontSize);

    // If the word pushes the line wider than the bounding box width
    if (testWidth > layer.width && i > 0) {
      // Draw the current line
      page.drawText(currentLine.trim(), {
        x: layer.x,
        y: currentY,
        size: layer.fontSize,
        font: customFont,
        color: hexToRgb(layer.fill),
      });
      // Move to the next line down
      currentLine = words[i] + " ";
      currentY -= lineHeight;
    } else {
      currentLine = testLine;
    }
  }

  // Draw the remaining words on the last line
  page.drawText(currentLine.trim(), {
    x: layer.x,
    y: currentY,
    size: layer.fontSize,
    font: customFont,
    color: hexToRgb(layer.fill),
  });
}
```

### 🎯 Summary of Workflow for Antigravity

1. **Update `useCanvasStore.ts**`: Add properties to the `TextLayer`type:`textAlign`, `lineHeight`, `letterSpacing`, and `sampledBackgroundColor`.
2. **Implement Color Sampling**: When the user imports a PDF, map through the text items. Use the `getBackgroundColorBehindText` utility to check the canvas behind every text node and save that color to the Zustand state.
3. **Build `TextLayer.tsx**`: Use the `<foreignObject>` approach for fluid, CSS-driven text editing in the browser.
4. **Update `pdfWorker.ts**`: Implement the `wrapAndDrawText` function so that when the user exports, the browser's CSS text wrapping is perfectly replicated in the binary PDF bytes.
