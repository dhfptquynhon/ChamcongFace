// routes/auth.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../models/db');
const auth = require('../middleware/auth');
const faceUtils = require('../utils/face');
const dbUtils = require('../utils/db');

/**
 * Tính toán khoảng cách Euclidean giữa 2 vector khuôn mặt
 * Threshold khuyến nghị: 0.45 - 0.5
 */
function calculateEuclideanDistance(v1, v2) {
    if (!Array.isArray(v1) || !Array.isArray(v2) || v1.length !== v2.length) {
        return Infinity;
    }
    return Math.sqrt(v1.reduce((sum, value, index) => {
        const diff = value - v2[index];
        return sum + diff * diff;
    }, 0));
}

// ==========================================
// 1. ĐĂNG NHẬP (PASSWORD)
// ==========================================
router.post('/login', async (req, res) => {
    try {
        const { ma_nhan_vien, password } = req.body;

        if (!ma_nhan_vien || !password) {
            return res.status(400).json({ 
                success: false, 
                message: 'Vui lòng nhập mã nhân viên và mật khẩu' 
            });
        }

        const [employees] = await db.query(
            'SELECT * FROM nhanvien WHERE ma_nhan_vien = ?', 
            [ma_nhan_vien]
        );

        if (employees.length === 0) {
            return res.status(401).json({ 
                success: false, 
                message: 'Mã nhân viên hoặc mật khẩu không đúng' 
            });
        }

        const employee = employees[0];
        const isMatch = await bcrypt.compare(password, employee.password);

        if (!isMatch) {
            return res.status(401).json({ 
                success: false, 
                message: 'Mã nhân viên hoặc mật khẩu không đúng' 
            });
        }

        const token = jwt.sign(
            { 
                id: employee.id, 
                ma_nhan_vien: employee.ma_nhan_vien,
                ten_nhan_vien: employee.ten_nhan_vien
            },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '8h' }
        );

        res.json({ 
            success: true,
            message: 'Đăng nhập thành công',
            token,
            employee: {
                id: employee.id,
                ma_nhan_vien: employee.ma_nhan_vien,
                ten_nhan_vien: employee.ten_nhan_vien,
                is_admin: employee.is_admin === 1 || employee.is_admin === true,
                // Trả về true nếu đã có dữ liệu khuôn mặt, ngược lại là false
                face_registered: !!employee.face_embedding 
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, message: 'Lỗi server' });
    }
});

