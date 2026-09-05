import { describe, it, expect, vi, afterEach } from "vitest";
import { buildUploadItems, uploadItems } from "@/lib/upload";
import type { Slot } from "@/lib/types";

afterEach(() => vi.restoreAllMocks());

function slot(id: Slot["id"], filled: boolean): Slot {
  return {
    id,
    label: id,
    hint: "",
    dataUrl: filled ? "data:," : null,
    file: filled ? new File(["x"], `${id}.jpg`, { type: "image/jpeg" }) : null,
  };
}

describe("buildUploadItems", () => {
  it("puts the sheet first and only includes filled slots", () => {
    const sheet = new Blob(["s"], { type: "image/png" });
    const slots = [slot("front", true), slot("top", false), slot("right", true)];
    const date = new Date(2026, 5, 27, 14, 5);
    const items = buildUploadItems(sheet, slots, "SAPPHIRE FUE", date, "Ahmet Yılmaz");

    expect(items.map((i) => i.key)).toEqual(["sheet", "front", "right"]);
    expect(items[0].filename).toBe(
      "hermest-visual-consent-sheet-sapphire_fue-ahmet_yilmaz-2026-06-27_1405.jpg"
    );
    expect(items[1].filename).toBe(
      "sapphire_fue_ahmet_yilmaz_front_view_2026-06-27_1405.jpg"
    );
    // description Drive'daki adi belirliyor (CRM sonuna " - <hasta>" ekliyor).
    expect(items[0].description).toBe(
      "SAPPHIRE FUE - Visual Consent Sheet - 2026-06-27_1405"
    );
    expect(items[1].description).toBe("SAPPHIRE FUE - front - 2026-06-27_1405");
  });

  it("gives every file in one export the same timestamp", () => {
    const slots = [slot("front", true), slot("left", true)];
    const items = buildUploadItems(
      new Blob(["s"], { type: "image/png" }),
      slots,
      "DHI METHOD",
      new Date(2026, 5, 27, 14, 5),
      "Ahmet"
    );
    const stamps = items.map((i) => i.filename.match(/2026-06-27_\d{4}/)?.[0]);
    expect(new Set(stamps).size).toBe(1);
  });
});

describe("uploadItems", () => {
  it("reports success per item", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 })));
    const updates: string[] = [];
    const items = [
      { key: "sheet", filename: "s.png", description: "", blob: new Blob(["s"]) },
      { key: "front", filename: "f.jpg", description: "Front", blob: new Blob(["f"]) },
    ];
    const results = await uploadItems("123", items, (k, s) => updates.push(`${k}:${s}`));
    expect(results.every((r) => r.status === "success")).toBe(true);
    expect(updates).toContain("sheet:uploading");
    expect(updates).toContain("front:success");
  });

  it("aga bagli hatayi anlasilir Turkce mesaja cevirir", async () => {
    // Safari fetch basarisiz olunca "Load failed" firlatiyor (Chrome'da
    // "Failed to fetch"). Klinik ekrani bu metni gordu ve ne oldugunu
    // anlayamadi; sunucuya istek hic ulasmamisti.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Load failed");
      })
    );
    const items = [{ key: "sheet", filename: "s.jpg", description: "", blob: new Blob(["s"]) }];
    const results = await uploadItems("123", items, () => {});
    expect(results[0].status).toBe("error");
    expect(results[0].error).toContain("Bağlantı");
    expect(results[0].error).not.toContain("Load failed");
  });

  it("sends the chosen sub folder with every item", async () => {
    const folders: (FormDataEntryValue | null)[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url, init) => {
        folders.push(((init as RequestInit).body as FormData).get("subFolder"));
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      })
    );
    const items = [
      { key: "sheet", filename: "s.png", description: "", blob: new Blob(["s"]) },
      { key: "front", filename: "f.jpg", description: "Front", blob: new Blob(["f"]) },
    ];
    await uploadItems("123", items, () => {}, "3.ay", 1);
    expect(folders).toEqual(["3.ay", "3.ay"]);
  });

  it("defaults to Dosyalar when no folder is given", async () => {
    let sent: FormDataEntryValue | null = null;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url, init) => {
        sent = ((init as RequestInit).body as FormData).get("subFolder");
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      })
    );
    await uploadItems("123", [{ key: "sheet", filename: "s.png", description: "", blob: new Blob(["s"]) }], () => {});
    expect(sent).toBe("Dosyalar");
  });

  it("marks a failed item as error without throwing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url, init) => {
        const fd = (init as RequestInit).body as FormData;
        const ok = fd.get("filename") !== "bad.jpg";
        return new Response(JSON.stringify(ok ? { ok: true } : { error: "boom" }), {
          status: ok ? 200 : 500,
        });
      })
    );
    const items = [
      { key: "good", filename: "good.jpg", description: "", blob: new Blob(["g"]) },
      { key: "bad", filename: "bad.jpg", description: "", blob: new Blob(["b"]) },
    ];
    const results = await uploadItems("123", items, () => {}, "Dosyalar", 1);
    const byKey = Object.fromEntries(results.map((r) => [r.key, r.status]));
    expect(byKey.good).toBe("success");
    expect(byKey.bad).toBe("error");
  });
});
