// src/app/api/extract-pdf-text/route.ts
import { NextResponse } from 'next/server';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Ensure API key is available
if (!GEMINI_API_KEY) {
  console.error('SERVER ERROR in /api/extract-pdf-text: GEMINI_API_KEY is not set.');
  // Throw an error during build/startup if the key is missing
  throw new Error("Missing GEMINI_API_KEY environment variable.");
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash", // Use a model that supports file input
     // Adjust safety settings if needed, be cautious with BLOCK_NONE
    safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    ],
});

// Helper to convert ArrayBuffer/Buffer to Base64
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided.' }, { status: 400 });
    }

    if (file.type !== 'application/pdf') {
         return NextResponse.json({ error: 'Only PDF files are supported for text extraction.' }, { status: 400 });
    }

    // Convert file to Base64
    const arrayBuffer = await file.arrayBuffer();
    const base64EncodedData = arrayBufferToBase64(arrayBuffer);

    // Prepare prompt for Gemini
    const prompt = "Extract all text content from this PDF document. Respond only with the extracted text.";
    const filePart = {
        inlineData: {
            mimeType: file.type, // Should be application/pdf
            data: base64EncodedData,
        }
    };

    // Call Gemini API
    const result = await model.generateContent([prompt, filePart]);
    const response = result.response;
    const extractedText = response.text();

    if (!extractedText) {
        // Check for safety blocks or other issues
        const candidates = response.candidates;
        const finishReason = candidates?.[0]?.finishReason;
        const safetyRatings = candidates?.[0]?.safetyRatings;
        console.warn(`PDF text extraction potentially blocked or empty. Reason: ${finishReason}`, safetyRatings);
         return NextResponse.json({ extractedText: "[Could not extract text or PDF is empty]" }); // Return empty but OK status
    }

    return NextResponse.json({ extractedText });

  } catch (error: any) {
    console.error('Error in PDF text extraction API:', error);
    // Check for specific Gemini errors if possible
    let errorMessage = 'Failed to extract text from PDF.';
    if (error.message && error.message.includes('400 Bad Request')) {
        errorMessage = 'Gemini API Error: Bad request. The PDF might be malformed or too large.';
    } else if (error.message) {
        errorMessage = error.message;
    }
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export const runtime = 'nodejs'; // Gemini SDK likely requires Node.js
export const dynamic = 'force-dynamic';