// ==========================================
// 2. ĐĂNG KÝ NHÂN VIÊN MỚI (CHỈ ADMIN)
// ==========================================
router.post('/register', async (req, res) => {
    try {
        const { ma_nhan_vien, ten_nhan_vien, password, is_admin } = req.body;

        if (!ma_nhan_vien || !ten_nhan_vien || !password) {
            return res.status(400).json({ success: false, message: 'Thiếu thông tin bắt buộc' });
        }

        const [existing] = await db.query('SELECT id FROM nhanvien WHERE ma_nhan_vien = ?', [ma_nhan_vien]);
        if (existing.length > 0) {
            return res.status(400).json({ success: false, message: 'Mã nhân viên đã tồn tại' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        await db.query(
            'INSERT INTO nhanvien (ma_nhan_vien, ten_nhan_vien, password, is_admin) VALUES (?, ?, ?, ?)',
            [ma_nhan_vien, ten_nhan_vien, hashedPassword, is_admin ? 1 : 0]
        );

        res.status(201).json({ success: true, message: 'Đăng ký nhân viên thành công' });
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ success: false, message: 'Lỗi server' });
    }
});

// ==========================================
// 3. ĐĂNG KÝ/CẬP NHẬT KHUÔN MẶT QUA ẢNH (BASE64)
// ==========================================
router.post('/register-face', auth, async (req, res) => {
  try {
    const { image } = req.body;
    const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
    const imageBuffer = Buffer.from(base64Data, 'base64');
    
    // Thêm log kích thước ảnh
    console.log('Image size:', imageBuffer.length, 'bytes');
    console.log('Approx dimensions:', Math.sqrt(imageBuffer.length / 3), 'x', Math.sqrt(imageBuffer.length / 3));
    const descriptor = await getFaceEmbedding(imageBuffer);
        
        // Trích xuất vector từ ảnh bằng AI ở Backend
        const faceEmbedding = await faceUtils.getFaceEmbedding(imageBuffer);

        if (!faceEmbedding) {
            return res.status(400).json({ 
                success: false, 
                message: 'Không nhận diện được khuôn mặt. Vui lòng thử lại với ảnh rõ nét hơn.' 
            });
        }

        // Lưu vào DB
        await dbUtils.saveEmbedding(req.employee.ma_nhan_vien, faceEmbedding);

        res.json({ success: true, message: 'Cập nhật khuôn mặt thành công!' });
    } catch (error) {
        console.error('Register face error:', error);
        res.status(500).json({ success: false, message: 'Lỗi server khi xử lý khuôn mặt' });
    }
});

// ==========================================
// 4. ĐĂNG NHẬP BẰNG KHUÔN MẶT
// ==========================================
router.post('/login-face', async (req, res) => {
    try {
        let { face_embedding, image } = req.body;

        // Nếu client gửi ảnh thay vì vector
        if (!face_embedding && image) {
            const base64Data = image.includes(',') ? image.split(',')[1] : image;
            const imageBuffer = Buffer.from(base64Data, 'base64');
            face_embedding = await faceUtils.getFaceEmbedding(imageBuffer);
        }

        if (!face_embedding || !Array.isArray(face_embedding)) {
            return res.status(400).json({ success: false, message: 'Dữ liệu khuôn mặt không hợp lệ' });
        }

        // Lấy tất cả nhân viên có dữ liệu mặt
        const [users] = await db.query(
            'SELECT id, ma_nhan_vien, ten_nhan_vien, face_embedding, is_admin FROM nhanvien WHERE face_embedding IS NOT NULL'
        );

        let matchUser = null;
        const threshold = 0.45; // Ngưỡng nhận diện (càng thấp càng khắt khe)

        for (const user of users) {
            const savedEmbedding = JSON.parse(user.face_embedding);
            const distance = calculateEuclideanDistance(face_embedding, savedEmbedding);
            if (distance < threshold) {
                matchUser = user;
                break;
            }
        }

        if (!matchUser) {
            return res.status(401).json({ success: false, message: 'Không nhận diện được khuôn mặt trong hệ thống' });
        }

        const token = jwt.sign(
            {
                id: matchUser.id,
                ma_nhan_vien: matchUser.ma_nhan_vien,
                ten_nhan_vien: matchUser.ten_nhan_vien
            },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '24h' }
        );

        res.json({
            success: true,
            token,
            employee: {
                id: matchUser.id,
                ma_nhan_vien: matchUser.ma_nhan_vien,
                ten_nhan_vien: matchUser.ten_nhan_vien,
                is_admin: matchUser.is_admin === 1 || matchUser.is_admin === true,
                face_registered: true
            }
        });
    } catch (error) {
        console.error('Login face error:', error);
        res.status(500).json({ success: false, message: 'Lỗi xử lý đăng nhập' });
    }
});

// ==========================================
// 5. LẤY THÔNG TIN ME (CHECK TOKEN)
// ==========================================
router.get('/me', auth, async (req, res) => {
    try {
        const [employees] = await db.query(
            'SELECT id, ma_nhan_vien, ten_nhan_vien, is_admin, face_embedding FROM nhanvien WHERE ma_nhan_vien = ?',
            [req.employee.ma_nhan_vien]
        );

        if (employees.length === 0) {
            return res.status(404).json({ success: false, message: 'Không thấy nhân viên' });
        }

        const employee = employees[0];
        res.json({ 
            success: true, 
            employee: {
                id: employee.id,
                ma_nhan_vien: employee.ma_nhan_vien,
                ten_nhan_vien: employee.ten_nhan_vien,
                is_admin: employee.is_admin === 1 || employee.is_admin === true,
                face_registered: !!employee.face_embedding
            }
        });
    } catch (error) {
        res.status(401).json({ success: false, message: 'Xác thực thất bại' });
    }
});

module.exports = router;