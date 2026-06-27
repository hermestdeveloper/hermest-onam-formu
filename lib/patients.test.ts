import { describe, it, expect, vi, afterEach } from "vitest";
import { searchPatientsClient } from "@/lib/patients";

afterEach(() => vi.restoreAllMocks());

describe("searchPatientsClient", () => {
  it("hits the proxy and returns the data array", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ data: [{ id: 1, name: "Ahmet" }], total: 1, page: 1 }), {
        status: 200,
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await searchPatientsClient("ahmet");
    expect(String(fetchMock.mock.calls[0][0])).toContain("/api/patients?search=ahmet");
    expect(result[0].name).toBe("Ahmet");
  });

  it("throws on a non-ok response", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("x", { status: 500 })));
    await expect(searchPatientsClient("ahmet")).rejects.toThrow();
  });
});
