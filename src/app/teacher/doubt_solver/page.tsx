'use client';

import { useAuth } from '@/components/auth/AuthProvider';
import { db } from '@/lib/firebase';
import {
  collection,
  query as fq,
  where,
  onSnapshot,
  orderBy
} from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { MessageCircle, Phone } from 'lucide-react';
import { addTeacherMessage } from '@/lib/db';
import { useRouter } from 'next/navigation';

// === Gemini translator ===
// Tries browser-exposed key first; gracefully falls back if missing.
const GEMINI_API_KEY =
  (process.env.NEXT_PUBLIC_GEMINI_API_KEY as string | undefined) ||
  (process.env.GEMINI_API_KEY as string | undefined);

async function translateWithGemini(input: string, targetLang: string): Promise<string> {
  if (!input?.trim()) return '';
  if (!GEMINI_API_KEY) return input; // show original if no key

  const langMap: Record<string, string> = {
    en: 'English',
    hi: 'Hindi',
    bn: 'Bengali',
    pa: 'Punjabi',
    ta: 'Tamil',
    as: 'Assamese',
    mr: 'Marathi',
  };
  const target = langMap[targetLang.toLowerCase()] || targetLang;

  try {
    const res = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=' + GEMINI_API_KEY,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text:
                    `Translate the following text into ${target}. ` +
                    `Return only the translated text with no extra commentary, quotes, or markup.\n\n` +
                    input,
                },
              ],
            },
          ],
          generationConfig: { temperature: 0.2 },
        }),
      }
    );

    if (!res.ok) return input;

    const data = await res.json();
    const text =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ??
      data?.candidates?.[0]?.content?.parts?.[0]?.inline_data ??
      '';

    return (typeof text === 'string' && text.trim()) ? text.trim() : input;
  } catch {
    return input;
  }
}

