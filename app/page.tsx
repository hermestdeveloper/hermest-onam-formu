"use client";

import { ChangeEvent, PointerEvent, useEffect, useMemo, useRef, useState } from "react";

type Slot = {
  id: string;
  label: string;
  hint: string;
  dataUrl: string | null;
};

type LoadedSlot = Slot & {
  image: HTMLImageElement | null;
};

type CountryOption = {
  code: string;
  flag: string;
  name: string;
};

const initialSlots: Slot[] = [
  { id: "front", label: "Front View", hint: "Frontal documentation", dataUrl: null },
  { id: "top", label: "Top View", hint: "Crown and top area", dataUrl: null },
  { id: "right", label: "Right Profile", hint: "Right-side angle", dataUrl: null },
  { id: "left", label: "Left Profile", hint: "Left-side angle", dataUrl: null },
];

const consentStatement =
  "The entire operation plan and hairline were determined with my approval. I approve the operation plan and my hairline.";

const treatmentMethodOptions = ["DHI METHOD", "SAPPHIRE FUE", "UNIQUE FUE"];
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

const countryOptions: CountryOption[] = countryCodes
  .map((code) => ({
    code,
    flag: getFlagEmoji(code),
    name: regionNames.of(code) ?? code,
  }))
  .sort((a, b) => {
    if (a.code === "US") {
      return -1;
    }

    if (b.code === "US") {
      return 1;
    }

    return a.name.localeCompare(b.name);
  });

const baseExportWidth = 1600;
const baseExportHeight = 2350;
const basePadding = 84;
const baseGap = 40;
const baseCardHeight = 780;
const baseCardTop = 360;
const minExportScale = 2;
const maxExportScale = 4;
const mobileMaxExportScale = 2.2;
const maxUploadWidth = 1800;
const maxUploadHeight = 2400;
const uploadQuality = 0.86;

