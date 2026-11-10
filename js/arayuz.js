// Arayüz: rapor kartları, kontrol ekranı, alt özet çubuğu; kart üzerindeki tıklama ve düzenlemeler; metin yapıştırma penceresi
function render(){
  const L=$('#list');
  if(!rows.length){L.innerHTML='<div class="empty-state">Henüz Z raporu yok.<br>Yukarıdan fotoğraf çekerek başla.</div>'}
  else L.innerHTML=rows.map(r=>{
    if(r.status==='work'||r.status==='queued') return `<div class="card" id="c_${r.id}"><div class="head">${r.thumb?`<img class="thumb" src="${r.thumb}">`:'<div class="thumb empty"></div>'}<div class="meta"><div class="t1">${r.status==='work'?'Okunuyor…':'Sırada…'}</div><div class="t2">${esc(r.prog||'Z raporu inceleniyor')}</div></div><div class="spin"></div></div></div>`;
    if(r.status==='error') return `<div class="card"><div class="head">${r.thumb?`<img class="thumb" src="${r.thumb}">`:'<div class="thumb empty"></div>'}<div class="meta"><div class="t1" style="color:var(--err)">Okunamadı</div><div class="t2">${esc(r.err)}</div></div><button class="btn small" data-retry="${r.id}" ${r.blob||r.file?'':'disabled'}>Tekrar</button><button class="btn small danger" data-del="${r.id}">Sil</button></div></div>`;
    let g='',inSec=false;
    for(const f of FIELDS){
      if(f.sec){if(inSec)g+='</div></section>';g+=`<section class="grp${f.x?' grp-x':''}"><div class="grp-h">${secHTML(f.sec)}</div><div class="grid">`;inSec=true}
      g+=`<div class="f${f.full?' full':''}${f.t==='num'?' num':''}"><label>${shortL(f)}</label><input data-id="${r.id}" data-k="${f.k}" ${f.t!=='text'?'inputmode="decimal"':''} class="${fcls(r,f)}" value="${esc(fv(f,r.d[f.k]))}" ${f.t==='num'?'placeholder="—"':''} aria-label="${esc(f.l)}"></div>`;
    }
    if(inSec)g+='</div></section>';
    return `<div class="card${r.open?' open':''}" id="c_${r.id}">
      <div class="head" data-tog="${r.id}">${headHTML(r)}</div>
      <div class="body">
        ${r.thumb?`<img class="big" src="${r.thumb}" data-zoom alt="Z raporu fotoğrafı (dokun: büyüt)">`:''}
        ${kaliteHTML(r)}
        ${r.d.z_rapor_mu===false?'<div class="notice" style="display:block">Bu görüntü bir Z raporuna benzemiyor, değerleri dikkatle kontrol et.</div>':''}
        <div class="checks">${checksHTML(r)}</div>
        <div class="grps">${g}</div>
        ${r.ocr!=null?`<details class="ocr"><summary>Okunan metin (düzeltip yeniden okutabilirsin)</summary><textarea rows="10" data-ocr="${r.id}">${esc(r.ocr)}</textarea><div class="set-row"><button class="btn small" data-copyocr="${r.id}">📋 Kopyala</button><button class="btn small" data-reparse="${r.id}">Metne göre yeniden oku</button></div></details>`:''}
        <div class="cardfoot"><button class="btn small danger" data-del="${r.id}">Sil</button><button class="btn small" data-tog="${r.id}">Kapat</button></div>
      </div></div>`;
  }).join('');
  renderSum();
}
function headHTML(r){const bad=isBad(r);return `${r.thumb?`<img class="thumb" src="${r.thumb}">`:`<div class="thumb empty">${r.src==='foto'?'📷':r.src==='metin'?'📋':'elle'}</div>`}
        <div class="meta"><div class="t1"><span class="tt">${esc(r.d.tarih||'Tarih yok')} · Z ${esc(r.d.z_no||'—')}</span></div>
        <div class="t2">KDV ${fm(kdvT(r.d))} · Kart ${fm(r.d.kart)||'—'} · Nakit ${fm(r.d.nakit)||'—'}</div></div>
        <div class="amt">${fm(satis(r.d))||'—'}<span class="badge ${bad?'b-warn':'b-ok'}">${bad?'Kontrol et':'Tamam'}</span></div>`}
// Kontrol ekranı: bölüm başlığı (oran rozeti), bölüm içinde kısa etiketler, alan durumu (şüpheli / hesaplandı)
function secHTML(t){const m=t.match(/^%(\d+)\s+KDV(.*)$/);if(m)return `<span class="rate">%${m[1]}</span>KDV${esc(m[2])}`;
  const p=t.match(/^Poşet\s*\((%\d+)\)$/);if(p)return `<span class="rate">${p[1]}</span>Poşet`;
  const k=t.match(/^Kontrol\s*—\s*(.*)$/);if(k)return `Kontrol<span class="grp-note">${esc(k[1])}</span>`;return esc(t)}
