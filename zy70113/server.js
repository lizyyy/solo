const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { initDatabase, run, get, all } = require('./database');

const app = express();
const PORT = 3000;

app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, './uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${uuidv4()}${path.extname(file.originalname)}`);
  }
});

const upload = multer({ storage });

function formatDate(date) {
  return date.toISOString().split('T')[0];
}

function formatDateTime(date) {
  return date.toISOString();
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function addHours(date, hours) {
  const result = new Date(date);
  result.setHours(result.getHours() + hours);
  return result;
}

function successResponse(data, message = '操作成功') {
  return {
    success: true,
    message,
    data,
    timestamp: new Date().toISOString()
  };
}

function errorResponse(message, error = null) {
  return {
    success: false,
    message,
    error: error ? error.message : null,
    timestamp: new Date().toISOString()
  };
}

app.post('/api/dishes', (req, res) => {
  try {
    const { name, category } = req.body;
    
    if (!name) {
      return res.status(400).json(errorResponse('菜品名称不能为空'));
    }

    const id = uuidv4();
    const now = formatDateTime(new Date());

    run(
      'INSERT INTO dishes (id, name, category, created_at) VALUES (?, ?, ?, ?)',
      [id, name, category || null, now]
    );

    res.json(successResponse({
      id,
      name,
      category: category || null
    }, `菜品「${name}」已添加`));
  } catch (err) {
    res.status(500).json(errorResponse('添加菜品失败', err));
  }
});

app.get('/api/dishes', (req, res) => {
  try {
    const dishes = all('SELECT id, name, category, created_at FROM dishes ORDER BY created_at DESC');
    res.json(successResponse(dishes, `查询到 ${dishes.length} 个菜品`));
  } catch (err) {
    res.status(500).json(errorResponse('查询菜品失败', err));
  }
});

app.post('/api/batches', (req, res) => {
  try {
    const { dish_id, batch_date, meal_time, cook_name, quantity, idempotency_key } = req.body;

    if (!dish_id || !batch_date || !meal_time || quantity === undefined) {
      return res.status(400).json(errorResponse('菜品ID、日期、餐次、数量均为必填项'));
    }

    if (!['breakfast', 'lunch', 'dinner'].includes(meal_time)) {
      return res.status(400).json(errorResponse('餐次必须是 breakfast(早餐)、lunch(午餐) 或 dinner(晚餐)'));
    }

    const dish = get('SELECT name FROM dishes WHERE id = ?', [dish_id]);
    if (!dish) {
      return res.status(404).json(errorResponse('该菜品不存在'));
    }

    if (idempotency_key) {
      const existing = get(
        `SELECT b.*, d.name as dish_name 
         FROM batches b 
         JOIN dishes d ON b.dish_id = d.id 
         WHERE b.id = (
           SELECT id FROM batches WHERE dish_id = ? AND batch_date = ? AND meal_time = ?
         )`,
        [dish_id, batch_date, meal_time]
      );
      
      if (existing) {
        return res.json(successResponse(existing, `批次已存在，请勿重复创建（${dish.name} ${batch_date} ${meal_time === 'breakfast' ? '早餐' : meal_time === 'lunch' ? '午餐' : '晚餐'}）`));
      }
    }

    const id = uuidv4();
    const now = formatDateTime(new Date());

    const mealTimeCN = meal_time === 'breakfast' ? '早餐' : meal_time === 'lunch' ? '午餐' : '晚餐';

    run(
      'INSERT INTO batches (id, dish_id, batch_date, meal_time, cook_name, quantity, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, dish_id, batch_date, meal_time, cook_name || null, quantity, now]
    );

    const batch = get(
      `SELECT b.*, d.name as dish_name 
       FROM batches b 
       JOIN dishes d ON b.dish_id = d.id 
       WHERE b.id = ?`,
      [id]
    );

    res.json(successResponse(batch, `批次创建成功：${dish.name} ${batch_date} ${mealTimeCN}，共 ${quantity} 份`));
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE')) {
      return res.json(successResponse(null, '该批次已存在，请勿重复创建'));
    }
    res.status(500).json(errorResponse('创建批次失败', err));
  }
});

