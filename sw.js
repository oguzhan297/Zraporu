// Uygulamayı internetsiz de açılabilir yapar. Sürüm değişince eski önbellek silinir.
const V='zrapor-v92';
// PaddleOCR (paddle.js, ONNX Runtime, modeller) büyük dosyalar: ayrı önbellekte durur, uygulama sürümü değişince silinmez
const OCR='zrapor-ocr-1';
const isOcr=u=>u.hostname==='paddle-model-ecology.bj.bcebos.com'||(u.hostname==='cdn.jsdelivr.net'&&u.pathname.startsWith('/npm/onnxruntime-web@'))||(u.origin===self.location.origin&&/\/paddle\.js$/.test(u.pathname));
const SHELL=['./','./index.html','./css/uygulama.css?v=92','./js/parser.js?v=92','./js/goruntu.js?v=92','./js/paddle-worker.js?v=92','./js/paddle-isci.js?v=92','./vendor/ort-wasm-simd-threaded.mjs?o=1.31.1','./js/temel.js?v=92','./js/kutu.js?v=92','./js/depo.js?v=92','./js/ayarlar.js?v=92','./js/kontrol.js?v=92','./js/kalite.js?v=92','./js/arayuz.js?v=92','./js/okuyucu-claude.js?v=92','./js/okuyucu-tesseract.js?v=92','./js/okuyucu-paddle.js?v=92','./js/okuma.js?v=92','./js/disari.js?v=92','./js/baslat.js?v=92','./ikon.svg?v=92','./manifest.webmanifest','./icon-180.png','./icon-192.png','./icon-512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'];
// cache:'reload' → tarayıcının kendi önbelleğindeki eski kopyayı değil, sunucudaki güncel dosyayı al
self.addEventListener('install',e=>{e.waitUntil(caches.open(V).then(c=>Promise.all(SHELL.map(u=>c.add(new Request(u,u.startsWith('http')?{mode:'cors'}:{cache:'reload'})).catch(()=>{})))).then(()=>self.skipWaiting()))});
// Yalnız kendi eski sürümlerini sil: aynı adresteki (oguzhan297.github.io) Tahsilat uygulamasının önbelleğine ve PaddleOCR önbelleğine dokunma
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==V&&/^zrapor-v\d+$/.test(k)).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
// Çok çekirdekli okuma için sayfa "cross-origin isolated" olmalı: GitHub Pages bu başlıkları veremediği için burada eklenir.
// (Dış adreslerdeki dosyalar — modeller, yazı tipi, xlsx — CORS/CORP veriyor; bu başlıklarla da yüklenir.)
const coi=res=>{if(!res||res.status===0||res.type==='opaque'||res.type==='opaqueredirect')return res;
  const h=new Headers(res.headers);h.set('Cross-Origin-Embedder-Policy','require-corp');h.set('Cross-Origin-Opener-Policy','same-origin');h.set('Cross-Origin-Resource-Policy','cross-origin');
  return new Response(res.body,{status:res.status,statusText:res.statusText,headers:h})};
self.addEventListener('fetch',e=>{
  const r=e.request;if(r.method!=='GET')return;
  const u=new URL(r.url);
  if(u.hostname==='api.anthropic.com'||u.hostname==='api.github.com'||u.searchParams.has('surum'))return;   // sürüm denetimi önbelleğe girmesin
  // Modeller ve çalışma zamanı sayfa tarafından zrapor-ocr önbelleğine yazılır (indirme yüzdesi için); burada sadece önbellekten ver
  if(isOcr(u)){e.respondWith(caches.open(OCR).then(c=>c.match(r,{ignoreVary:true}).then(m=>m||fetch(r).then(res=>{if(res.ok&&!/\.(tar|wasm)$/.test(u.pathname)){const cl=res.clone();c.put(r,cl)}return res})).then(res=>u.origin===self.location.origin?coi(res):res)));return}
  // Sayfanın kendisi: önce internetten (güncelleme gelsin), yoksa önbellekten
  if(r.mode==='navigate'){e.respondWith(fetch(r,{cache:'no-cache'}).then(res=>{const c=res.clone();caches.open(V).then(ca=>ca.put('./index.html',c));return res}).catch(()=>caches.match('./index.html')).then(coi));return}
  e.respondWith(caches.match(r).then(m=>m||fetch(r).then(res=>{if(res.ok||res.type==='opaque'){const c=res.clone();caches.open(V).then(ca=>ca.put(r,c))}return res})).then(res=>u.origin===self.location.origin?coi(res):res));
});
