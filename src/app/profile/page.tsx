
'use client';

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

  // PWA install prompt state
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false); // detect already installed

  // --- Auth gate: wait for loading; if no user after loading, redirect to login
  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login?redirect=/profile');
    }
  }, [loading, user, router]);

  // Detect standalone / installed state and wire the beforeinstallprompt
  useEffect(() => {
    // Is app already installed?
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
      toast({ title: 'Installed', description: 'Shiksha Setu was installed successfully.' });
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [toast]);

  const handleInstallClick = async () => {
    // If the prompt is available, show it
    if (installPrompt) {
      installPrompt.prompt();
      const { outcome } = await installPrompt.userChoice;
      if (outcome === 'accepted') {
        // user accepted; prompt will resolve and appinstalled will fire if install succeeds
      } else {
        toast({ title: 'Install dismissed', description: 'You can install the app later from this page.' });
      }
      // The prompt can only be used once
      setInstallPrompt(null);
      return;
    }

    // Prompt not available — show a helpful message instead of hiding the button
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

  const handleClassUpdate = () => {
    setStudentClass(newClass);
    setIsEditingClass(false);
    toast({ title: 'Class updated', description: `Your class is now ${newClass}` });
  };

  // While auth is resolving, render nothing (keeps your UI unchanged)
  if (loading) return null;
  // If unauthenticated, we already triggered redirect above; render nothing
  if (!user) return null;

  return (
    <div className="relative min-h-screen overflow-hidden bg-white">
      <div className="relative z-10 flex flex-col min-h-screen">
        <AppHeader title="Your Profile" />

        <main className="flex-grow container mx-auto p-4 sm:p-6 lg:p-8">
          {/* Back button to home */}
          <div className="mb-4">
            <Button variant="outline" onClick={() => router.push('/home')}>
              ← Back
            </Button>
          </div>

          <div className="max-w-2xl mx-auto space-y-6">

            {/* Account Info Card */}
            <Card className="bg-gradient-to-r from-pink-200 via-yellow-200 to-green-200 relative overflow-hidden">
              <BookOpen className="absolute top-2 left-2 w-6 h-6 text-pink-300 opacity-50" />
              <Pencil className="absolute bottom-2 right-2 w-6 h-6 text-yellow-300 opacity-50" />
              <CardHeader>
                <CardTitle>Account Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Email</Label>
                  <p className="text-lg font-semibold">{user.email}</p>
                </div>
                <div>
                  <Label>Role</Label>
                  <p className="text-lg font-semibold capitalize">{user.role}</p>
                </div>
              </CardContent>
            </Card>

            {/* Change Class Card */}
            <Card className="bg-gradient-to-r from-green-200 via-teal-200 to-blue-200 relative overflow-hidden">
              <Lightbulb className="absolute top-2 right-2 w-6 h-6 text-yellow-400 opacity-50" />
              <CardHeader>
                <CardTitle>Change Class</CardTitle>
                <CardDescription>Update your current class from the dropdown below.</CardDescription>
              </CardHeader>
              <CardContent>
                {isEditingClass ? (
                  <div className="space-y-3">
                    <select
                      value={newClass}
                      onChange={(e) => setNewClass(e.target.value)}
                      className="border p-2 rounded w-full"
                    >
                      {classes.map((cls) => (
                        <option key={cls} value={cls}>{cls}</option>
                      ))}
                    </select>
                    <div className="flex justify-center gap-3">
                      <Button onClick={handleClassUpdate} className="bg-blue-600 hover:bg-blue-700">
                        Save
                      </Button>
                      <Button onClick={() => setIsEditingClass(false)} variant="outline">
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <Button
                      onClick={() => setIsEditingClass(true)}
                      className="flex items-center gap-2"
                    >
                      <Edit3 className="w-4 h-4" /> Change Class
                    </Button>
                    <p className="text-gray-600">
                      Current Class: <span className="font-medium">{studentClass}</span>
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Install App Card — always visible; button works when prompt is available */}
            <Card className="bg-gradient-to-r from-purple-200 via-pink-200 to-orange-200 relative overflow-hidden">
              <Download className="absolute top-2 left-2 w-6 h-6 text-purple-300 opacity-50" />
              <CardHeader>
                <CardTitle>Download App</CardTitle>
                <CardDescription>
                  Install Shiksha Setu on your device for a better experience, including offline access.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={handleInstallClick}>
                  <Download className="mr-2 h-4 w-4" /> Install App
                </Button>
                {/* (Optional) small hint when app is already installed */}
                {isStandalone && (
                  <p className="text-xs text-gray-600 mt-2">
                    App already installed — you can launch it from your home screen or apps list.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Change Password Card */}
            <Card className="bg-gradient-to-r from-yellow-200 via-pink-200 to-red-200 relative overflow-hidden">
              <Pencil className="absolute top-2 right-2 w-6 h-6 text-pink-300 opacity-50" />
              <CardHeader>
                <CardTitle>Change Password</CardTitle>
                <CardDescription>
                  Enter a new password below to change your current password.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleChangePassword} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="new-password">New Password</Label>
                    <Input
                      id="new-password"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="New password"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Confirm New Password</Label>
                    <Input
                      id="confirm-password"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm new password"
                    />
                  </div>
                  <Button type="submit" disabled={isLoading}>
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Change Password
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Logout Card */}
            <Card className="bg-gradient-to-r from-red-200 via-pink-200 to-orange-200 relative overflow-hidden">
              <LogOut className="absolute top-2 right-2 w-6 h-6 text-red-400 opacity-50" />
              <CardHeader>
                <CardTitle>Log Out</CardTitle>
                <CardDescription>Sign out of your account securely.</CardDescription>
              </CardHeader>
              <CardContent className="flex justify-center">
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
                  className="bg-red-600 hover:bg-red-700 text-white px-6 py-2"
                >
                  <LogOut className="mr-2 h-4 w-4" /> Log Out
                </Button>
              </CardContent>
            </Card>

          </div>
        </main>
      </div>
    </div>
  );
}

export default ProfilePage;
