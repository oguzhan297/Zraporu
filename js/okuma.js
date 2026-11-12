// Okuma akışı: fotoğraf / metin ekleme, sıra, okuyucu seçimi, ayrıştırma sonucu rapora yazma, yeniden çekme
function miniResim(src){const w=src.naturalWidth||src.width,h=src.naturalHeight||src.height;if(!w||!h)return '';const o=120/Math.max(w,h),k=document.createElement('canvas');
  k.width=Math.max(1,Math.round(w*o));k.height=Math.max(1,Math.round(h*o));k.getContext('2d').drawImage(src,0,0,k.width,k.height);const u=k.toDataURL('image/jpeg',.7);k.width=k.height=0;return u}
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
  // listedeki küçük resim: ~120 px (kartlarda büyük fotoğraf göstermek, kaydırırken her birinin tam boy açılmasına yol açıp
  // iPhone'da belleği dolduruyor ve uygulamayı kapatıyordu)
  const mini=miniResim(c2);
  URL.revokeObjectURL(url);c.width=c.height=0;c2.width=c2.height=0;
  return {blob,thumb:URL.createObjectURL(blob),small,mini};
}

function applyParse(r,text,pre){
  r._zAuto=false;r._zManual=false;
  const res=pre||ZParse.parseZ(text);const d=res.d;d.z_no=normZ(d.z_no);
  const keepAck=r.d&&r.d.aciklama&&r.d.aciklama!==r._ack?r.d.aciklama:null;
  d.not=res.notes.join(' · ');d.z_rapor_mu=res.found>=4?undefined:false;
  {const km=ZParse.kumulatif?ZParse.kumulatif(text):{};for(const k of ['kum_sat','kum_kdv','sicil','slip','kart_adet'])if(d[k]==null)d[k]=km[k]??null}   // kümülatif + kasa sicil no
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
    const ps=sayfalar(r),imgs=[];for(let i=0;i<ps.length;i++)imgs.push({type:'image',source:{type:'base64',media_type:'image/jpeg',data:await b64(i?(await shrink(ps[i])).blob:r.blob)}});
    const txt=await callClaude([...imgs,{type:'text',text:PROMPT+(ps.length>1?`\nNot: Fiş uzun olduğu için ${ps.length} fotoğrafta, sırayla. Birleştirerek oku; iki fotoğrafta da görünen satırları bir kez say.`:'')}],4000);const a=txt.indexOf('{'),b=txt.lastIndexOf('}');
    if(a<0||b<a)throw new Error('Yanıt anlaşılamadı');
    const j=JSON.parse(txt.slice(a,b+1));
    const d={};
    for(const f of FIELDS){const v=j[f.k];d[f.k]=f.t==='text'?(v==null?'':String(v).trim()):(f.t==='int'?(pn(v)==null?null:Math.round(pn(v))):pn(v))}
    d.z_rapor_mu=j.z_rapor_mu;d.sicil=j.sicil?String(j.sicil).replace(/\s/g,'').toUpperCase():null;d.slip=Number.isInteger(j.slip)?j.slip:null;d.tarih=normDate(d.tarih);d.z_no=normZ(d.z_no);r.auto=fill(d);d.aciklama=mkAck(d);r._ack=d.aciklama;
    r.d=d;r.unsure=Array.isArray(j.belirsiz)?j.belirsiz.filter(k=>FIELDS.some(f=>f.k===k)):[];r.akt=null;r.oku=okunanAnlik(d);guessZ(r);
    r.status='done';r.open=false;r.created=r.created||Date.now();r.sayfa=sayfalar(r).length;delete r.blob;delete r.file;delete r.pages;resimBirak(r);
    save(r);autoZ();saveImg(r,r._small);delete r._small;
  }catch(e){
    r.status='error';
    r.err=(e&&e.message)||'Bilinmeyen hata';
  }
  render();
}
async function prep(r){   // küçük resmi ve yüklenecek kopyayı sırası gelince hazırla (seçim anında hepsini birden işleyip bekletme)
  if(r.blob||!r.file)return true;
  try{const s=await shrink(r.file);r.blob=s.blob;r.thumb=s.thumb;r._small=s.small;r.mini=s.mini}catch(e){r.status='error';r.err=e.message;render();return false}
  saveOrig(r,r.pages||[r.file]);
  try{r.q=await fotoKalite(r.file);const k=kaliteSorun(r.q);if(k.length){toast('📷 '+KALITE[k[0]].m+' — okuma hatalı olabilir');setProg(r,KALITE[k[0]].m+'; yine de okunuyor…')}}catch(e){r.q=null}
  return true
}
async function pump(){if(busy)return;busy=true;
  // Uzun seride işlemci aralıksız çalışınca telefon ısınıyor (ısınınca da yavaşlıyor): fişler arasında kısa nefes
  while(queue.length){const r=queue.shift();if(!rows.includes(r))continue;if(await prep(r))await extract(r);if(queue.length&&S.mode!=='api')await new Promise(a=>setTimeout(a,1200))}
  busy=false}

