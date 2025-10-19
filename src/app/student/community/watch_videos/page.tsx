'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { collection, addDoc, serverTimestamp, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';

const LANGS = ['Hindi','Marathi','Bengali','Tamil','English','Punjabi','Assamese'] as const;
type Lang = typeof LANGS[number];

type VideoDoc = {
  id: string;
  title: string;
  description: string;
  language: Lang;
  videoURL: string;
  uploadedBy: string;
  timestamp?: any;
};

export default function WatchVideosPage() {
  const { user } = useAuth();
  const [language, setLanguage] = useState<Lang>('Hindi');
  const [videos, setVideos] = useState<VideoDoc[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);

    const q = query(
      collection(db, 'videos'),
      where('language', '==', language),
      orderBy('timestamp', 'desc')
    );

    const unsub = onSnapshot(q, (snap) => {
      const rows: VideoDoc[] = [];
      snap.forEach((d) => {
        const data = d.data() as Omit<VideoDoc, 'id'>;
        rows.push({ id: d.id, ...data });
      });
      setVideos(rows);
      setLoading(false);
    }, () => setLoading(false));

    return () => unsub();
  }, [language]);

  const onViewed = async (video: VideoDoc) => {
    if (!user?.uid) return;
    try {
      await addDoc(collection(db, 'videoViews'), {
        videoId: video.id,
        studentID: user.uid,
        language: video.language,
        timestamp: serverTimestamp(),
      });
    } catch (e) {
      // soft-fail on logging
      console.error('Failed to log view', e);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#ECE7FF] via-[#F6F3FF] to-[#E3F1FF] text-gray-800 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="bg-white/80 backdrop-blur-md border border-white/70 rounded-2xl p-6 shadow-xl mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="text-3xl font-extrabold text-[#6B5BBE]">Watch Videos</h1>
              <p className="text-sm text-[#5A4DA8]/90 mt-1">Choose a language to filter videos.</p>
            </div>

            <div className="flex gap-2 items-center">
              <span className="text-sm">Language</span>
              <select
                className="p-2 border rounded-lg bg-white"
                value={language}
                onChange={(e) => setLanguage(e.target.value as Lang)}
              >
                {LANGS.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="bg-white/80 rounded-2xl p-6">Loading…</div>
        ) : videos.length === 0 ? (
          <div className="bg-white/80 rounded-2xl p-6">No videos found for <b>{language}</b>.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {videos.map((v) => (
              <div key={v.id} className="bg-white/85 backdrop-blur-xl border border-white/60 rounded-2xl p-4 shadow-lg">
                <h3 className="text-lg font-semibold text-[#4E3FA3]">{v.title}</h3>
                <p className="text-sm text-gray-600 mb-3">{v.description}</p>

                <div className="rounded-xl overflow-hidden bg-black">
                  <video
                    src={v.videoURL}
                    controls
                    preload="metadata"
                    className="w-full h-56 object-contain bg-black"
                    onPlay={() => onViewed(v)}
                  />
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs text-gray-500">Language: {v.language}</span>
                  <Button
                    className="bg-gradient-to-r from-[#9B87F5] to-[#7C6BF2] text-white rounded-xl"
                    onClick={() => {
                      // Ensures a “view” is logged even if autoplay is blocked
                      onViewed(v);
                      // Optionally force full-screen open in a new tab:
                      window.open(v.videoURL, '_blank', 'noopener,noreferrer');
                    }}
                  >
                    Open in new tab
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
