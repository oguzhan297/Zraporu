// PaddleOCR işçisi (WebGPU, ekran kartında; olmazsa aynı paket içinde WASM'a düşer). Gövde paddle-isci.js'de ortak.
// vendor/paddle-gpu.js değişince ?p= elle; paddle-isci.js ?v= değerini arac/surum.mjs günceller.
import '../vendor/paddle-gpu.js?p=1';
import './paddle-isci.js?v=86';
