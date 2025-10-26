'use client';

import { T } from '@/components/T'; // Added Import
import { useState, useEffect } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import AppHeader from '@/components/AppHeader';
import withAuth from '@/components/auth/withAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { updatePassword } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { Download, Loader2, Edit3, BookOpen, Pencil, Lightbulb, LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';

// Firestore
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

function ProfilePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const [isEditingClass, setIsEditingClass] = useState(false);
  const [studentClass, setStudentClass] = useState('9th');
  const [newClass, setNewClass] = useState(studentClass);
  const classes = ['7th', '8th', '9th'];

  const [isSavingClass, setIsSavingClass] = useState(false);
  const [isClassLoading, setIsClassLoading] = useState(true);

  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login?redirect=/profile');
    }
  }, [loading, user, router]);

  useEffect(() => {
    const loadClass = async () => {
      if (!user?.uid) return;
      try {
        const ref = doc(db, 'users', user.uid);
        const snap = await getDoc(ref);
        const cls = snap.exists() ? (snap.data() as any)?.className : null;
        const current = cls || studentClass;
        setStudentClass(current);
        setNewClass(current);
      } catch (err: any) {
        toast({
          variant: 'destructive',
          title: 'Could not load class',
          description: err?.message || 'Please try again.',
        });
      } finally {
        setIsClassLoading(false);
      }
    };

    if (!loading && user) {
      loadClass();
    }
  }, [loading, user, toast, studentClass]); // keep logic intact

  useEffect(() => {
    const standalone =
      (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
      // @ts-ignore (iOS Safari)
      (typeof navigator !== 'undefined' && (navigator as any).standalone === true);
    setIsStandalone(standalone);

    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    const handleAppInstalled = () => {
      setInstallPrompt(null);
      setIsStandalone(true);
      toast({ title: 'Installed', description: 'Vidya Setu was installed successfully.' });
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [toast]);

  const handleInstallClick = async () => {
    if (installPrompt) {
      installPrompt.prompt();
      const { outcome } = await installPrompt.userChoice;
      if (outcome !== 'accepted') {
        toast({ title: 'Install dismissed', description: 'You can install the app later from this page.' });
      }
      setInstallPrompt(null);
      return;
    }

    if (isStandalone) {
      toast({ title: 'Already installed', description: 'You are already using the installed app.' });
    } else {
      toast({
        title: 'Install not available yet',
        description:
          'Make sure you opened this site over HTTPS with a valid manifest and service worker. Try visiting this page in Chrome on Android or desktop.',
      });
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast({ variant: 'destructive', title: 'Passwords do not match' });
      return;
    }
    if (newPassword.length < 6) {
      toast({
        variant: 'destructive',
        title: 'Password is too short',
        description: 'Password should be at least 6 characters long.',
      });
      return;
    }

    setIsLoading(true);
    if (auth.currentUser) {
      try {
        await updatePassword(auth.currentUser, newPassword);
        toast({ title: 'Success', description: 'Your password has been updated.' });
        setNewPassword('');
        setConfirmPassword('');
      } catch (error: any) {
        toast({
          variant: 'destructive',
          title: 'Error updating password',
          description: error?.message || 'Please try again after re-authenticating.',
        });
      } finally {
        setIsLoading(false);
      }
    } else {
      setIsLoading(false);
      toast({ variant: 'destructive', title: 'Not signed in', description: 'Please sign in again.' });
    }
  };

  const handleClassUpdate = async () => {
    if (!user?.uid) {
      toast({ variant: 'destructive', title: 'Not signed in', description: 'Please sign in again.' });
      return;
    }

    const prev = studentClass;
    setStudentClass(newClass);
    setIsSavingClass(true);

    try {
      const ref = doc(db, 'users', user.uid);
      await setDoc(
        ref,
        {
          className: newClass,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      setIsEditingClass(false);
      toast({ title: 'Class updated', description: `Your class is now ${newClass}` });
    } catch (err: any) {
      setStudentClass(prev);
      toast({
        variant: 'destructive',
        title: 'Error updating class',
        description: err?.message || 'Please try again.',
      });
    } finally {
      setIsSavingClass(false);
    }
  };

  if (loading) return null;
  if (!user) return null;

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* ====== VIBRANT BACKGROUND ====== */}
      <div aria-hidden className="absolute inset-0 -z-20">
        {/* Gradient mesh: linear + conic + radial layers for max colour */}
        <div className="absolute inset-0 opacity-90"
          style={{
            backgroundImage: `
              radial-gradient(1200px 800px at 10% 10%, rgba(255,0,128,0.25), transparent 55%),
              radial-gradient(1000px 700px at 90% 15%, rgba(0,191,255,0.25), transparent 55%),
              radial-gradient(900px 700px at 15% 90%, rgba(255,215,0,0.28), transparent 55%),
              radial-gradient(900px 700px at 85% 85%, rgba(144,238,144,0.28), transparent 55%),
              conic-gradient(from 180deg at 50% 50%, #ff7ab6, #ffd86b, #7ee787, #66d9ff, #b59cff, #ff7ab6),
              linear-gradient(135deg, rgba(255,255,255,0.35), rgba(255,255,255,0.15))
            `,
            filter: 'saturate(1.2) contrast(1.05)'
          }}
        />
        {/* confetti dots grid, masked to center */}
        <div className="absolute inset-0 opacity-35 [mask-image:radial-gradient(600px_600px_at_center,black,transparent_80%)]"
          style={{
            backgroundImage: `
              radial-gradient(circle at 10% 20%, rgba(255,255,255,0.45) 2px, transparent 2px),
              radial-gradient(circle at 30% 80%, rgba(255,255,255,0.45) 2px, transparent 2px),
              radial-gradient(circle at 60% 30%, rgba(255,255,255,0.45) 2px, transparent 2px),
              radial-gradient(circle at 80% 70%, rgba(255,255,255,0.45) 2px, transparent 2px)
            `,
            backgroundSize: '120px 120px'
          }}
        />
      </div>

      {/* ====== ANIMATED DOODLES (cheerful + light) ====== */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        {/* Rainbow wave */}
        <svg className="absolute -top-12 left-[-10%] w-[140%] h-40 opacity-60 animate-wave"
             viewBox="0 0 1200 120" preserveAspectRatio="none">
          <defs>
            <linearGradient id="rainbow" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="#ff7ab6"/>
              <stop offset="20%" stopColor="#ffd86b"/>
              <stop offset="40%" stopColor="#7ee787"/>
              <stop offset="60%" stopColor="#66d9ff"/>
              <stop offset="80%" stopColor="#b59cff"/>
              <stop offset="100%" stopColor="#ff7ab6"/>
            </linearGradient>
          </defs>
          <path d="M0,40 C200,80 400,0 600,40 C800,80 1000,0 1200,40 L1200,120 L0,120 Z" fill="url(#rainbow)" fillOpacity="0.35"/>
        </svg>

        {/* Stars */}
        <svg className="absolute right-6 top-10 w-10 h-10 animate-spin-slowest" viewBox="0 0 100 100" fill="none">
          <path d="M50 4 L62 38 L98 38 L68 58 L80 92 L50 72 L20 92 L32 58 L2 38 L38 38 Z" fill="#66d9ff" opacity="0.9"/>
        </svg>
        <svg className="absolute left-8 top-28 w-8 h-8 animate-pulse-soft" viewBox="0 0 100 100" fill="none">
          <path d="M50 4 L62 38 L98 38 L68 58 L80 92 L50 72 L20 92 L32 58 L2 38 L38 38 Z" fill="#ffd86b" opacity="0.9"/>
        </svg>

        {/* Hearts */}
        <svg className="absolute bottom-8 right-10 w-10 h-10 animate-bob" viewBox="0 0 32 29.6">
          <path d="M23.6,0c-3.4,0-5.1,2-7.6,4.7C13.5,2,11.8,0,8.4,0C3.8,0,0,3.8,0,8.4c0,9.6,16,21.2,16,21.2s16-11.6,16-21.2 C32,3.8,28.2,0,23.6,0z" fill="#ff7ab6" fillOpacity="0.9"/>
        </svg>

        {/* Zigzag */}
        <svg className="absolute left-1/2 top-1/3 -translate-x-1/2 w-32 h-10 animate-zigzag opacity-80" viewBox="0 0 200 40" fill="none">
          <polyline points="0,30 25,10 50,30 75,10 100,30 125,10 150,30 175,10 200,30" stroke="#7ee787" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>

        {/* Plus signs */}
        <svg className="absolute left-6 bottom-16 w-8 h-8 animate-float-slow opacity-80" viewBox="0 0 24 24" fill="none">
          <path d="M10 0h4v10h10v4H14v10h-4V14H0v-4h10V0z" fill="#b59cff"/>
        </svg>
        <svg className="absolute right-16 top-1/2 w-6 h-6 animate-float opacity-80" viewBox="0 0 24 24" fill="none">
          <path d="M10 0h4v10h10v4H14v10h-4V14H0v-4h10V0z" fill="#ff9e80"/>
        </svg>

        {/* Dotted spiral */}
        <svg className="absolute left-10 top-1/2 w-24 h-24 animate-spiral opacity-70" viewBox="0 0 120 120" fill="none">
          <path d="M60 20c-22 0-40 18-40 40s18 40 40 40 32-12 32-28-12-24-26-24-22 10-22 20 8 16 18 16"
                stroke="#00e5ff" strokeWidth="4" strokeDasharray="2 10" strokeLinecap="round" />
        </svg>
      </div>

      {/* ====== CONTENT ====== */}
      <div className="relative z-10 flex flex-col min-h-screen">
        <AppHeader title="Your Profile" />

        <main className="flex-grow container mx-auto p-4 sm:p-6 lg:p-8">
          <div className="mb-4">
            <Button
              variant="outline"
              onClick={() => router.push('/home')}
              className="backdrop-blur-md bg-white/70 border-white/60 shadow-sm hover:shadow-md"
            >
              <T>← Back</T>
            </Button>
          </div>

          <div className="max-w-2xl mx-auto space-y-6">
            {/* Helper: gradient border wrapper for extra pop */}
            {/** ACCOUNT INFO */}
            <div className="rounded-2xl p-[1px] bg-gradient-to-r from-pink-400 via-amber-300 via-lime-300 via-cyan-300 to-violet-400 shadow-xl">
              <Card className="relative overflow-hidden break-words border-0 backdrop-blur-md bg-white/75">
                <BookOpen
                  className="absolute top-2 left-2 w-6 h-6 text-pink-400 opacity-60 pointer-events-none select-none hidden sm:block"
                  aria-hidden="true"
                />
                <Pencil
                  className="absolute bottom-2 right-2 w-6 h-6 text-amber-400 opacity-60 pointer-events-none select-none hidden sm:block"
                  aria-hidden="true"
                />
                <CardHeader className="relative z-10">
                  <CardTitle className="bg-clip-text text-transparent bg-gradient-to-r from-pink-500 via-orange-500 to-purple-600">
                    <T>Account Information</T>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 relative z-10">
                  <div>
                    <Label className="text-slate-700"><T>Email</T></Label>
                    <p className="text-lg font-semibold break-words">{user.email}</p>
                  </div>
                  <div>
                    <Label className="text-slate-700"><T>Role</T></Label>
                    <p className="text-lg font-semibold capitalize">{user.role}</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/** CHANGE CLASS */}
            <div className="rounded-2xl p-[1px] bg-gradient-to-r from-cyan-400 via-emerald-300 via-yellow-300 to-rose-400 shadow-xl">
              <Card className="relative overflow-hidden break-words border-0 backdrop-blur-md bg-white/75">
                <Lightbulb
                  className="absolute top-2 right-2 w-6 h-6 text-yellow-400 opacity-70 pointer-events-none select-none hidden sm:block"
                  aria-hidden="true"
                />
                <CardHeader className="relative z-10">
                  <CardTitle className="bg-clip-text text-transparent bg-gradient-to-r from-sky-600 via-emerald-600 to-amber-600">
                    <T>Change Class</T>
                  </CardTitle>
                  <CardDescription className="text-slate-700">
                    <T>Update your current class from the dropdown below.</T>
                  </CardDescription>
                </CardHeader>
                <CardContent className="relative z-10">
                  {isClassLoading ? (
                    <div className="flex items-center justify-center py-6 text-sm text-gray-700">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> <T>Loading your class...</T>
                    </div>
                  ) : isEditingClass ? (
                    <div className="space-y-3">
                      <select
                        value={newClass}
                        onChange={(e) => setNewClass(e.target.value)}
                        className="border p-2 rounded w-full bg-white/85 backdrop-blur"
                        disabled={isSavingClass}
                      >
                        {classes.map((cls) => (
                          <option key={cls} value={cls}>{cls}</option>
                        ))}
                      </select>
                      <div className="flex justify-center gap-3">
                        <Button onClick={handleClassUpdate} className="bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700" disabled={isSavingClass}>
                          {isSavingClass && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          <T>Save</T>
                        </Button>
                        <Button onClick={() => setIsEditingClass(false)} variant="outline" disabled={isSavingClass} className="bg-white/70">
                          <T>Cancel</T>
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <Button onClick={() => setIsEditingClass(true)} className="flex items-center gap-2 bg-gradient-to-r from-fuchsia-500 to-orange-400 hover:from-fuchsia-600 hover:to-orange-500 text-white">
                        <Edit3 className="w-4 h-4" /> <T>Change Class</T>
                      </Button>
                      <p className="text-slate-700">
                        <T>Current Class:</T> <span className="font-medium">{studentClass}</span>
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/** INSTALL APP */}
            <div className="rounded-2xl p-[1px] bg-gradient-to-r from-violet-400 via-pink-400 via-orange-300 to-lime-300 shadow-xl">
              <Card className="relative overflow-hidden break-words border-0 backdrop-blur-md bg-white/75">
                <Download
                  className="absolute top-2 left-2 w-6 h-6 text-purple-400 opacity-70 pointer-events-none select-none hidden sm:block"
                  aria-hidden="true"
                />
                <CardHeader className="relative z-10">
                  <CardTitle className="bg-clip-text text-transparent bg-gradient-to-r from-purple-600 via-rose-600 to-amber-600">
                    <T>Download App</T>
                  </CardTitle>
                  <CardDescription className="text-slate-700">
                    <T>Install Shiksha Setu on your device for a better experience, including offline access.</T>
                  </CardDescription>
                </CardHeader>
                <CardContent className="relative z-10">
                  <Button onClick={handleInstallClick} className="bg-gradient-to-r from-purple-500 to-rose-500 hover:from-purple-600 hover:to-rose-600 text-white">
                    <Download className="mr-2 h-4 w-4" /> <T>Install App</T>
                  </Button>
                  {isStandalone && (
                    <p className="text-xs text-gray-700 mt-2">
                      <T>App already installed — you can launch it from your home screen or apps list.</T>
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/** CHANGE PASSWORD */}
            <div className="rounded-2xl p-[1px] bg-gradient-to-r from-rose-400 via-amber-300 via-sky-300 to-fuchsia-400 shadow-xl">
              <Card className="relative overflow-hidden break-words border-0 backdrop-blur-md bg-white/75">
                <Pencil
                  className="absolute top-2 right-2 w-6 h-6 text-rose-400 opacity-70 pointer-events-none select-none hidden sm:block"
                  aria-hidden="true"
                />
                <CardHeader className="relative z-10">
                  <CardTitle className="bg-clip-text text-transparent bg-gradient-to-r from-rose-600 via-amber-600 to-sky-600">
                    <T>Change Password</T>
                  </CardTitle>
                  <CardDescription className="text-slate-700">
                    <T>Enter a new password below to change your current password.</T>
                  </CardDescription>
                </CardHeader>
                <CardContent className="relative z-10">
                  <form onSubmit={handleChangePassword} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="new-password" className="text-slate-700"><T>New Password</T></Label>
                      <Input
                        id="new-password"
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="New password"
                        className="bg-white/85 backdrop-blur"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirm-password" className="text-slate-700"><T>Confirm New Password</T></Label>
                      <Input
                        id="confirm-password"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirm new password"
                        className="bg-white/85 backdrop-blur"
                      />
                    </div>
                    <Button type="submit" disabled={isLoading} className="bg-gradient-to-r from-rose-500 to-amber-500 hover:from-rose-600 hover:to-amber-600 text-white">
                      {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      <T>Change Password</T>
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>

            {/** LOGOUT */}
            <div className="rounded-2xl p-[1px] bg-gradient-to-r from-red-400 via-pink-400 via-orange-300 to-yellow-300 shadow-xl">
              <Card className="relative overflow-hidden break-words border-0 backdrop-blur-md bg-white/75">
                <LogOut
                  className="absolute top-2 right-2 w-6 h-6 text-red-500 opacity-70 pointer-events-none select-none hidden sm:block"
                  aria-hidden="true"
                />
                <CardHeader className="relative z-10">
                  <CardTitle className="bg-clip-text text-transparent bg-gradient-to-r from-red-600 via-orange-600 to-yellow-600">
                    <T>Log Out</T>
                  </CardTitle>
                  <CardDescription className="text-slate-700"><T>Sign out of your account securely.</T></CardDescription>
                </CardHeader>
                <CardContent className="flex justify-center relative z-10">
                  <Button
                    onClick={async () => {
                      try {
                        await auth.signOut();
                        toast({ title: 'Logged Out', description: 'You’ve been logged out successfully.' });
                        router.push('/login');
                      } catch (error: any) {
                        toast({
                          variant: 'destructive',
                          title: 'Error logging out',
                          description: error?.message || 'Please try again.',
                        });
                      }
                    }}
                    className="bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 text-white px-6 py-2"
                  >
                    <LogOut className="mr-2 h-4 w-4" /> <T>Log Out</T>
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>

      {/* ====== Tiny animations & motion safety (no logic changes) ====== */}
      <style jsx>{`
        /* motion-respect */
        @media (prefers-reduced-motion: reduce) {
          .animate-wave,
          .animate-spin-slowest,
          .animate-pulse-soft,
          .animate-bob,
          .animate-zigzag,
          .animate-float,
          .animate-float-slow,
          .animate-spiral {
            animation: none !important;
          }
        }

        .animate-wave { animation: wave 14s ease-in-out infinite; }
        @keyframes wave {
          0%,100% { transform: translateY(0); }
          50%     { transform: translateY(12px); }
        }

        .animate-spin-slowest { animation: spin 18s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        .animate-pulse-soft { animation: pulse 3.5s ease-in-out infinite; }
        @keyframes pulse {
          0%,100% { transform: scale(1); opacity: 0.7; }
          50%     { transform: scale(1.08); opacity: 1; }
        }

        .animate-bob { animation: bob 6s ease-in-out infinite; }
        @keyframes bob {
          0%,100% { transform: translateY(0) rotate(0deg); }
          50%     { transform: translateY(-10px) rotate(2deg); }
        }

        .animate-zigzag { animation: zig 8s ease-in-out infinite; }
        @keyframes zig {
          0%,100% { transform: translateX(0); }
          50%     { transform: translateX(20px); }
        }

        .animate-float { animation: float 7s ease-in-out infinite; }
        .animate-float-slow { animation: float 11s ease-in-out infinite; }
        @keyframes float {
          0%,100% { transform: translateY(0); }
          50%     { transform: translateY(-8px); }
        }

        .animate-spiral { animation: spiral 16s linear infinite; }
        @keyframes spiral {
          0%   { transform: rotate(0deg) scale(1); }
          50%  { transform: rotate(180deg) scale(1.05); }
          100% { transform: rotate(360deg) scale(1); }
        }
      `}</style>
    </div>
  );
}

export default withAuth(ProfilePage);
