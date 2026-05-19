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
  Divider,
  Stack,
  TextField as MuiTextField,
  Autocomplete,
  Grid,
  Card,
  CardContent,
  LinearProgress,
  Badge,
  Radio,
  RadioGroup,
  FormControlLabel,
  FormLabel
} from '@mui/material';
import { 
  Close as CloseIcon, 
  Person as PersonIcon,
  AccessTime as AccessTimeIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon,
  People as PeopleIcon,
  SwapHoriz as SwapHorizIcon,
  Login as LoginIcon,
  Logout as LogoutIcon,
  Cancel as CancelIcon,
  Today as TodayIcon,
  CalendarMonth as CalendarMonthIcon,
  Summarize as SummarizeIcon,
  Timer as TimerIcon,
  Work as WorkIcon,
  Download as DownloadIcon,
  History as HistoryIcon,
  Message as MessageIcon,
  Warning as WarningIcon
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

// Hàm chuyển đổi giờ thập phân sang giờ:phút
const formatHours = (decimalHours) => {
  if (!decimalHours || decimalHours === 0) return "0 giờ 0 phút";
  
  const hours = Math.floor(decimalHours);
  const minutes = Math.round((decimalHours - hours) * 60);
  
  return `${hours} giờ ${minutes} phút`;
};

// Hàm xuất file Excel từ dữ liệu báo cáo tháng
const exportMonthlyReportToExcel = (reportData, employeeName, month, year) => {
  if (!reportData) return;
  
  try {
    // Tạo workbook (sử dụng sheetjs-style logic)
    const headers = [
      ['BÁO CÁO CHẤM CÔNG THÁNG', '', '', '', '', '', '', '', '', ''],
      ['Nhân viên:', employeeName, '', '', 'Tháng:', `${pad(month)}/${year}`, '', '', '', ''],
      ['', '', '', '', '', '', '', '', '', ''],
      [
        'STT',
        'Ngày',
        'Thứ',
        'Ca làm việc',
        'Giờ vào',
        'Giờ ra',
        'Thời gian làm (giờ)',
        'Thời gian làm (phút)',
        'Trạng thái',
        'Ghi chú'
      ]
    ];
    
    const rows = [];
    let stt = 1;
    
    // Thêm chi tiết từng ngày
    if (reportData.daily_reports && Array.isArray(reportData.daily_reports)) {
      reportData.daily_reports.forEach((dayReport, dayIndex) => {
        // Tách chi tiết các ca trong ngày
        if (dayReport.chi_tiet_ca) {
          const caDetails = dayReport.chi_tiet_ca.split(';');
          caDetails.forEach((caDetail, caIndex) => {
            const [caKey, hours] = caDetail.split(':');
            const shift = SHIFTS.find(s => s.key === caKey) || { label: caKey };
            
            rows.push([
              stt++,
              dayReport.ngay ? new Date(dayReport.ngay).toLocaleDateString('vi-VN') : '',
              dayReport.ngay ? dayNames[new Date(dayReport.ngay).getDay()] : '',
              shift.label,
              '', // Giờ vào - có thể thêm từ dữ liệu chi tiết nếu có
              '', // Giờ ra - có thể thêm từ dữ liệu chi tiết nếu có
              Number(hours).toFixed(2),
              Math.round(Number(hours) * 60),
              'Hoàn thành',
              `Ca ${caIndex + 1} trong ngày ${new Date(dayReport.ngay).toLocaleDateString('vi-VN')}`
            ]);
          });
        }
      });
    }
    
    
    // Thêm tổng kết
    if (rows.length > 0) {
      const totalHours = rows.reduce((sum, row) => sum + parseFloat(row[6]), 0);
      const totalMinutes = rows.reduce((sum, row) => sum + parseInt(row[7]), 0);
      
      rows.push([]);
      rows.push(['', '', '', '', '', '', '', '', '', '']);
      rows.push(['TỔNG KẾT THÁNG', '', '', '', '', '', 
        totalHours.toFixed(2), 
        totalMinutes,
        '', 
        `Số ngày làm: ${reportData.daily_reports.length}, Tổng ca: ${reportData.monthly_summary.tong_so_ca}`
      ]);
    }
    
    // Tạo nội dung CSV (đơn giản nhất để xuất)
    const csvContent = [
      ...headers.map(row => row.join(',')),
      ...rows.map(row => row.join(','))
    ].join('\n');
    
    // Tạo file blob với BOM cho UTF-8
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    // Tạo link download
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `BaoCaoChamCong_${employeeName}_${pad(month)}_${year}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
    
    return true;
  } catch (error) {
    console.error('Lỗi xuất Excel:', error);
    throw new Error('Xuất Excel thất bại: ' + error.message);
  }
};

// ========== CÁC HÀM KIỂM TRA QUÁ GIỜ VÀ CHƯA TỚI GIỜ ==========

// Hàm kiểm tra xem có thể đăng ký không (quá giờ đăng ký)
const canRegister = (date, shiftKey) => {
  const now = new Date();
  const currentTime = now.toTimeString().slice(0, 5);
  const currentDate = now.toISOString().split('T')[0];
  
  const shift = SHIFTS.find(s => s.key === shiftKey);
  if (!shift) return { canRegister: false, reason: 'Ca không hợp lệ' };
  
  const shiftEnd = shift.end;
  
  // Không cho đăng ký ngày trong quá khứ
  if (date < currentDate) {
    return {
      canRegister: false,
      reason: 'Không thể đăng ký ca ngày đã qua'
    };
  }
  
  // Nếu là hôm nay, chỉ chặn khi đã quá giờ kết thúc
  if (date === currentDate && currentTime > shiftEnd) {
    return {
      canRegister: false,
      reason: `Không thể đăng ký ca này vì ca đã kết thúc lúc ${shiftEnd}`
    };
  }
  
  return {
    canRegister: true,
    reason: null
  };
};


// ========== HÀM KIỂM TRA CHƯA TỚI NGÀY VÀ GIỜ ==========

// Hàm kiểm tra xem có thể check-in không (bao gồm kiểm tra chưa tới ngày và giờ)
const canCheckIn = (cell) => {
  if (!cell) return { canCheckIn: false, reason: 'Không có thông tin ca' };
  
  const now = new Date();
  const currentTime = now.toTimeString().slice(0, 5);
  const currentDate = now.toISOString().split('T')[0];
  
  const shift = SHIFTS.find(s => s.key === cell.ca);
  if (!shift) return { canCheckIn: false, reason: 'Ca không hợp lệ' };
  
  const shiftStart = shift.start;
  const shiftEnd = shift.end;
  const recordDate = new Date(cell.ngay).toISOString().split('T')[0];
  
  const currentDateObj = new Date(currentDate);
  const recordDateObj = new Date(recordDate);
  
  // Ngày trong tương lai
  if (currentDateObj < recordDateObj) {
    return {
      canCheckIn: false,
      reason: 'Chưa tới ngày làm! Không thể check‑in trước ngày làm việc'
    };
  }
  
  // Cùng ngày
  if (recordDate === currentDate) {
    if (currentTime < shiftStart) {
      return {
        canCheckIn: false,
        reason: `Chưa tới giờ làm! Check‑in chỉ được thực hiện từ ${shiftStart}`
      };
    }
    if (currentTime <= shiftEnd) {
      return {
        canCheckIn: true,
        reason: null
      };
    }
    // Quá giờ trong ngày – chuyển sang gửi yêu cầu
    return {
      canCheckIn: false,
      canRequestAdjustment: true,
      loai_yeu_cau: 'checkin',
      reason: `Đã quá giờ làm (kết thúc lúc ${shiftEnd})`,
      message: `Bạn có thể gửi yêu cầu điều chỉnh giờ check‑in`
    };
  }
  
  // Ngày hôm qua
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];
  
  if (recordDate === yesterdayStr) {
    const recordDateTime = new Date(cell.ngay);
    const endTime = new Date(recordDateTime);
    const [endHours, endMinutes] = shiftEnd.split(':').map(Number);
    endTime.setHours(endHours, endMinutes, 0);
    
    const allowedUntil = new Date(endTime.getTime() + (25 * 60 * 60 * 1000)); // 24h + 1h buffer
    
    if (now > allowedUntil) {
      return {
        canCheckIn: false,
        canRequestAdjustment: false,
        reason: 'Đã quá thời gian cho phép check‑in (quá 24 giờ sau khi ca kết thúc)'
      };
    }
    return {
      canCheckIn: false,
      canRequestAdjustment: true,
      loai_yeu_cau: 'checkin',
      reason: `Ca của ngày hôm qua, bạn có thể gửi yêu cầu điều chỉnh giờ check‑in`
    };
  }
  
  // Ngày cũ hơn 2 ngày
  if (recordDate < yesterdayStr) {
    return {
      canCheckIn: false,
      canRequestAdjustment: false,
      reason: 'Không thể check‑in cho ca đã qua 2 ngày trở lên'
    };
  }
  
  return { canCheckIn: true, reason: null };
};

// Hàm kiểm tra xem có thể check-out không (LUÔN CHO PHÉP GỬI YÊU CẦU CHO QUÁ KHỨ)
const canCheckOut = (cell) => {
  if (!cell) return { canCheckOut: false, reason: 'Không có thông tin ca' };
  
  const now = new Date();
  const currentTime = now.toTimeString().slice(0, 5);
  const currentDate = now.toISOString().split('T')[0];
  
  const shift = SHIFTS.find(s => s.key === cell.ca);
  if (!shift) return { canCheckOut: false, reason: 'Ca không hợp lệ' };
  
  const shiftStart = shift.start;
  const shiftEnd = shift.end;
  
  // Xử lý ngày an toàn
  let recordDate;
  try {
    recordDate = new Date(cell.ngay).toISOString().split('T')[0];
  } catch (e) {
    console.error('Lỗi xử lý ngày:', e);
    recordDate = currentDate;
  }
  
  // KIỂM TRA: CHƯA TỚI NGÀY LÀM (ngày trong tương lai)
  if (recordDate > currentDate) {
    return {
      canCheckOut: false,
      reason: 'Chưa tới ngày làm! Không thể check-out trước ngày làm việc'
    };
  }
  
  // Nếu là cùng ngày
  if (recordDate === currentDate) {
    // Chưa tới giờ làm
    if (currentTime < shiftStart) {
      return {
        canCheckOut: false,
        reason: `Chưa tới giờ làm! Check-out chỉ được thực hiện từ ${shiftStart}`
      };
    }
    
    // Trong giờ làm
    if (currentTime <= shiftEnd) {
      return {
        canCheckOut: true,
        reason: null
      };
    }
    
    // Quá giờ trong ngày
    return {
      canCheckOut: false,
      canRequestAdjustment: true,
      loai_yeu_cau: 'checkout',
      reason: `Đã quá giờ kết thúc ca (${shiftEnd})`,
      message: `Bạn có thể gửi yêu cầu điều chỉnh giờ check-out`
    };
  }
  
  // Nếu là ngày quá khứ (recordDate < currentDate)
  const diffTime = Math.abs(now - new Date(recordDate));
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return {
    canCheckOut: false,
    canRequestAdjustment: true,
    loai_yeu_cau: 'checkout',
    reason: `Ca này đã qua ${diffDays} ngày`,
    message: `Bạn có thể gửi yêu cầu điều chỉnh giờ check-out cho ca đã qua ${diffDays} ngày`
  };
};

// Cập nhật hàm getTimeStatus để hiển thị thông báo về yêu cầu điều chỉnh
const getTimeStatus = (cell) => {
  if (!cell) return null;
  
  const now = new Date();
  const currentTime = now.toTimeString().slice(0, 5);
  const currentDate = now.toISOString().split('T')[0];
  const shift = SHIFTS.find(s => s.key === cell.ca);
  
  if (!shift) return null;
  
  const shiftStart = shift.start;
  const shiftEnd = shift.end;
  
  // Kiểm tra xem có phải ngày hôm nay không
  const cellDate = new Date(cell.ngay).toISOString().split('T')[0];
  
  // KIỂM TRA MỚI: CHƯA TỚI NGÀY LÀM
  const currentDateObj = new Date(currentDate);
  const cellDateObj = new Date(cellDate);
  
  if (currentDateObj < cellDateObj) {
    // Tính số ngày còn lại
    const diffTime = Math.abs(cellDateObj - currentDateObj);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return {
      status: 'before_day',
      message: `📅 Còn ${diffDays} ngày nữa`,
      color: '#ff9800',
      disabled: true
    };
  }
  
  // Nếu là ngày quá khứ
  if (currentDateObj > cellDateObj) {
    const diffTime = Math.abs(now - new Date(cell.ngay));
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return { status: 'yesterday', message: '📅 Hôm qua - Cần gửi yêu cầu', color: '#ff9800', canRequestAdjustment: true };
    if (diffDays === 2) return { status: '2days', message: '📅 2 ngày trước - Cần gửi yêu cầu', color: '#ff9800', canRequestAdjustment: true };
    if (diffDays >= 3) return { status: 'older', message: '📅 3+ ngày trước - Cần gửi yêu cầu', color: '#ff9800', canRequestAdjustment: true };
  }
  
  // Nếu là hôm nay
  if (currentTime < shiftStart) {
    return {
      status: 'before_start',
      message: `⏳ Chưa tới giờ làm (từ ${shiftStart})`,
      color: '#ff9800',
      disabled: true
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
    const [endHours, endMinutes] = shiftEnd.split(':').map(Number);
    const endTimeInMinutes = endHours * 60 + endMinutes;
    
    const [currentHours, currentMinutes] = currentTime.split(':').map(Number);
    const currentTimeInMinutes = currentHours * 60 + currentMinutes;
    
    // Quá 30 phút so với thời gian kết thúc ca
    if (currentTimeInMinutes > (endTimeInMinutes + 30)) {
      return {
        status: 'overdue',
        message: '⚠️ Đã quá 30 phút kết thúc ca - Cần gửi yêu cầu',
        color: '#f44336',
        canRequestAdjustment: true
      };
    }
    
    return {
      status: 'after',
      message: '✅ Đã qua giờ làm (vẫn có thể check-out)',
      color: '#2196f3'
    };
  }
  
  return null;
};

// Thêm helper function để debug
const debugLog = (message, data = null) => {
  if (process.env.NODE_ENV === 'development') {
    console.log(`🔍 ${message}`, data || '');
  }
};

// ======================
// 1. HÀM KIỂM TRA ĐIỀU KIỆN HỦY TRỰC THAY (FRONTEND VALIDATION)
// ======================
const canCancelTrucThay = (cell) => {
  if (!cell) {
    return { 
      canCancel: false, 
      reason: 'Không có thông tin ca' 
    };
  }

  console.log('Kiểm tra hủy trực thay - Cell:', {
    id: cell.id,
    ma_nhan_vien: cell.ma_nhan_vien,
    is_user_truc_thay: cell.is_user_truc_thay,
    is_truc_thay: cell.is_truc_thay,
    trang_thai: cell.trang_thai,
    truc_thay_type: cell.truc_thay_type
  });

  // 1. Kiểm tra xem có phải là ca trực thay không
  if (!cell.is_truc_thay) {
    return { 
      canCancel: false, 
      reason: 'Đây không phải ca trực thay' 
    };
  }

  // 2. Chỉ người trực thay mới được hủy
  if (!cell.is_user_truc_thay) {
    return { 
      canCancel: false, 
      reason: 'Chỉ người trực thay mới được hủy' 
    };
  }

  // 3. Chỉ được hủy khi ca chưa bắt đầu (trạng thái registered)
  if (cell.trang_thai !== 'registered') {
    return { 
      canCancel: false, 
      reason: 'Chỉ có thể hủy trực thay khi ca chưa bắt đầu' 
    };
  }

  // 4. Phải có ID lịch trực gốc
  if (!cell.lich_truc_goc_id && !cell.truc_thay_info?.lich_truc_goc_id) {
    return { 
      canCancel: false, 
      reason: 'Không tìm thấy thông tin lịch trực gốc' 
    };
  }

  return {
    canCancel: true,
    reason: null
  };
};

// ======================
// 2. HÀM XỬ LÝ HỦY TRỰC THAY (FRONTEND)
// ======================
const handleCancelTrucThay = async (cell, setLoading, auth, showSnackbar, fetchSchedule, loadMyTrucThayShifts, closeDetailDialog) => {
  console.log('=== XỬ LÝ HỦY TRỰC THAY (FRONTEND) ===');
  console.log('Thông tin cell:', {
    id: cell.id,
    lich_truc_goc_id: cell.lich_truc_goc_id || cell.truc_thay_info?.lich_truc_goc_id,
    ten_nhan_vien: cell.ten_nhan_vien,
    ma_nhan_vien: cell.ma_nhan_vien,
    trang_thai: cell.trang_thai
  });

  // 1. KIỂM TRA ĐIỀU KIỆN TRƯỚC KHI GỌI API (FRONTEND VALIDATION)
  const checkResult = canCancelTrucThay(cell);
  if (!checkResult.canCancel) {
    showSnackbar(checkResult.reason, 'warning');
    return;
  }

  // 2. Lấy ID lịch trực gốc
  const lich_truc_goc_id = cell.lich_truc_goc_id || cell.truc_thay_info?.lich_truc_goc_id;
  if (!lich_truc_goc_id) {
    showSnackbar('Không tìm thấy thông tin lịch trực gốc', 'error');
    return;
  }

  // 3. Xác nhận với người dùng
  const confirmMessage = `Bạn có chắc chắn muốn hủy trực thay này?\n\n` +
    `• Ca: ${SHIFTS.find(s => s.key === cell.ca)?.label}\n` +
    `• Ngày: ${cell.ngay ? new Date(cell.ngay).toLocaleDateString('vi-VN') : ''}\n` +
    `• Người đăng ký gốc: ${cell.nguoi_duoc_truc_thay || 'Không rõ'}\n\n` +
    `Sau khi hủy, ca sẽ trở về trạng thái ban đầu và người đăng ký gốc sẽ giữ nguyên tên.`;

  if (!window.confirm(confirmMessage)) {
    return;
  }

  // 4. GỌI API HỦY TRỰC THAY (BACKEND)
  try {
    setLoading(true);
    
    console.log('Gọi API hủy trực thay với ID:', lich_truc_goc_id);
    
    const res = await axios.delete(
      `http://localhost:5000/api/attendance/truc-thay/cancel/${lich_truc_goc_id}`,
      { 
        headers: { Authorization: `Bearer ${auth.token}` },
        timeout: 10000
      }
    );
    
    console.log('API response:', res.data);
    
    if (res.data.success) {
      showSnackbar(res.data.message, 'success');
      
      // Hiển thị thông báo chi tiết về việc khôi phục
      setTimeout(() => {
        showSnackbar(
          res.data.important_note || '✅ Lịch trực đã được khôi phục về trạng thái ban đầu',
          'info',
          3000
        );
      }, 500);
      
      // 5. REFRESH DỮ LIỆU SAU KHI HỦY
      await Promise.all([
        fetchSchedule(),
        loadMyTrucThayShifts()
      ]);
      
      // 6. ĐÓNG DIALOG NẾU ĐANG MỞ
      if (closeDetailDialog) {
        closeDetailDialog();
      }
      
    } else {
      showSnackbar(res.data.message || 'Hủy trực thay thất bại', 'error');
    }
    
  } catch (error) {
    console.error('❌ Lỗi hủy trực thay (Frontend):', error);
    
    let errorMessage = 'Hủy trực thay thất bại';
    if (error.response?.data?.message) {
      errorMessage = error.response.data.message;
    }
    if (error.response?.data?.errors && error.response.data.errors.length > 0) {
      errorMessage += `: ${error.response.data.errors.join(', ')}`;
    }
    
    showSnackbar(errorMessage, 'error');
    
  } finally {
    setLoading(false);
  }
};

