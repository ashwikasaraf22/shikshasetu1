// src/app/admin/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
// removed Input, Label
// removed Table components
import {
  Users,
  GraduationCap,
  BookMarked,
  ArrowRight,
} from 'lucide-react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import type { UserProfile } from '@/lib/types';
import withAuth from '@/components/auth/withAuth';
import AppHeader from '@/components/AppHeader';
import Link from 'next/link';

function AdminDashboard() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const { toast } = useToast();

  useEffect(() => {
    setIsLoading(true);

    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const usersData = snapshot.docs.map(
        (doc) => ({ ...doc.data(), uid: doc.id } as UserProfile)
      );
      setUsers(usersData);
      setIsLoading(false);
    });

    return () => {
      unsubUsers();
    };
  }, []);

  const teacherCount = users.filter((u) => u.role === 'teacher').length;
  const studentCount = users.filter((u) => u.role === 'student').length;
  const parentCount = users.filter((u) => u.role === 'parent').length;

  if (isLoading) {
    return (
      <div className="relative flex h-screen items-center justify-center overflow-hidden">
        {/* animated gradient bg */}
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(1200px_800px_at_10%_-20%,#f0abfc_0%,transparent_50%),radial-gradient(1000px_700px_at_90%_0%,#93c5fd_0%,transparent_50%),conic-gradient(from_180deg_at_50%_50%,#e9d5ff, #dbeafe, #fee2e2, #ede9fe, #e0f2fe, #ffe4e6, #e9d5ff)] opacity-60" />
        <div className="animate-pulse rounded-2xl bg-white/70 px-6 py-4 text-sm shadow-lg ring-1 ring-indigo-100 backdrop-blur">
          Loading your vibrant dashboard…
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="relative flex min-h-screen flex-col overflow-hidden">
        {/* Deep, lively gradient background with soft animated blobs */}
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(1200px_800px_at_0%_0%,#f0abfc_20%,transparent_60%),radial-gradient(1200px_800px_at_100%_0%,#93c5fd_20%,transparent_60%),radial-gradient(900px_700px_at_50%_100%,#fecaca_10%,transparent_60%)]" />
        <div className="pointer-events-none absolute -top-24 -left-24 -z-10 h-[28rem] w-[28rem] animate-[float_12s_ease-in-out_infinite] rounded-full bg-fuchsia-300/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 -right-24 -z-10 h-[30rem] w-[30rem] animate-[float_14s_ease-in-out_infinite_reverse] rounded-full bg-sky-300/30 blur-3xl" />
        <style jsx global>{`
          @keyframes float {
            0% { transform: translateY(0px) translateX(0px); }
            50% { transform: translateY(-18px) translateX(12px); }
            100% { transform: translateY(0px) translateX(0px); }
          }
        `}</style>

        <AppHeader title="Admin Dashboard" />

        <main className="container mx-auto flex-grow p-4 sm:p-6 lg:p-8">
          {/* Hero / banner */}
          <div className="mb-8 overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-600 via-fuchsia-600 to-rose-600 p-[1px] shadow-2xl">
            <div className="relative rounded-3xl bg-white/90 p-6 backdrop-blur">
              <div className="pointer-events-none absolute right-0 top-0 h-24 w-24 -translate-y-1/2 translate-x-1/3 rounded-full bg-fuchsia-300/40 blur-2xl" />
              <h2 className="text-2xl font-semibold tracking-tight text-gray-900">
                Welcome, Admin!
              </h2>
              <p className="mt-1 text-sm text-gray-600">
                Manage lessons in a bright, friendly space ✨
              </p>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="mb-8 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <Card className="group relative overflow-hidden rounded-3xl border-0 bg-white/90 shadow-xl ring-1 ring-indigo-100 transition hover:-translate-y-0.5 hover:shadow-2xl">
              <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-indigo-200/70 opacity-60 blur-2xl" />
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-700">
                  Total Users
                </CardTitle>
                <Users className="h-4 w-4 text-indigo-600" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-extrabold text-gray-900">
                  {users.length}
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  All registered accounts
                </p>
              </CardContent>
            </Card>

            <Card className="relative overflow-hidden rounded-3xl border-0 bg-white/90 shadow-xl ring-1 ring-violet-100 transition hover:-translate-y-0.5 hover:shadow-2xl">
              <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-violet-200/70 opacity-60 blur-2xl" />
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-700">
                  Teachers
                </CardTitle>
                <GraduationCap className="h-4 w-4 text-violet-600" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-extrabold text-gray-900">
                  {teacherCount}
                </div>
                <p className="mt-1 text-xs text-gray-500">Guiding minds</p>
              </CardContent>
            </Card>

            <Card className="relative overflow-hidden rounded-3xl border-0 bg-white/90 shadow-xl ring-1 ring-emerald-100 transition hover:-translate-y-0.5 hover:shadow-2xl">
              <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-emerald-200/70 opacity-60 blur-2xl" />
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-700">
                  Students
                </CardTitle>
                <Users className="h-4 w-4 text-emerald-600" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-extrabold text-gray-900">
                  {studentCount}
                </div>
                <p className="mt-1 text-xs text-gray-500">Active learners</p>
              </CardContent>
            </Card>

            <Card className="relative overflow-hidden rounded-3xl border-0 bg-white/90 shadow-xl ring-1 ring-rose-100 transition hover:-translate-y-0.5 hover:shadow-2xl">
              <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-rose-200/70 opacity-60 blur-2xl" />
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-700">
                  Parents
                </CardTitle>
                <Users className="h-4 w-4 text-rose-600" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-extrabold text-gray-900">
                  {parentCount}
                </div>
                <p className="mt-1 text-xs text-gray-500">Engaged guardians</p>
              </CardContent>
            </Card>
          </div>

          {/* Management Sections (Manage Users removed) */}
          <div className="grid gap-8 lg:grid-cols-1">
            {/* Manage Lessons */}
            <Card className="relative flex flex-col items-center justify-center overflow-hidden rounded-3xl border-0 bg-white/90 p-8 text-center shadow-xl ring-1 ring-fuchsia-100 transition hover:shadow-2xl">
              <div className="pointer-events-none absolute -right-20 -top-16 h-64 w-64 rounded-full bg-fuchsia-200/70 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-20 -left-10 h-64 w-64 rounded-full bg-indigo-200/70 blur-3xl" />
              <CardHeader className="items-center">
                <CardTitle className="text-gray-900">Manage Lessons</CardTitle>
                <CardDescription className="text-gray-600">
                  Upload and organize chapter PDFs and related content.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center justify-center pt-2">
                <BookMarked className="mb-4 h-16 w-16 text-fuchsia-600" />
                <Link href="/admin/lessons" passHref>
                  <Button className="rounded-xl bg-gradient-to-r from-fuchsia-600 to-indigo-600 text-white shadow-lg transition hover:brightness-110">
                    Go to Manage Lessons
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </>
  );
}

export default withAuth(AdminDashboard, ['admin']);
