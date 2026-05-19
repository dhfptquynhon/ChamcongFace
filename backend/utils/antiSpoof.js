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

async function detectLiveness(imageBuffer) {
  // Tạm thời tắt antispoof vì chưa có model
  // Bật lại khi có đủ file model
  return true;

  /* Code gốc - bật lại khi có model
  await loadAntiSpoofModel();
  const img = await canvas.loadImage(imageBuffer);
  const inputCanvas = canvas.createCanvas(128, 128);
  const ctx = inputCanvas.getContext('2d');
  ctx.drawImage(img, 0, 0, 128, 128);
  const imageData = ctx.getImageData(0, 0, 128, 128);
  const tensor = tf.tidy(() => {
    const data = tf.browser.fromPixels(imageData);
    return data.expandDims(0).toFloat().div(255.0);
  });
  const prediction = antispoofModel.predict(tensor);
  const score = prediction.dataSync()[0];
  tensor.dispose();
  prediction.dispose();
  return score > 0.5;
  */
}

module.exports = { detectLiveness };