app.get('/api/batches', (req, res) => {
  try {
    const { date, dish_id } = req.query;
    
    let sql = `SELECT b.*, d.name as dish_name 
               FROM batches b 
               JOIN dishes d ON b.dish_id = d.id 
               WHERE 1=1`;
    const params = [];

    if (date) {
      sql += ' AND b.batch_date = ?';
      params.push(date);
    }
    if (dish_id) {
      sql += ' AND b.dish_id = ?';
      params.push(dish_id);
    }
    sql += ' ORDER BY b.batch_date DESC, b.meal_time ASC';

    const batches = all(sql, params);
    res.json(successResponse(batches, `查询到 ${batches.length} 个批次`));
  } catch (err) {
    res.status(500).json(errorResponse('查询批次失败', err));
  }
});

app.post('/api/samples', (req, res) => {
  try {
    const { batch_id, box_no, operator, remark, idempotency_key } = req.body;

    if (!batch_id || !box_no || !operator) {
      return res.status(400).json(errorResponse('批次ID、留样盒编号、操作人均为必填项'));
    }

    const batch = get(
      `SELECT b.*, d.name as dish_name 
       FROM batches b 
       JOIN dishes d ON b.dish_id = d.id 
       WHERE b.id = ?`,
      [batch_id]
    );
    if (!batch) {
      return res.status(404).json(errorResponse('该批次不存在'));
    }

    const box = get('SELECT * FROM sample_boxes WHERE box_no = ?', [box_no]);
    if (!box) {
      return res.status(404).json(errorResponse('留样盒不存在'));
    }
    if (box.status === 'in_use') {
      return res.status(400).json(errorResponse(`留样盒 ${box_no} 正在使用中，请更换其他盒子`));
    }

    if (idempotency_key) {
      const existing = get(
        `SELECT s.*, b.batch_date, b.meal_time, d.name as dish_name
         FROM sample_records s
         JOIN batches b ON s.batch_id = b.id
         JOIN dishes d ON b.dish_id = d.id
         WHERE s.idempotency_key = ?`,
        [idempotency_key]
      );
      
      if (existing) {
        const mealTimeCN = existing.meal_time === 'breakfast' ? '早餐' : existing.meal_time === 'lunch' ? '午餐' : '晚餐';
        return res.json(successResponse(existing, `留样已登记：${existing.dish_name} ${existing.batch_date} ${mealTimeCN}（留样盒 ${existing.box_no}）`));
      }
    }

    const existingSample = get(
      'SELECT * FROM sample_records WHERE batch_id = ? AND status = ?',
      [batch_id, 'active']
    );
    if (existingSample) {
      return res.status(400).json(errorResponse(`该批次已留样（留样盒 ${existingSample.box_no}），同一批次只能留样一次`));
    }

    const id = uuidv4();
    const now = new Date();
    const sampleTime = formatDateTime(now);
    const expireTime = formatDateTime(addHours(now, 48));

    run(
      'INSERT INTO sample_records (id, batch_id, box_no, sample_time, expire_time, status, operator, remark, idempotency_key, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, batch_id, box_no, sampleTime, expireTime, 'active', operator, remark || null, idempotency_key || null, sampleTime]
    );

    run(
      'UPDATE sample_boxes SET status = ?, current_sample_id = ? WHERE box_no = ?',
      ['in_use', id, box_no]
    );

    const mealTimeCN = batch.meal_time === 'breakfast' ? '早餐' : batch.meal_time === 'lunch' ? '午餐' : '晚餐';

    const sample = get(
      `SELECT s.*, b.batch_date, b.meal_time, b.cook_name, b.quantity, d.name as dish_name
       FROM sample_records s
       JOIN batches b ON s.batch_id = b.id
       JOIN dishes d ON b.dish_id = d.id
       WHERE s.id = ?`,
      [id]
    );

    res.json(successResponse(sample, `留样登记成功：${batch.dish_name} ${batch.batch_date} ${mealTimeCN}，留样盒 ${box_no}，将在 48 小时后到期`));
  } catch (err) {
    res.status(500).json(errorResponse('留样登记失败', err));
  }
});

