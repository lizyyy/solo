require('dotenv').config();
const { 
  sequelize, 
  ImportBatch, 
  SupplierDelivery, 
  WeighingRecord, 
  BasketReturn,
  LossRecord,
  CompensationQueue
} = require('../models');
const crypto = require('crypto');
const logger = require('../config/logger');

function generateId() {
  return crypto.randomUUID();
}

function fileHash(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

async function seedSampleData() {
  try {
    logger.info('开始初始化样例数据...');
    
    await sequelize.sync({ force: true });
    logger.info('数据库表已重置');

    const deliveryBatch = await ImportBatch.create({
      id: generateId(),
      sourceFileName: '供应商送货单_20240115.csv',
      sourceFileType: 'delivery_note',
      fileHash: fileHash('delivery_sample'),
      totalRows: 3,
      successRows: 3,
      failedRows: 0,
      status: 'completed',
      importedBy: 'admin',
    });

    const deliveries = await SupplierDelivery.bulkCreate([
      {
        id: generateId(),
        batchId: deliveryBatch.id,
        originalRowNumber: 1,
        originalData: { '送货单号': 'DEL20240115001', '供应商ID': 'SUP001', '供应商名称': '鲜果农场', '送货日期': '2024-01-15', '商品ID': 'PRD001', '商品名称': '红富士苹果', '送货数量': '100', '单位': 'kg', '单价': '5.00', '总金额': '500.00' },
        deliveryNo: 'DEL20240115001',
        supplierId: 'SUP001',
        supplierName: '鲜果农场',
        deliveryDate: '2024-01-15',
        productId: 'PRD001',
        productName: '红富士苹果',
        deliveryQuantity: 100.00,
        unit: 'kg',
        unitPrice: 5.00,
        totalAmount: 500.00,
        status: 'active',
        parseStatus: 'success',
      },
      {
        id: generateId(),
        batchId: deliveryBatch.id,
        originalRowNumber: 2,
        originalData: { '送货单号': 'DEL20240115001', '供应商ID': 'SUP001', '供应商名称': '鲜果农场', '送货日期': '2024-01-15', '商品ID': 'PRD002', '商品名称': '赣南脐橙', '送货数量': '80', '单位': 'kg', '单价': '8.00', '总金额': '640.00' },
        deliveryNo: 'DEL20240115001',
        supplierId: 'SUP001',
        supplierName: '鲜果农场',
        deliveryDate: '2024-01-15',
        productId: 'PRD002',
        productName: '赣南脐橙',
        deliveryQuantity: 80.00,
        unit: 'kg',
        unitPrice: 8.00,
        totalAmount: 640.00,
        status: 'active',
        parseStatus: 'success',
      },
      {
        id: generateId(),
        batchId: deliveryBatch.id,
        originalRowNumber: 3,
        originalData: { '送货单号': 'DEL20240115002', '供应商ID': 'SUP002', '供应商名称': '绿源蔬菜', '送货日期': '2024-01-15', '商品ID': 'PRD003', '商品名称': '有机番茄', '送货数量': '50', '单位': 'kg', '单价': '6.00', '总金额': '300.00' },
        deliveryNo: 'DEL20240115002',
        supplierId: 'SUP002',
        supplierName: '绿源蔬菜',
        deliveryDate: '2024-01-15',
        productId: 'PRD003',
        productName: '有机番茄',
        deliveryQuantity: 50.00,
        unit: 'kg',
        unitPrice: 6.00,
        totalAmount: 300.00,
        status: 'active',
        parseStatus: 'success',
      },
    ]);

    logger.info(`已创建 ${deliveries.length} 条送货单记录`);

    const weighingBatch = await ImportBatch.create({
      id: generateId(),
      sourceFileName: '称重记录_20240115.csv',
      sourceFileType: 'weighing_record',
      fileHash: fileHash('weighing_sample'),
      totalRows: 2,
      successRows: 2,
      failedRows: 0,
      status: 'completed',
      importedBy: 'admin',
    });

    const weighingRecords = await WeighingRecord.bulkCreate([
      {
        id: generateId(),
        batchId: weighingBatch.id,
        originalRowNumber: 1,
        originalData: { '称重单号': 'WGH20240115001', '送货单号': 'DEL20240115001', '商品ID': 'PRD001', '商品名称': '红富士苹果', '称重日期': '2024-01-15', '毛重': '105', '皮重': '8', '净重': '97', '单位': 'kg', '称重人': '张三' },
        weighingNo: 'WGH20240115001',
        deliveryNo: 'DEL20240115001',
        supplierId: 'SUP001',
        productId: 'PRD001',
        productName: '红富士苹果',
        weighingDate: '2024-01-15',
        grossWeight: 105.00,
        tareWeight: 8.00,
        netWeight: 97.00,
        unit: 'kg',
        weigher: '张三',
        status: 'active',
        parseStatus: 'success',
      },
      {
        id: generateId(),
        batchId: weighingBatch.id,
        originalRowNumber: 2,
        originalData: { '称重单号': 'WGH20240115002', '送货单号': 'DEL20240115002', '商品ID': 'PRD003', '商品名称': '有机番茄', '称重日期': '2024-01-15', '毛重': '52', '皮重': '3', '净重': '48', '单位': 'kg', '称重人': '李四' },
        weighingNo: 'WGH20240115002',
        deliveryNo: 'DEL20240115002',
        supplierId: 'SUP002',
        productId: 'PRD003',
        productName: '有机番茄',
        weighingDate: '2024-01-15',
        grossWeight: 52.00,
        tareWeight: 3.00,
        netWeight: 48.00,
        unit: 'kg',
        weigher: '李四',
        status: 'active',
        parseStatus: 'success',
      },
    ]);

    logger.info(`已创建 ${weighingRecords.length} 条称重记录`);

    const basketBatch = await ImportBatch.create({
      id: generateId(),
      sourceFileName: '退筐照片记录_20240115.csv',
      sourceFileType: 'basket_return',
      fileHash: fileHash('basket_sample'),
      totalRows: 2,
      successRows: 2,
      failedRows: 0,
      status: 'completed',
      importedBy: 'admin',
    });

    const basketReturns = await BasketReturn.bulkCreate([
      {
        id: generateId(),
        batchId: basketBatch.id,
        originalRowNumber: 1,
        originalData: { '退筐单号': 'RTN20240115001', '送货单号': 'DEL20240115001', '供应商ID': 'SUP001', '商品ID': 'PRD001', '退筐日期': '2024-01-15', '退筐数量': '5', '坏果重量': '3.5', '单位': 'kg', '退回原因': '运输磕碰损坏' },
        returnNo: 'RTN20240115001',
        deliveryNo: 'DEL20240115001',
        supplierId: 'SUP001',
        productId: 'PRD001',
        returnDate: '2024-01-15',
        basketCount: 5,
        badFruitWeight: 3.50,
        unit: 'kg',
        returnReason: '运输磕碰损坏',
        status: 'active',
        parseStatus: 'success',
      },
      {
        id: generateId(),
        batchId: basketBatch.id,
        originalRowNumber: 2,
        originalData: { '退筐单号': 'RTN20240115002', '送货单号': 'DEL20240115002', '供应商ID': 'SUP002', '商品ID': 'PRD003', '退筐日期': '2024-01-15', '退筐数量': '2', '坏果重量': '1.2', '单位': 'kg', '退回原因': '部分腐烂' },
        returnNo: 'RTN20240115002',
        deliveryNo: 'DEL20240115002',
        supplierId: 'SUP002',
        productId: 'PRD003',
        returnDate: '2024-01-15',
        basketCount: 2,
        badFruitWeight: 1.20,
        unit: 'kg',
        returnReason: '部分腐烂',
        status: 'active',
        parseStatus: 'success',
      },
    ]);

    logger.info(`已创建 ${basketReturns.length} 条退筐记录`);

    logger.info('');
    logger.info('=== 样例数据初始化完成 ===');
    logger.info('');
    logger.info('送货单:');
    logger.info('  - DEL20240115001: 鲜果农场 - 红富士苹果 100kg, 赣南脐橙 80kg');
    logger.info('  - DEL20240115002: 绿源蔬菜 - 有机番茄 50kg');
    logger.info('');
    logger.info('称重记录:');
    logger.info('  - WGH20240115001: 红富士苹果 净重97kg (损耗3kg)');
    logger.info('  - WGH20240115002: 有机番茄 净重48kg (损耗2kg)');
    logger.info('');
    logger.info('退筐记录:');
    logger.info('  - RTN20240115001: 红富士苹果 坏果3.5kg');
    logger.info('  - RTN20240115002: 有机番茄 坏果1.2kg');
    logger.info('');
    logger.info('接下来可以:');
    logger.info('  1. 调用 POST /api/loss/process-delivery/DEL20240115001 自动计算损耗');
    logger.info('  2. 调用 POST /api/loss/process-delivery/DEL20240115002 自动计算损耗');
    logger.info('  3. 查看队列状态: GET /api/queue/stats');
    logger.info('  4. 查看损耗记录: GET /api/loss/records');

    process.exit(0);
  } catch (error) {
    logger.error('样例数据初始化失败:', error);
    process.exit(1);
  }
}

seedSampleData();
