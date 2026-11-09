// ===== Z RAPORU GENEL OKUYUCU (kural tabanlı) =====
// Girdi: fişin düz metni (yazı tanıma çıktısı ya da kopyalanan metin)
// Çıktı: { d: alanlar, unsure: [emin olunamayan alanlar], notes: [açıklamalar] }
(function (root) {
  const TRU = s => s.toLocaleUpperCase('tr-TR');
  const RATES = [0, 1, 8, 10, 18, 20];
  const CUM = /K[ÜU]M[ÜU]LAT[İI]F|\bK[ÜU]M(?:\b|\.|SATI|KDV|TOP|\s?TOPLAM)|M\.?\s?HAF[İI]ZA|MAL[İI]\s?HAF[İI]ZA|GENEL\s?K[ÜU]M/;
  // Tutar içinde yanlış okunan harfler → rakam (sadece tutara benzeyen parçalarda)
  const FIX = { B: '8', S: '5', O: '0', Ö: '0', D: '0', Q: '0', L: '1', I: '1', İ: '1', '|': '1', Z: '2', G: '6', H: '6', A: '4', T: '7', Y: '9', Ğ: '0' };
  const fixAmt = tok => tok.replace(/[BSOÖDQLIİ|ZGHATYĞ]/g, c => FIX[c] || c);

  function normLine(l) {
    let s = TRU(l).replace(/[‘’`´]/g, "'").replace(/[ \t]+/g, ' ').replace(/\s+/g, ' ').trim();
    // "*1/00" ve "0/09" tutarlardır — "%" kuralından önce uygula
    s = s.replace(/(?<![\/\d])(\d{1,6})\/(\d{2})(?![\d\/])/g, '$1,$2');
    s = s.replace(/°\/O|0\/0|º\/O|°\/0/g, '%');
    // rakamların arasındaki tipik yazı tanıma karışıklıkları
    s = s.replace(/(\d)[OÖ](?=[\d,.])/g, '$10').replace(/([\d,.])[OÖ](?=\d)/g, '$10');
    s = s.replace(/(\d)[İIL|](?=\d)/g, '$11');
    s = s.replace(/(\d)\s?[,.]\s(\d{2})(?!\d)/g, '$1,$2');   // "123, 45" → "123,45"
    s = s.replace(/\s+[|¦!:;]+\s*$/, '');                                        // satır sonu "|" çöpü
    s = s.replace(/(\d)\.,\s?(\d)/g, '$1.$2');                                      // "*24.,997,50" / "*8., 360,08"
    s = s.replace(/(\d{1,3}),(\d{3}),(\d{2})(?!\d)/g, '$1.$2,$3');               // "1,255,00" → "1.255,00"
    s = s.replace(/(\d{1,3})\.\s(\d{3}[,.]\d{2})(?!\d)/g, '$1.$2');                // "*29. 255,50" → "*29.255,50"
    s = s.replace(/([*'"“”«»])\s?(\d{1,6}):(\d[\dĞG])(?!\d)/g, '$1$2,$3');            // "*1:0ğ" → "*1,0ğ"                       // "*1/00" → "*1,00"          // "1,255,00" → "1.255,00"
    s = s.replace(/\bK[O0ÖD]V\b/g, 'KDV');                                    // "KOV" → "KDV"
    s = s.replace(/^\+\s?(?=\d)/, '*').replace(/(\s)\+\s?(?=\d)/g, '$1*');   // "+8.654,00" → "*8.654,00"
    s = s.replace(/([*'"]\s?\d{1,3})\s(\d{3}[,.]\d{2})(?!\d)/g, '$1.$2'); // "*8 464,00" → "*8.464,00"
    {
      const kw = /TOPLAM|TOP\s?K[DO]V|\bKDV\b|NAK[İI]T|KART|KRED[İI]|SATI[ŞS]|C[İI]RO|BANKA|YEMEK/.test(s);
      const onlyAmt = !/[A-ZÇĞİÖŞÜ]{2}/.test(s.replace(/\s[A-ZÇĞİÖŞÜ]{1,3}\W*$/g, ''));
      if (kw || onlyAmt) {
        // "M1.433 36" / "A4 54": tutarın önüne yapışmış tek harf = "*"
        if (/TOP\s?K[DO]V|\bKDV\b|TOPLAM/.test(s)) s = s.replace(/(\s)[A-ZÇĞİÖŞÜ](?=\d{1,3}(?:[.,]\d{3})*[ ,.]\s?\d{2}\s*$)/, '$1*');
        // "417.467, S0" → "417.467,50" (kuruşta harf)
        s = s.replace(/(\d)([,.])\s?([0-9OÖDQSBGĞ]{2})(?![\dA-ZÇĞİÖŞÜ])/g, (m, a, sep, dd) => (/\d/.test(dd) || /^[OÖDQ]{2}$/.test(dd)) ? a + sep + fixAmt(dd) : m);
        // "18.600.009" / "17.467.506" → "18.600,00" / "17.467,50" (kuruş ayırıcısı nokta + fazladan rakam)
        s = s.replace(/(\d{1,3}(?:\.\d{3})+)\.(\d{2})\d?(?![\d,.])/g, '$1,$2');
        s = s.replace(/([*'"“”«»]\s?\d{1,3}(?:\.\d{3})*)\s(\d{2})(?![\d,.])/g, '$1,$2');
        s = s.replace(/([*'"“”«»]\s?\d{1,3})\s(\d{3}[,.]\d{2})(?!\d)/g, '$1.$2');   // "*8 600,00" → "*8.600,00"
      }
    }
    if (/TOPLAM|TOP\s?K[DO]V|\bKDV\b/.test(s)) s = s.replace(/(\s\d{1,3}(?:\.\d{3})*|\s\d{1,6})\s(\d{2})\s*$/, '$1,$2');
    s = s.replace(/([*'"“”«»]\s?\d{1,3})\s(\d{3}[,.]\d{2})(?!\d)/g, '$1.$2');          // ikinci geçiş: "*8 600,00" → "*8.600,00"
    // KDV satırında virgülü tamamen kaybolmuş tutar: "TOPKDV *409" → "*4,09"
    if (/^(?:\S{0,3}\s)?TOP\s?K[DO]V\b|^(?:\S{0,3}\s)?KDV\b/.test(s) && !/\d[,.]\d{2}/.test(s)) s = s.replace(/([*'"“”«»])\s?(\d{1,4})(\d{2})\s*$/, '$1$2,$3');   // "TOPKDV 10 01" → "10,01"           // "*187 47" → "*187,47"
    // "*B.654,00" / "*8.4H4,00" gibi: harf karışmış tutarları düzelt
    s = s.replace(/([*'"]?)([0-9BSOÖDQLIİ|ZGHATY]{1,3}(?:[.'][0-9BSOÖDQLIİ|ZGHATY]{3})*[,.][0-9OÖDQYGĞ]{2})(?![\dA-ZÇĞİÖŞÜ])/g,
      (m, p, t) => (/\d/.test(t) && (p || /^\d/.test(t))) ? p + fixAmt(t) : m);
    // Miktar alanlarını tutar sanmamak için çıkar: "%10 MKTR 16,00" → "%10"
    s = s.replace(/\bM[İI]?KTR\.?\s*[\d.,]*|\bM[İI]KTAR\s*[\d.,]*/g, ' MKTR ');
    s = s.replace(/\s+/g, ' ').trim();
    // Satır başındaki kenar gölgesi çöpleri: "J TOPLAM", "© KDV", "| KDV", "3 TOPLAM"
    while (/\d[,.]\d{2}/.test(s) && /\d[,.]\d{2}\s+(?:[^\s\d]{1,3}\s*)+$/.test(s)) s = s.replace(/\s+[^\s\d]{1,3}\s*$/, '');
    normLine.pre = s;
    s = s.replace(/^(?:[^A-ZÇĞİÖŞÜ0-9*%\s]{1,2}\s|[A-ZÇĞİÖŞÜ0-9]\s(?=(?:TOPLAM|TOP|KDV|NAK|BANKA|KRED|YEMEK|KART|MATRAH)\b))+/, '');
    s = s.replace(/^(?:\S{1,2}\s+)+(?=(?:TOPLAM|KDV|NAK[İI]T|BANKA|KRED[İI]|YEMEK|MATRAH|NET\s?C[İI]RO|BR[ÜU]T)\b)/, '');
    s = s.replace(/(\S)\s+[—–-]\s+(?=[*'"“”»>]?\s?\d)/g, '$1 ');               // "“1 — *7.399,00" → "“1 *7.399,00"
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
    let m = s.match(/%\s?(\d{1,2})(?!\d)/) || s.match(/(?<![\d,.])(\d{1,2})\s?%/) || s.match(/\bKDV\s?(\d{1,2})\b(?![,.]\d)/) ||
      // "%" işareti başka karakter okunmuşsa: "TOPLAM v10 *1.255,00", "KDV »20 0,00"
      s.match(/^(?:TOPLAM|TOP|KDV)\s*[^\sA-ZÇĞİÖŞÜ0-9]?[A-Z]?\s?(10|20|18|1|8)\s+[*'"“”»«>]?\s?\d/) ||
      s.match(/^(?:TOPLAM|TOP|KDV)\s*[^\sA-ZÇĞİÖŞÜ0-9]?[14789](10|20|18)\s+[*'"“”»«>]?\s?\d/) ||   // "%20" → "120" / "420"
      s.match(/^(?:TOPLAM|TOP|KDV)\s*[^\sA-ZÇĞİÖŞÜ0-9]?[479](1)\s+[*'"“”»«>]?\s?\d/) ||            // "%1" → "41"
      // departman satırı: "İÇECEK 1 MKTR"
      s.match(/(?:^|\s)\S?(\d{1,2})\s?MKTR\b/);
    if (!m) return null;
    const r = +m[1]; return RATES.includes(r) ? r : null;
  }
  const hasLetters = s => /[A-ZÇĞİÖŞÜ]{2,}/.test(s);
  const r2 = n => Math.round(n * 100) / 100;

  // Tipik okuma hatalarının olası doğru hâlleri
  function variants(v) {
    if (v == null) return [];
    const o = [], [i, dd] = v.toFixed(2).split('.'), d0 = dd.replace(/[24689]/g, '0');
    if (d0 !== dd) o.push(+(i + '.' + d0));
    if (/^[1347]\d/.test(i)) { o.push(+(i.slice(1) + '.' + dd)); if (d0 !== dd) o.push(+(i.slice(1) + '.' + d0)); }
    return [...new Set(o)].filter(x => x !== v);
  }
  // Eksik KDV grubunu tamamla: genel toplamdan kalan tutar + orana uyan KDV metinde varsa kesin kabul et
  function complete(d, amts, unsure, notes) {
    if (d.genel == null) return;
    const R = [['g1', 'm1', 'k1', 1], ['g10', 'm10', 'k10', 10], ['g20', 'm20', 'k20', 20]];
    const okG = x => d[x[0]] != null && !unsure.includes(x[0]);
    const known = ['tekel', 'gp'].reduce((a, x) => a + (d[x] || 0), 0) + R.filter(okG).reduce((a, x) => a + d[x[0]], 0);
    const rest = r2(d.genel - known), miss = R.filter(x => !okG(x));
    if (!miss.length || rest < 0.06) { if (miss.length && Math.abs(rest) < 0.06) miss.forEach(([g, m, k]) => { if (d[g] == null || d[g] === 0) { d[g] = 0; d[m] = 0; d[k] = 0; [g, m, k].forEach(x => { const i = unsure.indexOf(x); if (i >= 0) unsure.splice(i, 1); }); } }); return; }
    const known2 = [d.genel, d.top_kdv, d.tekel, d.nakit, d.kart].filter(v => v != null);
    const kOf = (g, r) => { const e = g * r / (100 + r), t = Math.max(0.03, e * 0.004); return amts.filter(v => !known2.some(x => Math.abs(x - v) < 0.006) && Math.abs(v - e) <= t).sort((a, b) => Math.abs(a - e) - Math.abs(b - e))[0]; };
    const set = ([g, m, k, r], gv, kv) => { d[g] = gv; d[k] = kv; d[m] = r2(gv - kv); [g, m, k].forEach(x => { const i = unsure.indexOf(x); if (i >= 0) unsure.splice(i, 1); }); };
    // tek eksik grup: kalan tutarın kendisi metinde olmalı (ya da sadece KDV'si)
    if (miss.length === 1) for (const x of miss) {
      const others = [];
      const kv = kOf(rest, x[3]);
      if (kv != null && rest >= 1 && (rest >= 100 || amts.some(v => Math.abs(v - rest) < 0.006))) {
        set(x, rest, kv); others.forEach(([g, m, k]) => { d[g] = 0; d[m] = 0; d[k] = 0; [g, m, k].forEach(z => { const i = unsure.indexOf(z); if (i >= 0) unsure.splice(i, 1); }); });
        notes.push(`%${x[3]} grubu genel toplamdan kalan tutar ve KDV'si ile doğrulandı.`); return;
      }
    }
    // iki eksik grup: kalan = a + b, ikisinin de KDV'si metinde
    if (miss.length >= 2) for (let i = 0; i < miss.length; i++) for (let j = i + 1; j < miss.length; j++)
      for (const a of amts) { const b = r2(rest - a); if (a <= 0 || b < 0) continue;
        if (!amts.some(v => Math.abs(v - b) < 0.06) && b !== 0) continue;
        if (a < 100 || (b > 0 && b < 100)) continue;
        const ka = kOf(a, miss[i][3]), kb = b === 0 ? 0 : kOf(b, miss[j][3]);
        if (ka != null && kb != null) { set(miss[i], a, ka); set(miss[j], b, kb); return; } }
  }

  // Onarım: toplamlar tutmuyorsa tipik okuma hatalarını dene ("1,0g"→"1,00", "*2,00"→"12,00") — sadece toplamı TAM tutturursa uygula
  function repair(d, notes, unsure, amts = []) {
    if (d.genel == null) {
      const sG = ['tekel', 'g1', 'g10', 'g20', 'gp'].reduce((a, k) => a + (d[k] || 0), 0), sP = ['nakit', 'kart', 'diger'].reduce((a, k) => a + (d[k] || 0), 0);
      if (sG > 0 && Math.abs(sG - sP) < 0.006) { d.genel = r2(sG); notes.push('Genel toplam okunamadı; gruplar ve ödemeler birbirini tuttuğu için onlardan alındı.'); }
      else return;
    }
    const alts = v => v == null ? [v] : [v, ...variants(v)];
    const fix = (keys, target, label) => {
      const cur = keys.reduce((a, k) => a + (d[k] || 0), 0);
      if (Math.abs(cur - target) < 0.006) return 'ok';
      let best = null;
      const rec = (i, acc, ch, pick) => {
        if (i === keys.length) { if (Math.abs(acc - target) < 0.006 && (!best || ch < best.ch)) best = { ch, pick: [...pick] }; return; }
        for (const v of alts(d[keys[i]])) { pick.push(v); rec(i + 1, acc + (v || 0), ch + (v === d[keys[i]] ? 0 : 1), pick); pick.pop(); }
      };
      rec(0, 0, 0, []);
      if (!best || best.ch === 0 || best.ch > 2) return false;
      keys.forEach((k, i) => { if (best.pick[i] !== d[k]) { changed.push(k); notes.push(`${label}: ${String(d[k]).replace('.', ',')} → ${best.pick[i].toFixed(2).replace('.', ',')} (okuma hatası düzeltildi)`); d[k] = best.pick[i]; } });
      return 'fixed';
    };
    const changed = [];
    const G = ['tekel', 'g1', 'g10', 'g20', 'gp'].filter(k => d[k] != null);
    const sumG = G.reduce((a, k) => a + d[k], 0), sumP = ['nakit', 'kart', 'diger'].reduce((a, k) => a + (d[k] || 0), 0);
    if (Math.abs(sumG - d.genel) >= 0.006 && Math.abs(sumP - d.genel) >= 0.006) {
      const gv = variants(d.genel).find(v => Math.abs(v - sumG) < 0.006 || Math.abs(v - sumP) < 0.006);
      if (gv != null) { notes.push(`Genel toplam: ${String(d.genel).replace('.', ',')} → ${gv.toFixed(2).replace('.', ',')} (okuma hatası düzeltildi)`); d.genel = gv; }
      else if (sumG > 0 && Math.abs(sumG - sumP) < 0.006) { notes.push(`Genel toplam: ${String(d.genel).replace('.', ',')} → ${sumG.toFixed(2).replace('.', ',')} (gruplar ve ödemeler birbirini tutuyor)`); d.genel = r2(sumG); }
    }
    if (fix(G, d.genel, 'Grup tutarı') === 'fixed') {
      for (const x of ['tekel', 'g1', 'm1', 'k1', 'g10', 'm10', 'k10', 'g20', 'm20', 'k20', 'gp']) { let i; while (d[x] != null && (i = unsure.indexOf(x)) >= 0) unsure.splice(i, 1); }
      // Toplamı düzeltilen grubun KDV'sini yeni toplama göre yeniden bul
      for (const [g, m, k, r] of [['g1', 'm1', 'k1', 1], ['g10', 'm10', 'k10', 10], ['g20', 'm20', 'k20', 20], ['gp', 'mp', 'kp', 20]]) {
        if (d[g] == null) continue;
        if (changed.includes(g)) {
          const e = d[g] * r / (100 + r), t = Math.max(0.03, e * 0.004);
          const kv = d[g] === 0 ? 0 : amts.filter(v => Math.abs(v - e) <= t).sort((a, b) => Math.abs(a - e) - Math.abs(b - e))[0];
          if (kv != null) d[k] = kv; else { d[k] = r2(e); unsure.push(k); }
        }
        if (d[k] != null) d[m] = r2(d[g] - d[k]);
      }
    }
    const P = ['nakit', 'kart', 'diger'].filter(k => d[k] != null);
    if (P.length && !fix(P, d.genel, 'Ödeme tutarı')) unsure.push(...P);
    else for (const x of P) { let i; while ((i = unsure.indexOf(x)) >= 0) unsure.splice(i, 1); }
    // Genel toplam ne gruplarla ne ödemelerle tutuyorsa turuncu
    const sG2 = ['tekel', 'g1', 'g10', 'g20', 'gp'].reduce((a, k) => a + (d[k] || 0), 0), sP2 = ['nakit', 'kart', 'diger'].reduce((a, k) => a + (d[k] || 0), 0);
    if (Math.abs(sG2 - d.genel) >= 0.006 && Math.abs(sP2 - d.genel) >= 0.006) unsure.push('genel');
    else { let i; while ((i = unsure.indexOf('genel')) >= 0) unsure.splice(i, 1); }
  }

  function parseZ(text) {
    const raw = String(text || '').split(/\r?\n/).filter(l => l.trim());
    const L = [];                    // {s, a, rate, cum}
    for (let i = 0; i < raw.length; i++) {
      const s = normLine(raw[i]), a = amounts(s);
      const pre = normLine.pre || s;
      let rate = rateOf(s);
      if (rate == null) {            // "%1 TOPLAM" → "1 TOPLAM", "420 TOPLAM", "&10 TOPLAM" ("%" kaybolmuş)
        const m = pre.match(/^[^\sA-ZÇĞİÖŞÜ0-9]?(10|18|20|0|1|8)\s?TOPLAM\b/) || pre.match(/^[^\sA-ZÇĞİÖŞÜ0-9]?[4789X&](10|18|20|0|1|8)\s?TOPLAM\b/);
        if (m) rate = +m[1];
      }
      L.push({ s, a, rate, cum: CUM.test(s) });
    }
    // "%1 TOPLAM *1,00" ↵ "TOPKDV *0,01": KDV satırı üstündeki oranı alır
    for (let i = 1; i < L.length; i++) if (L[i].rate == null && /^(?:TOP\s?KDV|KDV)\b/.test(L[i].s) && L[i - 1].rate != null && /TOPLAM/.test(L[i - 1].s) && !L[i].cum) L[i].rate = L[i - 1].rate;
    // Kümülatif başlığı tek başına satırdaysa, altındaki sadece-tutar satırı da kümülatiftir
    for (let i = 0; i < L.length - 1; i++) if (L[i].cum && !L[i].a.length && !hasLetters(L[i + 1].s.replace(/\*/g, ''))) L[i + 1].cum = true;

    const d = {}, unsure = [], notes = [];
    // Sütun sütun kopyalanmış metin: art arda etiket satırları, ardından art arda sayı satırları
    const isNum = l => !hasLetters(l.s.replace(/\*/g, ''));
    const colVal = {};
    for (let i = 0; i < L.length; i++) {
      if (!(hasLetters(L[i].s) && !L[i].a.length && !L[i].cum)) continue;
      let j = i; while (j < L.length && hasLetters(L[j].s) && !L[j].a.length) j++;
      const labels = []; for (let x = i; x < j; x++) if (!/:\s*$|T[ÜU]RLER[İI]/.test(L[x].s)) labels.push(x);
      if (labels.length < 2) continue;
      const vals = []; let k = j; while (k < L.length && isNum(L[k])) { if (L[k].a.length) vals.push(L[k].a[L[k].a.length - 1]); else if (/^[*'"]/.test(L[k].s)) vals.push(null); k++; }
      if (vals.length === labels.length) labels.forEach((x, n) => { if (vals[n] != null) colVal[x] = vals[n]; });
      i = j - 1;
    }
    const amtAt = i => {
      if (L[i].a.length) return L[i].a[L[i].a.length - 1];
      if (colVal[i] != null) return colVal[i];
      const n = L[i + 1];
      if (n && n.a.length === 1 && n.rate == null && isNum(n)) return n.a[0];
      // "Nakit 5" ↵ "*190,00": araya adet sayısı girmiş olabilir
      const n2 = L[i + 2];
      if (n && !n.a.length && isNum(n) && n2 && n2.a.length === 1 && isNum(n2)) return n2.a[0];
      return null;
    };
    const find = (re, ex) => { for (let i = 0; i < L.length; i++) { const l = L[i]; if (l.cum) continue; if (re.test(l.s) && !(ex && ex.test(l.s))) { const v = amtAt(i); if (v != null) return v; } } return null; };

    // --- Tarih ---
    const all = L.map(l => l.s).join('\n');
    let m;
    const dates = [...all.matchAll(/\b(\d{1,2})[./-](\d{1,2})[./-](\d{4}|\d{2})\b/g)].map(x => {
      const dd = +x[1], mm = +x[2], yy = x[3].length === 2 ? 2000 + +x[3] : +x[3];
      return dd >= 1 && dd <= 31 && mm >= 1 && mm <= 12 && yy >= 2000 && yy <= 2099 ? `${String(dd).padStart(2, '0')}.${String(mm).padStart(2, '0')}.${yy}` : null; }).filter(Boolean);
    if (dates.length) { const c = {}; dates.forEach(x => c[x] = (c[x] || 0) + 1); d.tarih = dates.slice().sort((a, b) => c[b] - c[a])[0]; }
    else unsure.push('tarih');

    // --- Z No ---
    m = all.match(/\bZ\s?(?:NO|NUMARASI|SIRA\s?NO|SAYISI|SAYA[ÇC])\s*[:.]?\s*(\d{1,6})\b/) ||
        all.match(/(?:^|\n)[^\n]{0,3}[Z2]\s?SAYA[ÇC]\s*[:.]?\s*(\d{1,6})\b/) ||
        (x => x && [x[0], x[1].replace(/[OCDQGÖ]/g, '0')])(all.match(/(?:^|\n)[^\n]{0,3}[Z2]\s?(?:SAYA[ÇC]|NO)\s*[:.]?\s*([0-9OCDQGÖ]{3,6})\b/)) ||
        all.match(/(?:^|\n)[^\n]{0,2}Z\s?N[OU0]\s*[:.]\s*(\d{1,6})\b/) ||
        all.match(/(?:^|\n)[^\n]{0,2}2\s?N[OU0]\s*[:.]\s*(\d{3,6})\b(?=[^\n]*EK[ÜU])/) ||
        all.match(/\bZ\s?RAPOR[UI]?\s*(?:NO)?\s*[:.]\s*(\d{1,6})\b/) ||
        all.match(/(?:^|\n)\s*Z\s*[:.]?\s*(\d{2,6})\s*(?:\n|$)/);
    if (m) d.z_no = m[1]; else unsure.push('z_no');
    if (d.z_no && d.z_no.length >= 4 && /^[689]/.test(d.z_no)) unsure.push('z_no');   // noktalı sıfır şüphesi
    if (d.z_no && d.z_no.length > 4) unsure.push('z_no');                                // fazladan rakam şüphesi ("20002")

    // --- Toplamlar ve ödeme ---
    const EXG = /KDV|%|F[İI][ŞS]|ADET|SAYI|[İI]PTAL|[İI]ND[İI]R[İI]M|PO[ŞS]ET|TEKEL|NAK[İI]T|KRED[İI]|KART|ARA\s?TOP/;
    const GEN = /\bGENEL\s?TOPLAM\b|\bTOPLAM\s?SATI[ŞS]|SATI[ŞS]\s?TOPLAMI|NET\s?SATI[ŞS]|NET\s?S[A-ZÇĞİÖŞÜ]{3,5}\b|NET\s?C[İI]RO|\bTOPLAM\b|\bTOP\b/;
    const STRONG = /\bGENEL\s?TOPLAM\b|\bTOPLAM\s?SATI[ŞS]|SATI[ŞS]\s?TOPLAMI|NET\s?SATI[ŞS]|NET\s?S[A-ZÇĞİÖŞÜ]{3,5}\b|NET\s?C[İI]RO/;
    const genS = [], genW = [];
    for (let i = 0; i < L.length; i++) { const l = L[i]; if (l.cum || l.rate != null || !GEN.test(l.s) || EXG.test(l.s)) continue; const v = amtAt(i); if (v != null) (STRONG.test(l.s) ? genS : genW).push(v); }
    const genC = genS.length ? genS : genW;
    d.genel = genC.length ? genC[0] : null;
    d.top_kdv = null;
    for (let i = 0; i < L.length; i++) { const l = L[i]; if (l.cum || l.rate != null) continue; if (/TOP\s?KDV|TOPLAM\s?KDV|KDV\s?TOPLAM|TOPKDV/.test(l.s)) { d.top_kdv = amtAt(i); break; } }
    d.nakit = find(/NAK[İI]T/, /[ÜU]ST[ÜU]|SAYI|ADET/);
    d.kart = find(/KRED[İI]|K\.\s?KART|BANKA\s?KART|\bKART\b|POS\b/, /SAYI|ADET|NAK[İI]T/);
    d.diger = find(/YEMEK|D[İI][ĞG]ER\s?[ÖO]DEME|HAVALE|EFT\b/, /SAYI|ADET/);
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
        const sum = /\b(?:TOPLAM|TOPKDV|KDV|MATRAH)\b/.test(l.s) && !/MKTR/.test(l.s);
        vals.forEach(v => pool.push({ v, kind, sum }));
      }
      if (!pool.length) continue;
      // Önce fişin altındaki özet satırlarıyla (TOPLAM %x / KDV %x) çöz; tutarlı sonuç yoksa tüm satırlarla
      const solve = pool0 => {
        let pool = pool0;
        let g = null, mm = null, k = null, ok = false;
        if (r === 0) return { g: Math.max(...pool.map(p => p.v)), mm, k, ok: true };
        if (pool.every(p => p.v === 0)) return { g: 0, mm: 0, k: 0, ok: true };
        const tol = k => Math.max(0.03, k * 0.004);
        const ext = [...pool]; pool.forEach(p => variants(p.v).forEach(v => ext.push({ ...p, v, alt: true })));
        pool = ext;
        const vs = pool.map(p => p.v);
        let best = null;
        for (const a of vs) for (const b of vs) for (const c of vs) {          // Matrah + KDV = Toplam üçlüsü
          if (!(a > b && c > a)) continue;
          const e1 = Math.abs(a + b - c), e2 = Math.abs(a * r / 100 - b);
          if (e1 <= 0.02 && e2 <= tol(b)) { const e = e1 + e2; if (!best || e < best.e) best = { e, g: c, m: a, k: b }; }
        }
        if (!best) for (const P of pool) for (const Q of pool) {             // (KDV dahil, KDV) ya da (matrah, KDV)
          const a = P.v, b = Q.v; if (a <= b) continue;
          const pen = (P.alt ? 0.001 : 0) + (Q.alt ? 0.001 : 0);
          // etiket "TOPLAM" ise matrah sayma, "MATRAH" ise toplam sayma (küçük tutarlarda matematik ayırt edemez)
          const eg = P.kind === 'm' ? Infinity : Math.abs(a * r / (100 + r) - b), em = P.kind === 'g' ? Infinity : Math.abs(a * r / 100 - b);
          if (eg <= tol(b) && (!best || eg + pen < best.e)) best = { e: eg + pen, g: a, k: b, m: r2(a - b) };
          if (em <= tol(b) && (!best || em + pen < best.e)) best = { e: em + pen, m: a, k: b, g: r2(a + b) };
        }
        if (best) return { g: best.g, mm: best.m, k: best.k, ok: true };
        const p = pool[0];                                                    // tek tutar: etiketine göre
        if (p.kind === 'm') mm = p.v; else if (p.kind === 'k') k = p.v; else g = p.v;
        return { g, mm, k, ok: false };
      };
      const summ = pool.filter(p => p.sum);
      let res = summ.length ? solve(summ) : null;
      if (!res || !res.ok) res = solve(pool);
      let { g, mm, k, ok } = res;
      if (key[r]) {
        const [gk, mk, kk] = key[r];
        if (g != null) d[gk] = g; if (mm != null) d[mk] = mm; if (k != null) d[kk] = k;
        if (!ok) unsure.push(gk, mk, kk);
      } else if (r === 0) { if (g > 0) { d._g0 = g; notes.push(`%0 satış: ${g.toFixed(2).replace('.', ',')}`); } }
      else notes.push(`%${r} grubu bulundu (${pool.map(p => p.v.toFixed(2).replace('.', ',')).join(' / ')}) — şablonda bu oran yok`);
    }

    // --- "TOPLAM" satırı + hemen altındaki "TOPKDV/KDV" satırı: oran işareti bozuk olsa da KDV/toplam oranından grubu bul ---
    const tok = s => { const o = [...amounts(s)]; const re = /(\d+)[,.](\d{2})(\d)(?!\d)/g; let m; const t = stripDT(s);
      while ((m = re.exec(t))) { o.push(+(m[1] + '.' + m[2])); o.push(+(m[1] + m[2] + m[3])); } return o; };
    const GK = { 1: ['g1', 'm1', 'k1'], 10: ['g10', 'm10', 'k10'], 20: ['g20', 'm20', 'k20'] };
    const pairHits = {};
    for (let i = 0; i < L.length - 1; i++) {
      const a = L[i], b = L[i + 1];
      const hdr = [L[i - 1], L[i - 2]].some(x => x && /MAL[İI]\s?VER[İI]|GENEL\s?TOPLAM/.test(x.s));
      if (hdr || a.cum || b.cum || !/TOPLAM/.test(a.s) || /F[İI][ŞS]|ADET|SATI[ŞS]|C[İI]RO|KDV/.test(a.s) || !/KDV/.test(b.s) || /TOPLAM/.test(b.s)) continue;
      const G = tok(a.s), K = tok(b.s); if (!G.length || !K.length) continue;
      let best = null;
      for (const g0 of G) for (const g of [g0, ...variants(g0)]) for (const k0 of K) for (const k of [k0, ...variants(k0)]) for (const r of [1, 10, 20]) {
        if (g < 0.5 || k <= 0) continue;
        const e = Math.abs(g * r / (100 + r) - k), t = (g !== g0 || k !== k0) ? Math.max(0.01, k * 0.002) : Math.max(0.03, k * 0.004);
        if (e > t) continue;
        const sc = e + (g !== g0 ? 0.002 : 0) + (k !== k0 ? 0.002 : 0) + (a.rate != null && a.rate !== r ? 0.01 : 0);
        if (!best || sc < best.sc) best = { sc, g, k, r };
      }
      if (best && (!pairHits[best.r] || best.sc < pairHits[best.r].sc)) pairHits[best.r] = best;
    }
    for (const r of [1, 10, 20]) {
      const h = pairHits[r]; if (!h) continue;
      const [gk, mk, kk] = GK[r];
      const validated = d[gk] != null && d[kk] != null && !unsure.includes(gk) && Math.abs(d[gk] * r / (100 + r) - d[kk]) <= Math.max(0.03, d[kk] * 0.004);
      if (validated && Math.abs(d[gk] - h.g) < 0.006) continue;
      if (validated && d[gk] >= 100) continue;          // büyük tutarlarda mevcut doğrulanmış sonucu koru
      d[gk] = h.g; d[kk] = h.k; d[mk] = r2(h.g - h.k);
      for (const x of [gk, mk, kk]) { const j = unsure.indexOf(x); if (j >= 0) unsure.splice(j, 1); }
    }
    // --- KDV'si eşleşmeyen gruplar: metindeki tüm tutarlar arasında orana uyan KDV'yi ara ---
    const allA = []; L.forEach(l => { if (!l.cum) l.a.forEach(v => allA.push(v)); });
    for (const [gk, mk, kk, r] of [['g1', 'm1', 'k1', 1], ['g10', 'm10', 'k10', 10], ['g20', 'm20', 'k20', 20]]) {
      if (d[gk] == null || !unsure.includes(gk)) continue;
      if (d[gk] === 0) { d[mk] = 0; d[kk] = 0; for (const x of [gk, mk, kk]) unsure.splice(unsure.indexOf(x), unsure.indexOf(x) >= 0 ? 1 : 0); continue; }
      const exp = d[gk] * r / (100 + r), tol = Math.max(0.03, exp * 0.004);
      const hit = allA.filter(v => Math.abs(v - exp) <= tol).sort((a, b) => Math.abs(a - exp) - Math.abs(b - exp))[0];
      if (hit != null) { d[kk] = hit; d[mk] = r2(d[gk] - hit); for (const x of [gk, mk, kk]) { const i = unsure.indexOf(x); if (i >= 0) unsure.splice(i, 1); } }
    }
    // --- Genel toplam: birden fazla aday varsa tutarlı olanı seç ---
    if (genC.length > 1) {
      const grp = ['tekel', 'g1', 'g10', 'g20', 'gp'].reduce((a, x) => a + (d[x] || 0), 0), pay = (d.nakit || 0) + (d.kart || 0) + (d.diger || 0);
      const hit = genC.find(v => Math.abs(v - grp) < 0.06) ?? genC.find(v => Math.abs(v - pay) < 0.06);
      if (hit != null) d.genel = hit;
      else { const cnt = new Map(); genC.forEach(v => cnt.set(v, (cnt.get(v) || 0) + 1)); d.genel = [...cnt.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0][0]; }
    }
    // %0'lı satış: Luca şablonunda %0 sütunu yok; Tekel departmanı %0 ise ya da tekel okunamadıysa Tekel'e yaz
    if (d._g0 > 0) {
      const tekelIs0 = L.some(l => /TEKEL|S[İI]GARA|T[ÜU]T[ÜU]N/.test(l.s) && l.rate === 0);
      if (d.tekel == null) { d.tekel = d._g0; if (!tekelIs0) { unsure.push('tekel'); notes.push('%0’lı satış Tekel sütununa yazıldı; kontrol et.'); } }
    }
    delete d._g0;
    complete(d, allA, unsure, notes);
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

    repair(d, notes, unsure, allA);
    for (const kf of ['genel', 'nakit', 'kart']) if (d[kf] == null) unsure.push(kf);
    // Toplamlar tutmuyorsa KDV gruplarının hiçbiri "emin" sayılmasın
    const grp = ['tekel', 'g1', 'g10', 'g20', 'gp'].reduce((a, x) => a + (d[x] || 0), 0);
    if (d.genel != null && Math.abs(grp - d.genel) >= 0.06)
      for (const x of ['tekel', 'g1', 'm1', 'k1', 'g10', 'm10', 'k10', 'g20', 'm20', 'k20', 'gp']) if (d[x]) unsure.push(x);
    const found = Object.keys(d).filter(k => d[k] != null).length;
    return { d, unsure: [...new Set(unsure)], notes, found, amts: allA };
  }
  // Bir okumanın iç tutarlılığı: birden fazla okuma arasında seçim için
  function consistency(res) {
    const d = res.d; let s = 0;
    const grp = ['tekel', 'g1', 'g10', 'g20', 'gp'].reduce((a, x) => a + (d[x] || 0), 0);
    const pay = ['nakit', 'kart', 'diger'].reduce((a, x) => a + (d[x] || 0), 0);
    if (d.genel != null && grp > 0 && Math.abs(grp - d.genel) < 0.06) s += 3;
    if (d.genel != null && pay > 0 && Math.abs(pay - d.genel) < 0.06) s += 3;
    s -= res.unsure.length * 0.5; if (d.tarih) s += 0.5; if (d.z_no) s += 0.5;
    return s;
  }
  // Birden fazla okumayı alan alan birleştir: oylama + "0 → 8/9" alternatifleri + toplam tutarlılığı
  function merge(list) {
    if (list.length === 1) return list[0];
    const near = (a, b) => a != null && b != null && Math.abs(a - b) < 0.06;
    const zalt = v => { const [i, dd] = v.toFixed(2).split('.'), d2 = dd.replace(/[689]/g, '0'); return d2 !== dd ? [+(i + '.' + d2)] : []; };
    const cands = k => {
      const m = new Map();
      for (const r of list) { const v = r.d[k]; if (v == null || typeof v !== 'number') continue;
        m.set(v.toFixed(2), (m.get(v.toFixed(2)) || 0) + 1);
        for (const z of zalt(v)) m.set(z.toFixed(2), (m.get(z.toFixed(2)) || 0) + 0.4); }
      return [...m.entries()].map(([v, w]) => ({ v: +v, w })).sort((a, b) => b.w - a.w);
    };
    const vote = k => { const m = new Map(); for (const r of list) { const v = r.d[k]; if (v) m.set(v, (m.get(v) || 0) + 1); }
      const e = [...m.entries()].sort((a, b) => b[1] - a[1]); return { v: e.length ? e[0][0] : null, uni: e.length === 1 }; };
    const d = {}, unsure = [], notes = [...new Set(list.flatMap(r => r.notes))];
    const t = vote('tarih'), z = vote('z_no'); d.tarih = t.v; d.z_no = z.v;
    // Noktalı sıfır: "0760" bazen "6760" okunur, tersi pek olmaz → sadece 0↔6/8/9 farkı varsa sıfırlı olanı seç
    const zs = [...new Set(list.map(r => r.d.z_no).filter(Boolean))];
    const zeroOf = (a, b) => a.length === b.length && [...a].every((c, i) => c === b[i] || (c === '0' && /[689]/.test(b[i])));
    if (zs.length > 1) { const zero = zs.find(a => zs.every(b => zeroOf(a, b))); if (zero) { d.z_no = zero; z.uni = true; } }
    if (zs.length > 1) { const suf = zs.find(a => a.length <= 4 && zs.every(b => b === a || b.endsWith(a) || zeroOf(a, b.slice(-a.length)))); if (suf) { d.z_no = suf; z.uni = true; } }
    if (!t.v || !t.uni) unsure.push('tarih'); if (!z.v || !z.uni) unsure.push('z_no');
    if (d.z_no && d.z_no.length >= 4 && /^[689]/.test(d.z_no)) unsure.push('z_no');   // noktalı sıfır şüphesi
    if (d.z_no && d.z_no.length > 4) unsure.push('z_no');                                // fazladan rakam şüphesi ("20002")
    // KDV grupları: (toplam, KDV) çiftini oy + oran uyumuyla seç
    for (const [g, m, k, r] of [['g1', 'm1', 'k1', 1], ['g10', 'm10', 'k10', 10], ['g20', 'm20', 'k20', 20], ['gp', 'mp', 'kp', 20]]) {
      const G = cands(g), K = cands(k); if (!G.length) continue;
      let best = null;
      for (const a of G) for (const b of (K.length ? K : [{ v: null, w: 0 }])) {
        const ok = b.v != null && (a.v === 0 ? b.v === 0 : Math.abs(a.v * r / (100 + r) - b.v) <= Math.max(0.03, b.v * 0.004));
        const sc = a.w + b.w + (ok ? 3 : 0); if (!best || sc > best.sc) best = { sc, g: a.v, k: b.v, ok };
      }
      d[g] = best.g;
      if (best.k != null && best.ok) { d[k] = best.k; d[m] = r2(best.g - best.k); }
      else { d[m] = r2(best.g / (1 + r / 100)); d[k] = r2(best.g - d[m]); unsure.push(g, m, k); }
    }
    const tk = cands('tekel'); if (tk.length) d.tekel = tk[0].v;
    if (tk.length && tk[0].w >= 2) { const i = notes.findIndex(n => /Tekel sütununa yazıldı/.test(n)); if (i >= 0) notes.splice(i, 1); }
    const amts = [...new Set(list.flatMap(r => r.amts || []))];
    for (const k of ['nakit', 'kart', 'diger']) { const c = cands(k); if (c.length) d[k] = c[0].v; }
    // Genel toplam: oy + gruplarla ve ödemelerle uyum
    const grp = ['tekel', 'g1', 'g10', 'g20', 'gp'].reduce((a, x) => a + (d[x] || 0), 0);
    const pay = ['nakit', 'kart', 'diger'].reduce((a, x) => a + (d[x] || 0), 0);
    // Tekel ve genel toplamı birlikte seç: Tekel + KDV grupları = genel toplam = nakit + kart (+ diğer)
    const candsV = k => { const m = new Map(); for (const c of cands(k)) m.set(c.v, (m.get(c.v) || 0) + c.w);
      for (const c of cands(k)) for (const v of variants(c.v)) if (!m.has(v)) m.set(v, 0.3); return [...m.entries()].map(([v, w]) => ({ v, w })); };
    const gsum = ['g1', 'g10', 'g20', 'gp'].reduce((a, x) => a + (d[x] || 0), 0);
    const T = candsV('genel').map(c => ({ ...c, src: 'g' }));
    for (const n of cands('nakit')) for (const k of cands('kart')) T.push({ v: r2(n.v + k.v), w: (n.w + k.w) / 2, src: 'p' });
    const TK = candsV('tekel');
    let joint = null;
    for (const tk of TK.length ? TK : [{ v: 0, w: 0 }]) for (const t of T) {
      if (!near(tk.v + gsum, t.v)) continue;
      const alsoPay = T.some(u => u.src === 'p' && near(u.v, t.v)), alsoGen = T.some(u => u.src === 'g' && near(u.v, t.v));
      const sc = tk.w + t.w + (alsoPay ? 2 : 0) + (alsoGen ? 1 : 0);
      if (!joint || sc > joint.sc) joint = { sc, tk: tk.v, t: t.v, alsoPay };
    }
    let jointGenel = null;
    if (joint && (joint.alsoPay || joint.sc >= 2)) {
      if (TK.length) { if (d.tekel !== joint.tk) notes.push(`Tekel: ${String(d.tekel).replace('.', ',')} → ${joint.tk.toFixed(2).replace('.', ',')} (toplamlarla doğrulandı)`); d.tekel = joint.tk; }
      jointGenel = joint.t;
      const i = notes.findIndex(n => /Tekel sütununa yazıldı/.test(n)); if (i >= 0) notes.splice(i, 1);
    }
    const GC = cands('genel');
    if (jointGenel != null) d.genel = jointGenel;
    else if (GC.length) { let b = null; for (const c of GC) { const sc = c.w + (near(c.v, grp) ? 3 : 0) + (near(c.v, pay) ? 3 : 0); if (!b || sc > b.sc) b = { sc, v: c.v }; } d.genel = b.v; }
    else if (grp > 0) { d.genel = r2(grp); unsure.push('genel'); }
    complete(d, amts, unsure, notes);
    repair(d, notes, unsure, amts);
    const grpN = ['tekel', 'g1', 'g10', 'g20', 'gp'].reduce((a, x) => a + (d[x] || 0), 0);
    if (!near(d.genel, grpN)) { for (const x of ['g1', 'm1', 'k1', 'g10', 'm10', 'k10', 'g20', 'm20', 'k20', 'tekel', 'gp']) if (d[x]) unsure.push(x); }
    else { for (const x of ['tekel', 'g1', 'g10', 'g20', 'gp']) { let i; while ((i = unsure.indexOf(x)) >= 0) unsure.splice(i, 1); } }
    // yanıltıcı notları temizle: "%0 satış" (Tekel alanında zaten var) ve başka bir gruba ait çıkan "%8/%18 grubu bulundu"
    for (let i = notes.length - 1; i >= 0; i--) {
      if (/^%0 satış/.test(notes[i])) notes.splice(i, 1);
      else if (/^%(8|18) grubu bulundu \(([\d,]+)/.test(notes[i])) { const v = +RegExp.$2.replace(',', '.'); if (['g1', 'g10', 'g20'].some(g => near(d[g], v))) notes.splice(i, 1); }
    }
    // Ödemeler: adaylar arasından toplamı genel toplamı veren birleşimi seç
    if (d.genel != null) {
      const NC = cands('nakit'), KC = cands('kart'), DC = cands('diger');
      let bp = null;
      for (const n of NC.length ? NC : [{ v: null, w: 0 }]) for (const k of KC.length ? KC : [{ v: null, w: 0 }]) for (const o of DC.length ? DC : [{ v: null, w: 0 }]) {
        if (n.v == null && k.v == null) continue;
        if (!near((n.v || 0) + (k.v || 0) + (o.v || 0), d.genel)) continue;
        const sc = n.w + k.w + o.w; if (!bp || sc > bp.sc) bp = { sc, n: n.v, k: k.v, o: o.v };
      }
      if (bp) { d.nakit = bp.n; d.kart = bp.k; if (bp.o != null) d.diger = bp.o;
        for (const x of ['nakit', 'kart', 'diger']) { let i; while ((i = unsure.indexOf(x)) >= 0) unsure.splice(i, 1); } }
    }
    // Tek bir ödeme okunamadıysa: genel toplamdan hesapla (turuncu işaretli)
    if (d.genel != null && near(d.genel, grpN)) {
      if (d.kart == null && d.nakit != null) { d.kart = r2(d.genel - d.nakit - (d.diger || 0)); unsure.push('kart'); notes.push('Kart tutarı okunamadı; genel toplam − nakit olarak hesaplandı.'); }
      else if (d.nakit == null && d.kart != null) { d.nakit = r2(d.genel - d.kart - (d.diger || 0)); unsure.push('nakit'); notes.push('Nakit tutarı okunamadı; genel toplam − kart olarak hesaplandı.'); }
    }
    const pay2 = ['nakit', 'kart', 'diger'].reduce((a, x) => a + (d[x] || 0), 0);
    if (!near(pay2, d.genel)) unsure.push('nakit', 'kart');
    if (!near(d.genel, grpN) && !near(d.genel, pay2)) unsure.push('genel');
    for (const k of ['genel', 'nakit', 'kart']) if (d[k] == null) unsure.push(k);
    return { d, unsure: [...new Set(unsure)], notes, found: Object.keys(d).filter(k => d[k] != null).length };
  }
  root.ZParse = { version: 19, parseZ, normLine, amounts, consistency, merge };
})(typeof window !== 'undefined' ? window : globalThis);
