A production-grade Image Tool must bridge the gap between a design suite (like Figma) and a document compiler. In Figma, image manipulation (cropping, filtering, masking) is non-destructive. In a PDF, however, images are rigidly defined binary objects.

To achieve a "Perfect Image Tool," we must maintain a non-destructive state in the browser (using Konva and Zustand) and perform a "destructive flatten" only at the exact moment of PDF export.

Here is the comprehensive architectural blueprint and implementation plan for the Advanced Image Tool.

---

### 🧠 1. The Image Layer Architecture (Zustand)

An image layer requires significantly more metadata than a rectangle. We must store the original unadulterated image, alongside its non-destructive transformation parameters.

**Directive for Antigravity - State Definition:**
Update `useCanvasStore.ts` to include an advanced `ImageLayer` type:

```typescript
export type ImageLayer = {
  type: "IMAGE";
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  cornerRadius: number;

  // Image Specifics
  src: string; // Base64 Data URL or Blob URL of the ORIGINAL image
  originalWidth: number;
  originalHeight: number;

  // Non-Destructive Cropping (Relative to original image dimensions)
  crop?: { x: number; y: number; width: number; height: number };

  // CSS-style Filters
  filters?: {
    brightness?: number; // -1 to 1
    contrast?: number; // -100 to 100
    blurRadius?: number; // 0 to 40
    grayscale?: boolean;
  };
  isNative?: boolean; // Flag if extracted from the original PDF
};
```

---

### 📥 2. Native PDF Image Extraction (`pdfjs-dist`)

Just as we extracted native text, a true editor must extract the images embedded inside the uploaded PDF so the user can resize or delete them.

**Implementation Logic:**
`pdf.js` parses pages using an "Operator List." We must scan this list for image drawing commands (`OPS.paintImageXObject`).

```typescript
// Inside your PDF Import Utility
const operatorList = await page.getOperatorList();
const validObjIds = [];

// Find all image objects on the page
for (let i = 0; i < operatorList.fnArray.length; i++) {
  if (
    operatorList.fnArray[i] === pdfjs.OPS.paintImageXObject ||
    operatorList.fnArray[i] === pdfjs.OPS.paintInlineImageXObject
  ) {
    validObjIds.push(operatorList.argsArray[i][0]);
  }
}

// Extract each image as a Base64 string to push to Zustand
for (const objId of validObjIds) {
  const imgData = await page.objs.get(objId);
  const canvas = document.createElement("canvas");
  canvas.width = imgData.width;
  canvas.height = imgData.height;
  const ctx = canvas.getContext("2d");

  // Convert pdf.js image data to a standard browser canvas image
  const imageData = new ImageData(imgData.data, imgData.width, imgData.height);
  ctx.putImageData(imageData, 0, 0);

  const base64Src = canvas.toDataURL("image/png");

  // Note: You must also calculate the X/Y/Width/Height by cross-referencing
  // the transform matrix in the operator list, just like we did for text.

  // Push to Zustand store...
}
```

---

### 🎨 3. High-Performance Canvas Rendering (Konva.js)

Because you are using Konva (from Phase 3), applying complex filters and crops is highly optimized. Konva uses WebGL/Canvas2D to apply filters natively.

**Directive for Antigravity - Konva Component:**

```tsx
import { Image as KonvaImage } from "react-konva";
import useImage from "use-image";
import Konva from "konva";

export default function ImageLayerComponent({ layer, isSelected }) {
  // useImage hook loads the base64 src into an HTMLImageElement for Konva
  const [img] = useImage(layer.src);

  // Map Zustand filters to Konva Filter classes
  const activeFilters = [];
  if (layer.filters?.blurRadius > 0) activeFilters.push(Konva.Filters.Blur);
  if (layer.filters?.brightness !== 0)
    activeFilters.push(Konva.Filters.Brighten);
  if (layer.filters?.contrast !== 0) activeFilters.push(Konva.Filters.Contrast);
  if (layer.filters?.grayscale) activeFilters.push(Konva.Filters.Grayscale);

  return (
    <KonvaImage
      image={img}
      x={layer.x}
      y={layer.y}
      width={layer.width}
      height={layer.height}
      rotation={layer.rotation}
      opacity={layer.opacity / 100}
      cornerRadius={layer.cornerRadius || 0}
      // Konva natively supports cropping by defining the source view box
      crop={
        layer.crop || {
          x: 0,
          y: 0,
          width: layer.originalWidth,
          height: layer.originalHeight,
        }
      }
      // Apply the active filters
      filters={activeFilters}
      blurRadius={layer.filters?.blurRadius || 0}
      brightness={layer.filters?.brightness || 0}
      contrast={layer.filters?.contrast || 0}
      // Cache the image for performance (Required for Konva filters to work)
      ref={(node) => {
        if (node && activeFilters.length > 0) {
          node.cache();
        }
      }}
    />
  );
}
```