export default function Home() {
  const [slots, setSlots] = useState(initialSlots);
  const [patientName, setPatientName] = useState("");
  const [countryCode, setCountryCode] = useState("US");
  const [treatmentMethod, setTreatmentMethod] = useState(treatmentMethodOptions[0]);
  const [isExporting, setIsExporting] = useState(false);
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const signatureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const signatureDataUrlRef = useRef<string | null>(null);
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  const filledCount = useMemo(
    () => slots.filter((slot) => Boolean(slot.dataUrl)).length,
    [slots]
  );
  const selectedCountry =
    countryOptions.find((country) => country.code === countryCode) ?? countryOptions[0];

  const handleSelect = (slotId: string) => {
    inputRefs.current[slotId]?.click();
  };

  const handleFileChange = (slotId: string, event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    void processImageFile(file).then((result) => {
      setSlots((current) =>
        current.map((slot) =>
          slot.id === slotId ? { ...slot, dataUrl: result } : slot
        )
      );
    });

    event.target.value = "";
  };

  const handleClear = (slotId: string) => {
    setSlots((current) =>
      current.map((slot) =>
        slot.id === slotId ? { ...slot, dataUrl: null } : slot
      )
    );
  };

  useEffect(() => {
    const canvas = signatureCanvasRef.current;

    if (!canvas) {
      return;
    }

    const syncCanvas = async () => {
      const rect = canvas.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      const previousSignature = signatureDataUrlRef.current;

      canvas.width = Math.max(1, Math.round(rect.width * ratio));
      canvas.height = Math.max(1, Math.round(rect.height * ratio));

      const ctx = canvas.getContext("2d");

      if (!ctx) {
        return;
      }

      configureSignatureCanvas(ctx, ratio);
      ctx.clearRect(0, 0, rect.width, rect.height);

      if (previousSignature) {
        const image = await loadImage(previousSignature);
        ctx.drawImage(image, 0, 0, rect.width, rect.height);
      }
    };

    syncCanvas();
    window.addEventListener("resize", syncCanvas);

    return () => {
      window.removeEventListener("resize", syncCanvas);
    };
  }, []);

  const getCanvasPoint = (event: PointerEvent<HTMLCanvasElement>) => {
    const canvas = signatureCanvasRef.current;

    if (!canvas) {
      return null;
    }

    const rect = canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  };

  const startSignature = (event: PointerEvent<HTMLCanvasElement>) => {
    const point = getCanvasPoint(event);
    const canvas = signatureCanvasRef.current;
    const ctx = canvas?.getContext("2d");

    if (!point || !canvas || !ctx) {
      return;
    }

    event.preventDefault();
    canvas.setPointerCapture(event.pointerId);
    isDrawingRef.current = true;
    lastPointRef.current = point;

    ctx.beginPath();
    ctx.arc(point.x, point.y, 1.2, 0, Math.PI * 2);
    ctx.fillStyle = "#003E51";
    ctx.fill();
  };

  const moveSignature = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) {
      return;
    }

    const point = getCanvasPoint(event);
    const canvas = signatureCanvasRef.current;
    const ctx = canvas?.getContext("2d");
    const lastPoint = lastPointRef.current;

    if (!point || !ctx || !lastPoint) {
      return;
    }

    event.preventDefault();
    ctx.beginPath();
    ctx.moveTo(lastPoint.x, lastPoint.y);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
    lastPointRef.current = point;
  };

  const endSignature = (event?: PointerEvent<HTMLCanvasElement>) => {
    const canvas = signatureCanvasRef.current;

    if (event && canvas?.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }

    if (!canvas) {
      return;
    }

    isDrawingRef.current = false;
    lastPointRef.current = null;
    const nextDataUrl = canvas.toDataURL("image/png");
    signatureDataUrlRef.current = nextDataUrl;
    setSignatureDataUrl(nextDataUrl);
  };

  const clearSignature = () => {
    const canvas = signatureCanvasRef.current;
    const ctx = canvas?.getContext("2d");

    if (!canvas || !ctx) {
      return;
    }

    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
    signatureDataUrlRef.current = null;
    setSignatureDataUrl(null);
  };

  const exportCollage = async () => {
    setIsExporting(true);

    try {
      await document.fonts.ready;

      const loadedSlots = await Promise.all(
        slots.map(async (slot) => ({
          ...slot,
          image: slot.dataUrl ? await loadImage(slot.dataUrl) : null,
        }))
      );
      const exportScale = getAdaptiveExportScale(loadedSlots);

      const canvas = document.createElement("canvas");
      canvas.width = Math.round(baseExportWidth * exportScale);
      canvas.height = Math.round(baseExportHeight * exportScale);

      const ctx = canvas.getContext("2d");

      if (!ctx) {
        throw new Error("Canvas context not available");
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      drawBackground(ctx, canvas.width, canvas.height, exportScale);

      const padding = basePadding * exportScale;
      const gap = baseGap * exportScale;
      const cardWidth = (canvas.width - padding * 2 - gap) / 2;
      const cardHeight = baseCardHeight * exportScale;

      drawHeader(ctx, canvas.width, padding, exportScale);

      const positions = [
        { x: padding, y: baseCardTop * exportScale },
        { x: padding + cardWidth + gap, y: baseCardTop * exportScale },
        { x: padding, y: baseCardTop * exportScale + cardHeight + gap },
        { x: padding + cardWidth + gap, y: baseCardTop * exportScale + cardHeight + gap },
      ];

      await Promise.all(
        loadedSlots.map(async (slot, index) => {
          await drawSlot(
            ctx,
            slot,
            positions[index],
            cardWidth,
            cardHeight,
            exportScale
          );
        })
      );

      drawConsentFooter(
        ctx,
        canvas.width,
        canvas.height,
        padding,
        exportScale,
        patientName,
        selectedCountry,
        treatmentMethod,
        signatureDataUrl ? await loadImage(signatureDataUrl) : null
      );

      const link = document.createElement("a");
      const now = new Date();
      const stamp = now.toISOString().slice(0, 10);
      const blob = await canvasToBlob(canvas);

      link.download = `hermest-visual-consent-sheet-${stamp}.png`;
      link.href = URL.createObjectURL(blob);
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <main className="page-shell">
      <section className="hero-card">
        <div className="hero-copy">
          <div className="hero-heading">
            <span className="eyebrow">Hermest Hair Clinic</span>
            <p className="hero-kicker">Hair Transplant Surgery Planning Form</p>
            <h1>Visual Consent Sheet</h1>
          </div>
          <p>
            Create a clear four-angle patient record for consultation and
            consent documentation. Images stay proportionate and export as a
            single branded sheet.
          </p>
        </div>

        <div className="hero-stats">
          <div className="stat-box">
            <strong>{filledCount}/4</strong>
            <span>Images placed</span>
          </div>
          <label className="input-stack">
            <span>Patient Name</span>
            <input
              type="text"
              placeholder="e.g. John Smith"
              value={patientName}
              onChange={(event) => setPatientName(event.target.value)}
            />
          </label>
          <label className="input-stack">
            <span>Patient Country</span>
            <div className="select-wrap">
              <div className="country-preview" aria-hidden="true">
                <span className="country-flag">{selectedCountry.flag}</span>
                <span className="country-name">{selectedCountry.name}</span>
              </div>
              <select
                value={countryCode}
                onChange={(event) => setCountryCode(event.target.value)}
                className="stack-select"
              >
                {countryOptions.map((country) => (
                  <option key={country.code} value={country.code}>
                    {country.name}
                  </option>
                ))}
              </select>
            </div>
          </label>
          <div className="input-stack">
            <span>Treatment Method</span>
            <div className="method-grid" role="radiogroup" aria-label="Treatment Method">
              {treatmentMethodOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={`method-chip ${treatmentMethod === option ? "active" : ""}`}
                  onClick={() => setTreatmentMethod(option)}
                  aria-pressed={treatmentMethod === option}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
          <div className="input-stack">
            <span>Signature</span>
            <div className="signature-panel">
              <canvas
                ref={signatureCanvasRef}
                className="signature-canvas"
                onPointerDown={startSignature}
                onPointerMove={moveSignature}
                onPointerUp={endSignature}
                onPointerLeave={endSignature}
                onPointerCancel={endSignature}
              />
              <div className="signature-actions">
                <small>Sign with finger or stylus</small>
                <button type="button" className="secondary-button" onClick={clearSignature}>
                  Clear Signature
                </button>
              </div>
            </div>
          </div>
          <p className="stat-note">Prepared for clinical review and patient approval</p>
          <button
            className="download-button"
            onClick={exportCollage}
            disabled={filledCount === 0 || isExporting}
          >
            {isExporting ? "Preparing..." : "Download Consent Sheet"}
          </button>
        </div>
      </section>

      <section className="grid-section">
        {slots.map((slot) => (
          <article key={slot.id} className="slot-card">
            <div
              className={`image-dropzone ${slot.dataUrl ? "filled" : ""}`}
              onClick={() => handleSelect(slot.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  handleSelect(slot.id);
                }
              }}
            >
              {slot.dataUrl ? (
                // img is preferable here because files come from local user selection.
                <img src={slot.dataUrl} alt={slot.label} className="slot-image" />
              ) : (
                <div className="placeholder-copy">
                  <span>Add Image</span>
                  <small>{slot.hint}</small>
                </div>
              )}
            </div>

            <div className="slot-footer">
              <div>
                <h2>{slot.label}</h2>
                <p>{slot.hint}</p>
              </div>

              {slot.dataUrl ? (
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => handleClear(slot.id)}
                >
                  Clear
                </button>
              ) : null}
            </div>

            <input
              ref={(node) => {
                inputRefs.current[slot.id] = node;
              }}
              className="hidden-input"
              type="file"
              accept="image/*"
              onChange={(event) => handleFileChange(slot.id, event)}
            />
          </article>
        ))}
      </section>
    </main>
  );
}

function drawBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  exportScale: number
) {
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#003E51");
  gradient.addColorStop(0.55, "#007FA3");
  gradient.addColorStop(1, "#77C5D5");

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "rgba(255, 255, 255, 0.06)";
  ctx.beginPath();
  ctx.arc(
    width - 180 * exportScale,
    170 * exportScale,
    120 * exportScale,
    0,
    Math.PI * 2
  );
  ctx.fill();

  ctx.beginPath();
  ctx.arc(120 * exportScale, height - 140 * exportScale, 90 * exportScale, 0, Math.PI * 2);
  ctx.fill();
}

function drawHeader(
  ctx: CanvasRenderingContext2D,
  width: number,
  padding: number,
  exportScale: number
) {
  const centerX = width / 2;

  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.font = `700 ${34 * exportScale}px Roboto`;
  ctx.fillText("Hermest Hair Clinic", centerX, 92 * exportScale);

  ctx.fillStyle = "#D1DDE6";
  ctx.font = `500 ${22 * exportScale}px Roboto`;
  ctx.fillText("Hair Transplant Surgery Planning Form", centerX, 138 * exportScale);

  ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
  ctx.font = `700 ${50 * exportScale}px Roboto`;
  ctx.fillText("Visual Consent Sheet", centerX, 210 * exportScale);

  ctx.fillStyle = "rgba(255, 255, 255, 0.78)";
  ctx.font = `400 ${18 * exportScale}px Roboto`;
  const dateLabel = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date());
  ctx.textAlign = "right";
  ctx.fillText(dateLabel, width - padding, 92 * exportScale);
  ctx.textAlign = "left";
}

