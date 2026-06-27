import { NextRequest, NextResponse } from "next/server";
import { searchPatients, CrmError } from "@/lib/crm";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const search = (sp.get("search") ?? "").trim();

  if (search.length < 2) {
    return NextResponse.json({ data: [], total: 0, page: 1 });
  }

  const page = Number(sp.get("page") ?? "1") || 1;
  const limit = Number(sp.get("limit") ?? "20") || 20;

  try {
    const result = await searchPatients({ search, page, limit });
    return NextResponse.json(result);
  } catch (err) {
    console.error("[/api/patients] arama hatası:", err);
    const status = err instanceof CrmError ? err.status : 500;
    return NextResponse.json({ error: "Arama başarısız" }, { status });
  }
}
