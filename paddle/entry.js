// PaddleOCR.js'i (PP-OCRv6) tek dosyalık tarayıcı betiğine paketler → ../paddle.js
// Derlemek için bu klasörde: npm install && npm run build
// Hem sayfada (<script>) hem de modül işçide (import) çalışır. İşçide document olmadığından görüntü cv.Mat olarak verilir.
import { PaddleOCR } from "@paddleocr/paddleocr-js";
import * as ort from "onnxruntime-web";   // alias ile onnxruntime-web/wasm — PaddleOCR.js ile aynı örnek
import cv from "@techstark/opencv-js";     // PaddleOCR.js ile aynı OpenCV örneği (cv.matFromImageData için)
globalThis.PaddleOCRLib = { PaddleOCR, ort, cv, ortVersion: __ORT_VER__ };
