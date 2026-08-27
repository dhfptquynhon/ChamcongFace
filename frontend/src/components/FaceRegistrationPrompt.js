// src/components/FaceRegistrationPrompt.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';

const dismissKey = (maNhanVien) => `faceRegPromptDismissed_${maNhanVien}`;

const FaceRegistrationPrompt = ({ auth, onClose, onGoToProfile }) => {
  const [checked, setChecked] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [dontAskAgain, setDontAskAgain] = useState(false);

  useEffect(() => {
    const check = async () => {
      try {
        const token = auth.token;
        const response = await axios.get('/api/attendance/check-face-registered', {
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

  let dismissed = false;
  try {
    dismissed = localStorage.getItem(dismissKey(auth?.employee?.ma_nhan_vien)) === '1';
  } catch (e) {
    // localStorage có thể bị chặn (chế độ ẩn danh...) - bỏ qua, cứ hiện thông báo bình thường
  }
  if (dismissed) return null;

  const handleGoRegister = () => {
    if (onGoToProfile) onGoToProfile();
    onClose();
  };

  const handleLater = () => {
    if (dontAskAgain) {
      try {
        localStorage.setItem(dismissKey(auth?.employee?.ma_nhan_vien), '1');
      } catch (e) {
        // bỏ qua nếu không lưu được
      }
    }
    onClose();
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <h3>📢 Thông báo</h3>
        <p>Bạn chưa đăng ký khuôn mặt. Vui lòng đăng ký để sử dụng tính năng đăng nhập bằng khuôn mặt sau này.</p>
        <label style={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={dontAskAgain}
            onChange={(e) => setDontAskAgain(e.target.checked)}
          />
          Không muốn đăng ký, không hiển thị lại thông báo này
        </label>
        <div style={styles.buttons}>
          <button style={styles.btnPrimary} onClick={handleGoRegister}>Đăng ký ngay</button>
          <button style={styles.btnSecondary} onClick={handleLater}>Để sau</button>
        </div>
      </div>
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
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
    fontSize: 13,
    color: '#555',
    cursor: 'pointer'
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