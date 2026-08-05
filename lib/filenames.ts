const SLOT_FILE_BASENAMES: Record<string, string> = {
  front: "front_view",
  top: "top_view",
  right: "right_profile",
  left: "left_profile",
};

// Turkce harfler once karsiliklarina cevriliyor; aksi halde "Sukru Oz" gibi bir ad
// "_kr__z" olurdu (a-z0-9 disi her sey alt cizgiye donuyor).
const TR_MAP: Record<string, string> = {
  ç: "c", ğ: "g", ı: "i", i̇: "i", ö: "o", ş: "s", ü: "u",
  Ç: "c", Ğ: "g", İ: "i", I: "i", Ö: "o", Ş: "s", Ü: "u",
};

export function slugify(text: string): string {
  return text
    .trim()
    .replace(/[çğıiöşüÇĞİIÖŞÜ]/g, (ch) => TR_MAP[ch] ?? ch)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

// Geriye donuk ad — tedavi yontemi de ayni kuralla sluglaniyor.
export const slugifyMethod = slugify;

// Yerel saat: klinikte dosyaya bakan kisi kendi saatini gormeli, UTC'yi degil.
export function timeStamp(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `_${pad(date.getHours())}${pad(date.getMinutes())}`
  );
}

export function extensionForMime(mime: string): string {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/jpeg") return "jpg";
  return "jpg";
}

export function slotFileName(
  slotId: string,
  mime: string,
  method: string,
  patientName: string,
  date: Date
): string {
  const base = SLOT_FILE_BASENAMES[slotId] ?? slotId;
  const parts = [slugify(method), slugify(patientName), base, timeStamp(date)].filter(Boolean);
  return `${parts.join("_")}.${extensionForMime(mime)}`;
}

export function consentSheetFileName(
  date: Date,
  method: string,
  patientName: string
): string {
  const parts = [
    "hermest-visual-consent-sheet",
    slugify(method),
    slugify(patientName),
    timeStamp(date),
  ].filter(Boolean);
  return `${parts.join("-")}.png`;
}
