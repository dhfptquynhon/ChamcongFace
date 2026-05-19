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
  
  const capturedImagesRef = useRef([]);
  const stepCapturedRef = useRef({ look_left: false, look_right: false, look_up: false });
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
    if (stepCapturedRef.current[step]) return;
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
    if (isProcessingRef.current) return;
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

  // ------------------- VẼ UI (ĐÃ SỬA HƯỚNG LANDMARK) -------------------
  const canvasRef = useRef(null);
  const drawOverlay = useCallback((score, met, landmarks) => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const video = webcamRef.current?.video;
    if (!video) return;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (!landmarks) return;
    
    // Mirror function cho tọa độ X (vì webcam mirrored)
    const mirrorX = (x) => (1 - x) * canvas.width;
    const getY = (y) => y * canvas.height;
    
    // 1. Vẽ đường viền khuôn mặt (face contour) – đã mirror
    const faceContourIndices = [
      10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109
    ];
    ctx.beginPath();
    let first = true;
    for (let idx of faceContourIndices) {
      const point = landmarks[idx];
      if (point) {
        const x = mirrorX(point.x);
        const y = getY(point.y);
        if (first) {
          ctx.moveTo(x, y);
          first = false;
        } else {
          ctx.lineTo(x, y);
        }
      }
    }
    ctx.closePath();
    ctx.strokeStyle = met ? '#4ade80' : '#fbbf24';
    ctx.lineWidth = 2.5;
    ctx.shadowBlur = 8;
    ctx.shadowColor = met ? '#4ade80' : '#fbbf24';
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.save();
    ctx.globalAlpha = 0.15;
    ctx.fillStyle = met ? '#4ade80' : '#fbbf24';
    ctx.fill();
    ctx.restore();
    
    // 2. Vẽ các điểm landmark quan trọng (đã mirror)
    const importantIndices = [
      33, 133, 155, 154, 153, 145, 144, 163, 7, 173,
      263, 362, 387, 386, 385, 374, 373, 380, 367, 398,
      1, 2, 4, 5, 6, 168, 195, 197,
      61, 291, 78, 308, 81, 311, 87, 317, 95, 325, 88, 318, 84, 314, 80, 310,
      55, 65, 52, 285, 282, 295,
      107, 66, 105, 293, 296, 334
    ];
    ctx.shadowBlur = 5;
    ctx.shadowColor = '#00ffcc';
    for (let idx of importantIndices) {
      const point = landmarks[idx];
      if (point) {
        const x = mirrorX(point.x);
        const y = getY(point.y);
        ctx.beginPath();
        ctx.arc(x, y, 2.5, 0, 2 * Math.PI);
        ctx.fillStyle = '#00ffcc';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, 2 * Math.PI);
        ctx.fillStyle = 'rgba(0,255,204,0.3)';
        ctx.fill();
      }
    }
    ctx.shadowBlur = 0;
    
    // 3. Vẽ vòng tròn tiến trình ở góc dưới phải (không bị ảnh hưởng bởi mirror)
    const centerX = canvas.width - 60;
    const centerY = canvas.height - 60;
    const radius = 45;
    const startAngle = -Math.PI / 2;
    const endAngle = startAngle + (Math.PI * 2 * Math.min(score, 1));
    
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 5;
    ctx.stroke();
    
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, startAngle, endAngle);
    ctx.strokeStyle = met ? '#4ade80' : '#fbbf24';
    ctx.lineWidth = 7;
    ctx.stroke();
    
    ctx.font = 'bold 22px "Segoe UI"';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`${Math.round(score * 100)}%`, centerX - 30, centerY + 8);
    
    // 4. Icon hướng dẫn (nếu chưa đạt)
    if (score < 1 && !met) {
      ctx.font = '28px sans-serif';
      ctx.fillStyle = '#fbbf24';
      let icon = '';
      if (challengeRef.current === 'look_left') icon = '⬅️';
      else if (challengeRef.current === 'look_right') icon = '➡️';
      else if (challengeRef.current === 'look_up') icon = '⬆️';
      ctx.fillText(icon, centerX - 20, centerY - 45);
    }
  }, []);
  
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
          }
          
          setCurrentScore(score);
          const met = detected;
          setIsThresholdMet(met);
          drawOverlay(score, met, landmarks);
          
          if (detected) {
            if (currentChallenge === 'look_left' && !stepCapturedRef.current.look_left) {
              captureCurrentFrame('look_left');
              setChallenge('look_right');
            } else if (currentChallenge === 'look_right' && !stepCapturedRef.current.look_right) {
              captureCurrentFrame('look_right');
              setChallenge('look_up');
            } else if (currentChallenge === 'look_up' && !stepCapturedRef.current.look_up) {
              captureCurrentFrame('look_up');
              setIsLivenessPassed(true);
              handleRegisterWithMultipleImages();
              return;
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
      case 'look_left': return '👉 Quay mặt sang TRÁI';
      case 'look_right': return '👈 Quay mặt sang PHẢI';
      case 'look_up': return '🙂 Ngước mặt LÊN TRÊN';
      default: return '';
    }
  };

  const getIcon = () => {
    switch(challenge) {
      case 'look_left': return '⬅️';
      case 'look_right': return '➡️';
      case 'look_up': return '⬆️';
      default: return '😀';
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
        <h3 style={styles.title}>📸 Thiết lập khuôn mặt</h3>
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
        <div style={styles.instruction}>
          <span style={styles.icon}>{getIcon()}</span>
          <span>{getInstruction()}</span>
        </div>
        <div style={styles.footer}>
          <button onClick={handleClose} style={styles.btnCancel} disabled={loading}>Hủy bỏ</button>
        </div>
      </div>
    </div>
  );
};

const styles = {
  overlay: { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000 },
  container: { background: '#1e1e2f', padding: '25px', borderRadius: '32px', width: '520px', textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)' },
  title: { marginTop: 0, color: '#fff', fontSize: '1.6rem', fontWeight: 600 },
  banner: { padding: '14px', color: '#fff', borderRadius: '60px', marginBottom: '20px', fontWeight: 'bold', fontSize: '0.9rem', backdropFilter: 'blur(10px)', background: 'rgba(0,0,0,0.5)' },
  camBox: { position: 'relative', height: '480px', borderRadius: '24px', overflow: 'hidden', background: '#000', boxShadow: '0 0 0 2px rgba(255,255,255,0.1)' },
  webcam: { width: '100%', height: '100%', objectFit: 'cover' },
  canvas: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' },
  loader: { position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' },
  instruction: { margin: '20px 0 10px', padding: '14px', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: '60px', fontSize: '1.1rem', fontWeight: 'bold', color: '#ffc357', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' },
  icon: { fontSize: '1.8rem' },
  footer: {},
  btnCancel: { padding: '10px 30px', cursor: 'pointer', borderRadius: '40px', background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', fontSize: '0.9rem', fontWeight: 500, transition: '0.2s' }
};

export default FaceRegisterModal;