import React, { useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Box,
  Chip,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Logout as LogoutIcon,
  AdminPanelSettings as AdminIcon,
  Brightness4 as DarkModeIcon,
  Brightness7 as LightModeIcon,
} from '@mui/icons-material';
import AuthContext from '../context/AuthContext';
import { ColorModeContext } from '../App';

const Navbar = () => {
  const navigate = useNavigate();
  const { auth, setAuth } = useContext(AuthContext);
  const { mode, toggleMode } = useContext(ColorModeContext);

  const handleLogout = () => {
    localStorage.removeItem('auth');
    setAuth(null);
    navigate('/login');
  };

  const name = auth?.employee?.ten_nhan_vien || '';
  const isAdmin = !!auth?.employee?.is_admin;

  return (
    <AppBar
      position="static"
      elevation={0}
      sx={{
        color: '#fff',
        background: 'linear-gradient(270deg, #4f46e5, #7c3aed, #0ea5e9, #4338ca)',
        backgroundSize: '400% 400%',
        animation: 'navbarGradientMove 14s ease infinite',
        '@keyframes navbarGradientMove': {
          '0%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
          '100%': { backgroundPosition: '0% 50%' },
        },
      }}
    >
      <Toolbar sx={{ minHeight: '56px !important', px: { xs: 1.5, sm: 3 } }}>
        <Box
          sx={{
            width: 34,
            height: 34,
            borderRadius: '10px',
            bgcolor: 'rgba(255,255,255,0.18)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mr: 1.25,
            fontSize: 18,
            flexShrink: 0,
          }}
        >
          🕒
        </Box>
        <Typography
          variant="h6"
          component="div"
          sx={{
            flexGrow: 1,
            fontSize: '1rem',
            fontWeight: 700,
            letterSpacing: 0.2,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          Hệ thống chấm công
        </Typography>

        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          {isAdmin && (
            <Chip
              size="small"
              icon={<AdminIcon sx={{ fontSize: '16px !important', color: '#fff !important' }} />}
              label="Quản trị"
              sx={{
                display: { xs: 'none', sm: 'flex' },
                bgcolor: 'rgba(255,255,255,0.16)',
                color: '#fff',
                fontWeight: 600,
              }}
            />
          )}

          <Tooltip title={mode === 'dark' ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}>
            <IconButton
              size="small"
              onClick={toggleMode}
              sx={{ color: '#fff' }}
            >
              {mode === 'dark' ? <LightModeIcon fontSize="small" /> : <DarkModeIcon fontSize="small" />}
            </IconButton>
          </Tooltip>

          {auth?.employee && (
            <Typography
              sx={{
                fontSize: '0.85rem',
                fontWeight: 500,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: { xs: 110, sm: 220 },
              }}
            >
              Xin chào, <strong>{name}</strong>
            </Typography>
          )}

          <Button
            onClick={handleLogout}
            variant="outlined"
            size="small"
            startIcon={<LogoutIcon fontSize="small" />}
            sx={{
              color: '#fff',
              borderColor: 'rgba(255,255,255,0.6)',
              flexShrink: 0,
              '&:hover': {
                borderColor: '#fff',
                bgcolor: 'rgba(255,255,255,0.14)',
              },
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