---

### ✂️ 4. The Interactive Cropping UX

A pro editor differentiates between _scaling_ an image and _cropping_ an image.

**The Workflow:**

1. **Single Click:** Shows the standard blue bounding box with 8 handles. Dragging these resizes the `layer.width` and `layer.height` (scaling the image).
2. **Double Click:** Changes `CanvasMode` to `Cropping`.

- Visually dim the rest of the canvas.
- Show the _entire_ original image at reduced opacity outside the cropped area.
- The 8 handles now modify the `layer.crop` object (x, y, width, height) rather than the layer's overall dimensions.

3. **Property Inspector:** Provide a button to "Reset Crop" and a slider for "Corner Radius" (which Konva handles natively via the `cornerRadius` prop).

---

### 🔥 5. The "Bake" Engine (Offscreen Flattening for Export)

This is the most critical step. `pdf-lib` **does not support** CSS filters, Konva filters, or complex SVG clipping paths natively. If you just pass the raw image to `pdf-lib`, all of the user's edits (blur, contrast, cropping) will vanish.

Before saving the PDF, your Comlink Web Worker must mathematically "flatten" the edited image into a brand-new, static PNG or JPEG.

**Directive for Antigravity - The Worker Flattening Script:**

```typescript
// Inside pdfWorker.ts
async function flattenImageForPdf(layer: ImageLayer): Promise<Uint8Array> {
  // 1. Create an OffscreenCanvas exactly the size of the final cropped/filtered image
  const canvas = new OffscreenCanvas(layer.width, layer.height);
  const ctx = canvas.getContext("2d");

  // 2. Load the original base64 image into an ImageBitmap
  const response = await fetch(layer.src);
  const blob = await response.blob();
  const imgBitmap = await createImageBitmap(blob);

  // 3. Apply Filters via Canvas Context filter property
  let filterString = "";
  if (layer.filters?.blurRadius)
    filterString += `blur(${layer.filters.blurRadius}px) `;
  if (layer.filters?.brightness)
    filterString += `brightness(${100 + layer.filters.brightness * 100}%) `;
  if (layer.filters?.grayscale) filterString += `grayscale(100%) `;
  ctx.filter = filterString.trim();

  // 4. Handle Corner Radius (Clipping Path)
  if (layer.cornerRadius > 0) {
    ctx.beginPath();
    ctx.roundRect(0, 0, layer.width, layer.height, layer.cornerRadius);
    ctx.clip();
  }

  // 5. Draw the cropped portion of the image onto the canvas
  const crop = layer.crop || {
    x: 0,
    y: 0,
    width: layer.originalWidth,
    height: layer.originalHeight,
  };
  ctx.drawImage(
    imgBitmap,
    crop.x,
    crop.y,
    crop.width,
    crop.height, // Source dimensions (the crop)
    0,
    0,
    layer.width,
    layer.height, // Destination dimensions (the canvas)
  );

  // 6. Convert the flattened canvas back to a Blob -> Uint8Array
  const finalBlob = await canvas.convertToBlob({ type: "image/png" });
  return new Uint8Array(await finalBlob.arrayBuffer());
}

// Later in the PDF generation loop:
const flattenedImageBytes = await flattenImageForPdf(imageLayer);
const pdfImage = await pdfDoc.embedPng(flattenedImageBytes);
page.drawImage(pdfImage, {
  x: imageLayer.x,
  y: imageLayer.y, // Remember to flip Y for pdf-lib!
  width: imageLayer.width,
  height: imageLayer.height,
});
```

### Summary of Execution Strategy

1. **Extraction:** Rip images out of `pdf.js` as base64 strings and store them in Zustand.
2. **State & UI:** Build the Right Sidebar controls for filters, opacity, and corner radius.
3. **Konva Rendering:** Use `react-konva` to apply these filters live on the canvas at 60fps.
4. **Export:** Use `OffscreenCanvas` in the Web Worker to "burn" the filters and crops into a flat image buffer before injecting it into `pdf-lib`.
