// Arayüz: rapor kartları, kontrol ekranı, alt özet çubuğu; kart üzerindeki tıklama ve düzenlemeler; metin yapıştırma penceresi
// ---- Arama ve süzgeç (yalnız listeyi süzer; Luca dosyası etkilenmez) ----
const FLT={q:'',f:'tum'};
const SUZ={tum:r=>true,kontrol:r=>isBad(r),yeni:r=>!r.akt,akt:r=>!!r.akt};
function araUyar(r,q){if(!q)return true;const d=r.d,t=[d.tarih,d.z_no,'z'+d.z_no,d.aciklama,fm(satis(d)),fm(d.kart),fm(d.nakit),fm(kdvT(d)),d.not].join(' ').toLocaleLowerCase('tr-TR');
  return q.toLocaleLowerCase('tr-TR').split(/\s+/).filter(Boolean).every(w=>t.includes(w)||t.replace(/\./g,'').includes(w.replace(/\./g,'')))}
const gorunur=r=>r.status!=='done'||(SUZ[FLT.f](r)&&araUyar(r,FLT.q));
function filtreUI(){const done=rows.filter(r=>r.status==='done'),el=$('#filtre');if(!el)return;el.hidden=done.length<3;
  for(const b of el.querySelectorAll('[data-f]')){const k=b.dataset.f;b.classList.toggle('on',FLT.f===k);b.querySelector('b').textContent=done.filter(SUZ[k]).length}}
const aktTarih=(t,uzun)=>{const d=new Date(t);return uzun?d.toLocaleDateString('tr-TR'):`${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}`};
// Okuma hatası bildirimi: okunan ↔ şimdiki farkı
function duzeltilen(r){if(!r.oku)return [];const n=v=>v==null||v===''?null:typeof v==='number'?Math.round(v*100):String(v).trim();
  return Object.keys(r.oku).filter(k=>n(r.oku[k])!==n(r.d[k])&&!(r.auto||[]).includes(k))}
function duzeltmeHTML(r){const k=duzeltilen(r);if(!k.length)return '';const ad=x=>(FIELDS.find(f=>f.k===x)||{}).l||x;
  return `<div class="duz">${ik('kalem')}Düzelttiğin alanlar: <b>${k.map(x=>esc(ad(x))).join(', ')}</b><div class="hint">Okuyucu bunları yanlış okumuş. Bildirirsen bu fiş test arşivine eklenir ve aynı hata bir daha tekrarlanmaz.</div><button class="btn small" data-bildirac="${r.id}">${ik('paylas')}Okuma hatasını bildir</button></div>`}
// Her kartta: "Hata bildir" → kısa not kutusu → gönder (düzeltme yapılmasa da)
function bildirKutuHTML(r){return `<div class="bildirkutu" id="bk-${r.id}" hidden><label>Ne yanlış okundu? (isteğe bağlı)</label><textarea rows="2" id="bn-${r.id}" placeholder="Örn. kredi kartı 1.250,00 olmalı"></textarea>
  <div class="hint">${S.ghKey?'Fiş, fotoğrafıyla birlikte doğrudan gizli test gelen kutusuna gönderilir.':'Bildirim dosyası oluşturulur; sohbete gönder. (Ayarlar’a gelen kutusu anahtarı girersen doğrudan gönderilir.)'}</div>
  <div class="set-row" style="justify-content:flex-end"><button class="btn small" data-bildirac="${r.id}">Vazgeç</button><button class="btn small primary" data-bildir="${r.id}">${ik('paylas')}Gönder</button></div></div>`}
// Gönderim süresinin çoğu fotoğrafın boyutundan: 1,5 MB'tan büyük asıl fotoğraf aynı çözünürlükte %88 kaliteyle yeniden kaydedilir
// (okuma testleri için çözünürlük korunur; telefon kamerasının 4–6 MB'lık dosyası ~1 MB'a iner)
async function bildirFoto(b,u){if(!b||b.size<1.5e6)return u;try{const bm=await createImageBitmap(b,{imageOrientation:'from-image'});
  const c=document.createElement('canvas');c.width=bm.width;c.height=bm.height;c.getContext('2d').drawImage(bm,0,0);bm.close&&bm.close();
  const y=c.toDataURL('image/jpeg',.88);c.width=c.height=1;return y.length<u.length?y:u}catch(e){return u}}
