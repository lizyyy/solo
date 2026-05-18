const express = require('express');
const router = express.Router();
const QuoteLockService = require('../services/quoteLockService');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const multer = require('multer');
const csvParser = require('csv-parser');
const fs = require('fs');
const path = require('path');

const upload = multer({ dest: 'uploads/' });

router.post('/', async (req, res) => {
  try {
    const operator = req.headers['x-operator'] || 'system';
    const result = await QuoteLockService.create(req.body, operator);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const operator = req.headers['x-operator'] || 'system';
    const result = await QuoteLockService.update(req.params.id, req.body, operator);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const data = await QuoteLockService.query(req.query);
    res.json({ success: true, data });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const data = await QuoteLockService.getById(req.params.id);
    res.json({ success: true, data });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/:id/history', async (req, res) => {
  try {
    const data = await QuoteLockService.getHistory(req.params.id);
    res.json({ success: true, data });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/batch-import', upload.single('file'), async (req, res) => {
  try {
    const operator = req.headers['x-operator'] || 'system';
    const records = [];
    
    fs.createReadStream(req.file.path)
      .pipe(csvParser())
      .on('data', (row) => {
        records.push({
          customer_id: row.customer_id,
          customer_name: row.customer_name,
          store_id: row.store_id,
          store_name: row.store_name,
          product_type: row.product_type,
          paper_type: row.paper_type,
          paper_size: row.paper_size,
          width: parseFloat(row.width),
          height: parseFloat(row.height),
          quantity: parseInt(row.quantity),
          color_mode: row.color_mode,
          double_sided: row.double_sided === '1' || row.double_sided === 'true',
          locked_price: row.locked_price ? parseFloat(row.locked_price) : undefined,
          status: row.status || 'pending',
          responsible_person: row.responsible_person,
          lock_date: row.lock_date,
          valid_from: row.valid_from,
          valid_to: row.valid_to,
          review_conclusion: row.review_conclusion
        });
      })
      .on('end', async () => {
        fs.unlinkSync(req.file.path);
        const result = await QuoteLockService.batchImport(records, operator);
        res.json({ success: true, data: result });
      });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/export', async (req, res) => {
  try {
    const data = await QuoteLockService.export(req.query);
    
    const exportDir = path.join(__dirname, '../../exports');
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }
    
    const filename = `quote-locks-${Date.now()}.csv`;
    const filePath = path.join(exportDir, filename);
    
    const csvWriter = createCsvWriter({
      path: filePath,
      header: [
        { id: 'quote_no', title: '锁价单号' },
        { id: 'customer_id', title: '客户编号' },
        { id: 'customer_name', title: '客户名称' },
        { id: 'store_id', title: '门店编号' },
        { id: 'store_name', title: '门店名称' },
        { id: 'product_type', title: '产品类型' },
        { id: 'paper_type', title: '纸张类型' },
        { id: 'paper_size', title: '纸张规格' },
        { id: 'width', title: '宽度(mm)' },
        { id: 'height', title: '高度(mm)' },
        { id: 'quantity', title: '数量' },
        { id: 'color_mode', title: '颜色模式' },
        { id: 'double_sided', title: '是否双面' },
        { id: 'original_price', title: '原始报价' },
        { id: 'locked_price', title: '锁定价格' },
        { id: 'discount_rate', title: '折扣率(%)' },
        { id: 'status', title: '状态' },
        { id: 'responsible_person', title: '负责人' },
        { id: 'lock_date', title: '锁价日期' },
        { id: 'valid_from', title: '有效期起' },
        { id: 'valid_to', title: '有效期止' },
        { id: 'batch_no', title: '处理批次' },
        { id: 'review_conclusion', title: '复核结论' },
        { id: 'version', title: '版本' }
      ]
    });
    
    await csvWriter.writeRecords(data);
    
    res.download(filePath, filename, (err) => {
      if (err) console.error('下载失败:', err);
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

module.exports = router;
