import type { CountryOption } from "@/lib/types";

const baseExportWidth = 1600;
const baseExportHeight = 2350;
const basePadding = 84;
const baseGap = 40;
const baseCardHeight = 780;
const baseCardTop = 360;
const minExportScale = 2;
const maxExportScale = 4;
const mobileMaxExportScale = 2.2;

const consentStatement =
  "The entire operation plan and hairline were determined with my approval. I approve the operation plan and my hairline.";

type LoadedSlot = {
  id: string;
  label: string;
  hint: string;
  dataUrl: string | null;
  image: HTMLImageElement | null;
};

export type CollageInput = {
  slots: { id: string; label: string; hint: string; dataUrl: string | null }[];
  patientName: string;
  country: CountryOption;
  treatmentMethod: string;
  signatureDataUrl: string | null;
  date: Date;
};

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
  exportScale: number,
  date: Date
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
  }).format(date);
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

function getDeviceAdjustedScale(scale: number) {
  if (typeof window === "undefined") {
    return scale;
  }

  const isMobileViewport = window.innerWidth <= 820;
  const isAppleMobile = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  const maxScale = isMobileViewport || isAppleMobile ? mobileMaxExportScale : maxExportScale;

  return Math.min(scale, maxScale);
}

export function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

export function canvasToBlob(canvas: HTMLCanvasElement) {
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
      await drawSlot(ctx, slot, positions[index]!, cardWidth, cardHeight, exportScale);
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
