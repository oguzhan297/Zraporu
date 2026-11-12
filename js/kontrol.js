// Kontroller: toplamların, KDV'lerin, ödemelerin tutarlılığı; Z no sırası (autoZ)
// Bir çizim (render) boyunca her raporun kontrolleri bir kez hesaplanır: kontroller tüm listeye baktığı için
// her kartta yeniden hesaplamak yüzlerce raporda saniyeler sürüyordu (açılış yavaşlığı).
let CK=null;
function ckToplu(fn){const ic=!CK;if(ic)CK=new Map();try{return fn()}finally{if(ic)CK=null}}
// Tarihe göre sıralı rapor dizini (komşu günleri ikili aramayla bulmak için); bir çizim boyunca bir kez kurulur
const dnumC=new Map();const dn=s=>{let v=dnumC.get(s);if(v===undefined){v=dnum(s);dnumC.set(s,v)}return v};
function gunDizin(){const k='__dizin';if(CK&&CK.has(k))return CK.get(k);
  const L=rows.filter(x=>x.status==='done').map(x=>({x,t:dn(x.d.tarih),z:/^\d+$/.test(String(x.d.z_no||''))?+x.d.z_no:null})).filter(o=>o.t!=null).sort((a,b)=>a.t-b.t);
  if(CK)CK.set(k,L);return L}
function gunAralik(t0,t1){const L=gunDizin();let lo=0,hi=L.length;while(lo<hi){const m=(lo+hi)>>1;if(L[m].t<t0)lo=m+1;else hi=m}
  const out=[];for(let i=lo;i<L.length&&L[i].t<=t1;i++)out.push(L[i]);return out}
