const path = require('path');
const canvas = require('canvas');
const faceapi = require('@vladmandic/face-api');
const tf = require('@tensorflow/tfjs-node'); // dùng backend node để nhanh hơn

const { Canvas, Image, ImageData } = canvas;
faceapi.env.monkeyPatch({ Canvas, Image, ImageData });

let modelsLoaded = false;

async function loadModels() {
  if (modelsLoaded) return;
  const modelPath = path.join(__dirname, '../models');
  await faceapi.nets.ssdMobilenetv1.loadFromDisk(modelPath);
  await faceapi.nets.faceLandmark68Net.loadFromDisk(modelPath);
  await faceapi.nets.faceRecognitionNet.loadFromDisk(modelPath);
  modelsLoaded = true;
  console.log('✅ Face models loaded (SSD Mobilenet)');
}

async function getFaceEmbedding(imageBuffer) {
  await loadModels();
  let img = await canvas.loadImage(imageBuffer);
  console.log(`Ảnh gốc: ${img.width}x${img.height}`);

  // KHÔNG resize nếu ảnh đã đủ lớn (>= 300px)
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
  } else {
    console.log(`Ảnh đủ lớn, giữ nguyên kích thước`);
  }

  // Detect với ngưỡng thấp dần
  let detection = null;
  for (const minConfidence of [0.2, 0.1, 0.05]) {
    detection = await faceapi
      .detectSingleFace(processedImg, new faceapi.SsdMobilenetv1Options({ minConfidence }))
      .withFaceLandmarks()
      .withFaceDescriptor();
    if (detection) break;
  }

  if (!detection) {
    const detections = await faceapi.detectAllFaces(processedImg, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.1 }))
      .withFaceLandmarks()
      .withFaceDescriptors();
    if (detections.length) detection = detections[0];
  }

  if (!detection) {
    // lưu ảnh debug
    const debugDir = path.join(__dirname, '../debug');
    if (!fs.existsSync(debugDir)) fs.mkdirSync(debugDir, { recursive: true });
    const outPath = path.join(debugDir, `face_debug_${Date.now()}.jpg`);
    const outCanvas = canvas.createCanvas(processedImg.width, processedImg.height);
    const ctx = outCanvas.getContext('2d');
    ctx.drawImage(processedImg, 0, 0);
    const outStream = fs.createWriteStream(outPath);
    outCanvas.createJPEGStream().pipe(outStream);
    console.log(`📸 Lưu ảnh lỗi: ${outPath}`);
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

module.exports = { getFaceEmbedding, cosineSimilarity };