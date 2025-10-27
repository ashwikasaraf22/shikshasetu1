// src/app/student/lesson/page.tsx
'use client';

import { T } from '@/components/T';
import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { BookText, PlayCircle, MessageCircle, Eye, Loader2, Volume2, FileText } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { db } from '@/lib/firebase';
import { addDoc, collection, query, where, getDocs, serverTimestamp, Timestamp } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';

// --- Types ---
const LANGS = ["Hindi", "Marathi", "Bengali", "Tamil", "English", "Punjabi", "Assamese"] as const;
type LangLabel = typeof LANGS[number];

type ChapterDoc = {
  id: string;
  classGrade: string;
  subject: string;
  chapterTitle: string;
  pdfData?: {
    url: string;
    storagePath: string;
    format: string;
    bytes: number;
    resource_type: string;
  };
  extractedText?: string;
  isStatic?: boolean;
  staticLanguage?: LangLabel;
  createdAt?: Timestamp;
};

// --- Static (Hardcoded) Data Structure ---
const staticSubjects = ["Science", "Maths", "SSC"] as const;
const staticChaptersByClass: Record<"7" | "8" | "9", Record<string, string[]>> = {
  "7": { Science: ["Magnets", "Methods of Seperation", "Mindful Eating"], SSC: ["Family", "Oceans and Continents", "Timeline"], Maths: ["Data Handling", "Symmetry", "Lines and Angles"] },
  "8": { Science: ["Electricity", "Life Processes in Plants", "Life Processes in Animals"], SSC: ["Empires", "Gupta Empire", "Understanding Markets"], Maths: ["Expressions using Letters", "Fractions", "Number Play"] },
  "9": { Science: ["Is Matter Around Us Pure", "Motion", "Cell Fundamental Unit of Life"], Maths: ["Number System", "Polynomials", "Coordinate Geometry"], SSC: ["French Revolution", "India Size and Location", "What is Democracy Why Democracy", "The Story of Village Palampur"] },
};

// --- Helpers ---
const getClassNumber = (cn?: string | null): '7' | '8' | '9' => {
  if (!cn) return "9";
  const s = String(cn).trim().toLowerCase();
  const m = s.match(/(?:class|std|standard)?\s*(\d{1,2})/i);
  if (m) { const n = parseInt(m[1],10); if ([7,8,9].includes(n)) return String(n) as "7"|"8"|"9"; }
  if (/7th/.test(s)||/\bvii\b/.test(s)||/\bseven|saat\b/.test(s)) return "7";
  if (/8th/.test(s)||/\bviii\b/.test(s)||/\beight|aath\b/.test(s)) return "8";
  if (/9th/.test(s)||/\bix\b/.test(s)||/\bnine|nau\b/.test(s)) return "9";
  return "9";
};
const slug = (s: string = '') => s.trim().toLowerCase().replace(/\s+/g, '-');
const clean = (s: string = '') => s.replace(/\s+/g, "").toLowerCase();

