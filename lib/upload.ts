import type { Slot, UploadItem, UploadResult, UploadStatus } from "@/lib/types";
import { slotFileName, consentSheetFileName } from "@/lib/filenames";

export function buildUploadItems(
  sheetBlob: Blob,
  slots: Slot[],
  method: string,
  date: Date
): UploadItem[] {
  const items: UploadItem[] = [
    {
      key: "sheet",
      filename: consentSheetFileName(date, method),
      description: "Visual Consent Sheet",
      blob: sheetBlob,
    },
  ];

  for (const slot of slots) {
    if (slot.file) {
      items.push({
        key: slot.id,
        filename: slotFileName(slot.id, slot.file.type, method),
        description: slot.label,
        blob: slot.file,
      });
    }
  }

  return items;
}

async function postItem(patientId: string | number, item: UploadItem): Promise<void> {
  const form = new FormData();
  form.append("file", item.blob, item.filename);
  form.append("filename", item.filename);
  form.append("description", item.description);

  const res = await fetch(`/api/patients/${encodeURIComponent(String(patientId))}/files`, {
    method: "POST",
    body: form,
  });

  if (!res.ok) {
    const message = await res
      .json()
      .then((d) => (d && typeof d.error === "string" ? d.error : null))
      .catch(() => null);
    throw new Error(message || `Yükleme hatası (${res.status})`);
  }
}

export async function uploadItems(
  patientId: string | number,
  items: UploadItem[],
  onUpdate: (key: string, status: UploadStatus, error?: string) => void,
  concurrency = 2
): Promise<UploadResult[]> {
  const results: UploadResult[] = [];
  let index = 0;

  async function worker(): Promise<void> {
    while (index < items.length) {
      const current = items[index++];
      onUpdate(current.key, "uploading");
      try {
        await postItem(patientId, current);
        onUpdate(current.key, "success");
        results.push({ key: current.key, status: "success" });
      } catch (e) {
        const error = e instanceof Error ? e.message : "Bilinmeyen hata";
        onUpdate(current.key, "error", error);
        results.push({ key: current.key, status: "error", error });
      }
    }
  }

  const count = Math.max(1, Math.min(concurrency, items.length));
  await Promise.all(Array.from({ length: count }, () => worker()));
  return results;
}