app.get('/api/samples', (req, res) => {
  try {
    const { status, date, box_no } = req.query;

    let sql = `SELECT s.*, b.batch_date, b.meal_time, b.cook_name, b.quantity, d.name as dish_name
               FROM sample_records s
               JOIN batches b ON s.batch_id = b.id
               JOIN dishes d ON b.dish_id = d.id
               WHERE 1=1`;
    const params = [];

    if (status) {
      sql += ' AND s.status = ?';
      params.push(status);
    }
    if (date) {
      sql += ' AND b.batch_date = ?';
      params.push(date);
    }
    if (box_no) {
      sql += ' AND s.box_no = ?';
      params.push(box_no);
    }
    sql += ' ORDER BY s.sample_time DESC';

    const samples = all(sql, params);
    
    const summary = {
      total: samples.length,
      active: samples.filter(s => s.status === 'active').length,
      destroyed: samples.filter(s => s.status === 'destroyed').length,
      supplemented: samples.filter(s => s.status === 'supplemented').length
    };

    res.json(successResponse({ samples, summary }, `查询到 ${samples.length} 条留样记录`));
  } catch (err) {
    res.status(500).json(errorResponse('查询留样记录失败', err));
  }
});

app.post('/api/samples/:id/destroy', (req, res) => {
  try {
    const { id } = req.params;
    const { operator, remark, idempotency_key } = req.body;

    if (!operator) {
      return res.status(400).json(errorResponse('操作人为必填项'));
    }

    const sample = get(
      `SELECT s.*, b.batch_date, b.meal_time, d.name as dish_name
       FROM sample_records s
       JOIN batches b ON s.batch_id = b.id
       JOIN dishes d ON b.dish_id = d.id
       WHERE s.id = ?`,
      [id]
    );
    if (!sample) {
      return res.status(404).json(errorResponse('留样记录不存在'));
    }

    if (sample.status === 'destroyed') {
      return res.json(successResponse(sample, '该留样已销毁，无需重复操作'));
    }

    if (idempotency_key) {
      const existingDestruction = get(
        'SELECT * FROM destruction_records WHERE idempotency_key = ?',
        [idempotency_key]
      );
      if (existingDestruction) {
        return res.json(successResponse({ sample, destruction: existingDestruction }, '销毁操作已记录，请勿重复提交'));
      }
    }

    const now = formatDateTime(new Date());
    const destructionId = uuidv4();

    run(
      'INSERT INTO destruction_records (id, sample_id, destroy_time, operator, remark, idempotency_key, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [destructionId, id, now, operator, remark || null, idempotency_key || null, now]
    );

    run(
      'UPDATE sample_records SET status = ? WHERE id = ?',
      ['destroyed', id]
    );

    run(
      'UPDATE sample_boxes SET status = ?, current_sample_id = NULL WHERE box_no = ?',
      ['empty', sample.box_no]
    );

    const mealTimeCN = sample.meal_time === 'breakfast' ? '早餐' : sample.meal_time === 'lunch' ? '午餐' : '晚餐';
    const updatedSample = get(
      `SELECT s.*, b.batch_date, b.meal_time, d.name as dish_name
       FROM sample_records s
       JOIN batches b ON s.batch_id = b.id
       JOIN dishes d ON b.dish_id = d.id
       WHERE s.id = ?`,
      [id]
    );

    res.json(successResponse(updatedSample, `销毁成功：${sample.dish_name} ${sample.batch_date} ${mealTimeCN}，留样盒 ${sample.box_no} 已归还`));
  } catch (err) {
    res.status(500).json(errorResponse('销毁操作失败', err));
  }
});

app.post('/api/samples/:id/photo', upload.single('photo'), (req, res) => {
  try {
    const { id } = req.params;

    if (!req.file) {
      return res.status(400).json(errorResponse('请上传照片'));
    }

    const sample = get('SELECT * FROM sample_records WHERE id = ?', [id]);
    if (!sample) {
      fs.unlinkSync(req.file.path);
      return res.status(404).json(errorResponse('留样记录不存在'));
    }

    const photoPath = `/uploads/${req.file.filename}`;
    run(
      'UPDATE sample_records SET photo_path = ? WHERE id = ?',
      [photoPath, id]
    );

    res.json(successResponse({
      sample_id: id,
      photo_url: `http://localhost:${PORT}${photoPath}`,
      photo_path: photoPath
    }, '照片上传成功，留样记录已更新'));
  } catch (err) {
    if (req.file) {
      try { fs.unlinkSync(req.file.path); } catch (e) {}
    }
    res.status(500).json(errorResponse('照片上传失败', err));
  }
});