async function hataBildir(r,not='',dugme){
  const k=duzeltilen(r);let foto=null,asil=[];try{foto=r.thumb&&r.thumb.startsWith('data:')?r.thumb:await IDB.get('imgs',r.id)}catch(e){}
  // fotoğrafın aslı saklıysa onu da ekle (test arşivi için en değerlisi)
  try{const o=r.hasOrig?await IDB.get('orig',r.id):null;for(const b of o||[])asil.push(await new Promise((a,h)=>{const f=new FileReader();f.onload=()=>a(f.result);f.onerror=h;f.readAsDataURL(b)}).then(u=>bildirFoto(b,u)))}catch(e){}
  const paket={tur:'zrapor-okuma-hatasi',surum:APP_VER,okuyucu:S.mode,olusturma:new Date().toISOString(),tarih:r.d.tarih,z_no:r.d.z_no,not:not||'',
    duzeltilen:Object.fromEntries(k.map(x=>[x,{okunan:r.oku&&r.oku[x],dogru:r.d[x]}])),dogru_degerler:okunanAnlik(r.d),okunan_degerler:r.oku||null,
    okunan_metin:r.ocr||'',kalite:r.q||null,foto_asil:asil,foto_kucuk:asil.length?null:foto||null};
  const ad=`${(r.d.tarih||'tarihsiz').replace(/\./g,'-')}_Z${r.d.z_no||'-'}`;
  if(S.ghKey){
    // Doğrudan gelen kutusuna: bildirim.json (fotoğrafsız) + fotoğraflar ayrı jpg
    const klasor=`${new Date().toISOString().replace(/[:.]/g,'-').slice(0,19)}_${ad}_${Math.random().toString(36).slice(2,6)}`;
    const fotolar=(asil.length?asil:foto&&foto.startsWith('data:')?[foto]:[]).map((u,i)=>({ad:`foto-${i+1}${asil.length?'':'-kucuk'}.jpg`,b64:u.slice(u.indexOf(',')+1)}));
    const govde={...paket,foto_asil:undefined,foto_kucuk:undefined,fotolar:fotolar.map(f=>f.ad)};
    const eski=dugme&&dugme.innerHTML;if(dugme){dugme.disabled=true;dugme.textContent='Gönderiliyor…'}toast('Gönderiliyor… uygulamayı kullanmaya devam edebilirsin');
    try{await ghGonder(klasor,[{ad:'bildirim.json',b64:b64Metin(JSON.stringify(govde,null,1))},...fotolar]);
      r.bildirildi=Date.now();save(r);toast('✓ Bildirim gönderildi, teşekkürler');return true}
    catch(e){toast('Gönderilemedi ('+(e.message==='Failed to fetch'?'bağlantı yok':e.message)+'); dosya olarak paylaşılıyor')}
    finally{if(dugme){dugme.disabled=false;dugme.innerHTML=eski}}
  }
  const ok=await offer(`okuma-hatasi_${ad}.json`,JSON.stringify(paket,null,1));
  if(ok){r.bildirildi=Date.now();save(r);toast(asil.length?'Dosyada fişin fotoğrafı da var; sohbete göndermen yeterli':'Dosyayı fişin asıl fotoğrafıyla birlikte gönder')}
  return ok;
}

