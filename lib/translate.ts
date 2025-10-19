// Generic translator that calls your own proxy at /api/translate
export async function translateText(
  q: string,
  target: string,
  source: string = "auto"
): Promise<string> {
  if (!q?.trim()) return "";

  const res = await fetch("/api/translate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ q, source, target, format: "text" }),
  });

  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(`Translate failed (${res.status}): ${msg}`);
  }

  const { translated } = await res.json();
  return typeof translated === "string" ? translated : translated?.[0] ?? "";
}

// Normalize language names/aliases to the short codes LibreTranslate expects
export function normalizeLang(input?: string | null): string {
  const s = (input || "").toLowerCase().trim();

  const map: Record<string, string> = {
    en: "en", english: "en",
    hi: "hi", hindi: "hi", "हिन्दी": "hi", "हिंदी": "hi",
    mr: "mr", marathi: "mr",
    bn: "bn", bengali: "bn", bangla: "bn",
    ta: "ta", tamil: "ta",
    te: "te", telugu: "te",
    gu: "gu", gujarati: "gu",
    kn: "kn", kannada: "kn",
    ml: "ml", malayalam: "ml",
    pa: "pa", punjabi: "pa",
    ur: "ur", urdu: "ur",
  };

  return map[s] || "en";
}
