"use client";

import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, User, signOut } from "firebase/auth";
import { collection, getDocs, query, where, Timestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { getChildrenForParent } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/context/TranslationContext";
import { T } from "@/components/T";

/* ----------------------------------------------------
   🎨 Pastel background (UI-only)
---------------------------------------------------- */
function PlayfulBackdrop() {
  return (
    <div className="absolute inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(60%_60%_at_12%_12%,#FFE4E6_0%,transparent_60%),radial-gradient(70%_70%_at_88%_10%,#E0E7FF_0%,transparent_55%),radial-gradient(60%_60%_at_14%_88%,#D1FAE5_0%,transparent_55%),radial-gradient(60%_60%_at_86%_86%,#FEF9C3_0%,transparent_55%)]" />
    </div>
  );
}

/* ----------------------------------------------------
   🪟 Card wrapper (UI-only)
---------------------------------------------------- */
function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-3xl border border-white/60 bg-white/70 backdrop-blur-xl shadow-[0_10px_30px_rgba(0,0,0,0.06)] p-6 ${className}`}
    >
      {children}
    </div>
  );
}

/* ----------------------------------------------------
   Types and helpers
---------------------------------------------------- */
type ActivityKind = "chapters" | "quizzes" | "teachers" | "workshops" | "videos";
type TimeWindow = 7 | 15 | 30;

type Row = {
  id: string;
  subject?: string;
  chapter?: string;
  className?: string;
  score?: number | string;
  timestamp?: Date | null;
  // for workshops/videos:
  title?: string;
  description?: string;
  timeText?: string;
};

async function getDocsByAnyStudentField(
  coll: string,
  childUid: string,
  fields: string[] = ["studentId", "studentID", "userId", "uid"]
) {
  const rows: { id: string; data: any }[] = [];
  for (const field of fields) {
    const snap = await getDocs(query(collection(db, coll), where(field, "==", childUid)));
    if (!snap.empty) {
      snap.forEach((d) => rows.push({ id: d.id, data: d.data() }));
      break; // use the first field that returns docs
    }
  }
  return rows;
}

function coerceTimestamp(raw: any): Date | null {
  if (!raw) return null;
  if (raw instanceof Timestamp) return raw.toDate();
  if (typeof raw === "number") return new Date(raw);
  if (typeof raw === "string") return new Date(raw);
  if (raw?.toDate && typeof raw.toDate === "function") return raw.toDate();
  return null;
}

/* ----------------------------------------------------
   Firestore fetchers (resilient to field name variants)
---------------------------------------------------- */
async function fetchChaptersRead(childUid: string, since: Date): Promise<Row[]> {
  const docs = await getDocsByAnyStudentField("contentReads", childUid);
  const rows: Row[] = docs
    .map(({ id, data }) => {
      const ts = coerceTimestamp(data.timestamp ?? data.readAt ?? data.createdAt ?? data.updatedAt);
      return {
        id,
        chapter: data.chapter ?? data.chapterName ?? data.title ?? "",
        className: data.class ?? data.className ?? "",
        subject: data.subject ?? "",
        timestamp: ts,
      } as Row;
    })
    .filter((r) => !r.timestamp || r.timestamp >= since); // if no timestamp, keep it
  rows.sort((a, b) => (b.timestamp?.getTime() ?? 0) - (a.timestamp?.getTime() ?? 0));
  return rows;
}

async function fetchQuizAttempts(childUid: string, since: Date): Promise<Row[]> {
  const docs = await getDocsByAnyStudentField("quizAttempts", childUid);
  const rows: Row[] = docs
    .map(({ id, data }) => {
      const ts = coerceTimestamp(data.timestamp ?? data.submittedAt ?? data.createdAt ?? data.updatedAt);
      const score =
        data.score ??
        data.percentage ??
        (typeof data.correctCount === "number" && typeof data.total === "number"
          ? `${data.correctCount}/${data.total}`
          : undefined);
      return {
        id,
        subject: data.subject ?? "",
        chapter: data.chapter ?? "",
        score,
        timestamp: ts,
      } as Row;
    })
    .filter((r) => !r.timestamp || r.timestamp >= since);
  rows.sort((a, b) => (b.timestamp?.getTime() ?? 0) - (a.timestamp?.getTime() ?? 0));
  return rows;
}

async function fetchTeachersTests(childUid: string, since: Date): Promise<Row[]> {
  const docs = await getDocsByAnyStudentField("community_test_answers", childUid);
  const rows: Row[] = docs
    .map(({ id, data }) => {
      const ts = coerceTimestamp(data.timestamp ?? data.submittedAt ?? data.createdAt ?? data.updatedAt);
      const score =
        data.score ??
        data.percentage ??
        (typeof data.correctCount === "number" && typeof data.total === "number"
          ? `${data.correctCount}/${data.total}`
          : undefined);
      return {
        id,
        subject: data.subject ?? "",
        chapter: data.chapter ?? "",
        score,
        timestamp: ts,
      } as Row;
    })
    .filter((r) => !r.timestamp || r.timestamp >= since);
  rows.sort((a, b) => (b.timestamp?.getTime() ?? 0) - (a.timestamp?.getTime() ?? 0));
  return rows;
}

async function fetchWorkshopsForStudent(childUid: string, since: Date): Promise<Row[]> {
  const docs = await getDocsByAnyStudentField("workshop_attended", childUid);
  const rows: Row[] = docs
    .map(({ id, data }) => {
      const ts = coerceTimestamp(
        data.attendedAt ?? data.timestamp ?? data.createdAt ?? data.updatedAt
      );
      return {
        id,
        title: data.Title ?? data.title ?? "",
        description: data.Description ?? data.description ?? "",
        timeText: data.Time ?? data.time ?? "",
        timestamp: ts,
      } as Row;
    })
    .filter((r) => !r.timestamp || r.timestamp >= since);
  rows.sort((a, b) => (b.timestamp?.getTime() ?? 0) - (a.timestamp?.getTime() ?? 0));
  return rows;
}

async function fetchVideoViewsForStudent(childUid: string, since: Date): Promise<Row[]> {
  const docs = await getDocsByAnyStudentField("videoViews", childUid);
  const rows: Row[] = docs
    .map(({ id, data }) => {
      const ts = coerceTimestamp(data.viewedAt ?? data.timestamp ?? data.createdAt ?? data.updatedAt);
      return {
        id,
        title: data.title ?? data.videoTitle ?? "",
        timestamp: ts,
      } as Row;
    })
    .filter((r) => !r.timestamp || r.timestamp >= since);
  rows.sort((a, b) => (b.timestamp?.getTime() ?? 0) - (a.timestamp?.getTime() ?? 0));
  return rows;
}

/* ----------------------------------------------------
   Dispatcher
---------------------------------------------------- */
async function fetchRows(kind: ActivityKind, childUid: string, lookback: TimeWindow) {
  const since = new Date(Date.now() - lookback * 24 * 60 * 60 * 1000);
  switch (kind) {
    case "chapters":
      return fetchChaptersRead(childUid, since);
    case "quizzes":
      return fetchQuizAttempts(childUid, since);
    case "teachers":
      return fetchTeachersTests(childUid, since);
    case "workshops":
      return fetchWorkshopsForStudent(childUid, since);
    case "videos":
      return fetchVideoViewsForStudent(childUid, since);
  }
}

/* ----------------------------------------------------
   Main page
---------------------------------------------------- */
export default function ParentDashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [children, setChildren] = useState<any[]>([]);
  const [childId, setChildId] = useState<string | null>(null);

  const [kind, setKind] = useState<ActivityKind>("chapters");
  const [windowDays, setWindowDays] = useState<TimeWindow>(7);

  const [rows, setRows] = useState<Row[]>([]);
  const [loadingRows, setLoadingRows] = useState(false);

  const router = useRouter();
  const { translate } = useTranslation();

  // Auth
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);

  // Load children
  useEffect(() => {
    (async () => {
      if (authLoading) return;
      if (!user) {
        router.replace("/login?redirect=" + encodeURIComponent("/parent/dashboard"));
        return;
      }
      const kids = await getChildrenForParent(user.uid);
      if (!kids || kids.length === 0) {
        const msg = await translate("No children linked. Redirecting to add-child page.");
        alert(msg);
        router.replace("/parent/add-child");
        return;
      }
      setChildren(kids);
      setChildId((prev) => prev ?? kids[0].uid);
    })();
  }, [authLoading, user, router, translate]);

  // Fetch rows on selection change
  useEffect(() => {
    (async () => {
      if (!childId) return;
      setLoadingRows(true);
      try {
        const data = await fetchRows(kind, childId, windowDays);
        setRows(data ?? []);
      } finally {
        setLoadingRows(false);
      }
    })();
  }, [childId, kind, windowDays]);

  const activeChild = useMemo(
    () => children.find((c) => c.uid === childId),
    [children, childId]
  );

  const handleLogout = async () => {
    await signOut(auth);
    const msg = await translate("Logged out successfully.");
    alert(msg);
    router.replace("/login");
  };

  return (
    <div className="relative min-h-[100vh] text-slate-800">
      <PlayfulBackdrop />

      <div className="mx-auto max-w-6xl px-5 md:px-6 lg:px-8 py-10 space-y-8">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-[28px] md:text-[36px] font-extrabold tracking-tight bg-clip-text text-transparent bg-[linear-gradient(90deg,#fb7185,#a78bfa,#34d399)] drop-shadow-sm">
              {activeChild
                ? `Progress for ${activeChild.fullName ?? activeChild.email ?? ""}`
                : "Progress Dashboard"}
            </h1>
            {activeChild?.className && (
              <p className="text-sm text-slate-600 mt-1">
                <T>Class:</T> <span className="font-medium">{activeChild.className}</span>
              </p>
            )}
          </div>

          <div className="flex items-center gap-3">
            <Button
              onClick={() => router.push("/parent/add-child")}
              className="rounded-full bg-gradient-to-r from-rose-400 via-indigo-400 to-emerald-400 text-white px-5 py-2 shadow hover:shadow-md transition-all"
            >
              <T>➕ Add another child</T>
            </Button>

            <Button
              variant="outline"
              onClick={handleLogout}
              className="rounded-full border-red-300 text-red-600 hover:bg-red-50"
              title="Log out"
            >
              <T>Logout</T>
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <div className="mb-4">
            <h2 className="text-lg font-semibold tracking-tight text-slate-800">
              <T>Filters</T>
            </h2>
            <p className="text-xs text-slate-600 mt-1">
              <T>Pick a child, choose an activity, and set a time window</T>
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Child selector */}
            <div className="flex flex-col">
              <label className="text-xs font-medium text-slate-600 mb-1">
                <T>Child</T>
              </label>
              <select
                className="rounded-2xl border border-slate-200 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-300"
                value={childId ?? ""}
                onChange={(e) => setChildId(e.target.value)}
              >
                {children.map((c) => (
                  <option key={c.uid} value={c.uid}>
                    {(c as any).fullName ?? c.displayName ?? c.email}
                  </option>
                ))}
              </select>
            </div>

            {/* Activity selector */}
            <div className="flex flex-col">
              <label className="text-xs font-medium text-slate-600 mb-1">
                <T>Activity</T>
              </label>
              <select
                className="rounded-2xl border border-slate-200 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-rose-300"
                value={kind}
                onChange={(e) => setKind(e.target.value as ActivityKind)}
              >
                <option value="chapters">📘 <T>Chapters Read</T></option>
                <option value="quizzes">🧠 <T>Quizzes Taken</T></option>
                <option value="teachers">🏫 <T>Teacher’s Test</T></option>
                <option value="workshops">🎉 <T>Workshops Attended</T></option>
                <option value="videos">🎬 <T>Videos Watched</T></option>
              </select>
            </div>

            {/* Time window */}
            <div className="flex flex-col">
              <label className="text-xs font-medium text-slate-600 mb-1">
                <T>Time Range</T>
              </label>
              <select
                className="rounded-2xl border border-slate-200 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                value={windowDays}
                onChange={(e) => setWindowDays(Number(e.target.value) as TimeWindow)}
              >
                <option value={7}><T>Last 7 days</T></option>
                <option value={15}><T>Last 15 days</T></option>
                <option value={30}><T>Last 30 days</T></option>
              </select>
            </div>
          </div>
        </Card>

        {/* Results */}
        <Card>
          <div className="mb-4">
            <h2 className="text-lg font-semibold tracking-tight text-slate-800">
              <T>Results</T>
            </h2>
          </div>

          <div className="mt-2">
            {loadingRows ? (
              <div className="text-center text-slate-600 py-6 animate-pulse">
                <T>Loading records…</T>
              </div>
            ) : rows.length === 0 ? (
              <div className="text-center text-slate-500 py-6">
                <T>No records for this selection.</T>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-white/70 text-slate-700">
                    {kind === "chapters" && (
                      <tr>
                        <th className="py-2 pr-4"><T>Chapter</T></th>
                        <th className="py-2 pr-4"><T>Class</T></th>
                        <th className="py-2 pr-4"><T>Subject</T></th>
                        <th className="py-2 pr-4"><T>Timestamp</T></th>
                      </tr>
                    )}
                    {(kind === "quizzes" || kind === "teachers") && (
                      <tr>
                        <th className="py-2 pr-4"><T>Subject</T></th>
                        <th className="py-2 pr-4"><T>Chapter</T></th>
                        <th className="py-2 pr-4"><T>Score</T></th>
                        <th className="py-2 pr-4"><T>Timestamp</T></th>
                      </tr>
                    )}
                    {kind === "workshops" && (
                      <tr>
                        <th className="py-2 pr-4"><T>Title</T></th>
                        <th className="py-2 pr-4"><T>Time</T></th>
                        <th className="py-2 pr-4"><T>Description</T></th>
                        <th className="py-2 pr-4"><T>Attended At</T></th>
                      </tr>
                    )}
                    {kind === "videos" && (
                      <tr>
                        <th className="py-2 pr-4"><T>Title</T></th>
                        <th className="py-2 pr-4"><T>Viewed At</T></th>
                      </tr>
                    )}
                  </thead>

                  <tbody>
                    {rows.map((r, i) => (
                      <tr
                        key={r.id}
                        className={`border-t border-slate-100 ${
                          i % 2 === 0 ? "bg-pink-50/30" : "bg-emerald-50/30"
                        } hover:bg-indigo-50/50`}
                      >
                        {kind === "chapters" && (
                          <>
                            <td className="py-2 pr-4 font-medium text-slate-800">{r.chapter ?? "-"}</td>
                            <td className="py-2 pr-4 text-slate-700">{r.className ?? "-"}</td>
                            <td className="py-2 pr-4 text-slate-700">{r.subject ?? "-"}</td>
                            <td className="py-2 pr-4 text-slate-600">
                              {r.timestamp ? r.timestamp.toLocaleString() : "-"}
                            </td>
                          </>
                        )}

                        {(kind === "quizzes" || kind === "teachers") && (
                          <>
                            <td className="py-2 pr-4 font-medium text-slate-800">{r.subject ?? "-"}</td>
                            <td className="py-2 pr-4 text-slate-700">{r.chapter ?? "-"}</td>
                            <td className="py-2 pr-4 text-slate-700">{r.score ?? "-"}</td>
                            <td className="py-2 pr-4 text-slate-600">
                              {r.timestamp ? r.timestamp.toLocaleString() : "-"}
                            </td>
                          </>
                        )}

                        {kind === "workshops" && (
                          <>
                            <td className="py-2 pr-4 font-medium text-slate-800">{r.title ?? "-"}</td>
                            <td className="py-2 pr-4 text-slate-700">{r.timeText ?? "-"}</td>
                            <td className="py-2 pr-4 text-slate-700">{r.description ?? "-"}</td>
                            <td className="py-2 pr-4 text-slate-600">
                              {r.timestamp ? r.timestamp.toLocaleString() : "-"}
                            </td>
                          </>
                        )}

                        {kind === "videos" && (
                          <>
                            <td className="py-2 pr-4 font-medium text-slate-800">{r.title ?? "-"}</td>
                            <td className="py-2 pr-4 text-slate-600">
                              {r.timestamp ? r.timestamp.toLocaleString() : "-"}
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
