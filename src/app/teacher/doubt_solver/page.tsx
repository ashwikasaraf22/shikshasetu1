'use client';

import { useAuth } from '@/components/auth/AuthProvider';
import { db } from '@/lib/firebase';
import {
  collection,
  query as fq,
  where,
  onSnapshot,
  orderBy,
  doc
} from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { MessageCircle, Phone, Loader2, ArrowLeft } from 'lucide-react'; // Added ArrowLeft for back button icon
import { addTeacherMessage } from '@/lib/db';
import { useRouter } from 'next/navigation';

// --- API Translation Functions ---
async function translateViaApi(text: string, targetLang: string, sourceLang?: string): Promise<string> {
  if (!text?.trim()) return '';
  const normSource = sourceLang?.toLowerCase() || '';
  const normTarget = targetLang?.toLowerCase() || '';
  if (normTarget === normSource || (normTarget === 'en' && !sourceLang)) {
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
  if (!input || sourceLang?.toLowerCase() === 'en') return input;
  return translateViaApi(input, 'en', sourceLang);
}

async function fromEnglishViaApi(input: string, targetLang: string): Promise<string> {
  if (!input || targetLang?.toLowerCase() === 'en') return input;
  return translateViaApi(input, targetLang, 'en');
}
// --- End API Translation Functions ---

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

  // --- Load doubts ---
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
          let previewsChanged = false;
          const nextPreviews = { ...currentPreviews };

          for (const d of data) {
            if (nextPreviews[d.id] !== undefined) continue;

            const baseText = d.text_original || d.text || d.text_en || '';
            if (baseText && d.language !== 'en') {
              nextPreviews[d.id] = '(translating preview...)';
              previewsChanged = true;
              toEnglishViaApi(baseText, d.language).then((translatedText) => {
                setPreviewEnMap((prevMap) => ({ ...prevMap, [d.id]: translatedText }));
              });
            } else {
              nextPreviews[d.id] = baseText || '';
              if (currentPreviews[d.id] === undefined) previewsChanged = true;
            }
          }
          return previewsChanged ? nextPreviews : currentPreviews;
        });
      },
      (err) => console.error('onSnapshot(doubts) error:', err)
    );

    return () => unsub();
  }, [user, loading, teacherSubject, teacherClass]);

  // --- Load messages ---
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
      const baseText = selectedDoubt?.text_original || selectedDoubt?.text || selectedDoubt?.text_en || '';
      if (!baseText) {
        setSelectedDoubtEnglish('(no text)');
        return;
      }
      const initialLang = selectedDoubt?.language || 'en';
      const translated =
        initialLang.toLowerCase() === 'en'
          ? baseText
          : await toEnglishViaApi(baseText, initialLang);
      setSelectedDoubtEnglish(translated);
    })();

    return () => unsub();
  }, [selectedDoubt]);

  // --- Translate student messages ---
  useEffect(() => {
    if (!selectedDoubt || !messages.length) return;

    messages.forEach((msg) => {
      const isStudent = msg.senderRole === 'student';
      if (!isStudent) return;

      const msgId = msg.id;
      if (translatedMsgMap[msgId] === undefined && !isTranslating[msgId]) {
        const source = (msg.text_original || msg.text || '').trim();
        const sourceLang = msg.language || selectedDoubt?.language || 'en';

        if (source && sourceLang.toLowerCase() !== 'en') {
          setIsTranslating((prev) => ({ ...prev, [msgId]: true }));
          toEnglishViaApi(source, sourceLang).then((en) => {
            setTranslatedMsgMap((prev) => ({ ...prev, [msgId]: en }));
            setIsTranslating((prev) => ({ ...prev, [msgId]: false }));
          });
        } else if (source) {
          setTranslatedMsgMap((prev) => ({ ...prev, [msgId]: source }));
        }
      }
    });
  }, [messages, selectedDoubt]);

  // --- Send message ---
  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedDoubt || !user) return;

    const englishInput = newMessage.trim();
    setNewMessage('');

    try {
      const studentLang = (selectedDoubt.language || 'en') as string;
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

  if (loading)
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-purple-700" />
      </div>
    );

  // --- JSX Rendering ---
  return (
    <div className="relative min-h-screen bg-gradient-to-br from-[#E8FFF8] via-[#FFF0F6] to-[#FFF9E7] p-8">
      {/* Top Section with Back Button */}
      <div className="flex items-center justify-between mb-8">
        <Button
          variant="outline"
          onClick={() => router.push('/teacher')}
          className="border-purple-300 text-purple-700 hover:bg-purple-50"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>
        <h1 className="text-3xl sm:text-4xl font-bold text-purple-700 text-center flex-1">
          Doubt Solver 💬
        </h1>
        <div className="w-[150px]" /> {/* Spacer to keep heading centered */}
      </div>

      {/* Doubts List */}
      {!selectedDoubt && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {doubts.map((doubt) => {
            const previewEN = previewEnMap[doubt.id] ?? '(loading preview...)';
            return (
              <Card
                key={doubt.id}
                className="cursor-pointer bg-white/80 border border-purple-100 shadow-lg hover:shadow-2xl hover:-translate-y-1 transition"
                onClick={() => setSelectedDoubt(doubt)}
              >
                <CardContent className="p-5">
                  <h2 className="text-lg font-semibold text-purple-700 mb-1">
                    {doubt.subject}
                    {doubt.classGrade ? ` • Class ${doubt.classGrade}` : ''}
                  </h2>
                  <p className="text-gray-800 font-medium">{previewEN}</p>
                  <p className="text-sm text-gray-500 mt-2">Chapter: {doubt.chapter}</p>
                  <p className="text-sm text-gray-500">Status: {doubt.status || 'Pending'}</p>
                </CardContent>
              </Card>
            );
          })}
          {doubts.length === 0 && (
            <p className="text-center text-gray-600 col-span-full mt-20">
              No new doubts yet for {teacherSubject}
              {teacherClass ? ` (Class ${teacherClass})` : ''}.
            </p>
          )}
        </div>
      )}

      {/* Chat Interface */}
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
            {selectedDoubt.chapter} ({selectedDoubt.subject}
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
                display = translatedMsgMap[msg.id];
                if (display === undefined || isTranslating[msg.id]) {
                  display = '(translating...)';
                }
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
