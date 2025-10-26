// src/app/teacher/page.tsx
'use client';

import { T } from '@/components/T';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { MessageCircle, Users } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/components/auth/AuthProvider";
import { useRouter } from "next/navigation";

export default function TeacherHome() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const handleGetStarted = () => {
    if (user) {
      router.push("/teacher"); // You can redirect wherever you want for teachers
    } else {
      router.push("/login");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 via-pink-50 to-yellow-50 text-gray-800">
      {/* Header Section */}
      <header className="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex flex-col items-center justify-center text-center relative">
        <div className="flex items-center justify-center gap-3 mb-2 flex-wrap">
          <Image
            src="/image/icon-192x192.png"
            alt="Vidya Setu Logo"
            width={55}
            height={55}
            className="drop-shadow-md shrink-0"
            priority
          />
          <h1 className="text-3xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-700 via-pink-600 to-indigo-500 drop-shadow-lg tracking-wide leading-tight break-words">
            Vidya Setu
          </h1>
        </div>

        <p className="text-purple-800 font-medium text-base sm:text-lg max-w-2xl break-words leading-relaxed px-2">
          <T>Empowering Teachers to Inspire Students</T> ✨
        </p>

        <div className="mt-4 sm:mt-0 w-full sm:w-auto sm:absolute sm:right-6 sm:top-8 flex sm:block justify-center">
          {loading ? (
            <div className="h-9 w-28 rounded-full bg-purple-100 animate-pulse" />
          ) : user ? (
            <div className="flex items-center gap-3">
              <div className="text-sm text-right">
                <div className="font-medium break-words max-w-[200px] sm:max-w-none">{user.name || user.email}</div>
                <div className="text-xs text-muted-foreground capitalize">{user.role}</div>
              </div>
              <Link href="/profile" prefetch={false}>
                <Button variant="ghost" size="sm"><T>Profile</T></Button>
              </Link>
            </div>
          ) : (
            <Link href="/login" prefetch={false}>
              <Button className="text-purple-700 hover:bg-purple-100" variant="ghost" size="sm">
                <T>Login</T>
              </Button>
            </Link>
          )}
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Hero Section */}
        <section className="relative rounded-3xl bg-gradient-to-r from-purple-200 via-pink-100 to-blue-50 p-6 sm:p-10 mb-10 overflow-hidden shadow-xl">
          <div className="flex flex-col md:flex-row items-center gap-8 sm:gap-10 relative z-10">
            <div className="flex-1 w-full">
              <h2 className="text-3xl sm:text-5xl font-extrabold leading-tight text-purple-800 mb-3 break-words">
                <T>Guide, Teach, and Inspire.</T>
              </h2>
              <p className="text-base sm:text-lg text-purple-700 mb-6 break-words">
                <T>For Teachers — Connect with students, solve doubts, create tests, and share knowledge effortlessly.</T>
              </p>
              <Button
                onClick={handleGetStarted}
                className="bg-gradient-to-r from-purple-600 to-indigo-500 hover:brightness-110 text-white px-6 py-3 text-lg rounded-xl shadow-md transition-all"
              >
                <T>Go to Dashboard</T>
              </Button>
            </div>
            <div className="w-full md:w-1/2 flex justify-center">
              <Image
                src="/image/icon-400x200.png"
                alt="Teacher Illustration"
                width={320}
                height={180}
                className="drop-shadow-md h-auto w-auto max-w-full"
                sizes="(max-width: 768px) 80vw, 320px"
                priority
              />
            </div>
          </div>
        </section>

        {/* Feature Cards */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 mb-10">
          {/* Doubt Solver */}
          <Card className="relative rounded-3xl bg-gradient-to-br from-green-200 via-green-100 to-green-50 shadow-lg hover:shadow-2xl transition-transform hover:-translate-y-1 break-words">
            <MessageCircle className="hidden sm:block absolute -top-5 -right-5 h-32 w-32 text-green-300 opacity-20 rotate-12 pointer-events-none" />
            <CardHeader className="relative z-10">
              <CardTitle className="flex items-center gap-3 text-green-700">
                <MessageCircle className="h-8 w-8 shrink-0" />
                <T>Doubt Solver</T>
              </CardTitle>
              <CardDescription>
                <T>View and solve doubts asked by students. Teachers can also connect via call for better explanation.</T>
              </CardDescription>
            </CardHeader>
            <CardContent className="relative z-10">
              <ul className="list-disc list-inside text-sm text-green-800 space-y-1">
                <li><T>Answer student questions directly</T></li>
                <li><T>Call feature for live discussion</T></li>
              </ul>
            </CardContent>
          </Card>

          {/* Community Hub */}
          <Card className="relative rounded-3xl bg-gradient-to-br from-pink-200 via-pink-100 to-pink-50 shadow-lg hover:shadow-2xl transition-transform hover:-translate-y-1 break-words">
            <Users className="hidden sm:block absolute -top-5 -right-5 h-32 w-32 text-pink-300 opacity-20 rotate-12 pointer-events-none" />
            <CardHeader className="relative z-10">
              <CardTitle className="flex items-center gap-3 text-pink-700">
                <Users className="h-8 w-8 shrink-0" />
                <T>Community Hub</T>
              </CardTitle>
              <CardDescription>
                <T>Create and manage tests, workshops, and upload educational videos. Review submissions from students and collaborate effectively.</T>
              </CardDescription>
            </CardHeader>
            <CardContent className="relative z-10">
              <ul className="list-disc list-inside text-sm text-pink-800 space-y-1">
                <li><T>Create Tests and Workshops</T></li>
                <li><T>View Student Submissions</T></li>
                <li><T>Upload Learning Videos</T></li>
              </ul>
            </CardContent>
          </Card>
        </section>

        {/* Why Vidya Setu */}
        <section className="mb-10 text-center">
          <h3 className="text-2xl font-semibold mb-3 text-purple-700">
            <T>Why Teach with Vidya Setu?</T>
          </h3>
          <p className="text-purple-800 max-w-3xl mx-auto leading-relaxed break-words px-2">
            <T>Vidya Setu empowers educators by integrating AI tools, collaboration spaces, and interactive content creation. Focus on what truly matters — teaching and inspiring.</T>
          </p>
        </section>
      </div>

      {/* Footer */}
      <footer className="border-t mt-8 py-6 text-center text-sm text-purple-600">
        © {new Date().getFullYear()} <span className="font-semibold">Vidya Setu</span>. <T>All rights reserved.</T>
      </footer>
    </div>
  );
}