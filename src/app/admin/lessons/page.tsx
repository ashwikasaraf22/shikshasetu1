// src/app/admin/lessons/page.tsx
'use client';

import React, { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase"; // Assuming firebase is setup
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { FileUp, Loader2, CheckCircle2, AlertTriangle, BookText, AudioLines } from "lucide-react"; // Added icons
import { Button } from "@/components/ui/button"; // Assuming shadcn ui
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast"; // Assuming useToast hook
import { T } from "@/components/T"; // Assuming translation component

const CHAPTER_COLLECTION = "chapters";

type UploadedAsset = {
  url: string; // secure_url
  storagePath: string; // public_id
  format: string; // e.g., 'pdf'
  bytes: number; // size in bytes
  resource_type: string; // 'raw' or 'image'
};

function clean<T extends Record<string, any>>(obj: T): T { /* ... keep existing clean function ... */
    const out: Record<string, any> = {};
    Object.entries(obj).forEach(([k, v]) => {
        if (v === undefined || v === null) return;
        if (typeof v === 'object' && !Array.isArray(v)) {
        const nested = clean(v as any);
        if (Object.keys(nested).length > 0) out[k] = nested;
        } else if (Array.isArray(v)) {
        out[k] = v.map((x) => (typeof x === 'object' ? clean(x) : x)).filter(x => x !== undefined && x !== null);
        } else {
        out[k] = v;
        }
    });
    return out as T;
}

export default function ManageChapterPDFsPage() {
  const router = useRouter();
  const { toast } = useToast();

  // Form state
  const [grade, setGrade] = useState<string>("");
  const [subject, setSubject] = useState<string>("");
  const [chapterTitle, setChapterTitle] = useState<string>("");

  // --- NEW: Separate state for file selection and extracted/uploaded data ---
  const [selectedPdfFile, setSelectedPdfFile] = useState<File | null>(null);
  const [extractedText, setExtractedText] = useState<string | null>(null);
  const [uploadedPdfData, setUploadedPdfData] = useState<UploadedAsset | null>(null);

  // UI states
  const [isExtracting, setIsExtracting] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [status, setStatus] = useState<{ type: "error" | "success" | "info"; message: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  /** Cloudinary Upload Function - Reverted to RAW */
  const uploadPdfToCloudinary = async (file: File): Promise<UploadedAsset> => { /* ... keep existing Cloudinary upload using /raw/upload ... */
    setIsUploading(true);
    setStatus({ type: "info", message: "Uploading PDF to Cloudinary..." });
    try {
        const sign = await fetch("/api/cloudinary/sign", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ folder: "chapters" }),
        }).then((r) => r.json());

        if (sign?.error) throw new Error(sign.error || "Failed to get Cloudinary signature.");
        const { cloudName, apiKey, signature, timestamp, folder } = sign;
        const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/raw/upload`;
        const form = new FormData();
        form.append("file", file);
        form.append("api_key", apiKey);
        form.append("timestamp", String(timestamp));
        form.append("signature", signature);
        form.append("folder", folder);
        const res = await fetch(uploadUrl, { method: "POST", body: form });
        if (!res.ok) {
            const txt = await res.text().catch(() => "");
            throw new Error(`Cloudinary upload failed (${res.status}): ${txt}`);
        }
        const json = await res.json();
        const asset: UploadedAsset = clean({
            url: json.secure_url,
            storagePath: json.public_id,
            format: json.format || 'pdf',
            bytes: json.bytes,
            resource_type: json.resource_type,
        });
        setStatus({ type: "success", message: "PDF uploaded successfully." });
        return asset;
    } catch (err: any) {
        setStatus({ type: "error", message: err?.message || "Failed to upload PDF." });
        throw err;
    } finally {
        setIsUploading(false);
    }
  };

  /** --- NEW: Function to extract text using API route --- */
  const extractTextFromPdf = async (file: File): Promise<string> => {
    setIsExtracting(true);
    setStatus({ type: "info", message: "Extracting text using Gemini..." });
    try {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('/api/extract-pdf-text', {
            method: 'POST',
            body: formData,
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || `Text extraction failed (${response.status})`);
        }
        setStatus({ type: "success", message: "Text extracted successfully." });
        return data.extractedText || "";
    } catch (err: any) {
        console.error("Extraction error:", err);
        setStatus({ type: "error", message: err.message || "Failed to extract text." });
        throw err; // Re-throw
    } finally {
        setIsExtracting(false);
    }
  };

  /** Handle file input change: Select -> Extract -> Upload */
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    e.target.value = ""; // Reset input immediately

    // Basic validation
    if (file.type !== "application/pdf") {
      setStatus({ type: "error", message: "Only PDF files are allowed." });
      setSelectedPdfFile(null);
      setExtractedText(null);
      setUploadedPdfData(null);
      return;
    }

    // Reset previous state for the new file
    setSelectedPdfFile(file);
    setExtractedText(null);
    setUploadedPdfData(null);
    setStatus(null);

    // --- Chain the operations: Extract then Upload ---
    try {
      // 1. Extract Text
      const text = await extractTextFromPdf(file);
      setExtractedText(text);

      // 2. Upload PDF to Cloudinary (only after text extraction succeeds)
      const asset = await uploadPdfToCloudinary(file);
      setUploadedPdfData(asset);

    } catch (err) {
      // Errors are set within the helper functions
      // Reset state if either step fails
      setSelectedPdfFile(null);
      setExtractedText(null);
      setUploadedPdfData(null);
    }
  };

  /** Trigger hidden file input */
  const onPickPdf = () => fileInputRef.current?.click();

  /** Save chapter metadata to Firestore (includes extractedText) */
  const onSaveChapter = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);

    // Validation
    if (!grade || !subject || !chapterTitle.trim()) {
      setStatus({ type: "error", message: "Please select Class, Subject, and enter Chapter Title." });
      return;
    }
    // ** Check if BOTH extraction and upload are done **
    if (!uploadedPdfData || extractedText === null) {
      setStatus({ type: "error", message: "Please select a PDF. Text extraction and upload must complete first." });
      return;
    }

    const user = auth.currentUser;
    if (!user) {
      setStatus({ type: "error", message: "You must be logged in." });
      return;
    }

    // --- Updated Payload ---
    const payload = clean({
      classGrade: grade,
      subject,
      chapterTitle: chapterTitle.trim(),
      pdfData: uploadedPdfData, // Cloudinary info
      extractedText: extractedText, // The extracted text string
      uploadedBy: user.uid,
      uploaderName: user.displayName || user.email || "Admin",
      createdAt: serverTimestamp(),
    });

    setIsSaving(true);
    try {
      const docRef = await addDoc(collection(db, CHAPTER_COLLECTION), payload);

      // Add Notification (existing logic)
      try { /* ... keep existing notification logic ... */
          await addDoc(collection(db, 'notifications'), {
            type: 'new_chapter',
            title: 'New Chapter Added!',
            message: `Chapter "${payload.chapterTitle}" for Class ${payload.classGrade} ${payload.subject} is now available.`,
            targetClass: payload.classGrade,
            targetSubject: payload.subject,
            relatedDocId: docRef.id,
            createdAt: serverTimestamp(),
            isRead: false
        });
      } catch (notifError) { console.warn("Failed to create notification:", notifError); }

      setStatus({ type: "success", message: `Chapter "${payload.chapterTitle}" saved successfully (PDF & Text).` });
      toast({ title: "Chapter Saved", description: `"${payload.chapterTitle}" added with PDF and extracted text.` });

      // Reset form
      setGrade("");
      setSubject("");
      setChapterTitle("");
      setSelectedPdfFile(null);
      setExtractedText(null);
      setUploadedPdfData(null);

    } catch (err: any) {
      console.error(err);
      const msg = err?.code ? `(${err.code}) ${err.message}` : err?.message || "Failed to save chapter.";
      setStatus({ type: "error", message: msg });
      toast({ variant: "destructive", title: "Save Failed", description: msg });
    } finally {
      setIsSaving(false);
    }
  };

  const currentTask = isExtracting ? "Extracting..." : isUploading ? "Uploading..." : isSaving ? "Saving..." : null;
  const isBusy = isExtracting || isUploading || isSaving;

  return (
    <div className="relative min-h-screen overflow-hidden text-gray-800 bg-gradient-to-br from-[#F0FAF8] via-[#F4F1FF] to-[#FFF6F9]">
      {/* Header (keep existing) */}
      <header className="relative z-10"> {/* ... keep existing header ... */}
            <div className="mx-auto max-w-6xl px-6 pt-10 pb-6 flex items-center justify-between">
                <Button variant="outline" onClick={() => router.push("/admin")} className="inline-flex items-center gap-2 rounded-xl border border-[#D5CEFF] bg-white/80 px-4 py-2 text-sm font-semibold text-[#4C409F] shadow hover:shadow-md backdrop-blur hover:bg-white">
                    <svg width="16" height="16" viewBox="0 0 24 24" className="-ml-0.5"><path d="M15 18l-6-6 6-6" fill="none" stroke="#6F5AE8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    <T>Back</T>
                </Button>
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-[#7C6BF2] via-[#9B87F5] to-[#7EC8E3]">
                    <T>Upload Chapter PDF</T>
                </h1>
                <div className="w-[84px]" /> {/* Spacer */}
            </div>
        </header>

      {/* Main Form */}
      <main className="relative z-10 mx-auto max-w-3xl px-6 pb-20">
        <form onSubmit={onSaveChapter} className="relative rounded-3xl border border-white/70 bg-white/80 p-8 shadow-2xl backdrop-blur space-y-6">
          {/* Selectors (keep existing) */}
          <div className="grid gap-4 sm:grid-cols-3"> {/* ... keep existing selectors for class, subject, title ... */}
                <div>
                <Label className="block text-sm font-semibold text-[#4E3FA3] mb-2"><T>Class</T></Label>
                <Select value={grade} onValueChange={setGrade} required disabled={isBusy}>
                    <SelectTrigger className="w-full rounded-xl border border-[#E7E3FF] bg-white/95 px-4 py-3 outline-none focus:ring-2 focus:ring-[#C7B7FF]">
                    <SelectValue placeholder="Select class" />
                    </SelectTrigger>
                    <SelectContent>
                    <SelectItem value="7">7</SelectItem>
                    <SelectItem value="8">8</SelectItem>
                    <SelectItem value="9">9</SelectItem>
                    </SelectContent>
                </Select>
                </div>
                 <div>
                    <Label className="block text-sm font-semibold text-[#4E3FA3] mb-2"><T>Subject</T></Label>
                    <Select value={subject} onValueChange={setSubject} required disabled={isBusy}>
                        <SelectTrigger className="w-full rounded-xl border border-[#E7E3FF] bg-white/95 px-4 py-3 outline-none focus:ring-2 focus:ring-[#C7B7FF]">
                        <SelectValue placeholder="Select subject" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="Science">Science</SelectItem>
                            <SelectItem value="SSC">SSC</SelectItem>
                            <SelectItem value="Maths">Maths</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                 <div className="sm:col-span-1">
                    <Label className="block text-sm font-semibold text-[#4E3FA3] mb-2"><T>Chapter Title</T></Label>
                    <Input
                        type="text" value={chapterTitle} onChange={(e) => setChapterTitle(e.target.value)}
                        placeholder="e.g., Motion & Measurement"
                        className="w-full rounded-xl border border-[#E7E3FF] bg-white/95 px-4 py-3 outline-none focus:ring-2 focus:ring-[#C7B7FF]"
                        required disabled={isBusy}
                    />
                </div>
            </div>

          {/* PDF Upload Area (Updated) */}
          <div>
            <Label className="block text-sm font-semibold text-[#4E3FA3] mb-2"><T>Chapter Ebook PDF</T></Label>
            <div className="flex items-center gap-4">
               <Button
                  type="button"
                  variant="outline"
                  onClick={onPickPdf}
                  disabled={isBusy} // Disable if any task is running
                  className="flex items-center justify-center gap-2 rounded-xl border-[#E7E3FF] bg-white/95 px-4 py-3 text-[#4E3FA3] font-semibold shadow hover:bg-[#F8F6FF] transition"
                >
                  <FileUp className="h-5 w-5" />
                  {selectedPdfFile ? <T>Change PDF</T> : <T>Select PDF</T>}
                </Button>
                {/* Hidden input */}
                <input ref={fileInputRef} type="file" accept="application/pdf" className="hidden" onChange={handleFileChange} disabled={isBusy} />

                {/* Status Indicators */}
                {selectedPdfFile && (
                    <span className="text-sm text-gray-600 truncate"><T>Selected:</T> {selectedPdfFile.name}</span>
                )}
                {currentTask && (
                    <span className="inline-flex items-center gap-1 text-sm text-blue-700">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <T>{currentTask}</T>
                    </span>
                 )}
                 {/* Show success only when BOTH are done */}
                 {uploadedPdfData && extractedText !== null && !isBusy && (
                    <span className="inline-flex items-center gap-1 text-sm text-emerald-700">
                        <CheckCircle2 className="h-4 w-4" />
                        <T>Ready to Save</T>
                    </span>
                 )}
            </div>
             <p className="text-xs text-[#5A4DA8]/70 mt-2">
                <T>Select PDF. Text extraction and Cloudinary upload will start automatically.</T>
             </p>
          </div>

           {/* Display Extracted Text Snippet (Optional Preview) */}
            {extractedText && (
                <div className="mt-4 space-y-1">
                    <Label className="text-xs font-semibold text-[#4E3FA3]"><T>Extracted Text Preview:</T></Label>
                    <p className="text-xs p-2 border border-[#E7E3FF] rounded-md bg-gray-50/50 max-h-20 overflow-auto text-gray-600">
                        {extractedText.substring(0, 300)}{extractedText.length > 300 ? '...' : ''}
                    </p>
                </div>
            )}


          {/* Status Messages */}
          {status && ( <div className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm border ${ status.type === "error" ? "bg-[#FFF1F0] text-[#8A3B3B] border-[#FFD6D3]" : status.type === "success" ? "bg-[#E7FFF7] text-[#2A7B6F] border-[#C6F2E7]" : "bg-[#EEF2FF] text-[#3C3C8C] border-[#D8DEFF]" }`}>
              {status.type === "error" && <AlertTriangle className="h-4 w-4" />}
              {status.type === "success" && <CheckCircle2 className="h-4 w-4" />}
              {status.type === "info" && <Loader2 className="h-4 w-4 animate-spin" />}
              <span>{status.message}</span>
            </div>
          )}

          {/* Save Button */}
          <div className="flex justify-end pt-4">
            <Button
              type="submit"
              // Disable unless both steps are complete AND not currently saving
              disabled={isBusy || !uploadedPdfData || extractedText === null}
              className={`rounded-xl px-6 py-3 text-sm font-semibold shadow transition ${ (isBusy || !uploadedPdfData || extractedText === null) ? "bg-[#EEE9FF] text-[#8A82B8] cursor-not-allowed" : "bg-gradient-to-r from-[#9B87F5] via-[#7EC8E3] to-[#F9B8C6] text-white hover:brightness-110" }`}
            >
              {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> <T>Saving...</T></> : <T>Save Chapter</T>}
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}