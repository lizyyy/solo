const logger = require('../config/logger');
const { LossRecord, SupplierDelivery, WeighingRecord, BasketReturn } = require('../models');
const QueueService = require('./queueService');
const { Op } = require('sequelize');

class LossCalculationService {
  static generateLossNo() {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `L${dateStr}${random}`;
  }

  static async calculateBadFruitLoss(basketReturnId, options = {}) {
    const basketReturn = await BasketReturn.findByPk(basketReturnId);
    if (!basketReturn) {
      throw new Error('退筐记录不存在');
    }

    const delivery = await SupplierDelivery.findOne({
      where: { deliveryNo: basketReturn.deliveryNo },
    });

    if (!delivery) {
      logger.warn(`未找到关联送货单: ${basketReturn.deliveryNo}`);
    }

    const lossNo = this.generateLossNo();
    const lossQuantity = basketReturn.badFruitWeight || 0;
    const unitPrice = delivery?.unitPrice || 0;
    const lossAmount = Number((lossQuantity * unitPrice).toFixed(2));

    const duplicateCheck = await this.checkDuplicateBadFruit(basketReturn);

    const lossRecord = await LossRecord.create({
      lossNo,
      deliveryNo: basketReturn.deliveryNo,
      supplierId: basketReturn.supplierId || delivery?.supplierId,
      supplierName: delivery?.supplierName || '',
      productId: basketReturn.productId || delivery?.productId,
      productName: delivery?.productName || '',
      lossDate: basketReturn.returnDate,
      lossType: 'bad_fruit',
      lossCategory: '坏果扣款',
      deliveryQuantity: delivery?.deliveryQuantity,
      actualWeight: null,
      lossQuantity,
      unit: basketReturn.unit || 'kg',
      unitPrice,
      lossAmount,
      isDuplicate: duplicateCheck.isDuplicate,
      duplicateSourceId: duplicateCheck.duplicateSourceId,
      sourceType: 'basket_return',
      sourceId: basketReturn.id,
      status: 'pending',
      remark: basketReturn.returnReason,
    });

    if (!duplicateCheck.isDuplicate && !options.skipQueue) {
      await QueueService.addJob('bad_fruit_deduction', {
        lossRecordId: lossRecord.id,
        lossNo,
        deliveryNo: lossRecord.deliveryNo,
        supplierId: lossRecord.supplierId,
        amount: lossAmount,
        simulateError: options.simulateError,
      });
    }

    return lossRecord;
  }

  static async checkDuplicateBadFruit(basketReturn) {
    const existing = await LossRecord.findOne({
      where: {
        sourceType: 'basket_return',
        lossType: 'bad_fruit',
        [Op.or]: [
          { sourceId: basketReturn.id },
          { 
            deliveryNo: basketReturn.deliveryNo,
            productId: basketReturn.productId,
            lossDate: basketReturn.returnDate,
          },
        ],
      },
    });

    if (existing) {
      logger.warn(`发现重复坏果记录: ${existing.lossNo}`);
      return {
        isDuplicate: true,
        duplicateSourceId: existing.id,
      };
    }

    return { isDuplicate: false };
  }

  static async calculateSecondarySortingLoss(weighingRecordId, options = {}) {
    const weighingRecord = await WeighingRecord.findByPk(weighingRecordId);
    if (!weighingRecord) {
      throw new Error('称重记录不存在');
    }

    const delivery = await SupplierDelivery.findOne({
      where: { deliveryNo: weighingRecord.deliveryNo },
    });

    if (!delivery) {
      throw new Error(`未找到关联送货单: ${weighingRecord.deliveryNo}`);
    }

    const lossQuantity = Number((delivery.deliveryQuantity - weighingRecord.netWeight).toFixed(2));
    
    if (lossQuantity <= 0) {
      logger.info(`送货量不大于称重，无损耗: delivery=${delivery.deliveryQuantity}, net=${weighingRecord.netWeight}`);
      return null;
    }

    const duplicateCheck = await this.checkDuplicateSecondarySorting(weighingRecord);

    if (duplicateCheck.isDuplicate) {
      logger.info(`二次分拣损耗已计算过，跳过: ${weighingRecord.weighingNo}`);
      return await LossRecord.findByPk(duplicateCheck.duplicateSourceId);
    }

    const lossNo = this.generateLossNo();
    const lossAmount = Number((lossQuantity * delivery.unitPrice).toFixed(2));

    const lossRecord = await LossRecord.create({
      lossNo,
      deliveryNo: weighingRecord.deliveryNo,
      supplierId: weighingRecord.supplierId || delivery.supplierId,
      supplierName: delivery.supplierName,
      productId: weighingRecord.productId,
      productName: weighingRecord.productName,
      lossDate: weighingRecord.weighingDate,
      lossType: 'secondary_sorting',
      lossCategory: '二次分拣损耗',
      deliveryQuantity: delivery.deliveryQuantity,
      actualWeight: weighingRecord.netWeight,
      lossQuantity,
      unit: weighingRecord.unit || 'kg',
      unitPrice: delivery.unitPrice,
      lossAmount,
      isDuplicate: false,
      sourceType: 'weighing',
      sourceId: weighingRecord.id,
      status: 'pending',
    });

    if (!options.skipQueue) {
      await QueueService.addJob('secondary_sorting', {
        lossRecordId: lossRecord.id,
        lossNo,
        deliveryNo: lossRecord.deliveryNo,
        supplierId: lossRecord.supplierId,
        lossQuantity,
        lossAmount,
      });
    }

    return lossRecord;
  }