function render(){const v=ckToplu(render0);if(window.kbDenetle)kbDenetle();return v}
function render0(){
  const L=$('#list');filtreUI();
  const goster=rows.filter(gorunur);
  if(!rows.length){L.innerHTML='<div class="empty-state">Henüz Z raporu yok.<br>Yukarıdan fotoğraf çekerek başla.</div>'}
  else if(!goster.length){L.innerHTML='<div class="empty-state">Bu aramaya / süzgece uyan rapor yok.</div>'}
  else L.innerHTML=goster.map(r=>{
    if(r.status==='work'||r.status==='queued') return `<div class="card" id="c_${r.id}"><div class="head">${r.mini?`<img class="thumb" src="${r.mini}">`:'<div class="thumb empty"></div>'}<div class="meta"><div class="t1">${r.status==='work'?'Okunuyor…':'Sırada…'}</div><div class="t2">${esc(r.prog||'Z raporu inceleniyor')}</div></div><div class="spin"></div></div></div>`;
    if(r.status==='error') return `<div class="card"><div class="head">${r.mini?`<img class="thumb" src="${r.mini}">`:'<div class="thumb empty"></div>'}<div class="meta"><div class="t1" style="color:var(--err)">Okunamadı</div><div class="t2">${esc(r.err)}</div></div><button class="btn small" data-retry="${r.id}" ${r.blob||r.file?'':'disabled'}>Tekrar</button><button class="btn small danger" data-del="${r.id}">Sil</button></div></div>`;
    let g='',inSec=false;
    for(const f of FIELDS){
      if(f.sec){if(inSec)g+='</div></section>';g+=`<section class="grp${f.x?' grp-x':''}"><div class="grp-h">${secHTML(f.sec)}</div><div class="grid">`;inSec=true}
      g+=`<div class="f${f.full?' full':''}${f.t==='num'?' num':''}"><label>${shortL(f)}</label><input data-id="${r.id}" data-k="${f.k}" ${f.k==='tarih'||f.k==='z_no'?'inputmode="numeric" pattern="[0-9]*" enterkeyhint="done"':f.t!=='text'?'inputmode="decimal"':''} class="${fcls(r,f)}" value="${esc(fv(f,r.d[f.k]))}" ${f.t==='num'?'placeholder="—"':''} aria-label="${esc(f.l)}"></div>`;
    }
    if(inSec)g+='</div></section>';
    return `<div class="card${r.open?' open':''}" id="c_${r.id}">
      <div class="head" data-tog="${r.id}">${headHTML(r)}</div>
      <div class="body">${r.open?`
        ${r.thumb?`<img class="big" src="${r.thumb}" data-zoom alt="Z raporu fotoğrafı (dokun: büyüt)">`:''}
        ${r.src==='foto'||r.hasImg?`<div class="devam">${(r.sayfa||1)>1?`${ik('sayfa')}${r.sayfa} fotoğraftan birlikte okundu · `:''}<button class="lnk" data-devam="${r.id}">${ik('arti')}Fiş uzunsa devamını ekle</button></div>`:''}
        ${kaliteHTML(r)}
        ${r.d.z_rapor_mu===false?'<div class="notice" style="display:block">Bu görüntü bir Z raporuna benzemiyor, değerleri dikkatle kontrol et.</div>':''}
        <div class="checks">${checksHTML(r)}</div>
        <div class="grps">${g}</div>
        ${r.ocr!=null?`<details class="ocr"><summary>Okunan metin (düzeltip yeniden okutabilirsin)</summary><textarea rows="10" data-ocr="${r.id}">${esc(r.ocr)}</textarea><div class="set-row"><button class="btn small" data-copyocr="${r.id}">${ik('kopya')}Kopyala</button><button class="btn small" data-reparse="${r.id}">Metne göre yeniden oku</button></div></details>`:''}
        ${duzeltmeHTML(r)}
        ${r.akt?`<div class="aktbar">✓ ${aktTarih(r.akt,1)} tarihinde Luca dosyasına aktarıldı. <button class="btn small" data-aktsil="${r.id}">Aktarılmadı yap</button></div>`:''}
        ${bildirKutuHTML(r)}
        <div class="cardfoot"><button class="btn small danger" data-del="${r.id}">Sil</button>${r.kontrol?'':`<button class="btn small primary" data-kontrol="${r.id}">${ik('onay')}Kontrol edildi</button>`}<button class="btn small bildirlnk" data-bildirac="${r.id}">${ik('uyari')}${r.bildirildi?'Bildirildi · yeniden':'Hata bildir'}</button><button class="btn small" data-tog="${r.id}">Kapat</button></div>`:''}
      </div></div>`;
  }).join('');
  renderSum();
}
function headHTML(r){const bad=isBad(r);return `${r.mini?`<img class="thumb" src="${r.mini}">`:`<div class="thumb empty">${ik(r.src==='foto'?'kamera':r.src==='metin'?'metin':'kalem')}</div>`}
        <div class="meta"><div class="t1"><span class="tt">${esc(r.d.tarih||'Tarih yok')} · Z ${esc(r.d.z_no||'—')}</span></div>
        <div class="t2">${r.akt?`<span class="akt" title="Luca dosyasına aktarıldı">✓ Luca ${aktTarih(r.akt)}</span> `:''}KDV ${fm(kdvT(r.d))} · Kart ${fm(r.d.kart)||'—'} · Nakit ${fm(r.d.nakit)||'—'}</div></div>
        <div class="amt">${fm(satis(r.d))||'—'}<span class="badge ${bad?'b-warn':'b-ok'}">${bad?'Kontrol et':r.kontrol?'Kontrol edildi':'Tamam'}</span></div>`}
