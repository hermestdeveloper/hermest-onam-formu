# Hermest Onam Formu — Handoff

Son güncelleme: 2026-06-27

Bu doküman, projeyi devralacak/sonra devam edecek geliştirici için: ne yapıldı,
canlı durum, nasıl test edilir, nasıl deploy edilir ve **kalan/bekleyen işler**.

---

## 1. Proje nedir?

Saç ekimi öncesi **görsel onam (rıza) föyü** üreten tek sayfalık uygulama
(**Next.js 16 + React 19 + TypeScript**, tamamen client-side UI + iki sunucu
proxy route'u). Akış:

1. **CRM'den hasta ara** (isim/telefon/e-posta) → seçilen hastanın **adı + ülkesi**
   otomatik gelir (ülke artık elle seçilmiyor, salt-okunur).
2. **4 açıdan fotoğraf** yükle (Front / Top / Right / Left) + **imza** çiz +
   **tedavi yöntemi** seç (DHI / Sapphire FUE / Unique FUE).
3. **"Download Consent Sheet"** → markalı **PNG** föyü üretir:
   - **lokale indirir** (her durumda), ve
   - **CRM'e yükler**: föy + dolu ham fotoğraflar, seçili hastanın klasörüne.
     Dosya adları tedavi-yöntemi önekli: `sapphire_fue_front_view.jpg`,
     föy: `hermest-visual-consent-sheet-sapphire_fue-<tarih>.png`.

**Güvenlik:** CRM API anahtarı (`X-API-Key`) **asla tarayıcıya gitmez**.
Tarayıcı → bu uygulamanın sunucu route'ları (`/api/patients`,
`/api/patients/:id/files`) → CRM. Anahtar yalnızca sunucu env'inde.

---

## 2. Canlı durum

- **URL:** https://onam.hermestclinic.net (yayında, HTTPS, noindex).
- **Sunucu:** Hetzner (n8n ile aynı kutu). Docker container `hermest-onam`,
  `127.0.0.1:3000`, host nginx vhost + Let's Encrypt (auto-renew).
  Sunucu erişim bilgileri (IP/SSH) repoda DEĞİL — Obsidian `hermest` notunda.
- **Konum:** `/opt/hermest-onam` (sunucuda).
- **Kod transferi:** şu an `rsync` ile (git değil). GitHub remote:
  `hermestdeveloper/hermest-onam-formu`.

> ⚠️ **Şu an arama/yükleme ÇALIŞMIYOR** çünkü CRM endpoint'leri henüz canlı
> değil (bkz. §5 Kalan İşler). Föy oluşturma + lokale indirme çalışıyor.

---

## 3. Nasıl test edilir?

### Lokal (geliştirme)
```bash
npm install
npm run dev        # http://localhost:3000
npm test           # 27 birim testi (Vitest)
npm run build      # production build (standalone)
npx tsc --noEmit   # tip kontrolü (temiz olmalı)
```

### Production smoke test
```bash
# Sayfa ayakta mı:
curl -I https://onam.hermestclinic.net/            # 200

# Kısa arama → CRM'e gitmeden boş döner (short-circuit, <2 karakter):
curl "https://onam.hermestclinic.net/api/patients?search=a"
# Beklenen: {"data":[],"total":0,"page":1}

# Gerçek arama → CRM uçları YOKKEN 500 döner (beklenen, creds/endpoint eksik):
curl "https://onam.hermestclinic.net/api/patients?search=ahmet"
# Şimdilik: {"error":"Arama başarısız"}  (CRM hazır olunca {data,total,page})
```

### Manuel uçtan-uca (CRM hazır olunca)
1. Hasta ara → seç → ad + ülke doluyor mu.
2. 1–4 fotoğraf + imza → **Download**.
3. Lokal PNG indi mi; **CRM hasta klasöründe** föy + isimli fotoğraflar
   (`sapphire_fue_front_view.jpg` vb.) oluştu mu.
4. Upload hatasını simüle et (yanlış key) → satır içi ✗ + özet + "Başarısızları
   tekrar dene" çalışıyor mu; lokal indirme yine de oluyor mu.

---

## 4. Deploy / Redeploy

Kod değişti → sunucuya gönder + yeniden build:
```bash
# Lokal Mac'ten (SSH key gerekli — bkz. Obsidian hermest notu):
rsync -az --delete \
  --exclude node_modules --exclude .next --exclude .git \
  --exclude .superpowers --exclude .env --exclude .DS_Store --exclude docs \
  -e "ssh -i ~/.ssh/id_ed25519" \
  /Users/furkan/Works/hermest/hermest-onam-formu/  root@<SUNUCU_IP>:/opt/hermest-onam/

ssh root@<SUNUCU_IP> 'cd /opt/hermest-onam && docker compose up -d --build'
```

