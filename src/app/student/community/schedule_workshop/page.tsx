"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export default function TeacherWorkshop() {
  const [title, setTitle] = useState("");
  const [about, setAbout] = useState("");
  const [cls, setCls] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [duration, setDuration] = useState("");
  const [language, setLanguage] = useState("");
  const [saved, setSaved] = useState(false);

  const handleSchedule = (e: React.FormEvent) => {
    e.preventDefault();

    // Shape matches what the student page expects
    const data = [
      {
        Title: title,
        Description: about,
        Class: cls,
        Date: date,
        Time: time,
        Duration: duration,
        Language: language,
      },
    ];

    // Create JSON file and trigger download (no libraries)
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "workshops.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    setSaved(true);
  };

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-[#E8D8FF] via-[#F5F0FF] to-[#E3E9FF] text-gray-800 overflow-hidden p-6 flex items-center justify-center">
      {/* doodles */}
      <svg className="absolute -top-10 -left-10 w-64 h-64 opacity-50" viewBox="0 0 200 200" fill="none">
        <path d="M40 120 q60 -40 120 0" stroke="#CBB6FF" strokeWidth="5" fill="none" strokeLinecap="round" />
        <circle cx="60" cy="60" r="10" fill="#E1D4FF" />
      </svg>
      <svg className="absolute bottom-0 right-0 w-[20rem] h-[20rem] opacity-60" viewBox="0 0 200 200" fill="none">
        <path d="M20 150 q40 -30 100 -10 q40 10 60 30" stroke="#B8E2D6" strokeWidth="4" fill="none" />
        <rect x="130" y="120" width="50" height="10" rx="5" fill="#FFD3E2" />
      </svg>

      <form
        onSubmit={handleSchedule}
        className="relative z-10 w-full max-w-lg bg-white/80 backdrop-blur-md p-8 rounded-3xl shadow-2xl"
      >
        <h1 className="text-3xl font-bold text-center mb-6 text-[#6B5BBE]">
          Schedule a Workshop
        </h1>

        <div className="space-y-4">
          <Input
            placeholder="Workshop Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />

          <Textarea
            placeholder="About the Workshop"
            value={about}
            onChange={(e) => setAbout(e.target.value)}
            required
          />

          <select
            className="w-full p-3 border rounded-lg bg-white/80"
            value={cls}
            onChange={(e) => setCls(e.target.value)}
            required
          >
            <option value="">Select Class</option>
            <option>7th</option>
            <option>8th</option>
            <option>9th</option>
          </select>

          <div className="flex gap-4">
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
            <Input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              required
            />
          </div>

          <Input
            placeholder="Duration (e.g. 1 hour)"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            required
          />

          <select
            className="w-full p-3 border rounded-lg bg-white/80"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            required
          >
            <option value="">Select Language</option>
            <option>Hindi</option>
            <option>English</option>
            <option>Punjabi</option>
            <option>Tamil</option>
            <option>Assamese</option>
            <option>Bengali</option>
            <option>Marathi</option>
          </select>

          <Button
            type="submit"
            className="w-full bg-gradient-to-r from-[#9B87F5] to-[#7C6BF2] text-white rounded-lg hover:brightness-110"
          >
            Download workshops.json
          </Button>

          {saved && (
            <p className="text-center text-green-700 font-medium">
              Workshop saved as JSON! Place <code>workshops.json</code> in your <code>/public</code> folder.
            </p>
          )}
        </div>
      </form>
    </div>
  );
}