// Kontrol ekranı: bölüm başlığı (oran rozeti), bölüm içinde kısa etiketler, alan durumu (şüpheli / hesaplandı)
function secHTML(t){const m=t.match(/^%(\d+)\s+KDV(.*)$/);if(m)return `<span class="rate">%${m[1]}</span>KDV${esc(m[2])}`;
  const p=t.match(/^Poşet\s*\((%\d+)\)$/);if(p)return `<span class="rate">${p[1]}</span>Poşet`;
  const k=t.match(/^Kontrol\s*—\s*(.*)$/);if(k)return `Kontrol<span class="grp-note">${esc(k[1])}</span>`;return esc(t)}
const SHORT={tekel:'Toplam (KDV dahil)',g1:'Toplam (KDV dahil)',g10:'Toplam (KDV dahil)',g20:'Toplam (KDV dahil)',gp:'Toplam (KDV dahil)',
  m1:'Matrah',m10:'Matrah',m20:'Matrah',mp:'Matrah',k1:'KDV',k10:'KDV',k20:'KDV',kp:'KDV',kart:'Kredi kartı',genel:'Fişteki genel toplam',not:'Not'};
const shortL=f=>SHORT[f.k]||f.l;
const fcls=(r,f)=>[(r.unsure||[]).includes(f.k)?'unsure':'',(r.auto||[]).includes(f.k)?'calc':''].filter(Boolean).join(' ');
function checksHTML(r){const L=checks(r),bad=L.filter(c=>!c.ok).length,un=(r.unsure||[]).length,inf=L.filter(c=>c.info).length;
  const head=r.kontrol?`<div class="ck-h ok">${ik('onay')}Kontrol edildi · ${aktTarih(r.kontrol,1)}<button class="btn small ck-btn" data-kontrolgeri="${r.id}">Geri al</button></div>`:bad||un?`<div class="ck-h bad">${bad?`${bad} uyarı`:''}${bad&&un?' · ':''}${un?`${un} şüpheli alan`:''}<span>kontrol et</span></div>`:`<div class="ck-h ok">Tüm kontroller tamam${inf?` · ${inf} not`:''}</div>`;
  return head+L.map(c=>`<div class="ck ${c.info?'info':c.ok?'ok':'bad'}"><i>${c.info?'i':c.ok?'✓':'!'}</i><span>${esc(c.m.replace(/\s*✓$/,''))}${c.act?`<button class="btn small ck-btn" ${c.act.a}>${c.act.l}</button>`:''}</span></div>`).join('')+(un?`<div class="ck bad"><i>!</i><span>Emin olunamayan alanlar turuncu işaretli.</span></div>`:'')}
function renderSum(){
  const done=rows.filter(r=>r.status==='done');
  const tot=done.reduce((a,r)=>a+satis(r.d),0), kdv=done.reduce((a,r)=>a+kdvT(r.d),0);
  const yeni=done.filter(r=>!r.akt).length;
  $('#sum').innerHTML=`<div class="s1"><b>${done.length}</b> rapor · ${yeni===done.length?'hepsi yeni':yeni?`<b class="yeni">${yeni} yeni</b>`:'hepsi aktarıldı'}</div><div class="s2"><b>${fm(tot)}</b> <span>KDV ${fm(kdv)}</span></div>`;
  $('#xlsx').disabled=!done.length;$('#csv').disabled=!done.length;$('#copy').disabled=!done.length;
}
function refreshCard(r){
  const c=document.getElementById('c_'+r.id);if(!c){render();return}
  c.querySelector('.head').innerHTML=headHTML(r);
  const ck=c.querySelector('.checks');if(ck)ck.innerHTML=checksHTML(r);   // kapalı kartın gövdesi çizilmez (açılınca çizilir)
  c.querySelectorAll('input[data-k]').forEach(i=>{const f=FIELDS.find(x=>x.k===i.dataset.k);if(i!==document.activeElement)i.value=fv(f,r.d[f.k]);i.classList.toggle('unsure',!!(r.unsure&&r.unsure.includes(f.k)));i.classList.toggle('calc',!!(r.auto&&r.auto.includes(f.k)))});
  renderSum();
}

