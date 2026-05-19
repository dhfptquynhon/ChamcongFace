import React, { useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import AuthContext from '../context/AuthContext';

const Login = () => {
  const [ma_nhan_vien, setMaNV] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { setAuth, auth } = useContext(AuthContext);
  const navigate = useNavigate();

  // State cho đèn và hiển thị login
  const [lampOn, setLampOn] = useState(false);
  const [showLogin, setShowLogin] = useState(false);

  // State cho hiệu ứng hover
  const [switchHover, setSwitchHover] = useState(false);
  const [buttonHover, setButtonHover] = useState(false);
  const [focusedInput, setFocusedInput] = useState(null);

  // State cho responsive
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const toggleLamp = () => {
    setLampOn(!lampOn);
    setShowLogin(!showLogin);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post('http://localhost:5000/api/auth/login', {
        ma_nhan_vien,
        password
      });

      // Log để kiểm tra cấu trúc response
      console.log('Login response:', response.data);

      // Lưu toàn bộ response vào localStorage và context
      localStorage.setItem('auth', JSON.stringify(response.data));
      setAuth(response.data);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Đăng nhập thất bại');
    }
  };

  // Styles điều chỉnh theo isMobile
  const styles = {
    container: {
      height: "100vh",
      display: "flex",
      flexDirection: isMobile ? "column" : "row",
      justifyContent: "center",
      alignItems: "center",
      background: "linear-gradient(135deg,#2b2b2b,#1c1c1c)",
      gap: isMobile ? "30px" : "80px",
      position: "relative",
      overflow: "hidden",
      padding: isMobile ? "20px" : "0"
    },
    lamp: {
      position: "relative",
      cursor: "pointer",
      transition: "transform 0.3s ease",
      transform: isMobile ? "scale(0.8)" : "scale(1)"
    },
    lampTop: {
      width: "180px",
      height: "90px",
      background: lampOn ? "#fff9e6" : "#fff",
      borderRadius: "90px 90px 0 0",
      transition: "background 0.3s, box-shadow 0.3s",
      boxShadow: lampOn ? "0 0 40px #ffc27a" : "none"
    },
    lampPole: {
      width: "10px",
      height: "160px",
      background: "#ddd",
      margin: "auto"
    },
    lampBase: {
      width: "140px",
      height: "15px",
      background: "#ddd",
      borderRadius: "10px",
      margin: "auto"
    },
    switch: {
      position: "absolute",
      right: "-5px", // sát thân đèn
      top: "110px",
      width: "20px",
      height: "20px",
      background: lampOn ? "#ffaa00" : "#ffc27a",
      borderRadius: "50%",
      cursor: "pointer",
      boxShadow: switchHover ? "0 0 15px #ffaa00" : "0 0 10px #ffc27a",
      transform: switchHover ? "scale(1.2)" : "scale(1)",
      transition: "box-shadow 0.3s, transform 0.2s, background 0.3s",
      zIndex: 10
    },
    loginBox: {
      width: isMobile ? "280px" : "340px",
      padding: isMobile ? "30px" : "40px",
      borderRadius: "30px",
      background: "rgba(255,255,255,0.1)",
      backdropFilter: "blur(10px)",
      display: "flex",
      flexDirection: "column",
      gap: "15px",
      opacity: showLogin ? 1 : 0,
      transform: showLogin ? "translateX(0)" : (isMobile ? "translateY(20px)" : "translateX(20px)"),
      transition: "opacity 0.5s ease, transform 0.5s ease",
      pointerEvents: showLogin ? "auto" : "none",
      border: "1px solid rgba(255,255,255,0.2)",
      boxShadow: "0 20px 40px rgba(0,0,0,0.3)"
    },
    input: {
      padding: "14px 18px",
      borderRadius: "40px",
      border: "none",
      outline: "none",
      fontSize: "16px",
      background: focusedInput ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.2)",
      color: "#fff",
      transition: "background 0.3s, box-shadow 0.3s",
      borderBottom: focusedInput ? "2px solid #ffc27a" : "2px solid transparent",
      width: "100%",
      marginBottom: focusedInput === 'ma' ? "15px" : "5px"
    },
    button: {
      padding: "14px",
      borderRadius: "40px",
      border: "none",
      background: "linear-gradient(45deg,#ffd87a,#f1b84c)",
      fontWeight: "bold",
      cursor: "pointer",
      fontSize: "16px",
      color: "#2b2b2b",
      transition: "transform 0.2s, box-shadow 0.2s",
      marginTop: "10px",
      transform: buttonHover ? "scale(1.02)" : "scale(1)",
      boxShadow: buttonHover ? "0 8px 20px rgba(255,200,100,0.5)" : "none"
    },
    error: {
      color: "#ff8a8a",
      textAlign: "center",
      marginBottom: "10px",
      fontSize: "14px"
    },
    adminLinks: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: "10px"
    },
    linkButton: {
      background: "none",
      border: "none",
      color: "#ffd87a",
      cursor: "pointer",
      fontSize: "14px",
      textDecoration: "underline",
      padding: "5px",
      transition: "color 0.2s"
    },
    text: {
      color: "#ddd",
      fontSize: "14px"
    },
    hint: {
      position: "absolute",
      top: isMobile ? "10px" : "30px", // đưa lên trên
      left: "50%",
      transform: "translateX(-50%)",
      color: "#aaa",
      fontSize: isMobile ? "12px" : "14px",
      background: "rgba(0,0,0,0.5)",
      padding: "8px 20px",
      borderRadius: "40px",
      backdropFilter: "blur(5px)",
      border: "1px solid rgba(255,255,255,0.1)",
      letterSpacing: "0.5px",
      whiteSpace: "nowrap"
    },
    title: {
      textAlign: "center",
      color: "#fff",
      marginBottom: "15px",
      fontWeight: "400",
      fontSize: isMobile ? "20px" : "24px",
      letterSpacing: "2px",
      textShadow: "0 2px 5px rgba(0,0,0,0.3)"
    }
  };

  return (
    <div style={styles.container}>
      {/* Hình cái đèn bên trái (hoặc trên nếu mobile) */}
      <div
        style={styles.lamp}
        onMouseEnter={() => setSwitchHover(true)}
        onMouseLeave={() => setSwitchHover(false)}
      >
        <div style={styles.lampTop} />
        <div style={styles.lampPole} />
        <div style={styles.lampBase} />
        <div
          style={styles.switch}
          onClick={toggleLamp}
          title={lampOn ? "Tắt đèn" : "Bật đèn"}
        />
      </div>

      {/* Khung đăng nhập bên phải (hoặc dưới nếu mobile) */}
      <div style={styles.loginBox}>
        <form onSubmit={handleSubmit} style={{ width: "100%" }}>
          <div style={styles.title}>ĐĂNG NHẬP</div>
          {error && <div style={styles.error}>{error}</div>}

          <input
            style={styles.input}
            type="text"
            placeholder="Mã nhân viên"
            value={ma_nhan_vien}
            onChange={(e) => setMaNV(e.target.value)}
            onFocus={() => setFocusedInput('ma')}
            onBlur={() => setFocusedInput(null)}
            required
          />

          <input
            style={styles.input}
            type="password"
            placeholder="Mật khẩu"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onFocus={() => setFocusedInput('password')}
            onBlur={() => setFocusedInput(null)}
            required
          />

          <button
            type="submit"
            style={styles.button}
            onMouseEnter={() => setButtonHover(true)}
            onMouseLeave={() => setButtonHover(false)}
          >
            Đăng nhập
          </button>

          <button
            type="button"
            style={{ ...styles.button, background: '#6D8CFF', marginTop: 10 }}
            onClick={() => navigate('/face-login')}
          >
            Đăng nhập bằng khuôn mặt
          </button>

          {/* Phần dành riêng cho admin (chỉ hiện khi đã đăng nhập với quyền admin) */}
          {auth?.employee?.is_admin && (
            <div style={styles.adminLinks}>
              <button
                style={styles.linkButton}
                onClick={() => navigate('/forgot-password')}
              >
                Quên mật khẩu?
              </button>
              <span style={styles.text}>
                Chưa có tài khoản?{' '}
                <button
                  style={styles.linkButton}
                  onClick={() => navigate('/register')}
                >
                  Đăng ký
                </button>
              </span>
            </div>
          )}
        </form>
      </div>

      {/* Hướng dẫn - chỉ hiện khi đèn tắt và chưa hiện login */}
      {!lampOn && !showLogin && (
        <div style={styles.hint}>
          💡 Nhấn vào công tắc đèn để bắt đầu
        </div>
      )}
    </div>
  );
};

export default Login;