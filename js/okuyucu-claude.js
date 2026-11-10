// Okuyucu 3: Claude API (fotoğraf + talimat → JSON)
const PROMPT=`Bu fotoğraf Türkiye'de kullanılan bir yazar kasa / ÖKC "Z RAPORU" fişidir. Fişi dikkatle oku ve YALNIZCA aşağıdaki JSON nesnesini döndür; başka hiçbir metin yazma.
{
 "z_rapor_mu": true veya false,
 "tarih": "GG.AA.YYYY",
 "z_no": "Z numarası, metin olarak (ör. \\"0123\\")",
 "tekel": TEKEL / SİGARA / tütün mamulleri satışlarının KDV dahil toplamı,
 "g1": %1 KDV'li satışların KDV dahil toplamı, "m1": %1 matrah, "k1": %1 KDV,
 "g10": %10 KDV'li satışların KDV dahil toplamı, "m10": %10 matrah, "k10": %10 KDV,
 "g20": %20 KDV'li satışların KDV dahil toplamı (TEKEL ve POŞET HARİÇ), "m20": %20 matrah (poşet ve tekel hariç), "k20": %20 KDV (poşet ve tekel hariç),
 "gp": POŞET satışlarının KDV dahil toplamı, "mp": poşet matrahı, "kp": poşet KDV'si (%20),
 "kart": kredi / banka kartı ile tahsilat toplamı,
 "nakit": nakit tahsilat toplamı,
 "genel": fişte yazan günlük GENEL TOPLAM / TOPLAM (KDV dahil),
 "not": "kısa açıklama, yoksa boş metin",
 "belirsiz": [okuyamadığın veya emin olmadığın alan adları]
}
Kurallar:
- Tutarları nokta ondalık ayırıcılı JSON sayısı olarak yaz (1.234,56 → 1234.56). Para birimi koyma.
- Fişte bulunmayan alan için null yaz, tahmin etme. Satır fişte var ama tutarı 0 ise 0 yaz.
- Departman / kısım satırlarında POŞET veya TEKEL/SİGARA görünüyorsa ve bunlar %20 grubunun içinde sayılmışsa, poşeti ve tekeli %20'den düşerek ayrı alanlara yaz; ne yaptığını "not" alanına kısaca yaz.
- Poşetin matrah/KDV'si fişte ayrıca yoksa: mp = gp / 1.20, kp = gp - mp (2 haneye yuvarla).
- Bir oran için yalnızca KDV dahil tutar ve KDV yazıyorsa matrah = KDV dahil tutar − KDV.
- "KÜMÜLATİF" / "KÜM." gibi birikmiş toplamları değil, bu Z raporunun GÜNLÜK değerlerini kullan.
- Fişte başka KDV oranları (%0, %8, %18 gibi) varsa bunları "not" alanına oran ve tutarlarıyla yaz.
- İptal / iade varsa net satışı kullan ve "not" alanında belirt.
- "KNV" satırında tutar varsa (fişte %0 basılı olsa da) onu TEKEL'e değil %1 grubuna ekle: g1'e tutarı, k1'e tutar/101'i (2 haneye yuvarla) ekle.
- Fişte "BELGE TİPLERİ" bölümü varsa nakit ve kartı YALNIZCA oradaki "-NAKİT" ve "-KREDİ" satırlarından al ("ÖDEME BİLGİLERİ" bölümünü kullanma).`;

const b64=blob=>new Promise((res,rej)=>{const f=new FileReader();f.onload=()=>res(String(f.result).split(',')[1]);f.onerror=()=>rej(f.error);f.readAsDataURL(blob)});
async function callClaude(content,maxTokens,count=true){
  if(!S.key)throw new Error('API anahtarı girilmemiş — ⚙️ Ayarlar');
  let res;
  try{res=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'x-api-key':S.key,'anthropic-version':'2023-06-01','content-type':'application/json','anthropic-dangerous-direct-browser-access':'true'},
    body:JSON.stringify({model:S.model,max_tokens:maxTokens,messages:[{role:'user',content}]})})}
  catch(e){throw new Error('İnternete bağlanılamadı. Bağlantını kontrol et.')}
  let j=null;try{j=await res.json()}catch(e){}
  if(!res.ok){const m=(j&&j.error&&j.error.message)||res.statusText||'';
    throw new Error(res.status===401?'API anahtarı geçersiz. ⚙️ Ayarlar’dan kontrol et.':res.status===403?'Bu anahtarın yetkisi yok: '+m:res.status===429?'Çok sık istek; biraz bekleyip tekrar dene.':res.status===529||res.status>=500?'Anthropic şu an yoğun; birazdan tekrar dene.':/credit|balance|billing/i.test(m)?'Anthropic hesabında kredi kalmamış. Panelden kredi yükle.':/model/i.test(m)?'Model kullanılamıyor: '+m:'API hatası ('+res.status+'): '+m)}
  track(j.usage,count);
  return (j.content||[]).filter(c=>c.type==='text').map(c=>c.text).join('');
}
