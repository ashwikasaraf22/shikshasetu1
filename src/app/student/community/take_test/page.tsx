'use client';

import React, { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, addDoc, doc, getDoc, serverTimestamp, getDocs, query, where } from "firebase/firestore";
import { useAuth } from "@/components/auth/AuthProvider";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type Question = {
  question: string;
  options: string[];
  correctAnswer: string; // full text
};

type Test = {
  id: string;
  title: string;
  description?: string;
  subject: string;
  chapter: string;
  targetClasses: string[];
  questions: Question[];
};

export default function TakeTestPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [tests, setTests] = useState<Test[]>([]);
  const [selectedTest, setSelectedTest] = useState<Test | null>(null);
  const [answers, setAnswers] = useState<{ [key: number]: string }>({});
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState<number | null>(null);

  // We'll keep the final test content used for scoring/review
  const [finalTestData, setFinalTestData] = useState<Test | null>(null);

  // Fetch tests for student's class
  useEffect(() => {
    const fetchTests = async () => {
      if (!user) return;
      try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        let studentClass = "";
        if (userDoc.exists()) {
          const u = userDoc.data() as any;
          studentClass = Array.isArray(u.className) ? u.className[0] : u.className || "";
        }
        if (!studentClass) return;

        const qy = query(
          collection(db, "community_tests"),
          where("targetClasses", "array-contains", studentClass)
        );
        const snapshot = await getDocs(qy);
        const data: Test[] = snapshot.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Test, "id">) }));
        setTests(data);
      } catch (err) {
        console.error("Error fetching tests:", err);
        alert("Error fetching tests. Try again later.");
      }
    };

    fetchTests();
  }, [user]);

  const handleAnswerChange = (index: number, value: string) => {
    setAnswers(prev => ({ ...prev, [index]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedTest) return;

    try {
      setLoading(true);

      // Fetch student info
      const userDoc = await getDoc(doc(db, "users", user.uid));
      let fullName = user.email || "Unknown";
      let studentClass = "-";
      if (userDoc.exists()) {
        const u = userDoc.data() as any;
        fullName = (u.fullName as string) || user.email || "Unknown";
        studentClass = Array.isArray(u.className) ? u.className[0] : u.className || "-";
      }

      // Re-fetch test data to ensure latest (source of truth for correct answers)
      const testDoc = await getDoc(doc(db, "community_tests", selectedTest.id));
      const testData: Test = testDoc.exists()
        ? ({ id: testDoc.id, ...(testDoc.data() as Omit<Test, "id">) } as Test)
        : selectedTest;
      setFinalTestData(testData);

      // Calculate score (compare exact option text with correctAnswer)
      let obtainedScore = 0;
      testData.questions.forEach((q, idx) => {
        const studentAnswer = (answers[idx] ?? "").trim();
        const correctAnswer = (q.correctAnswer ?? "").trim();
        if (studentAnswer && studentAnswer === correctAnswer) {
          obtainedScore++;
        }
      });

      setScore(obtainedScore);

      // Store submission
      await addDoc(collection(db, "community_test_answers"), {
        testId: testData.id,
        studentId: user.uid,
        studentName: fullName,
        studentClass,
        studentEmail: user.email,
        subject: testData.subject,
        chapter: testData.chapter,
        answers,
        score: obtainedScore,
        totalQuestions: testData.questions.length,
        submittedAt: serverTimestamp(),
      });

      setSubmitted(true);
    } catch (err: any) {
      console.error("Error submitting test:", err);
      alert(`❌ Error submitting test: ${err?.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  // Pastel pill for subject/chapter
  const MetaPill = ({ label, value }: { label: string; value: string }) => (
    <span className="inline-flex items-center gap-1 rounded-full bg-white/70 border border-white/60 px-3 py-1 text-xs text-[#4E3FA3]">
      <span className="opacity-70">{label}:</span>
      <span className="font-medium">{value}</span>
    </span>
  );

  if (submitted) {
    const total = finalTestData?.questions.length ?? 0;

    return (
      <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-[#EAF5FF] via-[#F7F3FF] to-[#EFFFF7] text-gray-800">
        {/* Decorative blobs */}
        <div className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-[#E3E0FF] blur-3xl opacity-50" />
        <div className="pointer-events-none absolute -bottom-24 -right-24 h-96 w-96 rounded-full bg-[#DFF7EF] blur-3xl opacity-50" />

        {/* Header */}
        <header className="relative z-10 mx-auto max-w-5xl px-6 pt-8 pb-2 flex items-center justify-between">
          <Button
            type="button"
            onClick={() => router.push('/student/community')}
            className="bg-gradient-to-r from-[#9B87F5] to-[#7C6BF2] text-white rounded-xl hover:brightness-110"
          >
            ← Back
          </Button>
          <div className="w-[84px]" />
        </header>

        {/* Result summary */}
        <main className="relative z-10 mx-auto max-w-4xl px-6 pb-20">
          <div className="mx-auto mb-6 rounded-3xl border border-white/60 bg-white/80 p-6 text-center shadow-2xl backdrop-blur">
            <h2 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-[#6B5BBE] via-[#7C6BF2] to-[#A1B5FF]">
              Test Submitted!
            </h2>
            <p className="mt-2 text-[#4E3FA3]/80">
              🎯 You scored <span className="font-semibold text-[#5A4DA8]">{score}</span> / {total}
            </p>
            {finalTestData && (
              <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                <MetaPill label="Subject" value={finalTestData.subject} />
                <MetaPill label="Chapter" value={finalTestData.chapter} />
              </div>
            )}
          </div>

          {/* Review: Show correct answers */}
          <section className="grid gap-4">
            {finalTestData?.questions.map((q, idx) => {
              const studentAns = answers[idx];
              const correctAns = q.correctAnswer;
              const isCorrect = studentAns === correctAns;

              return (
                <div
                  key={idx}
                  className={`rounded-2xl border p-5 shadow-sm bg-white/90 backdrop-blur ${
                    isCorrect ? 'border-[#CDEDF0]' : 'border-[#FAD9E6]'
                  }`}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="inline-flex items-center rounded-full bg-[#F0E9FF] px-3 py-1 text-xs font-medium text-[#4E3FA3]">
                      Q{idx + 1}
                    </span>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        isCorrect
                          ? 'bg-[#E7FFF7] text-[#2A7B6F]'
                          : 'bg-[#FFEAF1] text-[#8A3B5E]'
                      }`}
                    >
                      {isCorrect ? 'Correct' : 'Incorrect'}
                    </span>
                  </div>

                  <p className="font-medium text-gray-800">{q.question}</p>

                  <div className="mt-3 grid gap-2">
                    <div className="rounded-xl border bg-white px-3 py-2 text-sm">
                      <span className="mr-2 opacity-70">Your answer:</span>
                      <span className={isCorrect ? 'font-semibold text-[#2A7B6F]' : 'font-semibold text-[#8A3B5E]'}>
                        {studentAns ?? '—'}
                      </span>
                    </div>
                    <div className="rounded-xl border bg-white px-3 py-2 text-sm">
                      <span className="mr-2 opacity-70">Correct answer:</span>
                      <span className="font-semibold text-[#234E70]">{correctAns}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </section>

          <div className="mt-8 flex gap-3">
            <Button
              type="button"
              onClick={() => {
                // Reset for another attempt/list
                setSubmitted(false);
                setSelectedTest(null);
                setAnswers({});
                setScore(null);
                setFinalTestData(null);
              }}
              className="bg-gradient-to-r from-[#BDE5D6] to-[#D7F2EA] text-[#1F6E5A] hover:brightness-110 rounded-xl"
            >
              Take another test
            </Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-[#EAF5FF] via-[#F7F3FF] to-[#EFFFF7] text-gray-800">
      {/* Background accents */}
      <div className="pointer-events-none absolute -top-20 -left-24 h-72 w-72 rounded-full bg-[#E3E0FF] blur-3xl opacity-50" />
      <div className="pointer-events-none absolute -bottom-16 -right-16 h-96 w-96 rounded-full bg-[#DFF7EF] blur-3xl opacity-50" />
      <div className="pointer-events-none absolute top-1/2 -left-10 h-40 w-40 rounded-full bg-[#FFEAF1] blur-3xl opacity-40" />

      {/* Header with Back */}
      <header className="relative z-10">
        <div className="mx-auto max-w-5xl px-6 pt-8 pb-2 flex items-center justify-between">
          <Button
            type="button"
            onClick={() => router.push('/student/community')}
            className="bg-gradient-to-r from-[#9B87F5] to-[#7C6BF2] text-white rounded-xl hover:brightness-110"
          >
            ← Back
          </Button>
          <div className="flex-1 text-center">
            <h1 className="text-4xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-[#6B5BBE] via-[#7C6BF2] to-[#A1B5FF]">
              Take a Test
            </h1>
            <p className="mt-2 text-[#5A4DA8]/80">Carefully crafted questions for your class</p>
          </div>
          <div className="w-[84px]" />
        </div>
      </header>

      {/* Main */}
      <main className="relative z-10 mx-auto max-w-5xl px-6 pb-20">
        {!selectedTest ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {tests.length === 0 && (
              <p className="text-gray-500 text-center col-span-full">No tests available for your class.</p>
            )}
            {tests.map(test => (
              <div
                key={test.id}
                className="relative cursor-pointer overflow-hidden rounded-3xl border border-white/60 bg-white/80 p-6 shadow-xl backdrop-blur transition-transform hover:-translate-y-1.5 hover:shadow-2xl"
                onClick={() => setSelectedTest(test)}
              >
                <h2 className="text-xl font-semibold text-[#4E3FA3]">{test.title}</h2>
                {test.description && <p className="mt-1 text-gray-600">{test.description}</p>}
                <div className="mt-3 flex flex-wrap gap-2">
                  <MetaPill label="Subject" value={test.subject} />
                  <MetaPill label="Chapter" value={test.chapter} />
                </div>
                <div className="mt-4">
                  <Button
                    type="button"
                    className="bg-gradient-to-r from-[#9B87F5] to-[#7C6BF2] text-white rounded-xl hover:brightness-110"
                  >
                    Start
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div className="rounded-3xl border border-white/60 bg-white/80 p-6 shadow-xl backdrop-blur">
              <h2 className="text-2xl font-semibold text-[#4E3FA3]">{selectedTest.title}</h2>
              <p className="text-sm text-[#4E3FA3]/70 mt-1">
                Subject: <span className="font-medium">{selectedTest.subject}</span> • Chapter:{" "}
                <span className="font-medium">{selectedTest.chapter}</span>
              </p>
            </div>

            {selectedTest.questions.map((q, idx) => (
              <div key={idx} className="rounded-2xl border bg-white/90 backdrop-blur p-5 shadow-sm">
                <div className="mb-2 flex items-center justify-between">
                  <span className="inline-flex items-center rounded-full bg-[#F0E9FF] px-3 py-1 text-xs font-medium text-[#4E3FA3]">
                    Q{idx + 1}
                  </span>
                </div>

                <p className="font-medium text-gray-800">{q.question}</p>

                <div className="mt-3 grid gap-2">
                  {q.options.map((opt, oIdx) => {
                    const checked = answers[idx] === opt;
                    return (
                      <label
                        key={oIdx}
                        className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border p-3 text-sm transition ${
                          checked ? 'border-[#C7B7FF] bg-[#F7F4FF]' : 'bg-white'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="radio"
                            name={`q-${idx}`}
                            value={opt}
                            checked={checked}
                            onChange={() => handleAnswerChange(idx, opt)}
                            required
                            className="accent-[#7C6BF2]"
                          />
                          <span className="text-gray-800">{opt}</span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}

            <div className="sticky bottom-6 left-0 right-0 mt-8 flex justify-center">
              <Button
                type="submit"
                className="w-full max-w-md bg-gradient-to-r from-[#9B87F5] to-[#7C6BF2] text-white rounded-xl hover:brightness-110"
                disabled={loading}
              >
                {loading ? "Submitting..." : "Submit Test"}
              </Button>
            </div>
          </form>
        )}
      </main>
    </div>
  );
}