async function onFiles(list){
  const files=[...list];if(!files.length)return;
  const noKey=S.mode==='api'&&!S.key;
  if(noKey){notice('Claude API ile okuma için ⚙️ Ayarlar’dan API anahtarını gir ya da yöntemi “Ücretsiz” yap. Şimdilik fotoğraflar eklendi; değerleri elle girebilirsin.');$('#settings').open=true}
  // kartları hemen göster (tek seferde), okuma ilk fotoğraftan başlasın
  const now=Date.now(),add=files.map((file,i)=>({id:uid(),status:'queued',d:{},unsure:[],src:'foto',created:now+i,_local:true,file}));
  rows.unshift(...add.slice().reverse());render();
  kuyrukSakla(add);   // uygulama okurken kapanırsa (bellek, arka plan) fotoğraflar kaybolmasın: açılışta kaldığı yerden okunur
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
  r.file=file;r.pages=null;delete r.blob;r.thumb=null;r.q=null;r.status='queued';r.src='foto';r.open=false;r.prog='Yeni fotoğraf sırada';
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
  if(add.length){rows.forEach(x=>x.open=false);rows.unshift(...add.slice().reverse());for(const r of add)save(r);autoZ();render()}
  pm.hidden=true;
  toast(add.length?`${add.length} rapor eklendi${dup?`, ${dup} tanesi zaten listedeydi`:''} — kontrol et`:(dup?'Bu raporlar zaten listede':'Metinde rapor bulunamadı'))}

// ---- Uzun fiş: devam fotoğrafı ----
// Okunacak sayfalar (fotoğraflar): devam eklendiyse birden fazla
const sayfalar=r=>r.pages&&r.pages.length?r.pages:[r.file||r.blob];
// Sayfa metinlerini birleştir: iki fotoğrafın üst üste binen satırları bir kez sayılsın (aynı departman iki kez toplanmasın)
function birlestir(metinler){
  const nz=l=>l.toLocaleUpperCase('tr-TR').replace(/[^0-9A-ZÇĞİÖŞÜ%]/g,'');
  let A=metinler[0].split('\n');
  for(const m of metinler.slice(1)){const B=m.split('\n'),na=A.map(nz),nb=B.map(nz);let kes=0;
    for(let j=Math.max(0,A.length-60);j<A.length;j++){const n=A.length-j;if(n>B.length)continue;let es=0,dolu=0;
      for(let i=0;i<n;i++){if(na[j+i].length<3)continue;dolu++;if(na[j+i]===nb[i])es++}
      if(dolu>=2&&es>=Math.max(2,dolu*.6)){kes=n;break}}
    A=A.concat(B.slice(kes))}
  return A.join('\n');
}
let devId=null;
async function devamEkle(file){const r=rows.find(x=>x.id===devId);devId=null;if(!r||!file)return;
  if(r.status==='work'||r.status==='queued'){toast('Bu rapor zaten okunuyor');return}
  let onceki=null;try{onceki=r.hasOrig?await IDB.get('orig',r.id):null}catch(e){}
  if(!onceki||!onceki.length){const k=r.thumb||await IDB.get('imgs',r.id).catch(()=>null);if(!k){toast('İlk fotoğraf bulunamadı; fişi baştan iki fotoğrafla eklemeyi dene');return}
    onceki=[await (await fetch(k)).blob()];toast('İlk fotoğrafın aslı saklanmamış; küçük kopyası kullanılıyor')}
  r.pages=[...onceki,file];r.file=r.pages[0];delete r.blob;r.status='queued';r.open=false;r.prog=`${r.pages.length} fotoğraf birlikte okunacak`;
  queue.push(r);render();pump()}
$('#devam').addEventListener('change',e=>{devamEkle(e.target.files[0]);e.target.value=''});

