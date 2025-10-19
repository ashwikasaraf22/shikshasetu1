// src/lib/db.ts
import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { MCQQuestion, EvaluationResult, UserProfile } from '@/lib/types';

/**
 * Save an ad-hoc quiz test + the student's submission.
 * Creates a test doc (so parent dashboards can join on testId),
 * then creates a submission referencing that test.
 */
export async function saveAdhocQuizSubmission(params: {
  userId: string;
  subject: string;
  chapter: string;
  level: 'Easy' | 'Medium' | 'Hard';
  questions: {
    id: string;
    text: string;
    options: { label: string; value: string }[];
    correctIndex: number;
  }[];
  answers: number[]; // -1 if skipped
}) {
  const { userId, subject, chapter, level, questions, answers } = params;

  // Build a minimal "test" that matches your types (MCQ only)
  const testQuestions: MCQQuestion[] = questions.map((q) => ({
    question: q.text,
    options: q.options.map((o) => o.value),
    answer: q.options[q.correctIndex]?.value ?? '',
    type: 'mcq',
  }));

  const testDocRef = await addDoc(collection(db, 'tests'), {
    name: `${subject} • ${chapter} • ${level}`,
    classId: null,
    questions: testQuestions,
    createdBy: userId,
    createdAt: serverTimestamp(),
    isDraft: false,
  });

  // Build evaluation
  const evalResults: EvaluationResult[] = questions.map((q, i) => {
    const chosen = answers[i];
    const userAnswer =
      chosen >= 0 && q.options[chosen] ? q.options[chosen].value : '';
    const correctAnswer = q.options[q.correctIndex]?.value ?? '';
    const isCorrect = userAnswer === correctAnswer;

    return {
      question: q.text,
      type: 'mcq',
      userAnswer,
      isCorrect,
      explanation: isCorrect ? 'Correct!' : `Correct answer: ${correctAnswer}`,
    };
  });

  const correctCount = evalResults.filter((r) => r.isCorrect).length;
  const overallFeedback =
    correctCount === questions.length
      ? 'Excellent work!'
      : correctCount >= Math.ceil(questions.length * 0.6)
      ? 'Nice work. Review the ones you missed.'
      : 'Keep practicing. You can do it!';

  // Firestore: submission
  await addDoc(collection(db, 'submissions'), {
    testId: testDocRef.id,
    studentId: userId,
    classId: 'adhoc', // nothing to join here — a placeholder
    answers: answers.map((i, idx) =>
      i >= 0 && questions[idx]?.options[i]
        ? questions[idx].options[i].value
        : ''
    ),
    evaluation: {
      results: evalResults,
      overallFeedback,
    },
    submittedAt: serverTimestamp(),
  });

  return {
    testId: testDocRef.id,
    correct: correctCount,
    total: questions.length,
  };
}

/**
 * Save an Ask-Teacher question.
 */
export async function createQuestionSubmission(params: {
  userId: string;
  subject: string;
  chapter: string;
  text: string;
}) {
  const { userId, subject, chapter, text } = params;
  await addDoc(collection(db, 'questions'), {
    studentId: userId,
    subject,
    chapter,
    text,
    status: 'Pending',
    createdAt: serverTimestamp(),
  });
}

/* -------------------------------------------------------------------
 * 🧩 Parent–Child Mapping Helpers
 * -------------------------------------------------------------------
 */

/**
 * Fetch a student profile by their email (only if role === 'student')
 */
export async function getStudentByEmail(
  email: string
): Promise<UserProfile | null> {
  const q = query(
    collection(db, 'users'),
    where('email', '==', email),
    where('role', '==', 'student')
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { uid: d.id, ...(d.data() as any) } as UserProfile;
}

/**
 * Link a parent with a child (creates the Firestore container automatically)
 * Structure: parents/{parentUid}/children/{childUid}
 */
export async function linkParentToChild(
  parentUid: string,
  childUid: string
): Promise<void> {
  const linkRef = doc(db, 'parents', parentUid, 'children', childUid);
  await setDoc(linkRef, { childUid, linkedAt: Date.now() });
}

/**
 * Fetch all children linked to a parent
 */
export async function getChildrenForParent(
  parentUid: string
): Promise<UserProfile[]> {
  const childrenCol = collection(db, 'parents', parentUid, 'children');
  const links = await getDocs(childrenCol);
  if (links.empty) return [];
  const results: UserProfile[] = [];

  for (const l of links.docs) {
    const { childUid } = l.data() as { childUid: string };
    const uref = doc(db, 'users', childUid);
    const usnap = await getDoc(uref);
    if (usnap.exists()) {
      results.push({ uid: usnap.id, ...(usnap.data() as any) } as UserProfile);
    }
  }
  return results;
}
