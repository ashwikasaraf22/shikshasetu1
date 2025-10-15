'use client';

import { useAuth } from '@/components/auth/AuthProvider';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { BookText, MessageCircle, Eye } from 'lucide-react';

type Activity = {
  type: 'quiz' | 'question';
  title: string;
  score?: number;
  status?: string;
  time: string;
};

export default function StudentDashboard() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [recentActivity, setRecentActivity] = useState<Activity[] | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
      return;
    }

    const t = setTimeout(() => {
      setRecentActivity([
        { type: 'quiz', title: 'Science: Chapter 1', score: 85, time: '1 day ago' },
        { type: 'question', title: 'History: Chapter 1', status: 'Teacher replied', time: '3 days ago' },
      ]);
    }, 500);

    return () => clearTimeout(t);
  }, [user, loading, router]);

  if (loading || !user) {
    return <p className="text-center mt-20">Loading...</p>;
  }

  return (
    <div className="relative min-h-screen w-full flex flex-col bg-gradient-to-br from-[#FFF8F0] via-[#FFF1E6] to-[#FFECEC] text-[#3C2A1E] overflow-hidden">
      {/* Warm soft background blobs */}
      <div className="pointer-events-none absolute -top-24 -left-24 w-[28rem] h-[28rem] bg-[#FFE3CC] rounded-full blur-3xl opacity-50" />
      <div className="pointer-events-none absolute top-1/3 -right-20 w-[26rem] h-[26rem] bg-[#FFD5B8] rounded-full blur-3xl opacity-45" />
      <div className="pointer-events-none absolute bottom-[-6rem] left-1/4 w-[22rem] h-[22rem] bg-[#FFCBCB] rounded-full blur-3xl opacity-40" />

      <div className="relative z-10 p-6 max-w-6xl mx-auto w-full">
        <h1 className="text-4xl font-bold mb-10 text-center text-[#8B2C00] drop-shadow-sm">
          Welcome, {user.name || user.displayName || 'Student'}!
        </h1>

        {/* Main Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          {/* Start Lesson (gold-peach) */}
          <div
            className="relative bg-gradient-to-br from-[#FFF6E0] via-[#FFEAC0] to-[#FFDFA0] p-8 rounded-3xl shadow-lg hover:shadow-2xl transition-transform hover:-translate-y-1 overflow-hidden cursor-pointer ring-1 ring-[#FFE0A5]"
            onClick={() => router.push('/student/lesson')}
          >
            <BookText className="absolute -top-12 -left-12 h-44 w-44 text-[#FFD678]/40 rotate-12" />
            <BookText className="h-12 w-12 text-[#A36200] mb-4" />
            <h2 className="text-2xl font-semibold mb-2 text-[#7E4700]">Start a New Lesson</h2>
            <p className="text-[#7E4700]/80">Jump into your next chapter with our AI Tutor.</p>
            <Button className="mt-4 bg-[#E8A400] hover:bg-[#D59200] text-white transition-transform hover:scale-[1.03]">
              Go to section
            </Button>
          </div>

          {/* Ask a Question (sunset coral) */}
          <Link href="/student/ask_question">
            <div className="relative bg-gradient-to-br from-[#FFE7E0] via-[#FFDAD0] to-[#FFC8BA] p-8 rounded-3xl shadow-lg hover:shadow-2xl transition-transform hover:-translate-y-1 overflow-hidden cursor-pointer ring-1 ring-[#FFD3C2]">
              <MessageCircle className="absolute -top-12 -right-12 h-44 w-44 text-[#FFB199]/60 rotate-12" />
              <MessageCircle className="h-12 w-12 text-[#C5451D] mb-4" />
              <h2 className="text-2xl font-semibold mb-2 text-[#A33415]">Ask a Question</h2>
              <p className="text-[#7E270F]/80">Stuck on a concept? Get instant help.</p>
              <Button className="mt-4 bg-[#F86B36] hover:bg-[#E45623] text-white transition-transform hover:scale-[1.03]">
                Go to section
              </Button>
            </div>
          </Link>

          {/* Join Community (rosy blush) */}
          <Link href="/student/community">
            <div className="relative bg-gradient-to-br from-[#FFF0F4] via-[#FFE3EB] to-[#FFD5DE] p-8 rounded-3xl shadow-lg hover:shadow-2xl transition-transform hover:-translate-y-1 overflow-hidden cursor-pointer ring-1 ring-[#FFD0DB]">
              <Eye className="absolute -bottom-12 -right-12 h-44 w-44 text-[#FFBFD0]/60 -rotate-6" />
              <Eye className="h-12 w-12 text-[#B73C68] mb-4" />
              <h2 className="text-2xl font-semibold mb-2 text-[#982C55]">Join the Community</h2>
              <p className="text-[#752041]/80">Collaborate and learn with your peers.</p>
              <Button className="mt-4 bg-[#E85C88] hover:bg-[#D14978] text-white transition-transform hover:scale-[1.03]">
                Go to section
              </Button>
            </div>
          </Link>
        </div>

        {/* Recent Activity Section */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold mb-6 text-center text-[#8B2C00] drop-shadow-sm">
            Recent Activity
          </h2>
          {recentActivity === null ? (
            <p className="text-center text-[#7A4E33]">Loading activities...</p>
          ) : recentActivity.length === 0 ? (
            <p className="text-center text-[#7A4E33]">No recent activities</p>
          ) : (
            <ul className="space-y-4">
              {recentActivity.map((activity, index) => (
                <li
                  key={index}
                  className={`relative p-4 rounded-2xl shadow hover:shadow-lg transition overflow-hidden ring-1 ${
                    activity.type === 'quiz'
                      ? 'bg-gradient-to-br from-[#FFF8E8] via-[#FFF0D0] to-[#FFE7B8] ring-[#FFE5A0]'
                      : 'bg-gradient-to-br from-[#FFF1EE] via-[#FFE8E4] to-[#FFDCD6] ring-[#FFD3C9]'
                  }`}
                >
                  <BookText className="absolute -top-6 -right-6 h-24 w-24 text-[#FFD4A5]/40 rotate-12" />
                  {activity.type === 'quiz' ? (
                    <>
                      <p className="font-semibold text-[#8B2C00]">
                        Completed quiz for '{activity.title}'
                      </p>
                      <p className="text-[#A34200]">Score: {activity.score}%</p>
                      <p className="text-sm text-[#B34E00]">{activity.time}</p>
                    </>
                  ) : (
                    <>
                      <p className="font-semibold text-[#A33415]">
                        Asked a question in '{activity.title}'
                      </p>
                      <p className="text-[#C5451D]">Status: {activity.status}</p>
                      <p className="text-sm text-[#D1572C]">{activity.time}</p>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
