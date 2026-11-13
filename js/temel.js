// Temel: alan tanımları, matrah/KDV tamamlama, sayı-tarih biçimleri, küçük yardımcılar (her dosya bunlara dayanır)
// Uygulama sürümü: arac/surum.mjs ile değiştir (index.html, sw.js, parser.js, işçi aynı anda güncellenir)
const APP_VER=87;
// Her sürümde kullanıcıya gösterilecek kısa notlar (güncellemeden sonra bir kez gösterilir). Yeni sürümde buraya ekle.
const YENILIK={
  88:['Hızlı okuyucu: ayar kapanınca gerçekten kapalı kalır. Ekran kartının ilk açılışına daha uzun süre tanınır; 3 fişten sonra işlemciden yavaşsa kendiliğinden kapanır.'],
  87:['Fişin altındaki “PARAMETRE YÜKLEME / Versiyon” satırındaki başka tarih yüzünden tarih gereksiz yere turuncu çıkıyordu; düzeltildi'],
  86:['Hızlı okuyucu açılamazsa nedeni Ayarlar’da yazar ve test arşivine otomatik gider; ilk açılış için daha uzun beklenir.'],
  85:['Deneme: Ayarlar’da “Hızlı okuyucu” — okuma ekran kartında yapılır (daha hızlı ve serin olabilir). Açarsan ~30 MB daha iner; sorun çıkarsa kendiliğinden kapanır. Ayarlar’da ortalama okuma süreleri görünür'],
  84:['Raporları tek tek “Kontrol edildi” diye onaylarken fotoğrafları bellekte birikiyor, uzun süre sonra uygulama kendiliğinden kapanabiliyordu; düzeltildi'],
  83:['“Kontrol et” çıkan raporlar ve düzeltip “Kontrol edildi” dediklerin test arşivine kendiliğinden gider (Ayarlar’dan kapatılabilir); okuyucu bunlarla iyileştirilir','Fotoğrafı büyütmek artık tam ekran görüntüleyicide (dokun: yakınlaştır, ✕: kapat); büyütünce kapanma düzeltildi','Telefon ısınıp okuma yavaşlarsa fişler arasındaki ara kendiliğinden uzar','Okuma sürerken kamera açılırsa okuma bekler'],
  82:['Arka arkaya çekim: kare basar basmaz alınır, deklanşör kilitlenmez; çekildiği parlama, çerçeve nabzı ve titreşimle belli olur','Kamera açıkken okuma yapılmaz (birlikte telefonu zorluyor, uygulamayı kapatıyordu); kamerayı kapatınca hepsi sırayla okunur','Çerçeve daha uzun ve geniş, dışı daha az karartılır; fişin üstü ve altı için ek pay','Okunamayan fiş bir kez kendiliğinden yeniden okunur'],
  81:['Kamera izni bir açılışta bir kez sorulur: kamerayı kapatıp 3 dakika içinde yeniden açınca tekrar sormaz (iPhone ana ekran uygulamalarında izni kalıcı yapmaya izin vermiyor)'],
  80:['Kara kutu: uygulama okurken kendiliğinden kapanırsa, yeniden açılışta nedenini bulmamız için kısa bir kayıt (adımlar, fotoğraf boyutları; fiş tutarları değil) gizli gelen kutusuna gider'],
  79:['Okurken kaydırınca uygulamanın kapanması: listede artık küçük resimler gösteriliyor, okunan fotoğraflar bellekten bırakılıyor, büyük fotoğraflar okumadan önce küçültülüyor','Uygulama okurken kapanırsa çektiğin fotoğraflar kaybolmaz; yeniden açınca okuma kaldığı yerden sürer','Kartta Sil ve Hata bildir düğme olarak'],
  78:['Uygulama içi kamera yalnız çerçevenin içini çeker (yandaki / alttaki fiş okunmaz)','Fotoğrafta başka bir Z raporunun parçası da varsa yalnız asıl rapor okunur','Kartta “Kontrol edildi” düğmesi: fişle karşılaştırıp onayladığın rapor “Tamam” sayılır','Tarihi kısa yaz: 2910 → 29.10.2026; tarih ve Z No’da sayı klavyesi','Hata bildirimi daha hızlı gider','Alt çubuk (Luca CSV) artık kaybolmaz','KUPON ile ödenen tutar nakde eklenir'],
  77:['Luca/Excel dosyası çok raporla daha hızlı hazırlanır'],
  76:['Uygulama çok raporla çok daha hızlı açılır (kapalı kartlar çizilmez, kontroller bir kez hesaplanır, Excel kütüphanesi sonradan yüklenir)','Uzun seri okumada fişler arasında kısa ara: telefon daha az ısınır'],
  75:['Okunan raporların kartları kapalı gelir; görmek istediğine dokunup açarsın'],
  74:['Okuyucu (PaddleOCR) kendiliğinden iner; ekran kapanıp indirme yarıda kalırsa uygulamaya dönünce kaldığı yerden sürer, indirirken ekran açık tutulur','Arka arkaya çekimde sol alttaki küçük resme dokununca uygulama kapanmaz; kamera kapanıp listeye döner'],
  73:['Fişte okunan Z numarası artık sıradan tahminle değiştirilmez (araya satışsız Z girince yanlış numara yazılıyordu); daha önce yanlış değiştirilenler kendiliğinden düzeldi','Kümülatifi arada kalan bir rapor varsa “eksik Z hesapla” önerilmez; satışsız Z’ye tutar eklenmez'],
  72:['Güncellemeler artık aynı adresteki Tahsilat uygulamasının internetsiz açılmasını bozmaz'],
  69:['PaddleOCR okuyucusu önceden indirilebilir: Ayarlar’da durumu görünür, açılışta tek dokunuşla indirme önerisi (Wi-Fi’da Android kendiliğinden indirir)'],
  68:['Yeni sürüm yayınlanınca üstte “Yeni sürüm hazır” çıkar; dokununca güncellenir','Güncellemeden sonra bu “Yenilikler” listesi gösterilir'],
  67:['Slip fiş sayısı / kartlı işlem sayısı ile kredi kartı tutarı çelişirse uyarı'],
  65:['Kümülatif toplam kontrolü: ardışık Z’lerin KÜMSAT farkı günün satışıyla karşılaştırılır','Eksik Z bulunur; tek eksik Z kümülatiflerden hesaplanıp eklenebilir (doğrulanmadan Luca’ya gitmez)'],
  63:['Klavye açıkken alt çubuk gizlenir'],
  61:['Her kartta “Hata bildir”; bildirim doğrudan gizli gelen kutusuna gider'],
  60:['“Fotoğraf çek” uygulama içi kamerayla: çerçeve, fener, bulanıklık kontrolü']
};
const FIELDS=[
  {k:'tarih',l:'Tarih',c:'TARİH',t:'text',sec:'Genel'},
  {k:'z_no',l:'Z No',c:'Z NO',t:'text'},
  {k:'aciklama',l:'Açıklama',c:'AÇIKLAMA',t:'text',full:true},
  {k:'tekel',l:'Genel Toplam Tekel',c:'GENEL TOPLAM TEKEL',t:'num',sec:'Tekel',full:true},
  {k:'g1',l:'Genel Toplam %1',c:'GENEL TOPLAM %1',t:'num',sec:'%1 KDV',full:true},
  {k:'m1',l:'%1 Matrah',c:'%1 MATRAH',t:'num'},{k:'k1',l:'%1 KDV',c:'%1 KDV',t:'num'},
  {k:'g10',l:'Genel Toplam %10',c:'GENEL TOPLAM %10',t:'num',sec:'%10 KDV',full:true},
  {k:'m10',l:'%10 Matrah',c:'%10 MATRAH',t:'num'},{k:'k10',l:'%10 KDV',c:'%10 KDV',t:'num'},
  {k:'g20',l:'Genel Toplam %20',c:'GENEL TOPLAM %20',t:'num',sec:'%20 KDV (poşet hariç)',full:true},
  {k:'m20',l:'%20 Matrah',c:'%20 MATRAH',t:'num'},{k:'k20',l:'%20 KDV',c:'%20 KDV',t:'num'},
  {k:'gp',l:'Genel Toplam Poşet',c:'GENEL TOPLAM POŞET',t:'num',sec:'Poşet (%20)',full:true},
  {k:'mp',l:'%20 Poşet Matrah',c:'%20 POŞET MATRAH',t:'num'},{k:'kp',l:'%20 Poşet KDV',c:'%20 POŞET KDV',t:'num'},
  {k:'kart',l:'Kredi Kartı',c:'KREDİ KARTI',t:'num',sec:'Ödeme'},
  {k:'nakit',l:'Nakit',c:'NAKİT',t:'num'},
  {k:'genel',l:'Fişteki Genel Toplam (sadece kontrol)',t:'num',sec:'Kontrol — Luca’ya aktarılmaz',full:true,x:true},
  {k:'kum_sat',l:'Kümülatif satış',t:'num',x:true},{k:'kum_kdv',l:'Kümülatif KDV',t:'num',x:true},
  {k:'not',l:'Not (aktarılmaz)',t:'text',full:true,x:true}
];
const OUT=FIELDS.filter(f=>!f.x);
const GROUPS=[['g1','m1','k1'],['g10','m10','k10'],['g20','m20','k20'],['gp','mp','kp']];
const r2=n=>Math.round(n*100)/100;
const RATE={g1:.01,g10:.10,g20:.20,gp:.20};
function fillGroup(d,[g,m,k],auto){
  const set=(key,v)=>{d[key]=r2(v);auto.push(key)};
  if(d[g]!=null&&d[m]==null&&d[k]==null){set(m,d[g]/(1+RATE[g]));set(k,d[g]-d[m])}
  else if(d[g]==null&&d[m]!=null&&d[k]!=null)set(g,d[m]+d[k]);
  else if(d[m]==null&&d[g]!=null&&d[k]!=null)set(m,d[g]-d[k]);
  else if(d[k]==null&&d[g]!=null&&d[m]!=null)set(k,d[g]-d[m]);
  else if(d[g]==null&&d[m]!=null&&d[k]==null){set(k,d[m]*RATE[g]);set(g,d[m]+d[k])}
}
function fill(d,auto=[]){for(const G of GROUPS)fillGroup(d,G,auto);return auto}
function refill(r,key){
  r.auto=(r.auto||[]).filter(k=>k!==key);
  const G=GROUPS.find(G=>G.includes(key));if(!G)return;
  // Genel toplam elle yazıldıysa matrah ve KDV her zaman ondan yeniden hesaplanır
  if(key===G[0]){const [g,m,k]=G;r.d[m]=r.d[k]=null;r.auto=r.auto.filter(x=>x!==m&&x!==k);
    if(r.d[g]!=null){fillGroup(r.d,G,r.auto);if(r.unsure)r.unsure=r.unsure.filter(x=>x!==m&&x!==k)}return}
  for(const k of G)if(r.auto.includes(k)){r.d[k]=null;r.auto=r.auto.filter(x=>x!==k)}
  fillGroup(r.d,G,r.auto);
}
function normDate(s){
  s=String(s||'').trim();let m;
  if(m=s.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})$/))return `${m[3].padStart(2,'0')}.${m[2].padStart(2,'0')}.${m[1]}`;
  if(m=s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2}|\d{4})$/))return `${m[1].padStart(2,'0')}.${m[2].padStart(2,'0')}.${m[3].length===2?'20'+m[3]:m[3]}`;
  // Elle kısa yazım (sayısal klavye): "2910" → 29.10.<yıl>, "29102026" / "291026" → tam tarih, "29,10" / "29.10" / "9 10" de olur.
  // Yıl yazılmadıysa bu yıl; tarih ileriye düşerse (Ocak'ta 2912 yazılınca) geçen yıl.
  let g,a,y=null;
  if(m=s.match(/^(\d{1,2})[.,/\-\s](\d{1,2})$/)){g=+m[1];a=+m[2]}
  else if(m=s.match(/^(\d{2})(\d{2})(\d{4}|\d{2})?$/)){g=+m[1];a=+m[2];if(m[3])y=m[3].length===2?2000+(+m[3]):+m[3]}
  else if(m=s.match(/^(\d)(\d{2})$/)){g=+m[1];a=+m[2]}
  else return s;
  if(!(g>=1&&g<=31&&a>=1&&a<=12))return s;
  if(y==null){const b=new Date();y=b.getFullYear();if(Date.UTC(y,a-1,g)>Date.UTC(y,b.getMonth(),b.getDate())+864e5)y--}
  return `${String(g).padStart(2,'0')}.${String(a).padStart(2,'0')}.${y}`;
}
function dateOk(s){const m=String(s||'').match(/^(\d{2})\.(\d{2})\.(\d{4})$/);if(!m)return false;const d=new Date(+m[3],+m[2]-1,+m[1]);return d.getDate()===+m[1]&&d.getMonth()===+m[2]-1&&+m[3]>=2000&&d<=new Date(Date.now()+864e5)}
const satis=d=>['tekel','g1','g10','g20','gp'].reduce((a,k)=>a+(d[k]||0),0);
const kdvT=d=>['k1','k10','k20','kp'].reduce((a,k)=>a+(d[k]||0),0);
let ACK='Z RAPORU';
const normZ=z=>{z=String(z??'').trim();return /^\d+$/.test(z)?z.replace(/^0+(?=\d)/,''):z};
try{const a=localStorage.getItem('zrapor_ack');if(a&&a!=='Z RAPORU {z}')ACK=a}catch(e){}
const mkAck=d=>ACK.split('{z}').join(d.z_no||'').split('{tarih}').join(d.tarih||'').replace(/\s+/g,' ').trim();
const NUMK=FIELDS.filter(f=>f.t!=='text').map(f=>f.k);
const LS='zrapor_rows_v2';
let rows=[];let queue=[],busy=false;
const $=s=>document.querySelector(s);
const ik=a=>`<svg class="ik"><use href="#i-${a}"/></svg>`;   // ikon (index.html’deki SVG setinden)


