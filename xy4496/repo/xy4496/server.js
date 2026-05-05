const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const multer = require('multer');
const Papa = require('papaparse');
const path = require('path');
const fs = require('fs');

const db = require('./database');
const riskAnalysis = require('./riskAnalysis');

const app = express();
const PORT = process.env.PORT || 3000;

const upload = multer({ dest: 'uploads/' });

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, 'public')));

async function initApp() {
  await db.initDatabase();
  console.log('应用初始化完成');
}

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/orders', (req, res) => {
  const orders = db.all(`
    SELECT o.*, 
      ra.overall_risk, ra.review_status,
      ra.pressure_risk, ra.moisture_risk, ra.stack_risk
    FROM orders o
    LEFT JOIN risk_assessments ra ON o.order_number = ra.order_number
      AND ra.assessment_date = (
        SELECT MAX(assessment_date) FROM risk_assessments 
        WHERE order_number = o.order_number
      )
    ORDER BY o.created_at DESC
  `);
  res.json(orders);
});

app.get('/api/orders/:orderNumber', (req, res) => {
  const orderNumber = req.params.orderNumber;
  
  const order = db.get(`
    SELECT * FROM orders WHERE order_number = ?
  `, [orderNumber]);
  
  if (!order) {
    return res.status(404).json({ error: '订单不存在' });
  }

  const assessment = db.get(`
    SELECT * FROM risk_assessments 
    WHERE order_number = ? 
    ORDER BY assessment_date DESC 
    LIMIT 1
  `, [orderNumber]);

  const testResult = db.get(`
    SELECT tr.*, cb.corrugated_type, cb.paper_grade, cb.manufacturer
    FROM test_results tr
    LEFT JOIN cardboard_batches cb ON tr.batch_number = cb.batch_number
    WHERE tr.order_number = ?
    ORDER BY tr.test_date DESC
    LIMIT 1
  `, [orderNumber]);

  const loading = db.get(`
    SELECT * FROM loading_list WHERE order_number = ?
    ORDER BY loading_date DESC
    LIMIT 1
  `, [orderNumber]);

  const notes = db.all(`
    SELECT * FROM review_notes WHERE order_number = ?
    ORDER BY review_date DESC
  `, [orderNumber]);

  res.json({
    order,
    assessment,
    testResult,
    loading,
    notes
  });
});

app.post('/api/orders', (req, res) => {
  const { order_number, box_type, box_size, customer_name, quantity, production_date } = req.body;
  
  if (!order_number) {
    return res.status(400).json({ error: '订单号不能为空' });
  }

  const existing = db.get('SELECT id FROM orders WHERE order_number = ?', [order_number]);
  
  if (existing) {
    return res.status(400).json({ error: '订单号已存在' });
  }

  const result = db.run(`
    INSERT INTO orders (order_number, box_type, box_size, customer_name, quantity, production_date)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [order_number, box_type, box_size, customer_name, quantity, production_date]);

  if (result.success) {
    res.json({ success: true, id: result.lastInsertRowid, order_number });
  } else {
    res.status(500).json({ error: result.error });
  }
});

app.get('/api/batches', (req, res) => {
  const batches = db.all('SELECT * FROM cardboard_batches ORDER BY created_at DESC');
  res.json(batches);
});

app.post('/api/batches', (req, res) => {
  const { batch_number, corrugated_type, paper_grade, manufacturer, production_date, expiration_date } = req.body;
  
  if (!batch_number) {
    return res.status(400).json({ error: '批次号不能为空' });
  }

  const existing = db.get('SELECT id FROM cardboard_batches WHERE batch_number = ?', [batch_number]);
  
  if (existing) {
    return res.status(400).json({ error: '批次号已存在' });
  }

  const result = db.run(`
    INSERT INTO cardboard_batches (batch_number, corrugated_type, paper_grade, manufacturer, production_date, expiration_date)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [batch_number, corrugated_type, paper_grade, manufacturer, production_date, expiration_date]);

  if (result.success) {
    res.json({ success: true, id: result.lastInsertRowid, batch_number });
  } else {
    res.status(500).json({ error: result.error });
  }
});

