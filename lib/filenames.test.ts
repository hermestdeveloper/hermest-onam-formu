import { describe, it, expect } from "vitest";
import {
  slugifyMethod,
  extensionForMime,
  slotFileName,
  consentSheetFileName,
} from "@/lib/filenames";

describe("slugifyMethod", () => {
  it("lowercases and underscores", () => {
    expect(slugifyMethod("SAPPHIRE FUE")).toBe("sapphire_fue");
    expect(slugifyMethod("DHI METHOD")).toBe("dhi_method");
    expect(slugifyMethod("  Unique  FUE ")).toBe("unique_fue");
  });
});

describe("extensionForMime", () => {
  it("maps known mimes and defaults to jpg", () => {
    expect(extensionForMime("image/png")).toBe("png");
    expect(extensionForMime("image/jpeg")).toBe("jpg");
    expect(extensionForMime("application/octet-stream")).toBe("jpg");
  });
});

describe("slotFileName", () => {
  it("prefixes method slug and maps the view", () => {
    expect(slotFileName("front", "image/jpeg", "SAPPHIRE FUE")).toBe(
      "sapphire_fue_front_view.jpg"
    );
    expect(slotFileName("right", "image/png", "DHI METHOD")).toBe(
      "dhi_method_right_profile.png"
    );
  });
});

describe("consentSheetFileName", () => {
  it("includes method slug and ISO date", () => {
    const d = new Date("2026-06-27T10:00:00Z");
    expect(consentSheetFileName(d, "UNIQUE FUE")).toBe(
      "hermest-visual-consent-sheet-unique_fue-2026-06-27.png"
    );
  });
});