document.addEventListener('click',e=>{
  const t=e.target.closest('[data-tog],[data-del],[data-retry],[data-zoom],[data-reparse],[data-copyocr],[data-recam],[data-regal],[data-f],[data-aktsil],[data-bildir],[data-bildirac],[data-devam],[data-eksik],[data-hesaponay],[data-kontrol],[data-kontrolgeri]');if(!t)return;
  if(t.dataset.devam){devId=t.dataset.devam;const i=$('#devam');i.value='';i.click();return}
  if(t.dataset.f){FLT.f=t.dataset.f;render();return}
  if(t.dataset.aktsil){const r=rows.find(x=>x.id===t.dataset.aktsil);r.akt=null;save(r);render();toast('Bir sonraki Luca dosyasına yeniden girecek');return}
  if(t.dataset.eksik){const r=rows.find(x=>x.id===t.dataset.eksik);if(r)eksikZEkle(r);return}
  // Kontrol edildi: kullanıcı fişle karşılaştırıp (gerekirse elle düzeltip) onayladı → turuncular ve uyarılar kapanır, kart kapanır
  if(t.dataset.kontrol){const r=rows.find(x=>x.id===t.dataset.kontrol);if(!r)return;r.kontrol=Date.now();r.unsure=[];if(r.hesap)r.hesap.onay=true;r.open=false;save(r);render();toast('Kontrol edildi olarak işaretlendi');return}
  if(t.dataset.kontrolgeri){const r=rows.find(x=>x.id===t.dataset.kontrolgeri);if(!r)return;r.kontrol=null;save(r);render();toast('Kontrol işareti kaldırıldı');return}
  if(t.dataset.hesaponay){const r=rows.find(x=>x.id===t.dataset.hesaponay);if(r&&r.hesap){r.hesap.onay=true;r.unsure=(r.unsure||[]).filter(k=>k!=='tarih');save(r);render();toast('Doğrulandı; Luca’ya aktarılabilir')}return}
  if(t.dataset.bildirac){const k=$('#bk-'+t.dataset.bildirac);if(k){k.hidden=!k.hidden;if(!k.hidden)$('#bn-'+t.dataset.bildirac).focus()}return}
  if(t.dataset.bildir){const id=t.dataset.bildir,r=rows.find(x=>x.id===id);if(!r)return;const n=$('#bn-'+id);
    hataBildir(r,n?n.value.trim():'',t).then(ok=>{if(ok){render()}});return}
  if(t.dataset.recam||t.dataset.regal){reId=t.dataset.recam||t.dataset.regal;const i=$(t.dataset.recam?'#recam':'#regal');i.value='';i.click();return}
  if(t.dataset.copyocr){const ta=document.querySelector(`[data-ocr="${t.dataset.copyocr}"]`);const txt=ta?ta.value:'';
    (navigator.clipboard&&navigator.clipboard.writeText?navigator.clipboard.writeText(txt):Promise.reject()).then(()=>toast('Okunan metin kopyalandı')).catch(()=>{try{ta.focus();ta.select();ta.setSelectionRange(0,txt.length);const ok=document.execCommand('copy');toast(ok?'Okunan metin kopyalandı':'Kopyalanamadı — metne uzun basıp “Tümünü Seç”')}catch(x){toast('Kopyalanamadı')}});return}
  if(t.dataset.reparse){const r=rows.find(x=>x.id===t.dataset.reparse);const ta=document.querySelector(`[data-ocr="${r.id}"]`);r._zAuto=false;applyParse(r,ta.value);r.open=true;save(r);autoZ();render();toast('Metin yeniden okundu');return}
  if(t.dataset.zoom!==undefined){t.classList.toggle('zoom');return}
  if(t.dataset.tog){const r=rows.find(x=>x.id===t.dataset.tog);r.open=!r.open;if(r.open)loadImg(r);else if(r.hasImg&&r.status==='done'&&!String(r.thumb||'').startsWith('blob:'))r.thumb=null;   /* kapanan kartın büyük fotoğrafı bellekte kalmasın */render();if(r.open)document.getElementById('c_'+r.id)?.scrollIntoView({behavior:'smooth',block:'start'});return}
  if(t.dataset.del){
    if(t.dataset.armed!=='1'){t.dataset.armed='1';t.textContent='Emin misin?';setTimeout(()=>{if(t.isConnected){t.dataset.armed='';t.textContent='Sil'}},3000);return}
    removeRows(rows.filter(x=>x.id===t.dataset.del));return}
  if(t.dataset.retry){const r=rows.find(x=>x.id===t.dataset.retry);r.status='queued';queue.push(r);render();pump()}
});
document.addEventListener('change',e=>{
  const i=e.target;if(!i.dataset||!i.dataset.k)return;
  const r=rows.find(x=>x.id===i.dataset.id);const f=FIELDS.find(x=>x.k===i.dataset.k);
  if(!r||!f)return;
  r.d[f.k]=f.t==='text'?i.value.trim():pn(i.value);
  if(f.k==='tarih')r.d.tarih=normDate(r.d.tarih);
  if(f.k==='z_no'){r.d.z_no=normZ(r.d.z_no);r._zAuto=false;r._zManual=!!r.d.z_no}
  if(f.t==='num'&&i.value.trim()!==''&&r.d[f.k]==null)toast('Sayı anlaşılamadı: '+i.value);
  if(r.unsure)r.unsure=r.unsure.filter(k=>k!==f.k);
  if(f.t==='num')refill(r,f.k);
  if((f.k==='z_no'||f.k==='tarih')&&(!r.d.aciklama||r.d.aciklama===r._ack)){r.d.aciklama=mkAck(r.d);r._ack=r.d.aciklama}
  i.value=fv(f,r.d[f.k]);
  if(r.kontrol){r.kontrol=null;setTimeout(render,0)}   // onaydan sonra değiştirildi: yeniden kontrol edilsin
  if(r.akt){r.akt=null;toast('Rapor değişti: bir sonraki Luca dosyasına yeniden girecek')}
  save(r);
  if(f.k==='z_no'||f.k==='tarih')autoZ();
  ckToplu(()=>rows.forEach(x=>{if(x.status==='done')refreshCard(x)}));
});

