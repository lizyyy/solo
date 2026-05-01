const express = require('express');
const router = express.Router();
const bookingService = require('../services/bookingService');

router.get('/rooms', (req, res) => {
  try {
    const rooms = bookingService.getRooms();
    res.json({ success: true, data: rooms });
  } catch (error) {
    console.error('获取房间列表失败:', error);
    res.status(500).json({ success: false, error: '获取房间列表失败' });
  }
});

router.post('/reservations', (req, res) => {
  try {
    const { roomId, userName, userPhone, date, startTime, endTime, peopleCount, purpose } = req.body;
    
    const result = bookingService.createReservation({
      roomId: parseInt(roomId),
      userName,
      userPhone,
      date,
      startTime,
      endTime,
      peopleCount: parseInt(peopleCount),
      purpose
    });
    
    if (result.success) {
      res.status(201).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('创建预约失败:', error);
    res.status(500).json({ success: false, error: '创建预约失败' });
  }
});

router.get('/reservations', (req, res) => {
  try {
    const { roomId, date, status } = req.query;
    const filters = {};
    
    if (roomId) filters.roomId = parseInt(roomId);
    if (date) filters.date = date;
    if (status) filters.status = status;
    
    const reservations = bookingService.getReservations(filters);
    res.json({ success: true, data: reservations });
  } catch (error) {
    console.error('获取预约列表失败:', error);
    res.status(500).json({ success: false, error: '获取预约列表失败' });
  }
});

router.get('/reservations/:id', (req, res) => {
  try {
    const reservation = bookingService.getReservationById(parseInt(req.params.id));
    
    if (!reservation) {
      return res.status(404).json({ success: false, error: '预约不存在' });
    }
    
    res.json({ success: true, data: reservation });
  } catch (error) {
    console.error('获取预约详情失败:', error);
    res.status(500).json({ success: false, error: '获取预约详情失败' });
  }
});

router.post('/reservations/:id/cancel', (req, res) => {
  try {
    const { operator } = req.body;
    const result = bookingService.cancelReservation(
      parseInt(req.params.id),
      operator || 'user'
    );
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('取消预约失败:', error);
    res.status(500).json({ success: false, error: '取消预约失败' });
  }
});

router.get('/statistics', (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const today = new Date();
    const defaultStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const defaultEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    
    const start = startDate || defaultStart.toISOString().split('T')[0];
    const end = endDate || defaultEnd.toISOString().split('T')[0];
    
    const stats = bookingService.getStatistics(start, end);
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('获取统计数据失败:', error);
    res.status(500).json({ success: false, error: '获取统计数据失败' });
  }
});

router.get('/export/csv', (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const today = new Date();
    const defaultStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const defaultEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    
    const start = startDate || defaultStart.toISOString().split('T')[0];
    const end = endDate || defaultEnd.toISOString().split('T')[0];
    
    const csv = bookingService.exportToCSV(start, end);
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=reservations_${start}_${end}.csv`);
    
    res.send('\ufeff' + csv);
  } catch (error) {
    console.error('导出CSV失败:', error);
    res.status(500).json({ success: false, error: '导出CSV失败' });
  }
});

router.get('/check-availability', (req, res) => {
  try {
    const { roomId, date, startTime, endTime } = req.query;
    
    if (!roomId || !date || !startTime || !endTime) {
      return res.status(400).json({ 
        success: false, 
        error: '缺少必要参数：roomId, date, startTime, endTime' 
      });
    }
    
    const conflicts = bookingService.getConflictingReservations(
      parseInt(roomId),
      date,
      startTime,
      endTime
    );
    
    res.json({
      success: true,
      data: {
        available: conflicts.length === 0,
        conflicts: conflicts
      }
    });
  } catch (error) {
    console.error('检查可用性失败:', error);
    res.status(500).json({ success: false, error: '检查可用性失败' });
  }
});

module.exports = router;
