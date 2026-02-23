"use client";

import { Navbar } from "@/components/shared/Navbar";
import { UploadZone } from "@/components/shared/UploadZone";
import { ArrowLeft, FileText } from "lucide-react";
import Link from "next/link";

export default function EditPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-slate-50">
      <Navbar />

      <main className="pt-28 pb-20 px-6">
        {/* Back button */}
        <div className="max-w-2xl mx-auto mb-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-indigo-600 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Tools
          </Link>
        </div>

        {/* Header */}
        <div className="text-center mb-10 animate-fade-in-up">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 mb-5">
            <FileText className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-2">
            Edit PDF
          </h1>
          <p className="text-slate-500 text-lg max-w-md mx-auto">
            Upload your PDF to start editing text, images, and annotations
          </p>
        </div>

        {/* Upload Zone */}
        <UploadZone
          toolName="Edit"
          toolDescription="Drag and drop your PDF here to open it in the editor with full editing tools."
          editorMode="edit"
        />

        {/* Features preview */}
        <div className="max-w-2xl mx-auto mt-12 grid grid-cols-3 gap-4 animate-fade-in-up delay-300">
          {["Edit Text", "Add Images", "Annotate"].map((f) => (
            <div
              key={f}
              className="text-center py-3 px-4 rounded-xl bg-white border border-slate-100 shadow-sm"
            >
              <p className="text-sm font-semibold text-slate-700">{f}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
