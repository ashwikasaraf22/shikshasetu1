
'use client';

import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Loader2, User, BookOpen, BarChart2 } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc } from 'firebase/firestore';
import type { UserProfile, Submission, Test } from '@/lib/types';
import withAuth from '@/components/auth/withAuth';
import AppHeader from '@/components/AppHeader';
import { useRouter } from 'next/navigation';

interface StudentData extends UserProfile {
    submissions: Submission[];
    tests: Test[];
}

function ParentDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const [studentsData, setStudentsData] = useState<StudentData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user || !user.studentIds || user.studentIds.length === 0) {
      setIsLoading(false);
      return;
    }

    const fetchStudentsData = async () => {
        setIsLoading(true);
        try {
            // 1. Fetch profiles of linked students
            const studentsQuery = query(collection(db, 'users'), where('uid', 'in', user.studentIds));
            const studentDocs = await getDocs(studentsQuery);
            const studentProfiles = studentDocs.docs.map(doc => doc.data() as UserProfile);

            // 2. For each student, fetch their submissions and associated tests
            const allStudentsData: StudentData[] = [];
            for (const student of studentProfiles) {
                const submissionsQuery = query(collection(db, 'submissions'), where('studentId', '==', student.uid));
                const submissionsSnapshot = await getDocs(submissionsQuery);
                const submissions = submissionsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Submission));

                const testIds = [...new Set(submissions.map(s => s.testId))];
                let tests: Test[] = [];
                if (testIds.length > 0) {
                    // Firestore 'in' queries are limited to 30 items.
                    // For more than 30 tests, you'd need to batch queries.
                    const testsQuery = query(collection(db, 'tests'), where('__name__', 'in', testIds));
                    const testsSnapshot = await getDocs(testsQuery);
                    tests = testsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Test));
                }

                allStudentsData.push({
                    ...student,
                    submissions,
                    tests,
                });
            }
            setStudentsData(allStudentsData);
        } catch (error) {
            console.error("Error fetching student data:", error);
        } finally {
            setIsLoading(false);
        }
    };

    fetchStudentsData();
  }, [user]);

  const getAverageScore = (student: StudentData) => {
    const evaluatedSubmissions = student.submissions.filter(s => s.evaluation);
    if (evaluatedSubmissions.length === 0) return 'N/A';

    const totalScore = evaluatedSubmissions.reduce((acc, sub) => {
      const correct = sub.evaluation?.results.filter(r => r.isCorrect).length || 0;
      const total = sub.evaluation?.results.length || 1;
      return acc + (correct / total) * 100;
    }, 0);

    return `${(totalScore / evaluatedSubmissions.length).toFixed(0)}%`;
  }

  if (isLoading) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="h-16 w-16 animate-spin text-primary" /></div>;
  }

  return (
    <div className="flex flex-col min-h-screen bg-muted/40">
       <AppHeader title="Parent Dashboard" />
      <main className="flex-grow container mx-auto p-4 sm:p-6 lg:p-8">
        <Card>
            <CardHeader>
                <CardTitle>Your Children's Progress</CardTitle>
                <CardDescription>Monitor the academic performance and activity of your children.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {studentsData.length === 0 ? (
                    <div className="text-center py-10">
                        <p className="text-muted-foreground">No students are currently linked to your account.</p>
                        <p className="text-sm text-muted-foreground mt-2">Please contact the teacher or school admin to link your child's account.</p>
                    </div>
                ) : (
                    studentsData.map(student => (
                        <Card key={student.uid} className="bg-background">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <User /> {student.email}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="grid gap-4 md:grid-cols-2">
                                <Card>
                                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                        <CardTitle className="text-sm font-medium">Tests Completed</CardTitle>
                                        <BookOpen className="h-4 w-4 text-muted-foreground" />
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-2xl font-bold">{student.submissions.filter(s => s.evaluation).length}</div>
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                        <CardTitle className="text-sm font-medium">Average Score</CardTitle>
                                        <BarChart2 className="h-4 w-4 text-muted-foreground" />
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-2xl font-bold">{getAverageScore(student)}</div>
                                    </CardContent>
                                </Card>
                            </CardContent>
                        </Card>
                    ))
                )}
            </CardContent>
        </Card>
      </main>
    </div>
  );
}

export default withAuth(ParentDashboard, ['parent']);
