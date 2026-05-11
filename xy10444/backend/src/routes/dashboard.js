const express = require('express');
const router = express.Router();
const WorkOrder = require('../models/WorkOrder');
const Material = require('../models/Material');
const Settlement = require('../models/Settlement');

router.get('/stats', async (req, res) => {
  try {
    const { month } = req.query;
    let dateFilter = {};
    
    if (month) {
      const [year, m] = month.split('-');
      const startDate = new Date(year, parseInt(m) - 1, 1);
      const endDate = new Date(year, parseInt(m), 1);
      dateFilter = { createdAt: { $gte: startDate, $lt: endDate } };
    }
    
    const workOrders = await WorkOrder.find({});
    
    const pendingReturnOrders = workOrders.filter(wo => {
      return wo.materials.some(m => {
        const balance = m.quantityTaken - m.quantityUsed - m.quantityReturned;
        return balance > 0;
      }) && ['处理中', '待确认'].includes(wo.status);
    }).map(wo => {
      const materialsWithBalance = wo.materials
        .filter(m => {
          const balance = m.quantityTaken - m.quantityUsed - m.quantityReturned;
          return balance > 0;
        })
        .map(m => ({
          ...m.toObject(),
          balance: m.quantityTaken - m.quantityUsed - m.quantityReturned
        }));
      return {
        _id: wo._id,
        orderNumber: wo.orderNumber,
        repairType: wo.repairType,
        repairCategory: wo.repairCategory,
        location: wo.location,
        technician: wo.technician,
        status: wo.status,
        createdAt: wo.createdAt,
        materials: materialsWithBalance
      };
    });
    
    const pendingConfirmOrders = workOrders.filter(wo => 
      !wo.ownerConfirmed && 
      wo.status === '待确认' && 
      !wo.settled &&
      wo.materials.some(m => m.quantityUsed > 0)
    );
    
    const lowStockMaterials = await Material.find({ 
      stock: { $lte: '$minStock' } 
    });
    
    const allSettlements = await Settlement.find(dateFilter);
    const ownerPayTotal = allSettlements
      .filter(s => s.settlementType === '业主付费')
      .reduce((sum, s) => sum + s.totalAmount, 0);
    const fundPayTotal = allSettlements
      .filter(s => s.settlementType === '公共维修基金')
      .reduce((sum, s) => sum + s.totalAmount, 0);
    
    const costBreakdown = allSettlements.reduce((acc, s) => {
      s.items.forEach(item => {
        if (!acc[item.materialName]) {
          acc[item.materialName] = {
            materialName: item.materialName,
            unit: item.unit,
            unitPrice: item.unitPrice,
            totalQuantity: 0,
            totalAmount: 0
          };
        }
        acc[item.materialName].totalQuantity += item.quantityUsed;
        acc[item.materialName].totalAmount += item.amount;
      });
      return acc;
    }, {});
    
    const materialCostReport = Object.values(costBreakdown);
    
    res.json({
      success: true,
      data: {
        totalWorkOrders: workOrders.length,
        pendingWorkOrders: workOrders.filter(wo => wo.status === '待处理').length,
        inProgressWorkOrders: workOrders.filter(wo => wo.status === '处理中').length,
        completedWorkOrders: workOrders.filter(wo => wo.status === '已完成').length,
        pendingReturnCount: pendingReturnOrders.length,
        pendingReturnOrders,
        pendingConfirmCount: pendingConfirmOrders.length,
        pendingConfirmOrders,
        lowStockMaterials,
        ownerPayTotal,
        fundPayTotal,
        materialCostReport
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/export/materials', async (req, res) => {
  try {
    const { month } = req.query;
    let dateFilter = {};
    
    if (month) {
      const [year, m] = month.split('-');
      const startDate = new Date(year, parseInt(m) - 1, 1);
      const endDate = new Date(year, parseInt(m), 1);
      dateFilter = { createdAt: { $gte: startDate, $lt: endDate } };
    }
    
    const settlements = await Settlement.find(dateFilter).sort({ createdAt: -1 });
    
    const reportData = [];
    settlements.forEach(s => {
      s.items.forEach((item, index) => {
        reportData.push({
          settlementNumber: index === 0 ? s.settlementNumber : '',
          workOrderNumber: index === 0 ? s.workOrderNumber : '',
          settlementType: index === 0 ? s.settlementType : '',
          repairType: index === 0 ? s.repairType : '',
          location: index === 0 ? s.location : '',
          technician: index === 0 ? s.technician : '',
          houseNumber: index === 0 ? s.houseNumber : '',
          materialName: item.materialName,
          unit: item.unit,
          unitPrice: item.unitPrice,
          quantityUsed: item.quantityUsed,
          amount: item.amount,
          settlementDate: index === 0 ? s.createdAt : ''
        });
      });
    });
    
    res.json({ success: true, data: reportData });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
