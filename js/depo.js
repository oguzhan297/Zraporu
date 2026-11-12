// Kalıcı saklama: raporlar ve fotoğraflar bu telefonda (IndexedDB); yedek indir / yükle
// ---- Kalıcı saklama: bu telefonda (IndexedDB) ----
const IDB=(()=>{let p;
  const open=()=>p||(p=new Promise((res,rej)=>{const q=indexedDB.open('zrapor',2);q.onupgradeneeded=()=>{const d=q.result;if(!d.objectStoreNames.contains('rows'))d.createObjectStore('rows',{keyPath:'id'});if(!d.objectStoreNames.contains('imgs'))d.createObjectStore('imgs');if(!d.objectStoreNames.contains('orig'))d.createObjectStore('orig')};q.onsuccess=()=>res(q.result);q.onerror=()=>rej(q.error)}));
  const req=r=>new Promise((res,rej)=>{r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});
  const w=(st,fn)=>open().then(d=>new Promise((res,rej)=>{const t=d.transaction(st,'readwrite');fn(t.objectStore(st));t.oncomplete=()=>res();t.onerror=()=>rej(t.error);t.onabort=()=>rej(t.error)}));
  return {put:(st,v,k)=>w(st,s=>k===undefined?s.put(v):s.put(v,k)),del:(st,k)=>w(st,s=>s.delete(k)),
    all:st=>open().then(d=>req(d.transaction(st).objectStore(st).getAll())),get:(st,k)=>open().then(d=>req(d.transaction(st).objectStore(st).get(k)))};
})();
const ser=r=>({ocr:r.ocr??null,d:r.d||{},unsure:r.unsure||[],auto:r.auto||[],src:r.src||'',_ack:r._ack||'',hasImg:!!r.hasImg,created:r.created||Date.now(),_zAuto:!!r._zAuto,_zManual:!!r._zManual,_zRead:r._zRead||'',q:r.q||null,akt:r.akt||null,oku:r.oku||null,hasOrig:!!r.hasOrig,sayfa:r.sayfa||1,bildirildi:r.bildirildi||null,hesap:r.hesap||null,kontrol:r.kontrol||null,mini:r.mini||null});
function setStore(st){const el=$('#sync');if(!el)return;el.innerHTML=(st==='ok'?ik('telefon'):'')+({ok:'Bu telefonda kayıtlı',err:'⚠ Kaydedilemedi — CSV’yi indirmeden kapatma',wait:'Yükleniyor…'}[st]||'');el.className='sync s-'+st}
function save(r){if(!r||r.status!=='done')return;IDB.put('rows',{id:r.id,...ser(r)}).then(()=>setStore('ok')).catch(()=>{setStore('err');toast('Kaydedilemedi: telefon hafızası dolu olabilir.')})}
async function removeRows(list){
  const ids=new Set(list.map(x=>x.id));rows=rows.filter(x=>!ids.has(x.id));autoZ();render();
  try{for(const r of list){await IDB.del('rows',r.id);await IDB.del('imgs',r.id);await IDB.del('orig',r.id)}}catch(e){toast('Silinemedi, tekrar dene.')}
}
// Fotoğraf asılları (devam fotoğrafı ve hata bildirimi için): son ORIG_N raporunkiler saklanır, eskiler silinir
const ORIG_N=40;
async function saveOrig(r,pages){try{await IDB.put('orig',pages,r.id);r.hasOrig=true;
  const eski=rows.filter(x=>x.hasOrig).sort((a,b)=>(b.created||0)-(a.created||0)).slice(ORIG_N);
  for(const x of eski){await IDB.del('orig',x.id);x.hasOrig=false;save(x)}}catch(e){}}
async function saveImg(r,src){if(!src)return;try{await IDB.put('imgs',src,r.id);r.hasImg=true;save(r)}catch(e){}}
// Okunmayı bekleyen fotoğraflar: kartı ve fotoğrafın aslı hemen kaydedilir; okuma bitince normal kayıt bunun üstüne yazılır
async function kuyrukSakla(list){for(const r of list){try{const pages=r.pages||[r.file];await IDB.put('orig',pages,r.id);r.hasOrig=true;
  if(r.status!=='done')await IDB.put('rows',{id:r.id,...ser(r),bekliyor:1})}catch(e){}}}
