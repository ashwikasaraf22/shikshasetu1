'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { createQuestionSubmission } from '@/lib/db';

const chapters = {
  Science: ['Is matter around us pure?', 'Motion', 'Cell: Fundamental unit of life'],
  Maths: ['Chapter 1: Numbers', 'Chapter 2: Algebra', 'Chapter 3: Geometry'],
  SSC: ['Chapter 1: History', 'Chapter 2: Geography', 'Chapter 3: Civics'],
};

type Submission = {
  question: string;
  subject: string;
  chapter: string;
  status: 'Answered' | 'Pending';
  teacherReply?: string;
};

export default function AskTeacherPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [teacherSubject, setTeacherSubject] = useState('');
  const [teacherChapter, setTeacherChapter] = useState('');
  const [teacherQuestion, setTeacherQuestion] = useState('');
  const [submittedQuestions, setSubmittedQuestions] = useState<Submission[]>([
    {
      question: 'How does photosynthesis work?',
      subject: 'Science',
      chapter: 'Cell: Fundamental unit of life',
      status: 'Answered',
      teacherReply: 'Photosynthesis converts light energy into chemical energy in plants...',
    },
  ]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!teacherSubject) setTeacherChapter('');
  }, [teacherSubject]);

  if (loading || !user) return <p className="text-center mt-20">Loading...</p>;

  const handleSubmitToTeacher = async () => {
    if (!teacherSubject || !teacherChapter || !teacherQuestion.trim()) {
      alert('Please fill all fields.');
      return;
    }
    try {
      setSaving(true);
      await createQuestionSubmission({
        userId: user.uid,
        subject: teacherSubject,
        chapter: teacherChapter,
        text: teacherQuestion.trim(),
      });

      const newSubmission: Submission = {
        question: teacherQuestion.trim(),
        subject: teacherSubject,
        chapter: teacherChapter,
        status: 'Pending',
      };
      setSubmittedQuestions([newSubmission, ...submittedQuestions]);
      setTeacherQuestion('');
      alert('Your question has been submitted to the teacher.');
    } catch (e: any) {
      alert(e?.message || 'Failed to submit your question.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden text-gray-800">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#F0EBFF] via-[#FFF0F6] to-[#E6F7F3]" />
      <div className="pointer-events-none absolute -top-24 -left-24 h-80 w-80 rounded-full bg-[#D9D1FF] blur-3xl opacity-60" />
      <div className="pointer-events-none absolute -bottom-28 -right-20 h-[26rem] w-[26rem] rounded-full bg-[#FFD6C4] blur-3xl opacity-60" />
      <div className="pointer-events-none absolute top-1/3 left-10 h-40 w-40 rounded-full bg-[#CFF3E8] blur-3xl opacity-60" />

      {/* Doodles */}
      <svg className="pointer-events-none absolute top-8 left-8 w-28 h-28 opacity-90" viewBox="0 0 160 160" fill="none">
        <rect x="30" y="30" width="72" height="12" rx="6" fill="#E1D4FF" />
        <path d="M102 30 L130 20 L123 46 Z" fill="#FFD3E2" />
        <rect x="30" y="52" width="94" height="8" rx="4" fill="#DFF0FF" />
        <rect x="30" y="68" width="64" height="8" rx="4" fill="#E0F4F1" />
      </svg>

      {/* Header + Back */}
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
          Ask Teacher
        </h1>
        <p className="mt-3 text-center text-[#4C409F]/90">Send your doubt to a teacher for a detailed explanation.</p>
      </header>

      {/* Main */}
      <main className="relative z-10 mx-auto max-w-5xl px-6 pb-16">
        <Card className="border-white/70 bg-white/90 backdrop-blur shadow-2xl">
          <CardHeader>
            <CardTitle className="text-[#3F338C]">Submit Your Question</CardTitle>
            <CardDescription>Select your subject and chapter, then describe your doubt clearly.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Selects */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select value={teacherSubject} onValueChange={setTeacherSubject}>
                <SelectTrigger><SelectValue placeholder="Select Subject" /></SelectTrigger>
                <SelectContent>
                  {Object.keys(chapters).map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>

              <Select value={teacherChapter} onValueChange={setTeacherChapter} disabled={!teacherSubject}>
                <SelectTrigger><SelectValue placeholder="Select Chapter" /></SelectTrigger>
                <SelectContent>
                  {teacherSubject && (chapters as any)[teacherSubject].map((c: string) =>
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Textarea */}
            <Textarea
              rows={4}
              placeholder="Type your question for the teacher…"
              value={teacherQuestion}
              onChange={(e) => setTeacherQuestion(e.target.value)}
            />

            {/* Submit */}
            <Button
              onClick={handleSubmitToTeacher}
              disabled={saving}
              className="bg-gradient-to-r from-[#6F5AE8] via-[#7EC8E3] to-[#F7AFC1] text-white hover:brightness-110"
            >
              {saving ? 'Submitting…' : 'Submit to Teacher'}
            </Button>
          </CardContent>
        </Card>

        {/* Previous Questions */}
        <section className="mt-8">
          <h2 className="mb-4 text-xl font-semibold text-[#3F338C]">Previous Questions</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {submittedQuestions.map((q, idx) => (
              <Card key={idx} className="border-white/70 bg-white/90 backdrop-blur shadow-lg">
                <CardContent className="p-4">
                  <p className="font-semibold text-[#3F338C]">{q.question}</p>
                  <p className="mt-1 text-sm text-[#5A4DA8]/80">
                    Subject: {q.subject} • Chapter: {q.chapter} • Status: {q.status}
                  </p>
                  {q.teacherReply && (
                    <div className="mt-3 rounded-xl border border-[#F1EAFE] bg-[#F8F6FF] p-3">
                      <p className="text-sm text-gray-800">
                        <strong>Teacher’s Reply:</strong> {q.teacherReply}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
            {submittedQuestions.length === 0 && (
              <Card className="border-dashed border-[#D5CEFF] bg-white/80">
                <CardContent className="p-6 text-center text-[#4C409F]/70">
                  No questions yet — submit your first doubt above.
                </CardContent>
              </Card>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
