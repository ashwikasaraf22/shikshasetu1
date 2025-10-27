'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { addStudentMessage } from '@/lib/db';
import { db } from '@/lib/firebase';
import {
  collection,
  query as fq,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  addDoc,
  getDocs,
  doc,
} from 'firebase/firestore';

/**
 * Class-aware chapter source
 */
const chaptersByClass: Record<'7' | '8' | '9', Record<string, string[]>> = {
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
    SSC: [
      'French Revolution',
      'India Size and Location',
      'What is Democracy Why Democracy',
      'The Story of Village Palampur',
    ],
  },
};

export default function AskTeacherPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const userClassRaw = (user as any)?.className ?? (user as any)?.classGrade ?? undefined;
  const resolvedClass = userClassRaw ? userClassRaw.toString()[0] : '9'; // simple class resolve
  const chapters: Record<string, string[]> =
    chaptersByClass[resolvedClass as '7' | '8' | '9'] || chaptersByClass['9'];

  const [teacherSubject, setTeacherSubject] = useState('');
  const [teacherChapter, setTeacherChapter] = useState('');
  const [teacherQuestion, setTeacherQuestion] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState('en');
  const [teachers, setTeachers] = useState<{ id: string; name: string }[]>([]);
  const [selectedTeacher, setSelectedTeacher] = useState('');

  const [submittedQuestions, setSubmittedQuestions] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  // 🔽 Chat / details state
  const [selectedDoubt, setSelectedDoubt] = useState<any | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newFollowup, setNewFollowup] = useState('');
  const [callActive, setCallActive] = useState<boolean>(false);

  // Reset chapter when subject changes
  useEffect(() => {
    if (!teacherSubject) setTeacherChapter('');
  }, [teacherSubject]);

  // Fetch teachers based on selected subject
  useEffect(() => {
    if (!teacherSubject) {
      setTeachers([]);
      setSelectedTeacher('');
      return;
    }

    const fetchTeachers = async () => {
      try {
        const q = fq(
          collection(db, 'users'),
          where('role', '==', 'teacher'),
          where('subject', '==', teacherSubject)
        );
        const snap = await getDocs(q);
        const list = snap.docs.map((d) => ({
          id: d.id,
          name: (d.data() as any)?.fullName || (d.data() as any)?.name || 'Unknown',
        }));
        setTeachers(list);
        setSelectedTeacher('');
      } catch (err) {
        console.error('Error fetching teachers:', err);
        setTeachers([]);
      }
    };
    fetchTeachers();
  }, [teacherSubject]);

  // Fetch student's previous doubts
  useEffect(() => {
    if (!user) return;
    const base = collection(db, 'doubts');
    const qWithSort = fq(base, where('studentId', '==', user.uid), orderBy('createdAt', 'desc'));

    const unsub = onSnapshot(
      qWithSort,
      async (snap) => {
        const items = await Promise.all(
          snap.docs.map(async (d) => {
            const data = d.data() as any;
            let teacherName = '';
            if (data.teacherId) {
              try {
                const tSnap = await getDocs(collection(db, 'users'));
                const teacherData = tSnap.docs.find((td) => td.id === data.teacherId)?.data() as any;
                teacherName = teacherData?.fullName || teacherData?.name || 'Unknown';
              } catch {}
            }
            return {
              id: d.id,
              question: data.text_original || data.text_en || data.text || '',
              subject: data.subject || '',
              chapter: data.chapter || '',
              teacherId: data.teacherId || '',
              teacherName,
              status: data.status || 'Pending',
              language: data.language || 'en',
              createdAt: data.createdAt,
            };
          })
        );
        setSubmittedQuestions(items);
      },
      (err) => console.error(err)
    );

    return () => unsub();
  }, [user]);

  // Messages for selected doubt (chat thread)
  useEffect(() => {
    if (!selectedDoubt) return;
    const ref = collection(db, 'doubts', selectedDoubt.id, 'messages');
    const q = fq(ref, orderBy('timestamp', 'asc'));
    const unsub = onSnapshot(
      q,
      (snap) => setMessages(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }))),
      (err) => console.error('onSnapshot(messages) error:', err)
    );
    return () => unsub();
  }, [selectedDoubt]);

  // Listen for callActive on the doubt doc
  useEffect(() => {
    if (!selectedDoubt?.id) {
      setCallActive(false);
      return;
    }
    const dref = doc(db, 'doubts', selectedDoubt.id);
    const unsub = onSnapshot(
      dref,
      (snap) => {
        const data = snap.data() as any;
        setCallActive(!!data?.callActive);
      },
      (err) => console.error('onSnapshot(doubt doc) error:', err)
    );
    return () => unsub();
  }, [selectedDoubt?.id]);

  const handleSubmitToTeacher = async () => {
    if (!teacherSubject || !teacherChapter || !teacherQuestion.trim() || !selectedTeacher)
      return alert('Please fill all fields and select a teacher.');
    try {
      setSaving(true);
      await addDoc(collection(db, 'doubts'), {
        studentId: user!.uid,
        teacherId: selectedTeacher,
        subject: teacherSubject,
        classGrade: resolvedClass,
        chapter: teacherChapter,
        text_original: teacherQuestion.trim(),
        language: selectedLanguage,
        status: 'Pending',
        createdAt: serverTimestamp(),
        lastUpdatedAt: serverTimestamp(),
        callActive: false,
      });
      setTeacherQuestion('');
      setSelectedTeacher('');
      alert('Your question has been submitted!');
    } catch (e: any) {
      alert(e?.message || 'Submission failed.');
    } finally {
      setSaving(false);
    }
  };

  const openDoubtDetails = (d: any) => {
    setSelectedDoubt(d);
    setNewFollowup('');
  };

  const handleSendFollowup = async () => {
    if (!selectedDoubt || !newFollowup.trim()) return;
    try {
      await addStudentMessage({
        doubtId: selectedDoubt.id,
        studentId: user!.uid,
        text: newFollowup.trim(),
        language: selectedDoubt.language || selectedLanguage,
      });
      setNewFollowup('');
    } catch (e: any) {
      alert(e?.message || 'Failed to send your message.');
    }
  };

  if (loading || !user) return <p className="text-center mt-20">Loading...</p>;

  return (
    <div className="relative min-h-screen text-gray-800 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#EDE9FF] via-[#FFEAF2] to-[#E7F7F3]" />
      <div className="absolute -top-24 -left-24 h-80 w-80 rounded-full bg-[#DDD4FF] blur-3xl opacity-60" />
      <div className="absolute -bottom-28 -right-20 h-[26rem] w-[26rem] rounded-full bg-[#FFDCC7] blur-3xl opacity-60" />
      <div className="absolute top-1/3 right-8 h-40 w-40 rounded-full bg-[#CFF3E8] blur-3xl opacity-60" />

      {/* Header */}
      <header className="relative z-10 mx-auto max-w-5xl px-6 pt-12 pb-6 text-center">
        <h1 className="text-4xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-[#6F5AE8] via-[#9B87F5] to-[#59BBD0]">
          Ask Teacher
        </h1>
        <p className="mt-2 text-[#4C409F]/90">
          Submit your questions to a teacher for personalized guidance.
        </p>
      </header>

      <main className="relative z-10 mx-auto max-w-5xl px-6 pb-16 space-y-8">
        {/* ======= LIST / SUBMIT VIEW ======= */}
        {!selectedDoubt && (
          <>
            {/* Submit Question Card */}
            <Card className="bg-white/90 backdrop-blur shadow-2xl border-white/70">
              <CardHeader>
                <CardTitle className="text-[#3F338C]">Submit Your Question</CardTitle>
                <CardDescription>
                  Select your subject, chapter, teacher, and describe your doubt.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Select value={teacherSubject} onValueChange={setTeacherSubject}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select Subject" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.keys(chapters).map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select
                    value={teacherChapter}
                    onValueChange={setTeacherChapter}
                    disabled={!teacherSubject}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Chapter" />
                    </SelectTrigger>
                    <SelectContent>
                      {teacherSubject &&
                        chapters[teacherSubject]?.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>

                  <Select
                    value={selectedTeacher}
                    onValueChange={setSelectedTeacher}
                    disabled={teachers.length === 0}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Teacher" />
                    </SelectTrigger>
                    <SelectContent>
                      {teachers.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select Language" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="hi">Hindi</SelectItem>
                      <SelectItem value="bn">Bengali</SelectItem>
                      <SelectItem value="pa">Punjabi</SelectItem>
                      <SelectItem value="ta">Tamil</SelectItem>
                      <SelectItem value="as">Assamese</SelectItem>
                      <SelectItem value="mr">Marathi</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Textarea
                  rows={4}
                  placeholder="Type your question…"
                  value={teacherQuestion}
                  onChange={(e) => setTeacherQuestion(e.target.value)}
                />

                <Button
                  onClick={handleSubmitToTeacher}
                  disabled={saving}
                  className="bg-gradient-to-r from-[#6F5AE8] via-[#7EC8E3] to-[#F7AFC1] text-white hover:brightness-110"
                >
                  {saving ? 'Submitting…' : 'Submit to Teacher'}
                </Button>
              </CardContent>
            </Card>

            {/* Previous Questions with View Details */}
            <section className="mt-8">
              <h2 className="mb-4 text-xl font-semibold text-[#3F338C]">Previous Questions</h2>
              <div className="grid gap-4 md:grid-cols-2">
                {submittedQuestions.map((q) => (
                  <Card key={q.id} className="border-white/70 bg-white/90 backdrop-blur shadow-lg">
                    <CardContent className="p-4">
                      <p className="font-semibold text-[#3F338C]">{q.question}</p>
                      <p className="mt-1 text-sm text-[#5A4DA8]/80">
                        Subject: {q.subject} • Chapter: {q.chapter} • Teacher:{' '}
                        {q.teacherName || 'Unknown'} • Status: {q.status}
                      </p>
                      <div className="mt-3">
                        <Button
                          variant="outline"
                          className="border-[#D5CEFF] text-[#4C409F]"
                          onClick={() => openDoubtDetails(q)}
                        >
                          View Details
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {submittedQuestions.length === 0 && (
                  <Card className="border-dashed border-[#D5CEFF] bg-white/80">
                    <CardContent className="p-6 text-center text-[#4C409F]/70">
                      No questions submitted yet.
                    </CardContent>
                  </Card>
                )}
              </div>
            </section>
          </>
        )}

        {/* ======= CHAT / DETAILS VIEW ======= */}
        {selectedDoubt && (
          <div className="relative max-w-3xl mx-auto bg-white/90 backdrop-blur-md border border-purple-200 rounded-2xl shadow-2xl p-6 mt-6">
            <Button
              variant="outline"
              onClick={() => setSelectedDoubt(null)}
              className="mb-4 border-purple-300 text-purple-700 hover:bg-purple-50"
            >
              ← Back to Questions
            </Button>

            <h2 className="text-2xl font-bold text-purple-800 mb-2">
              {selectedDoubt.chapter} ({selectedDoubt.subject})
            </h2>
            <p className="text-gray-700 mb-4">Your Doubt: {selectedDoubt.question}</p>

            {/* Call strip */}
            <div className="mb-4 flex items-center justify-between rounded-xl border p-3 bg-purple-50">
              <span className="text-sm text-purple-800">
                {callActive
                  ? 'Teacher has started a call for this doubt.'
                  : 'Waiting for teacher to start the call…'}
              </span>
              <Button
                onClick={() => router.push(`/call/${selectedDoubt.id}`)}
                disabled={!callActive}
                className={
                  callActive
                    ? 'bg-gradient-to-r from-[#9B87F5] to-[#7C6BF2] text-white hover:brightness-110'
                    : 'bg-[#EEE9FF] text-[#8A82B8] cursor-not-allowed'
                }
              >
                Join Call
              </Button>
            </div>

            {/* Conversation */}
            <div className="h-80 overflow-y-auto border border-purple-100 rounded-xl p-4 bg-purple-50/50 mb-4">
              {messages.length === 0 && (
                <p className="text-center text-gray-500">
                  No messages yet. Start the discussion!
                </p>
              )}
              {messages.map((msg) => {
                const isStudent = msg.senderRole === 'student';
                const mainText =
                  msg.text_original || msg.text_en || msg.text || ''; // legacy 'text' supported
                const showEnglish = !!msg.text_en && !isStudent;
                return (
                  <div
                    key={msg.id}
                    className={`my-2 flex ${isStudent ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`p-3 rounded-2xl max-w-xs ${
                        isStudent
                          ? 'bg-purple-300 text-white'
                          : 'bg-white border border-purple-100 text-gray-800'
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap break-words">{mainText}</p>
                      {showEnglish && (
                        <p className="text-[11px] mt-1 opacity-70">EN: {msg.text_en}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Follow-up input */}
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={newFollowup}
                onChange={(e) => setNewFollowup(e.target.value)}
                placeholder="Type your message…"
                className="flex-1 border border-purple-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-400"
              />
              <Button onClick={handleSendFollowup} className="bg-purple-600 hover:bg-purple-700 text-white">
                Send
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
