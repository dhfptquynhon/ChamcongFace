const express = require('express');
const cors = require('cors');
const router = express.Router();
const db = require('../models/db');
const auth = require('../middleware/auth');
const ExcelJS = require('exceljs');
const { getFaceEmbedding, cosineSimilarity, euclideanDistance } = require('../utils/face');
const jwt = require('jsonwebtoken');

const bcrypt = require('bcrypt');
const saltRounds = 10;

// Cấu hình CORS
router.use(cors({
  origin: 'http://localhost:3000',
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 200
}));

// Helper functions
const pad = (n) => n.toString().padStart(2, '0');
const formatDateLocal = (dateObj) => {
  const d = new Date(dateObj);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

// CẬP NHẬT: Status labels
const statusLabel = {
  'registered': 'Đã đăng ký',
  'checked_in': 'Đang làm',
  'checked_out': 'Đã hoàn thành'
};

// Định nghĩa thông tin các ca
const SHIFTS = [
  { key: 'ca1', name: 'Ca 1: 7:00 – 9:30', start: '07:00', end: '09:30' },
  { key: 'ca2', name: 'Ca 2: 9:30 – 12:30', start: '09:30', end: '12:30' },
  { key: 'ca3', name: 'Ca 3: 12:30 – 15:00', start: '12:30', end: '15:00' },
  { key: 'ca4', name: 'Ca 4: 15:00 – 17:30', start: '15:00', end: '17:30' }
];

// Helper: tổng giờ làm trong tháng của 1 nhân viên
// LƯU Ý: khi ca của một người được người khác trực thay, giờ làm được TÍNH CHO NGƯỜI ĐĂNG KÝ GỐC
// (người sẽ được thanh toán), không tính cho người trực tiếp bấm check-in/out (người trực thay).
const getMonthlyHours = async (ma_nhan_vien, month, year) => {
  const [rows] = await db.query(
    `SELECT COALESCE(SUM(effective_hours), 0) AS total_hours FROM (
      -- Ca tự làm: KHÔNG phải ca ảo đi trực thay cho ai khác, và KHÔNG phải ca gốc đã bị
      -- người khác trực thay (dù giờ đã được đồng bộ sang dòng gốc lúc check-out hay chưa)
      SELECT lt.thoi_gian_lam AS effective_hours
      FROM lich_truc lt
      LEFT JOIN truc_thay tt ON (tt.lich_truc_ao_id = lt.id OR tt.lich_truc_goc_id = lt.id)
        AND tt.trang_thai IN ('active', 'completed')
      WHERE lt.ma_nhan_vien = ? AND MONTH(lt.ngay) = ? AND YEAR(lt.ngay) = ?
        AND lt.trang_thai = 'checked_out' AND lt.thoi_gian_lam IS NOT NULL
        AND NOT (tt.id IS NOT NULL AND tt.lich_truc_ao_id = lt.id)
        AND NOT (tt.id IS NOT NULL AND tt.lich_truc_goc_id = lt.id)

      UNION ALL

      -- Ca được người khác trực thay cho mình (mình là người đăng ký gốc) - lấy giờ từ ca ẢO
      SELECT lt.thoi_gian_lam AS effective_hours
      FROM lich_truc lt
      INNER JOIN truc_thay tt ON tt.lich_truc_ao_id = lt.id AND tt.trang_thai IN ('active', 'completed')
      INNER JOIN nhanvien nv ON tt.nguoi_dang_ky_id = nv.id
      WHERE nv.ma_nhan_vien = ? AND MONTH(lt.ngay) = ? AND YEAR(lt.ngay) = ?
        AND lt.trang_thai = 'checked_out' AND lt.thoi_gian_lam IS NOT NULL
    ) combined`,
    [ma_nhan_vien, month, year, ma_nhan_vien, month, year]
  );
  return Number(rows[0]?.total_hours || 0);
};

// Đoạn subquery dùng lại ở nhiều API: tổng giờ làm "hiệu lực" (đã quy đổi trực thay) của một
// nhân viên, dùng trong ngữ cảnh mà bảng nhân viên ngoài cùng được alias là `nv` và có thể
// chèn thêm điều kiện lọc tháng/năm qua tham số `extraDateFilter` (áp lên cả 2 vế UNION).
const effectiveHoursSubquery = (extraDateFilter = '') => `(
  (
    SELECT COALESCE(SUM(lt.thoi_gian_lam), 0)
    FROM lich_truc lt
    LEFT JOIN truc_thay tt ON (tt.lich_truc_ao_id = lt.id OR tt.lich_truc_goc_id = lt.id)
      AND tt.trang_thai IN ('active', 'completed')
    WHERE lt.nhan_vien_id = nv.id
      AND NOT (tt.id IS NOT NULL AND tt.lich_truc_ao_id = lt.id)
      AND NOT (tt.id IS NOT NULL AND tt.lich_truc_goc_id = lt.id)
      AND lt.trang_thai = 'checked_out' AND lt.thoi_gian_lam IS NOT NULL ${extraDateFilter}
  )
  +
  (
    SELECT COALESCE(SUM(lt2.thoi_gian_lam), 0)
    FROM lich_truc lt2
    INNER JOIN truc_thay tt2 ON tt2.lich_truc_ao_id = lt2.id AND tt2.trang_thai IN ('active', 'completed')
    WHERE tt2.nguoi_dang_ky_id = nv.id
      AND lt2.trang_thai = 'checked_out' AND lt2.thoi_gian_lam IS NOT NULL ${extraDateFilter.replaceAll('lt.', 'lt2.')}
  )
)`;

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
  const recordDate = new Date(cell.ngay).toISOString().split('T')[0];
  
  // KIỂM TRA: CHƯA TỚI NGÀY LÀM
  const currentDateObj = new Date(currentDate);
  const recordDateObj = new Date(recordDate);
  
  // Nếu ngày hiện tại nhỏ hơn ngày của ca (ngày trong tương lai)
  if (currentDateObj < recordDateObj) {
    return {
      canCheckOut: false,
      reason: 'Chưa tới ngày làm! Không thể check-out trước ngày làm việc'
    };
  }
  
  // KIỂM TRA: CHƯA TỚI GIỜ LÀM (chỉ áp dụng nếu là cùng ngày)
  if (recordDate === currentDate && currentTime < shiftStart) {
    return {
      canCheckOut: false,
      reason: `Chưa tới giờ làm! Check-out chỉ được thực hiện từ ${shiftStart}`
    };
  }
  
  // === LUÔN CHO PHÉP GỬI YÊU CẦU CHO CA QUÁ HẠN ===
  // Tính số ngày chênh lệch
  const diffTime = Math.abs(now - new Date(cell.ngay));
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  // Nếu là ngày hôm nay nhưng quá giờ
  if (recordDate === currentDate) {
    const [endHours, endMinutes] = shiftEnd.split(':').map(Number);
    const endTimeInMinutes = endHours * 60 + endMinutes;
    
    const [currentHours, currentMinutes] = currentTime.split(':').map(Number);
    const currentTimeInMinutes = currentHours * 60 + currentMinutes;
    
    // Quá 30 phút so với thời gian kết thúc ca
    if (currentTimeInMinutes > (endTimeInMinutes + 30)) {
      return {
        canCheckOut: false,
        canRequestAdjustment: true,
        loai_yeu_cau: 'checkout',
        reason: `Đã quá 30 phút so với thời gian kết thúc ca (${shiftEnd})`,
        message: `Bạn có thể gửi yêu cầu điều chỉnh giờ check-out`
      };
    }
  }
  
  // Nếu là ngày hôm qua, hôm kia hoặc bất kỳ ngày nào trong quá khứ
  if (recordDate < currentDate) {
    return {
      canCheckOut: false,
      canRequestAdjustment: true,
      loai_yeu_cau: 'checkout',
      reason: `Ca này đã qua ${diffDays} ngày`,
      message: `Bạn có thể gửi yêu cầu điều chỉnh giờ check-out cho ca đã qua ${diffDays} ngày`
    };
  }
  
  // Nếu là check-out bình thường (cùng ngày, trong giờ cho phép)
  return {
    canCheckOut: true,
    reason: null
  };
};

// ======================
// MIDDLEWARE: Kiểm tra quyền admin
// ======================
const requireAdmin = async (req, res, next) => {
  try {
    const { ma_nhan_vien } = req.employee;
    const [rows] = await db.query(
      'SELECT is_admin FROM nhanvien WHERE ma_nhan_vien = ?',
      [ma_nhan_vien]
    );

    if (rows.length === 0 || rows[0].is_admin !== 1) {
      return res.status(403).json({ message: 'Bạn không có quyền admin' });
    }

    next();
  } catch (error) {
    console.error('Lỗi kiểm tra quyền admin:', error);
    res.status(500).json({ message: 'Lỗi server' });
  }
};

// ======================
// MIDDLEWARE: Kiểm tra quyền admin TOÀN QUYỀN (chặn admin chỉ xem khỏi mọi thao tác sửa/xóa)
// ======================
const requireFullAdmin = async (req, res, next) => {
  try {
    const { ma_nhan_vien } = req.employee;
    const [rows] = await db.query(
      'SELECT is_admin, admin_readonly FROM nhanvien WHERE ma_nhan_vien = ?',
      [ma_nhan_vien]
    );

    if (rows.length === 0 || rows[0].is_admin !== 1) {
      return res.status(403).json({ message: 'Bạn không có quyền admin' });
    }
    if (rows[0].admin_readonly === 1) {
      return res.status(403).json({ message: 'Tài khoản quản trị viên chỉ xem, không có quyền thực hiện thao tác này' });
    }

    next();
  } catch (error) {
    console.error('Lỗi kiểm tra quyền admin toàn quyền:', error);
    res.status(500).json({ message: 'Lỗi server' });
  }
};

