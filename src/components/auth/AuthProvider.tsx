'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

type AppUser = {
  uid: string;
  email: string | null;
  role: 'student' | 'teacher' | 'parent';
  name?: string | null;

  // 🔽 added fields so you can gate UI anywhere
  className?: string | null;   // student/teacher class
  subject?: string | null;     // teacher subject (or student if you store)
  language?: string | null;    // student/teacher/parent language
  childUid?: string | null;    // parent → child UID (if you store it)

  // keep your existing field
  studentIds?: string[];
};

type AuthContextType = {
  user: AppUser | null;
  loading: boolean;
};

const AuthContext = createContext<AuthContextType>({ user: null, loading: true });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser: FirebaseUser | null) => {
      if (!fbUser) {
        setUser(null);
        setLoading(false);
        return;
      }
      try {
        const snap = await getDoc(doc(db, 'users', fbUser.uid));
        const data = snap.data() as any | undefined;

        const role = (data?.role?.toLowerCase?.() as AppUser['role']) || 'student';

        setUser({
          uid: fbUser.uid,
          email: fbUser.email,
          role,
          // prefer Firestore name fields; fall back to Auth displayName
          name: (data?.name ?? data?.fullName ?? fbUser.displayName ?? null) as string | null,

          // 🔽 map new fields (use either className or class if that's what you saved)
          className: (data?.className ?? data?.class ?? null) as string | null,
          subject: (data?.subject ?? null) as string | null,
          language: (data?.language ?? null) as string | null,
          childUid: (data?.childUid ?? null) as string | null,

          // keep your existing list safe
          studentIds: Array.isArray(data?.studentIds) ? data.studentIds : [],
        });
      } catch {
        // Fallback if profile missing/unreadable
        setUser({
          uid: fbUser.uid,
          email: fbUser.email,
          role: 'student',
          name: fbUser.displayName ?? null,
          className: null,
          subject: null,
          language: null,
          childUid: null,
          studentIds: [],
        });
      } finally {
        setLoading(false);
      }
    });
    return () => unsub();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>{children}</AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
