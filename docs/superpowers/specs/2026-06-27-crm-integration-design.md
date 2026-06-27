# Tasarım — CRM Entegrasyonu (Hasta Arama + Otomatik Dosya Yükleme)

- **Tarih:** 2026-06-27
- **Proje:** hermest-onam-formu (Visual Consent Sheet)
- **Durum:** Onaylandı (brainstorming → spec)

## 1. Amaç ve Kapsam

Mevcut tek-sayfa "Visual Consent Sheet" uygulamasına CRM entegrasyonu eklenir:

- Serbest-metin **"Patient Name"** alanı → **CRM hasta arama/seçme** bileşeni ile değişir.
- Hasta seçilince **ad + ülke** CRM yanıtından otomatik dolar.
- **"Download Consent Sheet"** butonuna basınca, üretilen PNG föy:
  1. bugünkü gibi **lokale iner**, ve
  2. **dolu ham fotoğraflarla birlikte** seçili hastanın CRM klasörüne **yüklenir**.
- **Hasta seçimi zorunlu**, en az **1 görsel** zorunlu (Download butonu bu iki koşul sağlanmadan pasif).
- Upload **yalnızca "Download Consent" anında** olur — görsel slot'a fotoğraf eklenince hiçbir istek atılmaz.
- **Dağıtım da kapsamda:** uygulama kendi sunucunuza (Hetzner) Docker ile kurulur ve `onam.hermestclinic.net` subdomain'inde nginx + Let's Encrypt arkasında yayınlanır (bkz. §8).

