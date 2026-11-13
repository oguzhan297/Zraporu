// Okuyucu 1 (varsayılan): PaddleOCR — modeller önbellekte, okuma js/paddle-worker.js işçisinde (ekran donmaz)
// ---- Ücretsiz okuma 2: PaddleOCR (PP-OCRv6, WASM) — telefonda çalışır, Tesseract'tan isabetli ----
// paddle.js = PaddleOCR.js + ONNX Runtime paketi (paddle/ klasöründen derlenir). Modeller ve çalışma zamanı ilk kullanımda
// bir kez indirilir ve önbellekte (zrapor-ocr-*) saklanır; uygulama sürümü değişince silinmez.
// vendor/paddle.js değişince: ?p= burada ve js/paddle-worker.js'de; ort = paddle/package.json'daki onnxruntime-web sürümü
const PADDLE={js:'vendor/paddle.js?p=2',ort:'1.31.1',det:'PP-OCRv6_small_det',rec:'PP-OCRv6_small_rec',
  base:'https://paddle-model-ecology.bj.bcebos.com/paddlex/official_inference_model/paddle3.0.0/',mb:{det:9.9,rec:21.3,wasm:14.8}};
// Çok çekirdek: sayfa "cross-origin isolated" ise (sw.js başlıkları ekler) ONNX Runtime okumayı birden çok çekirdeğe böler.
// Yardımcı iş parçacıkları ORT'nin küçük yükleyicisinden (vendor/ort-wasm-simd-threaded.mjs, ORT sürümüyle aynı) açılır: aynı adreste olmalı.
// Bir kez sorun çıkarsa bu telefonda tek çekirdeğe dönülür (zr_thr='1') ve nedeni test arşivine bildirilir.
const ORT_MJS='vendor/ort-wasm-simd-threaded.mjs?o=1.31.1';
// Üst sınır 2: iPhone'da 4 çekirdekle uzun okumada sayfa bellekten kapandı (13.11). Okurken çökme olursa sınır yarıya iner (zr_thr).
function cekirdek(){try{if(!self.crossOriginIsolated)return 1;const t=+localStorage.getItem('zr_thr')||2;return Math.max(1,Math.min(t,2,navigator.hardwareConcurrency||2))}catch(e){return 1}}
// Önceki açılış çok çekirdekle okurken kapandıysa bu telefonda çekirdek sayısını azalt (2 → 1) ve bildir
try{const o=KUTU.onceki;if(o&&o.olaylar){const ev=o.olaylar;let i=ev.length-1;while(i>=0&&ev[i].e!=='oku'&&ev[i].e!=='okundu')i--;
  const m=i>=0&&ev[i].e==='oku'&&/isci-(\d+)/.exec(ev[i].motor||'');
  if(m&&+m[1]>1){const yeni=Math.max(1,Math.floor(+m[1]/2));localStorage.setItem('zr_thr',String(yeni));kutu('cekirdekAzaldi',{eski:+m[1],yeni});
    setTimeout(()=>cekirdekTeshis({asama:'cokme',thr:+m[1],yeni}),6000)}}}catch(e){}
async function cekirdekTeshis(o){try{if(!S.ghKey||typeof ghGonder!=='function')return;
  const p={tur:'zrapor-cekirdek',surum:APP_VER,cihaz:navigator.userAgent,cekirdekSayisi:navigator.hardwareConcurrency,izole:self.crossOriginIsolated,...o,hiz:(()=>{try{return JSON.parse(localStorage.getItem('zr_hiz')||'{}')}catch(e){return null}})()};
  await ghGonder(`${new Date().toISOString().replace(/[:.]/g,'-').slice(0,19)}_cekirdek_v${APP_VER}_${Math.random().toString(36).slice(2,6)}`,[{ad:'cekirdek.json',b64:b64Metin(JSON.stringify(p,null,1))}])}catch(e){}}
