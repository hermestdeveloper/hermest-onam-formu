# CRM Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add CRM patient search and, on "Download Consent Sheet", upload the generated PNG sheet plus the filled raw photos to the selected patient's CRM folder — then ship the app on `onam.hermestclinic.net` via Docker + nginx + Let's Encrypt.

**Architecture:** The browser never sees the CRM API key. Two server-side Next.js route handlers proxy to the CRM (`GET /api/patients`, `POST /api/patients/[id]/files`), injecting `X-API-Key` from server env. The client searches patients through the proxy, auto-fills name + country from the result, and on download builds one upload per file (sheet + each filled photo) and posts them through the proxy. Output stays PNG.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript (strict), Vitest (new, dev-only), Docker, nginx, certbot. No new runtime dependencies.

## Global Constraints

- **Runtime:** Node.js 24. Next.js `^16.2.2`, React `^19.2.4`. TypeScript strict mode.
- **Secrets:** `CRM_API_KEY` and `CRM_BASE_URL` are server-only env vars (NOT `NEXT_PUBLIC_`). The key must never reach client JS.
- **Output format:** PNG only. No PDF. No new runtime dependency for output.
- **Turkish text:** All user-facing strings preserve Turkish characters (ç, ğ, ı, ö, ş, ü, Ç, Ğ, İ, Ö, Ş, Ü). UI labels in this app are English by existing convention; error/status copy added here is Turkish where user-facing in the brief — match the surrounding component's English UI for on-sheet text, Turkish for app-status toasts only if consistent. When in doubt, keep existing English UI labels.
- **Upload trigger:** Files are uploaded ONLY when "Download Consent Sheet" is pressed — never on image selection.
- **Patient required:** Download button is disabled unless a CRM patient is selected AND at least one image slot is filled.
- **Filenames:** Treatment method is slugified and prefixed. Photos: `<method_slug>_<view>.<ext>` (e.g. `sapphire_fue_front_view.jpg`). Sheet: `hermest-visual-consent-sheet-<method_slug>-<YYYY-MM-DD>.png`. View map: front→`front_view`, top→`top_view`, right→`right_profile`, left→`left_profile`.
- **Path alias:** Use `@/` → repo root (added in Task 1).
- **Deployment:** Docker Compose, container binds `127.0.0.1:3000`; host nginx vhost `onam.hermestclinic.net` → `proxy_pass http://127.0.0.1:3000`; `client_max_body_size 20m`; HTTPS via `certbot --nginx`.
- **Next 16 note:** Route-handler dynamic params are async — type as `{ params: Promise<{ id: string }> }` and `await params`.

---

## Task 1: Project setup — gitignore, untrack .DS_Store, Vitest, path alias

**Files:**
- Create: `.gitignore`
- Create: `vitest.config.ts`
- Create: `lib/smoke.test.ts`
- Modify: `package.json` (add `test` scripts + `vitest` devDependency)
- Modify: `tsconfig.json` (add `baseUrl` + `paths`)

**Interfaces:**
- Produces: a working `npm test` (Vitest) and the `@/*` import alias used by every later task.

- [ ] **Step 1: Create `.gitignore`**

```gitignore
# dependencies
/node_modules

# next.js
/.next
/out

# production
/build

# misc
.DS_Store
*.pem

# env
.env
.env*.local
.env.local

# vercel
.vercel

# typescript
*.tsbuildinfo
next-env.d.ts
```

- [ ] **Step 2: Stop tracking `.DS_Store`**

Run: `git rm --cached .DS_Store`
Expected: `rm '.DS_Store'`

- [ ] **Step 3: Install Vitest (dev)**

Run: `npm install -D vitest`
Expected: `package.json` gains `"vitest"` under `devDependencies`; lockfile updates.

- [ ] **Step 4: Add test scripts to `package.json`**

In `package.json` `"scripts"`, add:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 5: Add path alias to `tsconfig.json`**

In `compilerOptions`, add:

```json
"baseUrl": ".",
"paths": { "@/*": ["./*"] }
```

- [ ] **Step 6: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
});
```

- [ ] **Step 7: Write smoke test `lib/smoke.test.ts`**

```ts
import { describe, it, expect } from "vitest";