async function fetchTxtOnly(url: string): Promise<{ ok: boolean; status: number; text: string }> {
  try { const res = await fetch(url, { cache: "no-store" }); if (!res.ok) return { ok: false, status: res.status, text: "" }; const text = await res.text(); return { ok: true, status: 200, text: text?.trim() ?? "" }; } catch { return { ok: false, status: 0, text: "" }; }
}
function chunkText(text: string, maxLen = 180): string[] {
  const sentences = text.replace(/\s+/g, " ").split(/([.?!]|।|\n)/).reduce<string[]>((acc, part, idx, arr) => {
    if (idx % 2 === 0 && part) { acc.push((part + (arr[idx + 1] || "")).trim()); }
    return acc;
  }, []).filter(Boolean);
  const chunks: string[] = [];
  let currentChunk = "";
  for (const sentence of sentences) {
    if (currentChunk && (currentChunk.length + sentence.length + 1) > maxLen) {
      chunks.push(currentChunk.trim());
      if (sentence.length > maxLen) {
        for (let i = 0; i < sentence.length; i += maxLen) { chunks.push(sentence.substring(i, i + maxLen).trim()); }
        currentChunk = "";
      } else { currentChunk = sentence; }
    } else {
      currentChunk = (currentChunk ? currentChunk + " " : "") + sentence;
    }
  }
  if (currentChunk) chunks.push(currentChunk.trim());
  return chunks.filter(Boolean);
}
function ensureVoicesLoaded(): Promise<SpeechSynthesisVoice[]> {
  const synth = window.speechSynthesis; const existing = synth.getVoices();
  if (existing && existing.length > 0) return Promise.resolve(existing);
  return new Promise((resolve) => {
    const handler = () => { synth.onvoiceschanged = null; resolve(synth.getVoices()); };
    synth.onvoiceschanged = handler;
    setTimeout(() => { synth.onvoiceschanged = null; resolve(synth.getVoices()); }, 800);
  });
}
function pickGoogleHindiStrict(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  if (!voices) return null;
  const googleHindi = voices.find(v => /google/i.test(v.name) && /hi-IN/i.test(v.lang));
  if (googleHindi) return googleHindi;
  return voices.find(v => /hi-IN/i.test(v.lang)) || null;
}