// Eski "hızlı okuyucu" (ekran kartı) denemesi kaldırıldı: dosyalarını ve ayarlarını temizle
setTimeout(()=>{try{for(const k of ['zr_gpu','zr_gpuneden','zr_gpudeg','zr_gpuhazir'])localStorage.removeItem(k);if('gpu' in S){delete S.gpu;saveS()}}catch(e){}
  caches.open('zrapor-ocr-1').then(c=>c.keys().then(ks=>Promise.all(ks.filter(r=>/paddle-gpu\.js|\.jsep\.wasm/.test(r.url)).map(r=>c.delete(r))))).catch(()=>{})},3000);
const OCR_CACHE='zrapor-ocr-1';
// Büyük dosya indirme: yarıda kalırsa (ekran kapandı, uygulama arka plana geçti, bağlantı koptu) kaldığı yerden sürer.
// iPhone arka planda indirmeye izin vermez; uygulama yeniden öne gelince Range ile kalan kısım istenir (sunucu desteklemezse baştan).
const gorunurBekle=()=>document.visibilityState!=='hidden'?Promise.resolve():new Promise(r=>{const f=()=>{if(document.visibilityState!=='hidden'){document.removeEventListener('visibilitychange',f);r()}};document.addEventListener('visibilitychange',f)});
async function fetchBig(url,onBytes){
  let cache=null;
  try{cache=await caches.open(OCR_CACHE);const m=await cache.match(url);if(m){const b=await m.arrayBuffer();onBytes(b.byteLength,b.byteLength);return b}}catch(e){}
  const parts=[];let n=0,total=0,hata=null;
  for(let deneme=0;deneme<12;deneme++){
    await gorunurBekle();
    let res;
    try{res=await fetch(url,n?{mode:'cors',headers:{Range:`bytes=${n}-`}}:{mode:'cors'})}
    catch(e){hata=e;if(n){try{res=await fetch(url,{mode:'cors'})}catch(e2){}}if(!res){if(!n&&deneme>=2)break;await new Promise(r=>setTimeout(r,1500));continue}}   // hiç inmiyorsa (internet yok) çabuk vazgeç; sonra kendiliğinden yeniden denenir
    if(!res.ok){if(res.status>=500||res.status===429){hata=new Error(String(res.status));await new Promise(r=>setTimeout(r,2000));continue}throw new Error(`PaddleOCR dosyası indirilemedi (${res.status}). Biraz sonra tekrar dene.`)}
    if(n&&res.status!==206){parts.length=0;n=0}   // sunucu kaldığı yerden vermedi: baştan
    if(!total){const cr=res.headers.get('content-range'),m=cr&&cr.match(/\/(\d+)/);total=m?+m[1]:(+res.headers.get('content-length')||0)}
    try{
      if(res.body&&res.body.getReader){const rd=res.body.getReader();for(;;){const {done,value}=await rd.read();if(done)break;parts.push(value);n+=value.length;onBytes(n,total)}}
      else{const b=new Uint8Array(await res.arrayBuffer());parts.push(b);n+=b.length;onBytes(n,total)}
      if(!total||n>=total){hata=null;break}
    }catch(e){hata=e;await new Promise(r=>setTimeout(r,800))}   // yarıda kesildi: elde olanla devam
  }
  if(hata||(total&&n<total))throw new Error('PaddleOCR dosyaları indirilemedi. İnternet bağlantını kontrol et; uygulama açıkken kaldığı yerden sürer.');
  const buf=await new Blob(parts).arrayBuffer();
  if(cache)try{await cache.put(url,new Response(new Blob([buf])))}catch(e){}
  return buf;
}
// İndirme sürerken ekran kapanmasın (iPhone ekran kapanınca indirmeyi durdurur)
let ekranKilit=null;
async function ekranAcikTut(ac){try{if(ac){if(!ekranKilit&&navigator.wakeLock)ekranKilit=await navigator.wakeLock.request('screen')}else if(ekranKilit){await ekranKilit.release();ekranKilit=null}}catch(e){}}
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&onIndir&&!ekranKilit)ekranAcikTut(true)});
// Okuma motoru: önce işçide (ekran donmaz), işçi açılamazsa / çökerse sayfada (eski yol).
// motor = { tur:'isci'|'ana', resim(id,src), oku(id,src,opt) → kutular, birak(id) }
let pdl=null,pdlLoading=null,pdlProg=null,isciYok=false;
async function paddleDosyalari(){
  if(onIndir){pdlProg&&pdlProg('Okuyucu indiriliyor…');try{await onIndir}catch(e){}}   // önceden indirme sürüyorsa aynı dosyaları ikinci kez indirme
  const wasmDir=`https://cdn.jsdelivr.net/npm/onnxruntime-web@${PADDLE.ort}/dist/`;
  const urls={det:PADDLE.base+PADDLE.det+'_onnx_infer.tar',rec:PADDLE.base+PADDLE.rec+'_onnx_infer.tar',wasm:wasmDir+'ort-wasm-simd-threaded.wasm'};
  const got={det:0,rec:0,wasm:0},tot={det:PADDLE.mb.det*1e6,rec:PADDLE.mb.rec*1e6,wasm:PADDLE.mb.wasm*1e6};
  let last=-1;
  const tick=()=>{const a=Object.values(got).reduce((x,y)=>x+y,0),b=Object.values(tot).reduce((x,y)=>x+y,0),p=Math.min(100,Math.round(a*100/b));
    if(p!==last){last=p;pdlProg&&pdlProg(p>=100?'Okuyucu hazırlanıyor…':`İlk kullanım: okuyucu indiriliyor %${p} (bir kez)`)}};
  ekranAcikTut(true);
  try{const [det,rec,wasm]=await Promise.all(['det','rec','wasm'].map(k=>fetchBig(urls[k],(n,t)=>{if(t)tot[k]=t;got[k]=n;tick()})));
    return {det,rec,wasm,wasmDir,mjs:new URL(ORT_MJS,location.href).href}}
  finally{if(!onIndir)ekranAcikTut(false)}
}
// Fotoğrafı yönü düzeltilmiş (EXIF) ve iOS tuval sınırına (16 MP) indirilmiş ImageBitmap olarak hazırla
async function fotoBitmap(src){
  // Okuma geçişleri en çok ~2000 px genişlik kullanır: 24 MP (yeni iPhone) fotoğrafı tam boy taşımak belleği dolduruyordu.
  // Alan 12 MP ile sınırlı: 12 MP fotoğraf olduğu gibi kalır, 24/48 MP olanlar 12 MP'ye iner (eskiden 16 MP).
  const im=await openImage(src),W=im.naturalWidth,H=im.naturalHeight,k=Math.min(1,Math.sqrt(12.2e6/(W*H)));kutu('bitmap',{w:W,h:H,k:+k.toFixed(2)});
  const c=document.createElement('canvas');c.width=Math.round(W*k);c.height=Math.round(H*k);c.getContext('2d').drawImage(im,0,0,c.width,c.height);
  const b=await createImageBitmap(c);c.width=c.height=1;return b;
}
function isciMotoru(f,thr=1){
  return new Promise((ok,no)=>{
    let w;try{w=new Worker(`js/paddle-worker.js?v=${APP_VER}`,{type:'module'})}catch(e){return no(e)}
    let n=0,olu=false;const bek=new Map();
    const gonder=(o,tr)=>olu?Promise.reject(new Error('Okuyucu işçisi kapandı')):new Promise((a,b)=>{const id=++n;bek.set(id,{a,b});w.postMessage({...o,n:id},tr||[])});
    const bitir=er=>{if(olu)return;olu=true;for(const x of bek.values())x.b(er);bek.clear();try{w.terminate()}catch(e){}};
    w.onmessage=e=>{const m=e.data;if(m.hazir)return;const x=bek.get(m.n);if(!x)return;bek.delete(m.n);m.ok?x.a(m):x.b(new Error(m.err||'İşçi hatası'))};
    w.onerror=e=>{e.preventDefault&&e.preventDefault();const er=new Error('İşçi açılamadı'+(e.message?': '+e.message:''));bitir(er);no(er)};
    const zm=setTimeout(()=>{const er=new Error('İşçi zamanında hazır olmadı');bitir(er);no(er)},thr>1?90000:120000);
    gonder({t:'init',det:f.det,rec:f.rec,wasm:f.wasm,wasmDir:f.wasmDir,mjs:f.mjs,thr,detName:PADDLE.det,recName:PADDLE.rec},[f.det,f.rec,f.wasm]).then(c=>{clearTimeout(zm);
      ok({tur:'isci',thr:c&&c.thr||thr,olu:()=>olu,
        async resim(id,src){const bmp=await fotoBitmap(src);await gonder({t:'img',id,bmp},[bmp])},
        async oku(id,src,opt){return (await gonder({t:'read',id,opt,params:opt.p||{}})).items},
        birak(id){gonder({t:'free',id}).catch(()=>{})},kapat(){bitir(new Error('Okuyucu kapatıldı'))}})},er=>{clearTimeout(zm);bitir(er);no(er)});
  });
}
async function anaMotor(f){
  if(!window.PaddleOCRLib)await loadScript(PADDLE.js);
  const L=window.PaddleOCRLib;if(!L||!L.PaddleOCR)throw new Error('PaddleOCR yüklenemedi');
  L.ort.env.wasm.wasmBinary=f.wasm;   // çalışma zamanını önbellekten ver, ORT kendisi indirmesin
  const du=b=>URL.createObjectURL(new Blob([b])),dU=du(f.det),rU=du(f.rec);let ocr;
  try{ocr=await L.PaddleOCR.create({textDetectionModelName:PADDLE.det,textDetectionModelAsset:{url:dU},textRecognitionModelName:PADDLE.rec,textRecognitionModelAsset:{url:rU},
      ortOptions:{backend:'wasm',wasmPaths:{mjs:f.mjs,wasm:f.wasmDir+'ort-wasm-simd-threaded.wasm'},numThreads:cekirdek()}})}
  finally{URL.revokeObjectURL(dU);URL.revokeObjectURL(rU)}
  return {tur:'ana',thr:cekirdek(),olu:()=>false,async resim(){},
    async oku(id,src,opt){await new Promise(a=>setTimeout(a,30));const img=await prepImage(src,opt);const [out]=await ocr.predict(img,opt.p||{});img.width=img.height=1;return out&&out.items||[]},
    birak(){}};
}
async function getPaddle(onProg){
  pdlProg=onProg;   // ilerleme her zaman o an okunan karta yazılsın
  if(pdl&&!pdl.olu())return pdl;
  if(!pdlLoading)pdlLoading=(async()=>{
    pdlProg&&pdlProg('İlk kullanım: PaddleOCR indiriliyor (bir kez)…');
    // modül işçi + OffscreenCanvas varsa işçide; yoksa ya da işçi başarısızsa sayfada
    if(!isciYok&&typeof Worker!=='undefined'&&typeof OffscreenCanvas!=='undefined'&&typeof createImageBitmap==='function'){
      const thr=cekirdek();
      if(thr>1){const t=Date.now();
        try{pdl=await isciMotoru(await paddleDosyalari(),thr);kutu('motor',{thr,sn:Math.round((Date.now()-t)/1000)});return pdl}
        catch(e){if(/indirilemedi/.test(e&&e.message||''))throw e;const hata=String(e&&e.message||e).slice(0,300);
          try{localStorage.setItem('zr_thr','1')}catch(x){}kutu('cekirdekKapandi',{m:hata.slice(0,120)});cekirdekTeshis({asama:'acilis',thr,hata,sn:Math.round((Date.now()-t)/1000)});
          console.warn('Çok çekirdekli okuyucu açılamadı, tek çekirdekle okunacak:',e)}}
      try{pdl=await isciMotoru(await paddleDosyalari());return pdl}
      catch(e){if(/indirilemedi/.test(e&&e.message||''))throw e;isciYok=true;console.warn('PaddleOCR işçisi kullanılamadı, sayfada okunacak:',e)}
    }
    pdl=await anaMotor(await paddleDosyalari());   // dosyalar önbellekte: ikinci kez hızlı
    return pdl;
  })().finally(()=>{pdlLoading=null});
  return pdlLoading;
}
// PaddleOCR kutularını satırlara diz: eğikliği düzelt, aynı yükseklikteki kutuları soldan sağa birleştir
function paddleLines(items){
  const N=s=>String(s).normalize('NFKC').replace(/[ÍÌ]/g,'İ').replace(/[íì]/g,'i').trim();
  const it=(items||[]).map(i=>{const [a,b,c,d]=i.poly||[];if(!d)return null;
    const w=Math.hypot(b[0]-a[0],b[1]-a[1]),h=(Math.hypot(d[0]-a[0],d[1]-a[1])+Math.hypot(c[0]-b[0],c[1]-b[1]))/2;
    return {t:N(i.text||''),cx:(a[0]+b[0]+c[0]+d[0])/4,cy:(a[1]+b[1]+c[1]+d[1])/4,w,h:Math.max(1,h),ang:Math.atan2(b[1]-a[1],b[0]-a[0])}}).filter(i=>i&&i.t);
  const angs=it.filter(i=>i.w>2*i.h).map(i=>i.ang).sort((a,b)=>a-b),sk=angs.length?angs[angs.length>>1]:0,cs=Math.cos(sk),sn=Math.sin(sk);
  for(const i of it){i.x=i.cx*cs+i.cy*sn;i.y=-i.cx*sn+i.cy*cs}
  it.sort((a,b)=>a.y-b.y);
  const lines=[];
  for(const i of it){const L=lines.slice(-3).find(l=>Math.abs(l.y-i.y)<0.5*Math.min(l.h,i.h));
    if(L){L.items.push(i);L.y+=(i.y-L.y)/L.items.length;L.h=Math.max(L.h,i.h)}else lines.push({y:i.y,h:i.h,items:[i]})}
  return lines.map(l=>l.items.sort((a,b)=>a.x-b.x).map(i=>i.t).join(' ')).join('\n');
}
async function extractPaddle(r,ikinci){
  r.status='work';setProg(r,'Hazırlanıyor…');render();
  let motor;
  try{motor=await getPaddle(t=>setProg(r,t))}
  catch(e){
    // indirme hatası: kart "Okunamadı" olur, Tekrar ile denenir. Tarayıcı PaddleOCR'ı çalıştıramıyorsa Tesseract ile oku.
    if(navigator.onLine===false||/indirilemedi/.test(e&&e.message||'')){r.status='error';r.err=e.message;delete r.prog;render();return}
    toast('PaddleOCR bu tarayıcıda çalışmadı, Tesseract ile okunuyor');return extractFree(r);
  }
  const ps=sayfalar(r),sid=i=>r.id+':'+i,t0=Date.now();let etiket='Okunuyor (PaddleOCR)…';
  kutu('oku',{id:r.id.slice(-4),sayfa:ps.length,mb:+((ps[0]&&ps[0].size||0)/1e6).toFixed(1),motor:motor.tur+(motor.thr>1?'-'+motor.thr:'')});
  // işçide okurken ekran serbest: geçen süreyi göster
  const sayac=setInterval(()=>setProg(r,`${etiket} ${Math.round((Date.now()-t0)/1000)} sn`),1000);
  try{
    // Toplamlar tutana kadar farklı görüntülerle oku (tutunca durur). PaddleOCR arka planı kendisi ayıklar; fiş beyaz zemin
    // üstündeyken kırpma fişi kesebildiği için önce fotoğrafın tamamı okunur: tam, kırpılmış, renkli leke temizleyen + keskin, hassas algılama
    let passes=[{raw:1,full:1,tw:1600,maxSide:4000},{raw:1,tw:1280,maxSide:4000},{raw:1,full:1,tw:1800,maxSide:4000,gray:'max',sharp:1.5},
      {raw:1,full:1,tw:2000,maxSide:4000,sharp:1,p:{textDetThresh:.2,textDetBoxThresh:.45,textDetUnclipRatio:1.8}}];
    try{const x=JSON.parse(localStorage.getItem('zr_deney')||'null');if(Array.isArray(x)&&x.length)passes=x}catch(e){}   // yalnız hız/doğruluk denemesi (test aracı) için
    let best=null;const all=[],texts=[];
    for(let i=0;i<ps.length;i++)await motor.resim(sid(i),ps[i]);
    try{
      for(let n=0;n<passes.length;n++){
        etiket=n?`Toplamlar tutmadı, tekrar okunuyor (${n+1}/${passes.length})…`:'Okunuyor (PaddleOCR)…';setProg(r,etiket);
        kutu('gecis',{n:n+1});
        const sm=[];for(let i=0;i<ps.length;i++)sm.push(paddleLines(await motor.oku(sid(i),ps[i],passes[n])));
        const text=birlestir(sm);
        const res=ZParse.parseZ(text),sc=ZParse.consistency(res);
        all.push(res);texts.push(text);
        if(!best||sc>best.sc)best={res,sc,text};
        if(sc>=6)break;
        if(all.length>=2){const mm=ZParse.merge(all);if(!mm.unsure.some(k=>k!=='z_no'&&k!=='diger'&&FIELDS.some(f=>f.k===k)))break}
      }
    }finally{for(let i=0;i<ps.length;i++)motor.birak(sid(i))}
    // toplamları tam tutan bir okuma varsa onu al; yoksa okumaları alan alan birleştir
    const merged=best.sc>=6||all.length<2?best.res:ZParse.merge(all);
    applyParse(r,best.sc>=6||all.length<2?best.text:texts.map((t,i)=>`—— ${i+1}. okuma ——\n`+t).join('\n'),merged);
    r.status='done';r.open=false;r.created=r.created||Date.now();r.sayfa=sayfalar(r).length;delete r.blob;delete r.file;delete r.pages;resimBirak(r);delete r.prog;
    kutu('okundu',{sn:Math.round((Date.now()-t0)/1000),gecis:all.length});hizKaydet(motor.thr>1?'cok':'cpu',(Date.now()-t0)/1000/all.length);cekirdekDegerlendir(motor.thr||1,motor.tur);hizUI();r._sure=(Date.now()-t0)/all.length;
    save(r);autoZ();saveImg(r,r._small);delete r._small;
  }catch(e){
    clearInterval(sayac);
    // işçi çöktüyse (bellek vb.) bu raporu bir kez de sayfada oku
    if(motor.tur==='isci'&&motor.olu())kutu('isciCoktu',{m:String(e&&e.message||e).slice(0,120)});
    // çok çekirdekle okunamadı: bu telefonda tek çekirdeğe dön, raporu bir kez daha oku
    // (fotoğraf açılamadıysa çekirdekle ilgisi yok: o durumda dokunma)
    if(motor.thr>1&&!ikinci&&!/Fotoğraf|indirilemedi/.test(String(e&&e.message||e))){const hata=String(e&&e.message||e).slice(0,300);try{localStorage.setItem('zr_thr','1')}catch(x){}kutu('cekirdekKapandi',{m:hata.slice(0,120)});
      cekirdekTeshis({asama:'okuma',thr:motor.thr,hata});try{motor.kapat&&motor.kapat()}catch(x){}pdl=null;return extractPaddle(r,true)}   // eski işçi kapatılmazsa belleği tutar
    if(motor.tur==='isci'&&motor.olu()&&!ikinci){isciYok=true;pdl=null;console.warn('PaddleOCR işçisi çöktü, sayfada okunuyor:',e);return extractPaddle(r,true)}
    r.status='error';r.err=(e&&e.message)||'Okunamadı';delete r.prog;kutu('okumaHata',{m:String(r.err).slice(0,120),isci:motor.tur});
    // bir kez kendiliğinden yeniden dene (geçici bellek / işçi sorunu); ikinci kez olmazsa "Okunamadı + Tekrar" kalır
    if(!r._tekrar&&!/indirilemedi/.test(r.err)){r._tekrar=1;r.status='queued';delete r.err;r.prog='Okunamadı, yeniden deneniyor';queue.push(r)}
  }
  clearInterval(sayac);
  render();
}

