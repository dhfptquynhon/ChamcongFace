import React, { useState, useEffect, useContext, useCallback } from 'react';
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
  Grid,
  Alert,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  CircularProgress,
  Card,
  CardContent,
  Stack,
  Chip,
  IconButton,
  Tooltip,
  Button,
  Checkbox,
  FormControlLabel,
  Tabs,
  Tab,
  Avatar,
  Badge,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  alpha,
  Divider,
  MenuItem,
  FormControl,
  InputLabel,
  RadioGroup,
  Radio,
  FormLabel,
  FormHelperText,
  Switch
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  AccessTime as AccessTimeIcon,
  Work as WorkIcon,
  Person as PersonIcon,
  CalendarMonth as CalendarMonthIcon,
  Download as DownloadIcon,
  CheckBox as CheckBoxIcon,
  CheckBoxOutlineBlank as CheckBoxOutlineBlankIcon,
  People as PeopleIcon,
  HowToReg as HowToRegIcon,
  EventAvailable as EventAvailableIcon,
  Visibility as VisibilityIcon,
  Search as SearchIcon,
  Close as CloseIcon,
  Timeline as TimelineIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Pending as PendingIcon,
  History as HistoryIcon,
  NotificationsActive as NotificationsActiveIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  VpnKey as VpnKeyIcon,
  AdminPanelSettings as AdminPanelSettingsIcon,
  SwapHoriz as SwapHorizIcon,
  Settings as SettingsIcon,
  DeleteSweep as DeleteSweepIcon
} from '@mui/icons-material';
import AuthContext from '../context/AuthContext';
import axios from 'axios';
import * as XLSX from 'xlsx-js-style';

// =======================
// Tab Panel Component
// =======================
function TabPanel(props) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`admin-tabpanel-${index}`}
      aria-labelledby={`admin-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ pt: 2.5 }}>
          {children}
        </Box>
      )}
    </div>
  );
}



// =======================
// Excel Export Helpers (giữ nguyên như cũ)
// =======================
const getWeekdayVN = (dateStr) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const days = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
  return days[date.getDay()];
};

const isSunday = (dateStr) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).getDay() === 0;
};

const getAllDatesInMonth = (year, month) => {
  const dates = [];
  const lastDay = new Date(year, month, 0).getDate();
  for (let d = 1; d <= lastDay; d++) {
    dates.push(
      `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    );
  }
  return dates;
};

const getEmployeeAbbr = (employee) => {
  if (!employee) return '';
  const nameParts = employee.ten_nhan_vien.split(' ');
  return nameParts[nameParts.length - 1] || employee.ma_nhan_vien;
};

const EMPLOYEE_COLORS = [
  '#1976d2', '#d32f2f', '#388e3c', '#f9a825',
  '#7b1fa2', '#00838f', '#5d4037', '#c2185b',
];

const ensureCell = (ws, r, c) => {
  const addr = XLSX.utils.encode_cell({ r, c });
  if (!ws[addr]) ws[addr] = { t: 's', v: '' };
  return ws[addr];
};

const exportChamCongExcel = (
  attendanceData,
  employees,
  selectedEmployees,
  year,
  month
) => {
  if (!attendanceData || selectedEmployees.length === 0) {
    alert('Không có dữ liệu để xuất Excel');
    return;
  }

  const sortedEmployees = selectedEmployees
    .map(id => employees.find(emp => emp.id === id))
    .filter(Boolean);

  const allDates = getAllDatesInMonth(year, month);
  const dataMap = {};

  allDates.forEach(d => {
    dataMap[d] = {
      ca1_names: [],
      ca2_names: [],
      ca3_names: [],
      ca4_names: [],
      ca1_display: '',
      ca2_display: '',
      ca3_display: '',
      ca4_display: '',
      ghi_chu: '',
      total_hours: 0,
      employee_hours: {},
      note_details: []
    };
  });

  sortedEmployees.forEach(emp => {
    const empAbbr = getEmployeeAbbr(emp);
    (attendanceData[emp.id] || []).forEach(item => {
      const row = dataMap[item.date];
      if (!row) return;

      if (item.ca1) row.ca1_names.push(empAbbr);
      if (item.ca2) row.ca2_names.push(empAbbr);
      if (item.ca3) row.ca3_names.push(empAbbr);
      if (item.ca4) row.ca4_names.push(empAbbr);

      const empHours = item.tong_gio || 0;
      row.employee_hours[emp.id] = (row.employee_hours[emp.id] || 0) + empHours;
      row.total_hours += empHours;

      if (empHours > 0) {
        row.note_details.push(`${empAbbr}: ${empHours.toFixed(2)}h`);
      }
    });
  });

  allDates.forEach(d => {
    const row = dataMap[d];
    row.ca1_display = row.ca1_names.length > 0 ? row.ca1_names.join(', ') : '';
    row.ca2_display = row.ca2_names.length > 0 ? row.ca2_names.join(', ') : '';
    row.ca3_display = row.ca3_names.length > 0 ? row.ca3_names.join(', ') : '';
    row.ca4_display = row.ca4_names.length > 0 ? row.ca4_names.join(', ') : '';
    
    if (row.note_details.length > 0) {
      row.ghi_chu = row.note_details.join('; ');
    }
  });

  const wsData = [
    ['Phân Hiệu Trường ĐH FPT tại Tỉnh Bình Định'],
    ['Khu đô thị mới An Phú Thịnh, Phường Quy Nhơn Đông, Tỉnh Gia Lai, Việt Nam'],
    [],
    [`BẢNG CHẤM CÔNG CTV-IT THÁNG ${String(month).padStart(2, '0')}/${year}`],
    [],
    [
      'Ngày',
      'Thứ',
      'Ca 1 (7:00-9:30)',
      'Ca 2 (9:30-12:30)',
      'Ca 3 (12:30-15:00)',
      'Ca 4 (15:00-17:30)',
      ...sortedEmployees.map(e => `${getEmployeeAbbr(e)} (giờ)`),
      'Ghi chú',
      'Tổng giờ',
      'Thành tiền (VNĐ)'
    ]
  ];

  const dataStartRow = 5;
  const dataEndRow = dataStartRow + allDates.length - 1;

  allDates.forEach(d => {
    const date = new Date(d);
    const r = dataMap[d];

    wsData.push([
      `${date.getDate()}/${date.getMonth() + 1}/${year}`,
      getWeekdayVN(d),
      r.ca1_display,
      r.ca2_display,
      r.ca3_display,
      r.ca4_display,
      ...sortedEmployees.map(e => {
        const hours = r.employee_hours[e.id] || 0;
        return hours > 0 ? hours.toFixed(2) : '';
      }),
      r.ghi_chu || '',
      r.total_hours > 0 ? r.total_hours.toFixed(2) : '',
      r.total_hours > 0 ? (r.total_hours * 22000).toLocaleString('vi-VN') : ''
    ]);
  });

  wsData.push([]);
  
  const employeeTotals = {};
  sortedEmployees.forEach(e => {
    let total = 0;
    allDates.forEach(d => {
      total += dataMap[d]?.employee_hours[e.id] || 0;
    });
    employeeTotals[e.id] = total;
  });

  sortedEmployees.forEach((e, i) => {
    const total = employeeTotals[e.id];
    if (total > 0) {
      const rowData = [
        '', '', '', '', '', '',
        ...sortedEmployees.map((emp, idx) => idx === i ? total.toFixed(2) : ''),
        `Tổng ${getEmployeeAbbr(e)}`,
        total.toFixed(2),
        (total * 22000).toLocaleString('vi-VN')
      ];
      while (rowData.length < 9 + sortedEmployees.length) {
        rowData.push('');
      }
      wsData.push(rowData);
    }
  });

  const grandTotal = Object.values(employeeTotals).reduce((sum, val) => sum + val, 0);
  
  wsData.push([]);
  const grandTotalRow = [
    '', '', '', '', '', '',
    ...Array(sortedEmployees.length).fill(''),
    'TỔNG CỘNG',
    grandTotal.toFixed(2),
    (grandTotal * 22000).toLocaleString('vi-VN')
  ];
  while (grandTotalRow.length < 9 + sortedEmployees.length) {
    grandTotalRow.push('');
  }
  wsData.push(grandTotalRow);

  wsData.push([]);
  wsData.push(['', '', '', '', '', '', ...Array(sortedEmployees.length).fill(''), '',
    'Chú ý: bạn làm tối đa 91h thôi, không được làm 2 ca liên tiếp'
  ]);

  wsData.push([]);
  wsData.push(['', 'Cộng tác viên IT', '', '', '', '', 'Người lập biểu']);

  const ws = XLSX.utils.aoa_to_sheet(wsData);

  const merges = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 8 + sortedEmployees.length } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 8 + sortedEmployees.length } },
    { s: { r: 3, c: 0 }, e: { r: 3, c: 8 + sortedEmployees.length } }
  ];
  ws['!merges'] = merges;

  const colWidths = [
    { wch: 12 }, { wch: 10 }, { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 20 },
    ...Array(sortedEmployees.length).fill({ wch: 8 }),
    { wch: 20 }, { wch: 10 }, { wch: 15 }
  ];
  ws['!cols'] = colWidths;

  allDates.forEach((d, i) => {
    if (isSunday(d)) {
      for (let c = 0; c < 9 + sortedEmployees.length; c++) {
        const cell = ensureCell(ws, dataStartRow + i, c);
        cell.s = {
          fill: { fgColor: { rgb: 'FFFF00' } },
          alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
          border: {
            top: { style: 'thin' },
            bottom: { style: 'thin' },
            left: { style: 'thin' },
            right: { style: 'thin' }
          }
        };
      }
    }
  });

  for (let c = 0; c < 9 + sortedEmployees.length; c++) {
    const cell = ensureCell(ws, dataEndRow, c);
    cell.s = {
      ...(cell.s || {}),
      border: {
        ...(cell.s?.border || {}),
        bottom: { style: 'thick', color: { rgb: '000000' } }
      }
    };
  }

  for (let c = 0; c < 9 + sortedEmployees.length; c++) {
    const cell = ensureCell(ws, 4, c);
    cell.s = {
      font: { bold: true, color: { rgb: 'FFFFFF' } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      fill: { fgColor: { rgb: '1976D2' } },
      border: {
        top: { style: 'thin' },
        bottom: { style: 'thin' },
        left: { style: 'thin' },
        right: { style: 'thin' }
      }
    };
  }

  for (let r = dataStartRow; r <= dataEndRow; r++) {
    for (let c = 0; c < 9 + sortedEmployees.length; c++) {
      const cell = ensureCell(ws, r, c);
      cell.s = {
        ...(cell.s || {}),
        alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
        border: {
          top: { style: 'thin' },
          bottom: { style: 'thin' },
          left: { style: 'thin' },
          right: { style: 'thin' }
        }
      };
    }
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, `Tháng ${month}`);
  
  const fileName = `Bảng chấm công CTV IT tháng ${month} năm ${year}.xlsx`;
  XLSX.writeFile(wb, fileName);
};

