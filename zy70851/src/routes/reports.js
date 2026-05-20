const express = require('express');
const { v4: uuidv4 } = require('uuid');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const path = require('path');
const fs = require('fs');
const { get, all, run } = require('../db');

const router = express.Router();

const reportsDir = path.join(__dirname, '../../reports');
if (!fs.existsSync(reportsDir)) {
  fs.mkdirSync(reportsDir, { recursive: true });
}

router.get('/batch/:batchId/summary', async (req, res) => {
  try {
    const { batchId } = req.params;
    const batch = await get('SELECT * FROM batches WHERE id = ?', [batchId]);
    if (!batch) {
      return res.status(404).json({ error: '批次不存在' });
    }

    const claims = await all('SELECT * FROM claim_materials WHERE batch_id = ?', [batchId]);
    const results = await all('SELECT * FROM precheck_results WHERE batch_id = ?', [batchId]);

    const summary = {
      batch_id: batch.id,
      batch_no: batch.batch_no,
      operator: batch.operator,
      created_at: batch.created_at,
      total_claims: claims.length,
      total_amount: claims.reduce((sum, c) => sum + parseFloat(c.claim_amount), 0),
      precheck_completed: results.length,
      categories: {
        normal: results.filter(r => r.category === 'normal').length,
        supplement: results.filter(r => r.category === 'supplement').length,
        blocked: results.filter(r => r.category === 'blocked').length,
        manual_review: results.filter(r => r.needs_manual_review === 1).length
      },
      category_amounts: {
        normal: results.filter(r => r.category === 'normal').reduce((sum, r) => {
          const claim = claims.find(c => c.id === r.claim_id);
          return sum + (claim ? parseFloat(claim.claim_amount) : 0);
        }, 0),
        supplement: results.filter(r => r.category === 'supplement').reduce((sum, r) => {
          const claim = claims.find(c => c.id === r.claim_id);
          return sum + (claim ? parseFloat(claim.claim_amount) : 0);
        }, 0),
        blocked: results.filter(r => r.category === 'blocked').reduce((sum, r) => {
          const claim = claims.find(c => c.id === r.claim_id);
          return sum + (claim ? parseFloat(claim.claim_amount) : 0);
        }, 0)
      }
    };

    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/batch/:batchId/export', async (req, res) => {
  try {
    const { batchId } = req.params;
    const { format = 'csv' } = req.body;

    const batch = await get('SELECT * FROM batches WHERE id = ?', [batchId]);
    if (!batch) {
      return res.status(404).json({ error: '批次不存在' });
    }

    const claims = await all('SELECT * FROM claim_materials WHERE batch_id = ?', [batchId]);
    const results = await all('SELECT * FROM precheck_results WHERE batch_id = ?', [batchId]);

    const taskId = uuidv4();
    await run(
      'INSERT INTO task_status (id, batch_id, status, message) VALUES (?, ?, ?, ?)',
      [taskId, batchId, 'exported', `报告已导出，格式：${format}`]
    );

    await run('UPDATE batches SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', ['exported', batchId]);

    if (format === 'csv') {
      const records = results.map(result => {
        const claim = claims.find(c => c.id === result.claim_id);
        const policy = JSON.parse(result.policy_responsibility || '{}');
        const gaps = JSON.parse(result.material_gaps || '[]');
        const duplicate = JSON.parse(result.duplicate_claim || '{}');
        const reasons = JSON.parse(result.reasons || '[]');
        const nextActions = JSON.parse(result.next_actions || '[]');

        return {
          批次编号: batch.batch_no,
          报案号: claim ? claim.claim_no : '',
          保单号: claim ? claim.policy_no : '',
          被保人: claim ? claim.insured_name : '',
          身份证号: claim ? claim.insured_id_card : '',
          事故日期: claim ? claim.accident_date : '',
          诊断: claim ? claim.diagnosis : '',
          理赔金额: claim ? claim.claim_amount : 0,
          医院: claim ? claim.hospital : '',
          预审分类: result.category,
          是否属于责任: policy.covered ? '是' : '否',
          责任说明: policy.responsibility || '',
          材料缺口数: gaps.length,
          是否重复报案: duplicate.is_duplicate ? '是' : '否',
          需要人工复核: result.needs_manual_review === 1 ? '是' : '否',
          复核原因: result.review_reason || '',
          问题原因: reasons.join('; '),
          后续动作: nextActions.join('; '),
          预审时间: result.created_at
        };
      });

      const filename = `precheck-report-${batch.batch_no}-${Date.now()}.csv`;
      const filePath = path.join(reportsDir, filename);

      const csvWriter = createCsvWriter({
        path: filePath,
        header: [
          { id: '批次编号', title: '批次编号' },
          { id: '报案号', title: '报案号' },
          { id: '保单号', title: '保单号' },
          { id: '被保人', title: '被保人' },
          { id: '身份证号', title: '身份证号' },
          { id: '事故日期', title: '事故日期' },
          { id: '诊断', title: '诊断' },
          { id: '理赔金额', title: '理赔金额' },
          { id: '医院', title: '医院' },
          { id: '预审分类', title: '预审分类' },
          { id: '是否属于责任', title: '是否属于责任' },
          { id: '责任说明', title: '责任说明' },
          { id: '材料缺口数', title: '材料缺口数' },
          { id: '是否重复报案', title: '是否重复报案' },
          { id: '需要人工复核', title: '需要人工复核' },
          { id: '复核原因', title: '复核原因' },
          { id: '问题原因', title: '问题原因' },
          { id: '后续动作', title: '后续动作' },
          { id: '预审时间', title: '预审时间' }
        ]
      });

      await csvWriter.writeRecords(records);

      res.json({
        success: true,
        format: 'csv',
        filename,
        download_url: `/api/reports/download/${filename}`,
        record_count: records.length
      });
    } else if (format === 'json') {
      const filename = `precheck-report-${batch.batch_no}-${Date.now()}.json`;
      const filePath = path.join(reportsDir, filename);

      const reportData = {
        batch_info: batch,
        export_time: new Date().toISOString(),
        total_records: results.length,
        records: results.map(result => {
          const claim = claims.find(c => c.id === result.claim_id);
          return {
            claim: claim ? {
              claim_no: claim.claim_no,
              policy_no: claim.policy_no,
              insured_name: claim.insured_name,
              insured_id_card: claim.insured_id_card,
              accident_date: claim.accident_date,
              diagnosis: claim.diagnosis,
              claim_amount: claim.claim_amount,
              hospital: claim.hospital
            } : null,
            precheck_result: {
              category: result.category,
              policy_responsibility: JSON.parse(result.policy_responsibility || '{}'),
              material_gaps: JSON.parse(result.material_gaps || '[]'),
              duplicate_claim: JSON.parse(result.duplicate_claim || '{}'),
              reasons: JSON.parse(result.reasons || '[]'),
              next_actions: JSON.parse(result.next_actions || '[]'),
              needs_manual_review: result.needs_manual_review === 1,
              review_reason: result.review_reason
            }
          };
        })
      };

      fs.writeFileSync(filePath, JSON.stringify(reportData, null, 2), 'utf8');

      res.json({
        success: true,
        format: 'json',
        filename,
        download_url: `/api/reports/download/${filename}`,
        record_count: results.length
      });
    } else {
      res.status(400).json({ error: '不支持的格式，仅支持 csv 和 json' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/download/:filename', (req, res) => {
  try {
    const { filename } = req.params;
    const filePath = path.join(reportsDir, filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: '文件不存在' });
    }

    res.download(filePath, filename, (err) => {
      if (err) {
        res.status(500).json({ error: '下载失败' });
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
