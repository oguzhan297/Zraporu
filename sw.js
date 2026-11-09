// Uygulamayı internetsiz de açılabilir yapar. Sürüm değişince eski önbellek silinir.
const V='zrapor-v17';
const SHELL=['./','./index.html','./parser.js?v=17','./manifest.webmanifest','./icon-192.png','./icon-512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'];
// cache:'reload' → tarayıcının kendi önbelleğindeki eski kopyayı değil, sunucudaki güncel dosyayı al
self.addEventListener('install',e=>{e.waitUntil(caches.open(V).then(c=>Promise.all(SHELL.map(u=>c.add(new Request(u,u.startsWith('http')?{mode:'no-cors'}:{cache:'reload'})).catch(()=>{})))).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==V).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  const r=e.request;if(r.method!=='GET')return;
  const u=new URL(r.url);
  if(u.hostname==='api.anthropic.com')return;
  // Sayfanın kendisi: önce internetten (güncelleme gelsin), yoksa önbellekten
  if(r.mode==='navigate'){e.respondWith(fetch(r,{cache:'no-cache'}).then(res=>{const c=res.clone();caches.open(V).then(ca=>ca.put('./index.html',c));return res}).catch(()=>caches.match('./index.html')));return}
  e.respondWith(caches.match(r).then(m=>m||fetch(r).then(res=>{if(res.ok||res.type==='opaque'){const c=res.clone();caches.open(V).then(ca=>ca.put(r,c))}return res})));
});
