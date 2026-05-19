// src/pages/FaceRegisterModal.js
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import Webcam from 'react-webcam';
import axios from 'axios';

const FaceRegisterModal = ({ onClose, onSuccess }) => {
  const webcamRef = useRef(null);
  const landmarkerRef = useRef(null);
  
  const [status, setStatus] = useState('Đang khởi tạo AI...');
  const [challenge, setChallenge] = useState('look_left');
  const [isLivenessPassed, setIsLivenessPassed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isAiReady, setIsAiReady] = useState(false);
  
  const [currentScore, setCurrentScore] = useState(0);
  const [isThresholdMet, setIsThresholdMet] = useState(false);
  const [faceBox, setFaceBox] = useState(null);
  
  // Lưu danh sách ảnh đã chụp
  const capturedImagesRef = useRef([]);
  // Đánh dấu đã chụp cho từng bước
  const stepCapturedRef = useRef({ look_left: false, look_right: false, look_up: false });
  // Chống gọi request nhiều lần
  const isProcessingRef = useRef(false);
  
  const challengeRef = useRef(challenge);
  useEffect(() => {
    challengeRef.current = challenge;
    setCurrentScore(0);
    setIsThresholdMet(false);
  }, [challenge]);

  // ------------------- TRÁI / PHẢI -------------------
  const checkLeftRightDirection = (landmarks, videoWidth) => {
    const leftEye = 33, rightEye = 263, nose = 4;
    const eyeMidX = (landmarks[leftEye].x + landmarks[rightEye].x) / 2;
    const horizontalOffset = (eyeMidX - landmarks[nose].x) * videoWidth;
    if (horizontalOffset > 50) return 'right';
    if (horizontalOffset < -50) return 'left';
    return 'center';
  };

  const computeLeftRightScore = (landmarks, videoWidth) => {
    const leftEye = 33, rightEye = 263, nose = 4;
    const eyeMidX = (landmarks[leftEye].x + landmarks[rightEye].x) / 2;
    const horizontalOffset = Math.abs((eyeMidX - landmarks[nose].x) * videoWidth);
    return Math.min(1.0, horizontalOffset / 50);
  };

  // ------------------- LÊN / XUỐNG -------------------
  const checkUpDownDirection = (landmarks) => {
    const eyeMidY = (landmarks[33].y + landmarks[263].y) / 2;
    const noseY = landmarks[4].y;
    const chinY = landmarks[152].y;
    const topDist = noseY - eyeMidY;
    const bottomDist = chinY - noseY;
    if (topDist <= 0.001) return 'up';
    const ratio = bottomDist / topDist;
    console.log(`[Ngước] ratio = ${ratio.toFixed(3)}`);
    if (ratio > 1.5) return 'up';
    if (ratio < 0.8) return 'down';
    return 'center';
  };

  const computeUpDownScore = (landmarks) => {
    const eyeMidY = (landmarks[33].y + landmarks[263].y) / 2;
    const topDist = Math.max(0.001, landmarks[4].y - eyeMidY);
    const bottomDist = Math.max(0, landmarks[152].y - landmarks[4].y);
    const ratio = bottomDist / topDist;
    let score = (ratio - 1.0) / (1.4 - 1.0);
    return Math.max(0, Math.min(1.0, score));
  };

  // ------------------- KHỞI TẠO AI -------------------
  useEffect(() => {
    let isMounted = true;
    const init = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm");
        const landmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task", delegate: "GPU" },
          outputFaceBlendshapes: true, outputFaceLandmarks: true, runningMode: "VIDEO", numFaces: 1
        });
        if (isMounted) {
          landmarkerRef.current = landmarker;
          setIsAiReady(true);
          setStatus('Vui lòng quay đầu sang TRÁI để bắt đầu');
          // Reset tất cả
          capturedImagesRef.current = [];
          stepCapturedRef.current = { look_left: false, look_right: false, look_up: false };
          isProcessingRef.current = false;
        }
      } catch (err) {
        setError("Không thể tải mô hình AI.");
      }
    };
    init();
    return () => { isMounted = false; };
  }, []);

  // Chụp ảnh từ video element
  const captureCurrentFrame = useCallback((step) => {
    // Chỉ chụp nếu chưa chụp cho bước này
    if (stepCapturedRef.current[step]) {
      console.log(`⏭️ Bước ${step} đã chụp rồi, bỏ qua.`);
      return;
    }
    
    const video = webcamRef.current?.video;
    if (!video || video.readyState !== 4) {
      console.warn(`⚠️ Video chưa sẵn sàng để chụp cho bước ${step}`);
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageSrc = canvas.toDataURL('image/jpeg', 0.9);
    if (imageSrc) {
      capturedImagesRef.current.push(imageSrc);
      stepCapturedRef.current[step] = true;
      // Cập nhật status thông báo cho người dùng
      if (step === 'look_left') setStatus('✓ Đã chụp ảnh trái, bây giờ quay sang PHẢI');
      if (step === 'look_right') setStatus('✓ Đã chụp ảnh phải, bây giờ ngước mặt LÊN');
      if (step === 'look_up') setStatus('✓ Đã chụp ảnh ngước, đang lưu...');
      console.log(`📸 Đã chụp ảnh cho bước ${step} (tổng: ${capturedImagesRef.current.length})`);
    } else {
      console.warn(`❌ Không thể tạo ảnh cho bước ${step}`);
    }
  }, []);

  // Gửi mảng ảnh lên server
  const handleRegisterWithMultipleImages = useCallback(async () => {
  if (isProcessingRef.current) {
    console.warn('Đang xử lý, bỏ qua yêu cầu trùng');
    return;
  }
  const images = capturedImagesRef.current;
  if (images.length !== 3) {
    console.error(`Số lượng ảnh không đủ: ${images.length}/3`);
    setError(`Chỉ chụp được ${images.length}/3 ảnh, vui lòng thử lại.`);
    setLoading(false);
    setIsLivenessPassed(false);
    setChallenge('look_left');
    setStatus('Vui lòng quay đầu sang TRÁI để bắt đầu lại');
    capturedImagesRef.current = [];
    stepCapturedRef.current = { look_left: false, look_right: false, look_up: false };
    isProcessingRef.current = false;
    return;
  }
  isProcessingRef.current = true;
  setLoading(true);
  try {
    const authData = localStorage.getItem('auth');
    const token = authData ? JSON.parse(authData).token : null;
    console.log('📤 Đang gửi 3 ảnh lên server...');
    const response = await axios.post(
      'http://localhost:5000/api/attendance/register-face',
      { images: images },
      {
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        timeout: 15000
      }
    );
    console.log('📥 Server response:', response.data);
    if (response.data.success) {
      setStatus('✓ Đăng ký khuôn mặt thành công!');
      setTimeout(() => {
        if (onSuccess) onSuccess();
        onClose();
      }, 1500);
    } else {
      throw new Error(response.data.message || 'Lỗi không xác định');
    }
  } catch (err) {
    console.error("❌ Lỗi lưu mặt:", err.response?.data || err.message);
    setError(err.response?.data?.message || "Lỗi xác thực hoặc server.");
    setLoading(false);
    setIsLivenessPassed(false);
    setChallenge('look_left');
    setStatus('Vui lòng quay đầu sang TRÁI để bắt đầu lại');
    capturedImagesRef.current = [];
    stepCapturedRef.current = { look_left: false, look_right: false, look_up: false };
    isProcessingRef.current = false;
  }
}, [onSuccess, onClose]);

  // ------------------- VẼ UI -------------------
  const drawOverlay = useCallback((score, met, box) => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const video = webcamRef.current?.video;
    if (!video) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (box) {
      ctx.strokeStyle = met ? '#00ff00' : '#ff0000';
      ctx.lineWidth = 3;
      ctx.strokeRect(box.x, box.y, box.width, box.height);
    }
    const barWidth = canvas.width - 40;
    const barHeight = 20;
    ctx.fillStyle = '#333333';
    ctx.fillRect(20, canvas.height - 40, barWidth, barHeight);
    ctx.fillStyle = met ? '#00ff00' : '#ffaa00';
    ctx.fillRect(20, canvas.height - 40, barWidth * Math.min(score, 1), barHeight);
    ctx.strokeStyle = '#ffffff';
    ctx.strokeRect(20, canvas.height - 40, barWidth, barHeight);
    ctx.fillStyle = '#ffffff';
    ctx.font = "14px Arial";
    ctx.fillText(`Độ chính xác: ${Math.round(score * 100)}%`, 20, canvas.height - 45);
  }, []);

  const canvasRef = useRef(null);

  // ------------------- VÒNG LẶP PREDICT -------------------
  useEffect(() => {
    if (!isAiReady || isLivenessPassed || loading) return;
    let animationId;
    const predict = () => {
      if (!landmarkerRef.current || !webcamRef.current?.video || webcamRef.current.video.readyState !== 4) {
        animationId = requestAnimationFrame(predict);
        return;
      }
      try {
        const video = webcamRef.current.video;
        const result = landmarkerRef.current.detectForVideo(video, performance.now());
        
        if (result.faceLandmarks && result.faceLandmarks.length > 0) {
          const landmarks = result.faceLandmarks[0];
          const videoWidth = video.videoWidth;
          
          let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
          for (const lm of landmarks) {
            minX = Math.min(minX, lm.x); minY = Math.min(minY, lm.y);
            maxX = Math.max(maxX, lm.x); maxY = Math.max(maxY, lm.y);
          }
          const box = {
            x: minX * videoWidth,
            y: minY * video.videoHeight,
            width: (maxX - minX) * videoWidth,
            height: (maxY - minY) * video.videoHeight
          };
          
          let detected = false, score = 0;
          const currentChallenge = challengeRef.current;
          
          if (currentChallenge === 'look_left' || currentChallenge === 'look_right') {
            const direction = checkLeftRightDirection(landmarks, videoWidth);
            detected = (direction === (currentChallenge === 'look_left' ? 'left' : 'right'));
            score = computeLeftRightScore(landmarks, videoWidth);
          } else if (currentChallenge === 'look_up') {
            const direction = checkUpDownDirection(landmarks);
            detected = (direction === 'up');
            score = computeUpDownScore(landmarks);
            console.log(`[look_up] direction=${direction}, detected=${detected}, score=${score.toFixed(3)}`);
          }
          
          setCurrentScore(score);
          const met = detected;
          setIsThresholdMet(met);
          drawOverlay(score, met, box);
          
          if (detected) {
            if (currentChallenge === 'look_left' && !stepCapturedRef.current.look_left) {
              captureCurrentFrame('look_left');
              setChallenge('look_right');
              // Không set status ở đây vì captureCurrentFrame đã set
            } else if (currentChallenge === 'look_right' && !stepCapturedRef.current.look_right) {
              captureCurrentFrame('look_right');
              setChallenge('look_up');
            } else if (currentChallenge === 'look_up' && !stepCapturedRef.current.look_up) {
              captureCurrentFrame('look_up');
              setIsLivenessPassed(true);
              handleRegisterWithMultipleImages(); // gửi 3 ảnh
              return; // dừng predict ngay
            }
          }
        } else {
          drawOverlay(0, false, null);
        }
      } catch (err) {
        console.error(err);
      }
      animationId = requestAnimationFrame(predict);
    };
    animationId = requestAnimationFrame(predict);
    return () => cancelAnimationFrame(animationId);
  }, [isAiReady, isLivenessPassed, loading, captureCurrentFrame, handleRegisterWithMultipleImages, drawOverlay]);

  const getInstruction = () => {
    switch(challenge) {
      case 'look_left': return '👉 Quay mặt sang TRÁI, giữ cho đến khi khung xanh';
      case 'look_right': return '👈 Quay mặt sang PHẢI, giữ cho đến khi khung xanh';
      case 'look_up': return '🙂 Ngước mặt LÊN TRÊN, giữ cho đến khi khung xanh';
      default: return '';
    }
  };

  const handleClose = () => {
    capturedImagesRef.current = [];
    stepCapturedRef.current = { look_left: false, look_right: false, look_up: false };
    isProcessingRef.current = false;
    onClose();
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.container}>
        <h3 style={styles.title}>Thiết lập khuôn mặt</h3>
        <div style={{...styles.banner, backgroundColor: error ? '#dc3545' : isThresholdMet ? '#28a745' : '#6f42c1'}}>
          {error || status}
        </div>
        <div style={styles.camBox}>
          <Webcam
            audio={false}
            ref={webcamRef}
            screenshotFormat="image/jpeg"
            style={styles.webcam}
            mirrored={true}
            videoConstraints={{ width: 640, height: 480, facingMode: "user" }}
            onUserMedia={() => console.log('📷 Webcam đã sẵn sàng')}
            onUserMediaError={(err) => console.error('Webcam error:', err)}
          />
          <canvas ref={canvasRef} style={styles.canvas} />
          {loading && <div style={styles.loader}><p>Đang xử lý...</p></div>}
        </div>
        <div style={styles.instruction}>📌 {getInstruction()}</div>
        <div style={styles.footer}>
          <button onClick={handleClose} style={styles.btnCancel} disabled={loading}>Hủy bỏ</button>
        </div>
      </div>
    </div>
  );
};

const styles = {
  overlay: { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000 },
  container: { background: '#fff', padding: '25px', borderRadius: '20px', width: '500px', textAlign: 'center' },
  title: { marginTop: 0 },
  banner: { padding: '12px', color: '#fff', borderRadius: '10px', marginBottom: '15px', fontWeight: 'bold' },
  camBox: { position: 'relative', height: '480px', borderRadius: '15px', overflow: 'hidden', background: '#000' },
  webcam: { width: '100%', height: '100%', objectFit: 'cover' },
  canvas: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' },
  loader: { position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  instruction: { margin: '12px 0', padding: '8px', backgroundColor: '#f0f0f0', borderRadius: '8px', fontSize: '14px', fontWeight: 'bold', color: '#333' },
  footer: {},
  btnCancel: { padding: '10px 30px', cursor: 'pointer', borderRadius: '8px', background: '#f8f9fa', border: '1px solid #ddd' }
};

export default FaceRegisterModal;