import { NextRequest, NextResponse } from "next/server";
import { uploadPatientFile, CrmError } from "@/lib/crm";

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

  try {
    const result = await uploadPatientFile(id, file, filename, description);
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    console.error("[/api/patients/:id/files] yükleme hatası:", err);
    const status = err instanceof CrmError ? err.status : 500;
    return NextResponse.json({ error: "Yükleme başarısız" }, { status });
  }
}
