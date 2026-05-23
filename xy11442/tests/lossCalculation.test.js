require('dotenv').config();
const { sequelize, SupplierDelivery, WeighingRecord, BasketReturn, LossRecord, ImportBatch } = require('../src/models');
const LossCalculationService = require('../src/services/lossCalculationService');
const crypto = require('crypto');
const logger = require('../src/config/logger');

logger.transports.forEach(t => (t.silent = true));

function generateId() {
  return crypto.randomUUID();
}

beforeAll(async () => {
  await sequelize.sync({ force: true });
});

afterAll(async () => {
  await sequelize.close();
});

describe('LossCalculationService - 重复计算检测（幂等性）', () => {
  let batch, delivery, weighingRecord, basketReturn;

  beforeEach(async () => {
    await LossRecord.destroy({ where: {}, force: true });
    await WeighingRecord.destroy({ where: {}, force: true });
    await BasketReturn.destroy({ where: {}, force: true });
    await SupplierDelivery.destroy({ where: {}, force: true });
    await ImportBatch.destroy({ where: {}, force: true });

    batch = await ImportBatch.create({
      id: generateId(),
      sourceFileName: 'test.csv',
      sourceFileType: 'delivery_note',
      fileHash: 'testhash',
      totalRows: 1,
      successRows: 1,
      status: 'completed',
    });

    delivery = await SupplierDelivery.create({
      id: generateId(),
      batchId: batch.id,
      originalRowNumber: 1,
      originalData: {},
      deliveryNo: 'DEL-DUPLICATE-001',
      supplierId: 'SUP001',
      supplierName: '测试供应商',
      deliveryDate: '2024-01-15',
      productId: 'PRD001',
      productName: '测试商品',
      deliveryQuantity: 100.00,
      unit: 'kg',
      unitPrice: 5.00,
      totalAmount: 500.00,
      status: 'active',
      parseStatus: 'success',
    });

    weighingRecord = await WeighingRecord.create({
      id: generateId(),
      batchId: batch.id,
      originalRowNumber: 1,
      originalData: {},
      weighingNo: 'WGH-DUPLICATE-001',
      deliveryNo: 'DEL-DUPLICATE-001',
      supplierId: 'SUP001',
      productId: 'PRD001',
      productName: '测试商品',
      weighingDate: '2024-01-15',
      grossWeight: 105,
      tareWeight: 10,
      netWeight: 95,
      unit: 'kg',
      weigher: '测试员',
      status: 'active',
      parseStatus: 'success',
    });

    basketReturn = await BasketReturn.create({
      id: generateId(),
      batchId: batch.id,
      originalRowNumber: 1,
      originalData: {},
      returnNo: 'RTN-DUPLICATE-001',
      deliveryNo: 'DEL-DUPLICATE-001',
      supplierId: 'SUP001',
      productId: 'PRD001',
      returnDate: '2024-01-15',
      basketCount: 5,
      badFruitWeight: 3.5,
      unit: 'kg',
      returnReason: '测试坏果',
      status: 'active',
      parseStatus: 'success',
    });
  });

  test('二次分拣损耗重复计算会被检测并标记', async () => {
    const loss1 = await LossCalculationService.calculateSecondarySortingLoss(weighingRecord.id, { skipQueue: true });
    expect(loss1.isDuplicate).toBe(false);
    expect(loss1.lossQuantity).toBe(5);

    const loss2 = await LossCalculationService.calculateSecondarySortingLoss(weighingRecord.id, { skipQueue: true });
    expect(loss2.id).toBe(loss1.id);
  });

  test('坏果扣款重复计算会被检测并标记', async () => {
    const loss1 = await LossCalculationService.calculateBadFruitLoss(basketReturn.id, { skipQueue: true });
    expect(loss1.isDuplicate).toBe(false);

    const loss2 = await LossCalculationService.calculateBadFruitLoss(basketReturn.id, { skipQueue: true });
    expect(loss2.isDuplicate).toBe(true);
    expect(loss2.duplicateSourceId).toBe(loss1.id);
  });

  test('损耗计算金额正确', async () => {
    const loss = await LossCalculationService.calculateSecondarySortingLoss(weighingRecord.id, { skipQueue: true });
    
    expect(loss.lossQuantity).toBe(5);
    expect(loss.unitPrice).toBe(5);
    expect(parseFloat(loss.lossAmount)).toBe(25);
  });

  test('坏果扣款金额计算正确', async () => {
    const loss = await LossCalculationService.calculateBadFruitLoss(basketReturn.id, { skipQueue: true });
    
    expect(loss.lossQuantity).toBe(3.5);
    expect(loss.unitPrice).toBe(5);
    expect(parseFloat(loss.lossAmount)).toBe(17.5);
  });
});
