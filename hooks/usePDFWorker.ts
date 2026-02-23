import { useEffect, useState } from "react";

// ── Types for the worker's public API ───────────────────────────────

export interface PDFWorkerAPI {
  mergePDFs(a: Uint8Array, b: Uint8Array): Promise<Uint8Array>;
  reorderPages(pdfBytes: Uint8Array, newOrder: number[]): Promise<Uint8Array>;
  insertBlankPage(
    pdfBytes: Uint8Array,
    afterPageIndex: number,
  ): Promise<Uint8Array>;
  deletePage(pdfBytes: Uint8Array, pageIndex: number): Promise<Uint8Array>;
  rotatePage(
    pdfBytes: Uint8Array,
    pageIndex: number,
    degrees: number,
  ): Promise<Uint8Array>;
  replaceText(
    pdfBytes: Uint8Array,
    pageIndex: number,
    rect: { x: number; y: number; width: number; height: number },
    newText: string,
    fontName: string,
    fontSize: number,
    color: { r: number; g: number; b: number },
    format?: {
      isBold?: boolean;
      isItalic?: boolean;
      isUnderline?: boolean;
      isStrikethrough?: boolean;
      alignment?: "left" | "center" | "right" | "justify";
      bgColor?: { r: number; g: number; b: number };
    },
  ): Promise<Uint8Array>;
  addText(
    pdfBytes: Uint8Array,
    pageIndex: number,
    x: number,
    y: number,
    text: string,
    fontFamily: string,
    fontSize: number,
    color: { r: number; g: number; b: number },
    format?: {
      isBold?: boolean;
      isItalic?: boolean;
      isUnderline?: boolean;
      isStrikethrough?: boolean;
      alignment?: "left" | "center" | "right" | "justify";
      bgColor?: { r: number; g: number; b: number };
    },
    width?: number,
    height?: number,
  ): Promise<Uint8Array>;
  replaceImage(
    pdfBytes: Uint8Array,
    pageIndex: number,
    rect: { x: number; y: number; width: number; height: number },
    newImageBytes: Uint8Array,
    imageType: "png" | "jpg",
  ): Promise<Uint8Array>;
  deleteImage(
    pdfBytes: Uint8Array,
    pageIndex: number,
    rect: { x: number; y: number; width: number; height: number },
  ): Promise<Uint8Array>;
  addImage(
    pdfBytes: Uint8Array,
    pageIndex: number,
    x: number,
    y: number,
    width: number,
    height: number,
    imageBytes: Uint8Array,
    imageType: "png" | "jpg",
  ): Promise<Uint8Array>;
  bakeHighlights(
    pdfBytes: Uint8Array,
    highlights: Array<{
      pageIndex: number;
      x: number;
      y: number;
      width: number;
      height: number;
      color: { r: number; g: number; b: number };
      opacity: number;
    }>,
  ): Promise<Uint8Array>;
  eraseArea(
    pdfBytes: Uint8Array,
    pageIndex: number,
    rect: { x: number; y: number; width: number; height: number },
  ): Promise<Uint8Array>;
  bakeEdits(
    pdfBytes: Uint8Array,
    overlays: import("@/app/lib/overlayTypes").BakeOverlay[],
    customFontBytes?: Uint8Array,
  ): Promise<Uint8Array>;
}

// ── Promise-based message wrapper ───────────────────────────────────

function createWorkerProxy(worker: Worker): PDFWorkerAPI {
  let idCounter = 0;
  const pending = new Map<
    string,
    { resolve: (v: unknown) => void; reject: (e: Error) => void }
  >();

  worker.onmessage = (
    event: MessageEvent<{ id: string; result?: unknown; error?: string }>,
  ) => {
    const { id, result, error } = event.data;
    const handler = pending.get(id);
    if (!handler) return;
    pending.delete(id);
    if (error) {
      handler.reject(new Error(error));
    } else {
      handler.resolve(result);
    }
  };

  function call(method: string, ...args: unknown[]): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const id = `msg_${++idCounter}`;
      pending.set(id, { resolve, reject });
      worker.postMessage({ id, method, args });
    });
  }

  // Build the typed API proxy
  return new Proxy({} as PDFWorkerAPI, {
    get(_target, prop: string) {
      return (...args: unknown[]) => call(prop, ...args);
    },
  });
}

// ── React Hook ──────────────────────────────────────────────────────

export function usePDFWorker() {
  const [api, setApi] = useState<PDFWorkerAPI | null>(null);

  useEffect(() => {
    const rawWorker = new Worker(
      new URL("../workers/pdf.worker.ts", import.meta.url),
    );
    const proxy = createWorkerProxy(rawWorker);
    setApi(proxy);

    return () => {
      rawWorker.terminate();
    };
  }, []);

  return api;
}
