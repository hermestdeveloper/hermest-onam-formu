"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const POLL_MS = 60_000;

/**
 * Bu sekmenin yuklendigi surumun kimligi.
 *
 * Deger HTML'den okunuyor, JS paketine gomulmus bir sabitten degil: cache'ten
 * gelen eski HTML eski kimligi tasir, aradigimiz fark tam olarak budur.
 */
function ownBuildId(): string {
  const meta = document.querySelector('meta[name="x-build-id"]');
  return meta?.getAttribute("content")?.trim() ?? "";
}

type Props = {
  /** Formda kaybolacak bir sey var mi (fotograf, imza, secili hasta). */
  hasUnsavedWork: boolean;
};

/**
 * Acik duran sekmelerin eski surumde takili kalmasini engeller.
 *
 * Yeni yayin gorulduğunde form bossa sekme kendiliginden yenilenir. Form doluysa
 * yenilemek kullanicinin yukledigi fotograflari ve cizdigi imzayi silecegi icin
 * yalnizca serit gosterilir, kararı kullanici verir.
 */
export default function VersionWatcher({ hasUnsavedWork }: Props) {
  const [isStale, setIsStale] = useState(false);

  // Interval'i her tus vurusunda yeniden kurmamak icin ref; kontrol anindaki
  // guncel degeri okumak yeterli.
  const workRef = useRef(hasUnsavedWork);
  workRef.current = hasUnsavedWork;

  const check = useCallback(async () => {
    const own = ownBuildId();
    if (!own || own === "unknown") return;
    try {
      const res = await fetch("/api/version", { cache: "no-store" });
      if (!res.ok) return; // oturum dusmus olabilir; sessizce gec
      const { buildId } = (await res.json()) as { buildId?: string };
      if (!buildId || buildId === "unknown" || buildId === own) return;

      if (workRef.current) {
        setIsStale(true);
      } else {
        window.location.reload();
      }
    } catch {
      // Ag hatasi — bir sonraki turda tekrar denenir.
    }
  }, []);

  useEffect(() => {
    const timer = window.setInterval(check, POLL_MS);
    // Gunlerdir acik duran bir sekmeye donuldugunde beklemeden bakilsin.
    const onVisible = () => {
      if (document.visibilityState === "visible") void check();
    };
    document.addEventListener("visibilitychange", onVisible);
    void check();
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [check]);

  if (!isStale) return null;

  return (
    <div className="version-banner" role="status">
      <span>Yeni bir sürüm yayınlandı. Formu bitirdiğinizde sayfayı yenileyin.</span>
      <button type="button" onClick={() => window.location.reload()}>
        Şimdi yenile
      </button>
    </div>
  );
}