app.get('/api/tests', (req, res) => {
  const tests = db.all(`
    SELECT tr.*, cb.corrugated_type, cb.paper_grade
    FROM test_results tr
    LEFT JOIN cardboard_batches cb ON tr.batch_number = cb.batch_number
    ORDER BY tr.test_date DESC
  `);
  res.json(tests);
});

app.post('/api/tests', (req, res) => {
  const { order_number, batch_number, edge_crush, edge_crush_min, burst_strength, burst_strength_min, test_date, tester } = req.body;
  
  if (!order_number) {
    return res.status(400).json({ error: '订单号不能为空' });
  }

  const result = db.run(`
    INSERT INTO test_results (order_number, batch_number, edge_crush, edge_crush_min, burst_strength, burst_strength_min, test_date, tester)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [order_number, batch_number, parseFloat(edge_crush), parseFloat(edge_crush_min), parseFloat(burst_strength), parseFloat(burst_strength_min), test_date, tester]);

  if (result.success) {
    res.json({ success: true, id: result.lastInsertRowid });
  } else {
    res.status(500).json({ error: result.error });
  }
});

app.get('/api/environment', (req, res) => {
  const env = db.all('SELECT * FROM warehouse_environment ORDER BY record_date DESC');
  res.json(env);
});

app.post('/api/environment', (req, res) => {
  const { record_date, temperature, humidity, location, recorded_by } = req.body;
  
  if (!record_date) {
    return res.status(400).json({ error: '记录日期不能为空' });
  }

  const result = db.run(`
    INSERT INTO warehouse_environment (record_date, temperature, humidity, location, recorded_by)
    VALUES (?, ?, ?, ?, ?)
  `, [record_date, parseFloat(temperature), parseFloat(humidity), location, recorded_by]);

  if (result.success) {
    res.json({ success: true, id: result.lastInsertRowid });
  } else {
    res.status(500).json({ error: result.error });
  }
});

app.get('/api/loading', (req, res) => {
  const loading = db.all('SELECT * FROM loading_list ORDER BY loading_date DESC');
  res.json(loading);
});

app.post('/api/loading', (req, res) => {
  const { order_number, vehicle_number, loading_date, stack_layers, total_weight, destination } = req.body;
  
  if (!order_number) {
    return res.status(400).json({ error: '订单号不能为空' });
  }

  const result = db.run(`
    INSERT INTO loading_list (order_number, vehicle_number, loading_date, stack_layers, total_weight, destination)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [order_number, vehicle_number, loading_date, parseInt(stack_layers), parseFloat(total_weight), destination]);

  if (result.success) {
    res.json({ success: true, id: result.lastInsertRowid });
  } else {
    res.status(500).json({ error: result.error });
  }
});

app.post('/api/analyze/:orderNumber', (req, res) => {
  const orderNumber = req.params.orderNumber;
  
  const order = db.get('SELECT * FROM orders WHERE order_number = ?', [orderNumber]);
  if (!order) {
    return res.status(404).json({ error: '订单不存在' });
  }

  const assessment = riskAnalysis.analyzeOrder(orderNumber);
  const saveResult = riskAnalysis.saveRiskAssessment(assessment);

  res.json({ ...assessment, saved: saveResult.success });
});

app.post('/api/analyze-all', (req, res) => {
  const results = riskAnalysis.analyzeAllOrders();
  res.json(results);
});

