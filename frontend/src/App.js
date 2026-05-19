import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

// Pages
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import Dashboard from './pages/Dashboard';
import Attendance from './pages/Attendance';
import History from './pages/History';
import FaceLogin from './pages/FaceLogin';
import FaceRegister from './pages/FaceRegister';
import AdminHistory from './pages/AdminHistory';
import AdminDashboard from './pages/AdminDashboard';

// Components & Context
import Navbar from './components/Navbar';
import AuthContext from './context/AuthContext';

// Thiết kế Theme cho ứng dụng
const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
    background: {
      default: '#f4f6f8',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    fontSize: 14,
  },
});

function App() {
  // Khởi tạo trạng thái auth từ localStorage
  const [auth, setAuth] = useState(() => {
    try {
      const stored = localStorage.getItem('auth');
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      console.error("Lỗi đọc dữ liệu auth từ localStorage:", error);
      return null;
    }
  });

  // Theo dõi thay đổi của auth để cập nhật localStorage
  useEffect(() => {
    if (auth) {
      localStorage.setItem('auth', JSON.stringify(auth));
    } else {
      localStorage.removeItem('auth');
    }
  }, [auth]);

  return (
    <ThemeProvider theme={theme}>
      {/* CssBaseline giúp reset CSS mặc định của trình duyệt về chuẩn Material UI */}
      <CssBaseline />
      
      <AuthContext.Provider value={{ auth, setAuth }}>
        <Router>
          {/* Chỉ hiển thị Navbar khi người dùng đã đăng nhập */}
          {auth && <Navbar />}
          
          <Routes>
            {/* --- PUBLIC ROUTES (Chưa đăng nhập mới vào được) --- */}
            <Route 
              path="/login" 
              element={auth ? <Navigate to="/" /> : <Login />} 
            />
            <Route 
              path="/face-login" 
              element={auth ? <Navigate to="/" /> : <FaceLogin />} 
            />
            <Route 
              path="/register" 
              element={auth ? <Navigate to="/" /> : <Register />} 
            />
            <Route 
              path="/forgot-password" 
              element={auth ? <Navigate to="/" /> : <ForgotPassword />} 
            />

            {/* --- PRIVATE ROUTES (Phải đăng nhập mới vào được) --- */}
            <Route 
              path="/" 
              element={auth ? <Dashboard /> : <Navigate to="/login" />} 
            />
            
            {/* Route đăng ký khuôn mặt mà Dashboard sẽ điều hướng tới nếu face_registered = false */}
            <Route 
              path="/face-register" 
              element={auth ? <FaceRegister /> : <Navigate to="/login" />} 
            />
            
            <Route 
              path="/attendance" 
              element={auth ? <Attendance /> : <Navigate to="/login" />} 
            />
            
            <Route 
              path="/history" 
              element={auth ? <History /> : <Navigate to="/login" />} 
            />

            {/* --- ADMIN ROUTES --- */}
            <Route 
              path="/admin-history" 
              element={auth?.employee?.is_admin ? <AdminHistory /> : <Navigate to="/" />} 
            />
            
            <Route 
              path="/admin" 
              element={auth?.employee?.is_admin ? <AdminDashboard /> : <Navigate to="/" />} 
            />

            {/* Điều hướng mặc định: Nếu sai đường dẫn thì về trang chủ hoặc login */}
            <Route path="*" element={<Navigate to={auth ? "/" : "/login"} />} />
          </Routes>
        </Router>
      </AuthContext.Provider>
    </ThemeProvider>
  );
}

export default App;