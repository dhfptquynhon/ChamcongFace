const tf = require('@tensorflow/tfjs');
const canvas = require('canvas');
const path = require('path');

let antispoofModel = null;

async function loadAntiSpoofModel() {
  if (antispoofModel) return;
  const modelPath = `file://${path.join(__dirname, '../models/antispoof_model/model.json')}`;
  antispoofModel = await tf.loadGraphModel(modelPath);
  console.log('✅ Anti-spoofing model loaded');
}

/**
 * Nhận buffer ảnh, trả về true nếu là ảnh thật (live), false nếu giả (spoof)
 */
async function detectLiveness(imageBuffer) {
  await loadAntiSpoofModel();

  // Tiền xử lý ảnh: resize về 128x128 (tuỳ theo yêu cầu của model)
  const img = await canvas.loadImage(imageBuffer);
  const inputCanvas = canvas.createCanvas(128, 128);
  const ctx = inputCanvas.getContext('2d');
  ctx.drawImage(img, 0, 0, 128, 128);
  const imageData = ctx.getImageData(0, 0, 128, 128);

  // Chuyển sang tensor [1, 128, 128, 3]
  const tensor = tf.tidy(() => {
    const data = tf.browser.fromPixels(imageData); // [128,128,3]
    return data.expandDims(0).toFloat().div(255.0); // normalize [0,1]
  });

  const prediction = antispoofModel.predict(tensor);
  const score = prediction.dataSync()[0]; // giả sử đầu ra là xác suất ảnh thật
  tensor.dispose();
  prediction.dispose();

  return score > 0.5; // ngưỡng 0.5
}

module.exports = { detectLiveness };