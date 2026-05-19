import * as XLSX from 'xlsx';

export const exportToExcel = (data, filename = 'report.xlsx') => {
  // Tạo workbook
  const wb = XLSX.utils.book_new();
  
  // Tạo worksheet từ data
  const ws = XLSX.utils.json_to_sheet(data);
  
  // Thêm worksheet vào workbook
  XLSX.utils.book_append_sheet(wb, ws, "Báo cáo");
  
  // Xuất file
  XLSX.writeFile(wb, filename);
};

export const exportAttendanceReport = (data, month, year) => {
  const formattedData = data.map((item, index) => ({
    'STT': index + 1,
    'Mã nhân viên': item.ma_nhan_vien,
    'Tên nhân viên': item.ten_nhan_vien,
    'Số ngày làm': item.work_days_count || 0,
    'Số ca đã làm': item.total_shifts || 0,
    'Tổng giờ làm': parseFloat(item.total_hours || 0).toFixed(2),
    'Tỷ lệ hoàn thành (%)': parseFloat(item.completion_rate || 0).toFixed(2),
    'Ngày làm việc': item.work_days || 'Không có'
  }));
  
  exportToExcel(formattedData, `BaoCaoChamCong_Thang${month}_${year}.xlsx`);
};