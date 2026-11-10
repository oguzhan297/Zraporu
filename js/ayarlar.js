// Ayarlar: okuma yöntemi, Claude API anahtarı / model / kullanım, varsayılan açıklama
// ---- Ayarlar ----
const S=(()=>{let o={};try{o=JSON.parse(localStorage.getItem('zr_settings')||'{}')}catch(e){}const x=Object.assign({key:'',model:'claude-sonnet-5-5',usage:{}},o);if(!x.mode)x.mode=x.key?'api':'paddle';
  // v43: ücretsiz okumada varsayılan PaddleOCR (Tesseract'tan çok daha isabetli). Bir kez geçilir; Tesseract'ı yeniden seçen kalır.
  if(x.mode==='free'&&!x.mig43)x.mode='paddle';x.mig43=1;return x})();
const saveS=()=>{try{localStorage.setItem('zr_settings',JSON.stringify(S))}catch(e){}};
const PRICE={'claude-sonnet-5-5':[2,10],'claude-haiku-5-5':[0.10,0.50]};
function track(u,count=true){if(!u)return;const m=new Date().toISOString().slice(0,7);if(S.usage.m!==m)S.usage={m,n:0,cost:0};const p=PRICE[S.model]||[2,10];
  if(count)S.usage.n++;S.usage.cost+=((u.input_tokens||0)+(u.cache_creation_input_tokens||0))*p[0]/1e6+(u.output_tokens||0)*p[1]/1e6;saveS();showUsage()}
function showUsage(){const u=S.usage,m=new Date().toISOString().slice(0,7);$('#usage').textContent=u.m===m&&u.n?`Bu ay: ${u.n} okuma · tahmini maliyet ~$${u.cost.toFixed(2)} (kesin tutar Anthropic panelinde)`:'Bu ay henüz okuma yapılmadı.'}

$('#ack').value=ACK;
$('#ack').addEventListener('change',e=>{ACK=e.target.value.trim()||'Z RAPORU';e.target.value=ACK;try{localStorage.setItem('zrapor_ack',ACK)}catch(x){}toast('Varsayılan açıklama kaydedildi (yeni raporlara uygulanır)')});

// ---- Ayar kontrolleri ----
$('#key').value=S.key;$('#model').value=S.model;showUsage();
function modeUI(){$('#mode').value=S.mode;$('#apiBox').style.display=S.mode==='api'?'':'none';
  $('#modehint').textContent=S.mode==='api'?'Fiş Claude ile okunur; her okuma API hesabından ücretlendirilir.':S.mode==='paddle'?'Fiş telefonda PaddleOCR ile okunur, ücretsizdir. İlk kullanımda okuyucu bir kez indirilir (~56 MB, Wi-Fi önerilir); sonra internetsiz de çalışır. Her raporu kontrol et.':'Fiş telefonda Tesseract ile okunur, ücretsizdir. İsabet fişin netliğine ve yazar kasa modeline bağlıdır; her raporu kontrol et.'}
modeUI();
$('#mode').addEventListener('change',e=>{S.mode=e.target.value;saveS();modeUI();notice('')});
$('#key').addEventListener('change',e=>{S.key=e.target.value.trim();e.target.value=S.key;saveS();$('#testres').textContent='';if(S.key)notice('')});
$('#keyshow').onclick=()=>{const k=$('#key');k.type=k.type==='password'?'text':'password';$('#keyshow').textContent=k.type==='password'?'Göster':'Gizle'};
$('#model').addEventListener('change',e=>{S.model=e.target.value;saveS()});
$('#test').onclick=async()=>{const t=$('#testres');t.textContent='Deneniyor…';
  try{await callClaude([{type:'text',text:'Sadece "tamam" yaz.'}],200,false);t.textContent='✓ Bağlantı çalışıyor';t.style.color='var(--ok)'}
  catch(e){t.textContent='✗ '+e.message;t.style.color='var(--err)'}};

// ---- Hata bildirimi: gizli gelen kutusu (GitHub) ----
// Anahtar yalnız bu depoya yazabilen ince ayarlı bir GitHub anahtarıdır; sadece bu telefonda saklanır, sadece api.github.com'a gider.
const GH_DEPO='oguzhan297/zraporu-gelen';
const ghIstek=(yol,o={})=>fetch(`https://api.github.com/repos/${GH_DEPO}${yol}`,{...o,headers:{Authorization:'Bearer '+S.ghKey,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'}});
const b64Metin=t=>{const u=new TextEncoder().encode(t);let s='';for(let i=0;i<u.length;i+=0x8000)s+=String.fromCharCode.apply(null,u.subarray(i,i+0x8000));return btoa(s)};
async function ghYukle(yol,b64,mesaj){const r=await ghIstek('/contents/'+yol,{method:'PUT',body:JSON.stringify({message:mesaj,content:b64})});
  if(!r.ok){const m=r.status===401?'anahtar geçersiz ya da süresi dolmuş':r.status===403||r.status===404?'anahtarın gelen kutusuna yazma izni yok':'GitHub hatası '+r.status;throw new Error(m)}}
// dosyalar: [{ad, b64}] → gelen/<klasör>/ad
async function ghGonder(klasor,dosyalar){for(const d of dosyalar)await ghYukle(`gelen/${klasor}/${d.ad}`,d.b64,`Okuma hatası bildirimi: ${klasor}`)}
$('#ghkey').value=S.ghKey||'';
$('#ghkey').addEventListener('change',e=>{S.ghKey=e.target.value.trim();e.target.value=S.ghKey;saveS();$('#ghres').textContent=''});
$('#ghpaylas').onclick=async()=>{const k=S.ghKey;if(!k){toast('Önce anahtarı gir');return}
  try{if(navigator.share){await navigator.share({text:k});return}}catch(e){if(e&&e.name==='AbortError')return}
  try{await navigator.clipboard.writeText(k);toast('Anahtar kopyalandı; diğer telefona gönder')}catch(e){toast('Kopyalanamadı')}};
$('#ghtest').onclick=async()=>{const t=$('#ghres');if(!S.ghKey){t.textContent='Önce anahtarı gir';return}t.textContent='Deneniyor…';t.style.color='';
  try{const r=await ghIstek('');if(!r.ok)throw new Error(r.status===401?'anahtar geçersiz':'gelen kutusuna erişim yok ('+r.status+')');const j=await r.json();
    if(!j.permissions||!j.permissions.push)throw new Error('anahtarın yazma izni yok');t.textContent='✓ Gelen kutusu hazır';t.style.color='var(--ok)'}
  catch(e){t.textContent='✗ '+(e.message==='Failed to fetch'?'bağlantı yok':e.message);t.style.color='var(--err)'}};
