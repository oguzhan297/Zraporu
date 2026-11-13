// Bilgisayarda okuma: fotoğraf telefonda çekilir, okuma (PaddleOCR) eşleşilen Windows/Mac bilgisayarda yapılır → telefon ısınmaz.
// Bilgisayar: aynı uygulamayı ?pc ile açar (index.html?pc) → ekranda kısa bir kod çıkar, sayfa açık kaldıkça okur.
// Telefon: Ayarlar → "Bilgisayarda oku" kutusuna o kodu yazar. Bağlantı WebRTC ile doğrudan (aynı ağda fotoğraf internete çıkmaz);
// iki cihazı ilk kez buluşturmak için PeerJS'in ücretsiz eşleşme sunucusu kullanılır (yalnız bağlantı bilgisi geçer, fotoğraf geçmez).
// Telefondaki okuma mantığı (geçişler, toplam kontrolü, ayrıştırma) aynen telefonda kalır; bilgisayara yalnız ağır kısım gider:
// motor arayüzü işçiyle aynı → resim(id, dosya) · oku(id, _, ayar) → kutular · birak(id).
// Bilgisayar kapalı / ulaşılamıyorsa telefon kendisi okur; 2 dakikada bir yeniden dener.
const PC_ONEK='zrapor-pc-',PEERJS='vendor/peerjs.min.js?p=1';
let uzakYok=0;   // son başarısız deneme zamanı
const uzakDene=()=>!!(S.pcKod&&navigator.onLine!==false&&!new URLSearchParams(location.search).has('pc')&&Date.now()-uzakYok>120000);
async function peerYukle(){if(!window.Peer)await loadScript(PEERJS);if(!window.Peer)throw new Error('Eşleşme aracı yüklenemedi')}
const bekle=(p,ms,m)=>Promise.race([p,new Promise((_,no)=>setTimeout(()=>no(new Error(m)),ms))]);

// ---- Telefon tarafı: bilgisayardaki okuyucuya bağlanan motor ----
async function uzakMotor(prog,kod=S.pcKod){
  await peerYukle();prog&&prog('Bilgisayara bağlanılıyor…');
  const peer=new Peer(undefined,{debug:0});
  const kapat=()=>{try{peer.destroy()}catch(e){}};
  try{
    await bekle(new Promise((ok,no)=>{peer.on('open',ok);peer.on('error',no)}),8000,'Eşleşme sunucusuna ulaşılamadı');
    const conn=peer.connect(PC_ONEK+kod,{reliable:true});
    await bekle(new Promise((ok,no)=>{conn.on('open',ok);conn.on('error',no);peer.on('error',e=>no(e&&e.type==='peer-unavailable'?new Error('Bilgisayar açık değil ya da kod yanlış'):e))}),12000,'Bilgisayar yanıt vermedi');
    let n=0,olu=false;const bek=new Map(),sure={aktarim:0,okuma:0,mb:0};
    const bitir=er=>{if(olu)return;olu=true;for(const x of bek.values()){clearTimeout(x.z);x.b(er)}bek.clear();kapat()};
    conn.on('data',m=>{const x=m&&bek.get(m.n);if(!x)return;bek.delete(m.n);clearTimeout(x.z);m.ok?x.a(m):x.b(new Error(m.err||'Bilgisayarda okuma hatası'))});
    conn.on('close',()=>bitir(new Error('Bilgisayar bağlantısı koptu')));conn.on('error',e=>bitir(new Error('Bilgisayar bağlantısı: '+(e&&e.message||e))));
    peer.on('disconnected',()=>{});   // eşleşme sunucusundan kopmak kurulu bağlantıyı bozmaz
    const gonder=(o,ms)=>olu?Promise.reject(new Error('Bilgisayar bağlantısı kapalı')):new Promise((a,b)=>{const id=++n;
      bek.set(id,{a,b,z:setTimeout(()=>{bek.delete(id);bitir(new Error('Bilgisayar zamanında yanıt vermedi'))},ms)});conn.send({...o,n:id})});
    const m=await gonder({t:'merhaba',surum:APP_VER},90000);   // bilgisayarda okuyucu yeni açılıyorsa hazırlanması sürebilir
    kutu('uzak',{thr:m.thr,ad:m.ad});
    return {tur:'uzak',thr:m.thr||1,ad:m.ad||'Bilgisayar',olu:()=>olu,
      // her fişten önce kısa yoklama: bilgisayar sessizce kapandıysa (uyku, sekme kapandı) 8 sn içinde anlaşılır, telefon kendisi okur
      async resim(id,src){await gonder({t:'ping'},8000);const t=performance.now(),b=await src.arrayBuffer();await gonder({t:'img',id,b,tip:src.type||'image/jpeg'},45000);sure.aktarim+=performance.now()-t;sure.mb+=b.byteLength/1e6},
      async oku(id,src,opt){const t=performance.now(),r=await gonder({t:'read',id,opt},60000);sure.okuma+=performance.now()-t;return r.items||[]},
      sure,
      birak(id){gonder({t:'free',id},20000).catch(()=>{})},
      kapat(){bitir(new Error('kapatıldı'))},
      // bağlantı türü: host = aynı ağda doğrudan, srflx = internet üzerinden doğrudan, relay = aktarma sunucusu üzerinden
      async yol(){try{const st=await conn.peerConnection.getStats();let cift=null;st.forEach(x=>{if(x.type==='candidate-pair'&&(x.nominated||x.selected)&&x.state==='succeeded')cift=x});
        if(!cift)return null;const l=st.get(cift.localCandidateId),r=st.get(cift.remoteCandidateId);return {yerel:l&&l.candidateType,uzak:r&&r.candidateType,rtt:cift.currentRoundTripTime}}catch(e){return null}}};
  }catch(e){kapat();throw e}
}
// getPaddle bunu çağırır: kod girilmişse ve son deneme yakın zamanda başarısız olmadıysa bilgisayara bağlan
async function uzakDeneVeBaglan(prog){if(!uzakDene())return null;
  try{return await uzakMotor(prog)}catch(e){uzakYok=Date.now();pcHata('bağlanamadı: '+(e&&e.message||e));kutu('uzakYok',{m:String(e&&e.message||e).slice(0,100)});console.warn('Bilgisayara bağlanılamadı, telefonda okunacak:',e);return null}}

