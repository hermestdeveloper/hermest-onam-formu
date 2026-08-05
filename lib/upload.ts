import type { Slot, UploadItem, UploadResult, UploadStatus } from "@/lib/types";
import { slotFileName, consentSheetFileName } from "@/lib/filenames";
import { DEFAULT_SUB_FOLDER } from "@/lib/folders";

export function buildUploadItems(
  sheetBlob: Blob,
  slots: Slot[],
  method: string,
  date: Date,
  patientName: string
): UploadItem[] {
  const items: UploadItem[] = [
    {
      key: "sheet",
      filename: consentSheetFileName(date, method, patientName),
      description: "Visual Consent Sheet",
      blob: sheetBlob,
    },
  ];

  for (const slot of slots) {
    if (slot.file) {
      items.push({
        key: slot.id,
        filename: slotFileName(slot.id, slot.file.type, method, patientName, date),
        description: slot.label,
        blob: slot.file,
      });
    }
  }

  return items;
}

async function postItem(
  patientId: string | number,
  item: UploadItem,
  subFolder: string
): Promise<void> {
  const form = new FormData();
  form.append("file", item.blob, item.filename);
  form.append("filename", item.filename);
  form.append("description", item.description);
  form.append("subFolder", subFolder);

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
  subFolder: string = DEFAULT_SUB_FOLDER,
  concurrency = 2
): Promise<UploadResult[]> {
  const results: UploadResult[] = [];
  let index = 0;

  async function worker(): Promise<void> {
    while (index < items.length) {
      const current = items[index++];
      onUpdate(current.key, "uploading");
      try {
        await postItem(patientId, current, subFolder);
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
