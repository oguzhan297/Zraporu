// Fiş görüntüsü hazırlama: kırpma, gri ton, Lanczos ölçekleme, keskinleştirme, bölgesel eşikleme.
// Hem sayfada (<script>, Tesseract ve PaddleOCR yedek yolu) hem de PaddleOCR işçisinde (import) kullanılır.
// İşçide document yok: tuval OffscreenCanvas; görüntü ImageBitmap (yönü sayfada düzeltilmiş).
(function(root){
// sayfada normal tuval (Tesseract / PaddleOCR onu kabul eder), işçide OffscreenCanvas
const mk=(w=1,h=1)=>{if(typeof document==='undefined')return new OffscreenCanvas(w,h);const c=document.createElement('canvas');c.width=w;c.height=h;return c};
const dims=im=>[im.naturalWidth||im.width,im.naturalHeight||im.height];
// mode 'max': renkli lekeler (çay, kahve, yağ, mürekkep) kanallardan en az birinde açıktır, siyah yazı her kanalda koyudur
//   → en açık kanalı almak lekeyi büyük ölçüde siler, yazıyı korur
function grayOf(ctx,w,h,mode){const p=ctx.getImageData(0,0,w,h).data,g=new Uint8Array(w*h);
  if(mode==='max'){for(let i=0,j=0;i<p.length;i+=4,j++){const a=p[i],b=p[i+1],c=p[i+2];g[j]=a>b?(a>c?a:c):(b>c?b:c)}return g}
  for(let i=0,j=0;i<p.length;i+=4,j++)g[j]=(p[i]*299+p[i+1]*587+p[i+2]*114)/1000|0;return g}
function cropBox(im){
  const [W,H]=dims(im);
  // Küçük kopyada kâğıdı (en açık bölge) bulup fişi kırp
  const sw=300,sh=Math.max(1,Math.round(H*sw/W));
  const c=mk(sw,sh);const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(im,0,0,sw,sh);
  const g=grayOf(x,sw,sh),srt=Array.from(g).sort((a,b)=>a-b),pc=q=>srt[Math.min(srt.length-1,Math.floor(q*srt.length))];
  const hi=pc(.97),lo=pc(.40),th=lo+(hi-lo)*.55,pap=new Uint8Array(g.length);for(let i=0;i<g.length;i++)pap[i]=g[i]>th?1:0;
  let x0=-1,x1=-1;for(let cx=0;cx<sw;cx++){let n=0;for(let y=0;y<sh;y++)n+=pap[y*sw+cx];if(n/sh>.5){if(x0<0)x0=cx;x1=cx}}
  if(x0<0||x1-x0<5)return [0,0,W,H];
  let y0=-1,y1=-1;for(let y=0;y<sh;y++){let n=0;for(let cx=x0;cx<=x1;cx++)n+=pap[y*sw+cx];if(n/(x1-x0+1)>.5){if(y0<0)y0=y;y1=y}}
  if(y0<0||y1-y0<5)return [0,0,W,H];
  const f=W/sw;let bx0=x0*f,bx1=(x1+1)*f,by0=y0*f,by1=(y1+1)*f;const mx=(bx1-bx0)*.03,my=(by1-by0)*.01;
  bx0=Math.max(0,bx0-mx);by0=Math.max(0,by0-my);bx1=Math.min(W,bx1+mx);by1=Math.min(H,by1+my);
  const a=(bx1-bx0)*(by1-by0)/(W*H);return a>.05&&a<.95?[bx0,by0,bx1-bx0,by1-by0]:[0,0,W,H];
}
function lanczos(src,sw,sh,dw,dh){
  // Lanczos-3 yeniden boyutlandırma (gri ton): küçük yazılı fişlerde en net sonucu verir
  const L=x=>{if(x===0)return 1;if(x<=-3||x>=3)return 0;const p=Math.PI*x;return 3*Math.sin(p)*Math.sin(p/3)/(p*p)};
  const pass=(inp,iw,ih,ow,horiz)=>{const n=horiz?iw:ih,on=ow,sc=n/on,fs=Math.max(1,sc),sup=3*fs;
    const W=[],I=[];for(let o=0;o<on;o++){const c=(o+.5)*sc-.5,a=Math.max(0,Math.ceil(c-sup)),b=Math.min(n-1,Math.floor(c+sup));let ws=[],t=0;for(let j=a;j<=b;j++){const w=L((j-c)/fs);ws.push(w);t+=w}I.push(a);W.push(Float32Array.from(ws,w=>w/t))}
    const OW=horiz?ow:iw,OH=horiz?ih:ow,out=new Float32Array(OW*OH);
    if(horiz){for(let y=0;y<ih;y++){const r=y*iw,ro=y*OW;for(let o=0;o<on;o++){const w=W[o],a=I[o];let s=0;for(let k=0;k<w.length;k++)s+=inp[r+a+k]*w[k];out[ro+o]=s}}}
    else{for(let o=0;o<on;o++){const w=W[o],a=I[o],ro=o*OW;for(let k=0;k<w.length;k++){const wk=w[k],r=(a+k)*iw;for(let x=0;x<iw;x++)out[ro+x]+=inp[r+x]*wk}}}
    return out};
  const h1=pass(src,sw,sh,dw,true);const v=pass(h1,dw,sh,dh,false);
  const g=new Uint8Array(dw*dh);for(let i=0;i<g.length;i++){const x=v[i];g[i]=x<0?0:x>255?255:x+.5|0}return g;
}
// Keskinleştirme (unsharp mask): g + a·(g − bulanık g); bulanık = iki kez kutu bulanıklığı (≈ Gauss)
function unsharp(g,w,h,a,r){
  const box=(src)=>{const t=new Float32Array(w*h),o=new Float32Array(w*h),n=2*r+1;
    for(let y=0;y<h;y++){let s=0;const row=y*w;for(let x=-r;x<=r;x++)s+=src[row+Math.min(w-1,Math.max(0,x))];for(let x=0;x<w;x++){t[row+x]=s/n;s+=src[row+Math.min(w-1,x+r+1)]-src[row+Math.max(0,x-r)]}}
    for(let x=0;x<w;x++){let s=0;for(let y=-r;y<=r;y++)s+=t[Math.min(h-1,Math.max(0,y))*w+x];for(let y=0;y<h;y++){o[y*w+x]=s/n;s+=t[Math.min(h-1,y+r+1)*w+x]-t[Math.max(0,y-r)*w+x]}}
    return o};
  const b=box(box(g)),out=new Uint8Array(w*h);
  for(let i=0;i<out.length;i++){const v=g[i]+a*(g[i]-b[i]);out[i]=v<0?0:v>255?255:v+.5|0}return out;
}
function prep(C,opt={}){
  // 1) fişi kırp  2) genişliği 1400 px'e getir  3) bölgesel eşikleme (gölge ve gri zemine dayanıklı)
  // aynı fotoğrafın 2.–4. okumasında çözme ve kırpma tekrarlanmasın
  // opt.raw: eşikleme yapma, gri tonlu görüntüyü ver (PaddleOCR doğal görüntüde daha iyi okur) · opt.full: kırpma · opt.maxSide: uzun kenar sınırı
  const im=C.im,[cx,cy,cw,ch]=opt.full?[0,0,...dims(im)]:C.box;
  let tw=opt.tw||1400,th=Math.round(ch*tw/cw);if(tw*th>12e6){const k=Math.sqrt(12e6/(tw*th));tw=Math.round(tw*k);th=Math.round(th*k)}
  if(opt.maxSide&&Math.max(tw,th)>opt.maxSide){const k=opt.maxSide/Math.max(tw,th);tw=Math.round(tw*k);th=Math.round(th*k)}
  // fişi kendi çözünürlüğünde al (en fazla 16 MP), sonra Lanczos ile hedef boyuta getir
  let nw=Math.round(cw),nh=Math.round(ch);if(nw*nh>16e6){const k=Math.sqrt(16e6/(nw*nh));nw=Math.round(nw*k);nh=Math.round(nh*k)}
  const gk=(opt.gray||'lum')+(opt.full?'|full':'');let G0=C.gray[gk];
  if(!G0){const c0=mk(nw,nh);const x0=c0.getContext('2d',{willReadFrequently:true});x0.drawImage(im,cx,cy,cw,ch,0,0,nw,nh);
    G0=C.gray[gk]=grayOf(x0,nw,nh,opt.gray);c0.width=c0.height=1}
  let g=lanczos(G0,nw,nh,tw,th);
  if(opt.sharp)g=unsharp(g,tw,th,opt.sharp,Math.max(1,Math.round(tw/700)));   // bulanık fotoğraf: kenarları keskinleştir
  const c=mk(tw,th);const x=c.getContext('2d',{willReadFrequently:true});
  if(opt.raw){const img=x.createImageData(tw,th),o=img.data;for(let i=0,k=0;i<g.length;i++,k+=4){o[k]=o[k+1]=o[k+2]=g[i];o[k+3]=255}x.putImageData(img,0,0);return c}
  const W1=tw+1,I=new Uint32Array(W1*(th+1));
  for(let y=1;y<=th;y++){let row=0;for(let xx=1;xx<=tw;xx++){row+=g[(y-1)*tw+xx-1];I[y*W1+xx]=I[(y-1)*W1+xx]+row}}
  const S=Math.max(15,(tw*(opt.win||1/16))|0)|1,r=S>>1,T=opt.t||.15,img=x.createImageData(tw,th),o=img.data;
  for(let y=0;y<th;y++){const ya=Math.max(0,y-r),yb=Math.min(th,y+r+1);for(let xx=0;xx<tw;xx++){
    const xa=Math.max(0,xx-r),xb=Math.min(tw,xx+r+1),cnt=(yb-ya)*(xb-xa),sum=I[yb*W1+xb]-I[ya*W1+xb]-I[yb*W1+xa]+I[ya*W1+xa];
    const v=g[y*tw+xx]*cnt<=sum*(1-T)?0:255,k=(y*tw+xx)*4;o[k]=o[k+1]=o[k+2]=v;o[k+3]=255}}
  x.putImageData(img,0,0);return c;
}
const kaynak=im=>({im,box:cropBox(im),gray:{}});
root.ZGoruntu={prep,kaynak,cropBox,grayOf,lanczos,unsharp,mk,dims};
})(typeof window!=='undefined'?window:globalThis);
