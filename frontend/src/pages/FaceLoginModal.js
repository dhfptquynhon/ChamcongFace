import React, { useRef, useEffect, useState, useCallback } from 'react';
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import Webcam from 'react-webcam';
import axios from 'axios';

const FaceRegisterModal = ({ onClose, onSuccess }) => {
    const webcamRef = useRef(null);
    const landmarkerRef = useRef(null);
    const canvasRef = useRef(null);
    
    const [status, setStatus] = useState('Đang khởi tạo AI...');
    const [challenge, setChallenge] = useState('look_left');
    const [isLivenessPassed, setIsLivenessPassed] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [isAiReady, setIsAiReady] = useState(false);
    
    const [currentScore, setCurrentScore] = useState(0);
    const [isThresholdMet, setIsThresholdMet] = useState(false);
    const [faceBox, setFaceBox] = useState(null);
    
    const challengeRef = useRef(challenge);
    useEffect(() => {
        challengeRef.current = challenge;
        setCurrentScore(0);
        setIsThresholdMet(false);
        console.log(`🔄 Challenge changed to: ${challenge}`);
    }, [challenge]);

    // Khởi tạo AI
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
                    setStatus('Vui lòng quay đầu sang TRÁI để bắt đầu');
                    console.log('✅ FaceLandmarker khởi tạo thành công');
                }
            } catch (err) {
                console.error("Lỗi AI:", err);
                setError("Không thể tải mô hình AI.");
            }
        };
        init();
        return () => { isMounted = false; };
    }, []);

    // Gửi ảnh lên server
    const handleRegister = useCallback(async () => {
        if (loading) return;
        setLoading(true);
        const imageSrc = webcamRef.current?.getScreenshot();
        if (!imageSrc) {
            setError("Không thể chụp ảnh.");
            setLoading(false);
            setStatus('Vui lòng thử lại');
            setIsLivenessPassed(false);
            setChallenge('look_left');
            return;
        }
        try {
            const authData = localStorage.getItem('auth');
            const token = authData ? JSON.parse(authData).token : null;
            const response = await axios.post(
                'http://localhost:5000/api/attendance/register-face',
                { image: imageSrc },
                {
                    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                    timeout: 15000
                }
            );
            if (response.data.success) {
                setStatus('✓ Cập nhật thành công!');
                setTimeout(() => onSuccess(), 1500);
            } else {
                throw new Error(response.data.message || 'Lỗi không xác định');
            }
        } catch (err) {
            console.error("Lỗi lưu mặt:", err.response?.data || err.message);
            setError(err.response?.data?.message || "Lỗi xác thực hoặc server. Vui lòng đăng nhập lại.");
            setLoading(false);
            setIsLivenessPassed(false);
            setChallenge('look_left');
            setStatus('Vui lòng quay đầu sang TRÁI để bắt đầu lại');
        }
    }, [loading, onSuccess]);

    // Vẽ khung + thanh tiến trình
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
            ctx.font = "16px Arial";
            ctx.fillStyle = met ? '#00ff00' : '#ff0000';
            ctx.fillText(`${Math.round(score * 100)}%`, box.x, box.y - 5);
        }
        
        const barWidth = canvas.width - 40;
        const barHeight = 20;
        const barX = 20;
        const barY = canvas.height - 40;
        ctx.fillStyle = '#333333';
        ctx.fillRect(barX, barY, barWidth, barHeight);
        const fillWidth = barWidth * Math.min(score, 1);
        ctx.fillStyle = met ? '#00ff00' : '#ffaa00';
        ctx.fillRect(barX, barY, fillWidth, barHeight);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.strokeRect(barX, barY, barWidth, barHeight);
        ctx.font = "14px Arial";
        ctx.fillStyle = '#ffffff';
        ctx.fillText(`Độ chính xác: ${Math.round(score * 100)}%`, barX, barY - 5);
    }, []);

    // Vòng lặp dự đoán
    useEffect(() => {
        if (!isAiReady || isLivenessPassed || loading) return;

        let animationId;
        let isActive = true;

        const predict = () => {
            if (!isActive) return;
            if (!webcamRef.current?.video || webcamRef.current.video.readyState !== 4) {
                animationId = requestAnimationFrame(predict);
                return;
            }

            const video = webcamRef.current.video;
            try {
                const result = landmarkerRef.current.detectForVideo(video, performance.now());
                if (result.faceBlendshapes && result.faceBlendshapes.length > 0 &&
                    result.faceLandmarks && result.faceLandmarks.length > 0) {
                    
                    const categories = result.faceBlendshapes[0].categories;
                    const getScore = (name) => categories.find(c => c.categoryName === name)?.score || 0;
                    const landmarks = result.faceLandmarks[0];
                    
                    // Bounding box
                    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                    for (const lm of landmarks) {
                        minX = Math.min(minX, lm.x);
                        minY = Math.min(minY, lm.y);
                        maxX = Math.max(maxX, lm.x);
                        maxY = Math.max(maxY, lm.y);
                    }
                    const box = {
                        x: minX * video.videoWidth,
                        y: minY * video.videoHeight,
                        width: (maxX - minX) * video.videoWidth,
                        height: (maxY - minY) * video.videoHeight
                    };
                    
                    let detected = false;
                    let currentScoreVal = 0;
                    const currentChallenge = challengeRef.current;
                    
                    if (currentChallenge === 'look_left') {
                        const left = getScore('eyeLookOutLeft');
                        const right = getScore('eyeLookInRight');
                        currentScoreVal = (left + right) / 2;
                        console.log(`👀 look_left: left=${left.toFixed(2)} right=${right.toFixed(2)} score=${currentScoreVal.toFixed(2)}`);
                        if (left > 0.3 && right > 0.3) detected = true;
                    } 
                    else if (currentChallenge === 'look_right') {
                        const right = getScore('eyeLookOutRight');
                        const left = getScore('eyeLookInLeft');
                        currentScoreVal = (right + left) / 2;
                        console.log(`👀 look_right: right=${right.toFixed(2)} left=${left.toFixed(2)} score=${currentScoreVal.toFixed(2)}`);
                        if (right > 0.3 && left > 0.3) detected = true;
                    } 
                    else if (currentChallenge === 'look_up') {
                        // Sử dụng chênh lệch mũi - mắt (sẽ dương khi ngước)
                        const nose = landmarks[1];
                        const leftEye = landmarks[33];
                        const rightEye = landmarks[263];
                        const eyeCenterY = (leftEye.y + rightEye.y) / 2;
                        const upScore = nose.y - eyeCenterY; // dương khi ngước
                        currentScoreVal = Math.min(1, Math.max(0, upScore / 0.02));
                        console.log(`👀 look_up: upScore=${upScore.toFixed(4)} score=${currentScoreVal.toFixed(2)}`);
                        if (upScore > 0.008) detected = true; // ngưỡng thấp
                    }
                    
                    setCurrentScore(currentScoreVal);
                    const met = detected || currentScoreVal > 0.7;
                    setIsThresholdMet(met);
                    setFaceBox(box);
                    drawOverlay(currentScoreVal, met, box);
                    
                    if (detected) {
                        if (currentChallenge === 'look_left') {
                            setChallenge('look_right');
                            setStatus('Tốt! Giờ hãy quay sang PHẢI');
                        } else if (currentChallenge === 'look_right') {
                            setChallenge('look_up');
                            setStatus('Tốt! Giờ hãy ngước mặt LÊN');
                        } else if (currentChallenge === 'look_up') {
  const downLeft = getScore('eyeLookDownLeft');
  const downRight = getScore('eyeLookDownRight');
  currentScoreVal = (downLeft + downRight) / 2;
  if (downLeft > 0.3 && downRight > 0.3) detected = true;
                        }
                    }
                } else {
                    setFaceBox(null);
                    drawOverlay(0, false, null);
                }
            } catch (err) {
                console.error('Lỗi detect:', err);
            }
            animationId = requestAnimationFrame(predict);
        };

        animationId = requestAnimationFrame(predict);
        return () => {
            isActive = false;
            if (animationId) cancelAnimationFrame(animationId);
        };
    }, [isAiReady, isLivenessPassed, loading, handleRegister, drawOverlay]);

    const getInstruction = () => {
        switch(challenge) {
            case 'look_left': return '👉 Quay mặt sang TRÁI, giữ cho đến khi khung xanh';
            case 'look_right': return '👈 Quay mặt sang PHẢI, giữ cho đến khi khung xanh';
            case 'look_up': return '🙂 Ngước mặt LÊN TRÊN, giữ cho đến khi khung xanh';
            default: return '';
        }
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
                        videoConstraints={{ width: 480, height: 360, facingMode: "user" }}
                        onUserMedia={() => console.log('📷 Webcam đã sẵn sàng')}
                        onUserMediaError={(err) => console.error('Webcam error:', err)}
                    />
                    <canvas ref={canvasRef} style={styles.canvas} />
                    {loading && <div style={styles.loader}><p>Đang xử lý...</p></div>}
                </div>
                <div style={styles.instruction}>
                    📌 {getInstruction()}
                </div>
                <div style={styles.footer}>
                    <button onClick={onClose} style={styles.btnCancel} disabled={loading}>Hủy bỏ</button>
                </div>
            </div>
        </div>
    );
};

const styles = {
    overlay: { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000 },
    container: { background: '#fff', padding: '25px', borderRadius: '20px', width: '500px', textAlign: 'center' },
    banner: { padding: '12px', color: '#fff', borderRadius: '10px', marginBottom: '15px', fontWeight: 'bold' },
    camBox: { position: 'relative', height: '360px', borderRadius: '15px', overflow: 'hidden', background: '#000' },
    webcam: { width: '100%', height: '100%', objectFit: 'cover' },
    canvas: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' },
    loader: { position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' },
    instruction: { margin: '12px 0', padding: '8px', backgroundColor: '#f0f0f0', borderRadius: '8px', fontSize: '14px', fontWeight: 'bold', color: '#333' },
    btnCancel: { padding: '10px 30px', cursor: 'pointer', borderRadius: '8px', background: '#f8f9fa', border: '1px solid #ddd' }
};

export default FaceRegisterModal;