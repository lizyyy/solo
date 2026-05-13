const express = require('express');
const router = express.Router();
const transactionModel = require('../models/transaction');
const { success, error } = require('../utils/response');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

router.get('/', async (req, res) => {
  try {
    const filter = {};
    if (req.query.transaction_type) filter.transaction_type = req.query.transaction_type;
    if (req.query.status) filter.status = req.query.status;
    if (req.query.sample_id) filter.sample_id = req.query.sample_id;
    if (req.query.schedule_id) filter.schedule_id = req.query.schedule_id;
    if (req.query.host_id) filter.host_id = req.query.host_id;
    if (req.query.responsible_person_id) filter.responsible_person_id = req.query.responsible_person_id;
    if (req.query.start_date) filter.start_date = req.query.start_date;
    if (req.query.end_date) filter.end_date = req.query.end_date;
    if (req.query.keyword) filter.keyword = req.query.keyword;
    
    const transactions = await transactionModel.getAllTransactions(filter);
    res.json(success(transactions));
  } catch (err) {
    res.status(500).json(error(err.message));
  }
});

router.get('/anomalies', async (req, res) => {
  try {
    const anomalies = await transactionModel.getAnomalies();
    res.json(success(anomalies));
  } catch (err) {
    res.status(500).json(error(err.message));
  }
});

router.get('/:id', async (req, res) => {
  try {
    const transaction = await transactionModel.getTransactionById(req.params.id);
    if (!transaction) {
      return res.status(404).json(error('交易记录不存在'));
    }
    res.json(success(transaction));
  } catch (err) {
    res.status(500).json(error(err.message));
  }
});

router.post('/', async (req, res) => {
  try {
    const { 
      transaction_type, 
      sample_id, 
      schedule_id, 
      host_id, 
      quantity, 
      loss_description, 
      responsible_person_id, 
      created_by 
    } = req.body;
    
    if (!transaction_type || !sample_id || !schedule_id || !quantity) {
      return res.status(400).json(error('交易类型、样品ID、排期ID和数量不能为空'));
    }
    
    if (!['borrow', 'return', 'sell', 'loss'].includes(transaction_type)) {
      return res.status(400).json(error('无效的交易类型'));
    }
    
    if (quantity <= 0) {
      return res.status(400).json(error('数量必须大于0'));
    }
    
    const transaction = await transactionModel.createTransaction({
      transaction_type,
      sample_id,
      schedule_id,
      host_id,
      quantity,
      loss_description,
      responsible_person_id,
      created_by
    });
    
    res.json(success(transaction, '交易记录创建成功'));
  } catch (err) {
    res.status(400).json(error(err.message));
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { change_reason, updated_by, ...updateData } = req.body;
    const transaction = await transactionModel.updateTransaction(req.params.id, {
      ...updateData,
      change_reason
    }, updated_by || 'system');
    
    if (!transaction) {
      return res.status(404).json(error('交易记录不存在'));
    }
    
    res.json(success(transaction, '交易记录更新成功'));
  } catch (err) {
    res.status(400).json(error(err.message));
  }
});

router.post('/:id/approve', async (req, res) => {
  try {
    const { reviewed_by, reviewer_id, reviewer_name, comments } = req.body;
    
    const transaction = await transactionModel.approveTransaction(req.params.id, {
      reviewed_by,
      reviewer_id,
      reviewer_name,
      comments
    });
    
    if (!transaction) {
      return res.status(404).json(error('交易记录不存在'));
    }
    
    res.json(success(transaction, '审批通过'));
  } catch (err) {
    res.status(400).json(error(err.message));
  }
});

router.post('/:id/reject', async (req, res) => {
  try {
    const { reviewed_by, reviewer_id, reviewer_name, comments } = req.body;
    
    const transaction = await transactionModel.rejectTransaction(req.params.id, {
      reviewed_by,
      reviewer_id,
      reviewer_name,
      comments
    });
    
    if (!transaction) {
      return res.status(404).json(error('交易记录不存在'));
    }
    
    res.json(success(transaction, '审批拒绝'));
  } catch (err) {
    res.status(400).json(error(err.message));
  }
});

router.get('/:id/versions', async (req, res) => {
  try {
    const versions = await transactionModel.getTransactionVersions(req.params.id);
    res.json(success(versions));
  } catch (err) {
    res.status(500).json(error(err.message));
  }
});

router.get('/:id/reviews', async (req, res) => {
  try {
    const reviews = await transactionModel.getTransactionReviews(req.params.id);
    res.json(success(reviews));
  } catch (err) {
    res.status(500).json(error(err.message));
  }
});

router.post('/export', async (req, res) => {
  try {
    const filter = req.body || {};
    const transactions = await transactionModel.getAllTransactions(filter);
    
    if (transactions.length === 0) {
      return res.status(400).json(error('没有可导出的数据'));
    }
    
    const exportData = transactions.map(t => ({
      '交易ID': t.id,
      '交易类型': {
        'borrow': '借出',
        'return': '归还',
        'sell': '销售转正',
        'loss': '损耗'
      }[t.transaction_type] || t.transaction_type,
      'SKU': t.sku,
      '样品名称': t.sample_name,
      '分类': t.category,
      '数量': t.quantity,
      '单位成本': t.unit_cost,
      '总成本': t.unit_cost * t.quantity,
      '主播': t.host_name,
      '排期日期': t.schedule_date,
      '排期描述': t.schedule_description,
      '责任人': t.responsible_person_name,
      '损耗说明': t.loss_description || '-',
      '状态': {
        'pending': '待审批',
        'approved': '已通过',
        'rejected': '已拒绝'
      }[t.status] || t.status,
      '创建人': t.created_by,
      '创建时间': t.created_at,
      '审批人': t.reviewed_by || '-',
      '审批时间': t.reviewed_at || '-'
    }));
    
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '样品借还记录');
    
    const exportDir = path.join(__dirname, '..', 'exports');
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `样品借还报告_${timestamp}.xlsx`;
    const filePath = path.join(exportDir, filename);
    
    XLSX.writeFile(wb, filePath);
    
    res.json(success({
      filename,
      filepath: filePath,
      download_url: `/exports/${filename}`,
      count: transactions.length
    }, '导出成功'));
  } catch (err) {
    res.status(500).json(error(err.message));
  }
});

router.get('/check-duplicate', async (req, res) => {
  try {
    const { sample_id, schedule_id, transaction_type } = req.query;
    
    if (!sample_id || !schedule_id || !transaction_type) {
      return res.status(400).json(error('缺少必要参数'));
    }
    
    const isDuplicate = await transactionModel.checkDuplicateSubmission(
      sample_id, 
      schedule_id, 
      transaction_type
    );
    
    res.json(success({
      is_duplicate: isDuplicate
    }));
  } catch (err) {
    res.status(500).json(error(err.message));
  }
});

module.exports = router;