function checks(r){if(CK){let v=CK.get(r);if(!v){v=checks0(r);CK.set(r,v)}return v}return checks0(r)}
function checks0(r){
  const d=r.d,out=[];
  const names={g1:'%1',g10:'%10',g20:'%20',gp:'Poşet'};
  if(!d.tarih)out.push({ok:false,m:'Tarih boş'});
  else if(!dateOk(d.tarih))out.push({ok:false,m:`Tarih geçersiz veya GG.AA.YYYY biçiminde değil: “${d.tarih}”`});
  if(!d.z_no)out.push({ok:false,m:'Z No boş'});
  else if(rows.some(x=>x!==r&&x.status==='done'&&x.d.z_no&&String(x.d.z_no).replace(/^0+/,'')===String(d.z_no).replace(/^0+/,'')&&x.d.tarih===d.tarih))out.push({ok:false,m:'Aynı tarih ve Z No ile listede başka bir rapor var — iki kez eklenmiş olabilir'});
  // Z sırası: yakın tarihli raporlara göre beklenen Z'ye çok benziyor ama farklıysa (eksik/yanlış hane) uyar.
  // Birden fazla firmanın fişleri aynı listede olabilir: beklenen Z en az iki ayrı raporla desteklenmeli (aynı kasanın sırası),
  // eksik/fazla hane tahmini yalnız 3+ haneli numaralarda yapılır (3 ↔ 3069 gibi kısa numaralar rastlantıyla benzer).
  {const t=dnum(d.tarih),z=String(d.z_no||'');if(t!=null&&/^\d+$/.test(z)&&!(d._zIki&&!r._zAuto&&!r._zManual)){
    const say=new Map();
    for(const o of gunAralik(t-3,t+3)){const x=o.x;if(x===r||o.z==null||o.t===t)continue;
      const e=o.z-(o.t-t);say.set(e,(say.get(e)||0)+1)}
    const like=e=>{const a=String(e);if(a===z)return false;if(a.length!==z.length)return Math.min(a.length,z.length)>=3&&(a.startsWith(z)||a.endsWith(z)||z.startsWith(a)||z.endsWith(a));let n=0;for(let i=0;i<a.length;i++)if(a[i]!==z[i])n++;return n===1};
    const e=[...say].filter(([,c])=>c>=2).map(([e])=>e).find(like);if(e!=null&&!say.has(+z))out.push({ok:false,m:`Z No ${z} şüpheli: yakın tarihli raporlara göre ${e} olmalı`})}}
  if(satis(d)===0)out.push({ok:false,m:'Hiç satış tutarı yok'});
  for(const [g,m,k] of GROUPS){if(d[g]!=null&&d[m]!=null&&d[k]!=null){const df=Math.abs(d[m]+d[k]-d[g]);if(df>=0.006)out.push({ok:false,m:`${names[g]}: Matrah + KDV, genel toplamla tutmuyor (fark ${fm(df)})`})}}
  const s=satis(d);
  if(d.genel!=null&&s>0){const df=Math.abs(s-d.genel);out.push({ok:df<0.006,m:df<0.006?'Tekel + KDV grupları + poşet = fiş genel toplamı ✓':`Grupların toplamı (${fm(s)}) fiş genel toplamıyla (${fm(d.genel)}) tutmuyor, fark ${fm(df)}`})}
  // Vergi dökümü (fişin altındaki TOPLAM/TOPKDV satırları) ile karşılaştır
  if(d._vd&&typeof d._vd==='object'){const ok=[],bad=[];
    for(const [rt,p] of Object.entries(d._vd)){const g='g'+rt,k='k'+rt;if(!Array.isArray(p)||d[g]==null)continue;
      if(Math.abs(d[g]-p[0])<0.006&&(d[k]==null||Math.abs(d[k]-p[1])<0.006))ok.push('%'+rt);
      else bad.push(`%${rt}: vergi dökümünde ${fm(p[0])} / KDV ${fm(p[1])}, burada ${fm(d[g])} / KDV ${d[k]==null?'—':fm(d[k])}`)}
    if(ok.length)out.push({ok:true,m:`Vergi dökümüyle aynı (${ok.join(', ')}) ✓`});
    for(const b of bad)out.push({ok:false,m:b})}
  // Departman bilgileri (aynı oranlı departmanların toplamı) ile karşılaştır
  if(d._dp&&typeof d._dp==='object'){const ok=[],bad=[],key={0:'tekel',1:'g1',10:'g10',20:'g20'};
    for(const [rt,v] of Object.entries(d._dp)){const g=key[rt];if(!g||d[g]==null||typeof v!=='number')continue;if(Math.abs(d[g]-v)<0.006)ok.push(rt==='0'?'Tekel':'%'+rt);else bad.push(`${rt==='0'?'Tekel':'%'+rt}: departman bilgilerinde ${fm(v)}, burada ${fm(d[g])}`)}
    // Toplam ve ödemeler tutuyorsa fark büyük ihtimalle departman satırının yanlış okunmasıdır: uyarı değil bilgi
    const sumOk=d.genel!=null&&Math.abs(satis(d)-d.genel)<0.006&&Math.abs((d.kart||0)+(d.nakit||0)-d.genel)<0.006;
    if(ok.length)out.push({ok:true,m:`Departman bilgileriyle aynı (${ok.join(', ')}) ✓`});for(const b of bad)out.push(sumOk?{ok:true,m:'ⓘ '+b+' (toplamlar tuttuğu için departman satırı yanlış okunmuş olabilir)'}:{ok:false,m:b})}
  if(typeof d._topk==='number'){const sk=['k1','k10','k20','kp'].reduce((a,k)=>a+(d[k]||0),0),df=Math.abs(sk-d._topk);
    out.push({ok:df<0.006,m:df<0.006?'KDV’lerin toplamı fişteki toplam KDV ile aynı ✓':`KDV’lerin toplamı (${fm(sk)}) fişteki toplam KDV’den (${fm(d._topk)}) farklı, fark ${fm(df)} — en çok %20 KDV’yi kontrol et`})}
  // karekod vb. diğer ödemeler (d.diger) kullanıcıyı ilgilendirmez: gösterilmez, aktarılmaz; yalnız bu kontrolde sessizce hesaba katılır
  const pay=(d.kart||0)+(d.nakit||0)+(d.diger||0);
  if(pay>0&&s>0){const df=Math.abs(pay-s);out.push({ok:df<0.006,m:df<0.006?'Kredi kartı + Nakit = Satış toplamı ✓':`Kart + Nakit (${fm(pay-(d.diger||0))}) satış toplamıyla (${fm(s)}) tutmuyor, fark ${fm(Math.abs(pay-(d.diger||0)-s))}`})}
  out.push(...olagandisi(r));
  out.push(...hesapKontrol(r),...kumKontrol(r),...slipKontrol(r));
  return out;
}
// Olağandışı değer: aynı yazar kasanın yakın günleri (Z sırası tarihle uyumlu olanlar) ile karşılaştır. Uyarı değil, bilgi (ⓘ).
function olagandisi(r){
  const d=r.d,t=dnum(d.tarih),z=+d.z_no,s=satis(d);if(t==null||!(z>0)||!(s>0))return [];
  const kom=gunAralik(t-45,t+45).filter(o=>{const x=o.x;if(x===r||o.z==null||!(satis(x.d)>0))return false;
    const dt=o.t-t,dz=o.z-z;return dt!==0&&Math.abs(dz-dt)<=Math.max(3,Math.abs(dt)*.3)}).map(o=>o.x);
  if(kom.length<4)return [];
  const med=a=>{const s=a.slice().sort((p,q)=>p-q),m=s.length>>1;return s.length%2?s[m]:(s[m-1]+s[m])/2};
  const out=[],ms=med(kom.map(x=>satis(x.d)));
  if(s<ms*.35||s>ms*2.6)out.push({ok:true,info:true,m:`Günlük satış (${fm(s)}) bu kasanın yakın günlerine göre olağandışı ${s<ms?'düşük':'yüksek'} (ortanca ${fm(ms)}). Fişle karşılaştır.`});
  const ad={tekel:'Tekel',g1:'%1',g10:'%10',g20:'%20'};
  for(const k of Object.keys(ad)){const p=(d[k]||0)/s,mp=med(kom.map(x=>(x.d[k]||0)/satis(x.d)));
    if(Math.abs(p-mp)>.35){out.push({ok:true,info:true,m:`${ad[k]} payı %${Math.round(p*100)}, bu kasada genelde %${Math.round(mp*100)}. Gruplar karışmış olabilir.`});break}}
  return out;
}

