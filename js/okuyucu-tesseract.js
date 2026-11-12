// Okuyucu 2: Tesseract (telefonda, işçide) — görüntü hazırlama js/goruntu.js
// ---- Ücretsiz okuma: telefonda yazı tanıma (Tesseract) + kural tabanlı ayrıştırıcı ----
let ocrW=null,ocrLoading=null;
let ocrProg=null;
async function getOCR(onProg){
  ocrProg=onProg;   // ilerleme her zaman o an okunan karta yazılsın
  if(ocrW)return ocrW;
  if(!ocrLoading)ocrLoading=(async()=>{
    if(!window.Tesseract)await loadScript('https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js');
    const w=await Tesseract.createWorker('tur',1,{logger:m=>ocrProg&&ocrProg(m)});
    await w.setParameters({tessedit_pageseg_mode:'6',preserve_interword_spaces:'1'});
    ocrW=w;return w;
  })().catch(e=>{ocrLoading=null;throw e});
  return ocrLoading;
}
// Görüntü hazırlama goruntu.js'de (PaddleOCR işçisiyle ortak)
const prepCache=new WeakMap();
async function prepImage(src,opt={}){let C=prepCache.get(src);if(!C){C=ZGoruntu.kaynak(await openImage(src));prepCache.set(src,C)}return ZGoruntu.prep(C,opt)}
async function extractFree(r){
  r.status='work';setProg(r,'Hazırlanıyor…');render();
  try{
    const w=await getOCR(m=>{if(m.status==='recognizing text'&&!/tekrar/.test(r.prog||''))setProg(r,`Okunuyor… %${Math.round(m.progress*100)}`);else if(/load|init/i.test(m.status))setProg(r,'İlk kullanım: Türkçe dil dosyası indiriliyor (bir kez)…')});
    // Toplamlar tutana kadar farklı ayarlarla oku (tutunca durur): normal, kırpılmamış (fiş beyaz zemindeyse kırpma fişi kesebilir), küçük ölçek, renkli leke temizleyen, keskinleştirilmiş (bulanık fotoğraf), büyük ölçek + keskinleştirme, büyük ölçek
    const passes=[{tw:1400,t:.15,win:1/16},{full:1,tw:2000,t:.15,win:1/24},{tw:1100,t:.20,win:1/8},{tw:1400,t:.18,win:1/12,gray:'max'},{tw:1400,t:.15,win:1/16,sharp:2},{tw:1700,t:.12,win:1/16,sharp:1.5},{tw:1700,t:.20,win:1/16}];
    let best=null;const all=[],texts=[];
    for(let n=0;n<passes.length;n++){
      setProg(r,n?`Toplamlar tutmadı, tekrar okunuyor (${n+1}/${passes.length})…`:'Okunuyor…');
      const sm=[];for(const pg of sayfalar(r)){
        const img=await prepImage(pg,passes[n]);
        // takılırsa sonsuza dek "Okunuyor…"da kalmasın: 2 dakikada iptal et, okuyucuyu yeniden başlat
        let tm;const {data}=await Promise.race([w.recognize(img),new Promise((_,rej)=>{tm=setTimeout(()=>{try{w.terminate()}catch(e){}ocrW=null;ocrLoading=null;rej(new Error('Okuma 2 dakikada bitmedi. Tekrar dene; olmazsa fotoğrafı yeniden çek ya da 📋 Metinden ekle’yi kullan.'))},120000)})]);clearTimeout(tm);
        sm.push(data.text||'')}
      const data={text:birlestir(sm)};
      const res=ZParse.parseZ(data.text||''),sc=ZParse.consistency(res);
      all.push(res);texts.push(data.text||'');
      if(!best||sc>best.sc)best={res,sc,text:data.text||''};
      if(sc>=6)break;
      // birleştirilmiş sonuçta şüpheli alan kalmadıysa daha fazla okuma (pil) harcama
      if(all.length>=2){const mm=ZParse.merge(all);if(!mm.unsure.some(k=>k!=='z_no'&&k!=='diger'&&FIELDS.some(f=>f.k===k)))break}
    }
    // toplamları tam tutan bir okuma varsa onu al; yoksa okumaları alan alan birleştir
    const merged=best.sc>=6||all.length<2?best.res:ZParse.merge(all);
    applyParse(r,best.sc>=6||all.length<2?best.text:texts.map((t,i)=>`—— ${i+1}. okuma ——\n`+t).join('\n'),merged);
    r.status='done';r.open=false;r.created=r.created||Date.now();r.sayfa=sayfalar(r).length;delete r.blob;delete r.file;delete r.pages;resimBirak(r);delete r.prog;
    save(r);autoZ();saveImg(r,r._small);delete r._small;
  }catch(e){r.status='error';r.err=(e&&e.message)||'Okunamadı';delete r.prog}
  render();
}