// ---- Arka arkaya tarama: uygulama içi kamera (açık kalır; her kare kalite kontrolünden geçip sıraya girer) ----
// mod 'tek': "Fotoğraf çek" — net bir kare alınınca kapanır. mod 'seri': "Arka arkaya tara" — "Bitti"ye kadar açık kalır.
// Uygulama içi kamera yoksa ya da izin verilmediyse telefonun kendi kamerası (#cam) açılır.
const KAM={akis:null,sayi:0,isik:false,mod:'seri',yerel:false};
const yerelKamera=()=>{const i=$('#cam');i.value='';i.click()};
async function kameraAc(mod='seri'){
  KAM.mod=mod;
  if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia||(KAM.yerel&&mod==='tek')){if(mod==='tek')return yerelKamera();toast('Bu tarayıcıda uygulama içi kamera yok; Fotoğraf çek’i kullan');return}
  try{KAM.akis=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:'environment'},width:{ideal:3840},height:{ideal:2160}}})}
  catch(e){KAM.yerel=true;toast(e&&e.name==='NotAllowedError'?'Kamera izni verilmedi. Telefonun kamerası için tekrar dokun (izin: Ayarlar › Safari › Kamera)':'Kamera açılamadı. Telefonun kamerası için tekrar dokun');return}
  const tek=mod==='tek';$('#ksay').hidden=tek;$('#kbitti').textContent=tek?'Vazgeç':'Bitti';
  $('#kipucu').textContent=tek?'Fişi çerçeveye sığdır, net görününce çek · en yüksek kalite için: Telefon kamerası':'Fişi çerçeveye sığdır · uzunsa üst kısmı çek, sonra kartından devamını ekle';
  const v=$('#kvid');v.srcObject=KAM.akis;KAM.sayi=0;$('#ksay').textContent='0 fiş';$('#kson').removeAttribute('src');kMesaj('');
  $('#kamera').hidden=false;document.body.classList.add('kamera-acik');
  try{await v.play()}catch(e){}
  const tr=KAM.akis.getVideoTracks()[0],cap=tr.getCapabilities?tr.getCapabilities():{};
  $('#kisik').hidden=!(cap.torch||'torch' in cap||/iP(hone|ad)/.test(navigator.userAgent));   // iOS desteği bazen yanlış bildirirKAM.isik=false;
  // sürekli netleme destekleniyorsa aç
  try{if(cap.focusMode&&cap.focusMode.includes('continuous'))await tr.applyConstraints({advanced:[{focusMode:'continuous'}]})}catch(e){}
}
function kameraKapat(){if(KAM.akis)KAM.akis.getTracks().forEach(t=>t.stop());KAM.akis=null;$('#kvid').srcObject=null;$('#kamera').hidden=true;document.body.classList.remove('kamera-acik');
  if(KAM.sayi)toast(KAM.mod==='tek'?'Fotoğraf eklendi, okunuyor':`${KAM.sayi} fiş eklendi; okumalar sırayla sürüyor`)}
function kMesaj(m,tur){const el=$('#kmesaj');el.textContent=m;el.className='k-mesaj'+(tur?' '+tur:'');clearTimeout(el._t);if(m)el._t=setTimeout(()=>{el.textContent='';el.className='k-mesaj'},2600)}
// Kare: yalnız ekrandaki çerçevenin içi alınır (yandaki / alttaki fiş, masa okunmasın), kenarlarda %6 pay kalır.
// Ekranda görünen video (object-fit: cover) koordinatları video pikseline çevrilir.
async function kareAl(){
  const v=$('#kvid'),vw=v.videoWidth,vh=v.videoHeight;if(!vw)return null;
  const V=v.getBoundingClientRect(),F=document.querySelector('#kamera .k-cerceve').getBoundingClientRect(),k=Math.max(V.width/vw,V.height/vh),ox=V.left+(V.width-vw*k)/2,oy=V.top+(V.height-vh*k)/2;
  const px=F.width*.06/k,py=F.height*.06/k;
  let x0=Math.max(0,(F.left-ox)/k-px),y0=Math.max(0,(F.top-oy)/k-py),x1=Math.min(vw,(F.right-ox)/k+px),y1=Math.min(vh,(F.bottom-oy)/k+py);
  if(!(x1-x0>50&&y1-y0>50)){x0=0;y0=0;x1=vw;y1=vh}
  const c=document.createElement('canvas');c.width=Math.round(x1-x0);c.height=Math.round(y1-y0);c.getContext('2d').drawImage(v,x0,y0,x1-x0,y1-y0,0,0,c.width,c.height);
  // keskinlik eşikleri tam karenin 1000 px kopyasına göre ayarlı: ölçüm için tam kareyi de küçültüp sakla
  const o=Math.min(1,1000/Math.max(vw,vh)),t=document.createElement('canvas');t.width=Math.round(vw*o);t.height=Math.round(vh*o);t.getContext('2d').drawImage(v,0,0,t.width,t.height);
  KAM.tam=await new Promise(r=>t.toBlob(r,'image/jpeg',.92));t.width=t.height=1;
  KAM.boy=Math.max(c.width,c.height);KAM.kisa=Math.min(c.width,c.height);KAM.tamKisa=Math.min(vw,vh);const b=await new Promise(r=>c.toBlob(r,'image/jpeg',.92));c.width=c.height=1;return b;
}
// Son çekilen karenin küçük önizlemesi (videodan, ~120 px) — 4K fotoğrafın kendisi bu küçük kutuda gösterilince
// iPhone dokunulduğunda tam boy açmaya çalışıp uygulamayı kapatıyordu.
function kucukKare(){const v=$('#kvid');if(!v.videoWidth)return '';const o=120/Math.max(v.videoWidth,v.videoHeight),c=document.createElement('canvas');
  c.width=Math.round(v.videoWidth*o);c.height=Math.round(v.videoHeight*o);c.getContext('2d').drawImage(v,0,0,c.width,c.height);return c.toDataURL('image/jpeg',.7)}
