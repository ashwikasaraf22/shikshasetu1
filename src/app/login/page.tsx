"use client";

import React, { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { auth, db } from "@/lib/firebase";               // 🔽 add db
import { doc, getDoc } from "firebase/firestore";        // 🔽 fetch role from Firestore
import { Loader2 } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const redirect = params.get("redirect"); // if guards send ?redirect=/profile, we'll honor it

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);

      // 🔽 NEW: look up role
      const uid = cred.user.uid;
      const snap = await getDoc(doc(db, "users", uid));
      const role =
        (snap.data()?.role as "student" | "teacher" | "parent") || "student";

      // 🔽 Prefer redirect param if present (e.g., /login?redirect=/profile)
      if (redirect) {
        router.replace(redirect);
        return;
      }

      // 🔽 Route by role
      if (role === "parent") router.replace("/parent");
      else if (role === "teacher") router.replace("/teacher");
      else router.replace("/home");
    } catch (err: any) {
      console.error(err);

      if (err.code === "auth/user-not-found") {
        alert("Email ID not found. Please check or sign up first.");
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

  const handleForgotPassword = async () => {
    if (!email) {
      alert("Please enter your email address first.");
      return;
    }
    setResetting(true);
    try {
      await sendPasswordResetEmail(auth, email);
      alert("Password reset email sent! Please check your inbox.");
    } catch (err: any) {
      console.error(err);
      if (err.code === "auth/user-not-found") {
        alert("Email not found. Please check or register first.");
      } else {
        alert("Failed to send reset email: " + err.message);
      }
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-purple-100 via-indigo-100 to-pink-100">
      {/* Soft doodle background shapes */}
      <div className="absolute inset-0 overflow-hidden opacity-30">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 600 600"
          className="absolute -top-20 -left-20 w-96 h-96 text-purple-300"
          fill="currentColor"
        >
          <path d="M300,521.05c90.66,0,170.14-61.38,197.38-147.45,27.9-88.74-2.2-193.62-87.61-245.45C330.47,83,255,80.23,190.89,121.73,126.74,163.25,93,238.08,104.21,309.37c11.32,73.21,51.52,141.86,115.15,180.59C255.41,508.9,277.59,521.05,300,521.05Z" />
        </svg>

        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 600 600"
          className="absolute bottom-0 right-0 w-[28rem] h-[28rem] text-indigo-200"
          fill="currentColor"
        >
          <path d="M300,521.05c90.66,0,170.14-61.38,197.38-147.45,27.9-88.74-2.2-193.62-87.61-245.45C330.47,83,255,80.23,190.89,121.73,126.74,163.25,93,238.08,104.21,309.37c11.32,73.21,51.52,141.86,115.15,180.59C255.41,508.9,277.59,521.05,300,521.05Z" />
        </svg>
      </div>

      {/* Main login card */}
      <div className="relative z-10 bg-white/80 backdrop-blur-md p-10 rounded-2xl shadow-2xl w-full max-w-lg transition-transform transform hover:scale-[1.02]">
        <h1 className="whitespace-nowrap text-3xl sm:text-4xl font-bold text-center text-purple-700 mb-2">
          Login to Shiksha Setu
        </h1>
        <p className="text-center text-gray-500 mb-8">
          Welcome back! Please log in to continue your learning journey ✨
        </p>

        <form onSubmit={handleLogin} className="space-y-5">
          <input
            type="email"
            placeholder="Email Address"
            autoComplete="off"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-400"
          />
          <input
            type="password"
            placeholder="Password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-400"
          />

          {/* Forgot password link */}
          <div className="text-right">
            <button
              type="button"
              onClick={handleForgotPassword}
              disabled={resetting}
              className="text-sm text-purple-700 hover:underline disabled:opacity-60"
            >
              {resetting ? "Sending reset link..." : "Forgot Password?"}
            </button>
          </div>

          <button
            type="submit"
            className="w-full bg-gradient-to-r from-purple-500 to-indigo-500 text-white py-3 rounded-md font-semibold shadow-md hover:shadow-lg hover:brightness-110 transition-all duration-300"
            disabled={loading}
          >
            {loading ? (
              <span className="flex justify-center items-center gap-2">
                <Loader2 className="animate-spin w-5 h-5" />
                Logging in...
              </span>
            ) : (
              "Login"
            )}
          </button>
        </form>

        <p className="mt-8 text-center text-sm text-gray-700">
          Don’t have an account?{" "}
          <a
            href="/registration"
            className="text-purple-700 font-semibold underline hover:text-purple-800"
          >
            Sign up
          </a>
        </p>
      </div>
    </div>
  );
}
