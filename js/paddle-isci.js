// PaddleOCR işçisinin gövdesi (js/paddle-worker.js bunu yükler).
// Sayfa (index.html) modelleri indirip (önbellekten) buraya aktarır, fotoğrafı yönü düzeltilmiş ImageBitmap olarak gönderir,
// her okuma geçişinde yalnız ayarları yollar; buradan sadece bulunan metin kutuları (poly, text, score) döner.
// goruntu.js ?v= değerini arac/surum.mjs günceller.
import './goruntu.js?v=96';

const L = globalThis.PaddleOCRLib, G = globalThis.ZGoruntu;
let ocr = null, cv = null;
const foto = new Map();   // id → { C: görüntü önbelleği (kırpma kutusu, gri tonlar) }

onmessage = async e => {
  const m = e.data, cevap = (o, tr) => postMessage({ n: m.n, ...o }, tr || []);
  try {
    if (m.t === 'init') {
      L.ort.env.wasm.wasmBinary = m.wasm;           // çalışma zamanı sayfanın önbelleğinden
      // yükleyici (mjs) aynı adresten: çok çekirdekte yardımcı iş parçacıkları buradan açılır
      const yollar = m.mjs ? { mjs: m.mjs, wasm: m.wasmDir + 'ort-wasm-simd-threaded.wasm' } : m.wasmDir;
      L.ort.env.wasm.wasmPaths = yollar;
      const thr = self.crossOriginIsolated && m.thr > 1 ? m.thr : 1;
      // yükleyiciyi önceden içe aktar: işçide ORT'nin kendi içe aktarması takılıp "Detection model timed out" ile bitiyordu
      if (m.mjs) await import(m.mjs);
      const u = b => URL.createObjectURL(new Blob([b])), dU = u(m.det), rU = u(m.rec);
      try {
        ocr = await L.PaddleOCR.create({ textDetectionModelName: m.detName, textDetectionModelAsset: { url: dU },
          textRecognitionModelName: m.recName, textRecognitionModelAsset: { url: rU },
          ortOptions: { backend: 'wasm', wasmPaths: yollar, numThreads: thr } });
      } finally { URL.revokeObjectURL(dU); URL.revokeObjectURL(rU); }
      cv = L.cv instanceof Promise ? await L.cv : L.cv;
      if (!cv || !cv.matFromImageData) throw new Error('OpenCV işçide hazır değil');
      cevap({ ok: true, thr: L.ort.env.wasm.numThreads || thr });
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
