'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';

const COLLECTION_NAME = 'community_share'; // <-- writes here

// helper to remove undefined recursively
function clean<T extends Record<string, any>>(obj: T): T {
  const out: Record<string, any> = {};
  Object.entries(obj).forEach(([k, v]) => {
    if (v === undefined) return;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const nested = clean(v as any);
      out[k] = nested;
    } else if (Array.isArray(v)) {
      out[k] = v
        .map((x) => (x && typeof x === 'object' ? clean(x) : x))
        .filter((x) => x !== undefined);
    } else {
      out[k] = v;
    }
  });
  return out as T;
}

export default function ShareSomething() {
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [posted, setPosted] = useState(false);

  // media upload state
  const [files, setFiles] = useState<FileList | null>(null);
  const [uploading, setUploading] = useState(false);
  const [assets, setAssets] = useState<any[]>([]); // stores Cloudinary responses

  // upload handler to Cloudinary via your signing route
  const onUpload = async () => {
    setError(null);
    if (!files || files.length === 0) {
      setError('Please choose one or more files before uploading.');
      return;
    }

    setUploading(true);
    try {
      // Ask server for signature
      const sign = await fetch('/api/cloudinary/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Use a dedicated folder for these shares
        body: JSON.stringify({ folder: 'community/share' }),
      }).then((r) => r.json());

      if (sign?.error) {
        throw new Error(sign.error || 'Failed to get Cloudinary signature.');
      }

      const { cloudName, apiKey, signature, timestamp, folder } = sign;
      const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`;

      const results: any[] = [];
      for (const file of Array.from(files)) {
        const form = new FormData();
        form.append('file', file);
        form.append('api_key', apiKey);
        form.append('timestamp', String(timestamp));
        form.append('signature', signature);
        form.append('folder', folder);

        // Upload each file
        const res = await fetch(uploadUrl, { method: 'POST', body: form });
        if (!res.ok) {
          const txt = await res.text().catch(() => '');
          throw new Error(`Upload failed (${res.status}): ${txt}`);
        }
        const json = await res.json();
        results.push(json);
      }

      // Merge with any previously uploaded assets (allow multiple uploads)
      setAssets((prev) => [...prev, ...results]);

      // Clear file input selection (optional)
      setFiles(null);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const onPost = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setPosted(false);

    const t = title.trim();
    const d = description.trim();

    if (!t || !d) {
      setError('Please add a title and description before posting.');
      return;
    }

    // Ensure user is logged in
    const user = auth.currentUser;
    if (!user) {
      setError('You need to be signed in to post. Please log in and try again.');
      return;
    }

    // Build the Firestore payload exactly as requested
    // (We store per-asset entries, and also top-level metadata)
    const role = 'student'; // set role here
    const language = 'English'; // set a default; change if you later add a selector

    // per-asset records with only the allowed fields
    const media = (assets || []).map((a) =>
      clean({
        url: a.secure_url,
        cloudinaryVersion: a.version,
        storagePath: a.public_id,
        // Keeping resource_type/format out since you didn’t request them,
        // but you can add them if needed:
        // resource_type: a.resource_type,
        // format: a.format,
      })
    );

    const docPayload = clean({
      title: t,
      description: d,
      language,
      role,
      uploadedBy: user.uid,
      uploaderName: user.displayName || user.email || 'Student',
      // store one "url" at top-level if you want the first photo handy:
      url: media[0]?.url || null,
      // store all assets too:
      media, // [{ url, cloudinaryVersion, storagePath }, ...]
      // explicit timestamp field as requested:
      timestamp: serverTimestamp(),
      // also keep your usual createdAt if you want:
      createdAt: serverTimestamp(),
    });

    setPosting(true);
    try {
      await addDoc(collection(db, COLLECTION_NAME), docPayload);

      setTitle('');
      setDescription('');
      setAssets([]);
      setPosted(true);
    } catch (err: unknown) {
      console.error(err);
      const message =
        (err as any)?.code
          ? `(${(err as any).code}) ${(err as any).message}`
          : err instanceof Error
            ? err.message
            : 'Something went wrong while saving your post.';
      setError(message);
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden text-gray-800">
      {/* Layered pastel background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#F4F1FF] via-[#FFF6F9] to-[#F0FAF8]" />
      <div className="pointer-events-none absolute -top-24 -left-24 h-80 w-80 rounded-full bg-[#EDE9FE] blur-3xl opacity-55 animate-pulse" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 h-[28rem] w-[28rem] rounded-full bg-[#FFE7D1] blur-3xl opacity-60 animate-pulse delay-700" />
      <div className="pointer-events-none absolute top-1/3 right-10 h-40 w-40 rounded-full bg-[#DFF5F0] blur-3xl opacity-50" />
      <div className="pointer-events-none absolute bottom-20 left-1/4 h-32 w-32 rounded-full bg-[#E7F0FF] blur-3xl opacity-50" />

      {/* Header with Back button */}
      <header className="relative z-10">
        <div className="mx-auto max-w-6xl px-6 pt-12 pb-4">
          <div className="mb-4 flex items-center justify-between">
            <button
              onClick={() => router.push('/student/community')}
              className="inline-flex items-center gap-2 rounded-xl border border-[#D5CEFF] bg-white/80 px-4 py-2 text-sm font-semibold text-[#4C409F] shadow hover:shadow-md backdrop-blur hover:bg-white"
              aria-label="Back to Community"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" className="-ml-0.5">
                <path
                  d="M15 18l-6-6 6-6"
                  fill="none"
                  stroke="#6F5AE8"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Back
            </button>
            <div className="w-[84px]" />
          </div>

          <h1 className="text-center text-4xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-[#7C6BF2] via-[#9B87F5] to-[#7EC8E3] drop-shadow-sm">
            Share Something
          </h1>
          <p className="mt-2 text-center text-[#5F55B0]">
            Post your ideas, projects, or thoughts for everyone to see.
          </p>
        </div>
      </header>

      {/* Main */}
      <main className="relative z-10 mx-auto max-w-4xl px-6 pb-20">
        {/* Info strip */}
        <div className="mx-auto mb-6 flex w-full items-center justify-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#EDE9FE] via-[#FFF0F5] to-[#DFF5F0] px-4 py-2 text-xs font-medium text-[#4E3FA3] shadow-sm">
            <span className="h-2 w-2 rounded-full bg-[#9B87F5]" />
            Inspire others with your voice
          </div>
        </div>

        <form
          onSubmit={onPost}
          className="relative rounded-3xl border border-white/70 bg-white/80 p-8 shadow-2xl backdrop-blur"
        >
          {/* Title */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-[#4E3FA3] mb-2">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Give your post a short, catchy title…"
              className="w-full rounded-xl border border-[#E7E3FF] bg-white/95 px-4 py-3 outline-none focus:ring-2 focus:ring-[#C7B7FF]"
              maxLength={120}
              required
            />
            <div className="mt-2 text-xs text-[#5A4DA8]/70">Max 120 characters</div>
          </div>

          {/* Description */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-[#4E3FA3] mb-2">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Write your thoughts here. You can share ideas, questions, project updates, or reflections…"
              className="min-h-[160px] w-full rounded-xl border border-[#E7E3FF] bg-white/95 px-4 py-3 text-[15px] leading-relaxed outline-none focus:ring-2 focus:ring-[#C7B7FF]"
              required
            />
          </div>

          {/* Media upload section */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-[#4E3FA3] mb-2">Attach Media (PNG/JPG/PDF)</label>
            <input
              type="file"
              multiple
              accept="image/png,image/jpeg,application/pdf"
              onChange={(e) => setFiles(e.target.files)}
              className="w-full rounded-xl border border-[#E7E3FF] bg-white/95 px-4 py-2 outline-none"
            />
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onUpload}
                disabled={uploading || !files || files.length === 0}
                className={`rounded-xl px-4 py-2 text-sm font-semibold shadow transition ${
                  uploading
                    ? 'bg-[#EEE9FF] text-[#8A82B8] cursor-not-allowed'
                    : 'bg-gradient-to-r from-[#7EC8E3] via-[#9B87F5] to-[#F9B8C6] text-white hover:brightness-110'
                }`}
              >
                {uploading ? 'Uploading…' : 'Upload Media'}
              </button>

              {/* 👇 removed the visible list of uploaded items on purpose */}
              {/* We still keep assets in state so we can save them, but we don't display them */}
            </div>
          </div>

          {/* Messages */}
          {error && (
            <div className="mb-4 rounded-xl bg-[#FFF1F0] px-4 py-3 text-sm text-[#8A3B3B] border border-[#FFD6D3]">
              {error}
            </div>
          )}
          {posted && (
            <div className="mb-4 rounded-xl bg-[#E7FFF7] px-4 py-3 text-sm text-[#2A7B6F] border border-[#C6F2E7]">
              Posted! Your post will appear in <b>“See What Others Have Shared”</b>.
            </div>
          )}

          {/* Footer actions */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#EDE9FE] via-[#FFF0F5] to-[#E7F0FF] px-3 py-1.5 text-xs font-medium text-[#4E3FA3]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#7EC8E3]" />
              Be kind & respectful
              <span className="h-1.5 w-1.5 rounded-full bg-[#F9B8C6]" />
            </div>

            <button
              type="submit"
              disabled={posting}
              className={`rounded-xl px-5 py-2.5 text-sm font-semibold shadow transition ${
                posting
                  ? 'bg-[#EEE9FF] text-[#8A82B8] cursor-not-allowed'
                  : 'bg-gradient-to-r from-[#9B87F5] via-[#7EC8E3] to-[#F9B8C6] text-white hover:brightness-110'
              }`}
            >
              {posting ? 'Posting…' : 'Post'}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
