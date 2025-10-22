// src/app/student/community/watch_videos/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  query,
  where,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/components/auth/AuthProvider";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

const LANGS = [
  "Hindi",
  "Marathi",
  "Bengali",
  "Tamil",
  "English",
  "Punjabi",
  "Assamese",
] as const;
type LangLabel = (typeof LANGS)[number];

type VideoDoc = {
  id: string;
  title: string;
  description?: string;
  language: LangLabel | string;
  videoURL: string;
  createdAt?: any;
};

function getClassNumber(cn?: string | null) {
  if (!cn) return "9";
  const s = String(cn).trim().toLowerCase();
  const m = s.match(/(?:class|std|standard)?\s*(\d{1,2})/i);
  if (m) {
    const n = parseInt(m[1], 10);
    if ([7, 8, 9].includes(n)) return String(n);
  }
  if (/7th/.test(s) || /\bvii\b/.test(s) || /\bseven|saat\b/.test(s)) return "7";
  if (/8th/.test(s) || /\bviii\b/.test(s) || /\beight|aath\b/.test(s)) return "8";
  if (/9th/.test(s) || /\bix\b/.test(s) || /\bnine|nau\b/.test(s)) return "9";
  return "9";
}

export default function WatchVideosPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [language, setLanguage] = useState<LangLabel | "">("");
  const [videos, setVideos] = useState<VideoDoc[]>([]);
  const [loading, setLoading] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const studentClass =
    user?.role === "student" ? (user.className as string | undefined) : undefined;
  const classNormalized = getClassNumber(studentClass);

  const fetchVideos = async (lang: string) => {
    setLoading(true);
    setError(null);
    try {
      const q = query(collection(db, "videos"), where("language", "==", lang));
      const snap = await getDocs(q);
      const out: VideoDoc[] = [];
      snap.forEach((d) => {
        const data = d.data() as any;
        out.push({
          id: d.id,
          title: data.title || "Untitled",
          description: data.description || "",
          language: data.language || "",
          videoURL: data.videoURL || "",
          createdAt: data.createdAt || null,
        });
      });
      setVideos(out);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "Failed to fetch videos.");
      setVideos([]);
    } finally {
      setLoading(false);
    }
  };

  const onChangeLanguage = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const lang = e.target.value as LangLabel;
    setLanguage(lang);
    if (lang) {
      await fetchVideos(lang);
    } else {
      setVideos([]);
    }
  };

  const logView = async (video: VideoDoc) => {
    if (!user?.uid) return;
    try {
      // Global collection
      await addDoc(collection(db, "videoViews"), {
        videoId: video.id,
        studentID: user.uid,
        class: classNormalized,
        language: video.language || language || "",
        title: video.title,
        timestamp: serverTimestamp(),
      });

      // Per-video subcollection
      await addDoc(collection(db, "videos", video.id, "views"), {
        studentID: user.uid,
        timestamp: serverTimestamp(),
      });
    } catch (e) {
      console.error("Failed to log view", e);
    }
  };

  const handlePlay = async (v: VideoDoc) => {
    setPlayingId(v.id);
    await logView(v);
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-[#E7F2FF] via-[#FFF8F8] to-[#E9F7FF] text-gray-800">
      {/* background pastel blobs */}
      <div className="pointer-events-none absolute -top-20 -left-20 h-72 w-72 rounded-full bg-[#DFF2FF] blur-3xl opacity-60" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-[28rem] w-[28rem] rounded-full bg-[#FDE7FF] blur-3xl opacity-60" />
      <div className="pointer-events-none absolute top-1/3 left-10 h-40 w-40 rounded-full bg-[#D9FFF4] blur-3xl opacity-50" />

      {/* header with back button */}
      <header className="sticky top-0 z-20 backdrop-blur-xl bg-gradient-to-r from-white/70 via-white/50 to-white/70 border-b border-white/60 shadow-md">
        <div className="relative max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
          <Button
            onClick={() => router.push("/student/community")}
            className="bg-gradient-to-r from-[#9B87F5] to-[#7C6BF2] text-white rounded-xl hover:brightness-110"
          >
            ← Back
          </Button>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-[#6B5BBE] via-[#7C6BF2] to-[#A1B5FF]">
            Watch a Video
          </h1>
          <div className="w-[92px]" />
        </div>
      </header>

      {/* main content */}
      <main className="relative z-10 max-w-5xl mx-auto px-6 py-10">
        <p className="text-sky-900/80 text-center mb-6">
          Choose your preferred language to view videos.
        </p>

        <div className="rounded-3xl border border-sky-100 bg-white/80 shadow-2xl backdrop-blur p-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-1">
              <label className="block text-sm font-medium text-sky-900/80 mb-1">
                Language
              </label>
              <select
                className="w-full p-3 border border-sky-200 rounded-xl bg-white focus:ring-2 focus:ring-sky-300"
                value={language}
                onChange={onChangeLanguage}
              >
                <option value="">Select Language</option>
                {LANGS.map((lang) => (
                  <option key={lang} value={lang}>
                    {lang}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {loading && <p className="mt-6 text-sky-800">Loading videos…</p>}

          {error && (
            <p className="mt-4 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-4 py-2 inline-block">
              {error}
            </p>
          )}

          {!loading && !error && language && (
            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
              {videos.length === 0 && (
                <p className="text-sky-800 text-center col-span-full">
                  No videos found for <b>{language}</b> yet.
                </p>
              )}

              {videos.map((v) => (
                <div
                  key={v.id}
                  className="rounded-2xl border border-sky-100 bg-gradient-to-br from-[#F8FBFF] to-[#EAF6FF] shadow-lg overflow-hidden transition-transform hover:-translate-y-1 hover:shadow-2xl"
                >
                  <div className="p-4">
                    <h3 className="text-lg font-semibold text-sky-800">
                      {v.title}
                    </h3>
                    {v.description && (
                      <p className="text-sm text-sky-900/70 mt-1">
                        {v.description}
                      </p>
                    )}
                    <p className="text-xs text-sky-900/60 mt-2">
                      Language: <b>{String(v.language)}</b>
                    </p>
                  </div>

                  <div className="p-4 pt-0">
                    {playingId === v.id ? (
                      <video
                        controls
                        className="w-full rounded-xl border border-sky-100"
                        src={v.videoURL}
                        onPlay={() => logView(v)}
                      />
                    ) : (
                      <button
                        onClick={() => handlePlay(v)}
                        className="w-full px-5 py-3 rounded-xl text-white font-medium bg-gradient-to-r from-sky-500 to-sky-600 hover:brightness-110 shadow"
                      >
                        ▶️ Play Video
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {!language && (
            <p className="mt-6 text-center text-sky-800">
              Please select a language to view available videos.
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
