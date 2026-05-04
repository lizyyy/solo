const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const dayjs = require('dayjs');
const db = require('../config/database');
const { 
  importCustomers, 
  importOrders, 
  importTaxonomy, 
  importCallNotes 
} = require('../services/dataImporter');
const { 
  getDashboardData, 
  exportToMarkdown, 
  exportToHTML, 
  exportToCSV, 
  exportToJSON 
} = require('../services/reportExporter');
const { loadTaxonomy, attributeCall, extractCommitments } = require('../services/textAnalyzer');

const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({ storage: storage });

router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

router.get('/dashboard', (req, res) => {
  try {
    const filters = {
      agentName: req.query.agentName,
      category: req.query.category,
      region: req.query.region,
      startDate: req.query.startDate,
      endDate: req.query.endDate
    };
    const data = getDashboardData(filters);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: '获取看板数据失败', detail: err.message });
  }
});

router.get('/calls', (req, res) => {
  try {
    const { 
      customer_id, 
      order_id, 
      agent_name, 
      region, 
      start_date, 
      end_date,
      limit = 100,
      offset = 0
    } = req.query;

    let conditions = [];
    let params = [];

    if (customer_id) {
      conditions.push('cn.customer_id = ?');
      params.push(customer_id);
    }
    if (order_id) {
      conditions.push('cn.order_id = ?');
      params.push(order_id);
    }
    if (agent_name) {
      conditions.push('cn.agent_name LIKE ?');
      params.push(`%${agent_name}%`);
    }
    if (region) {
      conditions.push('cn.region = ?');
      params.push(region);
    }
    if (start_date) {
      conditions.push('cn.call_time >= ?');
      params.push(start_date);
    }
    if (end_date) {
      conditions.push('cn.call_time <= ?');
      params.push(end_date);
    }

    const whereClause = conditions.length > 0 
      ? 'WHERE ' + conditions.join(' AND ') 
      : '';

    const calls = db.prepare(`
      SELECT 
        cn.*,
        c.name as category_name,
        a.confidence,
        a.evidence,
        a.is_manual,
        cust.name as customer_name
      FROM call_notes cn
      LEFT JOIN attributions a ON cn.call_id = a.call_id
      LEFT JOIN categories c ON a.category_code = c.code
      LEFT JOIN customers cust ON cn.customer_id = cust.customer_id
      ${whereClause}
      ORDER BY cn.call_time DESC
      LIMIT ? OFFSET ?
    `).all(...params, parseInt(limit), parseInt(offset));

    const total = db.prepare(`
      SELECT COUNT(*) as count FROM call_notes cn
      ${whereClause}
    `).get(...params);

    res.json({
      calls,
      total: total.count,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (err) {
    res.status(500).json({ error: '获取通话列表失败', detail: err.message });
  }
});

router.get('/calls/:callId', (req, res) => {
  try {
    const { callId } = req.params;

    const call = db.prepare(`
      SELECT 
        cn.*,
        c.name as category_name,
        a.confidence,
        a.keywords as attribution_keywords,
        a.evidence,
        a.is_manual,
        cust.name as customer_name,
        cust.phone as customer_phone,
        cust.email as customer_email,
        cust.region as customer_region,
        o.product_name,
        o.purchase_date
      FROM call_notes cn
      LEFT JOIN attributions a ON cn.call_id = a.call_id
      LEFT JOIN categories c ON a.category_code = c.code
      LEFT JOIN customers cust ON cn.customer_id = cust.customer_id
      LEFT JOIN orders o ON cn.order_id = o.order_id
      WHERE cn.call_id = ?
    `).get(callId);

    if (!call) {
      return res.status(404).json({ error: '通话记录不存在' });
    }

    const commitments = db.prepare(`
      SELECT * FROM commitments WHERE call_id = ?
    `).all(callId);

    const otherCalls = db.prepare(`
      SELECT cn.call_id, cn.call_time, cn.raw_text, c.name as category_name
      FROM call_notes cn
      LEFT JOIN attributions a ON cn.call_id = a.call_id
      LEFT JOIN categories c ON a.category_code = c.code
      WHERE cn.customer_id = ? AND cn.call_id != ?
      ORDER BY cn.call_time DESC
      LIMIT 10
    `).all(call.customer_id, callId);

    res.json({
      call,
      commitments,
      otherCalls,
      categories: db.prepare('SELECT * FROM categories ORDER BY name').all()
    });
  } catch (err) {
    res.status(500).json({ error: '获取通话详情失败', detail: err.message });
  }
});

router.put('/calls/:callId/attribution', (req, res) => {
  try {
    const { callId } = req.params;
    const { category_code } = req.body;

    if (!category_code) {
      return res.status(400).json({ error: '缺少分类代码' });
    }

    const category = db.prepare('SELECT * FROM categories WHERE code = ?').get(category_code);
    if (!category) {
      return res.status(404).json({ error: '分类不存在' });
    }

    const call = db.prepare('SELECT * FROM call_notes WHERE call_id = ?').get(callId);
    if (!call) {
      return res.status(404).json({ error: '通话记录不存在' });
    }

    db.prepare(`
      DELETE FROM attributions WHERE call_id = ?
    `).run(callId);

    db.prepare(`
      INSERT INTO attributions (call_id, category_code, confidence, evidence, is_manual)
      VALUES (?, ?, 1.0, ?, 1)
    `).run(callId, category_code, `人工修改为: ${category.name}`);

    res.json({ 
      success: true, 
      message: '归因已更新',
      category: { code: category.code, name: category.name }
    });
  } catch (err) {
    res.status(500).json({ error: '更新归因失败', detail: err.message });
  }
});

router.put('/commitments/:commitmentId', (req, res) => {
  try {
    const { commitmentId } = req.params;
    const { status, follow_up_note } = req.body;

    const commitment = db.prepare('SELECT * FROM commitments WHERE id = ?').get(commitmentId);
    if (!commitment) {
      return res.status(404).json({ error: '承诺记录不存在' });
    }

    const updateFields = [];
    const updateValues = [];

    if (status) {
      updateFields.push('status = ?');
      updateValues.push(status);
    }
    if (follow_up_note) {
      updateFields.push('follow_up_note = ?');
      updateValues.push(follow_up_note);
    }
    if (status === 'completed') {
      updateFields.push('followed_up_at = ?');
      updateValues.push(dayjs().format('YYYY-MM-DD HH:mm:ss'));
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: '没有需要更新的字段' });
    }

    updateValues.push(commitmentId);

    db.prepare(`
      UPDATE commitments 
      SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(...updateValues);

    res.json({ success: true, message: '承诺已更新' });
  } catch (err) {
    res.status(500).json({ error: '更新承诺失败', detail: err.message });
  }
});

router.post('/import/customers', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请上传文件' });
    }
    const result = await importCustomers(req.file.path);
    fs.unlinkSync(req.file.path);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: '导入客户数据失败', detail: err.message });
  }
});

router.post('/import/orders', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请上传文件' });
    }
    const result = await importOrders(req.file.path);
    fs.unlinkSync(req.file.path);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: '导入订单数据失败', detail: err.message });
  }
});

router.post('/import/taxonomy', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请上传文件' });
    }
    const result = await importTaxonomy(req.file.path);
    fs.unlinkSync(req.file.path);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: '导入分类数据失败', detail: err.message });
  }
});

router.post('/import/calls', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请上传文件' });
    }
    const result = await importCallNotes(req.file.path);
    fs.unlinkSync(req.file.path);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: '导入通话数据失败', detail: err.message });
  }
});

router.get('/export/:format', (req, res) => {
  try {
    const { format } = req.params;
    const filters = {
      agentName: req.query.agentName,
      category: req.query.category,
      region: req.query.region,
      startDate: req.query.startDate,
      endDate: req.query.endDate
    };

    const data = getDashboardData(filters);
    const timestamp = dayjs().format('YYYYMMDD_HHmmss');

    switch (format.toLowerCase()) {
      case 'md':
      case 'markdown':
        const mdContent = exportToMarkdown(data);
        res.setHeader('Content-Type', 'text/markdown');
        res.setHeader('Content-Disposition', `attachment; filename="report_${timestamp}.md"`);
        res.send(mdContent);
        break;

      case 'html':
        const htmlContent = exportToHTML(data);
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="report_${timestamp}.html"`);
        res.send(htmlContent);
        break;

      case 'csv':
        const csvContent = exportToCSV(data);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="report_${timestamp}.csv"`);
        res.send('\uFEFF' + csvContent);
        break;

      case 'json':
        const jsonContent = exportToJSON(data);
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="report_${timestamp}.json"`);
        res.send(jsonContent);
        break;

      default:
        res.status(400).json({ error: '不支持的导出格式', supported: ['markdown', 'html', 'csv', 'json'] });
    }
  } catch (err) {
    res.status(500).json({ error: '导出报告失败', detail: err.message });
  }
});

