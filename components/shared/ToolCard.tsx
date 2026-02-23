"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";

interface ToolCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  href: string;
  color: string; // Tailwind gradient from (e.g. "from-indigo-500")
  colorTo: string; // Tailwind gradient to (e.g. "to-violet-500")
  delay?: string; // Animation delay class
}

export function ToolCard({
  icon: Icon,
  title,
  description,
  href,
  color,
  colorTo,
  delay = "",
}: ToolCardProps) {
  return (
    <Link
      href={href}
      className={`group relative overflow-hidden rounded-2xl bg-white border border-slate-200/80 p-6 hover:border-slate-300 hover:shadow-xl transition-all duration-300 animate-fade-in-up ${delay}`}
    >
      {/* Gradient glow on hover */}
      <div
        className={`absolute inset-0 bg-gradient-to-br ${color} ${colorTo} opacity-0 group-hover:opacity-[0.04] transition-opacity duration-300`}
      />

      {/* Icon */}
      <div
        className={`w-12 h-12 rounded-xl bg-gradient-to-br ${color} ${colorTo} flex items-center justify-center shadow-md group-hover:shadow-lg group-hover:scale-110 transition-all duration-300 mb-4`}
      >
        <Icon className="w-6 h-6 text-white" />
      </div>

      {/* Content */}
      <h3 className="text-lg font-bold text-slate-900 mb-1.5 group-hover:text-indigo-700 transition-colors">
        {title}
      </h3>
      <p className="text-sm text-slate-500 leading-relaxed">{description}</p>

      {/* Arrow */}
      <div className="mt-4 flex items-center gap-1.5 text-sm font-semibold text-indigo-600 opacity-0 group-hover:opacity-100 translate-x-[-4px] group-hover:translate-x-0 transition-all duration-300">
        Get started
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
            d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
          />
        </svg>
      </div>
    </Link>
  );
}
