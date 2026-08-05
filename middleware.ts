import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";

// Sayfa da API de korunuyor. Yalnizca sayfayi korumak yetmezdi: /api/patients
// dogrudan cagrildiginda CRM'deki hasta listesini (ad, telefon, e-posta) dondurur.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.png|robots.txt).*)"],
};

const PUBLIC_PATHS = ["/login", "/api/auth/login", "/api/auth/logout"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC_PATHS.includes(pathname)) return NextResponse.next();

  const isApi = pathname.startsWith("/api/");
  const secret = process.env.AUTH_SECRET;

  // Yapilandirma eksikse kapali kal. Aksi halde sunucuda env unutuldugunda
  // uygulama sessizce herkese acik calismaya devam ederdi.
  if (!secret || !process.env.APP_PASSWORD) {
    return isApi
      ? NextResponse.json({ error: "Sunucu yapılandırması eksik" }, { status: 503 })
      : new NextResponse("Sunucu yapılandırması eksik (APP_PASSWORD / AUTH_SECRET)", {
          status: 503,
        });
  }

  if (await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value, secret)) {
    return NextResponse.next();
  }

  if (isApi) {
    return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  }

  const loginUrl = new URL("/login", request.url);
  if (pathname !== "/") loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}