app.post('/api/samples/supplement', (req, res) => {
  try {
    const { batch_id, box_no, operator, supplement_reason, original_missing_reason, remark, idempotency_key } = req.body;

    if (!batch_id || !box_no || !operator || !supplement_reason) {
      return res.status(400).json(errorResponse('批次ID、留样盒编号、操作人、补录原因均为必填项'));
    }

    const batch = get(
      `SELECT b.*, d.name as dish_name 
       FROM batches b 
       JOIN dishes d ON b.dish_id = d.id 
       WHERE b.id = ?`,
      [batch_id]
    );
    if (!batch) {
      return res.status(404).json(errorResponse('该批次不存在'));
    }

    const originalSample = get(
      'SELECT * FROM sample_records WHERE batch_id = ? AND status = ?',
      [batch_id, 'active']
    );
    if (!originalSample) {
      return res.status(400).json(errorResponse('该批次无有效留样记录，无法补录'));
    }

    if (idempotency_key) {
      const existingSupplement = get(
        `SELECT sr.*, s.batch_id, s.box_no, s.sample_time,
                b.batch_date, b.meal_time, d.name as dish_name
         FROM supplement_records sr
         JOIN sample_records s ON sr.sample_id = s.id
         JOIN batches b ON s.batch_id = b.id
         JOIN dishes d ON b.dish_id = d.id
         WHERE sr.idempotency_key = ?`,
        [idempotency_key]
      );
      if (existingSupplement) {
        return res.json(successResponse(existingSupplement, '补录已记录，请勿重复提交'));
      }
    }

    const box = get('SELECT * FROM sample_boxes WHERE box_no = ?', [box_no]);
    if (!box) {
      return res.status(404).json(errorResponse('留样盒不存在'));
    }
    if (box.status === 'in_use' && box.current_sample_id !== originalSample.id) {
      return res.status(400).json(errorResponse(`留样盒 ${box_no} 正在使用中`));
    }

    const now = new Date();
    const supplementTime = formatDateTime(now);
    const expireTime = formatDateTime(addHours(now, 48));

    run(
      'UPDATE sample_records SET status = ? WHERE id = ?',
      ['destroyed', originalSample.id]
    );

    run(
      'UPDATE sample_boxes SET status = ?, current_sample_id = NULL WHERE box_no = ?',
      ['empty', originalSample.box_no]
    );

    const newSampleId = uuidv4();
    run(
      'INSERT INTO sample_records (id, batch_id, box_no, sample_time, expire_time, status, operator, remark, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [newSampleId, batch_id, box_no, supplementTime, expireTime, 'supplemented', operator, remark || null, supplementTime]
    );

    run(
      'UPDATE sample_boxes SET status = ?, current_sample_id = ? WHERE box_no = ?',
      ['in_use', newSampleId, box_no]
    );

    const supplementId = uuidv4();
    run(
      'INSERT INTO supplement_records (id, batch_id, sample_id, supplement_reason, supplement_time, operator, original_missing_reason, idempotency_key, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [supplementId, batch_id, newSampleId, supplement_reason, supplementTime, operator, original_missing_reason || null, idempotency_key || null, supplementTime]
    );

    const mealTimeCN = batch.meal_time === 'breakfast' ? '早餐' : batch.meal_time === 'lunch' ? '午餐' : '晚餐';

    const supplementedSample = get(
      `SELECT s.*, b.batch_date, b.meal_time, d.name as dish_name,
              sr.supplement_reason, sr.original_missing_reason, sr.supplement_time
       FROM sample_records s
       JOIN batches b ON s.batch_id = b.id
       JOIN dishes d ON b.dish_id = d.id
       JOIN supplement_records sr ON sr.sample_id = s.id
       WHERE s.id = ?`,
      [newSampleId]
    );

    res.json(successResponse(supplementedSample, `补录成功：${batch.dish_name} ${batch.batch_date} ${mealTimeCN}，新留样盒 ${box_no}，补录原因：${supplement_reason}`));
  } catch (err) {
    res.status(500).json(errorResponse('补录操作失败', err));
  }
});

