import React, { useState, useContext, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  CircularProgress,
  Alert,
  Chip,
  Stack,
  Divider,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Grid,
} from '@mui/material';
import {
  AccessTime as AccessTimeIcon,
  Refresh as RefreshIcon,
  Login as LoginIcon,
  Logout as LogoutIcon,
  People as PeopleIcon,
  Warning as WarningIcon
} from '@mui/icons-material';
import AuthContext from '../context/AuthContext';
import axios from 'axios';

const SHIFT_LABELS = {
  ca1: 'Ca 1: 7:00 – 9:30',
  ca2: 'Ca 2: 9:30 – 12:30',
  ca3: 'Ca 3: 12:30 – 15:00',
  ca4: 'Ca 4: 15:00 – 17:30',
};

const STATUS_CONFIG = {
  registered: { label: 'Đã đăng ký', color: 'default' },
  checked_in: { label: 'Đang làm', color: 'warning' },
  checked_out: { label: 'Hoàn thành', color: 'success' },
};

const formatTime = (t) => {
  if (!t) return '';
  if (typeof t === 'string') return t.slice(0, 5);
  return t;
};

const Attendance = ({ onChanged }) => {
  const { auth } = useContext(AuthContext);
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingActionId, setLoadingActionId] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // State cho dialog yêu cầu điều chỉnh giờ
  const [timeAdjustmentDialog, setTimeAdjustmentDialog] = useState({
    open: false,
    shift: null,
    loaiYeuCau: 'checkout',
    thoiGianDeXuat: '',
    lyDo: '',
    shiftEnd: ''
  });

  const today = useMemo(() => new Date(), []);
  const todayStr = today.toISOString().split('T')[0];

  const fetchTodayShifts = async () => {
    if (!auth?.token) return;
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const res = await axios.get(
        `http://localhost:5000/api/attendance/my/today-shifts?date=${todayStr}`,
        { headers: { Authorization: `Bearer ${auth.token}` } }
      );
      // Sắp xếp theo thứ tự ca
      const order = { ca1: 1, ca2: 2, ca3: 3, ca4: 4 };
      const sorted = (res.data || []).sort(
        (a, b) => (order[a.ca] || 0) - (order[b.ca] || 0)
      );
      setShifts(sorted);
    } catch (err) {
      setError(err.response?.data?.message || 'Không tải được danh sách ca hôm nay');
      setShifts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTodayShifts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth?.token]);

  // Hàm mở dialog yêu cầu điều chỉnh giờ
  const handleOpenTimeAdjustmentDialog = (shift, loaiYeuCau, shiftEnd) => {
    const now = new Date();
    const currentTime = now.toTimeString().slice(0, 5);
    
    setTimeAdjustmentDialog({
      open: true,
      shift: shift,
      loaiYeuCau: loaiYeuCau,
      thoiGianDeXuat: currentTime,
      lyDo: '',
      shiftEnd: shiftEnd
    });
  };

  // Hàm gửi yêu cầu điều chỉnh giờ
  const handleSendTimeAdjustmentRequest = async () => {
    const { shift, loaiYeuCau, thoiGianDeXuat, lyDo } = timeAdjustmentDialog;

    if (!shift) {
      setError('Không có thông tin ca');
      return;
    }

    setLoadingActionId(shift.id);
    setError('');
    setMessage('');

    try {
      const res = await axios.post(
        `http://localhost:5000/api/attendance/schedule/${shift.id}/request-time-adjustment`,
        {
          loai_yeu_cau: loaiYeuCau,
          thoi_gian_de_xuat: thoiGianDeXuat,
          ly_do: lyDo || 'Không có lý do'
        },
        { headers: { Authorization: `Bearer ${auth.token}` } }
      );
      
      if (res.data.success) {
        setMessage(res.data.message);
        
        // Đóng dialog
        setTimeAdjustmentDialog({
          open: false,
          shift: null,
          loaiYeuCau: 'checkout',
          thoiGianDeXuat: '',
          lyDo: '',
          shiftEnd: ''
        });
        
        // Refresh dữ liệu
        await fetchTodayShifts();
        if (onChanged) onChanged();
      } else {
        setError(res.data.message || 'Gửi yêu cầu thất bại');
      }
      
    } catch (err) {
      console.error('Lỗi gửi yêu cầu:', err);
      setError(err.response?.data?.message || 'Gửi yêu cầu thất bại');
    } finally {
      setLoadingActionId(null);
    }
  };

  const handleCheckIn = async (shift) => {
    if (!auth?.token || !shift) return;
    setLoadingActionId(shift.id);
    setMessage('');
    setError('');
    try {
      const res = await axios.post(
        `http://localhost:5000/api/attendance/schedule/${shift.id}/checkin`,
        {},
        { headers: { Authorization: `Bearer ${auth.token}` } }
      );
      setMessage(res.data?.message || 'Check-in thành công');
      setShifts((prev) =>
        prev.map((s) =>
          s.id === shift.id
            ? { ...s, trang_thai: 'checked_in', gio_vao: res.data?.time || s.gio_vao }
            : s
        )
      );
      if (onChanged) onChanged();
    } catch (err) {
      // Kiểm tra xem có phải lỗi quá giờ và có thể gửi yêu cầu không
      if (err.response?.status === 400 && err.response?.data?.canRequestAdjustment) {
        handleOpenTimeAdjustmentDialog(
          shift, 
          err.response.data.loai_yeu_cau || 'checkin',
          err.response.data.shiftEnd
        );
      } else {
        setError(err.response?.data?.message || 'Check-in thất bại');
      }
    } finally {
      setLoadingActionId(null);
    }
  };

  const handleCheckOut = async (shift) => {
    if (!auth?.token || !shift) return;
    setLoadingActionId(shift.id);
    setMessage('');
    setError('');
    try {
      const res = await axios.post(
        `http://localhost:5000/api/attendance/schedule/${shift.id}/checkout`,
        {},
        { headers: { Authorization: `Bearer ${auth.token}` } }
      );
      setMessage(res.data?.message || 'Check-out thành công');
      setShifts((prev) =>
        prev.map((s) =>
          s.id === shift.id
            ? {
                ...s,
                trang_thai: 'checked_out',
                gio_ra: res.data?.time || s.gio_ra,
                thoi_gian_lam: res.data?.workDuration ?? s.thoi_gian_lam,
              }
            : s
        )
      );
      if (onChanged) onChanged();
    } catch (err) {
      // Kiểm tra xem có phải lỗi quá giờ và có thể gửi yêu cầu không
      if (err.response?.status === 400 && err.response?.data?.canRequestAdjustment) {
        handleOpenTimeAdjustmentDialog(
          shift, 
          err.response.data.loai_yeu_cau || 'checkout',
          err.response.data.shiftEnd
        );
      } else {
        setError(err.response?.data?.message || 'Check-out thất bại');
      }
    } finally {
      setLoadingActionId(null);
    }
  };

  const renderParticipants = (shift) => {
    if (!shift.participants || shift.participants.length === 0) {
      return <Typography variant="body2">Chưa có ai khác</Typography>;
    }
    const others = shift.participants.filter((p) => !p.is_me);
    if (others.length === 0) {
      return <Typography variant="body2">Chỉ có bạn</Typography>;
    }
    const maxDisplay = 3;
    const displayNames = others.slice(0, maxDisplay).map(p => p.ten_nhan_vien).join(', ');
    const remaining = others.length - maxDisplay;
    
    return (
      <Tooltip title={others.map(p => p.ten_nhan_vien).join(', ')}>
        <Typography variant="body2" sx={{ cursor: 'help' }}>
          {displayNames}
          {remaining > 0 && ` +${remaining}`}
        </Typography>
      </Tooltip>
    );
  };

  const formattedToday = `${today.getDate()}/${today.getMonth() + 1}/${today.getFullYear()}`;

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight={600}>
            Ca hôm nay của bạn:
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Ngày: {formattedToday}
          </Typography>
        </Box>
        <Button
          variant="outlined"
          size="small"
          startIcon={<RefreshIcon />}
          onClick={fetchTodayShifts}
          disabled={loading}
        >
          Làm mới
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      {message && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setMessage('')}>
          {message}
        </Alert>
      )}

      {loading && shifts.length === 0 ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <CircularProgress />
        </Box>
      ) : shifts.length === 0 ? (
        <Paper sx={{ p: 3 }}>
          <Typography variant="body1" gutterBottom>
            Hôm nay bạn chưa đăng ký ca nào.
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Vào tab <strong>Đăng ký trực trước</strong> để đăng ký ca trong tháng, sau đó quay lại
            đây để check-in / check-out nhanh.
          </Typography>
        </Paper>
      ) : (
        <Grid container spacing={2}>
          {shifts.map((shift) => {
            const statusCfg = STATUS_CONFIG[shift.trang_thai] || STATUS_CONFIG.registered;
            const disabled = loadingActionId === shift.id || shift.trang_thai === 'checked_out';

            return (
              <Grid item xs={12} sm={6} md={4} key={shift.id}>
                <Paper 
                  sx={{ 
                    p: 2, 
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    transition: 'all 0.3s',
                    '&:hover': {
                      boxShadow: 3,
                      transform: 'translateY(-2px)'
                    }
                  }}
                >
                  {/* Header */}
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                    <Typography variant="subtitle1" fontWeight={600} sx={{ lineHeight: 1.2 }}>
                      {SHIFT_LABELS[shift.ca] || shift.ca}
                    </Typography>
                    <Chip
                      label={statusCfg.label}
                      color={statusCfg.color}
                      size="small"
                      icon={<AccessTimeIcon fontSize="small" />}
                      sx={{ ml: 1 }}
                    />
                  </Box>

                  <Divider sx={{ my: 1 }} />

                  {/* Nội dung */}
                  <Stack spacing={1} sx={{ flexGrow: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" color="text.secondary">Giờ vào:</Typography>
                      <Typography variant="body2" fontWeight={500}>
                        {formatTime(shift.gio_vao) || '--:--'}
                      </Typography>
                    </Box>
                    
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" color="text.secondary">Giờ ra:</Typography>
                      <Typography variant="body2" fontWeight={500}>
                        {formatTime(shift.gio_ra) || '--:--'}
                      </Typography>
                    </Box>
                    
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" color="text.secondary">Thời gian làm:</Typography>
                      <Typography variant="body2" fontWeight={500}>
                        {shift.thoi_gian_lam != null ? `${Number(shift.thoi_gian_lam).toFixed(2)}h` : '—'}
                      </Typography>
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                      <PeopleIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                      <Typography variant="body2" color="text.secondary" sx={{ mr: 0.5 }}>
                        Cùng ca:
                      </Typography>
                      {renderParticipants(shift)}
                    </Box>
                  </Stack>

                  {/* Footer */}
                  <Box sx={{ display: 'flex', gap: 1, mt: 2, justifyContent: 'flex-end' }}>
                    <Tooltip title="Check-in">
                      <span>
                        <Button
                          variant="contained"
                          color="primary"
                          size="small"
                          startIcon={<LoginIcon />}
                          disabled={disabled || shift.trang_thai !== 'registered'}
                          onClick={() => handleCheckIn(shift)}
                          sx={{ minWidth: 90 }}
                        >
                          {loadingActionId === shift.id && shift.trang_thai === 'registered' ? (
                            <CircularProgress size={18} />
                          ) : (
                            'Check-in'
                          )}
                        </Button>
                      </span>
                    </Tooltip>

                    <Tooltip title="Check-out">
                      <span>
                        <Button
                          variant="contained"
                          color="secondary"
                          size="small"
                          startIcon={<LogoutIcon />}
                          disabled={disabled || shift.trang_thai !== 'checked_in'}
                          onClick={() => handleCheckOut(shift)}
                          sx={{ minWidth: 90 }}
                        >
                          {loadingActionId === shift.id && shift.trang_thai === 'checked_in' ? (
                            <CircularProgress size={18} />
                          ) : (
                            'Check-out'
                          )}
                        </Button>
                      </span>
                    </Tooltip>
                  </Box>
                </Paper>
              </Grid>
            );
          })}
        </Grid>
      )}

      {/* Dialog yêu cầu điều chỉnh giờ */}
      <Dialog 
        open={timeAdjustmentDialog.open} 
        onClose={() => setTimeAdjustmentDialog({ open: false, shift: null, loaiYeuCau: 'checkout', thoiGianDeXuat: '', lyDo: '', shiftEnd: '' })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <WarningIcon color="warning" />
            <Typography variant="h6">
              {timeAdjustmentDialog.loaiYeuCau === 'checkin' ? 'Yêu cầu điều chỉnh giờ check-in' : 'Yêu cầu điều chỉnh giờ check-out'}
            </Typography>
          </Box>
        </DialogTitle>
        
        <DialogContent>
          {timeAdjustmentDialog.shift && (
            <>
              <Paper sx={{ p: 2, mb: 2, backgroundColor: '#fff3e0' }}>
                <Typography variant="body2" fontWeight="bold" gutterBottom>
                  Thông tin ca làm việc:
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="body2">
                      <strong>Ngày:</strong> {new Date(timeAdjustmentDialog.shift.ngay).toLocaleDateString('vi-VN')}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Ca:</strong> {SHIFT_LABELS[timeAdjustmentDialog.shift.ca] || timeAdjustmentDialog.shift.ca}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2">
                      <strong>Giờ vào:</strong> {timeAdjustmentDialog.shift.gio_vao ? formatTime(timeAdjustmentDialog.shift.gio_vao) : '--:--'}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Giờ kết thúc ca:</strong> {timeAdjustmentDialog.shiftEnd}
                    </Typography>
                  </Grid>
                </Grid>
              </Paper>
              
              <Alert severity="warning" sx={{ mb: 2 }}>
                <strong>LƯU Ý:</strong> Bạn đã quá thời gian cho phép 
                {timeAdjustmentDialog.loaiYeuCau === 'checkin' ? ' check-in' : ' check-out'}. 
                Vui lòng nhập thời gian thực tế và lý do để gửi yêu cầu lên admin duyệt.
              </Alert>
              
              <TextField
                fullWidth
                label={timeAdjustmentDialog.loaiYeuCau === 'checkin' ? 'Thời gian check-in thực tế' : 'Thời gian check-out thực tế'}
                type="time"
                value={timeAdjustmentDialog.thoiGianDeXuat}
                onChange={(e) => setTimeAdjustmentDialog(prev => ({ ...prev, thoiGianDeXuat: e.target.value }))}
                InputLabelProps={{ shrink: true }}
                sx={{ mb: 2 }}
              />
              
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Lý do"
                value={timeAdjustmentDialog.lyDo}
                onChange={(e) => setTimeAdjustmentDialog(prev => ({ ...prev, lyDo: e.target.value }))}
                placeholder="Ví dụ: Quên check-in, sự cố kỹ thuật, làm thêm giờ..."
                sx={{ mb: 2 }}
              />
            </>
          )}
        </DialogContent>
        
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button 
            onClick={() => setTimeAdjustmentDialog({ open: false, shift: null, loaiYeuCau: 'checkout', thoiGianDeXuat: '', lyDo: '', shiftEnd: '' })} 
            color="inherit"
          >
            Hủy
          </Button>
          <Button 
            variant="contained" 
            color="warning"
            onClick={handleSendTimeAdjustmentRequest}
            disabled={loadingActionId || !timeAdjustmentDialog.thoiGianDeXuat}
            startIcon={<WarningIcon />}
          >
            Gửi yêu cầu
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Attendance;