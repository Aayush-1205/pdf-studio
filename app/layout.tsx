import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "PDF Studio — Professional PDF Editor",
  description:
    "Edit, merge, compress, and rotate PDFs online. Free, fast, and professional-grade tools right in your browser.",
  keywords: [
    "PDF editor",
    "merge PDF",
    "compress PDF",
    "rotate PDF",
    "online PDF tools",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
