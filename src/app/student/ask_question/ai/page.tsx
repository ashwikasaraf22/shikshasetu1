'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

/**
 * Your exact chapter mapping (by class -> subject -> chapters)
 */
const CLASS_CHAPTERS: Record<'7' | '8' | '9', Record<string, string[]>> = {
  '7': {
    Science: ['Magnets', 'Methods of Seperation', 'Mindful Eating'],
    SSC: ['Family', 'Oceans and Continents', 'Timeline'],
    Maths: ['Data Handling', 'Symmetry', 'Lines and Angles'],
  },
  '8': {
    Science: ['Electricity', 'Life Processes in Plants', 'Life Processes in Animals'],
    SSC: ['Empires', 'Gupta Empire', 'Understanding Markets'],
    Maths: ['Expressions using Letters', 'Fractions', 'Number Play'],
  },
  '9': {
    Science: ['Is Matter Around Us Pure', 'Motion', 'Cell Fundamental Unit of Life'],
    Maths: ['Number System', 'Polynomials', 'Coordinate Geometry'],
    SSC: ['French Revolution', 'India Size and Location', 'What is Democracy Why Democracy', 'The Story of Village Palampur'],
  },
};

const languages = ['English', 'Hindi', 'Marathi', 'Tamil', 'Bengali', 'Assamese', 'Punjabi'];

/** Normalize any class string/array from Auth to '7' | '8' | '9' */
function normalizeClass(value: unknown): '7' | '8' | '9' | null {
  let raw: string | null = null;

  if (!value) return null;
  if (Array.isArray(value)) {
    raw = (value[0] ?? null) as string | null;
  } else if (typeof value === 'string') {
    raw = value;
  } else {
    return null;
  }
  if (!raw) return null;

  // Try to extract a leading number (handles "7th", "9th A", "7", "Class 8", etc.)
  const m = raw.match(/(\d+)/);
  if (!m) return null;

  const n = m[1];
  if (n === '7' || n === '8' || n === '9') return n as '7' | '8' | '9';
  return null;
}

export default function AskAIPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  // Resolve the user's class from AuthProvider (supports string or string[])
  const userClass: '7' | '8' | '9' | null = useMemo(() => {
    const cn = (user as any)?.className;
    return normalizeClass(cn);
  }, [user]);

  // Derive subject->chapters map for this class, with a safe fallback (default to '9')
  const subjectMapForClass: Record<string, string[]> = useMemo(() => {
    if (userClass && CLASS_CHAPTERS[userClass]) return CLASS_CHAPTERS[userClass];
    return CLASS_CHAPTERS['9'];
  }, [userClass]);

  const subjects = useMemo(() => Object.keys(subjectMapForClass), [subjectMapForClass]);

  const [subject, setSubject] = useState<string>('');
  const [chapter, setChapter] = useState<string>('');
  const [language, setLanguage] = useState<string>('English');
  const [question, setQuestion] = useState<string>('');
  const [aiAnswer, setAiAnswer] = useState<string | null>(null);
  const [loadingAI, setLoadingAI] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Reset chapter when subject changes (same as before)
  useEffect(() => {
    if (!subject) setChapter('');
  }, [subject]);

  // Ensure selections remain valid if class/subjects change
  useEffect(() => {
    if (!subject || !subjects.includes(subject)) {
      setSubject('');
      setChapter('');
    } else if (chapter && !subjectMapForClass[subject]?.includes(chapter)) {
      setChapter('');
    }
  }, [userClass, subjects, subject, chapter, subjectMapForClass]);

  if (loading || !user) return <p className="text-center mt-20">Loading...</p>;

  const handleAskAI = async () => {
    if (!subject || !chapter || !question) {
      alert('Please select subject, chapter and type your question.');
      return;
    }
    setLoadingAI(true);
    setAiAnswer(null);
    setAiError(null);
    try {
      const resp = await fetch('/api/ask-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, chapter, language, question }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error || 'Failed to get answer');
      setAiAnswer(data.answer);
    } catch (e: any) {
      setAiError(e?.message || 'Something went wrong while asking AI.');
    } finally {
      setLoadingAI(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden text-gray-800">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#EDE9FF] via-[#FFEAF2] to-[#E7F7F3]" />
      <div className="pointer-events-none absolute -top-24 -left-24 h-80 w-80 rounded-full bg-[#DDD4FF] blur-3xl opacity-60" />
      <div className="pointer-events-none absolute -bottom-28 -right-20 h-[26rem] w-[26rem] rounded-full bg-[#FFDCC7] blur-3xl opacity-60" />
      <div className="pointer-events-none absolute top-1/3 right-8 h-40 w-40 rounded-full bg-[#CFF3E8] blur-3xl opacity-60" />

      {/* Header with Back */}
      <header className="relative z-10 mx-auto max-w-5xl px-6 pt-12 pb-4">
        <div className="mb-4 flex items-center justify-between">
          <Button
            variant="outline"
            onClick={() => router.push('/student/ask_question')}
            className="border-[#D5CEFF] bg-white/80 text-[#4C409F] backdrop-blur"
          >
            ← Back
          </Button>
          <div className="w-[84px]" />
        </div>
        <h1 className="text-center text-4xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-[#6F5AE8] via-[#9B87F5] to-[#59BBD0]">
          Ask AI
        </h1>
        <p className="mt-3 text-center text-[#4C409F]/90">
          {userClass ? `Instant, friendly help for Class ${userClass}.` : 'Instant, friendly help in your language.'}
        </p>
      </header>

      {/* Main */}
      <main className="relative z-10 mx-auto max-w-5xl px-6 pb-16">
        <Card className="border-white/70 bg-white/90 backdrop-blur shadow-2xl">
          <CardHeader>
            <CardTitle className="text-[#3F338C]">Ask AI</CardTitle>
            <CardDescription>
              {userClass
                ? `Select a subject and chapter from Class ${userClass} and ask your question.`
                : 'We could not detect your class. Please set your class in your profile.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Dropdowns */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Select value={subject} onValueChange={setSubject} disabled={!userClass}>
                <SelectTrigger><SelectValue placeholder="Select Subject" /></SelectTrigger>
                <SelectContent>
                  {subjects.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>

              <Select value={chapter} onValueChange={setChapter} disabled={!subject || !userClass}>
                <SelectTrigger><SelectValue placeholder="Select Chapter" /></SelectTrigger>
                <SelectContent>
                  {subject && subjectMapForClass[subject]?.map((c: string) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger><SelectValue placeholder="Select Language" /></SelectTrigger>
                <SelectContent>
                  {languages.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Question */}
            <Textarea
              rows={4}
              placeholder="Type your question... e.g., 'Explain states of matter with examples.'"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
            />

            <Button
              onClick={handleAskAI}
              disabled={loadingAI || !userClass}
              className="bg-gradient-to-r from-[#6F5AE8] via-[#7EC8E3] to-[#F7AFC1] text-white hover:brightness-110"
            >
              {loadingAI ? <><Loader2 className="animate-spin h-4 w-4 mr-2" /> Asking AI...</> : 'Ask AI'}
            </Button>

            {/* Output */}
            {aiError && (
              <Card className="mt-4 bg-red-50 p-4">
                <p className="text-red-700 text-sm">{aiError}</p>
              </Card>
            )}
            {aiAnswer && (
              <Card className="mt-4 bg-gray-100 p-4 whitespace-pre-wrap">
                <p>{aiAnswer}</p>
              </Card>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
