const SLOT_FILE_BASENAMES: Record<string, string> = {
  front: "front_view",
  top: "top_view",
  right: "right_profile",
  left: "left_profile",
};

export function slugifyMethod(method: string): string {
  return method
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function extensionForMime(mime: string): string {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/jpeg") return "jpg";
  return "jpg";
}

export function slotFileName(slotId: string, mime: string, method: string): string {
  const base = SLOT_FILE_BASENAMES[slotId] ?? slotId;
  const slug = slugifyMethod(method);
  const ext = extensionForMime(mime);
  return slug ? `${slug}_${base}.${ext}` : `${base}.${ext}`;
}

export function consentSheetFileName(date: Date, method: string): string {
  const stamp = date.toISOString().slice(0, 10);
  const slug = slugifyMethod(method);
  return slug
    ? `hermest-visual-consent-sheet-${slug}-${stamp}.png`
    : `hermest-visual-consent-sheet-${stamp}.png`;
}
