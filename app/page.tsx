"use client";

import { Navbar } from "@/components/shared/Navbar";
import { ToolCard } from "@/components/shared/ToolCard";
import {
  FileText,
  Merge,
  FileDown,
  RotateCw,
  FilePlus,
  Trash2,
  Upload,
  Settings2,
  Download,
} from "lucide-react";

const tools = [
  {
    icon: FileText,
    title: "Edit PDF",
    description:
      "Edit text, replace images, annotate, highlight, and draw on your PDF documents.",
    href: "/edit",
    color: "from-indigo-500",
    colorTo: "to-violet-500",
  },
  {
    icon: Merge,
    title: "Merge PDFs",
    description:
      "Combine multiple PDF files into a single document in seconds.",
    href: "/merge",
    color: "from-blue-500",
    colorTo: "to-cyan-500",
  },
  {
    icon: FileDown,
    title: "Compress PDF",
    description:
      "Reduce file size while maintaining quality. Perfect for email and sharing.",
    href: "/compress",
    color: "from-emerald-500",
    colorTo: "to-teal-500",
  },
  {
    icon: RotateCw,
    title: "Rotate Pages",
    description:
      "Fix page orientation by rotating individual or all pages at once.",
    href: "/rotate",
    color: "from-amber-500",
    colorTo: "to-orange-500",
  },
  {
    icon: FilePlus,
    title: "Add Pages",
    description:
      "Insert blank pages or additional content anywhere in your document.",
    href: "/edit",
    color: "from-rose-500",
    colorTo: "to-pink-500",
  },
  {
    icon: Trash2,
    title: "Delete Pages",
    description: "Remove unwanted pages from your PDF quickly and easily.",
    href: "/edit",
    color: "from-slate-500",
    colorTo: "to-gray-600",
  },
];

const steps = [
  {
    icon: Upload,
    number: "1",
    title: "Upload",
    description: "Select your PDF from your device or drag and drop it.",
  },
  {
    icon: Settings2,
    number: "2",
    title: "Modify",
    description: "Use our professional tools to edit, merge, or compress.",
  },
  {
    icon: Download,
    number: "3",
    title: "Download",
    description: "Export your production-ready file in one click.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      {/* ── Hero Section ──────────────────────────────────────────── */}
      <section className="relative pt-32 pb-20 overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-gradient-to-br from-indigo-100/60 via-violet-50/40 to-transparent rounded-full blur-3xl" />
          <div className="absolute top-40 right-0 w-[400px] h-[400px] bg-gradient-to-bl from-blue-100/50 to-transparent rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-5xl mx-auto px-6 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-700 text-xs font-semibold px-4 py-1.5 rounded-full mb-6 animate-fade-in-up border border-indigo-100">
            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
            Professional PDF Tools — Free & Online
          </div>

          {/* Headline */}
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.1] mb-6 animate-fade-in-up delay-100">
            All Your <span className="gradient-text">PDF Tools</span>
            <br />
            In One Place
          </h1>

          {/* Subtitle */}
          <p className="text-lg md:text-xl text-slate-500 max-w-2xl mx-auto mb-10 animate-fade-in-up delay-200 leading-relaxed">
            Edit text, merge files, compress documents, and rotate pages — all
            in your browser. No installation required.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in-up delay-300">
            <a
              href="/edit"
              className="inline-flex items-center gap-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white text-base font-semibold px-8 py-4 rounded-2xl shadow-lg shadow-indigo-500/25 hover:shadow-xl hover:shadow-indigo-500/30 transition-all active:scale-[0.97]"
            >
              <FileText className="w-5 h-5" />
              Start Editing
            </a>
            <a
              href="#tools"
              className="inline-flex items-center gap-2 text-slate-600 hover:text-indigo-600 text-base font-semibold px-6 py-4 rounded-2xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50 transition-all"
            >
              Explore Tools
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19.5 13.5L12 21m0 0l-7.5-7.5M12 21V3"
                />
              </svg>
            </a>
          </div>
        </div>
      </section>

      {/* ── How It Works ──────────────────────────────────────────── */}
      <section className="py-20 bg-slate-50/60">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-3">
              How It Works
            </h2>
            <p className="text-slate-500 text-lg max-w-lg mx-auto">
              Three simple steps to transform your PDFs
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {steps.map((step, i) => (
              <div
                key={step.number}
                className={`text-center animate-fade-in-up delay-${(i + 1) * 100}`}
              >
                <div className="relative w-16 h-16 mx-auto mb-5">
                  <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 to-violet-500 rounded-2xl rotate-3 opacity-20" />
                  <div className="relative w-16 h-16 bg-white rounded-2xl shadow-md flex items-center justify-center border border-slate-100">
                    <step.icon className="w-7 h-7 text-indigo-600" />
                  </div>
                  <div className="absolute -top-2 -right-2 w-6 h-6 bg-indigo-600 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-md">
                    {step.number}
                  </div>
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-1.5">
                  {step.title}
                </h3>
                <p className="text-sm text-slate-500 leading-relaxed">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Tool Grid ─────────────────────────────────────────────── */}
      <section id="tools" className="py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-3">
              Professional PDF Tools
            </h2>
            <p className="text-slate-500 text-lg max-w-lg mx-auto">
              Everything you need to work with PDFs, all in one place
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {tools.map((tool, i) => (
              <ToolCard
                key={tool.title}
                {...tool}
                delay={`delay-${(i + 1) * 100}`}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────── */}
      <footer className="border-t border-slate-100 py-10">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <div className="flex items-center justify-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center">
              <FileText className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-bold text-slate-700">PDF Studio</span>
          </div>
          <p className="text-xs text-slate-400">
            Professional PDF tools, free and open source.
          </p>
        </div>
      </footer>
    </div>
  );
}
