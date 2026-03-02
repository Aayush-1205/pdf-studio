"use client";
import { useEffect, useState } from "react";

export const usePDFWorker = () => {
  const [worker, setWorker] = useState<Worker | null>(null);

  useEffect(() => {
    // Instantiate the worker
    const w = new Worker(new URL("../workers/pdf.worker.ts", import.meta.url), {
      type: "module",
    });
    setWorker(w);

    return () => {
      w.terminate();
    };
  }, []);

  return worker;
};
