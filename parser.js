// ===== Z RAPORU GENEL OKUYUCU (kural tabanlı) =====
// Girdi: fişin düz metni (yazı tanıma çıktısı ya da kopyalanan metin)
// Çıktı: { d: alanlar, unsure: [emin olunamayan alanlar], notes: [açıklamalar] }
(function (root) {
  const TRU = s => s.toLocaleUpperCase('tr-TR');
  const RATES = [0, 1, 8, 10, 18, 20];
  const CUM = /K[ÜU]M[ÜU]LAT[İI]F|\bK[ÜU]M\b|K[ÜU]M\.|M\.?\s?HAF[İI]ZA|MAL[İI]\s?HAF[İI]ZA|GENEL\s?K[ÜU]M/;

  function normLine(l) {
    let s = TRU(l).replace(/[‘’`´]/g, "'").replace(/[ \t]+/g, ' ').replace(/\s+/g, ' ').trim();
    s = s.replace(/°\/O|0\/0|º\/O|°\/0/g, '%');
    // rakamların arasındaki tipik yazı tanıma karışıklıkları
    s = s.replace(/(\d)[OÖ](?=[\d,.])/g, '$10').replace(/([\d,.])[OÖ](?=\d)/g, '$10');
    s = s.replace(/(\d)[İIL|](?=\d)/g, '$11');
    s = s.replace(/(\d)\s?[,.]\s(\d{2})(?!\d)/g, '$1,$2');   // "123, 45" → "123,45"
    return s;
  }
  const stripDT = s => s
    .replace(/\b\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\b/g, ' ')
    .replace(/\b\d{1,2}:\d{2}(:\d{2})?\b/g, ' ');
  function amounts(s) {
    const re = /(\d{1,3}(?:[.']\d{3})+|\d+)[,.](\d{2})(?![\d%])/g, out = [];
    let m; s = stripDT(s);
    while ((m = re.exec(s))) out.push(parseFloat(m[1].replace(/[.']/g, '') + '.' + m[2]));
    return out;
  }
  function rateOf(s) {
    let m = s.match(/%\s?(\d{1,2})(?!\d)/) || s.match(/(?<![\d,.])(\d{1,2})\s?%/) || s.match(/\bKDV\s?(\d{1,2})\b(?![,.]\d)/);
    if (!m) return null;
    const r = +m[1]; return RATES.includes(r) ? r : null;
  }
  const hasLetters = s => /[A-ZÇĞİÖŞÜ]{2,}/.test(s);
  const r2 = n => Math.round(n * 100) / 100;

  function parseZ(text) {
    const raw = String(text || '').split(/\r?\n/).map(normLine).filter(Boolean);
    const L = [];                    // {s, a, rate, cum}
    for (let i = 0; i < raw.length; i++) {
      const s = raw[i], a = amounts(s);
      L.push({ s, a, rate: rateOf(s), cum: CUM.test(s) });
    }
    // Kümülatif başlığı tek başına satırdaysa, altındaki sadece-tutar satırı da kümülatiftir
    for (let i = 0; i < L.length - 1; i++) if (L[i].cum && !L[i].a.length && !hasLetters(L[i + 1].s.replace(/\*/g, ''))) L[i + 1].cum = true;

    const d = {}, unsure = [], notes = [];
    const amtAt = i => {
      if (L[i].a.length) return L[i].a[L[i].a.length - 1];
      const n = L[i + 1];
      if (n && n.a.length === 1 && n.rate == null && !hasLetters(n.s.replace(/\*/g, ''))) return n.a[0];
      return null;
    };
    const find = (re, ex) => { for (let i = 0; i < L.length; i++) { const l = L[i]; if (l.cum) continue; if (re.test(l.s) && !(ex && ex.test(l.s))) { const v = amtAt(i); if (v != null) return v; } } return null; };

    // --- Tarih ---
    const all = raw.join('\n');
    let m = all.match(/\b(\d{1,2})[./-](\d{1,2})[./-](\d{4}|\d{2})\b/);
    if (m) d.tarih = `${m[1].padStart(2, '0')}.${m[2].padStart(2, '0')}.${m[3].length === 2 ? '20' + m[3] : m[3]}`;
    else unsure.push('tarih');

    // --- Z No ---
    m = all.match(/\bZ\s?(?:NO|NUMARASI|SIRA\s?NO|SAYISI)\s*[:.]?\s*(\d{1,6})\b/) ||
        all.match(/\bZ\s?RAPOR[UI]?\s*(?:NO)?\s*[:.]\s*(\d{1,6})\b/) ||
        all.match(/(?:^|\n)\s*Z\s*[:.]?\s*(\d{2,6})\s*(?:\n|$)/);
    if (m) d.z_no = m[1]; else unsure.push('z_no');

    // --- Toplamlar ve ödeme ---
    const EXG = /KDV|%|F[İI][ŞS]|ADET|SAYI|[İI]PTAL|[İI]ND[İI]R[İI]M|PO[ŞS]ET|TEKEL|NAK[İI]T|KRED[İI]|KART|ARA\s?TOP/;
    d.genel = find(/\bGENEL\s?TOPLAM\b|\bTOPLAM\s?SATI[ŞS]|SATI[ŞS]\s?TOPLAMI|NET\s?SATI[ŞS]|\bTOPLAM\b|\bTOP\b/, EXG);
    d.top_kdv = null;
    for (let i = 0; i < L.length; i++) { const l = L[i]; if (l.cum || l.rate != null) continue; if (/TOP\s?KDV|TOPLAM\s?KDV|KDV\s?TOPLAM|TOPKDV/.test(l.s)) { d.top_kdv = amtAt(i); break; } }
    d.nakit = find(/NAK[İI]T/, /[ÜU]ST[ÜU]|SAYI|ADET/);
    d.kart = find(/KRED[İI]|K\.\s?KART|BANKA\s?KART|\bKART\b|POS\b/, /SAYI|ADET|NAK[İI]T/);
    d.diger = find(/YEMEK\s?KART|D[İI][ĞG]ER\s?[ÖO]DEME|HAVALE|EFT\b/, /SAYI|ADET/);
    d.tekel = find(/TEKEL|S[İI]GARA|T[ÜU]T[ÜU]N/, /SAYI|ADET/);
    d.gp = find(/PO[ŞS]ET/, /SAYI|ADET/);

    // --- KDV grupları ---
    const key = { 1: ['g1', 'm1', 'k1'], 10: ['g10', 'm10', 'k10'], 20: ['g20', 'm20', 'k20'] };
    for (const r of RATES) {
      const pool = [];              // {v, kind}
      for (let i = 0; i < L.length; i++) {
        const l = L[i]; if (l.cum || l.rate !== r || /PO[ŞS]ET|TEKEL|S[İI]GARA/.test(l.s)) continue;
        const kind = /MATRAH|\bMAT\b|MAT\./.test(l.s) ? 'm' : (/KDV/.test(l.s) && !/KDV'?L[İI]|DAH[İI]L|TOPLAM|TUTAR|SATI/.test(l.s) ? 'k' : 'g');
        const nx = L[i + 1], vals = l.a.length ? l.a : (nx && nx.a.length === 1 && nx.rate == null && !hasLetters(nx.s.replace(/\*/g, '')) ? [nx.a[0]] : []);
        vals.forEach(v => pool.push({ v, kind }));
      }
      if (!pool.length) continue;
      let g = null, mm = null, k = null, ok = false;
      if (r === 0) { g = Math.max(...pool.map(p => p.v)); ok = true; }
      else {
        const tol = k => Math.max(0.06, k * 0.01);
        const vs = pool.map(p => p.v);
        // 1) Matrah + KDV = Toplam üçlüsü (en güçlü kanıt)
        let best = null;
        for (const a of vs) for (const b of vs) for (const c of vs) {
          if (!(a > b && c > a)) continue;
          const e1 = Math.abs(a + b - c), e2 = Math.abs(a * r / 100 - b);
          if (e1 <= 0.02 && e2 <= tol(b)) { const e = e1 + e2; if (!best || e < best.e) best = { e, g: c, m: a, k: b }; }
        }
        // 2) İkili: (KDV dahil, KDV) ya da (matrah, KDV) — hatası en küçük olan
        if (!best) for (const a of vs) for (const b of vs) {
          if (a <= b) continue;
          const eg = Math.abs(a * r / (100 + r) - b), em = Math.abs(a * r / 100 - b);
          if (eg <= tol(b) && (!best || eg < best.e)) best = { e: eg, g: a, k: b, m: r2(a - b) };
          if (em <= tol(b) && (!best || em < best.e)) best = { e: em, m: a, k: b, g: r2(a + b) };
        }
        if (best) { g = best.g; mm = best.m; k = best.k; ok = true; }
        if (!ok) {                                                     // tek tutar: etiketine göre
          const p = pool[0];
          if (p.kind === 'm') mm = p.v; else if (p.kind === 'k') k = p.v; else g = p.v;
        }
      }
      if (key[r]) {
        const [gk, mk, kk] = key[r];
        if (g != null) d[gk] = g; if (mm != null) d[mk] = mm; if (k != null) d[kk] = k;
        if (!ok) unsure.push(gk, mk, kk);
      } else if (r === 0) { notes.push(`%0 satış: ${g.toFixed(2).replace('.', ',')}`); }
      else notes.push(`%${r} grubu bulundu (${pool.map(p => p.v.toFixed(2).replace('.', ',')).join(' / ')}) — şablonda bu oran yok`);
    }

    // --- Tekel / poşet %20'nin içinde sayılmışsa ayır ---
    const sum = () => ['tekel', 'g1', 'g10', 'g20', 'gp'].reduce((a, x) => a + (d[x] || 0), 0);
    if (d.genel != null && d.g20 != null) {
      const diff = sum() - d.genel;
      if (Math.abs(diff) > 0.06) for (const extra of [(d.tekel || 0) + (d.gp || 0), d.gp || 0, d.tekel || 0]) {
        if (extra > 0 && Math.abs(diff - extra) <= 0.06 && d.g20 > extra) {
          d.g20 = r2(d.g20 - extra); d.m20 = r2(d.g20 / 1.2); d.k20 = r2(d.g20 - d.m20);
          unsure.push('g20', 'm20', 'k20');
          notes.push('Tekel/poşet %20 grubunun içinde basılmış; %20’den düşüldü, kontrol et.');
          break;
        }
      }
    }
    // Poşetin matrah/KDV'si
    if (d.gp != null) { d.mp = r2(d.gp / 1.2); d.kp = r2(d.gp - d.mp); }

    for (const kf of ['genel', 'nakit', 'kart']) if (d[kf] == null) unsure.push(kf);
    const found = Object.keys(d).filter(k => d[k] != null).length;
    return { d, unsure: [...new Set(unsure)], notes, found };
  }
  root.ZParse = { parseZ, normLine, amounts };
})(typeof window !== 'undefined' ? window : globalThis);