const SHORT={tekel:'Toplam (KDV dahil)',g1:'Toplam (KDV dahil)',g10:'Toplam (KDV dahil)',g20:'Toplam (KDV dahil)',gp:'Toplam (KDV dahil)',
  m1:'Matrah',m10:'Matrah',m20:'Matrah',mp:'Matrah',k1:'KDV',k10:'KDV',k20:'KDV',kp:'KDV',kart:'Kredi kartı',genel:'Fişteki genel toplam',not:'Not'};
const shortL=f=>SHORT[f.k]||f.l;
const fcls=(r,f)=>[(r.unsure||[]).includes(f.k)?'unsure':'',(r.auto||[]).includes(f.k)?'calc':''].filter(Boolean).join(' ');
function checksHTML(r){const L=checks(r),bad=L.filter(c=>!c.ok).length,un=(r.unsure||[]).length;
  const head=bad||un?`<div class="ck-h bad">${bad?`${bad} uyarı`:''}${bad&&un?' · ':''}${un?`${un} şüpheli alan`:''}<span>kontrol et</span></div>`:`<div class="ck-h ok">Tüm kontroller tamam</div>`;
  return head+L.map(c=>`<div class="ck ${c.ok?'ok':'bad'}"><i>${c.ok?'✓':'!'}</i><span>${esc(c.m.replace(/\s*✓$/,''))}</span></div>`).join('')+(un?`<div class="ck bad"><i>!</i><span>Emin olunamayan alanlar turuncu işaretli.</span></div>`:'')}
function renderSum(){
  const done=rows.filter(r=>r.status==='done');
  const tot=done.reduce((a,r)=>a+satis(r.d),0), kdv=done.reduce((a,r)=>a+kdvT(r.d),0);
  $('#sum').innerHTML=`<b>${done.length}</b> rapor · Toplam <b>${fm(tot)}</b><br>KDV ${fm(kdv)}`;
  $('#xlsx').disabled=!done.length;$('#csv').disabled=!done.length;$('#copy').disabled=!done.length;
}
function refreshCard(r){
  const c=document.getElementById('c_'+r.id);if(!c){render();return}
  c.querySelector('.head').innerHTML=headHTML(r);
  c.querySelector('.checks').innerHTML=checksHTML(r);
  c.querySelectorAll('input[data-k]').forEach(i=>{const f=FIELDS.find(x=>x.k===i.dataset.k);if(i!==document.activeElement)i.value=fv(f,r.d[f.k]);i.classList.toggle('unsure',!!(r.unsure&&r.unsure.includes(f.k)));i.classList.toggle('calc',!!(r.auto&&r.auto.includes(f.k)))});
  renderSum();
}

document.addEventListener('click',e=>{
  const t=e.target.closest('[data-tog],[data-del],[data-retry],[data-zoom],[data-reparse],[data-copyocr],[data-recam],[data-regal]');if(!t)return;
  if(t.dataset.recam||t.dataset.regal){reId=t.dataset.recam||t.dataset.regal;const i=$(t.dataset.recam?'#recam':'#regal');i.value='';i.click();return}
  if(t.dataset.copyocr){const ta=document.querySelector(`[data-ocr="${t.dataset.copyocr}"]`);const txt=ta?ta.value:'';
    (navigator.clipboard&&navigator.clipboard.writeText?navigator.clipboard.writeText(txt):Promise.reject()).then(()=>toast('Okunan metin kopyalandı')).catch(()=>{try{ta.focus();ta.select();ta.setSelectionRange(0,txt.length);const ok=document.execCommand('copy');toast(ok?'Okunan metin kopyalandı':'Kopyalanamadı — metne uzun basıp “Tümünü Seç”')}catch(x){toast('Kopyalanamadı')}});return}
  if(t.dataset.reparse){const r=rows.find(x=>x.id===t.dataset.reparse);const ta=document.querySelector(`[data-ocr="${r.id}"]`);r._zAuto=false;applyParse(r,ta.value);r.open=true;save(r);autoZ();render();toast('Metin yeniden okundu');return}
  if(t.dataset.zoom!==undefined){t.classList.toggle('zoom');return}
  if(t.dataset.tog){const r=rows.find(x=>x.id===t.dataset.tog);r.open=!r.open;if(r.open)loadImg(r);render();if(r.open)document.getElementById('c_'+r.id)?.scrollIntoView({behavior:'smooth',block:'start'});return}
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
  save(r);
  if(f.k==='z_no'||f.k==='tarih')autoZ();
  rows.forEach(x=>{if(x.status==='done')refreshCard(x)});
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
