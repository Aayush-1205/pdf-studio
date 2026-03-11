"use client";

import { Navbar } from "@/components/shared/Navbar";
import {
  FileText,
  UploadCloud,
  Layers,
  Sparkles,
  ShieldCheck,
  Zap,
} from "lucide-react";
import Link from "next/link";

const features = [
  {
    icon: Sparkles,
    label: "Advanced Editing",
    description: "Edit text directly, add shapes, draw freehand, and place images with a powerful, modern canvas.",
    color: "from-fuchsia-500 to-pink-500",
  },
  {
    icon: Layers,
    label: "Page Master",
    description: "Reorder, rotate, delete, or insert new pages on the fly with a magical layer system.",
    color: "from-indigo-500 to-cyan-500",
  },
  {
    icon: ShieldCheck,
    label: "Client-Side First",
    description: "Your files never leave your device unless you explicitly upload them to your Google Drive.",
    color: "from-emerald-500 to-teal-500",
  },
  {
    icon: Zap,
    label: "Blazing Fast",
    description: "Powered by modern web technologies for instant rendering and zero-lag editing.",
    color: "from-amber-500 to-orange-500",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-50 selection:bg-indigo-100 selection:text-indigo-900 overflow-x-hidden font-sans">
      <Navbar />

      {/* ── Majestic Hero Section ──────────────────────────────────── */}
      <section className="relative pt-40 pb-32 flex flex-col items-center justify-center min-h-[90vh] text-center px-4">
        {/* Abstract Glowing Orbs Background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
          <div className="absolute top-[10%] left-[20%] w-[500px] h-[500px] bg-linear-to-br from-indigo-400/30 to-purple-400/30 blur-[100px] rounded-full mix-blend-multiply animate-blob" />
          <div className="absolute top-[20%] right-[20%] w-[400px] h-[400px] bg-linear-to-br from-pink-400/30 to-rose-400/30 blur-[100px] rounded-full mix-blend-multiply animate-blob animation-delay-2000" />
          <div className="absolute bottom-[10%] left-[30%] w-[600px] h-[600px] bg-linear-to-br from-cyan-400/20 to-blue-400/20 blur-[120px] rounded-full mix-blend-multiply animate-blob animation-delay-4000" />
        </div>

        <div className="relative z-10 max-w-5xl mx-auto flex flex-col items-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/60 border border-indigo-100/50 backdrop-blur-md shadow-sm mb-8 animate-fade-in-up">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
            </span>
            <span className="text-xs font-bold tracking-widest uppercase text-indigo-800">
              The Next-Gen PDF Editor
            </span>
          </div>

          <h1 className="text-6xl md:text-8xl font-black tracking-tighter text-slate-900 leading-[1.05] mb-8 animate-fade-in-up delay-100">
            Edit PDFs with
            <br />
            <span className="bg-clip-text text-transparent bg-linear-to-r from-indigo-500 via-purple-500 to-pink-500">
              Zero Friction.
            </span>
          </h1>

          <p className="text-xl md:text-2xl text-slate-500 font-medium max-w-2xl mx-auto mb-12 animate-fade-in-up delay-200 leading-relaxed">
            Experience a beautifully crafted, blazing fast PDF editor in your browser. Annotate, modify, and organize pages without installing clunky software.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-5 w-full sm:w-auto animate-fade-in-up delay-300">
            <Link
              href="/editor"
              className="group relative flex items-center justify-center gap-3 w-full sm:w-auto px-8 py-4 bg-slate-900 text-white rounded-2xl font-bold text-lg hover:bg-slate-800 transition-all hover:scale-105 active:scale-95 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)]"
            >
              <FileText className="w-5 h-5 group-hover:-rotate-12 transition-transform" />
              Open Editor
              <div className="absolute inset-0 rounded-2xl ring-2 ring-indigo-500 ring-offset-2 ring-offset-slate-50 opacity-0 group-focus-visible:opacity-100 transition-opacity" />
            </Link>
            <Link
              href="/drive"
              className="group flex items-center justify-center gap-2 w-full sm:w-auto px-8 py-4 bg-white text-slate-700 rounded-2xl font-bold text-lg hover:text-indigo-600 transition-all shadow-sm border border-slate-200 hover:border-indigo-200 hover:shadow-md active:scale-95"
            >
              <UploadCloud className="w-5 h-5 group-hover:-translate-y-1 transition-transform" />
              Upload from Drive
            </Link>
          </div>
        </div>

        {/* Floating Preview Image / Mockup Hook */}
        <div className="relative z-10 w-full max-w-6xl mx-auto mt-24 animate-fade-in-up delay-500">
          <div className="absolute inset-0 bg-linear-to-b from-indigo-500/10 to-transparent blur-3xl -z-10 rounded-[3rem]" />
          <div className="relative rounded-[2rem] border border-white/40 bg-white/40 backdrop-blur-2xl p-2 md:p-4 shadow-2xl">
            <style>{`
              @keyframes float-slow {
                0%, 100% { transform: translateY(0px) rotate(-1deg); }
                50% { transform: translateY(-10px) rotate(1deg); }
              }
              @keyframes float-medium {
                0%, 100% { transform: translateY(0px); }
                50% { transform: translateY(-15px); }
              }
              @keyframes pulse-soft {
                0%, 100% { opacity: 0.8; }
                50% { opacity: 0.3; }
              }
            `}</style>
            <div className="rounded-[1.5rem] overflow-hidden border border-slate-200/50 bg-slate-50 aspect-video md:aspect-21/9 flex items-center justify-center relative shadow-inner">
              {/* Abstract Canvas Background */}
              <div className="absolute inset-0 bg-slate-100 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-size-[4rem_4rem] mask-[radial-gradient(ellipse_80%_80%_at_50%_50%,#000_60%,transparent_100%)] opacity-50" />
              
              {/* Animated Floating Graphic Items */}
              {/* 1. Main Document Context */}
              <div 
                className="absolute w-[80%] md:w-[45%] h-[75%] md:h-[80%] bg-white rounded-xl md:rounded-2xl shadow-[0_20px_40px_-15px_rgba(0,0,0,0.1)] border border-slate-200/60 p-4 md:p-7 flex flex-col"
                style={{ animation: 'float-slow 8s ease-in-out infinite' }}
              >
                 <div className="w-1/3 h-3 md:h-4 bg-slate-200 rounded-full mb-6 md:mb-8" />
                 <div className="w-full h-2 md:h-3 bg-slate-100 rounded-full mb-3 md:mb-4" />
                 <div className="w-5/6 h-2 md:h-3 bg-slate-100 rounded-full mb-3 md:mb-4" />
                 <div className="w-full h-2 md:h-3 bg-slate-100 rounded-full mb-3 md:mb-4" />
                 <div className="w-4/6 h-2 md:h-3 bg-slate-100 rounded-full mb-6 md:mb-10" />
                 
                 {/* Selection Box Simulation */}
                 <div className="w-full grow bg-indigo-50/50 rounded-lg md:rounded-xl border-2 border-indigo-400 border-dashed relative">
                   <div className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-white border border-indigo-400 rounded-full" />
                   <div className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-white border border-indigo-400 rounded-full" />
                   <div className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-white border border-indigo-400 rounded-full" />
                   <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white border border-indigo-400 rounded-full" />
                   <div className="absolute inset-0 flex items-center justify-center">
                     <Layers className="text-indigo-300 w-8 h-8 md:w-12 md:h-12" style={{ animation: 'pulse-soft 2s ease-in-out infinite' }} />
                   </div>
                 </div>
              </div>

              {/* 2. Floating Toolbar (Dynamic Island Style) */}
              <div 
                className="absolute bottom-6 md:bottom-10 bg-white/80 backdrop-blur-xl border border-slate-200/60 rounded-full p-2 flex items-center gap-2 shadow-[0_10px_25px_-5px_rgba(0,0,0,0.1)]"
                style={{ animation: 'float-medium 6s ease-in-out infinite 1s' }}
              >
                  <div className="w-8 h-8 md:w-12 md:h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 border border-white">
                    <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                  </div>
                  <div className="w-8 h-8 md:w-12 md:h-12 rounded-full bg-linear-to-r from-indigo-500 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                    <Sparkles className="w-4 h-4 md:w-5 md:h-5 text-white" />
                  </div>
                  <div className="w-8 h-8 md:w-12 md:h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 border border-white">
                    <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                  </div>
              </div>

              {/* 3. Floating Sidebar Panel (Right) */}
              <div 
                className="hidden md:flex absolute right-[10%] top-[25%] bg-white/70 backdrop-blur-xl w-[240px] rounded-3xl border border-white shadow-2xl p-5 flex-col gap-4"
                style={{ animation: 'float-medium 7s ease-in-out infinite 2s' }}
              >
                <div className="flex items-center justify-between mb-2">
                   <div className="w-24 h-3 bg-slate-200/80 rounded-full" />
                   <div className="w-6 h-6 rounded-full bg-slate-100" />
                </div>
                <div className="flex gap-2">
                  <div className="h-10 flex-1 bg-white border border-slate-200/60 rounded-xl shadow-sm" />
                  <div className="h-10 flex-1 bg-indigo-50 border border-indigo-100 rounded-xl shadow-sm text-indigo-500 flex items-center justify-center">
                     <div className="w-5 h-2 bg-indigo-200 rounded-full" />
                  </div>
                </div>
                <div className="h-24 w-full bg-slate-50 border border-slate-100 rounded-xl mt-2 flex items-center justify-center overflow-hidden">
                   <div className="w-[120%] h-[120%] bg-linear-to-br from-indigo-50 via-white to-purple-50 rounded-full opacity-50" />
                </div>
              </div>

            </div>
          </div>
        </div>
      </section>

      {/* ── Features Grid ──────────────────────────────────────────── */}
      <section className="py-24 relative overflow-hidden bg-white">
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="text-center mb-20 max-w-3xl mx-auto">
            <h2 className="text-4xl md:text-5xl font-black text-slate-900 mb-6 tracking-tight">
              A Complete Studio, <br/> Built for Speed.
            </h2>
            <p className="text-lg text-slate-500 font-medium">
              We stripped out the complexity of traditional PDF software and built an engine that runs silently, securely, and seamlessly right in your browser.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feat, i) => (
              <div key={i} className="group p-8 rounded-3xl bg-slate-50 hover:bg-white border border-slate-100 hover:border-indigo-100 hover:shadow-xl transition-all duration-300">
                <div className={`w-14 h-14 rounded-2xl bg-linear-to-br ${feat.color} flex items-center justify-center mb-6 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                  <feat.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">{feat.label}</h3>
                <p className="text-slate-500 leading-relaxed font-medium">{feat.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Call to Action ─────────────────────────────────────────── */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-slate-900 z-0">
           {/* Dark mode glow */}
           <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[500px] bg-indigo-500/20 blur-[120px] rounded-full" />
        </div>
        
        <div className="relative z-10 max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-4xl md:text-6xl font-black text-white mb-6 tracking-tight">
            Ready to edit?
          </h2>
          <p className="text-xl text-indigo-200/80 mb-10 max-w-2xl mx-auto font-medium">
            Jump right into the editor. It's free, it's fast, and no registration is strictly required to try it out.
          </p>
          <Link
            href="/editor"
            className="inline-flex items-center justify-center gap-2 px-10 py-5 bg-white text-slate-900 rounded-full font-black text-lg hover:bg-indigo-50 hover:text-indigo-700 transition-all hover:scale-105 active:scale-95 shadow-[0_0_40px_-10px_rgba(255,255,255,0.3)]"
          >
            Launch Editor Now
            <svg className="w-5 h-5 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </Link>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────── */}
      <footer className="bg-slate-900 border-t border-white/10 py-12">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-indigo-500 flex items-center justify-center">
              <FileText className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-bold text-white tracking-tight">PDF Studio</span>
          </div>
          <p className="text-sm text-slate-500 font-medium">
            © {new Date().getFullYear()} PDF Studio. Open source and privacy-first.
          </p>
        </div>
      </footer>
    </div>
  );
}
