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
      "Front View"
    );
  });

  it("returns 400 when no file is present", async () => {
    const fd = new FormData();
    fd.append("description", "no file");
    const res = await POST(fileReq(fd), { params: Promise.resolve({ id: "123" }) });
    expect(res.status).toBe(400);
    expect(uploadPatientFile).not.toHaveBeenCalled();
  });
});
