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
import { MessageCircle, Phone, Loader2 } from 'lucide-react'; // Import Loader2
import { addTeacherMessage } from '@/lib/db';
import { useRouter } from 'next/navigation';

// --- API Translation Functions ---
// Calls our backend API route (/api/translate-text)
async function translateViaApi(text: string, targetLang: string, sourceLang?: string): Promise<string> {
  if (!text?.trim()) return '';
  // Don't translate if target is the same as source (or if target is English and source isn't specified but likely English)
  const normSource = sourceLang?.toLowerCase() || '';
  const normTarget = targetLang?.toLowerCase() || '';
  if (normTarget === normSource || (normTarget === 'en' && !sourceLang)) {
      // console.log(`Skipping translation for "${text}" from ${sourceLang} to ${targetLang}`);
      return text;
  }

  try {
    // console.log(`Calling API to translate "${text}" from ${sourceLang} to ${targetLang}`);
    const response = await fetch('/api/translate-text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, targetLang, sourceLang }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Translation API Error (${response.status}): ${errorText}`);
      return `[API Error] ${text}`; // Return original text with error prefix
    }

    const data = await response.json();
    // console.log(`API response for "${text}":`, data);
    // Return translated text or original text with a failure prefix
    return data.translatedText || `[Translation Failed] ${text}`;

  } catch (error) {
    console.error('Error calling translation API:', error);
    return `[Network Error] ${text}`; // Return original text with error prefix
  }
}

// Helper specifically for translating to English via the API
async function toEnglishViaApi(input: string, sourceLang?: string): Promise<string> {
    if (!input || sourceLang?.toLowerCase() === 'en') return input;
    return translateViaApi(input, 'en', sourceLang);
}

