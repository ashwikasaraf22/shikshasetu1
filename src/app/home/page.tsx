'use client';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BookText, ArrowRight, LogIn, MessageCircle, Eye } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/components/auth/AuthProvider";
import { useRouter } from "next/navigation";

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const handleGetStarted = () => {
    if (user) {
      switch (user.role) {
        case "parent":
          router.push("/parent");
          break;
        case "teacher":
          router.push("/teacher");
          break;
        case "student":
          router.push("/student");
          break;
        default:
          router.push("/student");
          break;
      }
    } else {
      router.push("/login");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 via-pink-50 to-yellow-50 text-gray-800">
      {/* Header */}
      <header className="max-w-6xl mx-auto px-6 py-8 flex flex-col items-center justify-center text-center relative">
        {/* Title Row — logo + text side by side */}
        <div className="flex items-center justify-center gap-3 mb-2">
          <Image
            src="/image/icon-192x192.png"
            alt="Shiksha Setu Logo"
            width={55}
            height={55}
            className="drop-shadow-md"
          />
          <h1 className="text-4xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-700 via-pink-600 to-indigo-500 drop-shadow-lg tracking-wide">
            Shiksha Setu
          </h1>
        </div>

        <p className="text-purple-800 font-medium text-base sm:text-lg max-w-2xl">
          Bridging Learning with Simplicity 🌱
        </p>

        {/* Right-side buttons */}
        <div className="absolute right-6 top-8">
          {/* Wait for auth to finish before showing actions */}
          {loading ? (
            <div className="h-9 w-28 rounded-full bg-purple-100 animate-pulse" />
          ) : user ? (
            <div className="flex items-center gap-3">
              <div className="text-sm text-right">
                <div className="font-medium">{user.name || user.email}</div>
                <div className="text-xs text-muted-foreground capitalize">{user.role}</div>
              </div>
              {/* IMPORTANT: Plain link to /profile (no /app prefix) */}
              <Link href="/profile" prefetch={false}>
                <Button variant="ghost" size="sm">Profile</Button>
              </Link>
            </div>
          ) : (
            <Link href="/login" prefetch={false}>
              <Button variant="ghost" size="sm" className="text-purple-700 hover:bg-purple-100">
                <LogIn className="mr-2 h-4 w-4" />
                Login
              </Button>
            </Link>
          )}
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6">
        {/* Hero Section */}
        <section className="relative rounded-3xl bg-gradient-to-r from-purple-200 via-pink-100 to-blue-50 p-10 mb-10 overflow-hidden shadow-xl">
          <BookText className="absolute -top-12 -left-12 h-44 w-44 text-purple-300 opacity-20 rotate-12" />
          <MessageCircle className="absolute -bottom-12 -right-12 h-44 w-44 text-pink-300 opacity-20 rotate-12" />

          <div className="flex flex-col md:flex-row items-center gap-10 relative z-10">
            <div className="flex-1">
              <h2 className="text-4xl sm:text-5xl font-extrabold leading-tight text-purple-800 mb-3">
                Learn better, faster, and with confidence.
              </h2>
              <p className="text-lg text-purple-700 mb-6">
                For Students — Take tests, track progress, and learn with your AI tutor.
              </p>

              <Button
                onClick={handleGetStarted}
                className="bg-gradient-to-r from-purple-600 to-indigo-500 hover:brightness-110 text-white px-6 py-3 text-lg rounded-xl shadow-md transition-all"
              >
                Get Started
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>

            <div className="w-full md:w-1/2 flex justify-center">
              <Image
                src="/image/icon-400x200.png"
                alt="Learning Illustration"
                width={320}
                height={180}
                className="drop-shadow-md"
              />
            </div>
          </div>
        </section>

        {/* Feature Cards */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-10">
          {/* Smart AI */}
          <Card className="relative rounded-3xl bg-gradient-to-br from-purple-200 via-purple-100 to-purple-50 shadow-lg hover:shadow-2xl transition-transform hover:-translate-y-1">
            <BookText className="absolute -top-5 -right-5 h-32 w-32 text-purple-300 opacity-20 rotate-12" />
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-purple-700">
                <BookText className="h-8 w-8" />
                Smart AI Tutor
              </CardTitle>
              <CardDescription>
                Get simplified explanations, AI-generated notes, and personalized quizzes. Learn through visual aids and interactive tools.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="list-disc list-inside text-sm text-purple-800">
                <li>Custom Paths & Progress Tracking</li>
                <li>Interactive Content for Fun Learning</li>
              </ul>
            </CardContent>
          </Card>

          {/* Doubt Solver */}
          <Card className="relative rounded-3xl bg-gradient-to-br from-green-200 via-green-100 to-green-50 shadow-lg hover:shadow-2xl transition-transform hover:-translate-y-1">
            <MessageCircle className="absolute -top-5 -right-5 h-32 w-32 text-green-300 opacity-20 rotate-12" />
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-green-700">
                <MessageCircle className="h-8 w-8" />
                Instant Doubt Solver
              </CardTitle>
              <CardDescription>
                Ask any question and get instant AI answers. Connect with teachers for deeper clarity.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="list-disc list-inside text-sm text-green-800">
                <li>Quick AI Responses</li>
                <li>Teacher Support for Complex Topics</li>
              </ul>
            </CardContent>
          </Card>

          {/* Community Hub */}
          <Card className="relative rounded-3xl bg-gradient-to-br from-pink-200 via-pink-100 to-pink-50 shadow-lg hover:shadow-2xl transition-transform hover:-translate-y-1">
            <Eye className="absolute -top-5 -right-5 h-32 w-32 text-pink-300 opacity-20 rotate-12" />
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-pink-700">
                <Eye className="h-8 w-8" />
                Community Hub
              </CardTitle>
              <CardDescription>
                Collaborate, discuss, and learn together. Share insights and ideas with peers.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="list-disc list-inside text-sm text-pink-800">
                <li>Peer Collaboration</li>
                <li>Discussion Boards</li>
              </ul>
            </CardContent>
          </Card>
        </section>

        {/* Why Shiksha Setu */}
        <section className="mb-10 text-center">
          <h3 className="text-2xl font-semibold mb-3 text-purple-700">
            Why Shiksha Setu?
          </h3>
          <p className="text-purple-800 max-w-3xl mx-auto leading-relaxed">
            Shiksha Setu bridges learning gaps with a blend of AI and teacher guidance.
            Experience smart, personalized education that makes learning engaging, effective, and effortless.
          </p>
        </section>
      </div>

      <footer className="border-t mt-8 py-6 text-center text-sm text-purple-600">
        © {new Date().getFullYear()} <span className="font-semibold">Shiksha Setu</span>. All rights reserved.
      </footer>
    </div>
  );
}
