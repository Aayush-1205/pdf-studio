"use client";

import { PDFDocument } from "pdf-lib";
import { expose } from "comlink";

export interface ExtractedPage {
  base64: string;
  width: number;
  height: number;
}

const assembler = {
  async buildCompressedPdf(pages: ExtractedPage[]): Promise<Uint8Array> {
    const newPdfDoc = await PDFDocument.create();

    for (const imgData of pages) {
      // Create a page with the correct dimensions
      const newPage = newPdfDoc.addPage([imgData.width, imgData.height]);

      // Handle the base64 string (ensure it's just the data part if it has a prefix)
      const base64Data = imgData.base64.split(",")[1] || imgData.base64;
      const imageBytes = Uint8Array.from(atob(base64Data), (c) =>
        c.charCodeAt(0),
      );

      // Embed the heavily compressed JPEG
      const embeddedImage = await newPdfDoc.embedJpg(imageBytes);

      newPage.drawImage(embeddedImage, {
        x: 0,
        y: 0,
        width: imgData.width,
        height: imgData.height,
      });
    }

    // Save with object streams disabled to ensure maximum compatibility and compression in some readers
    return await newPdfDoc.save({ useObjectStreams: false });
  },
};

expose(assembler);
