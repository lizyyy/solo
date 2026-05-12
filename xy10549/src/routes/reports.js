const express = require('express');
const router = express.Router();
const { getAllShipments, getStatistics, getShipmentDetail } = require('../services/shipmentService');
const { COMPENSATION_RULES, STATUS_FLOW } = require('../services/rules');

router.get('/summary', (req, res) => {
  const stats = getStatistics();
  const shipments = getAllShipments();
  
  const summary = {
    generatedAt: new Date().toISOString(),
    statistics: stats,
    byCustomerLevel: {},
    byType: {},
    byStatus: stats.statusCounts
  };
  
  shipments.forEach(s => {
    if (!summary.byCustomerLevel[s.customerLevel]) {
      summary.byCustomerLevel[s.customerLevel] = {
        count: 0,
        statuses: {}
      };
    }
    summary.byCustomerLevel[s.customerLevel].count++;
    summary.byCustomerLevel[s.customerLevel].statuses[s.status] = 
      (summary.byCustomerLevel[s.customerLevel].statuses[s.status] || 0) + 1;
    
    if (!summary.byType[s.type]) {
      summary.byType[s.type] = {
        count: 0,
        statuses: {}
      };
    }
    summary.byType[s.type].count++;
    summary.byType[s.type].statuses[s.status] = 
      (summary.byType[s.type].statuses[s.status] || 0) + 1;
  });
  
  res.json({
    success: true,
    data: summary
  });
});

router.get('/rules', (req, res) => {
  res.json({
    success: true,
    data: {
      compensationRules: COMPENSATION_RULES,
      statusFlow: STATUS_FLOW
    }
  });
});

router.get('/export', (req, res) => {
  const { format = 'json', status, type, customerLevel } = req.query;
  
  const filters = { status, type, customerLevel };
  const shipments = getAllShipments(filters);
  const detailedShipments = shipments.map(s => {
    const detail = getShipmentDetail(s.shipmentId);
    return {
      shipmentId: s.shipmentId,
      waybillId: s.waybillId,
      customerName: s.customerName,
      customerLevel: s.customerLevel,
      type: s.type,
      status: s.status,
      statusReason: s.statusReason,
      carrier: s.carrier,
      insuredAmount: s.insuredAmount,
      trackingSummary: detail?.trackingSummary,
      compensation: detail?.compensation ? {
        amount: detail.compensation.calculatedAmount,
        status: detail.compensation.status,
        calculation: detail.compensation.calculation
      } : null,
      liability: detail?.liability ? {
        status: detail.liability.status,
        responsibleParty: detail.liability.responsibleParty
      } : null,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt
    };
  });
  
  if (format === 'csv') {
    const headers = [
      '异常件ID', '运单号', '客户名称', '客户等级', '异常类型',
      '当前状态', '状态原因', '承运商', '保价金额',
      '赔付金额', '赔付状态', '责任方', '创建时间', '更新时间'
    ];
    
    const rows = detailedShipments.map(s => [
      s.shipmentId,
      s.waybillId,
      s.customerName,
      s.customerLevel,
      s.type,
      s.status,
      s.statusReason || '',
      s.carrier,
      s.insuredAmount,
      s.compensation?.amount || 0,
      s.compensation?.status || '',
      s.liability?.responsibleParty || '',
      s.createdAt,
      s.updatedAt
    ]);
    
    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=logistics-report-${Date.now()}.csv`);
    res.send('\ufeff' + csv);
  } else {
    res.json({
      success: true,
      data: {
        generatedAt: new Date().toISOString(),
        count: detailedShipments.length,
        filters,
        shipments: detailedShipments
      }
    });
  }
});

module.exports = router;
