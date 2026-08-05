import { describe, it, expect, vi, afterEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/crm", () => ({
  CrmError: class CrmError extends Error {
    status: number;
    constructor(m: string, s: number) { super(m); this.status = s; }
  },
  uploadPatientFile: vi.fn(),
}));

import { POST } from "@/app/api/patients/[id]/files/route";
import { uploadPatientFile } from "@/lib/crm";

afterEach(() => vi.clearAllMocks());

function fileReq(form: FormData) {
  return new NextRequest("http://localhost/api/patients/123/files", {
    method: "POST",
    body: form,
  });
}

describe("POST /api/patients/[id]/files", () => {
  it("forwards file + description to the CRM client", async () => {
    (uploadPatientFile as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true });
    const fd = new FormData();
    fd.append("file", new Blob(["x"], { type: "image/png" }), "sapphire_fue_front_view.png");
    fd.append("filename", "sapphire_fue_front_view.png");
    fd.append("description", "Front View");

    const res = await POST(fileReq(fd), { params: Promise.resolve({ id: "123" }) });
    expect(res.status).toBe(200);
    expect(uploadPatientFile).toHaveBeenCalledWith(
      "123",
      expect.any(Blob),
      "sapphire_fue_front_view.png",
      "Front View",
      "Dosyalar"
    );
  });

  it("forwards a template sub folder", async () => {
    (uploadPatientFile as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true });
    const fd = new FormData();
    fd.append("file", new Blob(["x"], { type: "image/png" }), "f.png");
    fd.append("subFolder", "000 öncesi");

    const res = await POST(fileReq(fd), { params: Promise.resolve({ id: "123" }) });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ subFolder: "000 öncesi" });
    expect(uploadPatientFile).toHaveBeenCalledWith(
      "123",
      expect.any(Blob),
      "f.png",
      "",
      "000 öncesi"
    );
  });

  it("rejects a sub folder outside the template without calling the CRM", async () => {
    const fd = new FormData();
    fd.append("file", new Blob(["x"], { type: "image/png" }), "f.png");
    fd.append("subFolder", "Dosyalarr");

    const res = await POST(fileReq(fd), { params: Promise.resolve({ id: "123" }) });
    expect(res.status).toBe(400);
    expect(uploadPatientFile).not.toHaveBeenCalled();
  });

  it("passes the CRM message through on a 4xx so the user sees it", async () => {
    const { CrmError } = await import("@/lib/crm");
    (uploadPatientFile as ReturnType<typeof vi.fn>).mockRejectedValue(
      new CrmError("Bu kayda Drive klasörü bağlı değil.", 400)
    );
    const fd = new FormData();
    fd.append("file", new Blob(["x"], { type: "image/png" }), "f.png");

    const res = await POST(fileReq(fd), { params: Promise.resolve({ id: "123" }) });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Bu kayda Drive klasörü bağlı değil.");
  });

  it("hides internal detail on a 5xx", async () => {
    const { CrmError } = await import("@/lib/crm");
    (uploadPatientFile as ReturnType<typeof vi.fn>).mockRejectedValue(
      new CrmError("internal boom", 500)
    );
    const fd = new FormData();
    fd.append("file", new Blob(["x"], { type: "image/png" }), "f.png");

    const res = await POST(fileReq(fd), { params: Promise.resolve({ id: "123" }) });
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("Yükleme başarısız");
  });

  it("returns 400 when no file is present", async () => {
    const fd = new FormData();
    fd.append("description", "no file");
    const res = await POST(fileReq(fd), { params: Promise.resolve({ id: "123" }) });
    expect(res.status).toBe(400);
    expect(uploadPatientFile).not.toHaveBeenCalled();
  });
});
