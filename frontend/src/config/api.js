const API_BASE_URL = 'http://localhost:5000/api';

export const API_ENDPOINTS = {
  // Auth
  LOGIN: `${API_BASE_URL}/auth/login`,
  VERIFY: `${API_BASE_URL}/auth/verify`,
  ME: `${API_BASE_URL}/auth/me`,
  UPDATE_FACE: `${API_BASE_URL}/auth/update-face`,
  REGISTER_FACE: `${API_BASE_URL}/auth/register-face`,
  LOGIN_FACE: `${API_BASE_URL}/auth/login-face`,
  
  // Admin
  ADMIN_EMPLOYEES: `${API_BASE_URL}/admin/employees`,
  ADMIN_CREATE_EMPLOYEE: `${API_BASE_URL}/admin/employees/create`,
  ADMIN_UPDATE_EMPLOYEE: (id) => `${API_BASE_URL}/admin/employees/${id}`,
  ADMIN_DELETE_EMPLOYEE: (id) => `${API_BASE_URL}/admin/employees/${id}`,
  ADMIN_OVERVIEW_STATS: `${API_BASE_URL}/admin/overview-stats`,
  ADMIN_ATTENDANCE_REPORT: `${API_BASE_URL}/admin/attendance-report`,
  ADMIN_PENDING_TRUCTHAY: `${API_BASE_URL}/admin/pending-tructhay`,
  ADMIN_APPROVE_TRUCTHAY: (id) => `${API_BASE_URL}/admin/tructhay/${id}/approve`,
  ADMIN_EMPLOYEE_DETAIL: (id) => `${API_BASE_URL}/admin/employee/${id}/detail`,
  
  // Attendance
  ATTENDANCE_SCHEDULE: `${API_BASE_URL}/attendance/schedule`,
  ATTENDANCE_REGISTER: `${API_BASE_URL}/attendance/schedule/register`,
  ATTENDANCE_CHECKIN: (id) => `${API_BASE_URL}/attendance/schedule/${id}/checkin`,
  ATTENDANCE_CHECKOUT: (id) => `${API_BASE_URL}/attendance/schedule/${id}/checkout`,
  ATTENDANCE_MONTHLY_REPORT: `${API_BASE_URL}/attendance/monthly-report`,
  
  // Trực thay
  TRUCTHAY_REQUEST: `${API_BASE_URL}/truc-thay/request`,
  TRUCTHAY_CANCEL: (id) => `${API_BASE_URL}/truc-thay/cancel/${id}`,
  TRUCTHAY_MY_SHIFTS: `${API_BASE_URL}/truc-thay/my-shifts`,
  TRUCTHAY_CHECK: (id) => `${API_BASE_URL}/truc-thay/check/${id}`,
};

export const getAuthHeader = (token) => ({
  headers: { Authorization: `Bearer ${token}` }
});