app.get('/api/supplements', (req, res) => {
  try {
    const { date } = req.query;

    let sql = `SELECT sr.*, 
                      s.box_no, s.sample_time, s.expire_time, s.status as sample_status,
                      b.batch_date, b.meal_time, d.name as dish_name
               FROM supplement_records sr
               JOIN sample_records s ON sr.sample_id = s.id
               JOIN batches b ON s.batch_id = b.id
               JOIN dishes d ON b.dish_id = d.id
               WHERE 1=1`;
    const params = [];

    if (date) {
      sql += ' AND b.batch_date = ?';
      params.push(date);
    }
    sql += ' ORDER BY sr.supplement_time DESC';

    const supplements = all(sql, params);
    res.json(successResponse(supplements, `查询到 ${supplements.length} 条补录记录`));
  } catch (err) {
    res.status(500).json(errorResponse('查询补录记录失败', err));
  }
});

app.get('/api/audit/daily', (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date || formatDate(new Date());

    const batches = all(
      `SELECT b.*, d.name as dish_name
       FROM batches b
       JOIN dishes d ON b.dish_id = d.id
       WHERE b.batch_date = ?
       ORDER BY b.meal_time ASC`,
      [targetDate]
    );

    const samples = all(
      `SELECT s.*, b.batch_date, b.meal_time, d.name as dish_name
       FROM sample_records s
       JOIN batches b ON s.batch_id = b.id
       JOIN dishes d ON b.dish_id = d.id
       WHERE b.batch_date = ?`,
      [targetDate]
    );

    const supplements = all(
      `SELECT sr.*, b.batch_date, b.meal_time, d.name as dish_name
       FROM supplement_records sr
       JOIN sample_records s ON sr.sample_id = s.id
       JOIN batches b ON s.batch_id = b.id
       JOIN dishes d ON b.dish_id = d.id
       WHERE b.batch_date = ?`,
      [targetDate]
    );

    const destruction = all(
      `SELECT dr.*, b.batch_date, b.meal_time, d.name as dish_name, s.box_no
       FROM destruction_records dr
       JOIN sample_records s ON dr.sample_id = s.id
       JOIN batches b ON s.batch_id = b.id
       JOIN dishes d ON b.dish_id = d.id
       WHERE b.batch_date = ?`,
      [targetDate]
    );

    const missingBatches = batches.filter(batch => 
      !samples.some(s => s.batch_id === batch.id)
    );

    const expiredSamples = samples.filter(s => {
      if (s.status !== 'active') return false;
      return new Date(s.expire_time) < new Date();
    });

    const summary = {
      date: targetDate,
      total_batches: batches.length,
      total_samples: samples.length,
      active_samples: samples.filter(s => s.status === 'active').length,
      destroyed_samples: samples.filter(s => s.status === 'destroyed').length,
      supplemented_samples: samples.filter(s => s.status === 'supplemented').length,
      missing_count: missingBatches.length,
      expired_count: expiredSamples.length,
      supplement_count: supplements.length
    };

    res.json(successResponse({
      summary,
      batches,
      samples,
      supplements,
      destruction_records: destruction,
      missing_batches: missingBatches,
      expired_samples: expiredSamples
    }, `监管日报：${targetDate}，共 ${batches.length} 个批次，${missingBatches.length} 个批次漏样，${expiredSamples.length} 个留样已过期未销毁`));
  } catch (err) {
    res.status(500).json(errorResponse('生成监管日报失败', err));
  }
});

