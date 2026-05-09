const { storage, AssetStatus, InventoryStatus, generateId } = require('../data/store');
const { createError, ErrorCodes: EC } = require('./errors');

function getAssetById(id) {
  return storage.assets.find(a => a.id === id);
}

function getAssetByNo(assetNo) {
  return storage.assets.find(a => a.assetNo === assetNo);
}

function listAssets(filters = {}) {
  let results = [...storage.assets];
  
  if (filters.assetType) {
    results = results.filter(a => a.assetType === filters.assetType);
  }
  if (filters.department) {
    results = results.filter(a => a.department === filters.department);
  }
  if (filters.status) {
    results = results.filter(a => a.status === filters.status);
  }
  if (filters.responsiblePersonId) {
    results = results.filter(a => a.responsiblePersonId === filters.responsiblePersonId);
  }
  
  return results;
}

function createAsset(data) {
  const now = new Date().toISOString();
  const asset = {
    id: generateId(),
    assetNo: data.assetNo,
    assetType: data.assetType,
    brand: data.brand,
    model: data.model,
    purchaseDate: data.purchaseDate,
    originalValue: data.originalValue,
    responsiblePerson: data.responsiblePerson,
    responsiblePersonId: data.responsiblePersonId,
    department: data.department,
    depreciationDepartment: data.depreciationDepartment || data.department,
    status: data.status || AssetStatus.IDLE,
    inventoryStatus: data.inventoryStatus || InventoryStatus.NORMAL,
    lastInventoryDate: data.lastInventoryDate,
    depreciationMethod: data.depreciationMethod || 'STRAIGHT_LINE',
    version: 1,
    createdAt: now,
    updatedAt: now
  };
  
  storage.assets.push(asset);
  return asset;
}

function updateAsset(id, data, expectedVersion = null) {
  const asset = getAssetById(id);
  if (!asset) {
    throw createError(EC.ASSET_NOT_FOUND, { assetId: id });
  }
  
  if (expectedVersion !== null && asset.version !== expectedVersion) {
    throw createError(EC.VERSION_CONFLICT, {
      currentVersion: asset.version,
      expectedVersion: expectedVersion
    });
  }
  
  const updatableFields = [
    'brand', 'model', 'purchaseDate', 'originalValue',
    'responsiblePerson', 'responsiblePersonId', 'department',
    'depreciationDepartment', 'status', 'inventoryStatus',
    'lastInventoryDate', 'depreciationMethod'
  ];
  
  updatableFields.forEach(field => {
    if (data[field] !== undefined) {
      asset[field] = data[field];
    }
  });
  
  asset.version++;
  asset.updatedAt = new Date().toISOString();
  
  return asset;
}

function checkAssetAvailableForTransfer(assetId) {
  const asset = getAssetById(assetId);
  if (!asset) {
    throw createError(EC.ASSET_NOT_FOUND, { assetId });
  }
  
  if (asset.status !== AssetStatus.IN_USE && asset.status !== AssetStatus.IDLE) {
    throw createError(EC.ASSET_STATUS_INVALID, {
      assetId,
      currentStatus: asset.status,
      allowedStatuses: [AssetStatus.IN_USE, AssetStatus.IDLE],
      reason: `资产当前状态为「${asset.status}」，仅「在用」或「闲置」状态的资产允许调拨`
    });
  }
  
  if (asset.inventoryStatus === InventoryStatus.SHORT) {
    throw createError(EC.INVENTORY_ASSET_SHORT, {
      assetId,
      assetNo: asset.assetNo,
      lastInventoryDate: asset.lastInventoryDate,
      reason: '该资产在上次盘点中被标记为盘亏，调拨前需先处理盘点差异（找回资产或走报损流程）'
    });
  }
  
  return asset;
}

function updateAssetAfterTransfer(assetId, transferOrder, expectedVersion = null) {
  return updateAsset(assetId, {
    responsiblePerson: transferOrder.incomingResponsiblePerson,
    responsiblePersonId: transferOrder.incomingResponsiblePersonId,
    department: transferOrder.incomingDepartment,
    depreciationDepartment: transferOrder.incomingDepreciationDepartment || transferOrder.incomingDepartment,
    status: AssetStatus.IN_USE
  }, expectedVersion);
}

module.exports = {
  getAssetById,
  getAssetByNo,
  listAssets,
  createAsset,
  updateAsset,
  checkAssetAvailableForTransfer,
  updateAssetAfterTransfer
};
