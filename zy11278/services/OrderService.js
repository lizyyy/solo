const { v4: uuidv4 } = require('uuid');
const dayjs = require('dayjs');
const db = require('../models');

const ORDER_STATUS = {
  PENDING: 'pending',
  SUBMITTED: 'submitted',
  PARTIALLY_FILLED: 'partially_filled',
  FILLED: 'filled',
  CANCELLED: 'cancelled',
  REJECTED: 'rejected',
  EXPIRED: 'expired'
};

class OrderService {
  constructor() {
    this.sequelize = db.sequelize;
  }

  generateOrderNo() {
    return 'ORD' + dayjs().format('YYYYMMDDHHmmss') + Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  generateTradeNo() {
    return 'TRD' + dayjs().format('YYYYMMDDHHmmss') + Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  async createOrder(orderData, transaction = null) {
    const { trading_day_id, symbol, name, order_type, order_subtype, price, quantity, trade_plan_id, remark } = orderData;
    
    if (!trading_day_id) {
      throw new Error('交易日期不能为空');
    }
    if (!symbol) {
      throw new Error('股票代码不能为空');
    }
    if (!order_type || !['buy', 'sell'].includes(order_type)) {
      throw new Error('订单类型必须是 buy 或 sell');
    }
    if (!quantity || quantity <= 0) {
      throw new Error('委托数量必须大于0');
    }
    if (!order_subtype) {
      throw new Error('订单子类型不能为空');
    }

    if (order_subtype !== 'market' && (!price || price <= 0)) {
      throw new Error('限价单价格必须大于0');
    }

    const options = transaction ? { transaction } : {};

    const order = await db.Order.create({
      order_no: this.generateOrderNo(),
      trading_day_id,
      symbol,
      name: name || symbol,
      order_type,
      order_subtype: order_subtype || 'limit',
      status: ORDER_STATUS.PENDING,
      price: price || 0,
      quantity,
      filled_quantity: 0,
      trade_plan_id,
      remark,
      submit_time: new Date()
    }, options);

    return order;
  }

  async submitOrder(orderId, transaction = null) {
    const options = transaction ? { transaction } : {};
    const order = await db.Order.findByPk(orderId, options);
    
    if (!order) {
      throw new Error('订单不存在');
    }
    
    if (order.status !== ORDER_STATUS.PENDING) {
      throw new Error('只能提交待处理的订单');
    }

    order.status = ORDER_STATUS.SUBMITTED;
    order.submit_time = new Date();
    await order.save(options);

    return order;
  }

  async fillOrder(orderId, fillData, transaction = null) {
    const options = transaction ? { transaction } : {};
    const order = await db.Order.findByPk(orderId, options);
    
    if (!order) {
      throw new Error('订单不存在');
    }

    const { fill_quantity, fill_price, fill_time, commission = 0, tax = 0 } = fillData;
    
    if (!fill_quantity || fill_quantity <= 0) {
      throw new Error('成交数量必须大于0');
    }

    const remainingQuantity = order.quantity - order.filled_quantity;
    if (fill_quantity > remainingQuantity) {
      throw new Error(`成交数量不能大于剩余数量：${remainingQuantity}`);
    }

    if (!fill_price || fill_price <= 0) {
      throw new Error('成交价格必须大于0');
    }

    const fillAmount = fill_quantity * fill_price;
    
    let newFilledQuantity = order.filled_quantity + fill_quantity;
    let newFilledAmount = (order.filled_amount || 0) + fillAmount;
    let avgFilledPrice = newFilledAmount / newFilledQuantity;

    order.filled_quantity = newFilledQuantity;
    order.filled_price = avgFilledPrice;
    order.filled_amount = newFilledAmount;
    order.commission = (order.commission || 0) + commission;
    order.tax = (order.tax || 0) + tax;
    order.fill_time = fill_time || new Date();

    if (newFilledQuantity === order.quantity) {
      order.status = ORDER_STATUS.FILLED;
    } else {
      order.status = ORDER_STATUS.PARTIALLY_FILLED;
    }

    await order.save(options);

    const tradeHistory = await db.TradeHistory.create({
      order_id: order.id,
      trading_day_id: order.trading_day_id,
      symbol: order.symbol,
      name: order.name,
      trade_type: order.order_type,
      trade_no: this.generateTradeNo(),
      price: fill_price,
      quantity: fill_quantity,
      amount: fillAmount,
      commission,
      tax,
      total_cost: fillAmount + commission + tax,
      trade_time: fill_time || new Date()
    }, options);

    return { order, tradeHistory };
  }

  async cancelOrder(orderId, cancelReason = '', transaction = null) {
    const options = transaction ? { transaction } : {};
    const order = await db.Order.findByPk(orderId, options);
    
    if (!order) {
      throw new Error('订单不存在');
    }

    if (![ORDER_STATUS.PENDING, ORDER_STATUS.SUBMITTED, ORDER_STATUS.PARTIALLY_FILLED].includes(order.status)) {
      throw new Error('该订单状态不能撤单');
    }

    order.status = ORDER_STATUS.CANCELLED;
    order.cancel_time = new Date();
    order.cancel_reason = cancelReason;
    await order.save(options);

    return order;
  }

  async rejectOrder(orderId, rejectReason, transaction = null) {
    const options = transaction ? { transaction } : {};
    const order = await db.Order.findByPk(orderId, options);
    
    if (!order) {
      throw new Error('订单不存在');
    }

    order.status = ORDER_STATUS.REJECTED;
    order.cancel_time = new Date();
    order.cancel_reason = rejectReason;
    await order.save(options);

    return order;
  }

  async expireOrder(orderId, transaction = null) {
    const options = transaction ? { transaction } : {};
    const order = await db.Order.findByPk(orderId, options);
    
    if (!order) {
      throw new Error('订单不存在');
    }

    order.status = ORDER_STATUS.EXPIRED;
    order.cancel_time = new Date();
    await order.save(options);

    return order;
  }

  async triggerStopLoss(orderId, triggerPrice, triggerTime = null, transaction = null) {
    const options = transaction ? { transaction } : {};
    const order = await db.Order.findByPk(orderId, options);
    
    if (!order) {
      throw new Error('订单不存在');
    }

    if (order.order_subtype !== 'stop_loss') {
      throw new Error('不是止损订单');
    }

    order.trigger_type = 'stop_loss';
    order.trigger_price = triggerPrice;
    order.trigger_time = triggerTime || new Date();
    order.status = ORDER_STATUS.SUBMITTED;
    await order.save(options);

    return order;
  }

  async triggerTakeProfit(orderId, triggerPrice, triggerTime = null, transaction = null) {
    const options = transaction ? { transaction } : {};
    const order = await db.Order.findByPk(orderId, options);
    
    if (!order) {
      throw new Error('订单不存在');
    }

    if (order.order_subtype !== 'take_profit') {
      throw new Error('不是止盈订单');
    }

    order.trigger_type = 'take_profit';
    order.trigger_price = triggerPrice;
    order.trigger_time = triggerTime || new Date();
    order.status = ORDER_STATUS.SUBMITTED;
    await order.save(options);

    return order;
  }

  async getOrdersByTradingDay(tradingDayId, options = {}) {
    const { status, symbol, order_type, page = 1, pageSize = 50 } = options;
    
    const where = { trading_day_id: tradingDayId };
    if (status) where.status = status;
    if (symbol) where.symbol = symbol;
    if (order_type) where.order_type = order_type;

    const { count, rows } = await db.Order.findAndCountAll({
      where,
      include: [{
        model: db.TradePlan,
        as: 'tradePlan'
      }],
      order: [['created_at', 'DESC']],
      limit: pageSize,
      offset: (page - 1) * pageSize
    });

    return {
      total: count,
      page,
      pageSize,
      data: rows
    };
  }

  async getOrderById(orderId) {
    return await db.Order.findByPk(orderId, {
      include: [{
        model: db.TradePlan,
        as: 'tradePlan'
      }, {
        model: db.TradeHistory,
        as: 'tradeHistories'
      }]
    });
  }
}

module.exports = new OrderService();
