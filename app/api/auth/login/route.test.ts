import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/auth/login/route";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";

const OLD_ENV = { ...process.env };

beforeEach(() => {
  process.env.APP_PASSWORD = "hunter2";
  process.env.AUTH_SECRET = "test-secret-value";
});
afterEach(() => {
  process.env = { ...OLD_ENV };
});

// Hız sınırı bellekte tutuluyor; her test farklı IP kullanarak birbirini etkilemiyor.
function req(body: unknown, ip: string) {
  return new NextRequest("http://localhost/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("POST /api/auth/login", () => {
  it("sets an httpOnly session cookie on the right password", async () => {
    const res = await POST(req({ password: "hunter2" }, "10.0.0.1"));
    expect(res.status).toBe(200);

    const cookie = res.cookies.get(SESSION_COOKIE);
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe("lax");
    expect(await verifySessionToken(cookie?.value, "test-secret-value")).toBe(true);
  });

  it("rejects a wrong password without issuing a cookie", async () => {
    const res = await POST(req({ password: "wrong" }, "10.0.0.2"));
    expect(res.status).toBe(401);
    expect(res.cookies.get(SESSION_COOKIE)).toBeUndefined();
  });

  it("rejects an empty or malformed body", async () => {
    expect((await POST(req({}, "10.0.0.3"))).status).toBe(401);
    expect((await POST(req("not json", "10.0.0.4"))).status).toBe(401);
  });

  it("returns 503 when the server has no password configured", async () => {
    delete process.env.APP_PASSWORD;
    const res = await POST(req({ password: "hunter2" }, "10.0.0.5"));
    expect(res.status).toBe(503);
  });

  it("rate limits repeated failures from one address", async () => {
    const ip = "10.0.0.6";
    for (let i = 0; i < 10; i++) {
      expect((await POST(req({ password: "wrong" }, ip))).status).toBe(401);
    }
    const blocked = await POST(req({ password: "wrong" }, ip));
    expect(blocked.status).toBe(429);

    // Doğru parola da bloke edilmeli — aksi halde sınır aşılabilirdi.
    expect((await POST(req({ password: "hunter2" }, ip))).status).toBe(429);
    // Başka bir adres etkilenmemeli.
    expect((await POST(req({ password: "hunter2" }, "10.0.0.7"))).status).toBe(200);
  });
});
