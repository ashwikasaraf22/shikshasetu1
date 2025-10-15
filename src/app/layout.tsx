import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";
import { AuthProvider } from "@/components/auth/AuthProvider";
import RegisterSW from "@/components/RegisterSW"; // <-- add this line

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
export const metadata: Metadata = {
  title: "Shiksha Setu",
  description: "A revolutionary learning platform for students, teachers, and parents.",
  manifest: "/manifest.webmanifest", // ✅ ensure it matches the filename below
  themeColor: "#4f46e5",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="application-name" content="Shiksha Setu" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Shiksha Setu" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="theme-color" content="#4f46e5" />

        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="icon" href="/icons/icon-192.png" />
        <link rel="apple-touch-icon" href="/icons/icon-512.png" />

        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className={cn("min-h-screen bg-background font-sans antialiased", inter.variable)}>
        <AuthProvider>
          {children}
          <Toaster />
          <RegisterSW /> {/* ✅ Registers the service worker for install prompt */}
        </AuthProvider>
      </body>
    </html>
  );
}
