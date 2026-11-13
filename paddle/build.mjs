import { build } from "esbuild";
import { readFileSync } from "node:fs";
const ortVer = JSON.parse(readFileSync(new URL("./node_modules/onnxruntime-web/package.json", import.meta.url))).version;
const paddleVer = JSON.parse(readFileSync(new URL("./node_modules/@paddleocr/paddleocr-js/package.json", import.meta.url))).version;
const ortak = {
  entryPoints: ["entry.js"], bundle: true, format: "iife", minify: true, legalComments: "none",
  external: ["fs", "path", "crypto"],                         // OpenCV.js'in Node yolları; tarayıcıda kullanılmaz
  define: { __ORT_VER__: JSON.stringify(ortVer) },
  banner: { js: `/* @paddleocr/paddleocr-js ${paddleVer} + onnxruntime-web ${ortVer} (Apache-2.0 / MIT) — paddle/ klasöründen derlendi */` },
};
// paddle.js: yalnız WASM (işlemci) — her tarayıcıda çalışır; çalışma zamanı ort-wasm-simd-threaded.wasm
await build({ ...ortak, alias: { "onnxruntime-web": "onnxruntime-web/wasm" }, outfile: "../vendor/paddle.js" });
// paddle-gpu.js: WebGPU (ekran kartı) + WASM yedeği — ekran kartı olan tarayıcıda çok daha hızlı; çalışma zamanı ort-wasm-simd-threaded.jsep.wasm
await build({ ...ortak, alias: { "onnxruntime-web": "onnxruntime-web/webgpu" }, outfile: "../vendor/paddle-gpu.js" });
console.log("paddle.js hazır — onnxruntime-web", ortVer);
