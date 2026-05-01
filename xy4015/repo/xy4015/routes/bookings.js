const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { validateBooking, canCancelBooking } = require('../utils/validators');

router.get('/', (req, res) => {
  const { member_id, schedule_id, status } = req.query;
  
  let query = `
    SELECT 
      b.*,
      m.name as member_name,
      m.phone as member_phone,
      s.date,
      s.start_time,
      s.end_time,
      c.name as course_name,
      co.name as coach_name
    FROM bookings b
    JOIN members m ON b.member_id = m.id
    JOIN schedules s ON b.schedule_id = s.id
    JOIN courses c ON s.course_id = c.id
    JOIN coaches co ON s.coach_id = co.id
    WHERE 1=1
  `;
  
  const params = [];
  
  if (member_id) {
    query += ` AND b.member_id = ?`;
    params.push(member_id);
  }
  
  if (schedule_id) {
    query += ` AND b.schedule_id = ?`;
    params.push(schedule_id);
  }
  
  if (status) {
    query += ` AND b.status = ?`;
    params.push(status);
  }
  
  query += ` ORDER BY s.date DESC, s.start_time DESC`;
  
  db.all(query, params, (err, rows) => {
    if (err) {
      console.error('获取预约列表失败:', err);
      res.status(500).json({ error: '获取预约列表失败' });
      return;
    }
    res.json(rows);
  });
});

router.get('/:id', (req, res) => {
  const { id } = req.params;
  
  db.get(
    `SELECT 
      b.*,
      m.name as member_name,
      m.phone as member_phone,
      s.date,
      s.start_time,
      s.end_time,
      c.name as course_name,
      co.name as coach_name
    FROM bookings b
    JOIN members m ON b.member_id = m.id
    JOIN schedules s ON b.schedule_id = s.id
    JOIN courses c ON s.course_id = c.id
    JOIN coaches co ON s.coach_id = co.id
    WHERE b.id = ?`,
    [id],
    (err, booking) => {
      if (err) {
        console.error('获取预约信息失败:', err);
        res.status(500).json({ error: '获取预约信息失败' });
        return;
      }
      
      if (!booking) {
        res.status(404).json({ error: '预约不存在' });
        return;
      }
      
      res.json(booking);
    }
  );
});

router.post('/', async (req, res) => {
  try {
    const errors = await validateBooking(req.body);
    
    if (errors.length > 0) {
      res.status(400).json({ errors });
      return;
    }
    
    const { member_id, schedule_id } = req.body;
    
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      
      db.run(
        `INSERT INTO bookings (member_id, schedule_id, status, is_no_show) VALUES (?, ?, 'booked', 0)`,
        [member_id, schedule_id],
        function (err) {
          if (err) {
            db.run('ROLLBACK');
            console.error('创建预约失败:', err);
            res.status(500).json({ error: '创建预约失败' });
            return;
          }
          
          const bookingId = this.lastID;
          
          db.run(
            `UPDATE schedules SET booked_count = booked_count + 1 WHERE id = ?`,
            [schedule_id],
            (err) => {
              if (err) {
                db.run('ROLLBACK');
                console.error('更新排班预约数失败:', err);
                res.status(500).json({ error: '创建预约失败' });
                return;
              }
              
              db.run(
                `UPDATE members SET remaining_sessions = remaining_sessions - 1 WHERE id = ?`,
                [member_id],
                (err) => {
                  if (err) {
                    db.run('ROLLBACK');
                    console.error('扣减会员课时失败:', err);
                    res.status(500).json({ error: '创建预约失败' });
                    return;
                  }
                  
                  db.run('COMMIT', (err) => {
                    if (err) {
                      console.error('提交事务失败:', err);
                      res.status(500).json({ error: '创建预约失败' });
                      return;
                    }
                    
                    res.status(201).json({
                      id: bookingId,
                      member_id,
                      schedule_id,
                      status: 'booked'
                    });
                  });
                }
              );
            }
          );
        }
      );
    });
  } catch (err) {
    console.error('创建预约失败:', err);
    res.status(500).json({ error: '创建预约失败' });
  }
});

router.post('/:id/cancel', (req, res) => {
  const { id } = req.params;
  const currentTime = new Date();
  
  db.get(
    `SELECT 
      b.*,
      s.date,
      s.start_time,
      s.end_time,
      s.capacity,
      s.booked_count
    FROM bookings b
    JOIN schedules s ON b.schedule_id = s.id
    WHERE b.id = ? AND b.status = 'booked'`,
    [id],
    (err, booking) => {
      if (err) {
        console.error('获取预约信息失败:', err);
        res.status(500).json({ error: '获取预约信息失败' });
        return;
      }
      
      if (!booking) {
        res.status(404).json({ error: '预约不存在或已取消' });
        return;
      }
      
      const cancelCheck = canCancelBooking(booking, currentTime);
      
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        
        if (cancelCheck.canCancel) {
          db.run(
            `UPDATE bookings SET status = 'canceled', canceled_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [id],
            (err) => {
              if (err) {
                db.run('ROLLBACK');
                console.error('取消预约失败:', err);
                res.status(500).json({ error: '取消预约失败' });
                return;
              }
              
              db.run(
                `UPDATE schedules SET booked_count = booked_count - 1 WHERE id = ?`,
                [booking.schedule_id],
                (err) => {
                  if (err) {
                    db.run('ROLLBACK');
                    console.error('更新排班预约数失败:', err);
                    res.status(500).json({ error: '取消预约失败' });
                    return;
                  }
                  
                  db.run(
                    `UPDATE members SET remaining_sessions = remaining_sessions + 1 WHERE id = ?`,
                    [booking.member_id],
                    (err) => {
                      if (err) {
                        db.run('ROLLBACK');
                        console.error('返还会员课时失败:', err);
                        res.status(500).json({ error: '取消预约失败' });
                        return;
                      }
                      
                      db.run('COMMIT', (err) => {
                        if (err) {
                          console.error('提交事务失败:', err);
                          res.status(500).json({ error: '取消预约失败' });
                          return;
                        }
                        
                        res.json({
                          message: '预约已取消，课时已返还',
                          status: 'canceled',
                          is_no_show: false
                        });
                      });
                    }
                  );
                }
              );
            }
          );
        } else {
          db.run(
            `UPDATE bookings SET status = 'canceled', canceled_at = CURRENT_TIMESTAMP, is_no_show = 1 WHERE id = ?`,
            [id],
            (err) => {
              if (err) {
                db.run('ROLLBACK');
                console.error('取消预约失败:', err);
                res.status(500).json({ error: '取消预约失败' });
                return;
              }
              
              db.run(
                `UPDATE schedules SET booked_count = booked_count - 1 WHERE id = ?`,
                [booking.schedule_id],
                (err) => {
                  if (err) {
                    db.run('ROLLBACK');
                    console.error('更新排班预约数失败:', err);
                    res.status(500).json({ error: '取消预约失败' });
                    return;
                  }
                  
                  db.run('COMMIT', (err) => {
                    if (err) {
                      console.error('提交事务失败:', err);
                      res.status(500).json({ error: '取消预约失败' });
                      return;
                    }
                    
                    res.json({
                      message: '距离开课不足2小时，已记为爽约并扣课',
                      status: 'canceled',
                      is_no_show: true,
                      hoursBefore: cancelCheck.hoursBefore.toFixed(1)
                    });
                  });
                }
              );
            }
          );
        }
      });
    }
  );
});

module.exports = router;
