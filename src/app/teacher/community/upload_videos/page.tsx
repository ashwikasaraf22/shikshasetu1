"use client";

import React, { useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { db } from "@/lib/firebase";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { useRouter } from "next/navigation";

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

const MAX_FILE_BYTES = 500 * 1024 * 1024; // 500 MB

function toPublicId(name: string) {
  return (
    name
      .toLowerCase()
      .replace(/\.[^.]+$/, "")
      .replace(/[^\w\-]+/g, "-")
      .replace(/\-+/g, "-")
      .replace(/^\-+|\-+$/g, "") || `video_${Date.now()}`
  );
}

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

      const folder = `videos/${user.uid}`;
      const public_id = `${new Date().toISOString().replace(/[:.]/g, "-")}_${toPublicId(file.name)}`;

      // --- get signature (parse JSON ONCE) ---
      const signRes = await fetch("/api/cloudinary/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folder, public_id }),
      });

      const signJson = await signRes.json().catch(() => null as any);
      if (!signRes.ok || !signJson) {
        const msg = signJson?.error || "Failed to sign Cloudinary upload.";
        throw new Error(msg);
      }

      const { cloudName, apiKey, timestamp, signature } = signJson as {
        cloudName: string;
        apiKey: string;
        timestamp: number;
        signature: string;
      };

      // video endpoint (explicit)
      const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`;

      const form = new FormData();
      form.append("file", file);
      form.append("api_key", apiKey);
      form.append("timestamp", String(timestamp));
      form.append("signature", signature);
      form.append("folder", folder);
      form.append("public_id", public_id);

      // --- upload with progress via XHR ---
      const xhr = new XMLHttpRequest();
      const uploadPromise = new Promise<any>((resolve, reject) => {
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const pct = Math.round((event.loaded / event.total) * 100);
            setProgress(pct);
          }
        };
        xhr.onload = () => {
          try {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve(JSON.parse(xhr.responseText));
            } else {
              let msg = `Upload failed with status ${xhr.status}`;
              try {
                const parsed = JSON.parse(xhr.responseText);
                if (parsed?.error?.message) msg = parsed.error.message;
              } catch {}
              reject(new Error(msg));
            }
          } catch (err) {
            reject(err);
          }
        };
        xhr.onerror = () => reject(new Error("Network error during upload."));
        xhr.open("POST", uploadUrl, true);
        xhr.send(form);
      });

      const cloudinaryResp = await uploadPromise;

      const videoURL: string = cloudinaryResp.secure_url;
      const cloudinaryPublicId: string = cloudinaryResp.public_id;
      const cloudinaryVersion: number = cloudinaryResp.version;
      const format: string | undefined = cloudinaryResp.format; // e.g., mp4
      const duration: number | undefined = cloudinaryResp.duration;
      const width: number | undefined = cloudinaryResp.width;
      const height: number | undefined = cloudinaryResp.height;
      const bytes: number | undefined = cloudinaryResp.bytes;

      // Simple first-frame thumbnail URL (poster)
      // You can adjust the transformation if you want a different frame.
      const thumbnailUrl = videoURL?.replace("/upload/", "/upload/so_0/");

      const payload = {
        title: title.trim(),
        description: description.trim(),
        language,
        videoURL,
        storagePath: cloudinaryPublicId,
        uploadedBy: user.uid,
        uploaderName: user.displayName || user.email || "Teacher",
        role: "teacher",
        cloudinaryVersion,
        createdAt: serverTimestamp(),

        // extra metadata (useful for listings / previews)
        format: format ?? null,
        duration: duration ?? null,
        width: width ?? null,
        height: height ?? null,
        bytes: bytes ?? null,
        thumbnailUrl: thumbnailUrl ?? null,
      };

      await addDoc(collection(db, "videos"), payload);

      setMessage({ kind: "success", text: "Video uploaded successfully!" });
      setTitle("");
      setDescription("");
      setLanguage("");
      setFile(null);
      setProgress(0);
      setIsUploading(false);
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

            {/* Back Button */}
            <button
              type="button"
              onClick={() => router.push("/teacher/community")}
              className="px-6 py-3 rounded-xl border border-emerald-200 bg-white text-emerald-800 hover:bg-emerald-50 transition"
            >
              Back to Community
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
