import { NextResponse } from "next/server";
import crypto from "crypto";

/**
 * Generates a Cloudinary signature for direct uploads from the browser.
 * We sign ONLY non-file params (e.g., folder, public_id, timestamp).
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { folder = "videos", public_id } = body || {};

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
      return NextResponse.json(
        { error: "Cloudinary env vars not set on server." },
        { status: 500 }
      );
    }

    // Cloudinary requires UNIX seconds for timestamp
    const timestamp = Math.floor(Date.now() / 1000);

    // Build params to sign (all except file). Sort by key a–z.
    const params: Record<string, string | number> = { folder, timestamp };
    if (public_id) params.public_id = public_id;

    const toSign = Object.keys(params)
      .sort()
      .map((k) => `${k}=${params[k]}`)
      .join("&");

    const signature = crypto
      .createHash("sha1")
      .update(toSign + apiSecret)
      .digest("hex");

    return NextResponse.json({
      cloudName,
      apiKey,
      timestamp,
      folder,
      public_id: public_id || null,
      signature,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to sign Cloudinary params." },
      { status: 500 }
    );
  }
}
