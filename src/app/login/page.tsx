"use client";

import { T } from "@/components/T";
import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { Loader2 } from "lucide-react";

function LoginContent() {
  const router = useRouter();
  const params = useSearchParams();
  const redirect = params.get("redirect");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [chosenLang, setChosenLang] = useState<string>("");

  const languageOptions: { label: string; code: string }[] = [
    { label: "English", code: "en" },
    { label: "Hindi", code: "hi" },
    { label: "Marathi", code: "mr" },
    { label: "Tamil", code: "ta" },
    { label: "Punjabi", code: "pa" },
    { label: "Bengali", code: "bn" },
    { label: "Assamese", code: "as" },
  ];

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved =
      localStorage.getItem("selectedLanguage") ||
      localStorage.getItem("appLang") ||
      "";
    if (saved) {
      setChosenLang(saved);
      try {
        window.dispatchEvent(new CustomEvent("languageChange", { detail: saved }));
      } catch {}
    }
  }, []);

  const applyLanguageChoice = (langCode: string) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("appLang", langCode);
      localStorage.setItem("selectedLanguage", langCode);
      try {
        window.dispatchEvent(new CustomEvent("languageChange", { detail: langCode }));
      } catch {}
    }
    setChosenLang(langCode);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const uid = cred.user.uid;
      const snap = await getDoc(doc(db, "users", uid));

      if (!snap.exists()) {
        alert(
          "Login failed: User profile not found. Please contact support or try registering again."
        );
        await auth.signOut();
        setLoading(false);
        return;
      }

      const rawRole = snap.data()?.role;
      const role = String(rawRole ?? "student").trim().toLowerCase();

      if (redirect) {
        router.replace(redirect);
        return;
      }

      if (role === "admin") router.replace("/admin");
      else if (role === "parent") router.replace("/parent");
      else if (role === "teacher") router.replace("/teacher_home");
      else router.replace("/home");
    } catch (err: any) {
      console.error("Login Error:", err.code, err.message);
      if (err.code === "auth/user-not-found" || err.code === "auth/invalid-credential") {
        alert("Email ID not found or password incorrect. Please check or sign up first.");
      } else if (err.code === "auth/wrong-password") {
        alert("Password is incorrect. Please enter the correct password.");
      } else if (err.code === "auth/invalid-email") {
        alert("Invalid email address format.");
      } else {
        alert("Login failed: " + err.message);
      }
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

      {/* Card */}
      <div className="relative z-10 bg-white/90 backdrop-blur-3xl p-8 sm:p-10 rounded-3xl shadow-2xl w-full max-w-md transition-transform transform hover:scale-[1.01]">
        <h1 className="text-center text-4xl font-extrabold text-purple-700 mb-2">
          <T>Login to Vidya Setu</T>
        </h1>
        <p className="text-center text-gray-600 mb-6">
          <T>Welcome back! Please log in to continue your learning journey</T> 🎒
        </p>

        {/* Language first */}
        <div className="mb-6">
          <label className="block font-semibold text-gray-700 mb-2">
            <T>Choose Language</T>
          </label>
          <select
            value={chosenLang}
            onChange={(e) => applyLanguageChoice(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white/70"
          >
            <option value="">
              <T>Select Language</T>
            </option>
            {languageOptions.map((opt) => (
              <option key={opt.code} value={opt.code}>
                {opt.label}
              </option>
            ))}
          </select>
          <p className="mt-2 text-xs text-gray-500">
            <T>Your app will use this language across login, registration and all pages.</T>
          </p>
        </div>

        {chosenLang && (
          <form onSubmit={handleLogin} className="space-y-5">
            <input
              type="email"
              placeholder="Email Address"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white/70"
            />
            <input
              type="password"
              placeholder="Password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white/70"
            />

            <button
              type="submit"
              disabled={loading || resetting}
              className="w-full bg-gradient-to-r from-purple-500 via-pink-500 to-blue-400 text-white py-3 rounded-md font-semibold shadow-md hover:brightness-110 transition-all duration-300 disabled:opacity-60"
            >
              {loading ? (
                <span className="flex justify-center items-center gap-2">
                  <Loader2 className="animate-spin w-5 h-5" />
                  <T>Logging in...</T>
                </span>
              ) : (
                <T>Login</T>
              )}
            </button>
          </form>
        )}

        <p className="mt-8 text-center text-sm text-gray-700">
          <T>Don’t have an account?</T>{" "}
          <a
            href="/registration"
            className="text-purple-700 font-semibold underline hover:text-purple-800"
          >
            <T>Sign up</T>
          </a>
        </p>
      </div>

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

export default function LoginPage() {
  return (
    <Suspense fallback={<LoadingLogin />}>
      <LoginContent />
    </Suspense>
  );
}

function LoadingLogin() {
  return (
    <div className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-[#8ec5fc] via-[#a18cd1] to-[#fbc2eb]">
      <Loader2 className="h-12 w-12 animate-spin text-purple-500" />
    </div>
  );
}