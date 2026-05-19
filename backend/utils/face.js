const tf = require('@tensorflow/tfjs');
require('@tensorflow/tfjs-backend-wasm');
const faceapi = require('@vladmandic/face-api/dist/face-api.node-wasm.js');
const canvas = require('canvas');
const path = require('path');
const fs = require('fs');

const { Canvas, Image, ImageData } = canvas;
faceapi.env.monkeyPatch({ Canvas, Image, ImageData });

let modelsLoaded = false;
let tfBackendReady = false;

async function ensureWasmBackend() {
  if (tfBackendReady) return;
  await tf.setBackend('wasm');
  await tf.ready();
  tfBackendReady = true;
}

async function loadModels() {
  if (modelsLoaded) return;
  await ensureWasmBackend();
  // Đường dẫn tuyệt đối đến thư mục chứa model (đã có trong controllers/face_models)
  const modelPath = path.join(__dirname, '../models');
  console.log(`Loading models from: ${modelPath}`);
  await faceapi.nets.ssdMobilenetv1.loadFromDisk(modelPath);
  await faceapi.nets.faceLandmark68Net.loadFromDisk(modelPath);
  await faceapi.nets.faceRecognitionNet.loadFromDisk(modelPath);
  modelsLoaded = true;
  console.log('✅ Face models loaded');
}

async function getFaceEmbedding(imageBuffer) {
  await loadModels();
  let img = await canvas.loadImage(imageBuffer);
  console.log(`Ảnh gốc: ${img.width}x${img.height}`);

  // Resize ảnh nếu quá nhỏ
  const minSize = 300;
  let processedImg = img;
  if (img.width < minSize || img.height < minSize) {
    const scale = minSize / Math.min(img.width, img.height);
    const newWidth = Math.floor(img.width * scale);
    const newHeight = Math.floor(img.height * scale);
    const resizedCanvas = canvas.createCanvas(newWidth, newHeight);
    const ctx = resizedCanvas.getContext('2d');
    ctx.drawImage(img, 0, 0, newWidth, newHeight);
    processedImg = resizedCanvas;
    console.log(`Resize thành: ${newWidth}x${newHeight}`);
  }

  // Thử detect với nhiều ngưỡng confidence
  let detection = null;
  for (const minConfidence of [0.2, 0.1, 0.05]) {
    detection = await faceapi
      .detectSingleFace(processedImg, new faceapi.SsdMobilenetv1Options({ minConfidence }))
      .withFaceLandmarks()
      .withFaceDescriptor();
    if (detection) {
      console.log(`✅ Detect thành công với minConfidence = ${minConfidence}`);
      break;
    }
  }

  // Nếu vẫn không thấy, thử detect tất cả faces
  if (!detection) {
    const detections = await faceapi.detectAllFaces(processedImg, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.1 }))
      .withFaceLandmarks()
      .withFaceDescriptors();
    if (detections && detections.length > 0) {
      detection = detections[0];
      console.log(`✅ Phát hiện ${detections.length} khuôn mặt, lấy cái đầu tiên`);
    }
  }

  // Debug: lưu ảnh lỗi ra file để kiểm tra
  if (!detection) {
    console.log(`❌ Không thấy mặt. Kích thước: ${processedImg.width}x${processedImg.height}`);
    const debugDir = path.join(__dirname, '../debug');
    if (!fs.existsSync(debugDir)) fs.mkdirSync(debugDir, { recursive: true });
    const outPath = path.join(debugDir, `face_debug_${Date.now()}.jpg`);
    const outCanvas = canvas.createCanvas(processedImg.width, processedImg.height);
    const ctx = outCanvas.getContext('2d');
    ctx.drawImage(processedImg, 0, 0);
    const outStream = fs.createWriteStream(outPath);
    outCanvas.createJPEGStream().pipe(outStream);
    console.log(`📸 Đã lưu ảnh lỗi vào ${outPath}`);
    return null;
  }

  return detection.descriptor;
}

function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

// EXPORT ĐÚNG CÁCH - CHỈ MỘT DÒNG DUY NHẤT
module.exports = { getFaceEmbedding, cosineSimilarity };