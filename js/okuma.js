// Okuma akışı: fotoğraf / metin ekleme, sıra, okuyucu seçimi, ayrıştırma sonucu rapora yazma, yeniden çekme
async function shrink(file){
  const url=URL.createObjectURL(file);
  const img=await new Promise((res,rej)=>{const im=new Image();im.onload=()=>res(im);im.onerror=()=>rej(new Error('Görüntü açılamadı'));im.src=url});
  const max=1568,sc=Math.min(1,max/Math.max(img.naturalWidth,img.naturalHeight));
  const c=document.createElement('canvas');c.width=Math.round(img.naturalWidth*sc);c.height=Math.round(img.naturalHeight*sc);
  c.getContext('2d').drawImage(img,0,0,c.width,c.height);
  const blob=await new Promise(r=>c.toBlob(r,'image/jpeg',0.86));
  const s2=Math.min(1,1100/Math.max(c.width,c.height)),c2=document.createElement('canvas');
  c2.width=Math.round(c.width*s2);c2.height=Math.round(c.height*s2);c2.getContext('2d').drawImage(c,0,0,c2.width,c2.height);
  let small='';for(const q of [0.6,0.45,0.32]){small=c2.toDataURL('image/jpeg',q);if(small.length<190000)break;small=''}
  return {blob,thumb:URL.createObjectURL(blob),small};
}

function applyParse(r,text,pre){
  r._zAuto=false;r._zManual=false;
  const res=pre||ZParse.parseZ(text);const d=res.d;d.z_no=normZ(d.z_no);
  const keepAck=r.d&&r.d.aciklama&&r.d.aciklama!==r._ack?r.d.aciklama:null;
  d.not=res.notes.join(' · ');d.z_rapor_mu=res.found>=4?undefined:false;
  r.ocr=text;r.auto=fill(d);
  d.aciklama=keepAck||mkAck(d);if(!keepAck)r._ack=d.aciklama;
  r.d=d;r.unsure=res.unsure.filter(k=>FIELDS.some(f=>f.k===k));
  r.akt=null;r.oku=okunanAnlik(d);   // yeni okuma: henüz aktarılmadı; okunan değerler hata bildirimi için saklanır
  guessZ(r);
}
// Okuyucunun bulduğu değerler (kullanıcı düzeltmeden önce): Luca alanları + fişteki genel toplam
const okunanAnlik=d=>Object.fromEntries(FIELDS.filter(f=>f.k!=='aciklama'&&f.k!=='not').map(f=>[f.k,d[f.k]??null]));
async function extract(r){
  if(S.mode==='free')return extractFree(r);
  if(S.mode==='paddle')return extractPaddle(r);
  r.status='work';render();
  try{
    const txt=await callClaude([{type:'image',source:{type:'base64',media_type:'image/jpeg',data:await b64(r.blob)}},{type:'text',text:PROMPT}],4000);const a=txt.indexOf('{'),b=txt.lastIndexOf('}');
    if(a<0||b<a)throw new Error('Yanıt anlaşılamadı');
    const j=JSON.parse(txt.slice(a,b+1));
    const d={};
    for(const f of FIELDS){const v=j[f.k];d[f.k]=f.t==='text'?(v==null?'':String(v).trim()):(f.t==='int'?(pn(v)==null?null:Math.round(pn(v))):pn(v))}
    d.z_rapor_mu=j.z_rapor_mu;d.tarih=normDate(d.tarih);d.z_no=normZ(d.z_no);r.auto=fill(d);d.aciklama=mkAck(d);r._ack=d.aciklama;
    r.d=d;r.unsure=Array.isArray(j.belirsiz)?j.belirsiz.filter(k=>FIELDS.some(f=>f.k===k)):[];r.akt=null;r.oku=okunanAnlik(d);guessZ(r);
    r.status='done';r.open=true;r.created=r.created||Date.now();delete r.blob;delete r.file;
    save(r);autoZ();saveImg(r,r._small);delete r._small;
  }catch(e){
    r.status='error';
    r.err=(e&&e.message)||'Bilinmeyen hata';
  }
  render();
}
async function prep(r){   // küçük resmi ve yüklenecek kopyayı sırası gelince hazırla (seçim anında hepsini birden işleyip bekletme)
  if(r.blob||!r.file)return true;
  try{const s=await shrink(r.file);r.blob=s.blob;r.thumb=s.thumb;r._small=s.small}catch(e){r.status='error';r.err=e.message;render();return false}
  try{r.q=await fotoKalite(r.file);const k=kaliteSorun(r.q);if(k.length){toast('📷 '+KALITE[k[0]].m+' — okuma hatalı olabilir');setProg(r,KALITE[k[0]].m+'; yine de okunuyor…')}}catch(e){r.q=null}
  return true
}
async function pump(){if(busy)return;busy=true;
  while(queue.length){const r=queue.shift();if(!rows.includes(r))continue;if(await prep(r))await extract(r)}
  busy=false}

