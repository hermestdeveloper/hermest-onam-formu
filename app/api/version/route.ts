import { NextResponse } from "next/server";
import { readBuildId } from "@/lib/buildId";

// Sunucudaki guncel yayinin kimligi. Tarayici, kendisine servis edilmis HTML'deki
// kimlikle karsilastirir; farkliysa acik sekme eski surumdedir.
export const dynamic = "force-dynamic";

// Surec basina bir kez okunuyor: degeri degistirmenin tek yolu yeni bir yayin,
// o da container'i zaten yeniden baslatiyor.
const BUILD_ID = readBuildId();

export function GET() {
  return NextResponse.json(
    { buildId: BUILD_ID },
    { headers: { "Cache-Control": "no-store" } }
  );
}
