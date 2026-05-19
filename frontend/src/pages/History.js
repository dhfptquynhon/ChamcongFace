import React, { useState, useEffect, useContext } from 'react';
import { Box, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material';
import AuthContext from '../context/AuthContext';
import axios from 'axios';

import { TextField, Button, Grid } from '@mui/material';

const History = () => {
  const { auth } = useContext(AuthContext);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const today = new Date();
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [year, setYear] = useState(today.getFullYear());

  useEffect(() => {
    const fetchHistory = async () => {
      try {
          const response = await axios.get(
            `http://localhost:5000/api/attendance/history/month?month=${month}&year=${year}`,
            {
              headers: {
                Authorization: `Bearer ${auth.token}`
              }
            }
          );
          setRecords(response.data);
      } catch (err) {
        setError(err.response?.data?.message || 'Lỗi khi tải lịch sử');
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
    }, [auth.token, month, year]);

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Lịch sử chấm công
      </Typography>

        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid item>
            <TextField
              label="Tháng"
              type="number"
              value={month}
              onChange={e => setMonth(Number(e.target.value))}
              inputProps={{ min: 1, max: 12 }}
              size="small"
              sx={{ width: 100 }}
            />
          </Grid>
          <Grid item>
            <TextField
              label="Năm"
              type="number"
              value={year}
              onChange={e => setYear(Number(e.target.value))}
              inputProps={{ min: 2020, max: 2100 }}
              size="small"
              sx={{ width: 120 }}
            />
          </Grid>
        </Grid>
      
      {loading ? (
        <Typography>Đang tải...</Typography>
      ) : error ? (
        <Typography color="error">{error}</Typography>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Ngày</TableCell>
                <TableCell>Thứ</TableCell>
                <TableCell>Giờ vào</TableCell>
                <TableCell>Giờ ra</TableCell>
                <TableCell>Ca làm việc</TableCell>
                <TableCell>Thời gian làm (giờ)</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {records.map((record) => {
                // Tính thứ từ ngày
                const days = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
                const dayOfWeek = record.ngay_cham_cong ? days[new Date(record.ngay_cham_cong).getDay()] : '--';
                return (
                  <TableRow key={record.id}>
                    <TableCell>{record.ngay_cham_cong}</TableCell>
                    <TableCell>{dayOfWeek}</TableCell>
                    <TableCell>{record.gio_vao || '--'}</TableCell>
                    <TableCell>{record.gio_ra || '--'}</TableCell>
                    <TableCell>{record.trang_thai || '--'}</TableCell>
                    <TableCell>{record.thoi_gian_lam ? record.thoi_gian_lam.toFixed(2) : '--'}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
};

export default History;