// Kullanıcı kartı "Kontrol edildi" diye onayladıysa uyarılar kalsa da rapor sorunlu sayılmaz (Luca'ya uyarısız aktarılır)
const isBad=r=>!r.kontrol&&(checks(r).some(c=>!c.ok)||(r.unsure&&r.unsure.length>0)||r.d.z_rapor_mu===false);
// Z No okunamadıysa: listedeki yakın tarihli raporlardan sırayla tahmin et (Z her gün bir artar) — turuncu kalır
const dnum=s=>{const m=String(s||'').match(/^(\d{2})\.(\d{2})\.(\d{4})$/);return m?Math.round(Date.UTC(+m[3],+m[2]-1,+m[1])/864e5):null};
function guessZ(r){}   // yerini autoZ aldı
// Z No: listedeki raporlar tarihe göre sıralanır; Z'si okunamayan / şüpheli olan rapora bir önceki kesin raporun Z'si + sıra farkı yazılır.
// Sonraki kesin rapor da varsa ikisi birbirini tutmalı (tutarsa kesin, tek taraftan ise turuncu). Elle yazılan Z'ye dokunulmaz.
function autoZ(){
  // Eski sürümlerin sıradan "düzelttiği" ama fişte iki yerde aynı basılı olan Z'leri geri al (ör. 3234 → 3233 yapılmıştı)
  for(const r of rows){if(r.status!=='done'||!r._zAuto||r._zManual||r._zBak||!/^\d+$/.test(String(r._zRead||''))||!r.ocr)continue;r._zBak=1;   // her rapor oturumda bir kez denetlenir
    let iki=false;try{const p=ZParse.parseZ(r.ocr).d;iki=!!p._zIki&&normZ(p.z_no)===String(r._zRead)}catch(e){}
    if(!iki)continue;
    r.d.z_no=String(r._zRead);r.d._zIki=true;r._zAuto=false;r.unsure=(r.unsure||[]).filter(k=>k!=='z_no');
    r.d.not=(r.d.not||'').split(' · ').filter(x=>!/^Z No (okunamadı|sıradan)/.test(x)).join(' · ');
    if(r.d.aciklama===r._ack){r.d.aciklama=mkAck(r.d);r._ack=r.d.aciklama}
    save(r)}
  const isNum=z=>/^\d+$/.test(String(z||''));
  // aynı günün raporları Z sırasıyla (hesaplanan eksik Z ile okunan Z aynı tarihi alabilir; eklenme sırası yanıltır)
  const done=rows.filter(r=>r.status==='done'&&dnum(r.d.tarih)!=null).sort((a,b)=>dnum(a.d.tarih)-dnum(b.d.tarih)||(isNum(a.d.z_no)&&isNum(b.d.z_no)?+a.d.z_no-+b.d.z_no:0)||(a.created||0)-(b.created||0));
  const sure0=r=>isNum(r.d.z_no)&&!r._zAuto&&!(r.unsure||[]).includes('z_no');
  // Kesin okunan Z'lerden en az bir başka kesin Z ile sırası tutanlar "dayanaklı"dır. Dayanaklı okuma varsa, hiçbiriyle tutmayan
  // kesin okuma (ör. 3934 → "3954") dayanak sayılmaz; komşularından düzeltilebilir (yine de yalnızca tek hane farkı varsa).
  const anch=new Set();
  for(let i=0;i<done.length;i++){if(!sure0(done[i]))continue;const ta=dn(done[i].d.tarih);
    for(let j=i+1;j<done.length;j++){const a=done[i],b=done[j];const dd=dn(b.d.tarih)-ta;if(dd>10)break;if(!sure0(b))continue;
      if(dd>0&&+b.d.z_no-+a.d.z_no===j-i){anch.add(a);anch.add(b)}}}
  const sure=r=>sure0(r)&&(!anch.size||anch.has(r));
  const like=(a,z)=>{a=String(a);z=String(z||'');if(!z||a===z)return true;if(a.length!==z.length)return a.endsWith(z)||a.startsWith(z)||z.endsWith(a)||z.startsWith(a);let n=0;for(let i=0;i<a.length;i++)if(a[i]!==z[i])n++;return n===1};
  let cur0;
  for(let i=0;i<done.length;i++){
    const r=done[i];if(r._zManual||r.hesap)continue;
    // Fişte okunan, emin olunan Z'ye dokunma: sıra farkı çoğu zaman satışsız (sıfır) Z'den ya da fotoğrafı eklenmemiş Z'den gelir
    // (29.10'da Z 3234 okunmuşken araya giren satışsız Z 3233 yüzünden 3233 yazılıyordu). Gerçek okuma hatasını checks() uyarır.
    if(sure0(r))continue;
    let p=null,n=null;
    for(let j=i-1;j>=0;j--)if(sure(done[j])){p=j;break}
    for(let j=i+1;j<done.length;j++)if(sure(done[j])){n=j;break}
    const t=dnum(r.d.tarih);
    const fp=p!=null&&t-dnum(done[p].d.tarih)<=10&&t-dnum(done[p].d.tarih)>=0?+done[p].d.z_no+(i-p):null;
    const fn=n!=null&&dnum(done[n].d.tarih)-t<=10&&dnum(done[n].d.tarih)-t>=0?+done[n].d.z_no-(n-i):null;
    if(fp!=null&&fn!=null&&fp!==fn)continue;          // komşular tutmuyor (araya rapor eksik / farklı firma): dokunma
    const z=fp??fn;if(z==null||z<1)continue;
    const cur=r.d.z_no;
    // aynı numara listede başka bir günün raporunda varsa yazma (aynı Z iki rapora verilmesin)
    if(rows.some(x=>x!==r&&x.status==='done'&&String(+x.d.z_no)===String(z)&&x.d.tarih!==r.d.tarih&&(!x.d.sicil||!r.d.sicil||x.d.sicil===r.d.sicil)))continue;
    if(sure(r)&&(+cur===fp||+cur===fn))continue;      // okunan Z sırayla tutuyor
    // arada fotoğrafı eklenmemiş gün olabilir: kesin okunan Z'yi ancak günler de ardışıksa (gün farkı = sıra farkı) düzelt
    // iki kesin okuma çelişiyor ve hiçbiri başka bir okumayla desteklenmiyorsa hangisinin yanlış olduğu bilinemez: dokunma (kontrol uyarısı çıkar)
    if(sure0(r)&&!anch.size)continue;
    if(sure0(r)){const dp=fp!=null?t-dnum(done[p].d.tarih):null,dn=fn!=null?dnum(done[n].d.tarih)-t:null;
      const consec=(fp!=null&&dp===i-p)||(fn!=null&&dn===n-i);if(!consec)continue}
    if(isNum(cur)&&!r._zAuto&&!like(z,cur))continue;  // okunan Z bambaşka bir sayı: başka firmanın raporu olabilir
    const src=fp!=null?done[p]:done[n],both=fp!=null&&fn!=null;
    const ack=r.d.aciklama===r._ack;
    {
      if(!r._zAuto)r._zRead=cur||'';
      r.d.z_no=String(z);r._zAuto=true;cur0=r._zRead;
      r.d.not=[(r.d.not||'').split(' · ').filter(x=>!/^Z No (okunamadı|sıradan)/.test(x)).join(' · '),`Z No sıradan hesaplandı: ${src.d.tarih} tarihli Z ${src.d.z_no} raporuna göre ${z}${cur0&&String(cur0)!==String(z)?` (fişte okunan: ${cur0})`:''}${both?' — önceki ve sonraki raporla doğrulandı':' — fişle kontrol et'}`].filter(Boolean).join(' · ');
      if(ack){r.d.aciklama=mkAck(r.d);r._ack=r.d.aciklama}
    }
    r.unsure=(r.unsure||[]).filter(k=>k!=='z_no');if(!both)r.unsure.push('z_no');
    save(r);
  }
}

