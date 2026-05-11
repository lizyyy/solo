const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { initDatabase, run, get, all } = require('./db');

const app = express();
app.use(express.json());

const formatDate = (dateStr) => {
  const d = new Date(dateStr);
  return d.toISOString().split('T')[0];
};

const addDays = (dateStr, days) => {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return formatDate(d);
};

const calculateStreak = async (campId, studentId) => {
  const signs = await all(
    `SELECT sign_date, status FROM daily_signs 
     WHERE camp_id = ? AND student_id = ? 
     AND sign_date <= date('now')
     ORDER BY sign_date DESC`,
    [campId, studentId]
  );
  
  if (signs.length === 0) return 0;
  
  const validDates = new Set();
  signs.forEach(s => {
    if (s.status === 'approved') {
      validDates.add(s.sign_date);
    }
  });
  
  let streak = 0;
  let currentDate = formatDate('now');
  
  while (true) {
    if (validDates.has(currentDate)) {
      streak++;
      currentDate = addDays(currentDate, -1);
    } else {
      break;
    }
  }
  
  return streak;
};

const getRewardStatus = (streak, locked) => {
  if (locked) return 'locked';
  if (streak >= 30) return 'gold';
  if (streak >= 14) return 'silver';
  if (streak >= 7) return 'bronze';
  return 'none';
};

const updateStreak = async (campId, studentId) => {
  const streak = await calculateStreak(campId, studentId);
  const enrollment = await get(
    'SELECT locked_reward FROM enrollments WHERE camp_id = ? AND student_id = ?',
    [campId, studentId]
  );
  
  await run(
    'UPDATE enrollments SET streak_days = ? WHERE camp_id = ? AND student_id = ?',
    [streak, campId, studentId]
  );
  
  return streak;
};

