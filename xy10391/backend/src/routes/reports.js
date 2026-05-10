const express = require('express');
const FeeService = require('../services/feeService');
const db = require('../config/db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.get('/annual/:year', authenticateToken, async (req, res) => {
  try {
    const year = parseInt(req.params.year);
    const report = await FeeService.getAnnualReport(year);
    res.json(report);
  } catch (error) {
    console.error('获取年度报表失败:', error);
    res.status(500).json({ error: error.message || '服务器内部错误' });
  }
});

router.get('/dashboard', authenticateToken, async (req, res) => {
  try {
    const dashboard = await FeeService.getDashboardData();
    res.json(dashboard);
  } catch (error) {
    console.error('获取仪表盘数据失败:', error);
    res.status(500).json({ error: error.message || '服务器内部错误' });
  }
});

router.get('/export/annual/:year', authenticateToken, async (req, res) => {
  try {
    const year = parseInt(req.params.year);
    const report = await FeeService.getAnnualReport(year);
    
    const csvContent = generateCSV(report);
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=dues-report-${year}.csv`);
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Pragma', 'no-cache');
    
    res.send('\ufeff' + csvContent);
  } catch (error) {
    console.error('导出报表失败:', error);
    res.status(500).json({ error: error.message || '服务器内部错误' });
  }
});

function generateCSV(report) {
  const headers = [
    '会员编号',
    '企业名称',
    '会员等级',
    '入会时间',
    '到期时间',
    '会员状态',
    '小微企业',
    '联系人',
    '联系电话',
    '应收金额',
    '减免金额',
    '已收金额',
    '欠费金额',
    '是否结清',
    '催缴状态',
    '催缴说明',
    '欠费原因'
  ];

  const rows = report.details.map(item => [
    item.memberCode,
    item.companyName,
    item.memberLevel,
    item.joinDate,
    item.expiryDate,
    getStatusText(item.status),
    item.isSmallEnterprise ? '是' : '否',
    item.contactPerson || '',
    item.contactPhone || '',
    item.originalAmount.toFixed(2),
    item.reductionAmount.toFixed(2),
    item.paidAmount.toFixed(2),
    item.dueAmount.toFixed(2),
    item.isFullyPaid ? '是' : '否',
    getReminderStatusText(item.reminderStatus),
    item.reminderDescription || '',
    item.unpaidReason || ''
  ]);

  const summaryRows = [
    [],
    ['汇总数据'],
    ['统计年度', report.year],
    ['会员总数', report.summary.totalMembers],
    ['已结清', report.summary.paidMembers],
    ['缴费率', report.summary.paymentRate + '%'],
    ['逾期会员', report.summary.overdueMembers],
    ['待审批减免', report.summary.pendingReduction],
    ['暂停会员', report.summary.inactiveMembers],
    ['已退会', report.summary.resignedMembers],
    [],
    ['金额汇总'],
    ['应收总额', report.summary.totalOriginal.toFixed(2)],
    ['减免总额', report.summary.totalReduction.toFixed(2)],
    ['已收总额', report.summary.totalPaid.toFixed(2)],
    ['欠费总额', report.summary.totalDue.toFixed(2)]
  ];

  const allRows = [headers, ...rows, ...summaryRows];
  
  return allRows
    .map(row => row.map(cell => {
      if (typeof cell === 'string' && (cell.includes(',') || cell.includes('"') || cell.includes('\n'))) {
        return `"${cell.replace(/"/g, '""')}"`;
      }
      return cell;
    }).join(','))
    .join('\n');
}

function getStatusText(status) {
  const map = {
    active: '正常',
    inactive: '暂停',
    resigned: '已退会'
  };
  return map[status] || status;
}

function getReminderStatusText(status) {
  const map = {
    paid: '已结清',
    normal: '正常',
    pending: '待催缴',
    overdue: '逾期',
    inactive: '暂停',
    resigned: '已退会'
  };
  return map[status] || status;
}

module.exports = router;
