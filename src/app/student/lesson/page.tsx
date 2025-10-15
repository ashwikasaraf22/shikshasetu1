'use client';

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { BookText, PlayCircle, MessageCircle, Eye } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";

// --- PDF.js loader (client-side) ---
function usePdfJs() {
  const pdfjs = useRef<any>(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      // Dynamically import the main PDF.js build
      const mod = await import('pdfjs-dist/build/pdf');
      const pdfjsLib: any = mod;

      // ✅ Load the worker from your local /public folder
      // Copy this file manually once:
      // cp node_modules/pdfjs-dist/build/pdf.worker.min.mjs public/pdf.worker.min.mjs
      pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

      if (mounted) pdfjs.current = pdfjsLib;
    })();

    return () => {
      mounted = false;
    };
  }, []);

  return pdfjs;
}


// --- Utility: chunk text for SpeechSynthesis limits ---
function chunkText(text: string, maxLen = 1800) {
  const sentences = text
    .replace(/\s+/g, ' ')
    .split(/([.?!]|।|\n)/)
    .reduce<string[]>((acc, part, idx, arr) => {
      if (idx % 2 === 0) {
        const end = (arr[idx + 1] || '') as string;
        acc.push((part + end).trim());
      }
      return acc;
    }, [])
    .filter(Boolean);

  const chunks: string[] = [];
  let buf = '';
  for (const s of sentences) {
    if ((buf + ' ' + s).trim().length > maxLen) {
      if (buf) chunks.push(buf.trim());
      if (s.length > maxLen) {
        for (let i = 0; i < s.length; i += maxLen) chunks.push(s.slice(i, i + maxLen));
        buf = '';
      } else {
        buf = s;
      }
    } else {
      buf = (buf + ' ' + s).trim();
    }
  }
  if (buf) chunks.push(buf.trim());
  return chunks;
}

