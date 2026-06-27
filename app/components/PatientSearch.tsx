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
