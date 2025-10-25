import { NextResponse } from 'next/server';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

type TranslateRequestBody = {
  text: string;
  targetLang: string; // e.g., 'en', 'hi'
  sourceLang?: string; // e.g., 'hi', 'en'
};

const langMap: Record<string, string> = {
  en: 'English',
  hi: 'Hindi',
  bn: 'Bengali',
  pa: 'Punjabi',
  ta: 'Tamil',
  as: 'Assamese',
  mr: 'Marathi',
};

/** Tiny heuristic:
 * - Devanagari => 'hi'
 * - ASCIIish with no Devanagari => 'en'
 * - otherwise undefined (let model auto-detect)
 */
function detectLang(str: string): 'en' | 'hi' | undefined {
  if (!str) return undefined;
  if (/[\u0900-\u097F]/.test(str)) return 'hi';
  if (/^[\x00-\x7F\s.,;:'"?!()\[\]\-_/\\0-9A-Za-z]+$/.test(str)) return 'en';
  return undefined;
}

export async function POST(request: Request) {
  // 1) API key present?
  if (!GEMINI_API_KEY) {
    console.error('SERVER ERROR in /api/translate-text: GEMINI_API_KEY is not set.');
    try {
      const body = (await request.json()) as Partial<TranslateRequestBody>;
      return NextResponse.json({ translatedText: `[Server Config Error] ${body?.text ?? ''}` });
    } catch {
      return NextResponse.json({ translatedText: '[Server Config Error]' });
    }
  }

  let originalText = '';

  try {
    const body: TranslateRequestBody = await request.json();
    const { text, targetLang, sourceLang } = body;
    originalText = text;

    if (!text || !targetLang) {
      return NextResponse.json(
        { error: 'Missing required parameters: text and targetLang' },
        { status: 400 }
      );
    }

    const target = targetLang.toLowerCase();
    const detected = detectLang(text);

    // If detected language already equals target, no need to call the API
    if (detected && detected === target) {
      return NextResponse.json({ translatedText: text });
    }

    // Use detected if available; else use provided hint; else undefined (auto-detect)
    const sourceHint = (detected ?? sourceLang?.toLowerCase()) as string | undefined;

    const targetLanguageName = langMap[target] || target;
    const sourceLanguageName = sourceHint ? (langMap[sourceHint] || sourceHint) : null;

    let promptText = `Translate the following text into ${targetLanguageName}.`;
    if (sourceLanguageName) {
      promptText += ` Assume the source language is ${sourceLanguageName}.`;
    } else {
      promptText += ` Automatically detect the source language.`;
    }
    promptText += ` Respond ONLY with the translated text, without any introductory phrases, explanations, formatting, or quotation marks.\n\nText to translate:\n${text}`;

    const googleApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

    const response = await fetch(googleApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptText }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 1024 },
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`GEMINI API ERROR (${response.status}) in /api/translate-text: ${errorBody}`);
      return NextResponse.json({ translatedText: `[API Error ${response.status}] ${originalText}` });
    }

    const data = await response.json();
    const translated = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';

    const finishReason = data?.candidates?.[0]?.finishReason;
    if (finishReason && finishReason !== 'STOP') {
      console.warn(`[API /api/translate-text] Gemini finishReason: ${finishReason}`);
    }

    const resultText = translated || `[Translation Failed] ${originalText}`;
    return NextResponse.json({ translatedText: resultText });
  } catch (error: any) {
    console.error('UNEXPECTED ERROR in /api/translate-text:', error);
    return NextResponse.json({ translatedText: `[Unexpected Error] ${originalText}` });
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