// Okuma bitince büyük fotoğrafı bellekten bırak (kart açılınca kayıtlı kopyası yüklenir)
function resimBirak(r){if(r.thumb&&String(r.thumb).startsWith('blob:')){const u=r.thumb;setTimeout(()=>URL.revokeObjectURL(u),2000)}if(!r.open||r.hasImg||r._small)r.thumb=r.open?r.thumb:null}
async function loadImg(r){
  if(r.thumb||!r.hasImg||r._imgLoading)return;r._imgLoading=true;
  try{const src=await IDB.get('imgs',r.id);if(src){r.thumb=src;
      if(!r.mini){try{const im=await new Promise((a,h)=>{const i=new Image();i.onload=()=>a(i);i.onerror=h;i.src=src});r.mini=miniResim(im);save(r)}catch(e){}}
      if(r.open)render()}}catch(e){}
  r._imgLoading=false;
}
const sortRows=()=>rows.sort((a,b)=>((a.status==='done')-(b.status==='done'))||((b.created||0)-(a.created||0)));
async function load(){
  // yükleme sürerken eklenen fotoğraflar / raporlar kaybolmasın: bellektekileri koru
  try{const all=await IDB.all('rows'),ids=new Set(all.map(r=>r.id)),simdi=rows.filter(r=>!ids.has(r.id));
    const bek=all.filter(r=>r.bekliyor),tam=all.filter(r=>!r.bekliyor);
    rows=[...simdi,...tam.map(r=>({...r,status:'done',auto:r.auto||[],open:false}))];
    // önceki açılışta okunamadan kalan fotoğraflar (uygulama okurken kapandı): yeniden sıraya
    for(const b of bek){let o=null;try{o=await IDB.get('orig',b.id)}catch(e){}
      if(o&&o.length){const r={...b,status:'queued',d:b.d||{},unsure:[],auto:[],open:false,file:o[0],pages:o.length>1?o:null,hasOrig:true,prog:'Önceki açılıştan kaldı, yeniden okunacak'};delete r.bekliyor;rows.push(r);queue.push(r)}
      else IDB.del('rows',b.id).catch(()=>{})}
    if(bek.length)setTimeout(()=>{toast(`${queue.length} fotoğraf yarıda kalmıştı; okuma kaldığı yerden sürüyor`);pump()},300);
    for(const r of rows)if(r.d&&r.d.slip===undefined&&r.ocr&&window.ZParse&&ZParse.kumulatif){Object.assign(r.d,ZParse.kumulatif(r.ocr));if(r.oku){r.oku.kum_sat=r.d.kum_sat;r.oku.kum_kdv=r.d.kum_kdv}save(r)}   // v64 öncesi kayıtlar
    for(const r of rows){const d=r.d||(r.d={});let ch=false;
      const z=normZ(d.z_no);if(d.z_no!=null&&z!==d.z_no){d.z_no=z;ch=true}
      if(!d.aciklama||d.aciklama===r._ack||/^Z RAPORU\s*\d*$/.test(d.aciklama)){const a=mkAck(d);if(a!==d.aciklama){d.aciklama=a;ch=true}r._ack=a}
      if(ch)save(r)}
    setStore('ok');autoZ()}
  catch(e){setStore('err');notice('Bu tarayıcı veri saklamaya izin vermiyor (gizli sekme olabilir). Raporlar kaydedilmez; CSV’yi indirmeyi unutma.')}
  sortRows();render();window.yuklendi=true;   // testler kayıtlar yüklenene kadar bekler
}

// ---- Yedek ----
$('#bk').onclick=async()=>{
  const out=[];for(const r of rows.filter(x=>x.status==='done')){let img=null;if(r.hasImg){try{img=await IDB.get('imgs',r.id)}catch(e){}}out.push({id:r.id,...ser(r),img})}
  const d=new Date();offer(`Z_Rapor_Yedek_${d.toISOString().slice(0,10)}.json`,JSON.stringify({app:'zrapor',v:1,rows:out}));
};
$('#bkin').addEventListener('change',async e=>{
  const f=e.target.files[0];e.target.value='';if(!f)return;
  try{const j=JSON.parse(await f.text());if(!j||j.app!=='zrapor'||!Array.isArray(j.rows))throw 0;
    let n=0;for(const x of j.rows){if(!x||!x.id||!x.d)continue;if(rows.some(r=>r.id===x.id))continue;
      const r={id:String(x.id),status:'done',open:false,d:x.d,unsure:x.unsure||[],auto:x.auto||[],src:x.src||'',_ack:x._ack||'',created:x.created||Date.now(),hasImg:false};
      rows.push(r);save(r);if(x.img)await saveImg(r,x.img);n++}
    sortRows();render();toast(n?`${n} rapor yedekten yüklendi`:'Yedekteki raporlar zaten listede');
  }catch(err){toast('Bu dosya geçerli bir yedek değil.')}
});
