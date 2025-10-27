'use client';

import { useAuth } from '@/components/auth/AuthProvider';
import { db } from '@/lib/firebase';
import {
  collection,
  query as fq,
  where,
  onSnapshot,
  orderBy,
} from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { MessageCircle, Phone, Loader2 } from 'lucide-react';
import { addTeacherMessage } from '@/lib/db';
import { useRouter } from 'next/navigation';

/* ---------------------------------------------------------
   Lightweight client-side language detector
--------------------------------------------------------- */
function detectLang(str: string | undefined): 'en' | 'hi' | undefined {
  if (!str) return undefined;
  const hasDevanagari = /[\u0900-\u097F]/.test(str);
  if (hasDevanagari) return 'hi';
  const asciiish = /^[\x00-\x7F\s.,;:'"?!()\[\]\-_/\\0-9A-Za-z]+$/.test(str);
  if (asciiish) return 'en';
  return undefined;
}

/* ---------------------------------------------------------
   API Translation Helpers
--------------------------------------------------------- */
async function translateViaApi(
  text: string,
  targetLang: string,
  sourceLang?: string
): Promise<string> {
  if (!text?.trim()) return '';

  const detected = detectLang(text);
  if ((detected && detected === targetLang.toLowerCase()) ||
      (targetLang.toLowerCase() === 'en' && detected === 'en')) {
    return text;
  }

  try {
    const response = await fetch('/api/translate-text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, targetLang, sourceLang }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Translation API Error (${response.status}): ${errorText}`);
      return `[API Error] ${text}`;
    }

    const data = await response.json();
    return data.translatedText || `[Translation Failed] ${text}`;
  } catch (error) {
    console.error('Error calling translation API:', error);
    return `[Network Error] ${text}`;
  }
}

async function toEnglishViaApi(input: string, sourceLang?: string): Promise<string> {
  if (!input) return input;
  const detected = detectLang(input);
  if (detected === 'en') return input;
  return translateViaApi(input, 'en', sourceLang ?? detected);
}

async function fromEnglishViaApi(input: string, targetLang: string): Promise<string> {
  if (!input) return input;
  const tgt = (targetLang || 'en').toLowerCase();
  if (tgt === 'en') return input;
  return translateViaApi(input, tgt, 'en');
}

/* ---------------------------------------------------------
   Page Component
--------------------------------------------------------- */
export default function DoubtSolverPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [doubts, setDoubts] = useState<any[]>([]);
  const [selectedDoubt, setSelectedDoubt] = useState<any | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');

  const [selectedDoubtEnglish, setSelectedDoubtEnglish] = useState<string>('');
  const [translatedMsgMap, setTranslatedMsgMap] = useState<Record<string, string>>({});
  const [previewEnMap, setPreviewEnMap] = useState<Record<string, string>>({});
  const [isTranslating, setIsTranslating] = useState<Record<string, boolean>>({});

  const teacherSubject = (user as any)?.subject || 'Science';
  const teacherClass = (user as any)?.classGrade || null;

  /* -------------------------------------------------------
     Load doubts (Translate previews proactively)
  ------------------------------------------------------- */
  useEffect(() => {
    if (loading || !user) return;

    const base = collection(db, 'doubts');
    const q = teacherClass
      ? fq(base, where('subject', '==', teacherSubject), where('classGrade', '==', teacherClass))
      : fq(base, where('subject', '==', teacherSubject));

    const unsub = onSnapshot(
      q,
      (snap) => {
        setPreviewEnMap((currentPreviews) => {
          const data = snap.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .filter((d: any) => !d.assignedTo || d.assignedTo === user.uid)
            .sort((a: any, b: any) => {
              const sa = a.lastUpdatedAt?.seconds ?? a.createdAt?.seconds ?? 0;
              const sb = b.lastUpdatedAt?.seconds ?? b.createdAt?.seconds ?? 0;
              return sb - sa;
            });

          setDoubts(data);

          let changed = false;
          const next = { ...currentPreviews };

          for (const d of data) {
            if (next[d.id] !== undefined) continue;

            const baseText: string =
              (d.text_original || d.text || d.text_en || '').toString();

            if (!baseText) {
              next[d.id] = '';
              changed = true;
              continue;
            }

            const detected = detectLang(baseText);
            const shouldTranslate = detected !== 'en';

            if (shouldTranslate) {
              next[d.id] = '(translating preview...)';
              changed = true;
              toEnglishViaApi(baseText, detected).then((en) => {
                setPreviewEnMap((prev) => ({ ...prev, [d.id]: en }));
              });
            } else {
              next[d.id] = baseText;
              changed = true;
            }
          }

          return changed ? next : currentPreviews;
        });
      },
      (err) => console.error('onSnapshot(doubts) error:', err)
    );

    return () => unsub();
  }, [user, loading, teacherSubject, teacherClass]);

  /* -------------------------------------------------------
     Load messages & translate initial doubt
  ------------------------------------------------------- */
  useEffect(() => {
    if (!selectedDoubt) {
      setMessages([]);
      setSelectedDoubtEnglish('');
      setTranslatedMsgMap({});
      setIsTranslating({});
      return;
    }

    setSelectedDoubtEnglish('(translating initial doubt...)');

    const msgRef = collection(db, 'doubts', selectedDoubt.id, 'messages');
    const q = fq(msgRef, orderBy('timestamp', 'asc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const arr = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
        setMessages(arr);
        setTranslatedMsgMap({});
        setIsTranslating({});
      },
      (err) => {
        console.error('onSnapshot(messages) error:', err);
        setMessages([]);
      }
    );

    (async () => {
      const baseText: string =
        (selectedDoubt?.text_original ||
          selectedDoubt?.text ||
          selectedDoubt?.text_en ||
          '') as string;

      if (!baseText) {
        setSelectedDoubtEnglish('(no text)');
        return;
      }

      const detected = detectLang(baseText);
      if (detected === 'en') {
        setSelectedDoubtEnglish(baseText);
      } else {
        const translated = await toEnglishViaApi(baseText, detected);
        setSelectedDoubtEnglish(translated);
      }
    })();

    return () => unsub();
  }, [selectedDoubt]);

  /* -------------------------------------------------------
     Translate incoming student messages
  ------------------------------------------------------- */
  useEffect(() => {
    if (!selectedDoubt || !messages.length) return;

    messages.forEach((msg) => {
      const isStudent = msg.senderRole === 'student';
      if (!isStudent) return;

      const msgId = msg.id;
      if (translatedMsgMap[msgId] !== undefined || isTranslating[msgId]) return;

      const source = (msg.text_original || msg.text || '').toString().trim();
      if (!source) {
        setTranslatedMsgMap((prev) => ({ ...prev, [msgId]: '(empty message)' }));
        return;
      }

      const detected = detectLang(source);
      if (detected === 'en') {
        setTranslatedMsgMap((prev) => ({ ...prev, [msgId]: source }));
        return;
      }

      setIsTranslating((prev) => ({ ...prev, [msgId]: true }));
      toEnglishViaApi(source, detected).then((en) => {
        setTranslatedMsgMap((prev) => ({ ...prev, [msgId]: en }));
        setIsTranslating((prev) => ({ ...prev, [msgId]: false }));
      });
    });
  }, [messages, selectedDoubt, translatedMsgMap, isTranslating]);

  /* -------------------------------------------------------
     Send teacher reply
  ------------------------------------------------------- */
  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedDoubt || !user) return;

    const englishInput = newMessage.trim();
    setNewMessage('');

    try {
      const baseText: string =
        (selectedDoubt?.text_original ||
          selectedDoubt?.text ||
          selectedDoubt?.text_en ||
          '') as string;
      const detected = detectLang(baseText);
      const studentLang = ((selectedDoubt.language as string) || detected || 'en').toLowerCase();

      const localized = await fromEnglishViaApi(englishInput, studentLang);

      await addTeacherMessage({
        doubtId: selectedDoubt.id,
        teacher: { uid: user.uid, displayName: user.displayName || 'Teacher' },
        text_en: englishInput,
        text_original: localized,
        studentLanguage: studentLang,
      });
    } catch (e: any) {
      console.error('Error sending message:', e);
      alert(e?.message || 'Failed to send your message.');
      setNewMessage(englishInput);
    }
  };

  /* -------------------------------------------------------
     Group doubts by class
  ------------------------------------------------------- */
  const doubtsByClass = useMemo(() => {
    const grouped: Record<number, any[]> = {};
    
    doubts.forEach((doubt) => {
      const classNum = parseInt(doubt.classGrade) || 0;
      if (!grouped[classNum]) {
        grouped[classNum] = [];
      }
      grouped[classNum].push(doubt);
    });

    // Sort classes in ascending order
    const sortedClasses = Object.keys(grouped)
      .map(Number)
      .sort((a, b) => a - b);

    return sortedClasses.map((classNum) => ({
      class: classNum,
      doubts: grouped[classNum],
    }));
  }, [doubts]);

  if (loading)
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-purple-700" />
      </div>
    );

  /* -------------------------------------------------------
     UI - Tabular Format by Class
  ------------------------------------------------------- */
  return (
    <div className="relative min-h-screen bg-gradient-to-br from-[#E8FFF8] via-[#FFF0F6] to-[#FFF9E7] p-8">
      <h1 className="text-4xl font-bold text-purple-700 mb-8 text-center">
        Doubt Solver 💬
      </h1>

      {/* Doubts Table by Class */}
      {!selectedDoubt && (
        <div className="max-w-7xl mx-auto space-y-8">
          {doubtsByClass.length === 0 && (
            <p className="text-center text-gray-600 mt-20">
              No new doubts yet for {teacherSubject}
              {teacherClass ? ` (Class ${teacherClass})` : ''}.
            </p>
          )}

          {doubtsByClass.map(({ class: classNum, doubts: classDoubts }) => (
            <div key={classNum} className="bg-white/90 backdrop-blur-md rounded-2xl shadow-xl p-6 border border-purple-200">
              <h2 className="text-2xl font-bold text-purple-800 mb-4">
                Class {classNum} Doubts
              </h2>
              
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-purple-100 border-b-2 border-purple-300">
                      <th className="text-left p-4 font-semibold text-purple-900">Subject</th>
                      <th className="text-left p-4 font-semibold text-purple-900">Question</th>
                      <th className="text-left p-4 font-semibold text-purple-900">Chapter</th>
                      <th className="text-left p-4 font-semibold text-purple-900">Status</th>
                      <th className="text-center p-4 font-semibold text-purple-900">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {classDoubts.map((doubt, idx) => {
                      const previewEN = previewEnMap[doubt.id] ?? '(loading preview...)';
                      return (
                        <tr
                          key={doubt.id}
                          className={`border-b border-purple-100 hover:bg-purple-50 transition ${
                            idx % 2 === 0 ? 'bg-white' : 'bg-purple-50/30'
                          }`}
                        >
                          <td className="p-4 text-purple-700 font-medium">
                            {doubt.subject}
                          </td>
                          <td className="p-4 text-gray-800" lang="en" translate="no">
                            <div className="max-w-md truncate" title={previewEN}>
                              {previewEN}
                            </div>
                          </td>
                          <td className="p-4 text-gray-600">
                            {doubt.chapter}
                          </td>
                          <td className="p-4">
                            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                              doubt.status === 'Pending' 
                                ? 'bg-yellow-100 text-yellow-800'
                                : doubt.status === 'Active'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              {doubt.status || 'Pending'}
                            </span>
                          </td>
                          <td className="p-4 text-center">
                            <Button
                              onClick={() => setSelectedDoubt(doubt)}
                              size="sm"
                              className="bg-purple-600 hover:bg-purple-700 text-white"
                            >
                              View
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Chat Interface (unchanged) */}
      {selectedDoubt && (
        <div className="relative max-w-3xl mx-auto bg-white/90 backdrop-blur-md border border-purple-200 rounded-2xl shadow-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="outline"
              onClick={() => setSelectedDoubt(null)}
              className="border-purple-300 text-purple-700 hover:bg-purple-50"
            >
              ← Back to Doubts
            </Button>
            <Button
              onClick={() => router.push(`/call/${selectedDoubt.id}`)}
              className="bg-pink-500 hover:bg-pink-600 text-white"
            >
              <Phone className="h-4 w-4 mr-2" /> Call
            </Button>
          </div>

          <h2 className="text-2xl font-bold text-purple-800 mb-2">
            {selectedDoubt.chapter} (
            {selectedDoubt.subject}
            {selectedDoubt.classGrade ? ` • Class ${selectedDoubt.classGrade}` : ''})
          </h2>

          <p className="text-gray-700 mb-4">
            <span className="font-semibold">Student Doubt (EN): </span>
            <span lang="en" translate="no" className="font-medium">
              {selectedDoubtEnglish}
            </span>
          </p>

          {/* Chat Messages */}
          <div className="h-80 overflow-y-auto border border-purple-100 rounded-xl p-4 bg-purple-50/50 mb-4">
            {messages.length === 0 && (
              <p className="text-center text-gray-500">No messages yet.</p>
            )}
            {messages.map((msg) => {
              const isTeacher = msg.senderRole === 'teacher' || msg.senderId === user?.uid;

              let display = '';
              if (isTeacher) {
                display = (msg.text_en || msg.text_original || msg.text || '').trim();
              } else {
                const candidate = translatedMsgMap[msg.id];
                display =
                  candidate === undefined || isTranslating[msg.id] ? '(translating...)' : candidate;
              }

              if (!display && !isTranslating[msg.id]) display = '(empty message)';

              return (
                <div
                  key={msg.id}
                  className={`my-2 flex ${isTeacher ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`p-3 rounded-2xl max-w-xs ${
                      isTeacher
                        ? 'bg-purple-300 text-white'
                        : 'bg-white border border-purple-100 text-gray-800'
                    }`}
                  >
                    <p className="text-sm">
                      {isTranslating[msg.id] && (
                        <Loader2 className="inline-block h-3 w-3 animate-spin mr-1" />
                      )}
                      {display}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Input Area */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage();
            }}
            className="flex items-center gap-3"
          >
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type your reply in English…"
              className="flex-1 border border-purple-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-400"
            />
            <Button type="submit" className="bg-purple-600 hover:bg-purple-700 text-white">
              <MessageCircle className="h-4 w-4 mr-2" /> Send
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}
