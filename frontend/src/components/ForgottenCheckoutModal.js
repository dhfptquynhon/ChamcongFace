import React, { useContext, useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  List,
  ListItem,
  ListItemText,
  Chip,
  Button,
  Stack,
  Alert,
} from '@mui/material';
import { AccessTime as AccessTimeIcon, Logout as LogoutIcon } from '@mui/icons-material';
import AuthContext from '../context/AuthContext';
import axios from 'axios';

const SHIFT_LABELS = {
  ca1: 'Ca 1: 7:00 – 9:30',
  ca2: 'Ca 2: 9:30 – 12:30',
  ca3: 'Ca 3: 12:30 – 15:00',
  ca4: 'Ca 4: 15:00 – 17:30',
};
const SHIFT_END = { ca1: '09:30', ca2: '12:30', ca3: '15:00', ca4: '17:30' };

// Ca đã check-in nhưng có vẻ quên check-out: ca của ngày trước, hoặc ca hôm nay đã quá giờ kết thúc.
const isOverdue = (shift) => {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const shiftDate = shift.ngay ? String(shift.ngay).split('T')[0] : todayStr;
  if (shiftDate < todayStr) return true;
  if (shiftDate === todayStr) {
    const currentTime = now.toTimeString().slice(0, 5);
    return currentTime > (SHIFT_END[shift.ca] || '23:59');
  }
  return false;
};

// Hiện ngay sau khi đăng nhập: quét cả tháng hiện tại xem có ca nào đã check-in nhưng quên
// check-out không. Chỉ biến mất khi ca đó đã check-out xong (trực tiếp, hoặc gửi yêu cầu và
// được admin duyệt), hoặc người dùng chọn "Không cần checkout".
const ForgottenCheckoutModal = () => {
  const { auth } = useContext(AuthContext);
  const navigate = useNavigate();
  const [shifts, setShifts] = useState([]);
  const [open, setOpen] = useState(false);
  const [actingId, setActingId] = useState(null);

  const fetchOverdueShifts = useCallback(async () => {
    if (!auth?.token) return;
    const now = new Date();
    try {
      const res = await axios.get(
        `/api/attendance/my/checked-in-shifts?month=${now.getMonth() + 1}&year=${now.getFullYear()}`,
        { headers: { Authorization: `Bearer ${auth.token}` } }
      );
      const overdue = (res.data || []).filter(isOverdue);
      setShifts(overdue);
      if (overdue.length > 0) setOpen(true);
    } catch (err) {
      console.error('Lỗi tải danh sách ca quên check-out:', err);
    }
  }, [auth?.token]);

  useEffect(() => {
    fetchOverdueShifts();
  }, [fetchOverdueShifts]);

  const handleGoToCheckout = (shift) => {
    setOpen(false);
    navigate('/attendance', { state: { focusDate: shift.ngay } });
  };

  const handleUndoCheckin = async (shift) => {
    if (!window.confirm('Xác nhận bạn KHÔNG đi làm ca này? Ca sẽ quay lại trạng thái chưa check-in.')) return;
    setActingId(shift.id);
    try {
      const url = shift.is_truc_thay
        ? `/api/attendance/truc-thay/undo-checkin/${shift.lich_truc_ao_id || shift.id}`
        : `/api/attendance/schedule/${shift.id}/undo-checkin`;
      await axios.post(url, {}, { headers: { Authorization: `Bearer ${auth.token}` } });
      setShifts((prev) => {
        const next = prev.filter((s) => s.id !== shift.id);
        if (next.length === 0) setOpen(false);
        return next;
      });
    } catch (err) {
      alert(err.response?.data?.message || 'Hủy check-in thất bại');
    } finally {
      setActingId(null);
    }
  };

  if (shifts.length === 0) return null;

  return (
    <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AccessTimeIcon color="warning" />
          <Typography variant="h6">Bạn có ca quên check-out</Typography>
        </Box>
      </DialogTitle>
      <DialogContent>
        <Alert severity="warning" sx={{ mb: 2 }}>
          Bạn đã check-in {shifts.length} ca trong tháng này nhưng chưa check-out. Vui lòng check-out,
          hoặc chọn "Không cần checkout" nếu bạn không đi làm ca đó.
        </Alert>
        <List>
          {shifts.map((shift) => (
            <ListItem
              key={shift.id}
              sx={{ border: '1px solid #ffe0b2', borderRadius: 1, mb: 1, backgroundColor: '#fff8ef' }}
              secondaryAction={null}
            >
              <ListItemText
                primary={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                    <Typography variant="subtitle2" fontWeight="bold">
                      {SHIFT_LABELS[shift.ca] || shift.ca} - {shift.ngay ? new Date(shift.ngay).toLocaleDateString('vi-VN') : ''}
                    </Typography>
                    {shift.is_truc_thay && (
                      <Chip label="Ca trực thay" size="small" sx={{ height: 18, fontSize: '0.65rem', bgcolor: '#ff9800', color: 'white' }} />
                    )}
                  </Box>
                }
                secondary={`Giờ vào: ${shift.gio_vao ? shift.gio_vao.slice(0, 5) : '--:--'}`}
              />
              <Stack direction="row" spacing={1} sx={{ ml: 2 }}>
                <Button
                  size="small"
                  variant="contained"
                  color="secondary"
                  startIcon={<LogoutIcon />}
                  disabled={actingId === shift.id}
                  onClick={() => handleGoToCheckout(shift)}
                >
                  Check-out
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  color="error"
                  disabled={actingId === shift.id}
                  onClick={() => handleUndoCheckin(shift)}
                >
                  Không cần checkout
                </Button>
              </Stack>
            </ListItem>
          ))}
        </List>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setOpen(false)} color="inherit">
          Đóng
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ForgottenCheckoutModal;
