"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { getChildrenForParent } from "@/lib/db";
import { useRouter } from "next/navigation";
import { T } from "@/components/T"; // ✅ Translation wrapper
import { useTranslation } from "@/context/TranslationContext"; // ✅ For translated text

export default function ParentEntry() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { translate } = useTranslation();

  // Watch auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Decide where to go
  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login?redirect=" + encodeURIComponent("/parent"));
      return;
    }

    (async () => {
      const kids = await getChildrenForParent(user.uid);
      if (kids.length === 0) {
        const msg = await translate("No linked children found. Redirecting to add child page...");
        alert(msg);
        router.replace("/parent/add-child");
      } else {
        const msg = await translate("Redirecting to parent dashboard...");
        alert(msg);
        router.replace("/parent/dashboard");
      }
    })();
  }, [loading, user, router, translate]);

  return (
    <div className="p-6 text-center text-gray-700">
      <T>Loading Parent Portal...</T>
    </div>
  );
}
