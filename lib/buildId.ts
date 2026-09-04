import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Bu yayinin kimligi. Next her derlemede yeni bir BUILD_ID uretip diske yazar;
 * biz de onu okuyoruz.
 *
 * `next.config.ts` icinde `Date.now()` gibi bir deger URETMEK ise ise yaramaz:
 * config bir derleme sirasinda birden fazla kez degerlendiriliyor ve her
 * degerlendirmede farkli bir deger cikiyor — istemciye gomulen kimlik ile
 * sunucunun bildirdigi kimlik tutmuyor, bos formdaki her sekme sonsuz yenileme
 * dongusune giriyordu. Dosya tek kaynak oldugu icin bu sorun yasanmiyor.
 *
 * Standalone ciktisinda da yol ayni: server.js kendi klasorunden calisir ve
 * `.next/BUILD_ID` orada durur.
 */
export function readBuildId(): string {
  try {
    return readFileSync(join(process.cwd(), ".next", "BUILD_ID"), "utf8").trim();
  } catch {
    // Okunamazsa istemci karsilastirmayi atlar; hatali yenileme tetiklenmez.
    return "unknown";
  }
}
