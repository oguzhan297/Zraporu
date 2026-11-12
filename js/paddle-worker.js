// PaddleOCR işçisi: model yükleme, görüntü hazırlama ve okuma sayfadan ayrı iş parçacığında çalışır → okurken ekran donmaz.
// Sayfa (index.html) modelleri indirip (önbellekten) buraya aktarır, fotoğrafı yönü düzeltilmiş ImageBitmap olarak gönderir,
// her okuma geçişinde yalnız ayarları yollar; buradan sadece bulunan metin kutuları (poly, text, score) döner.
// vendor/paddle.js değişince ?p= elle; goruntu.js ?v= değerini arac/surum.mjs günceller.
import '../vendor/paddle.js?p=2';
import './goruntu.js?v=78';

const L = globalThis.PaddleOCRLib, G = globalThis.ZGoruntu;
let ocr = null, cv = null;
const foto = new Map();   // id → { C: görüntü önbelleği (kırpma kutusu, gri tonlar) }

onmessage = async e => {
  const m = e.data, cevap = (o, tr) => postMessage({ n: m.n, ...o }, tr || []);
  try {
    if (m.t === 'init') {
      L.ort.env.wasm.wasmBinary = m.wasm;           // çalışma zamanı sayfanın önbelleğinden
      L.ort.env.wasm.wasmPaths = m.wasmDir;
      const u = b => URL.createObjectURL(new Blob([b])), dU = u(m.det), rU = u(m.rec);
      try {
        ocr = await L.PaddleOCR.create({ textDetectionModelName: m.detName, textDetectionModelAsset: { url: dU },
          textRecognitionModelName: m.recName, textRecognitionModelAsset: { url: rU },
          ortOptions: { backend: 'wasm', wasmPaths: m.wasmDir, numThreads: 1 } });
      } finally { URL.revokeObjectURL(dU); URL.revokeObjectURL(rU); }
      cv = L.cv instanceof Promise ? await L.cv : L.cv;
      if (!cv || !cv.matFromImageData) throw new Error('OpenCV işçide hazır değil');
      cevap({ ok: true });
    } else if (m.t === 'img') {
      foto.set(m.id, { C: G.kaynak(m.bmp) });
      cevap({ ok: true });
    } else if (m.t === 'read') {
      const f = foto.get(m.id); if (!f) throw new Error('Fotoğraf işçide yok');
      const c = G.prep(f.C, m.opt), x = c.getContext('2d');
      const mat = cv.matFromImageData(x.getImageData(0, 0, c.width, c.height));
      c.width = c.height = 1;
      let r; try { [r] = await ocr.predict(mat, m.params || {}); } finally { mat.delete(); }
      cevap({ ok: true, items: (r && r.items || []).map(i => ({ poly: i.poly, text: i.text, score: i.score })) });
    } else if (m.t === 'free') {
      const f = foto.get(m.id); if (f && f.C.im.close) f.C.im.close(); foto.delete(m.id);
      cevap({ ok: true });
    }
  } catch (err) { cevap({ ok: false, err: String(err && err.message || err) }); }
};
postMessage({ n: 0, hazir: true });   // modül yüklendi (paddle.js + goruntu.js çözümlendi)
