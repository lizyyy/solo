const { storage, InventoryStatus, generateId } = require('../data/store');
const { createError, ErrorCodes: EC } = require('./errors');
const assetService = require('./assetService');

function getInventoryRecords(assetId = null) {
  let records = [...storage.inventoryRecords];
  if (assetId) {
    records = records.filter(r => r.assetId === assetId);
  }
  return records.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function recordInventory(assetId, status, remark, recordedBy) {
  const asset = assetService.getAssetById(assetId);
  if (!asset) {
    throw createError(EC.ASSET_NOT_FOUND, { assetId });
  }
  
  const now = new Date().toISOString();
  const record = {
    id: generateId(),
    assetId,
    assetNo: asset.assetNo,
    inventoryDate: new Date().toISOString().split('T')[0],
    status,
    remark,
    recordedBy,
    createdAt: now
  };
  
  storage.inventoryRecords.push(record);
  
  assetService.updateAsset(assetId, {
    inventoryStatus: status,
    lastInventoryDate: record.inventoryDate
  });
  
  return record;
}

function getInventorySummary() {
  const statusCounts = {
    NORMAL: 0,
    OVER: 0,
    SHORT: 0,
    PENDING: 0
  };
  
  storage.assets.forEach(asset => {
    const status = asset.inventoryStatus || 'PENDING';
    statusCounts[status] = (statusCounts[status] || 0) + 1;
  });
  
  const pendingInventory = storage.assets.filter(a => 
    !a.lastInventoryDate || a.inventoryStatus === 'PENDING'
  );
  
  const shortAssets = storage.assets.filter(a => a.inventoryStatus === 'SHORT');
  
  return {
    totalAssets: storage.assets.length,
    statusCounts,
    pendingInventoryCount: pendingInventory.length,
    shortAssetsCount: shortAssets.length,
    shortAssets: shortAssets.map(a => ({
      id: a.id,
      assetNo: a.assetNo,
      assetType: a.assetType,
      responsiblePerson: a.responsiblePerson,
      department: a.department,
      lastInventoryDate: a.lastInventoryDate
    }))
  };
}

module.exports = {
  getInventoryRecords,
  recordInventory,
  getInventorySummary
};
