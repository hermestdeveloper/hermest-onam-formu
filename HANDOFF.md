# Hermest Onam Formu — Handoff

Son güncelleme: 2026-09-04

Bu doküman, projeyi devralacak/sonra devam edecek geliştirici için: ne yapıldı,
canlı durum, nasıl test edilir, nasıl deploy edilir ve **kalan/bekleyen işler**.

---

## 1. Proje nedir?

Saç ekimi öncesi **görsel onam (rıza) föyü** üreten tek sayfalık uygulama
(**Next.js 16 + React 19 + TypeScript**, tamamen client-side UI + iki sunucu
proxy route'u). Akış:

1. **CRM'den hasta ara** (isim/telefon/e-posta) → sonuçlar **`#id` ile** listelenir,
   seçilen hastanın **adı + ülkesi** otomatik gelir (ülke elle seçilmiyor, salt-okunur).
   Arama **yalnızca tek bir CRM panosunu** kapsar (varsayılan **Danışanlar**, `boardId=13`).
2. **4 açıdan fotoğraf** yükle (Front / Top / Right / Left) + **imza** çiz +
   **tedavi yöntemi** seç (DHI / Sapphire FUE / Unique FUE) + **Drive alt klasörü**
   seç (varsayılan **Dosyalar**).
3. **İki buton** (75/25):
   - **"Send & Download"** → markalı **JPEG** föyü üretir, **lokale indirir** ve
     **CRM'e yükler** (föy + dolu ham fotoğraflar, hastanın Drive klasöründeki
     seçilen alt klasöre). Hasta seçimi zorunlu.
   - **"Download"** → yalnızca lokale indirir, **CRM'e hiç dokunmaz**. Hasta
     seçimi gerekmez (taslak/çıktı almak için).

**Dosya adı şeması** (`lib/filenames.ts`): `<tedavi>_<hasta>_<görünüm>_<tarih_saat>`
- fotoğraf: `sapphire_fue_ahmet_yilmaz_front_view_2026-08-05_1425.jpg`
- föy: `hermest-visual-consent-sheet-sapphire_fue-ahmet_yilmaz-2026-08-05_1425.jpg`

Zaman damgası **yerel saat** (dosyaya bakan klinik saatini görsün) ve bir dışa
aktarımdaki tüm dosyalar **aynı damgayı** taşır. Türkçe harfler karşılıklarına
çevrilir (`Şükrü Öztürk` → `sukru_ozturk`); boş parça (hasta seçilmemişse) atlanır.

> ⚠️ **Drive'daki ad bu değildir.** CRM, multipart'taki `filename` alanını **yok
> sayar** ve Drive adını kendisi kurar: `{description} - {hasta adı}.{uzantı}`.
> 2026-08-05'te gerçek yüklemeyle doğrulandı (gönderilen `BIZIM_GONDERDIGIMIZ_AD.png`
> → dönen `fileName: "SONDA_ACIKLAMA_XYZ - soner aratma.png"`). Bu yüzden Drive'da
> görünen ada tek etkimiz **`description`**; `lib/filenames.ts:driveDescription`
> oraya `{tedavi} - {etiket} - {tarih_saat}` yazar, sonuç:
> `DHI METHOD - Front View - 2026-08-05_1251 - soner aratma.png`.
> Hasta adı bilerek eklenmez — CRM zaten sona ekliyor, yoksa iki kez yazılırdı.
> Yükleme yanıtındaki `data.fileName` Drive'daki gerçek adı döndürür; adla ilgili
> bir şey değiştirileceğinde önce oraya bakılmalı.

**Güvenlik:** CRM API anahtarı (`X-API-Key`) **asla tarayıcıya gitmez**.
Tarayıcı → bu uygulamanın sunucu route'ları (`/api/patients`,
`/api/patients/:id/files`) → CRM. Anahtar yalnızca sunucu env'inde.

