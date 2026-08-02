import React, { useState, useEffect, useMemo, createContext } from 'react';
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

// Context bật/tắt giao diện sáng - tối, dùng chung cho toàn bộ app (vd: nút trên Navbar)
export const ColorModeContext = createContext({
  mode: 'light',
  toggleMode: () => {},
});

const LIGHT_BODY_BG = 'linear-gradient(135deg, #eef2ff 0%, #e0f2fe 45%, #f0fdf4 100%)';
const DARK_BODY_BG = 'linear-gradient(135deg, #0f172a 0%, #111827 45%, #1e1b4b 100%)';

// Thiết kế Theme cho ứng dụng — giao diện hiện đại, đồng bộ cho toàn bộ app
const buildTheme = (mode) => createTheme({
  palette: {
    mode,
    primary: {
      main: mode === 'dark' ? '#818cf8' : '#4f46e5',
      light: '#a5b4fc',
      dark: '#3730a3',
      contrastText: '#ffffff',
    },
    secondary: {
      main: mode === 'dark' ? '#38bdf8' : '#0ea5e9',
      light: '#7dd3fc',
      dark: '#0369a1',
    },
    success: {
      main: '#16a34a',
      light: '#86efac',
    },
    warning: {
      main: '#f59e0b',
      light: '#fde68a',
    },
    error: {
      main: '#e11d48',
    },
    info: {
      main: '#0ea5e9',
    },
    background: mode === 'dark'
      ? { default: '#0f172a', paper: '#1e293b' }
      : { default: '#f4f6fb', paper: '#ffffff' },
    text: mode === 'dark'
      ? { primary: '#f1f5f9', secondary: '#94a3b8' }
      : { primary: '#1e293b', secondary: '#64748b' },
    divider: mode === 'dark' ? 'rgba(148, 163, 184, 0.16)' : 'rgba(100, 116, 139, 0.16)',
  },
  shape: {
    borderRadius: 12,
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    fontSize: 14,
    h4: { fontWeight: 700 },
    h5: { fontWeight: 700 },
    h6: { fontWeight: 600 },
    button: { textTransform: 'none', fontWeight: 600 },
  },
  shadows: [
    'none',
    '0 1px 2px rgba(15, 23, 42, 0.06)',
    '0 1px 3px rgba(15, 23, 42, 0.08)',
    '0 2px 6px rgba(15, 23, 42, 0.08)',
    '0 4px 10px rgba(15, 23, 42, 0.08)',
    '0 6px 14px rgba(15, 23, 42, 0.09)',
    '0 8px 18px rgba(15, 23, 42, 0.10)',
    '0 10px 22px rgba(15, 23, 42, 0.10)',
    '0 12px 26px rgba(15, 23, 42, 0.11)',
    '0 14px 30px rgba(15, 23, 42, 0.11)',
    '0 16px 34px rgba(15, 23, 42, 0.12)',
    '0 16px 34px rgba(15, 23, 42, 0.12)',
    '0 16px 34px rgba(15, 23, 42, 0.12)',
    '0 16px 34px rgba(15, 23, 42, 0.12)',
    '0 16px 34px rgba(15, 23, 42, 0.12)',
    '0 16px 34px rgba(15, 23, 42, 0.12)',
    '0 16px 34px rgba(15, 23, 42, 0.12)',
    '0 16px 34px rgba(15, 23, 42, 0.12)',
    '0 16px 34px rgba(15, 23, 42, 0.12)',
    '0 16px 34px rgba(15, 23, 42, 0.12)',
    '0 16px 34px rgba(15, 23, 42, 0.12)',
    '0 16px 34px rgba(15, 23, 42, 0.12)',
    '0 16px 34px rgba(15, 23, 42, 0.12)',
    '0 16px 34px rgba(15, 23, 42, 0.12)',
    '0 16px 34px rgba(15, 23, 42, 0.12)',
  ],
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          scrollbarWidth: 'thin',
          background: mode === 'dark' ? DARK_BODY_BG : LIGHT_BODY_BG,
          backgroundAttachment: 'fixed',
          minHeight: '100vh',
        },
        '*::-webkit-scrollbar': {
          width: 8,
          height: 8,
        },
        '*::-webkit-scrollbar-thumb': {
          backgroundColor: 'rgba(100, 116, 139, 0.35)',
          borderRadius: 8,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          ...(mode === 'dark' && { border: '1px solid rgba(148, 163, 184, 0.12)' }),
        },
        rounded: {
          borderRadius: 14,
        },
        elevation1: {
          boxShadow: mode === 'dark'
            ? '0 1px 3px rgba(0, 0, 0, 0.3), 0 1px 2px rgba(0, 0, 0, 0.24)'
            : '0 1px 3px rgba(15, 23, 42, 0.06), 0 1px 2px rgba(15, 23, 42, 0.04)',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          boxShadow: mode === 'dark'
            ? '0 4px 16px rgba(0, 0, 0, 0.35)'
            : '0 4px 16px rgba(15, 23, 42, 0.06)',
          ...(mode === 'dark' && { border: '1px solid rgba(148, 163, 184, 0.12)' }),
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          textTransform: 'none',
          fontWeight: 600,
        },
        containedPrimary: {
          boxShadow: '0 4px 12px rgba(79, 70, 229, 0.28)',
          '&:hover': {
            boxShadow: '0 6px 16px rgba(79, 70, 229, 0.36)',
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          fontWeight: 600,
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          borderRadius: 10,
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderBottomColor: mode === 'dark' ? 'rgba(148, 163, 184, 0.16)' : 'rgba(100, 116, 139, 0.16)',
        },
        head: {
          fontWeight: 700,
          backgroundColor: mode === 'dark' ? '#243044' : '#f1f5f9',
          color: mode === 'dark' ? '#f1f5f9' : '#1e293b',
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          ...(mode === 'dark' && {
            '& .MuiOutlinedInput-notchedOutline': {
              borderColor: 'rgba(148, 163, 184, 0.3)',
            },
          }),
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 16,
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
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

  // Chế độ giao diện sáng/tối, ghi nhớ lựa chọn của người dùng
  const [mode, setMode] = useState(() => localStorage.getItem('themeMode') || 'light');

  useEffect(() => {
    localStorage.setItem('themeMode', mode);
  }, [mode]);

  const colorMode = useMemo(() => ({
    mode,
    toggleMode: () => setMode((prev) => (prev === 'light' ? 'dark' : 'light')),
  }), [mode]);

  const theme = useMemo(() => buildTheme(mode), [mode]);

  return (
    <ColorModeContext.Provider value={colorMode}>
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
    </ColorModeContext.Provider>
  );
}

export default App;