router.get('/categories', (req, res) => {
  try {
    const categories = db.prepare('SELECT * FROM categories ORDER BY name').all();
    res.json(categories);
  } catch (err) {
    res.status(500).json({ error: '获取分类失败', detail: err.message });
  }
});

router.get('/agents', (req, res) => {
  try {
    const agents = db.prepare(`
      SELECT DISTINCT agent_name FROM call_notes 
      WHERE agent_name IS NOT NULL AND agent_name != ''
      ORDER BY agent_name
    `).all();
    res.json(agents.map(a => a.agent_name));
  } catch (err) {
    res.status(500).json({ error: '获取客服列表失败', detail: err.message });
  }
});

router.get('/regions', (req, res) => {
  try {
    const regions = db.prepare(`
      SELECT DISTINCT region FROM call_notes 
      WHERE region IS NOT NULL AND region != ''
      ORDER BY region
    `).all();
    res.json(regions.map(r => r.region));
  } catch (err) {
    res.status(500).json({ error: '获取地区列表失败', detail: err.message });
  }
});

router.post('/analyze', (req, res) => {
  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ error: '请提供要分析的文本' });
    }

    const categories = loadTaxonomy();
    const attribution = attributeCall(text, categories);
    const commitments = extractCommitments(text);

    res.json({
      attribution,
      commitments
    });
  } catch (err) {
    res.status(500).json({ error: '分析失败', detail: err.message });
  }
});

router.get('/commitments/overdue', (req, res) => {
  try {
    const today = dayjs().format('YYYY-MM-DD');
    const overdue = db.prepare(`
      SELECT 
        c.*,
        cn.call_id,
        cn.agent_name,
        cn.customer_id,
        cust.name as customer_name
      FROM commitments c
      JOIN call_notes cn ON c.call_id = cn.call_id
      LEFT JOIN customers cust ON cn.customer_id = cust.customer_id
      WHERE c.status = 'pending' AND c.deadline < ?
      ORDER BY c.deadline ASC
    `).all(today);

    db.exec(`
      UPDATE commitments 
      SET status = 'overdue' 
      WHERE status = 'pending' AND deadline < '${today}'
    `);

    res.json(overdue);
  } catch (err) {
    res.status(500).json({ error: '获取逾期承诺失败', detail: err.message });
  }
});

module.exports = router;