app.get('/api/audit/compliance', (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    
    const today = formatDate(new Date());
    const start = start_date || formatDate(addDays(new Date(), -7));
    const end = end_date || today;

    const batches = all(
      `SELECT b.*, d.name as dish_name
       FROM batches b
       JOIN dishes d ON b.dish_id = d.id
       WHERE b.batch_date BETWEEN ? AND ?
       ORDER BY b.batch_date DESC, b.meal_time ASC`,
      [start, end]
    );

    const samples = all(
      `SELECT s.*, b.batch_date, b.meal_time, d.name as dish_name
       FROM sample_records s
       JOIN batches b ON s.batch_id = b.id
       JOIN dishes d ON b.dish_id = d.id
       WHERE b.batch_date BETWEEN ? AND ?`,
      [start, end]
    );

    const supplements = all(
      `SELECT sr.*, b.batch_date, b.meal_time, d.name as dish_name
       FROM supplement_records sr
       JOIN sample_records s ON sr.sample_id = s.id
       JOIN batches b ON s.batch_id = b.id
       JOIN dishes d ON b.dish_id = d.id
       WHERE b.batch_date BETWEEN ? AND ?`,
      [start, end]
    );

    const batchDates = [...new Set(batches.map(b => b.batch_date))];
    const dailyStats = batchDates.map(date => {
      const dayBatches = batches.filter(b => b.batch_date === date);
      const daySamples = samples.filter(s => s.batch_date === date);
      const daySupplements = supplements.filter(s => s.batch_date === date);
      const missing = dayBatches.filter(batch => 
        !daySamples.some(s => s.batch_id === batch.id)
      );

      return {
        date,
        total_batches: dayBatches.length,
        sampled_count: daySamples.length,
        missing_count: missing.length,
        supplement_count: daySupplements.length,
        has_photo: daySamples.filter(s => s.photo_path).length,
        compliance_rate: dayBatches.length > 0 
          ? Math.round(((dayBatches.length - missing.length) / dayBatches.length) * 100) 
          : 100
      };
    }).sort((a, b) => a.date.localeCompare(b.date));

    const totalBatches = batches.length;
    const totalMissing = batches.filter(batch => 
      !samples.some(s => s.batch_id === batch.id)
    ).length;

    const overallCompliance = totalBatches > 0 
      ? Math.round(((totalBatches - totalMissing) / totalBatches) * 100) 
      : 100;

    res.json(successResponse({
      period: { start, end },
      overall_compliance: overallCompliance,
      total_batches: totalBatches,
      total_samples: samples.length,
      total_missing: totalMissing,
      total_supplements: supplements.length,
      daily_stats: dailyStats,
      missing_details: batches.filter(batch => 
        !samples.some(s => s.batch_id === batch.id)
      ),
      supplement_details: supplements
    }, `合规检查报告（${start} 至 ${end}）：总体合规率 ${overallCompliance}%，共 ${totalBatches} 个批次，${totalMissing} 个漏样`));
  } catch (err) {
    res.status(500).json(errorResponse('生成合规报告失败', err));
  }
});

app.get('/api/boxes', (req, res) => {
  try {
    const { status } = req.query;
    
    let sql = 'SELECT * FROM sample_boxes WHERE 1=1';
    const params = [];

    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }
    sql += ' ORDER BY box_no ASC';

    const boxes = all(sql, params);
    const summary = {
      total: boxes.length,
      empty: boxes.filter(b => b.status === 'empty').length,
      in_use: boxes.filter(b => b.status === 'in_use').length
    };

    res.json(successResponse({ boxes, summary }, `查询到 ${boxes.length} 个留样盒，其中 ${summary.empty} 个空闲，${summary.in_use} 个使用中`));
  } catch (err) {
    res.status(500).json(errorResponse('查询留样盒失败', err));
  }
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: '餐厅后厨留样管理系统',
    timestamp: new Date().toISOString()
  });
});

async function startServer() {
  await initDatabase();
  
  app.listen(PORT, () => {
    console.log(`\n========================================`);
    console.log(`  餐厅后厨留样管理系统已启动`);
    console.log(`========================================`);
    console.log(`  服务地址: http://localhost:${PORT}`);
    console.log(`  健康检查: http://localhost:${PORT}/health`);
    console.log(`========================================\n`);
    console.log(`可用接口:`);
    console.log(`  GET  /api/dishes        - 查询菜品列表`);
    console.log(`  POST /api/dishes        - 添加菜品`);
    console.log(`  GET  /api/batches       - 查询批次`);
    console.log(`  POST /api/batches       - 创建批次`);
    console.log(`  GET  /api/samples       - 查询留样记录`);
    console.log(`  POST /api/samples       - 留样登记`);
    console.log(`  POST /api/samples/:id/destroy - 销毁留样`);
    console.log(`  POST /api/samples/:id/photo   - 上传照片`);
    console.log(`  POST /api/samples/supplement  - 异常补录`);
    console.log(`  GET  /api/supplements   - 查询补录记录`);
    console.log(`  GET  /api/audit/daily   - 监管日报`);
    console.log(`  GET  /api/audit/compliance - 合规检查`);
    console.log(`  GET  /api/boxes         - 查询留样盒状态`);
    console.log(`\n========================================\n`);
  });
}

startServer().catch(err => {
  console.error('启动失败:', err);
  process.exit(1);
});