app.post('/api/camps', async (req, res) => {
  try {
    const { name, start_date, end_date, max_retry_sign } = req.body;
    const id = uuidv4();
    await run(
      'INSERT INTO camps (id, name, start_date, end_date, max_retry_sign) VALUES (?, ?, ?, ?, ?)',
      [id, name, start_date, end_date, max_retry_sign || 3]
    );
    res.status(201).json({ id, name, start_date, end_date, max_retry_sign: max_retry_sign || 3 });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/camps/:campId/enroll', async (req, res) => {
  try {
    const { campId } = req.params;
    const { student_id, student_name } = req.body;
    
    const camp = await get('SELECT max_retry_sign FROM camps WHERE id = ?', [campId]);
    if (!camp) return res.status(404).json({ error: 'Camp not found' });
    
    const id = uuidv4();
    try {
      await run(
        'INSERT INTO enrollments (id, camp_id, student_id, student_name, remaining_retry_sign) VALUES (?, ?, ?, ?, ?)',
        [id, campId, student_id, student_name, camp.max_retry_sign]
      );
    } catch (e) {
      if (e.message.includes('UNIQUE')) {
        const existing = await get(
          'SELECT * FROM enrollments WHERE camp_id = ? AND student_id = ?',
          [campId, student_id]
        );
        return res.status(200).json(existing);
      }
      throw e;
    }
    
    const enrollment = await get(
      'SELECT * FROM enrollments WHERE camp_id = ? AND student_id = ?',
      [campId, student_id]
    );
    res.status(201).json(enrollment);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/camps/:campId/students/:studentId/sign', async (req, res) => {
  try {
    const { campId, studentId } = req.params;
    const { sign_date, homework_url } = req.body;
    
    const enrollment = await get(
      'SELECT * FROM enrollments WHERE camp_id = ? AND student_id = ?',
      [campId, studentId]
    );
    if (!enrollment) return res.status(404).json({ error: 'Enrollment not found' });
    
    const date = sign_date || formatDate('now');
    
    const existing = await get(
      'SELECT * FROM daily_signs WHERE camp_id = ? AND student_id = ? AND sign_date = ?',
      [campId, studentId, date]
    );
    
    if (existing) {
      return res.status(200).json(existing);
    }
    
    const id = uuidv4();
    await run(
      'INSERT INTO daily_signs (id, camp_id, student_id, sign_date, homework_url) VALUES (?, ?, ?, ?, ?)',
      [id, campId, studentId, date, homework_url]
    );
    
    const sign = await get('SELECT * FROM daily_signs WHERE id = ?', [id]);
    res.status(201).json(sign);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/camps/:campId/signs/:signId/review', async (req, res) => {
  try {
    const { campId, signId } = req.params;
    const { approved } = req.body;
    
    const sign = await get(
      'SELECT * FROM daily_signs WHERE id = ? AND camp_id = ?',
      [signId, campId]
    );
    if (!sign) return res.status(404).json({ error: 'Sign not found' });
    
    const newStatus = approved ? 'approved' : 'rejected';
    await run(
      'UPDATE daily_signs SET status = ? WHERE id = ?',
      [newStatus, signId]
    );
    
    const streak = await updateStreak(sign.camp_id, sign.student_id);
    
    const updated = await get('SELECT * FROM daily_signs WHERE id = ?', [signId]);
    res.json({ ...updated, current_streak: streak });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/camps/:campId/students/:studentId/retry', async (req, res) => {
  try {
    const { campId, studentId } = req.params;
    const { retry_date, homework_url } = req.body;
    
    if (!retry_date) return res.status(400).json({ error: 'retry_date required' });
    
    const enrollment = await get(
      'SELECT * FROM enrollments WHERE camp_id = ? AND student_id = ?',
      [campId, studentId]
    );
    if (!enrollment) return res.status(404).json({ error: 'Enrollment not found' });
    
    if (enrollment.remaining_retry_sign <= 0) {
      return res.status(400).json({ error: 'No retry attempts remaining' });
    }
    
    const existingSign = await get(
      'SELECT * FROM daily_signs WHERE camp_id = ? AND student_id = ? AND sign_date = ?',
      [campId, studentId, retry_date]
    );
    
    if (existingSign && existingSign.status === 'approved') {
      return res.status(400).json({ error: 'Already has approved sign on this date' });
    }
    
    const id = uuidv4();
    await run(
      'INSERT INTO retry_signs (id, camp_id, student_id, retry_date, homework_url) VALUES (?, ?, ?, ?, ?)',
      [id, campId, studentId, retry_date, homework_url]
    );
    
    const retry = await get('SELECT * FROM retry_signs WHERE id = ?', [id]);
    res.status(201).json(retry);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/camps/:campId/retries/:retryId/review', async (req, res) => {
  try {
    const { campId, retryId } = req.params;
    const { approved } = req.body;
    
    const retry = await get(
      'SELECT * FROM retry_signs WHERE id = ? AND camp_id = ?',
      [retryId, campId]
    );
    if (!retry) return res.status(404).json({ error: 'Retry not found' });
    
    if (retry.status !== 'pending_review') {
      return res.status(400).json({ error: 'Retry already reviewed' });
    }
    
    const enrollment = await get(
      'SELECT locked_reward FROM enrollments WHERE camp_id = ? AND student_id = ?',
      [campId, retry.student_id]
    );
    
    const newStatus = approved ? 'approved' : 'rejected';
    await run(
      'UPDATE retry_signs SET status = ?, reviewed_at = datetime(\'now\') WHERE id = ?',
      [newStatus, retryId]
    );
    
    await run(
      'UPDATE enrollments SET remaining_retry_sign = remaining_retry_sign - 1 WHERE camp_id = ? AND student_id = ?',
      [campId, retry.student_id]
    );
    
    if (approved && enrollment.locked_reward === 0) {
      const existing = await get(
        'SELECT * FROM daily_signs WHERE camp_id = ? AND student_id = ? AND sign_date = ?',
        [campId, retry.student_id, retry.retry_date]
      );
      
      if (existing) {
        await run(
          'UPDATE daily_signs SET status = ?, homework_url = ? WHERE id = ?',
          ['approved', retry.homework_url, existing.id]
        );
      } else {
        const signId = uuidv4();
        await run(
          'INSERT INTO daily_signs (id, camp_id, student_id, sign_date, status, homework_url) VALUES (?, ?, ?, ?, ?, ?)',
          [signId, campId, retry.student_id, retry.retry_date, 'approved', retry.homework_url]
        );
      }
      
      await updateStreak(campId, retry.student_id);
    }
    
    const updated = await get('SELECT * FROM retry_signs WHERE id = ?', [retryId]);
    const updatedEnrollment = await get(
      'SELECT * FROM enrollments WHERE camp_id = ? AND student_id = ?',
      [campId, retry.student_id]
    );
    
    res.json({
      ...updated,
      enrollment: {
        remaining_retry_sign: updatedEnrollment.remaining_retry_sign,
        streak_days: updatedEnrollment.streak_days
      }
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/camps/:campId/students/:studentId/lock-reward', async (req, res) => {
  try {
    const { campId, studentId } = req.params;
    const { reward_name } = req.body;
    
    const enrollment = await get(
      'SELECT * FROM enrollments WHERE camp_id = ? AND student_id = ?',
      [campId, studentId]
    );
    if (!enrollment) return res.status(404).json({ error: 'Enrollment not found' });
    
    await run(
      'UPDATE enrollments SET locked_reward = 1 WHERE camp_id = ? AND student_id = ?',
      [campId, studentId]
    );
    
    const rewardId = uuidv4();
    await run(
      'INSERT INTO rewards (id, camp_id, student_id, reward_name, reward_type) VALUES (?, ?, ?, ?, ?)',
      [rewardId, campId, studentId, reward_name || 'Locked Reward', 'locked']
    );
    
    const reward = await get('SELECT * FROM rewards WHERE id = ?', [rewardId]);
    res.status(201).json(reward);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/camps/:campId/statistics', async (req, res) => {
  try {
    const { campId } = req.params;
    
    const enrollments = await all(
      'SELECT * FROM enrollments WHERE camp_id = ?',
      [campId]
    );
    
    const pendingRetries = await all(
      `SELECT r.*, e.student_name 
       FROM retry_signs r 
       JOIN enrollments e ON r.camp_id = e.camp_id AND r.student_id = e.student_id
       WHERE r.camp_id = ? AND r.status = 'pending_review'`,
      [campId]
    );
    
    const result = await Promise.all(enrollments.map(async e => {
      const streak = await calculateStreak(campId, e.student_id);
      const rewardStatus = getRewardStatus(streak, e.locked_reward);
      
      const approvedCount = await get(
        `SELECT COUNT(*) as count FROM daily_signs 
         WHERE camp_id = ? AND student_id = ? AND status = 'approved'`,
        [campId, e.student_id]
      );
      
      const pendingCount = await get(
        `SELECT COUNT(*) as count FROM daily_signs 
         WHERE camp_id = ? AND student_id = ? AND status = 'pending_review'`,
        [campId, e.student_id]
      );
      
      const studentPendingRetries = pendingRetries.filter(r => r.student_id === e.student_id);
      
      return {
        student_id: e.student_id,
        student_name: e.student_name,
        streak_days: streak,
        reward_status: rewardStatus,
        reward_locked: e.locked_reward === 1,
        approved_signs_count: approvedCount.count,
        pending_signs_count: pendingCount.count,
        pending_retries: studentPendingRetries
      };
    }));
    
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/camps/:campId/leaderboard', async (req, res) => {
  try {
    const { campId } = req.params;
    
    const enrollments = await all(
      'SELECT * FROM enrollments WHERE camp_id = ?',
      [campId]
    );
    
    const result = await Promise.all(enrollments.map(async e => {
      const streak = await calculateStreak(campId, e.student_id);
      
      const approvedCount = await get(
        `SELECT COUNT(*) as count FROM daily_signs 
         WHERE camp_id = ? AND student_id = ? AND status = 'approved'`,
        [campId, e.student_id]
      );
      
      const pendingCount = await get(
        `SELECT COUNT(*) as count FROM daily_signs 
         WHERE camp_id = ? AND student_id = ? AND status = 'pending_review'`,
        [campId, e.student_id]
      );
      
      return {
        student_id: e.student_id,
        student_name: e.student_name,
        streak_days: streak,
        effective_signs_count: approvedCount.count,
        pending_signs_count: pendingCount.count
      };
    }));
    
    result.sort((a, b) => {
      if (b.streak_days !== a.streak_days) return b.streak_days - a.streak_days;
      return b.effective_signs_count - a.effective_signs_count;
    });
    
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 3000;

const start = async () => {
  await initDatabase();
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
};

start();
