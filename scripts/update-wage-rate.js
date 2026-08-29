#!/usr/bin/env node
/**
 * Đổi đơn giá lương theo giờ ở TẤT CẢ các nơi trong dự án CHAMCONGFACE cùng lúc.
 *
 * Cách chạy (đứng ở thư mục gốc dự án, nơi có backend/ và frontend/):
 *   node scripts/update-wage-rate.js 25000
 *
 * Script tự dò đơn giá HIỆN TẠI đang dùng trong code (không cần bạn nhớ số cũ
 * là bao nhiêu), rồi thay bằng số mới ở đúng 14 vị trí đã biết trong 4 file:
 *   - backend/routes/attendance.js
 *   - frontend/src/components/ScheduleBoard.js
 *   - frontend/src/pages/AdminHistory.js
 *   - frontend/src/pages/AdminDashboard.js
 *
 * Xem chi tiết từng vị trí trong file DonGiaLuong_ChamCongFace.docx đi kèm.
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..');

const TARGET_FILES = [
  'backend/routes/attendance.js',
  'frontend/src/components/ScheduleBoard.js',
  'frontend/src/pages/AdminHistory.js',
  'frontend/src/pages/AdminDashboard.js',
];

// Số lần thay THÀNH CÔNG mong đợi ở mỗi file (số dạng số + số dạng chữ "xx.xxxđ"),
// dùng để cảnh báo nếu code đã đổi khác so với lúc viết script này.
const EXPECTED_COUNTS = {
  'backend/routes/attendance.js': { number: 2, text: 0 },
  'frontend/src/components/ScheduleBoard.js': { number: 4, text: 1 },
  'frontend/src/pages/AdminHistory.js': { number: 5, text: 1 },
  'frontend/src/pages/AdminDashboard.js': { number: 0, text: 1 },
};

function formatVnd(n) {
  // 25000 -> "25.000" (chèn dấu chấm mỗi 3 chữ số, kiểu Việt Nam)
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function detectCurrentRate() {
  const backendPath = path.join(PROJECT_ROOT, 'backend/routes/attendance.js');
  const content = fs.readFileSync(backendPath, 'utf8');
  const m = content.match(/hourlyRate\s*=\s*parseFloat\(rate\)\s*\|\|\s*(\d+)/);
  if (m) return Number(m[1]);

  const m2 = content.match(/wagePerHour\s*=\s*(\d+)/);
  if (m2) return Number(m2[1]);

  throw new Error(
    'Không tự dò được đơn giá hiện tại trong backend/routes/attendance.js. ' +
    'Có thể code đã thay đổi cấu trúc — mở file DonGiaLuong_ChamCongFace.docx để sửa tay, ' +
    'hoặc chạy: node scripts/update-wage-rate.js <rate_moi> --old <rate_cu>'
  );
}

function main() {
  const args = process.argv.slice(2);
  const newRate = Number(args[0]);

  if (!args[0] || !Number.isInteger(newRate) || newRate <= 0) {
    console.error('Cách dùng: node scripts/update-wage-rate.js <don_gia_moi>');
    console.error('Ví dụ:    node scripts/update-wage-rate.js 25000');
    process.exit(1);
  }

  // Cho phép ép số cũ thủ công nếu việc tự dò thất bại: --old 22000
  const oldFlagIndex = args.indexOf('--old');
  const oldRate = oldFlagIndex !== -1 ? Number(args[oldFlagIndex + 1]) : detectCurrentRate();

  if (!Number.isInteger(oldRate) || oldRate <= 0) {
    console.error('Không xác định được đơn giá cũ hợp lệ.');
    process.exit(1);
  }

  if (oldRate === newRate) {
    console.log(`Đơn giá mới (${newRate}) giống hệt đơn giá hiện tại — không có gì để đổi.`);
    process.exit(0);
  }

  const oldText = formatVnd(oldRate) + 'đ';
  const newText = formatVnd(newRate) + 'đ';
  const numberRegex = new RegExp(`\\b${oldRate}\\b`, 'g');
  // escape dấu chấm trong "22.000đ" trước khi đưa vào RegExp
  const textRegex = new RegExp(oldText.replace(/\./g, '\\.'), 'g');

  console.log(`Đổi đơn giá: ${formatVnd(oldRate)}đ  ->  ${formatVnd(newRate)}đ`);
  console.log('');

  let totalReplacements = 0;
  let hadWarning = false;

  for (const relPath of TARGET_FILES) {
    const fullPath = path.join(PROJECT_ROOT, relPath);
    if (!fs.existsSync(fullPath)) {
      console.warn(`⚠️  Không tìm thấy file: ${relPath} — bỏ qua.`);
      hadWarning = true;
      continue;
    }

    const original = fs.readFileSync(fullPath, 'utf8');

    const numberMatches = (original.match(numberRegex) || []).length;
    const textMatches = (original.match(textRegex) || []).length;

    const updated = original
      .replace(numberRegex, String(newRate))
      .replace(textRegex, newText);

    fs.writeFileSync(fullPath, updated, 'utf8');

    const expected = EXPECTED_COUNTS[relPath] || { number: '?', text: '?' };
    const numberFlag = numberMatches !== expected.number ? '  (khác số mong đợi, kiểm tra lại)' : '';
    const textFlag = textMatches !== expected.text ? '  (khác số mong đợi, kiểm tra lại)' : '';
    if (numberFlag || textFlag) hadWarning = true;

    console.log(`✔ ${relPath}`);
    console.log(`   - dạng số (${oldRate} -> ${newRate}): ${numberMatches} chỗ${numberFlag}`);
    console.log(`   - dạng chữ (${oldText} -> ${newText}): ${textMatches} chỗ${textFlag}`);

    totalReplacements += numberMatches + textMatches;
  }

  console.log('');
  console.log(`Tổng cộng: ${totalReplacements} chỗ đã được thay trên ${TARGET_FILES.length} file.`);
  if (hadWarning) {
    console.log('');
    console.log('⚠️  Có ít nhất 1 file có số lượng thay thế KHÁC với dự kiến khi viết script này.');
    console.log('   Không có nghĩa là sai — có thể code đã được sửa thêm sau này.');
    console.log('   Nên mở "git diff" xem lại từng chỗ trước khi commit, để chắc chắn không đổi nhầm.');
  } else {
    console.log('Khớp đúng số lượng dự kiến ở mọi file.');
  }
  console.log('');
  console.log('Bước tiếp theo: xem "git diff" để kiểm tra lại, rồi commit + đẩy code lên server.');
  console.log('(Xem chi tiết trong file DonGiaLuong_ChamCongFace.docx, mục "Cập nhật lên hệ thống")');
}

main();