// ---- Kümülatif toplam (KÜMSAT/KÜMKDV): aynı kasanın ardışık Z'leri ----
// İki Z'nin kümülatif farkı = sonrakinin satışı. Tutmazsa bir tutar yanlış okunmuştur; arada Z eksikse eksiklerin toplamı bulunur.
// Aynı kasa: sicil no ikisinde de okunduysa eşit olmalı ('kesin'); okunmadıysa tarih ileri, kümülatif artan ve yakın olmalı ('olasi').
function ayniKasa(a,b){
  if(a.d.sicil&&b.d.sicil)return a.d.sicil===b.d.sicil?'kesin':false;
  const ta=dnum(a.d.tarih),tb=dnum(b.d.tarih),gap=+b.d.z_no-+a.d.z_no;if(ta==null||tb==null||tb<=ta)return false;
  if(b.d.kum_sat-a.d.kum_sat<-0.005||(a.d.kum_kdv!=null&&b.d.kum_kdv!=null&&b.d.kum_kdv-a.d.kum_kdv<-0.005))return false;
  return tb-ta<=gap*7+7?'olasi':false}
function kumOnceki(r){const z=+r.d.z_no;if(!(z>0)||r.d.kum_sat==null)return null;let en=null;
  for(const x of rows){if(x===r||x.status!=='done'||x.d.kum_sat==null)continue;const zx=+x.d.z_no;if(!(zx>0)||zx>=z||z-zx>10)continue;
    const k=ayniKasa(x,r);if(k&&(!en||zx>+en.x.d.z_no))en={x,k}}
  return en}
