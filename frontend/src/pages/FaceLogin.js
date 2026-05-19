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
  
  const challenges = ['look_left', 'look_right'];
  const remainingChallengesRef = useRef([...challenges]);
  
  const [livenessStatus, setLivenessStatus] = useState('init');
  const [currentChallenge, setCurrentChallenge] = useState(null);
  const [message, setMessage] = useState('Đang khởi tạo...');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [isAiReady, setIsAiReady] = useState(false);
  const [currentScore, setCurrentScore] = useState(0);
  
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
    setShowCodeDialog(false);
    setTempUserId(null);
    setVerificationCode('');
    setCodeError('');
    setTimeout(() => startLiveness(), 2000);
  };
  
  // Hàm kiểm tra hướng và tính điểm
  const checkLeftRightDirection = (landmarks, videoWidth) => {
    const eyeMidX = (landmarks[33].x + landmarks[263].x) / 2;
    const horizontalOffset = (eyeMidX - landmarks[4].x) * videoWidth;
    if (horizontalOffset > 15) return 'left';
    if (horizontalOffset < -15) return 'right';
    return 'center';
  };
  
  const computeDirectionalScore = (landmarks, videoWidth, expectedDirection) => {
    const eyeMidX = (landmarks[33].x + landmarks[263].x) / 2;
    const rawOffset = (eyeMidX - landmarks[4].x) * videoWidth;
    const signedOffset = expectedDirection === 'left' ? rawOffset : -rawOffset;
    return Math.max(0, Math.min(1.0, signedOffset / 40));
  };
  
  // Khởi tạo MediaPipe
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
  
  // ------------------- VẼ UI (ĐÃ SỬA HƯỚNG LANDMARK) -------------------
  const canvasRef = useRef(null);
  const drawOverlay = useCallback((score, landmarks) => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const video = webcamRef.current?.video;
    if (!video) return;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (!landmarks) return;
    
    const met = (score >= 1);
    const challenge = currentChallenge;
    
    // Mirror function cho tọa độ X (vì webcam mirrored)
    const mirrorX = (x) => (1 - x) * canvas.width;
    const getY = (y) => y * canvas.height;
    
    // 1. Vẽ đường viền khuôn mặt
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
    
    // 3. Vẽ vòng tròn tiến trình
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
    
    // Icon hướng dẫn (nếu chưa đạt)
    if (score < 1 && !met && challenge) {
      ctx.font = '28px sans-serif';
      ctx.fillStyle = '#fbbf24';
      let icon = '';
      if (challenge === 'look_left') icon = '⬅️';
      else if (challenge === 'look_right') icon = '➡️';
      ctx.fillText(icon, centerX - 20, centerY - 45);
    }
  }, [currentChallenge]);
  
  // Vòng lặp dự đoán
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
          drawOverlay(score, landmarks);
          
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
  
  // Gọi API nhận diện khuôn mặt
  const performFaceRecognition = async () => {
    setIsProcessing(true);
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
  
  // Xác minh code
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
        <h2 style={styles.title}>🔐 Đăng nhập bằng khuôn mặt</h2>
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
  card: { width: '100%', maxWidth: 420, padding: 24, borderRadius: 32, background: '#1e1e2f', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', color: '#fff', textAlign: 'center', border: '1px solid rgba(255,255,255,0.1)' },
  title: { marginTop: 0, fontSize: '1.5rem', fontWeight: 600 },
  preview: { position: 'relative', width: '100%', height: 320, marginBottom: 16, borderRadius: 24, overflow: 'hidden', background: '#000', boxShadow: '0 0 0 2px rgba(255,255,255,0.1)' },
  canvas: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' },
  message: { margin: '12px 0', padding: '10px', backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 60, fontSize: 14, color: '#ffc357', fontWeight: 'bold' },
  error: { color: '#ff8a8a', marginBottom: 12, fontSize: 14 },
  processing: { color: '#ffc357', marginBottom: 12, fontSize: 14 },
  linkButton: { background: 'none', border: 'none', color: '#fff', textDecoration: 'underline', cursor: 'pointer', fontSize: 14, marginTop: 12, opacity: 0.7, transition: '0.2s', ':hover': { opacity: 1 } },
  
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
    borderRadius: 24,
    padding: 24,
    width: 320,
    textAlign: 'center',
  },
  codeInput: {
    width: '100%',
    padding: '10px 12px',
    fontSize: '1rem',
    margin: '12px 0',
    borderRadius: 40,
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
    borderRadius: 40,
    cursor: 'pointer',
  },
  confirmBtn: {
    padding: '8px 20px',
    backgroundColor: '#1976d2',
    color: '#fff',
    border: 'none',
    borderRadius: 40,
    cursor: 'pointer',
  },
};

export default FaceLogin;