### Kapsam dışı
- Consent uygulamasına **yeni kimlik doğrulama (auth) eklenmez**. Erişim kontrolü sunucu/nginx tarafında yapılır (uygulama zaten `noindex`).
- **Treatment Method** alanı manuel kalır (CRM'den gelmez).
- PDF üretimi yoktur — çıktı **PNG** olarak kalır.

## 2. Dış Bağımlılık — CRM Uçları (CRM ekibi tarafından sağlanıyor)

### 2.1 Hasta listesi + arama
```
GET {CRM_BASE_URL}/api/webhooks/patients?search=ahmet&page=1&limit=20
Header: X-API-Key: crm_xxx
```
Yanıt:
```json
{
  "data": [
    { "id": 1234, "name": "Ahmet Yılmaz", "phone": "+905...", "email": "...", "country": "TR" }
  ],
  "total": 45,
  "page": 1
}
```
- Arama, **isim + telefon + e-posta** alanlarında eşleşmeli (CRM ekibine iletilecek gereksinim).
- Yanıtta **`country`** alanı bulunur (kullanıcı teyit etti). Format ilk gerçek çağrıda netleşecek — ISO alpha-2 kodu (`TR`) veya ülke adı (`Turkey`) olabilir; istemci ikisini de çözer (bkz. §6 ülke resolver).

### 2.2 Dosya yükleme
```
POST {CRM_BASE_URL}/api/webhooks/patients/:id/files
Header: X-API-Key: crm_xxx
Body: multipart/form-data  (file + opsiyonel description)
```
- **Varsayım:** uç istek başına **tek dosya** alır. (CRM ekibiyle teyit edilecek; çoklu dosya kabul ederse sonradan tek isteğe batch'lenebilir.)

## 3. Mimari

**Güvenlik kuralı:** `CRM_API_KEY` (`crm_xxx`) asla tarayıcıya gönderilmez. Akış:

```
Tarayıcı → bu Next.js uygulamasının sunucu route'ları (proxy) → CRM uçları
                         ↑ X-API-Key burada eklenir (env'den)
```

- **Frontend:** mevcut `app/page.tsx` (client component) genişletilir.
- **Yeni sunucu route'ları** (App Router route handler, `export const runtime = "nodejs"`):
  - `GET /api/patients` — CRM hasta aramasını proxy'ler.
  - `POST /api/patients/[id]/files` — CRM dosya yüklemeyi proxy'ler.

**Seçilen yükleme yaklaşımı (A — dosya başına relay):** İstemci PNG föyü + dolu fotoğrafları üretir; her dosyayı **ayrı** istekle proxy'ye yollar; proxy `X-API-Key` ekleyip CRM'e iletir. CRM ucunun "tek dosya" şekline birebir uyar ve dosya bazlı ilerleme/retry sağlar.

## 4. Dosya Yapısı (hedefli modülerleştirme)

`app/page.tsx` zaten ~935 satır; arama + upload eklenince yönetilemez büyür. Bu işe hizmet eden minimal ayrıştırma yapılır (kapsam dışı refactor yok):

| Dosya | Tür | Sorumluluk |
|---|---|---|
| `lib/types.ts` | ortak | `Patient`, `Slot`, `UploadItem`, durum tipleri |
| `lib/collage.ts` | client | Canvas çizim/export fonksiyonları (drawBackground, drawHeader, drawSlot, drawConsentFooter, wrapText, roundedRect, ölçek hesapları). `Blob` döndürür. page.tsx'ten taşınır. |
| `lib/crm.ts` | server | `searchPatients()`, `uploadPatientFile()` — CRM'e `fetch`, `X-API-Key` ekler, hata maplemesi |
| `app/api/patients/route.ts` | server | `GET` proxy handler |
| `app/api/patients/[id]/files/route.ts` | server | `POST` proxy handler |
| `app/components/PatientSearch.tsx` | client | Debounce'lu arama kutusu + sonuç dropdown'ı + seçim |
| `lib/upload.ts` | client | FormData kurar, proxy'ye dosya başına POST atar, per-dosya durum + retry |
| `app/page.tsx` | client | Orkestrasyon + state (ana UI, slot kartları, imza) |

## 5. Veri Modeli Değişiklikleri

- `Slot` tipine **`file: File | null`** eklenir. Slot artık hem **orijinal `File`'ı** (CRM'e yüklenecek gerçek ham hal) hem **`dataUrl`'i** (ekran + collage için küçültülmüş JPEG) tutar.
  - Foto eklenince: orijinal `File` saklanır **ve** mevcut `processImageFile` ile küçültülmüş `dataUrl` üretilir. Collage `dataUrl`'den çizilir; CRM'e `file` gider.
  - "Clear" → `file` ve `dataUrl` birlikte sıfırlanır.
- Yeni state: **`selectedPatient: Patient | null`** (`{ id, name, country, phone?, email? }`).
- "Patient Name" serbest input'u kaldırılır; ad artık `selectedPatient.name`'den gelir (salt-okunur gösterim).

## 6. Veri Akışı

### 6.1 Hasta arama
1. Kullanıcı arama kutusuna yazar (≥2 karakter), **~300ms debounce**, önceki istek **`AbortController`** ile iptal edilir (yarış önleme).
2. İstemci → `GET /api/patients?search=<q>&page=1&limit=20`.
3. Sunucu handler → `CRM_BASE_URL` + `CRM_API_KEY` okur → CRM'e `GET .../api/webhooks/patients?...` (`X-API-Key`).
4. Dönen `{ data, total, page }` istemciye aktarılır (gerekirse alanlar trim'lenir).
5. Dropdown her sonucu **isim + telefon/e-posta** ile gösterir (aynı isimli hastaları ayırmak için). Seçilince:
   - `selectedPatient` set edilir,
   - ad alanı dolar,
   - ülke dropdown'ı CRM ülkesine set edilir (resolver ile).
6. **Ülke resolver:** CRM değeri
   - bilinen bir ISO alpha-2 koduyla (büyük harf) eşleşiyorsa → o kod kullanılır;
   - değilse ülke **adı** ile `countryOptions` adlarına (case-insensitive) eşleştirilir → kod;
   - hiçbiri tutmazsa → otomatik set yapılmaz, kullanıcı manuel seçer (çökmez).

### 6.2 Download + upload ("Download Consent Sheet")
1. Buton aktif koşulu: `selectedPatient !== null && dolu görsel ≥ 1`.
2. `await document.fonts.ready` → collage canvas → PNG **`Blob`** (`lib/collage.ts`).
3. **Lokale indir** (anchor click) — **her durumda**, upload sonucundan bağımsız.
4. Upload listesi kurulur ve `POST /api/patients/:id/files`'a **dosya başına** gönderilir (**sınırlı eşzamanlılık, ör. 2**):
   - **Tedavi yöntemi dosya adlarına önek olarak eklenir** (slug'lanır: `"DHI METHOD"`→`dhi_method`, `"SAPPHIRE FUE"`→`sapphire_fue`, `"UNIQUE FUE"`→`unique_fue`). Böylece aynı operasyonun dosyaları CRM klasöründe yöntem bazında gruplanır.
   - **Föy:** `hermest-visual-consent-sheet-<method_slug>-<YYYY-MM-DD>.png`, `description = "Visual Consent Sheet"`.
   - **Dolu fotoğraflar (orijinal File):** `<method_slug>_<view>.<ext>` —
     - view eşlemesi: `front` → `front_view`, `top` → `top_view`, `right` → `right_profile`, `left` → `left_profile`
     - örnek: `sapphire_fue_front_view.jpg`
     - uzantı `File.type`'tan (`image/jpeg`→`.jpg`, `image/png`→`.png`); `description = slot.label` ("Front View"…).
   - Sadece **dolu** slot'lar gönderilir (kullanıcı kararı: en az 1, dolu olanlar).
5. Sunucu handler: multipart'ı `request.formData()` ile alır (`file` + `description`), CRM'e yeni multipart kurup `X-API-Key` ile iletir, CRM yanıt status'unu döndürür.
6. İstemci **ilerleme paneli** gösterir: her dosya için durum (`bekliyor` / `yükleniyor` / `✓` / `✗`).

## 7. Hata Yönetimi

- **Arama:**
  - CRM/ağ hatası → satır içi "Arama başarısız, tekrar deneyin".
  - Boş sonuç → "Sonuç bulunamadı".
  - 401 (geçersiz/eksik anahtar) → genel hata mesajı (anahtar detayı sızdırılmaz).
- **Upload:**
  - Lokal indirme upload'tan **bağımsız** ve **önce** yapılır → kullanıcı kopyasını her zaman alır.
  - Dosya başına `try/catch`; özet: "N dosyadan M'i yüklendi, K hata".
  - **"Başarısızları tekrar dene"** butonu yalnızca patlayan dosyaları yeniden gönderir.
- **Sunucu route'ları:**
  - `CRM_BASE_URL`/`CRM_API_KEY` eksikse → 500 + sunucu logu (istemciye genel mesaj).
  - CRM 2xx değilse → status + mesaj istemciye propagate edilir.

## 8. Konfigürasyon ve Dağıtım

### 8.1 Env değişkenleri (server-only, `NEXT_PUBLIC_` DEĞİL)
- `CRM_BASE_URL` — örn. `https://crm.hermest.example`
- `CRM_API_KEY` — `crm_xxx`
- `.env.example` commit'lenir; gerçek **`.env` asla commit'lenmez**. Sunucuda `/opt/hermest-onam/.env` olarak durur.

### 8.2 Repo hijyeni (mevcut eksikler)
- `.gitignore` oluşturulur: `node_modules`, `.next`, `.env*`, `.DS_Store` ignore'lanır.
- Hâlihazırda tracked olan `.DS_Store` git'ten çıkarılır (`git rm --cached`).

### 8.3 Dağıtım hedefi
- **Domain:** `onam.hermestclinic.net` (A kaydı Hetzner sunucusuna yönlendirildi).
- **Sunucu erişim bilgileri (IP / SSH key) bu repoya YAZILMAZ** — özel notlarda tutulur (Obsidian hermest notu deseniyle aynı).
- **Çalışma biçimi:** Docker Compose — mevcut n8n/hermest-api stack'iyle tutarlı.
  - `next.config.ts` → `output: "standalone"`.
  - Küçük `Dockerfile` (multi-stage: build → standalone runner, Node 24).
  - `compose.yml` → container `127.0.0.1:3000` (yalnızca localhost) dinler; `/opt/hermest-onam` altında; `.env` dosyasından env okur; `restart: unless-stopped`.
- **Reverse proxy:** host nginx'te yeni vhost `onam.hermestclinic.net` → `proxy_pass http://127.0.0.1:3000`.
  - Dosya yüklemeleri için **`client_max_body_size 20m;`**.
  - Standart proxy header'ları (`Host`, `X-Forwarded-For`, `X-Forwarded-Proto`).
- **HTTPS:** `certbot --nginx -d onam.hermestclinic.net` (Let's Encrypt). Auto-renew mevcut `certbot.timer` ile (sunucuda certbot zaten kurulu).
- Sunucunun **CRM'e ağ erişimi** olmalı (proxy çağrıları sunucudan çıkar).

### 8.4 Dağıtım sırası (son faz — kod tamamlandıktan SONRA)
1. Kod yazılır + lokal `next build` ile doğrulanır.
2. `Dockerfile` + `compose.yml` hazırlanır; lokal container testi.
3. Repo/sunucu senkronu (`/opt/hermest-onam`), sunucuda `.env` oluşturulur, `docker compose up -d`.
4. nginx vhost eklenir + reload.
5. `certbot` ile sertifika alınır; HTTPS doğrulanır.
6. Uçtan uca manuel test (§9 checklist) production domain'de.

> Not: Sunucu konfigürasyonu (nginx/certbot/docker) bu oturumun ortamından SSH erişimi mümkün değilse, ilgili komutlar runbook olarak verilip kullanıcı tarafından `! <komut>` ile çalıştırılır.

## 9. Test / Doğrulama (hafif — projede test altyapısı yok)

- **Birim:** ülke resolver (kod/ad → içsel kod), dosya-adı kurucu (slot → `front_view.jpg` vb.).
- **Proxy route'ları:** minik CRM stub'ı ile — `X-API-Key` ekleniyor mu, gövde/dosya iletiliyor mu, hata maplemesi doğru mu.
- **Manuel checklist:**
  1. Hasta ara → seç → ad + ülke doluyor.
  2. 1–4 görsel + imza → Download.
  3. Lokal PNG indi mi; CRM klasöründe **föy + isimli fotoğraflar** (`front_view` vb.) oluştu mu.
  4. Upload hatasını simüle et → özet + "tekrar dene" çalışıyor; lokal indirme yine de oldu.

## 10. Açık Varsayımlar (CRM ekibiyle teyit)

1. Dosya yükleme ucu **istek başına tek dosya** alır.
2. Hasta yanıtı **`country`** alanı içerir (ISO kodu veya ad).
3. Arama `?search=` tek parametresiyle **isim + telefon + e-posta** üzerinde eşleşir.