function kumKontrol(r){
  const d=r.d,p=kumOnceki(r);if(!p)return [];
  const pz=+p.x.d.z_no,z=+d.z_no,gap=z-pz,ds=r2(d.kum_sat-p.x.d.kum_sat),s=r2(satis(d)),dk=d.kum_kdv!=null&&p.x.d.kum_kdv!=null?r2(d.kum_kdv-p.x.d.kum_kdv):null,k=r2(kdvT(d)),sert=p.k==='kesin';
  if(gap===1){
    if(Math.abs(ds-s)>0.01)return [{ok:!sert,info:!sert,m:`Kümülatif satış Z ${pz}'den bu yana ${fm(ds)} artmış ama bu raporun satışı ${fm(s)} (fark ${fm(r2(ds-s))}). Bir tutar ya da kümülatif yanlış okunmuş olabilir.`}];
    if(dk!=null&&Math.abs(dk-k)>0.05)return [{ok:!sert,info:!sert,m:`Kümülatif KDV Z ${pz}'den bu yana ${fm(dk)} artmış ama bu raporun KDV'si ${fm(k)}. Bir KDV tutarı yanlış okunmuş olabilir.`}];
    return [{ok:true,m:`Kümülatif satış Z ${pz} ile tutuyor`}];
  }
  // kümülatifi ikisinin arasında olan başka bir rapor varsa "eksik" o rapordur ama Z numarası tutmuyor: hesaplayıp ekleme önerme
  const ara=rows.find(x=>x!==r&&x!==p.x&&x.status==='done'&&x.d.kum_sat!=null&&x.d.kum_sat>p.x.d.kum_sat+0.005&&x.d.kum_sat<d.kum_sat-0.005&&(!x.d.sicil||!d.sicil||x.d.sicil===d.sicil));
  if(ara)return [{ok:false,m:`Z ${pz} ile bu rapor arasında kümülatifi tutan bir rapor var (${ara.d.tarih}, Z ${ara.d.z_no||'—'}) ama Z numaraları sırayla gitmiyor. Z numaralarını fişle kontrol et.`}];
  const eS=r2(ds-s),eK=dk==null?null:r2(dk-k);
  if(eS<-0.01)return [{ok:!sert,info:!sert,m:`Kümülatif satış Z ${pz}'den bu yana ${fm(ds)} artmış; bu raporun satışından (${fm(s)}) az. Bir tutar yanlış okunmuş olabilir.`}];
  // aradaki numaralardan biri listede varsa (kümülatifi okunmamış olsa da) eksik sayma
  if(rows.some(x=>x!==r&&x.status==='done'&&+x.d.z_no>pz&&+x.d.z_no<z&&(!x.d.sicil||!d.sicil||x.d.sicil===d.sicil)))return [];
  if(gap===2){const ez=pz+1;
    if(Math.abs(eS)<=0.01)return [{info:true,ok:true,m:`Z ${ez} listede yok; kümülatife göre o raporda satış yok (0,00). Luca'ya girilecek tutar yok.`}];
    return [{info:true,ok:true,m:`Z ${ez} listede yok. Kümülatife göre satışı ${fm(eS)}${eK!=null?`, KDV'si ${fm(eK)}`:''}.`,act:{l:`Z ${ez}'i hesaplayıp ekle`,a:`data-eksik="${r.id}"`}}]}
  return [{info:true,ok:true,m:`Z ${pz+1}–${z-1} (${gap-1} rapor) listede yok. Kümülatife göre toplam satışları ${fm(eS)}${eK!=null?`, KDV'leri ${fm(eK)}`:''}. Ayrı ayrı hesaplanamaz; fişlerini ekle.`}];
}
// Toplam satış ve KDV'yi oranlara böl: en fazla iki oran (komşu raporlarda kullanılanlar) varsa kesin çözülür.
function oranBol(S,K,oranlar){const pay=o=>o/(100+o),L=[...oranlar];
  if(!L.length)return null;
  if(L.length===1){const o=L[0];return Math.abs(S*pay(o)-K)<=0.05+S*0.0005?{[o]:r2(S)}:null}
  if(L.length===2){const [a,b]=L,pa=pay(a),pb=pay(b);const ga0=(S*pb-K)/(pb-pa);if(ga0<-0.01||S-ga0<-0.01)return null;
    // Fişte KDV'ler grup grup kuruşa yuvarlanır: ±1 TL içinde KDV'yi kuruşu kuruşuna tutturanlardan en yuvarlak tutarı seç
    const yuv=x=>{const c=Math.round(Math.abs(x)*100);return c%100===0?3:c%50===0?2:c%10===0?1:0};let en=null;
    for(let i=-100;i<=100;i++){const ga=r2(Math.round(ga0*100)/100+i/100),gb=r2(S-ga);if(ga<0||gb<0)continue;
      if(Math.abs(r2(r2(ga*pa)+r2(gb*pb))-K)>0.005)continue;const p=[Math.min(yuv(ga),yuv(gb)),-Math.abs(i)];if(!en||p[0]>en.p[0]||(p[0]===en.p[0]&&p[1]>en.p[1]))en={ga,gb,p}}
    return en?{[a]:en.ga,[b]:en.gb}:{[a]:r2(Math.max(0,ga0)),[b]:r2(Math.max(0,S-ga0))}}
  return null}
const kullanilanOranlar=(...ds)=>{const o=new Set();for(const d of ds){if(d.tekel>0)o.add(0);if(d.g1>0)o.add(1);if(d.g10>0)o.add(10);if(d.g20>0||d.gp>0)o.add(20)}return o};
const gunStr=n=>{const t=new Date(n*864e5);return `${String(t.getUTCDate()).padStart(2,'0')}.${String(t.getUTCMonth()+1).padStart(2,'0')}.${t.getUTCFullYear()}`};
function eksikZEkle(r){
  const p=kumOnceki(r);if(!p||+r.d.z_no-+p.x.d.z_no!==2){toast('Eksik Z artık hesaplanamıyor');return}
  if(rows.some(x=>x!==r&&x!==p.x&&x.status==='done'&&x.d.kum_sat!=null&&x.d.kum_sat>p.x.d.kum_sat+0.005&&x.d.kum_sat<r.d.kum_sat-0.005)){toast('Aradaki rapor listede var; önce Z numaralarını kontrol et');return}
  if(Math.abs(r2(r.d.kum_sat-p.x.d.kum_sat-satis(r.d)))<=0.01){toast(`Z ${+p.x.d.z_no+1}'de satış yok; eklenecek tutar yok`);return}
  const a=p.x.d,b=r.d,ez=+a.z_no+1,S=r2(b.kum_sat-a.kum_sat-satis(b)),K=b.kum_kdv!=null&&a.kum_kdv!=null?r2(b.kum_kdv-a.kum_kdv-kdvT(b)):null;
  const bol=K==null?null:oranBol(S,K,kullanilanOranlar(a,b));
  const ta=dnum(a.tarih),tb=dnum(b.tarih),tah=ta!=null&&tb!=null?gunStr(Math.min(ta+1,tb)):(b.tarih||'');
  const d={tarih:tah,z_no:String(ez),tekel:0,g1:0,m1:null,k1:null,g10:0,m10:null,k10:null,g20:0,m20:null,k20:null,gp:null,mp:null,kp:null,kart:null,nakit:null,genel:S,
    kum_sat:r2(a.kum_sat+S),kum_kdv:K==null?null:r2(a.kum_kdv+K),sicil:b.sicil||a.sicil||null};
  const unsure=['tarih','kart','nakit'];
  if(bol){d.tekel=bol[0]||0;d.g1=bol[1]||0;d.g10=bol[10]||0;d.g20=bol[20]||0}
  else{for(const x of ['tekel','g1','g10','g20'])d[x]=null;unsure.push('tekel','g1','g10','g20')}
  const auto=fill(d);
  d.not=`Hesaplandı: Z ${a.z_no} ve Z ${b.z_no} kümülatif farkından (satış ${fm(S)}${K!=null?`, KDV ${fm(K)}`:''}).${bol?'':' Oran dağılımı hesaplanamadı (ikiden fazla oran ya da KDV tutmuyor); fişten gir.'} Tarih tahmini; nakit ve kart fişten girilmeli.`;
  d.aciklama=mkAck(d);
  const y={id:uid(),status:'done',d,unsure,auto,src:'hesap',created:Date.now(),open:true,_ack:d.aciklama,hesap:{onceki:a.z_no,sonraki:b.z_no,onay:false}};
  rows.push(y);save(y);autoZ();render();toast(`Z ${ez} hesaplanıp eklendi; fişle doğrula`);
}
function hesapKontrol(r){if(!r.hesap)return [];
  return r.hesap.onay?[{info:true,ok:true,m:`Z ${r.hesap.onceki} ve Z ${r.hesap.sonraki} kümülatiflerinden hesaplandı, sen doğruladın.`}]
    :[{ok:false,m:'Bu rapor fişten okunmadı, kümülatiflerden hesaplandı. Tarihi, oranları, nakit ve kartı fişle karşılaştır, sonra doğrula. Doğrulanana kadar Luca’ya aktarılmaz.',act:{l:'Doğruladım',a:`data-hesaponay="${r.id}"`}}]}

// ---- Slip / kartlı işlem sayısı ile kart tutarı çelişmesin (nakit ↔ kart karışmasını yakalar) ----
function slipKontrol(r){const d=r.d,k=d.kart||0;if(r.hesap||d.kart==null)return [];
  const kaynak=[[d.slip,'slip fiş sayısı'],[d.kart_adet,'kartlı işlem sayısı']].filter(([n])=>n!=null);if(!kaynak.length)return [];
  const celisen=kaynak.filter(([n])=>(n===0&&k>0.005)||(n>0&&k<0.005));if(!celisen.length)return [];
  const sert=celisen.length===2;   // tek satırdaki sayı yanlış okunmuş olabilir (Tesseract "0"ı "2"/"5" okuyor): o zaman yalnız not
  const [n,ad]=celisen[0];
  return [{ok:!sert,info:!sert,m:n===0?`Fişte ${ad} 0 ama kredi kartı ${fm(k)} okundu. Nakit ile kart karışmış olabilir.`:`Fişte ${ad} ${n} ama kredi kartı 0 okundu. Kart tutarı okunamamış ya da nakde yazılmış olabilir.`}]}
