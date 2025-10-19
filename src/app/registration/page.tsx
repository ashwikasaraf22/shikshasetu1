"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

// 🔗 add firebase imports
import { auth, db } from "@/lib/firebase";
import {
  createUserWithEmailAndPassword,
  updateProfile,
  sendEmailVerification,
} from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

export default function ShikshaSetuRegistration() {
  const router = useRouter();

  const [formData, setFormData] = useState({
    name: "",
    className: "",
    email: "",
    password: "",
    role: "",
    language: "",
    subject: "",
    childName: "",
    childEmail: "",
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // ✅ updated submit handler: Auth (email+password) + Firestore (profile)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      // 1) Create Auth user
      const cred = await createUserWithEmailAndPassword(
        auth,
        formData.email,
        formData.password
      );

      // 2) Optional: set display name (nice for greetings)
      if (formData.name) {
        await updateProfile(cred.user, { displayName: formData.name });
      }

      // 3) Write role-specific profile to Firestore: users/{uid}
      const userRef = doc(db, "users", cred.user.uid);

      const base = {
        role: formData.role.toLowerCase(), // "student" | "teacher" | "Parent"
        email: formData.email,
        language: formData.language,
        createdAt: serverTimestamp(),
      };

      if (formData.role === "student") {
        await setDoc(userRef, {
          ...base,
          fullName: formData.name,
          className: formData.className,
        });
      } else if (formData.role === "teacher") {
        await setDoc(userRef, {
          ...base,
          fullName: formData.name,
          className: formData.className,
          subject: formData.subject,
        });
      } else if (formData.role === "Parent") {
        await setDoc(userRef, {
          ...base,
          name: formData.name,          // Parent's name
          childName: formData.childName,
          childEmail: formData.childEmail,
        });
      }

      // 4) Optional: send verification email (non-blocking)
      try {
        await sendEmailVerification(cred.user);
      } catch {
        // ignore non-critical verification errors
      }

      // 5) (unchanged) keep your original flow
      // Save student info in localStorage (if you still want this)
      localStorage.setItem("user", JSON.stringify(formData));

      // 6) Redirect to your original route
      router.push("/login");
    } catch (err: any) {
      // minimal error surfacing without changing your UI
      const msg =
        err?.code === "auth/email-already-in-use"
          ? "Email already in use"
          : err?.code === "auth/weak-password"
          ? "Weak password (min 6 characters)"
          : err?.message || "Registration failed";
      alert(msg);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-[#EBDDFB] via-[#F3E8FF] to-[#D8D0FF] p-6">
      {/* Decorative blobs */}
      <div className="absolute inset-0 overflow-hidden opacity-40">
        <div className="absolute -top-10 -left-10 w-72 h-72 bg-purple-300 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-indigo-300 rounded-full blur-3xl animate-pulse delay-700"></div>
        <div className="absolute top-1/3 left-1/4 w-80 h-80 bg-pink-200 rounded-full blur-3xl opacity-40 animate-pulse delay-1000"></div>
      </div>

      <div className="relative z-10 bg-white/80 backdrop-blur-xl shadow-2xl rounded-3xl w-full max-w-md p-8 border border-white/40 transition-transform transform hover:scale-[1.02] duration-300 ease-in-out">
        {/* Title */}
        <h1 className="text-4xl font-extrabold text-center text-purple-700 mb-3">
          Shiksha Setu
        </h1>
        <p className="text-center text-gray-500 mb-6">
          Join the bridge to better learning 🌱
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Role selection FIRST */}
          <div>
            <label className="block font-semibold text-gray-700 mb-1">
              Role
            </label>
            <select
              name="role"
              value={formData.role}
              onChange={handleChange}
              required
              className="w-full border border-gray-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white/70"
            >
              <option value="">Select Role</option>
              <option value="student">Student</option>
              <option value="teacher">Teacher</option>
              <option value="Parent">Parent</option>
            </select>
          </div>

          {/* Show name only after role is chosen */}
          {formData.role && (
            <>
              <div>
                <label className="block font-semibold text-gray-700 mb-1">
                  {formData.role === "Parent" ? "Parent's Name" : "Full Name"}
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  className="w-full border border-gray-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white/70 placeholder-gray-400"
                  placeholder={
                    formData.role === "Parent"
                      ? "Enter Parent's full name"
                      : "Enter your full name"
                  }
                />
              </div>
            </>
          )}

          {/* Role-specific sections */}

          {/* Student Form */}
          {formData.role === "student" && (
            <>
              <div>
                <label className="block font-semibold text-gray-700 mb-1">
                  Class
                </label>
                <select
                  name="className"
                  value={formData.className}
                  onChange={handleChange}
                  required
                  className="w-full border border-gray-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white/70"
                >
                  <option value="">Select Class</option>
                  <option value="7th">7th</option>
                  <option value="8th">8th</option>
                  <option value="9th">9th</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">
                  Email ID
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  autoComplete="off"
                  className="w-full border border-gray-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white/70"
                  placeholder="Enter your email"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  autoComplete="new-password"
                  className="w-full border border-gray-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white/70"
                  placeholder="Create a password"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">
                  Language
                </label>
                <select
                  name="language"
                  value={formData.language}
                  onChange={handleChange}
                  required
                  className="w-full border border-gray-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white/70"
                >
                  <option value="">Choose Language</option>
                  <option value="English">English</option>
                  <option value="Hindi">Hindi</option>
                  <option value="Punjabi">Punjabi</option>
                  <option value="Tamil">Tamil</option>
                  <option value="Bengali">Bengali</option>
                  <option value="Assamese">Assamese</option>
                  <option value="Marathi">Marathi</option>
                </select>
              </div>
            </>
          )}

          {/* Teacher Form */}
          {formData.role === "teacher" && (
            <>
              <div>
                <label className="block font-semibold text-gray-700 mb-1">
                  Class
                </label>
                <select
                  name="className"
                  value={formData.className}
                  onChange={handleChange}
                  required
                  className="w-full border border-gray-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white/70"
                >
                  <option value="">Select Class</option>
                  <option value="7th">7th</option>
                  <option value="8th">8th</option>
                  <option value="9th">9th</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">
                  Subject
                </label>
                <select
                  name="subject"
                  value={formData.subject}
                  onChange={handleChange}
                  required
                  className="w-full border border-gray-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white/70"
                >
                  <option value="">Select Subject</option>
                  <option value="Science">Science</option>
                  <option value="SSC">SSC</option>
                  <option value="Maths">Maths</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">
                  Email ID
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  autoComplete="off"
                  className="w-full border border-gray-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white/70"
                  placeholder="Enter your email"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  autoComplete="new-password"
                  className="w-full border border-gray-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white/70"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">
                  Language
                </label>
                <select
                  name="language"
                  value={formData.language}
                  onChange={handleChange}
                  required
                  className="w-full border border-gray-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white/70"
                >
                  <option value="">Choose Language</option>
                  <option value="English">English</option>
                  <option value="Hindi">Hindi</option>
                  <option value="Marathi">Marathi</option>
                  <option value="Bengali">Bengali</option>
                  <option value="Punjabi">Punjabi</option>
                  <option value="Tamil">Tamil</option>
                  <option value="Assamese">Assamese</option>
                </select>
              </div>
            </>
          )}

          {/* Parent Form */}
          {formData.role === "Parent" && (
            <>
              <div>
                <label className="block font-semibold text-gray-700 mb-1">
                  Child's Name
                </label>
                <input
                  type="text"
                  name="childName"
                  value={formData.childName}
                  onChange={handleChange}
                  required
                  className="w-full border border-gray-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white/70"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">
                  Child's Email ID
                </label>
                <input
                  type="email"
                  name="childEmail"
                  value={formData.childEmail}
                  onChange={handleChange}
                  required
                  autoComplete="off"
                  className="w-full border border-gray-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white/70"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">
                  Parent's Email ID
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  autoComplete="off"
                  className="w-full border border-gray-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white/70"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  autoComplete="new-password"
                  className="w-full border border-gray-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white/70"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">
                  Language
                </label>
                <select
                  name="language"
                  value={formData.language}
                  onChange={handleChange}
                  required
                  className="w-full border border-gray-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white/70"
                >
                  <option value="">Choose Language</option>
                  <option value="English">English</option>
                  <option value="Hindi">Hindi</option>
                  <option value="Marathi">Marathi</option>
                  <option value="Bengali">Bengali</option>
                  <option value="Punjabi">Punjabi</option>
                  <option value="Tamil">Tamil</option>
                  <option value="Assamese">Assamese</option>
                </select>
              </div>
            </>
          )}

          {/* Register Button */}
          {formData.role && (
            <button
              type="submit"
              className="w-full bg-gradient-to-r from-purple-500 to-indigo-500 text-white font-semibold rounded-lg py-3 mt-4 shadow-md hover:shadow-lg hover:brightness-110 transition-all duration-300"
            >
              Register
            </button>
          )}
        </form>

        <p className="text-center text-gray-600 text-sm mt-6">
          Already have an account{" "}
          <a
            href="/login"
            className="text-purple-700 font-semibold hover:underline"
          >
            Login
          </a>
        </p>
      </div>
    </div>
  );
}
