"use client";

import React, { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { BookOpen, FileText, Headphones, Pencil, Laptop2, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";

/** Firestore collection to store lessons */
const COLLECTION_NAME = "lessons";

/** Deep-clean helper (mirrors /community/share approach) */
function clean<T extends Record<string, any>>(obj: T): T {
  const out: Record<string, any> = {};
  Object.entries(obj).forEach(([k, v]) => {
    if (v === undefined) return;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      const nested = clean(v as any);
      out[k] = nested;
    } else if (Array.isArray(v)) {
      out[k] = v
        .map((x) => (x && typeof x === "object" ? clean(x) : x))
        .filter((x) => x !== undefined);
    } else {
      out[k] = v;
    }
  });
  return out as T;
}

/** Minimal Cloudinary response fields we keep */
type UploadedAsset = {
  url: string;
  cloudinaryVersion: string | number;
  storagePath: string;
};

export default function ManageLessonsPage() {
  const router = useRouter();

  // Form state
  const [grade, setGrade] = useState<string>("");
  const [subject, setSubject] = useState<string>("");
  const [chapter, setChapter] = useState<string>("");

  // Upload states for the three buckets
  const [ebook, setEbook] = useState<UploadedAsset | null>(null);
  const [audiobook, setAudiobook] = useState<UploadedAsset | null>(null);
  const [explanation, setExplanation] = useState<UploadedAsset | null>(null);

  // UI states
  const [saving, setSaving] = useState<boolean>(false);
  const [status, setStatus] = useState<{ type: "error" | "success" | "info"; message: string } | null>(null);

  // hidden file inputs (one per upload type)
  const ebookInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const explInputRef = useRef<HTMLInputElement>(null);

  /** Shared file upload handler to Cloudinary (single PDF) */
  const uploadSinglePdf = async (file: File) => {
    // Get signature from your server
    const sign = await fetch("/api/cloudinary/sign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // keep lessons separate from community/share
      body: JSON.stringify({ folder: "lessons" }),
    }).then((r) => r.json());

    if (sign?.error) throw new Error(sign.error || "Failed to get Cloudinary signature.");

    const { cloudName, apiKey, signature, timestamp, folder } = sign;
    const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`;

    const form = new FormData();
    form.append("file", file);
    form.append("api_key", apiKey);
    form.append("timestamp", String(timestamp));
    form.append("signature", signature);
    form.append("folder", folder);

    const res = await fetch(uploadUrl, { method: "POST", body: form });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`Upload failed (${res.status}): ${txt}`);
    }
    const json = await res.json();

    const asset: UploadedAsset = clean({
      url: json.secure_url,
      cloudinaryVersion: json.version,
      storagePath: json.public_id,
    });

    return asset;
  };

  /** Click handlers for the three upload buttons -> triggers hidden input */
  const onPickEbook = () => ebookInputRef.current?.click();
  const onPickAudio = () => audioInputRef.current?.click();
  const onPickExpl = () => explInputRef.current?.click();

  /** onChange for each hidden file input */
  const handleEbookChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    try {
      setStatus({ type: "info", message: "Uploading e-book PDF…" });
      const asset = await uploadSinglePdf(file);
      setEbook(asset);
      setStatus({ type: "success", message: "E-book uploaded successfully." });
    } catch (err: any) {
      console.error(err);
      setStatus({ type: "error", message: err?.message || "Failed to upload e-book." });
    } finally {
      e.target.value = ""; // reset input
    }
  };

  const handleAudioChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    try {
      setStatus({ type: "info", message: "Uploading audio book PDF…" });
      const asset = await uploadSinglePdf(file);
      setAudiobook(asset);
      setStatus({ type: "success", message: "Audio book uploaded successfully." });
    } catch (err: any) {
      console.error(err);
      setStatus({ type: "error", message: err?.message || "Failed to upload audio book." });
    } finally {
      e.target.value = "";
    }
  };

  const handleExplChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    try {
      setStatus({ type: "info", message: "Uploading explanation PDF…" });
      const asset = await uploadSinglePdf(file);
      setExplanation(asset);
      setStatus({ type: "success", message: "Explanation uploaded successfully." });
    } catch (err: any) {
      console.error(err);
      setStatus({ type: "error", message: err?.message || "Failed to upload explanation." });
    } finally {
      e.target.value = "";
    }
  };

  /** Save to Firestore */
  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);

    // Basic validation
    if (!grade || !subject || !chapter.trim()) {
      setStatus({ type: "error", message: "Please select class, subject, and enter a chapter name." });
      return;
    }
    if (!ebook && !audiobook && !explanation) {
      setStatus({ type: "error", message: "Please upload at least one PDF (e-book, audio book, or explanation)." });
      return;
    }

    // Ensure auth
    const user = auth.currentUser;
    if (!user) {
      setStatus({ type: "error", message: "You must be logged in to save lessons." });
      return;
    }

    const payload = clean({
      classGrade: grade,                 // '7' | '8' | '9'
      subject,                           // 'Science' | 'SSC' | 'Maths'
      chapterTitle: chapter.trim(),
      // store each asset with the same fields you used in /community/share
      ebook: ebook || null,
      audiobook: audiobook || null,
      explanation: explanation || null,
      uploadedBy: user.uid,
      uploaderName: user.displayName || user.email || "Admin",
      timestamp: serverTimestamp(),
      createdAt: serverTimestamp(),
    });

    setSaving(true);
    try {
      await addDoc(collection(db, COLLECTION_NAME), payload);
      setStatus({ type: "success", message: "Lesson saved successfully." });
      // optional: reset form
      setGrade("");
      setSubject("");
      setChapter("");
      setEbook(null);
      setAudiobook(null);
      setExplanation(null);
    } catch (err: any) {
      console.error(err);
      const msg =
        err?.code ? `(${err.code}) ${err.message}` : err?.message || "Failed to save lesson.";
      setStatus({ type: "error", message: msg });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden text-gray-800">
      {/* Pastel layered background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#F4F1FF] via-[#FFF6F9] to-[#F0FAF8]" />
      <div className="pointer-events-none absolute -top-24 -left-24 h-80 w-80 rounded-full bg-[#EDE9FE] blur-3xl opacity-55 animate-pulse" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 h-[28rem] w-[28rem] rounded-full bg-[#FFE7D1] blur-3xl opacity-60 animate-pulse delay-700" />
      <div className="pointer-events-none absolute top-1/3 right-10 h-40 w-40 rounded-full bg-[#DFF5F0] blur-3xl opacity-50" />
      <div className="pointer-events-none absolute bottom-20 left-1/4 h-32 w-32 rounded-full bg-[#E7F0FF] blur-3xl opacity-50" />

      {/* Doodles */}
      <div className="pointer-events-none absolute left-8 top-10 animate-[drift_22s_linear_infinite]">
        <Pencil className="h-10 w-10 text-amber-400 opacity-80 drop-shadow" />
      </div>
      <div className="pointer-events-none absolute right-8 bottom-10 animate-[drift2_26s_linear_infinite]">
        <Laptop2 className="h-12 w-12 text-sky-400 opacity-80 drop-shadow" />
      </div>

      {/* Header */}
      <header className="relative z-10">
        <div className="mx-auto max-w-6xl px-6 pt-10 pb-6 flex items-center justify-between">
          <button
            onClick={() => router.push("/admin")}
            className="inline-flex items-center gap-2 rounded-xl border border-[#D5CEFF] bg-white/80 px-4 py-2 text-sm font-semibold text-[#4C409F] shadow hover:shadow-md backdrop-blur hover:bg-white"
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

          <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-[#7C6BF2] via-[#9B87F5] to-[#7EC8E3]">
            Manage Lessons
          </h1>

          <div className="w-[84px]" />
        </div>
      </header>

      {/* Main */}
      <main className="relative z-10 mx-auto max-w-4xl px-6 pb-20">
        {/* Info strip */}
        <div className="mx-auto mb-6 flex w-full items-center justify-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#EDE9FE] via-[#FFF0F5] to-[#DFF5F0] px-4 py-2 text-xs font-medium text-[#4E3FA3] shadow-sm">
            <span className="h-2 w-2 rounded-full bg-[#9B87F5]" />
            Upload PDFs for e-book, audio book, or explanation
          </div>
        </div>

        <form
          onSubmit={onSave}
          className="relative rounded-3xl border border-white/70 bg-white/80 p-8 shadow-2xl backdrop-blur space-y-6"
        >
          {/* Selectors */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-sm font-semibold text-[#4E3FA3] mb-2">Class</label>
              <select
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                className="w-full rounded-xl border border-[#E7E3FF] bg-white/95 px-4 py-3 outline-none focus:ring-2 focus:ring-[#C7B7FF]"
                required
              >
                <option value="" disabled>
                  Select class
                </option>
                <option value="7">7</option>
                <option value="8">8</option>
                <option value="9">9</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-[#4E3FA3] mb-2">Subject</label>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full rounded-xl border border-[#E7E3FF] bg-white/95 px-4 py-3 outline-none focus:ring-2 focus:ring-[#C7B7FF]"
                required
              >
                <option value="" disabled>
                  Select subject
                </option>
                <option value="Science">Science</option>
                <option value="SSC">SSC</option>
                <option value="Maths">Maths</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-[#4E3FA3] mb-2">Chapter Name</label>
              <input
                type="text"
                value={chapter}
                onChange={(e) => setChapter(e.target.value)}
                placeholder="e.g., Motion & Measurement"
                className="w-full rounded-xl border border-[#E7E3FF] bg-white/95 px-4 py-3 outline-none focus:ring-2 focus:ring-[#C7B7FF]"
                required
              />
            </div>
          </div>

          {/* Upload buttons */}
          <div className="grid gap-4 sm:grid-cols-3">
            <button
              type="button"
              onClick={onPickEbook}
              className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#7EC8E3] via-[#9B87F5] to-[#F9B8C6] px-4 py-3 text-white font-semibold shadow hover:brightness-110 transition"
            >
              <FileText className="h-5 w-5" />
              Upload E-Book (PDF)
            </button>
            <button
              type="button"
              onClick={onPickAudio}
              className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#F9B8C6] via-[#9B87F5] to-[#7EC8E3] px-4 py-3 text-white font-semibold shadow hover:brightness-110 transition"
            >
              <Headphones className="h-5 w-5" />
              Upload Audio Book (PDF)
            </button>
            <button
              type="button"
              onClick={onPickExpl}
              className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#9B87F5] via-[#7EC8E3] to-[#F9B8C6] px-4 py-3 text-white font-semibold shadow hover:brightness-110 transition"
            >
              <BookOpen className="h-5 w-5" />
              Upload Explanation (PDF)
            </button>

            {/* Hidden inputs (one per type) */}
            <input
              ref={ebookInputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={handleEbookChange}
            />
            <input
              ref={audioInputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={handleAudioChange}
            />
            <input
              ref={explInputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={handleExplChange}
            />
          </div>

          {/* Upload status badges */}
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-[#EEF5FF] text-[#355C7D] px-3 py-2 border border-white/60">
              <div className="text-xs font-semibold mb-0.5">E-Book</div>
              <div className="text-xs break-all">
                {ebook ? (
                  <span className="inline-flex items-center gap-1 text-emerald-700">
                    <CheckCircle2 className="h-4 w-4" />
                    {ebook.storagePath}
                  </span>
                ) : (
                  <span className="opacity-70">No file uploaded</span>
                )}
              </div>
            </div>
            <div className="rounded-xl bg-[#FFF0F2] text-[#7D354A] px-3 py-2 border border-white/60">
              <div className="text-xs font-semibold mb-0.5">Audio Book</div>
              <div className="text-xs break-all">
                {audiobook ? (
                  <span className="inline-flex items-center gap-1 text-emerald-700">
                    <CheckCircle2 className="h-4 w-4" />
                    {audiobook.storagePath}
                  </span>
                ) : (
                  <span className="opacity-70">No file uploaded</span>
                )}
              </div>
            </div>
            <div className="rounded-xl bg-[#EFFAF6] text-[#2D6A5D] px-3 py-2 border border-white/60">
              <div className="text-xs font-semibold mb-0.5">Explanation</div>
              <div className="text-xs break-all">
                {explanation ? (
                  <span className="inline-flex items-center gap-1 text-emerald-700">
                    <CheckCircle2 className="h-4 w-4" />
                    {explanation.storagePath}
                  </span>
                ) : (
                  <span className="opacity-70">No file uploaded</span>
                )}
              </div>
            </div>
          </div>

          {/* Messages */}
          {status && (
            <div
              className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm border ${
                status.type === "error"
                  ? "bg-[#FFF1F0] text-[#8A3B3B] border-[#FFD6D3]"
                  : status.type === "success"
                  ? "bg-[#E7FFF7] text-[#2A7B6F] border-[#C6F2E7]"
                  : "bg-[#EEF2FF] text-[#3C3C8C] border-[#D8DEFF]"
              }`}
            >
              {status.type === "error" ? <AlertTriangle className="h-4 w-4" /> : null}
              {status.type === "success" ? <CheckCircle2 className="h-4 w-4" /> : null}
              {status.type === "info" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              <span>{status.message}</span>
            </div>
          )}

          {/* Save */}
          <div className="flex items-center justify-between">
            <div className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#EDE9FE] via-[#FFF0F5] to-[#E7F0FF] px-3 py-1.5 text-xs font-medium text-[#4E3FA3]">
              Ensure PDFs are the correct chapter resources
            </div>
            <button
              type="submit"
              disabled={saving}
              className={`rounded-2xl px-6 py-3 text-sm font-semibold shadow transition ${
                saving
                  ? "bg-[#EEE9FF] text-[#8A82B8] cursor-not-allowed"
                  : "bg-gradient-to-r from-[#9B87F5] via-[#7EC8E3] to-[#F9B8C6] text-white hover:brightness-110"
              }`}
            >
              {saving ? "Saving…" : "Save Lesson"}
            </button>
          </div>
        </form>
      </main>

      {/* Local animations */}
      <style jsx global>{`
        @keyframes drift {
          0% { transform: translate(0, 0) rotate(12deg); }
          50% { transform: translate(12px, -10px) rotate(16deg); }
          100% { transform: translate(0, 0) rotate(12deg); }
        }
        @keyframes drift2 {
          0% { transform: translate(0, 0) rotate(-6deg); }
          50% { transform: translate(-14px, 12px) rotate(-2deg); }
          100% { transform: translate(0, 0) rotate(-6deg); }
        }
      `}</style>
    </div>
  );
}
