import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function EditorPage() {
  return (
    <div className="h-screen w-full flex flex-col bg-slate-50">
      <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4 shrink-0 shadow-sm z-10 w-full">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-700 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold bg-linear-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              PDF Studio
            </h1>
            <span className="text-sm font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
              Editor (Scratch)
            </span>
          </div>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden w-full relative">
        <div className="absolute inset-0 flex items-center justify-center text-slate-400">
          Editor Code Removed. Ready to start from scratch.
        </div>
      </main>
    </div>
  );
}
