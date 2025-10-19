// app/api/translate/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Optional providers (set in .env.local)
// GOOGLE_TRANSLATE_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
// DEEPL_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
// LIBRETRANSLATE_URL=https://libretranslate.yourdomain.com/translate
// LIBRETRANSLATE_API_KEY=optional

const GOOGLE_KEY = process.env.GOOGLE_TRANSLATE_API_KEY;
const DEEPL_KEY = process.env.DEEPL_API_KEY;
const LIBRE_URL = process.env.LIBRETRANSLATE_URL || "https://libretranslate.com/translate";
const LIBRE_KEY = process.env.LIBRETRANSLATE_API_KEY;

const MAX_CHUNK = 1800;

function chunkText(text: string, max = MAX_CHUNK) {
  const out: string[] = [];
  for (let i = 0; i < text.length; i += max) out.push(text.slice(i, i + max));
  return out;
}

async function translateWithGoogle(q: string, source: string, target: string) {
  // Docs: https://cloud.google.com/translate/docs/basic/translating-text
  const url = `https://translation.googleapis.com/language/translate/v2?key=${GOOGLE_KEY}`;
  const body = { q, source: source || undefined, target, format: "text" };
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Google HTTP ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const txt = data?.data?.translations?.[0]?.translatedText ?? "";
  return txt;
}

async function translateWithDeepL(q: string, source: string, target: string) {
  // Docs: https://www.deepl.com/docs-api
  // Use free endpoint if key ends with :fx, else paid endpoint.
  const base = DEEPL_KEY?.endsWith(":fx")
    ? "https://api-free.deepl.com/v2/translate"
    : "https://api.deepl.com/v2/translate";
  const params = new URLSearchParams({
    auth_key: DEEPL_KEY!,
    text: q,
    target_lang: target.toUpperCase(), // e.g., EN, HI, MR, BN...
  });
  if (source) params.append("source_lang", source.toUpperCase());
  const res = await fetch(base, { method: "POST", body: params });
  if (!res.ok) throw new Error(`DeepL HTTP ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const txt = data?.translations?.[0]?.text ?? "";
  return txt;
}

async function translateWithLibre(q: string, source: string, target: string) {
  const body: Record<string, any> = {
    q,
    source: source || "auto",
    target,
    format: "text",
  };
  if (LIBRE_KEY) body.api_key = LIBRE_KEY;

  // Two tries w/ small backoff
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(LIBRE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const data = await res.json();
      return data?.translatedText ?? "";
    }
    await new Promise((r) => setTimeout(r, 150 * (attempt + 1)));
  }
  throw new Error("LibreTranslate upstream failed.");
}

async function translateChunk(q: string, source: string, target: string) {
  // Provider priority: Google -> DeepL -> Libre
  if (GOOGLE_KEY) {
    try { return await translateWithGoogle(q, source, target); } catch {}
  }
  if (DEEPL_KEY) {
    try { return await translateWithDeepL(q, source, target); } catch {}
  }
  return await translateWithLibre(q, source, target);
}

export async function POST(req: Request) {
  try {
    const { text, source = "en", target } = await req.json();
    if (!text || !target) {
      return NextResponse.json({ error: "Missing 'text' or 'target'." }, { status: 400 });
    }
    // Hard cap to avoid excessive payloads
    const input = String(text);
    if (input.length > 250_000) {
      return NextResponse.json({ error: "Text too long." }, { status: 413 });
    }

    const pieces = chunkText(input, MAX_CHUNK);
    const out: string[] = [];
    for (const p of pieces) {
      const translated = await translateChunk(p, source, target);
      out.push(translated);
      // polite pacing for public endpoints
      await new Promise((r) => setTimeout(r, 100));
    }

    return NextResponse.json({ translatedText: out.join("") });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Translation failed." },
      { status: 502 }
    );
  }
}
