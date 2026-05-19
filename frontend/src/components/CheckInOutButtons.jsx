import React, { useState, useContext } from 'react';
import { Button, Box, Alert, Snackbar } from '@mui/material';
import { CheckCircle, Logout } from '@mui/icons-material';
import AuthContext from '../context/AuthContext';
import axios from 'axios';

const CheckInOutButtons = () => {
  const { auth } = useContext(AuthContext);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [severity, setSeverity] = useState('success');

  const handleCheckIn = async () => {
    setLoading(true);
    try {
      const response = await axios.post(
        'http://localhost:5000/api/attendance/checkin',
        {},
        {
          headers: {
            Authorization: `Bearer ${auth.token}`
          }
        }
      );
      
      setMessage(response.data.message || 'Check-in thành công');
      setSeverity('success');
    } catch (error) {
      setMessage(error.response?.data?.message || 'Lỗi check-in');
      setSeverity('error');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckOut = async () => {
    setLoading(true);
    try {
      const response = await axios.post(
        'http://localhost:5000/api/attendance/checkout',
        {},
        {
          headers: {
            Authorization: `Bearer ${auth.token}`
          }
        }
      );
      
      setMessage(response.data.message || 'Check-out thành công');
      setSeverity('success');
    } catch (error) {
      setMessage(error.response?.data?.message || 'Lỗi check-out');
      setSeverity('error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ mb: 3 }}>
      <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
        <Button
          variant="contained"
          color="primary"
          startIcon={<CheckCircle />}
          onClick={handleCheckIn}
          disabled={loading}
          fullWidth
        >
          CHECK-IN
        </Button>
        
        <Button
          variant="contained"
          color="secondary"
          startIcon={<Logout />}
          onClick={handleCheckOut}
          disabled={loading}
          fullWidth
        >
          CHECK-OUT
        </Button>
      </Box>

      <Snackbar
        open={!!message}
        autoHideDuration={6000}
        onClose={() => setMessage('')}
      >
        <Alert 
          onClose={() => setMessage('')} 
          severity={severity}
          sx={{ width: '100%' }}
        >
          {message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default CheckInOutButtons;