// ---- Okuyucuyu önceden indirme: ilk fiş beklemesin, internetsiz de okusun ----
// Wi-Fi bilinen cihazda (Android) kendiliğinden; bağlantı türü bilinmiyorsa (iPhone) tek dokunuşluk öneri, 3 günde bir.
let onIndir=null,okYarim=false;
const okDosyalar=()=>{const w=`https://cdn.jsdelivr.net/npm/onnxruntime-web@${PADDLE.ort}/dist/`;
  return [{u:new URL(PADDLE.js,location.href).href,mb:10.6,js:true},{u:PADDLE.base+PADDLE.det+'_onnx_infer.tar',mb:PADDLE.mb.det},{u:PADDLE.base+PADDLE.rec+'_onnx_infer.tar',mb:PADDLE.mb.rec},{u:w+'ort-wasm-simd-threaded.wasm',mb:PADDLE.mb.wasm}]};
async function okuyucuHazirMi(){try{const c=await caches.open(OCR_CACHE);for(const f of okDosyalar())if(!await c.match(f.u,{ignoreVary:true}))return false;return true}catch(e){return null}}
function okuyucuIndir(oto=false){if(onIndir)return onIndir;
  const fs=okDosyalar(),got=fs.map(()=>0),tot=fs.map(f=>f.mb*1e6);let son=-1;
  const yaz=m=>{$('#okdurum').textContent=m;if(!$('#okoneri').hidden)$('#okoneriyazi').textContent=m};
  const tik=()=>{const p=Math.min(99,Math.floor(got.reduce((a,b)=>a+b,0)*100/tot.reduce((a,b)=>a+b,0)));if(p!==son){son=p;yaz(`Okuyucu indiriliyor %${p}…`)}};
  $('#okindir').hidden=true;$('#okoneridugme').hidden=true;tik();
  ekranAcikTut(true);try{navigator.storage&&navigator.storage.persist&&navigator.storage.persist()}catch(e){}   // telefon yer açarken silmesin
  onIndir=(async()=>{const c=await caches.open(OCR_CACHE);
    await Promise.all(fs.map(async(f,i)=>{if(await c.match(f.u,{ignoreVary:true})){got[i]=tot[i];tik();return}
      if(f.js){let r=null;for(let k=0;k<6&&!r;k++){await gorunurBekle();try{r=await fetch(f.u,{cache:'reload'})}catch(e){await new Promise(z=>setTimeout(z,1500))}}
        if(!r||!r.ok)throw new Error('indirilemedi '+(r?r.status:''));await c.put(f.u,r.clone());const b=await r.arrayBuffer();got[i]=tot[i]=b.byteLength||tot[i];tik();return}   // başlıklarıyla sakla (işçi modül olarak yükler)
      await fetchBig(f.u,(n,t)=>{if(t)tot[i]=t;got[i]=n;tik()})}))})();
  onIndir.then(()=>{toast('Okuyucu hazır; artık internetsiz de okur');$('#okoneri').hidden=true;okDurumUI()},
    e=>{okYarim=true;if(!oto)toast('Okuyucu indirilemedi; internet gelince ya da uygulamaya dönünce kendiliğinden sürer');$('#okindir').hidden=false;$('#okoneridugme').hidden=false;$('#okoneriyazi').textContent='İndirme yarıda kaldı; uygulamaya dönünce kendiliğinden sürer (ya da dokun).';okDurumUI()})
    .finally(()=>{onIndir=null;ekranAcikTut(false)});
  return onIndir}
