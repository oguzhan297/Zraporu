// PaddleOCR.js'i (PP-OCRv6) tek dosyalık tarayıcı betiğine paketler → ../paddle.js
// Derlemek için bu klasörde: npm install && npm run build
import { PaddleOCR } from "@paddleocr/paddleocr-js";
import * as ort from "onnxruntime-web";   // alias ile onnxruntime-web/wasm — PaddleOCR.js ile aynı örnek
globalThis.PaddleOCRLib = { PaddleOCR, ort, ortVersion: __ORT_VER__ };
