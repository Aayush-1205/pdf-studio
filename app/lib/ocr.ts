// @ts-ignore
import Tesseract from "tesseract.js";

// Uses a Web Worker behind the scenes to avoid blocking the UI thread
export async function extractRasterText(dataUrl: string) {
  const worker = await Tesseract.createWorker("eng", 1, {
    logger: (info: any) => console.log("OCR Progress:", info),
  });

  const {
    data: { words },
  } = await worker.recognize(dataUrl);

  // Filter out low-confidence reads to keep the visual DOM clean
  const validWords = words.filter((word: any) => word.confidence > 75);

  const editableNodes = validWords.map((word: any) => {
    const width = word.bbox.x1 - word.bbox.x0;
    const height = word.bbox.y1 - word.bbox.y0;

    // Tesseract often returns very tight bounding boxes,
    return {
      id: crypto.randomUUID(),
      type: "TEXT" as const,
      text: word.text,
      x: word.bbox.x0,
      y: word.bbox.y0,
      width,
      height,
      fontSize: height, // approximation
      fontFamily: "Helvetica",
      color: "#000000",
    };
  });

  await worker.terminate();
  return editableNodes;
}
