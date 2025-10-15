'use client';
import React, { useEffect, useMemo, useState } from 'react';

type Workshop = {
  Title: string;
  Description: string;
  Class: string;
  Date: string;    // e.g., "2025-10-15"
  Time: string;    // e.g., "10:00"
  Duration: string;
  Language: string;
  // JoinURL?: string; // Optional if you have a link
};

function parseWorkshopStart(w: Workshop): Date | null {
  if (!w.Date || !w.Time) return null;
  // Safe because teacher form uses <input type="date"> and <input type="time">
  const [y, m, d] = w.Date.split('-').map(Number);
  const [hh, mm] = w.Time.split(':').map(Number);
  if (!y || !m || !d || hh === undefined || mm === undefined) return null;
  // Creates date in the user's local timezone (fine for a client app)
  return new Date(y, m - 1, d, hh, mm, 0, 0);
}

function msToShort(mmsecs: number) {
  if (mmsecs <= 0) return 'now';
  const totalSeconds = Math.floor(mmsecs / 1000);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  if (mins >= 60) {
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    return `${hrs}h ${remMins}m`;
  }
  if (mins >= 1) return `${mins}m ${secs}s`;
  return `${secs}s`;
}

export default function StudentWorkshop() {
  const [studentClass, setStudentClass] = useState<string>('');
  const [studentLanguage, setStudentLanguage] = useState<string>('');
  const [workshops, setWorkshops] = useState<Workshop[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState<number>(() => Date.now());

  // Load saved preferences
  useEffect(() => {
    const savedClass = localStorage.getItem('studentClass') || '';
    const savedLang = localStorage.getItem('studentLanguage') || '';
    setStudentClass(savedClass);
    setStudentLanguage(savedLang);
  }, []);

  // Tick every 15s to update join button state / countdowns
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(id);
  }, []);

  // Fetch workshops once both are available
  useEffect(() => {
    if (!studentClass || !studentLanguage) return;

    (async () => {
      try {
        const res = await fetch('/workshops.json', { cache: 'no-store' });
        if (!res.ok) throw new Error('Failed to load workshops.json');
        const data: Workshop[] = await res.json();
        const filtered = (data || []).filter(
          w => w.Class?.trim() === studentClass && w.Language?.trim() === studentLanguage
        );
        setWorkshops(filtered);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [studentClass, studentLanguage]);

  const onChangePrefs = () => {
    localStorage.removeItem('studentClass');
    localStorage.removeItem('studentLanguage');
    setStudentClass('');
    setStudentLanguage('');
  };

  const onJoin = (w: Workshop) => {
    // TODO: Replace with your real join link if available:
    // if (w.JoinURL) window.open(w.JoinURL, '_blank');
    alert(`Joining "${w.Title}"… (wire up your real meeting URL here)`);
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-[#F4F1FF] via-[#F8F6FF] to-[#F1F5FF] text-gray-800">
      {/* Soft animated blobs */}
      <div className="pointer-events-none absolute -top-20 -left-24 h-72 w-72 rounded-full bg-[#EDE9FE] blur-3xl opacity-60 animate-pulse" />
      <div className="pointer-events-none absolute -bottom-16 -right-16 h-96 w-96 rounded-full bg-[#E3F2F1] blur-3xl opacity-60 animate-pulse delay-700" />
      <div className="pointer-events-none absolute top-1/2 -left-10 h-40 w-40 rounded-full bg-[#FCE7F3] blur-3xl opacity-50" />

      {/* Doodle: Minimal laptop */}
      <svg
        className="pointer-events-none absolute top-6 left-6 w-28 h-28 opacity-70"
        viewBox="0 0 160 160"
        fill="none"
        aria-hidden="true"
      >
        <rect x="28" y="32" width="104" height="64" rx="6" fill="#EEE9FF" stroke="#C8B8FF" strokeWidth="2" />
        <rect x="36" y="40" width="88" height="48" rx="4" fill="#F9F7FF" />
        <rect x="20" y="100" width="120" height="18" rx="6" fill="#E0F4F1" stroke="#A7E3D9" strokeWidth="2" />
        <rect x="26" y="104" width="108" height="10" rx="5" fill="#DFF0FF" />
      </svg>

      {/* Header */}
      <header className="relative z-10">
        <div className="mx-auto max-w-6xl px-6 pt-10 pb-4">
          <h1 className="text-center text-4xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-[#7C6BF2] via-[#9B87F5] to-[#A1B5FF] drop-shadow-sm">
            Workshops Hub
          </h1>
          <p className="mt-2 text-center text-[#6B5BBE]/80">
            Curated sessions for your class & language preferences
          </p>
        </div>
      </header>

      {/* Main */}
      <main className="relative z-10 mx-auto max-w-6xl px-6 pb-16">
        {!studentClass || !studentLanguage ? (
          <div className="mx-auto mt-10 max-w-lg rounded-3xl border border-white/60 bg-white/70 p-8 shadow-2xl backdrop-blur-lg">
            <div className="mb-6">
              <h2 className="text-2xl font-semibold text-[#5A4DA8]">Set Your Profile</h2>
              <p className="text-sm text-[#5A4DA8]/70 mt-1">
                Choose your class and preferred language to see relevant workshops.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-[#4E3FA3]">Class</label>
                <select
                  value={studentClass}
                  onChange={(e) => {
                    localStorage.setItem('studentClass', e.target.value);
                    setStudentClass(e.target.value);
                  }}
                  className="w-full rounded-xl border border-[#E7E3FF] bg-white/80 p-3 outline-none focus:ring-2 focus:ring-[#C7B7FF]"
                >
                  <option value="">Select</option>
                  <option>7th</option>
                  <option>8th</option>
                  <option>9th</option>
                </select>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-[#4E3FA3]">Language</label>
                <select
                  value={studentLanguage}
                  onChange={(e) => {
                    localStorage.setItem('studentLanguage', e.target.value);
                    setStudentLanguage(e.target.value);
                  }}
                  className="w-full rounded-xl border border-[#E7E3FF] bg-white/80 p-3 outline-none focus:ring-2 focus:ring-[#C7B7FF]"
                >
                  <option value="">Select</option>
                  <option>Hindi</option>
                  <option>English</option>
                  <option>Punjabi</option>
                  <option>Tamil</option>
                  <option>Assamese</option>
                  <option>Bengali</option>
                  <option>Marathi</option>
                </select>
              </div>
            </div>

            <div className="mt-6 rounded-2xl bg-gradient-to-r from-[#F0E9FF] to-[#FFF1F6] p-4 text-sm text-[#4E3FA3]">
              Your selection is saved in your browser. You can change it anytime.
            </div>
          </div>
        ) : (
          <section className="mt-10">
            {/* Toolbar */}
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-2xl sm:text-3xl font-bold text-[#5A4DA8]">
                  Workshops for {studentClass}{' '}
                  <span className="text-[#5A4DA8]/70">({studentLanguage})</span>
                </h2>
                <p className="text-sm text-[#5A4DA8]/70 mt-1">
                  Discover sessions tailored to your learning journey.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-[#EDE9FE] px-4 py-2 text-sm font-medium text-[#4E3FA3]">
                  {loading ? 'Loading…' : `${workshops.length} found`}
                </span>
                <button
                  onClick={onChangePrefs}
                  className="rounded-xl border border-[#E7E3FF] bg-white px-4 py-2 text-sm font-medium text-[#5A4DA8] hover:shadow-md"
                >
                  Change Preferences
                </button>
              </div>
            </div>

            {/* Loading / Empty / Grid */}
            {loading ? (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-44 animate-pulse rounded-3xl bg-gradient-to-br from-[#EDE9FE] to-[#F5F0FF] opacity-70"
                  />
                ))}
              </div>
            ) : workshops.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-[#E7E3FF] bg-white/70 p-10 text-center backdrop-blur">
                <p className="text-lg font-medium text-[#5A4DA8]">No workshops available right now.</p>
                <p className="mt-1 text-sm text-[#5A4DA8]/70">
                  Check back soon—new sessions are added regularly!
                </p>
              </div>
            ) : (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {workshops.map((w, i) => {
                  const start = parseWorkshopStart(w);
                  const fiveMinBefore = start ? start.getTime() - 5 * 60 * 1000 : null;
                  const msUntil = fiveMinBefore !== null ? fiveMinBefore - now : null;
                  const isJoinActive = fiveMinBefore !== null ? now >= fiveMinBefore : false;

                  return (
                    <article
                      key={`${w.Title}-${i}`}
                      className="group relative overflow-hidden rounded-3xl border border-white/60 bg-white/80 p-6 shadow-xl backdrop-blur transition-transform hover:-translate-y-1.5 hover:shadow-2xl"
                    >
                      {/* Background accents */}
                      <svg className="pointer-events-none absolute -top-4 -right-4 h-24 w-24 opacity-30" viewBox="0 0 100 100" fill="none">
                        <circle cx="70" cy="20" r="10" fill="#D9F4EC" />
                        <path d="M10 50 Q 25 30, 40 50 T 70 50" stroke="#C9B8FF" strokeWidth="3" />
                      </svg>

                      <h3 className="text-xl font-semibold text-[#4E3FA3]">{w.Title}</h3>
                      <p className="mt-1 mb-4 text-sm text-gray-700">{w.Description}</p>

                      {/* Meta grid */}
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="rounded-xl bg-[#F0E9FF] px-3 py-2 text-[#4E3FA3]">
                          <span className="block text-[11px] uppercase tracking-wide opacity-70">Class</span>
                          <span className="font-medium">{w.Class}</span>
                        </div>
                        <div className="rounded-xl bg-[#E7FFF7] px-3 py-2 text-[#2A7B6F]">
                          <span className="block text-[11px] uppercase tracking-wide opacity-70">Language</span>
                          <span className="font-medium">{w.Language}</span>
                        </div>
                        <div className="rounded-xl bg-[#FFF1F6] px-3 py-2 text-[#8A3B5E]">
                          <span className="block text-[11px] uppercase tracking-wide opacity-70">Date</span>
                          <span className="font-medium">{w.Date}</span>
                        </div>
                        <div className="rounded-xl bg-[#E9F3FF] px-3 py-2 text-[#2D5B8A]">
                          <span className="block text-[11px] uppercase tracking-wide opacity-70">Time</span>
                          <span className="font-medium">{w.Time}</span>
                        </div>
                        <div className="col-span-2 rounded-xl bg-[#F6F3FF] px-3 py-2 text-[#4E3FA3]">
                          <span className="block text-[11px] uppercase tracking-wide opacity-70">Duration</span>
                          <span className="font-medium">{w.Duration}</span>
                        </div>
                      </div>

                      {/* Join Area */}
                      <div className="mt-5 flex items-center justify-between">
                        {/* Countdown chip */}
                        {start && fiveMinBefore !== null && !isJoinActive ? (
                          <span className="rounded-full bg-[#EDE9FE] px-3 py-1.5 text-xs font-medium text-[#4E3FA3]">
                            Join opens in {msToShort(msUntil!)}
                          </span>
                        ) : (
                          <span className="rounded-full bg-[#E3F2F1] px-3 py-1.5 text-xs font-medium text-[#2A7B6F]">
                            {start ? 'Join is open' : 'Time TBD'}
                          </span>
                        )}

                        <button
                          onClick={() => onJoin(w)}
                          disabled={!isJoinActive}
                          className={`rounded-xl px-4 py-2 text-sm font-semibold transition
                            ${isJoinActive
                              ? 'bg-gradient-to-r from-[#9B87F5] to-[#7C6BF2] text-white hover:brightness-110 shadow'
                              : 'bg-[#EEE9FF] text-[#8A82B8] cursor-not-allowed'}
                          `}
                          aria-disabled={!isJoinActive}
                          title={!isJoinActive ? 'Available 5 minutes before start' : 'Join workshop'}
                        >
                          Join
                        </button>
                      </div>

                      {/* Decorative bottom ribbon */}
                      <div className="pointer-events-none absolute -bottom-6 -left-10 h-24 w-56 rotate-6 bg-gradient-to-r from-[#EDE9FE] via-[#FDE7C9] to-[#DFF3FF] opacity-40 blur-2xl" />
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </main>

      {/* Doodle: subtle shapes bottom-left */}
      <svg
        className="pointer-events-none absolute bottom-6 left-6 w-32 h-32 opacity-60"
        viewBox="0 0 120 120"
        fill="none"
        aria-hidden="true"
      >
        <path d="M10 80 q30 -20 70 0 q20 10 30 20" stroke="#B8E2D6" strokeWidth="4" strokeLinecap="round" />
        <rect x="70" y="18" width="32" height="10" rx="5" fill="#FFD3E2" />
        <circle cx="28" cy="26" r="8" fill="#E1D4FF" />
      </svg>
    </div>
  );
}