async function okDurumUI(){const h=await okuyucuHazirMi(),el=$('#okhazir');if(S.mode!=='paddle'||h==null){el.hidden=true;return h}
  el.hidden=false;if(onIndir)return h;$('#okdurum').textContent=h?'Okuyucu bu telefonda hazır ✓ (internetsiz de okur)':'Okuyucu henüz indirilmedi (bir kez ~57 MB)';$('#okindir').hidden=!!h;return h}
$('#okindir').onclick=()=>okuyucuIndir();
$('#okoneriindir').onclick=()=>okuyucuIndir();
$('#okonerisonra').onclick=()=>{$('#okoneri').hidden=true;try{localStorage.setItem('zr_okoneri',String(Date.now()))}catch(e){}};
$('#mode').addEventListener('change',()=>{okDurumUI();if(S.mode!=='paddle')$('#okoneri').hidden=true});
// Okuyucu hazır değilse kendiliğinden indir (her telefonda; veri tasarrufu açıksa ya da hücresel bağlantı biliniyorsa sorar).
// Yarıda kaldıysa uygulama öne gelince / internet gelince kendiliğinden sürer. Dosyalar güncellemelerde silinmez.
function okOtomatik(){if(S.mode!=='paddle'||onIndir)return;okuyucuHazirMi().then(h=>{if(h!==false||onIndir)return;const c=navigator.connection;
  if(c&&(c.saveData||c.type==='cellular')&&!okYarim){let sonra=0;try{sonra=+localStorage.getItem('zr_okoneri')||0}catch(e){}if(Date.now()-sonra>=3*864e5)$('#okoneri').hidden=false;return}
  if(navigator.onLine===false)return;$('#okoneri').hidden=false;okuyucuIndir(true)})}
