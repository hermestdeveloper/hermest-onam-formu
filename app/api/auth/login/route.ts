import { NextRequest, NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  SESSION_TTL_MS,
  createSessionToken,
  getAuthConfig,
  passwordMatches,
  AuthConfigError,
} from "@/lib/auth";

export const runtime = "nodejs";

// Tek konteyner calisiyor, o yuzden bellek ici sayac yeterli. Amaç parolayi
// deneme yanilma ile bulmayi yavaslatmak.
const MAX_ATTEMPTS = 10;
const WINDOW_MS = 15 * 60 * 1000;
const attempts = new Map<string, { count: number; resetAt: number }>();

function clientKey(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0].trim() || "unknown";
}

function rateLimited(key: string, now: number): boolean {
  const entry = attempts.get(key);
  if (!entry || entry.resetAt <= now) return false;
  return entry.count >= MAX_ATTEMPTS;
}

function recordFailure(key: string, now: number): void {
  const entry = attempts.get(key);
  if (!entry || entry.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return;
  }
  entry.count += 1;
}

export async function POST(request: NextRequest) {
  let config: { password: string; secret: string };
  try {
    config = getAuthConfig();
  } catch (err) {
    console.error("[/api/auth/login] yapılandırma hatası:", err);
    const status = err instanceof AuthConfigError ? 503 : 500;
    return NextResponse.json({ error: "Sunucu yapılandırması eksik" }, { status });
  }

  const now = Date.now();
  const key = clientKey(request);
  if (rateLimited(key, now)) {
    return NextResponse.json(
      { error: "Çok fazla deneme yapıldı, 15 dakika sonra tekrar deneyin" },
      { status: 429 }
    );
  }

  let password = "";
  try {
    const body = (await request.json()) as { password?: unknown };
    if (typeof body?.password === "string") password = body.password;
  } catch {
    // gövde JSON değil — boş parola gibi işlenir
  }

  if (!passwordMatches(password, config.password)) {
    recordFailure(key, now);
    return NextResponse.json({ error: "Parola hatalı" }, { status: 401 });
  }

  attempts.delete(key);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, await createSessionToken(config.secret, now), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
  return response;
}
