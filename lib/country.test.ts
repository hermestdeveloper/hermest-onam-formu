import { describe, it, expect } from "vitest";
import { getFlagEmoji, resolveCountryCode, countryOptions } from "@/lib/country";

describe("getFlagEmoji", () => {
  it("converts an ISO code to a flag emoji", () => {
    expect(getFlagEmoji("DE")).toBe("🇩🇪");
  });
});

describe("countryOptions", () => {
  it("lists US first and includes Germany", () => {
    expect(countryOptions[0].code).toBe("US");
    expect(countryOptions.some((c) => c.code === "DE")).toBe(true);
  });
});

describe("resolveCountryCode", () => {
  it("accepts a valid ISO alpha-2 code (any case)", () => {
    expect(resolveCountryCode("tr")).toBe("TR");
    expect(resolveCountryCode("DE")).toBe("DE");
  });
  it("resolves a country name to its code", () => {
    expect(resolveCountryCode("Germany")).toBe("DE");
  });
  it("returns null for unknown input", () => {
    expect(resolveCountryCode("Zzz")).toBeNull();
    expect(resolveCountryCode("")).toBeNull();
    expect(resolveCountryCode(null)).toBeNull();
  });
});