// --- Component ---
export default function LessonPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const studentClassGrade = useMemo(() => getClassNumber(user?.className), [user?.className]);

  // --- State ---
  const [dynamicChapters, setDynamicChapters] = useState<ChapterDoc[]>([]);
  const [isLoadingChapters, setIsLoadingChapters] = useState(true);

  const [ebookSubject, setEbookSubject] = useState<string>("");
  const [ebookChapterTitle, setEbookChapterTitle] = useState<string>("");
  const [ebookLanguage, setEbookLanguage] = useState<LangLabel | "">("");

  const [audioSubject, setAudioSubject] = useState("");
  const [audioChapterTitle, setAudioChapterTitle] = useState("");
  const [audioLanguage, setAudioLanguage] = useState<LangLabel>("Hindi");

  const [explainSubject, setExplainSubject] = useState("");
  const [explainChapterTitle, setExplainChapterTitle] = useState("");
  const [explainLanguage, setExplainLanguage] = useState<LangLabel | "">("");

  const [quizSubject, setQuizSubject] = useState("");
  const [quizChapterTitle, setQuizChapterTitle] = useState("");
  const [quizLanguage, setQuizLanguage] = useState<LangLabel | "">("");

  // TTS state
  const [rate, setRate] = useState(1);
  const [ttsLoading, setTtsLoading] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [paused, setPaused] = useState(false);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const currentUtterance = useRef<SpeechSynthesisUtterance | null>(null);
  const queueRef = useRef<string[]>([]);
  const chunkIdxRef = useRef(0);
  const userActionRequiredRef = useRef(false);
  const [ttsStatus, setTtsStatus] = useState<string | null>(null);

  // --- Derived ---
  const combinedSubjects = useMemo(() => {
    const dynamicSubs = new Set(dynamicChapters.map(c => c.subject));
    const staticSubs = new Set(staticSubjects);
    return Array.from(new Set([...dynamicSubs, ...staticSubs])).sort();
  }, [dynamicChapters]);

  const getCombinedChapters = (subject: string): string[] => {
    if (!subject) return [];
    const dynamicChaps = new Set(dynamicChapters.filter(c => c.subject === subject).map(c => c.chapterTitle));
    const staticChaps = new Set(staticChaptersByClass[studentClassGrade]?.[subject] ?? []);
    return Array.from(new Set([...dynamicChaps, ...staticChaps])).sort();
  };

  const chaptersForEbookSubject = useMemo(() => getCombinedChapters(ebookSubject), [ebookSubject, dynamicChapters, studentClassGrade]);
  const chaptersForAudioSubject = useMemo(() => getCombinedChapters(audioSubject), [audioSubject, dynamicChapters, studentClassGrade]);
  const chaptersForExplainSubject = useMemo(() => getCombinedChapters(explainSubject), [explainSubject, dynamicChapters, studentClassGrade]);
  const chaptersForQuizSubject = useMemo(() => getCombinedChapters(quizSubject), [quizSubject, dynamicChapters, studentClassGrade]);

  // --- Content sources (Firestore first, static fallback) ---
  const ebookUrl = useMemo(() => {
    const dynamicDoc = dynamicChapters.find(c => c.subject === ebookSubject && c.chapterTitle === ebookChapterTitle);
    if (dynamicDoc?.pdfData?.url) return dynamicDoc.pdfData.url;
    if (ebookSubject && ebookChapterTitle && ebookLanguage) {
      return `/pdfs/${slug(ebookSubject)}/${slug(ebookLanguage)}/${clean(ebookChapterTitle)}.pdf`;
    }
    return null;
  }, [dynamicChapters, ebookSubject, ebookChapterTitle, ebookLanguage]);

  const audioContentSource = useMemo(() => {
    const dynamicDoc = dynamicChapters.find(c => c.subject === audioSubject && c.chapterTitle === audioChapterTitle);
    if (dynamicDoc?.extractedText !== undefined && dynamicDoc?.extractedText !== null) {
      return { type: 'text', content: dynamicDoc.extractedText } as const;
    }
    if (audioSubject && audioChapterTitle && audioLanguage) {
      const txtPath = `/pdfs/${slug(audioSubject)}/${slug(audioLanguage)}/${clean(audioChapterTitle)}.txt`;
      return { type: 'url', content: txtPath } as const;
    }
    return null;
  }, [dynamicChapters, audioSubject, audioChapterTitle, audioLanguage]);

  const explanationContentSource = useMemo(() => {
    const dynamicDoc = dynamicChapters.find(c => c.subject === explainSubject && c.chapterTitle === explainChapterTitle);
    if (dynamicDoc?.extractedText !== undefined && dynamicDoc?.extractedText !== null) {
      return { type: 'text', content: dynamicDoc.extractedText } as const;
    }
    if (explainSubject && explainChapterTitle && explainLanguage) {
      const txtPath = `/explanations/${slug(explainSubject)}/${slug(explainLanguage)}/${clean(explainChapterTitle)}.txt`;
      return { type: 'url', content: txtPath } as const;
    }
    return null;
  }, [dynamicChapters, explainSubject, explainChapterTitle, explainLanguage]);

  // --- Fetch Dynamic Chapters ---
  useEffect(() => {
    if (authLoading || !user || !studentClassGrade) {
      setIsLoadingChapters(authLoading);
      return;
    }

    setIsLoadingChapters(true);
    setDynamicChapters([]);

    const chaptersQuery = query(
      collection(db, 'chapters'),
      where('classGrade', '==', studentClassGrade)
    );

    getDocs(chaptersQuery)
      .then((snapshot) => {
        const chaptersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChapterDoc));
        setDynamicChapters(chaptersData);

        const latestCombinedSubjects = Array.from(new Set([...new Set(chaptersData.map(c => c.subject)), ...staticSubjects])).sort();
        const currentSubjects = new Set(latestCombinedSubjects);

        if (ebookSubject && !currentSubjects.has(ebookSubject)) { setEbookSubject(""); setEbookChapterTitle(""); setEbookLanguage(""); }
        if (audioSubject && !currentSubjects.has(audioSubject)) { setAudioSubject(""); setAudioChapterTitle(""); setAudioLanguage("Hindi"); }
        if (explainSubject && !currentSubjects.has(explainSubject)) { setExplainSubject(""); setExplainChapterTitle(""); setExplainLanguage(""); }
        if (quizSubject && !currentSubjects.has(quizSubject)) { setQuizSubject(""); setQuizChapterTitle(""); setQuizLanguage(""); }

        const ebookChaps = getCombinedChapters(ebookSubject);
        if (ebookChapterTitle && !ebookChaps.includes(ebookChapterTitle)) { setEbookChapterTitle(""); setEbookLanguage(""); }
        const audioChaps = getCombinedChapters(audioSubject);
        if (audioChapterTitle && !audioChaps.includes(audioChapterTitle)) { setAudioChapterTitle(""); }
        const explainChaps = getCombinedChapters(explainSubject);
        if (explainChapterTitle && !explainChaps.includes(explainChapterTitle)) { setExplainChapterTitle(""); setExplainLanguage(""); }
        const quizChaps = getCombinedChapters(quizSubject);
        if (quizChapterTitle && !quizChaps.includes(quizChapterTitle)) { setQuizChapterTitle(""); setQuizLanguage(""); }
      })
      .catch((error) => {
        if ((error as any).code === 'permission-denied') {
          toast({ variant: "destructive", title: "Access Denied", description: "Could not load chapters. Please check Firestore rules." });
        } else {
          toast({ variant: "destructive", title: "Error", description: "Could not load dynamic chapters." });
        }
        setDynamicChapters([]);
      })
      .finally(() => setIsLoadingChapters(false));
  }, [user, authLoading, studentClassGrade, toast]);

  // --- Event Handlers ---
  const writeContentRead = async ({ kind, subject, chapter }: { kind: 'ebook' | 'explanation'; subject: string; chapter: string; }) => {
    if (!user?.uid) return;
    try {
      await addDoc(collection(db, 'contentReads'), {
        studentID: user.uid,
        kind,
        class: studentClassGrade,
        subject,
        chapter,
        timestamp: serverTimestamp(),
      });
    } catch (e) { console.error('Failed to log content read:', e); }
  };

  const onOpenEbook = async (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (!ebookUrl || !ebookSubject || !ebookChapterTitle) return;
    e.preventDefault();
    await writeContentRead({ kind: 'ebook', subject: ebookSubject, chapter: ebookChapterTitle });
    window.open(ebookUrl, '_blank', 'noopener,noreferrer');
  };

  // --- TTS Logic ---
  useEffect(() => { (async () => { const voices = await ensureVoicesLoaded(); voiceRef.current = pickGoogleHindiStrict(voices); })(); }, []);
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "hidden") {
        if (speaking && !paused) { window.speechSynthesis.pause(); setPaused(true); userActionRequiredRef.current = true; }
      } else {
        if (speaking && paused) { window.speechSynthesis.pause(); }
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [speaking, paused]);
  useEffect(() => { return () => { try { window.speechSynthesis.cancel(); } catch {} }; }, []);
  const resetPlayback = () => {
    window.speechSynthesis.cancel(); currentUtterance.current = null; queueRef.current = []; chunkIdxRef.current = 0; setSpeaking(false); setPaused(false); userActionRequiredRef.current = false; setTtsStatus(null);
  };
  const speakChunks = () => {
    const synth = window.speechSynthesis;
    const next = () => {
      if (chunkIdxRef.current >= queueRef.current.length || !speaking) { resetPlayback(); return; }
      const text = queueRef.current[chunkIdxRef.current];
      const utt = new SpeechSynthesisUtterance(text);
      currentUtterance.current = utt;
      if (voiceRef.current) utt.voice = voiceRef.current;
      utt.lang = voiceRef.current?.lang || 'hi-IN';
      utt.rate = rate;
      utt.onend = () => { if (paused || !speaking) return; chunkIdxRef.current++; setTtsStatus(`Playing chunk ${chunkIdxRef.current + 1}/${queueRef.current.length}`); next(); };
      utt.onerror = () => { if (paused || !speaking) return; chunkIdxRef.current++; next(); };
      if (!synth) { resetPlayback(); return; }
      try { synth.speak(utt); } catch { resetPlayback(); }
    };
    setTimeout(next, 50);
  };
  const handlePlayAudio = async () => {
    resetPlayback();
    if (!audioSubject || !audioChapterTitle) { toast({ variant: "destructive", title: "Selection Required", description: "Please select Subject and Chapter." }); return; }
    if (!audioContentSource) { toast({ variant: "destructive", title: "Content Not Found", description: "Could not find audio content for this selection." }); return; }

    setTtsLoading(true);
    setTtsStatus("Preparing audio...");
    let textToSpeak = "";

    try {
      if (audioContentSource.type === 'text') {
        textToSpeak = audioContentSource.content;
      } else {
        setTtsStatus(`Loading text from ${audioContentSource.content}...`);
        const txtResult = await fetchTxtOnly(audioContentSource.content);
        if (!txtResult.ok || !txtResult.text) throw new Error(`Could not load text content for audio from: ${audioContentSource.content}. Make sure the file exists.`);
        textToSpeak = txtResult.text;
      }

      if (!textToSpeak?.trim()) throw new Error("No text content found to speak.");

      if (!voiceRef.current) {
        const voices = await ensureVoicesLoaded();
        voiceRef.current = pickGoogleHindiStrict(voices);
      }
      if (!voiceRef.current && audioLanguage === 'Hindi') { throw new Error("Google हिन्दी (hi-IN) voice unavailable."); }

      const chunks = chunkText(textToSpeak);
      if (chunks.length === 0) throw new Error("No text found after processing.");

      queueRef.current = chunks; chunkIdxRef.current = 0;
      setSpeaking(true); setPaused(false); userActionRequiredRef.current = false;
      setTtsStatus(`Playing chunk 1/${chunks.length}`);
      speakChunks();
    } catch (e: any) {
      setTtsStatus(`Error: ${e?.message || "Failed to start audio."}`);
      toast({ variant: "destructive", title: "Audio Error", description: e?.message || "Failed to start audio." });
      resetPlayback();
    } finally { setTtsLoading(false); }
  };
  const handlePause = () => { if (!speaking || paused) return; window.speechSynthesis.pause(); setPaused(true); userActionRequiredRef.current = true; setTtsStatus("Paused"); };
  const handleResume = () => { if (!speaking || !paused || !userActionRequiredRef.current) return; window.speechSynthesis.resume(); setPaused(false); userActionRequiredRef.current = false; setTtsStatus(`Playing chunk ${chunkIdxRef.current + 1}/${queueRef.current.length}`); };
  const handleStop = () => resetPlayback();

  // --- Render ---
  if (authLoading || isLoadingChapters) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="ml-3 text-sm font-medium text-gray-700"><T>Loading Chapters...</T></p>
      </div>
    );
  }
  if (!user) return <p className="text-center mt-20"><T>Please log in.</T></p>;

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-[#F6F3FF] via-[#F5FAFF] to-[#EEF3FF] text-gray-800 overflow-hidden">
      {/* subtle background accents */}
      <div className="pointer-events-none absolute -top-24 -left-24 w-[28rem] h-[28rem] bg-[#EEE7FF] rounded-full blur-3xl opacity-40" />
      <div className="pointer-events-none absolute bottom-0 right-0 w-[26rem] h-[26rem] bg-[#E0F2FF] rounded-full blur-3xl opacity-40" />

      <div className="relative z-10 p-6 max-w-7xl mx-auto w-full">
        {/* Top bar aligned */}
        <div className="flex items-center justify-between mb-6 gap-3">
          <div className="flex gap-3">
            <Button className="bg-gradient-to-r from-[#9B87F5] to-[#7C6BF2] text-white rounded-xl hover:brightness-110" onClick={() => router.back()}><T>Back</T></Button>
            <Button className="bg-gradient-to-r from-[#6B5BBE] to-[#A1B5FF] text-white rounded-xl hover:brightness-110" onClick={() => router.push('/home')}><T>Home</T></Button>
          </div>
          <div className="text-xs text-gray-600 bg-white/70 border border-gray-200 rounded-md px-2 py-1">
            <T>Class</T>: {studentClassGrade}
          </div>
        </div>

        {/* Title */}
        <h1 className="text-3xl sm:text-5xl font-extrabold text-center text-transparent bg-clip-text bg-gradient-to-r from-[#6B5BBE] via-[#7C6BF2] to-[#A1B5FF] drop-shadow-sm mb-2">
          <T>Start a New Lesson</T>
        </h1>
        <p className="text-center text-sm text-gray-600 mb-8">
          <T>Choose a subject and chapter to read, listen, learn, or test yourself.</T>
        </p>

        {/* Empty State */}
        {combinedSubjects.length === 0 && (
          <div className="text-center py-10 bg-white/70 rounded-2xl shadow border border-amber-200">
            <p className="font-semibold text-amber-800"><T>No Chapters Available</T></p>
            <p className="text-sm text-amber-700 mt-1"><T>Content for your class ({studentClassGrade}) may not be available yet.</T></p>
          </div>
        )}

        {/* --- Main Content Grid (equal heights) --- */}
        {combinedSubjects.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-12 auto-rows-fr">
            {/* --- E-book Section --- */}
            <section className="relative h-full flex flex-col bg-gradient-to-br from-purple-200 via-purple-100 to-purple-50 p-6 sm:p-8 rounded-3xl shadow-lg hover:shadow-2xl transition overflow-hidden lg:col-span-6">
              <div className="flex items-center gap-3">
                <BookText className="h-10 w-10 text-purple-600" />
                <div>
                  <h2 className="text-xl sm:text-2xl font-semibold text-purple-700"><T>E-book</T></h2>
                  <p className="text-xs sm:text-sm text-gray-700"><T>Read the chapter PDF.</T></p>
                </div>
              </div>

              {/* aligned selectors */}
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <Select value={ebookSubject} onValueChange={(v) => { setEbookSubject(v); setEbookChapterTitle(""); setEbookLanguage(""); }}>
                  <SelectTrigger><SelectValue placeholder="Subject" /></SelectTrigger>
                  <SelectContent>{combinedSubjects.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>

                <Select value={ebookChapterTitle} onValueChange={(v) => { setEbookChapterTitle(v); setEbookLanguage(""); }} disabled={!ebookSubject}>
                  <SelectTrigger><SelectValue placeholder={ebookSubject ? "Chapter" : "Select Subject first"} /></SelectTrigger>
                  <SelectContent>{getCombinedChapters(ebookSubject).map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>

                {ebookChapterTitle && !dynamicChapters.some(c => c.subject === ebookSubject && c.chapterTitle === ebookChapterTitle) && (
                  <Select value={ebookLanguage} onValueChange={(v) => setEbookLanguage(v as LangLabel)}>
                    <SelectTrigger><SelectValue placeholder="Language" /></SelectTrigger>
                    <SelectContent>{LANGS.map(lang => <SelectItem key={lang} value={lang}>{lang}</SelectItem>)}</SelectContent>
                  </Select>
                )}
              </div>

              {/* CTA pinned to bottom */}
              <div className="mt-auto pt-3">
                {ebookUrl ? (
                  <a
                    href={ebookUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={onOpenEbook}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-purple-600 text-white text-sm font-medium rounded-xl hover:bg-purple-700 transition"
                  >
                    <FileText className="h-4 w-4" /> <T>Open E-book PDF</T>
                  </a>
                ) : (
                  ebookChapterTitle && (
                    <p className="text-xs text-red-600 mt-1"><T>PDF not available for this selection (choose a language).</T></p>
                  )
                )}
              </div>
            </section>

            {/* --- Audio Book Section --- */}
            <section className="relative h-full flex flex-col bg-gradient-to-br from-emerald-200 via-emerald-100 to-emerald-50 p-6 sm:p-8 rounded-3xl shadow-lg hover:shadow-2xl transition overflow-hidden lg:col-span-6">
              <div className="flex items-center gap-3">
                <PlayCircle className="h-10 w-10 text-emerald-600" />
                <div>
                  <h2 className="text-xl sm:text-2xl font-semibold text-emerald-700"><T>Audio Book</T></h2>
                  <p className="text-xs sm:text-sm text-gray-700"><T>Listen to the chapter read aloud.</T></p>
                </div>
              </div>

              {/* aligned selectors */}
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <Select value={audioSubject} onValueChange={(v) => { setAudioSubject(v); setAudioChapterTitle(""); resetPlayback(); }}>
                  <SelectTrigger><SelectValue placeholder="Subject" /></SelectTrigger>
                  <SelectContent>{combinedSubjects.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>

                <Select value={audioChapterTitle} onValueChange={(v) => { setAudioChapterTitle(v); resetPlayback(); }} disabled={!audioSubject}>
                  <SelectTrigger><SelectValue placeholder={audioSubject ? "Chapter" : "Select Subject first"} /></SelectTrigger>
                  <SelectContent>{getCombinedChapters(audioSubject).map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>

                {audioChapterTitle && (
                  <Select value={audioLanguage} onValueChange={(v) => { setAudioLanguage(v as LangLabel); resetPlayback(); }}>
                    <SelectTrigger><SelectValue placeholder="Language" /></SelectTrigger>
                    <SelectContent>{LANGS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
                  </Select>
                )}
              </div>

              {/* bottom area: controls + status */}
              <div className="mt-auto pt-3">
                {audioChapterTitle && (
                  <div className="mb-3">
                    <Label className="text-xs font-medium text-gray-600">
                      <T>Playback Speed:</T> {rate.toFixed(1)}x
                    </Label>
                    <input
                      type="range"
                      min={0.5}
                      max={1.5}
                      step={0.1}
                      value={rate}
                      onChange={(e) => setRate(parseFloat(e.target.value))}
                      className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-emerald-200 accent-emerald-600"
                    />
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={handlePlayAudio}
                    disabled={ttsLoading || !audioChapterTitle || speaking}
                    className={`text-white shadow-sm transition ${ttsLoading || !audioChapterTitle ? "bg-emerald-300 cursor-not-allowed" : "bg-gradient-to-r from-emerald-500 to-emerald-600 hover:brightness-110"}`}
                  >
                    {ttsLoading ? (<><Loader2 className="h-4 w-4 mr-1 animate-spin" /> <T>Preparing…</T></>) : (<><Volume2 className="h-4 w-4 mr-1" /> <T>Play Audio</T></>)}
                  </Button>
                  <Button size="sm" variant="outline" onClick={handlePause} disabled={!speaking || paused}>⏸ <T>Pause</T></Button>
                  <Button size="sm" variant="outline" onClick={handleResume} disabled={!speaking || !paused}>▶ <T>Resume</T></Button>
                  <Button size="sm" variant="outline" onClick={handleStop} disabled={!speaking}>⏹ <T>Stop</T></Button>
                </div>

                {ttsStatus && <p className="mt-2 text-xs p-2 rounded border bg-blue-50 border-blue-200 text-blue-700">{ttsStatus}</p>}
                <p className="text-xs text-gray-500 mt-2"></p>
              </div>
            </section>

            {/* --- Chapter Explanation Section (full width) --- */}
            <section className="relative h-full flex flex-col bg-gradient-to-br from-pink-200 via-pink-100 to-pink-50 p-6 sm:p-8 rounded-3xl shadow-lg hover:shadow-2xl transition overflow-hidden lg:col-span-12">
              <div className="flex items-center gap-3">
                <MessageCircle className="h-10 w-10 text-pink-600" />
                <div>
                  <h2 className="text-xl sm:text-2xl font-semibold text-pink-700"><T>Chapter Explanation</T></h2>
                  <p className="text-xs sm:text-sm text-gray-700"><T>Read the text content for this chapter.</T></p>
                </div>
              </div>

              {/* aligned selectors */}
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <Select value={explainSubject} onValueChange={(v) => { setExplainSubject(v); setExplainChapterTitle(""); setExplainLanguage(""); }}>
                  <SelectTrigger><SelectValue placeholder="Subject" /></SelectTrigger>
                  <SelectContent>{combinedSubjects.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>

                <Select value={explainChapterTitle} onValueChange={(v) => { setExplainChapterTitle(v); setExplainLanguage(""); }} disabled={!explainSubject}>
                  <SelectTrigger><SelectValue placeholder={explainSubject ? "Chapter" : "Select Subject first"} /></SelectTrigger>
                  <SelectContent>{getCombinedChapters(explainSubject).map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>

                {explainChapterTitle && !dynamicChapters.some(c => c.subject === explainSubject && c.chapterTitle === explainChapterTitle) && (
                  <Select value={explainLanguage} onValueChange={(v) => setExplainLanguage(v as LangLabel)}>
                    <SelectTrigger><SelectValue placeholder="Language" /></SelectTrigger>
                    <SelectContent>{LANGS.map(lang => <SelectItem key={lang} value={lang}>{lang}</SelectItem>)}</SelectContent>
                  </Select>
                )}
              </div>

              {/* content / CTA pinned */}
              <div className="mt-auto pt-3">
                {explanationContentSource ? (
                  explanationContentSource.type === 'text' ? (
                    explanationContentSource.content ? (
                      <ScrollArea className="h-60 w-full rounded-xl border border-pink-200 bg-white/70 p-4">
                        <p className="text-sm whitespace-pre-wrap">{explanationContentSource.content}</p>
                      </ScrollArea>
                    ) : (
                      <p className="text-sm text-orange-700 mt-2 p-3 bg-orange-50 border border-orange-200 rounded-md">
                        <T>No text could be extracted from the PDF for this chapter.</T>
                      </p>
                    )
                  ) : (
                    <a
                      href={explanationContentSource.content}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 mt-2 px-5 py-2.5 bg-pink-600 text-white text-sm font-medium rounded-xl hover:bg-pink-700 transition"
                      onClick={(e) => { e.preventDefault(); writeContentRead({ kind: 'explanation', subject: explainSubject, chapter: explainChapterTitle }); window.open(explanationContentSource.content, '_blank', 'noopener,noreferrer'); }}
                    >
                      <FileText className="h-4 w-4" /> <T>Open Explanation File</T>
                    </a>
                  )
                ) : (
                  explainChapterTitle && <p className="text-xs text-red-600 mt-1"><T>Explanation content not available (choose a language).</T></p>
                )}
              </div>
            </section>

            {/* --- Take a Quiz Section --- */}
            <section className="relative h-full flex flex-col bg-gradient-to-br from-yellow-200 via-yellow-100 to-yellow-50 p-6 sm:p-8 rounded-3xl shadow-lg hover:shadow-2xl transition overflow-hidden lg:col-span-6">
              <div className="flex items-center gap-3">
                <Eye className="h-10 w-10 text-yellow-600" />
                <div>
                  <h2 className="text-xl sm:text-2xl font-semibold text-yellow-700"><T>Take a Quiz</T></h2>
                  <p className="text-xs sm:text-sm text-gray-700"><T>Test your understanding.</T></p>
                </div>
              </div>

              {/* aligned selectors */}
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <Select value={quizSubject} onValueChange={(v) => { setQuizSubject(v); setQuizChapterTitle(""); setQuizLanguage(""); }}>
                  <SelectTrigger><SelectValue placeholder="Subject" /></SelectTrigger>
                  <SelectContent>{combinedSubjects.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>

                <Select value={quizChapterTitle} onValueChange={(v) => { setQuizChapterTitle(v); setQuizLanguage(""); }} disabled={!quizSubject}>
                  <SelectTrigger><SelectValue placeholder={quizSubject ? "Chapter" : "Select Subject first"} /></SelectTrigger>
                  <SelectContent>{getCombinedChapters(quizSubject).map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>

                {quizChapterTitle && (
                  <Select value={quizLanguage} onValueChange={(v) => setQuizLanguage(v as LangLabel)}>
                    <SelectTrigger><SelectValue placeholder="Quiz Language" /></SelectTrigger>
                    <SelectContent>{LANGS.map(lang => <SelectItem key={lang} value={lang}>{lang}</SelectItem>)}</SelectContent>
                  </Select>
                )}
              </div>

              {/* CTA pinned to bottom */}
              <div className="mt-auto pt-3">
                {quizSubject && quizChapterTitle && quizLanguage && (
                  <Button
                    onClick={() => router.push(`/student/quiz?subject=${encodeURIComponent(quizSubject)}&chapter=${encodeURIComponent(quizChapterTitle)}&class=${studentClassGrade}&language=${encodeURIComponent(quizLanguage)}`)}
                    className="px-5 py-2.5 bg-yellow-600 text-white text-sm font-medium rounded-xl hover:bg-yellow-700 transition"
                  >
                    <T>Start Quiz</T>
                  </Button>
                )}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
