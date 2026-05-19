import React, { useCallback, useEffect, useMemo, useState, useContext } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Alert,
  CircularProgress,
  Menu,
  MenuItem,
  Tooltip,
  Snackbar,
  IconButton,
  Chip,
  Avatar,
  AvatarGroup,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
} from '@mui/material';
import { 
  Close as CloseIcon, 
  Person as PersonIcon,
  AccessTime as AccessTimeIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon,
  People as PeopleIcon
} from '@mui/icons-material';
import axios from 'axios';
import AuthContext from '../context/AuthContext';

const SHIFTS = [
  { key: 'ca1', label: 'Ca 1: 7:00-9:30', start: '07:00', end: '09:30' },
  { key: 'ca2', label: 'Ca 2: 9:30-12:30', start: '09:30', end: '12:30' },
  { key: 'ca3', label: 'Ca 3: 12:30-15:00', start: '12:30', end: '15:00' },
  { key: 'ca4', label: 'Ca 4: 15:00-17:30', start: '15:00', end: '17:30' },
];

const statusColor = {
  registered: '#c8e6c9',
  checked_in: '#fff9c4',
  checked_out: '#bbdefb',
};

const statusLabel = {
  registered: 'Đã đăng ký',
  checked_in: 'Đang làm',
  checked_out: 'Hoàn thành',
};

const dayNames = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

const pad = (num) => num.toString().padStart(2, '0');
const formatDate = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;

// Hàm kiểm tra xem đã đến giờ làm chưa
const isShiftTimeValid = (shiftKey, action) => {
  const now = new Date();
  const currentTime = now.toTimeString().slice(0, 5);
  const currentDate = now.toISOString().split('T')[0];
  
  const shift = SHIFTS.find(s => s.key === shiftKey);
  if (!shift) return false;
  
  const shiftStart = shift.start;
  
  if (action === 'checkin') {
    return currentTime >= shiftStart;
  }
  
  if (action === 'checkout') {
    return currentTime >= shiftStart;
  }
  
  return false;
};

// Hàm kiểm tra ngày làm
const isShiftDateValid = (scheduleDate) => {
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const scheduleDay = new Date(scheduleDate);
  const scheduleDateStr = scheduleDay.toISOString().split('T')[0];
  
  return today === scheduleDateStr;
};

// Hàm kiểm tra xem đã qua thời gian làm chưa (quá hạn)
const isShiftExpired = (scheduleDate, shiftKey) => {
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const scheduleDay = new Date(scheduleDate);
  const scheduleDateStr = scheduleDay.toISOString().split('T')[0];
  
  if (scheduleDateStr < today) {
    return true;
  }
  
  if (scheduleDateStr === today) {
    const currentTime = now.toTimeString().slice(0, 5);
    const shift = SHIFTS.find(s => s.key === shiftKey);
    if (shift && currentTime > shift.end) {
      return true;
    }
  }
  
  return false;
};

// Hàm lấy trạng thái thời gian cho menu
const getTimeStatus = (cell) => {
  if (!cell) return null;
  
  const now = new Date();
  const currentTime = now.toTimeString().slice(0, 5);
  const shift = SHIFTS.find(s => s.key === cell.ca);
  
  if (!shift) return null;
  
  const shiftStart = shift.start;
  const shiftEnd = shift.end;
  
  if (currentTime < shiftStart) {
    return {
      status: 'before',
      message: '⏳ Chưa tới giờ làm',
      color: '#ff9800'
    };
  }
  
  if (currentTime >= shiftStart && currentTime <= shiftEnd) {
    return {
      status: 'during',
      message: '🕒 Trong giờ làm',
      color: '#4caf50'
    };
  }
  
  if (currentTime > shiftEnd) {
    return {
      status: 'after',
      message: '⏰ Đã qua giờ làm',
      color: '#f44336'
    };
  }
  
  return null;
};

