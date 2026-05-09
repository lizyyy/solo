const { storage, TransferStatus } = require('../data/store');
const depreciationService = require('./depreciationService');
const inventoryService = require('./inventoryService');

function getAssetOverview() {
  const byStatus = {};
  const byType = {};
  const byDepartment = {};
  
  storage.assets.forEach(asset => {
    byStatus[asset.status] = (byStatus[asset.status] || 0) + 1;
    byType[asset.assetType] = (byType[asset.assetType] || 0) + 1;
    
    if (!byDepartment[asset.department]) {
      byDepartment[asset.department] = { count: 0, value: 0 };
    }
    byDepartment[asset.department].count++;
    byDepartment[asset.department].value += asset.originalValue;
  });
  
  const totalValue = storage.assets.reduce((sum, a) => sum + a.originalValue, 0);
  
  return {
    totalAssets: storage.assets.length,
    totalOriginalValue: Math.round(totalValue * 100) / 100,
    byStatus,
    byType,
    byDepartment: Object.entries(byDepartment).map(([dept, data]) => ({
      department: dept,
      count: data.count,
      totalValue: Math.round(data.value * 100) / 100
    }))
  };
}

function getTransferStatistics() {
  const byStatus = {};
  const transfers = storage.transferOrders;
  
  transfers.forEach(t => {
    byStatus[t.status] = (byStatus[t.status] || 0) + 1;
  });
  
  const thisMonth = new Date();
  thisMonth.setDate(1);
  thisMonth.setHours(0, 0, 0, 0);
  
  const thisMonthTransfers = transfers.filter(t => 
    new Date(t.createdAt) >= thisMonth
  );
  
  const completedTransfers = transfers.filter(t => 
    t.status === TransferStatus.COMPLETED
  );
  
  const departmentFlow = {};
  completedTransfers.forEach(t => {
    const key = `${t.outgoingDepartment} → ${t.incomingDepartment}`;
    departmentFlow[key] = (departmentFlow[key] || 0) + 1;
  });
  
  return {
    totalTransfers: transfers.length,
    thisMonthCount: thisMonthTransfers.length,
    completedCount: completedTransfers.length,
    byStatus,
    departmentFlow
  };
}

function getComprehensiveReport(date = new Date()) {
  const assetOverview = getAssetOverview();
  const transferStats = getTransferStatistics();
  const depreciationByDept = depreciationService.getDepreciationByDepartment(date);
  const inventorySummary = inventoryService.getInventorySummary();
  
  const departments = {};
  
  storage.assets.forEach(asset => {
    const dept = asset.department;
    if (!departments[dept]) {
      departments[dept] = {
        department: dept,
        assetCount: 0,
        originalValue: 0,
        assets: []
      };
    }
    departments[dept].assetCount++;
    departments[dept].originalValue += asset.originalValue;
    departments[dept].assets.push(asset);
  });
  
  const depreciationMap = {};
  depreciationByDept.forEach(d => {
    depreciationMap[d.department] = d;
  });
  
  const departmentSummary = Object.entries(departments).map(([dept, data]) => {
    const dep = depreciationMap[dept] || {};
    return {
      department: dept,
      assetCount: data.assetCount,
      originalValue: Math.round(data.originalValue * 100) / 100,
      accumulatedDepreciation: dep.accumulatedDepreciation || 0,
      netBookValue: dep.netBookValue || data.originalValue,
      monthlyDepreciation: dep.monthlyDepreciation || 0
    };
  });
  
  const riskyAssets = storage.assets.filter(a => 
    a.inventoryStatus === 'SHORT' || 
    a.status === 'TRANSFERRING'
  );
  
  return {
    reportDate: date.toISOString().split('T')[0],
    generatedAt: new Date().toISOString(),
    assetOverview,
    transferStatistics: transferStats,
    depreciationSummary: {
      byDepartment: departmentSummary,
      totalOriginalValue: Math.round(
        departmentSummary.reduce((s, d) => s + d.originalValue, 0) * 100
      ) / 100,
      totalAccumulatedDepreciation: Math.round(
        departmentSummary.reduce((s, d) => s + d.accumulatedDepreciation, 0) * 100
      ) / 100,
      totalNetBookValue: Math.round(
        departmentSummary.reduce((s, d) => s + d.netBookValue, 0) * 100
      ) / 100
    },
    inventorySummary,
    alerts: {
      count: riskyAssets.length,
      items: riskyAssets.map(a => ({
        id: a.id,
        assetNo: a.assetNo,
        assetType: a.assetType,
        responsiblePerson: a.responsiblePerson,
        department: a.department,
        alertType: a.inventoryStatus === 'SHORT' ? '盘亏' : '调拨中',
        detail: a.inventoryStatus === 'SHORT' 
          ? '资产处于盘亏状态，需尽快处理' 
          : '资产正在调拨中，请关注完成状态'
      }))
    }
  };
}

module.exports = {
  getAssetOverview,
  getTransferStatistics,
  getComprehensiveReport
};
