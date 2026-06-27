import type { Patient, PatientSearchResponse } from "@/lib/types";

export async function searchPatientsClient(
  search: string,
  signal?: AbortSignal
): Promise<Patient[]> {
  const params = new URLSearchParams({ search, page: "1", limit: "20" });
  const res = await fetch(`/api/patients?${params.toString()}`, { signal });
  if (!res.ok) {
    throw new Error("Arama başarısız");
  }
  const json = (await res.json()) as PatientSearchResponse;
  return json.data ?? [];
}
