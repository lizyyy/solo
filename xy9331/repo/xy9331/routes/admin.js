const express = require('express');
const db = require('../database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const path = require('path');
const fs = require('fs');

const router = express.Router();

function parseTime(timeStr) {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours + minutes / 60;
}

function getMonthDates(year, month) {
  const dates = [];
  const daysInMonth = new Date(year, month, 0).getDate();
  
  for (let i = 1; i <= daysInMonth; i++) {
    const date = new Date(year, month - 1, i);
    dates.push(date.toISOString().split('T')[0]);
  }
  return dates;
}

router.get('/work-hours', authenticateToken, requireAdmin, (req, res) => {
  const { year, month } = req.query;
  
  const now = new Date();
  const targetYear = year ? parseInt(year) : now.getFullYear();
  const targetMonth = month ? parseInt(month) : now.getMonth() + 1;
  
  const monthDates = getMonthDates(targetYear, targetMonth);
  const startDate = monthDates[0];
  const endDate = monthDates[monthDates.length - 1];

  const query = `
    SELECT s.*, u.name as user_name, u.id as user_id
    FROM shifts s
    LEFT JOIN users u ON s.user_id = u.id
    WHERE s.date >= ? AND s.date <= ?
    ORDER BY u.name, s.date, s.start_time
  `;

  db.all(query, [startDate, endDate], (err, shifts) => {
    if (err) {
      return res.status(500).json({ error: '数据库错误' });
    }
    
    const userWorkHours = {};
    shifts.forEach(shift => {
      const userId = shift.user_id;
      if (!userWorkHours[userId]) {
        userWorkHours[userId] = {
          user_id: userId,
          user_name: shift.user_name,
          total_hours: 0,
          shifts: []
        };
      }
      
      const startHours = parseTime(shift.start_time);
      const endHours = parseTime(shift.end_time);
      const hours = endHours - startHours;
      
      userWorkHours[userId].total_hours += hours;
      userWorkHours[userId].shifts.push({
        date: shift.date,
        start_time: shift.start_time,
        end_time: shift.end_time,
        shift_type: shift.shift_type,
        hours: hours.toFixed(2)
      });
    });
    
    const result = Object.values(userWorkHours).sort((a, b) => a.user_name.localeCompare(b.user_name));
    
    res.json({ 
      workHours: result,
      year: targetYear,
      month: targetMonth
    });
  });
});

router.get('/export/work-hours', authenticateToken, requireAdmin, (req, res) => {
  const { year, month } = req.query;
  
  const now = new Date();
  const targetYear = year ? parseInt(year) : now.getFullYear();
  const targetMonth = month ? parseInt(month) : now.getMonth() + 1;
  
  const monthDates = getMonthDates(targetYear, targetMonth);
  const startDate = monthDates[0];
  const endDate = monthDates[monthDates.length - 1];

  const query = `
    SELECT s.*, u.name as user_name, u.id as user_id
    FROM shifts s
    LEFT JOIN users u ON s.user_id = u.id
    WHERE s.date >= ? AND s.date <= ?
    ORDER BY u.name, s.date, s.start_time
  `;

  db.all(query, [startDate, endDate], (err, shifts) => {
    if (err) {
      return res.status(500).json({ error: '数据库错误' });
    }
    
    const records = [];
    let currentUser = null;
    let userTotalHours = 0;
    
    const sortedShifts = [...shifts].sort((a, b) => {
      if (a.user_name !== b.user_name) return a.user_name.localeCompare(b.user_name);
      return a.date.localeCompare(b.date);
    });
    
    sortedShifts.forEach(shift => {
      const startHours = parseTime(shift.start_time);
      const endHours = parseTime(shift.end_time);
      const hours = endHours - startHours;
      
      records.push({
        员工姓名: shift.user_name,
        日期: shift.date,
        上班时间: shift.start_time,
        下班时间: shift.end_time,
        班次类型: shift.shift_type,
        工时: hours.toFixed(2)
      });
    });
    
    const summaryRecords = [];
    const userTotals = {};
    
    sortedShifts.forEach(shift => {
      const startHours = parseTime(shift.start_time);
      const endHours = parseTime(shift.end_time);
      const hours = endHours - startHours;
      
      if (!userTotals[shift.user_name]) {
        userTotals[shift.user_name] = { name: shift.user_name, total: 0 };
      }
      userTotals[shift.user_name].total += hours;
    });
    
    Object.values(userTotals).forEach(u => {
      summaryRecords.push({
        员工姓名: u.name,
        日期: '',
        上班时间: '',
        下班时间: '',
        班次类型: '合计',
        工时: u.total.toFixed(2)
      });
    });
    
    const allRecords = [...records, ...summaryRecords];
    
    const csvWriter = createCsvWriter({
      path: path.join(__dirname, `../temp/work-hours-${targetYear}-${targetMonth}.csv`),
      header: [
        { id: '员工姓名', title: '员工姓名' },
        { id: '日期', title: '日期' },
        { id: '上班时间', title: '上班时间' },
        { id: '下班时间', title: '下班时间' },
        { id: '班次类型', title: '班次类型' },
        { id: '工时', title: '工时(小时)' }
      ]
    });
    
    const tempDir = path.join(__dirname, '../temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    csvWriter.writeRecords(allRecords)
      .then(() => {
        const filePath = path.join(__dirname, `../temp/work-hours-${targetYear}-${targetMonth}.csv`);
        res.download(filePath, `工时报表-${targetYear}年${targetMonth}月.csv`, (err) => {
          if (err) {
            console.error('下载失败:', err);
          }
          fs.unlink(filePath, (unlinkErr) => {
            if (unlinkErr) console.error('删除临时文件失败:', unlinkErr);
          });
        });
      })
      .catch(err => {
        res.status(500).json({ error: '生成CSV失败' });
      });
  });
});

router.get('/statistics', authenticateToken, requireAdmin, (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  
  db.serialize(() => {
    const results = {};
    
    db.get('SELECT COUNT(*) as count FROM users WHERE role = "employee"', (err, row) => {
      results.employeeCount = row?.count || 0;
      
      db.get('SELECT COUNT(*) as count FROM shifts WHERE date = ?', [today], (err, row) => {
        results.todayShifts = row?.count || 0;
        
        db.get('SELECT COUNT(*) as count FROM swap_requests WHERE status = "pending_approval"', (err, row) => {
          results.pendingApprovals = row?.count || 0;
          
          db.get('SELECT COUNT(*) as count FROM swap_requests WHERE status = "completed"', (err, row) => {
            results.completedSwaps = row?.count || 0;
            
            res.json({ statistics: results });
          });
        });
      });
    });
  });
});

module.exports = router;
