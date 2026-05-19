// src/components/FaceRegistrationPrompt.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import FaceRegisterModal from '../pages/FaceRegisterModal';

const FaceRegistrationPrompt = ({ auth, onClose, onSuccess }) => {
  const [showRegister, setShowRegister] = useState(false);
  const [checked, setChecked] = useState(false);
  const [registered, setRegistered] = useState(false);

  useEffect(() => {
    const check = async () => {
      try {
        const token = auth.token;
        const response = await axios.get('http://localhost:5000/api/attendance/check-face-registered', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (response.data.success) {
          setRegistered(response.data.registered);
        }
      } catch (err) {
        console.error('Lỗi kiểm tra đăng ký khuôn mặt:', err);
      } finally {
        setChecked(true);
      }
    };
    if (auth) check();
  }, [auth]);

  if (!checked) return null;
  if (registered) return null;

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <h3>📢 Thông báo</h3>
        <p>Bạn chưa đăng ký khuôn mặt. Vui lòng đăng ký để sử dụng tính năng đăng nhập bằng khuôn mặt sau này.</p>
        <div style={styles.buttons}>
          <button style={styles.btnPrimary} onClick={() => setShowRegister(true)}>Đăng ký ngay</button>
          <button style={styles.btnSecondary} onClick={onClose}>Để sau</button>
        </div>
      </div>
      {showRegister && (
        <FaceRegisterModal
          onClose={() => setShowRegister(false)}
          onSuccess={() => {
            setShowRegister(false);
            setRegistered(true);
            if (onSuccess) onSuccess();
            onClose();
          }}
        />
      )}
    </div>
  );
};

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2000
  },
  modal: {
    background: '#fff',
    padding: 24,
    borderRadius: 12,
    maxWidth: 400,
    textAlign: 'center',
    boxShadow: '0 10px 25px rgba(0,0,0,0.2)'
  },
  buttons: {
    display: 'flex',
    gap: 12,
    justifyContent: 'center',
    marginTop: 20
  },
  btnPrimary: {
    padding: '8px 16px',
    background: '#1976d2',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer'
  },
  btnSecondary: {
    padding: '8px 16px',
    background: '#f5f5f5',
    border: '1px solid #ccc',
    borderRadius: 6,
    cursor: 'pointer'
  }
};

export default FaceRegistrationPrompt;