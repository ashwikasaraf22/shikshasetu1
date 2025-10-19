// src/lib/translateQuizLite.ts
// Lightweight, batched translation helpers for the quiz page.
// Uses your /api/translate route and supports both single and array inputs.

export type Option = { label: string; value: string };
export type Question = {
  id: string;
  text: string;
  options: Option[];
  correctIndex: number;
};

// ---- Language normalization ----
const LANG_MAP: Record<string, string> = {
  en: 'en', english: 'en',
  hi: 'hi', hindi: 'hi',
  mr: 'mr', marathi: 'mr',
  bn: 'bn', bengali: 'bn',
  ta: 'ta', tamil: 'ta',
  te: 'te', telugu: 'te',
  gu: 'gu', gujarati: 'gu',
  kn: 'kn', kannada: 'kn',
  ml: 'ml', malayalam: 'ml',
  pa: 'pa', punjabi: 'pa',
  ur: 'ur', urdu: 'ur',
};

export function normalizeLang(input?: string | null): string {
  if (!input) return 'en';
  const key = String(input).trim().toLowerCase();
  return LANG_MAP[key] || 'en';
}

// ---- Thin client for /api/translate ----
async function callTranslateAPI(payload: { q: string | string[]; source?: string; target: string }) {
  const resp = await fetch('/api/translate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  // On error, bubble up the server's diagnostics to the console
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`Translate failed (${resp.status}): ${text}`);
  }
  return resp.json() as Promise<{ translated: string | string[] }>;
}

// Optional hint cache so repeated questions don’t re-hit the API during one session
const memCache = new Map<string, string>();

export async function preloadTranslationCache(target: string) {
  // no-op placeholder (kept to match your page’s calls)
  // Could pre-warm common UI strings if you want.
  return;
}

/**
 * Translate one quiz *question* (stem + all options) in ONE API call.
 * This massively reduces per-quiz API calls and avoids rate limits.
 */
async function translateOneQuestionBatched(
  q: Question,
  target: string,
  source: string = 'auto'
): Promise<Question> {
  if (!q || !q.text || !Array.isArray(q.options) || target === 'en') return q;

  // Build a batch array: [stem, opt0.value, opt1.value, ...]
  const items: string[] = [q.text, ...q.options.map(o => o.value)];

  // Try cache first (simple per-item memo within session)
  const uncachedIdx: number[] = [];
  const toSend: string[] = [];
  for (let i = 0; i < items.length; i++) {
    const key = `${target}::${items[i]}`;
    if (memCache.has(key)) continue;
    uncachedIdx.push(i);
    toSend.push(items[i]);
  }

  // If everything cached, just rebuild from cache
  if (toSend.length === 0) {
    const newStem = memCache.get(`${target}::${items[0]}`) || items[0];
    const newOpts = q.options.map((opt, i) => {
      const translatedVal = memCache.get(`${target}::${items[i + 1]}`) || opt.value;
      // Preserve your UI's "a) ..." labels by regenerating them
      const letter = String.fromCharCode(97 + i);
      return { label: `${letter}) ${translatedVal}`, value: translatedVal };
    });
    return { ...q, text: newStem, options: newOpts };
  }

  // Call API once for this question (batched)
  const { translated } = await callTranslateAPI({ q: toSend, source, target });

  // Merge API results back into the items in the original order
  const recv: string[] = Array.isArray(translated) ? translated : [translated];
  if (recv.length !== toSend.length) {
    // Fallback: do nothing if mismatch
    console.warn('translateOneQuestionBatched: length mismatch, falling back to English.');
    return q;
  }

  // Save into cache
  recv.forEach((out, j) => {
    const idx = uncachedIdx[j];
    memCache.set(`${target}::${items[idx]}`, out.trim());
  });

  // Rebuild final question object from cache (preserves correctIndex)
  const newStem = memCache.get(`${target}::${items[0]}`) || items[0];
  const newOpts = q.options.map((opt, i) => {
    const translatedVal = memCache.get(`${target}::${items[i + 1]}`) || opt.value;
    const letter = String.fromCharCode(97 + i);
    return { label: `${letter}) ${translatedVal}`, value: translatedVal };
  });

  return { ...q, text: newStem, options: newOpts };
}

/**
 * Translate an entire quiz array. Calls the API once per question (not per string).
 * If anything fails, we fall back to the original English content for that question.
 */
export async function translateQuestionsOnTheFly(
  baseQuestions: Question[],
  target: string,
  source: string = 'auto'
): Promise<Question[]> {
  if (!Array.isArray(baseQuestions) || baseQuestions.length === 0) return baseQuestions;
  if (!target || target === 'en') return baseQuestions;

  const out: Question[] = [];
  for (const q of baseQuestions) {
    try {
      const t = await translateOneQuestionBatched(q, target, source);
      out.push(t);
    } catch (e) {
      console.error('translateQuestionsOnTheFly error for question', q?.id, e);
      out.push(q); // graceful fallback to English for this question
    }
  }
  return out;
}
