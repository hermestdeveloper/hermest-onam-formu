import type { PatientSearchResponse } from "@/lib/types";
import { DEFAULT_SUB_FOLDER } from "@/lib/folders";

export class CrmError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "CrmError";
    this.status = status;
  }
}

export function getCrmConfig(): { baseUrl: string; apiKey: string } {
  const baseUrl = process.env.CRM_BASE_URL;
  const apiKey = process.env.CRM_API_KEY;
  if (!baseUrl || !apiKey) {
    throw new CrmError("CRM yapılandırması eksik (CRM_BASE_URL / CRM_API_KEY)", 500);
  }
  return { baseUrl: baseUrl.replace(/\/+$/, ""), apiKey };
}

// Onam formu yalnizca tek bir panodaki danisanlarla calisiyor (#84).
// CRM_BOARD bos birakilirsa filtre uygulanmaz — tum hastalar doner.
export function getBoardFilter(): string {
  const board = process.env.CRM_BOARD;
  return (board === undefined ? "Danışanlar" : board).trim();
}

// CRM hatayi {success,error:{statusCode,message}} ile donuyor; message dizi de olabilir.
// Kullaniciya "klasor bagli degil" gibi eyleme donuk mesajlari gostermek icin cikariyoruz.
async function crmErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as {
      error?: { message?: string | string[] } | string;
      message?: string | string[];
    };
    const raw =
      typeof body?.error === "string"
        ? body.error
        : body?.error?.message ?? body?.message;
    const text = Array.isArray(raw) ? raw.join(" ") : raw;
    if (typeof text === "string" && text.trim()) return text.trim();
  } catch {
    // gövde JSON değil — fallback kullanılır
  }
  return fallback;
}

export async function searchPatients(params: {
  search: string;
  page: number;
  limit: number;
  board?: string;
}): Promise<PatientSearchResponse> {
  const { baseUrl, apiKey } = getCrmConfig();
  const url = new URL(`${baseUrl}/api/webhooks/patients`);
  url.searchParams.set("search", params.search);
  url.searchParams.set("page", String(params.page));
  url.searchParams.set("limit", String(params.limit));
  const board = params.board?.trim();
  if (board) url.searchParams.set("board", board);

  const res = await fetch(url, {
    headers: { "X-API-Key": apiKey },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new CrmError(
      await crmErrorMessage(res, `CRM arama hatası (${res.status})`),
      res.status
    );
  }
  return (await res.json()) as PatientSearchResponse;
}

export async function uploadPatientFile(
  patientId: string,
  file: Blob,
  filename: string,
  description: string,
  subFolder: string = DEFAULT_SUB_FOLDER
): Promise<unknown> {
  const { baseUrl, apiKey } = getCrmConfig();
  const form = new FormData();
  form.append("file", file, filename);
  if (description) form.append("description", description);
  if (subFolder) form.append("subFolder", subFolder);

  const res = await fetch(
    `${baseUrl}/api/webhooks/patients/${encodeURIComponent(patientId)}/files`,
    {
      method: "POST",
      headers: { "X-API-Key": apiKey },
      body: form,
    }
  );
  if (!res.ok) {
    throw new CrmError(
      await crmErrorMessage(res, `CRM yükleme hatası (${res.status})`),
      res.status
    );
  }
  return res.json().catch(() => ({}));
}