  static async checkDuplicateSecondarySorting(weighingRecord) {
    const existing = await LossRecord.findOne({
      where: {
        sourceType: 'weighing',
        lossType: 'secondary_sorting',
        [Op.or]: [
          { sourceId: weighingRecord.id },
          { deliveryNo: weighingRecord.deliveryNo },
        ],
      },
    });

    if (existing) {
      return {
        isDuplicate: true,
        duplicateSourceId: existing.id,
      };
    }

    return { isDuplicate: false };
  }

  static async processDeliveryMatching(deliveryNo) {
    const delivery = await SupplierDelivery.findOne({ where: { deliveryNo } });
    if (!delivery) {
      throw new Error(`送货单不存在: ${deliveryNo}`);
    }

    const weighingRecords = await WeighingRecord.findAll({
      where: { deliveryNo },
    });

    const basketReturns = await BasketReturn.findAll({
      where: { deliveryNo },
    });

    const results = {
      delivery,
      weighingRecords: [],
      basketReturns: [],
      lossRecords: [],
    };

    for (const wr of weighingRecords) {
      const loss = await this.calculateSecondarySortingLoss(wr.id);
      if (loss) {
        results.lossRecords.push(loss);
      }
      results.weighingRecords.push(wr);
    }

    for (const br of basketReturns) {
      const loss = await this.calculateBadFruitLoss(br.id);
      results.lossRecords.push(loss);
      results.basketReturns.push(br);
    }

    return results;
  }

  static async getLossRecords(params = {}) {
    const { 
      deliveryNo, 
      supplierId, 
      lossType, 
      status, 
      isDuplicate,
      startDate,
      endDate,
      page = 1, 
      pageSize = 20 
    } = params;
    
    const where = {};
    if (deliveryNo) where.deliveryNo = deliveryNo;
    if (supplierId) where.supplierId = supplierId;
    if (lossType) where.lossType = lossType;
    if (status) where.status = status;
    if (isDuplicate !== undefined) where.isDuplicate = isDuplicate;
    if (startDate || endDate) {
      where.lossDate = {};
      if (startDate) where.lossDate[Op.gte] = startDate;
      if (endDate) where.lossDate[Op.lte] = endDate;
    }

    return await LossRecord.findAndCountAll({
      where,
      order: [['lossDate', 'DESC'], ['createdAt', 'DESC']],
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });
  }

  static async getLossById(id) {
    return await LossRecord.findByPk(id, {
      include: [{ association: 'delivery' }],
    });
  }

  static async getLossSummary(params = {}) {
    const { supplierId, startDate, endDate, lossType } = params;
    const where = {};
    
    if (supplierId) where.supplierId = supplierId;
    if (lossType) where.lossType = lossType;
    if (startDate || endDate) {
      where.lossDate = {};
      if (startDate) where.lossDate[Op.gte] = startDate;
      if (endDate) where.lossDate[Op.lte] = endDate;
    }

    const records = await LossRecord.findAll({
      where,
      attributes: [
        'lossType',
        'status',
        'isDuplicate',
        [LossRecord.sequelize.fn('COUNT', LossRecord.sequelize.col('id')), 'count'],
        [LossRecord.sequelize.fn('SUM', LossRecord.sequelize.col('lossQuantity')), 'totalQuantity'],
        [LossRecord.sequelize.fn('SUM', LossRecord.sequelize.col('lossAmount')), 'totalAmount'],
      ],
      group: ['lossType', 'status', 'isDuplicate'],
      raw: true,
    });

    return records;
  }
}

module.exports = LossCalculationService;
