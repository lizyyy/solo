const express = require('express');
const router = express.Router();
const auditService = require('../services/auditService');
const { storage } = require('../utils/storage');
const orderService = require('../services/orderService');
const depositService = require('../services/depositService');
const equipmentService = require('../services/equipmentService');

router.get('/audit', async (req, res) => {
  try {
    const result = await auditService.getAuditLogs(req.query);
    res.json({ success: true, data: result, count: result.length });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/reports/orders-summary', async (req, res) => {
  try {
    const orders = Object.values(storage.rentalOrders);
    const equipments = Object.values(storage.equipment);
    
    const statusCount = {};
    orders.forEach(o => {
      statusCount[o.status] = (statusCount[o.status] || 0) + 1;
    });
    
    let totalDepositFrozen = 0;
    let totalDepositRefunded = 0;
    let totalOverdueFees = 0;
    let totalDamageFees = 0;
    
    orders.forEach(o => {
      const ledger = storage.depositLedgers[o.orderId];
      const fees = storage.feeDetails[o.orderId];
      
      if (ledger) {
        totalDepositFrozen += ledger.totalFrozen;
        totalDepositRefunded += ledger.totalRefunded;
      }
      if (fees) {
        totalOverdueFees += fees.totalOverdueFee;
        totalDamageFees += fees.totalDamageFee;
      }
    });
    
    const equipmentStatusCount = {};
    equipments.forEach(e => {
      equipmentStatusCount[e.status] = (equipmentStatusCount[e.status] || 0) + 1;
    });
    
    res.json({
      success: true,
      data: {
        summary: {
          totalOrders: orders.length,
          statusBreakdown: statusCount,
          totalDepositFrozen,
          totalDepositRefunded,
          totalOverdueFees,
          totalDamageFees,
          netDeposit: totalDepositFrozen - totalDepositRefunded - totalOverdueFees - totalDamageFees
        },
        equipmentSummary: {
          totalEquipment: equipments.length,
          statusBreakdown: equipmentStatusCount
        },
        generatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/reports/order/:orderId', async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const detail = await orderService.getOrderDetail(orderId);
    
    if (!detail) {
      return res.status(404).json({ success: false, error: '订单不存在' });
    }
    
    const refundCalc = depositService.calculateRefundAmount(orderId);
    
    res.json({
      success: true,
      data: {
        orderId,
        reportType: 'FULL_DETAIL',
        generatedAt: new Date().toISOString(),
        
        orderInfo: {
          userId: detail.order.userId,
          userName: detail.order.userName,
          equipmentName: detail.order.equipmentName,
          equipmentModel: detail.order.equipmentModel,
          status: detail.order.status,
          startTime: detail.order.startTime,
          dueTime: detail.order.dueTime,
          returnTime: detail.order.returnTime,
          renewCount: detail.order.renewCount,
          totalRentalDays: detail.order.totalRentalDays
        },
        
        depositLedger: {
          totalFrozen: detail.ledger.totalFrozen,
          totalDeducted: detail.ledger.totalDeducted,
          totalRefunded: detail.ledger.totalRefunded,
          totalManualAdjust: detail.ledger.totalManualAdjust,
          balance: detail.ledger.balance,
          transactions: detail.ledger.transactions
        },
        
        feeDetails: {
          totalFees: detail.fees.totalFees,
          totalRentalFee: detail.fees.totalRentalFee,
          totalOverdueFee: detail.fees.totalOverdueFee,
          totalDamageFee: detail.fees.totalDamageFee,
          fees: detail.fees.fees
        },
        
        refundCalculation: refundCalc,
        
        equipmentStatus: detail.equipment?.status,
        
        statusHistory: detail.order.statusHistory,
        
        auditTimeline: detail.auditTimeline,
        
        equipmentStatusHistory: detail.equipmentStatusHistory
      }
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/reports/export', async (req, res) => {
  try {
    const orders = Object.values(storage.rentalOrders);
    const exportData = [];
    
    for (const order of orders) {
      const ledger = storage.depositLedgers[order.orderId];
      const fees = storage.feeDetails[order.orderId];
      const timeline = await auditService.getEntityTimeline('ORDER', order.orderId);
      
      exportData.push({
        orderId: order.orderId,
        user: `${order.userId} (${order.userName})`,
        equipment: `${order.equipmentName} - ${order.equipmentModel}`,
        status: order.status,
        startTime: order.startTime,
        dueTime: order.dueTime,
        returnTime: order.returnTime,
        rentalDays: order.totalRentalDays,
        renewCount: order.renewCount,
        
        depositAmount: order.depositAmount,
        totalFrozen: ledger?.totalFrozen || 0,
        totalDeducted: ledger?.totalDeducted || 0,
        totalRefunded: ledger?.totalRefunded || 0,
        
        totalOverdueFee: fees?.totalOverdueFee || 0,
        totalDamageFee: fees?.totalDamageFee || 0,
        totalFees: fees?.totalFees || 0,
        
        auditLogCount: timeline.length
      });
    }
    
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=deposit-report-${Date.now()}.json`);
    
    res.json({
      success: true,
      data: {
        exportTime: new Date().toISOString(),
        recordCount: exportData.length,
        records: exportData
      }
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

module.exports = router;