// ======================
// ĐĂNG KÝ TÀI KHOẢN MỚI (CHỈ ADMIN)
// ======================
router.post('/auth/register', auth, requireFullAdmin, async (req, res) => {
  const { ma_nhan_vien, ten_nhan_vien, password } = req.body;
  
  try {
    // Kiểm tra mã nhân viên đã tồn tại
    const [existing] = await db.query(
      'SELECT id FROM nhanvien WHERE ma_nhan_vien = ?',
      [ma_nhan_vien]
    );
    
    if (existing.length > 0) {
      return res.status(400).json({ message: 'Mã nhân viên đã tồn tại' });
    }
    
    // Mã hóa mật khẩu
    const bcrypt = require('bcrypt');
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    
    // Tạo nhân viên mới
    await db.query(
      `INSERT INTO nhanvien (ma_nhan_vien, ten_nhan_vien, password, is_admin) 
       VALUES (?, ?, ?, 0)`,
      [ma_nhan_vien, ten_nhan_vien, hashedPassword]
    );
    
    res.json({
      success: true,
      message: 'Tạo tài khoản thành công'
    });
  } catch (error) {
    console.error('Lỗi tạo tài khoản:', error);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// ======================
// ADMIN RESET MẬT KHẨU CHO USER
// ======================
router.post('/admin/reset-password', auth, requireFullAdmin, async (req, res) => {
  const { ma_nhan_vien, new_password } = req.body;

  if (!ma_nhan_vien || !new_password) {
    return res.status(400).json({ message: 'Thiếu thông tin' });
  }

  try {
    // Kiểm tra user tồn tại
    const [user] = await db.query('SELECT id FROM nhanvien WHERE ma_nhan_vien = ?', [ma_nhan_vien]);
    if (user.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy nhân viên' });
    }

    // Mã hóa mật khẩu mới
    const bcrypt = require('bcrypt');
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(new_password, saltRounds);

    // Cập nhật
    await db.query('UPDATE nhanvien SET password = ? WHERE ma_nhan_vien = ?', [hashedPassword, ma_nhan_vien]);

    res.json({
      success: true,
      message: 'Đặt lại mật khẩu thành công'
    });
  } catch (error) {
    console.error('Lỗi reset mật khẩu:', error);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// ======================
// ADMIN API: LẤY DANH SÁCH NHÂN VIÊN - ĐẦY ĐỦ
// ======================
router.get('/admin/employees', auth, requireAdmin, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT
        nv.*,
        (SELECT COUNT(*) FROM lich_truc WHERE nhan_vien_id = nv.id) as total_registered_shifts,
        (SELECT COUNT(*) FROM lich_truc WHERE nhan_vien_id = nv.id AND trang_thai = 'checked_out') as total_completed_shifts,
        ${effectiveHoursSubquery()} as total_work_hours
      FROM nhanvien nv
      ORDER BY nv.created_at DESC`
    );

    res.json(rows);
  } catch (error) {
    console.error('Lỗi lấy danh sách nhân viên:', error);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// ======================
// ADMIN API: TẠO NHÂN VIÊN MỚI
// ======================
router.post('/admin/employees/create', auth, requireFullAdmin, async (req, res) => {
  const { ma_nhan_vien, ten_nhan_vien, password, is_admin, admin_readonly } = req.body;
  try {
    const [existing] = await db.query('SELECT id FROM nhanvien WHERE ma_nhan_vien = ?', [ma_nhan_vien]);
    if (existing.length > 0) return res.status(400).json({ message: 'Mã nhân viên đã tồn tại' });

    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const [result] = await db.query(
        `INSERT INTO nhanvien (ma_nhan_vien, ten_nhan_vien, password, is_admin, admin_readonly, face_embedding)
         VALUES (?, ?, ?, ?, ?, NULL)`,
        [ma_nhan_vien, ten_nhan_vien, hashedPassword, is_admin ? 1 : 0, (is_admin && admin_readonly) ? 1 : 0]
    );

    res.status(201).json({
      success: true,
      message: 'Tạo nhân viên thành công',
      id: result.insertId
    });
  } catch (error) {
    console.error("LỖI SQL:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ======================
// ADMIN API: CẬP NHẬT NHÂN VIÊN
// ======================
router.put('/admin/employees/:id', auth, requireFullAdmin, async (req, res) => {
  const { id } = req.params;
  const { ten_nhan_vien, password, is_admin, admin_readonly } = req.body;

  try {
    // Không cho tự hạ quyền chính mình xuống chỉ xem hoặc nhân viên thường - tránh tự khóa mất quyền
    if (req.employee.id === parseInt(id) && (!is_admin || admin_readonly)) {
      return res.status(400).json({ message: 'Không thể tự hạ quyền quản trị toàn quyền của chính bạn' });
    }

    let updateQuery = 'UPDATE nhanvien SET ten_nhan_vien = ?, is_admin = ?, admin_readonly = ?';
    let queryParams = [ten_nhan_vien, is_admin ? 1 : 0, (is_admin && admin_readonly) ? 1 : 0];

    // Nếu có password thì cập nhật
    if (password && password.trim() !== '') {
      const bcrypt = require('bcrypt');
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(password, saltRounds);
      updateQuery += ', password = ?';
      queryParams.push(hashedPassword);
    }
    
    updateQuery += ' WHERE id = ?';
    queryParams.push(id);
    
    await db.query(updateQuery, queryParams);
    
    res.json({
      success: true,
      message: 'Cập nhật nhân viên thành công'
    });
  } catch (error) {
    console.error('Lỗi cập nhật nhân viên:', error);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// ======================
// ADMIN API: BẬT/TẮT (VÔ HIỆU HÓA) TÀI KHOẢN NHÂN VIÊN
// Nhân viên bị vô hiệu hóa không thể đăng nhập / đăng ký ca / check-in / check-out nữa,
// nhưng dữ liệu chấm công cũ vẫn được giữ nguyên để xem lại khi cần.
// ======================
router.put('/admin/employees/:id/active', auth, requireFullAdmin, async (req, res) => {
  const { id } = req.params;
  const { is_active } = req.body;

  try {
    if (req.employee.id === parseInt(id)) {
      return res.status(400).json({ message: 'Không thể tự vô hiệu hóa tài khoản của chính bạn' });
    }

    const [rows] = await db.query('SELECT is_admin FROM nhanvien WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy nhân viên' });
    }
    if (rows[0].is_admin && !is_active) {
      return res.status(400).json({ message: 'Không thể vô hiệu hóa tài khoản quản trị viên' });
    }

    await db.query('UPDATE nhanvien SET is_active = ? WHERE id = ?', [is_active ? 1 : 0, id]);

    res.json({
      success: true,
      message: is_active ? 'Đã kích hoạt lại tài khoản' : 'Đã vô hiệu hóa tài khoản',
      is_active: is_active ? 1 : 0
    });
  } catch (error) {
    console.error('Lỗi cập nhật trạng thái nhân viên:', error);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// ======================
// ADMIN API: XÓA NHÂN VIÊN
// ======================
router.delete('/admin/employees/:id', auth, requireFullAdmin, async (req, res) => {
  const { id } = req.params;
  
  try {
    // Không cho xóa chính mình
    if (req.employee.id === parseInt(id)) {
      return res.status(400).json({ message: 'Không thể xóa tài khoản của chính bạn' });
    }
    
    // Kiểm tra nhân viên có lịch trực không
    // const [hasSchedule] = await db.query(
    //   'SELECT id FROM lich_truc WHERE nhan_vien_id = ? LIMIT 1',
    //   [id]
    // );
    
    // if (hasSchedule.length > 0) {
    //   return res.status(400).json({ 
    //     message: 'Không thể xóa nhân viên đã có lịch trực. Hãy xóa lịch trực trước.' 
    //   });
    // }
    
    await db.query('DELETE FROM nhanvien WHERE id = ?', [id]);
    
    res.json({
      success: true,
      message: 'Xóa nhân viên thành công'
    });
  } catch (error) {
    console.error('Lỗi xóa nhân viên:', error);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// ======================
// ADMIN API: LẤY BÁO CÁO CHẤM CÔNG TỔNG HỢP
// ======================
router.get('/admin/employee/:id/attendance', auth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { month, year } = req.query;
  
  const targetMonth = month || new Date().getMonth() + 1;
  const targetYear = year || new Date().getFullYear();

  try {
    const [rows] = await db.query(
      `SELECT
        lt.id, lt.ngay, lt.ca, lt.trang_thai, lt.gio_vao, lt.gio_ra, lt.thoi_gian_lam, lt.ghi_chu,
        lt.created_at, lt.updated_at,
        DATE(lt.ngay) as ngay_thang,

        -- Quy đổi chủ sở hữu ca: nếu là ca ảo (được người khác trực thay), tên/mã hiển thị
        -- là NGƯỜI ĐĂNG KÝ GỐC (được thanh toán), không phải người trực tiếp làm
        CASE WHEN tt.id IS NOT NULL AND tt.lich_truc_ao_id = lt.id THEN nv_dang_ky.ten_nhan_vien ELSE lt.ten_nhan_vien END as ten_nhan_vien,
        CASE WHEN tt.id IS NOT NULL AND tt.lich_truc_ao_id = lt.id THEN nv_dang_ky.ma_nhan_vien ELSE lt.ma_nhan_vien END as ma_nhan_vien,
        CASE WHEN tt.id IS NOT NULL AND tt.lich_truc_ao_id = lt.id THEN nv_dang_ky.id ELSE lt.nhan_vien_id END as nhan_vien_id,

        -- Thông tin trực thay (nếu có)
        tt.id as truc_thay_id,
        tt.nguoi_dang_ky_id,
        tt.nguoi_thuc_hien_id,
        tt.lich_truc_goc_id,
        tt.lich_truc_ao_id,
        tt.ly_do as truc_thay_ly_do,
        tt.trang_thai as truc_thay_trang_thai,

        -- Thông tin người thực hiện trực thay (B) - dành cho lịch gốc
        nv_thuc_hien.ten_nhan_vien as ten_nguoi_truc_thay,
        nv_thuc_hien.ma_nhan_vien as ma_nguoi_truc_thay,

        -- Thông tin người đăng ký gốc (A) - dành cho lịch ảo
        nv_dang_ky.ten_nhan_vien as ten_nguoi_duoc_truc_thay,
        nv_dang_ky.ma_nhan_vien as ma_nguoi_duoc_truc_thay,

        -- Xác định loại lịch
        CASE
          WHEN tt.id IS NOT NULL AND tt.lich_truc_ao_id = lt.id THEN 'virtual'
          WHEN tt.id IS NOT NULL AND tt.lich_truc_goc_id = lt.id THEN 'original'
          ELSE 'normal'
        END as loai_lich

      FROM lich_truc lt
      LEFT JOIN truc_thay tt ON (lt.id = tt.lich_truc_goc_id OR lt.id = tt.lich_truc_ao_id)
        AND tt.trang_thai IN ('active', 'completed')
      LEFT JOIN nhanvien nv_thuc_hien ON tt.nguoi_thuc_hien_id = nv_thuc_hien.id
      LEFT JOIN nhanvien nv_dang_ky ON tt.nguoi_dang_ky_id = nv_dang_ky.id

      WHERE
        (
          -- Ca của chính nhân viên này: KHÔNG PHẢI ca ảo đi trực thay cho người khác, và
          -- KHÔNG PHẢI ca gốc đã bị người khác trực thay (dù giờ đã đồng bộ sang dòng gốc
          -- lúc check-out hay chưa - tránh đếm trùng giờ 2 lần)
          (
            lt.nhan_vien_id = ?
            AND NOT (tt.id IS NOT NULL AND tt.lich_truc_ao_id = lt.id)
            AND NOT (tt.id IS NOT NULL AND tt.lich_truc_goc_id = lt.id)
          )
          OR
          -- Ca được người khác trực thay CHO nhân viên này (quy giờ về đây) - lấy từ ca ẢO
          (tt.id IS NOT NULL AND tt.lich_truc_ao_id = lt.id AND tt.nguoi_dang_ky_id = ?)
        )
        AND MONTH(lt.ngay) = ?
        AND YEAR(lt.ngay) = ?
        AND lt.trang_thai = 'checked_out'
        AND lt.thoi_gian_lam IS NOT NULL
      ORDER BY lt.ngay DESC,
        CASE lt.ca
          WHEN 'ca1' THEN 1
          WHEN 'ca2' THEN 2
          WHEN 'ca3' THEN 3
          WHEN 'ca4' THEN 4
        END`,
      [id, id, targetMonth, targetYear]
    );

    // Format dates
    const formattedRows = rows.map(row => ({
      ...row,
      ngay: row.ngay ? formatDateLocal(row.ngay) : null
    }));

    res.json(formattedRows);
  } catch (error) {
    console.error('Lỗi lấy chi tiết chấm công:', error);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// ======================
// ADMIN API: LẤY CHI TIẾT CHẤM CÔNG NHÂN VIÊN (route trùng, không được gọi vì Express chỉ
// dùng route /admin/employee/:id/attendance đầu tiên khớp phía trên - giữ nguyên không xoá)
// ======================
router.get('/admin/employee/:id/attendance', auth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { month, year } = req.query;
  
  const targetMonth = month || new Date().getMonth() + 1;
  const targetYear = year || new Date().getFullYear();

  try {
    const [rows] = await db.query(
      `SELECT 
        lt.*,
        DATE(lt.ngay) as ngay_thang
      FROM lich_truc lt
      WHERE lt.nhan_vien_id = ?
        AND MONTH(lt.ngay) = ?
        AND YEAR(lt.ngay) = ?
        AND lt.trang_thai = 'checked_out'
        AND lt.thoi_gian_lam IS NOT NULL
      ORDER BY lt.ngay DESC, 
        CASE lt.ca
          WHEN 'ca1' THEN 1
          WHEN 'ca2' THEN 2
          WHEN 'ca3' THEN 3
          WHEN 'ca4' THEN 4
        END`,
      [id, targetMonth, targetYear]
    );

    // Format dates
    const formattedRows = rows.map(row => ({
      ...row,
      ngay: row.ngay ? formatDateLocal(row.ngay) : null
    }));

    res.json(formattedRows);
  } catch (error) {
    console.error('Lỗi lấy chi tiết chấm công:', error);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// ======================
// ADMIN API: LẤY LỊCH TRỰC NHÂN VIÊN
// ======================
router.get('/admin/employee/:id/schedule', auth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { month, year } = req.query;
  
  const targetMonth = month || new Date().getMonth() + 1;
  const targetYear = year || new Date().getFullYear();

  try {
    const [rows] = await db.query(
      `SELECT 
        lt.*,
        DATE(lt.ngay) as ngay_thang
      FROM lich_truc lt
      WHERE lt.nhan_vien_id = ?
        AND MONTH(lt.ngay) = ?
        AND YEAR(lt.ngay) = ?
      ORDER BY lt.ngay ASC, 
        CASE lt.ca
          WHEN 'ca1' THEN 1
          WHEN 'ca2' THEN 2
          WHEN 'ca3' THEN 3
          WHEN 'ca4' THEN 4
        END`,
      [id, targetMonth, targetYear]
    );

    // Format dates
    const formattedRows = rows.map(row => ({
      ...row,
      ngay: row.ngay ? formatDateLocal(row.ngay) : null
    }));

    res.json(formattedRows);
  } catch (error) {
    console.error('Lỗi lấy lịch trực:', error);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// ======================
// ADMIN API: LẤY THỐNG KÊ THÁNG CỦA NHÂN VIÊN
// ======================
router.get('/admin/employee/:id/monthly-stats', auth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { month, year } = req.query;
  
  const targetMonth = month || new Date().getMonth() + 1;
  const targetYear = year || new Date().getFullYear();

  try {
    const [stats] = await db.query(
      `SELECT
        (SELECT COUNT(*) FROM lich_truc WHERE nhan_vien_id = ? AND MONTH(ngay) = ? AND YEAR(ngay) = ?) as total_registered,
        (SELECT COUNT(*) FROM lich_truc WHERE nhan_vien_id = ? AND MONTH(ngay) = ? AND YEAR(ngay) = ? AND trang_thai = 'checked_out') as total_completed,
        CASE
          WHEN (SELECT COUNT(*) FROM lich_truc WHERE nhan_vien_id = ? AND MONTH(ngay) = ? AND YEAR(ngay) = ?) > 0
          THEN ROUND(
            (SELECT COUNT(*) FROM lich_truc WHERE nhan_vien_id = ? AND MONTH(ngay) = ? AND YEAR(ngay) = ? AND trang_thai = 'checked_out') /
            (SELECT COUNT(*) FROM lich_truc WHERE nhan_vien_id = ? AND MONTH(ngay) = ? AND YEAR(ngay) = ?) * 100,
            2
          )
          ELSE 0
        END as completion_rate`,
      [
        id, targetMonth, targetYear,
        id, targetMonth, targetYear,
        id, targetMonth, targetYear,
        id, targetMonth, targetYear,
        id, targetMonth, targetYear
      ]
    );

    // Tổng giờ làm đã quy đổi trực thay (giờ của ca được người khác trực thay tính về đây)
    const [empRow] = await db.query('SELECT ma_nhan_vien FROM nhanvien WHERE id = ?', [id]);
    const totalHours = empRow[0] ? await getMonthlyHours(empRow[0].ma_nhan_vien, targetMonth, targetYear) : 0;

    res.json({
      ...(stats[0] || { total_registered: 0, total_completed: 0, completion_rate: 0 }),
      total_hours: totalHours
    });
  } catch (error) {
    console.error('Lỗi lấy thống kê tháng:', error);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// ======================
// ADMIN API: LẤY CHI TIẾT NHÂN VIÊN (BAO GỒM LỊCH SỬ TRỰC THAY)
// ======================
router.get('/admin/employee/:id/detail', auth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { month, year } = req.query;
  
  const targetMonth = month || new Date().getMonth() + 1;
  const targetYear = year || new Date().getFullYear();

  try {
    // Thông tin cơ bản
    const [employeeRows] = await db.query(
      'SELECT * FROM nhanvien WHERE id = ?',
      [id]
    );
    
    if (employeeRows.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy nhân viên' });
    }
    
    const employee = employeeRows[0];
    
    // Lịch trực trong tháng
    const [scheduleRows] = await db.query(
      `SELECT * FROM lich_truc 
       WHERE nhan_vien_id = ? 
         AND MONTH(ngay) = ? 
         AND YEAR(ngay) = ?
       ORDER BY ngay ASC, ca ASC`,
      [id, targetMonth, targetYear]
    );
    
    // Thống kê tháng (số ca theo lịch của chính nhân viên, giờ làm quy đổi theo trực thay bên dưới)
    const [statsRows] = await db.query(
      `SELECT
        COUNT(*) as total_registered,
        SUM(CASE WHEN trang_thai = 'checked_out' THEN 1 ELSE 0 END) as total_completed,
        ROUND(
          CASE
            WHEN COUNT(*) > 0
            THEN (SUM(CASE WHEN trang_thai = 'checked_out' THEN 1 ELSE 0 END) / COUNT(*)) * 100
            ELSE 0
          END, 2
        ) as completion_rate
      FROM lich_truc
      WHERE nhan_vien_id = ?
        AND MONTH(ngay) = ?
        AND YEAR(ngay) = ?`,
      [id, targetMonth, targetYear]
    );
    const totalHoursEffective = await getMonthlyHours(employee.ma_nhan_vien, targetMonth, targetYear);

    // Lịch sử trực thay
    const [trucThayRows] = await db.query(
      `SELECT 
        tt.*,
        CASE 
          WHEN tt.nguoi_thuc_hien_id = ? THEN 'thuc_hien'
          WHEN tt.nguoi_dang_ky_id = ? THEN 'duoc_truc_thay'
        END as loai,
        nv_th.ten_nhan_vien as ten_nguoi_truc_thay,
        nv_th.ma_nhan_vien as ma_nguoi_truc_thay,
        nv_dk.ten_nhan_vien as ten_nguoi_duoc_truc_thay,
        nv_dk.ma_nhan_vien as ma_nguoi_duoc_truc_thay,
        lt.ngay,
        lt.ca
      FROM truc_thay tt
      INNER JOIN nhanvien nv_th ON tt.nguoi_thuc_hien_id = nv_th.id
      INNER JOIN nhanvien nv_dk ON tt.nguoi_dang_ky_id = nv_dk.id
      INNER JOIN lich_truc lt ON tt.lich_truc_goc_id = lt.id
      WHERE tt.nguoi_thuc_hien_id = ? OR tt.nguoi_dang_ky_id = ?
      ORDER BY tt.created_at DESC`,
      [id, id, id, id]
    );
    
    res.json({
      employee,
      schedule: scheduleRows,
      stats: {
        ...(statsRows[0] || { total_registered: 0, total_completed: 0, completion_rate: 0 }),
        total_hours: totalHoursEffective
      },
      trucThayHistory: trucThayRows
    });

  } catch (error) {
    console.error('Lỗi lấy chi tiết nhân viên:', error);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// ======================
// ADMIN API: LẤY DANH SÁCH USER ĐÃ ĐĂNG KÝ (KHÔNG PHÂN BIỆT QUYỀN)
// ======================
router.get('/admin/registered-users', auth, requireAdmin, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT 
        nv.*,
        (SELECT COUNT(*) FROM lich_truc WHERE nhan_vien_id = nv.id) as total_registered_shifts,
        (SELECT COUNT(*) FROM lich_truc WHERE nhan_vien_id = nv.id AND trang_thai = 'checked_out') as total_completed_shifts,
        ${effectiveHoursSubquery()} as total_work_hours
      FROM nhanvien nv
      WHERE EXISTS (
        SELECT 1 FROM lich_truc WHERE nhan_vien_id = nv.id
      )
      ORDER BY nv.created_at DESC`
    );
    
    res.json(rows);
  } catch (error) {
    console.error('Lỗi lấy danh sách user đã đăng ký:', error);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// ======================
// ADMIN API: LẤY CHI TIẾT USER ĐÃ ĐĂNG KÝ (ĐẦY ĐỦ)
// ======================
router.get('/admin/registered-users/:id/detail', auth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  
  try {
    // Thông tin cơ bản
    const [userRows] = await db.query(
      'SELECT * FROM nhanvien WHERE id = ?',
      [id]
    );
    
    if (userRows.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy user' });
    }
    
    // Thống kê tổng hợp (giờ làm đã quy đổi trực thay về người đăng ký gốc)
    const [stats] = await db.query(
      `SELECT
        (SELECT COUNT(*) FROM lich_truc WHERE nhan_vien_id = nv.id) as total_registered,
        (SELECT COUNT(*) FROM lich_truc WHERE nhan_vien_id = nv.id AND trang_thai = 'checked_out') as total_completed,
        ${effectiveHoursSubquery()} as total_hours,
        (SELECT COUNT(DISTINCT DATE(ngay)) FROM lich_truc WHERE nhan_vien_id = nv.id) as total_days
      FROM nhanvien nv
      WHERE nv.id = ?`,
      [id]
    );
    
    // Lịch sử chi tiết
    const [schedule] = await db.query(
      `SELECT * FROM lich_truc 
       WHERE nhan_vien_id = ?
       ORDER BY ngay DESC, 
         CASE ca
           WHEN 'ca1' THEN 1
           WHEN 'ca2' THEN 2
           WHEN 'ca3' THEN 3
           WHEN 'ca4' THEN 4
         END`,
      [id]
    );
    
    res.json({
      employee: userRows[0],
      stats: stats[0],
      schedule: schedule
    });
    
  } catch (error) {
    console.error('Lỗi lấy chi tiết user:', error);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// ======================
// ADMIN: CẬP NHẬT CÀI ĐẶT KHUÔN MẶT CHO NHÂN VIÊN
// ======================
router.put('/admin/employee/:id/face-settings', auth, requireFullAdmin, async (req, res) => {
  const { id } = req.params;
  const { face_login_enabled, face_code, face_code_enabled } = req.body;

  try {
    const [emp] = await db.query('SELECT id FROM nhanvien WHERE id = ?', [id]);
    if (emp.length === 0) {
      return res.status(404).json({ success: false, message: 'Nhân viên không tồn tại' });
    }

    let updateFields = [];
    let params = [];
    if (face_login_enabled !== undefined) {
      updateFields.push('face_login_enabled = ?');
      params.push(face_login_enabled ? 1 : 0);
    }
    if (face_code !== undefined) {
      updateFields.push('face_code = ?');
      params.push(face_code || null);
    }
    if (face_code_enabled !== undefined) {
      updateFields.push('face_code_enabled = ?');
      params.push(face_code_enabled ? 1 : 0);
    }
    if (updateFields.length === 0) {
      return res.status(400).json({ success: false, message: 'Không có dữ liệu cập nhật' });
    }
    params.push(id);
    await db.query(`UPDATE nhanvien SET ${updateFields.join(', ')} WHERE id = ?`, params);

    res.json({ success: true, message: 'Cập nhật cài đặt khuôn mặt thành công' });
  } catch (error) {
    console.error('Lỗi update face settings:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
});

// ======================
// ADMIN: XÓA DỮ LIỆU KHUÔN MẶT CỦA NHÂN VIÊN
// ======================
router.delete('/admin/employee/:id/face-data', auth, requireFullAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    await db.query('UPDATE nhanvien SET face_embedding = NULL WHERE id = ?', [id]);
    res.json({ success: true, message: 'Đã xóa dữ liệu khuôn mặt.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
});
// ======================
// ADMIN API: XUẤT BÁO CÁO CHẤM CÔNG EXCEL
// ======================
const VN_WEEKDAYS = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

router.get('/admin/export/attendance-report', auth, requireAdmin, async (req, res) => {
  const { month, year, rate } = req.query;
  const targetMonth = parseInt(month, 10) || new Date().getMonth() + 1;
  const targetYear = parseInt(year, 10) || new Date().getFullYear();
  const hourlyRate = parseFloat(rate) || 22000;

  try {
    // Danh sách nhân viên có lịch trực trong tháng, theo thứ tự tạo tài khoản
    const [employees] = await db.query(
      `SELECT DISTINCT nv.id, nv.ma_nhan_vien, nv.ten_nhan_vien
       FROM nhanvien nv
       INNER JOIN lich_truc lt ON lt.nhan_vien_id = nv.id
       WHERE MONTH(lt.ngay) = ? AND YEAR(lt.ngay) = ?
       ORDER BY nv.id ASC`,
      [targetMonth, targetYear]
    );

    // Toàn bộ lịch trực trong tháng (mọi trạng thái, để hiển thị đúng người trực từng ca)
    const [shiftRows] = await db.query(
      `SELECT lt.ngay, lt.ca, lt.nhan_vien_id, lt.ten_nhan_vien, lt.trang_thai,
              lt.thoi_gian_lam, lt.ghi_chu
       FROM lich_truc lt
       WHERE MONTH(lt.ngay) = ? AND YEAR(lt.ngay) = ?`,
      [targetMonth, targetYear]
    );

    const daysInMonth = new Date(targetYear, targetMonth, 0).getDate();

    // Gom dữ liệu theo từng ngày trong tháng
    const byDate = {};
    for (let d = 1; d <= daysInMonth; d++) {
      byDate[d] = { ca1: [], ca2: [], ca3: [], ca4: [], hoursByEmployee: {}, notes: new Set() };
    }

    const totalHoursByEmployee = {};
    employees.forEach(e => { totalHoursByEmployee[e.id] = 0; });

    shiftRows.forEach(row => {
      const d = new Date(row.ngay);
      const bucket = byDate[d.getDate()];
      if (!bucket) return;

      if (bucket[row.ca]) bucket[row.ca].push(row.ten_nhan_vien);

      if (row.trang_thai === 'checked_out' && row.thoi_gian_lam != null) {
        const hrs = Number(row.thoi_gian_lam) || 0;
        bucket.hoursByEmployee[row.nhan_vien_id] = (bucket.hoursByEmployee[row.nhan_vien_id] || 0) + hrs;
        totalHoursByEmployee[row.nhan_vien_id] = (totalHoursByEmployee[row.nhan_vien_id] || 0) + hrs;
      }

      if (row.ghi_chu && row.ghi_chu.trim()) bucket.notes.add(row.ghi_chu.trim());
    });

    // ======================
    // Tạo workbook đúng mẫu "Bảng chấm công CTV IT"
    // ======================
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Hệ thống chấm công';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet(`Tháng ${targetMonth}`);

    const numEmployees = Math.max(employees.length, 1);
    const COL_NGAY = 1;
    const COL_THU = 2;
    const COL_CA1 = 3;
    const COL_CA2 = 4;
    const COL_CA3 = 5;
    const COL_CA4 = 6;
    const COL_HOURS_START = 7;
    const COL_HOURS_END = COL_HOURS_START + numEmployees - 1;
    const COL_NOTE = COL_HOURS_END + 1;
    const COL_TOTAL_NAME = COL_NOTE + 1;
    const COL_TOTAL_HOURS = COL_TOTAL_NAME + 1;
    const COL_MONEY = COL_TOTAL_HOURS + 1;
    const LAST_COL = COL_MONEY;

    const thinBorder = {
      top: { style: 'thin' }, left: { style: 'thin' },
      bottom: { style: 'thin' }, right: { style: 'thin' }
    };
    const centerWrap = { vertical: 'middle', horizontal: 'center', wrapText: true };
    const headerFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };

    // Dòng 1-2: Thông tin đơn vị (chỉ trải tới cột Ghi chú, giống mẫu gốc - không đè lên bảng tổng giờ làm)
    sheet.mergeCells(1, COL_NGAY, 1, COL_NOTE);
    sheet.getCell(1, COL_NGAY).value = 'Phân Hiệu Trường ĐH FPT tại Tỉnh Bình Định';
    sheet.getCell(1, COL_NGAY).font = { bold: true, size: 12 };

    sheet.mergeCells(2, COL_NGAY, 2, COL_NOTE);
    sheet.getCell(2, COL_NGAY).value = 'Khu đô thị mới An Phú Thịnh, Phường Quy Nhơn Đông, Tỉnh Gia Lai, Việt Nam';

    // Dòng 4: Tiêu đề bảng
    sheet.mergeCells(4, COL_NGAY, 4, COL_NOTE);
    const titleCell = sheet.getCell(4, COL_NGAY);
    titleCell.value = `BẢNG CHẤM CÔNG CTV-IT THÁNG ${String(targetMonth).padStart(2, '0')}/${targetYear}`;
    titleCell.font = { bold: true, size: 13 };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(4).height = 20;

    // Dòng 5-6: Header của bảng
    sheet.mergeCells(5, COL_NGAY, 6, COL_NGAY);
    sheet.getCell(5, COL_NGAY).value = 'Ngày';
    sheet.mergeCells(5, COL_THU, 6, COL_THU);
    sheet.getCell(5, COL_THU).value = 'Thứ';
    sheet.mergeCells(5, COL_CA1, 6, COL_CA1);
    sheet.getCell(5, COL_CA1).value = 'Ca 1 (7:00-9:30)';
    sheet.mergeCells(5, COL_CA2, 6, COL_CA2);
    sheet.getCell(5, COL_CA2).value = 'Ca 2 (9:30-12:30)';
    sheet.mergeCells(5, COL_CA3, 6, COL_CA3);
    sheet.getCell(5, COL_CA3).value = 'Ca 3 (12:30-15:00)';
    sheet.mergeCells(5, COL_CA4, 6, COL_CA4);
    sheet.getCell(5, COL_CA4).value = 'Ca 4 (15:00-17:30)';

    sheet.mergeCells(5, COL_HOURS_START, 5, COL_HOURS_END);
    sheet.getCell(5, COL_HOURS_START).value = 'Số giờ làm được trong ngày(giờ)';
    employees.forEach((emp, idx) => {
      sheet.getCell(6, COL_HOURS_START + idx).value = emp.ten_nhan_vien;
    });

    sheet.mergeCells(5, COL_NOTE, 6, COL_NOTE);
    sheet.getCell(5, COL_NOTE).value = 'Ghi chú';

    sheet.mergeCells(5, COL_TOTAL_NAME, 5, COL_TOTAL_HOURS);
    sheet.getCell(5, COL_TOTAL_NAME).value = 'Tổng giờ làm(giờ)';

    // Lưu ý: không merge dọc O5:O6 vì dòng 6 trở đi của cột này chứa dữ liệu "Thành tiền" từng nhân viên
    sheet.getCell(5, COL_MONEY).value = 'Thành tiền (VNĐ)';

    // Style vùng header Ngày..Ghi chú (dòng 5-6)
    for (let r = 5; r <= 6; r++) {
      for (let c = COL_NGAY; c <= COL_NOTE; c++) {
        const cell = sheet.getCell(r, c);
        cell.font = { bold: true };
        cell.alignment = centerWrap;
        cell.fill = headerFill;
        cell.border = thinBorder;
      }
    }
    // Style header "Tổng giờ làm" / "Thành tiền" (chỉ dòng 5, dòng 6 dành cho dữ liệu nhân viên)
    [COL_TOTAL_NAME, COL_TOTAL_HOURS, COL_MONEY].forEach(c => {
      const cell = sheet.getCell(5, c);
      cell.font = { bold: true };
      cell.alignment = centerWrap;
      cell.fill = headerFill;
      cell.border = thinBorder;
    });
    sheet.getRow(5).height = 32;
    sheet.getRow(6).height = 18;

    // Bảng tổng giờ làm mỗi nhân viên (cột Tổng giờ làm / Thành tiền), bắt đầu từ dòng 6
    employees.forEach((emp, idx) => {
      const r = 6 + idx;
      const totalHrs = Number((totalHoursByEmployee[emp.id] || 0).toFixed(2));

      const nameCell = sheet.getCell(r, COL_TOTAL_NAME);
      nameCell.value = emp.ten_nhan_vien;
      nameCell.font = { bold: true };
      nameCell.border = thinBorder;

      const hoursCell = sheet.getCell(r, COL_TOTAL_HOURS);
      hoursCell.value = totalHrs;
      hoursCell.alignment = { horizontal: 'center' };
      hoursCell.border = thinBorder;

      const moneyCell = sheet.getCell(r, COL_MONEY);
      moneyCell.value = { formula: `${hoursCell.address}*${hourlyRate}` };
      moneyCell.numFmt = '#,##0';
      moneyCell.alignment = { horizontal: 'center' };
      moneyCell.border = thinBorder;
    });

    // Dữ liệu từng ngày trong tháng (từ dòng 7)
    const firstDataRow = 7;
    for (let day = 1; day <= daysInMonth; day++) {
      const rowIdx = firstDataRow + day - 1;
      const dateObj = new Date(targetYear, targetMonth - 1, day);
      const isSunday = dateObj.getDay() === 0;
      const bucket = byDate[day];
      const row = sheet.getRow(rowIdx);

      row.getCell(COL_NGAY).value = `${day}/${targetMonth}/${targetYear}`;
      row.getCell(COL_THU).value = VN_WEEKDAYS[dateObj.getDay()];
      row.getCell(COL_CA1).value = bucket.ca1.join(', ');
      row.getCell(COL_CA2).value = bucket.ca2.join(', ');
      row.getCell(COL_CA3).value = bucket.ca3.join(', ');
      row.getCell(COL_CA4).value = bucket.ca4.join(', ');

      employees.forEach((emp, idx) => {
        const hrs = bucket.hoursByEmployee[emp.id] || 0;
        row.getCell(COL_HOURS_START + idx).value = Number(hrs.toFixed(2));
      });

      row.getCell(COL_NOTE).value = Array.from(bucket.notes).join('; ');

      for (let c = COL_NGAY; c <= LAST_COL; c++) {
        const cell = row.getCell(c);
        cell.alignment = centerWrap;
        cell.border = thinBorder;
        if (isSunday) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
      }
      row.height = 18;
    }

    // Độ rộng cột
    sheet.getColumn(COL_NGAY).width = 11;
    sheet.getColumn(COL_THU).width = 11;
    sheet.getColumn(COL_CA1).width = 16;
    sheet.getColumn(COL_CA2).width = 16;
    sheet.getColumn(COL_CA3).width = 16;
    sheet.getColumn(COL_CA4).width = 16;
    for (let c = COL_HOURS_START; c <= COL_HOURS_END; c++) sheet.getColumn(c).width = 11;
    sheet.getColumn(COL_NOTE).width = 26;
    sheet.getColumn(COL_TOTAL_NAME).width = 13;
    sheet.getColumn(COL_TOTAL_HOURS).width = 9;
    sheet.getColumn(COL_MONEY).width = 16;

    // Chân bảng: chữ ký
    const footerRow = firstDataRow + daysInMonth + 3;
    sheet.mergeCells(footerRow, COL_THU, footerRow, COL_CA3);
    sheet.getCell(footerRow, COL_THU).value = 'Cộng tác viên IT';
    sheet.getCell(footerRow, COL_THU).alignment = { horizontal: 'center' };
    sheet.getCell(footerRow, COL_THU).font = { bold: true };

    sheet.mergeCells(footerRow, COL_HOURS_START, footerRow, COL_NOTE);
    sheet.getCell(footerRow, COL_HOURS_START).value = 'Người lập biểu';
    sheet.getCell(footerRow, COL_HOURS_START).alignment = { horizontal: 'center' };
    sheet.getCell(footerRow, COL_HOURS_START).font = { bold: true };

    sheet.views = [{ state: 'frozen', ySplit: 6 }];

    const filename = `BangChamCong_CTVIT_Thang${targetMonth}_${targetYear}.xlsx`;

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(filename)}"`
    );

    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('Lỗi xuất Excel:', error);
    res.status(500).json({ message: 'Lỗi xuất báo cáo Excel: ' + error.message });
  }
});

// ======================
// ADMIN API: XUẤT BÁO CÁO TỔNG HỢP
// ======================
router.get('/admin/export/summary-report', auth, requireAdmin, async (req, res) => {
  const { month, year } = req.query;
  
  const targetMonth = month || new Date().getMonth() + 1;
  const targetYear = year || new Date().getFullYear();

  try {
    // Lấy dữ liệu tổng hợp
    const [summaryRows] = await db.query(
      `SELECT 
        nv.ma_nhan_vien,
        nv.ten_nhan_vien,
        COUNT(lt.id) as total_shifts,
        COALESCE(SUM(lt.thoi_gian_lam), 0) as total_hours,
        ROUND(
          CASE 
            WHEN (SELECT COUNT(*) FROM lich_truc WHERE nhan_vien_id = nv.id AND MONTH(ngay) = ? AND YEAR(ngay) = ?) > 0
            THEN (COUNT(lt.id) / (SELECT COUNT(*) FROM lich_truc WHERE nhan_vien_id = nv.id AND MONTH(ngay) = ? AND YEAR(ngay) = ?)) * 100
            ELSE 0
          END, 2
        ) as completion_rate
      FROM nhanvien nv
      LEFT JOIN lich_truc lt ON nv.id = lt.nhan_vien_id 
        AND MONTH(lt.ngay) = ? 
        AND YEAR(lt.ngay) = ?
        AND lt.trang_thai = 'checked_out'
        AND lt.thoi_gian_lam IS NOT NULL
      GROUP BY nv.id, nv.ma_nhan_vien, nv.ten_nhan_vien
      ORDER BY total_hours DESC, total_shifts DESC
      LIMIT 10`,
      [targetMonth, targetYear, targetMonth, targetYear, targetMonth, targetYear]
    );

    // Lấy dữ liệu theo tuần
    const [weeklyData] = await db.query(
      `SELECT 
        WEEK(lt.ngay, 1) as week_number,
        COUNT(lt.id) as total_shifts,
        COALESCE(SUM(lt.thoi_gian_lam), 0) as total_hours,
        COUNT(DISTINCT lt.nhan_vien_id) as employees_count
      FROM lich_truc lt
      WHERE MONTH(lt.ngay) = ?
        AND YEAR(lt.ngay) = ?
        AND lt.trang_thai = 'checked_out'
        AND lt.thoi_gian_lam IS NOT NULL
      GROUP BY WEEK(lt.ngay, 1)
      ORDER BY week_number`,
      [targetMonth, targetYear]
    );

    // Tạo workbook Excel
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Hệ thống chấm công';
    workbook.created = new Date();
    
    // SHEET 1: TOP NHÂN VIÊN
    const topSheet = workbook.addWorksheet('Top nhân viên');
    
    // Tiêu đề
    topSheet.mergeCells('A1:E1');
    topSheet.getRow(1).getCell(1).value = `TOP 10 NHÂN VIÊN TÍCH CỰC THÁNG ${targetMonth}/${targetYear}`;
    topSheet.getRow(1).getCell(1).font = { bold: true, size: 16, color: { argb: 'FF1976D2' } };
    topSheet.getRow(1).getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
    topSheet.getRow(1).height = 30;

    // Header
    const headers = ['STT', 'Mã nhân viên', 'Tên nhân viên', 'Số ca đã làm', 'Tổng giờ làm', 'Tỷ lệ hoàn thành (%)'];
    const headerRow = topSheet.getRow(3);
    headers.forEach((header, index) => {
      const cell = headerRow.getCell(index + 1);
      cell.value = header;
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF2E7D32' }
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    });
    headerRow.height = 25;

    // Dữ liệu
    summaryRows.forEach((row, index) => {
      const dataRow = topSheet.getRow(index + 4);
      
      dataRow.getCell(1).value = index + 1;
      dataRow.getCell(2).value = row.ma_nhan_vien;
      dataRow.getCell(3).value = row.ten_nhan_vien;
      dataRow.getCell(4).value = row.total_shifts;
      dataRow.getCell(5).value = parseFloat(row.total_hours).toFixed(2);
      dataRow.getCell(6).value = parseFloat(row.completion_rate).toFixed(2);
      
      // Căn giữa
      [1, 4, 5, 6].forEach(col => {
        dataRow.getCell(col).alignment = { vertical: 'middle', horizontal: 'center' };
      });
      
      // Tô màu cho top 3
      if (index < 3) {
        for (let i = 1; i <= 6; i++) {
          dataRow.getCell(i).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: index === 0 ? 'FFFFFFE0' : index === 1 ? 'FFE8F5E8' : 'FFE3F2FD' }
          };
        }
      }
      
      // Border
      for (let i = 1; i <= 6; i++) {
        dataRow.getCell(i).border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      }
    });

    // Điều chỉnh độ rộng
    topSheet.columns = [
      { width: 6 },
      { width: 12 },
      { width: 25 },
      { width: 12 },
      { width: 12 },
      { width: 15 }
    ];

    // SHEET 2: PHÂN BỐ THEO TUẦN
    const weeklySheet = workbook.addWorksheet('Phân bố theo tuần');
    
    // Tiêu đề
    weeklySheet.mergeCells('A1:D1');
    weeklySheet.getRow(1).getCell(1).value = `PHÂN BỐ GIỜ LÀM THEO TUẦN THÁNG ${targetMonth}/${targetYear}`;
    weeklySheet.getRow(1).getCell(1).font = { bold: true, size: 16, color: { argb: 'FF1976D2' } };
    weeklySheet.getRow(1).getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
    weeklySheet.getRow(1).height = 30;

    // Header
    const weeklyHeaders = ['Tuần', 'Số nhân viên', 'Số ca đã làm', 'Tổng giờ làm'];
    const weeklyHeaderRow = weeklySheet.getRow(3);
    weeklyHeaders.forEach((header, index) => {
      const cell = weeklyHeaderRow.getCell(index + 1);
      cell.value = header;
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1976D2' }
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    });
    weeklyHeaderRow.height = 25;

    // Dữ liệu
    weeklyData.forEach((row, index) => {
      const dataRow = weeklySheet.getRow(index + 4);
      
      dataRow.getCell(1).value = `Tuần ${row.week_number}`;
      dataRow.getCell(2).value = row.employees_count;
      dataRow.getCell(3).value = row.total_shifts;
      dataRow.getCell(4).value = parseFloat(row.total_hours).toFixed(2);
      
      // Căn giữa
      [1, 2, 3, 4].forEach(col => {
        dataRow.getCell(col).alignment = { vertical: 'middle', horizontal: 'center' };
      });
      
      // Tô màu xen kẽ
      if (index % 2 === 0) {
        for (let i = 1; i <= 4; i++) {
          dataRow.getCell(i).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF5F5F5' }
          };
        }
      }
      
      // Border
      for (let i = 1; i <= 4; i++) {
        dataRow.getCell(i).border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      }
    });

    // Điều chỉnh độ rộng
    weeklySheet.columns = [
      { width: 15 },
      { width: 15 },
      { width: 15 },
      { width: 15 }
    ];

    // Thiết lập headers để download file
    const filename = `BaoCaoTongHop_Thang${targetMonth}_${targetYear}.xlsx`;
    
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(filename)}"`
    );

    // Ghi workbook vào response
    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('Lỗi xuất báo cáo tổng hợp:', error);
    res.status(500).json({ message: 'Lỗi xuất báo cáo: ' + error.message });
  }
});

// ======================
// ADMIN API: LẤY DANH SÁCH TRỰC THAY CHỜ DUYỆT
// ======================
router.get('/admin/pending-tructhay', auth, requireAdmin, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT 
        tt.*,
        -- Thông tin người trực thay (B)
        nv_thuc_hien.ten_nhan_vien as ten_nguoi_truc_thay,
        nv_thuc_hien.ma_nhan_vien as ma_nguoi_truc_thay,
        
        -- Thông tin người được trực thay (A)
        nv_dang_ky.ten_nhan_vien as ten_nguoi_duoc_truc_thay,
        nv_dang_ky.ma_nhan_vien as ma_nguoi_duoc_truc_thay,
        
        -- Thông tin lịch trực
        lt.ngay,
        lt.ca
        
      FROM truc_thay tt
      INNER JOIN nhanvien nv_thuc_hien ON tt.nguoi_thuc_hien_id = nv_thuc_hien.id
      INNER JOIN nhanvien nv_dang_ky ON tt.nguoi_dang_ky_id = nv_dang_ky.id
      INNER JOIN lich_truc lt ON tt.lich_truc_goc_id = lt.id
      
      WHERE tt.trang_thai = 'pending'
      ORDER BY tt.created_at DESC`
    );

    res.json(rows);
  } catch (error) {
    console.error('Lỗi lấy trực thay chờ duyệt:', error);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// ======================
// ADMIN API: LẤY TẤT CẢ LỊCH SỬ TRỰC THAY (CÓ THỂ LỌC THEO THÁNG/NĂM)
// ======================
router.get('/admin/tructhay/all', auth, requireAdmin, async (req, res) => {
  const { month, year } = req.query;
  
  let query = `
    SELECT 
      tt.*,
      nv_thuc_hien.ten_nhan_vien as ten_nguoi_truc_thay,
      nv_thuc_hien.ma_nhan_vien as ma_nguoi_truc_thay,
      nv_dang_ky.ten_nhan_vien as ten_nguoi_duoc_truc_thay,
      nv_dang_ky.ma_nhan_vien as ma_nguoi_duoc_truc_thay,
      lt.ngay,
      lt.ca
    FROM truc_thay tt
    INNER JOIN nhanvien nv_thuc_hien ON tt.nguoi_thuc_hien_id = nv_thuc_hien.id
    INNER JOIN nhanvien nv_dang_ky ON tt.nguoi_dang_ky_id = nv_dang_ky.id
    INNER JOIN lich_truc lt ON tt.lich_truc_goc_id = lt.id
    WHERE 1=1
  `;
  
  const params = [];
  if (month && year) {
    query += ' AND MONTH(lt.ngay) = ? AND YEAR(lt.ngay) = ?';
    params.push(month, year);
  }
  
  query += ' ORDER BY tt.created_at DESC';
  
  try {
    const [rows] = await db.query(query, params);
    res.json(rows);
  } catch (error) {
    console.error('Lỗi lấy lịch sử trực thay:', error);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// ======================
// ADMIN API: DUYỆT/TỪ CHỐI TRỰC THAY
// ======================
router.post('/admin/tructhay/:id/approve', auth, requireFullAdmin, async (req, res) => {
  const { id } = req.params;
  const { approve } = req.body; // true: duyệt, false: từ chối

  try {
    const [trucThayRows] = await db.query(
      'SELECT * FROM truc_thay WHERE id = ?',
      [id]
    );

    if (trucThayRows.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy yêu cầu trực thay' });
    }

    const trucThay = trucThayRows[0];

    if (approve) {
      // Duyệt: cập nhật trạng thái thành active
      await db.query(
        'UPDATE truc_thay SET trang_thai = "active", updated_at = NOW() WHERE id = ?',
        [id]
      );

      // Cập nhật ghi chú lịch gốc
      await db.query(
        `UPDATE lich_truc 
         SET ghi_chu = CONCAT(
           COALESCE(ghi_chu, ''), 
           ' | Được trực thay bởi: ', 
           (SELECT ten_nhan_vien FROM nhanvien WHERE id = ?), 
           ' (', 
           (SELECT ma_nhan_vien FROM nhanvien WHERE id = ?), 
           ')'
         ),
         updated_at = NOW()
         WHERE id = ?`,
        [trucThay.nguoi_thuc_hien_id, trucThay.nguoi_thuc_hien_id, trucThay.lich_truc_goc_id]
      );

      res.json({ 
        message: 'Đã duyệt yêu cầu trực thay',
        data: { id, status: 'active' }
      });
    } else {
      // Từ chối: xóa bản ghi trực thay và lịch ảo
      await db.query('START TRANSACTION');
      
      try {
        // Xóa lịch ảo
        await db.query('DELETE FROM lich_truc WHERE id = ?', [trucThay.lich_truc_ao_id]);
        // Xóa bản ghi trực thay
        await db.query('DELETE FROM truc_thay WHERE id = ?', [id]);
        
        // Khôi phục lịch gốc (xóa ghi chú chờ duyệt)
        await db.query(
          `UPDATE lich_truc 
           SET ghi_chu = REPLACE(ghi_chu, 
             CONCAT(' | Đang chờ trực thay bởi: ', 
               (SELECT ten_nhan_vien FROM nhanvien WHERE id = ?), 
               ' (', 
               (SELECT ma_nhan_vien FROM nhanvien WHERE id = ?), 
               ') - Lý do: ', ?), 
             '')
           WHERE id = ?`,
          [trucThay.nguoi_thuc_hien_id, trucThay.nguoi_thuc_hien_id, trucThay.ly_do, trucThay.lich_truc_goc_id]
        );
        
        await db.query('COMMIT');
        res.json({ 
          message: 'Đã từ chối yêu cầu trực thay',
          data: { id, status: 'rejected' }
        });
      } catch (error) {
        await db.query('ROLLBACK');
        throw error;
      }
    }
  } catch (error) {
    console.error('Lỗi xử lý trực thay:', error);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// ======================
// ADMIN API: LẤY THÔNG TIN TRỰC THAY CỦA NHÂN VIÊN
// ======================
router.get('/admin/employee/:id/tructhay', auth, requireAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    const [rows] = await db.query(
      `SELECT 
        tt.*,
        CASE 
          WHEN tt.nguoi_thuc_hien_id = ? THEN 'thuc_hien'
          WHEN tt.nguoi_dang_ky_id = ? THEN 'duoc_truc_thay'
        END as loai,
        
        -- Thông tin người trực thay
        nv_thuc_hien.ten_nhan_vien as ten_nguoi_truc_thay,
        nv_thuc_hien.ma_nhan_vien as ma_nguoi_truc_thay,
        
        -- Thông tin người được trực thay
        nv_dang_ky.ten_nhan_vien as ten_nguoi_duoc_truc_thay,
        nv_dang_ky.ma_nhan_vien as ma_nguoi_duoc_truc_thay,
        
        -- Thông tin lịch trực
        lt.ngay,
        lt.ca
        
      FROM truc_thay tt
      INNER JOIN nhanvien nv_thuc_hien ON tt.nguoi_thuc_hien_id = nv_thuc_hien.id
      INNER JOIN nhanvien nv_dang_ky ON tt.nguoi_dang_ky_id = nv_dang_ky.id
      INNER JOIN lich_truc lt ON tt.lich_truc_goc_id = lt.id
      
      WHERE tt.nguoi_thuc_hien_id = ? OR tt.nguoi_dang_ky_id = ?
      ORDER BY tt.created_at DESC`,
      [id, id, id, id]
    );

    res.json(rows);
  } catch (error) {
    console.error('Lỗi lấy thông tin trực thay:', error);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// ======================
// ADMIN API: TỔNG QUAN THỐNG KÊ
// ======================
router.get('/admin/overview-stats', auth, requireAdmin, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();

    const [stats] = await db.query(
      `SELECT 
        -- Tổng nhân viên
        (SELECT COUNT(*) FROM nhanvien) as total_employees,
        
        -- Nhân viên đang làm hôm nay
        (SELECT COUNT(DISTINCT nhan_vien_id) 
         FROM lich_truc 
         WHERE DATE(ngay) = ? 
           AND trang_thai IN ('checked_in', 'checked_out')) as active_today,
        
        -- Tổng số ca trong tháng
        (SELECT COUNT(*) 
         FROM lich_truc 
         WHERE MONTH(ngay) = ? 
           AND YEAR(ngay) = ?) as total_shifts_this_month,
        
        -- Tổng giờ làm trong tháng
        (SELECT COALESCE(SUM(thoi_gian_lam), 0) 
         FROM lich_truc 
         WHERE MONTH(ngay) = ? 
           AND YEAR(ngay) = ? 
           AND trang_thai = 'checked_out') as total_hours_this_month,
        
        -- Trực thay chờ duyệt
        (SELECT COUNT(*) 
         FROM truc_thay 
         WHERE trang_thai = 'pending') as pending_truc_thay,
         
        -- Yêu cầu điều chỉnh giờ chờ duyệt
        (SELECT COUNT(*) 
         FROM yeu_cau_dieu_chinh_gio 
         WHERE trang_thai = 'pending') as pending_time_adjustments`,
      [today, currentMonth, currentYear, currentMonth, currentYear]
    );

    res.json({
      totalEmployees: stats[0].total_employees,
      activeToday: stats[0].active_today,
      totalShiftsThisMonth: stats[0].total_shifts_this_month,
      totalHoursThisMonth: parseFloat(stats[0].total_hours_this_month) || 0,
      pendingTrucThay: stats[0].pending_truc_thay || 0,
      pendingTimeAdjustments: stats[0].pending_time_adjustments || 0
    });
  } catch (error) {
    console.error('Lỗi lấy thống kê:', error);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// ======================
// ADMIN API: Hoàn tác checkout (trả lại trạng thái đang làm)
// ======================
router.post('/admin/schedule/:id/revert-checkout', auth, requireFullAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    // Lấy thông tin ca làm việc
    const [rows] = await db.query('SELECT * FROM lich_truc WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy ca làm việc' });
    }

    const record = rows[0];

    // Chỉ cho phép hoàn tác nếu ca đã checkout
    if (record.trang_thai !== 'checked_out') {
      return res.status(400).json({ message: 'Chỉ có thể hoàn tác checkout cho ca đã hoàn thành' });
    }

    // Cập nhật: quay lại trạng thái 'checked_in', xóa giờ ra và thời gian làm
    await db.query(
      `UPDATE lich_truc 
       SET trang_thai = 'checked_in', 
           gio_ra = NULL, 
           thoi_gian_lam = NULL, 
           updated_at = NOW(),
           ghi_chu = CONCAT(COALESCE(ghi_chu, ''), ' | Admin hoàn tác checkout lúc ', NOW())
       WHERE id = ?`,
      [id]
    );

    res.json({ 
      success: true,
      message: 'Đã hoàn tác checkout thành công' 
    });

  } catch (error) {
    console.error('Lỗi revert checkout:', error);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// ======================
// API: LẤY LỊCH TRỰC THEO THÁNG (ĐÃ CẬP NHẬT HIỂN THỊ TRỰC THAY - PHIÊN BẢN MỚI)
// ======================
router.get('/schedule', auth, async (req, res) => {
  const month = Number(req.query.month) || new Date().getMonth() + 1;
  const year = Number(req.query.year) || new Date().getFullYear();
  const { ma_nhan_vien, is_admin } = req.employee;
  
  try {
    // QUERY MỚI - LẤY ĐÚNG THÔNG TIN PHÂN BIỆT
    const [rows] = await db.query(
      `SELECT 
        lt.*,
        nv.ten_nhan_vien,
        nv.ma_nhan_vien,
        nv.id as nhan_vien_id,
        
        -- Thông tin trực thay (nếu có)
        tt.id as truc_thay_id,
        tt.nguoi_dang_ky_id,
        tt.nguoi_thuc_hien_id,
        tt.lich_truc_goc_id, 
        tt.lich_truc_ao_id,
        tt.ly_do,
        tt.trang_thai as trang_thai_truc_thay,
        
        -- Thông tin người thực hiện trực thay (B)
        nv_thuc_hien.ten_nhan_vien as ten_nguoi_truc_thay,
        nv_thuc_hien.ma_nhan_vien as ma_nguoi_truc_thay,
        
        -- Thông tin người đăng ký gốc (A) - chỉ có khi đây là lịch ảo
        nv_dang_ky.ten_nhan_vien as ten_nguoi_duoc_truc_thay,
        nv_dang_ky.ma_nhan_vien as ma_nguoi_duoc_truc_thay,
        
        -- Xác định loại lịch
        CASE 
          WHEN tt.id IS NOT NULL AND tt.lich_truc_ao_id = lt.id THEN 'virtual' -- Lịch ảo của người trực thay (B)
          WHEN tt.id IS NOT NULL AND tt.lich_truc_goc_id = lt.id THEN 'original' -- Lịch gốc của người đăng ký (A)
          ELSE 'normal' -- Lịch bình thường
        END as loai_lich
        
      FROM lich_truc lt
      INNER JOIN nhanvien nv ON lt.nhan_vien_id = nv.id
      
      -- LEFT JOIN với truc_thay để lấy thông tin trực thay
    LEFT JOIN truc_thay tt ON 
  (lt.id = tt.lich_truc_goc_id OR lt.id = tt.lich_truc_ao_id)
  AND tt.trang_thai IN ('active', 'completed', 'pending')
      
      -- LEFT JOIN để lấy thông tin người trực thay (B)
      LEFT JOIN nhanvien nv_thuc_hien ON tt.nguoi_thuc_hien_id = nv_thuc_hien.id
      
      -- LEFT JOIN để lấy thông tin người đăng ký gốc (A) - cho lịch ảo
      LEFT JOIN nhanvien nv_dang_ky ON tt.nguoi_dang_ky_id = nv_dang_ky.id
      
      WHERE MONTH(lt.ngay) = ? AND YEAR(lt.ngay) = ? 
      ORDER BY lt.ngay ASC, lt.ca ASC, lt.ten_nhan_vien ASC`,
      [month, year]
    );
    
    // XỬ LÝ DỮ LIỆU ĐỂ PHÂN BIỆT RÕ
    const formattedRows = rows.map(row => {
      const isVirtual = row.loai_lich === 'virtual'; // Lịch ảo của người trực thay (B)
      const isOriginal = row.loai_lich === 'original'; // Lịch gốc của người đăng ký (A)
      
      let display_info = {
        display_status: statusLabel[row.trang_thai] || row.trang_thai,
        is_truc_thay_related: false,
        truc_thay_type: null
      };
      
      // TRƯỜNG HỢP 1: Đây là lịch ảo của người trực thay (B)
      if (isVirtual && row.truc_thay_id) {
        display_info = {
          display_status: `Trực thay cho ${row.ten_nguoi_duoc_truc_thay || row.ten_nhan_vien}`,
          is_truc_thay_related: true,
          truc_thay_type: 'performer', // Người thực hiện trực thay
          nguoi_duoc_truc_thay: row.ten_nguoi_duoc_truc_thay,
          ma_nguoi_duoc_truc_thay: row.ma_nguoi_duoc_truc_thay,
          can_cancel_truc_thay: row.trang_thai === 'registered'
        };
      }
      // TRƯỜNG HỢP 2: Đây là lịch gốc của người đăng ký (A) được trực thay
      else if (isOriginal && row.truc_thay_id) {
        display_info = {
          display_status: `Được trực thay bởi ${row.ten_nguoi_truc_thay || 'Ai đó'}`,
          is_truc_thay_related: true,
          truc_thay_type: 'receiver', // Người được trực thay
          nguoi_truc_thay: row.ten_nguoi_truc_thay,
          ma_nguoi_truc_thay: row.ma_nguoi_truc_thay,
          is_original_registrant: true
        };
      }
      
      const result = {
        ...row,
        ngay: row.ngay ? formatDateLocal(row.ngay) : null,
        // Thông tin hiển thị
        ...display_info,
        // Giữ nguyên các trường khác
        loai_lich: row.loai_lich,
        truc_thay_id: row.truc_thay_id
      };

      // Nhân viên thường chỉ được thấy mã nhân viên của chính mình — không thấy
      // mã của đồng nghiệp khác (kể cả người trực thay/được trực thay), để tránh
      // lộ mã nhân viên qua API dù giao diện đã ẩn. Admin vẫn thấy đầy đủ.
      if (!is_admin) {
        if (result.ma_nhan_vien !== ma_nhan_vien) delete result.ma_nhan_vien;
        delete result.ma_nguoi_truc_thay;
        delete result.ma_nguoi_duoc_truc_thay;
      }

      return result;
    });

    res.json(formattedRows);
  } catch (error) {
    console.error('Lỗi lấy lịch trực:', error);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// ======================
// API: Lấy chi tiết trực thay theo lịch trực
// ======================
router.get('/truc-thay/detail/:lich_truc_id', auth, async (req, res) => {
  const { lich_truc_id } = req.params;
  
  try {
    const [rows] = await db.query(
      `SELECT 
        tt.*,
        -- Thông tin lịch gốc (A)
        lt_goc.ngay as ngay_goc,
        lt_goc.ca as ca_goc,
        nv_goc.ten_nhan_vien as ten_nguoi_dang_ky,
        nv_goc.ma_nhan_vien as ma_nguoi_dang_ky,
        
        -- Thông tin lịch ảo (B)
        lt_ao.ngay as ngay_ao,
        lt_ao.ca as ca_ao,
        nv_ao.ten_nhan_vien as ten_nguoi_truc_thay,
        nv_ao.ma_nhan_vien as ma_nguoi_truc_thay
        
      FROM truc_thay tt
      INNER JOIN lich_truc lt_goc ON tt.lich_truc_goc_id = lt_goc.id
      INNER JOIN nhanvien nv_goc ON tt.nguoi_dang_ky_id = nv_goc.id
      INNER JOIN lich_truc lt_ao ON tt.lich_truc_ao_id = lt_ao.id
      INNER JOIN nhanvien nv_ao ON tt.nguoi_thuc_hien_id = nv_ao.id
      
      WHERE tt.lich_truc_goc_id = ? OR tt.lich_truc_ao_id = ?`,
      [lich_truc_id, lich_truc_id]
    );
    
    if (rows.length === 0) {
      return res.json({ 
        success: false, 
        message: 'Không có thông tin trực thay' 
      });
    }
    
    const detail = rows[0];
    const result = {
      success: true,
      data: {
        // Thông tin người đăng ký gốc (A)
        nguoi_dang_ky: {
          ten: detail.ten_nguoi_dang_ky,
          ma: detail.ma_nguoi_dang_ky,
          lich_truc_id: detail.lich_truc_goc_id,
          ngay: detail.ngay_goc,
          ca: detail.ca_goc
        },
        // Thông tin người trực thay (B)
        nguoi_truc_thay: {
          ten: detail.ten_nguoi_truc_thay,
          ma: detail.ma_nguoi_truc_thay,
          lich_truc_id: detail.lich_truc_ao_id,
          ngay: detail.ngay_ao,
          ca: detail.ca_ao
        },
        // Thông tin trực thay
        ly_do: detail.ly_do,
        trang_thai: detail.trang_thai,
        created_at: detail.created_at
      }
    };
    
    res.json(result);
  } catch (error) {
    console.error('Lỗi lấy chi tiết trực thay:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Lỗi server' 
    });
  }
});

// ======================
// API: Trực thay (FIXED VERSION)
// ======================
router.post('/truc-thay/request', auth, async (req, res) => {
  const { ma_nhan_vien, ten_nhan_vien } = req.employee;
  const { lich_truc_id, ly_do } = req.body;

  console.log('=== TRỰC THAY REQUEST ===');
  console.log('Người yêu cầu:', { ma_nhan_vien, ten_nhan_vien });
  console.log('Lịch trực ID:', lich_truc_id);
  console.log('Lý do:', ly_do);

  try {
    // 1. Lấy thông tin người yêu cầu trực thay
    const [requesterRows] = await db.query(
      'SELECT id FROM nhanvien WHERE ma_nhan_vien = ?',
      [ma_nhan_vien]
    );
    
    if (requesterRows.length === 0) {
      return res.status(400).json({ 
        success: false,
        message: 'Người yêu cầu không tồn tại' 
      });
    }
    
    const requester_id = requesterRows[0].id;

    // 2. Lấy thông tin lịch trực gốc
    const [originalScheduleRows] = await db.query(
      `SELECT lt.*, nv.ten_nhan_vien, nv.ma_nhan_vien, nv.id as nhan_vien_id 
       FROM lich_truc lt 
       JOIN nhanvien nv ON lt.nhan_vien_id = nv.id 
       WHERE lt.id = ?`,
      [lich_truc_id]
    );
    
    if (originalScheduleRows.length === 0) {
      return res.status(404).json({ 
        success: false,
        message: 'Không tìm thấy lịch trực' 
      });
    }

    const originalSchedule = originalScheduleRows[0];
    const original_owner_id = originalSchedule.nhan_vien_id;
    const original_owner_name = originalSchedule.ten_nhan_vien;
    const original_owner_code = originalSchedule.ma_nhan_vien;

    console.log('Thông tin lịch gốc:', {
      id: originalSchedule.id,
      ngay: originalSchedule.ngay,
      ca: originalSchedule.ca,
      chủ_sở_hữu: original_owner_name,
      trạng_thái: originalSchedule.trang_thai
    });

    // 3. Kiểm tra điều kiện
    const errors = [];

    // Không thể trực thay cho chính mình
    if (requester_id === original_owner_id) {
      errors.push('Không thể trực thay cho chính mình');
    }

    // Chỉ được trực thay khi ca chưa bắt đầu
    if (originalSchedule.trang_thai !== 'registered') {
      errors.push('Chỉ có thể trực thay khi ca chưa bắt đầu');
    }

    // Kiểm tra người trực thay có trùng lịch không
    const [conflictSchedule] = await db.query(
      `SELECT id FROM lich_truc 
       WHERE ngay = ? 
         AND ca = ? 
         AND nhan_vien_id = ? 
         AND trang_thai != 'checked_out'`,
      [originalSchedule.ngay, originalSchedule.ca, requester_id]
    );
    
    if (conflictSchedule.length > 0) {
      errors.push('Bạn đã có lịch vào thời gian này');
    }

    // Kiểm tra xem ca này đã được trực thay chưa
    const [existingTrucThay] = await db.query(
      'SELECT id FROM truc_thay WHERE lich_truc_goc_id = ? AND trang_thai != "completed"',
      [lich_truc_id]
    );
    
    if (existingTrucThay.length > 0) {
      errors.push('Ca này đã được trực thay');
    }

    // Người đã đạt giới hạn 91h/tháng không được đăng ký trực thay cho người khác
    const requesterCapDate = new Date(originalSchedule.ngay);
    const requesterCapHours = await getMonthlyHours(ma_nhan_vien, requesterCapDate.getMonth() + 1, requesterCapDate.getFullYear());
    if (requesterCapHours >= 91) {
      errors.push('Bạn đã đạt giới hạn tối đa 91 giờ trong tháng, không thể đăng ký trực thay cho người khác');
    }

    if (errors.length > 0) {
      return res.status(400).json({ 
        success: false,
        message: 'Không thể trực thay',
        errors: errors 
      });
    }

    // 4. BẮT ĐẦU TRANSACTION
    await db.query('START TRANSACTION');

    try {
      // 5. Tạo lịch trực ảo cho người trực thay
      const [virtualScheduleResult] = await db.query(
        `INSERT INTO lich_truc 
         (ngay, ca, nhan_vien_id, ma_nhan_vien, ten_nhan_vien, trang_thai, ghi_chu) 
         VALUES (?, ?, ?, ?, ?, 'registered', ?)`,
        [
          originalSchedule.ngay,
          originalSchedule.ca,
          requester_id,
          ma_nhan_vien,
          ten_nhan_vien,
          `TRỰC THAY - Lịch gốc ID: ${lich_truc_id} - Trực thay cho: ${original_owner_name} (${original_owner_code}) - Lý do: ${ly_do || 'Không có lý do'}`
        ]
      );

      const virtual_schedule_id = virtualScheduleResult.insertId;
      console.log('✅ Đã tạo lịch ảo ID:', virtual_schedule_id);

      // 6. Tạo bản ghi trực thay
      const [trucThayResult] = await db.query(
        `INSERT INTO truc_thay 
         (lich_truc_goc_id, nguoi_dang_ky_id, nguoi_thuc_hien_id, lich_truc_ao_id, ly_do, trang_thai) 
         VALUES (?, ?, ?, ?, ?, 'pending')`, // Thay đổi: trạng thái pending thay vì active
        [
          lich_truc_id,
          original_owner_id,
          requester_id,
          virtual_schedule_id,
          ly_do || 'Không có lý do'
        ]
      );

      const truc_thay_id = trucThayResult.insertId;
      console.log('✅ Đã tạo bản ghi trực thay ID:', truc_thay_id);

      // 7. Cập nhật lịch gốc - thêm ghi chú đang chờ duyệt
      await db.query(
        `UPDATE lich_truc 
         SET ghi_chu = CONCAT(
           COALESCE(ghi_chu, ''), 
           ' | Đang chờ trực thay bởi: ', ?, ' (', ?, ') - Lý do: ', ?, ' (Chờ duyệt)'
         ),
         updated_at = NOW()
         WHERE id = ?`,
        [
          ten_nhan_vien,
          ma_nhan_vien,
          ly_do || 'Không có lý do',
          lich_truc_id
        ]
      );

      console.log('✅ Đã cập nhật lịch gốc');

      // 8. Tạo thông báo cho người đăng ký gốc
      await db.query(
        `INSERT INTO thong_bao_truc_thay 
         (nguoi_nhan_id, nguoi_gui_id, lich_truc_id, noi_dung) 
         VALUES (?, ?, ?, ?)`,
        [
          original_owner_id,
          requester_id,
          lich_truc_id,
          `${ten_nhan_vien} (${ma_nhan_vien}) đã yêu cầu trực thay ca ${originalSchedule.ca} ngày ${new Date(originalSchedule.ngay).toLocaleDateString('vi-VN')} cho bạn. Đang chờ admin duyệt. Lý do: ${ly_do || 'Không có lý do'}`
        ]
      );

      console.log('✅ Đã gửi thông báo');

      await db.query('COMMIT');
      console.log('✅ TRANSACTION thành công');

      res.json({
        success: true,
        message: `Đã gửi yêu cầu trực thay thành công cho ${original_owner_name}. Đang chờ admin duyệt.`,
        important_note: `⚠️ Yêu cầu của bạn đang chờ admin duyệt. Bạn sẽ được thông báo khi được duyệt.`,
        data: {
          truc_thay_id: truc_thay_id,
          lich_truc_goc_id: lich_truc_id,
          lich_truc_ao_id: virtual_schedule_id,
          nguoi_dang_ky: {
            ten: original_owner_name,
            ma: original_owner_code
          },
          status: 'pending'
        }
      });

    } catch (error) {
      await db.query('ROLLBACK');
      console.error('❌ Transaction lỗi:', error);
      throw error;
    }

  } catch (error) {
    console.error('❌ Lỗi trực thay:', error);
    res.status(500).json({ 
      success: false,
      message: 'Lỗi server khi xử lý trực thay',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ======================
// API: HỦY TRỰC THAY (BACKEND) - PHIÊN BẢN MỚI
// ======================
router.delete('/truc-thay/cancel/:lich_truc_goc_id', auth, async (req, res) => {
  const { ma_nhan_vien, ten_nhan_vien } = req.employee;
  const { lich_truc_goc_id } = req.params;

  console.log('=== HỦY TRỰC THAY BACKEND ===');
  console.log('Người yêu cầu:', { ma_nhan_vien, ten_nhan_vien });
  console.log('Lịch trực gốc ID:', lich_truc_goc_id);

  try {
    const [requesterRows] = await db.query(
      'SELECT id FROM nhanvien WHERE ma_nhan_vien = ?',
      [ma_nhan_vien]
    );
    if (requesterRows.length === 0) {
      return res.status(400).json({ 
        success: false,
        message: 'Người yêu cầu không tồn tại' 
      });
    }
    const requester = requesterRows[0];

    // Lấy thông tin trực thay, kể cả khi lịch gốc đã bị xóa (LEFT JOIN)
    const [trucThayRows] = await db.query(
      `SELECT 
        tt.*,
        -- Thông tin lịch gốc (có thể NULL)
        lt_goc.id as lich_truc_goc_id,
        lt_goc.ngay as ngay_goc,
        lt_goc.ca as ca_goc,
        lt_goc.trang_thai as trang_thai_goc,
        lt_goc.gio_vao as gio_vao_goc,
        lt_goc.gio_ra as gio_ra_goc,
        lt_goc.thoi_gian_lam as thoi_gian_lam_goc,
        lt_goc.ghi_chu as ghi_chu_goc,
        nv_goc.id as nguoi_dang_ky_id,
        nv_goc.ten_nhan_vien as ten_nguoi_dang_ky,
        nv_goc.ma_nhan_vien as ma_nguoi_dang_ky,
        
        -- Thông tin lịch ảo (luôn có)
        lt_ao.id as lich_truc_ao_id,
        lt_ao.ngay as ngay_ao,
        lt_ao.ca as ca_ao,
        lt_ao.trang_thai as trang_thai_ao,
        lt_ao.gio_vao as gio_vao_ao,
        lt_ao.gio_ra as gio_ra_ao,
        lt_ao.thoi_gian_lam as thoi_gian_lam_ao,
        lt_ao.ghi_chu as ghi_chu_ao,
        nv_ao.id as nguoi_thuc_hien_id,
        nv_ao.ten_nhan_vien as ten_nguoi_thuc_hien,
        nv_ao.ma_nhan_vien as ma_nguoi_thuc_hien
        
      FROM truc_thay tt
      LEFT JOIN lich_truc lt_goc ON tt.lich_truc_goc_id = lt_goc.id
      LEFT JOIN nhanvien nv_goc ON tt.nguoi_dang_ky_id = nv_goc.id
      INNER JOIN lich_truc lt_ao ON tt.lich_truc_ao_id = lt_ao.id
      INNER JOIN nhanvien nv_ao ON tt.nguoi_thuc_hien_id = nv_ao.id
      
      WHERE tt.lich_truc_goc_id = ? 
        AND tt.nguoi_thuc_hien_id = ?
        AND tt.trang_thai IN ('active', 'pending')`,
      [lich_truc_goc_id, requester.id]
    );

    if (trucThayRows.length === 0) {
      return res.status(404).json({ 
        success: false,
        message: 'Không tìm thấy bản ghi trực thay hoặc bạn không có quyền hủy' 
      });
    }

    const trucThay = trucThayRows[0];

    // Kiểm tra điều kiện hủy
    const errors = [];

    // Nếu lịch gốc không còn, chỉ cần kiểm tra lịch ảo chưa check-in
    if (!trucThay.lich_truc_goc_id) {
      if (trucThay.trang_thai_ao !== 'registered') {
        errors.push('Không thể hủy trực thay khi ca đã được check-in');
      }
    } else {
      // Nếu còn lịch gốc, kiểm tra cả hai
      if (trucThay.trang_thai === 'active') {
        if (trucThay.trang_thai_goc !== 'registered' || trucThay.trang_thai_ao !== 'registered') {
          errors.push('Không thể hủy trực thay khi ca đã được check-in');
        }
      }
    }

    if (trucThay.nguoi_thuc_hien_id !== requester.id) {
      errors.push('Chỉ người trực thay mới được hủy');
    }

    if (errors.length > 0) {
      return res.status(400).json({ 
        success: false,
        message: 'Không thể hủy trực thay',
        errors: errors 
      });
    }

    // BẮT ĐẦU TRANSACTION
    await db.query('START TRANSACTION');

    try {
      // Xóa lịch ảo
      await db.query('DELETE FROM lich_truc WHERE id = ?', [trucThay.lich_truc_ao_id]);
      console.log(`✅ Đã xóa lịch trực ảo ID: ${trucThay.lich_truc_ao_id}`);

      // Xóa bản ghi trực thay
      await db.query('DELETE FROM truc_thay WHERE id = ?', [trucThay.id]);
      console.log(`✅ Đã xóa bản ghi trực thay ID: ${trucThay.id}`);

      // Nếu lịch gốc còn, khôi phục ghi chú
      if (trucThay.lich_truc_goc_id) {
        let cleanedGhiChu = null;
        if (trucThay.ghi_chu_goc) {
          const ghiChu = trucThay.ghi_chu_goc;
          const trucThayNote = `Đang chờ trực thay bởi: ${trucThay.ten_nguoi_thuc_hien} (${trucThay.ma_nguoi_thuc_hien})`;
          const activeTrucThayNote = `Được trực thay bởi: ${trucThay.ten_nguoi_thuc_hien} (${trucThay.ma_nguoi_thuc_hien})`;
          
          if (ghiChu.includes(trucThayNote) || ghiChu.includes(activeTrucThayNote)) {
            cleanedGhiChu = ghiChu.replace(trucThayNote, '').replace(activeTrucThayNote, '').trim();
            cleanedGhiChu = cleanedGhiChu.replace(/\s*\|\s*/g, ' | ').replace(/^\|\s*|\s*\|$/g, '');
            if (cleanedGhiChu === '' || cleanedGhiChu === '|') {
              cleanedGhiChu = null;
            }
          }
        }

        await db.query(
          'UPDATE lich_truc SET ghi_chu = ?, updated_at = NOW() WHERE id = ?',
          [cleanedGhiChu, trucThay.lich_truc_goc_id]
        );
        console.log(`✅ Đã khôi phục lịch trực gốc ID: ${trucThay.lich_truc_goc_id}`);
      }

      await db.query('COMMIT');

      res.json({
        success: true,
        message: 'Đã hủy trực thay thành công',
        important_note: trucThay.lich_truc_goc_id 
          ? `✅ Lịch trực đã được khôi phục về ${trucThay.ten_nguoi_dang_ky} (${trucThay.ma_nguoi_dang_ky})`
          : '✅ Đã xóa ca trực thay (lịch gốc không còn tồn tại)',
        data: {
          truc_thay_id: trucThay.id,
          lich_truc_goc_id: trucThay.lich_truc_goc_id,
          lich_truc_ao_id: trucThay.lich_truc_ao_id,
          nguoi_dang_ky: trucThay.ten_nguoi_dang_ky,
          nguoi_truc_thay: trucThay.ten_nguoi_thuc_hien
        }
      });

    } catch (error) {
      await db.query('ROLLBACK');
      console.error('❌ Transaction lỗi:', error);
      throw error;
    }

  } catch (error) {
    console.error('❌ Lỗi hủy trực thay (Backend):', error);
    res.status(500).json({ 
      success: false,
      message: 'Lỗi server khi hủy trực thay',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ======================
// API: Lấy danh sách ca trực thay của tôi (FIXED VERSION)
// ======================
router.get('/truc-thay/my-shifts', auth, async (req, res) => {
  const { ma_nhan_vien } = req.employee;

  try {
    console.log('=== LẤY CA TRỰC THAY CỦA:', ma_nhan_vien);

    // 1. Lấy ID nhân viên
    const [employeeRows] = await db.query(
      'SELECT id FROM nhanvien WHERE ma_nhan_vien = ?',
      [ma_nhan_vien]
    );
    
    if (employeeRows.length === 0) {
      return res.status(400).json({ 
        success: false,
        message: 'Nhân viên không tồn tại' 
      });
    }
    
    const employee_id = employeeRows[0].id;

    // 2. Lấy danh sách ca trực thay (QUERY ĐƠN GIẢN HÓA)
    const [rows] = await db.query(
      `SELECT 
        lt.id,
        lt.ngay,
        lt.ca,
        lt.trang_thai,
        lt.gio_vao,
        lt.gio_ra,
        lt.thoi_gian_lam,
        lt.ghi_chu,
        tt.ly_do,
        tt.created_at as thoi_gian_truc_thay,
        tt.trang_thai as trang_thai_truc_thay,
        nv_original.ten_nhan_vien AS ten_nguoi_dang_ky,
        nv_original.ma_nhan_vien AS ma_nguoi_dang_ky,
        tt.lich_truc_goc_id
      FROM lich_truc lt
      INNER JOIN truc_thay tt ON lt.id = tt.lich_truc_ao_id
      INNER JOIN nhanvien nv_original ON tt.nguoi_dang_ky_id = nv_original.id
      WHERE tt.nguoi_thuc_hien_id = ?
        AND tt.trang_thai IN ('active', 'pending', 'completed')
      ORDER BY lt.ngay DESC, lt.ca ASC`,
      [employee_id]
    );

    console.log(`✅ Tìm thấy ${rows.length} ca trực thay`);

    // 3. Format lại dữ liệu
    const formattedRows = rows.map(row => {
      // Parse thông tin từ ghi chú
      let originalScheduleId = null;
      if (row.ghi_chu && row.ghi_chu.includes('Lịch gốc ID:')) {
        const match = row.ghi_chu.match(/Lịch gốc ID:\s*(\d+)/);
        if (match) originalScheduleId = parseInt(match[1]);
      }

      return {
        id: row.id,
        ngay: row.ngay ? formatDateLocal(row.ngay) : null,
        ca: row.ca,
        trang_thai: row.trang_thai,
        gio_vao: row.gio_vao,
        gio_ra: row.gio_ra,
        thoi_gian_lam: row.thoi_gian_lam,
        ly_do: row.ly_do,
        thoi_gian_truc_thay: row.thoi_gian_truc_thay,
        ten_nguoi_dang_ky: row.ten_nguoi_dang_ky,
        ma_nguoi_dang_ky: row.ma_nguoi_dang_ky,
        lich_truc_goc_id: row.lich_truc_goc_id || originalScheduleId,
        ghi_chu: row.ghi_chu,
        trang_thai_truc_thay: row.trang_thai_truc_thay,
        is_truc_thay: true
      };
    });

    res.json({
      success: true,
      data: formattedRows,
      count: formattedRows.length
    });

  } catch (error) {
    console.error('❌ Lỗi lấy ca trực thay:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy ca trực thay',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ======================
// API: Lấy danh sách ca CỦA TÔI đã được NGƯỜI KHÁC trực thay (chiều ngược lại của my-shifts)
// ======================
router.get('/truc-thay/received-shifts', auth, async (req, res) => {
  const { ma_nhan_vien } = req.employee;

  try {
    const [employeeRows] = await db.query(
      'SELECT id FROM nhanvien WHERE ma_nhan_vien = ?',
      [ma_nhan_vien]
    );

    if (employeeRows.length === 0) {
      return res.status(400).json({ success: false, message: 'Nhân viên không tồn tại' });
    }

    const employee_id = employeeRows[0].id;

    // Lấy ca ẢO (lịch_truc_ao) - nơi người thực hiện đã/đang làm thay cho mình
    const [rows] = await db.query(
      `SELECT
        lt.id,
        lt.ngay,
        lt.ca,
        lt.trang_thai,
        lt.gio_vao,
        lt.gio_ra,
        lt.thoi_gian_lam,
        tt.ly_do,
        tt.created_at as thoi_gian_truc_thay,
        tt.trang_thai as trang_thai_truc_thay,
        nv_thuc_hien.ten_nhan_vien AS ten_nguoi_truc_thay,
        nv_thuc_hien.ma_nhan_vien AS ma_nguoi_truc_thay,
        tt.lich_truc_goc_id
      FROM lich_truc lt
      INNER JOIN truc_thay tt ON lt.id = tt.lich_truc_ao_id
      INNER JOIN nhanvien nv_thuc_hien ON tt.nguoi_thuc_hien_id = nv_thuc_hien.id
      WHERE tt.nguoi_dang_ky_id = ?
        AND tt.trang_thai IN ('active', 'pending', 'completed')
      ORDER BY lt.ngay DESC, lt.ca ASC`,
      [employee_id]
    );

    const formattedRows = rows.map(row => ({
      id: row.id,
      ngay: row.ngay ? formatDateLocal(row.ngay) : null,
      ca: row.ca,
      trang_thai: row.trang_thai,
      gio_vao: row.gio_vao,
      gio_ra: row.gio_ra,
      thoi_gian_lam: row.thoi_gian_lam,
      ly_do: row.ly_do,
      thoi_gian_truc_thay: row.thoi_gian_truc_thay,
      ten_nguoi_truc_thay: row.ten_nguoi_truc_thay,
      ma_nguoi_truc_thay: row.ma_nguoi_truc_thay,
      lich_truc_goc_id: row.lich_truc_goc_id,
      trang_thai_truc_thay: row.trang_thai_truc_thay
    }));

    res.json({
      success: true,
      data: formattedRows,
      count: formattedRows.length
    });

  } catch (error) {
    console.error('❌ Lỗi lấy ca được trực thay:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy ca được trực thay',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ======================
// API: Kiểm tra có thể trực thay không (FIXED VERSION)
// ======================
router.get('/truc-thay/check/:lich_truc_id', auth, async (req, res) => {
  const { ma_nhan_vien } = req.employee;
  const { lich_truc_id } = req.params;

  try {
    console.log('=== KIỂM TRA TRỰC THAY ===');
    console.log('Người kiểm tra:', ma_nhan_vien);
    console.log('Lịch trực ID:', lich_truc_id);

    // 1. Lấy thông tin người kiểm tra
    const [requesterRows] = await db.query(
      'SELECT id FROM nhanvien WHERE ma_nhan_vien = ?',
      [ma_nhan_vien]
    );
    
    if (requesterRows.length === 0) {
      return res.status(400).json({ 
        success: false,
        message: 'Người kiểm tra không tồn tại' 
      });
    }
    
    const requester_id = requesterRows[0].id;

    // 2. Lấy thông tin lịch trực
    const [scheduleRows] = await db.query(
      `SELECT lt.*, nv.ten_nhan_vien, nv.ma_nhan_vien, nv.id as nhan_vien_id 
       FROM lich_truc lt 
       JOIN nhanvien nv ON lt.nhan_vien_id = nv.id 
       WHERE lt.id = ?`,
      [lich_truc_id]
    );
    
    if (scheduleRows.length === 0) {
      return res.status(404).json({ 
        success: false,
        message: 'Không tìm thấy lịch trực' 
      });
    }

    const schedule = scheduleRows[0];
    const original_owner_id = schedule.nhan_vien_id;

    // 3. Kiểm tra các điều kiện
    const errors = [];
    const warnings = [];

    // Không thể trực thay cho chính mình
    if (requester_id === original_owner_id) {
      errors.push('Không thể trực thay cho chính mình');
    }

    // Chỉ được trực thay khi ca chưa bắt đầu
    if (schedule.trang_thai !== 'registered') {
      errors.push('Chỉ có thể trực thay khi ca chưa bắt đầu');
    }

    // Kiểm tra người trực thay có trùng lịch không
    const [conflictSchedule] = await db.query(
      `SELECT id FROM lich_truc 
       WHERE ngay = ? 
         AND ca = ? 
         AND nhan_vien_id = ? 
         AND trang_thai != 'checked_out'`,
      [schedule.ngay, schedule.ca, requester_id]
    );
    
    if (conflictSchedule.length > 0) {
      errors.push('Bạn đã có lịch vào thời gian này');
    }

    // Kiểm tra xem ca này đã được trực thay chưa
    const [existingTrucThay] = await db.query(
      `SELECT tt.*, nv.ten_nhan_vien as nguoi_truc_thay 
       FROM truc_thay tt 
       JOIN nhanvien nv ON tt.nguoi_thuc_hien_id = nv.id
       WHERE tt.lich_truc_goc_id = ? AND tt.trang_thai IN ('active', 'pending')`,
      [lich_truc_id]
    );
    
    if (existingTrucThay.length > 0) {
      const trucThay = existingTrucThay[0];
      const statusText = trucThay.trang_thai === 'pending' ? 'đang chờ duyệt' : 'đã được';
      errors.push(`Ca này đã ${statusText} ${trucThay.nguoi_truc_thay} trực thay`);
    }

    // Kiểm tra số lượng người trong ca
    const [userCount] = await db.query(
      'SELECT COUNT(*) as count FROM lich_truc WHERE ngay = ? AND ca = ?',
      [schedule.ngay, schedule.ca]
    );
    
    if (userCount[0].count >= 6) {
      warnings.push('Ca đã đủ số lượng người (6 người)');
    }

    res.json({
      success: errors.length === 0,
      can_truc_thay: errors.length === 0,
      errors: errors,
      warnings: warnings,
      schedule_info: {
        id: schedule.id,
        ngay: schedule.ngay,
        ca: schedule.ca,
        ten_nguoi_dang_ky: schedule.ten_nhan_vien,
        ma_nguoi_dang_ky: schedule.ma_nhan_vien,
        trang_thai: schedule.trang_thai
      }
    });

  } catch (error) {
    console.error('❌ Lỗi kiểm tra trực thay:', error);
    res.status(500).json({ 
      success: false,
      message: 'Lỗi server khi kiểm tra trực thay',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ======================
// API: Check-in cho ca trực thay (FIXED VERSION)
// ======================
router.post('/truc-thay/checkin/:lich_truc_ao_id', auth, async (req, res) => {
  const { ma_nhan_vien, ten_nhan_vien } = req.employee;
  const { lich_truc_ao_id } = req.params;
  const now = new Date();
  const currentTime = now.toTimeString().slice(0, 5);

  console.log('=== CHECK-IN TRỰC THAY ===');
  console.log('Người check-in:', { ma_nhan_vien, ten_nhan_vien });
  console.log('Lịch ảo ID:', lich_truc_ao_id);

  try {
    // 1. Kiểm tra xem có phải là ca trực thay không
    const [virtualScheduleRows] = await db.query(
      `SELECT lt.*, tt.lich_truc_goc_id, tt.nguoi_dang_ky_id, nv.ten_nhan_vien as ten_nguoi_dang_ky
       FROM lich_truc lt
       INNER JOIN truc_thay tt ON lt.id = tt.lich_truc_ao_id
       INNER JOIN nhanvien nv ON tt.nguoi_dang_ky_id = nv.id
       WHERE lt.id = ? AND lt.nhan_vien_id = (
         SELECT id FROM nhanvien WHERE ma_nhan_vien = ?
       ) AND tt.trang_thai = 'active'`,
      [lich_truc_ao_id, ma_nhan_vien]
    );

    if (virtualScheduleRows.length === 0) {
      return res.status(404).json({ 
        success: false,
        message: 'Không tìm thấy ca trực thay hoặc không có quyền hoặc chưa được duyệt' 
      });
    }

    const virtualSchedule = virtualScheduleRows[0];
    const lich_truc_goc_id = virtualSchedule.lich_truc_goc_id;
    const ten_nguoi_dang_ky = virtualSchedule.ten_nguoi_dang_ky;

    console.log('Thông tin trực thay:', {
      lịch_gốc_id: lich_truc_goc_id,
      người_đăng_ký: ten_nguoi_dang_ky,
      trạng_thái: virtualSchedule.trang_thai
    });

    // 2. Kiểm tra trạng thái
    if (virtualSchedule.trang_thai === 'checked_out') {
      return res.status(400).json({ 
        success: false,
        message: 'Ca này đã hoàn thành' 
      });
    }
    
    if (virtualSchedule.trang_thai === 'checked_in') {
      return res.status(400).json({
        success: false,
        message: 'Bạn đã check-in rồi'
      });
    }

    // 2a. KIỂM TRA GIỚI HẠN 91H/THÁNG CỦA CHÍNH NGƯỜI TRỰC THAY (không tính giờ này,
    // vì giờ trực thay tính cho người được trực thay, đây là giới hạn sức làm việc thực tế)
    const capDateTT = new Date(virtualSchedule.ngay);
    const capHoursTT = await getMonthlyHours(ma_nhan_vien, capDateTT.getMonth() + 1, capDateTT.getFullYear());
    if (capHoursTT >= 91) {
      return res.status(400).json({
        success: false,
        message: 'Bạn đã đạt giới hạn tối đa 91 giờ trong tháng, không thể check-in.'
      });
    }

    // 2b. KIỂM TRA CHƯA TỚI GIỜ LÀM (giống ca thường - trước đây thiếu nên check-in sớm được)
    const shiftInfo = SHIFTS.find(s => s.key === virtualSchedule.ca);
    if (shiftInfo) {
      const recordDate = new Date(virtualSchedule.ngay).toISOString().split('T')[0];
      const currentDate = now.toISOString().split('T')[0];
      if (recordDate === currentDate && currentTime < shiftInfo.start) {
        return res.status(400).json({
          success: false,
          message: `Chưa tới giờ làm! Check-in chỉ được thực hiện từ ${shiftInfo.start}`
        });
      }
    }

    // 3. BẮT ĐẦU TRANSACTION
    await db.query('START TRANSACTION');

    try {
      // 4. Check-in lịch ảo
      await db.query(
        'UPDATE lich_truc SET trang_thai = ?, gio_vao = ?, updated_at = NOW() WHERE id = ?',
        ['checked_in', currentTime, lich_truc_ao_id]
      );

      console.log('✅ Đã check-in lịch ảo');

      // 5. Check-in lịch gốc (đồng bộ)
      await db.query(
        'UPDATE lich_truc SET trang_thai = ?, gio_vao = ?, updated_at = NOW() WHERE id = ?',
        ['checked_in', currentTime, lich_truc_goc_id]
      );

      console.log('✅ Đã đồng bộ check-in lịch gốc');

      await db.query('COMMIT');

      res.json({
        success: true,
        message: `Check-in trực thay thành công cho ${ten_nguoi_dang_ky}`,
        note: `⚠️ Số giờ làm sẽ được tính cho ${ten_nguoi_dang_ky}`,
        data: {
          lich_truc_ao_id: lich_truc_ao_id,
          lich_truc_goc_id: lich_truc_goc_id,
          gio_vao: currentTime,
          nguoi_duoc_truc_thay: ten_nguoi_dang_ky
        }
      });

    } catch (error) {
      await db.query('ROLLBACK');
      console.error('❌ Transaction lỗi:', error);
      throw error;
    }

  } catch (error) {
    console.error('❌ Lỗi check-in trực thay:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi check-in trực thay',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ======================
// API: Hủy check-in trực thay (không cần checkout) - lỡ check-in nhưng không đi làm ca trực thay.
// Đưa cả lịch ảo lẫn lịch gốc (đã đồng bộ lúc check-in) về lại "registered".
// ======================
router.post('/truc-thay/undo-checkin/:lich_truc_ao_id', auth, async (req, res) => {
  const { ma_nhan_vien } = req.employee;
  const { lich_truc_ao_id } = req.params;

  try {
    const [virtualScheduleRows] = await db.query(
      `SELECT lt.*, tt.lich_truc_goc_id
       FROM lich_truc lt
       INNER JOIN truc_thay tt ON lt.id = tt.lich_truc_ao_id
       WHERE lt.id = ? AND lt.nhan_vien_id = (
         SELECT id FROM nhanvien WHERE ma_nhan_vien = ?
       ) AND tt.trang_thai = 'active'`,
      [lich_truc_ao_id, ma_nhan_vien]
    );

    if (virtualScheduleRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy ca trực thay hoặc không có quyền' });
    }

    const virtualSchedule = virtualScheduleRows[0];
    const lich_truc_goc_id = virtualSchedule.lich_truc_goc_id;

    if (virtualSchedule.trang_thai !== 'checked_in') {
      return res.status(400).json({ success: false, message: 'Ca này chưa check-in hoặc đã check-out, không thể hủy check-in' });
    }

    await db.query('START TRANSACTION');
    try {
      await db.query(
        `UPDATE lich_truc SET trang_thai = 'registered', gio_vao = NULL, updated_at = NOW() WHERE id = ?`,
        [lich_truc_ao_id]
      );
      await db.query(
        `UPDATE lich_truc SET trang_thai = 'registered', gio_vao = NULL, updated_at = NOW() WHERE id = ?`,
        [lich_truc_goc_id]
      );
      await db.query('COMMIT');

      res.json({
        success: true,
        message: 'Đã hủy check-in. Ca quay lại trạng thái chưa check-in, bạn có thể check-in lại nếu vẫn đi làm ca này.'
      });
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('❌ Lỗi hủy check-in trực thay:', error);
    res.status(500).json({ success: false, message: 'Lỗi server khi hủy check-in trực thay' });
  }
});

// ======================
// API: Check-out cho ca trực thay (FIXED VERSION)
// ======================
router.post('/truc-thay/checkout/:lich_truc_ao_id', auth, async (req, res) => {
  const { ma_nhan_vien, ten_nhan_vien } = req.employee;
  const { lich_truc_ao_id } = req.params;
  const now = new Date();
  const currentTime = now.toTimeString().slice(0, 5);

  console.log('=== CHECK-OUT TRỰC THAY ===');

  try {
    // 1. Kiểm tra xem có phải là ca trực thay không
    const [virtualScheduleRows] = await db.query(
      `SELECT lt.*, tt.lich_truc_goc_id, tt.nguoi_dang_ky_id, nv.ten_nhan_vien as ten_nguoi_dang_ky
       FROM lich_truc lt
       INNER JOIN truc_thay tt ON lt.id = tt.lich_truc_ao_id
       INNER JOIN nhanvien nv ON tt.nguoi_dang_ky_id = nv.id
       WHERE lt.id = ? AND lt.nhan_vien_id = (
         SELECT id FROM nhanvien WHERE ma_nhan_vien = ?
       ) AND tt.trang_thai = 'active'`,
      [lich_truc_ao_id, ma_nhan_vien]
    );

    if (virtualScheduleRows.length === 0) {
      return res.status(404).json({ 
        success: false,
        message: 'Không tìm thấy ca trực thay hoặc không có quyền hoặc chưa được duyệt' 
      });
    }

    const virtualSchedule = virtualScheduleRows[0];
    const lich_truc_goc_id = virtualSchedule.lich_truc_goc_id;
    const ten_nguoi_dang_ky = virtualSchedule.ten_nguoi_dang_ky;

    // 2. Kiểm tra trạng thái
    if (virtualSchedule.trang_thai !== 'checked_in') {
      return res.status(400).json({
        success: false,
        message: 'Bạn cần check-in trước khi check-out'
      });
    }

    // 2a. KIỂM TRA GIỚI HẠN 91H/THÁNG CỦA CHÍNH NGƯỜI TRỰC THAY
    const capDateTTOut = new Date(virtualSchedule.ngay);
    const capHoursTTOut = await getMonthlyHours(ma_nhan_vien, capDateTTOut.getMonth() + 1, capDateTTOut.getFullYear());
    if (capHoursTTOut >= 91) {
      return res.status(400).json({
        success: false,
        message: 'Bạn đã đạt giới hạn tối đa 91 giờ trong tháng, không thể check-out.'
      });
    }

    // 3. Tính thời gian làm việc
    const checkInTime = virtualSchedule.gio_vao ? 
      new Date(`${new Date().toISOString().split('T')[0]}T${virtualSchedule.gio_vao}`) : now;
    const checkOutTime = new Date(`${new Date().toISOString().split('T')[0]}T${currentTime}`);
    const workDuration = Math.max(0, (checkOutTime - checkInTime) / (1000 * 60 * 60));

    console.log('Thời gian làm việc:', {
      vào: virtualSchedule.gio_vao,
      ra: currentTime,
      tổng: workDuration.toFixed(2) + ' giờ'
    });

    // 4. BẮT ĐẦU TRANSACTION
    await db.query('START TRANSACTION');

    try {
      // 5. Check-out lịch ảo
      await db.query(
        'UPDATE lich_truc SET trang_thai = ?, gio_ra = ?, thoi_gian_lam = ?, updated_at = NOW() WHERE id = ?',
        ['checked_out', currentTime, workDuration.toFixed(2), lich_truc_ao_id]
      );

      // 6. Check-out lịch gốc (đồng bộ)
      await db.query(
        'UPDATE lich_truc SET trang_thai = ?, gio_ra = ?, thoi_gian_lam = ?, updated_at = NOW() WHERE id = ?',
        ['checked_out', currentTime, workDuration.toFixed(2), lich_truc_goc_id]
      );

      // 7. Cập nhật trạng thái trực thay
      await db.query(
        'UPDATE truc_thay SET trang_thai = "completed", updated_at = NOW() WHERE lich_truc_ao_id = ?',
        [lich_truc_ao_id]
      );

      await db.query('COMMIT');

      res.json({
        success: true,
        message: `Check-out thành công! Đã làm được ${workDuration.toFixed(2)} giờ cho ${ten_nguoi_dang_ky}`,
        note: `✅ Số giờ làm đã được tính cho ${ten_nguoi_dang_ky}`,
        data: {
          lich_truc_ao_id: lich_truc_ao_id,
          lich_truc_goc_id: lich_truc_goc_id,
          gio_ra: currentTime,
          thoi_gian_lam: workDuration.toFixed(2),
          nguoi_duoc_truc_thay: ten_nguoi_dang_ky
        }
      });

    } catch (error) {
      await db.query('ROLLBACK');
      console.error('❌ Transaction lỗi:', error);
      throw error;
    }

  } catch (error) {
    console.error('❌ Lỗi check-out trực thay:', error);
    res.status(500).json({ 
      success: false,
      message: 'Lỗi server khi check-out trực thay',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ======================
// API: Gửi yêu cầu điều chỉnh giờ (check-in hoặc check-out)
// ======================
router.post('/schedule/:id/request-time-adjustment', auth, async (req, res) => {
  const { ma_nhan_vien, ten_nhan_vien } = req.employee;
  const { id } = req.params;
  const { loai_yeu_cau, thoi_gian_de_xuat, ly_do } = req.body;

  console.log('=== YÊU CẦU ĐIỀU CHỈNH GIỜ ===');
  console.log('Người yêu cầu:', { ma_nhan_vien, ten_nhan_vien });
  console.log('Lịch trực ID:', id);
  console.log('Loại yêu cầu:', loai_yeu_cau);
  console.log('Thời gian đề xuất:', thoi_gian_de_xuat);
  console.log('Lý do:', ly_do);

  try {
    // 1. Lấy thông tin lịch trực
    const [rows] = await db.query('SELECT * FROM lich_truc WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ 
        success: false,
        message: 'Không tìm thấy ca đăng ký' 
      });
    }
    
    const record = rows[0];
    
    // 2. Kiểm tra quyền
    if (record.ma_nhan_vien !== ma_nhan_vien) {
      return res.status(403).json({ 
        success: false,
        message: 'Bạn không có quyền yêu cầu điều chỉnh ca này' 
      });
    }
    
    // 3. Kiểm tra trạng thái
    if (record.trang_thai === 'checked_out') {
      return res.status(400).json({ 
        success: false,
        message: 'Ca này đã hoàn thành' 
      });
    }
    
    // 4. Kiểm tra loại yêu cầu hợp lệ
    if (loai_yeu_cau === 'checkin' && record.trang_thai === 'checked_in') {
      return res.status(400).json({ 
        success: false,
        message: 'Bạn đã check-in rồi' 
      });
    }
    
    if (loai_yeu_cau === 'checkout' && record.trang_thai !== 'checked_in') {
      return res.status(400).json({ 
        success: false,
        message: 'Bạn cần check-in trước khi yêu cầu điều chỉnh giờ check-out' 
      });
    }
    
    // 5. Kiểm tra xem đã có yêu cầu chờ duyệt chưa
    const [existingRequest] = await db.query(
      'SELECT id FROM yeu_cau_dieu_chinh_gio WHERE lich_truc_id = ? AND trang_thai = "pending"',
      [id]
    );
    
    if (existingRequest.length > 0) {
      return res.status(400).json({ 
        success: false,
        message: 'Đã có yêu cầu điều chỉnh đang chờ duyệt cho ca này' 
      });
    }
    
    // 6. Lấy thông tin nhân viên
    const [empRows] = await db.query('SELECT id FROM nhanvien WHERE ma_nhan_vien = ?', [ma_nhan_vien]);
    if (empRows.length === 0) {
      return res.status(400).json({ 
        success: false,
        message: 'Nhân viên không tồn tại' 
      });
    }
    const nhan_vien_id = empRows[0].id;
    
    // Tính số ngày trễ (nếu có)
    const currentDate = new Date().toISOString().split('T')[0];
    const recordDate = new Date(record.ngay).toISOString().split('T')[0];
    let daysLate = 0;
    if (recordDate < currentDate) {
      const diffTime = Math.abs(new Date() - new Date(record.ngay));
      daysLate = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }
    
    // 7. Tạo yêu cầu điều chỉnh
    await db.query(
      `INSERT INTO yeu_cau_dieu_chinh_gio 
       (lich_truc_id, nhan_vien_id, ma_nhan_vien, ten_nhan_vien, loai_yeu_cau, 
        thoi_gian_de_xuat, gio_vao_hien_tai, gio_ra_hien_tai, ngay, ca, ly_do, trang_thai) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [
        id, 
        nhan_vien_id, 
        ma_nhan_vien, 
        ten_nhan_vien, 
        loai_yeu_cau,
        thoi_gian_de_xuat,
        record.gio_vao,
        record.gio_ra,
        record.ngay,
        record.ca,
        ly_do || (daysLate > 0 ? `Quên check-out sau ${daysLate} ngày` : 'Không có lý do')
      ]
    );
    
    // 8. Thêm thông báo cho admin
    try {
      const [adminRows] = await db.query('SELECT id FROM nhanvien WHERE is_admin = 1');
      const loaiText = loai_yeu_cau === 'checkin' ? 'check-in' : 'check-out';
      const lateText = daysLate > 0 ? ` (trễ ${daysLate} ngày)` : '';
      
      for (const admin of adminRows) {
        await db.query(
          `INSERT INTO thong_bao_truc_thay 
           (nguoi_nhan_id, nguoi_gui_id, lich_truc_id, noi_dung, loai) 
           VALUES (?, ?, ?, ?, ?)`,
          [
            admin.id,
            nhan_vien_id,
            id,
            `${ten_nhan_vien} (${ma_nhan_vien}) đã gửi yêu cầu điều chỉnh giờ ${loaiText}${lateText} ca ${record.ca} ngày ${new Date(record.ngay).toLocaleDateString('vi-VN')}. Thời gian đề xuất: ${thoi_gian_de_xuat}. Lý do: ${ly_do || 'Không có lý do'}`,
            loai_yeu_cau === 'checkin' ? 'checkin_request' : 'checkout_request'
          ]
        );
      }
    } catch (notifyError) {
      console.error('Lỗi gửi thông báo:', notifyError);
      // Không throw error vẫn tiếp tục
    }
    
    const lateMessage = daysLate > 0 ? ` (trễ ${daysLate} ngày)` : '';
    res.json({
      success: true,
      message: `Đã gửi yêu cầu điều chỉnh giờ ${loai_yeu_cau === 'checkin' ? 'check-in' : 'check-out'}${lateMessage} thành công. Vui lòng chờ admin duyệt.`,
      data: {
        lich_truc_id: id,
        loai_yeu_cau: loai_yeu_cau,
        thoi_gian_de_xuat: thoi_gian_de_xuat,
        trang_thai: 'pending',
        days_late: daysLate
      }
    });
    
  } catch (error) {
    console.error('Lỗi gửi yêu cầu điều chỉnh:', error);
    res.status(500).json({ 
      success: false,
      message: 'Lỗi server khi gửi yêu cầu điều chỉnh',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ======================
// ADMIN API: Lấy danh sách yêu cầu điều chỉnh giờ (tất cả trạng thái)
// ======================
router.get('/admin/time-adjustments/all', auth, requireAdmin, async (req, res) => {
  const { month, year } = req.query;
  
  let query = `
    SELECT 
      yc.*,
      lt.trang_thai as trang_thai_lich,
      lt.gio_vao as gio_vao_hien_tai,
      lt.gio_ra as gio_ra_hien_tai,
      lt.thoi_gian_lam as thoi_gian_lam_hien_tai,
      CASE yc.ca
        WHEN 'ca1' THEN 'Ca 1: 7:00-9:30'
        WHEN 'ca2' THEN 'Ca 2: 9:30-12:30'
        WHEN 'ca3' THEN 'Ca 3: 12:30-15:00'
        WHEN 'ca4' THEN 'Ca 4: 15:00-17:30'
      END as ten_ca,
      CASE yc.loai_yeu_cau
        WHEN 'checkin' THEN 'Check-in'
        WHEN 'checkout' THEN 'Check-out'
      END as ten_loai_yeu_cau
    FROM yeu_cau_dieu_chinh_gio yc
    INNER JOIN lich_truc lt ON yc.lich_truc_id = lt.id
    WHERE 1=1
  `;
  
  const params = [];
  if (month && year) {
    query += ' AND MONTH(yc.ngay) = ? AND YEAR(yc.ngay) = ?';
    params.push(month, year);
  }
  
  query += ' ORDER BY yc.created_at DESC';
  
  try {
    const [rows] = await db.query(query, params);
    res.json(rows);
  } catch (error) {
    console.error('Lỗi lấy lịch sử yêu cầu điều chỉnh:', error);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// ======================
// ADMIN API: Lấy danh sách yêu cầu điều chỉnh giờ chờ duyệt
// ======================
router.get('/admin/pending-time-adjustments', auth, requireAdmin, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT 
        yc.*,
        -- Thông tin lịch trực
        lt.trang_thai as trang_thai_lich,
        lt.gio_vao as gio_vao_hien_tai,
        lt.gio_ra as gio_ra_hien_tai,
        lt.thoi_gian_lam as thoi_gian_lam_hien_tai,
        
        -- Thông tin ca
        CASE yc.ca
          WHEN 'ca1' THEN 'Ca 1: 7:00-9:30'
          WHEN 'ca2' THEN 'Ca 2: 9:30-12:30'
          WHEN 'ca3' THEN 'Ca 3: 12:30-15:00'
          WHEN 'ca4' THEN 'Ca 4: 15:00-17:30'
        END as ten_ca,
        
        -- Thời gian quá giờ (cho check-out)
        CASE 
          WHEN yc.loai_yeu_cau = 'checkout' THEN
            TIMEDIFF(yc.thoi_gian_de_xuat, 
              CASE yc.ca
                WHEN 'ca1' THEN '09:30'
                WHEN 'ca2' THEN '12:30'
                WHEN 'ca3' THEN '15:00'
                WHEN 'ca4' THEN '17:30'
              END
            )
          ELSE NULL
        END as thoi_gian_qua_gio
      FROM yeu_cau_dieu_chinh_gio yc
      INNER JOIN lich_truc lt ON yc.lich_truc_id = lt.id
      WHERE yc.trang_thai = 'pending'
      ORDER BY yc.created_at DESC`
    );
    
    res.json(rows);
  } catch (error) {
    console.error('Lỗi lấy yêu cầu điều chỉnh:', error);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// ======================
// ADMIN API: Duyệt/từ chối yêu cầu điều chỉnh giờ (ĐÃ SỬA)
// ======================
router.post('/admin/time-adjustment/:id/process', auth, requireFullAdmin, async (req, res) => {
  const { id } = req.params;
  const { approve, thoi_gian_dieu_chinh, ghi_chu_admin } = req.body;
  const admin_id = req.employee.id;

  console.log('=== XỬ LÝ YÊU CẦU ĐIỀU CHỈNH GIỜ ===');
  console.log('Yêu cầu ID:', id);
  console.log('Duyệt:', approve);
  console.log('Thời gian điều chỉnh:', thoi_gian_dieu_chinh);
  console.log('Ghi chú admin:', ghi_chu_admin);

  // Kiểm tra tham số đầu vào
  if (!id) {
    return res.status(400).json({ 
      success: false,
      message: 'Thiếu ID yêu cầu' 
    });
  }

  try {
    // 1. Lấy thông tin yêu cầu
    const [requestRows] = await db.query(
      'SELECT * FROM yeu_cau_dieu_chinh_gio WHERE id = ?',
      [id]
    );

    if (requestRows.length === 0) {
      return res.status(404).json({ 
        success: false,
        message: 'Không tìm thấy yêu cầu điều chỉnh' 
      });
    }

    const request = requestRows[0];
    
    // Kiểm tra trạng thái yêu cầu
    if (request.trang_thai !== 'pending') {
      return res.status(400).json({ 
        success: false,
        message: `Yêu cầu đã được xử lý (${request.trang_thai})` 
      });
    }
    
    // ===== XỬ LÝ AN TOÀN NGÀY THÁNG =====
    // Tạo một object copy để không ảnh hưởng đến request gốc
    const requestData = { ...request };
    
    // Xử lý trường ngay để tránh lỗi toISOString
    let ngayFormatted = request.ngay;
    
    // Nếu request.ngay là Date object
    if (request.ngay instanceof Date) {
      ngayFormatted = request.ngay.toISOString().split('T')[0];
    } 
    // Nếu request.ngay là string
    else if (typeof request.ngay === 'string') {
      // Giữ nguyên hoặc parse nếu cần
      ngayFormatted = request.ngay;
    }
    // Nếu request.ngay là số (timestamp)
    else if (typeof request.ngay === 'number') {
      ngayFormatted = new Date(request.ngay).toISOString().split('T')[0];
    }
    
    // Gán lại giá trị đã xử lý
    requestData.ngay = ngayFormatted;
    
    // 2. BẮT ĐẦU TRANSACTION
    await db.query('START TRANSACTION');

    try {
      if (approve) {
        // Duyệt: cập nhật lịch trực dựa trên loại yêu cầu
        const thoi_gian = thoi_gian_dieu_chinh || request.thoi_gian_de_xuat;
        
        if (!thoi_gian) {
          throw new Error('Thiếu thời gian điều chỉnh');
        }
        
        if (request.loai_yeu_cau === 'checkin') {
          // Yêu cầu check-in: cập nhật giờ vào
          await db.query(
            `UPDATE lich_truc 
             SET gio_vao = ?, 
                 trang_thai = 'checked_in',
                 updated_at = NOW(),
                 ghi_chu = CONCAT(COALESCE(ghi_chu, ''), ' | Admin điều chỉnh check-in: ', ?, ' - Lý do: ', ?)
             WHERE id = ?`,
            [
              thoi_gian,
              thoi_gian,
              request.ly_do || 'Không có lý do',
              request.lich_truc_id
            ]
          );
          
          console.log(`✅ Đã cập nhật check-in cho lịch trực ID: ${request.lich_truc_id}`);
          
        } else {
          // Yêu cầu check-out: cập nhật giờ ra và tính thời gian làm
          // Lấy thông tin lịch trực hiện tại
          const [lichTrucRows] = await db.query(
            'SELECT * FROM lich_truc WHERE id = ?',
            [request.lich_truc_id]
          );
          
          if (lichTrucRows.length === 0) {
            throw new Error('Không tìm thấy lịch trực');
          }
          
          const lichTruc = lichTrucRows[0];
          
          // Tính thời gian làm việc
          let workDuration = 0;
          if (lichTruc.gio_vao) {
            // SỬ DỤNG requestData.ngay thay vì request.ngay.toISOString()
            const checkInTime = new Date(`${requestData.ngay}T${lichTruc.gio_vao}`);
            const checkOutTime = new Date(`${requestData.ngay}T${thoi_gian}`);
            workDuration = Math.max(0, (checkOutTime - checkInTime) / (1000 * 60 * 60));
          }
          
          await db.query(
            `UPDATE lich_truc 
             SET gio_ra = ?, 
                 thoi_gian_lam = ?, 
                 trang_thai = 'checked_out',
                 updated_at = NOW(),
                 ghi_chu = CONCAT(COALESCE(ghi_chu, ''), ' | Admin điều chỉnh check-out: ', ?, ' - Thời gian làm: ', ?, 'h - Lý do: ', ?)
             WHERE id = ?`,
            [
              thoi_gian,
              workDuration.toFixed(2),
              thoi_gian,
              workDuration.toFixed(2),
              request.ly_do || 'Không có lý do',
              request.lich_truc_id
            ]
          );
          
          console.log(`✅ Đã cập nhật check-out cho lịch trực ID: ${request.lich_truc_id}`);
        }
        
        // Cập nhật yêu cầu
        await db.query(
          `UPDATE yeu_cau_dieu_chinh_gio 
           SET trang_thai = 'approved', 
               admin_duyet_id = ?, 
               thoi_gian_dieu_chinh = ?,
               ghi_chu_admin = ?,
               updated_at = NOW()
           WHERE id = ?`,
          [admin_id, thoi_gian, ghi_chu_admin || null, id]
        );
        
        console.log(`✅ Đã cập nhật yêu cầu ID: ${id} thành approved`);
        
        // Tạo thông báo cho nhân viên (nếu có bảng thông báo)
        try {
          const loaiText = request.loai_yeu_cau === 'checkin' ? 'check-in' : 'check-out';
          await db.query(
            `INSERT INTO thong_bao_truc_thay 
             (nguoi_nhan_id, nguoi_gui_id, lich_truc_id, noi_dung, loai) 
             VALUES (?, ?, ?, ?, ?)`,
            [
              request.nhan_vien_id,
              admin_id,
              request.lich_truc_id,
              `Yêu cầu điều chỉnh giờ ${loaiText} của bạn đã được duyệt. Thời gian mới: ${thoi_gian.substring(0, 5)}.`,
              request.loai_yeu_cau === 'checkin' ? 'checkin_request_approved' : 'checkout_request_approved'
            ]
          );
        } catch (notifyError) {
          console.error('Lỗi tạo thông báo (không ảnh hưởng):', notifyError);
        }
        
        await db.query('COMMIT');
        
        res.json({ 
          success: true,
          message: `Đã duyệt yêu cầu và cập nhật thời gian ${request.loai_yeu_cau === 'checkin' ? 'check-in' : 'check-out'}`,
          data: {
            id,
            status: 'approved',
            loai_yeu_cau: request.loai_yeu_cau,
            thoi_gian_moi: thoi_gian
          }
        });
        
      } else {
        // Từ chối: chỉ cập nhật yêu cầu, không thay đổi lịch trực
        await db.query(
          `UPDATE yeu_cau_dieu_chinh_gio 
           SET trang_thai = 'rejected', 
               admin_duyet_id = ?,
               ghi_chu_admin = ?,
               updated_at = NOW()
           WHERE id = ?`,
          [admin_id, ghi_chu_admin || 'Từ chối yêu cầu', id]
        );
        
        console.log(`✅ Đã cập nhật yêu cầu ID: ${id} thành rejected`);
        
        // Tạo thông báo cho nhân viên (nếu có bảng thông báo)
        try {
          const loaiText = request.loai_yeu_cau === 'checkin' ? 'check-in' : 'check-out';
          await db.query(
            `INSERT INTO thong_bao_truc_thay 
             (nguoi_nhan_id, nguoi_gui_id, lich_truc_id, noi_dung, loai) 
             VALUES (?, ?, ?, ?, ?)`,
            [
              request.nhan_vien_id,
              admin_id,
              request.lich_truc_id,
              `Yêu cầu điều chỉnh giờ ${loaiText} của bạn đã bị từ chối. Lý do: ${ghi_chu_admin || 'Không được duyệt'}.`,
              request.loai_yeu_cau === 'checkin' ? 'checkin_request_rejected' : 'checkout_request_rejected'
            ]
          );
        } catch (notifyError) {
          console.error('Lỗi tạo thông báo (không ảnh hưởng):', notifyError);
        }
        
        await db.query('COMMIT');
        
        res.json({ 
          success: true,
          message: 'Đã từ chối yêu cầu điều chỉnh',
          data: { id, status: 'rejected' }
        });
      }
      
    } catch (error) {
      await db.query('ROLLBACK');
      console.error('❌ Transaction lỗi:', error);
      throw error;
    }
    
  } catch (error) {
    console.error('❌ Lỗi xử lý yêu cầu điều chỉnh:', error);
    res.status(500).json({ 
      success: false,
      message: 'Lỗi server khi xử lý yêu cầu: ' + error.message 
    });
  }
});

// ======================
// ADMIN API: Lấy chi tiết yêu cầu điều chỉnh theo nhân viên
// ======================
router.get('/admin/employee/:id/time-adjustments', auth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { month, year } = req.query;
  
  let query = 'SELECT * FROM yeu_cau_dieu_chinh_gio WHERE nhan_vien_id = ?';
  const params = [id];
  
  if (month && year) {
    query += ' AND MONTH(ngay) = ? AND YEAR(ngay) = ?';
    params.push(month, year);
  }
  
  query += ' ORDER BY created_at DESC';

  try {
    const [rows] = await db.query(query, params);
    res.json(rows);
  } catch (error) {
    console.error('Lỗi lấy yêu cầu điều chỉnh:', error);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// ======================
// API: Lấy lịch sử yêu cầu điều chỉnh của tôi
// ======================
router.get('/my/time-adjustments', auth, async (req, res) => {
  const { ma_nhan_vien } = req.employee;
  
  try {
    const [empRows] = await db.query('SELECT id FROM nhanvien WHERE ma_nhan_vien = ?', [ma_nhan_vien]);
    if (empRows.length === 0) {
      return res.status(400).json({ 
        success: false,
        message: 'Nhân viên không tồn tại' 
      });
    }
    const nhan_vien_id = empRows[0].id;
    
    const [rows] = await db.query(
      `SELECT 
        yc.*,
        CASE yc.trang_thai
          WHEN 'pending' THEN 'Chờ duyệt'
          WHEN 'approved' THEN 'Đã duyệt'
          WHEN 'rejected' THEN 'Từ chối'
        END as trang_thai_text,
        CASE yc.ca
          WHEN 'ca1' THEN 'Ca 1: 7:00-9:30'
          WHEN 'ca2' THEN 'Ca 2: 9:30-12:30'
          WHEN 'ca3' THEN 'Ca 3: 12:30-15:00'
          WHEN 'ca4' THEN 'Ca 4: 15:00-17:30'
        END as ten_ca,
        CASE yc.loai_yeu_cau
          WHEN 'checkin' THEN 'Check-in'
          WHEN 'checkout' THEN 'Check-out'
        END as ten_loai_yeu_cau
      FROM yeu_cau_dieu_chinh_gio yc
      WHERE yc.nhan_vien_id = ?
      ORDER BY yc.created_at DESC`,
      [nhan_vien_id]
    );
    
    res.json({
      success: true,
      data: rows
    });
  } catch (error) {
    console.error('Lỗi lấy lịch sử yêu cầu:', error);
    res.status(500).json({ 
      success: false,
      message: 'Lỗi server' 
    });
  }
});

// ======================
// API XUẤT BÁO CÁO THÁNG RA EXCEL (CÓ GIỜ VÀO, GIỜ RA)
// ======================
router.get('/monthly-report/excel', auth, async (req, res) => {
  const { ma_nhan_vien, ten_nhan_vien } = req.employee;
  const { month, year } = req.query;
  
  const today = new Date();
  const targetMonth = month || today.getMonth() + 1;
  const targetYear = year || today.getFullYear();

  try {
    // Lấy thông tin nhân viên
    const [empRows] = await db.query('SELECT id FROM nhanvien WHERE ma_nhan_vien = ?', [ma_nhan_vien]);
    if (empRows.length === 0) {
      return res.status(400).json({ message: 'Nhân viên không tồn tại' });
    }
    const nhan_vien_id = empRows[0].id;

    // Lấy dữ liệu chi tiết các ca đã làm trong tháng (CÓ GIỜ VÀO, GIỜ RA)
    const [workRecords] = await db.query(
      `SELECT 
        lt.*,
        DATE(lt.ngay) as ngay_thang,
        nv.ten_nhan_vien,
        nv.ma_nhan_vien
      FROM lich_truc lt
      JOIN nhanvien nv ON lt.nhan_vien_id = nv.id
      WHERE lt.nhan_vien_id = ? 
        AND MONTH(lt.ngay) = ?
        AND YEAR(lt.ngay) = ?
        AND lt.trang_thai = 'checked_out'
        AND lt.thoi_gian_lam IS NOT NULL
      ORDER BY lt.ngay ASC, 
        CASE lt.ca
          WHEN 'ca1' THEN 1
          WHEN 'ca2' THEN 2
          WHEN 'ca3' THEN 3
          WHEN 'ca4' THEN 4
        END`,
      [nhan_vien_id, targetMonth, targetYear]
    );

    // Lấy tổng kết tháng
    const [monthlySummary] = await db.query(
      `SELECT 
        COUNT(DISTINCT DATE(ngay)) as tong_so_ngay,
        COUNT(*) as tong_so_ca,
        SUM(thoi_gian_lam) as tong_thoi_gian_thang
      FROM lich_truc 
      WHERE nhan_vien_id = ? 
        AND MONTH(ngay) = ?
        AND YEAR(ngay) = ?
        AND trang_thai = 'checked_out'
        AND thoi_gian_lam IS NOT NULL`,
      [nhan_vien_id, targetMonth, targetYear]
    );

    // Tạo workbook Excel
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Hệ thống chấm công';
    workbook.created = new Date();
    
    // Tạo worksheet chính
    const worksheet = workbook.addWorksheet(`Báo cáo ${targetMonth}/${targetYear}`);
    
    // Định nghĩa các column
    worksheet.columns = [
      { header: 'STT', key: 'stt', width: 6 },
      { header: 'Ngày làm việc', key: 'ngay', width: 15 },
      { header: 'Thứ', key: 'thu', width: 8 },
      { header: 'Ca làm việc', key: 'ca', width: 20 },
      { header: 'Mã nhân viên', key: 'ma_nhan_vien', width: 12 },
      { header: 'Tên nhân viên', key: 'ten_nhan_vien', width: 25 },
      { header: 'Giờ vào', key: 'gio_vao', width: 10 },
      { header: 'Giờ ra', key: 'gio_ra', width: 10 },
      { header: 'Thời gian làm (giờ)', key: 'thoi_gian_lam', width: 18 },
      { header: 'Thời gian làm (phút)', key: 'thoi_gian_lam_phut', width: 18 },
      { header: 'Trạng thái', key: 'trang_thai', width: 12 },
      { header: 'Ghi chú', key: 'ghi_chu', width: 25 }
    ];

    // Style cho header
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF2E7D32' }
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 25;

    // Thêm dữ liệu
    let stt = 1;
    
    workRecords.forEach((record, index) => {
      const ngay = new Date(record.ngay_thang);
      const thu = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'][ngay.getDay()];
      
      // Định dạng tên ca
      let caLabel = record.ca;
      switch(record.ca) {
        case 'ca1': caLabel = 'Ca 1: 7:00-9:30'; break;
        case 'ca2': caLabel = 'Ca 2: 9:30-12:30'; break;
        case 'ca3': caLabel = 'Ca 3: 12:30-15:00'; break;
        case 'ca4': caLabel = 'Ca 4: 15:00-17:30'; break;
      }
      
      // Tính thời gian làm theo phút
      const thoiGianLamPhut = Math.round((Number(record.thoi_gian_lam) || 0) * 60);
      
      // Format giờ vào, giờ ra
      const gioVao = record.gio_vao ? 
        (typeof record.gio_vao === 'string' ? record.gio_vao.substring(0, 5) : record.gio_vao) : '';
      const gioRa = record.gio_ra ? 
        (typeof record.gio_ra === 'string' ? record.gio_ra.substring(0, 5) : record.gio_ra) : '';
      
      // Thêm dòng dữ liệu với GIỜ VÀO, GIỜ RA
      worksheet.addRow({
        stt: stt++,
        ngay: ngay.toLocaleDateString('vi-VN'),
        thu: thu,
        ca: caLabel,
        ma_nhan_vien: record.ma_nhan_vien,
        ten_nhan_vien: record.ten_nhan_vien,
        gio_vao: gioVao,
        gio_ra: gioRa,
        thoi_gian_lam: Number(record.thoi_gian_lam).toFixed(2),
        thoi_gian_lam_phut: thoiGianLamPhut,
        trang_thai: 'Hoàn thành',
        ghi_chu: `Ca ${caLabel.split(':')[0]} ngày ${ngay.toLocaleDateString('vi-VN')}`
      });
    });

    // Thêm dòng trống
    worksheet.addRow({});

    // Thêm dòng tổng kết
    const summaryRow = worksheet.addRow({
      ngay: 'TỔNG KẾT THÁNG',
      thu: '',
      ca: '',
      ma_nhan_vien: '',
      ten_nhan_vien: '',
      gio_vao: '',
      gio_ra: '',
      thoi_gian_lam: monthlySummary[0]?.tong_thoi_gian_thang ? 
        Number(monthlySummary[0].tong_thoi_gian_thang).toFixed(2) : '0.00',
      thoi_gian_lam_phut: monthlySummary[0]?.tong_thoi_gian_thang ? 
        Math.round(Number(monthlySummary[0].tong_thoi_gian_thang) * 60) : 0,
      trang_thai: '',
      ghi_chu: `Số ngày làm: ${monthlySummary[0]?.tong_so_ngay || 0}, Số ca: ${monthlySummary[0]?.tong_so_ca || 0}`
    });

    // Style cho dòng tổng kết
    summaryRow.font = { bold: true };
    summaryRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE3F2FD' }
    };

    // Thêm thông tin tiêu đề
    worksheet.insertRows(1, [
      [`BÁO CÁO CHẤM CÔNG THÁNG ${targetMonth}/${targetYear}`],
      [`Nhân viên: ${ten_nhan_vien} (Mã: ${ma_nhan_vien})`],
      [`Ngày xuất báo cáo: ${new Date().toLocaleDateString('vi-VN')}`],
      [] // Dòng trống
    ]);

    // Merge cells cho tiêu đề
    worksheet.mergeCells('A1:L1');
    worksheet.mergeCells('A2:L2');
    worksheet.mergeCells('A3:L3');

    // Style cho tiêu đề
    const titleRow = worksheet.getRow(1);
    titleRow.font = { bold: true, size: 16, color: { argb: 'FF1976D2' } };
    titleRow.alignment = { vertical: 'middle', horizontal: 'center' };
    titleRow.height = 30;

    const subtitleRow = worksheet.getRow(2);
    subtitleRow.font = { bold: true, size: 14 };
    subtitleRow.alignment = { vertical: 'middle', horizontal: 'center' };

    const dateRow = worksheet.getRow(3);
    dateRow.font = { italic: true };
    dateRow.alignment = { vertical: 'middle', horizontal: 'center' };

    // Điều chỉnh style cho toàn bộ dữ liệu
    for (let i = 5; i <= worksheet.rowCount; i++) {
      const row = worksheet.getRow(i);
      row.alignment = { vertical: 'middle', horizontal: 'center' };
      
      // Tô màu xen kẽ cho các dòng
      if (i >= 5 && i < worksheet.rowCount - 1) {
        if (i % 2 === 0) {
          row.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF5F5F5' }
          };
        }
      }
    }

    // Thiết lập border
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber >= 5) {
        row.eachCell((cell) => {
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          };
        });
      }
    });

    // Đặt tên file
    const filename = `BaoCaoChamCong_${ten_nhan_vien.replace(/\s+/g, '_')}_${pad(targetMonth)}_${targetYear}.xlsx`;
    
    // Thiết lập headers để download file
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(filename)}"`
    );

    // Ghi workbook vào response
    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('Lỗi xuất Excel:', error);
    res.status(500).json({ message: 'Lỗi xuất báo cáo Excel: ' + error.message });
  }
});

// ======================
// BÁO CÁO GIỜ LÀM THÁNG (theo nhân viên hiện tại)
// ======================
router.get('/monthly-hours', auth, async (req, res) => {
  const today = new Date();
  const month = Number(req.query.month || today.getMonth() + 1);
  const year = Number(req.query.year || today.getFullYear());
  const { ma_nhan_vien } = req.employee;

  try {
    // Giờ làm từng ngày
    const [daily] = await db.query(
      `SELECT ngay, COALESCE(SUM(thoi_gian_lam), 0) AS hours
       FROM lich_truc
       WHERE ma_nhan_vien = ?
         AND MONTH(ngay) = ?
         AND YEAR(ngay) = ?
         AND thoi_gian_lam IS NOT NULL
       GROUP BY ngay
       ORDER BY ngay ASC`,
      [ma_nhan_vien, month, year]
    );

    const formattedDaily = daily.map(row => ({
      ngay: row.ngay ? (typeof row.ngay === 'string' ? row.ngay.split('T')[0].split(' ')[0] : formatDateLocal(row.ngay)) : null,
      hours: Number(row.hours || 0),
    }));

    const totalHours = formattedDaily.reduce((sum, d) => sum + d.hours, 0);
    const wagePerHour = 22000;
    const totalWage = totalHours * wagePerHour;

    res.json({
      month,
      year,
      daily: formattedDaily,
      total_hours: totalHours,
      total_wage: totalWage,
      wage_per_hour: wagePerHour,
      threshold_warning: totalHours >= 80 && totalHours < 91,
      threshold_reached: totalHours >= 91,
    });
  } catch (error) {
    console.error('Lỗi lấy thống kê giờ làm tháng:', error);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// ======================
// API: CA ĐÃ ĐĂNG KÝ TRONG NGÀY (CHO NGƯỜI DÙNG HIỆN TẠI)
// ======================
router.get('/my/today-shifts', auth, async (req, res) => {
  const { ma_nhan_vien } = req.employee;
  const date = req.query.date || new Date().toISOString().split('T')[0];

  try {
    // Lấy tất cả ca trong ngày đó (mọi nhân viên), kèm thông tin trực thay (nếu có)
    // để phân biệt ca thường / ca trực thay ngay trên tab "Hôm nay"
    const [allRows] = await db.query(
      `SELECT
        lt.*,
        nv.ten_nhan_vien,
        tt.id as truc_thay_id,
        tt.lich_truc_ao_id,
        nv_thuc_hien.ten_nhan_vien as ten_nguoi_truc_thay,
        nv_thuc_hien.ma_nhan_vien as ma_nguoi_truc_thay,
        nv_dang_ky.ten_nhan_vien as ten_nguoi_duoc_truc_thay,
        nv_dang_ky.ma_nhan_vien as ma_nguoi_duoc_truc_thay,
        CASE
          WHEN tt.id IS NOT NULL AND tt.lich_truc_ao_id = lt.id THEN 'virtual'
          WHEN tt.id IS NOT NULL AND tt.lich_truc_goc_id = lt.id THEN 'original'
          ELSE 'normal'
        END as loai_lich
       FROM lich_truc lt
       JOIN nhanvien nv ON lt.nhan_vien_id = nv.id
       LEFT JOIN truc_thay tt ON (lt.id = tt.lich_truc_goc_id OR lt.id = tt.lich_truc_ao_id)
         AND tt.trang_thai IN ('active', 'pending', 'completed')
       LEFT JOIN nhanvien nv_thuc_hien ON tt.nguoi_thuc_hien_id = nv_thuc_hien.id
       LEFT JOIN nhanvien nv_dang_ky ON tt.nguoi_dang_ky_id = nv_dang_ky.id
       WHERE DATE(lt.ngay) = ?`,
      [date]
    );

    // Lọc ra các ca của chính nhân viên đang đăng nhập, BỎ QUA ca "gốc" đã được người khác
    // trực thay (loai_lich = 'original') vì người này không cần check-in/out cho ca đó nữa -
    // việc check-in/out do người trực thay thực hiện qua ca "ảo" của họ.
    const myRows = allRows.filter(row =>
      row.ma_nhan_vien === ma_nhan_vien && row.loai_lich !== 'original'
    );

    // Gom thông tin những người cùng ca
    const result = myRows.map(row => {
      const participants = allRows
        .filter(r => r.ngay === row.ngay && r.ca === row.ca && r.loai_lich !== 'original')
        .map(r => ({
          nhan_vien_id: r.nhan_vien_id,
          ma_nhan_vien: r.ma_nhan_vien,
          ten_nhan_vien: r.ten_nhan_vien,
          is_me: r.ma_nhan_vien === ma_nhan_vien
        }));

      return {
        id: row.id,
        ngay: row.ngay ? (typeof row.ngay === 'string' ? row.ngay.split('T')[0].split(' ')[0] : formatDateLocal(row.ngay)) : null,
        ca: row.ca,
        trang_thai: row.trang_thai,
        gio_vao: row.gio_vao,
        gio_ra: row.gio_ra,
        thoi_gian_lam: row.thoi_gian_lam,
        loai_lich: row.loai_lich,
        is_truc_thay: row.loai_lich === 'virtual',
        lich_truc_ao_id: row.lich_truc_ao_id,
        ten_nguoi_duoc_truc_thay: row.ten_nguoi_duoc_truc_thay,
        ma_nguoi_duoc_truc_thay: row.ma_nguoi_duoc_truc_thay,
        participants
      };
    });

    res.json(result);
  } catch (error) {
    console.error('Lỗi lấy ca hôm nay:', error);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// ======================
// API: Lấy các ca ĐÃ CHECK-IN NHƯNG CHƯA CHECK-OUT của tôi trong tháng (để nhắc quên check-out
// ngay sau khi đăng nhập, quét cả tháng chứ không chỉ hôm nay). Loại trừ ca đã bị người khác
// trực thay (đồng bộ trạng thái checked_in nhưng không phải mình có quyền check-out nó).
// ======================
router.get('/my/checked-in-shifts', auth, async (req, res) => {
  const { ma_nhan_vien } = req.employee;
  const month = Number(req.query.month) || new Date().getMonth() + 1;
  const year = Number(req.query.year) || new Date().getFullYear();

  try {
    const [rows] = await db.query(
      `SELECT
        lt.id, lt.ngay, lt.ca, lt.trang_thai, lt.gio_vao,
        tt_ao.lich_truc_ao_id
       FROM lich_truc lt
       LEFT JOIN truc_thay tt_ao ON tt_ao.lich_truc_ao_id = lt.id AND tt_ao.trang_thai = 'active'
       WHERE lt.nhan_vien_id = (SELECT id FROM nhanvien WHERE ma_nhan_vien = ?)
         AND lt.trang_thai = 'checked_in'
         AND MONTH(lt.ngay) = ? AND YEAR(lt.ngay) = ?
         AND NOT EXISTS (
           SELECT 1 FROM truc_thay tt_goc WHERE tt_goc.lich_truc_goc_id = lt.id AND tt_goc.trang_thai = 'active'
         )
       ORDER BY lt.ngay ASC, lt.ca ASC`,
      [ma_nhan_vien, month, year]
    );

    const result = rows.map(row => ({
      id: row.id,
      ngay: row.ngay ? formatDateLocal(row.ngay) : null,
      ca: row.ca,
      trang_thai: row.trang_thai,
      gio_vao: row.gio_vao,
      is_truc_thay: row.lich_truc_ao_id != null,
      lich_truc_ao_id: row.lich_truc_ao_id
    }));

    res.json(result);
  } catch (error) {
    console.error('Lỗi lấy ca quên check-out:', error);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// ======================
// ĐĂNG KÝ LỊCH TRỰC (CÓ KIỂM TRA QUÁ GIỜ)
// ======================
router.post('/schedule/register', auth, async (req, res) => {
  const { ma_nhan_vien, ten_nhan_vien } = req.employee;
  const { date, shift } = req.body;

  if (!['ca1', 'ca2', 'ca3', 'ca4'].includes(shift)) {
    return res.status(400).json({ message: 'Ca không hợp lệ' });
  }

  try {
    const now = new Date();
    const currentTime = now.toTimeString().slice(0, 5); // HH:MM
    const today = now.toISOString().split('T')[0]; // YYYY-MM-DD
    
    // Lấy thông tin ca
    const shiftInfo = {
      'ca1': { start: '07:00', end: '09:30' },
      'ca2': { start: '09:30', end: '12:30' },
      'ca3': { start: '12:30', end: '15:00' },
      'ca4': { start: '15:00', end: '17:30' }
    };
    
    const { start: shiftStart, end: shiftEnd } = shiftInfo[shift];
    
    // KIỂM TRA 1: QUÁ GIỜ ĐĂNG KÝ
    // Nếu ngày đăng ký là hôm nay và đã qua giờ bắt đầu ca
 if (date < today) {
  return res.status(400).json({ message: 'Không thể đăng ký ca trong quá khứ' });
}

// Nếu là hôm nay, kiểm tra đã quá giờ kết thúc ca chưa
if (date === today && currentTime > shiftEnd) {
  return res.status(400).json({ 
    message: `Không thể đăng ký ca này vì ca đã kết thúc lúc ${shiftEnd}` 
  });
}

    // Lấy thông tin nhân viên
    const [empRows] = await db.query('SELECT id FROM nhanvien WHERE ma_nhan_vien = ?', [ma_nhan_vien]);
    if (empRows.length === 0) {
      return res.status(400).json({ message: 'Nhân viên không tồn tại' });
    }
    const nhan_vien_id = empRows[0].id;

    // Kiểm tra đã đăng ký chưa
    const [existing] = await db.query(
      'SELECT id FROM lich_truc WHERE ngay = ? AND ca = ? AND nhan_vien_id = ?',
      [date, shift, nhan_vien_id]
    );
    
    if (existing.length > 0) {
      return res.status(400).json({ message: 'Bạn đã đăng ký ca này rồi' });
    }

    // Kiểm tra số lượng người trong ca (tối đa 6)
    const [userCount] = await db.query(
      'SELECT COUNT(*) as count FROM lich_truc WHERE ngay = ? AND ca = ?',
      [date, shift]
    );
    
    if (userCount[0].count >= 6) {
      return res.status(400).json({ message: 'Ca đã đủ số lượng người đăng ký (tối đa 6 người)' });
    }

    // Không cho đăng ký 2 ca liên tiếp trong cùng ngày.
    // Loại trừ các dòng lịch trực ẢO (được tạo ra khi mình nhận trực thay cho người
    // khác) — trực thay không tính là "tự đăng ký", nên không được phép chặn việc
    // đăng ký thêm 1 ca liền kề khác của chính mình.
    const [existingByUser] = await db.query(
      `SELECT lt.ca FROM lich_truc lt
       WHERE lt.ngay = ? AND lt.nhan_vien_id = ?
         AND NOT EXISTS (
           SELECT 1 FROM truc_thay tt WHERE tt.lich_truc_ao_id = lt.id
         )`,
      [date, nhan_vien_id]
    );

    if (existingByUser.length > 0) {
      const shiftOrder = ['ca1', 'ca2', 'ca3', 'ca4'];
      const currentIndex = shiftOrder.indexOf(shift);
      const registeredShifts = existingByUser.map(row => row.ca);

      const hasAdjacent = registeredShifts.some(regShift => {
        const regIndex = shiftOrder.indexOf(regShift);
        return Math.abs(currentIndex - regIndex) === 1;
      });

      if (hasAdjacent) {
        return res.status(400).json({ message: 'Không được đăng ký 2 ca liên tiếp trong cùng ngày' });
      }
    }

    // Không chặn đăng ký ca dù đã đạt 91h: cho phép đăng ký để người khác (chưa đạt 91h)
    // có thể đăng ký trực thay cho ca này. Việc chặn làm việc thực tế nằm ở bước check-in/check-out.
    const todayDate = new Date(date);
    const currentMonth = todayDate.getMonth() + 1;
    const currentYear = todayDate.getFullYear();

    // Thực hiện đăng ký
    const [result] = await db.query(
      'INSERT INTO lich_truc (ngay, ca, nhan_vien_id, ma_nhan_vien, ten_nhan_vien, trang_thai) VALUES (?, ?, ?, ?, ?, ?)',
      [date, shift, nhan_vien_id, ma_nhan_vien, ten_nhan_vien, 'registered']
    );

    // Lấy lại thông tin đăng ký vừa tạo với format ngày đúng
    const [newRecord] = await db.query(
      'SELECT * FROM lich_truc WHERE id = ?',
      [result.insertId]
    );

    const formattedRecord = newRecord[0] ? {
      ...newRecord[0],
      ngay: newRecord[0].ngay ? (typeof newRecord[0].ngay === 'string' ? newRecord[0].ngay.split('T')[0].split(' ')[0] : formatDateLocal(newRecord[0].ngay)) : null
    } : null;

    // Tính lại tổng giờ sau khi đăng ký để cảnh báo gần 91h
    const updatedMonthHours = await getMonthlyHours(ma_nhan_vien, currentMonth, currentYear);
    const warning = updatedMonthHours >= 80 && updatedMonthHours < 91
      ? 'Bạn đã gần đạt tới 91 giờ trong tháng'
      : null;

    res.json({ 
      id: result.insertId, 
      message: 'Đăng ký thành công',
      data: formattedRecord,
      status: 'registered',
      total_month_hours: updatedMonthHours,
      warning
    });
  } catch (error) {
    console.error('Lỗi đăng ký:', error);
    res.status(500).json({ message: 'Lỗi server: ' + error.message });
  }
});

// ======================
// CHECK-IN (CÓ KIỂM TRA CHƯA TỚI GIỜ LÀM)
// ======================
router.post('/schedule/:id/checkin', auth, async (req, res) => {
  const { ma_nhan_vien } = req.employee;
  const { id } = req.params;
  const now = new Date();
  const currentTime = now.toTimeString().slice(0, 5);
  const currentDate = now.toISOString().split('T')[0];

  try {
    const [rows] = await db.query('SELECT * FROM lich_truc WHERE id = ?', [id]);
    if (rows.length === 0) return res.status(404).json({ message: 'Không tìm thấy ca đăng ký' });
    
    const record = rows[0];
    
    // Kiểm tra quyền
    if (record.ma_nhan_vien !== ma_nhan_vien) {
      return res.status(403).json({ message: 'Bạn không có quyền check-in ca này' });
    }
    
    // Kiểm tra trạng thái
    if (record.trang_thai === 'checked_out') {
      return res.status(400).json({ message: 'Ca này đã hoàn thành' });
    }
    if (record.trang_thai === 'checked_in') {
      return res.status(400).json({ message: 'Bạn đã check-in rồi' });
    }

    // KIỂM TRA ĐÃ CÓ NGƯỜI TRỰC THAY: nếu ca này đang được người khác trực thay (đã duyệt),
    // chỉ người trực thay mới được check-in ca này, không phải người đăng ký gốc.
    const [activeSubIn] = await db.query(
      `SELECT nv.ten_nhan_vien AS performer_name
       FROM truc_thay tt JOIN nhanvien nv ON tt.nguoi_thuc_hien_id = nv.id
       WHERE tt.lich_truc_goc_id = ? AND tt.trang_thai = 'active'`,
      [id]
    );
    if (activeSubIn.length > 0) {
      return res.status(400).json({
        message: `Ca này đã được ${activeSubIn[0].performer_name} trực thay, bạn không thể tự check-in. Chỉ ${activeSubIn[0].performer_name} mới có thể check-in ca này. Khi họ hủy trực thay, bạn mới check-in được.`
      });
    }

    // KIỂM TRA GIỚI HẠN 91H/THÁNG: đã đạt tối đa thì không được check-in nữa
    const capDate = new Date(record.ngay);
    const capHours = await getMonthlyHours(ma_nhan_vien, capDate.getMonth() + 1, capDate.getFullYear());
    if (capHours >= 91) {
      return res.status(400).json({ message: 'Bạn đã đạt giới hạn tối đa 91 giờ trong tháng, không thể check-in.' });
    }

    // Lấy thông tin ca
    const shiftInfo = {
      'ca1': { start: '07:00', end: '09:30' },
      'ca2': { start: '09:30', end: '12:30' },
      'ca3': { start: '12:30', end: '15:00' },
      'ca4': { start: '15:00', end: '17:30' }
    };

    const { start: shiftStart, end: shiftEnd } = shiftInfo[record.ca] || { start: '00:00', end: '23:59' };
    const recordDate = new Date(record.ngay).toISOString().split('T')[0];

    // KIỂM TRA MỚI: CHƯA TỚI GIỜ LÀM
    // Nếu là ngày hôm nay và chưa tới giờ bắt đầu ca
    if (recordDate === currentDate && currentTime < shiftStart) {
      return res.status(400).json({ 
        message: `Chưa tới giờ làm! Check-in chỉ được thực hiện từ ${shiftStart}` 
      });
    }
    
    // KIỂM TRA QUÁ GIỜ CHECK-IN
    // Nếu là ngày hôm nay
    if (recordDate === currentDate) {
      const [endHours, endMinutes] = shiftEnd.split(':').map(Number);
      const endTimeInMinutes = endHours * 60 + endMinutes;
      
      const [currentHours, currentMinutes] = currentTime.split(':').map(Number);
      const currentTimeInMinutes = currentHours * 60 + currentMinutes;
      
      // Quá 1 giờ so với thời gian kết thúc ca
      if (currentTimeInMinutes > (endTimeInMinutes + 60)) {
        return res.status(400).json({ 
          message: `Đã quá 1 giờ so với thời gian kết thúc ca (${shiftEnd}), không thể check-in. Bạn có thể gửi yêu cầu điều chỉnh giờ.`,
          canRequestAdjustment: true,
          loai_yeu_cau: 'checkin',
          shiftEnd: shiftEnd,
          currentTime: currentTime
        });
      }
    }
    
    // Nếu là ngày trước đó (hôm qua)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    
    if (recordDate === yesterdayStr) {
      // Kiểm tra nếu đã quá 24h + 1h từ giờ kết thúc ca
      const recordDateTime = new Date(record.ngay);
      const endTime = new Date(recordDateTime);
      const [endHours, endMinutes] = shiftEnd.split(':').map(Number);
      endTime.setHours(endHours, endMinutes, 0);

      // Thời gian cho phép = thời gian kết thúc ca + 25 giờ (24h + 1h buffer)
      const allowedUntil = new Date(endTime.getTime() + (25 * 60 * 60 * 1000));

      if (now > allowedUntil) {
        return res.status(400).json({
          message: `Đã quá thời gian cho phép check-in trực tiếp (quá 24 giờ sau khi ca kết thúc). Bạn có thể gửi yêu cầu điều chỉnh giờ để admin duyệt.`,
          canRequestAdjustment: true,
          loai_yeu_cau: 'checkin',
          shiftEnd: shiftEnd,
          daysLate: 1
        });
      }
    }

    // Nếu quên check-in đã nhiều ngày (2+ ngày trước): không chặn hẳn nữa, cho phép gửi
    // yêu cầu điều chỉnh giờ để admin duyệt bổ sung, giống như luồng check-out ca quá khứ.
    if (recordDate < yesterdayStr) {
      const diffTime = Math.abs(now - new Date(recordDate));
      const daysLate = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return res.status(400).json({
        message: `Ca này đã qua ${daysLate} ngày. Vui lòng gửi yêu cầu điều chỉnh giờ check-in để admin duyệt.`,
        canRequestAdjustment: true,
        loai_yeu_cau: 'checkin',
        shiftEnd: shiftEnd,
        daysLate: daysLate
      });
    }

    await db.query(
      'UPDATE lich_truc SET trang_thai = ?, gio_vao = ?, updated_at = NOW() WHERE id = ?',
      ['checked_in', currentTime, id]
    );

    res.json({ 
      message: 'Check-in thành công', 
      status: 'checked_in', 
      time: currentTime,
      record: { ...record, trang_thai: 'checked_in', gio_vao: currentTime }
    });
  } catch (error) {
    console.error('Lỗi check-in:', error);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// ======================
// HỦY CHECK-IN (KHÔNG CẦN CHECKOUT) - dành cho trường hợp lỡ check-in nhưng không đi làm ca đó.
// Đưa ca về lại trạng thái "registered" như chưa từng check-in, để có thể check-in lại nếu vẫn đi làm.
// ======================
router.post('/schedule/:id/undo-checkin', auth, async (req, res) => {
  const { ma_nhan_vien } = req.employee;
  const { id } = req.params;

  try {
    const [rows] = await db.query('SELECT * FROM lich_truc WHERE id = ?', [id]);
    if (rows.length === 0) return res.status(404).json({ message: 'Không tìm thấy ca đăng ký' });

    const record = rows[0];

    if (record.ma_nhan_vien !== ma_nhan_vien) {
      return res.status(403).json({ message: 'Bạn không có quyền hủy check-in ca này' });
    }
    if (record.trang_thai !== 'checked_in') {
      return res.status(400).json({ message: 'Ca này chưa check-in hoặc đã check-out, không thể hủy check-in' });
    }

    await db.query(
      `UPDATE lich_truc
       SET trang_thai = 'registered', gio_vao = NULL, updated_at = NOW(),
           ghi_chu = CONCAT(COALESCE(ghi_chu, ''), ' | Đã hủy check-in (không đi làm) lúc ', NOW())
       WHERE id = ?`,
      [id]
    );

    res.json({
      message: 'Đã hủy check-in. Ca quay lại trạng thái chưa check-in, bạn có thể check-in lại nếu vẫn đi làm ca này.',
      status: 'registered'
    });
  } catch (error) {
    console.error('Lỗi hủy check-in:', error);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// ======================
// CHECK-OUT (CÓ KIỂM TRA CHƯA TỚI GIỜ LÀM) - ĐÃ SỬA
// ======================
router.post('/schedule/:id/checkout', auth, async (req, res) => {
  const { ma_nhan_vien } = req.employee;
  const { id } = req.params;
  const now = new Date();
  const currentTime = now.toTimeString().slice(0, 5);
  const currentDate = now.toISOString().split('T')[0];

  try {
    const [rows] = await db.query('SELECT * FROM lich_truc WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy ca đăng ký' });
    }
    
    const record = rows[0];
    
    // Kiểm tra quyền
    if (record.ma_nhan_vien !== ma_nhan_vien) {
      return res.status(403).json({ message: 'Bạn không có quyền check-out ca này' });
    }
    
    // Kiểm tra trạng thái
    if (record.trang_thai === 'checked_out') {
      return res.status(400).json({ message: 'Ca này đã hoàn thành' });
    }
    
    if (record.trang_thai !== 'checked_in') {
      return res.status(400).json({ message: 'Bạn cần check-in trước khi check-out' });
    }

    // KIỂM TRA ĐÃ CÓ NGƯỜI TRỰC THAY: nếu ca này đang được người khác trực thay (đã duyệt),
    // chỉ người trực thay mới được check-out ca này, không phải người đăng ký gốc.
    const [activeSubOut] = await db.query(
      `SELECT nv.ten_nhan_vien AS performer_name
       FROM truc_thay tt JOIN nhanvien nv ON tt.nguoi_thuc_hien_id = nv.id
       WHERE tt.lich_truc_goc_id = ? AND tt.trang_thai = 'active'`,
      [id]
    );
    if (activeSubOut.length > 0) {
      return res.status(400).json({
        message: `Ca này đã được ${activeSubOut[0].performer_name} trực thay, bạn không thể tự check-out. Chỉ ${activeSubOut[0].performer_name} mới có thể check-out ca này.`
      });
    }

    // KIỂM TRA GIỚI HẠN 91H/THÁNG: đã đạt tối đa thì không được check-out nữa
    const capDateOut = new Date(record.ngay);
    const capHoursOut = await getMonthlyHours(ma_nhan_vien, capDateOut.getMonth() + 1, capDateOut.getFullYear());
    if (capHoursOut >= 91) {
      return res.status(400).json({ message: 'Bạn đã đạt giới hạn tối đa 91 giờ trong tháng, không thể check-out.' });
    }

    // Lấy thông tin ca
    const shiftInfo = {
      'ca1': { start: '07:00', end: '09:30' },
      'ca2': { start: '09:30', end: '12:30' },
      'ca3': { start: '12:30', end: '15:00' },
      'ca4': { start: '15:00', end: '17:30' }
    };

    const { start: shiftStart, end: shiftEnd } = shiftInfo[record.ca] || { start: '00:00', end: '23:59' };

    // Xử lý ngày an toàn
    let recordDate;
    try {
      if (record.ngay instanceof Date) {
        recordDate = record.ngay.toISOString().split('T')[0];
      } else {
        recordDate = new Date(record.ngay).toISOString().split('T')[0];
      }
    } catch (e) {
      recordDate = currentDate;
    }
    
    // KIỂM TRA 1: CHƯA TỚI NGÀY LÀM
    if (recordDate > currentDate) {
      return res.status(400).json({ 
        message: 'Chưa tới ngày làm! Không thể check-out trước ngày làm việc' 
      });
    }
    
    // KIỂM TRA 2: CHƯA TỚI GIỜ LÀM (chỉ áp dụng nếu là cùng ngày)
    if (recordDate === currentDate && currentTime < shiftStart) {
      return res.status(400).json({ 
        message: `Chưa tới giờ làm! Check-out chỉ được thực hiện từ ${shiftStart}` 
      });
    }
    
    // TÍNH SỐ NGÀY CHÊNH LỆCH
    const diffTime = Math.abs(now - new Date(recordDate));
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    // KIỂM TRA 3: NẾU LÀ NGÀY HÔM NAY
    if (recordDate === currentDate) {
      const [endHours, endMinutes] = shiftEnd.split(':').map(Number);
      const endTimeInMinutes = endHours * 60 + endMinutes;
      
      const [currentHours, currentMinutes] = currentTime.split(':').map(Number);
      const currentTimeInMinutes = currentHours * 60 + currentMinutes;
      
      // Nếu trong giờ làm
      if (currentTimeInMinutes <= endTimeInMinutes) {
        // Check-out bình thường
        console.log('=== CHECK-OUT BÌNH THƯỜNG (cùng ngày, trong giờ) ===');
        const checkInTime = record.gio_vao ? new Date(`${currentDate}T${record.gio_vao}`) : now;
        const checkOutTime = new Date(`${currentDate}T${currentTime}`);
        const workDuration = Math.max(0, (checkOutTime - checkInTime) / (1000 * 60 * 60));

        await db.query(
          'UPDATE lich_truc SET trang_thai = ?, gio_ra = ?, thoi_gian_lam = ?, updated_at = NOW() WHERE id = ?',
          ['checked_out', currentTime, workDuration.toFixed(2), id]
        );

        // Tính tổng thời gian làm trong ngày
        const [totalWorkResult] = await db.query(
          `SELECT SUM(thoi_gian_lam) as tong_thoi_gian
           FROM lich_truc 
           WHERE nhan_vien_id = ? AND ngay = ? AND trang_thai = 'checked_out' AND thoi_gian_lam IS NOT NULL`,
          [record.nhan_vien_id, record.ngay]
        );

        return res.json({
          message: 'Check-out thành công',
          status: 'checked_out',
          workDuration: workDuration.toFixed(2),
          totalWorkTime: totalWorkResult[0]?.tong_thoi_gian || 0,
          time: currentTime,
          record: { 
            ...record, 
            trang_thai: 'checked_out', 
            gio_ra: currentTime, 
            thoi_gian_lam: workDuration.toFixed(2) 
          }
        });
      } 
      
      // Quá giờ trong ngày
      console.log('=== QUÁ GIỜ TRONG NGÀY, CHO PHÉP GỬI YÊU CẦU ===');
      return res.status(400).json({ 
        message: `Đã quá giờ kết thúc ca (${shiftEnd})`,
        canRequestAdjustment: true,
        loai_yeu_cau: 'checkout',
        shiftEnd: shiftEnd,
        daysLate: 0,
        record: record
      });
    }
    
    // KIỂM TRA 4: NẾU LÀ NGÀY QUÁ KHỨ
    if (recordDate < currentDate) {
      console.log('=== CA QUÁ KHỨ, CHO PHÉP GỬI YÊU CẦU ===');
      console.log('Số ngày trễ:', diffDays);
      return res.status(400).json({ 
        message: `Ca này đã qua ${diffDays} ngày. Vui lòng gửi yêu cầu điều chỉnh giờ check-out.`,
        canRequestAdjustment: true,
        loai_yeu_cau: 'checkout',
        shiftEnd: shiftEnd,
        daysLate: diffDays,
        record: record
      });
    }

    // Fallback (không nên xảy ra)
    return res.status(400).json({ 
      message: 'Không thể check-out',
      canRequestAdjustment: true,
      loai_yeu_cau: 'checkout'
    });
    
  } catch (error) {
    console.error('Lỗi check-out:', error);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// ======================
// LẤY TỔNG THỜI GIAN LÀM VIỆC THEO NGÀY
// ======================
router.get('/daily-summary', auth, async (req, res) => {
  const { ma_nhan_vien } = req.employee;
  const { date } = req.query; // format: YYYY-MM-DD
  
  if (!date) {
    return res.status(400).json({ message: 'Thiếu tham số ngày' });
  }

  try {
    // Lấy thông tin nhân viên
    const [empRows] = await db.query('SELECT id FROM nhanvien WHERE ma_nhan_vien = ?', [ma_nhan_vien]);
    if (empRows.length === 0) {
      return res.status(400).json({ message: 'Nhân viên không tồn tại' });
    }
    const nhan_vien_id = empRows[0].id;

    // Chi tiết các ca "thuộc về mình" trong ngày (ca thường + ca được người khác trực thay,
    // giờ đã quy đổi về mình), kèm thông tin trực thay để hiển thị rõ cho cả 2 bên.
    const [details] = await db.query(
      `SELECT
        lt.id,
        lt.ca,
        lt.gio_vao,
        lt.gio_ra,
        lt.thoi_gian_lam,
        lt.trang_thai,
        lt.created_at,
        CASE
          WHEN tt.id IS NOT NULL AND tt.lich_truc_ao_id = lt.id THEN 'virtual'
          ELSE 'normal'
        END as loai_lich,
        nv_thuc_hien.ten_nhan_vien as ten_nguoi_truc_thay,
        nv_thuc_hien.ma_nhan_vien as ma_nguoi_truc_thay
      FROM lich_truc lt
      LEFT JOIN truc_thay tt ON (tt.lich_truc_ao_id = lt.id OR tt.lich_truc_goc_id = lt.id)
        AND tt.trang_thai IN ('active', 'completed')
      LEFT JOIN nhanvien nv_thuc_hien ON tt.nguoi_thuc_hien_id = nv_thuc_hien.id
      WHERE
        (
          (
            lt.nhan_vien_id = ?
            AND NOT (tt.id IS NOT NULL AND tt.lich_truc_ao_id = lt.id)
            AND NOT (tt.id IS NOT NULL AND tt.lich_truc_goc_id = lt.id)
          )
          OR
          (tt.id IS NOT NULL AND tt.lich_truc_ao_id = lt.id AND tt.nguoi_dang_ky_id = ?)
        )
        AND DATE(lt.ngay) = ?
      ORDER BY
        CASE lt.ca
          WHEN 'ca1' THEN 1
          WHEN 'ca2' THEN 2
          WHEN 'ca3' THEN 3
          WHEN 'ca4' THEN 4
        END`,
      [nhan_vien_id, nhan_vien_id, date]
    );

    // Ca hôm nay mà MÌNH đã trực thay CHO NGƯỜI KHÁC (giờ tính cho người kia, chỉ để tham khảo)
    const [performedToday] = await db.query(
      `SELECT
        lt.id, lt.ca, lt.gio_vao, lt.gio_ra, lt.trang_thai, lt.thoi_gian_lam,
        nv_dang_ky.ten_nhan_vien as ten_nguoi_duoc_truc_thay,
        nv_dang_ky.ma_nhan_vien as ma_nguoi_duoc_truc_thay
      FROM lich_truc lt
      INNER JOIN truc_thay tt ON tt.lich_truc_ao_id = lt.id AND tt.trang_thai IN ('active', 'completed', 'pending')
      INNER JOIN nhanvien nv_dang_ky ON tt.nguoi_dang_ky_id = nv_dang_ky.id
      WHERE lt.nhan_vien_id = ?
        AND DATE(lt.ngay) = ?
      ORDER BY
        CASE lt.ca
          WHEN 'ca1' THEN 1
          WHEN 'ca2' THEN 2
          WHEN 'ca3' THEN 3
          WHEN 'ca4' THEN 4
        END`,
      [nhan_vien_id, date]
    );

    const completedDetails = details.filter(d => d.trang_thai === 'checked_out' && d.thoi_gian_lam != null);
    const soCaDaLam = completedDetails.length;
    const tongThoiGianLam = completedDetails.reduce((sum, d) => sum + (Number(d.thoi_gian_lam) || 0), 0);

    const result = {
      date: date,
      employee_id: nhan_vien_id,
      ma_nhan_vien: ma_nhan_vien,
      summary: {
        ngay: date,
        so_ca_da_lam: soCaDaLam,
        tong_thoi_gian_lam: tongThoiGianLam
      },
      details: details,
      performed_today: performedToday,
      formatted_summary: {
        ngay: date,
        so_ca_da_lam: soCaDaLam,
        tong_thoi_gian_lam: tongThoiGianLam.toFixed(2),
        tong_thoi_gian_gio: formatHours(tongThoiGianLam)
      }
    };

    res.json(result);
  } catch (error) {
    console.error('Lỗi lấy tổng thời gian:', error);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// ======================
// LẤY BÁO CÁO THỐNG KÊ THEO THÁNG
// ======================
router.get('/monthly-report', auth, async (req, res) => {
  const { ma_nhan_vien } = req.employee;
  const { month, year } = req.query;
  
  const today = new Date();
  const targetMonth = month || today.getMonth() + 1;
  const targetYear = year || today.getFullYear();

  try {
    // Lấy thông tin nhân viên
    const [empRows] = await db.query('SELECT id FROM nhanvien WHERE ma_nhan_vien = ?', [ma_nhan_vien]);
    if (empRows.length === 0) {
      return res.status(400).json({ message: 'Nhân viên không tồn tại' });
    }
    const nhan_vien_id = empRows[0].id;

    // Lấy báo cáo theo tháng (CÓ GIỜ VÀO, GIỜ RA)
    // Quy đổi chủ sở hữu: ca được người khác trực thay cho mình vẫn tính vào báo cáo này
    // (giờ tính cho mình), kèm tên người đã trực thay trong chi_tiet_ca để biết cần trả ai.
    const [report] = await db.query(
      `SELECT
        DATE(lt.ngay) as ngay,
        COUNT(*) as so_ca_da_lam,
        SUM(lt.thoi_gian_lam) as tong_thoi_gian_lam,
        GROUP_CONCAT(
          CONCAT(lt.ca, '|', lt.thoi_gian_lam, '|', COALESCE(lt.gio_vao, ''), '|', COALESCE(lt.gio_ra, ''), '|', COALESCE(nv_thuc_hien.ten_nhan_vien, ''))
          SEPARATOR ';'
        ) as chi_tiet_ca
      FROM lich_truc lt
      LEFT JOIN truc_thay tt ON (tt.lich_truc_ao_id = lt.id OR tt.lich_truc_goc_id = lt.id)
        AND tt.trang_thai IN ('active', 'completed')
      LEFT JOIN nhanvien nv_thuc_hien ON tt.nguoi_thuc_hien_id = nv_thuc_hien.id
      WHERE
        (
          (
            lt.nhan_vien_id = ?
            AND NOT (tt.id IS NOT NULL AND tt.lich_truc_ao_id = lt.id)
            AND NOT (tt.id IS NOT NULL AND tt.lich_truc_goc_id = lt.id)
          )
          OR
          (tt.id IS NOT NULL AND tt.lich_truc_ao_id = lt.id AND tt.nguoi_dang_ky_id = ?)
        )
        AND MONTH(lt.ngay) = ?
        AND YEAR(lt.ngay) = ?
        AND lt.trang_thai = 'checked_out'
        AND lt.thoi_gian_lam IS NOT NULL
      GROUP BY DATE(lt.ngay)
      ORDER BY DATE(lt.ngay) DESC`,
      [nhan_vien_id, nhan_vien_id, targetMonth, targetYear]
    );

    // Bảng trực thay: ai đã trực thay CHO MÌNH trong tháng và tổng bao nhiêu giờ -
    // để mình biết cần thanh toán lại cho ai, bao nhiêu.
    const [substitutionRows] = await db.query(
      `SELECT
        nv_thuc_hien.ten_nhan_vien as ten_nguoi_truc_thay,
        nv_thuc_hien.ma_nhan_vien as ma_nguoi_truc_thay,
        SUM(lt.thoi_gian_lam) as tong_gio,
        COUNT(*) as so_ca
      FROM lich_truc lt
      INNER JOIN truc_thay tt ON tt.lich_truc_ao_id = lt.id AND tt.trang_thai IN ('active', 'completed')
      INNER JOIN nhanvien nv_thuc_hien ON tt.nguoi_thuc_hien_id = nv_thuc_hien.id
      WHERE tt.nguoi_dang_ky_id = ?
        AND MONTH(lt.ngay) = ?
        AND YEAR(lt.ngay) = ?
        AND lt.trang_thai = 'checked_out'
        AND lt.thoi_gian_lam IS NOT NULL
      GROUP BY nv_thuc_hien.id
      ORDER BY tong_gio DESC`,
      [nhan_vien_id, targetMonth, targetYear]
    );

    // Bảng ngược lại: MÌNH đã trực thay CHO AI trong tháng và tổng bao nhiêu giờ -
    // (giờ này KHÔNG nằm trong tong_thoi_gian_thang của mình, đã được tính cho người kia)
    const [performedRows] = await db.query(
      `SELECT
        nv_dang_ky.ten_nhan_vien as ten_nguoi_duoc_truc_thay,
        nv_dang_ky.ma_nhan_vien as ma_nguoi_duoc_truc_thay,
        SUM(lt.thoi_gian_lam) as tong_gio,
        COUNT(*) as so_ca
      FROM lich_truc lt
      INNER JOIN truc_thay tt ON tt.lich_truc_ao_id = lt.id AND tt.trang_thai IN ('active', 'completed')
      INNER JOIN nhanvien nv_dang_ky ON tt.nguoi_dang_ky_id = nv_dang_ky.id
      WHERE tt.nguoi_thuc_hien_id = ?
        AND MONTH(lt.ngay) = ?
        AND YEAR(lt.ngay) = ?
        AND lt.trang_thai = 'checked_out'
        AND lt.thoi_gian_lam IS NOT NULL
      GROUP BY nv_dang_ky.id
      ORDER BY tong_gio DESC`,
      [nhan_vien_id, targetMonth, targetYear]
    );

    // Tính tổng tháng
    const monthlyTotal = report.reduce((total, day) => {
      return total + (Number(day.tong_thoi_gian_lam) || 0);
    }, 0);

    const result = {
      month: targetMonth,
      year: targetYear,
      employee_id: nhan_vien_id,
      ma_nhan_vien: ma_nhan_vien,
      daily_reports: report.map(day => ({
        ngay: day.ngay,
        so_ca_da_lam: day.so_ca_da_lam,
        tong_thoi_gian_lam: Number(day.tong_thoi_gian_lam).toFixed(2),
        chi_tiet_ca: day.chi_tiet_ca,
        formatted_time: formatHours(Number(day.tong_thoi_gian_lam))
      })),
      monthly_summary: {
        tong_so_ngay: report.length,
        tong_so_ca: report.reduce((sum, day) => sum + day.so_ca_da_lam, 0),
        tong_thoi_gian_thang: monthlyTotal.toFixed(2),
        tong_thoi_gian_thang_gio: formatHours(monthlyTotal)
      },
      substitution_summary: substitutionRows.map(row => ({
        ten_nguoi_truc_thay: row.ten_nguoi_truc_thay,
        ma_nguoi_truc_thay: row.ma_nguoi_truc_thay,
        tong_gio: Number(row.tong_gio).toFixed(2),
        so_ca: row.so_ca
      })),
      performed_substitution_summary: performedRows.map(row => ({
        ten_nguoi_duoc_truc_thay: row.ten_nguoi_duoc_truc_thay,
        ma_nguoi_duoc_truc_thay: row.ma_nguoi_duoc_truc_thay,
        tong_gio: Number(row.tong_gio).toFixed(2),
        so_ca: row.so_ca
      }))
    };

    res.json(result);
  } catch (error) {
    console.error('Lỗi lấy báo cáo tháng:', error);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// ======================
// API CHECK-IN/OUT THÔNG THƯỜNG (GIỮ NGUYÊN)
// ======================

// Hàm xác định ca làm việc
const getShift = (time) => {
  const hours = time.getHours();
  const minutes = time.getMinutes();
  
  if (hours < 9 || (hours === 9 && minutes < 30)) return 'Ca 1: 7:00 - 9:30';
  if (hours < 12 || (hours === 12 && minutes < 30)) return 'Ca 2: 9:30 - 12:30';
  if (hours < 15) return 'Ca 3: 12:30 - 15:00';
  return 'Ca 4: 15:00 - 17:30';
};

// Check-in thông thường
router.post('/checkin', auth, async (req, res) => {
  const { ma_nhan_vien, ten_nhan_vien } = req.employee;
  const now = new Date();
  const today = new Date().toISOString().split('T')[0];
  const currentTime = now.toTimeString().split(' ')[0];
  const shift = getShift(now);

  const shiftOrder = ['Ca 1: 7:00 - 9:30', 'Ca 2: 9:30 - 12:30', 'Ca 3: 12:30 - 15:00', 'Ca 4: 15:00 - 17:30'];

  try {
    const [empRows] = await db.query(
      'SELECT id FROM nhanvien WHERE ma_nhan_vien = ?',
      [ma_nhan_vien]
    );
    if (empRows.length === 0) {
      return res.status(400).json({ message: 'Nhân viên không tồn tại' });
    }
    const nhan_vien_id = empRows[0].id;

    // Kiểm tra không check-in 2 ca liên tiếp
    const [checkedShifts] = await db.query(
      'SELECT trang_thai FROM cham_cong WHERE ma_nhan_vien = ? AND ngay_cham_cong = ?',
      [ma_nhan_vien, today]
    );

    let isConsecutive = false;
    checkedShifts.forEach(row => {
      const idx = shiftOrder.indexOf(row.trang_thai);
      const currentIdx = shiftOrder.indexOf(shift);
      if (Math.abs(currentIdx - idx) === 1) {
        isConsecutive = true;
      }
    });
    if (isConsecutive) {
      return res.status(400).json({ message: 'Không được check-in 2 ca liên tiếp trong ngày.' });
    }

    // Thêm bản ghi check-in
    await db.query(
      'INSERT INTO cham_cong (nhan_vien_id, ma_nhan_vien, ten_nhan_vien, ngay_cham_cong, gio_vao, trang_thai) VALUES (?, ?, ?, ?, ?, ?)',
      [nhan_vien_id, ma_nhan_vien, ten_nhan_vien, today, currentTime, shift]
    );

    res.json({ message: `Check-in thành công vào ${shift}` });
  } catch (error) {
    console.error('Lỗi check-in:', error);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// Check-out thông thường
router.post('/checkout', auth, async (req, res) => {
  const { ma_nhan_vien } = req.employee;
  const now = new Date();
  const today = new Date().toISOString().split('T')[0];
  const currentTime = now.toTimeString().split(' ')[0];
  const shift = getShift(now);

  const shiftOrder = ['Ca 1: 7:00 - 9:30', 'Ca 2: 9:30 - 12:30', 'Ca 3: 12:30 - 15:00', 'Ca 4: 15:00 - 17:30'];

  try {
    const [rows] = await db.query(
      'SELECT * FROM cham_cong WHERE ma_nhan_vien = ? AND ngay_cham_cong = ? AND trang_thai = ? AND gio_ra IS NULL',
      [ma_nhan_vien, today, shift]
    );
    if (rows.length === 0) {
      return res.status(400).json({ message: 'Bạn chưa check-in ca này hoặc đã check-out.' });
    }

    // Kiểm tra không check-out 2 ca liên tiếp
    const [checkedShifts] = await db.query(
      'SELECT trang_thai FROM cham_cong WHERE ma_nhan_vien = ? AND ngay_cham_cong = ? AND gio_ra IS NOT NULL',
      [ma_nhan_vien, today]
    );
    
    let isConsecutive = false;
    checkedShifts.forEach(row => {
      const idx = shiftOrder.indexOf(row.trang_thai);
      const currentIdx = shiftOrder.indexOf(shift);
      if (Math.abs(currentIdx - idx) === 1) {
        isConsecutive = true;
      }
    });
    if (isConsecutive) {
      return res.status(400).json({ message: 'Không được check-out 2 ca liên tiếp trong ngày.' });
    }

    const checkInTime = new Date(`${today}T${rows[0].gio_vao}`);
    const checkOutTime = new Date(`${today}T${currentTime}`);
    const workDuration = (checkOutTime - checkInTime) / (1000 * 60 * 60);

    await db.query(
      'UPDATE cham_cong SET gio_ra = ?, thoi_gian_lam = ?, updated_at = NOW() WHERE id = ?',
      [currentTime, workDuration, rows[0].id]
    );

    res.json({ 
      message: `Check-out thành công từ ${shift}`,
      workDuration: workDuration.toFixed(2)
    });
  } catch (error) {
    console.error('Lỗi check-out:', error);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// ======================
// CÁC API KHÁC
// ======================

// Lịch sử chấm công cá nhân
router.get('/history', auth, async (req, res) => {
  const { ma_nhan_vien } = req.employee;

  try {
    const [records] = await db.query(
      'SELECT * FROM cham_cong WHERE ma_nhan_vien = ? ORDER BY ngay_cham_cong DESC, created_at DESC',
      [ma_nhan_vien]
    );
    res.json(records);
  } catch (error) {
    console.error('Lỗi lấy lịch sử:', error);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// Lịch sử chấm công theo tháng/năm
router.get('/history/month', auth, async (req, res) => {
  const { ma_nhan_vien } = req.employee;
  const { month, year } = req.query;
  try {
    const [records] = await db.query(
      'SELECT * FROM cham_cong WHERE ma_nhan_vien = ? AND MONTH(ngay_cham_cong) = ? AND YEAR(ngay_cham_cong) = ? ORDER BY ngay_cham_cong DESC',
      [ma_nhan_vien, month, year]
    );
    res.json(records);
  } catch (error) {
    console.error('Lỗi lấy lịch sử theo tháng:', error);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// API: Lấy thông tin chi tiết của một ca đăng ký
router.get('/schedule/:id', auth, async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await db.query('SELECT * FROM lich_truc WHERE id = ?', [id]);
    if (rows.length === 0) return res.status(404).json({ message: 'Không tìm thấy ca đăng ký' });
    res.json(rows[0]);
  } catch (error) {
    console.error('Lỗi lấy chi tiết ca:', error);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// API: Hủy đăng ký (nếu chưa check-in)
router.delete('/schedule/:id/cancel', auth, async (req, res) => {
  const { ma_nhan_vien } = req.employee;
  const { id } = req.params;

  try {
    const [rows] = await db.query('SELECT * FROM lich_truc WHERE id = ?', [id]);
    if (rows.length === 0) return res.status(404).json({ message: 'Không tìm thấy ca đăng ký' });
    
    const record = rows[0];
    
    if (record.ma_nhan_vien !== ma_nhan_vien) {
      return res.status(403).json({ message: 'Bạn không có quyền hủy ca này' });
    }
    
    if (record.trang_thai !== 'registered') {
      return res.status(400).json({ message: 'Chỉ được hủy khi chưa check-in' });
    }

    // KIỂM TRA ĐÃ CÓ NGƯỜI TRỰC THAY: nếu ca này đang được người khác trực thay (đã duyệt),
    // không cho hủy đăng ký - phải chờ người trực thay hủy trực thay trước.
    const [activeSubCancel] = await db.query(
      `SELECT nv.ten_nhan_vien AS performer_name
       FROM truc_thay tt JOIN nhanvien nv ON tt.nguoi_thuc_hien_id = nv.id
       WHERE tt.lich_truc_goc_id = ? AND tt.trang_thai = 'active'`,
      [id]
    );
    if (activeSubCancel.length > 0) {
      return res.status(400).json({
        message: `Ca này đang được ${activeSubCancel[0].performer_name} trực thay, bạn không thể hủy đăng ký. Khi ${activeSubCancel[0].performer_name} hủy trực thay, bạn mới hủy đăng ký được.`
      });
    }

    await db.query('START TRANSACTION');

    try {
      // Xóa lịch gốc
      await db.query('DELETE FROM lich_truc WHERE id = ?', [id]);

      // Xóa các lịch ảo và bản ghi trực thay liên quan
      await db.query(
        `DELETE lt_ao, tt 
         FROM lich_truc lt_ao 
         INNER JOIN truc_thay tt ON lt_ao.id = tt.lich_truc_ao_id 
         WHERE tt.lich_truc_goc_id = ?`,
        [id]
      );

      await db.query('COMMIT');

      res.json({ message: 'Hủy đăng ký thành công' });
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Lỗi hủy đăng ký:', error);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// Hàm chuyển đổi giờ thập phân sang giờ:phút
function formatHours(decimalHours) {
  if (!decimalHours || decimalHours === 0) return "0 giờ 0 phút";
  
  const hours = Math.floor(decimalHours);
  const minutes = Math.round((decimalHours - hours) * 60);
  
  return `${hours} giờ ${minutes} phút`;
}
// ======================
// API: CẬP NHẬT DỮ LIỆU KHUÔN MẶT
// ======================
// ======================
// API: CẬP NHẬT DỮ LIỆU KHUÔN MẶT (ĐÃ TĂNG ĐỘ KHÓ)
// ======================
// ======================
// API ĐĂNG KÝ KHUÔN MẶT – NHIỀU ẢNH
// ======================
router.post('/register-face', auth, async (req, res) => {
  try {
    let { images } = req.body;   // images là mảng các base64
    if (!images || !Array.isArray(images) || images.length === 0) {
      return res.status(400).json({ success: false, message: 'Cần gửi ít nhất một ảnh' });
    }

    const employeeId = req.employee.id;
    const embeddings = [];

    for (let i = 0; i < images.length; i++) {
      const base64Data = images[i].replace(/^data:image\/\w+;base64,/, '');
      const imageBuffer = Buffer.from(base64Data, 'base64');

      // Trích xuất embedding
      const descriptor = await getFaceEmbedding(imageBuffer);
      if (!descriptor) {
        return res.status(400).json({ 
          success: false, 
          message: `Không trích xuất được khuôn mặt từ ảnh thứ ${i+1}` 
        });
      }

      // Kiểm tra chất lượng ảnh (variance) – giữ nguyên như cũ
      const mean = descriptor.reduce((s, v) => s + v, 0) / descriptor.length;
      const variance = descriptor.reduce((s, v) => s + (v - mean) ** 2, 0) / descriptor.length;
      if (variance < 0.01) {
        return res.status(400).json({ 
          success: false, 
          message: `Ảnh thứ ${i+1} quá mờ hoặc khuôn mặt không rõ` 
        });
      }

      embeddings.push(Array.from(descriptor));
    }

    // Lưu mảng embeddings dưới dạng JSON
    await db.query(
      'UPDATE nhanvien SET face_embedding = ? WHERE id = ?',
      [JSON.stringify(embeddings), employeeId]
    );

    res.json({ success: true, message: 'Đăng ký khuôn mặt thành công' });
  } catch (error) {
    console.error('Lỗi register-face:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
});

// ======================
// API ĐĂNG NHẬP BẰNG KHUÔN MẶT (NGƯỠNG 0.9)
// ======================
// router.post('/login-face', async (req, res) => {
//   try {
//     console.log('=== LOGIN-FACE called ===');
//     const { image } = req.body;
//     if (!image) {
//       return res.status(400).json({ success: false, message: 'Thiếu ảnh' });
//     }
//     const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
//     const imageBuffer = Buffer.from(base64Data, 'base64');
//     console.log('Image buffer size:', imageBuffer.length);

//     const descriptor = await getFaceEmbedding(imageBuffer);
//     if (!descriptor) {
//       return res.status(400).json({ success: false, message: 'Không trích xuất được khuôn mặt từ ảnh' });
//     }

//     const [rows] = await db.query(
//       `SELECT id, ma_nhan_vien, ten_nhan_vien, face_embedding, is_admin, 
//               face_login_enabled, face_code, face_code_enabled
//        FROM nhanvien WHERE face_embedding IS NOT NULL`
//     );
//     console.log(`Found ${rows.length} users with face data`);

//     let bestMatch = null;
//     let bestScore = 0.4; // khởi tạo thấp
//     for (const row of rows) {
//       let storedDescriptor;
//       try {
//         if (typeof row.face_embedding === 'string') {
//           storedDescriptor = JSON.parse(row.face_embedding);
//         } else if (row.face_embedding && typeof row.face_embedding === 'object') {
//           storedDescriptor = row.face_embedding;
//         } else continue;
//         if (!Array.isArray(storedDescriptor) || storedDescriptor.length !== 128) continue;
//         const score = cosineSimilarity(descriptor, storedDescriptor);
//         console.log(`So sánh với ${row.ma_nhan_vien} (${row.ten_nhan_vien}): score = ${score.toFixed(4)}`);
//         if (score > bestScore) {
//           bestScore = score;
//           bestMatch = row;
//         }
//       } catch (parseErr) {
//         console.error(`Lỗi parse face_embedding cho ID ${row.id}:`, parseErr.message);
//       }
//     }

//     console.log(`Best score: ${bestScore.toFixed(4)}`);
//     if (bestMatch && bestScore > 0.9) {  // NGƯỠNG CAO 0.9
//       if (!bestMatch.face_login_enabled) {
//         return res.status(403).json({ 
//           success: false, 
//           message: 'Tính năng đăng nhập bằng khuôn mặt đã bị vô hiệu hóa. Vui lòng liên hệ quản trị viên.' 
//         });
//       }

//       // Nếu yêu cầu nhập code
//       if (bestMatch.face_code_enabled && bestMatch.face_code) {
//         return res.json({
//           success: true,
//           requireCode: true,
//           userId: bestMatch.id,
//           message: 'Vui lòng nhập mã xác thực để hoàn tất đăng nhập.'
//         });
//       }

//       // Đăng nhập thành công
//       const token = jwt.sign(
//         {
//           id: bestMatch.id,
//           ma_nhan_vien: bestMatch.ma_nhan_vien,
//           ten_nhan_vien: bestMatch.ten_nhan_vien,
//         },
//         process.env.JWT_SECRET,
//         { expiresIn: '24h' }
//       );
//       res.json({
//         success: true,
//         data: {
//           token,
//           user: {
//             id: bestMatch.id,
//             ma_nhan_vien: bestMatch.ma_nhan_vien,
//             ten_nhan_vien: bestMatch.ten_nhan_vien,
//             is_admin: bestMatch.is_admin,
//           },
//         },
//       });
//     } else {
//       res.status(401).json({ success: false, message: 'Không nhận diện được khuôn mặt' });
//     }
//   } catch (error) {
//     console.error('Lỗi login-face:', error);
//     res.status(500).json({ success: false, message: 'Lỗi server: ' + error.message });
//   }
// });

// ======================
// API ĐĂNG NHẬP BẰNG KHUÔN MẶT
// ======================
router.post('/login-face', async (req, res) => {
  try {
    console.log('=== LOGIN-FACE ===');
    const { image } = req.body;
    if (!image) return res.status(400).json({ success: false, message: 'Thiếu ảnh' });

    const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
    const imageBuffer = Buffer.from(base64Data, 'base64');
    console.log('Image buffer size:', imageBuffer.length);

    const descriptor = await getFaceEmbedding(imageBuffer);
    if (!descriptor) {
      console.log('❌ Không trích xuất được embedding');
      return res.status(400).json({ success: false, message: 'Không nhận diện được khuôn mặt' });
    }
    console.log('✅ Descriptor extracted, length:', descriptor.length);

    const [rows] = await db.query(
      `SELECT id, ma_nhan_vien, ten_nhan_vien, face_embedding, is_admin, is_active,
              face_login_enabled, face_code, face_code_enabled
       FROM nhanvien WHERE face_embedding IS NOT NULL`
    );
    console.log(`📋 Tìm thấy ${rows.length} người có dữ liệu khuôn mặt`);

    // Ngưỡng khoảng cách Euclidean - đúng chuẩn hiệu chuẩn gốc của Face Recognition Net
    // (dlib/face-api.js): cùng người thường < 0.6, khác người thường > 0.6. Chọn 0.5 (chặt
    // hơn mức mặc định) để giảm rủi ro nhận nhầm người khác.
    const FACE_MATCH_THRESHOLD = 0.5;
    let bestMatch = null;
    let bestDistance = Infinity;

    for (const row of rows) {
      let storedEmbeddings;
      try {
        // KIỂM TRA TẠI ĐÂY: Nếu đã là mảng (do DB tự parse) thì lấy luôn, nếu là chuỗi mới parse
        if (typeof row.face_embedding === 'string') {
          storedEmbeddings = JSON.parse(row.face_embedding);
        } else {
          storedEmbeddings = row.face_embedding;
        }

        if (!Array.isArray(storedEmbeddings)) {
          console.log(`⚠️ User ${row.ma_nhan_vien}: face_embedding không phải mảng`);
          continue;
        }

        console.log(`👤 User ${row.ma_nhan_vien}: có ${storedEmbeddings.length} embeddings`);
        for (let idx = 0; idx < storedEmbeddings.length; idx++) {
          const emb = storedEmbeddings[idx];
          const distance = euclideanDistance(descriptor, emb);
          console.log(`   🔍 So sánh với embedding ${idx+1}: distance = ${distance.toFixed(4)}`);
          if (distance < bestDistance) {
            bestDistance = distance;
            bestMatch = row;
          }
        }
      } catch(e) {
        console.error(`Lỗi parse face_embedding cho user ${row.ma_nhan_vien}:`, e.message);
      }
    }

    console.log(`🏆 Best distance: ${bestDistance.toFixed(4)}, match: ${bestMatch ? bestMatch.ma_nhan_vien : 'none'}`);
    if (bestMatch && bestDistance < FACE_MATCH_THRESHOLD) {
      if (bestMatch.is_active === 0) {
        return res.status(403).json({ success: false, message: 'Tài khoản của bạn đã bị vô hiệu hóa. Vui lòng liên hệ quản trị viên.' });
      }
      if (!bestMatch.face_login_enabled) {
        return res.status(403).json({ success: false, message: 'Tính năng đăng nhập bằng khuôn mặt đã bị vô hiệu hóa.' });
      }
      if (bestMatch.face_code_enabled && bestMatch.face_code) {
        return res.json({ success: true, requireCode: true, userId: bestMatch.id, message: 'Vui lòng nhập mã xác thực.' });
      }
      const token = jwt.sign(
        { id: bestMatch.id, ma_nhan_vien: bestMatch.ma_nhan_vien, ten_nhan_vien: bestMatch.ten_nhan_vien },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );
      return res.json({ success: true, data: { token, user: { id: bestMatch.id, ma_nhan_vien: bestMatch.ma_nhan_vien, ten_nhan_vien: bestMatch.ten_nhan_vien, is_admin: bestMatch.is_admin } } });
    } else {
      return res.status(401).json({ success: false, message: 'Không nhận diện được khuôn mặt' });
    }
  } catch (error) {
    console.error('Lỗi login-face:', error);
    res.status(500).json({ success: false, message: 'Lỗi server: ' + error.message });
  }
});

// API: KIỂM TRA NHÂN VIÊN ĐÃ ĐĂNG KÝ KHUÔN MẶT CHƯA
// ======================
router.get('/check-face-registered', auth, async (req, res) => {
  try {
    const employeeId = req.employee.id;
    const [rows] = await db.query('SELECT face_embedding FROM nhanvien WHERE id = ?', [employeeId]);
    const registered = rows[0]?.face_embedding !== null;
    res.json({ success: true, registered });
  } catch (error) {
    console.error('Lỗi check-face-registered:', error);
    res.status(500).json({ success: false, message: 'Lỗi server: ' + error.message });
  }
});

// ======================
// XÁC MINH MÃ CODE SAU KHI NHẬN DIỆN KHUÔN MẶT
// ======================
router.post('/login-face-verify', async (req, res) => {
  try {
    const { userId, code } = req.body;
    if (!userId || !code) {
      return res.status(400).json({ success: false, message: 'Thiếu thông tin xác thực' });
    }

    const [rows] = await db.query(
      `SELECT id, ma_nhan_vien, ten_nhan_vien, is_admin, is_active, face_code, face_code_enabled
       FROM nhanvien WHERE id = ?`,
      [userId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Người dùng không tồn tại' });
    }
    const user = rows[0];

    if (user.is_active === 0) {
      return res.status(403).json({ success: false, message: 'Tài khoản của bạn đã bị vô hiệu hóa. Vui lòng liên hệ quản trị viên.' });
    }

    if (!user.face_code_enabled || !user.face_code) {
      return res.status(400).json({ success: false, message: 'Mã xác thực không được yêu cầu' });
    }

    if (code !== user.face_code) {
      return res.status(401).json({ success: false, message: 'Mã xác thực không đúng' });
    }

    const token = jwt.sign(
      {
        id: user.id,
        ma_nhan_vien: user.ma_nhan_vien,
        ten_nhan_vien: user.ten_nhan_vien,
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          ma_nhan_vien: user.ma_nhan_vien,
          ten_nhan_vien: user.ten_nhan_vien,
          is_admin: user.is_admin,
        },
      },
    });
  } catch (error) {
    console.error('Lỗi login-face-verify:', error);
    res.status(500).json({ success: false, message: 'Lỗi server: ' + error.message });
  }
});

module.exports = router;