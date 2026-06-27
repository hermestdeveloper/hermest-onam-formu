export type Patient = {
  id: number | string;
  name: string;
  phone?: string;
  email?: string;
  country?: string;
};

export type PatientSearchResponse = {
  data: Patient[];
  total: number;
  page: number;
};

export type SlotId = "front" | "top" | "right" | "left";

export type Slot = {
  id: SlotId;
  label: string;
  hint: string;
  dataUrl: string | null;
  file: File | null;
};

export type CountryOption = {
  code: string;
  flag: string;
  name: string;
};

export type UploadStatus = "pending" | "uploading" | "success" | "error";

export type UploadItem = {
  key: string;
  filename: string;
  description: string;
  blob: Blob;
};

export type UploadResult = {
  key: string;
  status: UploadStatus;
  error?: string;
};
