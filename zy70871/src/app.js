const express = require('express');
const cors = require('cors');
const multer = require('multer');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { Parser } = require('json2csv');
const { initDatabase, runQuery, getQuery, allQuery } = require('./database');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

function generateHash(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function validateBatchData(data) {
  const errors = [];
  if (!data.batch_no) {
    errors.push({ field: 'batch_no', message: '批次号不能为空', position: 'root.batch_no' });
  }
  if (!data.product_name) {
    errors.push({ field: 'product_name', message: '产品名称不能为空', position: 'root.product_name' });
  }
  return errors;
}

function validateMaterialData(items) {
  const errors = [];
  const seenKeys = new Set();

  items.forEach((item, index) => {
    const position = `items[${index}]`;

    if (!item.sample_no) {
      errors.push({ field: 'sample_no', message: '样品批号不能为空', position: `${position}.sample_no`, value: item.sample_no, row: index + 1 });
    }
    if (!item.chamber_id) {
      errors.push({ field: 'chamber_id', message: '环境箱编号不能为空', position: `${position}.chamber_id`, value: item.chamber_id, row: index + 1 });
    }
    if (!item.sampling_month && item.sampling_month !== 0) {
      errors.push({ field: 'sampling_month', message: '取样月份不能为空', position: `${position}.sampling_month`, value: item.sampling_month, row: index + 1 });
    }
    if (item.sampling_month && (item.sampling_month < 0 || item.sampling_month > 60)) {
      errors.push({ field: 'sampling_month', message: '取样月份必须在0-60之间', position: `${position}.sampling_month`, value: item.sampling_month, row: index + 1 });
    }
    if (!item.temperature && item.temperature !== 0) {
      errors.push({ field: 'temperature', message: '温度不能为空', position: `${position}.temperature`, value: item.temperature, row: index + 1 });
    }

    const uniqueKey = `${item.sample_no}_${item.chamber_id}_${item.sampling_month}`;
    if (seenKeys.has(uniqueKey)) {
      errors.push({ field: 'duplicate', message: `重复的样品-箱体-月份组合: ${uniqueKey}`, position: position, value: uniqueKey, row: index + 1 });
    }
    seenKeys.add(uniqueKey);
  });

  return errors;
}

app.post('/api/batches', async (req, res) => {
  try {
    const validationErrors = validateBatchData(req.body);
    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: '数据验证失败',
        errors: validationErrors
      });
    }

    const existingBatch = await getQuery('SELECT * FROM batches WHERE batch_no = ?', [req.body.batch_no]);
    if (existingBatch) {
      return res.status(409).json({
        success: false,
        message: '批次号已存在',
        batch: existingBatch
      });
    }

    const batchId = uuidv4();
    await runQuery(
      'INSERT INTO batches (id, batch_no, product_name, specification, manufacturer, production_date, remark) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [batchId, req.body.batch_no, req.body.product_name, req.body.specification, req.body.manufacturer, req.body.production_date, req.body.remark]
    );

    const batch = await getQuery('SELECT * FROM batches WHERE id = ?', [batchId]);
    res.json({ success: true, data: batch });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/batches', async (req, res) => {
  try {
    const batches = await allQuery('SELECT * FROM batches ORDER BY created_at DESC');
    res.json({ success: true, data: batches });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/batches/:id', async (req, res) => {
  try {
    const batch = await getQuery('SELECT * FROM batches WHERE id = ?', [req.params.id]);
    if (!batch) {
      return res.status(404).json({ success: false, message: '批次不存在' });
    }
    res.json({ success: true, data: batch });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/batches/:batchId/materials', upload.single('file'), async (req, res) => {
  try {
    const batchId = req.params.batchId;
    const batch = await getQuery('SELECT * FROM batches WHERE id = ?', [batchId]);
    if (!batch) {
      return res.status(404).json({ success: false, message: '批次不存在' });
    }

    let materialContent;
    let fileName;

    if (req.file) {
      materialContent = req.file.buffer.toString('utf8');
      fileName = req.file.originalname;
    } else if (req.body.content) {
      materialContent = typeof req.body.content === 'string' ? req.body.content : JSON.stringify(req.body.content);
      fileName = req.body.fileName || 'manual_input';
    } else {
      return res.status(400).json({ success: false, message: '请上传文件或提供内容' });
    }

    const materialHash = generateHash(materialContent);

    const existingMaterial = await getQuery(
      'SELECT * FROM raw_materials WHERE material_hash = ?',
      [materialHash]
    );

    if (existingMaterial) {
      const existingRecords = await allQuery(
        'SELECT * FROM test_records WHERE material_id = ?',
        [existingMaterial.id]
      );
      const existingBatch = await getQuery('SELECT * FROM batches WHERE id = ?', [existingMaterial.batch_id]);

      return res.status(200).json({
        success: true,
        isDuplicate: true,
        message: '相同材料已存在，返回原有处理结果',
        existingMaterial: existingMaterial,
        existingBatch: existingBatch,
        existingRecords: existingRecords
      });
    }

    const materialId = uuidv4();
    await runQuery(
      'INSERT INTO raw_materials (id, batch_id, material_hash, material_content, file_name, uploaded_by) VALUES (?, ?, ?, ?, ?, ?)',
      [materialId, batchId, materialHash, materialContent, fileName, req.body.uploadedBy]
    );

    const material = await getQuery('SELECT * FROM raw_materials WHERE id = ?', [materialId]);
    res.json({ success: true, data: material, isDuplicate: false });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/batches/:batchId/materials', async (req, res) => {
  try {
    const materials = await allQuery(
      'SELECT * FROM raw_materials WHERE batch_id = ? ORDER BY created_at DESC',
      [req.params.batchId]
    );
    res.json({ success: true, data: materials });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/batches/:batchId/process', async (req, res) => {
  try {
    const batchId = req.params.batchId;
    const batch = await getQuery('SELECT * FROM batches WHERE id = ?', [batchId]);
    if (!batch) {
      return res.status(404).json({ success: false, message: '批次不存在' });
    }

    const materials = await allQuery(
      'SELECT * FROM raw_materials WHERE batch_id = ? ORDER BY created_at DESC LIMIT 1',
      [batchId]
    );

    if (materials.length === 0) {
      return res.status(400).json({ success: false, message: '请先上传材料' });
    }

    const material = materials[0];
    let items;

    try {
      const parsed = JSON.parse(material.material_content);
      items = Array.isArray(parsed) ? parsed : parsed.items || parsed.records || [];
    } catch (e) {
      return res.status(400).json({ success: false, message: '材料内容格式错误，无法解析' });
    }

    const validationErrors = validateMaterialData(items);

    if (validationErrors.length > 0) {
      for (const err of validationErrors) {
        await runQuery(
          'INSERT INTO errors (id, batch_id, material_id, error_type, error_message, original_position, field_name, raw_value) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [uuidv4(), batchId, material.id, 'validation', err.message, err.position, err.field, String(err.value || '')]
        );
      }

      return res.status(400).json({
        success: false,
        message: '数据验证失败',
        errors: validationErrors,
        errorCount: validationErrors.length
      });
    }

    const createdRecords = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const recordId = uuidv4();

      await runQuery(
        `INSERT INTO test_records (id, batch_id, material_id, sample_no, chamber_id, condition_code, temperature, humidity, sampling_month, sampling_date, planned_test_date)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [recordId, batchId, material.id, item.sample_no, item.chamber_id, item.condition_code || '',
         item.temperature, item.humidity || null, item.sampling_month, item.sampling_date || null,
         item.planned_test_date || null]
      );

      await runQuery(
        'INSERT INTO processing_traces (id, record_id, action, operator, remark, original_position) VALUES (?, ?, ?, ?, ?, ?)',
        [uuidv4(), recordId, 'created', req.body.operator || 'system', `从原始材料第${i + 1}行创建`, `row_${i + 1}`]
      );

      const record = await getQuery('SELECT * FROM test_records WHERE id = ?', [recordId]);
      createdRecords.push(record);
    }

    await runQuery('UPDATE batches SET status = ? WHERE id = ?', ['processed', batchId]);

    res.json({
      success: true,
      message: `成功拆分 ${createdRecords.length} 条试验记录`,
      records: createdRecords
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/records/:recordId/traces', async (req, res) => {
  try {
    const recordId = req.params.recordId;
    const record = await getQuery('SELECT * FROM test_records WHERE id = ?', [recordId]);
    if (!record) {
      return res.status(404).json({ success: false, message: '记录不存在' });
    }

    const traces = await allQuery(
      'SELECT * FROM processing_traces WHERE record_id = ? ORDER BY action_time ASC',
      [recordId]
    );

    res.json({
      success: true,
      data: {
        record: record,
        traces: traces
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/batches/:batchId/records', async (req, res) => {
  try {
    const records = await allQuery(
      `SELECT tr.*, rm.file_name
       FROM test_records tr
       LEFT JOIN raw_materials rm ON tr.material_id = rm.id
       WHERE tr.batch_id = ?
       ORDER BY tr.sample_no, tr.chamber_id, tr.sampling_month`,
      [req.params.batchId]
    );
    res.json({ success: true, data: records });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/chamber-events', async (req, res) => {
  try {
    const { chamber_id, event_type, start_time, end_time, temperature, humidity, remark } = req.body;

    if (!chamber_id || !event_type || !start_time) {
      return res.status(400).json({ success: false, message: '缺少必要字段' });
    }

    const eventId = uuidv4();
    await runQuery(
      'INSERT INTO chamber_events (id, chamber_id, event_type, start_time, end_time, temperature, humidity, remark) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [eventId, chamber_id, event_type, start_time, end_time, temperature, humidity, remark]
    );

    if (event_type === 'overtemp') {
      const affectedRecords = await allQuery(
        `SELECT * FROM test_records
         WHERE chamber_id = ?
         AND status != 'completed'
         AND is_affected_by_overtemp = 0`,
        [chamber_id]
      );

      for (const record of affectedRecords) {
        await runQuery(
          `UPDATE test_records
           SET is_affected_by_overtemp = 1, overtemp_start = ?, overtemp_end = ?, status = 'suspended'
           WHERE id = ?`,
          [start_time, end_time, record.id]
        );

        await runQuery(
          'INSERT INTO processing_traces (id, record_id, action, remark) VALUES (?, ?, ?, ?)',
          [uuidv4(), record.id, 'suspended', `环境箱${chamber_id}超温，试验暂停`]
        );
      }

      return res.json({
        success: true,
        eventId: eventId,
        affectedCount: affectedRecords.length,
        message: `已标记 ${affectedRecords.length} 条受影响的记录`
      });
    }

    const event = await getQuery('SELECT * FROM chamber_events WHERE id = ?', [eventId]);
    res.json({ success: true, data: event });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/batches/:batchId/report', async (req, res) => {
  try {
    const batchId = req.params.batchId;
    const batch = await getQuery('SELECT * FROM batches WHERE id = ?', [batchId]);
    if (!batch) {
      return res.status(404).json({ success: false, message: '批次不存在' });
    }

    const records = await allQuery(
      `SELECT
        sample_no as "样品批号",
        chamber_id as "环境箱",
        condition_code as "试验条件",
        temperature as "温度(℃)",
        humidity as "湿度(%)",
        sampling_month as "取样月份",
        sampling_date as "取样日期",
        planned_test_date as "计划试验日期",
        actual_test_date as "实际试验日期",
        status as "状态",
        CASE WHEN is_affected_by_overtemp = 1 THEN '是' ELSE '否' END as "受超温影响",
        overtemp_start as "超温开始时间",
        overtemp_end as "超温结束时间"
      FROM test_records
      WHERE batch_id = ?
      ORDER BY sample_no, chamber_id, sampling_month`,
      [batchId]
    );

    if (req.query.format === 'csv') {
      const parser = new Parser();
      const csv = parser.parse(records);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="stability_report_${batch.batch_no}.csv"`);
      res.send('\uFEFF' + csv);
    } else {
      res.json({
        success: true,
        batch: batch,
        records: records,
        generatedAt: new Date().toISOString()
      });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/errors', async (req, res) => {
  try {
    const errors = await allQuery('SELECT * FROM errors ORDER BY created_at DESC');
    res.json({ success: true, data: errors });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

async function startServer() {
  await initDatabase();
  app.listen(PORT, () => {
    console.log(`药企稳定性试验排期API服务已启动: http://localhost:${PORT}`);
  });
}

startServer();
