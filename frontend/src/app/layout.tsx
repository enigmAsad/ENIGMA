
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navigation from "@/components/Navigation";
import { AuthProvider } from "@/hooks/useStudentAuth";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ENIGMA - Bias-Free AI Admissions",
  description: "Fair, transparent, and AI-powered university admissions system with blind evaluation and cryptographic audit trails",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gray-50`}
      >
        <AuthProvider>
          <Navigation />
          <main className="min-h-screen">
            {children}
          </main>
          <footer className="bg-gray-900 text-white py-8 mt-16">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
              <p className="text-sm text-gray-400">
                &copy; {new Date().getFullYear()} ENIGMA Project. Committed to fair and transparent admissions.
              </p>
            </div>
          </footer>
        </AuthProvider>
      </body>
    </html>
  );
}

