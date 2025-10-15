
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { PlusCircle, Loader2, Eye, MessageSquare, Upload, Edit } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/components/auth/AuthProvider';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, getDocs } from 'firebase/firestore';
import type { Class, UserProfile, Submission, Test } from '@/lib/types';
import withAuth from '@/components/auth/withAuth';
import AppHeader from '@/components/AppHeader';

type StudentWithPerformance = UserProfile & {
  submission?: Submission;
};

function TeacherDashboard() {
  const { user } = useAuth();
  const [classes, setClasses] = useState<Class[]>([]);
  const [tests, setTests] = useState<Test[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [students, setStudents] = useState<StudentWithPerformance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  useEffect(() => {
    if (!user) return;
    setIsLoading(true);
    const q = query(collection(db, 'classes'), where('teacherId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const teacherClasses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Class));
      setClasses(teacherClasses);
      if (teacherClasses.length > 0 && !selectedClassId) {
        setSelectedClassId(teacherClasses[0].id);
      }
      setIsLoading(false);
    });
    
    // Fetch all tests created by the teacher
    const testsQuery = query(collection(db, 'tests'), where('createdBy', '==', user.uid));
    const unsubTests = onSnapshot(testsQuery, (snapshot) => {
      setTests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Test)));
    });

    return () => {
      unsubscribe();
      unsubTests();
    }
  }, [user, selectedClassId]);

  useEffect(() => {
    if (!selectedClassId) {
        setStudents([]);
        return;
    };

    const selectedClass = classes.find(c => c.id === selectedClassId);
    if (!selectedClass || !selectedClass.studentIds || selectedClass.studentIds.length === 0) {
        setStudents([]);
        return;
    }

    const fetchStudentsAndSubmissions = async () => {
        setIsLoadingDetails(true);
        // Fetch student profiles
        const studentsQuery = query(collection(db, 'users'), where('uid', 'in', selectedClass.studentIds));
        const studentDocs = await getDocs(studentsQuery);
        const studentProfiles = studentDocs.docs.map(doc => doc.data() as UserProfile);

        // Fetch all submissions for the selected class
        const submissionsQuery = query(collection(db, 'submissions'), where('classId', '==', selectedClassId));
        const unsubSubmissions = onSnapshot(submissionsQuery, (snapshot) => {
            const classSubmissions = snapshot.docs.map(doc => doc.data() as Submission);
            setSubmissions(classSubmissions);

            // Combine student profile with their submission
            const studentData: StudentWithPerformance[] = studentProfiles.map(p => {
                const studentSubmissions = classSubmissions.filter(s => s.studentId === p.uid).sort((a,b) => b.submittedAt.toMillis() - a.submittedAt.toMillis());
                return {
                    ...p,
                    submission: studentSubmissions[0] // get the most recent one
                };
            });
            setStudents(studentData);
        });

        setIsLoadingDetails(false);
        return () => unsubSubmissions();
    };

    fetchStudentsAndSubmissions();
  }, [selectedClassId, classes]);

  if (isLoading) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="h-16 w-16 animate-spin text-primary" /></div>;
  }

  const selectedClass = classes.find((c) => c.id === selectedClassId);
  const classTests = tests.filter(t => t.classId === selectedClassId && !t.isDraft);
  const draftTests = tests.filter(t => t.isDraft);

  return (
    <div className="flex flex-col min-h-screen bg-muted/40">
       <AppHeader title="Teacher Dashboard">
            <Link href="/teacher/create-test">
                <Button>
                    <PlusCircle className="mr-2" />
                    Create New Test
                </Button>
            </Link>
       </AppHeader>
      <main className="flex-grow container mx-auto p-4 sm:p-6 lg:p-8">
        <div className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-1">
             <Card className="mb-8">
              <CardHeader>
                <CardTitle>Your Classes</CardTitle>
                <CardDescription>Select a class to view details.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {classes.length === 0 ? (
                    <p className="text-muted-foreground text-sm">You have not been assigned to any classes yet.</p>
                ) : (
                    classes.map((c) => (
                    <button
                        key={c.id}
                        onClick={() => setSelectedClassId(c.id)}
                        className={cn(
                        "w-full text-left p-4 rounded-lg border transition-colors",
                        selectedClassId === c.id
                            ? "bg-primary text-primary-foreground border-primary"
                            : "hover:bg-muted/50"
                        )}
                    >
                        <p className="font-semibold">{c.name}</p>
                        <p className={cn("text-sm", selectedClassId === c.id ? 'text-primary-foreground/80' : 'text-muted-foreground')}>
                            Division: {c.division}
                        </p>
                    </button>
                    ))
                )}
              </CardContent>
            </Card>
            
            <Card>
                 <CardHeader>
                    <CardTitle>Quick Actions</CardTitle>
                 </CardHeader>
                 <CardContent className="space-y-4">
                     <Button asChild className="w-full">
                         <Link href="/chat">
                            <MessageSquare className="mr-2"/> Start a Chat
                         </Link>
                     </Button>
                     <Button asChild className="w-full">
                         <Link href="/community">
                            <Upload className="mr-2"/> Go to Community
                         </Link>
                     </Button>
                 </CardContent>
            </Card>
          </div>
          <div className="lg:col-span-2">
            {selectedClass ? (
              <Tabs defaultValue="assigned">
                <TabsList className="mb-4">
                    <TabsTrigger value="assigned">Assigned Tests</TabsTrigger>
                    <TabsTrigger value="drafts">My Drafts</TabsTrigger>
                    <TabsTrigger value="students">Students</TabsTrigger>
                </TabsList>
                <TabsContent value="assigned">
                    <Card>
                        <CardHeader>
                            <CardTitle>Tests for {selectedClass.name}</CardTitle>
                            <CardDescription>Tests you have assigned to this class.</CardDescription>
                        </CardHeader>
                        <CardContent>
                        <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Test Name</TableHead>
                                        <TableHead>Submissions</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {classTests.length === 0 ? (
                                        <TableRow><TableCell colSpan={3} className="h-24 text-center">No tests assigned to this class yet.</TableCell></TableRow>
                                    ) : (
                                        classTests.map(test => {
                                            const submissionCount = submissions.filter(s => s.testId === test.id && s.evaluation).length;
                                            return (
                                                <TableRow key={test.id}>
                                                    <TableCell className="font-medium">{test.name}</TableCell>
                                                    <TableCell>{submissionCount} / {selectedClass.studentIds.length}</TableCell>
                                                    <TableCell className="text-right">
                                                        <Button asChild variant="outline" size="sm">
                                                            <Link href={`/teacher/test/${test.id}`}>
                                                                <Eye className="mr-2 h-4 w-4" />
                                                                View Submissions
                                                            </Link>
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            )
                                        })
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value="drafts">
                     <Card>
                        <CardHeader>
                            <CardTitle>My Drafts</CardTitle>
                            <CardDescription>Unpublished tests you have created.</CardDescription>
                        </CardHeader>
                        <CardContent>
                           <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Draft Name</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {draftTests.length === 0 ? (
                                        <TableRow><TableCell colSpan={2} className="h-24 text-center">You have no drafts.</TableCell></TableRow>
                                    ) : (
                                        draftTests.map(test => (
                                            <TableRow key={test.id}>
                                                <TableCell className="font-medium">{test.name}</TableCell>
                                                <TableCell className="text-right">
                                                    <Button asChild variant="outline" size="sm">
                                                        <Link href={`/teacher/create-test?draftId=${test.id}`}>
                                                            <Edit className="mr-2 h-4 w-4" />
                                                            Edit
                                                        </Link>
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value="students">
                    <Card>
                        <CardHeader>
                        <CardTitle>Students in {selectedClass.name} - Div {selectedClass.division}</CardTitle>
                        <CardDescription>Overview of student performance and test status.</CardDescription>
                        </CardHeader>
                        <CardContent>
                        {isLoadingDetails ? (
                            <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                        ) : (
                            <Table>
                                <TableHeader>
                                <TableRow>
                                    <TableHead>Student</TableHead>
                                    <TableHead>Last Test Status</TableHead>
                                </TableRow>
                                </TableHeader>
                                <TableBody>
                                {students.length === 0 ? (
                                <TableRow>
                                        <TableCell colSpan={2} className="text-center h-24">No students enrolled in this class.</TableCell>
                                </TableRow> 
                                ) : (
                                    students.map((student) => {
                                        const submission = student.submission;
                                        let status = <Badge variant="outline">No submissions</Badge>;
                                        if(submission?.evaluation) {
                                            status = <Badge variant="default">Completed</Badge>
                                        } else if(submission) {
                                            status = <Badge variant="secondary">In Progress</Badge>
                                        }
                                        return (
                                            <TableRow key={student.uid}>
                                                <TableCell className="font-medium">{student.email}</TableCell>
                                                <TableCell>{status}</TableCell>
                                            </TableRow>
                                        )
                                    })
                                )}
                                </TableBody>
                            </Table>
                        )}
                        </CardContent>
                    </Card>
                </TabsContent>
              </Tabs>
            ) : (
                <div className="flex items-center justify-center h-full rounded-lg border border-dashed">
                    <p className="text-muted-foreground">Select a class to see details.</p>
                </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default withAuth(TeacherDashboard, ['teacher']);
