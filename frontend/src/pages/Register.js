import React, { useState, useContext } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { TextField, Button, Container, Typography, Box, Paper, Alert } from '@mui/material';
import axios from 'axios';
import AuthContext from '../context/AuthContext';

const Register = () => {
  const [ma_nhan_vien, setMaNhanVien] = useState('');
  const [ten_nhan_vien, setTenNhanVien] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const { auth } = useContext(AuthContext);
  const navigate = useNavigate();

  // Kiểm tra quyền admin
  if (!auth) {
    return <Navigate to="/login" />;
  }
  if (!auth.employee?.is_admin) {
    return <Navigate to="/" />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(
        'http://localhost:5000/api/auth/register',
        { ma_nhan_vien, ten_nhan_vien, password },
        { headers: { Authorization: `Bearer ${auth.token}` } } // gửi token admin
      );
      setSuccess('Đăng ký thành công.');
      setError('');
      setMaNhanVien('');
      setTenNhanVien('');
      setPassword('');
    } catch (err) {
      setError(err.response?.data?.message || 'Đăng ký thất bại');
      setSuccess('');
    }
  };

  return (
    <Container maxWidth="sm">
      <Box sx={{ mt: 8, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <Paper elevation={3} sx={{ p: 4, width: '100%' }}>
          <Typography component="h1" variant="h5" align="center">
            Tạo tài khoản nhân viên (Admin)
          </Typography>
          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
          {success && (
            <Alert severity="success" sx={{ mt: 2 }}>
              {success}
            </Alert>
          )}
          <Box component="form" onSubmit={handleSubmit} sx={{ mt: 3 }}>
            <TextField
              margin="normal"
              required
              fullWidth
              label="Mã nhân viên"
              value={ma_nhan_vien}
              onChange={(e) => setMaNhanVien(e.target.value)}
            />
            <TextField
              margin="normal"
              required
              fullWidth
              label="Tên nhân viên"
              value={ten_nhan_vien}
              onChange={(e) => setTenNhanVien(e.target.value)}
            />
            <TextField
              margin="normal"
              required
              fullWidth
              label="Mật khẩu"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Button
              type="submit"
              fullWidth
              variant="contained"
              sx={{ mt: 3, mb: 2 }}
            >
              Tạo tài khoản
            </Button>
          </Box>
        </Paper>
      </Box>
    </Container>
  );
};

export default Register;