const express = require('express');
const router = express.Router();
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const { run } = require('../database/db');
const TimelineService = require('../services/timelineService');

const upload = multer({ dest: path.join(__dirname, '../uploads/') });

router.post('/ayis', upload.single('file'), async (req, res) => {
  try {
    const results = [];
    const errors = [];
    
    fs.createReadStream(req.file.path)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', async () => {
        let successCount = 0;
        
        for (const row of results) {
          try {
            const ayiId = `AYI-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
            await run(
              `INSERT INTO ayi_profiles (ayi_id, name, phone, id_card, skills, experience_years) 
               VALUES (?, ?, ?, ?, ?, ?)`,
              [ayiId, row.name || row.姓名, row.phone || row.电话, row.id_card || row.身份证, row.skills || row.技能, parseInt(row.experience_years || row.经验年数) || 0]
            );
            successCount++;
          } catch (err) {
            errors.push({ row: JSON.stringify(row), error: err.message });
          }
        }

        fs.unlinkSync(req.file.path);

        await TimelineService.record(
          'batch_import_ayis',
          'ayi',
          null,
          'completed',
          successCount > 0 ? 'success' : 'failed',
          `批量导入阿姨档案: 成功${successCount}条, 失败${errors.length}条`,
          req.body.operator || 'system',
          { successCount, errorCount: errors.length }
        );

        res.json({ 
          success: true, 
          success_count: successCount, 
          error_count: errors.length,
          errors: errors 
        });
      });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/requirements', upload.single('file'), async (req, res) => {
  try {
    const results = [];
    const errors = [];
    
    fs.createReadStream(req.file.path)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', async () => {
        let successCount = 0;
        
        for (const row of results) {
          try {
            const reqId = `REQ-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
            await run(
              `INSERT INTO customer_requirements (req_id, customer_name, customer_phone, address, service_type, requirements, budget_min, budget_max) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                reqId, 
                row.customer_name || row.客户姓名, 
                row.customer_phone || row.客户电话, 
                row.address || row.地址, 
                row.service_type || row.服务类型, 
                row.requirements || row.需求描述,
                parseFloat(row.budget_min || row.预算最低) || 0,
                parseFloat(row.budget_max || row.预算最高) || 0
              ]
            );
            successCount++;
          } catch (err) {
            errors.push({ row: JSON.stringify(row), error: err.message });
          }
        }

        fs.unlinkSync(req.file.path);

        await TimelineService.record(
          'batch_import_requirements',
          'requirement',
          null,
          'completed',
          successCount > 0 ? 'success' : 'failed',
          `批量导入客户需求: 成功${successCount}条, 失败${errors.length}条`,
          req.body.operator || 'system',
          { successCount, errorCount: errors.length }
        );

        res.json({ 
          success: true, 
          success_count: successCount, 
          error_count: errors.length,
          errors: errors 
        });
      });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;