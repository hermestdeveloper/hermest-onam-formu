import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { searchPatients, uploadPatientFile, getCrmConfig, CrmError } from "@/lib/crm";

const OLD_ENV = { ...process.env };

beforeEach(() => {
  process.env.CRM_BASE_URL = "https://crm.test";
  process.env.CRM_API_KEY = "crm_secret";
});
afterEach(() => {
  process.env = { ...OLD_ENV };
  vi.restoreAllMocks();
});

describe("getCrmConfig", () => {
  it("throws CrmError(500) when env is missing", () => {
    delete process.env.CRM_API_KEY;
    expect(() => getCrmConfig()).toThrowError(CrmError);
  });
  it("strips a trailing slash from baseUrl", () => {
    process.env.CRM_BASE_URL = "https://crm.test/";
    expect(getCrmConfig().baseUrl).toBe("https://crm.test");
  });
});

describe("searchPatients", () => {
  it("calls the CRM with X-API-Key and query params", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ data: [], total: 0, page: 1 }), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);

    await searchPatients({ search: "ahmet", page: 1, limit: 20 });

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/api/webhooks/patients");
    expect(String(url)).toContain("search=ahmet");
    expect(String(url)).toContain("limit=20");
    expect((init as RequestInit).headers).toMatchObject({ "X-API-Key": "crm_secret" });
  });

  it("throws CrmError on non-2xx", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 502 })));
    await expect(searchPatients({ search: "x", page: 1, limit: 20 })).rejects.toMatchObject({
      status: 502,
    });
  });
});

describe("uploadPatientFile", () => {
  it("POSTs multipart with file + description and the key", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const blob = new Blob(["x"], { type: "image/png" });
    await uploadPatientFile("123", blob, "sapphire_fue_front_view.png", "Front View");

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("https://crm.test/api/webhooks/patients/123/files");
    expect((init as RequestInit).method).toBe("POST");
    const body = (init as RequestInit).body as FormData;
    expect(body).toBeInstanceOf(FormData);
    expect(body.get("description")).toBe("Front View");
    const sent = body.get("file");
    expect(sent).toBeInstanceOf(Blob);
  });
});