function drawConsentFooter(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  padding: number,
  exportScale: number,
  patientName: string,
  selectedCountry: CountryOption,
  treatmentMethod: string,
  signatureImage: HTMLImageElement | null
) {
  const footerX = padding;
  const footerY = 2010 * exportScale;
  const footerWidth = width - padding * 2;
  const footerHeight = 250 * exportScale;
  const badgeHeight = 74 * exportScale;

  roundedRect(ctx, footerX, footerY, footerWidth, footerHeight, 26 * exportScale);
  ctx.fillStyle = "rgba(255, 255, 255, 0.96)";
  ctx.fill();

  ctx.strokeStyle = "rgba(0, 62, 81, 0.12)";
  ctx.lineWidth = 2 * exportScale;
  ctx.stroke();

  const metaItems = [
    { label: "Patient Name", value: patientName.trim() || "-" },
    {
      label: "Country",
      value: `${selectedCountry.flag} ${selectedCountry.name}`,
    },
    { label: "Method", value: treatmentMethod.trim() || "-" },
  ];

  const metaGap = 18 * exportScale;
  const metaWidth =
    (footerWidth - 60 * exportScale - metaGap * (metaItems.length - 1)) /
    metaItems.length;

  metaItems.forEach((item, index) => {
    const metaX = footerX + 30 * exportScale + index * (metaWidth + metaGap);
    const metaY = footerY + 30 * exportScale;

    roundedRect(ctx, metaX, metaY, metaWidth, badgeHeight, 18 * exportScale);
    ctx.fillStyle = "#003E51";
    ctx.fill();

    ctx.fillStyle = "#D1DDE6";
    ctx.font = `500 ${16 * exportScale}px Roboto`;
    ctx.fillText(item.label.toUpperCase(), metaX + 24 * exportScale, metaY + 28 * exportScale);

    ctx.fillStyle = "#ffffff";
    ctx.font = `700 ${22 * exportScale}px Roboto`;
    ctx.fillText(item.value, metaX + 24 * exportScale, metaY + 58 * exportScale);
  });

  ctx.fillStyle = "#003E51";
  ctx.font = `400 ${22 * exportScale}px Roboto`;
  wrapText(
    ctx,
    consentStatement,
    footerX + 30 * exportScale,
    footerY + 138 * exportScale,
    footerWidth - 440 * exportScale,
    34 * exportScale
  );

  const signatureBoxWidth = 360 * exportScale;
  const signatureBoxHeight = 110 * exportScale;
  const signatureBoxX = footerX + footerWidth - signatureBoxWidth - 30 * exportScale;
  const signatureBoxY = footerY + 118 * exportScale;

  ctx.strokeStyle = "rgba(0, 62, 81, 0.22)";
  ctx.lineWidth = 1.5 * exportScale;
  ctx.beginPath();
  ctx.moveTo(signatureBoxX, signatureBoxY + signatureBoxHeight);
  ctx.lineTo(signatureBoxX + signatureBoxWidth, signatureBoxY + signatureBoxHeight);
  ctx.stroke();

  if (signatureImage) {
    drawContainedImage(
      ctx,
      signatureImage,
      signatureBoxX,
      signatureBoxY,
      signatureBoxWidth,
      signatureBoxHeight - 10 * exportScale
    );
  }

  ctx.fillStyle = "#6f8f9a";
  ctx.font = `400 ${16 * exportScale}px Roboto`;
  ctx.fillText(
    "Prepared by Hermest Clinic",
    footerX + 30 * exportScale,
    height - 40 * exportScale
  );
}

async function drawSlot(
  ctx: CanvasRenderingContext2D,
  slot: LoadedSlot,
  position: { x: number; y: number },
  width: number,
  height: number,
  exportScale: number
) {
  const { x, y } = position;

  roundedRect(ctx, x, y, width, height, 26 * exportScale);
  ctx.fillStyle = "rgba(255, 255, 255, 0.98)";
  ctx.fill();

  ctx.strokeStyle = "rgba(0, 62, 81, 0.12)";
  ctx.lineWidth = 2 * exportScale;
  ctx.stroke();

  ctx.fillStyle = "#003E51";
  ctx.font = `700 ${28 * exportScale}px Roboto`;
  ctx.textAlign = "center";
  ctx.fillText(slot.label, x + width / 2, y + 42 * exportScale);

  ctx.fillStyle = "#4f8191";
  ctx.font = `400 ${19 * exportScale}px Roboto`;
  ctx.fillText(slot.hint, x + width / 2, y + 74 * exportScale);
  ctx.textAlign = "left";

  const innerX = x + 24 * exportScale;
  const innerY = y + 98 * exportScale;
  const innerWidth = width - 48 * exportScale;
  const innerHeight = height - 122 * exportScale;

  roundedRect(ctx, innerX, innerY, innerWidth, innerHeight, 18 * exportScale);
  ctx.fillStyle = "#f7fbfd";
  ctx.fill();

  if (slot.image) {
    drawContainedImage(ctx, slot.image, innerX, innerY, innerWidth, innerHeight);
    return;
  }

  ctx.fillStyle = "#6eaec0";
  ctx.font = `600 ${24 * exportScale}px Roboto`;
  ctx.fillText(
    "No image added",
    innerX + 26 * exportScale,
    innerY + innerHeight / 2 - 10 * exportScale
  );
  ctx.font = `400 ${18 * exportScale}px Roboto`;
  ctx.fillText(
    "Tap to place the requested view",
    innerX + 26 * exportScale,
    innerY + innerHeight / 2 + 24 * exportScale
  );
}

