import { describe, it, expect, vi, afterEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/crm", () => ({
  CrmError: class CrmError extends Error {
    status: number;
    constructor(m: string, s: number) { super(m); this.status = s; }
  },
  searchPatients: vi.fn(),
}));

import { GET } from "@/app/api/patients/route";
import { searchPatients } from "@/lib/crm";

afterEach(() => vi.clearAllMocks());

function req(qs: string) {
  return new NextRequest(new URL(`http://localhost/api/patients${qs}`));
}

describe("GET /api/patients", () => {
  it("short-circuits queries under 2 chars without calling CRM", async () => {
    const res = await GET(req("?search=a"));
    const body = await res.json();
    expect(body).toEqual({ data: [], total: 0, page: 1 });
    expect(searchPatients).not.toHaveBeenCalled();
  });

  it("returns CRM results for a valid query", async () => {
    (searchPatients as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [{ id: 1, name: "Ahmet" }],
      total: 1,
      page: 1,
    });
    const res = await GET(req("?search=ahmet"));
    expect(res.status).toBe(200);
    expect((await res.json()).data[0].name).toBe("Ahmet");
  });

  it("maps CrmError status to the response", async () => {
    const { CrmError } = await import("@/lib/crm");
    (searchPatients as ReturnType<typeof vi.fn>).mockRejectedValue(new CrmError("x", 502));
    const res = await GET(req("?search=ahmet"));
    expect(res.status).toBe(502);
  });
});