app.post('/api/orders/:orderNumber/override', (req, res) => {
  const orderNumber = req.params.orderNumber;
  const { manual_override, override_reason, override_by, notes } = req.body;

  const assessment = db.get(`
    SELECT id FROM risk_assessments 
    WHERE order_number = ? 
    ORDER BY assessment_date DESC 
    LIMIT 1
  `, [orderNumber]);

  if (!assessment) {
    return res.status(404).json({ error: '未找到评估记录' });
  }

  const result = db.run(`
    UPDATE risk_assessments SET
      manual_override = ?,
      override_reason = ?,
      override_by = ?,
      override_date = ?,
      review_status = 'reviewed',
      notes = ?
    WHERE order_number = ? AND assessment_date = (
      SELECT MAX(assessment_date) FROM risk_assessments WHERE order_number = ?
    )
  `, [manual_override, override_reason, override_by, new Date().toISOString(), notes, orderNumber, orderNumber]);

  if (result.success) {
    res.json({ success: true });
  } else {
    res.status(500).json({ error: result.error });
  }
});

app.post('/api/orders/:orderNumber/notes', (req, res) => {
  const orderNumber = req.params.orderNumber;
  const { note_type, content, reviewer } = req.body;

  const result = db.run(`
    INSERT INTO review_notes (order_number, note_type, content, reviewer)
    VALUES (?, ?, ?, ?)
  `, [orderNumber, note_type, content, reviewer]);

  if (result.success) {
    res.json({ success: true, id: result.lastInsertRowid });
  } else {
    res.status(500).json({ error: result.error });
  }
});

app.get('/api/statistics', (req, res) => {
  const totalOrders = db.get('SELECT COUNT(*) as count FROM orders');
  const highRisk = db.get(`
    SELECT COUNT(*) as count FROM risk_assessments ra
    INNER JOIN (
      SELECT order_number, MAX(assessment_date) as max_date
      FROM risk_assessments
      GROUP BY order_number
    ) latest ON ra.order_number = latest.order_number AND ra.assessment_date = latest.max_date
    WHERE (ra.manual_override IS NULL OR ra.manual_override = '') AND ra.overall_risk = 'high'
  `);
  const mediumRisk = db.get(`
    SELECT COUNT(*) as count FROM risk_assessments ra
    INNER JOIN (
      SELECT order_number, MAX(assessment_date) as max_date
      FROM risk_assessments
      GROUP BY order_number
    ) latest ON ra.order_number = latest.order_number AND ra.assessment_date = latest.max_date
    WHERE (ra.manual_override IS NULL OR ra.manual_override = '') AND ra.overall_risk = 'medium'
  `);
  const lowRisk = db.get(`
    SELECT COUNT(*) as count FROM risk_assessments ra
    INNER JOIN (
      SELECT order_number, MAX(assessment_date) as max_date
      FROM risk_assessments
      GROUP BY order_number
    ) latest ON ra.order_number = latest.order_number AND ra.assessment_date = latest.max_date
    WHERE (ra.manual_override IS NULL OR ra.manual_override = '') AND ra.overall_risk = 'low'
  `);
  const reviewed = db.get(`
    SELECT COUNT(*) as count FROM risk_assessments ra
    INNER JOIN (
      SELECT order_number, MAX(assessment_date) as max_date
      FROM risk_assessments
      GROUP BY order_number
    ) latest ON ra.order_number = latest.order_number AND ra.assessment_date = latest.max_date
    WHERE ra.review_status = 'reviewed'
  `);

  res.json({
    totalOrders: totalOrders?.count || 0,
    highRisk: highRisk?.count || 0,
    mediumRisk: mediumRisk?.count || 0,
    lowRisk: lowRisk?.count || 0,
    reviewed: reviewed?.count || 0
  });
});

