const path = require('path');
// Luôn trỏ thẳng về file .env ở thư mục gốc của backend để tránh lỗi undefined
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mysql = require('mysql2/promise');

// Khởi tạo Pool kết nối
const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE, // 'chamcong'
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Kiểm tra kết nối ngay khi khởi động
(async () => {
  try {
    const conn = await pool.getConnection();
    const [rows] = await conn.query('SELECT DATABASE() as db');
    console.log(`✅ [db.js] Đã kết nối Database: ${rows[0].db || 'Chưa chọn'} | Thread ID: ${conn.threadId}`);
    conn.release();
  } catch (err) {
    console.error('❌ [db.js] Lỗi kết nối Database:', err.message);
  }
})();

/**
 * Lấy tất cả embedding từ DB
 * Giải pháp: Thêm tên database trực tiếp vào câu lệnh SQL để tránh lỗi No database selected
 */
async function getAllEmbeddings() {
  try {
    // Ép dùng 'chamcong.nhanvien' để chắc chắn không bị lỗi ER_NO_DB_ERROR
    const [rows] = await pool.query(
      'SELECT ma_nhan_vien, face_embedding FROM chamcong.nhanvien WHERE face_embedding IS NOT NULL'
    );
    
    return rows.map(row => ({
      ma_nhan_vien: row.ma_nhan_vien,
      embedding: typeof row.face_embedding === 'string' ? JSON.parse(row.face_embedding) : row.face_embedding
    }));
  } catch (error) {
    console.error("❌ Lỗi getAllEmbeddings:", error.message);
    throw error;
  }
}

/**
 * Tính khoảng cách Euclidean giữa hai embedding (mảng 128 số)
 */
function euclideanDistance(emb1, emb2) {
  if (!emb1 || !emb2 || emb1.length !== emb2.length) return Infinity;
  let sum = 0;
  for (let i = 0; i < emb1.length; i++) {
    const diff = emb1[i] - emb2[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

/**
 * Tìm nhân viên có khuôn mặt khớp nhất
 * Threshold mặc định 0.6 - 0.7 cho độ chính xác tốt
 */
async function findNearestEmployee(queryEmbedding, threshold = 0.7) {
  console.log("--- BẮT ĐẦU SO KHỚP KHUÔN MẶT ---");
  const employees = await getAllEmbeddings();
  
  if (!employees || employees.length === 0) {
    console.log("⚠️ Không có dữ liệu khuôn mặt nào trong Database.");
    return null;
  }

  let bestMatch = null;
  let minDist = Infinity;

  for (const emp of employees) {
    try {
      let dbEmb = emp.embedding;
      const dist = euclideanDistance(queryEmbedding, dbEmb);
      
      // Log để debug (có thể xóa khi chạy thực tế)
      console.log(`Kiểm tra NV: ${emp.ma_nhan_vien} | Dist: ${dist.toFixed(4)}`);

      if (dist < minDist && dist < threshold) {
        minDist = dist;
        bestMatch = emp.ma_nhan_vien;
      }
    } catch (e) {
      console.error(`Lỗi xử lý NV ${emp.ma_nhan_vien}:`, e.message);
    }
  }

  console.log(`=> Kết quả: ${bestMatch || 'KHÔNG KHỚP'} (Dist: ${minDist.toFixed(4)})`);
  return bestMatch;
}

/**
 * Lưu embedding khi nhân viên đăng ký khuôn mặt mới
 */
async function saveEmbedding(ma_nhan_vien, embedding) {
  try {
    const embeddingStr = JSON.stringify(Array.from(embedding));
    await pool.query(
      'UPDATE chamcong.nhanvien SET face_embedding = ? WHERE ma_nhan_vien = ?',
      [embeddingStr, ma_nhan_vien]
    );
    console.log(`✅ Đã lưu embedding cho nhân viên: ${ma_nhan_vien}`);
  } catch (error) {
    console.error("❌ Lỗi saveEmbedding:", error.message);
    throw error;
  }
}

// Hàm hỗ trợ query chung
async function query(sql, params) {
  return pool.query(sql, params);
}

module.exports = {
  pool,
  query,
  getAllEmbeddings,
  findNearestEmployee,
  saveEmbedding
};