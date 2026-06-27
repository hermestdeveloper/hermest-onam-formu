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
    const items = buildUploadItems(sheet, slots, "SAPPHIRE FUE", new Date("2026-06-27T00:00:00Z"));

    expect(items.map((i) => i.key)).toEqual(["sheet", "front", "right"]);
    expect(items[0].filename).toBe("hermest-visual-consent-sheet-sapphire_fue-2026-06-27.png");
    expect(items[1].filename).toBe("sapphire_fue_front_view.jpg");
    expect(items[1].description).toBe("front");
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
    const results = await uploadItems("123", items, () => {}, 1);
    const byKey = Object.fromEntries(results.map((r) => [r.key, r.status]));
    expect(byKey.good).toBe("success");
    expect(byKey.bad).toBe("error");
  });
});
