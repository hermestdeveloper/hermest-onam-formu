import type { PatientSearchResponse } from "@/lib/types";

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

export async function searchPatients(params: {
  search: string;
  page: number;
  limit: number;
}): Promise<PatientSearchResponse> {
  const { baseUrl, apiKey } = getCrmConfig();
  const url = new URL(`${baseUrl}/api/webhooks/patients`);
  url.searchParams.set("search", params.search);
  url.searchParams.set("page", String(params.page));
  url.searchParams.set("limit", String(params.limit));

  const res = await fetch(url, {
    headers: { "X-API-Key": apiKey },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new CrmError(`CRM arama hatası (${res.status})`, res.status);
  }
  return (await res.json()) as PatientSearchResponse;
}

export async function uploadPatientFile(
  patientId: string,
  file: Blob,
  filename: string,
  description: string
): Promise<unknown> {
  const { baseUrl, apiKey } = getCrmConfig();
  const form = new FormData();
  form.append("file", file, filename);
  if (description) form.append("description", description);

  const res = await fetch(
    `${baseUrl}/api/webhooks/patients/${encodeURIComponent(patientId)}/files`,
    {
      method: "POST",
      headers: { "X-API-Key": apiKey },
      body: form,
    }
  );
  if (!res.ok) {
    throw new CrmError(`CRM yükleme hatası (${res.status})`, res.status);
  }
  return res.json().catch(() => ({}));
}
