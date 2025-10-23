"use client";

import React, { useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { db, storage } from "@/lib/firebase";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";

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

// Optional client cap (keep <= any server/proxy limit you might have)
const MAX_FILE_BYTES = 500 * 1024 * 1024; // 500 MB

export default function UploadVideosPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [language, setLanguage] = useState<LangLabel | "">("");
  const [file, setFile] = useState<File | null>(null);

  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;

    if (!f) {
      setFile(null);
      return;
    }
    if (!f.type.startsWith("video/")) {
      setMessage({ kind: "error", text: "Please select a video file." });
      e.target.value = "";
      setFile(null);
      return;
    }
    if (f.size > MAX_FILE_BYTES) {
      setMessage({
        kind: "error",
        text: `File too large. Max ${(MAX_FILE_BYTES / (1024 * 1024)).toFixed(0)} MB.`,
      });
      e.target.value = "";
      setFile(null);
      return;
    }
    setMessage(null);
    setFile(f);
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (!user?.uid) {
      setMessage({ kind: "error", text: "You must be logged in as a teacher." });
      return;
    }
    if (!title.trim()) {
      setMessage({ kind: "error", text: "Please enter a title." });
      return;
    }
    if (!language) {
      setMessage({ kind: "error", text: "Please choose a language." });
      return;
    }
    if (!file) {
      setMessage({ kind: "error", text: "Please select a video file to upload." });
      return;
    }

    try {
      setIsUploading(true);
      setProgress(0);

      // Build a storage path: videos/<uid>/<timestamp>_<sanitizedName>
      const safeName = file.name.replace(/[^\w.\-()+\s]/g, "_") || `video_${Date.now()}.mp4`;
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      const storagePath = `videos/${user.uid}/${stamp}_${safeName}`;
      const storageRef = ref(storage, storagePath);

      const task = uploadBytesResumable(storageRef, file, { contentType: file.type });

      task.on(
        "state_changed",
        (snap) => {
          const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
          setProgress(pct);
        },
        (err) => {
          console.error(err);
          setMessage({ kind: "error", text: err?.message || "Upload failed." });
          setIsUploading(false);
        },
        async () => {
          // Completed
          const downloadURL = await getDownloadURL(task.snapshot.ref);

          const payload = {
            title: title.trim(),
            description: description.trim(),
            language,
            videoURL: downloadURL,   // public playback URL
            storagePath,            // videos/<uid>/<file>
            uploadedBy: user.uid,
            uploaderName: user.displayName || user.email || "Teacher",
            role: "teacher",
            createdAt: serverTimestamp(),
          };

          await addDoc(collection(db, "videos"), payload);

          setMessage({ kind: "success", text: "Video uploaded successfully!" });
          setTitle("");
          setDescription("");
          setLanguage("");
          setFile(null);
          setProgress(0);
          setIsUploading(false);
        }
      );
    } catch (err: any) {
      console.error(err);
      setMessage({ kind: "error", text: err?.message || "Upload failed." });
      setIsUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-emerald-50">
      <div className="max-w-3xl mx-auto px-6 py-10">
        <h1 className="text-3xl font-extrabold text-emerald-700">Upload Videos</h1>
        <p className="text-emerald-900/70 mt-1">
          Add a title, description, choose the language, and upload your lesson video.
        </p>

        <form
          onSubmit={handleUpload}
          className="mt-8 space-y-5 rounded-2xl bg-white/80 backdrop-blur border border-emerald-100 shadow-xl p-6"
        >
          <div>
            <label className="block text-sm font-medium text-emerald-900/80 mb-1">Language</label>
            <select
              className="w-full p-3 border rounded-lg bg-white"
              value={language}
              onChange={(e) => setLanguage(e.target.value as LangLabel)}
            >
              <option value="">Select Language</option>
              {LANGS.map((lang) => (
                <option key={lang} value={lang}>
                  {lang}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-emerald-900/80 mb-1">Title</label>
            <input
              type="text"
              className="w-full p-3 border rounded-lg"
              placeholder="e.g., Motion – Class 9 (Marathi)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={140}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-emerald-900/80 mb-1">Description</label>
            <textarea
              className="w-full p-3 border rounded-lg min-h-[120px]"
              placeholder="Brief description of this lesson video…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={1000}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-emerald-900/80 mb-1">Video file</label>
            <input
              type="file"
              accept="video/*"
              onChange={onPickFile}
              className="block w-full text-sm text-emerald-800 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-emerald-600 file:text-white hover:file:bg-emerald-700"
            />
            <p className="text-xs text-emerald-900/60 mt-1">
              Only video files are allowed. Max {(MAX_FILE_BYTES / (1024 * 1024)).toFixed(0)} MB.
            </p>
            {file && (
              <p className="text-xs text-emerald-900/70 mt-1">
                Selected: <strong>{file.name}</strong> ({(file.size / (1024 * 1024)).toFixed(1)} MB)
              </p>
            )}
          </div>

          {isUploading && (
            <div>
              <div className="w-full h-2 bg-emerald-100 rounded-full overflow-hidden">
                <div
                  className="h-2 bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-full transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-sm text-emerald-800 mt-1">Uploading… {progress}%</p>
            </div>
          )}

          {message && (
            <div
              className={`rounded-lg px-4 py-3 text-sm ${
                message.kind === "success"
                  ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                  : "bg-rose-50 text-rose-700 border border-rose-200"
              }`}
            >
              {message.text}
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={isUploading}
              className={`px-6 py-3 rounded-xl text-white shadow-sm transition ${
                isUploading
                  ? "bg-emerald-300 cursor-not-allowed"
                  : "bg-gradient-to-r from-emerald-600 to-emerald-700 hover:brightness-110"
              }`}
            >
              {isUploading ? "Uploading…" : "Upload"}
            </button>

            <button
              type="button"
              onClick={() => router.back()}
              className="px-6 py-3 rounded-xl border border-emerald-200 bg-white text-emerald-800 hover:bg-emerald-50 transition"
            >
              Back
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
