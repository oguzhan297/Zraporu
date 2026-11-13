// Açılış: kayıtları yükle, sürüm kontrolü, service worker (en son yüklenir)
$('#ack').value=ACK;
function showVer(){const pv=window.ZParse&&ZParse.version;$('#ver').textContent=`Sürüm: ${APP_VER} · okuyucu: ${pv||'yok'}`;$('#ver').style.color=pv===APP_VER?'':'var(--warn)';if(pv!==APP_VER)$('#ver').textContent+=' — okuyucu güncel değil, uygulamayı kapatıp yeniden aç';return pv===APP_VER}
// Okuyucu yüklenemediyse (ör. GitHub güncellemesi yayılırken) kendiliğinden yeniden dene
(function retryParser(n){if(showVer()||n>6)return;const sc=document.createElement('script');sc.src=`js/parser.js?v=${APP_VER}&r=${Date.now()}`;sc.onload=()=>{showVer();if(window.ZParse&&rows.length)render()};sc.onerror=()=>{};document.head.appendChild(sc);setTimeout(()=>retryParser(n+1),n<2?3000:15000)})(0);
if(S.mode==='api'&&!S.key){$('#settings').open=true;notice('Claude API ile okuma için ⚙️ Ayarlar’a anahtarını gir ya da yöntemi “Ücretsiz” yap.')}
setStore('wait');load();
try{navigator.storage&&navigator.storage.persist&&navigator.storage.persist()}catch(e){}
if('serviceWorker' in navigator&&(location.protocol==='https:'||location.hostname==='localhost'))navigator.serviceWorker.register('sw.js').catch(()=>{});

// ---- Güncelleme: yeni sürüm yayınlanınca bant göster; dokununca yenile (okuma sürüyorsa bitmesini bekle) ----
let yeniSurum=0;
function guncelGoster(v){if(v<=APP_VER||v<=yeniSurum)return;yeniSurum=v;$('#guncelyazi').textContent=`Yeni sürüm hazır (v${v})`;$('#guncel').hidden=false}
async function surumDenetle(){try{const r=await fetch(`./index.html?surum=${Date.now()}`,{cache:'no-store'});if(!r.ok)return;const m=(await r.text()).match(/temel\.js\?v=(\d+)/);if(m)guncelGoster(+m[1])}catch(e){}}
$('#guncelbtn').onclick=()=>{if(typeof busy!=='undefined'&&(busy||(typeof queue!=='undefined'&&queue.length))){toast('Okuma sürüyor; bitince yenile');return}
  $('#guncelbtn').disabled=true;$('#guncelyazi').textContent='Güncelleniyor…';
  const git=()=>location.replace(location.pathname+'?g='+Date.now());
  if(navigator.serviceWorker&&navigator.serviceWorker.getRegistration)navigator.serviceWorker.getRegistration().then(g=>g&&g.update()).catch(()=>{}).finally(()=>setTimeout(git,600));else git()};
if(location.search.includes('g='))history.replaceState(null,'',location.pathname+location.hash);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')surumDenetle()});
setTimeout(surumDenetle,4000);setInterval(surumDenetle,30*60*1000);
// ---- Yenilikler: güncellemeden sonra bir kez ----
(()=>{let son=0;try{son=+localStorage.getItem('zr_sonsurum')||0;localStorage.setItem('zr_sonsurum',APP_VER)}catch(e){return}
  if(!son||son>=APP_VER)return;const v=Object.keys(YENILIK).map(Number).filter(x=>x>son&&x<=APP_VER).sort((a,b)=>b-a);if(!v.length)return;
  $('#yeniliktitle').textContent=`Yenilikler · v${APP_VER}`;$('#yenilikliste').innerHTML=v.flatMap(x=>YENILIK[x]).map(m=>`<li>${esc(m)}</li>`).join('');
  setTimeout(()=>{$('#yenilik').hidden=false},800)})();
$('#yeniliktamam').onclick=()=>{$('#yenilik').hidden=true};
$('#yenilik').addEventListener('click',e=>{if(e.target.id==='yenilik')$('#yenilik').hidden=true});
setTimeout(()=>{if(typeof XLSX==='undefined')loadScript(XLSX_URL).catch(()=>{})},6000);   // Excel kütüphanesi açılıştan sonra, boşta yüklenir
// İki parmakla sayfayı yakınlaştırma kapalı: iPhone yakınlaştırılmış sayfayı yüksek çözünürlükte yeniden çizerken belleği dolduruyor,
// okuma sürerken uygulama kapanıyordu (13.11 çökme kaydı). Fotoğrafı büyütmek için fotoğrafa dokun (görüntüleyicide yakınlaştırma var).
['gesturestart','gesturechange'].forEach(t=>document.addEventListener(t,e=>e.preventDefault(),{passive:false}));
document.addEventListener('touchmove',e=>{if(e.touches&&e.touches.length>1&&!(e.target.closest&&e.target.closest('#gor')))e.preventDefault()},{passive:false});