// =======================
// TrucThay Requests Compact Component (Cập nhật)
// =======================
const TrucThayRequestsCompact = ({ 
  requests, 
  pendingCount, 
  onProcessRequest, 
  loading,
  month,
  year,
  fetchAllTrucThay
}) => {
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [processDialog, setProcessDialog] = useState({ open: false, approve: true });
  const [allRecords, setAllRecords] = useState([]);
  const [loadingAll, setLoadingAll] = useState(false);
  const [tabValue, setTabValue] = useState(0); // 0: chờ duyệt, 1: lịch sử

  const getStatusChip = (status) => {
    switch(status) {
      case 'pending':
        return <Chip size="small" icon={<PendingIcon />} label="Chờ duyệt" color="warning" sx={{ height: 22, '& .MuiChip-icon': { fontSize: '0.8rem' } }} />;
      case 'active':
        return <Chip size="small" icon={<CheckCircleIcon />} label="Đã duyệt" color="success" sx={{ height: 22, '& .MuiChip-icon': { fontSize: '0.8rem' } }} />;
      case 'completed':
        return <Chip size="small" icon={<CheckCircleIcon />} label="Hoàn thành" color="info" sx={{ height: 22, '& .MuiChip-icon': { fontSize: '0.8rem' } }} />;
      default:
        return <Chip size="small" label={status} />;
    }
  };

  const handleOpenProcessDialog = (request, approve) => {
    setSelectedRequest(request);
    setProcessDialog({ open: true, approve });
  };

  const handleProcess = () => {
    if (!selectedRequest) return;
    onProcessRequest(selectedRequest.id, processDialog.approve);
    setProcessDialog({ open: false, approve: true });
    setSelectedRequest(null);
    // Sau khi xử lý, đóng dialog chi tiết và refresh lại danh sách
    setOpenDialog(false);
  };

  // Khi dialog mở, fetch tất cả lịch sử
  useEffect(() => {
    if (openDialog && fetchAllTrucThay) {
      setLoadingAll(true);
      fetchAllTrucThay(month, year)
        .then(data => setAllRecords(data))
        .catch(err => console.error('Lỗi tải lịch sử trực thay:', err))
        .finally(() => setLoadingAll(false));
    }
  }, [openDialog, month, year, fetchAllTrucThay]);

  const recentRequests = requests.slice(0, 3);

  return (
    <>
      <Card 
        sx={{ 
          borderRadius: 2,
          boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
          position: 'relative',
          overflow: 'visible',
          transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
          cursor: 'pointer',
          height: '100%',
          '&:hover': {
            transform: 'translateY(-2px)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
          }
        }}
        onClick={() => setOpenDialog(true)}
      >
        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <Avatar sx={{ 
              bgcolor: alpha('#ff9800', 0.1),
              color: '#ff9800',
              width: 42,
              height: 42
            }}>
              <SwapHorizIcon />
            </Avatar>
            <Box sx={{ flex: 1 }}>
              <Typography variant="body2" color="text.secondary" fontWeight="medium" sx={{ fontSize: '0.8rem' }}>
                Yêu cầu trực thay
              </Typography>
              <Typography variant="h6" fontWeight="bold" sx={{ color: '#ff9800', fontSize: '1.1rem' }}>
                {pendingCount}
              </Typography>
            </Box>
          </Stack>

          {pendingCount > 0 && (
            <Box sx={{ mt: 1.5 }}>
              {recentRequests.map((req, index) => (
                <Box 
                  key={req.id}
                  sx={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    py: 0.5,
                    borderBottom: index < recentRequests.length - 1 ? '1px solid #f0f0f0' : 'none'
                  }}
                >
                  <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>
                    <strong>{req.ten_nguoi_truc_thay}</strong> → {req.ten_nguoi_duoc_truc_thay}
                  </Typography>
                  <Chip size="small" label="Chờ" color="warning" sx={{ height: 16, fontSize: '0.55rem' }} />
                </Box>
              ))}
              {requests.length > 3 && (
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem', display: 'block', textAlign: 'center', mt: 0.5 }}>
                  +{requests.length - 3} yêu cầu khác
                </Typography>
              )}
            </Box>
          )}

          {pendingCount > 0 && (
            <Badge
              badgeContent={pendingCount}
              color="warning"
              sx={{
                position: 'absolute',
                top: -8,
                right: -8,
                '& .MuiBadge-badge': {
                  fontSize: '0.7rem',
                  height: 20,
                  minWidth: 20,
                  fontWeight: 'bold'
                }
              }}
            />
          )}
        </CardContent>
      </Card>

      {/* Dialog chi tiết với tabs */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="lg" fullWidth>
        <DialogTitle sx={{ bgcolor: '#ff9800', color: 'white', py: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <SwapHorizIcon />
              <Typography variant="h6">QUẢN LÝ TRỰC THAY</Typography>
            </Box>
            <IconButton onClick={() => setOpenDialog(false)} sx={{ color: 'white' }}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        
        <DialogContent sx={{ p: 0 }}>
          <Tabs 
            value={tabValue} 
            onChange={(e, v) => setTabValue(v)}
            sx={{ 
              borderBottom: '1px solid #e0e0e0',
              '& .MuiTab-root': { fontWeight: 'bold', fontSize: '0.85rem' }
            }}
          >
            <Tab label={`CHỜ DUYỆT (${pendingCount})`} />
            <Tab label="LỊCH SỬ TRỰC THAY" />
          </Tabs>

          {/* Tab 1: Danh sách chờ duyệt */}
          {tabValue === 0 && (
            <Box sx={{ maxHeight: 500, overflow: 'auto' }}>
              {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                  <CircularProgress size={28} />
                </Box>
              ) : requests.length === 0 ? (
                <Box sx={{ p: 3, textAlign: 'center' }}>
                  <SwapHorizIcon sx={{ fontSize: 40, color: '#e0e0e0', mb: 1 }} />
                  <Typography variant="body2" color="text.secondary">Không có yêu cầu trực thay</Typography>
                </Box>
              ) : (
                <List sx={{ p: 0 }}>
                  {requests.map((req) => {
                    const isPending = req.trang_thai === 'pending';
                    return (
                      <ListItem 
                        key={req.id}
                        sx={{ 
                          borderBottom: '1px solid #f0f0f0',
                          bgcolor: isPending ? alpha('#ff9800', 0.05) : 'inherit',
                          flexDirection: 'column',
                          alignItems: 'stretch',
                          py: 1.5
                        }}
                      >
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                          <Box>
                            <Typography variant="body2" fontWeight="bold">
                              {req.ten_nguoi_truc_thay} ({req.ma_nguoi_truc_thay}) → {req.ten_nguoi_duoc_truc_thay} ({req.ma_nguoi_duoc_truc_thay})
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {new Date(req.ngay).toLocaleDateString('vi-VN')} - 
                              {req.ca === 'ca1' ? ' Ca 1 (7:00-9:30)' :
                               req.ca === 'ca2' ? ' Ca 2 (9:30-12:30)' :
                               req.ca === 'ca3' ? ' Ca 3 (12:30-15:00)' : ' Ca 4 (15:00-17:30)'}
                            </Typography>
                          </Box>
                          <Box>
                            {getStatusChip(req.trang_thai)}
                          </Box>
                        </Box>

                        <Typography variant="caption" sx={{ mb: 1 }}>
                          <strong>Lý do:</strong> {req.ly_do || 'Không có lý do'}
                        </Typography>

                        {isPending && (
                          <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                            <Button
                              size="small"
                              variant="contained"
                              color="success"
                              startIcon={<CheckCircleIcon />}
                              onClick={() => handleOpenProcessDialog(req, true)}
                              sx={{ fontSize: '0.7rem', py: 0.3 }}
                            >
                              Duyệt
                            </Button>
                            <Button
                              size="small"
                              variant="outlined"
                              color="error"
                              startIcon={<CancelIcon />}
                              onClick={() => handleOpenProcessDialog(req, false)}
                              sx={{ fontSize: '0.7rem', py: 0.3 }}
                            >
                              Từ chối
                            </Button>
                          </Box>
                        )}
                      </ListItem>
                    );
                  })}
                </List>
              )}
            </Box>
          )}

          {/* Tab 2: Lịch sử trực thay (bảng) */}
          {tabValue === 1 && (
            <Box sx={{ maxHeight: 500, overflow: 'auto', p: 2 }}>
              {loadingAll ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                  <CircularProgress size={28} />
                </Box>
              ) : allRecords.length === 0 ? (
                <Box sx={{ p: 3, textAlign: 'center' }}>
                  <HistoryIcon sx={{ fontSize: 40, color: '#e0e0e0', mb: 1 }} />
                  <Typography variant="body2" color="text.secondary">Chưa có lịch sử trực thay</Typography>
                </Box>
              ) : (
                <TableContainer component={Paper} sx={{ boxShadow: 'none' }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 'bold', bgcolor: '#f5f5f5', fontSize: '0.75rem' }}>STT</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', bgcolor: '#f5f5f5', fontSize: '0.75rem' }}>Người trực thay</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', bgcolor: '#f5f5f5', fontSize: '0.75rem' }}>Người được trực thay</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', bgcolor: '#f5f5f5', fontSize: '0.75rem' }}>Ngày</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', bgcolor: '#f5f5f5', fontSize: '0.75rem' }}>Ca</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', bgcolor: '#f5f5f5', fontSize: '0.75rem' }}>Lý do</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', bgcolor: '#f5f5f5', fontSize: '0.75rem' }}>Trạng thái</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', bgcolor: '#f5f5f5', fontSize: '0.75rem' }}>Thời gian tạo</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {allRecords.map((record, index) => (
                        <TableRow key={record.id} hover>
                          <TableCell sx={{ fontSize: '0.75rem' }}>{index + 1}</TableCell>
                          <TableCell sx={{ fontSize: '0.75rem' }}>
                            <Tooltip title={record.ma_nguoi_truc_thay}>
                              <span>{record.ten_nguoi_truc_thay}</span>
                            </Tooltip>
                          </TableCell>
                          <TableCell sx={{ fontSize: '0.75rem' }}>
                            <Tooltip title={record.ma_nguoi_duoc_truc_thay}>
                              <span>{record.ten_nguoi_duoc_truc_thay}</span>
                            </Tooltip>
                          </TableCell>
                          <TableCell sx={{ fontSize: '0.75rem' }}>{new Date(record.ngay).toLocaleDateString('vi-VN')}</TableCell>
                          <TableCell sx={{ fontSize: '0.75rem' }}>
                            {record.ca === 'ca1' ? 'Ca 1' :
                             record.ca === 'ca2' ? 'Ca 2' :
                             record.ca === 'ca3' ? 'Ca 3' : 'Ca 4'}
                          </TableCell>
                          <TableCell sx={{ fontSize: '0.75rem', maxWidth: 200 }}>
                            <Tooltip title={record.ly_do || ''}>
                              <span style={{ 
                                display: 'block',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                              }}>
                                {record.ly_do || '--'}
                              </span>
                            </Tooltip>
                          </TableCell>
                          <TableCell sx={{ fontSize: '0.75rem' }}>
                            {getStatusChip(record.trang_thai)}
                          </TableCell>
                          <TableCell sx={{ fontSize: '0.75rem' }}>
                            {new Date(record.created_at).toLocaleString('vi-VN')}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Box>
          )}
        </DialogContent>
        
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setOpenDialog(false)} color="inherit">
            Đóng
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog xác nhận xử lý */}
      <Dialog open={processDialog.open} onClose={() => setProcessDialog({ open: false, approve: true })} maxWidth="xs" fullWidth>
        <DialogTitle>
          {processDialog.approve ? 'Xác nhận duyệt yêu cầu' : 'Xác nhận từ chối'}
        </DialogTitle>
        <DialogContent>
          <Typography>
            {processDialog.approve 
              ? 'Bạn có chắc chắn muốn duyệt yêu cầu trực thay này?' 
              : 'Bạn có chắc chắn muốn từ chối yêu cầu trực thay này?'}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setProcessDialog({ open: false, approve: true })}>Hủy</Button>
          <Button 
            variant="contained" 
            color={processDialog.approve ? "success" : "error"}
            onClick={handleProcess}
          >
            Xác nhận
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

