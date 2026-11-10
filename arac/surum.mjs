// Sürüm yükseltme: tüm dosyalardaki sürüm numarasını tek seferde değiştirir.
// Telefonlar dosyaları önbellekten açtığı için her yayında sürüm artmalı; bir yer unutulursa eski dosya kalır.
//
//   node arac/surum.mjs          → mevcut sürümleri gösterir, tutarsızlık varsa söyler
//   node arac/surum.mjs 55       → hepsini 55 yapar
//   node arac/surum.mjs +        → bir artırır
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const oku = f => fs.readFileSync(path.join(KOK, f), 'utf8');
const yaz = (f, s) => fs.writeFileSync(path.join(KOK, f), s);

// [dosya, desen (1. grup = sürüm), açıklama]
const YERLER = [
  ['index.html', /\.(?:js|css|svg)\?v=(\d+)/g, 'betik, stil ve ikon bağlantıları'],
  ['js/temel.js', /const APP_VER=(\d+);/g, 'uygulama sürümü'],
  ['js/parser.js', /version: (\d+),/g, 'ayrıştırıcı sürümü (açılışta APP_VER ile karşılaştırılır)'],
  ['sw.js', /zrapor-v(\d+)/g, 'önbellek adı'],
  ['sw.js', /\?v=(\d+)/g, 'önbellek listesi'],
  ['js/paddle-worker.js', /goruntu\.js\?v=(\d+)/g, 'işçinin görüntü modülü'],
];

const bul = () => YERLER.map(([f, re, ne]) => ({ f, ne, v: [...oku(f).matchAll(re)].map(m => +m[1]) }));
const simdi = bul(), hepsi = simdi.flatMap(x => x.v), farkli = [...new Set(hepsi)];
const hedef = process.argv[2];

if (!hedef) {
  for (const x of simdi) console.log(`${x.f.padEnd(22)} ${String([...new Set(x.v)].join(', ') || '— YOK').padEnd(8)} ${x.v.length} yer · ${x.ne}`);
  console.log(farkli.length === 1 ? `\nTutarlı: sürüm ${farkli[0]}` : `\n⚠ TUTARSIZ: ${farkli.join(', ')} — "node arac/surum.mjs <sürüm>" ile düzelt`);
  process.exit(farkli.length === 1 ? 0 : 1);
}

const yeni = hedef === '+' ? Math.max(...hepsi) + 1 : +hedef;
if (!Number.isInteger(yeni) || yeni < 1) { console.error('Geçersiz sürüm:', hedef); process.exit(2); }
for (const [f, re] of YERLER) {
  const s = oku(f), n = [...s.matchAll(re)].length;
  if (!n) { console.error(`${f}: sürüm bulunamadı (${re})`); process.exit(2); }
  yaz(f, s.replace(re, m => m.replace(/\d+/, String(yeni))));
}
const son = [...new Set(bul().flatMap(x => x.v))];
console.log(son.length === 1 && son[0] === yeni ? `Sürüm ${yeni} yapıldı (${hepsi.length} yer).` : `⚠ Beklenmeyen durum: ${son.join(', ')}`);
