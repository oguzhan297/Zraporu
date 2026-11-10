// Fotoğraf kalitesi: bulanık / düşük çözünürlük / karanlık / soluk ölçümü ve uyarısı (eşikler test arşiviyle ayarlandı)
// ---- Fotoğraf kalitesi: okumadan önce telefonda hızlı ölçüm (≈50 ms) ----
// Eşikler test arşivindeki 23 gerçek fotoğraf ve bunların bulanık / karanlık / soluk / küçük kopyalarıyla ayarlandı.
async function fotoKalite(src){
  const im=await openImage(src),W=im.naturalWidth,H=im.naturalHeight;
  const S=Math.min(1,1000/Math.max(W,H)),w=Math.max(1,Math.round(W*S)),h=Math.max(1,Math.round(H*S));
  const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(im,0,0,w,h);
  const p=x.getImageData(0,0,w,h).data,g=new Float32Array(w*h);c.width=c.height=1;
  for(let i=0,j=0;i<p.length;i+=4,j++)g[j]=.299*p[i]+.587*p[i+1]+.114*p[i+2];
  const G=new Float32Array(w*h),Lp=new Float32Array(w*h);
  for(let y=1;y<h-1;y++)for(let xx=1;xx<w-1;xx++){const i=y*w+xx;
    const gx=g[i-w+1]+2*g[i+1]+g[i+w+1]-g[i-w-1]-2*g[i-1]-g[i+w-1],gy=g[i+w-1]+2*g[i+w]+g[i+w+1]-g[i-w-1]-2*g[i-w]-g[i-w+1];
    G[i]=Math.hypot(gx,gy);Lp[i]=Math.abs(4*g[i]-g[i-1]-g[i+1]-g[i-w]-g[i+w])}
  const q=(a,f)=>{const s=Float32Array.from(a).sort();return s[Math.min(s.length-1,Math.floor(f*s.length))]};
  const gT=q(G,.99);let sl=0,sg=0;for(let i=0;i<G.length;i++)if(G[i]>=gT&&G[i]>0){sl+=Lp[i];sg+=G[i]}
  const p5=q(g,.05),p95=q(g,.95);
  // keskinlik: en güçlü kenarlarda Laplace / gradyan oranı (bulanık kenar yayılır, oran düşer); ölçekten ve ışıktan büyük ölçüde bağımsız
  return {min:Math.min(W,H),keskin:sg?sl/sg:0,p5,p95,kontrast:p95-p5};
}
const KALITE={
  kucuk:{m:'Fotoğrafın çözünürlüğü düşük',ip:'Fişe yaklaş ya da fotoğrafı orijinal boyutunda gönder (sıkıştırılmış WhatsApp görüntüsü değil).'},
  bulanik:{m:'Fotoğraf bulanık',ip:'Telefonu sabit tut, çekmeden önce ekranda fişe dokunup netlemesini bekle.'},
  karanlik:{m:'Fotoğraf karanlık',ip:'Daha aydınlık bir yerde ya da flaşla çek.'},
  soluk:{m:'Fotoğraf soluk / düşük kontrastlı',ip:'Işık yansımasından kaçın; baskının kendisi silikse değerleri elle kontrol et.'}
};
// Bulanık ve düşük çözünürlük okumayı bozar (testte bulanıkta doğru fiş 23/23 → 13/23): her zaman uyar.
// Karanlık ve soluk fotoğrafları PaddleOCR çoğunlukla doğru okur: yalnız okumada da sorun varsa sebep olarak göster.
function kaliteSorun(o,okumaSorunlu){if(!o)return [];const k=[];
  if(o.min<900)k.push('kucuk');else if(o.keskin<0.07)k.push('bulanik');
  if(okumaSorunlu){if(o.p95<110)k.push('karanlik');else if(o.kontrast<90&&o.p5>85)k.push('soluk')}
  return k}
function kaliteHTML(r){const k=kaliteSorun(r.q,isBad(r));if(!k.length)return '';
  return `<div class="qwarn"><div class="qw-h">📷 Fotoğraf kalitesi düşük — okuma hatalı olabilir</div>${k.map(x=>`<div class="qw-i"><b>${KALITE[x].m}.</b> ${KALITE[x].ip}</div>`).join('')}
    <div class="set-row"><button class="btn small primary" data-recam="${r.id}">📷 Yeniden çek</button><button class="btn small" data-regal="${r.id}">🖼️ Galeriden değiştir</button></div></div>`}
