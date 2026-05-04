const express = require('express');
const router = express.Router();
const XLSX = require('xlsx');
const exportService = require('../services/exportService');

router.get('/pickup-list', async (req, res) => {
  try {
    const { date, format = 'json' } = req.query;
    const data = await exportService.generatePickupList(date);

    if (format === 'excel') {
      const wb = await exportService.exportToExcel(data);
      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=pickup-list-${date || 'today'}.xlsx`);
      
      return res.send(buffer);
    }

    res.json({
      success: true,
      ...data
    });
  } catch (error) {
    console.error('生成自提清单失败:', error);
    res.status(500).json({
      success: false,
      message: '生成自提清单失败',
      error: error.message
    });
  }
});

router.get('/shortage-report', async (req, res) => {
  try {
    const { date, format = 'json' } = req.query;
    const data = await exportService.generateShortageReport(date);

    if (format === 'excel') {
      const wb = XLSX.utils.book_new();
      
      const summaryData = [
        ['缺货报告汇总'],
        ['生成日期', new Date().toISOString().split('T')[0]],
        ['总缺货单数', data.summary.totalShortages],
        ['总缺货数量', data.summary.totalAffectedQuantity],
        ['待处理', data.summary.pendingAction],
        [],
        ['按商品汇总']
      ];
      
      Object.values(data.summary.byProduct).forEach(product => {
        summaryData.push([
          product.productName,
          `SKU: ${product.productSku}`,
          `缺货数量: ${product.totalQuantity}`,
          `影响订单: ${product.orderCount}单`
        ]);
      });
      
      summaryData.push([]);
      summaryData.push(['缺货明细']);
      summaryData.push(['异常ID', '订单号', '客户姓名', '电话', '商品名称', 'SKU', '缺货数量', '状态', '处理方式', '描述']);
      
      data.shortageItems.forEach(item => {
        summaryData.push([
          item.exceptionId,
          item.orderNo,
          item.customerName,
          item.customerPhone,
          item.productName,
          item.productSku,
          item.affectedQuantity,
          item.status,
          item.action,
          item.description
        ]);
      });

      const ws = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, ws, '缺货报告');
      
      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=shortage-report-${date || 'today'}.xlsx`);
      
      return res.send(buffer);
    }

    res.json({
      success: true,
      ...data
    });
  } catch (error) {
    console.error('生成缺货报告失败:', error);
    res.status(500).json({
      success: false,
      message: '生成缺货报告失败',
      error: error.message
    });
  }
});

