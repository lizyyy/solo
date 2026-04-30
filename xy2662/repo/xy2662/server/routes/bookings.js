const express = require('express');
const router = express.Router();
const { get, all, run, checkTimeConflict, addAuditLog } = require('../database');

const STATUS_TRANSITIONS = {
  pending: ['deposited', 'refunded'],
  deposited: ['verified', 'refunded'],
  verified: [],
  refunded: []
};

const STATUS_LABELS = {
  pending: '待收取',
  deposited: '已收取',
  verified: '已核销',
  refunded: '已退款'
};

function validateBookingData(data) {
  const errors = [];
  
  if (!data.customer_name || data.customer_name.trim() === '') {
    errors.push('客户姓名不能为空');
  }
  
  if (!data.phone || data.phone.trim() === '') {
    errors.push('联系电话不能为空');
  }
  
  if (!data.studio || data.studio.trim() === '') {
    errors.push('棚位不能为空');
  }
  
  if (!data.booking_date) {
    errors.push('预约日期不能为空');
  }
  
  if (!data.start_time) {
    errors.push('开始时间不能为空');
  }
  
  if (!data.end_time) {
    errors.push('结束时间不能为空');
  }
  
  if (data.deposit_amount === undefined || data.deposit_amount === null || isNaN(data.deposit_amount)) {
    errors.push('押金金额必须是有效数字');
  }
  
  if (data.start_time && data.end_time && data.start_time >= data.end_time) {
    errors.push('开始时间必须早于结束时间');
  }
  
  return errors;
}

