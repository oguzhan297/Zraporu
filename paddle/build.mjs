import { build } from "esbuild";
import { readFileSync } from "node:fs";
const ortVer = JSON.parse(readFileSync(new URL("./node_modules/onnxruntime-web/package.json", import.meta.url))).version;
const paddleVer = JSON.parse(readFileSync(new URL("./node_modules/@paddleocr/paddleocr-js/package.json", import.meta.url))).version;
await build({
  entryPoints: ["entry.js"], bundle: true, format: "iife", minify: true, legalComments: "none",
  alias: { "onnxruntime-web": "onnxruntime-web/wasm" },     // WebGPU'suz, sadece WASM çalışma zamanı
  external: ["fs", "path", "crypto"],                         // OpenCV.js'in Node yolları; tarayıcıda kullanılmaz
  define: { __ORT_VER__: JSON.stringify(ortVer) },
  banner: { js: `/* @paddleocr/paddleocr-js ${paddleVer} + onnxruntime-web ${ortVer} (Apache-2.0 / MIT) — paddle/ klasöründen derlendi */` },
  outfile: "../vendor/paddle.js",
});
console.log("paddle.js hazır — onnxruntime-web", ortVer);
