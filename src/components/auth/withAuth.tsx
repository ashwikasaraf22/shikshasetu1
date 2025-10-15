'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthProvider';

export default function withAuth<P>(
  Component: React.ComponentType<P>,
  allowedRoles?: Array<'student' | 'teacher' | 'parent'>
) {
  return function Guard(props: P) {
    const { user, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
      if (!loading) {
        if (!user) {
          // Preserve destination so we can come back after login
          router.replace('/login?redirect=' + encodeURIComponent(window.location.pathname));
          return;
        }
        if (allowedRoles && !allowedRoles.includes(user.role)) {
          // Route by user role if they’re not allowed here
          if (user.role === 'parent') router.replace('/parent');
          else if (user.role === 'teacher') router.replace('/teacher');
          else router.replace('/student');
        }
      }
    }, [loading, user, allowedRoles, router]);

    if (loading) return null;  // or a loading spinner
    if (!user) return null;    // redirecting
    if (allowedRoles && !allowedRoles.includes(user.role)) return null; // redirecting

    return <Component {...props} />;
  };
}