$('#kson').onclick=e=>{e.preventDefault();e.stopPropagation();if(KAM.sayi)kameraKapat()};   // önizlemeye dokun: kamerayı kapat, listeye dön (telefon kamerasındaki gibi)
$('#seri').onclick=()=>kameraAc('seri');
$('#tekcek').onclick=()=>kameraAc('tek');
$('#kyerel').onclick=()=>{KAM.sayi=0;kameraKapat();yerelKamera()};   // en yüksek çözünürlük: telefonun kendi kamerası
$('#kbitti').onclick=kameraKapat;
$('#kisik').onclick=async()=>{const tr=KAM.akis&&KAM.akis.getVideoTracks()[0];if(!tr)return;KAM.isik=!KAM.isik;try{await tr.applyConstraints({advanced:[{torch:KAM.isik}]})}catch(e){KAM.isik=false;$('#kisik').hidden=true;kMesaj('Bu cihazda fener açılamıyor','kotu')}$('#kisik').classList.toggle('on',KAM.isik)};
$('#kdek').onclick=async()=>{
  const d=$('#kdek');if(d.disabled)return;d.disabled=true;
  try{
    const f=$('#kflas');f.classList.remove('on');void f.offsetWidth;f.classList.add('on');navigator.vibrate&&navigator.vibrate(25);
    const b=await kareAl();if(!b){kMesaj('Çekilemedi, tekrar dene','kotu');return}
    const file=new File([b],`seri_${Date.now()}.jpg`,{type:'image/jpeg'});
    // anında kalite kontrolü: bulanık / düşük çözünürlüklü kare sıraya girmez, yeniden çekilir
    let q=null;try{q=await fotoKalite(KAM.tam||file);if(KAM.tam)q.min=KAM.tamKisa}catch(e){}
    const k=kaliteSorun(q);if(q&&KAM.tam)q.min=KAM.kisa;   // bulanıklık tam kareye göre; boyut kırpılmış kareye göre (aşağıda)
    if(k.includes('bulanik')){kMesaj('Bulanık — sabit tut, tekrar çek','kotu');return}
    // kare çerçeveden kırpıldığı için kısa kenar küçük olabilir: yalnız gerçekten küçükse reddet
    if(k.includes('kucuk')&&(KAM.boy||0)<700){kMesaj('Görüntü çok küçük — fişe yaklaş','kotu');return}
    KAM.sayi++;$('#ksay').textContent=`${KAM.sayi} fiş`;$('#kson').src=kucukKare()||$('#kson').src;   // tam boy fotoğraf değil: iPhone'da bellek doluyordu
    onFiles([file]);
    if(KAM.mod==='tek'){kameraKapat();return}
    kMesaj('✓ Eklendi, sıradaki fiş','iyi');
  }finally{d.disabled=false}
};
// Kamera açıkken ekran kilitlenir / uygulama arka plana geçerse görüntü akışı durur (iPhone'da siyah ekran kalıyordu): kamerayı kapat
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'&&KAM.akis)kameraKapat()});
