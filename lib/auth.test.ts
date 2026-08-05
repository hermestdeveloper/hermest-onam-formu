import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createSessionToken,
  verifySessionToken,
  passwordMatches,
  timingSafeEqual,
  getAuthConfig,
  AuthConfigError,
  SESSION_TTL_MS,
} from "@/lib/auth";

const SECRET = "test-secret-value";
const OLD_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...OLD_ENV };
});

describe("getAuthConfig", () => {
  beforeEach(() => {
    process.env.APP_PASSWORD = "hunter2";
    process.env.AUTH_SECRET = SECRET;
  });

  it("returns the configured values", () => {
    expect(getAuthConfig()).toEqual({ password: "hunter2", secret: SECRET });
  });

  it("throws when either value is missing — the app must fail closed", () => {
    delete process.env.APP_PASSWORD;
    expect(() => getAuthConfig()).toThrowError(AuthConfigError);
    process.env.APP_PASSWORD = "hunter2";
    delete process.env.AUTH_SECRET;
    expect(() => getAuthConfig()).toThrowError(AuthConfigError);
  });
});

describe("timingSafeEqual", () => {
  it("compares content and rejects different lengths", () => {
    const enc = new TextEncoder();
    expect(timingSafeEqual(enc.encode("abc"), enc.encode("abc"))).toBe(true);
    expect(timingSafeEqual(enc.encode("abc"), enc.encode("abd"))).toBe(false);
    expect(timingSafeEqual(enc.encode("abc"), enc.encode("abcd"))).toBe(false);
  });
});

describe("passwordMatches", () => {
  it("accepts only the exact password", () => {
    expect(passwordMatches("hunter2", "hunter2")).toBe(true);
    expect(passwordMatches("Hunter2", "hunter2")).toBe(false);
    expect(passwordMatches("", "hunter2")).toBe(false);
    expect(passwordMatches("hunter2 ", "hunter2")).toBe(false);
  });
});

describe("session token", () => {
  it("round-trips a freshly issued token", async () => {
    const token = await createSessionToken(SECRET);
    expect(await verifySessionToken(token, SECRET)).toBe(true);
  });

  it("rejects a token signed with a different secret", async () => {
    const token = await createSessionToken(SECRET);
    expect(await verifySessionToken(token, "other-secret")).toBe(false);
  });

  it("rejects an expired token", async () => {
    const issuedAt = 1_000_000;
    const token = await createSessionToken(SECRET, issuedAt);
    expect(await verifySessionToken(token, SECRET, issuedAt + SESSION_TTL_MS + 1)).toBe(false);
    expect(await verifySessionToken(token, SECRET, issuedAt + SESSION_TTL_MS - 1)).toBe(true);
  });

  it("rejects a token whose expiry was edited — the signature covers it", async () => {
    const token = await createSessionToken(SECRET, 1_000_000);
    const [, , signature] = token.split(".");
    const forged = `v1.${9_999_999_999_999}.${signature}`;
    expect(await verifySessionToken(forged, SECRET)).toBe(false);
  });

  it("rejects missing, malformed and wrong-version tokens", async () => {
    expect(await verifySessionToken(undefined, SECRET)).toBe(false);
    expect(await verifySessionToken("", SECRET)).toBe(false);
    expect(await verifySessionToken("garbage", SECRET)).toBe(false);
    expect(await verifySessionToken("v1.123", SECRET)).toBe(false);
    expect(await verifySessionToken("v1.abc.sig", SECRET)).toBe(false);

    const token = await createSessionToken(SECRET);
    const [, exp, signature] = token.split(".");
    expect(await verifySessionToken(`v2.${exp}.${signature}`, SECRET)).toBe(false);
  });

  it("rejects a signature that is not valid base64url", async () => {
    const token = await createSessionToken(SECRET);
    const [, exp] = token.split(".");
    expect(await verifySessionToken(`v1.${exp}.!!!!`, SECRET)).toBe(false);
  });
});
