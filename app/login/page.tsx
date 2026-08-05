"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(typeof body?.error === "string" ? body.error : "Giriş başarısız");
        return;
      }
      // Açık yönlendirme olmasın diye yalnızca uygulama içi yollar kabul ediliyor.
      const next = params.get("next");
      router.replace(next && next.startsWith("/") && !next.startsWith("//") ? next : "/");
      router.refresh();
    } catch {
      setError("Bağlantı hatası, tekrar deneyin");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className="login-card" onSubmit={handleSubmit}>
      <span className="eyebrow">Hermest Hair Clinic</span>
      <h1>Visual Consent Sheet</h1>
      <p className="login-hint">Devam etmek için klinik parolasını girin.</p>

      <input
        type="password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        placeholder="Parola"
        autoComplete="current-password"
        autoFocus
        aria-label="Parola"
      />

      {error ? <p className="login-error">{error}</p> : null}

      <button className="download-button" type="submit" disabled={isSubmitting || !password}>
        {isSubmitting ? "Kontrol ediliyor..." : "Giriş"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="login-shell">
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