describe("smoke", () => {
  it("runs the test runner", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 8: Run the smoke test**

Run: `npm test`
Expected: PASS — 1 passed.

- [ ] **Step 9: Commit**

```bash
git add .gitignore vitest.config.ts lib/smoke.test.ts package.json package-lock.json tsconfig.json
git commit -m "chore: add vitest, gitignore, @/ path alias; untrack .DS_Store"
```

---

## Task 2: Shared types (`lib/types.ts`)

**Files:**
- Create: `lib/types.ts`

**Interfaces:**
- Produces:
  - `Patient = { id: number | string; name: string; phone?: string; email?: string; country?: string }`
  - `PatientSearchResponse = { data: Patient[]; total: number; page: number }`
  - `SlotId = "front" | "top" | "right" | "left"`
  - `Slot = { id: SlotId; label: string; hint: string; dataUrl: string | null; file: File | null }`
  - `CountryOption = { code: string; flag: string; name: string }`
  - `UploadStatus = "pending" | "uploading" | "success" | "error"`
  - `UploadItem = { key: string; filename: string; description: string; blob: Blob }`
  - `UploadResult = { key: string; status: UploadStatus; error?: string }`

- [ ] **Step 1: Create `lib/types.ts`**

```ts
export type Patient = {
  id: number | string;
  name: string;
  phone?: string;
  email?: string;
  country?: string;
};

export type PatientSearchResponse = {
  data: Patient[];
  total: number;
  page: number;
};

export type SlotId = "front" | "top" | "right" | "left";

export type Slot = {
  id: SlotId;
  label: string;
  hint: string;
  dataUrl: string | null;
  file: File | null;
};

export type CountryOption = {
  code: string;
  flag: string;
  name: string;
};

export type UploadStatus = "pending" | "uploading" | "success" | "error";

export type UploadItem = {
  key: string;
  filename: string;
  description: string;
  blob: Blob;
};

export type UploadResult = {
  key: string;
  status: UploadStatus;
  error?: string;
};
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/types.ts
git commit -m "feat: add shared types for CRM integration"
```

---

## Task 3: Country library (`lib/country.ts`) + resolver

**Files:**
- Create: `lib/country.ts`
- Create: `lib/country.test.ts`

**Interfaces:**
- Consumes: `CountryOption` from `@/lib/types`.
- Produces:
  - `getFlagEmoji(code: string): string`
  - `countryOptions: CountryOption[]` (the same sorted list currently inlined in `page.tsx`, US first)
  - `resolveCountryCode(value: string | null | undefined): string | null` — maps a CRM-provided ISO alpha-2 code OR a country name to an internal code; returns `null` if unrecognised.

- [ ] **Step 1: Write the failing test `lib/country.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { getFlagEmoji, resolveCountryCode, countryOptions } from "@/lib/country";

describe("getFlagEmoji", () => {
  it("converts an ISO code to a flag emoji", () => {
    expect(getFlagEmoji("DE")).toBe("🇩🇪");
  });
});

describe("countryOptions", () => {
  it("lists US first and includes Germany", () => {
    expect(countryOptions[0].code).toBe("US");
    expect(countryOptions.some((c) => c.code === "DE")).toBe(true);
  });
});

describe("resolveCountryCode", () => {
  it("accepts a valid ISO alpha-2 code (any case)", () => {
    expect(resolveCountryCode("tr")).toBe("TR");
    expect(resolveCountryCode("DE")).toBe("DE");
  });
  it("resolves a country name to its code", () => {
    expect(resolveCountryCode("Germany")).toBe("DE");
  });
  it("returns null for unknown input", () => {
    expect(resolveCountryCode("Zzz")).toBeNull();
    expect(resolveCountryCode("")).toBeNull();
    expect(resolveCountryCode(null)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/country.test.ts`
Expected: FAIL — cannot find module `@/lib/country`.

- [ ] **Step 3: Create `lib/country.ts`**

Move the `countryCodes` array, `getFlagEmoji`, `regionNames`, and `countryOptions` verbatim out of `app/page.tsx` into this module, then add `resolveCountryCode`.

```ts
import type { CountryOption } from "@/lib/types";

const countryCodes = [
  "AF", "AX", "AL", "DZ", "AS", "AD", "AO", "AI", "AQ", "AG", "AR", "AM",
  "AW", "AU", "AT", "AZ", "BS", "BH", "BD", "BB", "BY", "BE", "BZ", "BJ",
  "BM", "BT", "BO", "BQ", "BA", "BW", "BV", "BR", "IO", "BN", "BG", "BF",
  "BI", "KH", "CM", "CA", "CV", "KY", "CF", "TD", "CL", "CN", "CX", "CC",
  "CO", "KM", "CG", "CD", "CK", "CR", "CI", "HR", "CU", "CW", "CY", "CZ",
  "DK", "DJ", "DM", "DO", "EC", "EG", "SV", "GQ", "ER", "EE", "SZ", "ET",
  "FK", "FO", "FJ", "FI", "FR", "GF", "PF", "TF", "GA", "GM", "GE", "DE",
  "GH", "GI", "GR", "GL", "GD", "GP", "GU", "GT", "GG", "GN", "GW", "GY",
  "HT", "HM", "VA", "HN", "HK", "HU", "IS", "IN", "ID", "IR", "IQ", "IE",
  "IM", "IL", "IT", "JM", "JP", "JE", "JO", "KZ", "KE", "KI", "KP", "KR",
  "KW", "KG", "LA", "LV", "LB", "LS", "LR", "LY", "LI", "LT", "LU", "MO",
  "MG", "MW", "MY", "MV", "ML", "MT", "MH", "MQ", "MR", "MU", "YT", "MX",
  "FM", "MD", "MC", "MN", "ME", "MS", "MA", "MZ", "MM", "NA", "NR", "NP",
  "NL", "NC", "NZ", "NI", "NE", "NG", "NU", "NF", "MK", "MP", "NO", "OM",
  "PK", "PW", "PS", "PA", "PG", "PY", "PE", "PH", "PN", "PL", "PT", "PR",
  "QA", "RE", "RO", "RU", "RW", "BL", "SH", "KN", "LC", "MF", "PM", "VC",
  "WS", "SM", "ST", "SA", "SN", "RS", "SC", "SL", "SG", "SX", "SK", "SI",
  "SB", "SO", "ZA", "GS", "SS", "ES", "LK", "SD", "SR", "SJ", "SE", "CH",
  "SY", "TW", "TJ", "TZ", "TH", "TL", "TG", "TK", "TO", "TT", "TN", "TR",
  "TM", "TC", "TV", "UG", "UA", "AE", "GB", "US", "UM", "UY", "UZ", "VU",
  "VE", "VN", "VG", "VI", "WF", "EH", "YE", "ZM", "ZW",
] as const;

const regionNames = new Intl.DisplayNames(["en"], { type: "region" });

export function getFlagEmoji(countryCode: string): string {
  return countryCode
    .toUpperCase()
    .split("")
    .map((char) => String.fromCodePoint(127397 + char.charCodeAt(0)))
    .join("");
}

export const countryOptions: CountryOption[] = countryCodes
  .map((code) => ({
    code,
    flag: getFlagEmoji(code),
    name: regionNames.of(code) ?? code,
  }))
  .sort((a, b) => {
    if (a.code === "US") return -1;
    if (b.code === "US") return 1;
    return a.name.localeCompare(b.name);
  });

export function resolveCountryCode(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const upper = trimmed.toUpperCase();
  if (countryOptions.some((c) => c.code === upper)) return upper;

  const byName = countryOptions.find(
    (c) => c.name.toLowerCase() === trimmed.toLowerCase()
  );
  return byName ? byName.code : null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/country.test.ts`
Expected: PASS — all assertions green.

- [ ] **Step 5: Commit**

```bash
git add lib/country.ts lib/country.test.ts
git commit -m "feat: extract country list + add resolveCountryCode"
```

> Note: `app/page.tsx` still defines its own copies at this point; they are removed in Task 12 when the page imports from `@/lib/country`.

---

## Task 4: Filename builder (`lib/filenames.ts`)

**Files:**
- Create: `lib/filenames.ts`
- Create: `lib/filenames.test.ts`

**Interfaces:**
- Produces:
  - `slugifyMethod(method: string): string`
  - `extensionForMime(mime: string): string`
  - `slotFileName(slotId: string, mime: string, method: string): string`
  - `consentSheetFileName(date: Date, method: string): string`

- [ ] **Step 1: Write the failing test `lib/filenames.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import {
  slugifyMethod,
  extensionForMime,
  slotFileName,
  consentSheetFileName,
} from "@/lib/filenames";

describe("slugifyMethod", () => {
  it("lowercases and underscores", () => {
    expect(slugifyMethod("SAPPHIRE FUE")).toBe("sapphire_fue");
    expect(slugifyMethod("DHI METHOD")).toBe("dhi_method");
    expect(slugifyMethod("  Unique  FUE ")).toBe("unique_fue");
  });
});

describe("extensionForMime", () => {
  it("maps known mimes and defaults to jpg", () => {
    expect(extensionForMime("image/png")).toBe("png");
    expect(extensionForMime("image/jpeg")).toBe("jpg");
    expect(extensionForMime("application/octet-stream")).toBe("jpg");
  });
});

describe("slotFileName", () => {
  it("prefixes method slug and maps the view", () => {
    expect(slotFileName("front", "image/jpeg", "SAPPHIRE FUE")).toBe(
      "sapphire_fue_front_view.jpg"
    );
    expect(slotFileName("right", "image/png", "DHI METHOD")).toBe(
      "dhi_method_right_profile.png"
    );
  });
});

describe("consentSheetFileName", () => {
  it("includes method slug and ISO date", () => {
    const d = new Date("2026-06-27T10:00:00Z");
    expect(consentSheetFileName(d, "UNIQUE FUE")).toBe(
      "hermest-visual-consent-sheet-unique_fue-2026-06-27.png"
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/filenames.test.ts`
Expected: FAIL — cannot find module `@/lib/filenames`.

- [ ] **Step 3: Create `lib/filenames.ts`**

```ts
const SLOT_FILE_BASENAMES: Record<string, string> = {
  front: "front_view",
  top: "top_view",
  right: "right_profile",
  left: "left_profile",
};

export function slugifyMethod(method: string): string {
  return method
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function extensionForMime(mime: string): string {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/jpeg") return "jpg";
  return "jpg";
}

export function slotFileName(slotId: string, mime: string, method: string): string {
  const base = SLOT_FILE_BASENAMES[slotId] ?? slotId;
  const slug = slugifyMethod(method);
  const ext = extensionForMime(mime);
  return slug ? `${slug}_${base}.${ext}` : `${base}.${ext}`;
}

export function consentSheetFileName(date: Date, method: string): string {
  const stamp = date.toISOString().slice(0, 10);
  const slug = slugifyMethod(method);
  return slug
    ? `hermest-visual-consent-sheet-${slug}-${stamp}.png`
    : `hermest-visual-consent-sheet-${stamp}.png`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/filenames.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/filenames.ts lib/filenames.test.ts
git commit -m "feat: filename builder with treatment-method prefix"
```

---

## Task 5: Extract collage rendering (`lib/collage.ts`)

This is a refactor: move the canvas drawing/export logic out of `app/page.tsx` into a reusable module that returns a `Blob`. Verified by build, not a unit test (canvas/DOM-dependent).

**Files:**
- Create: `lib/collage.ts`
- Modify: `app/page.tsx` (remove moved functions; call `renderCollageBlob`)

**Interfaces:**
- Consumes: `CountryOption` from `@/lib/types`.
- Produces:
  - `type CollageInput = { slots: { id: string; label: string; hint: string; dataUrl: string | null }[]; patientName: string; country: CountryOption; treatmentMethod: string; signatureDataUrl: string | null; date: Date }`
  - `renderCollageBlob(input: CollageInput): Promise<Blob>` — builds the canvas exactly as today and resolves a PNG `Blob`.

- [ ] **Step 1: Create `lib/collage.ts`**

Move these existing items verbatim from `app/page.tsx` into `lib/collage.ts`: the constants `baseExportWidth`, `baseExportHeight`, `basePadding`, `baseGap`, `baseCardHeight`, `baseCardTop`, `minExportScale`, `maxExportScale`, `mobileMaxExportScale`, `consentStatement`; and the functions `drawBackground`, `drawHeader`, `drawConsentFooter`, `drawSlot`, `drawContainedImage`, `roundedRect`, `wrapText`, `getAdaptiveExportScale`, `getDeviceAdjustedScale`, `loadImage`, `canvasToBlob`, plus the `LoadedSlot` type. Mark `loadImage` and `canvasToBlob` as `export` (also used by the page for the signature image and download). Then add the wrapper below, which is the body of today's `exportCollage` minus React state and the download step:

```ts
import type { CountryOption } from "@/lib/types";

// ... (moved constants, LoadedSlot type, and helper functions above) ...

export type CollageInput = {
  slots: { id: string; label: string; hint: string; dataUrl: string | null }[];
  patientName: string;
  country: CountryOption;
  treatmentMethod: string;
  signatureDataUrl: string | null;
  date: Date;
};

export async function renderCollageBlob(input: CollageInput): Promise<Blob> {
  await document.fonts.ready;

  const loadedSlots = await Promise.all(
    input.slots.map(async (slot) => ({
      ...slot,
      image: slot.dataUrl ? await loadImage(slot.dataUrl) : null,
    }))
  );
  const exportScale = getAdaptiveExportScale(loadedSlots);

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(baseExportWidth * exportScale);
  canvas.height = Math.round(baseExportHeight * exportScale);

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas context not available");

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  drawBackground(ctx, canvas.width, canvas.height, exportScale);

  const padding = basePadding * exportScale;
  const gap = baseGap * exportScale;
  const cardWidth = (canvas.width - padding * 2 - gap) / 2;
  const cardHeight = baseCardHeight * exportScale;

  drawHeader(ctx, canvas.width, padding, exportScale, input.date);

  const positions = [
    { x: padding, y: baseCardTop * exportScale },
    { x: padding + cardWidth + gap, y: baseCardTop * exportScale },
    { x: padding, y: baseCardTop * exportScale + cardHeight + gap },
    { x: padding + cardWidth + gap, y: baseCardTop * exportScale + cardHeight + gap },
  ];

  await Promise.all(
    loadedSlots.map(async (slot, index) => {
      await drawSlot(ctx, slot, positions[index], cardWidth, cardHeight, exportScale);
    })
  );

  drawConsentFooter(
    ctx,
    canvas.width,
    canvas.height,
    padding,
    exportScale,
    input.patientName,
    input.country,
    input.treatmentMethod,
    input.signatureDataUrl ? await loadImage(input.signatureDataUrl) : null
  );

  return canvasToBlob(canvas);
}
```

> `drawHeader` gains a `date: Date` parameter (replace its internal `new Date()` with the passed `date`). Keep every other moved function byte-for-byte identical.

- [ ] **Step 2: Update `app/page.tsx` to use the module**

Remove the moved constants/functions from `page.tsx`. Replace the body of `exportCollage` so it calls the module (the download wiring stays in the page — see Task 13 where it is finalized; for now keep behaviour identical):

```tsx
import { renderCollageBlob } from "@/lib/collage";

// inside exportCollage(), replacing the canvas-building block:
const blob = await renderCollageBlob({
  slots,
  patientName,
  country: selectedCountry,
  treatmentMethod,
  signatureDataUrl,
  date: new Date(),
});

const link = document.createElement("a");
const stamp = new Date().toISOString().slice(0, 10);
link.download = `hermest-visual-consent-sheet-${stamp}.png`;
link.href = URL.createObjectURL(blob);
link.click();
setTimeout(() => URL.revokeObjectURL(link.href), 1000);
```

> `loadImage` references inside `page.tsx` (signature canvas `useEffect`) now import from `@/lib/collage`: `import { loadImage } from "@/lib/collage";`.

- [ ] **Step 3: Type-check and build**

Run: `npx tsc --noEmit && npm run build`
Expected: build succeeds; no type errors.

- [ ] **Step 4: Manual parity check**

Run: `npm run dev`, open the app, add an image, draw a signature, click Download. Confirm the downloaded PNG looks identical to before the refactor.

- [ ] **Step 5: Commit**

```bash
git add lib/collage.ts app/page.tsx
git commit -m "refactor: extract collage rendering into lib/collage"
```

---

## Task 6: CRM server library (`lib/crm.ts`)

**Files:**
- Create: `lib/crm.ts`
- Create: `lib/crm.test.ts`

**Interfaces:**
- Consumes: `Patient`, `PatientSearchResponse` from `@/lib/types`.
- Produces:
  - `class CrmError extends Error { status: number }`
  - `getCrmConfig(): { baseUrl: string; apiKey: string }` — reads env, throws `CrmError(…, 500)` if missing.
  - `searchPatients(params: { search: string; page: number; limit: number }): Promise<PatientSearchResponse>`
  - `uploadPatientFile(patientId: string, file: Blob, filename: string, description: string): Promise<unknown>`

- [ ] **Step 1: Write the failing test `lib/crm.test.ts`**

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/crm.test.ts`
Expected: FAIL — cannot find module `@/lib/crm`.

- [ ] **Step 3: Create `lib/crm.ts`**

```ts
import type { PatientSearchResponse } from "@/lib/types";

export class CrmError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "CrmError";
    this.status = status;
  }
}

export function getCrmConfig(): { baseUrl: string; apiKey: string } {
  const baseUrl = process.env.CRM_BASE_URL;
  const apiKey = process.env.CRM_API_KEY;
  if (!baseUrl || !apiKey) {
    throw new CrmError("CRM yapılandırması eksik (CRM_BASE_URL / CRM_API_KEY)", 500);
  }
  return { baseUrl: baseUrl.replace(/\/+$/, ""), apiKey };
}

export async function searchPatients(params: {
  search: string;
  page: number;
  limit: number;
}): Promise<PatientSearchResponse> {
  const { baseUrl, apiKey } = getCrmConfig();
  const url = new URL(`${baseUrl}/api/webhooks/patients`);
  url.searchParams.set("search", params.search);
  url.searchParams.set("page", String(params.page));
  url.searchParams.set("limit", String(params.limit));

  const res = await fetch(url, {
    headers: { "X-API-Key": apiKey },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new CrmError(`CRM arama hatası (${res.status})`, res.status);
  }
  return (await res.json()) as PatientSearchResponse;
}

export async function uploadPatientFile(
  patientId: string,
  file: Blob,
  filename: string,
  description: string
): Promise<unknown> {
  const { baseUrl, apiKey } = getCrmConfig();
  const form = new FormData();
  form.append("file", file, filename);
  if (description) form.append("description", description);

  const res = await fetch(
    `${baseUrl}/api/webhooks/patients/${encodeURIComponent(patientId)}/files`,
    {
      method: "POST",
      headers: { "X-API-Key": apiKey },
      body: form,
    }
  );
  if (!res.ok) {
    throw new CrmError(`CRM yükleme hatası (${res.status})`, res.status);
  }
  return res.json().catch(() => ({}));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/crm.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/crm.ts lib/crm.test.ts
git commit -m "feat: CRM server client (search + upload) with X-API-Key injection"
```

---

## Task 7: `GET /api/patients` proxy route

**Files:**
- Create: `app/api/patients/route.ts`
- Create: `app/api/patients/route.test.ts`

**Interfaces:**
- Consumes: `searchPatients`, `CrmError` from `@/lib/crm`.
- Produces: `GET(request: NextRequest)` returning `PatientSearchResponse` JSON; `{ data: [], total: 0, page: 1 }` for queries shorter than 2 chars; error JSON with the CRM status otherwise.

- [ ] **Step 1: Write the failing test `app/api/patients/route.test.ts`**

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/api/patients/route.test.ts`
Expected: FAIL — cannot find module `@/app/api/patients/route`.

- [ ] **Step 3: Create `app/api/patients/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { searchPatients, CrmError } from "@/lib/crm";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const search = (sp.get("search") ?? "").trim();

  if (search.length < 2) {
    return NextResponse.json({ data: [], total: 0, page: 1 });
  }

  const page = Number(sp.get("page") ?? "1") || 1;
  const limit = Number(sp.get("limit") ?? "20") || 20;

  try {
    const result = await searchPatients({ search, page, limit });
    return NextResponse.json(result);
  } catch (err) {
    const status = err instanceof CrmError ? err.status : 500;
    return NextResponse.json({ error: "Arama başarısız" }, { status });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/api/patients/route.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/patients/route.ts app/api/patients/route.test.ts
git commit -m "feat: GET /api/patients proxy route"
```

---

## Task 8: `POST /api/patients/[id]/files` proxy route

**Files:**
- Create: `app/api/patients/[id]/files/route.ts`
- Create: `app/api/patients/[id]/files/route.test.ts`

**Interfaces:**
- Consumes: `uploadPatientFile`, `CrmError` from `@/lib/crm`.
- Produces: `POST(request: NextRequest, ctx: { params: Promise<{ id: string }> })`. Reads multipart fields `file` (Blob, required), `filename` (string, optional), `description` (string, optional); forwards to `uploadPatientFile`; returns `{ ok: true, result }` or an error with the CRM status.

- [ ] **Step 1: Write the failing test `app/api/patients/[id]/files/route.test.ts`**

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run "app/api/patients/[id]/files/route.test.ts"`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `app/api/patients/[id]/files/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { uploadPatientFile, CrmError } from "@/lib/crm";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Geçersiz form verisi" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "Dosya bulunamadı" }, { status: 400 });
  }

  const description = typeof form.get("description") === "string"
    ? (form.get("description") as string)
    : "";
  const filename =
    (typeof form.get("filename") === "string" && (form.get("filename") as string)) ||
    (file instanceof File ? file.name : "upload");

  try {
    const result = await uploadPatientFile(id, file, filename, description);
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    const status = err instanceof CrmError ? err.status : 500;
    return NextResponse.json({ error: "Yükleme başarısız" }, { status });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run "app/api/patients/[id]/files/route.test.ts"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "app/api/patients/[id]/files/route.ts" "app/api/patients/[id]/files/route.test.ts"
git commit -m "feat: POST /api/patients/[id]/files proxy route"
```

---

## Task 9: Client patient-search helper (`lib/patients.ts`)

**Files:**
- Create: `lib/patients.ts`
- Create: `lib/patients.test.ts`

**Interfaces:**
- Consumes: `Patient`, `PatientSearchResponse` from `@/lib/types`.
- Produces: `searchPatientsClient(search: string, signal?: AbortSignal): Promise<Patient[]>` — calls `GET /api/patients`, returns `data`.

- [ ] **Step 1: Write the failing test `lib/patients.test.ts`**

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/patients.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `lib/patients.ts`**

```ts
import type { Patient, PatientSearchResponse } from "@/lib/types";

export async function searchPatientsClient(
  search: string,
  signal?: AbortSignal
): Promise<Patient[]> {
  const params = new URLSearchParams({ search, page: "1", limit: "20" });
  const res = await fetch(`/api/patients?${params.toString()}`, { signal });
  if (!res.ok) {
    throw new Error("Arama başarısız");
  }
  const json = (await res.json()) as PatientSearchResponse;
  return json.data ?? [];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/patients.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/patients.ts lib/patients.test.ts
git commit -m "feat: client patient-search helper"
```

---

## Task 10: Client upload orchestrator (`lib/upload.ts`)

**Files:**
- Create: `lib/upload.ts`
- Create: `lib/upload.test.ts`

**Interfaces:**
- Consumes: `Slot`, `UploadItem`, `UploadResult`, `UploadStatus` from `@/lib/types`; `slotFileName`, `consentSheetFileName` from `@/lib/filenames`.
- Produces:
  - `buildUploadItems(sheetBlob: Blob, slots: Slot[], method: string, date: Date): UploadItem[]` — sheet first, then one item per **filled** slot.
  - `uploadItems(patientId: string | number, items: UploadItem[], onUpdate: (key: string, status: UploadStatus, error?: string) => void, concurrency?: number): Promise<UploadResult[]>`

- [ ] **Step 1: Write the failing test `lib/upload.test.ts`**

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/upload.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `lib/upload.ts`**

```ts
import type { Slot, UploadItem, UploadResult, UploadStatus } from "@/lib/types";
import { slotFileName, consentSheetFileName } from "@/lib/filenames";

export function buildUploadItems(
  sheetBlob: Blob,
  slots: Slot[],
  method: string,
  date: Date
): UploadItem[] {
  const items: UploadItem[] = [
    {
      key: "sheet",
      filename: consentSheetFileName(date, method),
      description: "Visual Consent Sheet",
      blob: sheetBlob,
    },
  ];

  for (const slot of slots) {
    if (slot.file) {
      items.push({
        key: slot.id,
        filename: slotFileName(slot.id, slot.file.type, method),
        description: slot.label,
        blob: slot.file,
      });
    }
  }

  return items;
}

async function postItem(patientId: string | number, item: UploadItem): Promise<void> {
  const form = new FormData();
  form.append("file", item.blob, item.filename);
  form.append("filename", item.filename);
  form.append("description", item.description);

  const res = await fetch(`/api/patients/${encodeURIComponent(String(patientId))}/files`, {
    method: "POST",
    body: form,
  });

  if (!res.ok) {
    const message = await res
      .json()
      .then((d) => (d && typeof d.error === "string" ? d.error : null))
      .catch(() => null);
    throw new Error(message || `Yükleme hatası (${res.status})`);
  }
}

export async function uploadItems(
  patientId: string | number,
  items: UploadItem[],
  onUpdate: (key: string, status: UploadStatus, error?: string) => void,
  concurrency = 2
): Promise<UploadResult[]> {
  const results: UploadResult[] = [];
  let index = 0;

  async function worker(): Promise<void> {
    while (index < items.length) {
      const current = items[index++];
      onUpdate(current.key, "uploading");
      try {
        await postItem(patientId, current);
        onUpdate(current.key, "success");
        results.push({ key: current.key, status: "success" });
      } catch (e) {
        const error = e instanceof Error ? e.message : "Bilinmeyen hata";
        onUpdate(current.key, "error", error);
        results.push({ key: current.key, status: "error", error });
      }
    }
  }

  const count = Math.max(1, Math.min(concurrency, items.length));
  await Promise.all(Array.from({ length: count }, () => worker()));
  return results;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/upload.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/upload.ts lib/upload.test.ts
git commit -m "feat: client upload orchestrator with per-file status"
```

---

## Task 11: PatientSearch component (`app/components/PatientSearch.tsx`)

UI component; gate is build + manual (no unit test — debounce/DOM).

**Files:**
- Create: `app/components/PatientSearch.tsx`
- Modify: `app/globals.css` (search dropdown styles)

**Interfaces:**
- Consumes: `searchPatientsClient` from `@/lib/patients`; `Patient` from `@/lib/types`.
- Produces: default-exported `PatientSearch` component:
  - Props: `{ selected: Patient | null; onSelect: (patient: Patient) => void; onClear: () => void }`
  - Behaviour: debounced (300 ms) live search via `searchPatientsClient`, aborts the previous request, shows a results dropdown (name + phone/email), calls `onSelect` on click. When a patient is selected, shows the selected name with a "Değiştir" (clear) action.

- [ ] **Step 1: Create `app/components/PatientSearch.tsx`**

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import type { Patient } from "@/lib/types";
import { searchPatientsClient } from "@/lib/patients";

type Props = {
  selected: Patient | null;
  onSelect: (patient: Patient) => void;
  onClear: () => void;
};

export default function PatientSearch({ selected, onSelect, onClear }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Patient[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "empty">("idle");
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (selected) return;

    const term = query.trim();
    if (term.length < 2) {
      setResults([]);
      setStatus("idle");
      return;
    }

    const handle = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setStatus("loading");
      try {
        const data = await searchPatientsClient(term, controller.signal);
        setResults(data);
        setStatus(data.length === 0 ? "empty" : "idle");
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setStatus("error");
      }
    }, 300);

    return () => clearTimeout(handle);
  }, [query, selected]);

  if (selected) {
    return (
      <div className="patient-selected">
        <div>
          <strong>{selected.name}</strong>
          {selected.phone ? <span> · {selected.phone}</span> : null}
        </div>
        <button type="button" className="secondary-button" onClick={onClear}>
          Değiştir
        </button>
      </div>
    );
  }

  return (
    <div className="patient-search">
      <input
        type="text"
        placeholder="İsim, telefon veya e-posta ile ara"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      {status === "loading" ? <p className="patient-hint">Aranıyor…</p> : null}
      {status === "error" ? <p className="patient-hint error">Arama başarısız, tekrar deneyin</p> : null}
      {status === "empty" ? <p className="patient-hint">Sonuç bulunamadı</p> : null}
      {results.length > 0 ? (
        <ul className="patient-results">
          {results.map((patient) => (
            <li key={String(patient.id)}>
              <button
                type="button"
                onClick={() => {
                  onSelect(patient);
                  setQuery("");
                  setResults([]);
                  setStatus("idle");
                }}
              >
                <span className="patient-name">{patient.name}</span>
                <span className="patient-meta">
                  {[patient.phone, patient.email].filter(Boolean).join(" · ")}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 2: Add dropdown styles to `app/globals.css`**

Append:

```css
.patient-search {
  position: relative;
  display: grid;
  gap: 8px;
}

.patient-search input {
  width: 100%;
  padding: 16px 18px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.1);
  color: #ffffff;
  outline: none;
}

.patient-search input::placeholder {
  color: rgba(255, 255, 255, 0.5);
}

.patient-hint {
  margin: 0;
  color: var(--text-soft);
  font-size: 0.9rem;
}

.patient-hint.error {
  color: #ffd2d2;
}

.patient-results {
  list-style: none;
  margin: 0;
  padding: 6px;
  display: grid;
  gap: 4px;
  max-height: 260px;
  overflow-y: auto;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.96);
}

.patient-results button {
  width: 100%;
  display: grid;
  gap: 2px;
  padding: 12px 14px;
  border: 0;
  border-radius: 12px;
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.patient-results button:hover {
  background: rgba(0, 127, 163, 0.12);
}

.patient-name {
  color: var(--navy-strong);
  font-weight: 700;
}

.patient-meta {
  color: #6f8f9a;
  font-size: 0.86rem;
}

.patient-selected {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.16);
  color: #ffffff;
}
```

- [ ] **Step 3: Build to verify the component compiles**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add app/components/PatientSearch.tsx app/globals.css
git commit -m "feat: PatientSearch debounced search component"
```

---

## Task 12: Wire patient search + country auto-fill + slot File storage into `page.tsx`

**Files:**
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: `PatientSearch` (default) from `@/app/components/PatientSearch`; `countryOptions`, `resolveCountryCode` from `@/lib/country`; `Slot`, `Patient` from `@/lib/types`.
- Produces: `selectedPatient` state; slots that carry the original `File`; country auto-filled on patient selection.

- [ ] **Step 1: Update imports and remove inlined country code from `page.tsx`**

At the top of `app/page.tsx`:

```tsx
import PatientSearch from "@/app/components/PatientSearch";
import { countryOptions, resolveCountryCode } from "@/lib/country";
import type { Patient, Slot } from "@/lib/types";
```

Delete the now-duplicated `countryCodes`, `regionNames`, `countryOptions`, `getFlagEmoji`, and the local `Slot`/`CountryOption` type declarations from `page.tsx` (they live in `@/lib/country` and `@/lib/types` now). Keep `treatmentMethodOptions`, `consentStatement` is already in `lib/collage`.

- [ ] **Step 2: Give slots a `file` field**

Change `initialSlots` so each slot includes `file: null`:

```tsx
const initialSlots: Slot[] = [
  { id: "front", label: "Front View", hint: "Frontal documentation", dataUrl: null, file: null },
  { id: "top", label: "Top View", hint: "Crown and top area", dataUrl: null, file: null },
  { id: "right", label: "Right Profile", hint: "Right-side angle", dataUrl: null, file: null },
  { id: "left", label: "Left Profile", hint: "Left-side angle", dataUrl: null, file: null },
];
```

- [ ] **Step 3: Add `selectedPatient` state and handlers**

```tsx
const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);

const handlePatientSelect = (patient: Patient) => {
  setSelectedPatient(patient);
  setPatientName(patient.name);
  const code = resolveCountryCode(patient.country);
  if (code) setCountryCode(code);
};

const handlePatientClear = () => {
  setSelectedPatient(null);
  setPatientName("");
};
```

- [ ] **Step 4: Store the original File on image select**

In `handleFileChange`, keep the original `File` alongside the processed `dataUrl`:

```tsx
void processImageFile(file).then((result) => {
  setSlots((current) =>
    current.map((slot) =>
      slot.id === slotId ? { ...slot, dataUrl: result, file } : slot
    )
  );
});
```

And in `handleClear`, reset `file` too:

```tsx
setSlots((current) =>
  current.map((slot) =>
    slot.id === slotId ? { ...slot, dataUrl: null, file: null } : slot
  )
);
```

- [ ] **Step 5: Replace the free-text Patient Name input with `PatientSearch`**

Replace the existing `Patient Name` `<label className="input-stack">…</label>` block with:

```tsx
<div className="input-stack">
  <span>Patient</span>
  <PatientSearch
    selected={selectedPatient}
    onSelect={handlePatientSelect}
    onClear={handlePatientClear}
  />
</div>
```

- [ ] **Step 6: Type-check and build**

Run: `npx tsc --noEmit && npm run build`
Expected: success.

- [ ] **Step 7: Manual check**

`npm run dev`: type a query (proxy will error without real env — that is expected; the dropdown should show "Arama başarısız"). With a stubbed/real CRM, selecting a patient fills the name display and sets the country. Adding an image still works.

- [ ] **Step 8: Commit**

```bash
git add app/page.tsx
git commit -m "feat: patient search + country auto-fill + raw File storage in page"
```

---

## Task 13: Download → local save + CRM upload + progress/retry UI

**Files:**
- Modify: `app/page.tsx`
- Modify: `app/globals.css` (upload progress styles)

**Interfaces:**
- Consumes: `renderCollageBlob` from `@/lib/collage`; `buildUploadItems`, `uploadItems` from `@/lib/upload`; `UploadItem`, `UploadStatus` from `@/lib/types`.
- Produces: the final download handler — renders the sheet, downloads it locally (always), then uploads sheet + filled photos to the selected patient with per-file status and a retry action for failures.

- [ ] **Step 1: Add upload imports + state to `page.tsx`**

```tsx
import { renderCollageBlob } from "@/lib/collage";
import { buildUploadItems, uploadItems } from "@/lib/upload";
import type { UploadItem, UploadStatus } from "@/lib/types";

const [isUploading, setIsUploading] = useState(false);
const [uploadStatus, setUploadStatus] = useState<Record<string, UploadStatus>>({});
const [uploadItemsList, setUploadItemsList] = useState<UploadItem[]>([]);
```

- [ ] **Step 2: Replace `exportCollage` with the download+upload handler**

```tsx
const runUploads = async (patientId: string | number, items: UploadItem[]) => {
  setIsUploading(true);
  setUploadStatus(Object.fromEntries(items.map((i) => [i.key, "pending"])));
  try {
    await uploadItems(patientId, items, (key, status) =>
      setUploadStatus((prev) => ({ ...prev, [key]: status }))
    );
  } finally {
    setIsUploading(false);
  }
};

const handleDownload = async () => {
  if (!selectedPatient) return;
  setIsExporting(true);
  try {
    const now = new Date();
    const blob = await renderCollageBlob({
      slots,
      patientName,
      country: selectedCountry,
      treatmentMethod,
      signatureDataUrl,
      date: now,
    });

    // Always download locally first.
    const link = document.createElement("a");
    const stamp = now.toISOString().slice(0, 10);
    link.download = `hermest-visual-consent-sheet-${stamp}.png`;
    link.href = URL.createObjectURL(blob);
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);

    // Then upload sheet + filled photos to the CRM.
    const items = buildUploadItems(blob, slots, treatmentMethod, now);
    setUploadItemsList(items);
    await runUploads(selectedPatient.id, items);
  } finally {
    setIsExporting(false);
  }
};

const retryFailed = async () => {
  if (!selectedPatient) return;
  const failed = uploadItemsList.filter((i) => uploadStatus[i.key] === "error");
  if (failed.length === 0) return;
  await runUploads(selectedPatient.id, failed);
};
```

- [ ] **Step 3: Update the download button + add the progress panel**

Change the button to require a patient and reflect the upload phase:

```tsx
<button
  className="download-button"
  onClick={handleDownload}
  disabled={filledCount === 0 || !selectedPatient || isExporting || isUploading}
>
  {isExporting ? "Preparing..." : isUploading ? "Uploading..." : "Download Consent Sheet"}
</button>

{uploadItemsList.length > 0 ? (
  <div className="upload-panel">
    <ul>
      {uploadItemsList.map((item) => {
        const status = uploadStatus[item.key] ?? "pending";
        const icon =
          status === "success" ? "✓" : status === "error" ? "✗" : status === "uploading" ? "…" : "•";
        return (
          <li key={item.key} className={`upload-row ${status}`}>
            <span className="upload-icon">{icon}</span>
            <span className="upload-name">{item.filename}</span>
          </li>
        );
      })}
    </ul>
    {uploadItemsList.some((i) => uploadStatus[i.key] === "error") && !isUploading ? (
      <button type="button" className="secondary-button" onClick={retryFailed}>
        Başarısızları tekrar dene
      </button>
    ) : null}
  </div>
) : null}
```

- [ ] **Step 4: Add progress styles to `app/globals.css`**

```css
.upload-panel {
  display: grid;
  gap: 10px;
  margin-top: 4px;
  padding: 14px 16px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.12);
}

.upload-panel ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 6px;
}

.upload-row {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--text-soft);
  font-size: 0.9rem;
}

.upload-row .upload-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.upload-row.success { color: #c9f3d8; }
.upload-row.error { color: #ffd2d2; }
.upload-icon { width: 1.1rem; text-align: center; }
```

- [ ] **Step 5: Type-check and build**

Run: `npx tsc --noEmit && npm run build`
Expected: success.

- [ ] **Step 6: Run the full unit suite**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 7: Manual end-to-end (with real or stubbed CRM env)**

Set `.env` with `CRM_BASE_URL`/`CRM_API_KEY`, `npm run dev`: search → select patient (name + country fill) → add 1–4 images + signature → Download → local PNG downloads AND the progress panel shows each file going ✓; force a failure (bad key) → rows show ✗ and "tekrar dene" re-uploads only those.

- [ ] **Step 8: Commit**

```bash
git add app/page.tsx app/globals.css
git commit -m "feat: download + CRM upload with progress and retry"
```

---

## Task 14: Production build config — standalone + Docker

**Files:**
- Modify: `next.config.ts` (add `output: "standalone"`)
- Create: `Dockerfile`
- Create: `compose.yml`
- Create: `.dockerignore`
- Create: `.env.example`
- Create: `public/.gitkeep`

**Interfaces:**
- Produces: a container that serves the app on `127.0.0.1:3000` reading `CRM_BASE_URL`/`CRM_API_KEY` from `.env`.

- [ ] **Step 1: Enable standalone output in `next.config.ts`**

Add `output: "standalone"` to the config object (keep `reactStrictMode` and `headers`):

```ts
const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "standalone",
  async headers() {
    /* unchanged */
  },
};
```

- [ ] **Step 2: Create `public/.gitkeep`**

Empty file so the `public/` directory exists for the Docker `COPY` step.

```
```

- [ ] **Step 3: Create `.env.example`**

```bash
# CRM webhook integration (server-only — never commit the real .env)
CRM_BASE_URL=https://crm.example.com
CRM_API_KEY=crm_xxx
```

- [ ] **Step 4: Create `.dockerignore`**

```dockerignore
node_modules
.next
.git
.env
.env*.local
docs
*.md
.DS_Store
```

- [ ] **Step 5: Create `Dockerfile`**

```dockerfile
# syntax=docker/dockerfile:1
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:24-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
```

- [ ] **Step 6: Create `compose.yml`**

```yaml
services:
  onam:
    build: .
    container_name: hermest-onam
    restart: unless-stopped
    env_file: .env
    ports:
      - "127.0.0.1:3000:3000"
```

- [ ] **Step 7: Verify the standalone build locally**

Run: `npm run build`
Expected: build succeeds and `.next/standalone/server.js` exists.
Run (if Docker is available locally): `docker build -t hermest-onam .`
Expected: image builds without error.

- [ ] **Step 8: Commit**

```bash
git add next.config.ts Dockerfile compose.yml .dockerignore .env.example public/.gitkeep
git commit -m "build: standalone output + Docker/compose for self-hosting"
```

---

## Task 15: Deployment artifacts — nginx vhost + runbook

**Files:**
- Create: `deploy/nginx/onam.hermestclinic.net.conf`
- Create: `docs/superpowers/runbooks/2026-06-27-onam-deploy.md`

**Interfaces:**
- Produces: a copy-paste nginx server block and a step-by-step deploy runbook (Docker → nginx → certbot). Actual execution happens on the server (interactively) — SSH from the dev environment may be unavailable, in which case the user runs the commands.

- [ ] **Step 1: Create `deploy/nginx/onam.hermestclinic.net.conf`**

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name onam.hermestclinic.net;

    client_max_body_size 20m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

> `certbot --nginx` rewrites this file to add the `listen 443 ssl` block and the HTTP→HTTPS redirect.

- [ ] **Step 2: Create `docs/superpowers/runbooks/2026-06-27-onam-deploy.md`**

```markdown
# Deploy Runbook — onam.hermestclinic.net

Target: Hetzner host (root, SSH key auth). nginx + certbot already installed (serving n8n.hermestclinic.net). DNS A record `onam.hermestclinic.net` → host already set.

## 1. Get the code on the server
    mkdir -p /opt/hermest-onam
    # rsync from local OR git clone; then:
    cd /opt/hermest-onam

## 2. Create the server-side .env (never committed)
    cat > /opt/hermest-onam/.env <<'EOF'
    CRM_BASE_URL=https://<real-crm-host>
    CRM_API_KEY=crm_xxx
    EOF
    chmod 600 /opt/hermest-onam/.env

## 3. Build + run the container
    cd /opt/hermest-onam
    docker compose up -d --build
    curl -I http://127.0.0.1:3000        # expect HTTP 200

## 4. nginx vhost
    cp deploy/nginx/onam.hermestclinic.net.conf /etc/nginx/sites-available/onam.hermestclinic.net
    ln -s /etc/nginx/sites-available/onam.hermestclinic.net /etc/nginx/sites-enabled/
    nginx -t
    systemctl reload nginx

## 5. HTTPS
    certbot --nginx -d onam.hermestclinic.net
    # auto-renew already handled by certbot.timer

## 6. Verify
    curl -I https://onam.hermestclinic.net    # expect HTTP 200
    # Then run the manual end-to-end checklist (search → select → images → download → CRM upload).

## Redeploy (after code changes)
    cd /opt/hermest-onam
    git pull   # or rsync
    docker compose up -d --build
```

- [ ] **Step 3: Commit**

```bash
git add deploy/nginx/onam.hermestclinic.net.conf docs/superpowers/runbooks/2026-06-27-onam-deploy.md
git commit -m "docs: nginx vhost + onam deploy runbook"
```

- [ ] **Step 4: Execute the deploy**

Follow the runbook on the server. If SSH is unavailable from this environment, hand the runbook commands to the user to run via `! <command>` (interactive). Confirm `https://onam.hermestclinic.net` serves the app and a real patient search + upload round-trips to the CRM.

---

## Self-Review

**Spec coverage** (each spec section → task):
- §1 scope (search, autofill, download+upload, patient required, ≥1 image, upload only on download) → Tasks 7–13. ✓
- §2 CRM endpoints (search shape, upload shape) → Tasks 6–8. ✓
- §3 architecture (proxy, key server-side, approach A) → Tasks 6–8, 10. ✓
- §4 file structure (types, collage, crm, routes, PatientSearch, upload, page) → Tasks 2–13. ✓
- §5 data model (Slot.file, selectedPatient, name from CRM) → Tasks 2, 12. ✓
- §6 data flow (debounced search + abort, country resolver, download→download→upload, concurrency 2, filenames with method prefix) → Tasks 3, 4, 9, 10, 11, 12, 13. ✓
- §7 error handling (search states, per-file retry, download independent of upload, route error mapping) → Tasks 7, 8, 11, 13. ✓
- §8 config/deploy (env, gitignore/.DS_Store, Docker standalone, nginx, certbot, onam.hermestclinic.net) → Tasks 1, 14, 15. ✓
- §9 testing (resolver, filename builder, route handlers, manual checklist) → Tasks 3, 4, 6, 7, 8, 10, 13, 15. ✓
- §10 assumptions (one-file-per-request, country present, search fields) → encoded in Tasks 6/8 (one file per request) and surfaced in the runbook. ✓

**Placeholder scan:** No "TBD/TODO/handle edge cases" left; every code step contains full code. The only intentionally-empty file is `public/.gitkeep`. ✓

**Type consistency:** `Slot.file: File | null` (Tasks 2, 10, 12); `buildUploadItems(sheetBlob, slots, method, date)` matches its call in Task 13; `uploadItems(patientId, items, onUpdate, concurrency?)` matches Task 13 usage; `renderCollageBlob(CollageInput)` matches Tasks 5 and 13; `CrmError.status` used consistently in Tasks 6–8; route param type `Promise<{ id: string }>` matches the Global Constraints note. ✓
