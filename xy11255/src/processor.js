const Order = require('../models/Order');
const OutOfStockItem = require('../models/OutOfStockItem');
const CompensationRule = require('../models/CompensationRule');
const ProcessingResult = require('../models/ProcessingResult');

class CompensationProcessor {
  constructor() {
    this.compensationTypes = {
      refund: '退款',
      exchange: '换货',
      coupon: '补券'
    };
  }

  async processOutOfStock() {
    const outOfStockItems = await OutOfStockItem.findAll();
    let processedCount = 0;

    for (const item of outOfStockItems) {
      const affectedOrders = await Order.findByProductId(item.product_id);

      for (const order of affectedOrders) {
        const compensationType = this.determineCompensationType(order);
        const value = this.calculateCompensationValue(order, compensationType);

        await ProcessingResult.create({
          order_id: order.id,
          order_no: order.order_no,
          compensation_type: compensationType,
          compensation_value: value,
          notes: `缺货商品: ${item.product_name}`
        });

        await Order.updateStatus(order.id, 'processed');
        processedCount++;
      }
    }

    return { processedCount };
  }

  determineCompensationType(order) {
    const totalAmount = order.total_amount;

    if (totalAmount > 100) {
      return 'refund';
    } else if (totalAmount > 50) {
      return 'coupon';
    } else {
      return 'exchange';
    }
  }

  calculateCompensationValue(order, compensationType) {
    switch (compensationType) {
      case 'refund':
        return order.total_amount;
      case 'coupon':
        return Math.min(order.total_amount * 0.1, 20);
      case 'exchange':
        return 0;
      default:
        return 0;
    }
  }

  async processRefund(order) {
    await ProcessingResult.create({
      order_id: order.id,
      order_no: order.order_no,
      compensation_type: 'refund',
      compensation_value: order.total_amount,
      notes: '全额退款'
    });
    await Order.updateStatus(order.id, 'refunded');
  }

  async processExchange(order) {
    await ProcessingResult.create({
      order_id: order.id,
      order_no: order.order_no,
      compensation_type: 'exchange',
      compensation_value: 0,
      notes: '换货处理'
    });
    await Order.updateStatus(order.id, 'exchanged');
  }

  async processCoupon(order) {
    const couponValue = Math.min(order.total_amount * 0.1, 20);
    await ProcessingResult.create({
      order_id: order.id,
      order_no: order.order_no,
      compensation_type: 'coupon',
      compensation_value: couponValue,
      notes: `补偿优惠券: ${couponValue}元`
    });
    await Order.updateStatus(order.id, 'couponed');
  }

  async getStatistics() {
    const stats = await ProcessingResult.getStatistics();
    return stats.map(s => ({
      type: this.compensationTypes[s.compensation_type] || s.compensation_type,
      count: s.count,
      totalValue: s.total_value || 0
    }));
  }

  async getAllProcessingResults() {
    return await ProcessingResult.findAll();
  }
}

module.exports = CompensationProcessor;
