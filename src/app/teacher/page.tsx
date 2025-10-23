// src/app/teacher/page.tsx
'use client';

import { useAuth } from '@/components/auth/AuthProvider';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { MessageCircle, Users, LogOut } from 'lucide-react';
import { auth } from '@/lib/firebase';

export default function TeacherDashboard() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return <p className="text-center mt-20 text-gray-500">Loading...</p>;
  }

  return (
    <div
      className="
        min-h-screen w-full text-gray-800 
        bg-gradient-to-br from-[#ffe0e9] via-[#f4f7ff] to-[#d4f9e7]
        flex flex-col items-center justify-center
      "
    >
      {/* Logout Button - fixed top right */}
      <div className="absolute top-4 right-4 z-20">
        <Button
          onClick={async () => {
            try {
              await auth.signOut();
            } finally {
              router.push('/login');
            }
          }}
          className="bg-rose-500 hover:bg-rose-600 text-white shadow-md"
        >
          <LogOut className="mr-2 h-4 w-4" />
          Log out
        </Button>
      </div>

      {/* Centered Welcome Section */}
      <div className="text-center mb-10 px-4">
        <h1 className="text-4xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-700 via-pink-500 to-indigo-500 drop-shadow-md leading-tight">
          Welcome, {user.name || user.displayName || 'Teacher'} 👋
        </h1>
        <p className="mt-4 text-lg sm:text-xl text-gray-700 max-w-2xl mx-auto leading-relaxed">
          Empower your students, solve their doubts, and collaborate with fellow educators in a
          serene and pastel-perfect workspace.
        </p>
      </div>

      {/* Feature Cards */}
      <div className="max-w-5xl w-full grid grid-cols-1 md:grid-cols-2 gap-8 px-6 pb-16">
        {/* Doubt Solver Card */}
        <Link href="/teacher/doubt_solver" className="group">
          <div
            className="
              relative p-8 rounded-3xl bg-gradient-to-br from-sky-100 via-blue-50 to-indigo-100 
              border border-blue-200/60 shadow-md hover:shadow-xl 
              hover:-translate-y-1 transition-all duration-300 backdrop-blur-sm
            "
          >
            <MessageCircle className="h-14 w-14 text-blue-700 mb-4" />
            <h2 className="text-2xl font-semibold mb-2 text-blue-800 leading-snug">
              Doubt Solver
            </h2>
            <p className="text-blue-900/80 mb-6 text-sm sm:text-base">
              Quickly answer and manage student queries with ease.
            </p>
            <Button className="bg-gradient-to-r from-sky-300 to-blue-300 text-blue-900 hover:from-sky-400 hover:to-blue-400 shadow">
              Open Doubt Solver
            </Button>

            {/* soft corner icon */}
            <MessageCircle
              aria-hidden
              className="hidden sm:block absolute -top-8 -right-8 h-32 w-32 text-sky-300/30 rotate-12"
            />
          </div>
        </Link>

        {/* Community Card */}
        <Link href="/teacher/community" className="group">
          <div
            className="
              relative p-8 rounded-3xl bg-gradient-to-br from-pink-100 via-rose-50 to-purple-100
              border border-pink-200/60 shadow-md hover:shadow-xl 
              hover:-translate-y-1 transition-all duration-300 backdrop-blur-sm
            "
          >
            <Users className="h-14 w-14 text-pink-700 mb-4" />
            <h2 className="text-2xl font-semibold mb-2 text-pink-800 leading-snug">
              Teacher Community
            </h2>
            <p className="text-pink-900/80 mb-6 text-sm sm:text-base">
              Share ideas, collaborate with educators, and grow together.
            </p>
            <Button className="bg-gradient-to-r from-pink-300 to-fuchsia-300 text-pink-900 hover:from-pink-400 hover:to-fuchsia-400 shadow">
              Join Community
            </Button>

            {/* soft corner icon */}
            <Users
              aria-hidden
              className="hidden sm:block absolute -bottom-8 -right-8 h-32 w-32 text-rose-300/30 -rotate-12"
            />
          </div>
        </Link>
      </div>
    </div>
  );
}
