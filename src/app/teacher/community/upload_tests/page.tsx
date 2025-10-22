'use client';

import React, { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, addDoc, doc, getDoc, serverTimestamp } from "firebase/firestore";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

type Question = {
  question: string;
  options: string[];
  correctAnswer: string;
};

export default function UploadTests() {
  const { user } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [teacherData, setTeacherData] = useState<any>(null);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    subject: "",
    chapter: "",
    targetClasses: [] as string[], // multiple classes
    questions: [{ question: "", options: ["", "", "", ""], correctAnswer: "" }],
  });

  // Fetch teacher data
  useEffect(() => {
    if (!user?.uid) return;

    const fetchTeacher = async () => {
      try {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const data = userSnap.data() as any;
          if (data.role !== "teacher") {
            alert("❌ Only teachers can upload tests.");
            return;
          }

          // Normalize className to array (purely defensive; UI needs array for mapping)
          const normalizedClasses = Array.isArray(data.className)
            ? data.className
            : (data.className ? [data.className] : []);

          setTeacherData({ ...data, className: normalizedClasses });
          setFormData((prev) => ({ ...prev, subject: data.subject || "" }));
        }
      } catch (err) {
        console.error("Error fetching teacher data:", err);
      }
    };

    fetchTeacher();
  }, [user]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleQuestionChange = (
    index: number,
    field: string,
    value: string,
    optionIndex?: number
  ) => {
    const questions = [...formData.questions];
    if (field === "option" && optionIndex !== undefined) {
      questions[index].options[optionIndex] = value;
    } else {
      (questions[index] as any)[field] = value;
    }
    setFormData((prev) => ({ ...prev, questions }));
  };

  const addQuestion = () => {
    setFormData((prev) => ({
      ...prev,
      questions: [
        ...prev.questions,
        { question: "", options: ["", "", "", ""], correctAnswer: "" },
      ],
    }));
  };

  const handleClassChange = (cls: string, checked: boolean) => {
    if (checked) {
      setFormData((prev) => ({ ...prev, targetClasses: [...prev.targetClasses, cls] }));
    } else {
      setFormData((prev) => ({
        ...prev,
        targetClasses: prev.targetClasses.filter((c) => c !== cls),
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teacherData) return;
    if (!formData.targetClasses.length) return alert("❌ Select at least one class.");

    try {
      setLoading(true);
      await addDoc(collection(db, "community_tests"), {
        ...formData,
        createdBy: user?.uid,
        createdAt: serverTimestamp(),
      });

      alert("✅ Test uploaded successfully!");
      setFormData({
        title: "",
        description: "",
        subject: teacherData.subject || "",
        chapter: "",
        targetClasses: [],
        questions: [{ question: "", options: ["", "", "", ""], correctAnswer: "" }],
      });
    } catch (err: any) {
      console.error(err);
      alert(`❌ Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (!teacherData) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#E6E9FF] via-[#F4F7FF] to-[#EAF5FF]">
      <p className="text-[#4E3FA3] bg-white/70 px-4 py-2 rounded-xl border border-white/60 shadow-sm">Loading teacher data...</p>
    </div>
  );

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-[#ECE7FF] via-[#F6F3FF] to-[#E3F1FF] text-gray-800">
      {/* soft blobs */}
      <div className="pointer-events-none absolute -top-24 -left-24 h-80 w-80 rounded-full bg-[#E3E0FF] blur-3xl opacity-50" />
      <div className="pointer-events-none absolute -bottom-28 -right-20 h-[26rem] w-[26rem] rounded-full bg-[#DFF7EF] blur-3xl opacity-50" />
      <div className="pointer-events-none absolute top-1/3 left-10 h-40 w-40 rounded-full bg-[#FFEAF1] blur-3xl opacity-40" />

      {/* Header bar */}
      <header className="sticky top-0 z-20 backdrop-blur-2xl bg-gradient-to-r from-white/60 via-white/50 to-white/60 border-b border-white/40 shadow-md">
        <div className="relative mx-auto max-w-4xl px-6 py-5 flex items-center justify-between">
          <Button
            type="button"
            onClick={() => router.push('/teacher/community')}
            className="bg-gradient-to-r from-[#9B87F5] to-[#7C6BF2] text-white rounded-xl hover:brightness-110"
          >
            ← Back
          </Button>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-[#6B5BBE] via-[#7C6BF2] to-[#A1B5FF]">
            Create a New MCQ Test
          </h1>
          <div className="w-[92px]" />
        </div>
      </header>

      {/* Content card */}
      <main className="relative z-10 mx-auto max-w-3xl p-6 pb-16">
        <div className="rounded-3xl border border-white/60 bg-white/80 p-6 shadow-2xl backdrop-blur">
          {/* Title / Description */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm text-[#4E3FA3]/80 mb-1">Title</label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleChange}
                required
                className="w-full rounded-xl border border-[#E7E3FF] bg-white/90 p-3 outline-none focus:ring-2 focus:ring-[#C7B7FF]"
              />
            </div>
            <div>
              <label className="block text-sm text-[#4E3FA3]/80 mb-1">Subject</label>
              <input
                type="text"
                value={teacherData.subject || "Loading..."}
                disabled
                className="w-full rounded-xl border border-[#E7E3FF] bg-[#F6F5FF] p-3 text-gray-600 cursor-not-allowed"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm text-[#4E3FA3]/80 mb-1">Description</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                className="w-full rounded-xl border border-[#E7E3FF] bg-white/90 p-3 outline-none focus:ring-2 focus:ring-[#C7B7FF]"
              />
            </div>
          </div>

          {/* Target Classes */}
          <div className="mt-6">
            <label className="block text-sm text-[#4E3FA3]/80 mb-2">Target Classes</label>
            {teacherData.className.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#E7E3FF] bg-white/70 p-3 text-sm text-[#5A4DA8]">
                No classes found on your profile.
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {teacherData.className.map((cls: string) => {
                  const active = formData.targetClasses.includes(cls);
                  return (
                    <label
                      key={cls}
                      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition
                        ${active ? 'bg-[#E7FFF7] text-[#2A7B6F] border-[#C8EFE6]' : 'bg-white text-[#4E3FA3] border-[#E7E3FF]'}`}
                    >
                      <input
                        type="checkbox"
                        checked={active}
                        onChange={(e) => handleClassChange(cls, e.target.checked)}
                        className="accent-[#7C6BF2]"
                      />
                      {cls}
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {/* Chapter */}
          <div className="mt-6">
            <label className="block text-sm text-[#4E3FA3]/80 mb-1">Chapter</label>
            <input
              type="text"
              name="chapter"
              value={formData.chapter}
              onChange={handleChange}
              required
              className="w-full rounded-xl border border-[#E7E3FF] bg-white/90 p-3 outline-none focus:ring-2 focus:ring-[#C7B7FF]"
            />
          </div>

          {/* Questions */}
          <h2 className="mt-8 text-xl font-semibold text-[#4E3FA3]">Questions (MCQ)</h2>
          {formData.questions.map((q, idx) => (
            <div key={idx} className="mt-3 rounded-2xl border bg-white/90 backdrop-blur p-5 shadow-sm">
              <div className="mb-2 flex items-center justify-between">
                <span className="inline-flex items-center rounded-full bg-[#F0E9FF] px-3 py-1 text-xs font-medium text-[#4E3FA3]">
                  Q{idx + 1}
                </span>
              </div>

              <input
                type="text"
                placeholder={`Question ${idx + 1}`}
                value={q.question}
                onChange={(e) => handleQuestionChange(idx, "question", e.target.value)}
                required
                className="w-full rounded-xl border border-[#E7E3FF] bg-white/90 p-3 outline-none focus:ring-2 focus:ring-[#C7B7FF]"
              />

              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                {["A", "B", "C", "D"].map((opt, i) => (
                  <input
                    key={i}
                    type="text"
                    placeholder={`Option ${opt}`}
                    value={q.options[i]}
                    onChange={(e) => handleQuestionChange(idx, "option", e.target.value, i)}
                    required
                    className="w-full rounded-xl border border-[#E7E3FF] bg-white/90 p-3 outline-none focus:ring-2 focus:ring-[#C7B7FF]"
                  />
                ))}
              </div>

              <div className="mt-3">
                <label className="block text-sm text-[#4E3FA3]/80 mb-1">Correct Answer</label>
                <select
                  value={q.correctAnswer}
                  onChange={(e) => handleQuestionChange(idx, "correctAnswer", e.target.value)}
                  required
                  className="w-full rounded-xl border border-[#E7E3FF] bg-white/90 p-3 outline-none focus:ring-2 focus:ring-[#C7B7FF]"
                >
                  <option value="">Select Correct Answer</option>
                  {q.options.map((opt, i) => (
                    <option key={i} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
            </div>
          ))}

          {/* Actions */}
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Button
              type="button"
              onClick={addQuestion}
              className="w-full bg-gradient-to-r from-[#BDE5D6] to-[#D7F2EA] text-[#1F6E5A] hover:brightness-110 rounded-xl"
            >
              ➕ Add Another Question
            </Button>
            <Button
              type="submit"
              disabled={loading}
              onClick={handleSubmit}
              className="w-full bg-gradient-to-r from-[#9B87F5] to-[#7C6BF2] text-white hover:brightness-110 rounded-xl"
            >
              {loading ? "Creating..." : "Create MCQ Test"}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
