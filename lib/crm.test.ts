import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  searchPatients,
  uploadPatientFile,
  getCrmConfig,
  getBoardFilter,
  CrmError,
} from "@/lib/crm";

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

describe("getBoardFilter", () => {
  it("defaults to the Danışanlar board when unset", () => {
    delete process.env.CRM_BOARD;
    expect(getBoardFilter()).toBe("Danışanlar");
  });
  it("honours an override", () => {
    process.env.CRM_BOARD = "Takipler";
    expect(getBoardFilter()).toBe("Takipler");
  });
  it("returns an empty string when explicitly disabled", () => {
    process.env.CRM_BOARD = "";
    expect(getBoardFilter()).toBe("");
  });
});

describe("searchPatients", () => {
  it("calls the CRM with X-API-Key and query params", async () => {
    const fetchMock = vi.fn(async (_url: string | URL, _init?: RequestInit) =>
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

  it("sends the board filter when one is given", async () => {
    const fetchMock = vi.fn(async (_url: string | URL, _init?: RequestInit) =>
      new Response(JSON.stringify({ data: [], total: 0, page: 1 }), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);

    await searchPatients({ search: "ahmet", page: 1, limit: 20, board: "Danışanlar" });

    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.searchParams.get("board")).toBe("Danışanlar");
  });

  it("omits the board param when the filter is empty", async () => {
    const fetchMock = vi.fn(async (_url: string | URL, _init?: RequestInit) =>
      new Response(JSON.stringify({ data: [], total: 0, page: 1 }), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);

    await searchPatients({ search: "ahmet", page: 1, limit: 20, board: "  " });

    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.searchParams.has("board")).toBe(false);
  });

  it("throws CrmError on non-2xx", async () => {
    vi.stubGlobal("fetch", vi.fn(async (_url: string | URL, _init?: RequestInit) => new Response("nope", { status: 502 })));
    await expect(searchPatients({ search: "x", page: 1, limit: 20 })).rejects.toMatchObject({
      status: 502,
    });
  });
});

describe("uploadPatientFile", () => {
  it("POSTs multipart with file + description and the key", async () => {
    const fetchMock = vi.fn(async (_url: string | URL, _init?: RequestInit) => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const blob = new Blob(["x"], { type: "image/png" });
    await uploadPatientFile("123", blob, "sapphire_fue_front_view.png", "Front View");

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("https://crm.test/api/webhooks/patients/123/files");
    expect((init as RequestInit).method).toBe("POST");
    expect((init as RequestInit).headers).toMatchObject({ "X-API-Key": "crm_secret" });
    const body = (init as RequestInit).body as FormData;
    expect(body).toBeInstanceOf(FormData);
    expect(body.get("description")).toBe("Front View");
    // subFolder gonderilmezse dosya danisan klasorunun kokune duserdi (#84).
    expect(body.get("subFolder")).toBe("Dosyalar");
    const sent = body.get("file");
    expect(sent).toBeInstanceOf(Blob);
  });

  it("sends the requested sub folder", async () => {
    const fetchMock = vi.fn(async (_url: string | URL, _init?: RequestInit) => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const blob = new Blob(["x"], { type: "image/png" });
    await uploadPatientFile("123", blob, "f.png", "Front View", "000 öncesi");

    const body = (fetchMock.mock.calls[0][1] as RequestInit).body as FormData;
    expect(body.get("subFolder")).toBe("000 öncesi");
  });

  it("throws CrmError on non-2xx upload", async () => {
    vi.stubGlobal("fetch", vi.fn(async (_url: string | URL, _init?: RequestInit) => new Response("nope", { status: 500 })));
    const blob = new Blob(["x"], { type: "image/png" });
    await expect(
      uploadPatientFile("123", blob, "f.png", "Front View")
    ).rejects.toMatchObject({ status: 500 });
  });

  it("surfaces the CRM error message so the UI can show it", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            success: false,
            error: {
              statusCode: 400,
              message: ["Bu kayda Drive klasörü bağlı değil. Önce CRM üzerinden bir Drive klasörü bağlayın."],
            },
          }),
          { status: 400 }
        )
      )
    );
    const blob = new Blob(["x"], { type: "image/png" });
    await expect(
      uploadPatientFile("123", blob, "f.png", "Front View")
    ).rejects.toMatchObject({
      status: 400,
      message: "Bu kayda Drive klasörü bağlı değil. Önce CRM üzerinden bir Drive klasörü bağlayın.",
    });
  });
});
