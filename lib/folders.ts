// Drive alt klasor sablonu — CRM'in kabul ettigi kanonik adlar (#84).
// Sablon disindaki bir ad gonderilirse CRM 400 doner ve Drive'da cop klasor acilmaz.
export const SUB_FOLDER_OPTIONS = [
  "Dosyalar",
  "000 öncesi",
  "00 saç ekimi günü",
  "0-5.gün",
  "0-10.gün",
  "1.ay",
  "2.ay",
  "3.ay",
  "4.ay",
  "5.ay",
  "6.ay",
  "7.ay",
  "8.ay",
  "9.ay",
  "10.ay",
  "11.ay",
  "12.ay",
] as const;

export const DEFAULT_SUB_FOLDER = "Dosyalar";

export function isValidSubFolder(value: string): boolean {
  return (SUB_FOLDER_OPTIONS as readonly string[]).includes(value);
}
