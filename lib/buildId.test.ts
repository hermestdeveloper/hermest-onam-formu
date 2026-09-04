import { describe, it, expect, afterEach, vi } from "vitest";

const readFileSync = vi.hoisted(() => vi.fn());
vi.mock("node:fs", () => ({ readFileSync }));

const { readBuildId } = await import("@/lib/buildId");

afterEach(() => {
  readFileSync.mockReset();
});

describe("readBuildId", () => {
  it("dosyadaki degeri okur, bosluklari kirpar", () => {
    readFileSync.mockReturnValue("QwG_cmacn-QJ9a92kX-Gs\n");
    expect(readBuildId()).toBe("QwG_cmacn-QJ9a92kX-Gs");
  });

  it("BUILD_ID dosyasi okunamazsa 'unknown' doner", () => {
    // Bu, surum kontrolunun en tehlikeli hata bicimini engelliyor: "unknown"
    // gorunce istemci karsilastirmayi atliyor. Rastgele/degisken bir deger
    // donseydi bos formdaki her sekme sonsuz yenileme dongusune girerdi.
    readFileSync.mockImplementation(() => {
      throw new Error("ENOENT");
    });
    expect(readBuildId()).toBe("unknown");
  });
});