// Helper specifically for translating from English via the API
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

  // EN versions state
  const [selectedDoubtEnglish, setSelectedDoubtEnglish] = useState<string>('');
  const [translatedMsgMap, setTranslatedMsgMap] = useState<Record<string, string>>({}); // { messageId: englishTranslation }
  const [previewEnMap, setPreviewEnMap] = useState<Record<string, string>>({}); // { doubtId: englishPreview }
  const [isTranslating, setIsTranslating] = useState<Record<string, boolean>>({}); // Track loading state per message

  // Teacher profile fields
  const teacherSubject = (user as any)?.subject || 'Science';
  const teacherClass = (user as any)?.classGrade || null;

  // --- Load doubts (Uses API for preview translation) ---
  useEffect(() => {
    if (loading || !user) return;

    const base = collection(db, 'doubts');
    const q = teacherClass
      ? fq(base, where('subject', '==', teacherSubject), where('classGrade', '==', teacherClass))
      : fq(base, where('subject', '==', teacherSubject));

    const unsub = onSnapshot(
      q,
      (snap) => {
        setPreviewEnMap(currentPreviews => {
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
              if (baseText && d.language !== 'en') { // Only translate if not already English
                 nextPreviews[d.id] = '(translating preview...)';
                 previewsChanged = true;
                 toEnglishViaApi(baseText, d.language).then(translatedText => {
                     setPreviewEnMap(prevMap => ({ ...prevMap, [d.id]: translatedText }));
                 });
              } else {
                 nextPreviews[d.id] = baseText || ''; // Show original if English or empty
                 if (currentPreviews[d.id] === undefined) previewsChanged = true; // Mark change if setting for first time
              }
            }
            return previewsChanged ? nextPreviews : currentPreviews;
        });
      },
      (err) => console.error('onSnapshot(doubts) error:', err)
    );

    return () => unsub();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loading, teacherSubject, teacherClass]);

  // --- Load messages & Translate initial doubt (Uses API) ---
  useEffect(() => {
    if (!selectedDoubt) {
        setMessages([]);
        setSelectedDoubtEnglish('');
        setTranslatedMsgMap({});
        setIsTranslating({}); // Clear loading states
        return;
    };

    setSelectedDoubtEnglish('(translating initial doubt...)');

    const msgRef = collection(db, 'doubts', selectedDoubt.id, 'messages');
    const q = fq(msgRef, orderBy('timestamp', 'asc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const arr = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
        setMessages(arr);
        // Reset translation map and loading state when messages reload
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
        setSelectedDoubtEnglish('(no text)'); return;
      }
      // Translate only if needed
      const initialLang = selectedDoubt?.language || 'en';
      const translated = initialLang.toLowerCase() === 'en' ? baseText : await toEnglishViaApi(baseText, initialLang);
      setSelectedDoubtEnglish(translated);
    })();

    // No need to reset translatedMsgMap here, done in snapshot handler
    return () => unsub();
  }, [selectedDoubt]);

  // --- Translate incoming student messages (Uses API) ---
  useEffect(() => {
     if (!selectedDoubt || !messages.length) return;

      messages.forEach(msg => {
          const isStudent = msg.senderRole === 'student';
          if (!isStudent) return; // Skip teacher messages

          const msgId = msg.id;
          // Only trigger translation if not already done, not currently loading, and not already English
          if (translatedMsgMap[msgId] === undefined && !isTranslating[msgId]) {
              const source = (msg.text_original || msg.text || '').trim(); // Prioritize original
              const sourceLang = msg.language || selectedDoubt?.language || 'en'; // Get language hint

              if (source && sourceLang.toLowerCase() !== 'en') {
                  // Mark as loading
                  setIsTranslating(prev => ({ ...prev, [msgId]: true }));
                  // console.log(`Starting translation for ${msgId}...`);

                  toEnglishViaApi(source, sourceLang).then(en => {
                      // console.log(`Finished translation for ${msgId}: ${en}`);
                      setTranslatedMsgMap(prev => ({ ...prev, [msgId]: en }));
                      setIsTranslating(prev => ({ ...prev, [msgId]: false })); // Mark as done
                  });
              } else if (source) {
                  // If it's already English or source is empty, store the source directly
                  setTranslatedMsgMap(prev => ({ ...prev, [msgId]: source }));
              }
          }
      });

  // Depend on messages array itself to re-trigger when new messages arrive
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, selectedDoubt]);


  // --- Send Message (Uses API for translating teacher's reply) ---
  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedDoubt || !user) return;

    const englishInput = newMessage.trim();
    setNewMessage(''); // Clear input immediately

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
      console.error("Error sending message:", e);
      alert(e?.message || 'Failed to send your message.');
      setNewMessage(englishInput); // Restore input on error
    }
  };

  if (loading) return (
      <div className="flex h-screen items-center justify-center">
          <Loader2 className="h-12 w-12 animate-spin text-purple-700" />
      </div>
  );

  // --- JSX Rendering ---
  return (
    <div className="relative min-h-screen bg-gradient-to-br from-[#E8FFF8] via-[#FFF0F6] to-[#FFF9E7] p-8">
      <h1 className="text-4xl font-bold text-purple-700 mb-8 text-center">Doubt Solver 💬</h1>

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
                    {doubt.subject}{doubt.classGrade ? ` • Class ${doubt.classGrade}` : ''}
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
              No new doubts yet for {teacherSubject}{teacherClass ? ` (Class ${teacherClass})` : ''}.
            </p>
          )}
        </div>
      )}

      {/* Chat Interface */}
      {selectedDoubt && (
        <div className="relative max-w-3xl mx-auto bg-white/90 backdrop-blur-md border border-purple-200 rounded-2xl shadow-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <Button variant="outline" onClick={() => setSelectedDoubt(null)} className="border-purple-300 text-purple-700 hover:bg-purple-50">
              ← Back to Doubts
            </Button>
            <Button onClick={() => router.push(`/call/${selectedDoubt.id}`)} className="bg-pink-500 hover:bg-pink-600 text-white">
              <Phone className="h-4 w-4 mr-2" /> Call
            </Button>
          </div>

          <h2 className="text-2xl font-bold text-purple-800 mb-2">
            {selectedDoubt.chapter} ({selectedDoubt.subject}{selectedDoubt.classGrade ? ` • Class ${selectedDoubt.classGrade}` : ''})
          </h2>
          <p className="text-gray-700 mb-4">
            <span className="font-semibold">Student Doubt (EN): </span>
            <span lang="en" translate="no" className="font-medium">{selectedDoubtEnglish}</span>
          </p>

          {/* Chat Messages */}
          <div className="h-80 overflow-y-auto border border-purple-100 rounded-xl p-4 bg-purple-50/50 mb-4">
            {messages.length === 0 && ( <p className="text-center text-gray-500">No messages yet.</p> )}
            {messages.map((msg) => {
              const isTeacher = msg.senderRole === 'teacher' || msg.senderId === user?.uid;

              // --- Simplified Display Logic ---
              let display = '';
              if (isTeacher) {
                // Teacher's message: Use text_en (what they typed)
                display = (msg.text_en || msg.text_original || msg.text || '').trim();
              } else {
                // Student's message: Use the map entry or show loading
                display = translatedMsgMap[msg.id];
                if (display === undefined || isTranslating[msg.id]) {
                    display = '(translating...)'; // Show generic loading state
                }
                 // If display contains '[API Error]' etc., it will show up here
              }
              // --- End Simplified Display Logic ---

              // Fallback for completely empty message data
              if (!display && !isTranslating[msg.id]) display = '(empty message)';

              return (
                <div key={msg.id} className={`my-2 flex ${isTeacher ? 'justify-end' : 'justify-start'}`}>
                  <div className={`p-3 rounded-2xl max-w-xs ${ isTeacher ? 'bg-purple-300 text-white' : 'bg-white border border-purple-100 text-gray-800'}`}>
                    <p className="text-sm">
                      {isTranslating[msg.id] && <Loader2 className="inline-block h-3 w-3 animate-spin mr-1" /> } {/* Add spinner */}
                      {display}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Input Area */}
          <form onSubmit={(e) => { e.preventDefault(); sendMessage(); }} className="flex items-center gap-3">
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
