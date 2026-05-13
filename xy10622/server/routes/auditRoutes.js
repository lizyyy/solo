const express = require('express');
const router = express.Router();
const ExcelJS = require('exceljs');
const auditController = require('../controllers/auditController');

router.get('/statistics', async (req, res) => {
  try {
    const stats = await auditController.getStatistics();
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/audits', async (req, res) => {
  try {
    const filters = req.query;
    const audits = await auditController.getAuditList(filters);
    res.json({ success: true, data: audits });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/missing-checkouts', async (req, res) => {
  try {
    const list = await auditController.getMissingCheckoutList();
    res.json({ success: true, data: list });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/validate-checkin/:id', async (req, res) => {
  try {
    const result = await auditController.validateCheckin(req.params.id);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/process-missing-checkout', async (req, res) => {
  try {
    const { checkinId, approvedHours, notes, handledBy } = req.body;
    
    if (!checkinId || approvedHours === undefined) {
      return res.status(400).json({ success: false, message: '缺少必要参数' });
    }

    const result = await auditController.processMissingCheckout(
      checkinId,
      approvedHours,
      notes || '',
      handledBy || '系统管理员'
    );
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/save-audit', async (req, res) => {
  try {
    const { auditId, status, approvedHours, handledBy } = req.body;
    
    if (!auditId || !status) {
      return res.status(400).json({ success: false, message: '缺少必要参数' });
    }

    const result = await auditController.saveSupplementalAudit(
      auditId,
      status,
      approvedHours,
      handledBy || '系统管理员'
    );
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/export-report', async (req, res) => {
  try {
    const filters = req.query;
    const data = await auditController.exportReport(filters);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('补录审核报告');

    worksheet.columns = [
      { header: '序号', key: 'id', width: 8 },
      { header: '志愿者姓名', key: 'volunteer_name', width: 15 },
      { header: '联系电话', key: 'phone', width: 15 },
      { header: '活动名称', key: 'activity_name', width: 25 },
      { header: '活动日期', key: 'activity_date', width: 12 },
      { header: '签到时间', key: 'checkin_time', width: 20 },
      { header: '签退时间', key: 'checkout_time', width: 20 },
      { header: '原始时长', key: 'original_hours', width: 10 },
      { header: '核定时长', key: 'approved_hours', width: 10 },
      { header: '审核状态', key: 'audit_status', width: 10 },
      { header: '审核原因', key: 'reason', width: 30 },
      { header: '处理人', key: 'handled_by', width: 15 },
      { header: '处理时间', key: 'handled_at', width: 20 },
      { header: '队长确认时长', key: 'confirmed_hours', width: 15 },
      { header: '确认状态', key: 'confirmation_status', width: 12 }
    ];

    data.forEach((row, index) => {
      worksheet.addRow({
        ...row,
        id: index + 1
      });
    });

    worksheet.getRow(1).font = { bold: true };

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=volunteer-audit-report.xlsx');

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/volunteer-history/:id', async (req, res) => {
  try {
    const history = await auditController.getVolunteerHistory(req.params.id);
    res.json({ success: true, data: history });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/checkin-history/:id', async (req, res) => {
  try {
    const history = await auditController.getCheckinHistory(req.params.id);
    res.json({ success: true, data: history });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/confirmation-history/:id', async (req, res) => {
  try {
    const history = await auditController.getConfirmationHistory(req.params.id);
    res.json({ success: true, data: history });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
