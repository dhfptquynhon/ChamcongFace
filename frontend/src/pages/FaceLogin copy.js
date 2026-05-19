import React, { useRef, useState, useContext, useEffect, useCallback } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import Webcam from 'react-webcam';
import axios from 'axios';
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import AuthContext from '../context/AuthContext';

const FaceLogin = () => {
  const { auth, setAuth } = useContext(AuthContext);
  const navigate = useNavigate();
  const webcamRef = useRef(null);
  const landmarkerRef = useRef(null);
  const timeoutRef = useRef(null);
  
  // Khai báo challenges TRƯỚC KHI dùng trong useRef
  const challenges = ['look_left', 'look_right'];
  const remainingChallengesRef = useRef([...challenges]);
  
  const [livenessStatus, setLivenessStatus] = useState('init');
  const [currentChallenge, setCurrentChallenge] = useState(null);
  const [message, setMessage] = useState('Đang khởi tạo...');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [isAiReady, setIsAiReady] = useState(false);
  const [currentScore, setCurrentScore] = useState(0);
  const [faceBox, setFaceBox] = useState(null);
  
  // State cho dialog nhập code
  const [showCodeDialog, setShowCodeDialog] = useState(false);
  const [tempUserId, setTempUserId] = useState(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [codeError, setCodeError] = useState('');
  
  const mirrored = true;
  
  const shuffleChallenges = () => {
    const arr = [...challenges];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    remainingChallengesRef.current = arr;
  };
  
  const startLiveness = () => {
    shuffleChallenges();
    setLivenessStatus('active');
    nextChallenge();
  };
  
  const nextChallenge = () => {
    if (remainingChallengesRef.current.length === 0) {
      setLivenessStatus('passed');
      setMessage('Xác minh thành công! Đang nhận diện khuôn mặt...');
      performFaceRecognition();
      return;
    }
    const next = remainingChallengesRef.current.shift();
    setCurrentChallenge(next);
    updateMessage(next);
    setCurrentScore(0);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setError('Quá thời gian thực hiện. Vui lòng thử lại.');
      resetLiveness();
    }, 10000);
  };
  
  const updateMessage = (challenge) => {
    switch(challenge) {
      case 'look_left': setMessage('👈 Quay đầu sang PHẢI'); break;
      case 'look_right': setMessage('👉 Quay đầu sang TRÁI'); break;
      default: setMessage('');
    }
  };
  
  const resetLiveness = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    remainingChallengesRef.current = [...challenges];
    setLivenessStatus('init');
    setCurrentChallenge(null);
    setMessage('Vui lòng thử lại');
    setError('');
    setShowCodeDialog(false); // Đóng dialog nếu đang mở
    setTempUserId(null);
    setVerificationCode('');
    setCodeError('');
    setTimeout(() => startLiveness(), 2000);
  };
  
  // ------------------- KIỂM TRA HƯỚNG BẰNG LANDMARK -------------------
  const checkLeftRightDirection = (landmarks, videoWidth) => {
    const eyeMidX = (landmarks[33].x + landmarks[263].x) / 2;
    const horizontalOffset = (eyeMidX - landmarks[4].x) * videoWidth;
    // Mirror: offset dương → user quay phải thật → hiện là 'left' trên màn hình
    if (horizontalOffset > 15) return 'left';
    if (horizontalOffset < -15) return 'right';
    return 'center';
  };
  
  const computeDirectionalScore = (landmarks, videoWidth, expectedDirection) => {
    const eyeMidX = (landmarks[33].x + landmarks[263].x) / 2;
    const rawOffset = (eyeMidX - landmarks[4].x) * videoWidth; // có dấu
    
    // Mirror: offset dương = 'left', âm = 'right'
    // Nếu yêu cầu 'left': rawOffset dương là đúng → score dương
    // Nếu yêu cầu 'right': rawOffset âm là đúng → score dương khi đảo dấu
    const signedOffset = expectedDirection === 'left' ? rawOffset : -rawOffset;
    
    // Nội suy: 0px = 0 điểm, 40px = 1 điểm, âm = 0 điểm
    const score = Math.max(0, Math.min(1.0, signedOffset / 40));
    return score;
  };
  
  // ------------------- KHỞI TẠO MEDIAPIPE -------------------
  useEffect(() => {
    let isMounted = true;
    const init = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );
        const landmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
            delegate: "GPU"
          },
          outputFaceBlendshapes: true,
          outputFaceLandmarks: true,
          runningMode: "VIDEO",
          numFaces: 1
        });
        if (isMounted) {
          landmarkerRef.current = landmarker;
          setIsAiReady(true);
          startLiveness();
        }
      } catch (err) {
        console.error("Lỗi AI:", err);
        setError("Không thể tải mô hình AI.");
      }
    };
    init();
    return () => { isMounted = false; };
  }, []);
  
  // ------------------- VẼ KHUNG VÀ THANH TIẾN TRÌNH -------------------
  const canvasRef = useRef(null);
  const drawOverlay = useCallback((score, box) => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const video = webcamRef.current?.video;
    if (!video) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (box) {
      ctx.strokeStyle = '#00ff00';
      ctx.lineWidth = 3;
      ctx.strokeRect(box.x, box.y, box.width, box.height);
    }
    const barWidth = canvas.width - 40;
    const barHeight = 20;
    const barX = 20;
    const barY = canvas.height - 40;
    ctx.fillStyle = '#333333';
    ctx.fillRect(barX, barY, barWidth, barHeight);
    const fillWidth = barWidth * Math.min(score, 1);
    ctx.fillStyle = '#00ff00';
    ctx.fillRect(barX, barY, fillWidth, barHeight);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barWidth, barHeight);
    ctx.font = "14px Arial";
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`Độ chính xác: ${Math.round(score * 100)}%`, barX, barY - 5);
  }, []);
  
  // ------------------- VÒNG LẶP DỰ ĐOÁN (CẬP NHẬT SCORE) -------------------
  useEffect(() => {
    if (!isAiReady || livenessStatus !== 'active') return;
    let animationId;
    const predict = () => {
      if (!landmarkerRef.current || !webcamRef.current?.video) {
        animationId = requestAnimationFrame(predict);
        return;
      }
      const video = webcamRef.current.video;
      if (video.readyState !== 4) {
        animationId = requestAnimationFrame(predict);
        return;
      }
      try {
        const result = landmarkerRef.current.detectForVideo(video, performance.now());
        if (result.faceLandmarks && result.faceLandmarks.length > 0) {
          const landmarks = result.faceLandmarks[0];
          const videoWidth = video.videoWidth;
          const videoHeight = video.videoHeight;
          
          // Bounding box
          let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
          for (const lm of landmarks) {
            minX = Math.min(minX, lm.x);
            minY = Math.min(minY, lm.y);
            maxX = Math.max(maxX, lm.x);
            maxY = Math.max(maxY, lm.y);
          }
          const box = {
            x: minX * videoWidth,
            y: minY * videoHeight,
            width: (maxX - minX) * videoWidth,
            height: (maxY - minY) * videoHeight
          };
          
          let score = 0;
          let shouldComplete = false;
          if (currentChallenge === 'look_left' || currentChallenge === 'look_right') {
            const expected = currentChallenge === 'look_left' ? 'left' : 'right';
            score = computeDirectionalScore(landmarks, videoWidth, expected);
            if (score >= 1) {
              shouldComplete = true;
            }
          }
          
          setCurrentScore(score);
          setFaceBox(box);
          drawOverlay(score, box);
          
          if (shouldComplete) {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            nextChallenge();
            return;
          }
        } else {
          drawOverlay(0, null);
        }
      } catch (err) {
        console.error('Lỗi detect:', err);
      }
      animationId = requestAnimationFrame(predict);
    };
    animationId = requestAnimationFrame(predict);
    return () => cancelAnimationFrame(animationId);
  }, [isAiReady, livenessStatus, currentChallenge, drawOverlay]);
  
  // ------------------- GỌI API NHẬN DIỆN KHUÔN MẶT -------------------
  const performFaceRecognition = async () => {
  setIsProcessing(true);
  // Đợi webcam ổn định (quan trọng)
  await new Promise(resolve => setTimeout(resolve, 200));
  const imageSrc = webcamRef.current?.getScreenshot({
    width: 640,
    height: 480,
    quality: 1
  });
  if (!imageSrc) {
    setError('Không thể chụp ảnh. Vui lòng thử lại.');
    resetLiveness();
    setIsProcessing(false);
    return;
  }
  console.log('📸 Ảnh chụp được, độ dài:', imageSrc.length);
  try {
    const response = await axios.post('http://localhost:5000/api/attendance/login-face', { image: imageSrc });
    console.log('📥 Server response:', response.data);
    if (response.data.success) {
      if (response.data.requireCode) {
        setTempUserId(response.data.userId);
        setShowCodeDialog(true);
        setMessage('Nhập mã xác thực để hoàn tất đăng nhập');
        setIsProcessing(false);
        return;
      } else {
        const { token, user } = response.data.data;
        const authData = { token, employee: user };
        localStorage.setItem('auth', JSON.stringify(authData));
        setAuth(authData);
        navigate('/');
      }
    } else {
      setError(response.data.message || 'Không nhận diện được khuôn mặt');
      resetLiveness();
    }
  } catch (err) {
    console.error('❌ Lỗi login-face:', err.response?.data || err.message);
    setError(err.response?.data?.message || 'Lỗi kết nối server');
    resetLiveness();
  } finally {
    setIsProcessing(false);
  }
};
  
  // ------------------- XÁC MINH CODE -------------------
  const handleVerifyCode = async () => {
    if (!verificationCode.trim()) {
      setCodeError('Vui lòng nhập mã xác thực');
      return;
    }
    setIsProcessing(true);
    try {
      const response = await axios.post('http://localhost:5000/api/attendance/login-face-verify', {
        userId: tempUserId,
        code: verificationCode
      });
      if (response.data.success) {
        const { token, user } = response.data.data;
        const authData = { token, employee: user };
        localStorage.setItem('auth', JSON.stringify(authData));
        setAuth(authData);
        navigate('/');
      } else {
        setCodeError(response.data.message || 'Mã xác thực không đúng');
      }
    } catch (err) {
      setCodeError(err.response?.data?.message || 'Lỗi xác thực mã');
    } finally {
      setIsProcessing(false);
    }
  };
  
  if (auth) return <Navigate to="/" />;
  
  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h2>Đăng nhập bằng khuôn mặt</h2>
        <div style={styles.preview}>
          <Webcam
            audio={false}
            ref={webcamRef}
            screenshotFormat="image/jpeg"
            screenshotQuality={1}
            mirrored={mirrored}
            videoConstraints={{ width: 640, height: 480, facingMode: 'user' }}
            style={{ width: '100%', height: '100%', borderRadius: 12 }}
          />
          <canvas ref={canvasRef} style={styles.canvas} />
        </div>
        <div style={styles.message}>{message}</div>
        {error && <div style={styles.error}>{error}</div>}
        {isProcessing && <div style={styles.processing}>Đang xử lý...</div>}
        <button style={styles.linkButton} onClick={() => navigate('/login')}>
          Quay về đăng nhập mật khẩu
        </button>
      </div>
      
      {/* Dialog nhập mã code */}
      {showCodeDialog && (
        <div style={styles.dialogOverlay}>
          <div style={styles.dialog}>
            <h3>Xác thực bảo mật</h3>
            <p>Vui lòng nhập mã code được cấp để hoàn tất đăng nhập.</p>
            <input
              type="text"
              placeholder="Nhập mã code"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value)}
              style={styles.codeInput}
              autoFocus
            />
            {codeError && <div style={styles.error}>{codeError}</div>}
            <div style={styles.dialogButtons}>
              <button
                onClick={() => {
                  setShowCodeDialog(false);
                  resetLiveness();
                  setVerificationCode('');
                  setCodeError('');
                }}
                style={styles.cancelBtn}
              >
                Hủy
              </button>
              <button
                onClick={handleVerifyCode}
                style={styles.confirmBtn}
                disabled={isProcessing}
              >
                {isProcessing ? 'Đang xử lý...' : 'Xác nhận'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const styles = {
  container: { minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'linear-gradient(135deg, #1c1c1c, #2b2b2b)', padding: 20 },
  card: { width: '100%', maxWidth: 420, padding: 24, borderRadius: 24, background: 'rgba(255,255,255,0.08)', boxShadow: '0 20px 50px rgba(0,0,0,0.3)', color: '#fff', textAlign: 'center' },
  preview: { position: 'relative', width: '100%', height: 320, marginBottom: 16, borderRadius: 16, overflow: 'hidden', background: '#000' },
  canvas: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' },
  message: { margin: '12px 0', padding: '8px', backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 8, fontSize: 14, color: '#ffc357' },
  error: { color: '#ff8a8a', marginBottom: 12, fontSize: 14 },
  processing: { color: '#ffc357', marginBottom: 12, fontSize: 14 },
  linkButton: { background: 'none', border: 'none', color: '#fff', textDecoration: 'underline', cursor: 'pointer', fontSize: 14, marginTop: 12 },
  
  // Dialog styles
  dialogOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2000,
  },
  dialog: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    width: 320,
    textAlign: 'center',
  },
  codeInput: {
    width: '100%',
    padding: '10px 12px',
    fontSize: '1rem',
    margin: '12px 0',
    borderRadius: 8,
    border: '1px solid #ccc',
    outline: 'none',
  },
  dialogButtons: {
    display: 'flex',
    gap: 12,
    justifyContent: 'center',
  },
  cancelBtn: {
    padding: '8px 20px',
    backgroundColor: '#f0f0f0',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
  },
  confirmBtn: {
    padding: '8px 20px',
    backgroundColor: '#1976d2',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
  },
};

export default FaceLogin;