app.get('/api/export/markdown/:orderNumber', (req, res) => {
  const orderNumber = req.params.orderNumber;
  
  const order = db.get('SELECT * FROM orders WHERE order_number = ?', [orderNumber]);
  if (!order) {
    return res.status(404).json({ error: '订单不存在' });
  }

  const assessment = db.get(`
    SELECT * FROM risk_assessments WHERE order_number = ? ORDER BY assessment_date DESC LIMIT 1
  `, [orderNumber]);

  const testResult = db.get(`
    SELECT * FROM test_results WHERE order_number = ? ORDER BY test_date DESC LIMIT 1
  `, [orderNumber]);

  const loading = db.get(`
    SELECT * FROM loading_list WHERE order_number = ? ORDER BY loading_date DESC LIMIT 1
  `, [orderNumber]);

  const notes = db.all(`
    SELECT * FROM review_notes WHERE order_number = ? ORDER BY review_date DESC
  `, [orderNumber]);

  const getRiskLabel = (risk) => {
    const labels = { high: '高风险', medium: '中风险', low: '低风险' };
    return labels[risk] || risk;
  };

  const getRiskBadge = (risk) => {
    const badges = { high: '🔴', medium: '🟡', low: '🟢' };
    return badges[risk] || '⚪';
  };

  const finalRisk = assessment?.manual_override || assessment?.overall_risk || 'low';
  const isOverridden = assessment?.manual_override && assessment?.manual_override !== assessment?.overall_risk;

  let markdown = `# 纸箱品质放行单\n\n`;
  markdown += `## 基本信息\n\n`;
  markdown += `| 项目 | 内容 |\n`;
  markdown += `|------|------|\n`;
  markdown += `| 订单号 | ${order.order_number} |\n`;
  markdown += `| 箱型 | ${order.box_type || '-'} |\n`;
  markdown += `| 尺寸 | ${order.box_size || '-'} |\n`;
  markdown += `| 客户 | ${order.customer_name || '-'} |\n`;
  markdown += `| 数量 | ${order.quantity || '-'} |\n`;
  markdown += `| 生产日期 | ${order.production_date || '-'} |\n\n`;

  markdown += `## 风险评估结果\n\n`;
  markdown += `### 综合评估: ${getRiskBadge(finalRisk)} ${getRiskLabel(finalRisk)}\n\n`;
  if (isOverridden) {
    markdown += `> ⚠️ 人工改判: 原评估为 ${getRiskBadge(assessment.overall_risk)} ${getRiskLabel(assessment.overall_risk)}\n`;
    markdown += `> 改判理由: ${assessment.override_reason || '-'}\n`;
    markdown += `> 改判人: ${assessment.override_by || '-'}\n`;
    markdown += `> 改判时间: ${assessment.override_date || '-'}\n\n`;
  }

  markdown += `| 风险类型 | 等级 | 说明 |\n`;
  markdown += `|----------|------|------|\n`;
  markdown += `| 抗压风险 | ${getRiskBadge(assessment?.pressure_risk)} ${getRiskLabel(assessment?.pressure_risk)} | ${assessment?.pressure_risk_reason || '-'} |\n`;
  markdown += `| 受潮风险 | ${getRiskBadge(assessment?.moisture_risk)} ${getRiskLabel(assessment?.moisture_risk)} | ${assessment?.moisture_risk_reason || '-'} |\n`;
  markdown += `| 堆码风险 | ${getRiskBadge(assessment?.stack_risk)} ${getRiskLabel(assessment?.stack_risk)} | ${assessment?.stack_risk_reason || '-'} |\n\n`;

  if (testResult) {
    markdown += `## 测试数据\n\n`;
    markdown += `| 项目 | 实测值 | 标准值 | 状态 |\n`;
    markdown += `|------|--------|--------|------|\n`;
    if (testResult.edge_crush !== null) {
      const edgeStatus = testResult.edge_crush >= (testResult.edge_crush_min || 0) ? '✅ 合格' : '❌ 不合格';
      markdown += `| 边压强度 | ${testResult.edge_crush} N/m | ${testResult.edge_crush_min || '-'} N/m | ${edgeStatus} |\n`;
    }
    if (testResult.burst_strength !== null) {
      const burstStatus = testResult.burst_strength >= (testResult.burst_strength_min || 0) ? '✅ 合格' : '❌ 不合格';
      markdown += `| 耐破强度 | ${testResult.burst_strength} kPa | ${testResult.burst_strength_min || '-'} kPa | ${burstStatus} |\n`;
    }
    markdown += `\n测试日期: ${testResult.test_date || '-'}\n`;
    markdown += `测试人员: ${testResult.tester || '-'}\n\n`;
  }

  if (loading) {
    markdown += `## 装车信息\n\n`;
    markdown += `| 项目 | 内容 |\n`;
    markdown += `|------|------|\n`;
    markdown += `| 车牌号 | ${loading.vehicle_number || '-'} |\n`;
    markdown += `| 装车日期 | ${loading.loading_date || '-'} |\n`;
    markdown += `| 堆码层数 | ${loading.stack_layers || '-'} 层 |\n`;
    markdown += `| 总重量 | ${loading.total_weight || '-'} kg |\n`;
    markdown += `| 目的地 | ${loading.destination || '-'} |\n\n`;
  }

  if (notes && notes.length > 0) {
    markdown += `## 复核备注\n\n`;
    notes.forEach((note, index) => {
      markdown += `### 备注 ${index + 1}\n`;
      markdown += `- 类型: ${note.note_type || '-'}\n`;
      markdown += `- 内容: ${note.content || '-'}\n`;
      markdown += `- 复核人: ${note.reviewer || '-'}\n`;
      markdown += `- 日期: ${note.review_date || '-'}\n\n`;
    });
  }

  markdown += `---\n\n`;
  markdown += `放行单生成时间: ${new Date().toISOString().split('T')[0]}\n`;
  markdown += `系统版本: 纸箱厂品控数据分析工具 v1.0\n`;

  res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="release-${orderNumber}.md"`);
  res.send(markdown);
});

app.get('/api/export/json/:orderNumber', (req, res) => {
  const orderNumber = req.params.orderNumber;
  
  const order = db.get('SELECT * FROM orders WHERE order_number = ?', [orderNumber]);
  if (!order) {
    return res.status(404).json({ error: '订单不存在' });
  }

  const assessment = db.get(`
    SELECT * FROM risk_assessments WHERE order_number = ? ORDER BY assessment_date DESC LIMIT 1
  `, [orderNumber]);

  const testResult = db.get(`
    SELECT tr.*, cb.corrugated_type, cb.paper_grade, cb.manufacturer, cb.production_date as batch_production_date
    FROM test_results tr
    LEFT JOIN cardboard_batches cb ON tr.batch_number = cb.batch_number
    WHERE tr.order_number = ? ORDER BY tr.test_date DESC LIMIT 1
  `, [orderNumber]);

  const loading = db.get(`
    SELECT * FROM loading_list WHERE order_number = ? ORDER BY loading_date DESC LIMIT 1
  `, [orderNumber]);

  const notes = db.all(`
    SELECT * FROM review_notes WHERE order_number = ? ORDER BY review_date DESC
  `, [orderNumber]);

  const auditData = {
    audit_id: `AUD-${Date.now()}`,
    audit_date: new Date().toISOString(),
    order: order,
    assessment: assessment,
    test_result: testResult,
    loading: loading,
    review_notes: notes,
    thresholds: riskAnalysis.THRESHOLDS
  };

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="audit-${orderNumber}.json"`);
  res.json(auditData);
});