export default function LessonPage() {
  const router = useRouter();

  const { user } = useAuth();
  const studentClass =
    user?.role === "student" ? (user.className as string | undefined) : undefined;
  console.log("studentClass from auth:", studentClass, "role:", user?.role);

  const [ebookSubject, setEbookSubject] = useState("");
  const [ebookChapter, setEbookChapter] = useState("");
  const [ebookLanguage, setEbookLanguage] = useState("");

  const [audioSubject, setAudioSubject] = useState("");
  const [audioChapter, setAudioChapter] = useState("");

  const [explainSubject, setExplainSubject] = useState("");
  const [explainChapter, setExplainChapter] = useState("");

  const [quizSubject, setQuizSubject] = useState("");
  const [quizChapter, setQuizChapter] = useState("");

  const subjects = ["Science", "Maths", "SSC"];
  const chaptersByClass: Record<"7" | "8" | "9", Record<string, string[]>> = {
    "7": {
      Science: ["Air", "Environment and Earth", "Universe"],
      SSC: ["Akhbar", "Birbal", "Shivaji"],
      Maths: ["Numbers", "Equations", "Geometry"],
    },
    "8": {
      Science: ["Animal Tissue", "Plant Tissue", "Pressure"],
      SSC: ["Maharana Pratap", "Maurya Dynasty", "Tanali Rama"],
      Maths: ["Fractions", "Linear Equations", "Area and Volume"],
    },
    "9": {
      Science: ["Is Matter Around Us Pure", "Motion", "Cell Fundamental Unit of Life"],
      Maths: ["Number System", "Polynomials", "Coordinate Geometry"],
      SSC: [
        "French Revolution",
        "India Size and Location",
        "What is Democracy Why Democracy",
        "The Story of Village Palampur",
      ],
    },
  };

  const getClassNumber = (className?: string | null) => {
    if (!className) return "9";
    const m = String(className).match(/\d+/);
    return m ? m[0] : "9";
  };

  const getChaptersFor = (subject: string, className?: string | null) => {
    const cls = getClassNumber(className) as "7" | "8" | "9";
    return chaptersByClass[cls]?.[subject] ?? [];
  };

  const languages = [
    "Hindi",
    "Marathi",
    "Bengali",
    "Tamil",
    "English",
    "Punjabi",
    "Assamese",
  ];

  const getPdfPath = (subject: string, chapter: string, language: string) => {
    if (!subject || !chapter || !language) return null;
    const cleanChapter = chapter.replace(/\s+/g, "");
    return `/pdfs/${subject}/${language}/${cleanChapter}.pdf`;
  };

  const getAudioPath = (subject: string, chapter: string) => {
    if (!subject || !chapter) return null;
    const cleanChapter = chapter.replace(/\s+/g, "");
    return `/audio/${subject}/${cleanChapter}.mp3`;
  };

  const ebookPdf = getPdfPath(ebookSubject, ebookChapter, ebookLanguage);
  const audioUrl = getAudioPath(audioSubject, audioChapter);

  // -----------------------
  // In-browser TTS (SpeechSynthesis) — moved to Audio Book card
  // -----------------------
  const pdfjs = usePdfJs();
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceIndex, setVoiceIndex] = useState<number>(-1);
  const [rate, setRate] = useState<number>(1);
  const [pitch, setPitch] = useState<number>(1);
  const [ttsLoading, setTtsLoading] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState<{ chunk: number; total: number }>({ chunk: 0, total: 0 });

  const currentUtterance = useRef<SpeechSynthesisUtterance | null>(null);
  const queueRef = useRef<string[]>([]);
  const chunkIdxRef = useRef<number>(0);

  useEffect(() => {
    const synth = window.speechSynthesis;
    const load = () => {
      const v = synth.getVoices();
      setVoices(v);
      if (voiceIndex === -1 && v.length) {
        const preferred = v.findIndex((vv) =>
          /-(IN|in)|Hindi|Marathi|Bengali|Tamil|Punjabi|Assamese|हिन्दी|বাংলা|தமிழ்|मराठी|ਪੰਜਾਬੀ/i.test(
            `${vv.name} ${vv.lang}`
          )
        );
        setVoiceIndex(preferred >= 0 ? preferred : 0);
      }
    };
    load();
    if ('onvoiceschanged' in synth) {
      synth.onvoiceschanged = load;
    }
  }, [voiceIndex]);

  const resetPlayback = () => {
    window.speechSynthesis.cancel();
    currentUtterance.current = null;
    queueRef.current = [];
    chunkIdxRef.current = 0;
    setSpeaking(false);
    setPaused(false);
    setProgress({ chunk: 0, total: 0 });
  };

  const extractPdfText = async (pdfUrl: string) => {
    if (!pdfjs.current) throw new Error('PDF engine still loading; try again in a moment.');
    const res = await fetch(pdfUrl);
    if (!res.ok) throw new Error('Unable to load PDF. Check the path & CORS.');
    const buf = await res.arrayBuffer();
    const pdf = await pdfjs.current.getDocument({ data: new Uint8Array(buf) }).promise;
    let all = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const text = content.items.map((it: any) => ('str' in it ? it.str : '')).join(' ');
      all += text + '\n';
    }
    return all.trim();
  };

  const handleSpeakFromAudioSelection = async () => {
    resetPlayback();
    try {
      if (!audioSubject || !audioChapter) {
        alert('Please select a Subject and Chapter in the Audio Book card.');
        return;
      }
      setTtsLoading(true);

      const preferredLang = (user?.language as string) || "English";
      const ttsPdf = getPdfPath(audioSubject, audioChapter, preferredLang);
      if (!ttsPdf) {
        alert('Could not resolve PDF for TTS. Please ensure your user language and chapter exist.');
        return;
      }

      let textToRead = await extractPdfText(ttsPdf);
      if (!textToRead) {
        throw new Error('No selectable text found in PDF (scanned PDFs need OCR).');
      }

      const chunks = chunkText(textToRead);
      queueRef.current = chunks;
      setProgress({ chunk: 0, total: chunks.length });
      setSpeaking(true);

      const synth = window.speechSynthesis;

      const speakNext = () => {
        if (chunkIdxRef.current >= queueRef.current.length) {
          setSpeaking(false);
          setPaused(false);
          return;
        }
        const utter = new SpeechSynthesisUtterance(queueRef.current[chunkIdxRef.current]);
        currentUtterance.current = utter;
        if (voices[voiceIndex]) utter.voice = voices[voiceIndex];
        utter.rate = rate;
        utter.pitch = pitch;

        utter.onend = () => {
          chunkIdxRef.current += 1;
          setProgress({ chunk: chunkIdxRef.current, total: queueRef.current.length });
          speakNext();
        };
        utter.onerror = () => {
          chunkIdxRef.current += 1;
          setProgress({ chunk: chunkIdxRef.current, total: queueRef.current.length });
          speakNext();
        };
        synth.speak(utter);
      };

      speakNext();
    } catch (e: any) {
      console.error(e);
      alert(e?.message || 'Failed to start TTS.');
    } finally {
      setTtsLoading(false);
    }
  };

  const handlePause = () => {
    if (!speaking || paused) return;
    window.speechSynthesis.pause();
    setPaused(true);
  };
  const handleResume = () => {
    if (!speaking || !paused) return;
    window.speechSynthesis.resume();
    setPaused(false);
  };
  const handleStop = () => resetPlayback();

  return (
    <div className="min-h-screen p-6 max-w-6xl mx-auto bg-gradient-to-b from-[#D8EDFF] via-[#EAF4FF] to-[#BFDFFF]">
      <h1 className="text-4xl font-bold mb-10 text-center text-blue-700">
        Start a New Lesson
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
        {/* E-book */}
        <div className="relative bg-gradient-to-br from-purple-200 via-purple-100 to-purple-50 p-8 rounded-3xl shadow-lg hover:shadow-2xl transition overflow-hidden">
          <BookText className="absolute -top-10 -left-10 h-40 w-40 text-purple-300 opacity-40 rotate-12" />
          <BookText className="h-12 w-12 text-purple-600 mb-4" />
          <h2 className="text-2xl font-semibold mb-2 text-purple-700">E-book</h2>
          <p>Read chapters from your subjects at your own pace.</p>

          <div className="mt-4 space-y-3">
            <select
              className="w-full p-3 border rounded-lg"
              value={ebookSubject}
              onChange={(e) => {
                setEbookSubject(e.target.value);
                setEbookChapter("");
                setEbookLanguage("");
              }}
            >
              <option value="">Select Subject</option>
              {subjects.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>

            {ebookSubject && (
              <select
                className="w-full p-3 border rounded-lg"
                value={ebookChapter}
                onChange={(e) => {
                  setEbookChapter(e.target.value);
                  setEbookLanguage("");
                }}
              >
                <option value="">Select Chapter</option>
                {getChaptersFor(ebookSubject, studentClass).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            )}

            {ebookChapter && (
              <select
                className="w-full p-3 border rounded-lg"
                value={ebookLanguage}
                onChange={(e) => setEbookLanguage(e.target.value)}
              >
                <option value="">Select Language</option>
                {["Hindi","Marathi","Bengali","Tamil","English","Punjabi","Assamese"].map((lang) => (
                  <option key={lang} value={lang}>
                    {lang}
                  </option>
                ))}
              </select>
            )}

            {ebookPdf && (
              <div className="flex flex-col sm:flex-row gap-3">
                <a
                  href={ebookPdf}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition text-center"
                >
                  Open E-book PDF
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Audio Book (with Browser TTS) */}
        <div className="relative bg-gradient-to-br from-green-200 via-green-100 to-green-50 p-8 rounded-3xl shadow-lg hover:shadow-2xl transition overflow-hidden">
          <PlayCircle className="absolute -top-10 -right-10 h-40 w-40 text-green-300 opacity-40 rotate-12" />
          <PlayCircle className="h-12 w-12 text-green-600 mb-4" />
          <h2 className="text-2xl font-semibold mb-2 text-green-700">Audio Book</h2>
          <p>Listen to chapters on the go.</p>

          <div className="mt-4 space-y-3">
            <select
              className="w-full p-3 border rounded-lg"
              value={audioSubject}
              onChange={(e) => {
                setAudioSubject(e.target.value);
                setAudioChapter("");
              }}
            >
              <option value="">Select Subject</option>
              {subjects.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>

            {audioSubject && (
              <select
                className="w-full p-3 border rounded-lg"
                value={audioChapter}
                onChange={(e) => setAudioChapter(e.target.value)}
              >
                <option value="">Select Chapter</option>
                {getChaptersFor(audioSubject, studentClass).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            )}

            {audioUrl && (
              <a
                href={audioUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-block px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
              >
                Play Audio
              </a>
            )}

            {/* 🔊 Browser TTS (reads PDF based on audioSubject + audioChapter and user's saved language) */}
            {(audioSubject && audioChapter) && (
              <div className="mt-2">
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={handleSpeakFromAudioSelection}
                    disabled={ttsLoading}
                    className="px-4 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700"
                  >
                    {ttsLoading ? 'Preparing…' : '🔊 Read with Browser TTS'}
                  </button>
                  <button
                    onClick={handlePause}
                    disabled={!speaking || paused}
                    className="px-4 py-2 rounded border"
                  >
                    ⏸ Pause
                  </button>
                  <button
                    onClick={handleResume}
                    disabled={!speaking || !paused}
                    className="px-4 py-2 rounded border"
                  >
                    ▶️ Resume
                  </button>
                  <button
                    onClick={handleStop}
                    disabled={!speaking}
                    className="px-4 py-2 rounded border"
                  >
                    ⏹ Stop
                  </button>
                  {progress.total > 0 && (
                    <span className="text-sm text-gray-700 self-center">
                      Reading {Math.min(progress.chunk + 1, progress.total)} / {progress.total}
                    </span>
                  )}
                </div>

                {/* Voice / Rate / Pitch (kept compact; no layout changes elsewhere) */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">Voice</label>
                    <select
                      className="w-full p-2 border rounded-lg"
                      value={voiceIndex}
                      onChange={(e) => setVoiceIndex(parseInt(e.target.value, 10))}
                    >
                      {voices.length === 0 && <option value={-1}>Loading…</option>}
                      {voices.map((v, i) => (
                        <option key={i} value={i}>
                          {v.name} ({v.lang})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Rate: {rate.toFixed(2)}</label>
                    <input
                      type="range"
                      min={0.5}
                      max={1.5}
                      step={0.05}
                      value={rate}
                      onChange={(e) => setRate(parseFloat(e.target.value))}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Pitch: {pitch.toFixed(2)}</label>
                    <input
                      type="range"
                      min={0.8}
                      max={1.4}
                      step={0.05}
                      value={pitch}
                      onChange={(e) => setPitch(parseFloat(e.target.value))}
                      className="w-full"
                    />
                  </div>
                </div>

                <p className="text-xs text-gray-600 mt-2">
                  Uses your saved language preference (<b>{(user?.language as string) || "English"}</b>) to pick the PDF for TTS.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Chapter Explanation */}
        <div className="relative bg-gradient-to-br from-pink-200 via-pink-100 to-pink-50 p-8 rounded-3xl shadow-lg hover:shadow-2xl transition overflow-hidden">
          <MessageCircle className="absolute -bottom-10 -left-10 h-40 w-40 text-pink-300 opacity-40 rotate-12" />
          <MessageCircle className="h-12 w-12 text-pink-600 mb-4" />
          <h2 className="text-2xl font-semibold mb-2 text-pink-700">Chapter Explanation</h2>
          <p>Get simplified summaries and notes generated by AI.</p>

          <div className="mt-4 space-y-3">
            <select
              className="w-full p-3 border rounded-lg"
              value={explainSubject}
              onChange={(e) => {
                setExplainSubject(e.target.value);
                setExplainChapter("");
              }}
            >
              <option value="">Select Subject</option>
              {subjects.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>

            {explainSubject && (
              <select
                className="w-full p-3 border rounded-lg"
                value={explainChapter}
                onChange={(e) => setExplainChapter(e.target.value)}
              >
                <option value="">Select Chapter</option>
                {getChaptersFor(explainSubject, studentClass).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            )}

            {explainSubject && explainChapter && (
              <a
                href={`/explanations/${explainSubject}/${explainChapter.replace(
                  /\s+/g,
                  ""
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-block px-6 py-3 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition"
              >
                Open Explanation
              </a>
            )}
          </div>
        </div>

        {/* Personalized Quiz */}
        <div className="relative bg-gradient-to-br from-yellow-200 via-yellow-100 to-yellow-50 p-8 rounded-3xl shadow-lg hover:shadow-2xl transition overflow-hidden">
          <Eye className="absolute -bottom-10 -right-10 h-40 w-40 text-yellow-300 opacity-40 rotate-12" />
          <Eye className="h-12 w-12 text-yellow-600 mb-4" />
          <h2 className="text-2xl font-semibold mb-2 text-yellow-700">
            Personalized Quiz
          </h2>
          <p>Test your understanding with AI-generated quizzes.</p>

          <div className="mt-4 space-y-3">
            <select
              className="w-full p-3 border rounded-lg"
              value={quizSubject}
              onChange={(e) => {
                setQuizSubject(e.target.value);
                setQuizChapter("");
              }}
            >
              <option value="">Select Subject</option>
              {subjects.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>

            {quizSubject && (
              <select
                className="w-full p-3 border rounded-lg"
                value={quizChapter}
                onChange={(e) => setQuizChapter(e.target.value)}
              >
                <option value="">Select Chapter</option>
                {getChaptersFor(quizSubject, studentClass).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            )}

            {quizSubject && quizChapter && (
              <button
                onClick={() =>
                  router.push(
                    `/student/quiz?subject=${quizSubject}&chapter=${quizChapter}&level=Easy`
                  )
                }
                className="mt-4 inline-block px-6 py-3 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition"
              >
                Start Quiz
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
