import { useEffect, useRef, useState } from "react";
import { wrap, proxy } from "comlink";
import { useCompressorStore, CompressionLevel } from "../store/useCompressorStore";
import type { CompressionProgress } from "../workers/pdfCompressor.worker";

type CompressionSource = Uint8Array | ArrayBuffer | string;

export interface CompressionResult {
  pdfBytes: Uint8Array;
  originalSize: number;
  compressedSize: number;
  pageCount: number;
}

export function usePDFCompressor() {
  const workerRef = useRef<Worker | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const apiRef = useRef<any>(null);
  const [workerReady, setWorkerReady] = useState(false);
  const [lastBlob, setLastBlob] = useState<Blob | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const { beginJob, onProgress, onSuccess, onError, reset } = useCompressorStore();

  useEffect(() => {
    const worker = new Worker(
      new URL("../workers/pdfCompressor.worker.ts", import.meta.url),
      { type: "module" }
    );
    workerRef.current = worker;
    apiRef.current = wrap(worker);
    setWorkerReady(true);

    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
      }
    };
  }, []);

  const cancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    reset();
  };

  const compress = async (source: CompressionSource, level: CompressionLevel, fileName: string) => {
    if (!apiRef.current) {
      throw new Error("Worker not initialized");
    }

    // Cancel any in-flight jobs
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    const signal = controller.signal;

    beginJob(fileName);

    try {
      // Normalise source to Uint8Array
      let bytes: Uint8Array;
      if (source instanceof Uint8Array) {
        bytes = source;
      } else if (source instanceof ArrayBuffer) {
        bytes = new Uint8Array(source);
      } else if (typeof source === "string" && source.startsWith("data:")) {
        const base64 = source.split(",")[1] || source;
        const binary = atob(base64);
        bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
      } else {
        throw new Error("Invalid compression source format");
      }

      if (signal.aborted) return;

      const progressCallback = proxy((prog: CompressionProgress) => {
        if (signal.aborted) return;
        onProgress(prog.phase, prog.percent, prog.message);
      });

      const { pdfBytes, pageCount } = await apiRef.current.compress(
        bytes,
        level,
        progressCallback
      );

      if (signal.aborted) return;

      const blob = new Blob([pdfBytes], { type: "application/pdf" });
      setLastBlob(blob);
      onSuccess(bytes.byteLength, pdfBytes.byteLength, pageCount);
    } catch (err: unknown) {
      if (signal.aborted) return;
      console.error("Compression Error:", err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      onError(errorMessage || "An error occurred during compression.");
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
    }
  };

  return {
    compress,
    cancel,
    lastBlob,
    workerReady,
  };
}
export type { CompressionProgress };
