"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { getStudentByEmail, linkParentToChild, getChildrenForParent } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { T } from "@/components/T";
import { useTranslation } from "@/context/TranslationContext";

const schema = z.object({
  childEmail: z.string().email("Enter a valid email"),
});
type FormValues = z.infer<typeof schema>;

type PendingChild = {
  uid: string;
  name: string;
  className?: string;
};

// 🌈 Background
function PlayfulBackdrop() {
  return (
    <div className="absolute inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(60%_60%_at_12%_12%,#FFE4E6_0%,transparent_60%),radial-gradient(70%_70%_at_88%_10%,#E0E7FF_0%,transparent_55%),radial-gradient(60%_60%_at_14%_88%,#D1FAE5_0%,transparent_55%),radial-gradient(60%_60%_at_86%_86%,#FEF9C3_0%,transparent_55%)]" />
    </div>
  );
}

export default function AddChildPage() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [pendingChild, setPendingChild] = useState<PendingChild | null>(null);
  const [linking, setLinking] = useState(false);
  const [linkedCount, setLinkedCount] = useState<number>(0);
  const [loadingLinkedCount, setLoadingLinkedCount] = useState(true);

  const router = useRouter();
  const { translate } = useTranslation();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    (async () => {
      if (authLoading) return;
      if (!user) {
        router.replace("/login?redirect=" + encodeURIComponent("/parent/add-child"));
        return;
      }
      setLoadingLinkedCount(true);
      try {
        const kids = await getChildrenForParent(user.uid);
        setLinkedCount(kids.length);
      } finally {
        setLoadingLinkedCount(false);
      }
    })();
  }, [authLoading, user, router]);

  const { register, handleSubmit, formState: { errors }, reset } =
    useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
    const email = values.childEmail.trim().toLowerCase();
    const student = await getStudentByEmail(email);
    if (!student) {
      const msg = await translate("No student found with that email.");
      alert(msg);
      setPendingChild(null);
      return;
    }

    const name =
      (student as any).fullName ||
      (student as any).displayName ||
      student.email ||
      "Student";

    setPendingChild({
      uid: student.uid,
      name,
      className: (student as any).className,
    });
  }

  async function confirmLink() {
    if (!user || !pendingChild) return;
    setLinking(true);
    try {
      await linkParentToChild(user.uid, pendingChild.uid);
      setLinkedCount((c) => (c > 0 ? c : 1));

      const msg = await translate("Child linked successfully!");
      alert(msg);

      const addMoreMsg = await translate("Do you want to add another child?");
      const addMoreConfirm = window.confirm(addMoreMsg);
      if (addMoreConfirm) {
        setPendingChild(null);
        reset({ childEmail: "" });
      } else {
        router.push("/parent/dashboard");
      }
    } finally {
      setLinking(false);
    }
  }

  if (authLoading || !user || loadingLinkedCount) {
    return (
      <div className="p-6 text-center text-slate-700 animate-pulse">
        <T>Loading…</T>
      </div>
    );
  }

  const goToDashboardDisabled = linkedCount === 0;

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center px-4">
      <PlayfulBackdrop />

      <Card className="w-full max-w-md p-6 rounded-3xl bg-white/70 backdrop-blur-md shadow-lg border border-white/60 space-y-4">
        <CardHeader>
          <CardTitle className="text-2xl font-extrabold text-center bg-clip-text text-transparent bg-gradient-to-r from-rose-400 via-indigo-400 to-emerald-400">
            <T>Add Child Details 👨‍👩‍👧</T>
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-6">
          {!pendingChild && (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="childEmail" className="font-medium text-slate-700">
                  <T>Child’s Email</T>
                </Label>
                <Input
                  id="childEmail"
                  placeholder="student@example.com"
                  className="rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-300"
                  {...register("childEmail")}
                />
                {errors.childEmail && (
                  <p className="text-sm text-rose-600">{errors.childEmail.message}</p>
                )}
              </div>
              <Button
                type="submit"
                className="w-full rounded-full bg-gradient-to-r from-rose-400 via-indigo-400 to-emerald-400 text-white font-semibold hover:shadow-md transition"
              >
                <T>Fetch Student ✨</T>
              </Button>
            </form>
          )}

          {pendingChild && (
            <div className="space-y-5 text-center">
              <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-50 via-pink-50 to-emerald-50 border border-white shadow-inner">
                <p className="text-lg font-semibold text-slate-800">
                  {pendingChild.name}
                </p>
                <p className="text-slate-600">
                  <T>Class:</T> {pendingChild.className ?? "—"}
                </p>
              </div>

              <div className="flex justify-center gap-3">
                <Button
                  onClick={confirmLink}
                  disabled={linking}
                  className="rounded-full bg-gradient-to-r from-emerald-400 to-blue-400 text-white font-medium px-6 hover:shadow"
                >
                  {linking ? <T>Linking...</T> : <T>OK</T>}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => setPendingChild(null)}
                  className="rounded-full border border-slate-300 text-slate-700 bg-white hover:bg-slate-50"
                >
                  <T>Change Email</T>
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="mt-6 flex items-center justify-between w-full max-w-md text-sm text-slate-700">
        <p>
          {goToDashboardDisabled ? (
            <T>No child linked yet — link a child to enable the dashboard.</T>
          ) : (
            <T>You have linked child account(s). You can go to the dashboard.</T>
          )}
        </p>
        <Button
          onClick={() => router.push("/parent/dashboard")}
          disabled={goToDashboardDisabled}
          className={`rounded-full px-5 py-2 ${
            goToDashboardDisabled
              ? "bg-slate-200 text-slate-400 cursor-not-allowed"
              : "bg-gradient-to-r from-rose-400 via-indigo-400 to-emerald-400 text-white hover:shadow"
          }`}
        >
          <T>Go to Dashboard</T>
        </Button>
      </div>
    </div>
  );
}
