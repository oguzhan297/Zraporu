// Açılış: kayıtları yükle, sürüm kontrolü, service worker (en son yüklenir)
$('#ack').value=ACK;
function showVer(){const pv=window.ZParse&&ZParse.version;$('#ver').textContent=`Sürüm: ${APP_VER} · okuyucu: ${pv||'yok'}`;$('#ver').style.color=pv===APP_VER?'':'var(--warn)';if(pv!==APP_VER)$('#ver').textContent+=' — okuyucu güncel değil, uygulamayı kapatıp yeniden aç';return pv===APP_VER}
// Okuyucu yüklenemediyse (ör. GitHub güncellemesi yayılırken) kendiliğinden yeniden dene
(function retryParser(n){if(showVer()||n>6)return;const sc=document.createElement('script');sc.src=`js/parser.js?v=${APP_VER}&r=${Date.now()}`;sc.onload=()=>{showVer();if(window.ZParse&&rows.length)render()};sc.onerror=()=>{};document.head.appendChild(sc);setTimeout(()=>retryParser(n+1),n<2?3000:15000)})(0);
if(S.mode==='api'&&!S.key){$('#settings').open=true;notice('Claude API ile okuma için ⚙️ Ayarlar’a anahtarını gir ya da yöntemi “Ücretsiz” yap.')}
setStore('wait');load();
try{navigator.storage&&navigator.storage.persist&&navigator.storage.persist()}catch(e){}
if('serviceWorker' in navigator&&(location.protocol==='https:'||location.hostname==='localhost'))navigator.serviceWorker.register('sw.js').catch(()=>{});
