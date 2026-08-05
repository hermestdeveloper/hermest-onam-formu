import { describe, it, expect } from "vitest";
import {
  slugify,
  slugifyMethod,
  timeStamp,
  extensionForMime,
  slotFileName,
  consentSheetFileName,
} from "@/lib/filenames";

// Yerel saat kullanildigi icin sabit bir yerel tarih kuruluyor (UTC parse edilirse
// makinenin saat dilimine gore gun/saat kayar ve test kirilgan olur).
const DATE = new Date(2026, 5, 27, 14, 5); // 27 Haziran 2026, 14:05 yerel

describe("slugify", () => {
  it("lowercases and underscores", () => {
    expect(slugifyMethod("SAPPHIRE FUE")).toBe("sapphire_fue");
    expect(slugifyMethod("DHI METHOD")).toBe("dhi_method");
    expect(slugifyMethod("  Unique  FUE ")).toBe("unique_fue");
  });

  it("transliterates Turkish letters instead of dropping them", () => {
    expect(slugify("Şükrü Öztürk")).toBe("sukru_ozturk");
    expect(slugify("İbrahim Çağlar")).toBe("ibrahim_caglar");
    expect(slugify("Ayşe Gül")).toBe("ayse_gul");
  });

  it("returns an empty string for a blank name", () => {
    expect(slugify("")).toBe("");
    expect(slugify("   ")).toBe("");
  });
});

describe("timeStamp", () => {
  it("is local date + hour/minute", () => {
    expect(timeStamp(DATE)).toBe("2026-06-27_1405");
  });
  it("pads single digits", () => {
    expect(timeStamp(new Date(2026, 0, 3, 9, 7))).toBe("2026-01-03_0907");
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
  it("is method_patient_view_timestamp", () => {
    expect(slotFileName("front", "image/jpeg", "SAPPHIRE FUE", "Ahmet Yılmaz", DATE)).toBe(
      "sapphire_fue_ahmet_yilmaz_front_view_2026-06-27_1405.jpg"
    );
    expect(slotFileName("right", "image/png", "DHI METHOD", "Ayşe Gül", DATE)).toBe(
      "dhi_method_ayse_gul_right_profile_2026-06-27_1405.png"
    );
  });

  it("drops the patient segment when no patient is selected", () => {
    expect(slotFileName("top", "image/jpeg", "UNIQUE FUE", "", DATE)).toBe(
      "unique_fue_top_view_2026-06-27_1405.jpg"
    );
  });
});

describe("consentSheetFileName", () => {
  it("includes method, patient and timestamp", () => {
    expect(consentSheetFileName(DATE, "UNIQUE FUE", "Ahmet Yılmaz")).toBe(
      "hermest-visual-consent-sheet-unique_fue-ahmet_yilmaz-2026-06-27_1405.png"
    );
  });

  it("drops the patient segment when no patient is selected", () => {
    expect(consentSheetFileName(DATE, "UNIQUE FUE", "")).toBe(
      "hermest-visual-consent-sheet-unique_fue-2026-06-27_1405.png"
    );
  });
});