// ========== CÁC HÀM ĐÃ CẬP NHẬT ==========

// CẬP NHẬT HÀM getCellData - PHÂN BIỆT RÕ AI LÀ AI
const getCellData = (day, shiftKey, rows, auth, year, month) => {
  const date = formatDate(year, month, day);
  
  // Lọc các dòng trùng ngày và ca
  const allRows = rows.filter((r) => {
    if (!r.ngay || !r.ca) return false;
    
    let rowDate;
    if (typeof r.ngay === 'string') {
      rowDate = r.ngay.split('T')[0].split(' ')[0].trim();
    } else if (r.ngay instanceof Date) {
      rowDate = r.ngay.toISOString().split('T')[0];
    } else {
      try {
        const d = new Date(r.ngay);
        if (!isNaN(d.getTime())) {
          rowDate = formatDate(d.getFullYear(), d.getMonth() + 1, d.getDate());
        } else {
          return false;
        }
      } catch (e) {
        return false;
      }
    }
    
    const toDateStr = (val) => String(val).split('T')[0].split(' ')[0].trim();
    const normalizedRowDate = toDateStr(rowDate);
    const normalizedDate = toDateStr(date);
    const dateMatch = normalizedRowDate === normalizedDate;
    const caMatch = String(r.ca) === String(shiftKey);
    
    return dateMatch && caMatch;
  });
  
  // Ánh xạ mỗi cell với thông tin hiển thị
  return allRows.map(cell => {
    // Trường hợp 1: Lịch gốc của người được trực thay (receiver) - loai_lich === 'original'
    if (cell.loai_lich === 'original') {
      return {
        ...cell,
        truc_thay_type: 'receiver', // gán để dùng sau
        display_status: `Được trực thay bởi ${cell.ten_nguoi_truc_thay || '?'}`,
        is_original_registrant: true,
        is_being_truc_thay: true,
        nguoi_truc_thay: cell.ten_nguoi_truc_thay,
        ma_nguoi_truc_thay: cell.ma_nguoi_truc_thay,
        truc_thay_info: {
          type: 'receiver',
          nguoi_truc_thay: cell.ten_nguoi_truc_thay,
          ma_nguoi_truc_thay: cell.ma_nguoi_truc_thay
        }
      };
    }
    
    // Trường hợp 2: Lịch ảo của người trực thay (performer) - loai_lich === 'virtual'
    if (cell.loai_lich === 'virtual') {
      const isCurrentUser = cell.ma_nhan_vien === auth?.employee?.ma_nhan_vien;
      return {
        ...cell,
        truc_thay_type: 'performer',
        display_status: isCurrentUser 
          ? `Bạn đang trực thay cho ${cell.ten_nguoi_duoc_truc_thay || '?'}`
          : `Đang trực thay cho ${cell.ten_nguoi_duoc_truc_thay || '?'}`,
        is_truc_thay: true,
        is_user_truc_thay: isCurrentUser,
        can_cancel_truc_thay: isCurrentUser && cell.trang_thai === 'registered',
        lich_truc_goc_id: cell.lich_truc_goc_id,
        nguoi_duoc_truc_thay: cell.ten_nguoi_duoc_truc_thay,
        ma_nguoi_duoc_truc_thay: cell.ma_nguoi_duoc_truc_thay,
        truc_thay_info: {
          type: 'performer',
          nguoi_duoc_truc_thay: cell.ten_nguoi_duoc_truc_thay,
          ma_nguoi_duoc_truc_thay: cell.ma_nguoi_duoc_truc_thay,
          lich_truc_ao_id: cell.id,
          lich_truc_goc_id: cell.lich_truc_goc_id
        }
      };
    }
    
    // Trường hợp 3: Lịch bình thường, không liên quan trực thay
    return {
      ...cell,
      truc_thay_type: null,
      display_status: statusLabel[cell.trang_thai] || cell.trang_thai,
      is_truc_thay_related: false
    };
  });
};

// CẬP NHẬT HÀM getUserCell - TÌM ĐÚNG CELL CỦA USER
const getUserCell = (day, shiftKey, rows, auth, year, month) => {
  const cells = getCellData(day, shiftKey, rows, auth, year, month);
  
  // Tìm theo 3 trường hợp:
  
  // 1. Tìm cell có mã nhân viên trùng với user hiện tại
  const directCell = cells.find(cell => cell.ma_nhan_vien === auth?.employee?.ma_nhan_vien);
  if (directCell) return directCell;
  
  // 2. Tìm cell là lịch ảo mà user đang trực thay
  const virtualCell = cells.find(cell => 
    cell.truc_thay_type === 'performer' && 
    cell.ma_nhan_vien === auth?.employee?.ma_nhan_vien
  );
  if (virtualCell) return virtualCell;
  
  // 3. Tìm cell là lịch gốc mà user được trực thay
  const originalCell = cells.find(cell => 
    cell.truc_thay_type === 'receiver' && 
    cell.ma_nhan_vien === auth?.employee?.ma_nhan_vien
  );
  if (originalCell) return originalCell;
  
  return null;
};

const ScheduleBoard = ({ refreshToken }) => {
  const { auth } = useContext(AuthContext);
  const getLastViewedFeedback = useCallback(() => {
    if (!auth?.employee?.id) return 0;
    const stored = localStorage.getItem(`lastViewedFeedback_${auth.employee.id}`);
    return stored ? parseInt(stored, 10) : 0;
  }, [auth]);
  
  const setLastViewedFeedback = useCallback(() => {
    if (auth?.employee?.id) {
      localStorage.setItem(`lastViewedFeedback_${auth.employee.id}`, Date.now().toString());
    }
  }, [auth]);
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
    users: [],
    userCell: null,
    isTrucThayList: false // Đánh dấu đang xem danh sách trực thay
  });
  const [dailySummaryDialog, setDailySummaryDialog] = useState({
    open: false,
    date: null,
    summary: null,
    details: []
  });
  const [monthlyReportDialog, setMonthlyReportDialog] = useState({
    open: false,
    month: null,
    year: null,
    report: null
  });
