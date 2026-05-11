import { dataStore } from './data/store';
import { batchService } from './services/batchService';
import { freezeService } from './services/freezeService';
import { inventoryService } from './services/inventoryService';
import { Product, Warehouse } from './types';

export function seedSampleData(): void {
  dataStore.clearAll();

  const products: Product[] = [
    {
      id: 'prod-001',
      name: '电子元器件A',
      sku: 'SKU-001',
      ownerId: 'owner-001',
      ownerName: '张三',
      alertRules: {
        lowDays: 30,
        mediumDays: 60,
        highDays: 90,
        criticalDays: 120
      }
    },
    {
      id: 'prod-002',
      name: '电子元器件B',
      sku: 'SKU-002',
      ownerId: 'owner-001',
      ownerName: '张三',
      alertRules: {
        lowDays: 30,
        mediumDays: 60,
        highDays: 90,
        criticalDays: 120
      }
    },
    {
      id: 'prod-003',
      name: '机械设备零件C',
      sku: 'SKU-003',
      ownerId: 'owner-002',
      ownerName: '李四',
      alertRules: {
        lowDays: 60,
        mediumDays: 90,
        highDays: 120,
        criticalDays: 180
      }
    },
    {
      id: 'prod-004',
      name: '包装材料D',
      sku: 'SKU-004',
      ownerId: 'owner-003',
      ownerName: '王五',
      alertRules: {
        lowDays: 15,
        mediumDays: 30,
        highDays: 45,
        criticalDays: 60
      }
    }
  ];

  products.forEach(p => dataStore.addProduct(p));

  const warehouses: Warehouse[] = [
    { id: 'wh-001', name: '华东仓库', location: '上海' },
    { id: 'wh-002', name: '华北仓库', location: '北京' },
    { id: 'wh-003', name: '华南仓库', location: '广州' }
  ];

  warehouses.forEach(w => dataStore.addWarehouse(w));

  const now = new Date();

  const newBatch = batchService.createBatch(
    'BATCH-2026-001',
    'prod-001',
    'wh-001',
    500,
    new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000)
  );

  const mediumBatch = batchService.createBatch(
    'BATCH-2026-002',
    'prod-002',
    'wh-001',
    1000,
    new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000)
  );

  const highBatch = batchService.createBatch(
    'BATCH-2026-003',
    'prod-003',
    'wh-002',
    200,
    new Date(now.getTime() - 100 * 24 * 60 * 60 * 1000)
  );

  const criticalBatch = batchService.createBatch(
    'BATCH-2026-004',
    'prod-004',
    'wh-002',
    300,
    new Date(now.getTime() - 75 * 24 * 60 * 60 * 1000)
  );

  const frozenBatch = batchService.createBatch(
    'BATCH-2026-005',
    'prod-002',
    'wh-003',
    800,
    new Date(now.getTime() - 70 * 24 * 60 * 60 * 1000)
  );

  const disposedBatch = batchService.createBatch(
    'BATCH-2026-006',
    'prod-003',
    'wh-003',
    150,
    new Date(now.getTime() - 200 * 24 * 60 * 60 * 1000)
  );

  const freeze = freezeService.createFreeze(
    frozenBatch.id,
    800,
    '质量检验',
    'operator-001'
  );

  inventoryService.createDisposal(
    disposedBatch.id,
    150,
    '超期报废',
    'operator-001'
  );

  console.log('样例数据已创建:');
  console.log(`  新批次 (5天): ${newBatch.batchNumber} - ${newBatch.quantity}件`);
  console.log(`  临期批次 (45天, medium): ${mediumBatch.batchNumber} - ${mediumBatch.quantity}件`);
  console.log(`  高风险批次 (100天, high): ${highBatch.batchNumber} - ${highBatch.quantity}件`);
  console.log(`  严重风险批次 (75天, critical): ${criticalBatch.batchNumber} - ${criticalBatch.quantity}件`);
  console.log(`  冻结批次 (70天): ${frozenBatch.batchNumber} - ${frozenBatch.frozenQuantity}件冻结`);
  console.log(`  已处置批次 (200天): ${disposedBatch.batchNumber} - 已报废`);
}
