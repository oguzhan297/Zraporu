// ===== Z RAPORU GENEL OKUYUCU (kural tabanlı) =====
// Girdi: fişin düz metni (yazı tanıma çıktısı ya da kopyalanan metin)
// Çıktı: { d: alanlar, unsure: [emin olunamayan alanlar], notes: [açıklamalar] }
(function (root) {
  const TRU = s => s.toLocaleUpperCase('tr-TR');
  const RATES = [0, 1, 8, 10, 18, 20];
  const CUM = /MAL[İI1]\s?BELLEK|BELLEK\s?TOP|K[ÜU]M[ÜU]LAT[İI]F|\bK[ÜU]M(?:\b|\.|SATI|KDV|TOP|\s?TOPLAM)|M\.?\s?HAF[İI]ZA|MAL[İI]\s?HAF[İI]ZA|GENEL\s?K[ÜU]M/;
  // Tutar içinde yanlış okunan harfler → rakam (sadece tutara benzeyen parçalarda)
  const FIX = { B: '8', S: '5', O: '0', Ö: '0', D: '0', Q: '0', L: '1', I: '1', İ: '1', '|': '1', Z: '2', G: '6', H: '6', A: '4', T: '7', Y: '9', Ğ: '0', V: '0', U: '0' };
  const fixAmt = tok => tok.replace(/[BSOÖDQLIİ|ZGHATYĞVU]/g, c => FIX[c] || c);

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
    s = s.replace(/\bK[O0ÖD][VU]\b/g, 'KDV').replace(/\bTOPK[DO0Ö][VU]\b/g, 'TOPKDV');
    s = s.replace(/(^|\s)[ÇC(\[{]OPK[DO0Ö][VU]\b/g, '$1TOPKDV').replace(/\bTOPLA[NHRK]\b/g, 'TOPLAM');   // "ÇOPKDV", "(OPKDV", "TOPLAN"
    if (/TOPLAM|TOPKDV|\bKDV\b|N?AK[İI1]T\b|KRED[İI1]|D[İI1][ĞG]ER/.test(s)) {
      s = s.replace(/(\d)(?:\s+[^\s\d]{1,3})+\s*$/, '$1');                                // "48.235 09 İL" → "48.235 09"
      s = s.replace(/(\s[*'"“”«»]?\d{1,6})\s([0-9][0-9GĞOSBZ]|[GĞOSBZ][0-9])\s*$/, (m, a, b) => a + ',' + fixAmt(b));   // "43 G4" → "43,64"
    }                                    // "KOV" → "KDV"
    // bölümlü raporda departman oranı "TEMİZLİK %20.00" / "UNLU MAMÜL 401.00" / "TEKEL X00.00": tutar sanılmasın ("01.00" → 1,00 TL)
    if (!/[*]|MKTR|TOPLA|KDV|NAK|KART|KRED|MATRAH|TUTAR|SATI|[İI]ADE|[İI]PTAL|%\s?\d{1,2}\s/.test(s) && /[A-ZÇĞİÖŞÜ]{3}/.test(s))
      s = s.replace(/(\s)(?:[%xX$#&»<>]\s?|[4125](?=\d\d\s?[.,]))?(00|01|08|10|18|20)\s?[.,]\s?0[0-9OÖ](\s+\S{1,3})?\s*$/, (m, sp, r, j) => {
        const pre = m.trim()[0]; if (!/[%xX$#&»<>4125]/.test(pre) && !/^0/.test(r)) return m;   // çıplak "10,00" / "20,00" tutar olabilir: dokunma
        return sp + '%' + (+r); });
    s = s.replace(/([*'"“”«»]\d{0,3})([BOSZGĞD])(\d{0,2}[.,]\d{3}[.,\s]\d)/g, (m, a, b, c) => a + FIX[b] + c);   // "*2B.516,98" → "*28.516,98"
    s = s.replace(/^\+\s?(?=\d)/, '*').replace(/(\s)\+\s?(?=\d)/g, '$1*');   // "+8.654,00" → "*8.654,00"
    s = s.replace(/([*'"]\s?\d{1,3})\s(\d{3}[,.]\d{2})(?!\d)/g, '$1.$2'); // "*8 464,00" → "*8.464,00"
    {
      const kw = /TOPLAM|TOP\s?K[DO]V|\bKDV\b|N?AK[İI]T|D[İI][ĞG]ER|KART|KRED[İI]|SATI[ŞS]|C[İI]RO|BANKA|YEMEK/.test(s);
      const onlyAmt = !/[A-ZÇĞİÖŞÜ]{2}/.test(s.replace(/\s[A-ZÇĞİÖŞÜ]{1,3}\W*$/g, ''));
      if (kw || onlyAmt) {
        // "M1.433 36" / "A4 54": tutarın önüne yapışmış tek harf = "*"
        if (/TOP\s?K[DO]V|\bKDV\b|TOPLAM/.test(s)) s = s.replace(/(\s)[A-ZÇĞİÖŞÜ](?=\d{1,3}(?:[.,]\d{3})*[ ,.]\s?\d{2}\s*$)/, '$1*');
        // "417.467, S0" → "417.467,50" (kuruşta harf)
        s = s.replace(/(\d)([,.])\s?([0-9OÖDQSBGĞVU]{2})(?![\dA-ZÇĞİÖŞÜ])/g, (m, a, sep, dd) => (/\d/.test(dd) || /^[OÖDQ]{2}$/.test(dd)) ? a + sep + fixAmt(dd) : m);
        // "18.600.009" / "17.467.506" → "18.600,00" / "17.467,50" (kuruş ayırıcısı nokta + fazladan rakam)
        s = s.replace(/(\d{1,3}(?:\.\d{3})+)\.(\d{2})\d?(?![\d,.])/g, '$1,$2');
        s = s.replace(/([*'"“”«»]\s?\d{1,3}(?:\.\d{3})*)\s([0-9][0-9GĞOSBZ]|[GĞOSBZ][0-9])(?![\d,.A-ZÇĞİÖŞÜ])/g, (m, a, b) => a + ',' + fixAmt(b));   // "*28.516 9G" → "*28.516,96"
        s = s.replace(/([*'"“”«»]\s?\d{1,3})\s(\d{3}[,.]\d{2})(?!\d)/g, '$1.$2');   // "*8 600,00" → "*8.600,00"
      }
    }
    // binlik noktası boşluk olmuş ve önünde yıldız yok: "TOPLAM 142 163,80", "TOPLAM X42 163,80", "*) 822,00" (")" = "1.")
    if (/TOPLAM|TOP\s?K[DO]V|\bKDV\b|N?AK[İI1]T|KRED/.test(s)) {
      s = s.replace(/([*'"“”«»]\s?)\)\s?(\d{3}[,.]\d{2})(?!\d)/g, '$11.$2');
      s = s.replace(/(\s[*'"“”«»xX#$]?)(\d{1,3})\s(\d{3}[,.]\d{2})(?!\d)/g, '$1$2.$3');
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
    // (her turda en az bir karakter silinmeli; silinmezse dur — v18–v21'de "*15892,42 TARİH" gibi satırda sonsuz döngüye giriyordu)
    for (let g = 0; g < 20 && /\d[,.]\d{2}(?:\s+[^\s\d]{1,3})+\s*$/.test(s); g++) { const t = s.replace(/\s+[^\s\d]{1,3}\s*$/, ''); if (t === s) break; s = t; }
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
    if (!miss.length || rest < 0.006) { if (miss.length && Math.abs(rest) < 0.006) miss.forEach(([g, m, k]) => { if (d[g] == null || d[g] === 0) { d[g] = 0; d[m] = 0; d[k] = 0; [g, m, k].forEach(x => { const i = unsure.indexOf(x); if (i >= 0) unsure.splice(i, 1); }); } }); return; }
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
        if (!amts.some(v => Math.abs(v - b) < 0.006) && b !== 0) continue;
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
    const RATE = { g1: 1, g10: 10, g20: 20 };
    const fix = (keys, target, label) => {
      const cur = keys.reduce((a, k) => a + (d[k] || 0), 0);
      if (Math.abs(cur - target) < 0.006) return 'ok';
      let best = null;
      const rec = (i, acc, ch, pick) => {
        if (i === keys.length) { if (Math.abs(acc - target) < 0.006) {
          // eşit sayıda değişiklikte: okunan KDV'si oranına uyan grup sayısı fazla olan kazanır
          const kf = pick.reduce((a, v, x) => { const r = RATE[keys[x]]; if (!r || !v) return a; const e = v * r / (100 + r);
            return a + ([d['k' + r], ...amts].some(u => u != null && u > 0 && Math.abs(u - e) <= Math.max(0.011, e * 0.0005)) ? 1 : 0); }, 0);
          if (!best || ch < best.ch || (ch === best.ch && kf > best.kf)) best = { ch, kf, pick: [...pick], tie: false };
          else if (ch === best.ch && kf === best.kf && pick.some((v, x) => v !== best.pick[x])) best.tie = true; } return; }
        for (const v of alts(d[keys[i]])) { pick.push(v); rec(i + 1, acc + (v || 0), ch + (v === d[keys[i]] ? 0 : 1), pick); pick.pop(); }
      };
      rec(0, 0, 0, []);
      if (!best || best.ch === 0 || best.ch > 2) return false;
      if (best.tie) return false;   // birden fazla eşit düzeltme var: tahmin etme, turuncu kalsın
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
          if (kv != null) d[k] = kv; else { d[k] = r2(e); unsure.push(k); (d._calc = d._calc || []).push(k); }
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

  // Toplam çözücü: kesinleşmemiş KDV gruplarını, genel toplamı TAM tutturan ve her grubun KDV'si oranına uyan birleşimle bul
  function solveGroups(d, amts, unsure, notes) {
    if (d.genel == null) return false;
    const R = [['g1', 'm1', 'k1', 1], ['g10', 'm10', 'k10', 10], ['g20', 'm20', 'k20', 20]];
    const isOk = x => d[x[0]] != null && !unsure.includes(x[0]) && !unsure.includes(x[2]);
    const otherSum = (d.gp || 0) + R.filter(isOk).reduce((a, x) => a + d[x[0]], 0);
    const open = R.filter(x => !isOk(x));
    if (!open.length) return false;
    // Tekel adayları: okunan değer; şüpheliyse okuma hatası varyantları da (ör. "*2.030,00" → "12.030,00"),
    // ama varyant ancak metinde aynen geçiyorsa (Tekel departman satırı) kabul edilir
    const amtSet = new Set(amts);
    const TK = [{ v: d.tekel || 0, orig: true }];
    if (d.tekel && (unsure.includes('tekel') || d.tekel + otherSum > d.genel + 0.006))
      for (const w of variants(d.tekel)) if (w > 0 && amtSet.has(w)) TK.push({ v: w, orig: false });
    const kPool = new Map(); for (const v of amts) { kPool.set(v, true); for (const w of variants(v)) if (!kPool.has(w)) kPool.set(w, false); }
    const kOf = (g, r) => { const e = g * r / (100 + r); let b = null;
      for (const [v, orig] of kPool) { const t = orig ? Math.max(0.03, v * 0.004) : Math.max(0.01, v * 0.002); const er = Math.abs(v - e) + (orig ? 0 : 1000); if (Math.abs(v - e) <= t && (!b || er < b.er)) b = { k: v, orig, er }; } return b; };
    let best = null;
    for (const tk of TK) {
      const rest = r2(d.genel - tk.v - otherSum);
      if (rest < 0) continue;
      const pool = new Map();                                    // metindeki tutarlar (asıl / varyant)
      for (const v of amts) { if (v > 0 && v <= rest + 0.01) pool.set(v, true); for (const w of variants(v)) if (w > 0 && w <= rest + 0.01 && !pool.has(w)) pool.set(w, false); }
      // Her açık grup için adaylar: oranı belli satırdan okunan toplam (ve varyantları) + metindeki tutarlar + 0
      const C = open.map(x => { const m = new Map([[0, { v: 0, lab: false, orig: true }]]);
        if (d[x[0]] != null) for (const v of [d[x[0]], ...variants(d[x[0]])]) m.set(v, { v, lab: true, orig: v === d[x[0]] });
        if (d._dp && d._dp[x[3]] > 0 && !m.has(d._dp[x[3]])) m.set(d._dp[x[3]], { v: d._dp[x[3]], lab: true, orig: true });   // departman bilgilerinden
        for (const [v, orig] of pool) if (!m.has(v)) m.set(v, { v, lab: false, orig }); return m; });
      const score = parts => {
        let sc = tk.orig ? 0.5 : 0; const ks = [];
        for (const p of parts) {
          if (p.v === 0) { ks.push({ k: 0, orig: true }); continue; }
          if (p.v < 1) return;
          const kv = kOf(p.v, p.x[3]);
          if (!kv && !p.lab) return;                               // KDV'si de yok, oranı belli satırdan da gelmiyor → kabul etme
          ks.push(kv); sc += (kv ? 2 + (kv.orig ? 1 : 0) : 0) + (p.lab ? 2 + (p.orig ? 1 : 0) : 0) + (p.orig ? 0.5 : 0);
        }
        if (!best || sc > best.sc) best = { sc, parts: parts.map(p => ({ ...p })), ks, tk };
      };
      const n = open.length;
      if (n === 1) { const c = C[0].get(rest) || (pool.has(rest) ? { v: rest, lab: false, orig: pool.get(rest) } : null); if (c) score([{ ...c, x: open[0] }]); }
      else if (n === 2) { for (const a of C[0].values()) { const b = r2(rest - a.v); const c = C[1].get(b); if (c) score([{ ...a, x: open[0] }, { ...c, x: open[1] }]); } }
      else { for (const a of C[0].values()) for (const b of C[1].values()) { const c3 = r2(rest - a.v - b.v); if (c3 < 0) continue; const c = C[2].get(c3); if (c) score([{ ...a, x: open[0] }, { ...b, x: open[1] }, { ...c, x: open[2] }]); } }
    }
    // Tek grup eksik ve KDV'si okunamadı: toplam = genel − diğerleri metinde geçiyorsa, KDV = fişin KDV toplamı − diğer KDV'ler orana uyuyorsa al
    if (!best && open.length === 1 && d._tk != null) {
      const [g, m, k, r] = open[0], rest = r2(d.genel - (d.tekel || 0) - otherSum), e = rest * r / (100 + r);
      const ok = R.filter(isOk).reduce((a, x) => a + (d[x[2]] || 0), 0) + (d.kp || 0);
      const kt = [d._tk, ...variants(d._tk)].map(v => r2(v - ok)).find(v => v > 0 && Math.abs(v - e) <= Math.max(0.03, e * 0.003));
      if (rest > 0 && kt != null && amts.some(v => Math.abs(v - rest) < 0.006)) {
        notes.push(`%${r} toplamı genel toplamdan, KDV'si fişin KDV toplamından bulundu (${rest.toFixed(2).replace('.', ',')} / ${kt.toFixed(2).replace('.', ',')}).`);
        d[g] = rest; d[k] = kt; d[m] = r2(rest - kt); (d._kTk = d._kTk || []).push(k); for (const x of [g, m, k, 'tekel']) { let j; while ((j = unsure.indexOf(x)) >= 0) unsure.splice(j, 1); }
        return true;
      }
    }
    if (!best) return false;
    if (!best.tk.orig) { notes.push(`Tekel: ${String(d.tekel).replace('.', ',')} → ${best.tk.v.toFixed(2).replace('.', ',')} (okuma hatası; genel toplamla doğrulandı)`); d.tekel = best.tk.v; }
    best.parts.forEach((p, i) => { const [g, m, k, r] = p.x;
      if (d[g] != null && Math.abs(d[g] - p.v) >= 0.006) notes.push(`%${r} toplamı: ${String(d[g]).replace('.', ',')} → ${p.v.toFixed(2).replace('.', ',')} (genel toplamla doğrulandı)`);
      d[g] = p.v; for (const x of [g, m, k]) { let j; while ((j = unsure.indexOf(x)) >= 0) unsure.splice(j, 1); }
      if (best.ks[i]) { d[k] = best.ks[i].k; }
      else { d[k] = r2(p.v * r / (100 + r)); unsure.push(k, m); (d._calc = d._calc || []).push(k); notes.push(`%${r} KDV okunamadı; orandan hesaplandı, fişle kontrol et.`); }
      d[m] = r2(p.v - d[k]); });
    { let j; while ((j = unsure.indexOf('tekel')) >= 0) unsure.splice(j, 1); }
    return true;
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

    // Bölümlü Z raporu (KDV BİLGİLERİ / DEPARTMAN / ÖDEME BİLGİLERİ / BELGE TİPLERİ / SAYAÇLAR): her satırın bölümünü işaretle
    { let sec = null;
      for (const l of L) {
        const t = l.s;
        if ((/K[DO0ÖU][VU]\s?B[İI1]L|^\W*\S{0,3}\s?B[İI1]LG[İI1]LER[İI1]\W*$/.test(t) || (/[-.<>»]{4,}/.test(t) && /K[DO0ÖU][VU]B?/.test(t))) && !/DEPART|[ÖO]DEME|BELGE|SAYA|KAS[İI1]YER|G[ÜU]NL/.test(t)) sec = 'kdvb'; else if (/DEPARTMAN/.test(t)) sec = 'dept'; else if (/[ÖO]DEME\s?B[İI1]LG/.test(t)) sec = 'odeme';
        else if (/BELGE\s?T[İI1]P/.test(t)) sec = 'belge'; else if (/SAYA[ÇC]LAR/.test(t)) sec = 'sayac'; else if (/KAS[İI1]YER\s?B/.test(t)) sec = 'kasiyer';
        else if (/G[ÜU]NL[ÜU]K\s?F[İI1][ŞS]/.test(t)) sec = 'gunluk';
        else if (sec === 'belge' && /^\W*[İI1][PR]\S{0,2}AL\b/.test(t)) sec = 'iptal';
        l.sec = sec;
        if (sec === 'belge' && /D[İI1][ĞG]ER/.test(t)) sec = 'iptal';   // -DİĞER'den sonrası iptal bölümü
        // İptal, sayaç, kasiyer ve (kullanıcı isteği) ödeme bilgileri satırları hesaba katılmaz
        if (sec === 'iptal' || sec === 'sayac' || sec === 'kasiyer' || sec === 'odeme') l.cum = true;
      }
    }
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
    // Tarih adayları: tam geçerli olanlar 1 puan; okuma hatası düzeltilmiş olanlar ("11-18" → ay 10, yıl "2626" → 2026) 0,4 puan
    const c = {}, fixD = x => x.replace(/[689]/g, '0');
    const addDate = (D, M, Y, w) => {
      let dd = +D, mm = +M, yy = Y.length === 2 ? 2000 + +Y : +Y, ww = w;
      if (yy < 2000 || yy > 2099) { if (Y.length === 4 && /^2\d2\d$/.test(Y)) { yy = +('20' + Y.slice(2)); ww *= 0.4; } else return; }
      if (mm < 1 || mm > 12) { mm = +fixD(M); ww *= 0.4; }
      if (dd < 1 || dd > 31) { dd = +fixD(D); ww *= 0.4; }
      if (!(dd >= 1 && dd <= 31 && mm >= 1 && mm <= 12)) return;
      const k = `${String(dd).padStart(2, '0')}.${String(mm).padStart(2, '0')}.${yy}`; c[k] = (c[k] || 0) + ww;
    };
    for (const x of all.matchAll(/\b(\d{1,2})[./-](\d{1,2})[./-](\d{4}|\d{2})\b/g)) addDate(x[1], x[2], x[3], 1);
    // "TARİH" satırı (TARİM/TARİN okunabilir): ayırıcı boşluk da olabilir ("11 10 2026", "11-18 2026")
    for (const l of L) { const x = l.s.match(/TAR[İI1]\S{0,2}\W*(\d{1,2})\s*[./\-\s:]\s*(\d{1,2})\s*[./\-\s:]\s*(\d{4})\b/); if (x) addDate(x[1], x[2], x[3], /\d[./-]\d{1,2}[./-]\d/.test(x[0]) ? 0 : 0.8); }
    const dk = Object.keys(c);
    if (dk.length) { dk.sort((a, b) => c[b] - c[a]); d.tarih = dk[0]; if (c[dk[0]] < 1 || (dk[1] && c[dk[1]] >= c[dk[0]] * 0.8)) unsure.push('tarih'); }
    if (!d.tarih) unsure.push('tarih');
    else if (+d.tarih.slice(6) < new Date().getFullYear() - 1) unsure.push('tarih');   // "2021": yıl okuma hatası olabilir

    // --- Z No ---
    m = all.match(/\bZ\s?(?:NO|NUMARASI|SIRA\s?NO|SAYISI|SAYA[ÇC])\s*[:.]?\s*(\d{1,6})\b/) ||
        all.match(/(?:^|\n)[^\n]{0,3}RAPOR\s?(?:NO|N[O0D]|M[O0D]|NUMARASI)\s*[:.]?\s*(\d{1,6})\b/) ||
        all.match(/(?:^|\n)[^\n]{0,4}RAPOR(?![UI])\s*[^\s\d]{0,4}\s*[:.]?\s*(\d{3,6})\s*(?:\n|$)/) ||
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
    const GEN = /\bGENEL\s?TOPLAM\b|\bTOPLAM\s?SATI[ŞS]|SATI[ŞS]\s?TOPLAMI|NET\s?SAT[IİÎ1]?[ŞS]|NET\s?S[A-ZÇĞİÖŞÜ]{3,5}(?![A-ZÇĞİÖŞÜ])|NET\s?C[İI]RO|\bTOPLAM\b|\bTOP\b/;
    const STRONG = /\bGENEL\s?TOPLAM\b|\bTOPLAM\s?SATI[ŞS]|SATI[ŞS]\s?TOPLAMI|NET\s?SAT[IİÎ1]?[ŞS]|NET\s?S[A-ZÇĞİÖŞÜ]{3,5}(?![A-ZÇĞİÖŞÜ])|NET\s?C[İI]RO/;
    const genS = [], genW = [];
    for (let i = 0; i < L.length; i++) { const l = L[i]; if (l.cum || l.rate != null || !GEN.test(l.s) || EXG.test(l.s)) continue; const v = amtAt(i); if (v != null) (STRONG.test(l.s) ? genS : genW).push(v); }
    const genC = genS.length ? genS : genW;
    d.genel = genC.length ? genC[0] : null;
    d._genWeak = !genS.length && genW.length > 0;   // genel toplam yalnızca etiketsiz "TOPLAM" satırından: başka kaynakla doğrulanmalı
    d.top_kdv = null;
    for (let i = 0; i < L.length; i++) { const l = L[i]; if (l.cum || l.rate != null) continue; if (/TOP\s?KDV|TOPLAM\s?KDV|KDV\s?TOPLAM|TOPKDV/.test(l.s)) { d.top_kdv = amtAt(i); break; } }
    d.nakit = find(/NAK[İI]T/, /[ÜU]ST[ÜU]|SAYI|ADET|KASA/);
    d.kasa = find(/KASA\s?NAK[İI]T/, /SAYI|ADET/);
    if (d.nakit == null) d.nakit = d.kasa;
    d.kart = find(/KRED[İI]|K\S{0,2}\s?KART|BANKA\s?KART|\bKART\b|POS\b/, /SAYI|ADET|NAK[İI]T|YEMEK/);
    // Kart satırının altındaki banka dökümü (Ziraat, Vakıfbank…): toplamları kart tutarını doğrular
    { const ki = L.findIndex(l => /KRED[İI]|K\S{0,2}\s?KART|BANKA\s?KART/.test(l.s) && !/ADET|SAYI/.test(l.s));
      if (ki >= 0) { const b = []; let start = ki + 1; if (L[start] && !hasLetters(L[start].s)) start++;
        for (let j = start; j < Math.min(L.length, ki + 10); j++) { if (/ADET|SAYI|M[ÜU][ŞS]TER|VERG[İI]|D[ÖO]K[ÜU]M|YEMEK|[ÇC]EK|NAK[İI]T|TOPLAM|SATI/.test(L[j].s)) break; if (L[j].a.length && L[j].a[L[j].a.length - 1] > 0) b.push(L[j].a[L[j].a.length - 1]); }
        if (b.length) d._banks = b; } }
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
        const vo = pool.filter(p => !p.alt).map(p => p.v);
        for (const a of vo) for (const b of vo) for (const c of vo) {          // Matrah + KDV = Toplam üçlüsü
          if (!(a > b && c > a)) continue;
          const e1 = Math.abs(a + b - c), e2 = Math.abs(a * r / 100 - b);
          if (e1 <= 0.02 && e2 <= tol(b)) { const e = e1 + e2; if (!best || e < best.e) best = { e, g: c, m: a, k: b }; }
        }
        if (!best) for (const P of pool) for (const Q of pool) {             // (KDV dahil, KDV) ya da (matrah, KDV)
          const a = P.v, b = Q.v; if (a <= b) continue;
          const pen = (P.alt ? 1000 : 0) + (Q.alt ? 1000 : 0);               // okunan asıl değer tutuyorsa varyanta hiç bakma
          // etiket "TOPLAM" ise matrah sayma, "MATRAH" ise toplam sayma (küçük tutarlarda matematik ayırt edemez)
          const eg = P.kind === 'm' ? Infinity : Math.abs(a * r / (100 + r) - b), em = P.kind === 'g' ? Infinity : Math.abs(a * r / 100 - b);
          const tl = (P.alt || Q.alt) ? Math.max(0.01, b * 0.002) : tol(b);
          if (eg <= tl && (!best || eg + pen < best.e)) best = { e: eg + pen, g: a, k: b, m: r2(a - b) };
          if (em <= tl && (!best || em + pen < best.e)) best = { e: em + pen, m: a, k: b, g: r2(a + b) };
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
      // fazladan rakam ayırarak üretilen adaylar ("22.861" → 22,86) gerçek tutarların gerisinde kalsın
      const GA = new Set(amounts(a.s)), KA = new Set(amounts(b.s)), xp = (v, S) => S.has(v) ? 0 : 500;
      let best = null;
      for (const g0 of G) for (const g of [g0, ...variants(g0)]) for (const k0 of K) for (const k of [k0, ...variants(k0)]) for (const r of [1, 10, 20]) {
        if (g < 0.5 || k <= 0) continue;
        const e = Math.abs(g * r / (100 + r) - k), t = (g !== g0 || k !== k0) ? Math.max(0.01, k * 0.002) : Math.max(0.025, k * 0.001);
        if (e > t) continue;
        const vp = g0 < 20 ? 0.012 : 1000;   // küçük tutarlarda tolerans görece büyük: tam tutan varyant, zorlama tutan orijinali geçebilsin
        const sc = e + (g !== g0 ? vp : 0) + (k !== k0 ? vp : 0) + xp(g0, GA) + xp(k0, KA) + (a.rate != null && a.rate !== r ? 0.01 : 0);
        if (!best || sc < best.sc) best = { sc, g, k, r, alt: xp(g0, GA) + xp(k0, KA) > 0 };
      }
      if (best && !best.alt && (!pairHits[best.r] || best.sc < pairHits[best.r].sc)) pairHits[best.r] = best;   // bölünmüş-rakam adayları ("2.479" → 2,47) grup sayılmaz
    }
    // Vergi dökümünde okunan (toplam, KDV) çiftleri: uygulama gruplarla karşılaştırır
    d._vd = {}; for (const r of [1, 10, 20]) { const h = pairHits[r]; if (h && h.sc < 1001) d._vd[r] = [h.g, h.k]; }   // en çok bir tarafı okuma hatası düzeltilmiş
    if (!Object.keys(d._vd).length) delete d._vd;
    for (const r of [1, 10, 20]) {
      const h = pairHits[r]; if (!h) continue;
      const [gk, mk, kk] = GK[r];
      const validated = d[gk] != null && d[kk] != null && !unsure.includes(gk) && Math.abs(d[gk] * r / (100 + r) - d[kk]) <= Math.max(0.03, d[kk] * 0.004);
      if (validated && Math.abs(d[gk] - h.g) < 0.006) continue;
      if (validated && d[gk] >= 100) continue;          // büyük tutarlarda mevcut doğrulanmış sonucu koru
      d[gk] = h.g; d[kk] = h.k; d[mk] = r2(h.g - h.k);
      for (const x of [gk, mk, kk]) { const j = unsure.indexOf(x); if (j >= 0) unsure.splice(j, 1); }
      if (h.sc >= 1) unsure.push(gk, mk, kk);   // okuma hatası düzeltilerek eşleşti: genel toplamla yeniden doğrulansın
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
      const hit = genC.find(v => Math.abs(v - grp) < 0.006) ?? genC.find(v => Math.abs(v - pay) < 0.006);
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
      if (Math.abs(diff) > 0.006) for (const extra of [(d.tekel || 0) + (d.gp || 0), d.gp || 0, d.tekel || 0]) {
        // okunan %20 KDV eski toplamla tutuyorsa (yenisiyle tutmuyorsa) düşme: tekel yanlış okunmuştur
        const kOld = d.k20 != null && Math.abs(d.k20 - d.g20 * 20 / 120) <= Math.max(0.05, d.k20 * 0.0001);
        const kNew = d.k20 != null && Math.abs(d.k20 - (d.g20 - extra) * 20 / 120) <= Math.max(0.05, d.k20 * 0.0001);
        if (kOld && !kNew && !(d.gp > 0 && extra >= d.gp)) continue;   // poşet %20'li olduğundan KDV'si %20 KDV'nin içindedir; tekel (%0) değildir
        if (extra > 0 && Math.abs(diff - extra) <= 0.006 && d.g20 > extra) {
          d.g20 = r2(d.g20 - extra); d.m20 = r2(d.g20 / 1.2); d.k20 = r2(d.g20 - d.m20);
          unsure.push('g20', 'm20', 'k20');
          notes.push('Tekel/poşet %20 grubunun içinde basılmış; %20’den düşüldü, kontrol et.');
          break;
        }
      }
    }
    // Poşetin matrah/KDV'si
    if (d.gp != null) { d.mp = r2(d.gp / 1.2); d.kp = r2(d.gp - d.mp); }

    sectioned(L, d, unsure, notes);
    if (d._dp) for (const v of Object.values(d._dp)) if (v > 0 && !allA.includes(v)) allA.push(v);   // departman toplamları da aday
    // Genel toplam bozuk okunduysa ("313.971,00" — baştaki '*' → 3): varyantı nakit + kart ile birebir tutuyorsa onu al
    if (d.genel != null && d.kart != null) {
      const NC = [d.nakit, d.kasa].filter(v => v != null).flatMap(v => [v, ...variants(v)]), KC = [d.kart, ...variants(d.kart)];
      const payOk = v => NC.some(n => KC.some(k => Math.abs(n + k - v) < 0.006));
      if (!payOk(d.genel)) { const gv = variants(d.genel).filter(payOk); if (gv.length === 1) { notes.push(`Genel toplam: ${String(d.genel).replace('.', ',')} → ${gv[0].toFixed(2).replace('.', ',')} (nakit + kartla doğrulandı)`); d.genel = gv[0]; } }
      // genel toplam hiç tutmuyor ama gruplar toplamı ödemelerle tutuyorsa genel toplam odur
      const grp0 = ['tekel', 'g1', 'g10', 'g20', 'gp'].reduce((a, x) => a + (d[x] || 0), 0);
      if (!payOk(d.genel) && Math.abs(grp0 - d.genel) >= 0.006 && grp0 > 0 && payOk(r2(grp0))) { notes.push(`Genel toplam: ${String(d.genel).replace('.', ',')} → ${grp0.toFixed(2).replace('.', ',')} (gruplar ve nakit + kart birbirini tutuyor)`); d.genel = r2(grp0); }
    }
    solveGroups(d, allA, unsure, notes);
    // Nakit tutmuyorsa "KASA NAKİT" satırını dene
    if (d.genel != null && d.kasa != null && d.kart != null && Math.abs((d.nakit || 0) + d.kart + (d.diger || 0) - d.genel) >= 0.006 && Math.abs(d.kasa + d.kart + (d.diger || 0) - d.genel) < 0.006) {
      notes.push(`Nakit: ${String(d.nakit).replace('.', ',')} → ${d.kasa.toFixed(2).replace('.', ',')} ("KASA NAKİT" satırından)`); d.nakit = d.kasa; }
    repair(d, notes, unsure, allA);
    fixTopKdv(d, unsure, notes);
    maliKdv(d, L, unsure, notes);
    // Tekel okunamadıysa: genel toplam (ödemelerle doğrulanmış) − KDV grupları, metinde aynen geçiyorsa Tekel odur
    if ((d.tekel == null || d.tekel === 0) && d.genel != null && d.kart != null) {
      const rest = r2(d.genel - ['g1', 'g10', 'g20', 'gp'].reduce((a, x) => a + (d[x] || 0), 0));
      const pay = (d.nakit || 0) + d.kart + (d.diger || 0), payK = (d.kasa != null ? d.kasa : d.nakit || 0) + d.kart + (d.diger || 0);
      if (rest > 0.005 && allA.some(v => Math.abs(v - rest) < 0.006) && (Math.abs(pay - d.genel) < 0.006 || Math.abs(payK - d.genel) < 0.006)
          && ['g1', 'g10', 'g20'].every(g => !unsure.includes(g))) {
        notes.push(`Tekel okunamadı; genel toplam − KDV grupları = ${rest.toFixed(2).replace('.', ',')} (fişte de geçiyor)`); d.tekel = rest; }
    }
    solvePay(d, allA, unsure, notes);
    for (const kf of ['genel', 'nakit', 'kart']) if (d[kf] == null) unsure.push(kf);
    // Toplamlar tutmuyorsa KDV gruplarının hiçbiri "emin" sayılmasın
    const grp = ['tekel', 'g1', 'g10', 'g20', 'gp'].reduce((a, x) => a + (d[x] || 0), 0);
    if (d.genel != null && Math.abs(grp - d.genel) >= 0.006)
      { for (const x of ['tekel', 'g1', 'm1', 'k1', 'g10', 'm10', 'k10', 'g20', 'm20', 'k20', 'gp']) if (d[x]) unsure.push(x); if (!d.tekel) unsure.push('tekel'); }   // boş Tekel de şüpheli
    checkTk(d, unsure, notes);
    if (ciroReport(L, d, unsure, notes)) { const u = [...new Set(unsure)]; return { d, unsure: u, notes: [...new Set(notes)], found: Object.keys(d).filter(k => d[k] != null).length, amts: allA }; }
    // zayıf kaynaklı genel toplam ödemelerle de tutmuyorsa gruplar dahil hiçbir şey "kesin" sayılmasın ("TOPLAM *724,00" genel sanıldı, diğer gruplar 0 yapıldı)
    if (d._genWeak && d.genel != null) { const pay = (d.nakit || 0) + (d.kart || 0) + (d.diger || 0); if (Math.abs(pay - d.genel) >= 0.006) unsure.push('genel', 'tekel', 'g1', 'm1', 'k1', 'g10', 'm10', 'k10', 'g20', 'm20', 'k20'); }
    const found = Object.keys(d).filter(k => d[k] != null).length;
    return { d, unsure: [...new Set(unsure)], notes: [...new Set(notes)], found, amts: allA };
  }
  // Bir grubun KDV'si yerine "TOPLAM KDV" okunduysa: diğer KDV'leri çıkarıp düzelt
  function fixTopKdv(d, unsure, notes) {
    if (d.top_kdv == null || !(d.top_kdv > 0)) return;
    const R = [['g1', 'm1', 'k1', 1], ['g10', 'm10', 'k10', 10], ['g20', 'm20', 'k20', 20]];
    for (const [g, m, k, r] of R) {
      if (d[k] == null || Math.abs(d[k] - d.top_kdv) >= 0.006) continue;
      const others = R.filter(x => x[2] !== k).reduce((a, x) => a + (d[x[2]] || 0), 0);
      if (others < 0.005) continue;
      const nk = r2(d.top_kdv - others), e = (d[g] || 0) * r / (100 + r);
      if (Math.abs(d[k] - e) <= Math.max(0.05, e * 0.0001)) continue;   // zaten oranına uyuyor (Beko'da "TOPKDV" grup satırıdır)
      if (Math.abs(nk - e) <= Math.max(0.05, e * 0.0001)) { d[k] = nk; d[m] = r2(d[g] - nk); notes.push(`%${r} KDV: toplam KDV yerine okunmuştu; ${String(nk).replace('.', ',')} olarak düzeltildi.`); }
      else { d[k] = r2(e); d[m] = r2(d[g] - d[k]); unsure.push(k, m); }
    }
  }
  // "MALİ VERİ" altındaki TOPKDV = tüm KDV'lerin toplamı. %20 KDV en çok bozulan alan: okunamadı/şüpheliyse buradan bul,
  // okunduysa bununla doğrula
  function maliKdv(d, L, unsure, notes) {
    let cands = d._mk || [];
    if (L) { const mi = L.findIndex(l => /MAL[İI1]\s?VER/.test(l.s));
      // etiket çoğu zaman bozuk okunuyor ("TOPKOWL", "MAĞ"): penceredeki tüm tutarlar aday; yalnızca KDV toplamını TAM tutturan kullanılır
      if (mi >= 0) { for (let j = mi + 1; j < Math.min(L.length, mi + 6); j++) { if (L[j].cum || /K[ÜU]M/.test(L[j].s)) break; cands = cands.concat(L[j].a); }
        if (cands.length) d._mk = cands; } }
    if (d._tk != null && !cands.includes(d._tk)) cands = cands.concat([d._tk]);   // bölümlü raporda belge KDV TOPLAMI
    if (!cands.length) return;
    const C = [...new Set(cands.flatMap(v => [v, ...variants(v)]))];
    const ks = ['k1', 'k10', 'k20', 'kp'], sumK = () => ks.reduce((a, k) => a + (d[k] || 0), 0);
    const hit = C.find(v => Math.abs(v - sumK()) < 0.006);
    if (hit != null) { d._topk = hit; return; }
    // Bir grubun KDV'si şüpheliyse / orandan hesaplandıysa: toplam KDV − diğer KDV'ler, o grubun oranına uyuyorsa onu al.
    // %20 KDV okunmuş ve kesin sayılsa bile toplamdan bulunan değer orana belirgin daha iyi uyuyorsa düzelt ("303,61" → 303,67)
    const R = [['g20', 'm20', 'k20', 20], ['g10', 'm10', 'k10', 10], ['g1', 'm1', 'k1', 1]];
    const weak = R.filter(([g, , k]) => d[g] > 0 && (d[k] == null || unsure.includes(k) || (d._calc || []).includes(k)));
    const tryFix = ([g, m, k, r], force) => {
      const others = sumK() - (d[k] || 0), e = d[g] * r / (100 + r);
      const fit = arr => [...new Set(arr.map(v => r2(v - others)).filter(x => x > 0 && Math.abs(x - e) <= Math.max(0.03, e * 0.003)))];
      let f = fit(cands); if (f.length !== 1) f = fit(C);      // önce okunan değerin kendisi, olmazsa okuma hatası varyantları
      if (f.length !== 1) return false;
      if (!force && !(Math.abs((d[k] ?? 1e9) - e) > Math.abs(f[0] - e) + 0.02)) return false;
      if (d[k] !== f[0]) notes.push(`%${r} KDV: ${d[k] == null ? '—' : String(d[k]).replace('.', ',')} → ${f[0].toFixed(2).replace('.', ',')} (fişin KDV toplamından doğrulandı)`);
      d[k] = f[0]; d[m] = r2(d[g] - f[0]); d._topk = r2(others + f[0]); (d._kTk = d._kTk || []).push(k); if (k === 'k20') d._k20mk = 1;
      for (const x of [k, m]) { let j; while ((j = unsure.indexOf(x)) >= 0) unsure.splice(j, 1); }
      if (d._calc) d._calc = d._calc.filter(x => x !== k);
      return true;
    };
    // önce orandan HESAPLANMIŞ (hiç okunmamış) KDV, sonra şüpheli okunan
    const calc = weak.filter(([, , k]) => d[k] == null || (d._calc || []).includes(k));
    if (calc.length === 1) tryFix(calc[0], true);
    else if (weak.length === 1) tryFix(weak[0], true);
    else if (!weak.length && d.g20 > 0) tryFix(R[0], false);
  }
  // Ödemeler: genel toplam gruplarla doğrulanmışsa nakit + kart (+ diğer) = genel toplam olacak şekilde seç.
  // Kanıtlar: okunan nakit / KASA NAKİT / okunan kart / metinde aynen geçen tutar / banka dökümü toplamı
  function solvePay(d, amts, unsure, notes, extraN = [], extraK = [], extraPK = []) {
    if (d.genel == null) return;
    const grp = ['tekel', 'g1', 'g10', 'g20', 'gp'].reduce((a, x) => a + (d[x] || 0), 0);
    if (Math.abs(grp - d.genel) >= 0.006) return;                 // genel toplam güvenilir değil
    const near = (a, b) => a != null && b != null && Math.abs(a - b) < 0.006;
    const diger = d.diger || 0, amtSet = amts.filter(v => v > 0);
    const banks = (d._banks || []).flatMap(v => [v, ...variants(v)]);
    const bankSums = new Set(); const bs = [...new Set(d._banks || [])].slice(0, 6);
    // banka satırlarının (ve okuma hatası varyantlarının) 1–4'lü toplamları
    const bv = bs.map(v => [v, ...variants(v)]);
    const rec = (i, acc, n) => { if (n > 0) bankSums.add(r2(acc)); if (i >= bv.length || n >= 4) return; for (let j = i; j < bv.length; j++) for (const v of bv[j]) rec(j + 1, acc + v, n + 1); };
    rec(0, 0, 0);
    const NC = new Map();
    const addN = (v, w) => { if (v == null || v < 0) return; NC.set(r2(v), (NC.get(r2(v)) || 0) + w); };
    addN(d.nakit, 2); addN(d.kasa, 2); addN(0, 0.1);
    for (const v of [d.nakit, d.kasa]) if (v != null) for (const w of variants(v)) addN(w, 0.5);
    for (const v of extraN) Array.isArray(v) ? addN(v[0], v[1]) : addN(v, 1);   // [değer, kaç okumada görüldü]
    if (d._payN != null) addN(d._payN, 2);
    const KR = [d.kart, ...extraK].filter(v => v != null);
    // kart tarafındaki kanıttan türetilen nakit adayı yalnızca ADAY olur, nakit kanıtı sayılmaz (ağırlık 0)
    for (const v of [d._payK, ...extraPK]) if (v != null) for (const w of [v, ...variants(v)]) { bankSums.add(w); for (const dg of new Set([diger, 0])) addN(r2(d.genel - dg - w), 0); }
    for (const kv of KR) for (const w of [kv, ...variants(kv)]) for (const dg of new Set([diger, 0])) addN(r2(d.genel - dg - w), 0);
    let best = null, second = null; const all = [];
    // "Yemek çeki" vb. diğer ödeme çoğunlukla 0'dır; okunan küçük tutar okuma hatası olabilir → 0 da denenir
    const DG = [...new Set([diger, 0])];
    const digerOk = diger === 0 || !variants(diger).includes(0);   // "*0,00" → "10,00"/"40,00" okunmuş olabilir
    for (const dg of DG) for (const [n, wn0] of NC) {
      const wn = wn0 + (dg === diger && digerOk ? 0.3 : 0) - (dg === diger && !digerOk ? 0.5 : 0);
      const k = r2(d.genel - dg - n); if (k < 0) continue;
      let wk = 0;
      if (KR.some(v => near(v, k))) wk += 3; else if (KR.some(kv => variants(kv).some(v => near(v, k)))) wk += 1;
      if (amtSet.some(v => near(v, k))) wk += 1;
      if (k > 0 && bankSums.has(k)) wk += 3;
      if (k === 0 && d.kart == null) wk += 0.5;
      const sc = wn + wk, cand = { n, k, dg, sc, wn, wk };
      all.push(cand);
    }
    // iki tarafın da kendi kanıtı olan adaylar öncelikli (yalnız bir okumadan türetilen çift kendini doğrulamasın)
    const both = all.filter(c => c.wn > 0 && c.wk > 0), pool = (both.length ? both : all).sort((a, b) => b.sc - a.sc);
    best = pool[0] || null; second = pool[1] || null;
    if (!best) return;
    const changed = !near(best.n, d.nakit) || !near(best.k, d.kart);
    const strong = best.wn >= 2 && best.wk >= 3 && (!second || best.sc - second.sc >= 2);
    if (changed) notes.push(`Ödemeler: nakit ${best.n.toFixed(2).replace('.', ',')} + kart ${best.k.toFixed(2).replace('.', ',')} = genel toplam${strong ? ' (okunan tutarlar / banka dökümüyle doğrulandı)' : ' — fişle kontrol et'}`);
    if (!strong && changed) {
      // iki taraf da desteklenmiyorsa okunanları bırak; destekleniyorsa en iyi aday yazılır ama turuncu kalır ve birleştirmede oy vermez
      if (!(best.wn > 0 && best.wk >= 3)) { notes.pop(); notes.push(`Ödemeler tutmuyor; olası: nakit ${best.n.toFixed(2).replace('.', ',')} + kart ${best.k.toFixed(2).replace('.', ',')} — fişle kontrol et`); unsure.push('nakit', 'kart'); return; }
      d._payCalc = 1;
    }
    d.nakit = best.n; d.kart = best.k; if (best.dg !== diger) { notes.push(`Diğer ödeme: ${String(diger).replace('.', ',')} → 0,00 (okuma hatası)`); d.diger = 0; }
    for (const x of ['nakit', 'kart']) { let j; while ((j = unsure.indexOf(x)) >= 0) unsure.splice(j, 1); }
    if (!strong) unsure.push('nakit', 'kart');
  }
  // KDV BİLGİLERİ ("KDV %20.00 *305,66" ↵ "TOPLAM *1.834,00") ve BELGE TİPLERİ (-SATIŞ TOPLAMI, -NAKİT, -KREDİ, -DİĞER) bölümlü raporlar
  function sectioned(L, d, unsure, notes) {
    if (!L.some(l => l.sec === 'kdvb' || l.sec === 'belge')) return;
    const clear = (...ks) => { for (const k of ks) { let j; while ((j = unsure.indexOf(k)) >= 0) unsure.splice(j, 1); } };
    // KDV BİLGİLERİ: "KDV %20.00 *305,66" ↵ "TOPLAM *1.834,00" çiftleri. Etiket ve oran işareti çok bozuk okunuyor
    // ("MKV 2000", "AV 410.00", "KV 401.00") → oranı etiketten değil KDV/TOPLAM oranından bul.
    const A = L.filter(l => l.sec === 'kdvb' && l.a.length && !/B[İI1]LG/.test(l.s));
    const groups = {};
    for (let i = 0; i < A.length - 1;) {
      const k0 = A[i].a[A[i].a.length - 1], g0 = A[i + 1].a[A[i + 1].a.length - 1];
      let best = null;
      for (const g of [g0, ...variants(g0)]) for (const k of [k0, ...variants(k0)]) for (const r of [0, 1, 10, 20]) {
        if (g <= 0) continue;
        // yazar kasa KDV'yi satır satır yuvarlayabilir (42.163,80 → 417,52; oranla 417,46): oran tespiti için göreli tolerans
        const e = Math.abs(g * r / (100 + r) - k), t = r === 0 ? 0.001 : (g === g0 && k === k0 ? Math.max(0.03, k * 0.003) : Math.max(0.01, k * 0.002));
        if (e > t) continue;
        const sc = e + (g !== g0 ? 10 : 0) + (k !== k0 ? 10 : 0); if (!best || sc < best.sc) best = { sc, g, k, r };
      }
      if (best && !(best.r in groups)) { groups[best.r] = best; i += 2; } else i += 1;
    }
    const KEY = { 1: ['g1', 'm1', 'k1'], 10: ['g10', 'm10', 'k10'], 20: ['g20', 'm20', 'k20'] };
    for (const [rs, b] of Object.entries(groups)) {
      const r = +rs;
      if (r === 0) { d.tekel = b.g; clear('tekel'); if (b.sc >= 10) unsure.push('tekel'); continue; }
      const [gk, mk, kk] = KEY[r];
      d[gk] = b.g; d[kk] = b.k; d[mk] = r2(b.g - b.k); clear(gk, mk, kk);
      if (b.sc >= 10) unsure.push(gk, mk, kk);   // okuma hatası düzeltilerek bulundu: genel toplamla doğrulansın
    }
    // DEPARTMAN BİLGİLERİ: "TEMİZLİK %20.00" ↵ "TOPLAM *1.834,00" ↵ "MİKTARI 27,0000"; aynı oranlı departmanlar toplanır (Unlu Mamül + Temel Gıda = %1)
    { const D = L.filter(l => l.sec === 'dept' && !/B[İI1]LG/.test(l.s));
      const dp = {}, cnt = {}; let rate = null;
      for (const l of D) {
        if (/[MKHN][İI1]?K?TAR|M[İI1]KT/.test(l.s)) { rate = null; continue; }           // miktar satırı
        if (/TOPLA/.test(l.s)) { if (rate != null && l.a.length) { const v = l.a[l.a.length - 1]; dp[rate] = r2((dp[rate] || 0) + v); cnt[rate] = (cnt[rate] || 0) + 1; } rate = null; continue; }
        // departman adı + oran: son "dd.00" kalıbının son iki hanesi oran ("420.00"→20, "$01.00"→1, "X00.00"→0, "120.00"→20)
        const m = l.s.match(/(\d{2,3})\s?[.,]\s?0{2}\s*\S{0,3}\s*$/) || l.s.match(/%(\d{1,2})\s*$/);
        if (m && hasLetters(l.s)) { const r = +m[1].slice(-2); rate = RATES.includes(r) ? r : null; }
      }
      if (Object.keys(dp).length) d._dp = dp; }
    // BELGE TİPLERİ (İPTAL'e kadar): satış toplamı, KDV toplamı, nakit, kredi, diğer
    const B = L.filter(l => l.sec === 'belge');
    const pick = re => { for (const l of B) if (re.test(l.s) && l.a.length) return l.a[l.a.length - 1]; return null; };
    // etiketler bozuk okunabiliyor ("-GATIŞ TOPLARI", "-MAKİT", "HAKİ", "KAEDI"); sıra hep: KDV TOPLAMI, SATIŞ TOPLAMI, NAKİT, KREDİ, DİĞER
    let gen = pick(/[SG5]AT[IİI1][ŞS]\s?T[OU]PLA/), tk = pick(/K[DO][VU]\s?T[OU]PLA/), nk = pick(/^\W*\S{0,2}A[KX][İI1T]/), kr = pick(/\SRED[İI1J]|KART/), dg = pick(/D[İI1][ĞGC]ER/);
    { const BA = B.filter(l => !/F[İI1][ŞS]LER|B[İI1]LG|T[İI1]PLER/.test(l.s) && /\S/.test(l.s));   // belge satırları sırayla (tutarı okunamayan satır da yerini korur)
      const si = BA.findIndex(l => /[SG5]AT[IİI1][ŞS]/.test(l.s));
      if (si >= 0) { const at = j => BA[si + j] && BA[si + j].a.length ? BA[si + j].a[BA[si + j].a.length - 1] : null;
        if (gen == null) gen = at(0); if (nk == null) nk = at(1); if (kr == null) kr = at(2); if (dg == null) dg = at(3); } }
    if (gen != null) { d.genel = gen; clear('genel'); }
    if (nk != null) { d.nakit = nk; d.kasa = null; }
    if (kr != null) d.kart = kr;
    if (dg != null) d.diger = dg;
    if (tk != null) { d._mk = [tk]; d._tk = tk; }
    // genel toplamın başka kopyaları: GÜNLÜK FİŞ DÖKÜMÜ TOPLAM, KASİYER BİLGİ
    const alt = L.filter(l => (l.sec === 'gunluk' && /TOPLAM/.test(l.s) && !/KDV/.test(l.s))).map(l => l.a[l.a.length - 1]).filter(v => v != null);
    if (gen == null && alt.length) d.genel = alt[0];
    else if (gen != null && alt.length && !alt.some(v => Math.abs(v - gen) < 0.006)) { const gv = variants(gen).find(v => alt.some(a => Math.abs(a - v) < 0.006)); if (gv != null) d.genel = gv; }
    // ÖDEME BİLGİLERİ yalnızca doğrulama için: nakit toplamı ve diğer tüm ödeme türlerinin (kredi + karekod…) toplamı
    { let lab = null, n = null, k = 0, kn = 0, kl = 0;
      for (const l of L.filter(l => l.sec === 'odeme' && !/B[İI1]LG|---/.test(l.s))) {
        if (/TOPLA/.test(l.s)) { if (l.a.length && lab) { const v = l.a[l.a.length - 1]; if (lab === 'n') n = v; else { k += v; kn++; } } lab = null; }
        else if (/N?AK[İI1]T/.test(l.s)) lab = 'n'; else if (hasLetters(l.s)) { lab = 'k'; kl++; }
      }
      if (n != null) d._payN = n; if (kn && kn === kl) d._payK = r2(k); }
    // Genel toplam: belge SATIŞ TOPLAMI, GÜNLÜK FİŞ DÖKÜMÜ TOPLAM, KASİYER toplamı, KDV grupları toplamı, ödemeler toplamı — en az iki kaynağın tuttuğu değer
    let genOk = false;
    { const src = [];
      const add = (v, tag) => { if (v != null && v > 0) src.push({ v: r2(v), tag }); };
      add(gen, 'belge'); for (const v of alt) add(v, 'gunluk');
      for (const l of L.filter(l => l.sec === 'kasiyer')) if (l.a.length) add(l.a[l.a.length - 1], 'kasiyer');
      if (Object.keys(groups).length) add(Object.values(groups).reduce((a, b) => a + b.g, 0), 'grup');
      if (d._dp) add(Object.values(d._dp).reduce((a, b) => a + b, 0), 'dept');
      if (nk != null && kr != null) add(nk + kr + (dg || 0), 'odeme');
      if (d._payN != null && d._payK != null) add(d._payN + d._payK, 'odeme2');
      const C = new Map();
      for (const x of src) for (const v of [x.v, ...variants(x.v)]) { const t = C.get(v) || new Set(); t.add(x.tag); C.set(v, t); }
      // aynı kaynağın kendi varyantı ikinci oy sayılmaz; en çok farklı kaynağın tuttuğu değer
      // önce gerçekten okunmuş değerler aday (varyantlar yalnızca destek); hiçbiri ≥2 kaynakla tutmazsa varyant adaylar
      let best = null;
      for (const x of src) { const t = C.get(x.v); const n = t ? t.size : 0; if (!best || n > best.n) best = { v: x.v, n }; }
      if (!best || best.n < 2) for (const [v, t] of C) if (!best || t.size > best.n) best = { v, n: t.size };
      if (best && best.n >= 2) { if (d.genel !== best.v) notes.push(`Genel toplam: ${String(d.genel ?? '—').replace('.', ',')} → ${best.v.toFixed(2).replace('.', ',')} (${best.n} ayrı satırla doğrulandı)`); d.genel = best.v; genOk = true; d._genWeak = false; clear('genel'); }
      else unsure.push('genel'); }
    // bulunan gruplar genel toplamı TAM veriyorsa listede olmayan oranlar gerçekten 0'dır
    if (Object.keys(groups).length && d.genel != null && genOk) {
      const sum = Object.values(groups).reduce((a, b) => a + b.g, 0);
      if (Math.abs(sum - d.genel) < 0.006) { for (const r of [1, 10, 20]) if (!(r in groups)) { const [gk, mk, kk] = KEY[r]; d[gk] = d[mk] = d[kk] = 0; clear(gk, mk, kk); }
        if (!(0 in groups)) { d.tekel = 0; clear('tekel'); }
        for (const b of Object.values(groups)) if (b.sc >= 10) { if (b.r === 0) clear('tekel'); else clear(...KEY[b.r]); } }
    }
  }
  // "FİŞ CİROSU" düzenli Z raporu (DEPARTMANLARA GÖRE / KDV ORANLARINA GÖRE FİŞ SATIŞ DÖKÜMLERİ, GÜNLÜK FİŞ CİROSU,
  // FİŞ ÖDEME DÖKÜMLERİ: NAKİT ÖDEME TUTARI, KREDİ-01…, KREDİ ÖDEMELER TOPLAMI, ÖDEMELER TOPLAMI).
  // Gruplar "KDV ORANLARINA GÖRE" bölümünden alınır (aynı oranlı departmanların toplamı); okunamayan oran departmanlardan toplanır.
  // Genel toplam, ödemeler toplamı, nakit + kredi ve grupların toplamı birbirini doğrular. Uygulandıysa true döner.
  function ciroReport(L, d, unsure, notes) {
    const CIRO = /C[İI1][RP][O0Ö]S[UÜ]/, KTUT = /KDV\s?TUTAR/;
    if (L.filter(l => CIRO.test(l.s)).length < 2) return false;
    // tutar: satır sonundaki tutar ("*527 ,04" gibi boşluklu kuruş da), yoksa alttaki yalnız-tutar satırı
    const amt = l => { const a = amounts(l.s.replace(/(\d)\s+([,.])\s*(\d{2})(?!\d)/g, '$1$2$3')); return a.length ? a[a.length - 1] : null; };
    const val = i => { const v = amt(L[i]); if (v != null) return v;
      const n = L[i + 1]; if (n && !hasLetters(n.s.replace(/\*/g, ''))) return amt(n); return null; };
    // oran etiketi: "KDV ORANI %1", "KDV ORANI: %20"; "%" sık bozulur ("X0", "&1", "$10", "410", "40"), "KDV" de ("KDY", "KOY")
    const labRate = t => { const m = t.match(/K\S{1,2}\s?ORAN\S*\s*[:;.,]?\s*[^\d\s]{0,2}\s?(\d{1,3})(?![\d,.])/) || t.match(/DEPARTMAN.*?[%X$&]\s?(\d{1,2})\s*\W*$/);
      return m ? (RATES.includes(+m[1]) ? +m[1] : m[1].length > 1 && RATES.includes(+m[1].slice(1)) ? +m[1].slice(1) : null) : null; };
    // oranı ciro / KDV oranından bul (etiket sık bozuk okunur): KDV 0 → %0; değilse KDV'nin ciroya oranına en yakın oran
    const ratioRate = (g, k) => { if (g == null || k == null || g <= 0) return null; if (k === 0) return 0;
      let b = null; for (const r of RATES) { if (!r) continue; const e = g * r / (100 + r), er = Math.abs(e - k) / Math.max(1, e); if (er < 0.015 && (!b || er < b.er)) b = { r, er }; } return b ? b.r : null; };
    const blocks = [];   // {sec, lab, g, k}
    let sec = null, blk = null, genel = null, topk = null, nakit = null, krTop = null, payTot = null;
    const KR = [], OTH = [];
    for (let i = 0; i < L.length; i++) {
      const t = L[i].s;
      if (/DEPARTMANLARA/.test(t)) { sec = 'dep'; blk = null; continue; }
      if (/ORANLARINA/.test(t)) { sec = 'oran'; blk = null; continue; }
      if (/G[ÜU]NL[ÜU]K/.test(t)) { sec = 'gun'; blk = null; }
      else if (/D[EÉ]ME\s?D[ÖO]K/.test(t)) { sec = 'odeme'; continue; }
      else if (/[İI1]ND[İI1]R[İI1]M\s?D[ÖO]K|[İI1]PTAL|BEKLEMEYE|SATI[ŞS]\s?F[İI1][ŞS][İI1]\s?ADED/.test(t) && sec !== 'dep' && sec !== 'oran') { sec = 'son'; continue; }
      if (sec === 'dep' || sec === 'oran') {
        if (/K\S{1,2}\s?ORAN|DEPARTMAN/.test(t) && !CIRO.test(t) && !/TUTAR/.test(t)) {
          const lr = labRate(t);
          if (blk && blk.g == null && blk.k == null) { if (lr != null) blk.lab = lr; }   // departman başlığı + "KDV ORANI" aynı blok
          else blocks.push(blk = { sec, lab: lr, g: null, k: null });
          continue;
        }
        if (!blk) continue;
        const v = val(i); if (v == null) continue;
        if (CIRO.test(t)) { if (blk.g == null) blk.g = v; }
        else if (/TUTAR/.test(t)) { if (blk.k == null) blk.k = v; }
      } else if (sec === 'gun') {
        const v = val(i); if (v == null) continue;
        if (KTUT.test(t) || (/TUTAR/.test(t) && !CIRO.test(t))) { if (topk == null) topk = v; } else if (CIRO.test(t) && genel == null) genel = v;
      } else if (sec === 'odeme') {
        const v = val(i); if (v == null) continue;
        if (/D[EÉ]MELER\s?TOPLAM/.test(t) && !/KRED/.test(t)) payTot = v;
        else if (/KRED\S*\s?\S?D[EÉ]ME/.test(t)) krTop = v;
        else if (/N?AK[İI1]T/.test(t)) { if (nakit == null) nakit = v; }
        else if (/KRED|KART|BANKA/.test(t)) KR.push(v);
        else if (hasLetters(t)) OTH.push(v);
      }
    }
    // her bloğun oranı: ciro/KDV oranından; bulunamazsa etiketten. Departmanlar orana göre toplanır.
    const G = {}, K = {}, DG = {}, DK = {};
    for (const b of blocks) {
      if (b.g == null) continue;
      const rr = ratioRate(b.g, b.k), r = rr ?? b.lab; if (r == null) continue;
      const rate = (rr != null && b.lab != null && rr !== b.lab && b.g < 50) ? b.lab : r;   // küçük tutarda oran ayırt edilemez: etikete güven
      if (b.sec === 'dep') { DG[rate] = r2((DG[rate] || 0) + b.g); if (b.k != null) DK[rate] = r2((DK[rate] || 0) + b.k); }
      else if (G[rate] == null) { G[rate] = b.g; if (b.k != null) K[rate] = b.k; }
    }
    if (!Object.keys(G).length && !Object.keys(DG).length) return false;
    const near = (a, b) => a != null && b != null && Math.abs(a - b) < 0.006;
    const sumV = o => r2(Object.values(o).reduce((a, b) => a + b, 0));
    const krSum = KR.length ? r2(KR.reduce((a, b) => a + b, 0)) : null;
    // Genel toplam: en çok kaynağın tuttuğu değer (okuma hatası varyantları destek oyu)
    const src = [['gun', genel], ['odeme', payTot], ['oran', Object.keys(G).length ? sumV(G) : null], ['dep', Object.keys(DG).length ? sumV(DG) : null],
      ['nk', nakit != null && (krTop ?? krSum) != null ? r2(nakit + (krTop ?? krSum) + OTH.reduce((a, b) => a + b, 0)) : null]].filter(x => x[1] != null && x[1] > 0);
    const C = new Map(); for (const [tag, v] of src) for (const w of [v, ...variants(v)]) { const s = C.get(w) || new Set(); s.add(tag); C.set(w, s); }
    let gBest = null; for (const [tag, v] of src) { const n = C.get(v).size; if (!gBest || n > gBest.n) gBest = { v, n }; }
    const gen = gBest ? gBest.v : null;
    // Gruplar: her oran için KDV ORANLARINA GÖRE değeri ya da departman toplamı; genel toplamı tutturan birleşim
    const rates = [...new Set([...Object.keys(G), ...Object.keys(DG)].map(Number))].sort((a, b) => a - b);
    const opts = rates.map(r => { const o = []; if (G[r] != null) o.push({ g: G[r], k: K[r], src: 'oran' }); if (DG[r] != null && !near(DG[r], G[r])) o.push({ g: DG[r], k: DK[r], src: 'dep' }); return o; });
    let pick = opts.map(o => o[0]);
    if (gen != null && !near(pick.reduce((a, p) => a + p.g, 0), gen)) {
      const rec = (i, acc, cur) => { if (i === opts.length) return near(acc, gen) ? [...cur] : null;
        for (const p of opts[i]) { const x = rec(i + 1, acc + p.g, [...cur, p]); if (x) return x; } return null; };
      const hit = rec(0, 0, []); if (hit) pick = hit;
    }
    const grp = {}; rates.forEach((r, i) => grp[r] = pick[i]);
    const KEY = { 1: ['g1', 'm1', 'k1'], 10: ['g10', 'm10', 'k10'], 20: ['g20', 'm20', 'k20'] };
    const all = ['tekel', 'g1', 'm1', 'k1', 'g10', 'm10', 'k10', 'g20', 'm20', 'k20', 'gp', 'mp', 'kp', 'genel', 'nakit', 'kart'];
    for (const k of all) d[k] = null;
    { const keep = unsure.filter(k => k === 'tarih' || k === 'z_no'); unsure.length = 0; unsure.push(...keep); notes.length = 0; }
    if (gen != null && genel != null && !near(gen, genel)) notes.push(`Genel toplam: ${String(genel).replace('.', ',')} → ${gen.toFixed(2).replace('.', ',')} (diğer satırlarla doğrulandı)`);
    for (const r of rates) {
      const p = grp[r];
      if (r === 0) { d.tekel = p.g; notes.push(`%0 satış Tekel sütununa yazıldı (${p.g.toFixed(2).replace('.', ',')}).`); continue; }
      if (!KEY[r]) { notes.push(`%${r} grubu bulundu (${p.g.toFixed(2).replace('.', ',')}) — şablonda bu oran yok`); unsure.push('genel'); continue; }
      const [gk, mk, kk] = KEY[r];
      d[gk] = p.g;
      const e = p.g * r / (100 + r);
      let kv = p.k;
      if (kv == null || Math.abs(kv - e) > Math.max(0.05, e * 0.003)) {   // KDV okunamadı / orana uymuyor: diğer kaynağı ya da varyantı dene
        const alt = [K[r], DK[r], ...(kv != null ? variants(kv) : [])].find(v => v != null && Math.abs(v - e) <= Math.max(0.05, e * 0.003));
        if (alt != null) kv = alt; else { kv = r2(e); unsure.push(kk, mk); notes.push(`%${r} KDV okunamadı; orandan hesaplandı, fişle kontrol et.`); }
      }
      d[kk] = kv; d[mk] = r2(p.g - kv);
      if (p.src === 'dep') notes.push(`%${r} toplamı departmanlardan toplandı.`);
    }
    for (const r of [1, 10, 20]) if (!rates.includes(r)) { const [gk, mk, kk] = KEY[r]; d[gk] = d[mk] = d[kk] = 0; }
    if (!rates.includes(0)) d.tekel = 0;
    d.genel = gen;
    // Ödemeler: nakit + kredi toplamı (+ diğer) = ödemeler toplamı = genel toplam
    let kart = krTop ?? krSum;
    if (kart != null && krSum != null && krTop != null && !near(krTop, krSum) && gen != null && nakit != null && near(nakit + krSum, gen)) kart = krSum;
    const oth = r2(OTH.reduce((a, b) => a + b, 0));
    if (gen != null && nakit != null && kart != null && !near(nakit + kart + oth, gen)) {
      const nk = [nakit, ...variants(nakit)].flatMap(n => [kart, ...variants(kart)].map(k => [n, k])).find(([n, k]) => near(n + k + oth, gen));
      if (nk) { notes.push('Ödeme tutarı okuma hatası genel toplamla düzeltildi.'); [nakit, kart] = nk; }
    }
    if (gen != null && nakit == null && kart != null) { nakit = r2(gen - kart - oth); unsure.push('nakit'); notes.push('Nakit okunamadı; genel toplam − kredi olarak hesaplandı.'); }
    if (gen != null && kart == null && nakit != null) { kart = r2(gen - nakit - oth); unsure.push('kart'); notes.push('Kredi toplamı okunamadı; genel toplam − nakit olarak hesaplandı.'); }
    d.nakit = nakit; d.kart = kart; d.diger = oth > 0 ? oth : null;
    if (oth > 0) notes.push(`Nakit ve kredi dışında ödeme var (${oth.toFixed(2).replace('.', ',')}) — Luca şablonunda sütunu yok, kontrol et.`);
    d.kasa = null; d._banks = KR.length ? KR : undefined; d._payCalc = undefined; d._genWeak = false; d.top_kdv = topk;
    // Uygulamadaki çapraz kontroller: departman toplamları, oran dökümü, fişin KDV toplamı
    if (Object.keys(DG).length) d._dp = Object.fromEntries(Object.entries(DG).map(([r, v]) => [r, v])); else delete d._dp;
    if (topk != null) { d._tk = topk; d._topk = topk; } else { delete d._tk; delete d._topk; }
    delete d._calc; delete d._mk; delete d._kTk; delete d._k20mk;
    // KDV'ler fişteki GÜNLÜK FİŞ KDV TUTARI'nı vermiyorsa: departman KDV'leri, okuma hatası varyantları ya da toplamdan kalan ile düzelt
    const ks = [[1, 'k1', 'm1', 'g1'], [10, 'k10', 'm10', 'g10'], [20, 'k20', 'm20', 'g20']].filter(x => d[x[3]] > 0);
    const kSum = () => ['k1', 'k10', 'k20'].reduce((a, k) => a + (d[k] || 0), 0);
    if (topk != null && !near(kSum(), topk) && ks.length) {
      const fits = (r, g, k) => k != null && Math.abs(k - g * r / (100 + r)) <= Math.max(0.05, g * r / (100 + r) * 0.003);
      const C = ks.map(([r, k, m, g]) => { const o = [d[k]]; for (const v of [K[r], DK[r], ...variants(d[k])]) if (v != null && !o.some(x => near(x, v)) && fits(r, d[g], v)) o.push(v); return o; });
      let best = null;
      const rec = (i, acc, ch, cur) => { if (i === C.length) { if (near(acc, topk) && (!best || ch < best.ch)) best = { ch, cur: [...cur] }; return; }
        C[i].forEach((v, j) => { cur.push(v); rec(i + 1, acc + v, ch + (j ? 1 : 0), cur); cur.pop(); }); };
      rec(0, 0, 0, []);
      if (!best) for (let i = 0; i < ks.length; i++) {   // tek KDV: fişin KDV toplamı − diğerleri, oranına uyuyorsa
        const [r, k, m, g] = ks[i], v = r2(topk - kSum() + d[k]);
        if (fits(r, d[g], v)) { best = { ch: 1, cur: ks.map(([, kk], j) => j === i ? v : d[kk]) }; break; }
      }
      if (best) ks.forEach(([r, k, m, g], i) => { if (!near(d[k], best.cur[i])) { notes.push(`%${r} KDV: ${String(d[k]).replace('.', ',')} → ${best.cur[i].toFixed(2).replace('.', ',')} (fişin KDV toplamıyla doğrulandı)`); d[k] = best.cur[i]; d[m] = r2(d[g] - d[k]); } });
    }
    // oran dökümünde okunan değerler (KDV fişin KDV toplamıyla düzeltildiyse düzeltilmiş hâli)
    const vd = {}; for (const r of [1, 10, 20]) if (G[r] != null && K[r] != null) { const kk = 'k' + r; vd[r] = [G[r], near(d['g' + r], G[r]) && notes.some(n => n.startsWith(`%${r} KDV:`)) ? d[kk] : K[r]]; }
    if (Object.keys(vd).length) d._vd = vd; else delete d._vd;
    // Şüpheli alanlar
    const gsum = ['tekel', 'g1', 'g10', 'g20'].reduce((a, k) => a + (d[k] || 0), 0);
    if (gen == null) unsure.push('genel');
    else if (!near(gsum, gen)) unsure.push('tekel', 'g1', 'm1', 'k1', 'g10', 'm10', 'k10', 'g20', 'm20', 'k20');
    if (gen == null || !near((d.nakit || 0) + (d.kart || 0) + oth, gen)) unsure.push('nakit', 'kart');
    if (gBest && gBest.n < 2) unsure.push('genel');
    if (topk != null && !near(['k1', 'k10', 'k20'].reduce((a, k) => a + (d[k] || 0), 0), topk)) {
      unsure.push('k1', 'k10', 'k20');
      notes.push(`KDV'lerin toplamı fişteki GÜNLÜK FİŞ KDV TUTARI'nı (${topk.toFixed(2).replace('.', ',')}) tutmuyor; KDV'leri kontrol et.`);
    }
    if (!d.tarih) unsure.push('tarih');
    if (!d.z_no) unsure.push('z_no');
    return true;
  }
  // Bölümlü raporda belge KDV TOPLAMI, grupların KDV'leri toplamını vermiyorsa bir grup eksik/yanlış okunmuştur
  function checkTk(d, unsure, notes) {
    if (d._tk == null) return;
    const sk = ['k1', 'k10', 'k20', 'kp'].reduce((a, k) => a + (d[k] || 0), 0);
    if ([d._tk, ...variants(d._tk)].some(v => Math.abs(v - sk) < 0.006)) return;
    unsure.push('tekel', 'g1', 'm1', 'k1', 'g10', 'm10', 'k10', 'g20', 'm20', 'k20');
    notes.push(`KDV'lerin toplamı (${sk.toFixed(2).replace('.', ',')}) fişteki KDV toplamını (${d._tk.toFixed(2).replace('.', ',')}) tutmuyor; KDV gruplarını kontrol et.`);
  }
  // Bir okumanın iç tutarlılığı: birden fazla okuma arasında seçim için
  function consistency(res) {
    const d = res.d; let s = 0;
    const grp = ['tekel', 'g1', 'g10', 'g20', 'gp'].reduce((a, x) => a + (d[x] || 0), 0);
    const pay = ['nakit', 'kart', 'diger'].reduce((a, x) => a + (d[x] || 0), 0);
    if (d.genel != null && grp > 0 && Math.abs(grp - d.genel) < 0.006) s += 3;
    if (d.genel != null && pay > 0 && Math.abs(pay - d.genel) < 0.006) s += 3;
    s -= res.unsure.length * 0.5; if (d.tarih) s += 0.5; if (d.z_no) s += 0.5;
    return s;
  }
  // Birden fazla okumayı alan alan birleştir: oylama + "0 → 8/9" alternatifleri + toplam tutarlılığı
  function merge(list) {
    if (list.length === 1) return list[0];
    const near = (a, b) => a != null && b != null && Math.abs(a - b) < 0.006;
    // kuruştaki tek bir 6/8/9'u 0 yap (noktalı sıfır) — her seferinde tek hane
    const zalt = v => { const [i, dd] = v.toFixed(2).split('.'), out = [];
      for (let x = 0; x < 2; x++) if (/[689]/.test(dd[x])) out.push(+(i + '.' + dd.slice(0, x) + '0' + dd.slice(x + 1))); return out; };
    const cands = k => {
      const m = new Map(), za = new Map();
      for (const r of list) { const v = r.d[k]; if (v == null || typeof v !== 'number' || (r.d._calc || []).includes(k) || (r.d._payCalc && (k === 'nakit' || k === 'kart'))) continue;   // orandan hesaplanan KDV oy vermez
        const base = r.unsure && r.unsure.includes(k) ? 0.6 : 1;   // kendi okumasında şüpheli olan değer daha az oy alır
        m.set(v.toFixed(2), (m.get(v.toFixed(2)) || 0) + base);
        for (const z of zalt(v)) za.set(z.toFixed(2), (za.get(z.toFixed(2)) || 0) + 0.4 * base); }
      for (const [z, w] of za) m.set(z, (m.get(z) || 0) + Math.min(0.4, w));   // alternatifler yığılıp gerçek okumayı geçmesin
      return [...m.entries()].map(([v, w]) => ({ v: +v, w })).sort((a, b) => b.w - a.w);
    };
    const vote = k => { const m = new Map(); for (const r of list) { const v = r.d[k]; if (v) m.set(v, (m.get(v) || 0) + 1); }
      const e = [...m.entries()].sort((a, b) => b[1] - a[1]); return { v: e.length ? e[0][0] : null, uni: e.length === 1 }; };
    const d = {}, unsure = [], notes = [...new Set(list.flatMap(r => r.notes))];
    const t = vote('tarih'), z = vote('z_no'); d.tarih = t.v; d.z_no = z.v;
    // Tarih: kendi okumasında şüpheli (turuncu) olan farklı tarih, kesin okunan çoğunluğu bozmasın
    { const w = new Map(); for (const r of list) { const v = r.d.tarih; if (v) w.set(v, (w.get(v) || 0) + (r.unsure.includes('tarih') ? 0.3 : 1)); }
      const e = [...w.entries()].sort((a, b) => b[1] - a[1]);
      if (e.length) { d.tarih = e[0][0]; const rest = e.slice(1).reduce((a, x) => a + x[1], 0); t.uni = e[0][1] >= 1 && rest < 0.5 && e[0][1] >= 2 * rest; } }
    // Noktalı sıfır: "0760" bazen "6760" okunur, tersi pek olmaz → sadece 0↔6/8/9 farkı varsa sıfırlı olanı seç
    const zs = [...new Set(list.map(r => r.d.z_no).filter(Boolean))];
    const zeroOf = (a, b) => a.length === b.length && [...a].every((c, i) => c === b[i] || (c === '0' && /[689]/.test(b[i])));
    if (zs.length > 1) { const zero = zs.find(a => zs.every(b => zeroOf(a, b))); if (zero) { d.z_no = zero; z.uni = true; } }
    if (zs.length > 1) { const suf = zs.find(a => a.length <= 4 && zs.every(b => b === a || b.endsWith(a) || zeroOf(a, b.slice(-a.length)))); if (suf) { d.z_no = suf; z.uni = true; } }
    if (!t.v || !t.uni) unsure.push('tarih'); if (!z.v || !z.uni) unsure.push('z_no');
    if (list.length >= 3 && list.filter(r => r.d.z_no).length === 1) unsure.push('z_no');   // tek okumada çıkan Z (kenarı kesik olabilir: 1374 → 374)
    if (d.z_no && d.z_no.length >= 4 && /^[689]/.test(d.z_no)) unsure.push('z_no');   // noktalı sıfır şüphesi
    if (d.z_no && d.z_no.length > 4) unsure.push('z_no');                                // fazladan rakam şüphesi ("20002")
    // KDV grupları: (toplam, KDV) çiftini oy + oran uyumuyla seç
    for (const [g, m, k, r] of [['g1', 'm1', 'k1', 1], ['g10', 'm10', 'k10', 10], ['g20', 'm20', 'k20', 20], ['gp', 'mp', 'kp', 20]]) {
      const G = cands(g), K = cands(k); if (!G.length) continue;
      let best = null;
      for (const a of G) for (const b of (K.length ? K : [{ v: null, w: 0 }])) {
        const ok = b.v != null && (a.v === 0 ? b.v === 0 : b.v === 0 ? a.v * r / (100 + r) < 0.005 : Math.abs(a.v * r / (100 + r) - b.v) <= Math.max(0.03, b.v * 0.004));
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
    { const vd = {}; for (const r of list) for (const [rt, p] of Object.entries(r.d._vd || {})) { const k = rt + '|' + p.join('|'); (vd[rt] = vd[rt] || {})[k] = ((vd[rt] || {})[k] || 0) + 1; }
      for (const rt in vd) { const best = Object.entries(vd[rt]).sort((a, b) => b[1] - a[1])[0][0].split('|'); (d._vd = d._vd || {})[rt] = [+best[1], +best[2]]; } }
    { const c = cands('_tk').filter(x => x.w >= 0.6); if (c.length) d._tk = c[0].v; }
    { const dp = {}; for (const r of list) for (const [rt, v] of Object.entries(r.d._dp || {})) { (dp[rt] = dp[rt] || new Map()).set(v, (dp[rt].get(v) || 0) + 1); }
      for (const rt in dp) { const best = [...dp[rt].entries()].sort((a, b) => b[1] - a[1])[0][0]; (d._dp = d._dp || {})[rt] = best; if (!amts.includes(best)) amts.push(best); } }
    complete(d, amts, unsure, notes);
    solveGroups(d, amts, unsure, notes);
    repair(d, notes, unsure, amts);
    d._mk = [...new Set(list.flatMap(r => r.d._mk || []))]; if (!d._mk.length) delete d._mk; else maliKdv(d, null, unsure, notes);
    { const tk = list.map(r => r.d.top_kdv).filter(v => v > 0); if (tk.length) { d.top_kdv = tk.sort((a, b) => tk.filter(v => v === b).length - tk.filter(v => v === a).length)[0]; fixTopKdv(d, unsure, notes); } }
    const grpN = ['tekel', 'g1', 'g10', 'g20', 'gp'].reduce((a, x) => a + (d[x] || 0), 0);
    if (!near(d.genel, grpN)) { for (const [g, m, k] of [['g1', 'm1', 'k1'], ['g10', 'm10', 'k10'], ['g20', 'm20', 'k20']]) if (d[g]) unsure.push(g, m, k); for (const x of ['tekel', 'gp']) if (d[x]) unsure.push(x); if (!d.tekel) unsure.push('tekel'); }
    else { for (const x of ['tekel', 'g1', 'g10', 'g20', 'gp']) { let i; while ((i = unsure.indexOf(x)) >= 0) unsure.splice(i, 1); } }
    // Hiçbir okumada gerçekten okunmamış (hepsinde orandan hesaplanmış) KDV turuncu kalır
    for (const k of ['k1', 'k10', 'k20']) {
      if (d[k] == null) continue;
      const read = list.some(r => r.d[k] != null && near(r.d[k], d[k]) && !(r.d._calc || []).includes(k)) || (k === 'k20' && d._k20mk) || (d._kTk || []).includes(k);
      if (!read) { unsure.push(k, 'm' + k.slice(1)); if (!notes.some(n => n.startsWith(`%${k.slice(1)} KDV okunamadı`))) notes.push(`%${k.slice(1)} KDV okunamadı; orandan hesaplandı, fişle kontrol et.`); }
      else for (let i = notes.length - 1; i >= 0; i--) if (notes[i].startsWith(`%${k.slice(1)} KDV okunamadı`)) notes.splice(i, 1);
    }
    { const seen = new Set(); for (let i = notes.length - 1; i >= 0; i--) { const key = notes[i].split(':')[0]; if (seen.has(key)) notes.splice(i, 1); else seen.add(key); } }
    // yanıltıcı notları temizle: "%0 satış" (Tekel alanında zaten var) ve başka bir gruba ait çıkan "%8/%18 grubu bulundu"
    for (let i = notes.length - 1; i >= 0; i--) {
      if (/^%0 satış/.test(notes[i])) notes.splice(i, 1);
      else if (/^%(8|18) grubu bulundu \(([\d,]+)/.test(notes[i])) { const v = +RegExp.$2.replace(',', '.'); if (['g1', 'g10', 'g20'].some(g => near(d[g], v))) notes.splice(i, 1); }
    }
    // Ödemeler: adaylar arasından toplamı genel toplamı veren birleşimi seç
    if (d.genel != null) {
      const NC = cands('nakit'), KC = cands('kart'), DC = cands('diger');
      for (const c of cands('kasa')) { const e = NC.find(x => near(x.v, c.v)); if (e) e.w += 0.5 * c.w; else NC.push({ v: c.v, w: 0.5 * c.w }); }
      let bp = null;
      for (const n of NC.length ? NC : [{ v: null, w: 0 }]) for (const k of KC.length ? KC : [{ v: null, w: 0 }]) for (const o of [{ v: null, w: 0 }, ...DC]) {
        if (n.v == null && k.v == null) continue;
        if (!near((n.v || 0) + (k.v || 0) + (o.v || 0), d.genel)) continue;
        const sc = n.w + k.w + o.w; if (!bp || sc > bp.sc) bp = { sc, n: n.v, k: k.v, o: o.v };
      }
      if (bp) { d.nakit = bp.n; d.kart = bp.k; if (bp.o != null) d.diger = bp.o;
        for (const x of ['nakit', 'kart', 'diger']) { let i; while ((i = unsure.indexOf(x)) >= 0) unsure.splice(i, 1); } }
    }
    for (let i = notes.length - 1; i >= 0; i--) if (/^Ödemeler/.test(notes[i])) notes.splice(i, 1);
    { d._banks = [...new Set(list.flatMap(r => r.d._banks || []))]; if (!d._banks.length) delete d._banks;
      const kasaC = cands('kasa'); if (kasaC.length) d.kasa = kasaC[0].v;
      for (const k of ['_payN', '_payK']) { const c = cands(k); if (c.length) d[k] = c[0].v; }
      const R0 = k => cands(k).filter(c => c.w >= 0.6).map(c => [c.v, c.w]);   // yalnızca gerçekten okunan değerler (kuruş alternatifleri değil)
      solvePay(d, amts, unsure, notes, [...R0('nakit'), ...R0('kasa'), ...R0('_payN')], R0('kart').map(x => x[0]), R0('_payK').map(x => x[0])); delete d.kasa; }
    // Tek bir ödeme okunamadıysa: genel toplamdan hesapla (turuncu işaretli)
    if (d.genel != null && near(d.genel, grpN)) {
      if (d.kart == null && d.nakit != null) { d.kart = r2(d.genel - d.nakit - (d.diger || 0)); unsure.push('kart'); notes.push('Kart tutarı okunamadı; genel toplam − nakit olarak hesaplandı.'); }
      else if (d.nakit == null && d.kart != null) { d.nakit = r2(d.genel - d.kart - (d.diger || 0)); unsure.push('nakit'); notes.push('Nakit tutarı okunamadı; genel toplam − kart olarak hesaplandı.'); }
    }
    const pay2 = ['nakit', 'kart', 'diger'].reduce((a, x) => a + (d[x] || 0), 0);
    if (!near(pay2, d.genel)) unsure.push('nakit', 'kart');
    if (!near(d.genel, grpN) && !near(d.genel, pay2)) unsure.push('genel');
    { const c = cands('_tk').filter(x => x.w >= 0.6); if (c.length) { d._tk = c[0].v; for (let i = notes.length - 1; i >= 0; i--) if (/^KDV'lerin toplamı/.test(notes[i])) notes.splice(i, 1); checkTk(d, unsure, notes); } }
    { const strong = list.some(r => !r.d._genWeak && r.d.genel != null && near(r.d.genel, d.genel) && !r.unsure.includes('genel'));
      const payOk = near(pay2, d.genel) && !unsure.includes('nakit') && !unsure.includes('kart') && !d._payCalc;
      if (!strong && d.genel != null && !payOk) unsure.push('genel', 'tekel', 'g1', 'm1', 'k1', 'g10', 'm10', 'k10', 'g20', 'm20', 'k20'); }
    for (const k of ['genel', 'nakit', 'kart']) if (d[k] == null) unsure.push(k);
    return { d, unsure: [...new Set(unsure)], notes, found: Object.keys(d).filter(k => d[k] != null).length };
  }
  root.ZParse = { version: 44, parseZ, normLine, amounts, consistency, merge };
})(typeof window !== 'undefined' ? window : globalThis);