app.post('/api/import/csv', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: '请上传文件' });
  }

  const dataType = req.body.data_type || 'orders';
  const filePath = req.file.path;

  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      fs.unlinkSync(filePath);
      return res.status(500).json({ error: '读取文件失败' });
    }

    const parsed = Papa.parse(data, { header: true, skipEmptyLines: true });
    
    if (parsed.errors.length > 0) {
      fs.unlinkSync(filePath);
      return res.status(400).json({ error: 'CSV解析错误', details: parsed.errors });
    }

    const records = parsed.data;
    let importedCount = 0;
    let failedCount = 0;
    const errors = [];

    records.forEach((record, index) => {
      try {
        let result;
        
        switch (dataType) {
          case 'orders':
            const existingOrder = db.get('SELECT id FROM orders WHERE order_number = ?', [record.order_number || record['订单号']]);
            if (!existingOrder) {
              result = db.run(`
                INSERT INTO orders (order_number, box_type, box_size, customer_name, quantity, production_date)
                VALUES (?, ?, ?, ?, ?, ?)
              `, [
                record.order_number || record['订单号'],
                record.box_type || record['箱型'],
                record.box_size || record['尺寸'],
                record.customer_name || record['客户'],
                parseInt(record.quantity || record['数量']) || null,
                record.production_date || record['生产日期']
              ]);
            }
            break;

          case 'batches':
            const existingBatch = db.get('SELECT id FROM cardboard_batches WHERE batch_number = ?', [record.batch_number || record['批次号']]);
            if (!existingBatch) {
              result = db.run(`
                INSERT INTO cardboard_batches (batch_number, corrugated_type, paper_grade, manufacturer, production_date, expiration_date)
                VALUES (?, ?, ?, ?, ?, ?)
              `, [
                record.batch_number || record['批次号'],
                record.corrugated_type || record['瓦楞类型'],
                record.paper_grade || record['纸质等级'],
                record.manufacturer || record['供应商'],
                record.production_date || record['生产日期'],
                record.expiration_date || record['有效期']
              ]);
            }
            break;

          case 'tests':
            result = db.run(`
              INSERT INTO test_results (order_number, batch_number, edge_crush, edge_crush_min, burst_strength, burst_strength_min, test_date, tester)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `, [
              record.order_number || record['订单号'],
              record.batch_number || record['批次号'],
              parseFloat(record.edge_crush || record['边压强度']) || null,
              parseFloat(record.edge_crush_min || record['边压标准']) || null,
              parseFloat(record.burst_strength || record['耐破强度']) || null,
              parseFloat(record.burst_strength_min || record['耐破标准']) || null,
              record.test_date || record['测试日期'],
              record.tester || record['测试人']
            ]);
            break;

          case 'environment':
            result = db.run(`
              INSERT INTO warehouse_environment (record_date, temperature, humidity, location, recorded_by)
              VALUES (?, ?, ?, ?, ?)
            `, [
              record.record_date || record['日期'],
              parseFloat(record.temperature || record['温度']) || null,
              parseFloat(record.humidity || record['湿度']) || null,
              record.location || record['位置'],
              record.recorded_by || record['记录人']
            ]);
            break;

          case 'loading':
            result = db.run(`
              INSERT INTO loading_list (order_number, vehicle_number, loading_date, stack_layers, total_weight, destination)
              VALUES (?, ?, ?, ?, ?, ?)
            `, [
              record.order_number || record['订单号'],
              record.vehicle_number || record['车牌号'],
              record.loading_date || record['装车日期'],
              parseInt(record.stack_layers || record['堆码层数']) || null,
              parseFloat(record.total_weight || record['总重量']) || null,
              record.destination || record['目的地']
            ]);
            break;

          default:
            throw new Error(`未知数据类型: ${dataType}`);
        }

        if (result?.success !== false) {
          importedCount++;
        } else {
          failedCount++;
          errors.push({ row: index + 1, error: result?.error || '插入失败' });
        }
      } catch (e) {
        failedCount++;
        errors.push({ row: index + 1, error: e.message });
      }
    });

    fs.unlinkSync(filePath);

    res.json({
      success: true,
      total: records.length,
      imported: importedCount,
      failed: failedCount,
      errors: errors.slice(0, 10)
    });
  });
});