export default function DoubtSolverPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [doubts, setDoubts] = useState<any[]>([]);
  const [selectedDoubt, setSelectedDoubt] = useState<any | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');

  // EN versions
  const [selectedDoubtEnglish, setSelectedDoubtEnglish] = useState<string>('');     // translated student doubt for teacher
  const [translatedMsgMap, setTranslatedMsgMap] = useState<Record<string, string>>({}); // per-message EN cache
  const [previewEnMap, setPreviewEnMap] = useState<Record<string, string>>({});     // card previews in EN

  // Teacher profile fields (adapt if your user profile stores differently)
  const teacherSubject = (user as any)?.subject || 'Science';
  const teacherClass = (user as any)?.classGrade || null;

  // --- Load doubts related to teacher's subject (+ class if available)
  useEffect(() => {
    if (loading || !user) return;

    const base = collection(db, 'doubts');
    const q = teacherClass
      ? fq(base, where('subject', '==', teacherSubject), where('classGrade', '==', teacherClass))
      : fq(base, where('subject', '==', teacherSubject));

    const unsub = onSnapshot(
      q,
      async (snap) => {
        const data = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          // Only show doubts that are unassigned or assigned to this teacher
          .filter((d: any) => !d.assignedTo || d.assignedTo === user.uid)
          // Sort by lastUpdatedAt desc (client side)
          .sort((a: any, b: any) => {
            const sa = a.lastUpdatedAt?.seconds ?? a.createdAt?.seconds ?? 0;
            const sb = b.lastUpdatedAt?.seconds ?? b.createdAt?.seconds ?? 0;
            return sb - sa;
          });

        setDoubts(data);

        // Build/refresh EN previews for the cards
        const newPreviewMap: Record<string, string> = { ...previewEnMap };
        for (const d of data) {
          if (newPreviewMap[d.id]) continue; // already have it
          const baseText = d.text_en || d.text_original || d.text || '';
          if (!baseText) {
            newPreviewMap[d.id] = '';
            continue;
          }
          if (d.text_en || (d.language || 'en') === 'en') {
            newPreviewMap[d.id] = d.text_en || baseText;
          } else {
            // translate once and cache
            const tr = await translateWithGemini(baseText, 'en');
            newPreviewMap[d.id] = tr || baseText;
          }
        }
        setPreviewEnMap(newPreviewMap);
      },
      (err) => {
        console.error('onSnapshot(doubts) error:', err);
      }
    );

    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loading, teacherSubject, teacherClass]);

  // --- Load chat messages & translate student's original text to EN for the teacher view
  useEffect(() => {
    if (!selectedDoubt) return;

    // 1) subscribe messages
    const msgRef = collection(db, 'doubts', selectedDoubt.id, 'messages');
    const q = fq(msgRef, orderBy('timestamp', 'asc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const arr = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
        setMessages(arr);
      },
      (err) => console.error('onSnapshot(messages) error:', err)
    );

    // 2) translate the student's initial doubt to English if needed
    (async () => {
      const baseText =
        selectedDoubt?.text_en ||
        selectedDoubt?.text_original ||
        selectedDoubt?.text ||
        '';
      const lang = selectedDoubt?.language || 'en';

      if (!baseText) {
        setSelectedDoubtEnglish('');
        return;
      }
      if (selectedDoubt?.text_en || lang === 'en') {
        setSelectedDoubtEnglish(selectedDoubt?.text_en || baseText);
      } else {
        const translated = await translateWithGemini(baseText, 'en');
        setSelectedDoubtEnglish(translated);
      }
    })();

    // reset cache on doubt change
    setTranslatedMsgMap({});

    return () => unsub();
  }, [selectedDoubt]);

  // --- Translate incoming student messages (without text_en) → English, cache per message
  useEffect(() => {
    (async () => {
      if (!selectedDoubt || !messages.length) return;
      const studentLang = selectedDoubt.language || 'en';

      const updates: Record<string, string> = {};
      for (const msg of messages) {
        const isStudent = msg.senderRole === 'student';
        const alreadyCached = translatedMsgMap[msg.id] !== undefined;
        const hasEnglish = !!msg.text_en;
        const source = msg.text_original || msg.text || '';

        if (!isStudent) continue;              // only translate student's messages for teacher view
        if (hasEnglish) continue;              // no need if English already stored
        if (!source) continue;                 // nothing to translate
        if (alreadyCached) continue;           // already translated/cached

        const en = studentLang === 'en' ? source : await translateWithGemini(source, 'en');
        updates[msg.id] = en;
      }
      if (Object.keys(updates).length) {
        setTranslatedMsgMap((prev) => ({ ...prev, ...updates }));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, selectedDoubt]);

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedDoubt || !user) return;

    try {
      const english = newMessage.trim();
      const studentLang = (selectedDoubt.language || 'en') as string;

      // Translate teacher EN → student's language
      const localized =
        studentLang === 'en'
          ? english
          : await translateWithGemini(english, studentLang);

      await addTeacherMessage({
        doubtId: selectedDoubt.id,
        teacher: { uid: user.uid, displayName: user.displayName || 'Teacher' },
        text_en: english,          // teacher's EN message (for teacher view)
        text_original: localized,  // localized for student
        studentLanguage: studentLang,
      });

      setNewMessage('');
    } catch (e: any) {
      alert(e?.message || 'Failed to send your message.');
    }
  };

  if (loading) return <p className="text-center mt-20 text-gray-500">Loading...</p>;

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-[#E8FFF8] via-[#FFF0F6] to-[#FFF9E7] p-8">
      <h1 className="text-4xl font-bold text-purple-700 mb-8 text-center">Doubt Solver 💬</h1>

      {/* Doubts List */}
      {!selectedDoubt && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {doubts.map((doubt) => {
            const basePreview = doubt.text_en || doubt.text_original || doubt.text || '';
            // Always show EN preview (either stored or translated/cached)
            const previewEN = previewEnMap[doubt.id] || basePreview;

            return (
              <Card
                key={doubt.id}
                className="cursor-pointer bg-white/80 border border-purple-100 shadow-lg hover:shadow-2xl hover:-translate-y-1 transition"
                onClick={() => setSelectedDoubt(doubt)}
              >
                <CardContent className="p-5">
                  <h2 className="text-lg font-semibold text-purple-700 mb-1">
                    {doubt.subject} {doubt.classGrade ? `• Class ${doubt.classGrade}` : ''}
                  </h2>
                  <p className="text-gray-800 font-medium">
                    {previewEN}
                  </p>
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
              title="Start call with the student"
            >
              <Phone className="h-4 w-4 mr-2" /> Call
            </Button>
          </div>

          <h2 className="text-2xl font-bold text-purple-800 mb-2">
            {selectedDoubt.chapter} ({selectedDoubt.subject}
            {selectedDoubt.classGrade ? ` • Class ${selectedDoubt.classGrade}` : ''})
          </h2>

          {/* Teacher sees the student's doubt in EN (translated if needed) */}
          <p className="text-gray-700 mb-4">
            Student Doubt (EN): {selectedDoubtEnglish || '(no text)'}
          </p>

          {/* Chat Messages */}
          <div className="h-80 overflow-y-auto border border-purple-100 rounded-xl p-4 bg-purple-50/50 mb-4">
            {messages.length === 0 && (
              <p className="text-center text-gray-500">No messages yet. Start the discussion!</p>
            )}
            {messages.map((msg) => {
              const isTeacher = msg.senderRole === 'teacher' || msg.senderId === user?.uid;

              // Teacher view shows English: prefer stored text_en; otherwise use translated cache
              const source = msg.text_en || msg.text_original || msg.text || '';
              const display = !msg.text_en && translatedMsgMap[msg.id]
                ? translatedMsgMap[msg.id]
                : source;

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
                    <p className="text-sm">{display}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Input Area */}
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type your reply in English…"
              className="flex-1 border border-purple-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-400"
            />
            <Button onClick={sendMessage} className="bg-purple-600 hover:bg-purple-700 text-white">
              <MessageCircle className="h-4 w-4 mr-2" /> Send
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