**Giriş (2026-08-05):** Uygulama tek ortak parolayla korunuyor. `middleware.ts`
`/login` ve auth uçları dışındaki **her yolu** kapatır — yalnızca sayfayı korumak
yetmezdi, `/api/patients` doğrudan çağrıldığında CRM'deki ~29 bin hastanın adı,
telefonu ve e-postası dönüyordu. Oturum imzalı çerez (HMAC-SHA256, httpOnly +
sameSite lax, 30 gün); veritabanı yok. `APP_PASSWORD` / `AUTH_SECRET` tanımlı
değilse uygulama **hiçbir şey servis etmez** (503) — env unutulursa site sessizce
açık kalmasın diye bilerek böyle. Giriş IP başına 15 dakikada 10 hatalı denemeyle
sınırlı. Parola karşılaştırması ve imza karşılaştırması sabit zamanlı.

Parola değiştirme (sunucuda, ~1 dk):
```bash
ssh root@<SUNUCU_IP>
cd /opt/hermest-onam
sed -i 's/^APP_PASSWORD=.*/APP_PASSWORD=yeni-parola/' .env
docker compose up -d --force-recreate     # rebuild gerekmez
```
`AUTH_SECRET` değiştirilirse herkesin oturumu düşer (bazen istenen şey budur).

---

## 2. Canlı durum

- **URL:** https://onam.hermestclinic.net (yayında, HTTPS, noindex).
- **Sunucu:** Hetzner (n8n ile aynı kutu). Docker container `hermest-onam`,
  `127.0.0.1:3000`, host nginx vhost + Let's Encrypt (auto-renew).
  Sunucu erişim bilgileri (IP/SSH) repoda DEĞİL — Obsidian `hermest` notunda.
- **Konum:** `/opt/hermest-onam` (sunucuda).
- **Kod transferi:** şu an `rsync` ile (git değil). GitHub remote:
  `hermestdeveloper/hermest-onam-formu`.
- **Cloudflare (2026-09-04):** alan adı artık **proxy arkasında** (turuncu bulut);
  DNS Cloudflare IP'lerine çözülüyor, origin adresi Obsidian `hermest` notunda. SSL modu **Full
  (strict)** olmalı — Flexible'da origin HTTPS'e zorladığı için sonsuz yönlendirme
  döngüsü olur. Let's Encrypt yenilemesi proxy arkasında da çalışıyor
  (`certbot renew --dry-run` proxy açıkken doğrulandı).
  nginx gerçek ziyaretçi IP'sini `CF-Connecting-IP`'den okuyor
  (`/etc/nginx/snippets/cloudflare-realip.conf`, `deploy/nginx/*.conf` içinde de var).
  Bu olmadan giriş deneme limiti tüm kullanıcılar için ortak sayaca dönerdi.
  Aynı düzenleme `n8n.hermestclinic.net` vhost'una da uygulandı.
  Cloudflare Free planı origin'den 100 sn içinde yanıt beklemiyor, uzun istekler
  524 alır — onam için sorun değil, n8n'de uzun workflow'lar etkilenebilir
  (bilinçli olarak öyle bırakıldı).

