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

  it("freezes ICU-divergent names (hydration safety — must not come from runtime Intl)", () => {
    const name = (code: string) => countryOptions.find((c) => c.code === code)?.name;
    // These region names vary across ICU/CLDR versions; they MUST be stable
    // literals so SSR and client hydration produce identical <option> text (#418).
    expect(name("US")).toBe("United States");
    expect(name("DE")).toBe("Germany");
    expect(name("TR")).toBe("Türkiye");
    expect(name("CZ")).toBe("Czechia");
    expect(name("SZ")).toBe("Eswatini");
    expect(name("MK")).toBe("North Macedonia");
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