function pn(v){
  if(v===null||v===undefined)return null;
  if(typeof v==='number')return isFinite(v)?v:null;
  let s=String(v).trim().replace(/\s|₺|TL|\*/gi,'');
  if(!s)return null;
  if(s.includes(',')) s=s.replace(/\./g,'').replace(',','.');
  else if(/\.\d{3}$/.test(s)&&!/\.\d{3}\./.test(s)&&s.split('.').length>=2&&/^\d{1,3}(\.\d{3})+$/.test(s)) s=s.replace(/\./g,'');
  const n=parseFloat(s);return isFinite(n)?n:null;
}
const fm=n=>n==null?'':n.toLocaleString('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:2});
const fv=(f,v)=>v==null?'':(f.t==='num'?fm(v):f.t==='int'?String(v):String(v));
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const uid=()=>Math.random().toString(36).slice(2,10);
function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('show');clearTimeout(t._t);t._t=setTimeout(()=>t.classList.remove('show'),2600)}
function notice(m){const n=$('#notice');n.style.display=m?'block':'none';n.textContent=m||''}
function loadScript(src){return new Promise((res,rej)=>{const s=document.createElement('script');s.src=src;s.onload=res;s.onerror=()=>rej(new Error('Yazı tanıma aracı indirilemedi. İnternet bağlantını kontrol et.'));document.head.appendChild(s)})}
function openImage(src){return new Promise((res,rej)=>{const u=URL.createObjectURL(src),im=new Image();im.onload=()=>{URL.revokeObjectURL(u);res(im)};im.onerror=()=>{URL.revokeObjectURL(u);rej(new Error('Fotoğraf açılamadı'))};im.src=u})}
function setProg(r,txt){r.prog=txt;const el=document.querySelector(`#c_${r.id} .t2`);if(el)el.textContent=txt}
