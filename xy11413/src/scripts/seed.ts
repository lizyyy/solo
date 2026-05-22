import { getDbConnection } from '../database/connection';
import {
  createImportSource,
  importOrderItems,
  importWasteRecords,
  importHeadquarterPrices,
  importSupplementRecords
} from '../services/importService';

const FRANCHISEES = [
  { id: 'F001', name: '北京朝阳店' },
  { id: 'F002', name: '上海浦东店' },
  { id: 'F003', name: '广州天河店' },
  { id: 'F004', name: '深圳南山店' }
];

const MATERIALS = [
  { code: 'M001', name: '红茶', unit: 'kg', price: 45 },
  { code: 'M002', name: '绿茶', unit: 'kg', price: 38 },
  { code: 'M003', name: '乌龙', unit: 'kg', price: 52 },
  { code: 'M004', name: '珍珠', unit: 'kg', price: 12 },
  { code: 'M005', name: '椰果', unit: 'kg', price: 8 },
  { code: 'M006', name: '果糖', unit: 'kg', price: 15 },
  { code: 'M007', name: '牛奶', unit: 'L', price: 22 },
  { code: 'M008', name: '奶盖粉', unit: 'kg', price: 35 }
];

const generateOrderItems = (count: number) => {
  const items = [];
  for (let i = 0; i < count; i++) {
    const franchisee = FRANCHISEES[Math.floor(Math.random() * FRANCHISEES.length)];
    const material = MATERIALS[Math.floor(Math.random() * MATERIALS.length)];
    const date = new Date();
    date.setDate(date.getDate() - Math.floor(Math.random() * 30));
    
    items.push({
      orderNo: `ORD${String(20240001 + i).padStart(10, '0')}`,
      materialCode: material.code,
      materialName: material.name,
      quantity: Math.round((Math.random() * 50 + 10) * 100) / 100,
      unit: material.unit,
      franchiseeId: franchisee.id,
      franchiseeName: franchisee.name,
      orderDate: date.toISOString().split('T')[0]
    });
  }
  return items;
};

const generateWasteRecords = (count: number) => {
  const records = [];
  for (let i = 0; i < count; i++) {
    const franchisee = FRANCHISEES[Math.floor(Math.random() * FRANCHISEES.length)];
    const material = MATERIALS[Math.floor(Math.random() * MATERIALS.length)];
    const date = new Date();
    date.setDate(date.getDate() - Math.floor(Math.random() * 30));
    const reasons = ['过期', '破损', '品质不合格', '其他'];
    
    records.push({
      wasteNo: `WST${String(10001 + i).padStart(8, '0')}`,
      materialCode: material.code,
      materialName: material.name,
      quantity: Math.round((Math.random() * 5 + 0.5) * 100) / 100,
      unit: material.unit,
      wasteReason: reasons[Math.floor(Math.random() * reasons.length)],
      franchiseeId: franchisee.id,
      franchiseeName: franchisee.name,
      wasteDate: date.toISOString().split('T')[0]
    });
  }
  return records;
};

const generatePrices = () => {
  return MATERIALS.map(m => ({
    materialCode: m.code,
    materialName: m.name,
    price: m.price,
    unit: m.unit,
    effectiveDate: '2024-01-01',
    expireDate: '2024-12-31'
  }));
};

const generateSupplementRecords = (count: number) => {
  const records = [];
  for (let i = 0; i < count; i++) {
    const franchisee = FRANCHISEES[Math.floor(Math.random() * FRANCHISEES.length)];
    const material = MATERIALS[Math.floor(Math.random() * MATERIALS.length)];
    const date = new Date();
    date.setDate(date.getDate() - Math.floor(Math.random() * 30));
    const reasons = ['运输损耗补送', '品质问题补发', '活动额外赠送', '盘点差异补平'];
    
    records.push({
      supplementNo: `SUP${String(10001 + i).padStart(8, '0')}`,
      materialCode: material.code,
      materialName: material.name,
      quantity: Math.round((Math.random() * 10 + 1) * 100) / 100,
      unit: material.unit,
      supplementReason: reasons[Math.floor(Math.random() * reasons.length)],
      franchiseeId: franchisee.id,
      franchiseeName: franchisee.name,
      supplementDate: date.toISOString().split('T')[0]
    });
  }
  return records;
};

const runSeed = async () => {
  console.log('开始造数...');
  
  getDbConnection();
  
  const orderItems = generateOrderItems(50);
  const sourceId1 = await createImportSource(
    'orders_202405.csv',
    JSON.stringify(orderItems),
    'order',
    'admin'
  );
  const result1 = await importOrderItems(sourceId1, orderItems, 'orders_202405.csv');
  console.log(`订货表: ${result1.insertedCount} 条新增, ${result1.updatedCount} 条更新`);

  const wasteRecords = generateWasteRecords(20);
  const sourceId2 = await createImportSource(
    'waste_202405.csv',
    JSON.stringify(wasteRecords),
    'waste',
    'admin'
  );
  const result2 = await importWasteRecords(sourceId2, wasteRecords, 'waste_202405.csv');
  console.log(`损耗登记: ${result2.insertedCount} 条新增, ${result2.updatedCount} 条更新`);

  const prices = generatePrices();
  const sourceId3 = await createImportSource(
    'hq_prices_2024.csv',
    JSON.stringify(prices),
    'price',
    'admin'
  );
  const result3 = await importHeadquarterPrices(sourceId3, prices, 'hq_prices_2024.csv');
  console.log(`总部价格表: ${result3.insertedCount} 条新增, ${result3.updatedCount} 条更新`);

  const supplementRecords = generateSupplementRecords(15);
  const sourceId4 = await createImportSource(
    'supplement_202405.csv',
    JSON.stringify(supplementRecords),
    'supplement',
    'admin'
  );
  const result4 = await importSupplementRecords(sourceId4, supplementRecords, 'supplement_202405.csv');
  console.log(`临时补录单: ${result4.insertedCount} 条新增, ${result4.updatedCount} 条更新`);

  console.log('造数完成!');
  process.exit(0);
};

runSeed().catch(console.error);
