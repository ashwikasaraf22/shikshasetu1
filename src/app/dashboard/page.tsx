"use client";

import Link from "next/link";

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 to-purple-300 flex flex-col items-center p-8">
      {/* Title */}
      <h1 className="text-5xl font-extrabold text-purple-800 text-center mt-4 mb-10">
        Shiksha Setu
      </h1>

      {/* Features Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 w-full max-w-6xl">
        {/* Smart AI Tutor */}
        <div className="bg-white shadow-lg rounded-2xl p-6 hover:shadow-xl transition">
          <h2 className="text-2xl font-bold text-purple-700 mb-3">
            Smart AI Tutor
          </h2>
          <p className="text-gray-700 leading-relaxed">
            Our Smart AI Tutor helps students learn interactively with features like:
          </p>
          <ul className="list-disc list-inside text-gray-700 mt-3">
            <li>Doubt Solving</li>
            <li>Concept Explanations</li>
            <li>Practice Questions</li>
            <li>Study Recommendations</li>
            <li>E-Books</li>
          </ul>
        </div>

        {/* Doubt Solver */}
        <div className="bg-white shadow-lg rounded-2xl p-6 hover:shadow-xl transition">
          <h2 className="text-2xl font-bold text-purple-700 mb-3">
            Doubt Solver
          </h2>
          <p className="text-gray-700 leading-relaxed">
            Students can post their academic doubts and get quick responses from
            peers or AI assistance, ensuring continuous learning without gaps.
          </p>
        </div>

        {/* Parental Control */}
        <div className="bg-white shadow-lg rounded-2xl p-6 hover:shadow-xl transition">
          <h2 className="text-2xl font-bold text-purple-700 mb-3">
            Parental Control
          </h2>
          <p className="text-gray-700 leading-relaxed">
            Parents can monitor their child’s progress, assignments, and performance
            reports to stay informed and supportive in their learning journey.
          </p>
        </div>

        {/* Community Section */}
        <div className="bg-white shadow-lg rounded-2xl p-6 hover:shadow-xl transition md:col-span-2">
          <h2 className="text-2xl font-bold text-purple-700 mb-3">
            Community
          </h2>
          <p className="text-gray-700 leading-relaxed">
            This feature will provide a page for the students to chat with each
            other, and also allow teachers to upload their videos, notes, and
            other learning materials online for everyone to access.
          </p>
        </div>
      </div>

      {/* Get Started Button */}
      <div className="mt-10">
        <Link href="/get-started">
          <button className="bg-purple-700 text-white px-6 py-3 rounded-xl text-lg font-semibold hover:bg-purple-800 transition">
            Get Started
          </button>
        </Link>
      </div>

      {/* Footer */}
      <footer className="mt-16 text-center text-gray-600 text-sm">
        © {new Date().getFullYear()} Shiksha Setu. All rights reserved.
      </footer>
    </div>
  );
}