setTimeout(async()=>{await okDurumUI();okOtomatik()},400);   // hemen: sonradan eklenip düğmeleri kaydırmasın
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')setTimeout(okOtomatik,600)});
window.addEventListener('online',()=>setTimeout(okOtomatik,600));

// Okuma hızı istatistiği (bir okuma geçişi, sn): tek çekirdek (cpu) ile çok çekirdek (cok) karşılaştırması için
function hizKaydet(k,sn){try{const h=JSON.parse(localStorage.getItem('zr_hiz')||'{}');delete h.gpu;h[k]=(h[k]||[]).concat(Math.round(sn*10)/10).slice(-20);localStorage.setItem('zr_hiz',JSON.stringify(h))}catch(e){}}
// 3 fiş çok çekirdekle okununca sonucu bir kez test arşivine bildir (hız kazancı gerçekten var mı)
function cekirdekDegerlendir(thr,tur){try{const h=JSON.parse(localStorage.getItem('zr_hiz')||'{}'),c=thr>1?h.cok||[]:h.cpu||[];
  let n=+localStorage.getItem('zr_thrsay')||0;n++;localStorage.setItem('zr_thrsay',n);if(n<3||localStorage.getItem('zr_thrdeg')===String(APP_VER))return;
  localStorage.setItem('zr_thrdeg',String(APP_VER));const ort=a=>a&&a.length?Math.round(a.reduce((x,y)=>x+y,0)/a.length*10)/10:null;
  let sw=null;try{sw=!!(navigator.serviceWorker&&navigator.serviceWorker.controller)}catch(e){}
  cekirdekTeshis({asama:'sonuc',thr,motor:tur,swDenetliyor:sw,tekCekirdekeDonuldu:localStorage.getItem('zr_thr')==='1',cokSn:ort((h.cok||[]).slice(-3)),tekSn:ort(h.cpu)})}catch(e){}}
// Ayarlar'da okuma hızı: kaç çekirdek kullanılıyor, bir okuma geçişi ortalama kaç saniye
function hizUI(){const el=$('#hizdurum');if(!el)return;if(S.mode!=='paddle'){el.hidden=true;return}
  let h={};try{h=JSON.parse(localStorage.getItem('zr_hiz')||'{}')}catch(e){}
  const o=a=>a&&a.length?(a.reduce((x,y)=>x+y,0)/a.length).toFixed(1).replace('.',','):null,t=cekirdek(),c=o(h.cok),k=o(h.cpu);
  el.textContent=`Okuma: ${t>1?t+' çekirdek':'tek çekirdek'}`+(t>1&&c?` · ortalama ${c} sn`:k?` · ortalama ${k} sn`:'')+(t>1&&c&&k?` (tek çekirdekte ${k} sn)`:'');el.hidden=false}
$('#mode').addEventListener('change',hizUI);setTimeout(hizUI,600);