// =======================
// Time Adjustment Requests Compact Component (Cập nhật)
// =======================
const TimeAdjustmentRequestsCompact = ({ requests, pendingCount, onProcessRequest, loading, month, year, fetchAllTimeAdjustments }) => {
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [processDialog, setProcessDialog] = useState({ open: false, approve: true, adjustedTime: '', adminNote: '' });
  const [allHistory, setAllHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [tabValue, setTabValue] = useState(0); // 0: chờ duyệt, 1: lịch sử duyệt

  const getStatusChip = (status) => {
    switch(status) {
      case 'pending':
        return <Chip size="small" icon={<PendingIcon />} label="Chờ duyệt" color="warning" sx={{ height: 22, '& .MuiChip-icon': { fontSize: '0.8rem' } }} />;
      case 'approved':
        return <Chip size="small" icon={<CheckCircleIcon />} label="Đã duyệt" color="success" sx={{ height: 22, '& .MuiChip-icon': { fontSize: '0.8rem' } }} />;
      case 'rejected':
        return <Chip size="small" icon={<CancelIcon />} label="Từ chối" color="error" sx={{ height: 22, '& .MuiChip-icon': { fontSize: '0.8rem' } }} />;
      default:
        return <Chip size="small" label={status} />;
    }
  };

  const handleOpenProcessDialog = (request, approve) => {
    setSelectedRequest(request);
    setProcessDialog({
      open: true,
      approve,
      adjustedTime: request.thoi_gian_de_xuat?.substring(0, 5) || '',
      adminNote: ''
    });
  };

  const handleProcess = () => {
    if (!selectedRequest) return;
    
    onProcessRequest(
      selectedRequest.id,
      processDialog.approve,
      processDialog.approve ? processDialog.adjustedTime : null,
      processDialog.adminNote
    );
    
    setProcessDialog({ open: false, approve: true, adjustedTime: '', adminNote: '' });
    setSelectedRequest(null);
    setOpenDialog(false);
  };

  // Khi dialog mở, fetch tất cả lịch sử
  useEffect(() => {
    if (openDialog && fetchAllTimeAdjustments) {
      setLoadingHistory(true);
      fetchAllTimeAdjustments(month, year)
        .then(data => setAllHistory(data))
        .catch(err => console.error('Lỗi tải lịch sử yêu cầu:', err))
        .finally(() => setLoadingHistory(false));
    }
  }, [openDialog, month, year, fetchAllTimeAdjustments]);

  const getLoaiYeuCauText = (loai) => {
    return loai === 'checkin' ? 'Check-in' : 'Check-out';
  };

  // Hiển thị 3 yêu cầu gần nhất trên thẻ
  const recentRequests = requests.slice(0, 3);

  return (
    <>
      <Card 
        sx={{ 
          borderRadius: 2,
          boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
          position: 'relative',
          overflow: 'visible',
          transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
          cursor: 'pointer',
          height: '100%',
          '&:hover': {
            transform: 'translateY(-2px)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
          }
        }}
        onClick={() => setOpenDialog(true)}
      >
        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <Avatar sx={{ 
              bgcolor: alpha('#f44336', 0.1),
              color: '#f44336',
              width: 42,
              height: 42
            }}>
              <PendingIcon />
            </Avatar>
            <Box sx={{ flex: 1 }}>
              <Typography variant="body2" color="text.secondary" fontWeight="medium" sx={{ fontSize: '0.8rem' }}>
                Yêu cầu chờ duyệt
              </Typography>
              <Typography variant="h6" fontWeight="bold" sx={{ color: '#f44336', fontSize: '1.1rem' }}>
                {pendingCount}
              </Typography>
            </Box>
          </Stack>

          {/* Hiển thị 3 yêu cầu gần nhất */}
          {pendingCount > 0 && (
            <Box sx={{ mt: 1.5 }}>
              {recentRequests.map((req, index) => (
                <Box 
                  key={req.id}
                  sx={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    py: 0.5,
                    borderBottom: index < recentRequests.length - 1 ? '1px solid #f0f0f0' : 'none'
                  }}
                >
                  <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>
                    <strong>{req.ten_nhan_vien}</strong> - {req.loai_yeu_cau === 'checkin' ? 'Check-in' : 'Check-out'}
                  </Typography>
                  <Chip 
                    size="small" 
                    label="Chờ" 
                    color="warning" 
                    sx={{ height: 16, fontSize: '0.55rem' }} 
                  />
                </Box>
              ))}
              {requests.length > 3 && (
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem', display: 'block', textAlign: 'center', mt: 0.5 }}>
                  +{requests.length - 3} yêu cầu khác
                </Typography>
              )}
            </Box>
          )}

          {pendingCount > 0 && (
            <Badge
              badgeContent={pendingCount}
              color="error"
              sx={{
                position: 'absolute',
                top: -8,
                right: -8,
                '& .MuiBadge-badge': {
                  fontSize: '0.7rem',
                  height: 20,
                  minWidth: 20,
                  fontWeight: 'bold'
                }
              }}
            />
          )}
        </CardContent>
      </Card>

      {/* Dialog chi tiết với tabs */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="lg" fullWidth>
        <DialogTitle sx={{ bgcolor: '#f44336', color: 'white', py: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <PendingIcon />
              <Typography variant="h6">QUẢN LÝ YÊU CẦU ĐIỀU CHỈNH GIỜ</Typography>
            </Box>
            <IconButton onClick={() => setOpenDialog(false)} sx={{ color: 'white' }}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        
        <DialogContent sx={{ p: 0 }}>
          <Tabs 
            value={tabValue} 
            onChange={(e, v) => setTabValue(v)}
            sx={{ 
              borderBottom: '1px solid #e0e0e0',
              '& .MuiTab-root': { fontWeight: 'bold', fontSize: '0.85rem' }
            }}
          >
            <Tab label={`CHỜ DUYỆT (${pendingCount})`} />
            <Tab label="LỊCH SỬ DUYỆT" />
          </Tabs>

          {/* Tab 1: Danh sách chờ duyệt */}
          {tabValue === 0 && (
            <Box sx={{ maxHeight: 500, overflow: 'auto' }}>
              {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                  <CircularProgress size={28} />
                </Box>
              ) : requests.length === 0 ? (
                <Box sx={{ p: 3, textAlign: 'center' }}>
                  <AccessTimeIcon sx={{ fontSize: 40, color: '#e0e0e0', mb: 1 }} />
                  <Typography variant="body2" color="text.secondary">Không có yêu cầu điều chỉnh giờ</Typography>
                </Box>
              ) : (
                <List sx={{ maxHeight: 500, overflow: 'auto', p: 0 }}>
                  {requests.map((req) => {
                    const isPending = req.trang_thai === 'pending';
                    
                    return (
                      <ListItem 
                        key={req.id}
                        sx={{ 
                          borderBottom: '1px solid #f0f0f0',
                          bgcolor: isPending ? alpha('#ff9800', 0.05) : 'inherit',
                          flexDirection: 'column',
                          alignItems: 'stretch',
                          py: 1.5
                        }}
                      >
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                          <Box>
                            <Typography variant="body2" fontWeight="bold">
                              {req.ten_nhan_vien} ({req.ma_nhan_vien})
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {new Date(req.ngay).toLocaleDateString('vi-VN')} - 
                              {req.ca === 'ca1' ? ' Ca 1 (7:00-9:30)' :
                               req.ca === 'ca2' ? ' Ca 2 (9:30-12:30)' :
                               req.ca === 'ca3' ? ' Ca 3 (12:30-15:00)' : ' Ca 4 (15:00-17:30)'}
                            </Typography>
                          </Box>
                          <Box>
                            {getStatusChip(req.trang_thai)}
                          </Box>
                        </Box>

                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 1 }}>
                          <Typography variant="caption">
                            <strong>Loại:</strong> {getLoaiYeuCauText(req.loai_yeu_cau)}
                          </Typography>
                          <Typography variant="caption">
                            <strong>Giờ vào:</strong> {req.gio_vao_hien_tai ? req.gio_vao_hien_tai.substring(0,5) : '--:--'}
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
                          <strong>Lý do:</strong> {req.ly_do || 'Không có lý do'}
                        </Typography>

                        {req.ghi_chu_admin && (
                          <Typography variant="caption" color="error.main" sx={{ mb: 1 }}>
                            <strong>Ghi chú admin:</strong> {req.ghi_chu_admin}
                          </Typography>
                        )}

                        {isPending && (
                          <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                            <Button
                              size="small"
                              variant="contained"
                              color="success"
                              startIcon={<CheckCircleIcon />}
                              onClick={() => handleOpenProcessDialog(req, true)}
                              sx={{ fontSize: '0.7rem', py: 0.3 }}
                            >
                              Duyệt
                            </Button>
                            <Button
                              size="small"
                              variant="outlined"
                              color="error"
                              startIcon={<CancelIcon />}
                              onClick={() => handleOpenProcessDialog(req, false)}
                              sx={{ fontSize: '0.7rem', py: 0.3 }}
                            >
                              Từ chối
                            </Button>
                          </Box>
                        )}
                      </ListItem>
                    );
                  })}
                </List>
              )}
            </Box>
          )}

          {/* Tab 2: Lịch sử duyệt (bảng) */}
          {tabValue === 1 && (
            <Box sx={{ maxHeight: 500, overflow: 'auto', p: 2 }}>
              {loadingHistory ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                  <CircularProgress size={28} />
                </Box>
              ) : allHistory.length === 0 ? (
                <Box sx={{ p: 3, textAlign: 'center' }}>
                  <HistoryIcon sx={{ fontSize: 40, color: '#e0e0e0', mb: 1 }} />
                  <Typography variant="body2" color="text.secondary">Chưa có lịch sử duyệt</Typography>
                </Box>
              ) : (
                <TableContainer component={Paper} sx={{ boxShadow: 'none' }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 'bold', bgcolor: '#f5f5f5', fontSize: '0.75rem' }}>STT</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', bgcolor: '#f5f5f5', fontSize: '0.75rem' }}>Nhân viên</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', bgcolor: '#f5f5f5', fontSize: '0.75rem' }}>Loại</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', bgcolor: '#f5f5f5', fontSize: '0.75rem' }}>Ngày</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', bgcolor: '#f5f5f5', fontSize: '0.75rem' }}>Ca</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', bgcolor: '#f5f5f5', fontSize: '0.75rem' }}>Giờ đề xuất</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', bgcolor: '#f5f5f5', fontSize: '0.75rem' }}>Giờ điều chỉnh</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', bgcolor: '#f5f5f5', fontSize: '0.75rem' }}>Lý do</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', bgcolor: '#f5f5f5', fontSize: '0.75rem' }}>Ghi chú admin</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', bgcolor: '#f5f5f5', fontSize: '0.75rem' }}>Trạng thái</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', bgcolor: '#f5f5f5', fontSize: '0.75rem' }}>Thời gian xử lý</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {allHistory.map((record, index) => (
                        <TableRow key={record.id} hover>
                          <TableCell sx={{ fontSize: '0.75rem' }}>{index + 1}</TableCell>
                          <TableCell sx={{ fontSize: '0.75rem' }}>
                            <Tooltip title={record.ma_nhan_vien}>
                              <span>{record.ten_nhan_vien}</span>
                            </Tooltip>
                          </TableCell>
                          <TableCell sx={{ fontSize: '0.75rem' }}>{record.loai_yeu_cau === 'checkin' ? 'Check-in' : 'Check-out'}</TableCell>
                          <TableCell sx={{ fontSize: '0.75rem' }}>{new Date(record.ngay).toLocaleDateString('vi-VN')}</TableCell>
                          <TableCell sx={{ fontSize: '0.75rem' }}>
                            {record.ca === 'ca1' ? 'Ca 1' :
                             record.ca === 'ca2' ? 'Ca 2' :
                             record.ca === 'ca3' ? 'Ca 3' : 'Ca 4'}
                          </TableCell>
                          <TableCell sx={{ fontSize: '0.75rem' }}>{record.thoi_gian_de_xuat?.substring(0,5)}</TableCell>
                          <TableCell sx={{ fontSize: '0.75rem', color: record.thoi_gian_dieu_chinh ? 'success.main' : 'inherit' }}>
                            {record.thoi_gian_dieu_chinh?.substring(0,5) || '--:--'}
                          </TableCell>
                          <TableCell sx={{ fontSize: '0.75rem', maxWidth: 150 }}>
                            <Tooltip title={record.ly_do || ''}>
                              <span style={{ 
                                display: 'block',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                              }}>
                                {record.ly_do || '--'}
                              </span>
                            </Tooltip>
                          </TableCell>
                          <TableCell sx={{ fontSize: '0.75rem', maxWidth: 150 }}>
                            <Tooltip title={record.ghi_chu_admin || ''}>
                              <span style={{ 
                                display: 'block',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                              }}>
                                {record.ghi_chu_admin || '--'}
                              </span>
                            </Tooltip>
                          </TableCell>
                          <TableCell sx={{ fontSize: '0.75rem' }}>
                            {getStatusChip(record.trang_thai)}
                          </TableCell>
                          <TableCell sx={{ fontSize: '0.75rem' }}>
                            {record.updated_at ? new Date(record.updated_at).toLocaleString('vi-VN') : new Date(record.created_at).toLocaleString('vi-VN')}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Box>
          )}
        </DialogContent>
        
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setOpenDialog(false)} color="inherit">
            Đóng
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog xử lý yêu cầu */}
      <Dialog open={processDialog.open} onClose={() => setProcessDialog({ open: false, approve: true, adjustedTime: '', adminNote: '' })} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {processDialog.approve ? (
              <CheckCircleIcon color="success" />
            ) : (
              <CancelIcon color="error" />
            )}
            <Typography variant="h6">
              {processDialog.approve ? 'Duyệt yêu cầu điều chỉnh giờ' : 'Từ chối yêu cầu'}
            </Typography>
          </Box>
        </DialogTitle>
        
        <DialogContent>
          {selectedRequest && (
            <>
              <Paper sx={{ p: 2, mb: 2, bgcolor: '#f5f5f5' }}>
                <Typography variant="body2" fontWeight="bold" gutterBottom>
                  Thông tin yêu cầu:
                </Typography>
                <Grid container spacing={1}>
                  <Grid item xs={6}>
                    <Typography variant="caption"><strong>Nhân viên:</strong> {selectedRequest.ten_nhan_vien}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption"><strong>Mã NV:</strong> {selectedRequest.ma_nhan_vien}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption"><strong>Ngày:</strong> {new Date(selectedRequest.ngay).toLocaleDateString('vi-VN')}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption"><strong>Ca:</strong> {
                      selectedRequest.ca === 'ca1' ? 'Ca 1 (7:00-9:30)' :
                      selectedRequest.ca === 'ca2' ? 'Ca 2 (9:30-12:30)' :
                      selectedRequest.ca === 'ca3' ? 'Ca 3 (12:30-15:00)' : 'Ca 4 (15:00-17:30)'
                    }</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption"><strong>Loại:</strong> {selectedRequest.loai_yeu_cau === 'checkin' ? 'Check-in' : 'Check-out'}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption"><strong>Giờ vào:</strong> {selectedRequest.gio_vao_hien_tai?.substring(0,5) || '--:--'}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption"><strong>Giờ đề xuất:</strong> {selectedRequest.thoi_gian_de_xuat?.substring(0,5)}</Typography>
                  </Grid>
                  <Grid item xs={12}>
                    <Typography variant="caption"><strong>Lý do:</strong> {selectedRequest.ly_do || 'Không có lý do'}</Typography>
                  </Grid>
                </Grid>
              </Paper>

              {processDialog.approve ? (
                <TextField
                  fullWidth
                  label="Thời gian điều chỉnh"
                  type="time"
                  value={processDialog.adjustedTime}
                  onChange={(e) => setProcessDialog(prev => ({ ...prev, adjustedTime: e.target.value }))}
                  InputLabelProps={{ shrink: true }}
                  sx={{ mb: 2 }}
                  helperText="Có thể giữ nguyên thời gian nhân viên yêu cầu hoặc điều chỉnh lại"
                />
              ) : (
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  label="Lý do từ chối"
                  value={processDialog.adminNote}
                  onChange={(e) => setProcessDialog(prev => ({ ...prev, adminNote: e.target.value }))}
                  placeholder="Nhập lý do từ chối yêu cầu..."
                  sx={{ mb: 2 }}
                />
              )}
            </>
          )}
        </DialogContent>
        
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setProcessDialog({ open: false, approve: true, adjustedTime: '', adminNote: '' })} color="inherit">
            Hủy
          </Button>
          <Button 
            variant="contained" 
            color={processDialog.approve ? "success" : "error"}
            onClick={handleProcess}
            disabled={processDialog.approve ? !processDialog.adjustedTime : false}
          >
            {processDialog.approve ? 'Xác nhận duyệt' : 'Xác nhận từ chối'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

// =======================
// Statistics Cards Component (Cập nhật)
// =======================
const StatisticsCards = ({ 
  totals, 
  stats, 
  pendingRequests, 
  requests, 
  onProcessRequest, 
  loadingRequests, 
  pendingTrucThay, 
  trucThayRequests, 
  onProcessTrucThay, 
  loadingTrucThay, 
  month, 
  year, 
  fetchAllTrucThay,
  fetchAllTimeAdjustments
}) => {
  const totalRegistered = Object.values(stats).reduce((sum, stat) => sum + (stat.total_registered || 0), 0);
  const totalCompleted = Object.values(stats).reduce((sum, stat) => sum + (stat.total_completed || 0), 0);

  const cards = [
    {
      title: 'Tổng ca đăng ký',
      value: totalRegistered,
      icon: <WorkIcon />,
      color: '#1976d2',
      bgColor: alpha('#1976d2', 0.1)
    },
    {
      title: 'Tổng ca hoàn thành',
      value: totalCompleted,
      icon: <HowToRegIcon />,
      color: '#2e7d32',
      bgColor: alpha('#2e7d32', 0.1)
    },
    {
      title: 'Tổng giờ làm',
      value: `${totals.totalHours}h`,
      icon: <AccessTimeIcon />,
      color: '#ed6c02',
      bgColor: alpha('#ed6c02', 0.1)
    }
  ];

  return (
    <Grid container spacing={2} sx={{ mb: 2.5 }}>
      {/* 3 thẻ thống kê */}
      {cards.map((card, index) => (
        <Grid item xs={12} sm={6} md={2.4} key={index}>
          <Card sx={{ 
            borderRadius: 2,
            boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
            position: 'relative',
            overflow: 'visible',
            transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
            '&:hover': {
              transform: 'translateY(-2px)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
            }
          }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Stack direction="row" alignItems="center" spacing={1.5}>
                <Avatar sx={{ 
                  bgcolor: card.bgColor,
                  color: card.color,
                  width: 42,
                  height: 42
                }}>
                  {card.icon}
                </Avatar>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2" color="text.secondary" fontWeight="medium" sx={{ fontSize: '0.8rem' }}>
                    {card.title}
                  </Typography>
                  <Typography variant="h6" fontWeight="bold" sx={{ color: card.color, fontSize: '1.1rem' }}>
                    {card.value}
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      ))}

      {/* Thẻ Yêu cầu điều chỉnh giờ */}
      <Grid item xs={12} sm={6} md={2.4}>
        <TimeAdjustmentRequestsCompact 
          requests={requests}
          pendingCount={pendingRequests}
          onProcessRequest={onProcessRequest}
          loading={loadingRequests}
          month={month}
          year={year}
          fetchAllTimeAdjustments={fetchAllTimeAdjustments}
        />
      </Grid>

      {/* Thẻ Yêu cầu trực thay */}
      <Grid item xs={12} sm={6} md={2.4}>
        <TrucThayRequestsCompact 
          requests={trucThayRequests}
          pendingCount={pendingTrucThay}
          onProcessRequest={onProcessTrucThay}
          loading={loadingTrucThay}
          month={month}               
          year={year}                 
          fetchAllTrucThay={fetchAllTrucThay}
        />
      </Grid>
    </Grid>
  );
};

// =======================
// Detailed Attendance Table Component (CẬP NHẬT)
// =======================
const DetailedAttendanceTable = ({ 
  combinedTableData, 
  employeeHoursPerDay, 
  selectedEmployees, 
  employees,
  loading 
}) => {
  const formatDate = (dateString) => {
        if (!dateString) return '';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return dateString;
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    } catch (e) {
      return dateString;
    }
  };
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress size={35} />
      </Box>
    );
  }

  if (combinedTableData.length === 0) {
    return (
      <Alert severity="info" sx={{ borderRadius: 2, py: 1 }}>
        Không có dữ liệu chấm công trong tháng này
      </Alert>
    );
  }

  const employeeMonthlyHours = {};
  selectedEmployees.forEach(empId => {
    let total = 0;
    combinedTableData.forEach(day => {
      total += employeeHoursPerDay[day.date]?.[empId] || 0;
    });
    employeeMonthlyHours[empId] = total;
  });

  // Hàm xử lý hiển thị chip cho từng ca
  const renderShiftChips = (shiftData) => {
    if (!shiftData || shiftData.length === 0) {
      return <Typography variant="body2" color="text.disabled" sx={{ fontSize: '0.7rem' }}>-</Typography>;
    }

    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.3 }}>
        {shiftData.map((item, idx) => {
          const isObject = typeof item === 'object' && item !== null;
          const name = isObject ? item.name : item;
          const isTrucThay = isObject ? item.isTrucThay : false;
          const tooltip = isObject ? item.tooltip : name;

          return (
            <Tooltip key={idx} title={tooltip} arrow>
              <Chip 
                label={name}
                size="small"
                sx={{ 
                  height: 18, 
                  fontSize: '0.65rem',
                  backgroundColor: isTrucThay ? alpha('#ff9800', 0.15) : alpha('#1976d2', 0.1),
                  fontWeight: isTrucThay ? 'bold' : 'normal',
                  color: isTrucThay ? '#e65100' : 'inherit',
                  '& .MuiChip-label': { px: 0.8 }
                }}
              />
            </Tooltip>
          );
        })}
      </Box>
    );
  };

  return (
    <TableContainer 
      component={Paper} 
      sx={{ 
        borderRadius: 2,
        boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
        maxHeight: 450,
        '&::-webkit-scrollbar': { width: '6px', height: '6px' },
        '&::-webkit-scrollbar-track': { background: '#f1f1f1' },
        '&::-webkit-scrollbar-thumb': { background: '#888', borderRadius: '3px' },
      }}
    >
      <Table stickyHeader size="small">
        <TableHead>
          <TableRow>
            <TableCell rowSpan={2} align="center" sx={{ fontWeight: 'bold', bgcolor: '#1976d2', color: 'white', py: 1, fontSize: '0.8rem' }}>
              Ngày
            </TableCell>
            <TableCell rowSpan={2} align="center" sx={{ fontWeight: 'bold', bgcolor: '#1976d2', color: 'white', py: 1, fontSize: '0.8rem' }}>
              Thứ
            </TableCell>
            <TableCell rowSpan={2} align="center" sx={{ fontWeight: 'bold', bgcolor: '#1976d2', color: 'white', py: 1, fontSize: '0.75rem' }}>
              Ca 1<br />7:00-9:30
            </TableCell>
            <TableCell rowSpan={2} align="center" sx={{ fontWeight: 'bold', bgcolor: '#1976d2', color: 'white', py: 1, fontSize: '0.75rem' }}>
              Ca 2<br />9:30-12:30
            </TableCell>
            <TableCell rowSpan={2} align="center" sx={{ fontWeight: 'bold', bgcolor: '#1976d2', color: 'white', py: 1, fontSize: '0.75rem' }}>
              Ca 3<br />12:30-15:00
            </TableCell>
            <TableCell rowSpan={2} align="center" sx={{ fontWeight: 'bold', bgcolor: '#1976d2', color: 'white', py: 1, fontSize: '0.75rem' }}>
              Ca 4<br />15:00-17:30
            </TableCell>
            
            <TableCell colSpan={selectedEmployees.length} align="center" sx={{ 
              fontWeight: 'bold', 
              bgcolor: '#1976d2', 
              color: 'white',
              borderLeft: '1px solid white',
              borderRight: '1px solid white',
              py: 1,
              fontSize: '0.8rem'
            }}>
              <Stack direction="row" alignItems="center" justifyContent="center" spacing={0.5}>
                <TimelineIcon sx={{ fontSize: '1rem' }} />
                <Typography variant="body2" fontWeight="bold" sx={{ fontSize: '0.8rem' }}>
                  THỜI GIAN LÀM (GIỜ)
                </Typography>
              </Stack>
            </TableCell>
            
            <TableCell rowSpan={2} align="center" sx={{ fontWeight: 'bold', bgcolor: '#1976d2', color: 'white', py: 1, fontSize: '0.8rem' }}>
              Tổng giờ
            </TableCell>
            <TableCell rowSpan={2} align="center" sx={{ fontWeight: 'bold', bgcolor: '#1976d2', color: 'white', py: 1, fontSize: '0.8rem' }}>
              Thành tiền
            </TableCell>
          </TableRow>

          <TableRow>
            {selectedEmployees.map((id, idx) => {
              const emp = employees.find(e => e.id === id);
              const monthlyTotal = employeeMonthlyHours[id] || 0;
              const color = EMPLOYEE_COLORS[idx % EMPLOYEE_COLORS.length];
              return (
                <TableCell 
                  key={`hours-header-${id}`} 
                  align="center" 
                  sx={{ 
                    fontWeight: 'bold', 
                    bgcolor: alpha(color, 0.15),
                    color,
                    borderLeft: '1px solid #e0e0e0',
                    borderRight: '1px solid #e0e0e0',
                    minWidth: 70,
                    py: 1,
                    fontSize: '0.75rem'
                  }}
                >
                  <Tooltip title={`${emp?.ten_nhan_vien} - Tổng: ${monthlyTotal.toFixed(2)}h`}>
                    <Box>
                      <Typography variant="body2" fontWeight="bold" sx={{ fontSize: '0.8rem' }}>
                        {getEmployeeAbbr(emp)}
                      </Typography>
                      <Typography variant="caption" sx={{ fontSize: '0.65rem', display: 'block' }}>
                        {monthlyTotal.toFixed(2)}h
                      </Typography>
                    </Box>
                  </Tooltip>
                </TableCell>
              );
            })}
          </TableRow>
        </TableHead>

        <TableBody>
          {combinedTableData.map((row, index) => {
            const isSunday = row.weekday === 'Chủ Nhật';
            const totalHours = row.total_hours || 0;
            const totalAmount = totalHours * 22000;

            return (
              <TableRow 
                key={row.date}
                sx={{ 
                  backgroundColor: isSunday ? alpha('#ffff00', 0.15) : 'inherit',
                  '&:hover': { backgroundColor: alpha('#1976d2', 0.05) }
                }}
              >
                <TableCell align="center" sx={{ py: 0.75, fontSize: '0.8rem' }}>
                  {formatDate(row.date)}
                </TableCell>
                <TableCell align="center" sx={{ py: 0.75, fontSize: '0.8rem', color: isSunday ? 'error.main' : 'inherit' }}>
                  {row.weekday}
                </TableCell>
                
                <TableCell align="center" sx={{ py: 0.75 }}>
                  {renderShiftChips(row.ca1_details || row.ca1)}
                </TableCell>
                <TableCell align="center" sx={{ py: 0.75 }}>
                  {renderShiftChips(row.ca2_details || row.ca2)}
                </TableCell>
                <TableCell align="center" sx={{ py: 0.75 }}>
                  {renderShiftChips(row.ca3_details || row.ca3)}
                </TableCell>
                <TableCell align="center" sx={{ py: 0.75 }}>
                  {renderShiftChips(row.ca4_details || row.ca4)}
                </TableCell>

                {selectedEmployees.map((id, idx) => {
                  const hours = employeeHoursPerDay[row.date]?.[id] || 0;
                  const emp = employees.find(e => e.id === id);
                  const color = EMPLOYEE_COLORS[idx % EMPLOYEE_COLORS.length];
                  
                  return (
                    <TableCell 
                      key={`hours-${row.date}-${id}`} 
                      align="center"
                      sx={{ 
                        bgcolor: hours > 0 ? alpha(color, 0.1) : 'inherit',
                        borderLeft: '1px solid #f0f0f0',
                        borderRight: '1px solid #f0f0f0',
                        py: 0.75,
                        fontSize: '0.8rem',
                        fontWeight: hours > 0 ? 'bold' : 'normal',
                        color: hours > 0 ? color : 'inherit'
                      }}
                    >
                      {hours > 0 ? (
                        <Typography variant="body2" fontWeight="bold" sx={{ fontSize: '0.8rem' }}>
                          {hours.toFixed(2)}
                        </Typography>
                      ) : (
                        <Typography variant="body2" color="text.disabled" sx={{ fontSize: '0.8rem' }}>
                          -
                        </Typography>
                      )}
                    </TableCell>
                  );
                })}

                <TableCell align="center" sx={{ fontWeight: 'bold', py: 0.75, fontSize: '0.8rem' }}>
                  <Typography variant="body2" fontWeight="bold" color="primary.main" sx={{ fontSize: '0.8rem' }}>
                    {totalHours > 0 ? totalHours.toFixed(2) : '-'}
                  </Typography>
                </TableCell>
                <TableCell align="center" sx={{ fontWeight: 'bold', py: 0.75, fontSize: '0.8rem' }}>
                  <Typography variant="body2" fontWeight="bold" color="success.main" sx={{ fontSize: '0.8rem' }}>
                    {totalAmount > 0 ? totalAmount.toLocaleString('vi-VN') : '-'}
                  </Typography>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

// =======================
// EmployeeList Component
// =======================
const EmployeeList = ({
  employees,
  selectedEmployees,
  onEmployeeToggle,
  onSelectAll,
  searchTerm,
  onSearchChange,
  loading
}) => {
  const filteredEmployees = employees.filter(emp => 
    emp.ten_nhan_vien.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.ma_nhan_vien.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Paper sx={{ borderRadius: 2, overflow: 'hidden', boxShadow: '0 2px 6px rgba(0,0,0,0.05)', height: '100%' }}>
      <Box sx={{ bgcolor: '#1976d2', color: 'white', p: 2 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Typography variant="subtitle1" fontWeight="bold" sx={{ fontSize: '0.95rem' }}>
            👥 DANH SÁCH NHÂN VIÊN
          </Typography>
          <Chip 
            label={`${selectedEmployees.length}/${employees.length}`}
            size="small"
            sx={{ bgcolor: 'white', color: '#1976d2', fontWeight: 'bold', height: 22, '& .MuiChip-label': { fontSize: '0.75rem', px: 1 } }}
          />
        </Stack>
        
        <TextField
          fullWidth
          size="small"
          placeholder="Tìm kiếm nhân viên..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          sx={{ 
            mt: 1.5,
            '& .MuiOutlinedInput-root': {
              bgcolor: 'white',
              borderRadius: 2,
              fontSize: '0.85rem',
              height: 36
            }
          }}
          InputProps={{
            startAdornment: <SearchIcon sx={{ mr: 0.5, color: '#666', fontSize: '1.1rem' }} />,
            endAdornment: searchTerm && (
              <IconButton size="small" onClick={() => onSearchChange('')} sx={{ p: 0.5 }}>
                <CloseIcon sx={{ fontSize: '1rem' }} />
              </IconButton>
            )
          }}
        />
      </Box>
      
      <Box sx={{ p: 1.5, borderBottom: '1px solid #e0e0e0', bgcolor: '#fafafa' }}>
        <FormControlLabel
          control={
            <Checkbox
              size="small"
              checked={selectedEmployees.length === employees.length && employees.length > 0}
              indeterminate={selectedEmployees.length > 0 && selectedEmployees.length < employees.length}
              onChange={onSelectAll}
              sx={{ color: '#1976d2', '& .MuiSvgIcon-root': { fontSize: '1.3rem' } }}
            />
          }
          label={
            <Typography variant="body2" fontWeight="medium" sx={{ fontSize: '0.85rem' }}>
              Chọn tất cả
            </Typography>
          }
        />
      </Box>
      
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
          <CircularProgress size={28} />
        </Box>
      ) : (
        <List sx={{ maxHeight: 350, overflow: 'auto', p: 0 }}>
          {filteredEmployees.map(emp => (
            <ListItem 
              key={emp.id} 
              disablePadding
              sx={{ 
                borderBottom: '1px solid #f0f0f0',
                '&:hover': { bgcolor: alpha('#1976d2', 0.05) }
              }}
            >
              <ListItemButton 
                sx={{ py: 1.2 }}
                onClick={() => onEmployeeToggle(emp.id)}
              >
                <Checkbox
                  size="small"
                  checked={selectedEmployees.includes(emp.id)}
                  sx={{ mr: 0.5, '& .MuiSvgIcon-root': { fontSize: '1.3rem' } }}
                />
                <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                    <Typography variant="body2" sx={{ fontSize: '0.9rem' }}>
                      {emp.ten_nhan_vien}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#1976d2', fontWeight: 'bold', fontSize: '0.7rem' }}>
                      ({getEmployeeAbbr(emp)})
                    </Typography>
                  </Box>
                  <Chip 
                    label={emp.ma_nhan_vien}
                    size="small"
                    variant="outlined"
                    sx={{ 
                      height: 18, 
                      fontSize: '0.65rem', 
                      width: 'fit-content',
                      mt: 0.5,
                      '& .MuiChip-label': { px: 0.8 }
                    }}
                  />
                </Box>
              </ListItemButton>
            </ListItem>
          ))}
          {filteredEmployees.length === 0 && (
            <Box sx={{ p: 2.5, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">Không tìm thấy nhân viên</Typography>
            </Box>
          )}
        </List>
      )}
    </Paper>
  );
};

// =======================
// Main Component
// =======================
const AdminHistory = () => {
  const { auth } = useContext(AuthContext);
  const today = new Date();
  
  // State cho tabs
  const [tabValue, setTabValue] = useState(0);
  
  // State cho tab Chấm công
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [year, setYear] = useState(today.getFullYear());
  const [employees, setEmployees] = useState([]);
  const [selectedEmployees, setSelectedEmployees] = useState([]);
  const [allAttendanceData, setAllAttendanceData] = useState({});
  const [loading, setLoading] = useState(false);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [error, setError] = useState('');
  const [stats, setStats] = useState({});
  const [combinedTableData, setCombinedTableData] = useState([]);
  const [employeeHoursPerDay, setEmployeeHoursPerDay] = useState({});
  const [notesByDate, setNotesByDate] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  // State cho bộ lọc tháng/năm ở Tab 2
const [statsMonth, setStatsMonth] = useState(today.getMonth() + 1);
const [statsYear, setStatsYear] = useState(today.getFullYear());

  // State cho tab Danh sách user đã đăng ký
  const [registeredUsers, setRegisteredUsers] = useState([]);
  const [loadingRegisteredUsers, setLoadingRegisteredUsers] = useState(false);
  const [userDetailDialog, setUserDetailDialog] = useState({ open: false, user: null, schedule: [] });
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());

  // State cho yêu cầu điều chỉnh giờ
  const [timeAdjustmentRequests, setTimeAdjustmentRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(false);

  // State cho yêu cầu trực thay
  const [trucThayRequests, setTrucThayRequests] = useState([]);
  const [loadingTrucThay, setLoadingTrucThay] = useState(false);

  // State cho revert checkout
  const [revertLoading, setRevertLoading] = useState(false);

  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  // ======================
  // State cho quản lý nhân viên
  // ======================
  const [employeeDialog, setEmployeeDialog] = useState({
    open: false,
    mode: 'create', // 'create' hoặc 'edit'
    employee: {
      ma_nhan_vien: '',
      ten_nhan_vien: '',
      password: '',
      is_admin: false
    },
    errors: {}
  });

  // ======================
  // State cho reset mật khẩu
  // ======================
  const [resetPasswordDialog, setResetPasswordDialog] = useState({
    open: false,
    employee: null,
    newPassword: '',
    confirmPassword: '',
    error: '',
    success: ''
  });
const [faceSettingsDialog, setFaceSettingsDialog] = useState({
    open: false,
    employee: null,
    face_login_enabled: true,
    face_code: '',
    face_code_enabled: false,
    loading: false,
    error: ''
  });

  // Hàm mở dialog cài đặt khuôn mặt
  const openFaceSettings = (employee) => {
    setFaceSettingsDialog({
      open: true,
      employee,
      face_login_enabled: employee.face_login_enabled !== undefined ? employee.face_login_enabled : true,
      face_code: employee.face_code || '',
      face_code_enabled: employee.face_code_enabled || false,
      loading: false,
      error: ''
    });
  };

  // Hàm lưu cài đặt khuôn mặt
  const saveFaceSettings = async () => {
    const { employee, face_login_enabled, face_code, face_code_enabled } = faceSettingsDialog;
    setFaceSettingsDialog(prev => ({ ...prev, loading: true, error: '' }));
    try {
      await axios.put(`http://localhost:5000/api/attendance/admin/employee/${employee.id}/face-settings`, {
        face_login_enabled,
        face_code: face_code_enabled ? face_code : null,
        face_code_enabled
      }, {
        headers: { Authorization: `Bearer ${auth.token}` }
      });
      showSnackbar('Cập nhật cài đặt khuôn mặt thành công', 'success');
      setFaceSettingsDialog(prev => ({ ...prev, open: false }));
      fetchRegisteredUsers(); // refresh danh sách
    } catch (err) {
      setFaceSettingsDialog(prev => ({ ...prev, error: err.response?.data?.message || 'Lỗi cập nhật' }));
    } finally {
      setFaceSettingsDialog(prev => ({ ...prev, loading: false }));
    }
  };

  // Hàm xóa dữ liệu khuôn mặt
const handleDeleteFaceData = async () => {
  if (!faceSettingsDialog.employee) return;
  if (window.confirm(`Bạn có chắc muốn xóa dữ liệu khuôn mặt của ${faceSettingsDialog.employee.ten_nhan_vien}? Nhân viên sẽ cần đăng ký lại.`)) {
    await deleteFaceData(faceSettingsDialog.employee.id);
    setFaceSettingsDialog({ ...faceSettingsDialog, open: false });
  }
};

  // Hàm xóa dữ liệu khuôn mặt
  const deleteFaceData = async (employeeId) => {
    if (!window.confirm('Bạn có chắc muốn xóa dữ liệu khuôn mặt của nhân viên này? Nhân viên sẽ cần đăng ký lại.')) return;
    try {
      await axios.delete(`http://localhost:5000/api/attendance/admin/employee/${employeeId}/face-data`, {
        headers: { Authorization: `Bearer ${auth.token}` }
      });
      showSnackbar('Đã xóa dữ liệu khuôn mặt', 'success');
      fetchRegisteredUsers(); // refresh
    } catch (err) {
      showSnackbar(err.response?.data?.message || 'Lỗi xóa', 'error');
    }
  };
  // Format date function
  const formatDate = (dateString) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return dateString;
      
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear();
      
      return `${day}/${month}/${year}`;
    } catch (e) {
      return dateString;
    }
  };

  // Hàm xử lý revert checkout
  const handleRevertCheckout = async (recordId) => {
    if (!window.confirm('Bạn có chắc muốn hoàn tác checkout cho ca này?')) return;
    
    setRevertLoading(true);
    try {
      const response = await axios.post(
        `http://localhost:5000/api/attendance/admin/schedule/${recordId}/revert-checkout`,
        {},
        { headers: { Authorization: `Bearer ${auth.token}` } }
      );
      showSnackbar(response.data.message, 'success');
      // Refresh lại chi tiết user
      await fetchUserDetail(userDetailDialog.user.id);
    } catch (err) {
      showSnackbar(err.response?.data?.message || 'Hoàn tác thất bại', 'error');
    } finally {
      setRevertLoading(false);
    }
  };

  // Hàm lấy tất cả lịch sử trực thay
  const fetchAllTrucThay = useCallback(async (month, year) => {
    try {
      const res = await axios.get('http://localhost:5000/api/attendance/admin/tructhay/all', {
        params: { month, year },
        headers: { Authorization: `Bearer ${auth.token}` }
      });
      return res.data;
    } catch (err) {
      console.error('Lỗi tải lịch sử trực thay:', err);
      throw err;
    }
  }, [auth.token]);

  // Hàm lấy tất cả lịch sử yêu cầu điều chỉnh
  const fetchAllTimeAdjustments = useCallback(async (month, year) => {
    try {
      const res = await axios.get('http://localhost:5000/api/attendance/admin/time-adjustments/all', {
        params: { month, year },
        headers: { Authorization: `Bearer ${auth.token}` }
      });
      return res.data;
    } catch (err) {
      console.error('Lỗi tải lịch sử yêu cầu điều chỉnh:', err);
      throw err;
    }
  }, [auth.token]);

  // Fetch time adjustment requests
  const fetchTimeAdjustmentRequests = async () => {
    if (!auth?.token || !auth?.employee?.is_admin) return;
    
    setLoadingRequests(true);
    try {
      const response = await axios.get('http://localhost:5000/api/attendance/admin/pending-time-adjustments', {
        headers: { Authorization: `Bearer ${auth.token}` }
      });
      setTimeAdjustmentRequests(response.data);
    } catch (err) {
      console.error('Lỗi tải yêu cầu điều chỉnh:', err);
      showSnackbar('Không thể tải yêu cầu điều chỉnh', 'error');
    } finally {
      setLoadingRequests(false);
    }
  };

  // Fetch truc thay requests
  const fetchTrucThayRequests = async () => {
    if (!auth?.token || !auth?.employee?.is_admin) return;
    
    setLoadingTrucThay(true);
    try {
      const res = await axios.get('http://localhost:5000/api/attendance/admin/pending-tructhay', {
        headers: { Authorization: `Bearer ${auth.token}` }
      });
      setTrucThayRequests(res.data);
    } catch (err) {
      console.error('Lỗi tải yêu cầu trực thay:', err);
      showSnackbar('Không thể tải yêu cầu trực thay', 'error');
    } finally {
      setLoadingTrucThay(false);
    }
  };

  // Process time adjustment request
  const handleProcessTimeAdjustment = async (requestId, approve, adjustedTime, adminNote) => {
    try {
      setLoadingRequests(true);
      
      const response = await axios.post(
        `http://localhost:5000/api/attendance/admin/time-adjustment/${requestId}/process`,
        { approve, thoi_gian_dieu_chinh: adjustedTime, ghi_chu_admin: adminNote },
        { headers: { Authorization: `Bearer ${auth.token}` } }
      );
      
      if (response.data.success) {
        showSnackbar(response.data.message, 'success');
        // Refresh dữ liệu
        await Promise.all([
          fetchTimeAdjustmentRequests(),
          fetchAllAttendance()
        ]);
      } else {
        showSnackbar(response.data.message || 'Xử lý thất bại', 'error');
      }
      
    } catch (err) {
      console.error('Lỗi xử lý yêu cầu:', err);
      console.error('Chi tiết lỗi:', err.response?.data);
      showSnackbar(err.response?.data?.message || 'Xử lý yêu cầu thất bại', 'error');
    } finally {
      setLoadingRequests(false);
    }
  };

  // Process truc thay request
  const handleProcessTrucThay = async (requestId, approve) => {
    try {
      setLoadingTrucThay(true);
      const res = await axios.post(
        `http://localhost:5000/api/attendance/admin/tructhay/${requestId}/approve`,
        { approve },
        { headers: { Authorization: `Bearer ${auth.token}` } }
      );
      showSnackbar(res.data.message, 'success');
      await Promise.all([fetchTrucThayRequests(), fetchAllAttendance()]); // Refresh
    } catch (err) {
      showSnackbar(err.response?.data?.message || 'Xử lý thất bại', 'error');
    } finally {
      setLoadingTrucThay(false);
    }
  };

  // Show snackbar
  const showSnackbar = (message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const closeSnackbar = () => {
    setSnackbar(prev => ({ ...prev, open: false }));
  };

  // Fetch employees
useEffect(() => {
  fetchEmployees();
  fetchTimeAdjustmentRequests();
  fetchTrucThayRequests();
}, [auth.token, auth?.employee?.is_admin]);

  // Fetch registered users
  const fetchRegisteredUsers = async () => {
    if (!auth?.token || !auth?.employee?.is_admin) return;
    
    setLoadingRegisteredUsers(true);
    try {
      const response = await axios.get('http://localhost:5000/api/attendance/admin/registered-users', {
        headers: { Authorization: `Bearer ${auth.token}` }
      });
      setRegisteredUsers(response.data);
    } catch (err) {
      console.error('Lỗi tải danh sách user đã đăng ký:', err);
    } finally {
      setLoadingRegisteredUsers(false);
    }
  };

  // Lấy danh sách nhân viên (không admin) và thống kê theo tháng/năm được chọn
// Lấy danh sách nhân viên gốc (không thống kê theo tháng) cho Tab 1
const fetchEmployees = async () => {
  if (!auth?.token || !auth?.employee?.is_admin) return;
  
  setLoadingEmployees(true);
  try {
    const response = await axios.get('http://localhost:5000/api/attendance/admin/employees', {
      headers: { Authorization: `Bearer ${auth.token}` }
    });
    const nonAdminEmployees = (response.data || []).filter(emp => !emp.is_admin);
    setEmployees(nonAdminEmployees);
    setSelectedEmployees(nonAdminEmployees.map(emp => emp.id));
  } catch (err) {
    setError('Không thể tải danh sách nhân viên: ' + (err.response?.data?.message || err.message));
  } finally {
    setLoadingEmployees(false);
  }
};

// Lấy danh sách nhân viên kèm thống kê theo tháng (cho Tab 2)
const loadEmployeesWithStats = async () => {
  if (!auth?.token) return;
  setLoadingEmployees(true);
  try {
    const empRes = await axios.get('http://localhost:5000/api/attendance/admin/employees', {
      headers: { Authorization: `Bearer ${auth.token}` }
    });
    const nonAdminEmployees = (empRes.data || []).filter(emp => !emp.is_admin);
    
    // Lấy thống kê tháng cho từng nhân viên
    const employeesWithStats = await Promise.all(
      nonAdminEmployees.map(async (emp) => {
        try {
          const statsRes = await axios.get(
            `http://localhost:5000/api/attendance/admin/employee/${emp.id}/monthly-stats?month=${statsMonth}&year=${statsYear}`,
            { headers: { Authorization: `Bearer ${auth.token}` } }
          );
          return {
            ...emp,
            total_registered_shifts: statsRes.data.total_registered,
            total_completed_shifts: statsRes.data.total_completed,
            total_work_hours: statsRes.data.total_hours
          };
        } catch (err) {
          console.error(`Lỗi lấy stats cho ${emp.ma_nhan_vien}:`, err);
          return {
            ...emp,
            total_registered_shifts: 0,
            total_completed_shifts: 0,
            total_work_hours: 0
          };
        }
      })
    );
    
    setEmployees(employeesWithStats);
    setSelectedEmployees(employeesWithStats.map(emp => emp.id));
  } catch (err) {
    setError('Không thể tải danh sách nhân viên: ' + (err.response?.data?.message || err.message));
  } finally {
    setLoadingEmployees(false);
  }
};

  // Fetch user detail
  const fetchUserDetail = async (userId) => {
    if (!auth?.token) return;
    
    try {
      const response = await axios.get(
        `http://localhost:5000/api/attendance/admin/employee/${userId}/detail?month=${selectedMonth}&year=${selectedYear}`,
        { headers: { Authorization: `Bearer ${auth.token}` } }
      );
      
      setUserDetailDialog({
        open: true,
        user: response.data.employee,
        schedule: response.data.schedule || []
      });
    } catch (err) {
      console.error('Lỗi tải chi tiết user:', err);
    }
  };

  // Fetch attendance data
  const fetchAllAttendance = async () => {
    if (!auth?.token || selectedEmployees.length === 0) return;
    
    setLoading(true);
    setError('');
    
    try {
      const attendanceData = {};
      const statsData = {};
      const notesData = {};
      
      for (const employeeId of selectedEmployees) {
        try {
          const employee = employees.find(emp => emp.id === employeeId);
          if (!employee) continue;
          
          const attendanceRes = await axios.get(
            `http://localhost:5000/api/attendance/admin/employee/${employeeId}/attendance?month=${month}&year=${year}`,
            { headers: { Authorization: `Bearer ${auth.token}` } }
          );
          
          const transformedData = transformAttendanceData(attendanceRes.data, employee);
          attendanceData[employeeId] = transformedData;
          
          transformedData.forEach(item => {
            const dateKey = item.date;
            const empAbbr = getEmployeeAbbr(employee);
            const hours = item.tong_gio || 0;
            
            if (hours > 0) {
              if (!notesData[dateKey]) {
                notesData[dateKey] = [];
              }
              notesData[dateKey].push(`${empAbbr}: ${hours.toFixed(2)}h`);
            }
          });
          
          const statsRes = await axios.get(
            `http://localhost:5000/api/attendance/admin/employee/${employeeId}/monthly-stats?month=${month}&year=${year}`,
            { headers: { Authorization: `Bearer ${auth.token}` } }
          );
          statsData[employeeId] = statsRes.data;
          
        } catch (err) {
          console.error(`Error fetching data for employee ${employeeId}:`, err);
        }
      }
      
      const formattedNotes = {};
      Object.keys(notesData).forEach(date => {
        formattedNotes[date] = notesData[date].join('; ');
      });
      
      setAllAttendanceData(attendanceData);
      setStats(statsData);
      setNotesByDate(formattedNotes);
      
      const { combinedData, employeeHours } = createCombinedTableData(attendanceData, formattedNotes);
      setCombinedTableData(combinedData);
      setEmployeeHoursPerDay(employeeHours);
      
    } catch (err) {
      setError('Không thể tải dữ liệu chấm công: ' + (err.response?.data?.message || err.message));
      setAllAttendanceData({});
      setStats({});
      setCombinedTableData([]);
      setEmployeeHoursPerDay({});
      setNotesByDate({});
    } finally {
      setLoading(false);
    }
  };

  // Transform attendance data
  const transformAttendanceData = (records, employee) => {
    const groupedByDate = {};
    
    records.forEach(record => {
      const date = record.ngay.split('T')[0];
      if (!groupedByDate[date]) {
        groupedByDate[date] = {
          date,
          ca1: false,
          ca2: false,
          ca3: false,
          ca4: false,
          ghi_chu: '',
          tong_gio: 0,
          employeeName: employee.ten_nhan_vien,
          employeeId: employee.id,
          employeeHours: {},
          // Thêm thông tin trực thay chi tiết cho từng ca
          ca1_details: [],
          ca2_details: [],
          ca3_details: [],
          ca4_details: []
        };
      }
      
      const employeeAbbr = getEmployeeAbbr(employee);
      const ca = record.ca;
      const hours = parseFloat(record.thoi_gian_lam) || 0;
      
      // Đánh dấu ca
      groupedByDate[date][ca] = true;
      groupedByDate[date].tong_gio += hours;
      groupedByDate[date].employeeHours[employee.id] = 
        (groupedByDate[date].employeeHours[employee.id] || 0) + hours;
      
      // Xử lý thông tin trực thay
      let trucThayInfo = null;
      let isTrucThay = false;
      let tooltip = employeeAbbr;
      
      if (record.loai_lich === 'virtual') {
        // Người này đang trực thay cho người khác
        isTrucThay = true;
        trucThayInfo = {
          type: 'performer',
          nguoi_duoc_truc_thay: record.ten_nguoi_duoc_truc_thay,
          ma_nguoi_duoc_truc_thay: record.ma_nguoi_duoc_truc_thay
        };
        tooltip = `${employeeAbbr} (trực thay cho ${record.ten_nguoi_duoc_truc_thay})`;
      } else if (record.loai_lich === 'original') {
        // Người này được trực thay bởi người khác
        isTrucThay = false;
        trucThayInfo = {
          type: 'receiver',
          nguoi_truc_thay: record.ten_nguoi_truc_thay,
          ma_nguoi_truc_thay: record.ma_nguoi_truc_thay
        };
        tooltip = `${employeeAbbr} (được ${record.ten_nguoi_truc_thay} trực thay)`;
      }
      
      // Lưu chi tiết ca
      groupedByDate[date][`${ca}_details`].push({
        name: employeeAbbr,
        hours,
        isTrucThay,
        tooltip,
        trucThayInfo
      });
      
      // Ghi chú tổng hợp (giữ nguyên)
      if (hours > 0) {
        let note = `${employeeAbbr}: ${hours.toFixed(2)}h`;
        if (trucThayInfo) {
          if (trucThayInfo.type === 'performer') {
            note += ` (trực thay ${trucThayInfo.nguoi_duoc_truc_thay})`;
          } else {
            note += ` (được ${trucThayInfo.nguoi_truc_thay} trực thay)`;
          }
        }
        if (groupedByDate[date].ghi_chu) {
          groupedByDate[date].ghi_chu += `; ${note}`;
        } else {
          groupedByDate[date].ghi_chu = note;
        }
      }
    });
    
    return Object.values(groupedByDate)
      .map(item => ({
        ...item,
        weekday: getWeekdayVN(item.date),
        formattedDate: formatDate(item.date)
      }))
      .sort((a, b) => new Date(a.date) - new Date(b.date));
  };

  // Create combined table data
  const createCombinedTableData = (attendanceData, notes) => {
    const allDates = getAllDatesInMonth(year, month);
    const combinedMap = {};
    const employeeHoursMap = {};
    
    allDates.forEach(date => {
      combinedMap[date] = {
        date,
        weekday: getWeekdayVN(date),
        formattedDate: formatDate(date),
        ca1: [],
        ca2: [],
        ca3: [],
        ca4: [],
        ca1_details: [],
        ca2_details: [],
        ca3_details: [],
        ca4_details: [],
        ghi_chu: notes[date] || '',
        tong_gio: 0,
        total_hours: 0
      };
    });
    
    Object.values(attendanceData).forEach(employeeData => {
      employeeData.forEach(item => {
        if (!combinedMap[item.date]) return;

        // Gộp thông tin từ các employee vào combinedMap
        combinedMap[item.date].ca1_details = [...combinedMap[item.date].ca1_details, ...(item.ca1_details || [])];
        combinedMap[item.date].ca2_details = [...combinedMap[item.date].ca2_details, ...(item.ca2_details || [])];
        combinedMap[item.date].ca3_details = [...combinedMap[item.date].ca3_details, ...(item.ca3_details || [])];
        combinedMap[item.date].ca4_details = [...combinedMap[item.date].ca4_details, ...(item.ca4_details || [])];
        
        // Vẫn giữ ca1, ca2,... dạng mảng các tên để tương thích ngược
        if (item.ca1) combinedMap[item.date].ca1.push(getEmployeeAbbr(employees.find(e => e.id === item.employeeId)));
        if (item.ca2) combinedMap[item.date].ca2.push(getEmployeeAbbr(employees.find(e => e.id === item.employeeId)));
        if (item.ca3) combinedMap[item.date].ca3.push(getEmployeeAbbr(employees.find(e => e.id === item.employeeId)));
        if (item.ca4) combinedMap[item.date].ca4.push(getEmployeeAbbr(employees.find(e => e.id === item.employeeId)));
        
        combinedMap[item.date].total_hours += item.tong_gio || 0;
        
        if (!employeeHoursMap[item.date]) {
          employeeHoursMap[item.date] = {};
        }
        
        if (item.employeeHours) {
          Object.keys(item.employeeHours).forEach(empIdStr => {
            const empId = Number(empIdStr);
            if (!empId) return;

            const emp = employees.find(e => e.id === empId);
            if (!emp) return;

            const prev = employeeHoursMap[item.date][empId] || 0;
            employeeHoursMap[item.date][empId] = prev + (item.employeeHours[empIdStr] || 0);
          });
        }
      });
    });
    
    const filteredData = Object.values(combinedMap)
      .filter(day => day.ca1.length > 0 || day.ca2.length > 0 || day.ca3.length > 0 || day.ca4.length > 0)
      .sort((a, b) => new Date(a.date) - new Date(b.date));
    
    return {
      combinedData: filteredData,
      employeeHours: employeeHoursMap
    };
  };

  // ======================
  // Hàm xử lý quản lý nhân viên
  // ======================
  const openEmployeeDialog = (mode, employee = null) => {
    setEmployeeDialog({
      open: true,
      mode,
      employee: employee ? {
        id: employee.id,
        ma_nhan_vien: employee.ma_nhan_vien,
        ten_nhan_vien: employee.ten_nhan_vien,
        password: '',
        is_admin: employee.is_admin || false
      } : {
        ma_nhan_vien: '',
        ten_nhan_vien: '',
        password: '',
        is_admin: false
      },
      errors: {}
    });
  };

  const handleSaveEmployee = async () => {
    const { employee, mode } = employeeDialog;
    const errors = {};

    if (!employee.ma_nhan_vien.trim()) errors.ma_nhan_vien = 'Mã nhân viên là bắt buộc';
    if (!employee.ten_nhan_vien.trim()) errors.ten_nhan_vien = 'Tên nhân viên là bắt buộc';
    if (mode === 'create' && !employee.password) errors.password = 'Mật khẩu là bắt buộc';

    if (Object.keys(errors).length > 0) {
      setEmployeeDialog({ ...employeeDialog, errors });
      return;
    }

    try {
      setLoadingEmployees(true);
      
      if (mode === 'create') {
        await axios.post('http://localhost:5000/api/attendance/admin/employees/create', {
          ma_nhan_vien: employee.ma_nhan_vien,
          ten_nhan_vien: employee.ten_nhan_vien,
          password: employee.password,
          is_admin: employee.is_admin
        }, {
          headers: { Authorization: `Bearer ${auth.token}` }
        });
        showSnackbar('Tạo nhân viên thành công!', 'success');
      } else {
        const updateData = {
          ten_nhan_vien: employee.ten_nhan_vien,
          is_admin: employee.is_admin
        };
        if (employee.password) {
          updateData.password = employee.password;
        }
        await axios.put(`http://localhost:5000/api/attendance/admin/employees/${employee.id}`, updateData, {
          headers: { Authorization: `Bearer ${auth.token}` }
        });
        showSnackbar('Cập nhật nhân viên thành công!', 'success');
      }

      // Refresh danh sách
      await fetchRegisteredUsers();
      setEmployeeDialog({ ...employeeDialog, open: false });
      
    } catch (err) {
      const errorMsg = err.response?.data?.message || 'Có lỗi xảy ra';
      showSnackbar(errorMsg, 'error');
    } finally {
      setLoadingEmployees(false);
    }
  };

  const handleDeleteEmployee = async (employeeId) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa nhân viên này? Hành động này không thể hoàn tác.')) {
      return;
    }

    try {
      setLoadingEmployees(true);
      await axios.delete(`http://localhost:5000/api/attendance/admin/employees/${employeeId}`, {
        headers: { Authorization: `Bearer ${auth.token}` }
      });
      
      // Refresh danh sách
      await fetchRegisteredUsers();
      showSnackbar('Xóa nhân viên thành công!', 'success');
      
    } catch (err) {
      const errorMsg = err.response?.data?.message || 'Không thể xóa nhân viên';
      showSnackbar(errorMsg, 'error');
    } finally {
      setLoadingEmployees(false);
    }
  };

  const openResetPasswordDialog = (employee) => {
    setResetPasswordDialog({
      open: true,
      employee,
      newPassword: '',
      confirmPassword: '',
      error: '',
      success: ''
    });
  };

  const handleResetPassword = async () => {
    const { employee, newPassword, confirmPassword } = resetPasswordDialog;

    if (!newPassword || !confirmPassword) {
      setResetPasswordDialog(prev => ({ ...prev, error: 'Vui lòng nhập đầy đủ mật khẩu' }));
      return;
    }
    if (newPassword !== confirmPassword) {
      setResetPasswordDialog(prev => ({ ...prev, error: 'Mật khẩu xác nhận không khớp' }));
      return;
    }
    if (newPassword.length < 6) {
      setResetPasswordDialog(prev => ({ ...prev, error: 'Mật khẩu phải có ít nhất 6 ký tự' }));
      return;
    }

    try {
      setLoadingEmployees(true);
      await axios.post(
        'http://localhost:5000/api/attendance/admin/reset-password',
        { ma_nhan_vien: employee.ma_nhan_vien, new_password: newPassword },
        { headers: { Authorization: `Bearer ${auth.token}` } }
      );
      setResetPasswordDialog(prev => ({ ...prev, success: 'Đặt lại mật khẩu thành công!', error: '' }));
      setTimeout(() => {
        setResetPasswordDialog({ open: false, employee: null, newPassword: '', confirmPassword: '', error: '', success: '' });
      }, 1500);
    } catch (err) {
      setResetPasswordDialog(prev => ({ ...prev, error: err.response?.data?.message || 'Có lỗi xảy ra' }));
    } finally {
      setLoadingEmployees(false);
    }
  };

  // Handle tab change
const handleTabChange = (event, newValue) => {
  setTabValue(newValue);
  if (newValue === 0) {
    fetchEmployees(); // lấy danh sách gốc cho Tab 1
  } else {
    loadEmployeesWithStats(); // lấy danh sách kèm stats theo tháng cho Tab 2
  }
};

  // Handle employee selection
  useEffect(() => {
    if (employees.length > 0 && selectedEmployees.length > 0 && tabValue === 0) {
      fetchAllAttendance();
    }
  }, [selectedEmployees, month, year, tabValue]);

  // Refresh data
  const handleRefresh = () => {
    if (tabValue === 0) {
      Promise.all([
        fetchAllAttendance(),
        fetchTimeAdjustmentRequests(),
        fetchTrucThayRequests()
      ]);
    } else {
      loadEmployeesWithStats();
    }
  };

  // Handle employee toggle
  const handleEmployeeToggle = (employeeId) => {
    setSelectedEmployees(prev => {
      if (prev.includes(employeeId)) {
        return prev.filter(id => id !== employeeId);
      } else {
        return [...prev, employeeId];
      }
    });
  };

  const handleSelectAll = () => {
    if (selectedEmployees.length === employees.length) {
      setSelectedEmployees([]);
    } else {
      setSelectedEmployees(employees.map(emp => emp.id));
    }
  };

  // Calculate totals
  const calculateTotals = () => {
    let totalHours = 0;
    let totalShifts = 0;
    
    Object.values(allAttendanceData).forEach(employeeData => {
      employeeData.forEach(day => {
        totalHours += day.tong_gio || 0;
        
        if (day.ca1) totalShifts++;
        if (day.ca2) totalShifts++;
        if (day.ca3) totalShifts++;
        if (day.ca4) totalShifts++;
      });
    });
    
    const totalAmount = (totalHours * 22000).toLocaleString('vi-VN');

    return {
      totalHours: totalHours.toFixed(2),
      totalShifts,
      totalAmount
    };
  };

  const totals = calculateTotals();

  // Handle Excel export
  const handleExportExcel = () => {
    exportChamCongExcel(allAttendanceData, employees, selectedEmployees, year, month);
  };

  // Helper function to safely format number
  const formatNumber = (value, decimals = 2) => {
    if (value === null || value === undefined) return '0.00';
    const num = parseFloat(value);
    return isNaN(num) ? '0.00' : num.toFixed(decimals);
  };

  if (!auth?.employee?.is_admin) {
    return (
      <Box sx={{ p: 2.5 }}>
        <Alert severity="error" sx={{ fontSize: '0.9rem' }}>Bạn không có quyền truy cập trang quản trị.</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2.5, bgcolor: '#f5f5f5', minHeight: '100vh' }}>
      {/* Header */}
      <Typography variant="h5" fontWeight="bold" sx={{ mb: 2.5, color: '#1976d2' }}>
        QUẢN LÝ CHẤM CÔNG
      </Typography>

      {/* Tabs */}
      <Paper sx={{ mb: 2.5, borderRadius: 2, overflow: 'hidden' }}>
        <Tabs 
          value={tabValue} 
          onChange={handleTabChange}
          variant="fullWidth"
          indicatorColor="primary"
          textColor="primary"
          sx={{
            minHeight: 45,
            '& .MuiTab-root': {
              fontWeight: 'bold',
              fontSize: '0.9rem',
              minHeight: 45,
              py: 1,
              '&.Mui-selected': {
                bgcolor: alpha('#1976d2', 0.1)
              }
            }
          }}
        >
          <Tab 
            icon={<Badge badgeContent={timeAdjustmentRequests.filter(r => r.trang_thai === 'pending').length} color="error" sx={{ '& .MuiBadge-badge': { right: -5, top: 5 } }}><WorkIcon /></Badge>}
            iconPosition="start"
            label="Bảng chấm công tổng hợp" 
          />
          <Tab label="Danh sách user đã đăng ký" />
        </Tabs>
      </Paper>

      {/* ================= TAB 1 ================= */}
      <TabPanel value={tabValue} index={0}>
        {/* Statistics với 5 thẻ cùng hàng */}
        <StatisticsCards 
          totals={calculateTotals()} 
          stats={stats} 
          pendingRequests={timeAdjustmentRequests.filter(r => r.trang_thai === 'pending').length}
          requests={timeAdjustmentRequests}
          onProcessRequest={handleProcessTimeAdjustment}
          loadingRequests={loadingRequests}
          pendingTrucThay={trucThayRequests.filter(r => r.trang_thai === 'pending').length}
          trucThayRequests={trucThayRequests}
          onProcessTrucThay={handleProcessTrucThay}
          loadingTrucThay={loadingTrucThay}
          month={month}                      
          year={year}                        
          fetchAllTrucThay={fetchAllTrucThay}
          fetchAllTimeAdjustments={fetchAllTimeAdjustments}
        />

        {/* Layout 2 CỘT (đã bỏ cột giữa) */}
        <Grid container spacing={2} alignItems="stretch">
          
          {/* CỘT TRÁI - DANH SÁCH NHÂN VIÊN */}
          <Grid item xs={12} md={4}>
            <EmployeeList
              employees={employees}
              selectedEmployees={selectedEmployees}
              onEmployeeToggle={handleEmployeeToggle}
              onSelectAll={handleSelectAll}
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              loading={loadingEmployees}
            />
          </Grid>

          {/* CỘT PHẢI - BẢNG CHẤM CÔNG TỔNG HỢP */}
          <Grid item xs={12} md={8}>
            <Paper
              sx={{
                borderRadius: 2,
                p: 2,
                height: "100%",
                display: "flex",
                flexDirection: "column",
                boxShadow: "0 2px 6px rgba(0,0,0,0.05)"
              }}
            >
              <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                sx={{ mb: 2 }}
              >
                <Typography variant="subtitle1" fontWeight="bold" sx={{ fontSize: '1rem' }}>
                  📊 BẢNG CHẤM CÔNG TỔNG HỢP
                </Typography>

                <Stack direction="row" spacing={1}>
                  <TextField
                    select
                    label="Tháng"
                    value={month}
                    onChange={(e) => setMonth(Number(e.target.value))}
                    size="small"
                    sx={{ minWidth: 90, '& .MuiInputLabel-root': { fontSize: '0.85rem' }, '& .MuiSelect-select': { fontSize: '0.85rem', py: 0.8 } }}
                    SelectProps={{ native: true }}
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                      <option key={m} value={m}>Tháng {m}</option>
                    ))}
                  </TextField>
                  
                  <TextField
                    select
                    label="Năm"
                    value={year}
                    onChange={(e) => setYear(Number(e.target.value))}
                    size="small"
                    sx={{ minWidth: 90, '& .MuiInputLabel-root': { fontSize: '0.85rem' }, '& .MuiSelect-select': { fontSize: '0.85rem', py: 0.8 } }}
                    SelectProps={{ native: true }}
                  >
                    {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </TextField>
                  
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<RefreshIcon />}
                    onClick={handleRefresh}
                    sx={{ fontSize: '0.8rem', py: 0.6 }}
                  >
                    Làm mới
                  </Button>

                  <Button
                    variant="contained"
                    size="small"
                    startIcon={<DownloadIcon />}
                    onClick={handleExportExcel}
                    disabled={selectedEmployees.length === 0 || loading}
                    sx={{ fontSize: '0.8rem', py: 0.6 }}
                  >
                    Xuất Excel
                  </Button>
                </Stack>
              </Stack>

              {/* Error message */}
              {error && (
                <Alert severity="error" sx={{ mb: 2, borderRadius: 2, py: 0.8, fontSize: '0.85rem' }}>
                  {error}
                </Alert>
              )}

              {/* Bảng */}
              <Box sx={{ flexGrow: 1 }}>
                <DetailedAttendanceTable
                  combinedTableData={combinedTableData}
                  employeeHoursPerDay={employeeHoursPerDay}
                  selectedEmployees={selectedEmployees}
                  employees={employees}
                  loading={loading}
                />
              </Box>
            </Paper>
          </Grid>
        </Grid>
      </TabPanel>

      {/* ================= TAB 2 ================= */}
      <TabPanel value={tabValue} index={1}>
  <Paper sx={{ p: 2.5, borderRadius: 2, boxShadow: '0 2px 6px rgba(0,0,0,0.05)' }}>
    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2.5, flexWrap: 'wrap', gap: 1 }}>
      <Box>
        <Typography variant="h6" fontWeight="bold" sx={{ color: '#1976d2', fontSize: '1.1rem' }}>
          👥 QUẢN LÝ NHÂN VIÊN
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.85rem' }}>
          Tổng số: {employees.length} nhân viên (không kể admin)
        </Typography>
      </Box>
      <Stack direction="row" spacing={1} alignItems="center">
        {/* Bộ lọc tháng/năm */}
        <TextField
          select
          label="Tháng"
          value={statsMonth}
          onChange={(e) => {
            setStatsMonth(Number(e.target.value));
            loadEmployeesWithStats();
          }}
          size="small"
          sx={{ minWidth: 90, '& .MuiInputLabel-root': { fontSize: '0.85rem' }, '& .MuiSelect-select': { fontSize: '0.85rem', py: 0.8 } }}
          SelectProps={{ native: true }}
        >
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
            <option key={m} value={m}>Tháng {m}</option>
          ))}
        </TextField>
        
        <TextField
          select
          label="Năm"
          value={statsYear}
          onChange={(e) => {
            setStatsYear(Number(e.target.value));
            loadEmployeesWithStats();
          }}
          size="small"
          sx={{ minWidth: 90, '& .MuiInputLabel-root': { fontSize: '0.85rem' }, '& .MuiSelect-select': { fontSize: '0.85rem', py: 0.8 } }}
          SelectProps={{ native: true }}
        >
          {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </TextField>

        <Button
          variant="contained"
          size="small"
          startIcon={<AddIcon />}
          onClick={() => openEmployeeDialog('create')}
          sx={{ fontSize: '0.8rem', py: 0.6 }}
        >
          Thêm nhân viên
        </Button>
        <Button variant="outlined" size="small" startIcon={<RefreshIcon />} onClick={loadEmployeesWithStats}>
          Làm mới
        </Button>
      </Stack>
    </Stack>

    {/* Phần bảng giữ nguyên */}
    {loadingEmployees ? (
      <CircularProgress />
    ) : (
      <TableContainer sx={{ maxHeight: 450 }}>
  <Table size="small" stickyHeader>
    <TableHead>
      <TableRow sx={{ bgcolor: '#1976d2' }}>
        <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>STT</TableCell>
        <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Mã NV</TableCell>
        <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Tên NV</TableCell>
        <TableCell align="center" sx={{ color: 'white', fontWeight: 'bold' }}>Số ca đăng ký</TableCell>
        <TableCell align="center" sx={{ color: 'white', fontWeight: 'bold' }}>Số ca hoàn thành</TableCell>
        <TableCell align="center" sx={{ color: 'white', fontWeight: 'bold' }}>Tổng giờ làm</TableCell>
        <TableCell align="center" sx={{ color: 'white', fontWeight: 'bold' }}>Face Login</TableCell>
        <TableCell align="center" sx={{ color: 'white', fontWeight: 'bold' }}>Hành động</TableCell>
      </TableRow>
    </TableHead>
    <TableBody>
      {employees.map((user, idx) => (
        <TableRow key={user.id}>
          <TableCell>{idx + 1}</TableCell>
          <TableCell>{user.ma_nhan_vien}</TableCell>
          <TableCell>{user.ten_nhan_vien}</TableCell>
          <TableCell align="center">{user.total_registered_shifts || 0}</TableCell>
          <TableCell align="center">{user.total_completed_shifts || 0}</TableCell>
          <TableCell align="center">{((Number(user.total_work_hours) || 0)).toFixed(1)}h</TableCell>
          <TableCell align="center">
            <Chip 
              label={user.face_login_enabled ? "Bật" : "Tắt"}
              size="small"
              color={user.face_login_enabled ? "success" : "default"}
              sx={{ height: 20, fontSize: '0.7rem' }}
            />
          </TableCell>
          <TableCell align="center">
            <Tooltip title="Xem chi tiết lịch sử">
              <IconButton color="primary" onClick={() => fetchUserDetail(user.id)}>
                <VisibilityIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Sửa thông tin">
              <IconButton color="warning" onClick={() => openEmployeeDialog('edit', user)}>
                <EditIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Cài đặt đăng nhập khuôn mặt">
              <IconButton color="secondary" onClick={() => openFaceSettings(user)}>
                <SettingsIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Xóa nhân viên">
              <IconButton color="error" onClick={() => handleDeleteEmployee(user.id)} disabled={user.id === auth.employee.id}>
                <DeleteIcon />
              </IconButton>
            </Tooltip>
          </TableCell>
        </TableRow>
      ))}
      {employees.length === 0 && (
        <TableRow>
          <TableCell colSpan={8} align="center">
            <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
              Chưa có nhân viên nào trong hệ thống
            </Typography>
          </TableCell>
        </TableRow>
      )}
    </TableBody>
  </Table>
</TableContainer>
    )}
  </Paper>
</TabPanel>

      {/* Dialog tạo/sửa nhân viên */}
      <Dialog
        open={employeeDialog.open}
        onClose={() => setEmployeeDialog({ ...employeeDialog, open: false })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {employeeDialog.mode === 'create' ? '➕ Thêm nhân viên mới' : '✏️ Sửa thông tin nhân viên'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <TextField
              fullWidth
              label="Mã nhân viên *"
              value={employeeDialog.employee.ma_nhan_vien}
              onChange={(e) => setEmployeeDialog({
                ...employeeDialog,
                employee: { ...employeeDialog.employee, ma_nhan_vien: e.target.value },
                errors: { ...employeeDialog.errors, ma_nhan_vien: '' }
              })}
              error={!!employeeDialog.errors.ma_nhan_vien}
              helperText={employeeDialog.errors.ma_nhan_vien}
              sx={{ mb: 2 }}
              disabled={employeeDialog.mode === 'edit'}
            />
            
            <TextField
              fullWidth
              label="Tên nhân viên *"
              value={employeeDialog.employee.ten_nhan_vien}
              onChange={(e) => setEmployeeDialog({
                ...employeeDialog,
                employee: { ...employeeDialog.employee, ten_nhan_vien: e.target.value },
                errors: { ...employeeDialog.errors, ten_nhan_vien: '' }
              })}
              error={!!employeeDialog.errors.ten_nhan_vien}
              helperText={employeeDialog.errors.ten_nhan_vien}
              sx={{ mb: 2 }}
            />
            
            <TextField
              fullWidth
              label={employeeDialog.mode === 'create' ? "Mật khẩu *" : "Mật khẩu mới"}
              type="password"
              value={employeeDialog.employee.password}
              onChange={(e) => setEmployeeDialog({
                ...employeeDialog,
                employee: { ...employeeDialog.employee, password: e.target.value },
                errors: { ...employeeDialog.errors, password: '' }
              })}
              error={!!employeeDialog.errors.password}
              helperText={employeeDialog.errors.password || (employeeDialog.mode === 'edit' ? 'Để trống nếu không thay đổi mật khẩu' : '')}
              sx={{ mb: 2 }}
            />
            
            <FormControlLabel
              control={
                <Switch
                  checked={employeeDialog.employee.is_admin}
                  onChange={(e) => setEmployeeDialog({
                    ...employeeDialog,
                    employee: { ...employeeDialog.employee, is_admin: e.target.checked }
                  })}
                />
              }
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <AdminPanelSettingsIcon fontSize="small" />
                  <Typography>Cấp quyền Quản trị viên</Typography>
                </Box>
              }
            />
            
            <Alert severity="info" sx={{ mt: 2 }}>
              <Typography variant="body2">
                <strong>Lưu ý:</strong> Mật khẩu sẽ được mã hóa trước khi lưu vào hệ thống.
              </Typography>
            </Alert>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEmployeeDialog({ ...employeeDialog, open: false })}>
            Hủy
          </Button>
          <Button 
            variant="contained" 
            onClick={handleSaveEmployee}
            disabled={loadingEmployees}
          >
            {loadingEmployees ? 'Đang xử lý...' : employeeDialog.mode === 'create' ? 'Tạo mới' : 'Cập nhật'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog reset mật khẩu */}
      <Dialog
        open={resetPasswordDialog.open}
        onClose={() => setResetPasswordDialog({ ...resetPasswordDialog, open: false })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Đặt lại mật khẩu cho {resetPasswordDialog.employee?.ten_nhan_vien}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            {resetPasswordDialog.error && (
              <Alert severity="error" sx={{ mb: 2 }}>{resetPasswordDialog.error}</Alert>
            )}
            {resetPasswordDialog.success && (
              <Alert severity="success" sx={{ mb: 2 }}>{resetPasswordDialog.success}</Alert>
            )}
            <TextField
              fullWidth
              label="Mật khẩu mới"
              type="password"
              value={resetPasswordDialog.newPassword}
              onChange={(e) => setResetPasswordDialog({ ...resetPasswordDialog, newPassword: e.target.value, error: '' })}
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label="Xác nhận mật khẩu"
              type="password"
              value={resetPasswordDialog.confirmPassword}
              onChange={(e) => setResetPasswordDialog({ ...resetPasswordDialog, confirmPassword: e.target.value, error: '' })}
              sx={{ mb: 2 }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResetPasswordDialog({ ...resetPasswordDialog, open: false })}>Hủy</Button>
          <Button variant="contained" onClick={handleResetPassword} disabled={loadingEmployees}>
            {loadingEmployees ? 'Đang xử lý...' : 'Đặt lại'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog xem chi tiết user */}
      <Dialog
        open={userDetailDialog.open}
        onClose={() => setUserDetailDialog({ open: false, user: null, schedule: [] })}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ py: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Avatar sx={{ bgcolor: '#1976d2', width: 40, height: 40, fontSize: '1rem' }}>
              {userDetailDialog.user?.ten_nhan_vien?.charAt(0) || '?'}
            </Avatar>
            <Box>
              <Typography variant="h6" sx={{ fontSize: '1.1rem' }}>
                {userDetailDialog.user?.ten_nhan_vien}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.85rem' }}>
                Mã NV: {userDetailDialog.user?.ma_nhan_vien}
              </Typography>
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ py: 1.5 }}>
          <Typography variant="subtitle1" fontWeight="bold" gutterBottom sx={{ fontSize: '0.95rem' }}>
            Lịch sử chấm công tháng {selectedMonth}/{selectedYear}
          </Typography>
          
          {userDetailDialog.schedule.length === 0 ? (
            <Alert severity="info" sx={{ fontSize: '0.9rem' }}>
              Không có dữ liệu chấm công trong tháng này
            </Alert>
          ) : (
            <TableContainer>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Ngày</TableCell>
                    <TableCell sx={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Ca</TableCell>
                    <TableCell sx={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Giờ vào</TableCell>
                    <TableCell sx={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Giờ ra</TableCell>
                    <TableCell sx={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Thời gian</TableCell>
                    <TableCell sx={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Trạng thái</TableCell>
                    <TableCell sx={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Hành động</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {userDetailDialog.schedule.map((item, idx) => (
                    <TableRow key={idx}>
                      <TableCell sx={{ fontSize: '0.8rem' }}>{formatDate(item.ngay)}</TableCell>
                      <TableCell sx={{ fontSize: '0.8rem' }}>
                        {item.ca === 'ca1' ? 'Ca 1' :
                         item.ca === 'ca2' ? 'Ca 2' :
                         item.ca === 'ca3' ? 'Ca 3' : 'Ca 4'}
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.8rem' }}>{item.gio_vao ? item.gio_vao.substring(0,5) : '--:--'}</TableCell>
                      <TableCell sx={{ fontSize: '0.8rem' }}>{item.gio_ra ? item.gio_ra.substring(0,5) : '--:--'}</TableCell>
                      <TableCell sx={{ fontSize: '0.8rem' }}>
                        {item.thoi_gian_lam ? `${parseFloat(item.thoi_gian_lam).toFixed(2)}h` : '--'}
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.8rem' }}>
                        <Chip 
                          size="small"
                          label={
                            item.trang_thai === 'registered' ? 'Đã đăng ký' :
                            item.trang_thai === 'checked_in' ? 'Đang làm' :
                            item.trang_thai === 'checked_out' ? 'Hoàn thành' : item.trang_thai
                          }
                          color={
                            item.trang_thai === 'registered' ? 'default' :
                            item.trang_thai === 'checked_in' ? 'warning' :
                            item.trang_thai === 'checked_out' ? 'success' : 'default'
                          }
                          sx={{ height: 20, fontSize: '0.7rem' }}
                        />
                      </TableCell>
                      <TableCell align="center" sx={{ fontSize: '0.8rem' }}>
                        {item.trang_thai === 'checked_out' && (
                          <IconButton
                            size="small"
                            color="warning"
                            onClick={() => handleRevertCheckout(item.id)}
                            disabled={revertLoading}
                            title="Hoàn tác checkout (trả lại trạng thái đang làm)"
                          >
                            <HistoryIcon fontSize="small" />
                          </IconButton>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions sx={{ py: 1.5 }}>
          <Button onClick={() => setUserDetailDialog({ open: false, user: null, schedule: [] })} size="small">
            Đóng
          </Button>
        </DialogActions>
      </Dialog>

       {/* Dialog cài đặt khuôn mặt */}
      <Dialog open={faceSettingsDialog.open} onClose={() => setFaceSettingsDialog({ ...faceSettingsDialog, open: false })} maxWidth="sm" fullWidth>
        <DialogTitle>Cài đặt đăng nhập khuôn mặt - {faceSettingsDialog.employee?.ten_nhan_vien}</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <FormControlLabel
              control={<Switch checked={faceSettingsDialog.face_login_enabled} onChange={(e) => setFaceSettingsDialog(prev => ({ ...prev, face_login_enabled: e.target.checked }))} />}
              label="Cho phép đăng nhập bằng khuôn mặt"
            />
            <Divider sx={{ my: 2 }} />
            <FormControlLabel
              control={<Switch checked={faceSettingsDialog.face_code_enabled} onChange={(e) => setFaceSettingsDialog(prev => ({ ...prev, face_code_enabled: e.target.checked }))} />}
              label="Yêu cầu nhập mã xác thực khi đăng nhập"
            />
            {faceSettingsDialog.face_code_enabled && (
              <TextField
                fullWidth
                label="Mã xác thực"
                value={faceSettingsDialog.face_code}
                onChange={(e) => setFaceSettingsDialog(prev => ({ ...prev, face_code: e.target.value }))}
                placeholder="Nhập mã code (có thể tùy ý)"
                helperText="Mã này sẽ được yêu cầu sau khi nhận diện khuôn mặt thành công"
                sx={{ mt: 2 }}
              />
            )}
            {faceSettingsDialog.error && (
              <Alert severity="error" sx={{ mt: 2 }}>{faceSettingsDialog.error}</Alert>
            )}

            <Divider sx={{ my: 2 }} />
<Button
  fullWidth
  variant="outlined"
  color="error"
  startIcon={<DeleteSweepIcon />}
  onClick={handleDeleteFaceData}
  disabled={faceSettingsDialog.loading}
>
  Xóa dữ liệu khuôn mặt
</Button>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFaceSettingsDialog({ ...faceSettingsDialog, open: false })}>Hủy</Button>
          <Button variant="contained" onClick={saveFaceSettings} disabled={faceSettingsDialog.loading}>
            {faceSettingsDialog.loading ? 'Đang lưu...' : 'Lưu'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar thông báo */}
      {snackbar.open && (
        <Alert
          severity={snackbar.severity}
          sx={{
            position: 'fixed',
            bottom: 16,
            right: 16,
            zIndex: 9999,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            fontSize: '0.85rem'
          }}
          onClose={closeSnackbar}
        >
          {snackbar.message}
        </Alert>
      )}
    </Box>
  );
};

export default AdminHistory;