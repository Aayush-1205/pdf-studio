import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import Canvas from "@/components/editor/Canvas";
import { DocumentStats } from "@/components/editor/DocumentStats";

export default function EditorPage() {
  return (
    <div className="relative h-screen w-full flex flex-col bg-slate-50/50 overflow-hidden font-sans">
      {/* Premium Glass Header */}
      <header className="absolute top-0 left-0 right-0 h-[72px] bg-white/70 backdrop-blur-2xl border-b border-white/50 flex items-center justify-between px-6 shrink-0 shadow-[0_2px_15px_rgba(0,0,0,0.03)] z-20 w-full transition-all duration-300">
        <div className="flex items-center gap-5">
          <Link
            href="/"
            className="p-2.5 bg-white/60 hover:bg-white rounded-xl text-slate-500 hover:text-indigo-600 transition-all duration-300 shadow-sm border border-slate-200/60 group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          </Link>
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-black tracking-tight bg-linear-to-r from-violet-600 via-indigo-600 to-blue-600 bg-clip-text text-transparent transform hover:scale-[1.02] transition-transform cursor-default">
              PDF Studio
            </h1>
            <span className="text-[10px] font-bold tracking-widest uppercase px-3 py-1.5 rounded-full bg-indigo-50/80 text-indigo-500 border border-indigo-100/50 shadow-sm">
              Editor Pro
            </span>
          </div>
        </div>
        <DocumentStats />
      </header>
      
      {/* Main Workspace */}
      <div className="flex-1 w-full h-full relative z-10 pt-[72px]">
        <Canvas />
      </div>
    </div>
  );
}
