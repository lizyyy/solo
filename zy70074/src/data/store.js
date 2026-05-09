const { v4: uuidv4 } = require('uuid');

const AssetStatus = {
  IN_USE: 'IN_USE',
  IDLE: 'IDLE',
  TRANSFERRING: 'TRANSFERRING',
  SCRAPPED: 'SCRAPPED'
};

const TransferStatus = {
  DRAFT: 'DRAFT',
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED'
};

const TransferValidTransitions = {
  [TransferStatus.DRAFT]: [TransferStatus.PENDING_APPROVAL, TransferStatus.CANCELLED],
  [TransferStatus.PENDING_APPROVAL]: [TransferStatus.APPROVED, TransferStatus.REJECTED, TransferStatus.CANCELLED],
  [TransferStatus.APPROVED]: [TransferStatus.COMPLETED, TransferStatus.CANCELLED],
  [TransferStatus.REJECTED]: [],
  [TransferStatus.COMPLETED]: [],
  [TransferStatus.CANCELLED]: []
};

const InventoryStatus = {
  NORMAL: 'NORMAL',
  OVER: 'OVER',
  SHORT: 'SHORT',
  PENDING: 'PENDING'
};

const DepreciationMethod = {
  STRAIGHT_LINE: 'STRAIGHT_LINE'
};

const storage = {
  assets: [],
  transferOrders: [],
  approvalRecords: [],
  depreciationConfigs: [],
  inventoryRecords: [],
  version: 0
};

function initSampleData() {
  storage.depreciationConfigs = [
    {
      id: 'config-laptop',
      assetType: 'LAPTOP',
      usefulLifeMonths: 36,
      residualRate: 0.05,
      method: DepreciationMethod.STRAIGHT_LINE,
      createdAt: new Date('2024-01-01').toISOString()
    },
    {
      id: 'config-monitor',
      assetType: 'MONITOR',
      usefulLifeMonths: 60,
      residualRate: 0.05,
      method: DepreciationMethod.STRAIGHT_LINE,
      createdAt: new Date('2024-01-01').toISOString()
    }
  ];

  storage.assets = [
    {
      id: 'asset-001',
      assetNo: 'LT-2023-001',
      assetType: 'LAPTOP',
      brand: 'MacBook Pro',
      model: '14寸 M3',
      purchaseDate: '2023-06-15',
      originalValue: 14999,
      responsiblePerson: '张三',
      responsiblePersonId: 'emp-zhangsan',
      department: '研发部',
      depreciationDepartment: '研发部',
      status: AssetStatus.IN_USE,
      inventoryStatus: InventoryStatus.NORMAL,
      lastInventoryDate: '2025-03-01',
      depreciationMethod: DepreciationMethod.STRAIGHT_LINE,
      version: 1,
      createdAt: '2023-06-15T00:00:00.000Z',
      updatedAt: '2025-03-01T00:00:00.000Z'
    },
    {
      id: 'asset-002',
      assetNo: 'MT-2023-001',
      assetType: 'MONITOR',
      brand: 'Dell',
      model: 'U2723QE',
      purchaseDate: '2023-08-20',
      originalValue: 5999,
      responsiblePerson: '张三',
      responsiblePersonId: 'emp-zhangsan',
      department: '研发部',
      depreciationDepartment: '研发部',
      status: AssetStatus.IN_USE,
      inventoryStatus: InventoryStatus.NORMAL,
      lastInventoryDate: '2025-03-01',
      depreciationMethod: DepreciationMethod.STRAIGHT_LINE,
      version: 1,
      createdAt: '2023-08-20T00:00:00.000Z',
      updatedAt: '2025-03-01T00:00:00.000Z'
    },
    {
      id: 'asset-003',
      assetNo: 'LT-2022-001',
      assetType: 'LAPTOP',
      brand: 'ThinkPad',
      model: 'X1 Carbon',
      purchaseDate: '2022-05-10',
      originalValue: 12999,
      responsiblePerson: '李四',
      responsiblePersonId: 'emp-lisi',
      department: '财务部',
      depreciationDepartment: '财务部',
      status: AssetStatus.IN_USE,
      inventoryStatus: InventoryStatus.SHORT,
      lastInventoryDate: '2025-03-15',
      depreciationMethod: DepreciationMethod.STRAIGHT_LINE,
      version: 1,
      createdAt: '2022-05-10T00:00:00.000Z',
      updatedAt: '2025-03-15T00:00:00.000Z'
    },
    {
      id: 'asset-004',
      assetNo: 'MT-2022-001',
      assetType: 'MONITOR',
      brand: 'LG',
      model: '27UL850',
      purchaseDate: '2022-03-01',
      originalValue: 4599,
      responsiblePerson: '王五',
      responsiblePersonId: 'emp-wangwu',
      department: '市场部',
      depreciationDepartment: '市场部',
      status: AssetStatus.IDLE,
      inventoryStatus: InventoryStatus.NORMAL,
      lastInventoryDate: '2025-03-01',
      depreciationMethod: DepreciationMethod.STRAIGHT_LINE,
      version: 1,
      createdAt: '2022-03-01T00:00:00.000Z',
      updatedAt: '2025-03-01T00:00:00.000Z'
    }
  ];

  storage.inventoryRecords = [
    {
      id: 'inv-001',
      assetId: 'asset-003',
      inventoryDate: '2025-03-15',
      status: InventoryStatus.SHORT,
      remark: '资产盘点时未找到，暂按盘亏处理',
      recordedBy: '资产管理员',
      createdAt: '2025-03-15T10:00:00.000Z'
    }
  ];

  storage.version = 1;
}

function generateId() {
  return uuidv4();
}

module.exports = {
  storage,
  AssetStatus,
  TransferStatus,
  TransferValidTransitions,
  InventoryStatus,
  DepreciationMethod,
  initSampleData,
  generateId
};