function drawContainedImage(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number
) {
  const imageRatio = image.width / image.height;
  const frameRatio = width / height;

  let drawWidth = width;
  let drawHeight = height;

  if (imageRatio > frameRatio) {
    drawHeight = width / imageRatio;
  } else {
    drawWidth = height * imageRatio;
  }

  const offsetX = x + (width - drawWidth) / 2;
  const offsetY = y + (height - drawHeight) / 2;

  ctx.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
) {
  const words = text.split(" ");
  let line = "";
  let currentY = y;

  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word;
    const testWidth = ctx.measureText(testLine).width;

    if (testWidth > maxWidth && line) {
      ctx.fillText(line, x, currentY);
      line = word;
      currentY += lineHeight;
      continue;
    }

    line = testLine;
  }

  if (line) {
    ctx.fillText(line, x, currentY);
  }
}

function getAdaptiveExportScale(slots: LoadedSlot[]) {
  const baseCardWidth = (baseExportWidth - basePadding * 2 - baseGap) / 2;
  const baseInnerWidth = baseCardWidth - 48;
  const baseInnerHeight = baseCardHeight - 122;

  const sourceScaleCandidates = slots
    .filter((slot) => Boolean(slot.image))
    .map((slot) => {
      const image = slot.image!;
      return Math.min(image.width / baseInnerWidth, image.height / baseInnerHeight);
    })
    .filter((value) => Number.isFinite(value) && value > 0);

  if (sourceScaleCandidates.length === 0) {
    return getDeviceAdjustedScale(minExportScale);
  }

  const adaptiveScale = Math.max(...sourceScaleCandidates);
  return getDeviceAdjustedScale(
    Math.max(minExportScale, Math.min(maxExportScale, adaptiveScale))
  );
}

function getFlagEmoji(countryCode: string) {
  return countryCode
    .toUpperCase()
    .split("")
    .map((char) => String.fromCodePoint(127397 + char.charCodeAt(0)))
    .join("");
}

async function processImageFile(file: File) {
  const image = await loadImageFromFile(file);
  const { width, height } = getContainSize(
    image.width,
    image.height,
    maxUploadWidth,
    maxUploadHeight
  );

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Could not prepare image canvas");
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(image, 0, 0, width, height);

  return canvas.toDataURL("image/jpeg", uploadQuality);
}

function configureSignatureCanvas(ctx: CanvasRenderingContext2D, ratio: number) {
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = 2.4;
  ctx.strokeStyle = "#003E51";
  ctx.fillStyle = "#003E51";
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function loadImageFromFile(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : null;

      if (!result) {
        reject(new Error("Could not read selected image"));
        return;
      }

      loadImage(result).then(resolve).catch(reject);
    };

    reader.onerror = () => reject(new Error("Could not load selected image"));
    reader.readAsDataURL(file);
  });
}

function getContainSize(
  sourceWidth: number,
  sourceHeight: number,
  maxWidth: number,
  maxHeight: number
) {
  const ratio = Math.min(maxWidth / sourceWidth, maxHeight / sourceHeight, 1);

  return {
    width: Math.max(1, Math.round(sourceWidth * ratio)),
    height: Math.max(1, Math.round(sourceHeight * ratio)),
  };
}

function getDeviceAdjustedScale(scale: number) {
  if (typeof window === "undefined") {
    return scale;
  }

  const isMobileViewport = window.innerWidth <= 820;
  const isAppleMobile = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  const maxScale = isMobileViewport || isAppleMobile ? mobileMaxExportScale : maxExportScale;

  return Math.min(scale, maxScale);
}

function canvasToBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Could not create image blob"));
        return;
      }

      resolve(blob);
    }, "image/png");
  });
}
