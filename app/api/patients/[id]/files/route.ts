import { NextRequest, NextResponse } from "next/server";
import { uploadPatientFile, CrmError } from "@/lib/crm";
import { DEFAULT_SUB_FOLDER, isValidSubFolder } from "@/lib/folders";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Geçersiz form verisi" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "Dosya bulunamadı" }, { status: 400 });
  }

  const description = typeof form.get("description") === "string"
    ? (form.get("description") as string)
    : "";
  const filename =
    (typeof form.get("filename") === "string" && (form.get("filename") as string)) ||
    (file instanceof File ? file.name : "upload");

  const requestedSubFolder =
    typeof form.get("subFolder") === "string"
      ? (form.get("subFolder") as string).trim()
      : "";
  if (requestedSubFolder && !isValidSubFolder(requestedSubFolder)) {
    return NextResponse.json(
      { error: `Geçersiz klasör: ${requestedSubFolder}` },
      { status: 400 }
    );
  }
  const subFolder = requestedSubFolder || DEFAULT_SUB_FOLDER;

  try {
    const result = await uploadPatientFile(id, file, filename, description, subFolder);
    return NextResponse.json({ ok: true, subFolder, result });
  } catch (err) {
    console.error("[/api/patients/:id/files] yükleme hatası:", err);
    const status = err instanceof CrmError ? err.status : 500;
    // CRM'in "Drive klasoru bagli degil" gibi eyleme donuk mesajlari kullaniciya tasiniyor;
    // beklenmeyen hatalarda ic detay sizmasin diye genel mesaj kullaniliyor.
    const message =
      err instanceof CrmError && status >= 400 && status < 500
        ? err.message
        : "Yükleme başarısız";
    return NextResponse.json({ error: message }, { status });
  }
}