async function onFiles(list){
  const files=[...list];if(!files.length)return;
  const noKey=S.mode==='api'&&!S.key;
  if(noKey){notice('Claude API ile okuma için ⚙️ Ayarlar’dan API anahtarını gir ya da yöntemi “Ücretsiz” yap. Şimdilik fotoğraflar eklendi; değerleri elle girebilirsin.');$('#settings').open=true}
  // kartları hemen göster (tek seferde), okuma ilk fotoğraftan başlasın
  const now=Date.now(),add=files.map((file,i)=>({id:uid(),status:'queued',d:{},unsure:[],src:'foto',created:now+i,_local:true,file}));
  rows.unshift(...add.slice().reverse());render();
  for(const r of add){
    if(noKey){if(await prep(r)){r.status='done';r.d={aciklama:mkAck({})};r._ack=r.d.aciklama;r.open=true;save(r);saveImg(r,r._small);delete r._small}continue}
    queue.push(r);
  }
  render();pump();
}
$('#cam').addEventListener('change',e=>{onFiles(e.target.files);e.target.value=''});
// Yeniden çek: kartın fotoğrafını değiştirip yeniden oku (elle yapılan düzeltmeler yeni okumayla değişir)
let reId=null;
function replacePhoto(file){const r=rows.find(x=>x.id===reId);reId=null;if(!r||!file)return;
  if(r.status==='work'||r.status==='queued'){toast('Bu rapor zaten okunuyor');return}
  r.file=file;delete r.blob;r.thumb=null;r.q=null;r.status='queued';r.src='foto';r.open=false;r.prog='Yeni fotoğraf sırada';
  queue.push(r);render();pump()}
$('#recam').addEventListener('change',e=>{replacePhoto(e.target.files[0]);e.target.value=''});
$('#regal').addEventListener('change',e=>{replacePhoto(e.target.files[0]);e.target.value=''});
$('#gal').addEventListener('change',e=>{onFiles(e.target.files);e.target.value=''});
// Bilgisayarda: fotoğrafları pencereye sürükleyip bırak
document.addEventListener('dragover',e=>{if(e.dataTransfer&&[...e.dataTransfer.types].includes('Files')){e.preventDefault();document.body.classList.add('dropping')}});
document.addEventListener('dragleave',e=>{if(!e.relatedTarget)document.body.classList.remove('dropping')});
document.addEventListener('drop',e=>{document.body.classList.remove('dropping');const fs=[...(e.dataTransfer&&e.dataTransfer.files||[])].filter(f=>/^image\//.test(f.type));if(fs.length){e.preventDefault();onFiles(fs)}else if(e.dataTransfer&&e.dataTransfer.files.length){e.preventDefault();toast('Sadece fotoğraf bırakabilirsin')}});
$('#manual').onclick=()=>{const d={};d.aciklama=mkAck(d);rows.forEach(x=>x.open=false);const nr={id:uid(),status:'done',d,unsure:[],auto:[],open:true,_ack:d.aciklama,created:Date.now(),_local:true};rows.unshift(nr);save(nr);render();window.scrollTo({top:document.getElementById('list').offsetTop-10,behavior:'smooth'})};
$('#clear').onclick=e=>{const b=e.currentTarget;if(!rows.length)return;if(b.dataset.armed!=='1'){b.dataset.armed='1';b.textContent='Emin misin? Tekrar dokun';setTimeout(()=>{b.dataset.armed='';b.textContent='Tümünü sil'},3000);return}b.dataset.armed='';b.textContent='Tümünü sil';queue=[];removeRows(rows.slice())};

function splitBulk(t){const parts=t.split(/#\s?ZR\s?#/i).map(x=>x.trim()).filter(x=>x.length>=20);return parts.length?parts:[t.trim()]}
function sameReport(a,b){const n=v=>v==null?null:Math.round(+v*100);
  return a.tarih&&a.tarih===b.tarih&&n(a.genel)!=null&&n(a.genel)===n(b.genel)&&(!a.z_no||!b.z_no||String(+a.z_no)===String(+b.z_no))}
function addTexts(t){const parts=splitBulk(t),add=[];let dup=0;
  for(const p of parts){const r={id:uid(),status:'done',d:{},unsure:[],auto:[],src:'metin',created:Date.now(),open:false};applyParse(r,p);
    if(rows.concat(add).some(x=>x.status==='done'&&sameReport(x.d,r.d))){dup++;continue}add.push(r)}
  if(add.length){rows.forEach(x=>x.open=false);if(add.length===1)add[0].open=true;rows.unshift(...add.slice().reverse());for(const r of add)save(r);autoZ();render()}
  pm.hidden=true;
  toast(add.length?`${add.length} rapor eklendi${dup?`, ${dup} tanesi zaten listedeydi`:''} — kontrol et`:(dup?'Bu raporlar zaten listede':'Metinde rapor bulunamadı'))}
