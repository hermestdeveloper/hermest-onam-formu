// Tek ortak parolali oturum. Kullanici kaydi/veritabani yok: giris basarili olunca
// imzali bir jeton cerezde tutuluyor, dogrulama tamamen HMAC ile yapiliyor.
//
// Web Crypto kullaniliyor (node:crypto degil) — ayni kod hem middleware'de
// (Edge runtime) hem sunucu route'larinda calissin diye.

export const SESSION_COOKIE = "onam_session";
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 gün

export class AuthConfigError extends Error {}

export function getAuthConfig(): { password: string; secret: string } {
  const password = process.env.APP_PASSWORD;
  const secret = process.env.AUTH_SECRET;
  if (!password || !secret) {
    throw new AuthConfigError("APP_PASSWORD / AUTH_SECRET tanımlı değil");
  }
  return { password, secret };
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text: string): Uint8Array {
  const padded = text.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  return Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
}

async function sign(secret: string, data: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return new Uint8Array(sig);
}

// Sabit zamanli karsilastirma — erken cikis yapan bir esitlik kontrolu, imzayi
// bayt bayt tahmin etmeye izin verirdi.
export function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export function passwordMatches(input: string, expected: string): boolean {
  const encoder = new TextEncoder();
  return timingSafeEqual(encoder.encode(input), encoder.encode(expected));
}

export async function createSessionToken(
  secret: string,
  now: number = Date.now(),
  ttlMs: number = SESSION_TTL_MS
): Promise<string> {
  const payload = `v1.${now + ttlMs}`;
  return `${payload}.${toBase64Url(await sign(secret, payload))}`;
}

export async function verifySessionToken(
  token: string | undefined,
  secret: string,
  now: number = Date.now()
): Promise<boolean> {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [version, expText, signature] = parts;
  if (version !== "v1") return false;

  const exp = Number(expText);
  if (!Number.isFinite(exp) || exp <= now) return false;

  let provided: Uint8Array;
  try {
    provided = fromBase64Url(signature);
  } catch {
    return false;
  }
  return timingSafeEqual(provided, await sign(secret, `${version}.${expText}`));
}
