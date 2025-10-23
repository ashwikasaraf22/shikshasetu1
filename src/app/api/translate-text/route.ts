// src/app/api/translate-text/route.ts
import { NextResponse } from 'next/server';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

type TranslateRequestBody = {
  text: string;
  targetLang: string; // e.g., 'en', 'hi'
  sourceLang?: string; // Optional: e.g., 'hi', 'en'
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

export async function POST(request: Request) {
  // --- 1. Check Server API Key ---
  if (!GEMINI_API_KEY) {
    console.error('SERVER ERROR in /api/translate-text: GEMINI_API_KEY is not set.');
    // Return a specific error message, keeping original text as fallback
    try {
      const body = await request.json();
      return NextResponse.json({ translatedText: `[Server Config Error] ${body.text}` });
    } catch {
      return NextResponse.json({ translatedText: '[Server Config Error]' });
    }
  }

  let originalText = ''; // Variable to hold original text for fallback

  try {
    const body: TranslateRequestBody = await request.json();
    const { text, targetLang, sourceLang } = body;
    originalText = text; // Store for fallback

    // --- 2. Validate Input ---
    if (!text || !targetLang) {
      console.warn('API WARNING in /api/translate-text: Missing text or targetLang.');
      return NextResponse.json(
        { error: 'Missing required parameters: text and targetLang' },
        { status: 400 }
      );
    }

    // --- 3. Prepare Prompt ---
    const targetLanguageName = langMap[targetLang.toLowerCase()] || targetLang;
    const sourceLanguageName = sourceLang ? (langMap[sourceLang.toLowerCase()] || sourceLang) : null;

    let promptText = `Translate the following text into ${targetLanguageName}.`;
    if (sourceLanguageName) {
      promptText += ` Assume the source language is ${sourceLanguageName}.`;
    } else {
      promptText += ` Automatically detect the source language.`;
    }
    // Added stricter instruction for output format
    promptText += ` Respond ONLY with the translated text, without any introductory phrases, explanations, markdown formatting, or quotation marks.\n\nText to translate:\n${text}`;

    console.log(`[API /api/translate-text] Sending prompt to Gemini: ${promptText}`); // Log the prompt

    // --- 4. Call Gemini API ---
    const googleApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

    const response = await fetch(googleApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptText }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 1024 }, // Lowered temperature
        // safetySettings: [ ... ] // optional
      }),
    });

    // --- 5. Handle Gemini Response ---
    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`GEMINI API ERROR (${response.status}) in /api/translate-text: ${errorBody}`);
      // Return original text prefixed with error indication
      return NextResponse.json({ translatedText: `[API Error ${response.status}] ${originalText}` });
    }

    const data = await response.json();
    console.log('[API /api/translate-text] Raw Gemini Response:', JSON.stringify(data, null, 2)); // Log raw response

    // Safely extract the translated text
    const translated: string =
      data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';

    // Check for potential issues like finishReason or safetyRatings if needed
    const finishReason = data?.candidates?.[0]?.finishReason;
    if (finishReason && finishReason !== 'STOP') {
      console.warn(`[API /api/translate-text] Gemini finishReason: ${finishReason}`);
      // Decide if you want to return original text or the partial translation
    }

    // --- 6. Return Result ---
    // Return the original text if translation result is empty or just whitespace
    const resultText = translated || `[Translation Failed] ${originalText}`;
    console.log(`[API /api/translate-text] Returning: "${resultText}"`); // Log the final result

    return NextResponse.json({ translatedText: resultText });
  } catch (error: any) {
    console.error('UNEXPECTED ERROR in /api/translate-text:', error);
    // Return original text prefixed with error indication
    return NextResponse.json({ translatedText: `[Unexpected Error] ${originalText}` });
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
