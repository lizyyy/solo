const express = require('express');
const moment = require('moment');
const { readJSON } = require('../utils/db');

const router = express.Router();

router.get('/', (req, res) => {
  const batches = readJSON('batches.json');
  const reagents = readJSON('reagents.json');
  
  const reagentMap = new Map(reagents.map(r => [r.id, r]));
  
  const alerts = [];
  
  batches.forEach(batch => {
    const reagent = reagentMap.get(batch.reagentId);
    const daysToExpiry = moment(batch.expiryDate).diff(moment(), 'days');
    
    let severity = 'info';
    let type = '';
    let message = '';
    
    if (batch.status === 'expired') {
      severity = 'danger';
      type = 'expired';
      message = `已过期 ${Math.abs(daysToExpiry)} 天`;
    } else if (batch.status === 'expiring') {
      severity = 'warning';
      type = 'expiring';
      message = `即将过期，还剩 ${daysToExpiry} 天`;
    } else if (batch.status === 'low_stock') {
      severity = 'warning';
      type = 'low_stock';
      message = `库存不足，剩余 ${batch.remainingQuantity}`;
    } else if (batch.status === 'empty') {
      severity = 'danger';
      type = 'empty';
      message = `库存已空`;
    }
    
    if (type) {
      alerts.push({
        id: `alert-${batch.id}-${type}`,
        batchId: batch.id,
        reagentId: batch.reagentId,
        batchNo: batch.batchNo,
        reagentName: reagent ? reagent.name : '未知试剂',
        reagentCode: reagent ? reagent.code : '',
        type,
        severity,
        message,
        remainingQuantity: batch.remainingQuantity,
        expiryDate: batch.expiryDate,
        daysToExpiry,
        storageLocation: batch.storageLocation,
        createdAt: new Date().toISOString()
      });
    }
  });
  
  const reagentStockAlerts = reagents.map(reagent => {
    const reagentBatches = batches.filter(b => b.reagentId === reagent.id);
    const totalRemaining = reagentBatches.reduce((sum, b) => sum + b.remainingQuantity, 0);
    
    if (totalRemaining <= reagent.minStock) {
      return {
        id: `reagent-alert-${reagent.id}`,
        reagentId: reagent.id,
        batchId: null,
        batchNo: null,
        reagentName: reagent.name,
        reagentCode: reagent.code,
        type: 'reagent_low_stock',
        severity: 'warning',
        message: `总库存(${totalRemaining})低于安全库存(${reagent.minStock})`,
        remainingQuantity: totalRemaining,
        minStock: reagent.minStock,
        expiryDate: null,
        daysToExpiry: null,
        storageLocation: null,
        createdAt: new Date().toISOString()
      };
    }
    return null;
  }).filter(Boolean);
  
  const allAlerts = [...alerts, ...reagentStockAlerts];
  
  const stats = {
    total: allAlerts.length,
    danger: allAlerts.filter(a => a.severity === 'danger').length,
    warning: allAlerts.filter(a => a.severity === 'warning').length,
    info: allAlerts.filter(a => a.severity === 'info').length,
    expired: allAlerts.filter(a => a.type === 'expired').length,
    expiring: allAlerts.filter(a => a.type === 'expiring').length,
    lowStock: allAlerts.filter(a => a.type === 'low_stock' || a.type === 'reagent_low_stock').length
  };
  
  res.json({ success: true, data: allAlerts, stats });
});

router.get('/overview', (req, res) => {
  const batches = readJSON('batches.json');
  const reagents = readJSON('reagents.json');
  const records = readJSON('records.json');
  
  const totalBatches = batches.length;
  const totalReagents = reagents.length;
  const totalRecords = records.length;
  
  const expiredBatches = batches.filter(b => b.status === 'expired').length;
  const expiringBatches = batches.filter(b => b.status === 'expiring').length;
  const lowStockBatches = batches.filter(b => b.status === 'low_stock').length;
  const emptyBatches = batches.filter(b => b.status === 'empty').length;
  
  const totalStock = batches.reduce((sum, b) => sum + b.remainingQuantity, 0);
  const totalUsed = batches.reduce((sum, b) => sum + b.usedQuantity, 0);
  
  const today = moment().startOf('day');
  const todayRecords = records.filter(r => moment(r.createdAt).isSameOrAfter(today)).length;
  
  const recentRecords = records
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 5);
  
  res.json({
    success: true,
    data: {
      overview: {
        totalReagents,
        totalBatches,
        totalRecords,
        todayRecords
      },
      stock: {
        totalStock,
        totalUsed,
        utilizationRate: totalStock + totalUsed > 0 
          ? Math.round((totalUsed / (totalStock + totalUsed)) * 100) 
          : 0
      },
      alerts: {
        expired: expiredBatches,
        expiring: expiringBatches,
        lowStock: lowStockBatches,
        empty: emptyBatches
      },
      recentRecords
    }
  });
});

module.exports = router;
