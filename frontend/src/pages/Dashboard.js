import React, { useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthContext from '../context/AuthContext';
import AdminHistory from './AdminHistory';
import { Box, Typography, Paper, Grid, Tabs, Tab, Button } from '@mui/material';
import ScheduleBoard from '../components/ScheduleBoard';
import Attendance from './Attendance';
import AnalogClock from './AnalogClock';
import FaceRegistrationPrompt from '../components/FaceRegistrationPrompt';

const Dashboard = () => {
  const { auth, setAuth } = useContext(AuthContext);
  const navigate = useNavigate();
  const [tab, setTab] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showPrompt, setShowPrompt] = useState(true);

  // Log để debug
  useEffect(() => {
    console.log('Dashboard auth:', auth);
    console.log('face_registered:', auth?.employee?.face_registered);
  }, [auth]);

  // Admin → chỉ hiển thị trang quản lý lịch sử/thống kê
  if (auth?.employee?.is_admin) {
    return <AdminHistory />;
  }

  // Cập nhật trạng thái face_registered trong context sau khi đăng ký thành công
  const handleFaceRegistrationSuccess = () => {
    setAuth({
      ...auth,
      employee: {
        ...auth.employee,
        face_registered: true
      }
    });
    setShowPrompt(false);
  };

  return (
    <Box sx={{ p: 1.5 }}>
      {/* Prompt đăng ký khuôn mặt - chỉ hiện nếu chưa đăng ký và chưa đóng */}
      {showPrompt && auth && !auth.employee?.face_registered && (
        <FaceRegistrationPrompt 
          auth={auth} 
          onClose={() => setShowPrompt(false)}
          onSuccess={handleFaceRegistrationSuccess}
        />
      )}

      {/* ===== TABS ===== */}
      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        sx={{
          mb: 1,
          minHeight: 32,
          '& .MuiTabs-indicator': {
            height: 2,
          },
        }}
      >
        <Tab
          label="Hôm nay"
          sx={{
            minHeight: 32,
            padding: '6px 10px',
            fontSize: 13,
            fontWeight: 500,
            textTransform: 'none',
          }}
        />
        <Tab
          label="Đăng ký trực trước"
          sx={{
            minHeight: 32,
            padding: '6px 10px',
            fontSize: 13,
            fontWeight: 500,
            textTransform: 'none',
          }}
        />
        <Tab
          label="Thông tin cá nhân"
          sx={{
            minHeight: 32,
            padding: '6px 10px',
            fontSize: 13,
            fontWeight: 500,
            textTransform: 'none',
          }}
        />
      </Tabs>

      {/* ===== TAB 0: HÔM NAY (CHECKIN/CHECKOUT NHANH) ===== */}
      {tab === 0 && (
        <Box sx={{ mt: 0.5 }}>
          <Attendance onChanged={() => setRefreshKey((k) => k + 1)} />
        </Box>
      )}

      {/* ===== TAB 1: LỊCH TRỰC THÁNG ===== */}
      {tab === 1 && (
        <Box sx={{ mt: 0.5 }}>
          <ScheduleBoard refreshToken={refreshKey} />
        </Box>
      )}

      {/* ===== TAB 2: THÔNG TIN CÁ NHÂN ===== */}
      {tab === 2 && (
        <Grid container spacing={1.5}>
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 1.5 }}>
              <Typography
                sx={{
                  fontSize: 14,
                  fontWeight: 600,
                  mb: 0.5,
                }}
              >
                Thông tin nhân viên
              </Typography>

              <Typography sx={{ fontSize: 13 }}>
                Mã nhân viên: {auth?.employee?.ma_nhan_vien}
              </Typography>
              <Typography sx={{ fontSize: 13 }}>
                Tên nhân viên: {auth?.employee?.ten_nhan_vien}
              </Typography>
              
              <Box sx={{ mt: 2 }}>
                <Typography sx={{ fontSize: 13, color: auth?.employee?.face_registered ? 'green' : 'red', fontWeight: 500 }}>
                   Trạng thái khuôn mặt: {auth?.employee?.face_registered ? '✅ Đã đăng ký' : '❌ Chưa đăng ký'}
                </Typography>
                {!auth?.employee?.face_registered && (
                   <Button 
                    variant="outlined" 
                    size="small" 
                    sx={{ mt: 1, textTransform: 'none' }}
                    onClick={() => navigate('/face-register')}
                   >
                    Đăng ký ngay
                   </Button>
                )}
              </Box>
            </Paper>
          </Grid>

          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 1.5 }}>
              <Typography
                sx={{
                  fontSize: 14,
                  fontWeight: 600,
                  mb: 0.5,
                }}
              >
                Hướng dẫn sử dụng
              </Typography>

              <Typography sx={{ fontSize: 13 }}>
                - Click ô trống để đăng ký ca
              </Typography>
              <Typography sx={{ fontSize: 13 }}>
                - Chuột phải ô của bạn để check-in / check-out
              </Typography>
              <Typography sx={{ fontSize: 13 }}>
                - Xanh lá: đã đăng ký · Vàng: đang làm · Xanh dương: hoàn thành
              </Typography>
            </Paper>
          </Grid>
        </Grid>
      )}
      <AnalogClock />
    </Box>
  );
};

export default Dashboard;