router.get('/refund-report', async (req, res) => {
  try {
    const { date, format = 'json' } = req.query;
    const data = await exportService.generateRefundReport(date);

    if (format === 'excel') {
      const wb = XLSX.utils.book_new();
      
      const summaryData = [
        ['退款报告汇总'],
        ['生成日期', new Date().toISOString().split('T')[0]],
        ['总退款单数', data.summary.totalRefunds],
        ['总退款金额', `¥${data.summary.totalRefundAmount}`],
        ['待处理', data.summary.byStatus.pending],
        ['已解决', data.summary.byStatus.resolved],
        [],
        ['按商品汇总']
      ];
      
      Object.values(data.summary.byProduct).forEach(product => {
        summaryData.push([
          product.productName,
          `SKU: ${product.productSku}`,
          `退款数量: ${product.totalQuantity}`,
          `退款金额: ¥${product.totalAmount.toFixed(2)}`,
          `订单数: ${product.orderCount}单`
        ]);
      });
      
      summaryData.push([]);
      summaryData.push(['退款明细']);
      summaryData.push(['异常ID', '订单号', '客户姓名', '电话', '商品名称', 'SKU', '数量', '单价', '退款金额', '状态', '解决时间', '描述']);
      
      data.refundItems.forEach(item => {
        summaryData.push([
          item.exceptionId,
          item.orderNo,
          item.customerName,
          item.customerPhone,
          item.productName,
          item.productSku,
          item.affectedQuantity,
          item.unitPrice,
          `¥${item.refundAmount}`,
          item.status,
          item.resolvedAt || '-',
          item.description
        ]);
      });

      const ws = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, ws, '退款报告');
      
      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=refund-report-${date || 'today'}.xlsx`);
      
      return res.send(buffer);
    }

    res.json({
      success: true,
      ...data
    });
  } catch (error) {
    console.error('生成退款报告失败:', error);
    res.status(500).json({
      success: false,
      message: '生成退款报告失败',
      error: error.message
    });
  }
});

router.get('/overdue-reminders', async (req, res) => {
  try {
    const data = await exportService.getOverdueReminders();

    res.json({
      success: true,
      ...data
    });
  } catch (error) {
    console.error('获取逾期提醒失败:', error);
    res.status(500).json({
      success: false,
      message: '获取逾期提醒失败',
      error: error.message
    });
  }
});

router.get('/daily-report', async (req, res) => {
  try {
    const { date, format = 'json' } = req.query;
    
    const pickupList = await exportService.generatePickupList(date);
    const shortageReport = await exportService.generateShortageReport(date);
    const refundReport = await exportService.generateRefundReport(date);
    const overdueReminders = await exportService.getOverdueReminders();

    const dailyReport = {
      date: date || new Date().toISOString().split('T')[0],
      generatedAt: new Date().toISOString(),
      summary: {
        pickupOrders: pickupList.summary.totalOrders,
        pickupAmount: pickupList.summary.totalAmount,
        shortages: shortageReport.summary.totalShortages,
        shortageQuantity: shortageReport.summary.totalAffectedQuantity,
        refunds: refundReport.summary.totalRefunds,
        refundAmount: refundReport.summary.totalRefundAmount,
        overdueOrders: overdueReminders.totalOverdue
      },
      details: {
        pickupList: pickupList,
        shortageReport: shortageReport,
        refundReport: refundReport,
        overdueReminders: overdueReminders
      }
    };

    if (format === 'excel') {
      const wb = XLSX.utils.book_new();
      
      const summarySheet = [
        ['每日综合报告'],
        ['报告日期', dailyReport.date],
        ['生成时间', dailyReport.generatedAt],
        [],
        ['一、自提统计'],
        ['今日自提订单数', dailyReport.summary.pickupOrders],
        ['今日自提总金额', `¥${dailyReport.summary.pickupAmount}`],
        [],
        ['二、异常统计'],
        ['缺货单数', dailyReport.summary.shortages],
        ['缺货总数量', dailyReport.summary.shortageQuantity],
        ['退款单数', dailyReport.summary.refunds],
        ['退款总金额', `¥${dailyReport.summary.refundAmount}`],
        [],
        ['三、逾期提醒'],
        ['逾期未自提订单数', dailyReport.summary.overdueOrders]
      ];
      
      const ws1 = XLSX.utils.aoa_to_sheet(summarySheet);
      XLSX.utils.book_append_sheet(wb, ws1, '汇总');
      
      if (pickupList.pickupList.length > 0) {
        const pickupSheet = [
          ['自提清单'],
          [],
          ['订单号', '客户姓名', '电话', '自提码', '自提时段', '商品', '数量', '总金额', '状态', '备注']
        ];
        
        pickupList.pickupList.forEach(order => {
          order.items.forEach((item, idx) => {
            pickupSheet.push([
              idx === 0 ? order.orderNo : '',
              idx === 0 ? order.customerName : '',
              idx === 0 ? order.customerPhone : '',
              idx === 0 ? order.pickupCode : '',
              idx === 0 ? `${order.pickupSlot.startTime}-${order.pickupSlot.endTime}` : '',
              item.productName + (item.isExpiryPriority ? ' [临期优先]' : ''),
              item.quantity,
              idx === 0 ? `¥${order.totalAmount}` : '',
              idx === 0 ? order.status : '',
              idx === 0 ? order.note : ''
            ]);
          });
        });
        
        const ws2 = XLSX.utils.aoa_to_sheet(pickupSheet);
        XLSX.utils.book_append_sheet(wb, ws2, '自提清单');
      }
      
      if (shortageReport.shortageItems.length > 0) {
        const shortageSheet = [
          ['缺货报告'],
          [],
          ['异常ID', '订单号', '客户姓名', '电话', '商品名称', 'SKU', '缺货数量', '状态', '处理方式', '描述']
        ];
        
        shortageReport.shortageItems.forEach(item => {
          shortageSheet.push([
            item.exceptionId,
            item.orderNo,
            item.customerName,
            item.customerPhone,
            item.productName,
            item.productSku,
            item.affectedQuantity,
            item.status,
            item.action,
            item.description
          ]);
        });
        
        const ws3 = XLSX.utils.aoa_to_sheet(shortageSheet);
        XLSX.utils.book_append_sheet(wb, ws3, '缺货报告');
      }
      
      if (refundReport.refundItems.length > 0) {
        const refundSheet = [
          ['退款报告'],
          [],
          ['异常ID', '订单号', '客户姓名', '电话', '商品名称', 'SKU', '数量', '单价', '退款金额', '状态', '解决时间']
        ];
        
        refundReport.refundItems.forEach(item => {
          refundSheet.push([
            item.exceptionId,
            item.orderNo,
            item.customerName,
            item.customerPhone,
            item.productName,
            item.productSku,
            item.affectedQuantity,
            item.unitPrice,
            `¥${item.refundAmount}`,
            item.status,
            item.resolvedAt || '-'
          ]);
        });
        
        const ws4 = XLSX.utils.aoa_to_sheet(refundSheet);
        XLSX.utils.book_append_sheet(wb, ws4, '退款报告');
      }
      
      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=daily-report-${date || 'today'}.xlsx`);
      
      return res.send(buffer);
    }

    res.json({
      success: true,
      ...dailyReport
    });
  } catch (error) {
    console.error('生成每日报告失败:', error);
    res.status(500).json({
      success: false,
      message: '生成每日报告失败',
      error: error.message
    });
  }
});

module.exports = router;