router.get('/', async (req, res) => {
  try {
    const { date, studio, status } = req.query;
    let sql = 'SELECT * FROM bookings WHERE 1=1';
    let params = [];

    if (date) {
      sql += ' AND booking_date = ?';
      params.push(date);
    }

    if (studio) {
      sql += ' AND studio = ?';
      params.push(studio);
    }

    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }

    sql += ' ORDER BY booking_date DESC, start_time ASC';

    const bookings = await all(sql, params);
    res.json(bookings);
  } catch (error) {
    console.error('获取预约列表失败:', error);
    res.status(500).json({ error: '获取预约列表失败' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const booking = await get('SELECT * FROM bookings WHERE id = ?', [id]);
    
    if (!booking) {
      return res.status(404).json({ error: '预约不存在' });
    }

    res.json(booking);
  } catch (error) {
    console.error('获取预约详情失败:', error);
    res.status(500).json({ error: '获取预约详情失败' });
  }
});

router.post('/', async (req, res) => {
  try {
    const {
      customer_name,
      phone,
      studio,
      booking_date,
      start_time,
      end_time,
      deposit_amount,
      note
    } = req.body;

    const errors = validateBookingData(req.body);
    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }

    const conflict = await checkTimeConflict(studio, booking_date, start_time, end_time);
    if (conflict.conflict) {
      return res.status(400).json({
        error: '时间冲突',
        message: `棚位 ${studio} 在 ${booking_date} ${start_time}-${end_time} 已被预约`,
        conflictingBooking: conflict.existingBooking
      });
    }

    const result = await run(`
      INSERT INTO bookings (
        customer_name, phone, studio, booking_date, 
        start_time, end_time, deposit_amount, status, note
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)
    `, [
      customer_name, phone, studio, booking_date,
      start_time, end_time, parseFloat(deposit_amount), note || ''
    ]);

    await addAuditLog(
      result.lastID,
      'create',
      null,
      'pending',
      `新建预约 - 客户: ${customer_name}, 棚位: ${studio}, 时间: ${booking_date} ${start_time}-${end_time}`
    );

    const newBooking = await get('SELECT * FROM bookings WHERE id = ?', [result.lastID]);
    res.status(201).json(newBooking);
  } catch (error) {
    console.error('创建预约失败:', error);
    res.status(500).json({ error: '创建预约失败' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const existingBooking = await get('SELECT * FROM bookings WHERE id = ?', [id]);
    
    if (!existingBooking) {
      return res.status(404).json({ error: '预约不存在' });
    }

    const {
      customer_name,
      phone,
      studio,
      booking_date,
      start_time,
      end_time,
      deposit_amount,
      note
    } = req.body;

    const errors = validateBookingData(req.body);
    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }

    const conflict = await checkTimeConflict(studio, booking_date, start_time, end_time, parseInt(id));
    if (conflict.conflict) {
      return res.status(400).json({
        error: '时间冲突',
        message: `棚位 ${studio} 在 ${booking_date} ${start_time}-${end_time} 已被预约`,
        conflictingBooking: conflict.existingBooking
      });
    }

    await run(`
      UPDATE bookings SET 
        customer_name = ?, phone = ?, studio = ?, booking_date = ?,
        start_time = ?, end_time = ?, deposit_amount = ?, note = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      customer_name, phone, studio, booking_date,
      start_time, end_time, parseFloat(deposit_amount), note || '',
      id
    ]);

    await addAuditLog(
      id,
      'update',
      null,
      null,
      `编辑预约 - 客户: ${customer_name}, 棚位: ${studio}, 时间: ${booking_date} ${start_time}-${end_time}`
    );

    const updatedBooking = await get('SELECT * FROM bookings WHERE id = ?', [id]);
    res.json(updatedBooking);
  } catch (error) {
    console.error('更新预约失败:', error);
    res.status(500).json({ error: '更新预约失败' });
  }
});

router.put('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, note = '' } = req.body;

    const validStatuses = ['pending', 'deposited', 'verified', 'refunded'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: '无效的状态值' });
    }

    const existingBooking = await get('SELECT * FROM bookings WHERE id = ?', [id]);
    if (!existingBooking) {
      return res.status(404).json({ error: '预约不存在' });
    }

    if (existingBooking.status === 'refunded' || existingBooking.status === 'verified') {
      return res.status(400).json({ error: '已核销或已退款的预约无法变更状态' });
    }

    const allowedTransitions = STATUS_TRANSITIONS[existingBooking.status] || [];
    if (!allowedTransitions.includes(status) && status !== existingBooking.status) {
      return res.status(400).json({
        error: '状态变更不允许',
        currentStatus: existingBooking.status,
        targetStatus: status,
        allowedTransitions
      });
    }

    if (existingBooking.status !== status) {
      await run('UPDATE bookings SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [status, id]);

      let action = '';
      let auditNote = note;
      
      switch (status) {
        case 'deposited':
          action = 'deposit';
          auditNote = auditNote || `收取押金 ¥${existingBooking.deposit_amount}`;
          break;
        case 'verified':
          action = 'verify';
          auditNote = auditNote || `核销预约，押金 ¥${existingBooking.deposit_amount} 已确认`;
          break;
        case 'refunded':
          action = 'refund';
          auditNote = auditNote || `退回押金 ¥${existingBooking.deposit_amount}`;
          break;
        default:
          action = 'status_change';
      }

      await addAuditLog(id, action, existingBooking.status, status, auditNote);
    }

    const updatedBooking = await get('SELECT * FROM bookings WHERE id = ?', [id]);
    res.json(updatedBooking);
  } catch (error) {
    console.error('更新预约状态失败:', error);
    res.status(500).json({ error: '更新预约状态失败' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const existingBooking = await get('SELECT * FROM bookings WHERE id = ?', [id]);
    
    if (!existingBooking) {
      return res.status(404).json({ error: '预约不存在' });
    }

    await addAuditLog(
      id,
      'delete',
      existingBooking.status,
      null,
      `删除预约 - 客户: ${existingBooking.customer_name}, 棚位: ${existingBooking.studio}`
    );

    await run('DELETE FROM bookings WHERE id = ?', [id]);
    
    res.json({ message: '预约已删除', id });
  } catch (error) {
    console.error('删除预约失败:', error);
    res.status(500).json({ error: '删除预约失败' });
  }
});

module.exports = router;
