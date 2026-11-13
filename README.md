# Z Raporu → Luca

Yazar kasa Z raporlarını telefonda fotoğraftan okuyup Luca'ya aktarılacak CSV / Excel dosyasına çeviren web uygulaması (PWA).
Sunucu yok: fotoğraflar ve raporlar yalnızca kullanıcının telefonunda (IndexedDB) durur. Yayın: GitHub Pages (`main` dalı).

## Klasörler

```
index.html             sayfa iskeleti (yalnız HTML)
css/uygulama.css       stil (koyu slate teması)
js/                    uygulama kodu — sırası index.html'deki gibi yüklenir
  temel.js             alan tanımları (FIELDS), sayı/tarih biçimleri, matrah/KDV tamamlama, yardımcılar, APP_VER
  depo.js              IndexedDB kaydı, yedek indir/yükle
  ayarlar.js           okuma yöntemi, Claude API anahtarı/model, varsayılan açıklama
  kontrol.js           tutarlılık kontrolleri (checks), Z no sırası (autoZ)
  kalite.js            fotoğraf kalitesi ölçümü ve uyarısı
  arayuz.js            rapor kartları, kontrol ekranı, alt özet, tıklama/düzenleme olayları, metin yapıştırma
  okuyucu-paddle.js    PaddleOCR (varsayılan): model indirme/önbellek, işçi + sayfa yedeği, kutuları satıra dizme
  okuyucu-tesseract.js Tesseract
  okuyucu-claude.js    Claude API
  okuma.js             fotoğraf/metin ekleme, sıra, okuyucu seçimi, sonucu rapora yazma, yeniden çekme,
                       uzun fiş (devam fotoğrafı, sayfa birleştirme), arka arkaya tarama (uygulama içi kamera)
  disari.js            Luca CSV (Windows-1254), Excel, panoya kopyalama
  baslat.js            açılış: kayıtları yükle, sürüm kontrolü, service worker
  parser.js            Z raporu metin ayrıştırıcısı (ZParse) — tüm fiş düzenleri, okuma hatası onarımları
  goruntu.js           görüntü hazırlama (kırpma, gri ton, Lanczos, keskinleştirme, eşikleme) — sayfa ve işçi ortak
  paddle-worker.js     PaddleOCR işçisi (modül Web Worker, WASM/işlemci): okurken ekran donmaz
  paddle-worker-gpu.js aynı işçinin WebGPU (ekran kartı) sürümü — Ayarlar'da "Hızlı okuyucu (deneme)" açıkken
  paddle-isci.js       iki işçinin ortak gövdesi
vendor/paddle.js       derlenmiş PaddleOCR.js + ONNX Runtime WASM (elle düzenlenmez)
vendor/paddle-gpu.js   aynısı, ONNX Runtime WebGPU ile (çalışma zamanı ort-wasm-simd-threaded.jsep.wasm)
paddle/                vendor/paddle.js'in kaynağı: `cd paddle && npm install && npm run build`
ikon.svg, icon-*.png  uygulama ikonu (ana ekran, sekme, başlık logosu); PNG'ler ikon.svg'den üretilir
sw.js                  service worker: çevrimdışı açılış; PaddleOCR dosyaları ayrı, kalıcı önbellekte
arac/surum.mjs         sürüm yükseltme
```

Derleme adımı yok; dosyalar olduğu gibi yayınlanır. `js/` dosyaları klasik `<script>` olarak yüklenir ve
üst düzey tanımları paylaşır, bu yüzden **sıra önemli**: tanımlar önce, açılışta çalışan kod (`baslat.js`) en son.

## Yayına alma

1. `node arac/surum.mjs +` — sürümü bir artırır (index.html, sw.js, parser.js, işçi; ~35 yer). Unutulursa telefonlar eski dosyayı kullanır.
2. Test arşivini çalıştır (aşağıda).
3. `main`'e gönder. GitHub Pages 1–3 dakikada yayınlar; `curl -s https://oguzhan297.github.io/Zraporu/ | grep APP_VER` ile kontrol.

`vendor/paddle.js` / `vendor/paddle-gpu.js` yeniden derlenirse `js/okuyucu-paddle.js` (`PADDLE.js`, `PADDLE.gpujs`) ve `js/paddle-worker.js` / `js/paddle-worker-gpu.js` içindeki `?p=` değerini de artır.

## Test

Gerçek fiş fotoğrafları ve onaylı doğru değerleri gizli `oguzhan297/zraporu-testler` deposunda (fişlerde firma bilgisi var).
O depoda:

```
node calistir.mjs --uygulama ../zraporu --metin       # ayrıştırıcı, saniyeler
node calistir.mjs --uygulama ../zraporu --mod paddle   # fotoğraftan PaddleOCR, ~7 dk
```

`node arayuz.mjs --uygulama ../zraporu` ekran testleri (saniyeler). "Yanlış ve işaretsiz" sütunu sıfır olmalı (uygulama emin göründüğü hâlde yanlış değer).

## Kullanıcı kuralları (muhasebe)

- %0'lı satışlar Luca'da **Tekel** sütununa yazılır.
- **KNV** satırında tutar varsa Tekel'e değil **%1** grubuna eklenir; KDV'si tutar / 101.
- Bölümlü raporlarda (BELGE TİPLERİ olan) nakit ve kredi kartı yalnız **BELGE TİPLERİ -NAKİT / -KREDİ** satırlarından alınır.
- Karekod ödemeleri ayrıca gösterilmez ve aktarılmaz.
