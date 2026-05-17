const transferService = require('../services/transferService');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const fs = require('fs');
const path = require('path');

async function createTransfer(req, res) {
  try {
    const result = await transferService.createTransfer(req.body);
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
}

async function processTransfer(req, res) {
  try {
    const { transferId, reviewerId } = req.body;
    const result = await transferService.processTransfer(transferId, reviewerId);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
}

async function confirmBooking(req, res) {
  try {
    const { transferId, reviewerId, paymentAmount } = req.body;
    const result = await transferService.confirmBooking(transferId, reviewerId, paymentAmount);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
}

async function rejectTransfer(req, res) {
  try {
    const { transferId, reviewerId, reason } = req.body;
    const result = await transferService.rejectTransfer(transferId, reviewerId, reason);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
}

async function resubmitTransfer(req, res) {
  try {
    const { transferId, employeeId, ...newData } = req.body;
    const result = await transferService.resubmitTransfer(transferId, employeeId, newData);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
}

async function manualReviewTransfer(req, res) {
  try {
    const { transferId, reviewerId, approved, comment } = req.body;
    const result = await transferService.manualReviewTransfer(transferId, reviewerId, approved, comment);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
}

async function getTransferById(req, res) {
  try {
    const result = await transferService.getTransferById(req.params.id);
    if (!result) {
      return res.status(404).json({ success: false, message: '调拨记录不存在' });
    }
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
}

async function getTransferList(req, res) {
  try {
    const result = await transferService.getTransferList(req.query);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
}

async function getTransferHistory(req, res) {
  try {
    const result = await transferService.getTransferHistory(req.params.id);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
}

async function exportTransfers(req, res) {
  try {
    const transfers = await transferService.getTransferList(req.query);
    
    const exportDir = path.join(__dirname, '../../exports');
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }
    
    const fileName = `transfers_${Date.now()}.csv`;
    const filePath = path.join(exportDir, fileName);
    
    const csvWriter = createCsvWriter({
      path: filePath,
      header: [
        { id: 'id', title: '调拨ID' },
        { id: 'employee_name', title: '员工姓名' },
        { id: 'reimbursement_order_id', title: '报销单号' },
        { id: 'original_subject_name', title: '原科目' },
        { id: 'target_subject_name', title: '新科目' },
        { id: 'transfer_amount', title: '调拨金额' },
        { id: 'status', title: '状态' },
        { id: 'flow_type', title: '流程类型' },
        { id: 'created_at', title: '创建时间' }
      ]
    });
    
    await csvWriter.writeRecords(transfers);
    
    res.download(filePath, fileName, (err) => {
      if (err) {
        res.status(500).json({ success: false, message: '导出失败' });
      }
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
}

async function importTransfers(req, res) {
  try {
    const { rows, fileName, operatorId } = req.body;
    
    let successCount = 0;
    let failCount = 0;
    const errors = [];
    
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        await transferService.createTransfer({
          employeeId: row.employeeId,
          reimbursementOrderId: row.reimbursementOrderId,
          originalSubjectId: row.originalSubjectId,
          targetSubjectId: row.targetSubjectId,
          transferAmount: row.transferAmount,
          flowType: row.flowType || 'normal'
        });
        successCount++;
      } catch (error) {
        failCount++;
        errors.push(`行${i + 1}: ${error.message}`);
      }
    }
    
    res.json({
      success: true,
      data: {
        total: rows.length,
        success: successCount,
        failed: failCount,
        errors: errors
      }
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
}

module.exports = {
  createTransfer,
  processTransfer,
  confirmBooking,
  rejectTransfer,
  resubmitTransfer,
  manualReviewTransfer,
  getTransferById,
  getTransferList,
  getTransferHistory,
  exportTransfers,
  importTransfers
};
