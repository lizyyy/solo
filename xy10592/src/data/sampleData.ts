import {
  Store,
  Asset,
  AssetStatus,
  AssetCategory,
  AcquisitionRecord,
  TransferRecord,
  RepairRecord,
  RepairType,
  ScrapRecord,
  ImportData
} from '../types';
import { generateId } from '../utils/id';

export function createSampleData(): ImportData {
  const stores: Store[] = [
    { id: 'store_001', name: '望京店', code: 'WJ' },
    { id: 'store_002', name: '中关村店', code: 'ZGC' },
    { id: 'store_003', name: '国贸店', code: 'GM' }
  ];

  const asset1Id = generateId('asset');
  const asset2Id = generateId('asset');
  const asset3Id = generateId('asset');
  const asset4Id = generateId('asset');
  const asset5Id = generateId('asset');

  const assets: Asset[] = [
    {
      id: asset1Id,
      code: 'FRE-0001',
      name: '海尔立式冰柜',
      category: AssetCategory.FREEZER,
      description: '500升商用立式冰柜',
      currentStoreId: 'store_002',
      status: AssetStatus.ACTIVE,
      originalCost: 0,
      accumulatedDepreciation: 0,
      netBookValue: 0,
      usefulLifeMonths: 0,
      remainingLifeMonths: 0,
      residualValueRate: 0.05,
      acquisitionDate: '2024-01-15',
      lastDepreciationDate: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: asset2Id,
      code: 'CAS-0001',
      name: 'IBM收银机',
      category: AssetCategory.CASH_REGISTER,
      description: '触摸屏收银机，带小票打印机',
      currentStoreId: 'store_001',
      status: AssetStatus.ACTIVE,
      originalCost: 0,
      accumulatedDepreciation: 0,
      netBookValue: 0,
      usefulLifeMonths: 0,
      remainingLifeMonths: 0,
      residualValueRate: 0.05,
      acquisitionDate: '2024-02-10',
      lastDepreciationDate: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: asset3Id,
      code: 'COF-0001',
      name: '星巴克全自动咖啡机',
      category: AssetCategory.COFFEE_MACHINE,
      description: '商用级全自动咖啡机，日产量500杯',
      currentStoreId: 'store_001',
      status: AssetStatus.ACTIVE,
      originalCost: 0,
      accumulatedDepreciation: 0,
      netBookValue: 0,
      usefulLifeMonths: 0,
      remainingLifeMonths: 0,
      residualValueRate: 0.05,
      acquisitionDate: '2024-01-20',
      lastDepreciationDate: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: asset4Id,
      code: 'FRE-0002',
      name: '美的卧式冰柜',
      category: AssetCategory.FREEZER,
      description: '300升商用卧式冰柜',
      currentStoreId: 'store_003',
      status: AssetStatus.ACTIVE,
      originalCost: 0,
      accumulatedDepreciation: 0,
      netBookValue: 0,
      usefulLifeMonths: 0,
      remainingLifeMonths: 0,
      residualValueRate: 0.05,
      acquisitionDate: '2023-06-01',
      lastDepreciationDate: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: asset5Id,
      code: 'CAS-0002',
      name: '惠普惠普通用收银机',
      category: AssetCategory.CASH_REGISTER,
      description: '基础版收银机',
      currentStoreId: 'store_003',
      status: AssetStatus.ACTIVE,
      originalCost: 0,
      accumulatedDepreciation: 0,
      netBookValue: 0,
      usefulLifeMonths: 0,
      remainingLifeMonths: 0,
      residualValueRate: 0.05,
      acquisitionDate: '2023-03-15',
      lastDepreciationDate: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ];

  const acquisitions: AcquisitionRecord[] = [
    {
      id: generateId('acq'),
      assetId: asset1Id,
      storeId: 'store_001',
      acquisitionDate: '2024-01-15',
      cost: 8500.00,
      usefulLifeMonths: 60,
      residualValueRate: 0.05,
      supplier: '海尔商用设备有限公司',
      invoiceNumber: 'INV-2024-0115-001',
      createdBy: 'admin',
      createdAt: new Date().toISOString()
    },
    {
      id: generateId('acq'),
      assetId: asset2Id,
      storeId: 'store_001',
      acquisitionDate: '2024-02-10',
      cost: 12000.00,
      usefulLifeMonths: 36,
      residualValueRate: 0.05,
      supplier: 'IBM零售解决方案',
      invoiceNumber: 'INV-2024-0210-001',
      createdBy: 'admin',
      createdAt: new Date().toISOString()
    },
    {
      id: generateId('acq'),
      assetId: asset3Id,
      storeId: 'store_001',
      acquisitionDate: '2024-01-20',
      cost: 25000.00,
      usefulLifeMonths: 48,
      residualValueRate: 0.05,
      supplier: '星巴克设备供应商',
      invoiceNumber: 'INV-2024-0120-001',
      createdBy: 'admin',
      createdAt: new Date().toISOString()
    },
    {
      id: generateId('acq'),
      assetId: asset4Id,
      storeId: 'store_002',
      acquisitionDate: '2023-06-01',
      cost: 6000.00,
      usefulLifeMonths: 60,
      residualValueRate: 0.05,
      supplier: '美的商用电器',
      invoiceNumber: 'INV-2023-0601-001',
      createdBy: 'admin',
      createdAt: new Date().toISOString()
    },
    {
      id: generateId('acq'),
      assetId: asset5Id,
      storeId: 'store_003',
      acquisitionDate: '2023-03-15',
      cost: 8000.00,
      usefulLifeMonths: 36,
      residualValueRate: 0.05,
      supplier: '惠普零售设备',
      invoiceNumber: 'INV-2023-0315-001',
      createdBy: 'admin',
      createdAt: new Date().toISOString()
    }
  ];

  const transfers: TransferRecord[] = [
    {
      id: generateId('trans'),
      assetId: asset1Id,
      fromStoreId: 'store_001',
      toStoreId: 'store_002',
      transferDate: '2024-03-01',
      reason: '望京店冰柜容量不足，从总部门店调拨',
      transferor: '张三',
      transferee: '李四',
      approvedBy: '王经理',
      createdBy: 'admin',
      createdAt: new Date().toISOString()
    },
    {
      id: generateId('trans'),
      assetId: asset4Id,
      fromStoreId: 'store_002',
      toStoreId: 'store_003',
      transferDate: '2024-02-15',
      reason: '国贸店新增冰品业务，需要增加冰柜',
      transferor: '李四',
      transferee: '王五',
      approvedBy: '王经理',
      createdBy: 'admin',
      createdAt: new Date().toISOString()
    }
  ];

  const repairs: RepairRecord[] = [
    {
      id: generateId('rep'),
      assetId: asset3Id,
      storeId: 'store_001',
      repairDate: '2024-04-10',
      repairType: RepairType.CAPITALIZED,
      cost: 5000.00,
      description: '咖啡机核心部件损坏，更换压缩机和加热系统，延长使用寿命12个月',
      vendor: '星巴克授权维修中心',
      extendedLifeMonths: 12,
      createdBy: 'maintenance',
      createdAt: new Date().toISOString()
    },
    {
      id: generateId('rep'),
      assetId: asset2Id,
      storeId: 'store_001',
      repairDate: '2024-03-20',
      repairType: RepairType.ROUTINE,
      cost: 800.00,
      description: '收银机触摸屏校准和清洁，费用化处理',
      vendor: 'IBM售后',
      extendedLifeMonths: 0,
      createdBy: 'maintenance',
      createdAt: new Date().toISOString()
    }
  ];

  const scraps: ScrapRecord[] = [
    {
      id: generateId('scrap'),
      assetId: asset5Id,
      storeId: 'store_003',
      scrapDate: '2026-01-15',
      reason: '收银机硬件老化，无法支持新系统升级，申请报废',
      scrapValue: 500.00,
      approvedBy: '财务总监',
      createdBy: 'admin',
      createdAt: new Date().toISOString()
    }
  ];

  return {
    stores,
    assets,
    acquisitions,
    transfers,
    repairs,
    scraps
  };
}

export function createInvalidSampleData(): ImportData {
  const stores: Store[] = [
    { id: 'store_001', name: '望京店', code: 'WJ' }
  ];

  const asset1Id = generateId('asset');
  const asset2Id = generateId('asset');

  const assets: Asset[] = [
    {
      id: asset1Id,
      code: 'FRE-0001',
      name: '海尔立式冰柜',
      category: AssetCategory.FREEZER,
      description: '500升商用立式冰柜',
      currentStoreId: 'store_001',
      status: AssetStatus.ACTIVE,
      originalCost: 0,
      accumulatedDepreciation: 0,
      netBookValue: 0,
      usefulLifeMonths: 0,
      remainingLifeMonths: 0,
      residualValueRate: 0.05,
      acquisitionDate: '2024-01-15',
      lastDepreciationDate: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: asset2Id,
      code: 'FRE-0001',
      name: '美的冰柜',
      category: AssetCategory.FREEZER,
      description: '重复编号的冰柜',
      currentStoreId: 'store_001',
      status: AssetStatus.ACTIVE,
      originalCost: 0,
      accumulatedDepreciation: 0,
      netBookValue: 0,
      usefulLifeMonths: 0,
      remainingLifeMonths: 0,
      residualValueRate: 0.05,
      acquisitionDate: '2024-02-10',
      lastDepreciationDate: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ];

  const acquisitions: AcquisitionRecord[] = [
    {
      id: generateId('acq'),
      assetId: asset1Id,
      storeId: 'store_001',
      acquisitionDate: '2024-01-15',
      cost: 8500.00,
      usefulLifeMonths: 60,
      residualValueRate: 0.05,
      supplier: '海尔',
      invoiceNumber: 'INV-1',
      createdBy: 'admin',
      createdAt: new Date().toISOString()
    },
    {
      id: generateId('acq'),
      assetId: asset2Id,
      storeId: 'store_001',
      acquisitionDate: '2024-02-10',
      cost: 6000.00,
      usefulLifeMonths: 60,
      residualValueRate: 0.05,
      supplier: '美的',
      invoiceNumber: 'INV-2',
      createdBy: 'admin',
      createdAt: new Date().toISOString()
    }
  ];

  const scraps: ScrapRecord[] = [
    {
      id: generateId('scrap'),
      assetId: asset1Id,
      storeId: 'store_001',
      scrapDate: '2026-05-01',
      reason: '测试报废',
      scrapValue: 1000.00,
      approvedBy: '测试',
      createdBy: 'admin',
      createdAt: new Date().toISOString()
    }
  ];

  const transfers: TransferRecord[] = [
    {
      id: generateId('trans'),
      assetId: asset1Id,
      fromStoreId: 'store_001',
      toStoreId: 'store_999',
      transferDate: '2026-05-10',
      reason: '报废后的调拨（这会失败）',
      transferor: '测试',
      transferee: '测试',
      approvedBy: '测试',
      createdBy: 'admin',
      createdAt: new Date().toISOString()
    }
  ];

  return {
    stores,
    assets,
    acquisitions,
    transfers,
    repairs: [],
    scraps
  };
}
