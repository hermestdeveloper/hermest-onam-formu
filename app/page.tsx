"use client";

import { ChangeEvent, PointerEvent, useEffect, useMemo, useRef, useState } from "react";
import { renderCollageBlob, loadImage } from "@/lib/collage";
import { buildUploadItems, uploadItems } from "@/lib/upload";
import { consentSheetFileName } from "@/lib/filenames";
import PatientSearch from "@/app/components/PatientSearch";
import { countryOptions, resolveCountryCode } from "@/lib/country";
import type { CountryOption, Patient, Slot, UploadItem, UploadStatus } from "@/lib/types";

const initialSlots: Slot[] = [
  { id: "front", label: "Front View", hint: "Frontal documentation", dataUrl: null, file: null },
  { id: "top", label: "Top View", hint: "Crown and top area", dataUrl: null, file: null },
  { id: "right", label: "Right Profile", hint: "Right-side angle", dataUrl: null, file: null },
  { id: "left", label: "Left Profile", hint: "Left-side angle", dataUrl: null, file: null },
];

const treatmentMethodOptions = ["DHI METHOD", "SAPPHIRE FUE", "UNIQUE FUE"];

const maxUploadWidth = 1800;
const maxUploadHeight = 2400;
const uploadQuality = 0.86;

export default function Home() {
  const [slots, setSlots] = useState(initialSlots);
  const [patientName, setPatientName] = useState("");
  const [selectedCountry, setSelectedCountry] = useState<CountryOption | null>(null);
  const [treatmentMethod, setTreatmentMethod] = useState(treatmentMethodOptions[0]);
  const [isExporting, setIsExporting] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<Record<string, UploadStatus>>({});
  const [uploadItemsList, setUploadItemsList] = useState<UploadItem[]>([]);
  const [uploadErrors, setUploadErrors] = useState<Record<string, string>>({});
  const [downloadError, setDownloadError] = useState<string | null>(null);
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
  const handlePatientSelect = (patient: Patient) => {
    setSelectedPatient(patient);
    setPatientName(patient.name);
    const code = resolveCountryCode(patient.country);
    if (code) {
      setSelectedCountry(countryOptions.find((c) => c.code === code) ?? null);
    } else if (patient.country) {
      setSelectedCountry({ code: "", flag: "", name: patient.country });
    } else {
      setSelectedCountry(null);
    }
  };

  const handlePatientClear = () => {
    setSelectedPatient(null);
    setPatientName("");
    setSelectedCountry(null);
  };

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
          slot.id === slotId ? { ...slot, dataUrl: result, file } : slot
        )
      );
    });

    event.target.value = "";
  };

  const handleClear = (slotId: string) => {
    setSlots((current) =>
      current.map((slot) =>
        slot.id === slotId ? { ...slot, dataUrl: null, file: null } : slot
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

  const runUploads = async (patientId: string | number, items: UploadItem[]) => {
    setIsUploading(true);
    setUploadStatus((prev) => ({
      ...prev,
      ...Object.fromEntries(items.map((i) => [i.key, "pending" as UploadStatus])),
    }));
    setUploadErrors((prev) => {
      const next = { ...prev };
      for (const i of items) delete next[i.key];
      return next;
    });
    try {
      await uploadItems(patientId, items, (key, status, error) => {
        setUploadStatus((prev) => ({ ...prev, [key]: status }));
        if (error) setUploadErrors((prev) => ({ ...prev, [key]: error }));
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDownload = async () => {
    if (!selectedPatient) return;
    setDownloadError(null);
    setIsExporting(true);
    try {
      const now = new Date();
      const blob = await renderCollageBlob({
        slots,
        patientName,
        country: selectedCountry ?? { code: "", flag: "", name: "-" },
        treatmentMethod,
        signatureDataUrl,
        date: now,
      });

      // Always download locally first, independent of upload outcome.
      const link = document.createElement("a");
      link.download = consentSheetFileName(now, treatmentMethod);
      link.href = URL.createObjectURL(blob);
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);

      // Local copy is done — leave the "Preparing" phase before uploading.
      setIsExporting(false);

      const items = buildUploadItems(blob, slots, treatmentMethod, now);
      setUploadItemsList(items);
      await runUploads(selectedPatient.id, items);
    } catch (err) {
      console.error("[consent] download/upload failed:", err);
      setDownloadError("Föy oluşturulurken bir hata oluştu. Lütfen tekrar deneyin.");
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
          <div className="input-stack">
            <span>Patient</span>
            <PatientSearch
              selected={selectedPatient}
              onSelect={handlePatientSelect}
              onClear={handlePatientClear}
            />
          </div>
          <div className="input-stack">
            <span>Patient Country</span>
            {selectedCountry ? (
              <div className="country-readonly">
                {selectedCountry.flag ? (
                  <span className="country-flag">{selectedCountry.flag}</span>
                ) : null}
                <span className="country-name">{selectedCountry.name}</span>
              </div>
            ) : (
              <div className="country-readonly muted">Patient seçilince otomatik gelir</div>
            )}
          </div>
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
            onClick={handleDownload}
            disabled={filledCount === 0 || !selectedPatient || isExporting || isUploading}
          >
            {isExporting ? "Preparing..." : isUploading ? "Uploading..." : "Download Consent Sheet"}
          </button>
          {downloadError ? <p className="download-error">{downloadError}</p> : null}

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
                      {status === "error" && uploadErrors[item.key] ? (
                        <span className="upload-error">{uploadErrors[item.key]}</span>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
              {(() => {
                const total = uploadItemsList.length;
                const uploaded = uploadItemsList.filter((i) => uploadStatus[i.key] === "success").length;
                const failed = uploadItemsList.filter((i) => uploadStatus[i.key] === "error").length;
                return !isUploading && uploaded + failed > 0 ? (
                  <p className="upload-summary">
                    {total} dosyadan {uploaded} yüklendi{failed > 0 ? `, ${failed} hata` : ""}
                  </p>
                ) : null;
              })()}
              {uploadItemsList.some((i) => uploadStatus[i.key] === "error") && !isUploading ? (
                <button type="button" className="secondary-button" onClick={retryFailed}>
                  Başarısızları tekrar dene
                </button>
              ) : null}
            </div>
          ) : null}
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
