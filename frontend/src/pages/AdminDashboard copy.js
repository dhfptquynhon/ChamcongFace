import React, { useState, useEffect, useContext } from 'react';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  TextField,
  InputAdornment,
  IconButton,
  Button,
  Grid,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  Tabs,
  Tab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tooltip,
  Avatar,
  Badge,
  LinearProgress,
  Divider,
  Switch,
  FormControlLabel,
  Stack
} from '@mui/material';
import {
  Search as SearchIcon,
  FilterList as FilterIcon,
  Download as DownloadIcon,
  Visibility as VisibilityIcon,
  Person as PersonIcon,
  CalendarMonth as CalendarMonthIcon,
  AccessTime as AccessTimeIcon,
  Refresh as RefreshIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  AdminPanelSettings as AdminPanelSettingsIcon,
  Work as WorkIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon,
  Today as TodayIcon,
  TrendingUp as TrendingUpIcon,
  People as PeopleIcon,
  History as HistoryIcon,
  ListAlt as ListAltIcon
} from '@mui/icons-material';
import axios from 'axios';
import AuthContext from '../context/AuthContext';

const AdminDashboard = () => {
  const { auth } = useContext(AuthContext);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState(0);
  
  // State cho quản lý nhân viên
  const [employees, setEmployees] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  
  // State cho thống kê chung
  const [stats, setStats] = useState({
    totalEmployees: 0,
    activeToday: 0,
    totalShiftsThisMonth: 0,
    totalHoursThisMonth: 0,
    pendingTrucThay: 0
  });
  
  // State cho xem chi tiết nhân viên
  const [employeeDetail, setEmployeeDetail] = useState({
    open: false,
    employee: null,
    schedule: [],
    attendance: [],
    monthlyStats: null,
    trucThayRecords: []
  });
  
  // State cho báo cáo
  const [reportDate, setReportDate] = useState({
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear()
  });

  // State cho quản lý nhân viên
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

  // State cho trực thay chờ duyệt
  const [pendingTrucThay, setPendingTrucThay] = useState([]);

  // State mới: Báo cáo chấm công tổng hợp
  const [attendanceReport, setAttendanceReport] = useState({
    loading: false,
    data: [],
    summary: {
      totalEmployees: 0,
      totalShifts: 0,
      totalHours: 0,
      averageHours: 0,
      completionRate: 0
    }
  });

  // ======================
  // HÀM FORMAT DATE THAY THẾ (không cần date-fns)
  // ======================
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
      // Nếu dateString đã là định dạng dd/mm/yyyy thì trả về nguyên bản
      if (typeof dateString === 'string' && dateString.includes('/')) {
        return dateString;
      }
      return dateString;
    }
  };

  const formatTime = (time) => {
    if (!time) return '--:--';
    if (typeof time === 'string') {
      // Lấy HH:MM từ chuỗi thời gian
      const match = time.match(/(\d{1,2}):(\d{1,2})/);
      if (match) {
        const hours = match[1].padStart(2, '0');
        const minutes = match[2].padStart(2, '0');
        return `${hours}:${minutes}`;
      }
    }
    return time;
  };

  // ======================
  // 1. LẤY DANH SÁCH TẤT CẢ NHÂN VIÊN
  // ======================
  const fetchAllEmployees = async () => {
    if (!auth?.token) return;
    
    setLoading(true);
    try {
      const res = await axios.get('http://localhost:5000/api/attendance/admin/employees', {
        headers: { Authorization: `Bearer ${auth.token}` }
      });
      setEmployees(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Không thể tải danh sách nhân viên');
    } finally {
      setLoading(false);
    }
  };

  // ======================
  // 2. LẤY THỐNG KÊ TỔNG QUAN
  // ======================
  const fetchOverviewStats = async () => {
    if (!auth?.token) return;
    
    try {
      const res = await axios.get('http://localhost:5000/api/attendance/admin/overview-stats', {
        headers: { Authorization: `Bearer ${auth.token}` }
      });
      setStats(res.data);
    } catch (err) {
      console.error('Lỗi lấy thống kê:', err);
    }
  };

  // ======================
  // 3. LẤY BÁO CÁO CHẤM CÔNG TỔNG HỢP
  // ======================
  const fetchAttendanceReport = async (month, year) => {
    if (!auth?.token) return;
    
    setAttendanceReport(prev => ({ ...prev, loading: true }));
    try {
      const res = await axios.get(
        `http://localhost:5000/api/attendance/admin/attendance-report?month=${month}&year=${year}`,
        { headers: { Authorization: `Bearer ${auth.token}` } }
      );
      
      setAttendanceReport({
        loading: false,
        data: res.data.details || [],
        summary: res.data.summary || {
          totalEmployees: 0,
          totalShifts: 0,
          totalHours: 0,
          averageHours: 0,
          completionRate: 0
        }
      });
    } catch (err) {
      setError(err.response?.data?.message || 'Không thể tải báo cáo chấm công');
      setAttendanceReport(prev => ({ ...prev, loading: false }));
    }
  };

  // ======================
  // 4. XUẤT BÁO CÁO EXCEL TỔNG HỢP
  // ======================
  const exportAttendanceReport = async () => {
    if (!auth?.token) return;
    
    try {
      const url = `http://localhost:5000/api/attendance/admin/export/attendance-report?month=${reportDate.month}&year=${reportDate.year}`;
      
      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${auth.token}` },
        responseType: 'blob'
      });
      
      // Tạo file download
      const blob = new Blob([res.data], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      const urlBlob = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = urlBlob;
      link.download = `BaoCaoChamCong_Thang${reportDate.month}_${reportDate.year}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(urlBlob);
      
      // Hiển thị thông báo thành công
      setError('');
      setTimeout(() => {
        alert('Xuất báo cáo Excel thành công!');
      }, 100);
    } catch (err) {
      setError('Xuất báo cáo thất bại: ' + (err.response?.data?.message || err.message));
    }
  };

  // ======================
  // 5. LẤY TRỰC THAY CHỜ DUYỆT
  // ======================
  const fetchPendingTrucThay = async () => {
    if (!auth?.token) return;
    
    try {
      const res = await axios.get('http://localhost:5000/api/attendance/admin/pending-tructhay', {
        headers: { Authorization: `Bearer ${auth.token}` }
      });
      setPendingTrucThay(res.data);
    } catch (err) {
      console.error('Lỗi lấy trực thay chờ duyệt:', err);
    }
  };

  // ======================
  // 6. LẤY CHI TIẾT NHÂN VIÊN
  // ======================
  const fetchEmployeeDetail = async (employeeId) => {
    if (!auth?.token || !employeeId) return;
    
    setLoading(true);
    try {
      const [scheduleRes, attendanceRes, statsRes, trucThayRes] = await Promise.all([
        axios.get(`http://localhost:5000/api/attendance/admin/employee/${employeeId}/schedule?month=${reportDate.month}&year=${reportDate.year}`, {
          headers: { Authorization: `Bearer ${auth.token}` }
        }),
        axios.get(`http://localhost:5000/api/attendance/admin/employee/${employeeId}/attendance?month=${reportDate.month}&year=${reportDate.year}`, {
          headers: { Authorization: `Bearer ${auth.token}` }
        }),
        axios.get(`http://localhost:5000/api/attendance/admin/employee/${employeeId}/monthly-stats?month=${reportDate.month}&year=${reportDate.year}`, {
          headers: { Authorization: `Bearer ${auth.token}` }
        }),
        axios.get(`http://localhost:5000/api/attendance/admin/employee/${employeeId}/tructhay`, {
          headers: { Authorization: `Bearer ${auth.token}` }
        })
      ]);

      setEmployeeDetail({
        open: true,
        employee: employees.find(emp => emp.id === employeeId),
        schedule: scheduleRes.data,
        attendance: attendanceRes.data,
        monthlyStats: statsRes.data,
        trucThayRecords: trucThayRes.data
      });
    } catch (err) {
      setError(err.response?.data?.message || 'Không thể tải chi tiết nhân viên');
    } finally {
      setLoading(false);
    }
  };

  // ======================
  // 7. XUẤT BÁO CÁO EXCEL (TỔNG HỢP)
  // ======================
  const exportSummaryReport = async () => {
    if (!auth?.token) return;
    
    try {
      const url = `http://localhost:5000/api/attendance/admin/export/summary-report?month=${reportDate.month}&year=${reportDate.year}`;
      
      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${auth.token}` },
        responseType: 'blob'
      });
      
      const blob = new Blob([res.data], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      const urlBlob = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = urlBlob;
      link.download = `BaoCaoTongHop_Thang${reportDate.month}_${reportDate.year}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(urlBlob);
      
      alert('Xuất báo cáo tổng hợp thành công!');
    } catch (err) {
      setError('Xuất báo cáo thất bại: ' + (err.response?.data?.message || err.message));
    }
  };

  // ======================
  // 8. MỞ DIALOG TẠO/SỬA NHÂN VIÊN
  // ======================
  const openEmployeeDialog = (mode, employee = null) => {
    setEmployeeDialog({
      open: true,
      mode,
      employee: employee ? {
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

  // ======================
  // 9. XỬ LÝ TẠO/SỬA NHÂN VIÊN
  // ======================
  const handleSaveEmployee = async () => {
    const { employee, mode } = employeeDialog;
    const errors = {};

    // Validate
    if (!employee.ma_nhan_vien.trim()) errors.ma_nhan_vien = 'Mã nhân viên là bắt buộc';
    if (!employee.ten_nhan_vien.trim()) errors.ten_nhan_vien = 'Tên nhân viên là bắt buộc';
    if (mode === 'create' && !employee.password) errors.password = 'Mật khẩu là bắt buộc';

    if (Object.keys(errors).length > 0) {
      setEmployeeDialog({ ...employeeDialog, errors });
      return;
    }

    try {
      setLoading(true);
      
      if (mode === 'create') {
        await axios.post('http://localhost:5000/api/attendance/admin/employees/create', employee, {
          headers: { Authorization: `Bearer ${auth.token}` }
        });
      } else {
        // Cập nhật - chỉ gửi các trường cần thiết
        const updateData = {
          ten_nhan_vien: employee.ten_nhan_vien,
          is_admin: employee.is_admin
        };
        // Chỉ thêm password nếu có
        if (employee.password) {
          updateData.password = employee.password;
        }
        
        await axios.put(`http://localhost:5000/api/attendance/admin/employees/${selectedEmployee?.id}`, updateData, {
          headers: { Authorization: `Bearer ${auth.token}` }
        });
      }

      // Refresh danh sách
      await fetchAllEmployees();
      
      // Đóng dialog
      setEmployeeDialog({ ...employeeDialog, open: false });
      
      // Hiển thị thông báo
      alert(`${mode === 'create' ? 'Tạo' : 'Cập nhật'} nhân viên thành công!`);
      
    } catch (err) {
      const errorMsg = err.response?.data?.message || 'Có lỗi xảy ra';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  // ======================
  // 10. XÓA NHÂN VIÊN
  // ======================
  const handleDeleteEmployee = async (employeeId) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa nhân viên này? Hành động này không thể hoàn tác.')) {
      return;
    }

    try {
      setLoading(true);
      await axios.delete(`http://localhost:5000/api/attendance/admin/employees/${employeeId}`, {
        headers: { Authorization: `Bearer ${auth.token}` }
      });
      
      // Refresh danh sách
      await fetchAllEmployees();
      alert('Xóa nhân viên thành công!');
      
    } catch (err) {
      const errorMsg = err.response?.data?.message || 'Không thể xóa nhân viên';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  // ======================
  // 11. DUYỆT TRỰC THAY
  // ======================
  const handleApproveTrucThay = async (trucThayId, approve) => {
    try {
      setLoading(true);
      
      const res = await axios.post(
        `http://localhost:5000/api/attendance/admin/tructhay/${trucThayId}/approve`,
        { approve },
        { headers: { Authorization: `Bearer ${auth.token}` } }
      );
      
      alert(res.data.message);
      
      // Refresh dữ liệu
      await Promise.all([
        fetchPendingTrucThay(),
        fetchOverviewStats()
      ]);
      
    } catch (err) {
      const errorMsg = err.response?.data?.message || 'Có lỗi xảy ra';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  // ======================
  // 12. HÀM TÍNH TỔNG GIỜ LÀM
  // ======================
  const calculateTotalHours = (records) => {
    return records.reduce((total, record) => {
      return total + (Number(record.thoi_gian_lam) || 0);
    }, 0).toFixed(1);
  };

  // ======================
  // 13. LỌC NHÂN VIÊN THEO TÌM KIẾM
  // ======================
  const filteredEmployees = employees.filter(emp => {
    const searchLower = searchTerm.toLowerCase();
    return (
      emp.ma_nhan_vien.toLowerCase().includes(searchLower) ||
      emp.ten_nhan_vien.toLowerCase().includes(searchLower)
    );
  });

  // ======================
  // 14. EFFECT HOOKS
  // ======================
  useEffect(() => {
    if (auth?.employee?.is_admin) {
      fetchAllEmployees();
      fetchOverviewStats();
      fetchPendingTrucThay();
    }
  }, [auth]);

  useEffect(() => {
    if (auth?.employee?.is_admin && tab === 1) { // Tab báo cáo chấm công
      fetchAttendanceReport(reportDate.month, reportDate.year);
    }
  }, [auth, tab, reportDate.month, reportDate.year]);

  // ======================
  // 15. KIỂM TRA QUYỀN ADMIN
  // ======================
  if (!auth?.employee?.is_admin) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Alert severity="error">
          Bạn không có quyền truy cập trang quản trị
        </Alert>
      </Box>
    );
  }

  // ======================
  // 16. HÀM FORMAT THỜI GIAN ĐỊA PHƯƠNG
  // ======================
  const formatLocalTime = (dateString) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return '';
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* TIÊU ĐỀ */}
      <Typography variant="h4" fontWeight="bold" gutterBottom sx={{ color: '#1976d2', mb: 3 }}>
        🛠️ Bảng điều khiển Quản trị viên
      </Typography>

      {/* THỐNG KÊ TỔNG QUAN */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ height: '100%', borderLeft: '4px solid #1976d2' }}>
            <CardContent>
              <Typography color="textSecondary" gutterBottom variant="body2">
                <PeopleIcon sx={{ mr: 1, fontSize: '1rem' }} />
                Tổng nhân viên
              </Typography>
              <Typography variant="h4" color="primary" fontWeight="bold">
                {stats.totalEmployees}
              </Typography>
              <Typography variant="caption" color="textSecondary">
                Đang hoạt động: {employees.filter(e => e.total_registered_shifts > 0).length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ height: '100%', borderLeft: '4px solid #2e7d32' }}>
            <CardContent>
              <Typography color="textSecondary" gutterBottom variant="body2">
                <TodayIcon sx={{ mr: 1, fontSize: '1rem' }} />
                Đang làm hôm nay
              </Typography>
              <Typography variant="h4" color="success.main" fontWeight="bold">
                {stats.activeToday}
              </Typography>
              <Typography variant="caption" color="textSecondary">
                Trong tổng số {employees.length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ height: '100%', borderLeft: '4px solid #ed6c02' }}>
            <CardContent>
              <Typography color="textSecondary" gutterBottom variant="body2">
                <WorkIcon sx={{ mr: 1, fontSize: '1rem' }} />
                Số ca tháng này
              </Typography>
              <Typography variant="h4" color="warning.main" fontWeight="bold">
                {stats.totalShiftsThisMonth}
              </Typography>
              <Typography variant="caption" color="textSecondary">
                Trung bình: {employees.length > 0 ? (stats.totalShiftsThisMonth / employees.length).toFixed(1) : 0} ca/người
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ height: '100%', borderLeft: '4px solid #0288d1' }}>
            <CardContent>
              <Typography color="textSecondary" gutterBottom variant="body2">
                <AccessTimeIcon sx={{ mr: 1, fontSize: '1rem' }} />
                Tổng giờ tháng
              </Typography>
              <Typography variant="h4" color="info.main" fontWeight="bold">
                {stats.totalHoursThisMonth.toFixed(1)}h
              </Typography>
              <Typography variant="caption" color="textSecondary">
                Trung bình: {employees.length > 0 ? (stats.totalHoursThisMonth / employees.length).toFixed(1) : 0}h/người
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* BADGE CHO TRỰC THAY CHỜ DUYỆT */}
      {stats.pendingTrucThay > 0 && (
        <Alert 
          severity="warning" 
          sx={{ mb: 3 }}
          action={
            <Button 
              color="inherit" 
              size="small"
              onClick={() => setTab(2)}
            >
              Xem ngay
            </Button>
          }
        >
          Có {stats.pendingTrucThay} yêu cầu trực thay đang chờ duyệt
        </Alert>
      )}

      {/* TABS */}
      <Paper sx={{ mb: 3, borderRadius: 2 }}>
        <Tabs 
          value={tab} 
          onChange={(e, v) => setTab(v)}
          variant="fullWidth"
          sx={{
            '& .MuiTab-root': {
              minHeight: 48,
              fontWeight: 500
            }
          }}
        >
          <Tab 
            icon={<PeopleIcon />} 
            iconPosition="start" 
            label="Quản lý nhân viên" 
          />
          <Tab 
            icon={<ListAltIcon />} 
            iconPosition="start" 
            label="Báo cáo chấm công" 
          />
          <Tab 
            icon={<ScheduleIcon />} 
            iconPosition="start" 
            label={
              <Badge 
                badgeContent={stats.pendingTrucThay} 
                color="error"
                sx={{ mr: 1 }}
              >
                Quản lý trực thay
              </Badge>
            } 
          />
          <Tab 
            icon={<TrendingUpIcon />} 
            iconPosition="start" 
            label="Xuất báo cáo" 
          />
        </Tabs>
      </Paper>

      {/* TAB 1: QUẢN LÝ NHÂN VIÊN */}
      {tab === 0 && (
        <Paper sx={{ p: 3, borderRadius: 2 }}>
          {/* HEADER VỚI CÔNG CỤ */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h6" fontWeight="bold">
              📋 Danh sách nhân viên ({employees.length})
            </Typography>
            
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              <TextField
                placeholder="Tìm kiếm theo mã, tên..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                sx={{ width: '300px' }}
                size="small"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                }}
              />
              
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => openEmployeeDialog('create')}
              >
                Thêm nhân viên
              </Button>
              
              <Tooltip title="Làm mới danh sách">
                <IconButton onClick={fetchAllEmployees}>
                  <RefreshIcon />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>

          {/* BẢNG NHÂN VIÊN */}
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}>
              <CircularProgress />
            </Box>
          ) : error ? (
            <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
          ) : (
            <TableContainer sx={{ maxHeight: 500 }}>
              <Table stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold' }}>Mã NV</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Tên nhân viên</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Vai trò</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Ngày tạo</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Số ca đăng ký</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Tổng giờ làm</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Hành động</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredEmployees.map((employee) => (
                    <TableRow 
                      key={employee.id}
                      hover
                      sx={{ 
                        cursor: 'pointer',
                        backgroundColor: selectedEmployee?.id === employee.id ? '#f0f7ff' : 'inherit'
                      }}
                      onClick={() => setSelectedEmployee(employee)}
                    >
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Avatar sx={{ width: 32, height: 32, bgcolor: employee.is_admin ? '#f44336' : '#1976d2' }}>
                            {employee.ten_nhan_vien.charAt(0)}
                          </Avatar>
                          <Typography fontWeight="bold">
                            {employee.ma_nhan_vien}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography>
                          {employee.ten_nhan_vien}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={employee.is_admin ? "Quản trị viên" : "Nhân viên"}
                          color={employee.is_admin ? "error" : "default"}
                          size="small"
                          icon={employee.is_admin ? <AdminPanelSettingsIcon /> : <PersonIcon />}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {formatDate(employee.created_at)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <WorkIcon fontSize="small" color="primary" />
                          <Typography fontWeight="bold" color="primary">
                            {employee.total_registered_shifts || 0}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <AccessTimeIcon fontSize="small" color="success" />
                          <Typography fontWeight="bold" color="success.main">
                            {(employee.total_work_hours || 0).toFixed(1)}h
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={1}>
                          <Tooltip title="Xem chi tiết">
                            <IconButton
                              size="small"
                              color="primary"
                              onClick={(e) => {
                                e.stopPropagation();
                                fetchEmployeeDetail(employee.id);
                              }}
                            >
                              <VisibilityIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          
                          <Tooltip title="Sửa thông tin">
                            <IconButton
                              size="small"
                              color="warning"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedEmployee(employee);
                                openEmployeeDialog('edit', employee);
                              }}
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          
                          <Tooltip title="Xóa nhân viên">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteEmployee(employee.id);
                              }}
                              disabled={employee.id === auth.employee.id} // Không cho xóa chính mình
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {/* THÔNG TIN NHÂN VIÊN ĐƯỢC CHỌN */}
          {selectedEmployee && (
            <Paper sx={{ p: 2, mt: 3, backgroundColor: '#f8f9fa' }}>
              <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                👤 Thông tin nhân viên được chọn
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} md={4}>
                  <Typography><strong>Mã NV:</strong> {selectedEmployee.ma_nhan_vien}</Typography>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Typography><strong>Tên:</strong> {selectedEmployee.ten_nhan_vien}</Typography>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Typography>
                    <strong>Vai trò:</strong> 
                    <Chip 
                      label={selectedEmployee.is_admin ? "Quản trị viên" : "Nhân viên"}
                      color={selectedEmployee.is_admin ? "error" : "default"}
                      size="small"
                      sx={{ ml: 1 }}
                    />
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<VisibilityIcon />}
                    onClick={() => fetchEmployeeDetail(selectedEmployee.id)}
                  >
                    Xem chi tiết chấm công
                  </Button>
                </Grid>
              </Grid>
            </Paper>
          )}
        </Paper>
      )}

      {/* TAB 2: BÁO CÁO CHẤM CÔNG */}
      {tab === 1 && (
        <Paper sx={{ p: 3, borderRadius: 2 }}>
          <Typography variant="h6" fontWeight="bold" gutterBottom>
            📊 Báo cáo chấm công tháng {reportDate.month}/{reportDate.year}
          </Typography>
          
          {/* BỘ LỌC THỜI GIAN */}
          <Box sx={{ display: 'flex', gap: 2, mb: 3, alignItems: 'center' }}>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Tháng</InputLabel>
              <Select
                value={reportDate.month}
                label="Tháng"
                onChange={(e) => setReportDate({ ...reportDate, month: e.target.value })}
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                  <MenuItem key={month} value={month}>
                    Tháng {month}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Năm</InputLabel>
              <Select
                value={reportDate.year}
                label="Năm"
                onChange={(e) => setReportDate({ ...reportDate, year: e.target.value })}
              >
                {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map((year) => (
                  <MenuItem key={year} value={year}>
                    {year}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            
            <Button 
              variant="contained" 
              color="success"
              startIcon={<DownloadIcon />}
              onClick={exportAttendanceReport}
              disabled={attendanceReport.loading}
            >
              Xuất Excel
            </Button>
            
            <Tooltip title="Làm mới dữ liệu">
              <IconButton onClick={() => fetchAttendanceReport(reportDate.month, reportDate.year)}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </Box>

          {/* THỐNG KÊ TỔNG QUAN */}
          {attendanceReport.summary && (
            <Grid container spacing={3} sx={{ mb: 3 }}>
              <Grid item xs={12} sm={6} md={3}>
                <Card sx={{ height: '100%', borderLeft: '4px solid #1976d2' }}>
                  <CardContent>
                    <Typography color="textSecondary" gutterBottom variant="body2">
                      <PeopleIcon sx={{ mr: 1, fontSize: '1rem' }} />
                      Tổng nhân viên
                    </Typography>
                    <Typography variant="h4" color="primary" fontWeight="bold">
                      {attendanceReport.summary.totalEmployees}
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      Đã chấm công: {attendanceReport.data.filter(e => e.total_shifts > 0).length}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid item xs={12} sm={6} md={3}>
                <Card sx={{ height: '100%', borderLeft: '4px solid #2e7d32' }}>
                  <CardContent>
                    <Typography color="textSecondary" gutterBottom variant="body2">
                      <WorkIcon sx={{ mr: 1, fontSize: '1rem' }} />
                      Tổng số ca
                    </Typography>
                    <Typography variant="h4" color="success.main" fontWeight="bold">
                      {attendanceReport.summary.totalShifts}
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      Trung bình: {(attendanceReport.summary.totalShifts / (attendanceReport.summary.totalEmployees || 1)).toFixed(1)} ca/người
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid item xs={12} sm={6} md={3}>
                <Card sx={{ height: '100%', borderLeft: '4px solid #ed6c02' }}>
                  <CardContent>
                    <Typography color="textSecondary" gutterBottom variant="body2">
                      <AccessTimeIcon sx={{ mr: 1, fontSize: '1rem' }} />
                      Tổng giờ làm
                    </Typography>
                    <Typography variant="h4" color="warning.main" fontWeight="bold">
                      {attendanceReport.summary.totalHours.toFixed(1)}h
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      Trung bình: {attendanceReport.summary.averageHours.toFixed(1)}h/người
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid item xs={12} sm={6} md={3}>
                <Card sx={{ height: '100%', borderLeft: '4px solid #0288d1' }}>
                  <CardContent>
                    <Typography color="textSecondary" gutterBottom variant="body2">
                      <TodayIcon sx={{ mr: 1, fontSize: '1rem' }} />
                      Tỷ lệ hoàn thành
                    </Typography>
                    <Typography variant="h4" color="info.main" fontWeight="bold">
                      {attendanceReport.summary.completionRate || 0}%
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      Số người hoàn thành: {attendanceReport.data.filter(e => e.completion_rate >= 80).length}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          )}

          {/* BẢNG BÁO CÁO CHI TIẾT */}
          <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
            Chi tiết chấm công từng nhân viên
          </Typography>
          
          {attendanceReport.loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}>
              <CircularProgress />
            </Box>
          ) : attendanceReport.data.length === 0 ? (
            <Alert severity="info">
              Không có dữ liệu chấm công cho tháng {reportDate.month}/{reportDate.year}
            </Alert>
          ) : (
            <TableContainer component={Paper} sx={{ maxHeight: 500 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>STT</TableCell>
                    <TableCell>Tên nhân viên</TableCell>
                    <TableCell>Mã NV</TableCell>
                    <TableCell>Số ca đã làm</TableCell>
                    <TableCell>Tổng giờ làm</TableCell>
                    <TableCell>Giờ trung bình/ca</TableCell>
                    <TableCell>Ngày làm việc</TableCell>
                    <TableCell>Tỷ lệ hoàn thành</TableCell>
                    <TableCell>Hành động</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {attendanceReport.data.map((emp, index) => {
                    const avgHoursPerShift = emp.total_shifts > 0
                      ? (emp.total_hours / emp.total_shifts).toFixed(1)
                      : 0;

                    return (
                      <TableRow key={emp.ma_nhan_vien} hover>
                        <TableCell>{index + 1}</TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Avatar sx={{ width: 32, height: 32, bgcolor: '#1976d2' }}>
                              {emp.ten_nhan_vien.charAt(0)}
                            </Avatar>
                            <Typography fontWeight="medium">
                              {emp.ten_nhan_vien}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Chip label={emp.ma_nhan_vien} size="small" color="primary" />
                        </TableCell>
                        <TableCell align="center">
                          <Chip 
                            label={emp.total_shifts || 0} 
                            size="small" 
                            color={emp.total_shifts > 0 ? "primary" : "default"}
                          />
                        </TableCell>
                        <TableCell align="center">
                          <Typography fontWeight="bold" color="success.main">
                            {(emp.total_hours || 0).toFixed(1)}h
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          {avgHoursPerShift}h
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {emp.work_days ? emp.work_days.split(',').slice(0, 3).join(', ') : 'Chưa có'}
                            {emp.work_days && emp.work_days.split(',').length > 3 && '...'}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="body2" color="text.secondary">
                              {emp.completion_rate || 0}%
                            </Typography>
                            <LinearProgress 
                              variant="determinate" 
                              value={emp.completion_rate || 0} 
                              sx={{ width: 50, height: 6, borderRadius: 3 }}
                              color={emp.completion_rate >= 80 ? "success" : emp.completion_rate >= 50 ? "warning" : "error"}
                            />
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<VisibilityIcon />}
                            onClick={() => {
                              const employee = employees.find(e => e.ma_nhan_vien === emp.ma_nhan_vien);
                              if (employee) {
                                fetchEmployeeDetail(employee.id);
                              }
                            }}
                          >
                            Chi tiết
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>
      )}

      {/* TAB 3: QUẢN LÝ TRỰC THAY */}
      {tab === 2 && (
        <Paper sx={{ p: 3, borderRadius: 2 }}>
          <Typography variant="h6" fontWeight="bold" gutterBottom>
            🔄 Quản lý trực thay chờ duyệt ({pendingTrucThay.length})
          </Typography>

          {pendingTrucThay.length === 0 ? (
            <Alert severity="info">
              Không có yêu cầu trực thay nào đang chờ duyệt.
            </Alert>
          ) : (
            <TableContainer sx={{ maxHeight: 500 }}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>STT</TableCell>
                    <TableCell>Người trực thay</TableCell>
                    <TableCell>Người được trực thay</TableCell>
                    <TableCell>Ngày & Ca</TableCell>
                    <TableCell>Lý do</TableCell>
                    <TableCell>Thời gian yêu cầu</TableCell>
                    <TableCell>Hành động</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {pendingTrucThay.map((item, index) => (
                    <TableRow key={item.id} hover>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Avatar sx={{ width: 32, height: 32, bgcolor: '#ff9800' }}>
                            {item.ten_nguoi_truc_thay?.charAt(0)}
                          </Avatar>
                          <Box>
                            <Typography fontWeight="bold">{item.ten_nguoi_truc_thay}</Typography>
                            <Typography variant="caption" color="text.secondary">
                              {item.ma_nguoi_truc_thay}
                            </Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Avatar sx={{ width: 32, height: 32, bgcolor: '#4caf50' }}>
                            {item.ten_nguoi_duoc_truc_thay?.charAt(0)}
                          </Avatar>
                          <Box>
                            <Typography fontWeight="bold">{item.ten_nguoi_duoc_truc_thay}</Typography>
                            <Typography variant="caption" color="text.secondary">
                              {item.ma_nguoi_duoc_truc_thay}
                            </Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography>
                          {formatDate(item.ngay)}
                          <br />
                          <Chip 
                            label={item.ca === 'ca1' ? 'Ca 1 (7:00-9:30)' :
                                  item.ca === 'ca2' ? 'Ca 2 (9:30-12:30)' :
                                  item.ca === 'ca3' ? 'Ca 3 (12:30-15:00)' : 'Ca 4 (15:00-17:30)'}
                            size="small"
                            sx={{ mt: 0.5 }}
                          />
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {item.ly_do || 'Không có lý do'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {formatDate(item.created_at)}
                          <br />
                          <Typography variant="caption" color="text.secondary">
                            {item.created_at ? formatLocalTime(item.created_at) : ''}
                          </Typography>
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={1}>
                          <Button
                            size="small"
                            variant="contained"
                            color="success"
                            startIcon={<CheckCircleIcon />}
                            onClick={() => handleApproveTrucThay(item.id, true)}
                          >
                            Duyệt
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            color="error"
                            onClick={() => handleApproveTrucThay(item.id, false)}
                          >
                            Từ chối
                          </Button>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          <Divider sx={{ my: 3 }} />

          {/* LỊCH SỬ TRỰC THAY ĐÃ DUYỆT */}
          <Typography variant="h6" fontWeight="bold" gutterBottom>
            📋 Lịch sử trực thay đã duyệt
          </Typography>
          <Alert severity="info">
            Tính năng đang được phát triển. Hiện tại chỉ hiển thị các yêu cầu đang chờ duyệt.
          </Alert>
        </Paper>
      )}

      {/* TAB 4: XUẤT BÁO CÁO */}
      {tab === 3 && (
        <Paper sx={{ p: 3, borderRadius: 2 }}>
          <Typography variant="h6" fontWeight="bold" gutterBottom>
            📋 Xuất báo cáo tổng hợp
          </Typography>
          
          <Card sx={{ p: 2, mb: 3, backgroundColor: '#f5f5f5' }}>
            <Typography variant="subtitle2" gutterBottom>
              ⚙️ Thiết lập thời gian báo cáo
            </Typography>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={4}>
                <FormControl fullWidth size="small">
                  <InputLabel>Tháng báo cáo</InputLabel>
                  <Select
                    value={reportDate.month}
                    label="Tháng báo cáo"
                    onChange={(e) => setReportDate({ ...reportDate, month: e.target.value })}
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                      <MenuItem key={month} value={month}>
                        Tháng {month}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={4}>
                <FormControl fullWidth size="small">
                  <InputLabel>Năm báo cáo</InputLabel>
                  <Select
                    value={reportDate.year}
                    label="Năm báo cáo"
                    onChange={(e) => setReportDate({ ...reportDate, year: e.target.value })}
                  >
                    {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map((year) => (
                      <MenuItem key={year} value={year}>
                        {year}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={4}>
                <Typography variant="body2" color="text.secondary">
                  Báo cáo cho: <strong>Tháng {reportDate.month}/{reportDate.year}</strong>
                </Typography>
              </Grid>
            </Grid>
          </Card>

          {/* CÁC LOẠI BÁO CÁO */}
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <DownloadIcon color="primary" sx={{ mr: 1 }} />
                    <Typography variant="h6" color="primary">
                      Báo cáo chấm công chi tiết
                    </Typography>
                  </Box>
                  <Typography variant="body2" paragraph>
                    Xuất báo cáo Excel chi tiết tất cả nhân viên theo tháng:
                  </Typography>
                  <ul style={{ marginLeft: '20px', paddingLeft: 0 }}>
                    <li>Thông tin chi tiết từng nhân viên</li>
                    <li>Số ca đã đăng ký và hoàn thành</li>
                    <li>Giờ check-in/check-out từng ca</li>
                    <li>Tổng giờ làm việc</li>
                    <li>Trạng thái chấm công</li>
                    <li>Ngày làm việc trong tháng</li>
                  </ul>
                  <Button
                    fullWidth
                    variant="contained"
                    startIcon={<DownloadIcon />}
                    onClick={exportAttendanceReport}
                    sx={{ mt: 2 }}
                  >
                    Xuất báo cáo chấm công
                  </Button>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <TrendingUpIcon color="secondary" sx={{ mr: 1 }} />
                    <Typography variant="h6" color="secondary">
                      Báo cáo tổng hợp tháng
                    </Typography>
                  </Box>
                  <Typography variant="body2" paragraph>
                    Xuất báo cáo tổng hợp dạng Excel, bao gồm:
                  </Typography>
                  <ul style={{ marginLeft: '20px', paddingLeft: 0 }}>
                    <li>Tổng quan thống kê tháng</li>
                    <li>Top nhân viên tích cực</li>
                    <li>Phân bố giờ làm theo tuần</li>
                    <li>So sánh với tháng trước</li>
                    <li>Biểu đồ phân tích</li>
                  </ul>
                  <Button
                    fullWidth
                    variant="contained"
                    color="secondary"
                    startIcon={<DownloadIcon />}
                    onClick={exportSummaryReport}
                    sx={{ mt: 2 }}
                  >
                    Xuất báo cáo tổng hợp
                  </Button>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* THÔNG BÁO */}
          <Alert severity="info" sx={{ mt: 3 }}>
            <Typography variant="body2">
              <strong>Lưu ý:</strong> File Excel sẽ được tải về ngay lập tức sau khi nhấn nút "Xuất". 
              Mỗi báo cáo có cấu trúc và thông tin khác nhau phù hợp với mục đích sử dụng.
            </Typography>
          </Alert>
        </Paper>
      )}

      {/* DIALOG TẠO/SỬA NHÂN VIÊN */}
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
              label="Mật khẩu *"
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
            disabled={loading}
          >
            {loading ? 'Đang xử lý...' : employeeDialog.mode === 'create' ? 'Tạo mới' : 'Cập nhật'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* DIALOG XEM CHI TIẾT NHÂN VIÊN */}
      <Dialog
        open={employeeDetail.open}
        onClose={() => setEmployeeDetail({ ...employeeDetail, open: false })}
        maxWidth="lg"
        fullWidth
        sx={{ maxHeight: '80vh' }}
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <PersonIcon />
            <Typography variant="h6">
              Chi tiết chấm công: {employeeDetail.employee?.ten_nhan_vien}
            </Typography>
          </Box>
        </DialogTitle>
        
        <DialogContent>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}>
              <CircularProgress />
            </Box>
          ) : (
            <Box>
              {/* THÔNG TIN CƠ BẢN */}
              <Paper sx={{ p: 2, mb: 3 }}>
                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                  📋 Thông tin cá nhân
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={4}>
                    <Typography><strong>Mã NV:</strong> {employeeDetail.employee?.ma_nhan_vien}</Typography>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Typography><strong>Tên:</strong> {employeeDetail.employee?.ten_nhan_vien}</Typography>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Typography>
                      <strong>Vai trò:</strong> 
                      <Chip 
                        label={employeeDetail.employee?.is_admin ? "Quản trị viên" : "Nhân viên"}
                        color={employeeDetail.employee?.is_admin ? "error" : "default"}
                        size="small"
                        sx={{ ml: 1 }}
                      />
                    </Typography>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Typography><strong>Ngày tạo tài khoản:</strong> {formatDate(employeeDetail.employee?.created_at)}</Typography>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Typography><strong>Số ca đã đăng ký:</strong> {employeeDetail.monthlyStats?.total_registered || 0}</Typography>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Typography><strong>Tổng giờ làm:</strong> {(employeeDetail.monthlyStats?.total_hours || 0).toFixed(1)}h</Typography>
                  </Grid>
                </Grid>
              </Paper>

              {/* THỐNG KÊ THÁNG */}
              {employeeDetail.monthlyStats && (
                <Paper sx={{ p: 2, mb: 3 }}>
                  <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                    📊 Thống kê tháng {reportDate.month}/{reportDate.year}
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={6} md={3}>
                      <Typography variant="body2" color="text.secondary">
                        Số ca đã đăng ký
                      </Typography>
                      <Typography variant="h5" fontWeight="bold" color="primary">
                        {employeeDetail.monthlyStats.total_registered || 0}
                      </Typography>
                    </Grid>
                    <Grid item xs={6} md={3}>
                      <Typography variant="body2" color="text.secondary">
                        Số ca hoàn thành
                      </Typography>
                      <Typography variant="h5" fontWeight="bold" color="success.main">
                        {employeeDetail.monthlyStats.total_completed || 0}
                      </Typography>
                    </Grid>
                    <Grid item xs={6} md={3}>
                      <Typography variant="body2" color="text.secondary">
                        Tổng giờ làm
                      </Typography>
                      <Typography variant="h5" fontWeight="bold" color="warning.main">
                        {(employeeDetail.monthlyStats.total_hours || 0).toFixed(1)}h
                      </Typography>
                    </Grid>
                    <Grid item xs={6} md={3}>
                      <Typography variant="body2" color="text.secondary">
                        Tỷ lệ hoàn thành
                      </Typography>
                      <Typography variant="h5" fontWeight="bold" color="info.main">
                        {employeeDetail.monthlyStats.completion_rate || 0}%
                      </Typography>
                    </Grid>
                  </Grid>
                </Paper>
              )}

              {/* LỊCH TRỰC ĐÃ ĐĂNG KÝ */}
              <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                📅 Lịch trực đã đăng ký ({employeeDetail.schedule.length})
              </Typography>
              {employeeDetail.schedule.length === 0 ? (
                <Alert severity="info">Không có lịch trực nào trong tháng này.</Alert>
              ) : (
                <TableContainer component={Paper} sx={{ maxHeight: 300, mb: 3 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Ngày</TableCell>
                        <TableCell>Ca</TableCell>
                        <TableCell>Trạng thái</TableCell>
                        <TableCell>Giờ vào</TableCell>
                        <TableCell>Giờ ra</TableCell>
                        <TableCell>Thời gian làm</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {employeeDetail.schedule.map((schedule, index) => (
                        <TableRow key={index}>
                          <TableCell>{formatDate(schedule.ngay)}</TableCell>
                          <TableCell>
                            {schedule.ca === 'ca1' ? 'Ca 1: 7:00-9:30' :
                             schedule.ca === 'ca2' ? 'Ca 2: 9:30-12:30' :
                             schedule.ca === 'ca3' ? 'Ca 3: 12:30-15:00' : 'Ca 4: 15:00-17:30'}
                          </TableCell>
                          <TableCell>
                            <Chip 
                              label={schedule.trang_thai === 'registered' ? 'Đã đăng ký' :
                                     schedule.trang_thai === 'checked_in' ? 'Đang làm' :
                                     schedule.trang_thai === 'checked_out' ? 'Hoàn thành' : schedule.trang_thai}
                              color={schedule.trang_thai === 'registered' ? 'default' :
                                     schedule.trang_thai === 'checked_in' ? 'primary' :
                                     schedule.trang_thai === 'checked_out' ? 'success' : 'default'}
                              size="small"
                            />
                          </TableCell>
                          <TableCell>{formatTime(schedule.gio_vao)}</TableCell>
                          <TableCell>{formatTime(schedule.gio_ra)}</TableCell>
                          <TableCell>
                            {schedule.thoi_gian_lam ? `${schedule.thoi_gian_lam}h` : '--'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}

              {/* TRỰC THAY ĐÃ THỰC HIỆN */}
              {employeeDetail.trucThayRecords && employeeDetail.trucThayRecords.length > 0 && (
                <>
                  <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                    🔄 Lịch sử trực thay ({employeeDetail.trucThayRecords.length})
                  </Typography>
                  <TableContainer component={Paper} sx={{ maxHeight: 200, mb: 3 }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Vai trò</TableCell>
                          <TableCell>Người liên quan</TableCell>
                          <TableCell>Ngày & Ca</TableCell>
                          <TableCell>Lý do</TableCell>
                          <TableCell>Trạng thái</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {employeeDetail.trucThayRecords.map((record, index) => (
                          <TableRow key={index}>
                            <TableCell>
                              <Chip 
                                label={record.loai === 'thuc_hien' ? 'Trực thay' : 'Được trực thay'}
                                color={record.loai === 'thuc_hien' ? 'warning' : 'success'}
                                size="small"
                              />
                            </TableCell>
                            <TableCell>
                              {record.loai === 'thuc_hien' 
                                ? `Cho: ${record.ten_nguoi_duoc_truc_thay}`
                                : `Bởi: ${record.ten_nguoi_truc_thay}`
                              }
                            </TableCell>
                            <TableCell>
                              {formatDate(record.ngay)}
                              <br />
                              <Typography variant="caption">
                                {record.ca === 'ca1' ? 'Ca 1' :
                                 record.ca === 'ca2' ? 'Ca 2' :
                                 record.ca === 'ca3' ? 'Ca 3' : 'Ca 4'}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2">
                                {record.ly_do || 'Không có lý do'}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Chip 
                                label={record.trang_thai === 'active' ? 'Đang hoạt động' :
                                       record.trang_thai === 'completed' ? 'Hoàn thành' :
                                       record.trang_thai === 'pending' ? 'Chờ duyệt' : record.trang_thai}
                                color={record.trang_thai === 'active' ? 'primary' :
                                       record.trang_thai === 'completed' ? 'success' :
                                       record.trang_thai === 'pending' ? 'warning' : 'default'}
                                size="small"
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </>
              )}
            </Box>
          )}
        </DialogContent>
        
        <DialogActions>
          <Button onClick={() => setEmployeeDetail({ ...employeeDetail, open: false })}>
            Đóng
          </Button>
        </DialogActions>
      </Dialog>

      {/* THÔNG BÁO LỖI */}
      {error && (
        <Alert 
          severity="error" 
          sx={{ position: 'fixed', bottom: 20, right: 20, minWidth: 300 }}
          onClose={() => setError('')}
        >
          {error}
        </Alert>
      )}
    </Box>
  );
};

export default AdminDashboard;