const pm=$('#pm');
$('#paste').onclick=()=>{pm.hidden=false;$('#pmt').value='';setTimeout(()=>$('#pmt').focus(),50)};
$('#pmc').onclick=()=>{pm.hidden=true};
pm.addEventListener('click',e=>{if(e.target===pm)pm.hidden=true});
// Toplu metin: "Z Tara" kestirmesi her fişin metninden önce "#ZR#" satırı koyar
$('#pmo').onclick=()=>{const t=$('#pmt').value.trim();if(!t){toast('Önce metni yapıştır');return}addTexts(t)};
$('#pmclip').onclick=async()=>{try{const t=(await navigator.clipboard.readText()||'').trim();if(!t){toast('Pano boş — önce kestirmeyi çalıştır');return}addTexts(t)}
  catch(e){toast('Panoya erişilemedi — kutuya uzun basıp “Yapıştır” de, sonra Oku ve ekle');$('#pmt').focus()}};
if(/^#(toplu|tara)/.test(location.hash)){history.replaceState(null,'',location.pathname);setTimeout(()=>$('#paste').click(),300)}
$('#ara').addEventListener('input',e=>{FLT.q=e.target.value.trim();render()});

// ---- Klavye açıkken: alt çubuğu gizle. Kaydırmayı iOS kendisi yapar (biz karışırsak sayfa iner-çıkar);
// yalnız "Hata bildir" kutusunda düğmeler klavyenin altında kalırsa, klavye yerleştikten sonra BİR KEZ aşağı kaydır.
(()=>{
  const yazilir=el=>!!el&&el.matches&&(el.matches('textarea,select,[contenteditable]')||el.matches('input')&&!/^(checkbox|radio|button|submit|file|range|color|reset)$/.test(el.type));
  let zm;
  document.addEventListener('focusin',e=>{const el=e.target;if(!yazilir(el))return;document.body.classList.add('klavye');clearTimeout(zm);
    const kutu=el.closest('.bildirkutu');if(!kutu)return;
    zm=setTimeout(()=>{if(document.activeElement!==el)return;const vv=window.visualViewport;if(!vv)return;
      const alt=vv.offsetTop+vv.height-8,dib=kutu.getBoundingClientRect().bottom,ust=el.getBoundingClientRect().top,d=Math.min(dib-alt,ust-vv.offsetTop-16);
      if(d>4)window.scrollBy(0,d)},650)});
  document.addEventListener('focusout',()=>setTimeout(kbDenetle,80));
  // Odaktaki kutu çizim sırasında silinirse (kart yeniden çizildi / kapandı) iPhone "focusout" göndermiyor ve alt çubuk
  // (Luca CSV) gizli kalıyordu: klavye kapanınca, dokununca ve her çizimden sonra yeniden denetle.
  window.kbDenetle=()=>{const el=document.activeElement;if(!(yazilir(el)&&el.isConnected))document.body.classList.remove('klavye')};
  if(window.visualViewport)visualViewport.addEventListener('resize',()=>setTimeout(kbDenetle,60));
  document.addEventListener('touchstart',()=>setTimeout(kbDenetle,300),{passive:true});
})();
