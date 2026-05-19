import React, { useState, useContext } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { TextField, Button, Container, Typography, Box, Paper, Alert } from '@mui/material';
import axios from 'axios';
import AuthContext from '../context/AuthContext';

const ForgotPassword = () => {
  const [ma_nhan_vien, setMaNhanVien] = useState('');
  const [new_password, setNewPassword] = useState('');
  const [confirm_password, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const { auth } = useContext(AuthContext);
  const navigate = useNavigate();

  // Chỉ admin mới được vào
  if (!auth) {
    return <Navigate to="/login" />;
  }
  if (!auth.employee?.is_admin) {
    return <Navigate to="/" />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (new_password !== confirm_password) {
      setError('Mật khẩu mới và xác nhận không khớp');
      return;
    }
    if (new_password.length < 6) {
      setError('Mật khẩu mới phải có ít nhất 6 ký tự');
      return;
    }

    try {
      await axios.post(
        'http://localhost:5000/api/attendance/admin/reset-password',
        { ma_nhan_vien, new_password },
        { headers: { Authorization: `Bearer ${auth.token}` } }
      );
      setSuccess('Đặt lại mật khẩu thành công!');
      setMaNhanVien('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err.response?.data?.message || 'Đặt lại mật khẩu thất bại');
    }
  };

  return (
    <Container maxWidth="sm">
      <Box sx={{ mt: 8, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <Paper elevation={3} sx={{ p: 4, width: '100%' }}>
          <Typography component="h1" variant="h5" align="center">
            Admin: Đặt lại mật khẩu cho nhân viên
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
              label="Mã nhân viên cần reset"
              value={ma_nhan_vien}
              onChange={(e) => setMaNhanVien(e.target.value)}
            />
            <TextField
              margin="normal"
              required
              fullWidth
              label="Mật khẩu mới"
              type="password"
              value={new_password}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <TextField
              margin="normal"
              required
              fullWidth
              label="Xác nhận mật khẩu mới"
              type="password"
              value={confirm_password}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
            <Button
              type="submit"
              fullWidth
              variant="contained"
              sx={{ mt: 3, mb: 2 }}
            >
              Đặt lại mật khẩu
            </Button>
          </Box>
        </Paper>
      </Box>
    </Container>
  );
};

export default ForgotPassword;