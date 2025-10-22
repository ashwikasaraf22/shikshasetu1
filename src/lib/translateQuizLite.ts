// src/lib/translateQuizLite.ts
// Loads local quiz JSON files, supports multiple languages with smart fallbacks.
// Updated to be robust when only a single Hindi JSON exists and to match
// Subject/Chapter/Difficulty keys case-/space-insensitively.

export type Option = { label: string; value: string };
export type Question = {
  id: string;
  text: string;
  options: Option[];
  correctIndex: number;
};

const LANG_MAP: Record<string, string> = {
  en: "en",
  english: "en",
  hi: "hi",
  hindi: "hi",
  mr: "mr",
  marathi: "mr",
  bn: "bn",
  bengali: "bn",
  ta: "ta",
  tamil: "ta",
  te: "te",
  telugu: "te",
  pa: "pa",
  punjabi: "pa",
  as: "as",
  assamese: "as",
  // convenience aliases
  tm: "ta",
  pn: "pa",
};

export function normalizeLang(input?: string | null): string {
  if (!input) return "en";
  const key = String(input).trim().toLowerCase();
  return LANG_MAP[key] || "en";
}

/* --------------------------- Internal helpers --------------------------- */

// Normalize a key for forgiving lookups: lowercase + collapse spaces + strip punctuation
function normKey(s: string) {
  return String(s)
    .toLowerCase()
    .replace(/[\s_\-’'".,()]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

// Find a property in an object using forgiving key comparison
function pick<T extends Record<string, any>>(obj: T | undefined, key: string) {
  if (!obj) return undefined as any;
  const want = normKey(key);
  for (const k of Object.keys(obj)) {
    if (normKey(k) === want) return (obj as any)[k];
  }
  return undefined as any;
}

// Try reading JSON from a list of candidate URLs, returning the first valid parsed object
async function loadFirstAvailable(paths: string[]): Promise<any | null> {
  for (const p of paths) {
    try {
      const res = await fetch(p, { cache: "no-store" });
      if (!res.ok) continue;
      return await res.json();
    } catch {
      // try next
    }
  }
  return null;
}

/* --------------------------------- API --------------------------------- */
/**
 * Loads quiz questions from static JSON.
 * Order of attempts:
 *   1) /quiz/quiz_i18n_<lang>.json
 *   2) /quiz_i18n_<lang>.json
 *   3) /quiz/quiz_i18n_en.json
 *   4) /quiz_i18n_en.json
 *
 * This allows your setup where you currently have only **Hindi**:
 *   place the file at /public/quiz_i18n_hi.json   (or /public/quiz/quiz_i18n_hi.json)
 *
 * Extraction is forgiving for Subject / Chapter / Difficulty names.
 */
export async function fetchQuizByLanguage(
  lang: string,
  grade: string,
  subject: string,
  chapter: string,
  difficulty: string = "Easy"
): Promise<Question[]> {
  const code = normalizeLang(lang);

  // Candidate URLs to try (root and /quiz subfolder, both lang and English)
  const langCandidates = [
    `/quiz/quiz_i18n_${code}.json`,
    `/quiz_i18n_${code}.json`,
  ];
  const enCandidates = [`/quiz/quiz_i18n_en.json`, `/quiz_i18n_en.json`];

  // Load language file (or fallback English file)
  let data = await loadFirstAvailable(langCandidates);

  // If language file missing, try English
  if (!data) {
    data = await loadFirstAvailable(enCandidates);
    if (!data) {
      console.error(
        "[translateQuizLite] Could not load any quiz file (lang or English)."
      );
      return [];
    }
  }

  // Helper to extract questions with forgiving key matches
  function extractQuestionsFrom(tree: any): Question[] {
    const g = tree?.[String(grade)];
    if (!g) return [];

    const subj = pick(g, subject);
    if (!subj) return [];

    const ch = pick(subj, chapter);
    if (!ch) return [];

    // Difficulty could be "Easy" etc. Make it forgiving too.
    const diffBlock =
      ch[difficulty] ?? pick(ch, difficulty) ?? ch["Easy"] ?? pick(ch, "Easy");

    return Array.isArray(diffBlock) ? (diffBlock as Question[]) : [];
  }

  // First, try extracting from the selected language (if loaded); if empty, try English
  let questions = extractQuestionsFrom(data);

  if ((!questions || questions.length === 0) && code !== "en") {
    const fallback = await loadFirstAvailable(enCandidates);
    if (fallback) {
      questions = extractQuestionsFrom(fallback);
    }
  }

  // Final guard
  return Array.isArray(questions) ? questions : [];
}

/* Compatibility no-ops kept for existing imports */
export async function preloadTranslationCache(_: string) {
  return;
}
export async function translateQuestionsOnTheFly(
  base: Question[],
  _target: string
): Promise<Question[]> {
  return base;
}