// ---- Bilgisayarda okuma raporu: bir okuma turu bitince (sıra boşalınca) özet test arşivine gider (fotoğraf/tutar yok) ----
const PCR='zr_pcrapor';
async function pcKaydet(r,motor,sn,gecis){try{const l=JSON.parse(localStorage.getItem(PCR)||'[]');
  if(!l.length&&motor.yol){const y=await motor.yol();localStorage.setItem(PCR+'_yol',JSON.stringify(y))}
  const S_=motor.sure||{};l.push({sn:Math.round(sn*10)/10,gecis,ok:r.status==='done',aktarim:Math.round((S_.aktarim||0)/100)/10,okuma:Math.round((S_.okuma||0)/100)/10,mb:Math.round((S_.mb||0)*10)/10});if(motor.sure){motor.sure.aktarim=0;motor.sure.okuma=0;motor.sure.mb=0}localStorage.setItem(PCR,JSON.stringify(l.slice(-100)))}catch(e){}}
function pcHata(m){try{const l=JSON.parse(localStorage.getItem(PCR+'_hata')||'[]');l.push({t:Date.now(),m:String(m).slice(0,160)});localStorage.setItem(PCR+'_hata',JSON.stringify(l.slice(-20)))}catch(e){}}
async function pcRaporGonder(){try{const l=JSON.parse(localStorage.getItem(PCR)||'[]'),h=JSON.parse(localStorage.getItem(PCR+'_hata')||'[]');
  if(l.length<3&&!h.length)return;if(!S.ghKey||typeof ghGonder!=='function')return;
  const p={tur:'zrapor-pc',surum:APP_VER,cihaz:navigator.userAgent,pc:pdl&&pdl.tur==='uzak'?{ad:pdl.ad,thr:pdl.thr}:null,yol:JSON.parse(localStorage.getItem(PCR+'_yol')||'null'),
    fis:l.length,ortSn:Math.round(l.reduce((a,b)=>a+b.sn,0)/Math.max(1,l.length)*10)/10,okumalar:l,kopmalar:h};
  localStorage.removeItem(PCR);localStorage.removeItem(PCR+'_hata');localStorage.removeItem(PCR+'_yol');
  await ghGonder(`${new Date().toISOString().replace(/[:.]/g,'-').slice(0,19)}_pc_v${APP_VER}_${Math.random().toString(36).slice(2,6)}`,[{ad:'pc.json',b64:b64Metin(JSON.stringify(p,null,1))}])}catch(e){}}

// ---- Telefon: Ayarlar'daki "Bilgisayarda oku" satırı ----
(()=>{const g=$('#pckodgir');if(!g)return;g.value=S.pcKod||'';
  const yaz=m=>{$('#pcdurumtel').textContent=m};
  yaz(S.pcKod?'Kod kayıtlı: okuma bilgisayarda yapılır (bilgisayar kapalıysa telefonda).':'Bilgisayarda index.html?pc sayfasını açıp çıkan kodu buraya yaz.');
  $('#pcbagla').addEventListener('click',async()=>{const k=g.value.trim().toLowerCase().replace(/\s+/g,'');
    if(!k){S.pcKod='';saveS();uzakYok=0;if(pdl&&pdl.tur==='uzak'){try{pdl.kapat()}catch(e){}pdl=null}yaz('Kapalı: okuma telefonda yapılır.');return}
    yaz('Bağlanılıyor…');
    try{const m=await uzakMotor(null,k);try{m.kapat()}catch(e){}S.pcKod=k;saveS();uzakYok=0;if(pdl&&!busy){try{pdl.kapat&&pdl.kapat()}catch(e){}pdl=null}
      yaz(`Bağlandı ✓ ${m.ad} hazır (${m.thr} çekirdek). Fişler artık bilgisayarda okunacak.`)}
    catch(e){yaz('Bağlanamadı: '+(e&&e.message||e)+'. Bilgisayarda sayfa açık mı, kod doğru mu?')}});
})();