app.post('/api/import/json', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: '请上传文件' });
  }

  const filePath = req.file.path;

  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      fs.unlinkSync(filePath);
      return res.status(500).json({ error: '读取文件失败' });
    }

    try {
      const jsonData = JSON.parse(data);
      let importedCount = 0;
      let failedCount = 0;
      const errors = [];

      if (jsonData.orders) {
        jsonData.orders.forEach((order, index) => {
          try {
            const existing = db.get('SELECT id FROM orders WHERE order_number = ?', [order.order_number]);
            if (!existing) {
              const result = db.run(`
                INSERT INTO orders (order_number, box_type, box_size, customer_name, quantity, production_date)
                VALUES (?, ?, ?, ?, ?, ?)
              `, [order.order_number, order.box_type, order.box_size, order.customer_name, order.quantity, order.production_date]);
              if (result.success) importedCount++;
              else failedCount++;
            }
          } catch (e) {
            failedCount++;
            errors.push({ row: index + 1, error: e.message });
          }
        });
      }

      if (jsonData.batches) {
        jsonData.batches.forEach((batch, index) => {
          try {
            const existing = db.get('SELECT id FROM cardboard_batches WHERE batch_number = ?', [batch.batch_number]);
            if (!existing) {
              const result = db.run(`
                INSERT INTO cardboard_batches (batch_number, corrugated_type, paper_grade, manufacturer, production_date, expiration_date)
                VALUES (?, ?, ?, ?, ?, ?)
              `, [batch.batch_number, batch.corrugated_type, batch.paper_grade, batch.manufacturer, batch.production_date, batch.expiration_date]);
              if (result.success) importedCount++;
              else failedCount++;
            }
          } catch (e) {
            failedCount++;
            errors.push({ row: index + 1, error: e.message });
          }
        });
      }

      if (jsonData.tests) {
        jsonData.tests.forEach((test, index) => {
          try {
            const result = db.run(`
              INSERT INTO test_results (order_number, batch_number, edge_crush, edge_crush_min, burst_strength, burst_strength_min, test_date, tester)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `, [test.order_number, test.batch_number, test.edge_crush, test.edge_crush_min, test.burst_strength, test.burst_strength_min, test.test_date, test.tester]);
            if (result.success) importedCount++;
            else failedCount++;
          } catch (e) {
            failedCount++;
            errors.push({ row: index + 1, error: e.message });
          }
        });
      }

      if (jsonData.environment) {
        jsonData.environment.forEach((env, index) => {
          try {
            const result = db.run(`
              INSERT INTO warehouse_environment (record_date, temperature, humidity, location, recorded_by)
              VALUES (?, ?, ?, ?, ?)
            `, [env.record_date, env.temperature, env.humidity, env.location, env.recorded_by]);
            if (result.success) importedCount++;
            else failedCount++;
          } catch (e) {
            failedCount++;
            errors.push({ row: index + 1, error: e.message });
          }
        });
      }

      if (jsonData.loading) {
        jsonData.loading.forEach((load, index) => {
          try {
            const result = db.run(`
              INSERT INTO loading_list (order_number, vehicle_number, loading_date, stack_layers, total_weight, destination)
              VALUES (?, ?, ?, ?, ?, ?)
            `, [load.order_number, load.vehicle_number, load.loading_date, load.stack_layers, load.total_weight, load.destination]);
            if (result.success) importedCount++;
            else failedCount++;
          } catch (e) {
            failedCount++;
            errors.push({ row: index + 1, error: e.message });
          }
        });
      }

      fs.unlinkSync(filePath);

      res.json({
        success: true,
        imported: importedCount,
        failed: failedCount,
        errors: errors.slice(0, 10)
      });
    } catch (e) {
      fs.unlinkSync(filePath);
      res.status(400).json({ error: 'JSON解析错误', details: e.message });
    }
  });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

initApp().then(() => {
  app.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}`);
    console.log(`请在浏览器中打开 http://localhost:${PORT} 访问应用`);
  });
});