const [trucThayDialog, setTrucThayDialog] = useState({
  open: false,
  usersList: [],      // danh sách người có thể trực thay
  selectedUser: null, // người được chọn
  lyDo: '',
});
  const [myTrucThayShifts, setMyTrucThayShifts] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [fetchingEmployees, setFetchingEmployees] = useState(false);
  const [selectedDate, setSelectedDate] = useState(today.toISOString().split('T')[0]);

  // State cho dialog yêu cầu điều chỉnh giờ (MỚI)
  const [timeAdjustmentDialog, setTimeAdjustmentDialog] = useState({
    open: false,
    cell: null,
    loaiYeuCau: 'checkout', // 'checkin' hoặc 'checkout'
    thoiGianDeXuat: '',
    lyDo: '',
    shiftEnd: ''
  });

  // State cho dialog lịch sử yêu cầu điều chỉnh (MỚI)
  const [myTimeAdjustmentsDialog, setMyTimeAdjustmentsDialog] = useState({
    open: false,
    requests: [],
    loading: false
  });
  const [unreadFeedbackCount, setUnreadFeedbackCount] = useState(0);

  // State cho dialog cảnh báo checkout sớm (MỚI)
  const [earlyCheckoutDialog, setEarlyCheckoutDialog] = useState({
    open: false,
    cell: null,
    minutes: 0
  });

  const daysInMonth = useMemo(() => new Date(year, month, 0).getDate(), [month, year]);

  // ĐỊNH NGHĨA showSnackbar TRƯỚC CÁC HÀM KHÁC
  const showSnackbar = useCallback((message, severity = 'info') => {
    setSnackbar({ open: true, message, severity });
  }, []);

  const closeSnackbar = () => {
    setSnackbar(prev => ({ ...prev, open: false }));
  };

  // Hàm load ca trực thay (FIXED)
  const loadMyTrucThayShifts = useCallback(async () => {
    if (!auth?.token) {
      debugLog('Không có token, không thể load ca trực thay');
      return;
    }

    try {
      debugLog('Đang load ca trực thay...');
      
      const res = await axios.get(
        'http://localhost:5000/api/attendance/truc-thay/my-shifts',
        { 
          headers: { Authorization: `Bearer ${auth.token}` },
          timeout: 10000 // 10 giây timeout
        }
      );
      
      debugLog('Kết quả load ca trực thay:', res.data);
      
      if (res.data.success && res.data.data) {
        setMyTrucThayShifts(res.data.data);
        debugLog(`Đã load ${res.data.data.length} ca trực thay`);
      } else {
        console.warn('API trả về không có dữ liệu:', res.data);
        setMyTrucThayShifts([]);
      }
      
    } catch (error) {
      console.error('❌ Lỗi lấy ca trực thay:', error);
      
      // Hiển thị chi tiết lỗi
      if (error.response) {
        console.error('Response error:', error.response.data);
        showSnackbar(`Lỗi: ${error.response.data.message || 'Không thể load ca trực thay'}`, 'error');
      } else if (error.request) {
        console.error('Request error:', error.request);
        showSnackbar('Không thể kết nối đến server', 'error');
      } else {
        console.error('Error:', error.message);
        showSnackbar(`Lỗi: ${error.message}`, 'error');
      }
      
      setMyTrucThayShifts([]);
    }
  }, [auth, showSnackbar]);

  // Hàm load lịch sử yêu cầu điều chỉnh của tôi (MỚI)
  const loadMyTimeAdjustments = useCallback(async () => {
    if (!auth?.token) return;
    
    setMyTimeAdjustmentsDialog(prev => ({ ...prev, loading: true }));
    
    try {
      const res = await axios.get(
        'http://localhost:5000/api/attendance/my/time-adjustments',
        { headers: { Authorization: `Bearer ${auth.token}` } }
      );
      
      if (res.data.success) {
        const requests = res.data.data;
        setMyTimeAdjustmentsDialog(prev => ({ 
          ...prev, 
          requests: requests,
          loading: false 
        }));
        
        // Lấy thời điểm xem cuối
        const lastViewed = getLastViewedFeedback();
        
        // Đếm số yêu cầu có phản hồi admin và có updated_at > lastViewed
        const count = requests.filter(req => {
          if (!req.ghi_chu_admin) return false;
          const updatedAt = new Date(req.updated_at).getTime();
          return updatedAt > lastViewed;
        }).length;
        
        setUnreadFeedbackCount(count);
      }
    } catch (error) {
      console.error('Lỗi load lịch sử yêu cầu:', error);
      showSnackbar('Không thể load lịch sử yêu cầu', 'error');
      setMyTimeAdjustmentsDialog(prev => ({ ...prev, loading: false }));
      setUnreadFeedbackCount(0);
    }
  }, [auth, showSnackbar]);

  // Cập nhật các hàm khác có sử dụng showSnackbar
  const fetchSchedule = useCallback(async () => {
    if (!auth?.token) return;
    
    setLoading(true);
    setError('');
    try {
      const res = await axios.get(`http://localhost:5000/api/attendance/schedule?month=${month}&year=${year}`, {
        headers: { Authorization: `Bearer ${auth.token}` },
      });
      
      // Đảm bảo format ngày đúng cho tất cả rows
      const formattedRows = (res.data || []).map(row => {
        let ngay = null;
        if (row.ngay) {
          if (typeof row.ngay === 'string') {
            ngay = row.ngay.split('T')[0].split(' ')[0].trim();
          } else {
            const d = new Date(row.ngay);
            if (!isNaN(d.getTime())) {
              const pad = (n) => n.toString().padStart(2, '0');
              ngay = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
            }
          }
        }
        return { ...row, ngay };
      });
      
      setRows(formattedRows);
    } catch (err) {
      const errorMsg = err.response?.data?.message || 'Không tải được lịch trực';
      setError(errorMsg);
      showSnackbar(errorMsg, 'error');
    } finally {
      setLoading(false);
    }
  }, [auth, month, year, showSnackbar]);

  const fetchEmployees = useCallback(async () => {
    if (!auth?.token) return;
    
    if (!auth?.employee?.is_admin) {
      setEmployees([]);
      return;
    }
    
    setFetchingEmployees(true);
    try {
      const res = await axios.get('http://localhost:5000/api/attendance/admin/employees', {
        headers: { Authorization: `Bearer ${auth.token}` },
      });
      const filteredEmployees = res.data.filter(emp => 
        emp.ma_nhan_vien !== auth?.employee?.ma_nhan_vien
      );
      setEmployees(filteredEmployees);
    } catch (err) {
      console.warn('Không thể lấy danh sách nhân viên:', err.response?.status);
      showSnackbar('Không thể lấy danh sách nhân viên', 'warning');
      setEmployees([]);
    } finally {
      setFetchingEmployees(false);
    }
  }, [auth, showSnackbar]);

  const fetchDailySummary = useCallback(async (date) => {
    if (!auth?.token) return;
    
    try {
      const res = await axios.get(`http://localhost:5000/api/attendance/daily-summary?date=${date}`, {
        headers: { Authorization: `Bearer ${auth.token}` },
      });
      return res.data;
    } catch (err) {
      console.error('Lỗi lấy tổng thời gian:', err);
      showSnackbar('Không thể lấy tổng thời gian', 'warning');
      return null;
    }
  }, [auth, showSnackbar]);

  const fetchMonthlyReport = useCallback(async (month, year) => {
    if (!auth?.token) return;
    
    try {
      const res = await axios.get(`http://localhost:5000/api/attendance/monthly-report?month=${month}&year=${year}`, {
        headers: { Authorization: `Bearer ${auth.token}` },
      });
      return res.data;
    } catch (err) {
      console.error('Lỗi lấy báo cáo tháng:', err);
      showSnackbar('Không thể lấy báo cáo tháng', 'warning');
      return null;
    }
  }, [auth, showSnackbar]);

  // Hàm xuất Excel từ client-side
  const handleExportExcel = useCallback(() => {
    if (!monthlyReportDialog.report) {
      showSnackbar('Không có dữ liệu để xuất', 'warning');
      return;
    }
    
    try {
      const success = exportMonthlyReportToExcel(
        monthlyReportDialog.report,
        auth?.employee?.ten_nhan_vien || 'NhanVien',
        monthlyReportDialog.month || month,
        monthlyReportDialog.year || year
      );
      
      if (success) {
        showSnackbar('Xuất Excel thành công!', 'success');
      }
    } catch (error) {
      showSnackbar('Lỗi xuất Excel: ' + error.message, 'error');
      console.error('Xuất Excel thất bại:', error);
    }
  }, [monthlyReportDialog.report, monthlyReportDialog.month, monthlyReportDialog.year, auth?.employee?.ten_nhan_vien, month, year, showSnackbar]);

  useEffect(() => {
    fetchSchedule();
    fetchEmployees();
    if (auth?.token) {
      loadMyTrucThayShifts();
      loadMyTimeAdjustments();
    }
  }, [fetchSchedule, fetchEmployees, loadMyTrucThayShifts, loadMyTimeAdjustments, auth, refreshToken]);

  useEffect(() => {
    const handleFocus = () => {
      if (auth?.token) {
        fetchSchedule();
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [auth, fetchSchedule]);

  // CẬP NHẬT HÀM getCellData LOCAL
  const getCellDataLocal = useCallback((day, shiftKey) => {
    return getCellData(day, shiftKey, rows, auth, year, month);
  }, [rows, auth, year, month]);

  // CẬP NHẬT HÀM getUserCell LOCAL
  const getUserCellLocal = useCallback((day, shiftKey) => {
    return getUserCell(day, shiftKey, rows, auth, year, month);
  }, [rows, auth, year, month]);

  // ======================
  // HÀM KIỂM TRA XEM USER CÓ THỂ TRỰC THAY KHÔNG (THÊM MỚI)
  // ======================
  const canUserBeTrucThay = useCallback((user) => {
  if (!user) return false;

  // Không phải receiver và ca còn registered
  if (user.truc_thay_type === 'receiver') return false; // người được trực thay không thể trực thay cho người khác
  if (user.trang_thai !== 'registered') return false;

  const shift = SHIFTS.find(s => s.key === user.ca);
  if (!shift) return false;

  const now = new Date();
  const currentDate = formatDate(now.getFullYear(), now.getMonth() + 1, now.getDate());
  const userDate = new Date(user.ngay).toISOString().split('T')[0];

  // Ngày trong tương lai → được phép
  if (userDate > currentDate) return true;
  // Ngày trong quá khứ → không được phép
  if (userDate < currentDate) return false;

  // Cùng ngày: so sánh giờ hiện tại với giờ KẾT THÚC ca
  const currentTime = now.toTimeString().slice(0, 5);
  return currentTime < shift.end; // cho phép nếu chưa quá giờ kết thúc
}, []);

  // Hàm mở dialog trực thay với kiểm tra (ĐÃ CẬP NHẬT)
  const handleOpenTrucThayDialog = (allOtherUsers) => {
    if (allOtherUsers.length === 0) {
      showSnackbar('Không có ai để trực thay trong ca này', 'warning');
      return;
    }
    setTrucThayDialog({
      open: true,
      usersList: allOtherUsers,
      selectedUser: null,  // không tự chọn, để người dùng chọn
      lyDo: '',
    });
  };

  // Hàm xử lý trực thay (FIXED)
  const handleTrucThay = async () => {
  const { selectedUser, lyDo } = trucThayDialog;

  if (!selectedUser) {
    showSnackbar('Vui lòng chọn người để trực thay', 'warning');
    return;
  }

  try {
    setLoading(true);
    const res = await axios.post(
      'http://localhost:5000/api/attendance/truc-thay/request',
      {
        lich_truc_id: selectedUser.id,   // ID của lịch gốc của người được chọn
        ly_do: lyDo || 'Không có lý do'
      },
      { headers: { Authorization: `Bearer ${auth.token}` }, timeout: 15000 }
    );

    if (res.data.success) {
      showSnackbar(res.data.message, 'success');
      setTimeout(() => {
        showSnackbar(res.data.important_note || 'Đã đăng ký trực thay thành công', 'info', 5000);
      }, 1000);
    } else {
      showSnackbar(res.data.message || 'Trực thay thất bại', 'error');
    }

    // Đóng dialog và refresh dữ liệu
    setTrucThayDialog({ open: false, usersList: [], selectedUser: null, lyDo: '' });
    await Promise.all([fetchSchedule(), loadMyTrucThayShifts()]);

  } catch (error) {
    console.error('❌ Lỗi trực thay:', error);
    let errorMessage = 'Trực thay thất bại';
    if (error.response?.data?.message) errorMessage = error.response.data.message;
    if (error.response?.data?.errors) errorMessage += `: ${error.response.data.errors.join(', ')}`;
    showSnackbar(errorMessage, 'error');
  } finally {
    setLoading(false);
  }
};

  // Hàm check-in cho ca trực thay (FIXED)
  const handleCheckinTrucThay = async (lich_truc_ao_id) => {
    try {
      setLoading(true);
      debugLog('Đang check-in trực thay...', { lich_truc_ao_id });
      
      const res = await axios.post(
        `http://localhost:5000/api/attendance/truc-thay/checkin/${lich_truc_ao_id}`,
        {},
        { 
          headers: { Authorization: `Bearer ${auth.token}` },
          timeout: 10000
        }
      );
      
      debugLog('Kết quả check-in trực thay:', res.data);
      
      if (res.data.success) {
        showSnackbar(res.data.message, 'success');
        
        // Hiển thị thông báo về giờ tính
        setTimeout(() => {
          showSnackbar(res.data.note || '⚠️ Số giờ làm sẽ được tính cho người được trực thay', 'info', 3000);
        }, 500);
        
      } else {
        showSnackbar(res.data.message || 'Check-in thất bại', 'error');
      }
      
      // Refresh dữ liệu
      await Promise.all([
        loadMyTrucThayShifts(),
        fetchSchedule()
      ]);
      
    } catch (error) {
      console.error('❌ Lỗi check-in trực thay:', error);
      
      let errorMessage = 'Check-in trực thay thất bại';
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      }
      
      showSnackbar(errorMessage, 'error');
      
    } finally {
      setLoading(false);
    }
  };

  // Hàm check-out cho ca trực thay (FIXED)
  const handleCheckoutTrucThay = async (lich_truc_ao_id) => {
    try {
      setLoading(true);
      debugLog('Đang check-out trực thay...', { lich_truc_ao_id });
      
      const res = await axios.post(
        `http://localhost:5000/api/attendance/truc-thay/checkout/${lich_truc_ao_id}`,
        {},
        { 
          headers: { Authorization: `Bearer ${auth.token}` },
          timeout: 10000
        }
      );
      
      debugLog('Kết quả check-out trực thay:', res.data);
      
      if (res.data.success) {
        showSnackbar(res.data.message, 'success');
        
        // Hiển thị thông báo về giờ tính
        setTimeout(() => {
          showSnackbar(res.data.note || '✅ Số giờ làm đã được tính cho người được trực thay', 'success', 3000);
        }, 500);
        
      } else {
        showSnackbar(res.data.message || 'Check-out thất bại', 'error');
      }
      
      // Refresh dữ liệu
      await Promise.all([
        loadMyTrucThayShifts(),
        fetchSchedule()
      ]);
      
    } catch (error) {
      console.error('❌ Lỗi check-out trực thay:', error);
      
      let errorMessage = 'Check-out trực thay thất bại';
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      }
      
      showSnackbar(errorMessage, 'error');
      
    } finally {
      setLoading(false);
    }
  };

  // CẬP NHẬT HÀM handleCancelTrucThayLocal
  const handleCancelTrucThayLocal = useCallback(async (cell) => {
    return handleCancelTrucThay(cell, setLoading, auth, showSnackbar, fetchSchedule, loadMyTrucThayShifts, closeDetailDialog);
  }, [auth, fetchSchedule, loadMyTrucThayShifts, showSnackbar]);

  // Hàm mở dialog yêu cầu điều chỉnh giờ (MỚI)
  const handleOpenTimeAdjustmentDialog = (cell, loaiYeuCau) => {
    console.log('=== MỞ DIALOG YÊU CẦU ===');
    console.log('Cell:', cell);
    console.log('Loại yêu cầu:', loaiYeuCau);
    
    if (!cell) {
      showSnackbar('Không có thông tin ca', 'error');
      return;
    }
    
    const now = new Date();
    const currentTime = now.toTimeString().slice(0, 5);
    
    // Tính số ngày trễ
    let daysLate = 0;
    try {
      const cellDate = new Date(cell.ngay).toISOString().split('T')[0];
      const currentDate = now.toISOString().split('T')[0];
      if (cellDate < currentDate) {
        const diffTime = Math.abs(now - new Date(cell.ngay));
        daysLate = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      }
    } catch (e) {
      console.error('Lỗi tính ngày trễ:', e);
    }
    
    setTimeAdjustmentDialog({
      open: true,
      cell: cell,
      loaiYeuCau: loaiYeuCau,
      thoiGianDeXuat: currentTime,
      lyDo: daysLate > 0 ? `Quên check-out sau ${daysLate} ngày` : '',
      shiftEnd: SHIFTS.find(s => s.key === cell.ca)?.end || '--:--',
      daysLate: daysLate
    });
  };

  // Hàm gửi yêu cầu điều chỉnh giờ (MỚI)
  const handleSendTimeAdjustmentRequest = async () => {
    const { cell, loaiYeuCau, thoiGianDeXuat, lyDo } = timeAdjustmentDialog;

    if (!cell) {
      showSnackbar('Không có thông tin ca', 'error');
      return;
    }

    try {
      setLoading(true);
      
      const res = await axios.post(
        `http://localhost:5000/api/attendance/schedule/${cell.id}/request-time-adjustment`,
        {
          loai_yeu_cau: loaiYeuCau,
          thoi_gian_de_xuat: thoiGianDeXuat,
          ly_do: lyDo || 'Không có lý do'
        },
        { headers: { Authorization: `Bearer ${auth.token}` } }
      );
      
      if (res.data.success) {
        showSnackbar(res.data.message, 'success');
        
        // Đóng dialog
        setTimeAdjustmentDialog({
          open: false,
          cell: null,
          loaiYeuCau: 'checkout',
          thoiGianDeXuat: '',
          lyDo: '',
          shiftEnd: ''
        });
        
        // Refresh dữ liệu
        await fetchSchedule();
      } else {
        showSnackbar(res.data.message || 'Gửi yêu cầu thất bại', 'error');
      }
      
    } catch (error) {
      console.error('Lỗi gửi yêu cầu:', error);
      const errorMsg = error.response?.data?.message || 'Gửi yêu cầu thất bại';
      showSnackbar(errorMsg, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Hàm mở dialog lịch sử yêu cầu (MỚI)
  const handleOpenMyTimeAdjustments = async () => {
    await loadMyTimeAdjustments();
    setLastViewedFeedback();           // cập nhật thời gian xem
    setUnreadFeedbackCount(0);          // xóa badge ngay lập tức
    setMyTimeAdjustmentsDialog(prev => ({ ...prev, open: true }));
  };

  // ====================== HÀM TÍNH SỐ PHÚT TỪ LÚC CHECK-IN (MỚI) ======================
  const getMinutesSinceCheckin = (cell) => {
    if (!cell.gio_vao) return Infinity;
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const checkinDateTime = new Date(`${todayStr}T${cell.gio_vao}`);
    // Nếu check‑in xảy ra vào ngày khác (không thể xảy ra trong thực tế), ta bỏ qua
    const diffMs = now - checkinDateTime;
    return diffMs / (1000 * 60);
  };

  // ====================== TÁCH LOGIC GỌI API CHECKOUT THÀNH HÀM RIÊNG (MỚI) ======================
  const doCheckout = async (cell) => {
    try {
      setLoading(true);
      const res = await axios.post(
        `http://localhost:5000/api/attendance/schedule/${cell.id}/checkout`,
        {},
        { headers: { Authorization: `Bearer ${auth.token}` } }
      );
      showSnackbar(res.data?.message || 'Check-out thành công', 'success');
      
      setRows(prev => prev.map(row => {
        if (row.id === cell.id) {
          return { 
            ...row, 
            trang_thai: 'checked_out',
            gio_ra: res.data?.time,
            thoi_gian_lam: res.data?.workDuration
          };
        }
        return row;
      }));
      
      if (detailDialog.open) {
        setDetailDialog(prev => ({
          ...prev,
          userCell: { 
            ...prev.userCell, 
            trang_thai: 'checked_out', 
            gio_ra: res.data?.time,
            thoi_gian_lam: res.data?.workDuration
          }
        }));
      }
      
      if (res.data?.totalWorkTime) {
        showSnackbar(
          `Check-out thành công! Tổng thời gian làm hôm nay: ${Number(res.data.totalWorkTime).toFixed(2)} giờ (${formatHours(res.data.totalWorkTime)})`,
          'info'
        );
      }
    } catch (err) {
      const errorMsg = err.response?.data?.message || 'Check-out thất bại';
      showSnackbar(errorMsg, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (day, shiftKey) => {
    if (registering) return;
    
    const date = formatDate(year, month, day);
    
    const checkResult = canRegister(date, shiftKey);
    if (!checkResult.canRegister) {
      showSnackbar(checkResult.reason, 'warning');
      return;
    }
    
    const existingCells = getCellDataLocal(day, shiftKey);
    const alreadyRegistered = existingCells.some(cell => 
      cell.ma_nhan_vien === auth?.employee?.ma_nhan_vien
    );
    
    if (alreadyRegistered) {
      handleCellClick(day, { key: shiftKey });
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
        await fetchSchedule();
    } catch (err) {
      const errorMsg = err.response?.data?.message || 'Không thể đăng ký ca';
      setError(errorMsg);
      
      if (err.response?.status === 400 && (errorMsg.includes('đã đăng ký') || errorMsg.includes('đăng ký ca này rồi') || errorMsg.includes('Bạn đã đăng ký'))) {
        await fetchSchedule();
        setTimeout(() => {
          handleCellClick(day, { key: shiftKey });
        }, 300);
        setRegistering(false);
        return;
      }
      
      showSnackbar(errorMsg, 'error');
    } finally {
      setRegistering(false);
    }
  };

  const handleCellClick = (day, shift) => {
    const users = getCellDataLocal(day, shift.key);
    const userCell = getUserCellLocal(day, shift.key);
    const date = formatDate(year, month, day);
    
    setDetailDialog({
      open: true,
      date: date,
      shift: shift.key,
      users: users,
      userCell: userCell,
      isTrucThayList: false
    });
  };

  const closeDetailDialog = () => {
    setDetailDialog({ open: false, date: null, shift: null, users: [], userCell: null, isTrucThayList: false });
  };

  const handleOpenDailySummary = async (date) => {
    if (!date) {
      date = today.toISOString().split('T')[0];
    }
    
    setSelectedDate(date);
    const summary = await fetchDailySummary(date);
    
    setDailySummaryDialog({
      open: true,
      date: date,
      summary: summary?.formatted_summary || null,
      details: summary?.details || []
    });
  };

  const closeDailySummaryDialog = () => {
    setDailySummaryDialog({
      open: false,
      date: null,
      summary: null,
      details: []
    });
  };

  const handleOpenMonthlyReport = async () => {
    const report = await fetchMonthlyReport(month, year);
    
    setMonthlyReportDialog({
      open: true,
      month: month,
      year: year,
      report: report
    });
  };

  const closeMonthlyReportDialog = () => {
    setMonthlyReportDialog({
      open: false,
      month: null,
      year: null,
      report: null
    });
  };

  const handleContextMenu = (event, cell) => {
    event.preventDefault();
    event.stopPropagation();
    
    if (!cell || cell.ma_nhan_vien !== auth?.employee?.ma_nhan_vien) return;
    
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

  const handleCheckin = async (cell) => {
    if (!cell) return;
    
    const checkResult = canCheckIn(cell);
    
    // Nếu quá giờ và có thể gửi yêu cầu, mở dialog yêu cầu
    if (!checkResult.canCheckIn && checkResult.canRequestAdjustment) {
      handleOpenTimeAdjustmentDialog(cell, 'checkin');
      closeDetailDialog();
      return;
    }
    
    // Nếu không thể check-in vì lý do khác
    if (!checkResult.canCheckIn) {
      showSnackbar(checkResult.reason, 'warning');
      return;
    }
    
    try {
      setLoading(true);
      const res = await axios.post(
        `http://localhost:5000/api/attendance/schedule/${cell.id}/checkin`,
        {},
        { headers: { Authorization: `Bearer ${auth.token}` } }
      );
      
      showSnackbar(res.data?.message || 'Check-in thành công', 'success');
      
      setRows(prev => prev.map(row => {
        if (row.id === cell.id) {
          return { 
            ...row, 
            trang_thai: 'checked_in',
            gio_vao: res.data?.time
          };
        }
        return row;
      }));
      
      if (detailDialog.open) {
        setDetailDialog(prev => ({
          ...prev,
          userCell: { ...prev.userCell, trang_thai: 'checked_in', gio_vao: res.data?.time }
        }));
      }
      
    } catch (err) {
      const errorMsg = err.response?.data?.message || 'Check-in thất bại';
      showSnackbar(errorMsg, 'error');
    } finally {
      setLoading(false);
      closeDetailDialog();
    }
  };

  // ====================== HANDLE CHECKOUT - ĐÃ SỬA ĐỂ XỬ LÝ CHECKOUT SỚM ======================
  const handleCheckout = async (cell) => {
    if (!cell) return;

    const checkResult = canCheckOut(cell);

    // Nếu có thể gửi yêu cầu (quá giờ, quá ngày) thì mở dialog yêu cầu
    if (checkResult.canRequestAdjustment) {
      handleOpenTimeAdjustmentDialog(cell, 'checkout');
      closeDetailDialog();
      return;
    }

    // Nếu không thể checkout vì lý do khác
    if (!checkResult.canCheckOut) {
      showSnackbar(checkResult.reason, 'warning');
      return;
    }

    // Kiểm tra thời gian từ lúc check‑in
    const minutesSinceCheckin = getMinutesSinceCheckin(cell);
    if (minutesSinceCheckin < 30) {
      setEarlyCheckoutDialog({
        open: true,
        cell,
        minutes: Math.round(minutesSinceCheckin)
      });
      return;
    }

    // Thực hiện checkout bình thường
    await doCheckout(cell);
    closeDetailDialog();
  };

  const handleCancelRegistration = async (cell) => {
    if (!cell) return;
    
    if (cell.trang_thai !== 'registered') {
      showSnackbar('Chỉ có thể hủy đăng ký khi chưa check-in', 'warning');
      return;
    }
    
    try {
      setLoading(true);
      const res = await axios.delete(
        `http://localhost:5000/api/attendance/schedule/${cell.id}/cancel`,
        { headers: { Authorization: `Bearer ${auth.token}` } }
      );
      
      showSnackbar(res.data?.message || 'Hủy đăng ký thành công', 'success');
      
      setRows(prev => prev.filter(row => row.id !== cell.id));
      closeDetailDialog();
      
    } catch (err) {
      const errorMsg = err.response?.data?.message || 'Hủy đăng ký thất bại';
      showSnackbar(errorMsg, 'error');
    } finally {
      setLoading(false);
    }
  };

  const calculateTotalWorkTime = (users) => {
    return users.reduce((total, user) => {
      return total + (Number(user.thoi_gian_lam) || 0);
    }, 0).toFixed(1);
  };

  // ======================
  // 6. HÀM LOAD CA TRỰC THAY CỦA TÔI
  // ======================
  const loadMyTrucThayShiftsCallback = useCallback(async () => {
    if (!auth?.token) return;

    try {
      const res = await axios.get(
        'http://localhost:5000/api/attendance/truc-thay/my-shifts',
        { 
          headers: { Authorization: `Bearer ${auth.token}` },
          timeout: 10000
        }
      );
      
      if (res.data.success && res.data.data) {
        const formattedShifts = res.data.data.map(shift => ({
          ...shift,
          can_cancel_truc_thay: shift.trang_thai === 'registered',
          is_truc_thay: true,
          is_user_truc_thay: true,
          lich_truc_goc_id: shift.lich_truc_goc_id
        }));
        
        setMyTrucThayShifts(formattedShifts);
      } else {
        setMyTrucThayShifts([]);
      }
      
    } catch (error) {
      console.error('❌ Lỗi lấy ca trực thay:', error);
      showSnackbar('Không thể load ca trực thay', 'error');
      setMyTrucThayShifts([]);
    }
  }, [auth, showSnackbar]);

  useEffect(() => {
    if (auth?.token) {
      loadMyTrucThayShiftsCallback();
    }
  }, [auth, loadMyTrucThayShiftsCallback]);

  const renderCell = (day, shift) => {
    const users = getCellDataLocal(day, shift.key);
    const userCell = getUserCellLocal(day, shift.key);
    const isSunday = new Date(year, month - 1, day).getDay() === 0;
    const totalWorkTime = calculateTotalWorkTime(users);
    const isToday = day === today.getDate() && month === today.getMonth() + 1 && year === today.getFullYear();
    
    const date = formatDate(year, month, day);
    const registerCheck = canRegister(date, shift.key);
    
    let timeCheck = null;
    if (userCell) {
      if (userCell.trang_thai === 'registered') {
        timeCheck = canCheckIn(userCell);
      } else if (userCell.trang_thai === 'checked_in') {
        timeCheck = canCheckOut(userCell);
      }
    }
    
    let warningTooltip = '';
    if (!registerCheck.canRegister) {
      warningTooltip = `⚠️ ${registerCheck.reason}`;
    } else if (timeCheck && !timeCheck.canCheckIn && userCell?.trang_thai === 'registered') {
      warningTooltip = `⚠️ ${timeCheck.reason}`;
    } else if (timeCheck && !timeCheck.canCheckOut && userCell?.trang_thai === 'checked_in') {
      warningTooltip = `⚠️ ${timeCheck.reason}`;
    }

    // TÌM ĐÚNG THÔNG TIN TRỰC THAY
    const trucThayInfo = {
      // Người được trực thay (A)
      receiver: users.find(user => user.truc_thay_type === 'receiver'),
      // Người trực thay (B)
      performer: users.find(user => user.truc_thay_type === 'performer')
    };
    
    const hasTrucThay = trucThayInfo.receiver || trucThayInfo.performer;
    
    // TOOLTIP HIỂN THỊ ĐÚNG
    let tooltipText = `${users.length} người đã đăng ký`;
    
    if (hasTrucThay) {
      if (trucThayInfo.receiver && trucThayInfo.performer) {
        // CÓ CẢ A VÀ B
        tooltipText += `\n• ${trucThayInfo.receiver.ten_nhan_vien} (được trực thay bởi ${trucThayInfo.performer.ten_nhan_vien})`;
        tooltipText += `\n• ${trucThayInfo.performer.ten_nhan_vien} (đang trực thay cho ${trucThayInfo.receiver.ten_nhan_vien})`;
      } else if (trucThayInfo.receiver) {
        // CHỈ CÓ A (B có thể đã bị xóa)
        tooltipText += `\n• ${trucThayInfo.receiver.ten_nhan_vien} (được trực thay)`;
      } else if (trucThayInfo.performer) {
        // CHỈ CÓ B (A có thể đã bị xóa)
        tooltipText += `\n• ${trucThayInfo.performer.ten_nhan_vien} (đang trực thay)`;
      }
    }

    // Lọc những người khác (không phải mình và không phải người đang trực thay)
    const otherUsers = users.filter(u => 
      u.ma_nhan_vien !== auth?.employee?.ma_nhan_vien && 
      u.truc_thay_type !== 'performer'
    );

    // Những người thực sự có thể trực thay (sử dụng hàm canUserBeTrucThay)
    const availableForTrucThay = otherUsers.filter(u => canUserBeTrucThay(u));

    if (users.length === 0) {
      return (
        <TableCell
          key={shift.key}
          sx={{
            cursor: registering ? 'wait' : (registerCheck.canRegister ? 'pointer' : 'not-allowed'),
            textAlign: 'center',
            padding: '4px !important',
            height: '85px',
            minWidth: '120px',
            position: 'relative',
            transition: 'all 0.2s ease',
            fontSize: '0.75rem',
            opacity: registerCheck.canRegister ? 1 : 0.7,
            backgroundColor: !registerCheck.canRegister ? '#f5f5f5' : '#f8f9fa',
            '&:hover': {
              backgroundColor: registerCheck.canRegister ? '#f0f7ff' : '#f5f5f5',
              boxShadow: registerCheck.canRegister ? 'inset 0 0 0 1px #1976d2' : 'none',
            },
            ...(isSunday && { backgroundColor: registerCheck.canRegister ? '#fff9e6' : '#fff5e6' }),
            ...(isToday && { 
              borderLeft: '3px solid #ff9800',
              borderRight: '3px solid #ff9800'
            }),
          }}
          onClick={(e) => {
            e.stopPropagation();
            if (!registering && registerCheck.canRegister) {
              handleRegister(day, shift.key);
            }
          }}
          title={warningTooltip || (registerCheck.canRegister ? "Nhấn để đăng ký ca" : registerCheck.reason)}
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
            <Avatar sx={{ 
              width: 32, 
              height: 32, 
              bgcolor: registerCheck.canRegister ? '#e0e0e0' : '#f5f5f5' 
            }}>
              <PersonIcon sx={{ fontSize: '1.2rem' }} />
            </Avatar>
            <Typography variant="caption" color={registerCheck.canRegister ? "text.secondary" : "text.disabled"}>
              Chưa có ai
            </Typography>
            <Typography variant="caption" color={registerCheck.canRegister ? "primary" : "text.disabled"} sx={{ fontSize: '0.65rem', fontWeight: 'bold' }}>
              Đăng ký
            </Typography>
          </Box>
        </TableCell>
      );
    }

    const firstUser = users[0];
    const timeStatus = getTimeStatus(firstUser);
    
    const cellStyle = {
      cursor: 'pointer',
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
      backgroundColor: '#f8f9fa',
      ...(isToday && { 
        borderRight: '3px solid #ff9800'
      }),
      // MÀU CHO NGƯỜI ĐƯỢC TRỰC THAY (A)
      ...(trucThayInfo.receiver && {
        backgroundColor: '#e8f5e8',
        borderLeft: '3px solid #4caf50',
        borderRight: '3px solid #4caf50'
      }),
      
      // MÀU CHO NGƯỜI TRỰC THAY (B) - CHỈ KHI LÀ USER HIỆN TẠI
      ...(trucThayInfo.performer && trucThayInfo.performer.ma_nhan_vien === auth?.employee?.ma_nhan_vien && {
        backgroundColor: '#fff3e0',
        borderLeft: '3px solid #ff9800',
        borderRight: '3px solid #ff9800'
      }),
      
      // BADGE HIỂN THỊ
      ...(hasTrucThay && {
        '&:after': {
          content: '"🔄"',
          position: 'absolute',
          top: 2,
          right: 2,
          fontSize: '0.7rem'
        }
      })
    };

    return (
      <TableCell
        key={shift.key}
        onContextMenu={(e) => {
          if (userCell) {
            handleContextMenu(e, userCell);
          }
        }}
        onClick={() => handleCellClick(day, shift)}
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
                  color: '#1976d2'
                }}
              >
                {users.length} người
              </Typography>
            </Box>

            {/* Danh sách tên người đăng ký */}
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
              {totalWorkTime > 0 && (
                <Typography 
                  variant="caption" 
                  fontWeight="bold"
                  color="primary" 
                  sx={{ fontSize: '0.55rem' }}
                >
                  {totalWorkTime}h
                </Typography>
              )}
            
              {userCell && (
                <Chip 
                  size="small" 
                  label={userCell.display_status || statusLabel[userCell.trang_thai] || userCell.trang_thai}
                  sx={{ 
                    height: '16px', 
                    fontSize: '0.5rem', 
                    fontWeight: 'bold',
                    backgroundColor: userCell.truc_thay_type === 'performer' ? '#ff9800' : 
                                   userCell.truc_thay_type === 'receiver' ? '#4caf50' : 
                                   (statusColor[userCell.trang_thai] || '#e0e0e0'),
                    color: userCell.truc_thay_type === 'performer' ? 'white' : 
                           userCell.truc_thay_type === 'receiver' ? 'white' : 'inherit',
                    border: userCell.ma_nhan_vien === auth?.employee?.ma_nhan_vien ? '1px solid #1976d2' : 'none'
                  }}
                />
              )}
            </Box>
            
            {/* Hiển thị trạng thái thời gian */}
            {timeStatus && (
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
                {timeStatus.status === 'before_day' && '📅'}
                {timeStatus.status === 'before_start' && '⏳'}
                {timeStatus.status === 'during' && '🕒'}
                {timeStatus.status === 'after' && '✅'}
                {timeStatus.status === 'overdue' && '⚠️'}
                {timeStatus.status === 'yesterday' && '📅'}
                {timeStatus.status === '2days' && '📅'}
                {timeStatus.status === 'older' && '📅'}
              </Typography>
            )}
            
            {/* Hiển thị cảnh báo chưa tới ngày/giờ */}
            {warningTooltip && (
              <Typography 
                variant="caption" 
                color="warning.main"
                sx={{ 
                  fontSize: '0.5rem',
                  fontWeight: 'bold',
                  position: 'absolute',
                  top: '1px',
                  right: '1px',
                }}
              >
                ⚠️
              </Typography>
            )}

            {/* Nút TRỰC THAY - ĐÃ CẬP NHẬT THEO YÊU CẦU */}
            {availableForTrucThay.length > 0 && !trucThayInfo.performer?.is_user_truc_thay && (
              <Button
                size="small"
                variant="contained"
                color="warning"
                sx={{
                  position: 'absolute',
                  bottom: 2,
                  right: 2,
                  padding: '0px 4px',
                  fontSize: '0.55rem',
                  minWidth: 'auto',
                  height: '16px',
                  textTransform: 'none',
                  fontWeight: 'bold',
                  borderRadius: '2px',
                  boxShadow: 'none',
                  '&:hover': {
                    backgroundColor: '#f57c00',
                    boxShadow: 'none'
                  }
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  // Mở dialog với tất cả người khác (trừ performer) để hiển thị đầy đủ
                  handleOpenTrucThayDialog(otherUsers);
                }}
                title={`Trực thay cho một trong số ${otherUsers.length} người`}
              >
                TRỰC THAY
              </Button>
            )}

            {/* NÚT HỦY TRỰC THAY TRONG CELL */}
            {hasTrucThay && trucThayInfo.performer?.is_user_truc_thay && 
                trucThayInfo.performer?.trang_thai === 'registered' && (
              <Button
                size="small"
                variant="contained"
                color="error"
                sx={{
                  position: 'absolute',
                  bottom: 2,
                  right: 2,
                  padding: '0px 4px',
                  fontSize: '0.55rem',
                  minWidth: 'auto',
                  height: '16px',
                  textTransform: 'none',
                  fontWeight: 'bold',
                  borderRadius: '2px',
                  boxShadow: 'none',
                  '&:hover': {
                    backgroundColor: '#d32f2f',
                    boxShadow: 'none'
                  }
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  handleCancelTrucThayLocal(trucThayInfo.performer);
                }}
                title="Hủy trực thay"
              >
                HỦY TRỰC THAY
              </Button>
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

          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<TodayIcon />}
              onClick={() => handleOpenDailySummary(today.toISOString().split('T')[0])}
            >
              Ca trong ngày
            </Button>
            <Button
              variant="outlined"
              size="small"
              startIcon={<SummarizeIcon />}
              onClick={handleOpenMonthlyReport}
            >
              Báo cáo tháng
            </Button>
            
            {/* Nút "Lịch sử yêu cầu điều chỉnh" (MỚI) */}
            <Badge
              badgeContent={unreadFeedbackCount}
              color="error"
              sx={{
                '& .MuiBadge-badge': {
                  fontSize: '0.6rem',
                  height: 16,
                  minWidth: 16,
                }
              }}
            >
              <Button
                variant="outlined"
                size="small"
                startIcon={<HistoryIcon />}
                onClick={handleOpenMyTimeAdjustments}
                sx={{ ml: 1 }}
              >
                Thông báo
              </Button>
            </Badge>
            
            {/* Nút "Ca trực thay của tôi" */}
            <Button
              variant="outlined"
              size="small"
              startIcon={<SwapHorizIcon />}
              onClick={() => {
                // Hiển thị danh sách ca trực thay
                if (myTrucThayShifts.length > 0) {
                  setDetailDialog({
                    open: true,
                    date: null,
                    shift: null,
                    users: [],
                    userCell: null,
                    isTrucThayList: true // Đánh dấu đang xem danh sách trực thay
                  });
                } else {
                  showSnackbar('Bạn chưa có ca trực thay nào', 'info');
                }
              }}
              sx={{ 
                ml: 1,
                backgroundColor: myTrucThayShifts.length > 0 ? '#fff3e0' : 'inherit'
              }}
            >
              <Badge 
                badgeContent={myTrucThayShifts.length} 
                color="warning"
                sx={{ mr: 1 }}
              >
                <SwapHorizIcon />
              </Badge>
              Ca trực thay
            </Button>
            
            <Box sx={{ display: 'flex', gap: 0.5 }}>
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
                label="Chưa tới ngày" 
                sx={{ 
                  backgroundColor: '#fff3e0', 
                  color: '#e65100',
                  fontSize: '0.65rem',
                  height: '20px',
                  border: '1px solid #ff9800'
                }} 
              />
              <Chip 
                size="small" 
                label="Quá giờ (cần yêu cầu)" 
                sx={{ 
                  backgroundColor: '#ffcdd2', 
                  color: '#b71c1c',
                  fontSize: '0.65rem',
                  height: '20px',
                  border: '1px solid #f44336'
                }} 
              />
              <Chip 
                size="small" 
                label="Trực thay (Bạn)" 
                sx={{ 
                  backgroundColor: '#ff9800', 
                  color: 'white',
                  fontSize: '0.65rem',
                  height: '20px'
                }} 
              />
              <Chip 
                size="small" 
                label="Được trực thay" 
                sx={{ 
                  backgroundColor: '#4caf50', 
                  color: 'white',
                  fontSize: '0.65rem',
                  height: '20px'
                }} 
              />
            </Box>
          </Box>
        </Box>

        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block', fontSize: '0.7rem' }}>
          • Click ô trống để đăng ký • Click ô đã có người để xem chi tiết • Chuột phải ô của bạn để check-in/out
          • Không thể checkin/out trước ngày và giờ làm việc • Xuất Excel trong báo cáo tháng
          • Nhấn nút <strong style={{color: '#ff9800'}}>TRỰC THAY</strong> để trực thay ca của người khác
          • <strong style={{color: '#ff9800'}}>Quá giờ</strong> sẽ chuyển sang gửi yêu cầu điều chỉnh giờ
          • <strong style={{color: '#4caf50'}}>Xanh lá</strong>: Người được trực thay • <strong style={{color: '#ff9800'}}>Cam</strong>: Bạn đang trực thay
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
              {registering ? 'Đang đăng ký...' : 
               loading ? 'Đang xử lý...' : 'Đang tải dữ liệu...'}
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
                    '& td': { borderTop: '2px solid #ff9800', borderBottom: '2px solid #ff9800' }
                  }),
                };

                return (
                  <TableRow key={day} sx={rowStyle}>
                    <TableCell sx={{ 
                      padding: '4px !important',
                      fontSize: '0.7rem',
                      textAlign: 'center',
                      borderRight: '1px solid rgba(0,0,0,0.1)',
                      position: 'relative'
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
                      {/* Nút xem tổng thời gian trong ngày */}
                      {rows.some(r => {
                        const rowDate = typeof r.ngay === 'string' ? r.ngay.split('T')[0] : r.ngay.toISOString().split('T')[0];
                        const currentDate = formatDate(year, month, day);
                        return rowDate === currentDate && r.ma_nhan_vien === auth?.employee?.ma_nhan_vien;
                      }) && (
                        <IconButton
                          size="small"
                          sx={{
                            position: 'absolute',
                            top: '2px',
                            right: '2px',
                            padding: '0px',
                            fontSize: '0.6rem',
                            minWidth: 'auto',
                            width: '16px',
                            height: '16px'
                          }}
                          onClick={() => handleOpenDailySummary(formatDate(year, month, day))}
                          title="Xem tổng thời gian làm"
                        >
                          <TimerIcon sx={{ fontSize: '0.6rem' }} />
                        </IconButton>
                      )}
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

      {/* Dialog xem chi tiết và tùy chọn */}
      <Dialog 
        open={detailDialog.open} 
        onClose={closeDetailDialog}
        maxWidth="md"
        fullWidth
      >
        {detailDialog.isTrucThayList ? (
          <>
            <DialogTitle>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <SwapHorizIcon color="warning" />
                <Typography variant="h6" color="warning.main">
                  📋 Ca trực thay của bạn ({myTrucThayShifts.length})
                </Typography>
              </Box>
            </DialogTitle>
            
            <DialogContent>
              {myTrucThayShifts.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <SwapHorizIcon sx={{ fontSize: 48, color: '#e0e0e0', mb: 2 }} />
                  <Typography variant="body1" color="text.secondary" gutterBottom>
                    Bạn chưa có ca trực thay nào
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Nhấn nút "TRỰC THAY" trên ca của người khác để đăng ký
                  </Typography>
                </Box>
              ) : (
                <List sx={{ maxHeight: 400, overflow: 'auto' }}>
                  {myTrucThayShifts.map((shift, index) => (
                    <ListItem
                      key={shift.id}
                      sx={{
                        borderBottom: '1px solid #f0f0f0',
                        backgroundColor: index % 2 === 0 ? '#fafafa' : 'white',
                        borderRadius: 1,
                        mb: 1,
                        alignItems: 'flex-start'
                      }}
                      secondaryAction={
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                          {shift.trang_thai === 'registered' && (
                            <Button
                              size="small"
                              variant="contained"
                              color="primary"
                              onClick={() => handleCheckinTrucThay(shift.id)}
                              disabled={loading}
                            >
                              Check-in
                            </Button>
                          )}
                          {shift.trang_thai === 'checked_in' && (
                            <Button
                              size="small"
                              variant="contained"
                              color="secondary"
                              onClick={() => handleCheckoutTrucThay(shift.id)}
                              disabled={loading}
                            >
                              Check-out
                            </Button>
                          )}
                          {shift.trang_thai === 'checked_out' && (
                            <Chip 
                              size="small" 
                              label="Đã hoàn thành" 
                              color="success" 
                              sx={{ fontSize: '0.75rem' }}
                            />
                          )}
                          {/* NÚT HỦY TRỰC THAY */}
                          {shift.can_cancel_truc_thay && shift.trang_thai === 'registered' && (
                            <Button
                              size="small"
                              variant="outlined"
                              color="error"
                              startIcon={<CancelIcon />}
                              onClick={() => handleCancelTrucThayLocal(shift)}
                              disabled={loading}
                            >
                              Hủy trực thay
                            </Button>
                          )}
                        </Box>
                      }
                    >
                      <ListItemAvatar>
                        <Avatar sx={{ bgcolor: '#ff9800' }}>
                          <SwapHorizIcon />
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={
                          <Box>
                            <Typography variant="subtitle2" fontWeight="bold">
                              {SHIFTS.find(s => s.key === shift.ca)?.label} - {shift.ngay ? new Date(shift.ngay).toLocaleDateString('vi-VN') : ''}
                            </Typography>
                            <Chip 
                              size="small"
                              label={
                                shift.trang_thai === 'registered' ? 'Chưa bắt đầu' :
                                shift.trang_thai === 'checked_in' ? 'Đang làm' :
                                shift.trang_thai === 'checked_out' ? 'Hoàn thành' : shift.trang_thai
                              }
                              color={
                                shift.trang_thai === 'registered' ? 'default' :
                                shift.trang_thai === 'checked_in' ? 'primary' :
                                shift.trang_thai === 'checked_out' ? 'success' : 'default'
                              }
                              sx={{ height: 20, fontSize: '0.65rem', mt: 0.5 }}
                            />
                          </Box>
                        }
                        secondary={
                          <Box sx={{ mt: 1 }}>
                            <Typography variant="body2" color="text.primary">
                              Trực thay cho: <strong>{shift.ten_nguoi_dang_ky}</strong> ({shift.ma_nguoi_dang_ky})
                            </Typography>
                            {shift.ly_do && (
                              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontStyle: 'italic' }}>
                                Lý do: {shift.ly_do}
                              </Typography>
                            )}
                            {shift.gio_vao && (
                              <Typography variant="caption" color="primary" sx={{ display: 'block', mt: 0.5 }}>
                                ⏰ Vào: {shift.gio_vao.substring(0, 5)}
                              </Typography>
                            )}
                            {shift.gio_ra && (
                              <Typography variant="caption" color="primary" sx={{ display: 'block' }}>
                                ⏰ Ra: {shift.gio_ra.substring(0, 5)} | Thời gian: {shift.thoi_gian_lam} giờ
                              </Typography>
                            )}
                            <Alert 
                              severity="warning" 
                              sx={{ 
                                mt: 1, 
                                py: 0, 
                                fontSize: '0.75rem',
                                backgroundColor: '#fff3e0'
                              }}
                            >
                              ⚠️ Giờ làm tính cho bạn!
                            </Alert>
                          </Box>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </DialogContent>
            
            <DialogActions sx={{ px: 3, pb: 2 }}>
              <Button onClick={closeDetailDialog} color="inherit">
                Đóng
              </Button>
            </DialogActions>
          </>
        ) : (
          <>
            <DialogTitle sx={{ pb: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <PeopleIcon color="primary" />
                  <Box>
                    <Typography variant="h6">
                      {SHIFTS.find(s => s.key === detailDialog.shift)?.label}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Ngày: {detailDialog.date ? new Date(detailDialog.date).toLocaleDateString('vi-VN') : ''}
                    </Typography>
                  </Box>
                </Box>
                {detailDialog.users.length < 6 && (
                  <Button 
                    variant="outlined" 
                    size="small"
                    onClick={() => {
                      if (detailDialog.date) {
                        const [y, m, d] = detailDialog.date.split('-');
                        const day = parseInt(d);
                        handleRegister(day, detailDialog.shift);
                      }
                    }}
                    disabled={registering || detailDialog.users.some(u => u.ma_nhan_vien === auth?.employee?.ma_nhan_vien)}
                  >
                    Đăng ký
                  </Button>
                )}
              </Box>
            </DialogTitle>
            
            <DialogContent>
              {/* Phần tùy chọn cho người dùng nếu đã đăng ký */}
              {detailDialog.userCell && (
                <Paper sx={{ p: 2, mb: 3, backgroundColor: '#e3f2fd', border: '1px solid #90caf9' }}>
                  <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                    🎯 Tùy chọn của bạn
                  </Typography>
              
                  {/* Hiển thị cảnh báo nếu chưa tới ngày hoặc giờ check-in */}
                  {detailDialog.userCell.trang_thai === 'registered' && (
                    (() => {
                      const check = canCheckIn(detailDialog.userCell);
                      if (!check.canCheckIn) {
                        return (
                          <Alert severity="warning" sx={{ mb: 2 }}>
                            {check.reason}
                          </Alert>
                        );
                      }
                      return null;
                    })()
                  )}
                  
                  {/* Hiển thị cảnh báo nếu chưa tới ngày hoặc giờ check-out */}
                  {detailDialog.userCell.trang_thai === 'checked_in' && (
                    (() => {
                      const check = canCheckOut(detailDialog.userCell);
                      if (!check.canCheckOut) {
                        return (
                          <Alert severity="warning" sx={{ mb: 2 }}>
                            {check.reason}
                          </Alert>
                        );
                      }
                      return null;
                    })()
                  )}
                  
                  <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
                    {/* Nút Check-in khi registered */}
                    {detailDialog.userCell.trang_thai === 'registered' && (
                      <Button
                        variant="contained"
                        color="primary"
                        startIcon={<LoginIcon />}
                        onClick={() => handleCheckin(detailDialog.userCell)}
                        disabled={loading || !canCheckIn(detailDialog.userCell).canCheckIn}
                        fullWidth
                      >
                        Check-in
                      </Button>
                    )}

                    {/* Nút Check-out khi checked_in */}
                    {detailDialog.userCell.trang_thai === 'checked_in' && (
                      (() => {
                        const checkoutResult = canCheckOut(detailDialog.userCell);
                        const isDisabled = loading || (!checkoutResult.canCheckOut && !checkoutResult.canRequestAdjustment);
                        return (
                          <Button
                            variant="contained"
                            color={checkoutResult.canRequestAdjustment ? "warning" : "secondary"}
                            startIcon={checkoutResult.canRequestAdjustment ? <AccessTimeIcon /> : <LogoutIcon />}
                            onClick={() => handleCheckout(detailDialog.userCell)}
                            disabled={isDisabled}
                            fullWidth
                          >
                            {checkoutResult.canRequestAdjustment ? 'Gửi yêu cầu check-out' : 'Check-out'}
                          </Button>
                        );
                      })()
                    )}

                    {/* Nút Hủy đăng ký - chỉ hiển thị nếu là ca thường (không phải trực thay) và registered */}
                    {detailDialog.userCell.trang_thai === 'registered' && !detailDialog.userCell.is_truc_thay && (
                      <Button
                        variant="outlined"
                        color="error"
                        startIcon={<CancelIcon />}
                        onClick={() => handleCancelRegistration(detailDialog.userCell)}
                        disabled={loading}
                        fullWidth
                      >
                        Hủy đăng ký
                      </Button>
                    )}

                    {/* Nút Hủy trực thay - chỉ hiển thị nếu là ca trực thay và registered và có thể hủy */}
                    {detailDialog.userCell.can_cancel_truc_thay && detailDialog.userCell.is_truc_thay && detailDialog.userCell.trang_thai === 'registered' && (
                      <Button
                        variant="outlined"
                        color="error"
                        startIcon={<CancelIcon />}
                        onClick={() => handleCancelTrucThayLocal(detailDialog.userCell)}
                        disabled={loading}
                        fullWidth
                      >
                        Hủy trực thay
                      </Button>
                    )}

                    {/* Thông báo trạng thái khi đã hoàn thành */}
                    {detailDialog.userCell.trang_thai === 'checked_out' && (
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
                        <CheckCircleIcon color="success" sx={{ mr: 1 }} />
                        <Typography color="text.secondary">
                          Đã hoàn thành ca làm
                        </Typography>
                      </Box>
                    )}
                  </Stack>
                  
                  {/* Thông tin chi tiết của bạn */}
                  <Box sx={{ mt: 2, p: 1.5, backgroundColor: 'white', borderRadius: 1 }}>
                    <Typography variant="body2" fontWeight="bold" gutterBottom>
                      Thông tin của bạn:
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                      <Typography variant="body2">
                        <strong>Trạng thái:</strong> {detailDialog.userCell.display_status || statusLabel[detailDialog.userCell.trang_thai]}
                      </Typography>
                      {detailDialog.userCell.nguoi_truc_thay && detailDialog.userCell.truc_thay_type === 'receiver' && (
                        <Typography variant="body2">
                          <strong>Người trực thay:</strong> {detailDialog.userCell.nguoi_truc_thay}
                        </Typography>
                      )}
                      {detailDialog.userCell.nguoi_duoc_truc_thay && detailDialog.userCell.truc_thay_type === 'performer' && (
                        <Typography variant="body2">
                          <strong>Đang trực thay cho:</strong> {detailDialog.userCell.nguoi_duoc_truc_thay}
                        </Typography>
                      )}
                      {detailDialog.userCell.gio_vao && (
                        <Typography variant="body2">
                          <strong>Giờ vào:</strong> {typeof detailDialog.userCell.gio_vao === 'string' ? detailDialog.userCell.gio_vao.substring(0, 5) : detailDialog.userCell.gio_vao}
                        </Typography>
                      )}
                      {detailDialog.userCell.gio_ra && (
                        <Typography variant="body2">
                          <strong>Giờ ra:</strong> {typeof detailDialog.userCell.gio_ra === 'string' ? detailDialog.userCell.gio_ra.substring(0, 5) : detailDialog.userCell.gio_ra}
                        </Typography>
                      )}
                      {detailDialog.userCell.thoi_gian_lam && (
                        <Typography variant="body2">
                          <strong>Thời gian làm:</strong> {Number(detailDialog.userCell.thoi_gian_lam).toFixed(2)} giờ ({formatHours(Number(detailDialog.userCell.thoi_gian_lam))})
                        </Typography>
                      )}
                    </Box>
                  </Box>
                </Paper>
              )}
              
              {/* Danh sách tất cả người đã đăng ký */}
              <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                👥 Danh sách người đã đăng ký ({detailDialog.users.length}/6)
              </Typography>
              
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
                        mb: 0.5,
                        alignItems: 'flex-start'
                      }}
                    >
                      <ListItemAvatar>
                        <Avatar sx={{ 
                          bgcolor: user.truc_thay_type === 'performer' ? '#ff9800' : 
                                   user.truc_thay_type === 'receiver' ? '#4caf50' :
                                   user.ma_nhan_vien === auth?.employee?.ma_nhan_vien ? '#1976d2' : '#9e9e9e',
                          fontWeight: 'bold'
                        }}>
                          {user.ten_nhan_vien.charAt(0)}
                        </Avatar>
                      </ListItemAvatar>
                      
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                            <Typography variant="body2" fontWeight="bold">
                              {user.ten_nhan_vien}
                            </Typography>
                            
                            {/* Badge loại trực thay */}
                            {user.truc_thay_type === 'receiver' && (
                              <Chip 
                                size="small"
                                label="Được trực thay"
                                sx={{ 
                                  height: '18px', 
                                  fontSize: '0.6rem',
                                  backgroundColor: '#4caf50',
                                  color: 'white'
                                }}
                              />
                            )}
                            {user.truc_thay_type === 'performer' && (
                              <Chip 
                                size="small"
                                label="Đang trực thay"
                                sx={{ 
                                  height: '18px', 
                                  fontSize: '0.6rem',
                                  backgroundColor: '#ff9800',
                                  color: 'white'
                                }}
                              />
                            )}
                            
                            {/* Badge "Bạn" nếu là user hiện tại */}
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
                            {/* Dòng trạng thái và mã nhân viên */}
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                              <Chip 
                                size="small"
                                label={user.display_status || statusLabel[user.trang_thai] || user.trang_thai}
                                sx={{ 
                                  fontSize: '0.6rem',
                                  height: '18px',
                                  backgroundColor: user.truc_thay_type === 'performer' ? '#fff3e0' :
                                                   user.truc_thay_type === 'receiver' ? '#e8f5e8' :
                                                   (statusColor[user.trang_thai] || '#e0e0e0'),
                                  color: user.truc_thay_type === 'performer' ? '#e65100' :
                                         user.truc_thay_type === 'receiver' ? '#2e7d32' : 'inherit',
                                  fontWeight: 'bold'
                                }}
                              />
                              <Typography variant="caption" color="text.secondary">
                                Mã: {user.ma_nhan_vien}
                              </Typography>
                            </Box>
                            
                            {/* Hiển thị thông tin trực thay chi tiết */}
                            {user.truc_thay_type === 'receiver' && user.nguoi_truc_thay && (
                              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                                👤 Được trực thay bởi: <strong>{user.nguoi_truc_thay}</strong>
                              </Typography>
                            )}
                            {user.truc_thay_type === 'receiver' && !user.nguoi_truc_thay && (
                              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, fontStyle: 'italic' }}>
                                (Đang chờ trực thay)
                              </Typography>
                            )}
                            
                            {user.truc_thay_type === 'performer' && user.nguoi_duoc_truc_thay && (
                              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                                👤 Đang trực thay cho: <strong>{user.nguoi_duoc_truc_thay}</strong>
                              </Typography>
                            )}
                            {user.truc_thay_type === 'performer' && !user.nguoi_duoc_truc_thay && (
                              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, fontStyle: 'italic' }}>
                                (Đang chờ duyệt)
                              </Typography>
                            )}
                            
                            {/* Giờ vào/ra và thời gian làm */}
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
                                Thời gian làm: {Number(user.thoi_gian_lam).toFixed(2)} giờ ({formatHours(Number(user.thoi_gian_lam))})
                              </Typography>
                            )}
                            
                            {/* Nút hủy trực thay (chỉ cho người trực thay và khi chưa bắt đầu) */}
                            {user.can_cancel_truc_thay && user.is_truc_thay && user.trang_thai === 'registered' && (
                              <Button
                                size="small"
                                variant="outlined"
                                color="error"
                                startIcon={<CancelIcon />}
                                onClick={() => handleCancelTrucThayLocal(user)}
                                disabled={loading}
                                sx={{ mt: 1, width: 'fit-content' }}
                              >
                                Hủy trực thay
                              </Button>
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
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* Dialog yêu cầu điều chỉnh giờ (MỚI) */}
      <Dialog 
        open={timeAdjustmentDialog.open} 
        onClose={() => setTimeAdjustmentDialog({ open: false, cell: null, loaiYeuCau: 'checkout', thoiGianDeXuat: '', lyDo: '', shiftEnd: '' })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AccessTimeIcon color="warning" />
            <Typography variant="h6">
              {timeAdjustmentDialog.loaiYeuCau === 'checkin' ? 'Yêu cầu điều chỉnh giờ check-in' : 'Yêu cầu điều chỉnh giờ check-out'}
            </Typography>
          </Box>
        </DialogTitle>
        
        <DialogContent>
          {timeAdjustmentDialog.cell && (
            <>
              <Paper sx={{ p: 2, mb: 2, backgroundColor: '#fff3e0' }}>
                <Typography variant="body2" fontWeight="bold" gutterBottom>
                  Thông tin ca làm việc:
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="body2">
                      <strong>Ngày:</strong> {new Date(timeAdjustmentDialog.cell.ngay).toLocaleDateString('vi-VN')}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Ca:</strong> {SHIFTS.find(s => s.key === timeAdjustmentDialog.cell.ca)?.label}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2">
                      <strong>Giờ vào:</strong> {timeAdjustmentDialog.cell.gio_vao || '--:--'}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Giờ kết thúc ca:</strong> {timeAdjustmentDialog.shiftEnd}
                    </Typography>
                  </Grid>
                </Grid>
                {timeAdjustmentDialog.daysLate > 0 && (
                  <Alert severity="info" sx={{ mt: 1 }}>
                    Ca này đã qua {timeAdjustmentDialog.daysLate} ngày
                  </Alert>
                )}
              </Paper>
              
              <Alert severity="warning" sx={{ mb: 2 }}>
                <strong>LƯU Ý:</strong> Bạn đã quá thời gian cho phép 
                {timeAdjustmentDialog.loaiYeuCau === 'checkin' ? ' check-in' : ' check-out'}. 
                Vui lòng nhập thời gian thực tế check-out trong ngày hôm đó và lý do để gửi yêu cầu lên admin duyệt.
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
            onClick={() => setTimeAdjustmentDialog({ open: false, cell: null, loaiYeuCau: 'checkout', thoiGianDeXuat: '', lyDo: '', shiftEnd: '' })} 
            color="inherit"
          >
            Hủy
          </Button>
          <Button 
            variant="contained" 
            color="warning"
            onClick={handleSendTimeAdjustmentRequest}
            disabled={loading || !timeAdjustmentDialog.thoiGianDeXuat}
            startIcon={<AccessTimeIcon />}
          >
            Gửi yêu cầu
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog lịch sử yêu cầu điều chỉnh của tôi (MỚI) */}
      <Dialog
        open={myTimeAdjustmentsDialog.open}
        onClose={() => setMyTimeAdjustmentsDialog(prev => ({ ...prev, open: false }))}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <HistoryIcon color="primary" />
            <Typography variant="h6">
              Lịch sử yêu cầu điều chỉnh giờ
            </Typography>
          </Box>
        </DialogTitle>
        
        <DialogContent>
          {myTimeAdjustmentsDialog.loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress size={28} />
            </Box>
          ) : myTimeAdjustmentsDialog.requests.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <AccessTimeIcon sx={{ fontSize: 48, color: '#e0e0e0', mb: 2 }} />
              <Typography variant="body1" color="text.secondary">
                Bạn chưa có yêu cầu điều chỉnh giờ nào
              </Typography>
            </Box>
          ) : (
            <List sx={{ maxHeight: 400, overflow: 'auto' }}>
              {myTimeAdjustmentsDialog.requests.map((req, index) => (
                <ListItem
                  key={req.id}
                  sx={{
                    borderBottom: '1px solid #f0f0f0',
                    backgroundColor: index % 2 === 0 ? '#fafafa' : 'white',
                    borderRadius: 1,
                    mb: 1,
                    flexDirection: 'column',
                    alignItems: 'stretch',
                    py: 1.5
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="subtitle2" fontWeight="bold">
                      {req.ten_ca} - {new Date(req.ngay).toLocaleDateString('vi-VN')}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {/* 👇 Thêm icon phản hồi nếu có ghi chú admin */}
                      {req.ghi_chu_admin && (
                        <Tooltip title="Có phản hồi từ admin">
                          <MessageIcon fontSize="small" color="primary" />
                        </Tooltip>
                      )}
                      <Chip
                        size="small"
                        label={req.trang_thai_text}
                        color={
                          req.trang_thai === 'approved' ? 'success' :
                          req.trang_thai === 'rejected' ? 'error' : 'warning'
                        }
                        sx={{ height: 20, fontSize: '0.7rem' }}
                      />
                    </Box>
                  </Box>
                  
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 1 }}>
                    <Typography variant="caption">
                      <strong>Loại:</strong> {req.ten_loai_yeu_cau}
                    </Typography>
                    <Typography variant="caption">
                      <strong>Giờ đề xuất:</strong> {req.thoi_gian_de_xuat?.substring(0,5)}
                    </Typography>
                    {req.thoi_gian_dieu_chinh && (
                      <Typography variant="caption" color="success.main">
                        <strong>Đã điều chỉnh:</strong> {req.thoi_gian_dieu_chinh.substring(0,5)}
                      </Typography>
                    )}
                  </Box>
                  
                  <Typography variant="caption" sx={{ mb: 1 }}>
                    <strong>Lý do:</strong> {req.ly_do}
                  </Typography>
                  
                  {req.ghi_chu_admin && (
                    <Typography variant="caption" color={req.trang_thai === 'rejected' ? 'error.main' : 'info.main'}>
                      <strong>Phản hồi admin:</strong> {req.ghi_chu_admin}
                    </Typography>
                  )}
                </ListItem>
              ))}
            </List>
          )}
        </DialogContent>
        
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setMyTimeAdjustmentsDialog(prev => ({ ...prev, open: false }))} color="inherit">
            Đóng
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog cảnh báo checkout sớm (MỚI) */}
      <Dialog
        open={earlyCheckoutDialog.open}
        onClose={() => setEarlyCheckoutDialog({ open: false, cell: null, minutes: 0 })}
      >
        <DialogTitle>
          <WarningIcon color="warning" sx={{ mr: 1, verticalAlign: 'middle' }} />
          Cảnh báo checkout sớm
        </DialogTitle>
        <DialogContent>
          <Typography>
            Bạn vừa check‑in được <strong>{earlyCheckoutDialog.minutes} phút</strong>.
            Bạn có chắc muốn checkout sớm?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEarlyCheckoutDialog({ open: false, cell: null, minutes: 0 })}>
            Hủy
          </Button>
          <Button
            variant="contained"
            color="warning"
            onClick={async () => {
              const cell = earlyCheckoutDialog.cell;
              setEarlyCheckoutDialog({ open: false, cell: null, minutes: 0 });
              await doCheckout(cell);
              closeDetailDialog();
            }}
          >
            Vẫn checkout
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog tổng thời gian làm trong ngày */}
      <Dialog 
        open={dailySummaryDialog.open} 
        onClose={closeDailySummaryDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TimerIcon color="primary" />
            <Typography variant="h6">
              Tổng thời gian làm việc
            </Typography>
          </Box>
        </DialogTitle>
        
        <DialogContent>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Ngày: {dailySummaryDialog.date ? new Date(dailySummaryDialog.date).toLocaleDateString('vi-VN') : ''}
          </Typography>
          
          {dailySummaryDialog.summary ? (
            <>
              <Card sx={{ mb: 3, backgroundColor: '#e3f2fd' }}>
                <CardContent>
                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="text.secondary">
                        Số ca đã làm
                      </Typography>
                      <Typography variant="h5" fontWeight="bold" color="primary">
                        {dailySummaryDialog.summary.so_ca_da_lam}
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="text.secondary">
                        Tổng thời gian
                      </Typography>
                      <Typography variant="h5" fontWeight="bold" color="primary">
                        {dailySummaryDialog.summary.tong_thoi_gian_lam} giờ
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        ({dailySummaryDialog.summary.tong_thoi_gian_gio})
                      </Typography>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
              
              <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                Chi tiết các ca:
              </Typography>
              
              {dailySummaryDialog.details.length > 0 ? (
                <TableContainer component={Paper} sx={{ maxHeight: 300 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Ca</TableCell>
                        <TableCell>Giờ vào</TableCell>
                        <TableCell>Giờ ra</TableCell>
                        <TableCell>Thời gian</TableCell>
                        <TableCell>Trạng thái</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {dailySummaryDialog.details.map((detail, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            {SHIFTS.find(s => s.key === detail.ca)?.label || detail.ca}
                          </TableCell>
                          <TableCell>
                            {detail.gio_vao ? (typeof detail.gio_vao === 'string' ? detail.gio_vao.substring(0, 5) : detail.gio_vao) : '--:--'}
                          </TableCell>
                          <TableCell>
                            {detail.gio_ra ? (typeof detail.gio_ra === 'string' ? detail.gio_ra.substring(0, 5) : detail.gio_ra) : '--:--'}
                          </TableCell>
                          <TableCell>
                            {detail.thoi_gian_lam ? `${Number(detail.thoi_gian_lam).toFixed(2)} giờ` : '--'}
                          </TableCell>
                          <TableCell>
                            <Chip 
                              size="small"
                              label={statusLabel[detail.trang_thai] || detail.trang_thai}
                              sx={{ 
                                fontSize: '0.6rem',
                                height: '20px',
                                backgroundColor: statusColor[detail.trang_thai] || '#e0e0e0',
                              }}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                  Không có dữ liệu chi tiết
                </Typography>
              )}
            </>
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
              Không có dữ liệu làm việc cho ngày này
            </Typography>
          )}
        </DialogContent>
        
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button 
            variant="outlined" 
            onClick={() => {
              const date = new Date(dailySummaryDialog.date);
              date.setDate(date.getDate() - 1);
              handleOpenDailySummary(date.toISOString().split('T')[0]);
            }}
          >
            Ngày trước
          </Button>
          <Button 
            variant="outlined" 
            onClick={() => {
              const date = new Date(dailySummaryDialog.date);
              date.setDate(date.getDate() + 1);
              handleOpenDailySummary(date.toISOString().split('T')[0]);
            }}
          >
            Ngày sau
          </Button>
          <Button onClick={closeDailySummaryDialog} color="inherit">
            Đóng
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog báo cáo tháng (có thêm nút xuất Excel) */}
      <Dialog 
        open={monthlyReportDialog.open} 
        onClose={closeMonthlyReportDialog}
        maxWidth="lg"
        fullWidth
        maxHeight="80vh"
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <SummarizeIcon color="primary" />
              <Typography variant="h6">
                Báo cáo tháng {monthlyReportDialog.month}/{monthlyReportDialog.year}
              </Typography>
            </Box>
            {/* NÚT XUẤT EXCEL CHỈ HIỆN Ở ĐÂY - TRONG DIALOG BÁO CÁO THÁNG */}
            <Button
              variant="contained"
              startIcon={<DownloadIcon />}
              onClick={handleExportExcel}
              disabled={loading || !monthlyReportDialog.report}
              sx={{
                backgroundColor: '#2e7d32',
                '&:hover': {
                  backgroundColor: '#1b5e20',
                }
              }}
            >
              Xuất Excel
            </Button>
          </Box>
        </DialogTitle>
        
        <DialogContent>
          {monthlyReportDialog.report ? (
            <>
              <Card sx={{ mb: 3, backgroundColor: '#e8f5e8' }}>
                <CardContent>
                  <Grid container spacing={2}>
                    <Grid item xs={4}>
                      <Typography variant="body2" color="text.secondary">
                        Tổng số ngày làm
                      </Typography>
                      <Typography variant="h5" fontWeight="bold" color="primary">
                        {monthlyReportDialog.report.monthly_summary.tong_so_ngay}
                      </Typography>
                    </Grid>
                    <Grid item xs={4}>
                      <Typography variant="body2" color="text.secondary">
                        Tổng số ca đã làm
                      </Typography>
                      <Typography variant="h5" fontWeight="bold" color="primary">
                        {monthlyReportDialog.report.monthly_summary.tong_so_ca}
                      </Typography>
                    </Grid>
                    <Grid item xs={4}>
                      <Typography variant="body2" color="text.secondary">
                        Tổng thời gian tháng
                      </Typography>
                      <Typography variant="h5" fontWeight="bold" color="primary">
                        {monthlyReportDialog.report.monthly_summary.tong_thoi_gian_thang} giờ
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        ({monthlyReportDialog.report.monthly_summary.tong_thoi_gian_thang_gio})
                      </Typography>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
              
              <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                Chi tiết theo ngày:
              </Typography>
              
              {monthlyReportDialog.report.daily_reports.length > 0 ? (
                <TableContainer component={Paper} sx={{ maxHeight: 400 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Ngày</TableCell>
                        <TableCell>Số ca</TableCell>
                        <TableCell>Tổng thời gian</TableCell>
                        <TableCell>Chi tiết ca</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {monthlyReportDialog.report.daily_reports.map((dayReport, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            {new Date(dayReport.ngay).toLocaleDateString('vi-VN')}
                          </TableCell>
                          <TableCell>
                            {dayReport.so_ca_da_lam}
                          </TableCell>
                          <TableCell>
                            <Typography fontWeight="bold">
                              {dayReport.tong_thoi_gian_lam} giờ
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {dayReport.formatted_time}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="caption">
                              {dayReport.chi_tiet_ca ? dayReport.chi_tiet_ca.split(';').map(ca => {
                                const [caName, hours] = ca.split(':');
                                const shiftName = SHIFTS.find(s => s.key === caName)?.label || caName;
                                return `${shiftName}: ${Number(hours).toFixed(1)}h`;
                              }).join(', ') : '--'}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                  Không có dữ liệu làm việc trong tháng này
                </Typography>
              )}
            </>
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
              Đang tải báo cáo...
            </Typography>
          )}
        </DialogContent>
        
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={closeMonthlyReportDialog} color="inherit">
            Đóng
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog trực thay */}
      <Dialog 
        open={trucThayDialog.open} 
        onClose={() => setTrucThayDialog({ open: false, usersList: [], selectedUser: null, lyDo: '' })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <SwapHorizIcon color="warning" />
            <Typography variant="h6">Đăng ký trực thay</Typography>
          </Box>
        </DialogTitle>

        <DialogContent>
          <Typography variant="body2" gutterBottom>
            Chọn người bạn muốn trực thay:
          </Typography>

          <RadioGroup
            value={trucThayDialog.selectedUser?.id || ''}
            onChange={(e) => {
              const selectedId = parseInt(e.target.value);
              const selected = trucThayDialog.usersList.find(u => u.id === selectedId);
              setTrucThayDialog(prev => ({ ...prev, selectedUser: selected }));
            }}
          >
            {trucThayDialog.usersList.map(user => {
              // Sử dụng hàm canUserBeTrucThay đã định nghĩa
              const canSelect = canUserBeTrucThay(user);
              let disabledReason = '';
              if (!canSelect) {
                if (user.truc_thay_type === 'receiver') {
                  disabledReason = 'Đã có người trực thay';
                } else if (user.trang_thai !== 'registered') {
                  disabledReason = 'Ca đã bắt đầu hoặc kết thúc';
                } else {
                  // Trường hợp quá giờ nhưng trạng thái vẫn registered
                  disabledReason = 'Đã quá giờ bắt đầu ca';
                }
              }
              return (
                <FormControlLabel
                  key={user.id}
                  value={user.id}
                  control={<Radio />}
                  disabled={!canSelect}
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <span>{user.ten_nhan_vien} ({user.ma_nhan_vien})</span>
                      {!canSelect && (
                        <Chip
                          size="small"
                          label={disabledReason}
                          color="default"
                          sx={{ height: 20, fontSize: '0.65rem' }}
                        />
                      )}
                    </Box>
                  }
                />
              );
            })}
          </RadioGroup>

          <TextField
            fullWidth
            multiline
            rows={3}
            label="Lý do muốn trực thay (tùy chọn)"
            value={trucThayDialog.lyDo}
            onChange={(e) => setTrucThayDialog(prev => ({ ...prev, lyDo: e.target.value }))}
            sx={{ mt: 2 }}
            placeholder="Ví dụ: Tôi rảnh vào giờ này, muốn hỗ trợ đồng nghiệp..."
          />
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setTrucThayDialog({ open: false, usersList: [], selectedUser: null, lyDo: '' })}>
            Hủy
          </Button>
          <Button
            variant="contained"
            color="warning"
            onClick={handleTrucThay}
            disabled={!trucThayDialog.selectedUser}
            startIcon={<SwapHorizIcon />}
          >
            Xác nhận trực thay
          </Button>
        </DialogActions>
      </Dialog>

      {/* Menu ngữ cảnh (chuột phải) */}
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
            minWidth: '180px'
          }
        }}
      >
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

        {contextMenu?.cell?.trang_thai === 'registered' && (
          <MenuItem 
            onClick={() => {
              handleCheckin(contextMenu.cell);
              closeContextMenu();
            }}
            sx={{ 
              color: '#d84315', 
              fontSize: '0.8rem', 
              py: 0.75,
            }}
            disabled={!canCheckIn(contextMenu.cell).canCheckIn}
          >
            🔔 Check-in
            {!canCheckIn(contextMenu.cell).canCheckIn && (
              <Typography variant="caption" color="text.secondary" sx={{ ml: 1, fontSize: '0.65rem' }}>
                ({canCheckIn(contextMenu.cell).reason?.includes('Chưa tới ngày') ? 'Chưa tới ngày' : 
                  canCheckIn(contextMenu.cell).reason?.includes('Chưa tới giờ') ? 'Chưa tới giờ' : 'Quá giờ'})
              </Typography>
            )}
          </MenuItem>
        )}
        
        {contextMenu?.cell?.trang_thai === 'checked_in' && (
          (() => {
            const checkoutResult = canCheckOut(contextMenu.cell);
            const isDisabled = !checkoutResult.canCheckOut && !checkoutResult.canRequestAdjustment;
            return (
              <MenuItem 
                onClick={() => {
                  handleCheckout(contextMenu.cell);
                  closeContextMenu();
                }}
                sx={{ 
                  color: checkoutResult.canRequestAdjustment ? '#ed6c02' : '#2e7d32', 
                  fontSize: '0.8rem', 
                  py: 0.75 
                }}
                disabled={isDisabled}
              >
                {checkoutResult.canRequestAdjustment ? '⏰ Gửi yêu cầu check-out' : '✅ Check-out'}
                {!checkoutResult.canCheckOut && (
                  <Typography variant="caption" color="text.secondary" sx={{ ml: 1, fontSize: '0.65rem' }}>
                    ({checkoutResult.reason})
                  </Typography>
                )}
              </MenuItem>
            );
          })()
        )}
        
        {contextMenu?.cell?.trang_thai === 'checked_out' && (
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
        autoHideDuration={4000}
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