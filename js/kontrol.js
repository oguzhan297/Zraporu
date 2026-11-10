// Kontroller: toplamların, KDV'lerin, ödemelerin tutarlılığı; Z no sırası (autoZ)
function checks(r){
  const d=r.d,out=[];
  const names={g1:'%1',g10:'%10',g20:'%20',gp:'Poşet'};
  if(!d.tarih)out.push({ok:false,m:'Tarih boş'});
  else if(!dateOk(d.tarih))out.push({ok:false,m:`Tarih geçersiz veya GG.AA.YYYY biçiminde değil: “${d.tarih}”`});
  if(!d.z_no)out.push({ok:false,m:'Z No boş'});
  else if(rows.some(x=>x!==r&&x.status==='done'&&x.d.z_no&&String(x.d.z_no).replace(/^0+/,'')===String(d.z_no).replace(/^0+/,'')&&x.d.tarih===d.tarih))out.push({ok:false,m:'Aynı tarih ve Z No ile listede başka bir rapor var — iki kez eklenmiş olabilir'});
  // Z sırası: yakın tarihli raporlara göre beklenen Z'ye çok benziyor ama farklıysa (eksik/yanlış hane) uyar.
  // Birden fazla firmanın fişleri aynı listede olabilir: beklenen Z en az iki ayrı raporla desteklenmeli (aynı kasanın sırası),
  // eksik/fazla hane tahmini yalnız 3+ haneli numaralarda yapılır (3 ↔ 3069 gibi kısa numaralar rastlantıyla benzer).
  {const t=dnum(d.tarih),z=String(d.z_no||'');if(t!=null&&/^\d+$/.test(z)){
    const say=new Map();
    for(const x of rows){if(x===r||x.status!=='done'||!/^\d+$/.test(String(x.d.z_no||'')))continue;const tx=dnum(x.d.tarih);if(tx==null||tx===t||Math.abs(tx-t)>3)continue;
      const e=+x.d.z_no-(tx-t);say.set(e,(say.get(e)||0)+1)}
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
  return out;
}
// Olağandışı değer: aynı yazar kasanın yakın günleri (Z sırası tarihle uyumlu olanlar) ile karşılaştır. Uyarı değil, bilgi (ⓘ).
function olagandisi(r){
  const d=r.d,t=dnum(d.tarih),z=+d.z_no,s=satis(d);if(t==null||!(z>0)||!(s>0))return [];
  const kom=rows.filter(x=>x!==r&&x.status==='done'&&satis(x.d)>0&&/^\d+$/.test(String(x.d.z_no||''))&&dnum(x.d.tarih)!=null).filter(x=>{
    const dt=dnum(x.d.tarih)-t,dz=+x.d.z_no-z;return dt!==0&&Math.abs(dt)<=45&&Math.abs(dz-dt)<=Math.max(3,Math.abs(dt)*.3)});
  if(kom.length<4)return [];
  const med=a=>{const s=a.slice().sort((p,q)=>p-q),m=s.length>>1;return s.length%2?s[m]:(s[m-1]+s[m])/2};
  const out=[],ms=med(kom.map(x=>satis(x.d)));
  if(s<ms*.35||s>ms*2.6)out.push({ok:true,info:true,m:`Günlük satış (${fm(s)}) bu kasanın yakın günlerine göre olağandışı ${s<ms?'düşük':'yüksek'} (ortanca ${fm(ms)}). Fişle karşılaştır.`});
  const ad={tekel:'Tekel',g1:'%1',g10:'%10',g20:'%20'};
  for(const k of Object.keys(ad)){const p=(d[k]||0)/s,mp=med(kom.map(x=>(x.d[k]||0)/satis(x.d)));
    if(Math.abs(p-mp)>.35){out.push({ok:true,info:true,m:`${ad[k]} payı %${Math.round(p*100)}, bu kasada genelde %${Math.round(mp*100)}. Gruplar karışmış olabilir.`});break}}
  return out;
}

const isBad=r=>checks(r).some(c=>!c.ok)||(r.unsure&&r.unsure.length>0)||r.d.z_rapor_mu===false;
// Z No okunamadıysa: listedeki yakın tarihli raporlardan sırayla tahmin et (Z her gün bir artar) — turuncu kalır
const dnum=s=>{const m=String(s||'').match(/^(\d{2})\.(\d{2})\.(\d{4})$/);return m?Math.round(Date.UTC(+m[3],+m[2]-1,+m[1])/864e5):null};
function guessZ(r){}   // yerini autoZ aldı
// Z No: listedeki raporlar tarihe göre sıralanır; Z'si okunamayan / şüpheli olan rapora bir önceki kesin raporun Z'si + sıra farkı yazılır.
// Sonraki kesin rapor da varsa ikisi birbirini tutmalı (tutarsa kesin, tek taraftan ise turuncu). Elle yazılan Z'ye dokunulmaz.
function autoZ(){
  const done=rows.filter(r=>r.status==='done'&&dnum(r.d.tarih)!=null).sort((a,b)=>dnum(a.d.tarih)-dnum(b.d.tarih)||(a.created||0)-(b.created||0));
  const isNum=z=>/^\d+$/.test(String(z||''));
  const sure0=r=>isNum(r.d.z_no)&&!r._zAuto&&!(r.unsure||[]).includes('z_no');
  // Kesin okunan Z'lerden en az bir başka kesin Z ile sırası tutanlar "dayanaklı"dır. Dayanaklı okuma varsa, hiçbiriyle tutmayan
  // kesin okuma (ör. 3934 → "3954") dayanak sayılmaz; komşularından düzeltilebilir (yine de yalnızca tek hane farkı varsa).
  const anch=new Set();
  for(let i=0;i<done.length;i++)for(let j=i+1;j<done.length;j++){const a=done[i],b=done[j];if(!sure0(a)||!sure0(b))continue;
    const dd=dnum(b.d.tarih)-dnum(a.d.tarih);if(dd>0&&dd<=10&&+b.d.z_no-+a.d.z_no===j-i){anch.add(a);anch.add(b)}}
  const sure=r=>sure0(r)&&(!anch.size||anch.has(r));
  const like=(a,z)=>{a=String(a);z=String(z||'');if(!z||a===z)return true;if(a.length!==z.length)return a.endsWith(z)||a.startsWith(z)||z.endsWith(a)||z.startsWith(a);let n=0;for(let i=0;i<a.length;i++)if(a[i]!==z[i])n++;return n===1};
  let cur0;
  for(let i=0;i<done.length;i++){
    const r=done[i];if(r._zManual)continue;
    let p=null,n=null;
    for(let j=i-1;j>=0;j--)if(sure(done[j])){p=j;break}
    for(let j=i+1;j<done.length;j++)if(sure(done[j])){n=j;break}
    const t=dnum(r.d.tarih);
    const fp=p!=null&&t-dnum(done[p].d.tarih)<=10&&t-dnum(done[p].d.tarih)>=0?+done[p].d.z_no+(i-p):null;
    const fn=n!=null&&dnum(done[n].d.tarih)-t<=10&&dnum(done[n].d.tarih)-t>=0?+done[n].d.z_no-(n-i):null;
    if(fp!=null&&fn!=null&&fp!==fn)continue;          // komşular tutmuyor (araya rapor eksik / farklı firma): dokunma
    const z=fp??fn;if(z==null||z<1)continue;
    const cur=r.d.z_no;
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
