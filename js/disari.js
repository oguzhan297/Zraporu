// Dışa aktarma: Luca CSV (Windows-1254), Excel, panoya tablo
function sorted(){return rows.filter(r=>r.status==='done').slice().sort((a,b)=>{const p=s=>{const m=String(s||'').match(/(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/);return m?(+(m[3].length===2?'20'+m[3]:m[3]))*10000+(+m[2])*100+(+m[1]):0};return p(a.d.tarih)-p(b.d.tarih)||String(a.d.z_no).localeCompare(String(b.d.z_no),'tr',{numeric:true})})}
const cell=(f,v)=>v==null||v===''?'':f.t==='num'?(Math.round((v+Number.EPSILON*Math.sign(v||1))*100)/100+0).toFixed(2).replace('.',','):String(v).replace(/[;\r\n\t]/g,' ');
function csvText(){return [OUT.map(f=>f.c).join(';'),...sorted().map(r=>OUT.map(f=>cell(f,r.d[f.k])).join(';'))].join('\r\n')}
const W1254={'’':0x92,'‘':0x91,'“':0x93,'”':0x94,'–':0x96,'—':0x97,'€':0x80,'…':0x85,'é':0xE9,'É':0xC9,'à':0xE0,'á':0xE1,'è':0xE8,'í':0xED,'ó':0xF3,'ú':0xFA,'ñ':0xF1,'ä':0xE4,'Ä':0xC4,'ß':0xDF,'é':0xE9,'Ç':0xC7,'ç':0xE7,'Ğ':0xD0,'ğ':0xF0,'İ':0xDD,'ı':0xFD,'Ö':0xD6,'ö':0xF6,'Ş':0xDE,'ş':0xFE,'Ü':0xDC,'ü':0xFC,'Â':0xC2,'â':0xE2,'Î':0xCE,'î':0xEE,'Û':0xDB,'û':0xFB};
function enc1254(s){s=s.replace(/₺/g,'TL');const out=[];for(const c of s){const n=c.codePointAt(0);out.push(n<128?n:(W1254[c]??0x3F))}return new Uint8Array(out)}
function fname(ext){const d=new Date();return `Z_Raporlari_${String(d.getDate()).padStart(2,'0')}-${String(d.getMonth()+1).padStart(2,'0')}-${d.getFullYear()}.${ext}`}
const MIME={csv:'text/csv',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',json:'application/json'};
async function offer(name,data){
  const blob=new Blob([data],{type:MIME[name.split('.').pop()]||'application/octet-stream'});
  const ios=/iPhone|iPad|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  if(ios&&navigator.canShare){const file=new File([blob],name,{type:blob.type});if(navigator.canShare({files:[file]})){try{await navigator.share({files:[file]});return}catch(e){if(e&&e.name==='AbortError')return}}}
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();
  setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},5000);toast('Dosya indirildi: '+name);
}
function guard(btn,label){
  const bad=rows.filter(r=>r.status==='done'&&isBad(r)).length, pend=rows.filter(r=>r.status==='work'||r.status==='queued'||r.status==='error').length;
  if(!bad&&!pend)return true;
  if(btn.dataset.armed==='1'){btn.dataset.armed='';btn.textContent=label;return true}
  btn.dataset.armed='1';btn.textContent='Yine de indir?';
  toast([bad?`${bad} raporda uyarı var`:'',pend?`${pend} rapor henüz okunmadı / hatalı, dosyaya girmez`:''].filter(Boolean).join(' · '));
  setTimeout(()=>{btn.dataset.armed='';btn.textContent=label},4000);return false;
}
$('#csv').onclick=e=>{if(!guard(e.currentTarget,'⬇ Luca CSV'))return;offer(fname('csv'),new Blob([enc1254(csvText()+'\r\n')]))};
$('#xlsx').onclick=async e=>{if(!guard(e.currentTarget,'Excel'))return;
  if(typeof XLSX==='undefined'){toast('Excel kütüphanesi yüklenemedi; CSV’yi kullan.');return}
  const body=sorted().map(r=>OUT.map(f=>r.d[f.k]??(f.t==='text'?'':null)));
  const ws=XLSX.utils.aoa_to_sheet([OUT.map(f=>f.c),...body]);
  const ncols=OUT.map((f,i)=>f.t==='num'?i:-1).filter(i=>i>=0);
  for(let r=1;r<=body.length;r++)for(const c of ncols){const a=XLSX.utils.encode_cell({r,c});if(ws[a])ws[a].z='#,##0.00'}
  ws['!cols']=OUT.map(f=>({wch:f.k==='aciklama'?22:Math.max(11,f.c.length+1)}));
  const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'Z Raporları');
  offer(fname('xlsx'),new Blob([XLSX.write(wb,{type:'array',bookType:'xlsx'})]));
};
$('#copy').onclick=async()=>{
  try{await navigator.clipboard.writeText(csvText().replace(/;/g,'\t'));toast('Kopyalandı — Excel’de A1 hücresine yapıştır')}catch(e){toast('Kopyalanamadı')}
};