**Sadece env (CRM creds) değişti** → rebuild gerekmez ama **force-recreate** şart
(düz restart env'i yeniden okumaz):
```bash
ssh root@<SUNUCU_IP> 'cd /opt/hermest-onam && docker compose up -d --force-recreate'
```

nginx vhost + certbot kurulumu zaten yapıldı. Detaylı runbook:
`docs/superpowers/runbooks/2026-06-27-onam-deploy.md`

---

## 5. Kalan / Bekleyen İşler

### 🔴 BLOCKER — CRM webhook endpoint'leri (CRM ekibinde)
CRM'de iki uç **henüz tanımlı/deploy değil** (test edildi, 404 dönüyorlar):
- `GET  /api/webhooks/patients?search=&page=&limit=` → `{ data, total, page }`
- `POST /api/webhooks/patients/:id/files` (multipart: `file` + opsiyonel `description`)

CRM dev'den gerekenler:
1. Bu iki endpoint'i ekleyip **deploy** etmeleri.
2. **Gerçek API key** (`X-API-Key` için; şu an `crm_xxx` placeholder).
3. Hasta yanıtına **`country`** alanı (ISO `TR` veya ad `Turkey` — ikisi de
   resolver'da destekleniyor).

> Not: CRM bir NestJS app, global prefix `/api`. `/webhooks/patients`
> (api'siz) 200 döner ama o **frontend SPA**'in index.html'i — gerçek API değil.

### 🟢 CRM hazır olunca yapılacak (bizde, ~1 dk)
```bash
# Sunucuda /opt/hermest-onam/.env :
CRM_BASE_URL=https://crm.hermestclinic.net
CRM_API_KEY=<gerçek_key>
# sonra:
docker compose up -d --force-recreate
```
Ardından §3 manuel uçtan-uca testi prod'da çalıştır.

### 🟡 Teyit / küçük işler
- **Dosya boyutu:** nginx `client_max_body_size` şu an **20m** (`deploy/nginx/
  onam.hermestclinic.net.conf` + sunucuda `/etc/nginx/sites-available/`). Ham
  fotoğraflar 20MB'ı aşacaksa artır.
- **Tek dosya/istek varsayımı:** Uygulama dosyaları **istek başına tek dosya**
  yolluyor. CRM ucu çoklu kabul ediyorsa da çalışır; teyit edilebilir.
- **favicon.ico 404** (kozmetik) — istenirse `app/icon.png` eklenebilir.
- **HEIC:** iPhone HEIC orijinalleri `.jpg` uzantısıyla yükleniyor
  (`lib/filenames.ts:extensionForMime`); CRM HEIC kabul etmiyorsa dönüştürme
  gerekebilir.

---

## 6. Kod haritası

| Yol | Sorumluluk |
|---|---|
| `app/page.tsx` | Ana UI + state + download/upload orkestrasyonu |
| `app/components/PatientSearch.tsx` | Debounce'lu hasta arama (client) |
| `app/api/patients/route.ts` | `GET` arama proxy (X-API-Key ekler) |
| `app/api/patients/[id]/files/route.ts` | `POST` dosya yükleme proxy |
| `lib/crm.ts` | CRM server client (search + uploadFile), env + hata maplemesi |
| `lib/patients.ts` | Client arama helper'ı (`/api/patients` çağırır) |
| `lib/upload.ts` | `buildUploadItems` + eşzamanlı `uploadItems` (durum/retry) |
| `lib/collage.ts` | Canvas çizim/export → PNG `Blob` |
| `lib/country.ts` | **Sabit/donmuş** ülke adları + flag + `resolveCountryCode` |
| `lib/filenames.ts` | Dosya adı kurucu (tedavi-yöntemi önekli) |
| `lib/types.ts` | Ortak tipler |

**Tasarım & plan:**
`docs/superpowers/specs/2026-06-27-crm-integration-design.md`,
`docs/superpowers/plans/2026-06-27-crm-integration.md`.

### Önemli teknik not (regresyon olmasın)
`lib/country.ts` içindeki ülke adları **bilerek statik literal** (runtime
`Intl.DisplayNames` KULLANMA). Sebep: Node ICU (server) ile tarayıcı ICU
farklı ad üretebiliyor (örn. "Türkiye"/"Turkey") → SSR ile client metni
uyuşmaz → React **hydration mismatch (#418)**. Statik liste iki tarafta da
aynı render edilir. `lib/country.test.ts` bunu pinliyor.

---

## 7. Env değişkenleri

| Değişken | Açıklama |
|---|---|
| `CRM_BASE_URL` | CRM kök adresi (örn. `https://crm.hermestclinic.net`) — server-only |
| `CRM_API_KEY` | `X-API-Key` değeri — server-only, asla `NEXT_PUBLIC_` değil |

Sunucuda `/opt/hermest-onam/.env`. Repoda yalnızca `.env.example` var; gerçek
`.env` commit'lenmez.