> ✅ **CRM uçları 2026-08-04'te prod'a çıktı** (CRM release `20260804-210304-d0decb2`,
> issue [#84](https://github.com/CloserOneAI/HermestCRM/issues/84)). Arama doğrulandı;
> Drive'a yüklemenin uçtan uca teyidi (gerçek föyle) hâlâ bekliyor — bkz. §5.

---

## 3. Nasıl test edilir?

### Lokal (geliştirme)
```bash
npm install
npm run dev        # http://localhost:3000
npm test           # 65 birim testi (Vitest)
npm run build      # production build (standalone)
npm run typecheck  # tsc --noEmit (temiz olmalı)
```

### Production smoke test
```bash
# Giriş koruması ayakta mı (oturumsuz):
curl -s -o /dev/null -w '%{http_code}\n' https://onam.hermestclinic.net/          # 307 → /login
curl -s https://onam.hermestclinic.net/api/patients?search=ahmet                  # {"error":"Oturum gerekli"} 401

# Oturum açıp devam et:
curl -c p.txt -X POST -H 'Content-Type: application/json' \
     -d '{"password":"<parola>"}' https://onam.hermestclinic.net/api/auth/login   # {"ok":true}
curl -b p.txt -o /dev/null -w '%{http_code}\n' https://onam.hermestclinic.net/    # 200

# Kısa arama → CRM'e gitmeden boş döner (short-circuit, <2 karakter):
curl "https://onam.hermestclinic.net/api/patients?search=a"
# Beklenen: {"data":[],"total":0,"page":1}

# Gerçek arama → {data,total,page}; her kayıtta board "Danışanlar" olmalı:
curl "https://onam.hermestclinic.net/api/patients?search=ahmet" | head -c 400
```

### Manuel uçtan-uca
1. Hasta ara → listede `#id` görünüyor + okunuyor mu; sonuçların hepsi
   **Danışanlar** panosundan mı (yanıtta `board` alanı) → seç → ad + ülke doluyor mu.
2. 1–4 fotoğraf + imza → **Drive Folder** seç → **Download**.
3. Lokal föy (JPEG) indi mi; **hastanın Drive klasöründeki seçilen alt klasörde** föy +
   isimli fotoğraflar (`sapphire_fue_front_view.jpg` vb.) oluştu mu. Aynı yüklemeyi
   ikinci kez yap → alt klasör **çoğalmamalı** (CRM #107).
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

### 🔴 Uçtan uca Drive teyidi (bizde)
CRM ekibi issue #84'ü kapatırken tek açık maddeyi bize bıraktı: gerçek bir onam
formu yükleyip dosyanın Drive'da **danışan klasörü → seçilen alt klasöre** düştüğünü
görmek. Lokalde/testlerde `subFolder` gönderimi doğrulandı, canlı Drive denenmedi.

### ⚠️ Drive klasörü bağlı olmayan hastalar
CRM #36 ile **otomatik klasör açma kaldırıldı** (#107 ile hastaya bağlı, çoklamayan
sürüm geri geldi). Klasörü olmayan bir kayda yükleme denenirse CRM 400 + şu mesajı
döner: *"Bu kayda Drive klasörü bağlı değil. Önce CRM üzerinden bir Drive klasörü
bağlayın."* Bu mesaj artık kullanıcıya satır içi gösteriliyor
(`app/api/patients/[id]/files/route.ts`, 4xx'te CRM metni aynen geçer).

### 🟢 Yapıldı — issue #84, **prod'a çıkıldı 2026-08-05**
Deploy doğrulandı: `/api/patients?search=ahmet` → 207 sonuç, hepsi `board: "Danışanlar"`
(filtresiz 29.320'ye karşı); istemciden `?board=Takipler` gönderilse bile yok sayılıyor;
şablon dışı `subFolder` CRM'e gitmeden 400 dönüyor.

- **Pano filtresi:** `/api/patients` CRM'e `board` parametresi gönderiyor. Değer
  **sunucudan** (`CRM_BOARD`) geliyor, istemci değiştiremiyor. Varsayılan `Danışanlar`;
  env boş bırakılırsa filtre uygulanmaz.
- **Arama listesinde `#id`** + okunabilirlik: liste zemini tam opak, metin koyu.
  (Kök neden: `.input-stack span` etiket stili liste içindeki span'lere de sızıp
  metni soluk + büyük harf yapıyordu; kural `> span`'e daraltıldı.)
- **Drive alt klasörü seçimi:** ekranda "Drive Folder" seçici, varsayılan `Dosyalar`.
  Şablon dışı bir ad sunucuda 400 ile reddediliyor (`lib/folders.ts`), CRM'e hiç
  gitmiyor — Drive'da çöp klasör açılmasın diye.

### 🟡 Teyit / küçük işler
- **Dosya boyutu:** nginx `client_max_body_size` şu an **20m** (`deploy/nginx/
  onam.hermestclinic.net.conf` + sunucuda `/etc/nginx/sites-available/`). Ham
  fotoğraflar 20MB'ı aşacaksa artır.
- **Tek dosya/istek varsayımı:** Uygulama dosyaları **istek başına tek dosya**
  yolluyor. CRM ucu çoklu kabul ediyorsa da çalışır; teyit edilebilir.
- **ESLint kurulu değil.** `lint` script'i `next lint` çağırıyordu; o komut Next 16'da
  kaldırıldı ve projede hiç eslint bağımlılığı/config'i yok — script kaldırıldı, yerine
  `npm run typecheck` kondu. Gerçek lint istenirse `eslint` + `eslint-config-next`
  kurulmalı (ayrı iş; yeni uyarı dalgası çıkarabilir).
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
| `lib/collage.ts` | Canvas çizim/export → JPEG `Blob` (q=0.92) |
| `lib/country.ts` | **Sabit/donmuş** ülke adları + flag + `resolveCountryCode` |
| `lib/filenames.ts` | Dosya adı kurucu (tedavi-yöntemi önekli) |
| `lib/folders.ts` | CRM Drive alt klasör şablonu + varsayılan (`Dosyalar`) + doğrulama |
| `lib/types.ts` | Ortak tipler |
| `lib/buildId.ts` | `.next/BUILD_ID`'yi okur (yayın kimliği) |
| `app/api/version/route.ts` | Sunucudaki güncel yayın kimliğini döner |
| `app/components/VersionWatcher.tsx` | Açık sekmeyi eski sürümde bırakmaz |

**Tasarım & plan:**
`docs/superpowers/specs/2026-06-27-crm-integration-design.md`,
`docs/superpowers/plans/2026-06-27-crm-integration.md`.

### Yükleme sorunlarını nasıl teşhis edersin (2026-09-05)

Onam trafiği artık **ayrı bir dosyada**: `/var/log/nginx/onam-access.log`. Ana
`access.log` internet tarama botlarıyla dolu, klinik istekleri orada kayboluyordu.
Format `onam_timed`, tanımı sunucuda `/etc/nginx/conf.d/log-timing.conf`:

| Alan | Ne söyler |
|---|---|
| `req_len` | İsteğin boyutu — yüklenen dosya bu kadar |
| `req_time` | İstemciden yanıta kadar toplam süre — yavaş/yarım kalan yükleme |
| `ups_time` | Next'in harcadığı süre — CRM yavaşsa burada görünür |
| `ups_status` | Uygulamanın döndüğü kod (nginx'inkinden farklı olabilir) |

Örnek satır (12.6 MB'lik bir yükleme 10 saniye sürmüş, uygulama 45 ms'de yanıtlamış):
```
"POST /api/patients/0/files" 401 req_len=12583604 req_time=10.004 ups_time=0.045
```

Yükleme şikâyeti geldiğinde sırayla bak:
1. **Bu dosyada satır var mı?** Yoksa istek sunucuya hiç ulaşmamış — cihazın
   bağlantısı kopmuştur, ekranda "Bağlantı kurulamadı…" yazar. Kodda yapılacak yok.
2. **Satır var, durum 4xx/5xx mi?** `ups_status` ve container log'u sebebi söyler.
3. **Durum 200 ama `req_time` yüksek mi?** Bağlantı yavaş; `req_len`'e bakıp
   dosyanın neden büyük olduğunu sorgula.

logrotate `/var/log/nginx/*.log` kapsadığı için bu dosya da günlük dönüyor (14 gün).

> **Bilinen açık:** yükleme yapan **tüm** Safari cihazları sunucuya kendini
> `Macintosh` diye tanıtıyor, hiçbiri `iPad` demiyor — ama klinik iPad kullanıyor.
> Yani `getDeviceAdjustedScale` içindeki mobil tavan klinikte hiç devreye girmiyor,
> föy her zaman en yüksek ölçekte (4x, 6400x9400) üretiliyor. Zayıf bağlantıda ilk
> kopan da bu cihaz oluyor. Düzeltmesi bekliyor.

### İstek gövdesi sınırı iki yerde (2026-09-05)

Föy JPEG'e çevrildikten sonra bile bir yükleme **400** döndü ve Drive'a ulaşmadı.
Container log'u sebebi açıkça söylüyordu:

```
Request body exceeded 10MB for /api/patients/164880/files.
Only the first 10MB will be available unless configured.
```

`middleware.ts` her `/api` yolunu kapsadığı için Next isteği kendi sınırında
kesiyor; varsayılan **10 MB**. nginx'i 64m'ye çıkarmak yetmiyordu, ikinci bir
sınır daha vardı. `next.config.ts` içinde `experimental.proxyClientMaxBodySize`
64mb'ye alındı. Sınır artık iki yerde de aynı.

> Doğrulandı: 22 MB'lik gövde artık uyarı üretmeden geçiyor (401 dönüyor çünkü
> oturumsuz gönderildi, yani istek uçtan uca ilerliyor).

### "Load failed" ne demek (2026-09-05)

Bir iPad'de beş dosyanın yanında da `Load failed` göründü. Bu bir sunucu hatası
**değil**: Safari'nin başarısız `fetch` mesajı (Chrome'da "Failed to fetch").
O anda sunucu kayıtlarında o isteklerin izi yoktu — nginx'te satır yok, 499 yok,
error log boş. `/api/version` yoklamaları da tam o dakika durup sonra geri geldi,
yani cihaz o aralıkta bağlantısızdı.

Mesaj artık ham hâliyle gösterilmiyor; `lib/upload.ts:describeUploadError`
`TypeError`'ı "Bağlantı kurulamadı… İnterneti kontrol edip tekrar deneyin"
cümlesine çeviriyor. Aynı ekranı bir daha gören kişi ne yapacağını bilsin diye.

### Föy neden JPEG (2026-09-04)

Klinik "diğer fotoğraflar gitti, onam föyü gitmedi" diye bildirdi. Sebep föyün
boyutuydu: `client_max_body_size` **20m** iken üretilen föy **25.8 MB** çıktı ve
nginx isteği uygulamaya iletmeden **413** döndü. Ham fotoğraflar küçültülmüş JPEG
olduğu için geçiyordu — hata tam olarak bu yüzden yalnızca föyde görünüyordu.

nginx error log'undaki kanıt:
```
client intended to send too large body: 25797533 bytes
```

Access log'da desen nettir (föy listede ilk sırada gönderiliyor):
`05:54:53 föy 413` → `05:55:17-23 dört fotoğraf 200` → tekrar denemeler yine 413.

İki değişiklik yapıldı:
1. **`client_max_body_size` 20m → 64m** (Cloudflare Free 100 MB'da kestiği için altında).
2. **Föy PNG yerine JPEG** (`lib/collage.ts:sheetMimeType`, kalite 0.92). Föy baştan
   aşağı fotoğraf ve gradyan; kayıpsız sıkıştırma dosyayı boşuna şişiriyordu. Zemin
   tamamen doldurulduğu için saydamlık kaybı diye bir sorun yok.

Ölçüldü (aynı tuval, aynı içerik):

| Tuval | PNG | JPEG q=0.92 |
|---|---|---|
| 3200x4700 | 11.0 MB | 0.35 MB |
| 6400x9400 | 39.4 MB | 1.0 MB |
| 3200x4700, saf gürültü (en kötü durum) | 32.7 MB | 11.0 MB |

> Föyün çözünürlüğü yüklenen fotoğrafın çözünürlüğüne göre büyüyor
> (`getAdaptiveExportScale`, 2x-4x). **Bilinen açık:** `getDeviceAdjustedScale`
> mobil tavanı `iPhone|iPad|iPod` user-agent'ına bakarak uyguluyor; modern iPad'ler
> kendini `Macintosh` diye tanıttığı için o tavanın dışında kalıp 4x üretiyorlar.
> JPEG'e geçince aciliyeti kalmadı ama düzeltilmedi.

### Sürüm tazeliği (2026-09-04)

Kullanıcılar cache'teki eski HTML yüzünden eski sürümde kalıyordu. İki parça:

1. **Cache başlıkları** (`next.config.ts`): HTML için `no-cache, must-revalidate`.
   `/_next/static` bilerek dışarıda — oradaki adlar içerik hash'i taşır, `immutable`
   kalmaları doğru. Yeni bir sekme artık her zaman güncel HTML alır.
2. **Açık sekmeler** (`VersionWatcher`): dakikada bir ve sekmeye geri dönüldüğünde
   `/api/version` sorulur. Sunucunun kimliği farklıysa; form **boşsa** sekme
   kendiliğinden yenilenir, **doluysa** şerit gösterilir (fotoğraf ve imza
   silinmesin diye — kullanıcının kararı).

> ⚠️ Kimlik `next.config.ts` içinde ÜRETİLMEZ. Config bir derlemede birden fazla
> kez değerlendiriliyor; `Date.now()` gibi bir değer her seferinde farklı çıkıyor,
> istemciye giden kimlik sunucunun bildirdiğiyle hiç tutmuyor ve boş formdaki her
> sekme **sonsuz yenileme döngüsüne** giriyordu. Tek kaynak `.next/BUILD_ID`
> dosyası: layout onu `<meta name="x-build-id">` olarak HTML'e basar, `/api/version`
> aynı dosyayı okur. Dosya okunamazsa `"unknown"` döner ve istemci karşılaştırmayı
> atlar (`lib/buildId.test.ts` bunu pinliyor).

### Uzun dosya adı / yatay taşma (2026-09-04)

Yükleme listesindeki uzun dosya adı tüm sayfayı sağa kaydırıyordu. Sebep:
`.upload-name` ellipsis için `overflow: hidden` taşıyor ama flex öğesinin
varsayılan `min-width` değeri `auto` olduğu için içeriğinden küçülemiyordu.
Çözüm zincir boyunca `min-width: 0` (`.hero-stats` → `.upload-panel` → `ul` →
`.upload-row` → `.upload-name`) ve `.upload-name`'e `flex: 1 1 0`. Hata metni
`flex: 1 0 100%` ile alt satıra iniyor. Ad kırpıldığı için `title` ile tam hâli
gösteriliyor.

Ölçüldü (1200px kapta, 120 karakterlik dosya adı): eski CSS'te sayfa 270px sağa
kayıyordu, yeni CSS'te kayma yok ve panel kolon genişliğinde kalıyor. 390px'lik
dar kapta da taşan öğe yok.

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
| `CRM_API_KEY` | `X-API-Key` değeri — server-only, asla `NEXT_PUBLIC_` değil. Gereken kapsamlar: **yalnızca** `customers:read` + `customers:write` |
| `CRM_BOARD` | Aramanın sınırlandığı CRM panosu. **Opsiyonel** — tanımlı değilse kod `Danışanlar` kullanır (sunucudaki `.env`'de yok, gerekmiyor). Boş string = filtre yok |
| `APP_PASSWORD` | **Zorunlu.** Klinik ekibinin paylaştığı tek giriş parolası. Yoksa uygulama 503 döner |
| `AUTH_SECRET` | **Zorunlu.** Oturum çerezini imzalar (`openssl rand -base64 48`). Değişirse tüm oturumlar düşer |

Sunucuda `/opt/hermest-onam/.env`. Repoda yalnızca `.env.example` var; gerçek
`.env` commit'lenmez.

### CRM anahtarı yenilerken (2026-09-04'te yaşandı)

CRM'de **var olan bir API anahtarının kapsamları değiştirilemez.** `api-keys`
modülünde yalnızca oluştur / listele / sil uçları var; PATCH yok. Kapsam yanlışsa
panelden **yeni anahtar üretmek** gerekir, eskisini düzenlemek işe yaramaz.

Onam formu CRM'de sadece iki uca gidiyor, dolayısıyla anahtara başka kapsam
verilmemeli:

| Uç | Kapsam |
|---|---|
| `GET /api/webhooks/patients` | `customers:read` |
| `POST /api/webhooks/patients/:id/files` | `customers:write` |

> Kapsam listesi **boş** bırakılırsa CRM geçiş toleransına düşüp anahtarı tam
> yetkili sayar (`hasRequiredScope` → `null`). Yeni anahtarda iki kutu mutlaka
> işaretlenmeli.

Prod'a koymadan önce doğrula (403 = kapsam eksik, 401 = anahtar yok):
```bash
curl -s -o /dev/null -w '%{http_code}\n' -H "X-API-Key: <yeni>" \
  'https://crm.hermestclinic.net/api/webhooks/patients?search=zzz&page=1&limit=1'   # 200 bekleniyor
# customers:write, dosya yüklemeden guard'la sınanır (403 = kapsam yok, 400 = kapsam var):
curl -s -o /dev/null -w '%{http_code}\n' -X POST -H "X-API-Key: <yeni>" \
  'https://crm.hermestclinic.net/api/webhooks/patients/00000000-0000-0000-0000-000000000000/files'
```
