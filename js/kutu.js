// Kara kutu: uygulama okurken iPhone tarafından kapatılırsa (bellek dolunca beyaz ekran) ne olduğunu sonradan görebilmek için.
// Son olaylar ve birkaç saniyede bir durum özeti telefonda (localStorage) tutulur. Uygulama ekrandayken kendiliğinden kapanmışsa
// bir sonraki açılışta bu kayıtlar "çökme raporu" olarak gizli gelen kutusuna gönderilir (anahtar yoksa Ayarlar'dan paylaşılabilir).
// Fotoğraf ya da fiş tutarı yazılmaz; yalnız sayılar ve adımlar.
const KUTU=(()=>{
  const ON='zr_',AN=ON+'kutu',OT=ON+'oturum',CR=ON+'cokme',N=80;
  const oturum={id:Math.random().toString(36).slice(2,8),basla:Date.now()};
  let liste=[],son=0;const tum=[];
  const yaz=()=>{try{localStorage.setItem(AN,JSON.stringify(liste))}catch(e){}};
  const ekle=(e,o)=>{const ev={t:Date.now()-oturum.basla,e,...(o||{})};liste.push(ev);tum.push(ev);if(tum.length>500)tum.splice(0,tum.length-500);if(liste.length>N)liste=liste.slice(-N);
    const s=Date.now();if(s-son>400){son=s;yaz()}else{clearTimeout(ekle._t);ekle._t=setTimeout(yaz,450)}};
  // ekrandaki görüntülerin toplam piksel sayısı (bellek için kaba gösterge) ve diğer durum bilgisi
  const durum=()=>{let px=0,img=0;for(const i of document.images){if(i.complete&&i.naturalWidth){img++;px+=i.naturalWidth*i.naturalHeight}}
    const R=typeof rows!=='undefined'?rows:[];
    return {rapor:R.length,sira:typeof queue!=='undefined'?queue.length:null,okuyor:R.filter(r=>r.status==='work').length,acik:R.filter(r=>r.open).length,
      buyukResim:R.filter(r=>r.thumb).length,img,mpx:+(px/1e6).toFixed(1),kaydir:Math.round(scrollY),kamera:typeof KAM!=='undefined'&&!!KAM.akis,
      js:performance.memory?Math.round(performance.memory.usedJSHeapSize/1e6):null,gizli:document.visibilityState==='hidden'}};
  const oturumYaz=temiz=>{try{localStorage.setItem(OT,JSON.stringify({...oturum,temiz,son:Date.now(),surum:typeof APP_VER!=='undefined'?APP_VER:null}))}catch(e){}};
  // Önceki oturum: ekrandayken (temiz değil) ve yakın zamanda yaşıyorken bittiyse çökme sayılır
  let onceki=null;try{const o=JSON.parse(localStorage.getItem(OT)||'null'),k=JSON.parse(localStorage.getItem(AN)||'[]');
    if(o&&!o.temiz&&Date.now()-o.son<10*60e3&&k.length)onceki={oturum:o,olaylar:k,cihaz:navigator.userAgent,ekran:[screen.width,screen.height,devicePixelRatio],bellek:navigator.deviceMemory||null,cekirdek:navigator.hardwareConcurrency||null}}catch(e){}
  if(onceki)try{localStorage.setItem(CR,JSON.stringify(onceki))}catch(e){}
  oturumYaz(false);ekle('acilis',{onceki:!!onceki});
  // kalp atışı: durum özeti (yalnız değişmişse) ve "hâlâ yaşıyorum" zamanı
  let sonDurum='';setInterval(()=>{const d=durum(),s=JSON.stringify(d);if(s!==sonDurum){sonDurum=s;ekle('durum',d)}oturumYaz(document.visibilityState==='hidden')},3000);
  // arka plana geçince temiz say (iPhone arka plandaki uygulamayı da kapatabilir; bu çökme değildir)
  document.addEventListener('visibilitychange',()=>{const g=document.visibilityState==='hidden';ekle(g?'arka':'on');oturumYaz(g);yaz()});
  addEventListener('pagehide',()=>{ekle('kapat');oturumYaz(true);yaz()});
  addEventListener('error',e=>ekle('hata',{m:String(e.message||'').slice(0,160),y:(e.filename||'').split('/').pop()+':'+e.lineno}));
  addEventListener('unhandledrejection',e=>ekle('hata',{m:String(e.reason&&e.reason.message||e.reason||'').slice(0,160)}));
  let kt=0;addEventListener('scroll',()=>{const s=Date.now();if(s-kt>2000){kt=s;ekle('kaydir',{y:Math.round(scrollY)})}},{passive:true});
  // Açılışta: önceki çökmeyi gönder (gelen kutusu anahtarı varsa), yoksa Ayarlar'da beklesin
  async function gonder(){let c=null;try{c=JSON.parse(localStorage.getItem(CR)||'null')}catch(e){}if(!c)return;
    if(typeof S==='undefined'||!S.ghKey||typeof ghGonder!=='function'){if(onceki)toast('Uygulama önceki açılışta kendiliğinden kapanmış. Ayarlar’a gelen kutusu anahtarı girersen nedeni bana iletilir.');return}
    const kl=`${new Date().toISOString().replace(/[:.]/g,'-').slice(0,19)}_cokme_v${c.oturum.surum||'-'}_${oturum.id}`;
    try{await ghGonder(kl,[{ad:'cokme.json',b64:b64Metin(JSON.stringify({tur:'zrapor-cokme',...c},null,1))}]);localStorage.removeItem(CR);
      toast('Uygulama önceki açılışta kapanmıştı; nedenini bulmak için kayıt gönderildi')}catch(e){}}
  setTimeout(()=>{if(onceki||localStorage.getItem(CR))gonder()},5000);

  // Canlı kayıt (Ayarlar'da açık/kapalı, varsayılan açık; gelen kutusu anahtarı gerekir): olaylar oturum boyunca
  // canli/z/<oturum>.json dosyasına birkaç saniyede bir yazılır (üzerine yazılır). Fotoğraf, tutar ya da firma adı yazılmaz.
  const canli=(()=>{const d=new Date(oturum.basla).toISOString().replace(/[:.]/g,'-').slice(0,19),yol=`canli/z/${d}_${oturum.id}.json`;
    let sha=null,gonderilen=-1,mesgul=false,hata=0,kapali=false,zam=null;
    const acik=()=>!kapali&&typeof S!=='undefined'&&S&&S.canli!==false&&!!S.ghKey&&typeof ghIstek==='function'&&typeof b64Metin==='function';
    async function yaz(){if(!acik()||mesgul||tum.length===gonderilen)return;mesgul=true;
      try{const govde=JSON.stringify({tur:'z-canli',oturum:{...oturum,surum:typeof APP_VER!=='undefined'?APP_VER:null,gonderim:new Date().toISOString()},cihaz:navigator.userAgent,ekran:[screen.width,screen.height,devicePixelRatio],cekirdek:navigator.hardwareConcurrency||null,bellek:navigator.deviceMemory||null,durum:durum(),olaylar:tum},null,0),n=tum.length;
        const gonder=async()=>ghIstek('/contents/'+yol,{method:'PUT',body:JSON.stringify({message:'Canlı kayıt z',content:b64Metin(govde),...(sha?{sha}:{})})});
        let r=await gonder();
        if(r.status===409||r.status===422){const g=await ghIstek('/contents/'+yol);if(g.ok){sha=(await g.json()).sha;r=await gonder()}}
        if(r.ok){sha=(await r.json()).content.sha;gonderilen=n;hata=0}
        else{hata++;if(r.status===401||r.status===403||r.status===404||hata>=5)kapali=true}}
      catch(e){hata++;if(hata>=5)kapali=true}finally{mesgul=false}}
    // ekrandayken 8 sn'de bir (yalnız yeni olay varsa), arka plana geçerken ve açılırken hemen
    zam=setInterval(yaz,8000);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')setTimeout(yaz,50)});
    return {yaz,yol,acik}})();
  return {ekle,durum,onceki,gonder,canli};
})();
const kutu=(e,o)=>KUTU.ekle(e,o);
