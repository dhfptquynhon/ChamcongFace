import React, { useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Box
} from '@mui/material';
import AuthContext from '../context/AuthContext';

const Navbar = () => {
  const navigate = useNavigate();
  const { auth, setAuth } = useContext(AuthContext);

  const handleLogout = () => {
    localStorage.removeItem('auth');
    setAuth(null);
    navigate('/login');
  };

  return (
    <AppBar 
      position="static" 
      elevation={1}
      sx={{ 
        backgroundColor: 'white',
        color: 'text.primary',
        borderBottom: '1px solid #e0e0e0',
        minHeight: '48px'
      }}
    >
      <Toolbar sx={{ minHeight: '48px !important', padding: '0 16px !important' }}>
        <Typography 
          variant="h6" 
          component="div" 
          sx={{ 
            flexGrow: 1, 
            fontSize: '1rem',
            fontWeight: 600,
            color: 'primary.main'
          }}
        >
          📊 Hệ thống chấm công
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          {/* Hiển thị tên người đã login khi có auth */}
          {auth && auth.employee && (
            <Typography 
              sx={{ 
                fontSize: '0.85rem',
                mr: 1,
                color: 'text.secondary'
              }}
            >
              Xin chào: <strong style={{ color: 'primary.main' }}>{auth.employee.ten_nhan_vien}</strong>
            </Typography>
          )}
          
          {!auth?.employee?.is_admin && (
            <Button 
              color="inherit" 
              onClick={() => navigate('/history')}
              sx={{ 
                fontSize: '0.75rem',
                padding: '4px 8px',
                minWidth: 'auto',
                textTransform: 'none'
              }}
            >
              {/* Lịch sử */}
            </Button>
          )}
          <Button 
            color="error" 
            onClick={handleLogout}
            variant="outlined"
            size="small"
            sx={{ 
              fontSize: '0.75rem',
              padding: '4px 8px',
              minWidth: 'auto',
              textTransform: 'none'
            }}
          >
            Đăng xuất
          </Button>
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default Navbar;