const ScheduleBoard = () => {
  const { auth } = useContext(AuthContext);
  const today = new Date();
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [year, setYear] = useState(today.getFullYear());
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [error, setError] = useState('');
  const [contextMenu, setContextMenu] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
  const [detailDialog, setDetailDialog] = useState({ 
    open: false, 
    date: null, 
    shift: null, 
    users: [] 
  });

  const daysInMonth = useMemo(() => new Date(year, month, 0).getDate(), [month, year]);

  const fetchSchedule = useCallback(async () => {
    if (!auth?.token) return;
    
    setLoading(true);
    setError('');
    try {
      const res = await axios.get(`http://localhost:5000/api/attendance/schedule?month=${month}&year=${year}`, {
        headers: { Authorization: `Bearer ${auth.token}` },
      });
      setRows(res.data || []);
    } catch (err) {
      const errorMsg = err.response?.data?.message || 'Không tải được lịch trực';
      setError(errorMsg);
      showSnackbar(errorMsg, 'error');
    } finally {
      setLoading(false);
    }
  }, [auth, month, year]);

  useEffect(() => {
    fetchSchedule();
  }, [fetchSchedule]);

  // Hàm lấy danh sách người đã đăng ký trong một ca
  const getCellData = (day, shiftKey) => {
    const date = formatDate(year, month, day);
    return rows.filter((r) => {
      if (!r.ngay) return false;
      const rowDate = typeof r.ngay === 'string' ? r.ngay.split('T')[0] : r.ngay.toISOString().split('T')[0];
      return rowDate === date && r.ca === shiftKey;
    });
  };

  // Tìm cell của người dùng hiện tại trong một ca
  const getUserCell = (day, shiftKey) => {
    const cells = getCellData(day, shiftKey);
    return cells.find(cell => cell.ma_nhan_vien === auth?.employee?.ma_nhan_vien);
  };

  const handleRegister = async (day, shiftKey) => {
    if (registering) return;
    
    const date = formatDate(year, month, day);
    
    // Kiểm tra xem người dùng đã đăng ký ca này chưa
    const existingCells = getCellData(day, shiftKey);
    const alreadyRegistered = existingCells.some(cell => cell.ma_nhan_vien === auth?.employee?.ma_nhan_vien);
    
    if (alreadyRegistered) {
      showSnackbar('Bạn đã đăng ký ca này rồi', 'warning');
      return;
    }

    setRegistering(true);
    setError('');
    
    try {
      const res = await axios.post(
        'http://localhost:5000/api/attendance/schedule/register',
        { date, shift: shiftKey },
        { headers: { Authorization: `Bearer ${auth.token}` } }
      );
      
      showSnackbar(res.data?.message || 'Đăng ký thành công', 'success');
      
      if (res.data?.data) {
        setRows(prev => [...prev, res.data.data]);
      } else {
        await fetchSchedule();
      }
    } catch (err) {
      const errorMsg = err.response?.data?.message || 'Không thể đăng ký ca';
      setError(errorMsg);
      showSnackbar(errorMsg, 'error');
    } finally {
      setRegistering(false);
    }
  };

  const handleViewDetails = (day, shift) => {
    const users = getCellData(day, shift.key);
    const date = formatDate(year, month, day);
    setDetailDialog({
      open: true,
      date: date,
      shift: shift.key,
      users: users
    });
  };

  const closeDetailDialog = () => {
    setDetailDialog({ open: false, date: null, shift: null, users: [] });
  };

  const handleContextMenu = (event, cell) => {
    event.preventDefault();
    event.stopPropagation();
    
    if (!cell || cell.ma_nhan_vien !== auth?.employee?.ma_nhan_vien) return;
    
    if (isShiftExpired(cell.ngay, cell.ca)) {
      showSnackbar('Ca làm này đã quá hạn, không thể checkin/checkout', 'warning');
      return;
    }
    
    if (!isShiftDateValid(cell.ngay)) {
      showSnackbar('Chỉ có thể checkin/checkout vào đúng ngày làm việc', 'warning');
      return;
    }
    
    const timeStatus = getTimeStatus(cell);
    
    setContextMenu({
      mouseX: event.clientX - 2,
      mouseY: event.clientY - 4,
      cell,
      timeStatus
    });
  };

  const closeContextMenu = () => {
    setContextMenu(null);
  };

  const doCheck = async (type) => {
    if (!contextMenu?.cell) return;
    
    const { cell } = contextMenu;
    
    if (!isShiftTimeValid(cell.ca, type)) {
      const shift = SHIFTS.find(s => s.key === cell.ca);
      const shiftTime = type === 'checkin' ? shift?.start : shift?.start;
      showSnackbar(`Chưa đến giờ làm! ${type === 'checkin' ? 'Checkin' : 'Checkout'} chỉ được thực hiện từ ${shiftTime}`, 'warning');
      closeContextMenu();
      return;
    }
    
    if (!isShiftDateValid(cell.ngay)) {
      showSnackbar('Chỉ có thể checkin/checkout vào đúng ngày làm việc', 'warning');
      closeContextMenu();
      return;
    }
    
    if (isShiftExpired(cell.ngay, cell.ca)) {
      showSnackbar('Ca làm này đã quá hạn, không thể checkin/checkout', 'warning');
      closeContextMenu();
      return;
    }
    
    const url = `http://localhost:5000/api/attendance/schedule/${cell.id}/${type}`;
    
    try {
      setLoading(true);
      const res = await axios.post(
        url,
        {},
        { headers: { Authorization: `Bearer ${auth.token}` } }
      );
      
      showSnackbar(res.data?.message || `${type} thành công`, 'success');
      
      setRows(prev => prev.map(row => {
        if (row.id === cell.id) {
          return { 
            ...row, 
            trang_thai: res.data?.record?.trang_thai || (type === 'checkin' ? 'checked_in' : 'checked_out'),
            gio_vao: type === 'checkin' ? res.data?.time : row.gio_vao,
            gio_ra: type === 'checkout' ? res.data?.time : row.gio_ra,
            thoi_gian_lam: type === 'checkout' ? res.data?.workDuration : row.thoi_gian_lam
          };
        }
        return row;
      }));
      
    } catch (err) {
      const errorMsg = err.response?.data?.message || `${type} thất bại`;
      showSnackbar(errorMsg, 'error');
    } finally {
      setLoading(false);
      closeContextMenu();
    }
  };

  const showSnackbar = (message, severity = 'info') => {
    setSnackbar({ open: true, message, severity });
  };

  const closeSnackbar = () => {
    setSnackbar(prev => ({ ...prev, open: false }));
  };

  // Tính tổng thời gian làm của tất cả người trong ca
  const calculateTotalWorkTime = (users) => {
    return users.reduce((total, user) => {
      return total + (Number(user.thoi_gian_lam) || 0);
    }, 0).toFixed(1);
  };

  const renderCell = (day, shift) => {
    const users = getCellData(day, shift.key);
    const userCell = getUserCell(day, shift.key);
    const isSunday = new Date(year, month - 1, day).getDay() === 0;
    const totalWorkTime = calculateTotalWorkTime(users);
    
    if (users.length === 0) {
      return (
        <TableCell
          key={shift.key}
          sx={{
            cursor: registering ? 'wait' : 'pointer',
            textAlign: 'center',
            padding: '4px !important',
            height: '85px',
            minWidth: '120px',
            position: 'relative',
            transition: 'all 0.2s ease',
            fontSize: '0.75rem',
            '&:hover': {
              backgroundColor: '#f0f7ff',
              boxShadow: 'inset 0 0 0 1px #1976d2',
            },
            ...(isSunday && { backgroundColor: '#fff9e6' }),
          }}
          onClick={(e) => {
            e.stopPropagation();
            if (!registering) {
              handleRegister(day, shift.key);
            }
          }}
          title="Nhấn để đăng ký ca"
        >
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              height: '100%',
              padding: '2px',
              gap: '8px',
            }}
          >
            <Avatar sx={{ width: 32, height: 32, bgcolor: '#e0e0e0' }}>
              <PersonIcon sx={{ fontSize: '1.2rem' }} />
            </Avatar>
            <Typography variant="caption" color="text.secondary">
              Chưa có ai
            </Typography>
            <Typography variant="caption" color="primary" sx={{ fontSize: '0.65rem', fontWeight: 'bold' }}>
              Đăng ký
            </Typography>
          </Box>
        </TableCell>
      );
    }

    // Tìm thời gian status từ user đầu tiên (tất cả cùng ca)
    const firstUser = users[0];
    const isExpired = isShiftExpired(firstUser.ngay, shift.key);
    const isToday = isShiftDateValid(firstUser.ngay);
    const timeStatus = getTimeStatus(firstUser);
    
    const cellStyle = {
      cursor: userCell ? 'context-menu' : 'pointer',
      textAlign: 'center',
      padding: '4px !important',
      height: '85px',
      minWidth: '120px',
      position: 'relative',
      fontSize: '0.75rem',
      borderLeft: userCell ? '3px solid #1976d2' : 'none',
      ...(isSunday && { 
        backgroundColor: '#f5f5f5',
      }),
      ...(isExpired && {
        opacity: 0.7,
        backgroundColor: '#fafafa',
      }),
      backgroundColor: '#f8f9fa',
    };

    // Tạo tooltip thông tin
    let tooltipText = `${users.length} người đã đăng ký`;
    
    if (userCell) {
      tooltipText += "\n• Bạn đã đăng ký (chuột phải để check-in/out)";
    }
    
    if (isExpired) {
      tooltipText += "\n• Đã quá hạn";
    } else if (isToday && timeStatus) {
      tooltipText += `\n• ${timeStatus.message}`;
    }
    
    tooltipText += "\n• Click để xem chi tiết";

    return (
      <TableCell
        key={shift.key}
        onContextMenu={(e) => {
          if (userCell && !isExpired && isToday) {
            handleContextMenu(e, userCell);
          }
        }}
        onClick={() => handleViewDetails(day, shift)}
        sx={cellStyle}
      >
        <Tooltip 
          title={tooltipText}
          arrow
        >
          <Box
            sx={{
              whiteSpace: 'normal',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              alignItems: 'center',
              height: '100%',
              padding: '4px 2px',
            }}
          >
            {/* Header: Số lượng người và avatar */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, width: '100%' }}>
              <PeopleIcon sx={{ fontSize: '0.8rem', color: '#666' }} />
              <Typography 
                variant="caption" 
                fontWeight="bold"
                sx={{ 
                  fontSize: '0.7rem',
                  color: isExpired ? 'text.disabled' : '#1976d2'
                }}
              >
                {users.length} người
              </Typography>
            </Box>

            {/* Danh sách tên người đăng ký (tối đa 2 người) */}
            <Box sx={{ 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '2px',
              width: '100%',
              maxHeight: '40px',
              overflow: 'hidden'
            }}>
              {users.slice(0, 2).map((user, idx) => (
                <Box 
                  key={idx} 
                  sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between',
                    fontSize: '0.6rem',
                    padding: '1px 3px',
                    borderRadius: '2px',
                    backgroundColor: user.ma_nhan_vien === auth?.employee?.ma_nhan_vien ? '#e3f2fd' : 'transparent',
                    border: user.ma_nhan_vien === auth?.employee?.ma_nhan_vien ? '1px solid #90caf9' : 'none'
                  }}
                >
                  <Typography 
                    variant="caption" 
                    sx={{ 
                      fontSize: '0.55rem',
                      fontWeight: user.ma_nhan_vien === auth?.employee?.ma_nhan_vien ? 'bold' : 'normal',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      maxWidth: '60px'
                    }}
                    title={user.ten_nhan_vien}
                  >
                    {user.ten_nhan_vien.split(' ').pop()}
                  </Typography>
                  {user.gio_vao && (
                    <AccessTimeIcon sx={{ fontSize: '0.5rem', color: '#666' }} />
                  )}
                </Box>
              ))}
              {users.length > 2 && (
                <Typography variant="caption" sx={{ fontSize: '0.5rem', color: '#666', textAlign: 'center' }}>
                  +{users.length - 2} người khác
                </Typography>
              )}
            </Box>

            {/* Footer: Thời gian và trạng thái */}
            <Box sx={{ 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '1px',
              width: '100%',
              alignItems: 'center'
            }}>
              {/* Thời gian làm việc nếu có */}
              {totalWorkTime > 0 && (
                <Typography 
                  variant="caption" 
                  fontWeight="bold" 
                  color={isExpired ? 'text.disabled' : 'primary'} 
                  sx={{ fontSize: '0.55rem' }}
                >
                  {totalWorkTime}h
                </Typography>
              )}
              
              {/* Trạng thái của người dùng hiện tại (nếu có) */}
              {userCell && (
                <Chip 
                  size="small"
                  label={statusLabel[userCell.trang_thai] || userCell.trang_thai}
                  sx={{ 
                    height: '16px', 
                    fontSize: '0.5rem',
                    fontWeight: 'bold',
                    backgroundColor: isExpired ? '#e0e0e0' : (statusColor[userCell.trang_thai] || '#e0e0e0'),
                    border: userCell.ma_nhan_vien === auth?.employee?.ma_nhan_vien ? '1px solid #1976d2' : 'none'
                  }}
                />
              )}
            </Box>

            {/* Hiển thị quá hạn */}
            {isExpired && (
              <Typography 
                variant="caption" 
                color="error" 
                sx={{ 
                  fontSize: '0.5rem',
                  fontWeight: 'bold',
                  position: 'absolute',
                  bottom: '1px',
                  right: '1px',
                }}
              >
                QUÁ HẠN
              </Typography>
            )}
            
            {/* Hiển thị trạng thái thời gian */}
            {!isExpired && isToday && timeStatus && (
              <Typography 
                variant="caption" 
                sx={{ 
                  fontSize: '0.5rem',
                  fontWeight: 'bold',
                  position: 'absolute',
                  bottom: '1px',
                  left: '1px',
                  color: timeStatus.color,
                }}
              >
                {timeStatus.status === 'before' && '⏳'}
                {timeStatus.status === 'during' && '🕒'}
                {timeStatus.status === 'after' && '⏰'}
              </Typography>
            )}
          </Box>
        </Tooltip>
      </TableCell>
    );
  };

  return (
    <Box sx={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: 'calc(100vh - 48px)',
      overflow: 'hidden'
    }}>
      {/* Header điều khiển */}
      <Paper sx={{ 
        p: 1.5, 
        mx: 2, 
        mt: 2, 
        mb: 1.5,
        borderRadius: 2,
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="h6" fontWeight="bold" sx={{ fontSize: '1rem' }}>
              📅 Lịch trực - {pad(month)}/{year}
            </Typography>
            
            <Box sx={{ display: 'flex', gap: 0.5, ml: 1 }}>
              <TextField
                size="small"
                type="number"
                value={month}
                onChange={(e) => {
                  const val = Math.min(12, Math.max(1, Number(e.target.value)));
                  setMonth(val);
                }}
                inputProps={{ 
                  min: 1, 
                  max: 12,
                  style: { 
                    padding: '6px 8px',
                    fontSize: '0.75rem',
                    width: '45px',
                    textAlign: 'center'
                  }
                }}
                sx={{ width: '70px' }}
              />
              <TextField
                size="small"
                type="number"
                value={year}
                onChange={(e) => {
                  const val = Math.min(2100, Math.max(2020, Number(e.target.value)));
                  setYear(val);
                }}
                inputProps={{ 
                  min: 2020, 
                  max: 2100,
                  style: { 
                    padding: '6px 8px',
                    fontSize: '0.75rem',
                    width: '60px',
                    textAlign: 'center'
                  }
                }}
                sx={{ width: '90px' }}
              />
            </Box>
          </Box>

          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', alignItems: 'center' }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
              Mỗi ca có thể có nhiều người (tối đa 6)
            </Typography>
            <Chip 
              size="small" 
              label="Đã đăng ký" 
              sx={{ 
                backgroundColor: '#c8e6c9', 
                fontSize: '0.65rem',
                height: '20px'
              }} 
            />
            <Chip 
              size="small" 
              label="Đang làm" 
              sx={{ 
                backgroundColor: '#fff9c4', 
                fontSize: '0.65rem',
                height: '20px'
              }} 
            />
            <Chip 
              size="small" 
              label="Hoàn thành" 
              sx={{ 
                backgroundColor: '#bbdefb', 
                fontSize: '0.65rem',
                height: '20px'
              }} 
            />
            <Chip 
              size="small" 
              label="CN" 
              sx={{ 
                backgroundColor: '#fff9e6', 
                fontSize: '0.65rem',
                height: '20px'
              }} 
            />
            <Chip 
              size="small" 
              label="Quá hạn" 
              sx={{ 
                backgroundColor: '#f5f5f5', 
                fontSize: '0.65rem',
                height: '20px',
                opacity: 0.6
              }} 
            />
          </Box>
        </Box>

        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block', fontSize: '0.7rem' }}>
          • Click ô trống để đăng ký • Click ô đã có người để xem chi tiết • Chuột phải ô của bạn (đúng ngày, đúng giờ) để check-in/out
        </Typography>

        {error && (
          <Alert 
            severity="error" 
            sx={{ 
              mt: 1, 
              py: 0.5, 
              fontSize: '0.75rem',
              '& .MuiAlert-icon': { fontSize: '16px' }
            }}
            onClose={() => setError('')}
          >
            {error}
          </Alert>
        )}

        {(loading || registering) && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
            <CircularProgress size={14} />
            <Typography variant="caption" color="text.secondary">
              {registering ? 'Đang đăng ký...' : 'Đang tải dữ liệu...'}
            </Typography>
          </Box>
        )}
      </Paper>

      {/* Bảng lịch trực */}
      <Paper sx={{ 
        flex: 1,
        mx: 2,
        mb: 2,
        borderRadius: 2,
        overflow: 'hidden',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      }}>
        <TableContainer 
          sx={{ 
            height: '100%',
            overflow: 'auto',
            '&::-webkit-scrollbar': {
              width: '6px',
              height: '6px',
            },
            '&::-webkit-scrollbar-track': {
              background: '#f1f1f1',
            },
            '&::-webkit-scrollbar-thumb': {
              background: '#888',
              borderRadius: '3px',
            },
          }}
        >
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={{ 
                  fontWeight: 'bold', 
                  bgcolor: 'primary.main', 
                  color: 'white',
                  padding: '6px 4px !important',
                  fontSize: '0.7rem',
                  minWidth: '45px',
                  textAlign: 'center',
                  borderRight: '1px solid rgba(255,255,255,0.1)'
                }}>
                  Ngày
                </TableCell>
                <TableCell sx={{ 
                  fontWeight: 'bold', 
                  bgcolor: 'primary.main', 
                  color: 'white',
                  padding: '6px 4px !important',
                  fontSize: '0.7rem',
                  minWidth: '35px',
                  textAlign: 'center',
                  borderRight: '1px solid rgba(255,255,255,0.1)'
                }}>
                  Thứ
                </TableCell>
                {SHIFTS.map((shift) => (
                  <TableCell 
                    key={shift.key} 
                    sx={{ 
                      fontWeight: 'bold', 
                      bgcolor: 'primary.main', 
                      color: 'white',
                      padding: '6px 4px !important',
                      fontSize: '0.7rem',
                      minWidth: '120px',
                      textAlign: 'center',
                      borderRight: '1px solid rgba(255,255,255,0.1)'
                    }}
                  >
                    {shift.label}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {Array.from({ length: daysInMonth }, (_, idx) => {
                const day = idx + 1;
                const dow = new Date(year, month - 1, day).getDay();
                const isSunday = dow === 0;
                const isToday = 
                  day === today.getDate() && 
                  month === today.getMonth() + 1 && 
                  year === today.getFullYear();
                
                const rowStyle = {
                  ...(isSunday && { backgroundColor: '#fff9e6' }),
                  ...(isToday && { 
                    backgroundColor: '#e3f2fd',
                    '& td': { borderTop: '2px solid #2196f3', borderBottom: '2px solid #2196f3' }
                  }),
                };

                return (
                  <TableRow key={day} sx={rowStyle}>
                    <TableCell sx={{ 
                      padding: '4px !important',
                      fontSize: '0.7rem',
                      textAlign: 'center',
                      borderRight: '1px solid rgba(0,0,0,0.1)'
                    }}>
                      <Box sx={{ 
                        display: 'flex', 
                        flexDirection: 'column', 
                        alignItems: 'center',
                        gap: '1px'
                      }}>
                        <Typography variant="caption" fontWeight={isToday ? 'bold' : 'normal'}>
                          {pad(day)}
                        </Typography>
                        {isToday && (
                          <Typography 
                            variant="caption" 
                            color="primary" 
                            fontWeight="bold"
                            sx={{ fontSize: '0.55rem' }}
                          >
                            Hôm nay
                          </Typography>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell sx={{ 
                      padding: '4px !important',
                      color: isSunday ? 'error.main' : 'inherit',
                      textAlign: 'center',
                      borderRight: '1px solid rgba(0,0,0,0.1)'
                    }}>
                      <Typography 
                        variant="caption" 
                        fontWeight={isSunday ? 'bold' : 'normal'}
                        color={isSunday ? 'error' : 'inherit'}
                        sx={{ fontSize: '0.7rem' }}
                      >
                        {dayNames[dow]}
                      </Typography>
                    </TableCell>
                    {SHIFTS.map((shift) => renderCell(day, shift))}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Dialog xem chi tiết người đăng ký */}
      <Dialog 
        open={detailDialog.open} 
        onClose={closeDetailDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <PeopleIcon color="primary" />
            <Typography variant="h6">
              Chi tiết ca {SHIFTS.find(s => s.key === detailDialog.shift)?.label}
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary">
            Ngày: {detailDialog.date ? new Date(detailDialog.date).toLocaleDateString('vi-VN') : ''}
          </Typography>
        </DialogTitle>
        
        <DialogContent>
          {detailDialog.users.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 3 }}>
              <PersonIcon sx={{ fontSize: 48, color: '#e0e0e0', mb: 2 }} />
              <Typography color="text.secondary">
                Chưa có ai đăng ký ca này
              </Typography>
            </Box>
          ) : (
            <List sx={{ pt: 0 }}>
              {detailDialog.users.map((user, index) => (
                <ListItem 
                  key={index}
                  sx={{ 
                    borderBottom: '1px solid #f0f0f0',
                    backgroundColor: user.ma_nhan_vien === auth?.employee?.ma_nhan_vien ? '#e3f2fd' : 'transparent',
                    borderRadius: 1,
                    mb: 0.5
                  }}
                >
                  <ListItemAvatar>
                    <Avatar sx={{ 
                      bgcolor: user.ma_nhan_vien === auth?.employee?.ma_nhan_vien ? '#1976d2' : '#4caf50',
                      fontWeight: 'bold'
                    }}>
                      {user.ten_nhan_vien.charAt(0)}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2" fontWeight="bold">
                          {user.ten_nhan_vien}
                        </Typography>
                        {user.ma_nhan_vien === auth?.employee?.ma_nhan_vien && (
                          <Chip 
                            size="small" 
                            label="Bạn" 
                            sx={{ 
                              height: '18px', 
                              fontSize: '0.6rem',
                              backgroundColor: '#1976d2',
                              color: 'white'
                            }} 
                          />
                        )}
                      </Box>
                    }
                    secondary={
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mt: 0.5 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Chip 
                            size="small"
                            label={statusLabel[user.trang_thai] || user.trang_thai}
                            sx={{ 
                              fontSize: '0.6rem',
                              height: '18px',
                              backgroundColor: statusColor[user.trang_thai] || '#e0e0e0',
                              fontWeight: 'bold'
                            }}
                          />
                          <Typography variant="caption" color="text.secondary">
                            Mã: {user.ma_nhan_vien}
                          </Typography>
                        </Box>
                        
                        {user.gio_vao && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <AccessTimeIcon sx={{ fontSize: '0.8rem', color: '#666' }} />
                            <Typography variant="caption">
                              Vào: {typeof user.gio_vao === 'string' ? user.gio_vao.substring(0, 5) : user.gio_vao}
                            </Typography>
                          </Box>
                        )}
                        
                        {user.gio_ra && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <CheckCircleIcon sx={{ fontSize: '0.8rem', color: '#666' }} />
                            <Typography variant="caption">
                              Ra: {typeof user.gio_ra === 'string' ? user.gio_ra.substring(0, 5) : user.gio_ra}
                            </Typography>
                          </Box>
                        )}
                        
                        {user.thoi_gian_lam && (
                          <Typography variant="caption" fontWeight="bold" color="primary">
                            Thời gian làm: {Number(user.thoi_gian_lam).toFixed(1)} giờ
                          </Typography>
                        )}
                      </Box>
                    }
                  />
                </ListItem>
              ))}
            </List>
          )}
          
          {detailDialog.users.length > 0 && (
            <Paper sx={{ p: 2, mt: 2, backgroundColor: '#f5f5f5' }}>
              <Typography variant="body2" fontWeight="bold">
                Thống kê:
              </Typography>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
                <Typography variant="caption">
                  Tổng số người: {detailDialog.users.length}
                </Typography>
                <Typography variant="caption">
                  Đã đăng ký: {detailDialog.users.filter(u => u.trang_thai === 'registered').length}
                </Typography>
                <Typography variant="caption">
                  Đang làm: {detailDialog.users.filter(u => u.trang_thai === 'checked_in').length}
                </Typography>
                <Typography variant="caption">
                  Hoàn thành: {detailDialog.users.filter(u => u.trang_thai === 'checked_out').length}
                </Typography>
              </Box>
              <Typography variant="caption" fontWeight="bold" color="primary" sx={{ mt: 1, display: 'block' }}>
                Tổng thời gian làm: {calculateTotalWorkTime(detailDialog.users)} giờ
              </Typography>
            </Paper>
          )}
        </DialogContent>
        
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={closeDetailDialog} color="inherit">
            Đóng
          </Button>
          {detailDialog.users.length < 6 && (
            <Button 
              variant="contained" 
              onClick={() => {
                if (detailDialog.date) {
                  const [y, m, d] = detailDialog.date.split('-');
                  const day = parseInt(d);
                  handleRegister(day, detailDialog.shift);
                }
                closeDetailDialog();
              }}
              disabled={registering}
            >
              Đăng ký ca này
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Menu ngữ cảnh */}
      <Menu
        open={contextMenu !== null}
        onClose={closeContextMenu}
        anchorReference="anchorPosition"
        anchorPosition={
          contextMenu !== null
            ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
            : undefined
        }
        PaperProps={{
          sx: {
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
            fontSize: '0.8rem',
            minWidth: '140px'
          }
        }}
      >
        {/* Hiển thị trạng thái thời gian */}
        {contextMenu?.timeStatus && (
          <MenuItem 
            disabled
            sx={{ 
              fontSize: '0.75rem', 
              py: 0.5,
              color: contextMenu.timeStatus.color,
              fontWeight: 'bold',
              justifyContent: 'center',
              backgroundColor: '#f5f5f5',
              borderBottom: '1px solid #e0e0e0'
            }}
          >
            {contextMenu.timeStatus.message}
          </MenuItem>
        )}
        
        {/* Hiển thị thông tin ca làm */}
        {contextMenu?.cell && (
          <MenuItem 
            disabled
            sx={{ 
              fontSize: '0.7rem', 
              py: 0.5,
              color: 'text.secondary',
              justifyContent: 'center',
              backgroundColor: '#fafafa'
            }}
          >
            {SHIFTS.find(s => s.key === contextMenu.cell.ca)?.label}
          </MenuItem>
        )}

        {/* Các action checkin/checkout */}
        {contextMenu?.cell?.trang_thai === 'registered' && (
          <MenuItem 
            onClick={() => doCheck('checkin')}
            sx={{ 
              color: '#d84315', 
              fontSize: '0.8rem', 
              py: 0.75,
              '&:disabled': {
                color: '#9e9e9e'
              }
            }}
            disabled={contextMenu?.timeStatus?.status === 'before'}
          >
            🔔 Check-in
            {contextMenu?.timeStatus?.status === 'before' && (
              <Typography variant="caption" color="text.secondary" sx={{ ml: 1, fontSize: '0.65rem' }}>
                (Từ {SHIFTS.find(s => s.key === contextMenu.cell.ca)?.start})
              </Typography>
            )}
          </MenuItem>
        )}
        
        {contextMenu?.cell?.trang_thai === 'checked_in' && (
          <MenuItem 
            onClick={() => doCheck('checkout')}
            sx={{ 
              color: '#2e7d32', 
              fontSize: '0.8rem', 
              py: 0.75,
              '&:disabled': {
                color: '#9e9e9e'
              }
            }}
            disabled={contextMenu?.timeStatus?.status === 'before'}
          >
            ✅ Check-out
            {contextMenu?.timeStatus?.status === 'before' && (
              <Typography variant="caption" color="text.secondary" sx={{ ml: 1, fontSize: '0.65rem' }}>
                (Từ {SHIFTS.find(s => s.key === contextMenu.cell.ca)?.start})
              </Typography>
            )}
          </MenuItem>
        )}
        
        {(contextMenu?.cell?.trang_thai === 'checked_out') && (
          <MenuItem disabled sx={{ fontSize: '0.8rem', py: 0.75 }}>
            🏁 Đã hoàn thành
          </MenuItem>
        )}
        
        <MenuItem 
          onClick={closeContextMenu} 
          sx={{ 
            fontSize: '0.8rem', 
            py: 0.75,
            borderTop: '1px solid #e0e0e0',
            color: '#757575'
          }}
        >
          ❌ Đóng
        </MenuItem>
      </Menu>

      {/* Snackbar thông báo */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={closeSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={closeSnackbar}
          severity={snackbar.severity}
          sx={{ width: '100%', fontSize: '0.8rem' }}
          action={
            <IconButton
              size="small"
              aria-label="close"
              color="inherit"
              onClick={closeSnackbar}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          }
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default ScheduleBoard;