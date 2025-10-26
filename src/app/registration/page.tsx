"use client";

import { T } from "@/components/T";
import React, { useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { Loader2 } from "lucide-react";

function RegistrationContent() {
  const router = useRouter();

  // Role
  const [role, setRole] = useState<"" | "student" | "teacher" | "parent">("");

  // Student state
  const [studentName, setStudentName] = useState("");
  const [studentClass, setStudentClass] = useState("");
  const [studentEmail, setStudentEmail] = useState("");
  const [studentPassword, setStudentPassword] = useState("");

  // Teacher state
  const [teacherName, setTeacherName] = useState("");
  const [teacherClasses, setTeacherClasses] = useState<string[]>([]);
  const [teacherSubject, setTeacherSubject] = useState("");
  const [teacherPhone, setTeacherPhone] = useState("");
  const [teacherEmail, setTeacherEmail] = useState("");
  const [teacherPassword, setTeacherPassword] = useState("");

  // Parent state
  const [parentName, setParentName] = useState("");
  const [childName, setChildName] = useState("");
  const [childEmail, setChildEmail] = useState("");
  const [childClass, setChildClass] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [parentEmail, setParentEmail] = useState("");
  const [parentPassword, setParentPassword] = useState("");

  // Language
  const [chosenLang, setChosenLang] = useState<string>("");

  // UI
  const [loading, setLoading] = useState(false);

  // Constants
  const languageOptions = [
    "English",
    "Hindi",
    "Marathi",
    "Tamil",
    "Punjabi",
    "Bengali",
    "Assamese",
  ];
  const classOptions = ["7th", "8th", "9th"];
  const subjectOptions = ["Science", "Maths", "SSC"];

  // Helpers
  const toggleTeacherClass = (cls: string, checked: boolean) => {
    setTeacherClasses((prev) =>
      checked ? Array.from(new Set([...prev, cls])) : prev.filter((c) => c !== cls)
    );
  };

  const handleRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    // Basic validation per role
    if (!role) {
      alert("Please select a role.");
      return;
    }
    if (!chosenLang) {
      alert("Please choose a language.");
      return;
    }

    try {
      setLoading(true);

      let email = "";
      let password = "";
      let name = "";

      if (role === "student") {
        if (!studentName || !studentClass || !studentEmail || !studentPassword) {
          alert("Please complete all student details.");
          setLoading(false);
          return;
        }
        email = studentEmail;
        password = studentPassword;
        name = studentName;
      }

      if (role === "teacher") {
        if (
          !teacherName ||
          teacherClasses.length === 0 ||
          !teacherSubject ||
          !teacherPhone ||
          !teacherEmail ||
          !teacherPassword
        ) {
          alert("Please complete all teacher details (including at least one class).");
          setLoading(false);
          return;
        }
        email = teacherEmail;
        password = teacherPassword;
        name = teacherName;
      }

      if (role === "parent") {
        if (
          !parentName ||
          !childName ||
          !childEmail ||
          !childClass ||
          !parentPhone ||
          !parentEmail ||
          !parentPassword
        ) {
          alert("Please complete all parent details.");
          setLoading(false);
          return;
        }
        email = parentEmail;
        password = parentPassword;
        name = parentName;
      }

      // Create Auth user
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      const uid = cred.user.uid;

      // Save in Firestore /users
      await setDoc(doc(db, "users", uid), {
        role,
        fullName:
          role === "student"
            ? studentName
            : role === "teacher"
            ? teacherName
            : parentName,
        email,
        language: chosenLang,
        createdAt: serverTimestamp(),
        ...(role === "student" && {
          className: studentClass,
          subject: "",
        }),
        ...(role === "teacher" && {
          className: teacherClasses, // array of selected classes
          subject: teacherSubject,
          phoneNumber: teacherPhone,
        }),
        ...(role === "parent" && {
          childName,
          childEmail,
          className: childClass,
          phoneNumber: parentPhone,
          subject: "",
        }),
      });

      alert("🎉 Registration successful!");
      router.replace("/login");
    } catch (err: any) {
      console.error(err);
      alert("❌ " + (err?.message || "Registration failed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-[#8ec5fc] via-[#a18cd1] to-[#fbc2eb] p-6 overflow-hidden">
      {/* Doodles */}
      <div className="absolute inset-0 overflow-hidden opacity-30 pointer-events-none">
        <img
          src="https://cdn-icons-png.flaticon.com/512/3135/3135755.png"
          className="absolute top-16 left-10 w-28 animate-float"
          alt="student"
        />
        <img
          src="https://cdn-icons-png.flaticon.com/512/1828/1828817.png"
          className="absolute bottom-16 right-10 w-24 animate-float-slow"
          alt="book"
        />
        <img
          src="https://cdn-icons-png.flaticon.com/512/2921/2921222.png"
          className="absolute top-1/2 left-[10%] w-20 animate-float"
          alt="pencil"
        />
        <img
          src="https://cdn-icons-png.flaticon.com/512/3062/3062634.png"
          className="absolute bottom-10 left-1/4 w-28 animate-float-slow"
          alt="globe"
        />
        <img
          src="https://cdn-icons-png.flaticon.com/512/2331/2331942.png"
          className="absolute top-0 right-0 w-32 animate-float-slow"
          alt="doodle"
        />
      </div>

      {/* Main Card */}
      <div className="relative z-10 bg-white/90 backdrop-blur-3xl shadow-2xl rounded-3xl w-full max-w-2xl p-10 border border-white/40 transition-all hover:scale-[1.02] duration-300">
        <h1 className="text-center text-4xl font-extrabold text-purple-700 mb-2">
          Vidya Setu
        </h1>
        <p className="text-center text-gray-600 mb-6">
          <T>Join the bridge to better learning 🌱</T>
        </p>

        {/* Role (Dropdown) */}
        <div className="mb-6">
          <label className="block font-semibold text-gray-700 mb-2">
            <T>Role</T>
          </label>
          <select
            value={role}
            onChange={(e) =>
              setRole(e.target.value as "" | "student" | "teacher" | "parent")
            }
            className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white/90"
          >
            <option value="">
              <T>Select Role</T>
            </option>
            <option value="student">
              <T>Student</T>
            </option>
            <option value="teacher">
              <T>Teacher</T>
            </option>
            <option value="parent">
              <T>Parent</T>
            </option>
          </select>
        </div>

        {/* Forms per role */}
        {role && (
          <form onSubmit={handleRegistration} className="space-y-5">
            {/* ===== STUDENT ===== */}
            {role === "student" && (
              <>
                <label className="block font-semibold text-gray-700">
                  <T>Full Name</T>
                </label>
                <input
                  type="text"
                  placeholder="Enter your full name"
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  required
                  className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white/70"
                />

                <label className="block font-semibold text-gray-700">
                  <T>Class</T>
                </label>
                <select
                  value={studentClass}
                  onChange={(e) => setStudentClass(e.target.value)}
                  required
                  className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white/70"
                >
                  <option value="">
                    <T>Select Class</T>
                  </option>
                  {classOptions.map((cls) => (
                    <option key={cls} value={cls}>
                      {cls}
                    </option>
                  ))}
                </select>

                <label className="block font-semibold text-gray-700">
                  <T>Email ID</T>
                </label>
                <input
                  type="email"
                  placeholder="Enter your email"
                  value={studentEmail}
                  onChange={(e) => setStudentEmail(e.target.value)}
                  required
                  autoComplete="off"
                  className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white/70"
                />

                <label className="block font-semibold text-gray-700">
                  <T>Password</T>
                </label>
                <input
                  type="password"
                  placeholder="Create a password"
                  value={studentPassword}
                  onChange={(e) => setStudentPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white/70"
                />

                <label className="block font-semibold text-gray-700">
                  <T>Language</T>
                </label>
                <select
                  value={chosenLang}
                  onChange={(e) => setChosenLang(e.target.value)}
                  required
                  className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white/70"
                >
                  <option value="">
                    <T>Choose Language</T>
                  </option>
                  {languageOptions.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              </>
            )}

            {/* ===== TEACHER ===== */}
            {role === "teacher" && (
              <>
                <label className="block font-semibold text-gray-700">
                  <T>Full Name</T>
                </label>
                <input
                  type="text"
                  placeholder="Enter your full name"
                  value={teacherName}
                  onChange={(e) => setTeacherName(e.target.value)}
                  required
                  className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white/70"
                />

                <label className="block font-semibold text-gray-700">
                  <T>Classes</T>
                </label>
                <div className="flex items-center gap-6 flex-wrap">
                  {classOptions.map((cls) => (
                    <label key={cls} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        className="w-4 h-4 accent-purple-500"
                        checked={teacherClasses.includes(cls)}
                        onChange={(e) => toggleTeacherClass(cls, e.target.checked)}
                      />
                      <span>{cls}</span>
                    </label>
                  ))}
                </div>

                <label className="block font-semibold text-gray-700">
                  <T>Subject</T>
                </label>
                <select
                  value={teacherSubject}
                  onChange={(e) => setTeacherSubject(e.target.value)}
                  required
                  className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white/70"
                >
                  <option value="">
                    <T>Select Subject</T>
                  </option>
                  {subjectOptions.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>

                <label className="block font-semibold text-gray-700">
                  <T>Phone Number</T>
                </label>
                <input
                  type="tel"
                  placeholder="e.g., 9876543210"
                  value={teacherPhone}
                  onChange={(e) => setTeacherPhone(e.target.value)}
                  required
                  className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white/70"
                />

                <label className="block font-semibold text-gray-700">
                  <T>Email ID</T>
                </label>
                <input
                  type="email"
                  placeholder="Enter your email"
                  value={teacherEmail}
                  onChange={(e) => setTeacherEmail(e.target.value)}
                  required
                  autoComplete="off"
                  className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white/70"
                />

                <label className="block font-semibold text-gray-700">
                  <T>Password</T>
                </label>
                <input
                  type="password"
                  placeholder="Create a password"
                  value={teacherPassword}
                  onChange={(e) => setTeacherPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white/70"
                />

                <label className="block font-semibold text-gray-700">
                  <T>Language</T>
                </label>
                <select
                  value={chosenLang}
                  onChange={(e) => setChosenLang(e.target.value)}
                  required
                  className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white/70"
                >
                  <option value="">
                    <T>Choose Language</T>
                  </option>
                  {languageOptions.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              </>
            )}

            {/* ===== PARENT ===== */}
            {role === "parent" && (
              <>
                <label className="block font-semibold text-gray-700">
                  <T>Parent's Name</T>
                </label>
                <input
                  type="text"
                  placeholder="Enter parent's full name"
                  value={parentName}
                  onChange={(e) => setParentName(e.target.value)}
                  required
                  className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white/70"
                />

                <label className="block font-semibold text-gray-700">
                  <T>Child's Name</T>
                </label>
                <input
                  type="text"
                  placeholder="Enter child's full name"
                  value={childName}
                  onChange={(e) => setChildName(e.target.value)}
                  required
                  className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white/70"
                />

                <label className="block font-semibold text-gray-700">
                  <T>Child's Email</T>
                </label>
                <input
                  type="email"
                  placeholder="Enter child's email"
                  value={childEmail}
                  onChange={(e) => setChildEmail(e.target.value)}
                  required
                  autoComplete="off"
                  className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white/70"
                />

                <label className="block font-semibold text-gray-700">
                  <T>Child's Class</T>
                </label>
                <select
                  value={childClass}
                  onChange={(e) => setChildClass(e.target.value)}
                  required
                  className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white/70"
                >
                  <option value="">
                    <T>Select Class</T>
                  </option>
                  {classOptions.map((cls) => (
                    <option key={cls} value={cls}>
                      {cls}
                    </option>
                  ))}
                </select>

                <label className="block font-semibold text-gray-700">
                  <T>Parent's Phone Number</T>
                </label>
                <input
                  type="tel"
                  placeholder="e.g., 9876543210"
                  value={parentPhone}
                  onChange={(e) => setParentPhone(e.target.value)}
                  required
                  className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white/70"
                />

                <label className="block font-semibold text-gray-700">
                  <T>Parent's Email</T>
                </label>
                <input
                  type="email"
                  placeholder="Enter parent's email"
                  value={parentEmail}
                  onChange={(e) => setParentEmail(e.target.value)}
                  required
                  autoComplete="off"
                  className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white/70"
                />

                <label className="block font-semibold text-gray-700">
                  <T>Password</T>
                </label>
                <input
                  type="password"
                  placeholder="Create a password"
                  value={parentPassword}
                  onChange={(e) => setParentPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white/70"
                />

                <label className="block font-semibold text-gray-700">
                  <T>Language</T>
                </label>
                <select
                  value={chosenLang}
                  onChange={(e) => setChosenLang(e.target.value)}
                  required
                  className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white/70"
                >
                  <option value="">
                    <T>Choose Language</T>
                  </option>
                  {languageOptions.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              </>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-purple-500 via-pink-500 to-blue-400 text-white font-semibold rounded-lg py-3 shadow-md hover:brightness-110 transition-all duration-300 disabled:opacity-60"
            >
              {loading ? (
                <span className="flex justify-center items-center gap-2">
                  <Loader2 className="animate-spin w-5 h-5" /> <T>Registering...</T>
                </span>
              ) : (
                <T>Register</T>
              )}
            </button>
          </form>
        )}

        <p className="text-center text-gray-600 text-sm mt-6">
          <T>Already have an account?</T>{" "}
          <a href="/login" className="text-purple-600 font-semibold hover:underline">
            <T>Login</T>
          </a>
        </p>
      </div>

      {/* Floating Animation */}
      <style jsx>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-15px); }
        }
        .animate-float { animation: float 5s ease-in-out infinite; }
        .animate-float-slow { animation: float 7s ease-in-out infinite; }
      `}</style>
    </div>
  );
}

export default function RegistrationPage() {
  return (
    <Suspense fallback={<LoadingRegistration />}>
      <RegistrationContent />
    </Suspense>
  );
}

function LoadingRegistration() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#8ec5fc] via-[#a18cd1] to-[#fbc2eb]">
      <Loader2 className="h-12 w-12 animate-spin text-purple-500" />
    </div>
  );
}