// ---- Bilgisayar tarafı (index.html?pc): telefonlardan gelen fotoğrafları bu bilgisayarın okuyucusuyla okur ----
async function pcBaslat(){
  document.body.classList.add('pc-mod');$('#pcpanel').hidden=false;
  const yaz=m=>{$('#pcdurum').textContent=m};
  // çok çekirdek için sayfa izole olmalı (sw.js başlık ekler): ilk açılışta servis çalışanı devreye girince bir kez yenile
  if(!self.crossOriginIsolated&&'serviceWorker' in navigator&&!sessionStorage.getItem('zr_pcyenile')){
    try{await bekle(navigator.serviceWorker.ready,8000,'sw');sessionStorage.setItem('zr_pcyenile','1');location.reload();return}catch(e){}}
  let kod=localStorage.getItem('zr_pckod');
  if(!kod){const h='abcdefghjkmnpqrstuvwxyz23456789';kod=Array.from(crypto.getRandomValues(new Uint8Array(6)),b=>h[b%h.length]).join('');localStorage.setItem('zr_pckod',kod)}
  $('#pckodgoster').textContent=kod.slice(0,3)+' '+kod.slice(3);
  const thr=self.crossOriginIsolated?Math.max(1,Math.min(4,(navigator.hardwareConcurrency||2)-1)):1;
  let motor=null,motorYuk=null,okunan=0,son=null;const baglar=new Set();
  const istat=()=>{$('#pcistat').textContent=`Bağlı telefon: ${baglar.size} · Okunan fotoğraf: ${okunan}`+(son?` · Son: ${new Date(son).toLocaleTimeString('tr-TR')}`:'')};
  const motorAl=()=>motorYuk||(motorYuk=(async()=>{yaz('Okuyucu hazırlanıyor (ilk açılışta ~56 MB iner)…');
    pdlProg=t=>yaz(t);const f=await paddleDosyalari();
    try{motor=await isciMotoru(f,thr)}catch(e){console.warn('Çok çekirdek açılamadı:',e);motor=await isciMotoru(await paddleDosyalari(),1)}
    yaz(`Hazır ✓ (${motor.thr} çekirdek). Bu sayfayı açık bırakın; simge durumuna küçültülebilir.`);return motor})().catch(e=>{motorYuk=null;yaz('Okuyucu açılamadı: '+e.message);throw e}));
  motorAl().catch(()=>{});
  await peerYukle();
  let peer;const ac=()=>{peer=new Peer(PC_ONEK+kod,{debug:0});
    peer.on('open',()=>{$('#pcbag').textContent='Telefon bağlantısına hazır'});
    peer.on('disconnected',()=>{$('#pcbag').textContent='Eşleşme sunucusuna yeniden bağlanılıyor…';setTimeout(()=>{try{peer.reconnect()}catch(e){}},3000)});
    peer.on('error',e=>{if(e&&e.type==='unavailable-id'){$('#pcbag').textContent='Bu kod başka bir sekmede açık. O sekmeyi kapatın.';return}
      $('#pcbag').textContent='Bağlantı hatası, yeniden deneniyor…';if(peer.destroyed){setTimeout(ac,5000)}});
    peer.on('connection',conn=>{baglar.add(conn);istat();
      conn.on('close',()=>{baglar.delete(conn);istat()});
      // aynı telefondan gelen istekleri sırayla işle (fotoğraf yüklenmeden okuma başlamasın)
      let zincir=Promise.resolve();
      conn.on('data',m=>{zincir=zincir.then(async()=>{const c=o=>{try{conn.send({n:m.n,...o})}catch(e){}};
        try{const mt=await motorAl();
          if(m.t==='ping'){c({ok:true});return}
          if(m.t==='merhaba')c({ok:true,thr:mt.thr,ad:'Bilgisayar ('+(navigator.userAgentData&&navigator.userAgentData.platform||navigator.platform||'')+')'});
          else if(m.t==='img'){await mt.resim(m.id,new Blob([m.b],{type:m.tip||'image/jpeg'}));okunan++;son=Date.now();istat();c({ok:true})}
          else if(m.t==='read')c({ok:true,items:await mt.oku(m.id,null,m.opt||{})});
          else if(m.t==='free'){mt.birak(m.id);c({ok:true})}
        }catch(e){c({ok:false,err:String(e&&e.message||e).slice(0,200)});if(motor&&motor.olu&&motor.olu()){motor=null;motorYuk=null}}})})});
  };
  ac();istat();
}
if(new URLSearchParams(location.search).has('pc'))setTimeout(()=>pcBaslat().catch(e=>{$('#pcdurum').textContent='Başlatılamadı: '+e.message}),300);
