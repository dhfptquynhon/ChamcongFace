const path = require('path');
// Nạp file .env từ thư mục gốc của backend (cha của thư mục utils)
require('dotenv').config({ path: path.join(__dirname, '../.env') }); 
const mysql = require('mysql2/promise');

// --- CẤU HÌNH DATABASE ---
const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE, 
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// --- BIẾN CACHE TRONG RAM ---
let cachedEmployees = null; 

/**
 * Kiểm tra kết nối và nạp dữ liệu vào RAM ngay khi khởi động
 */
(async () => {
    try {
        const conn = await pool.getConnection();
        console.log(`✅ [db.js] Kết nối thành công Database: ${process.env.DB_DATABASE}`);
        conn.release();
        
        // Nạp dữ liệu vào cache lần đầu
        await refreshEmployeeCache();
    } catch (err) {
        console.error("❌ [db.js] Lỗi khởi động:", err.message);
    }
})();

/**
 * Làm mới bộ nhớ đệm (Cache) từ Database
 * Gọi hàm này mỗi khi có nhân viên mới đăng ký khuôn mặt
 */
async function refreshEmployeeCache() {
    try {
        const dbName = process.env.DB_DATABASE || 'chamcong';
        const [rows] = await pool.query(
            `SELECT ma_nhan_vien, face_embedding FROM ${dbName}.nhanvien WHERE face_embedding IS NOT NULL`
        );
        
        cachedEmployees = rows.map(row => ({
            ma_nhan_vien: row.ma_nhan_vien,
            embedding: typeof row.face_embedding === 'string' ? JSON.parse(row.face_embedding) : row.face_embedding
        }));
        
        console.log(`💾 [Cache] Đã nạp ${cachedEmployees.length} mẫu khuôn mặt vào RAM.`);
    } catch (error) {
        console.error("❌ [Cache] Lỗi khi làm mới cache:", error.message);
    }
}

/**
 * Tính khoảng cách Euclidean
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
 * Tìm nhân viên gần nhất (Sử dụng Cache RAM)
 * Tốc độ so khớp sẽ cực nhanh vì không phải đợi Database
 */
async function findNearestEmployee(queryEmbedding, threshold = 0.6) {
    const startTime = Date.now();
    
    // Nếu cache trống, nạp lại dữ liệu
    if (!cachedEmployees) {
        await refreshEmployeeCache();
    }

    if (!cachedEmployees || cachedEmployees.length === 0) return null;

    let bestMatch = null;
    let minDist = Infinity;

    // So sánh trực tiếp trong mảng RAM
    for (const emp of cachedEmployees) {
        const dist = euclideanDistance(queryEmbedding, emp.embedding);
        
        if (dist < minDist && dist < threshold) {
            minDist = dist;
            bestMatch = emp.ma_nhan_vien;
        }
    }
    
    const duration = (Date.now() - startTime) / 1000;
    console.log(`⏱️ So khớp RAM xong trong: ${duration}s | Kết quả: ${bestMatch || 'N/A'}`);
    
    return bestMatch;
}

/**
 * Lưu embedding và làm mới cache
 */
async function saveEmbedding(ma_nhan_vien, embedding) {
    const dbName = process.env.DB_DATABASE || 'chamcong';
    const embeddingStr = JSON.stringify(Array.from(embedding));
    
    await pool.query(
        `UPDATE ${dbName}.nhanvien SET face_embedding = ? WHERE ma_nhan_vien = ?`,
        [embeddingStr, ma_nhan_vien]
    );
    
    // Cập nhật lại Cache ngay lập tức để người mới đăng ký có thể login luôn
    await refreshEmployeeCache();
}

function query(sql, params) {
    return pool.query(sql, params);
}

module.exports = {
    pool,
    query,
    findNearestEmployee,
    saveEmbedding,
    refreshEmployeeCache // Xuất hàm này để dùng khi cần cập nhật dữ liệu thủ công
};