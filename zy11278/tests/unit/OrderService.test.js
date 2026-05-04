const sequelize = require('../../config/database');
const { Order, TradingDay } = require('../../models');
const OrderService = require('../../services/OrderService');

beforeAll(async () => {
  await sequelize.sync({ force: true });
});

afterAll(async () => {
  await sequelize.close();
});

describe('OrderService', () => {
  let tradingDay;

  beforeEach(async () => {
    tradingDay = await TradingDay.create({
      date: '2024-01-17',
      status: 'active',
      initial_cash: 1000000,
      final_cash: 1000000,
      total_asset: 1000000
    });
  });

  describe('createOrder', () => {
    it('should create a buy order correctly', async () => {
      const orderData = {
        trading_day_id: tradingDay.id,
        symbol: '002594',
        name: '比亚迪',
        order_type: 'limit',
        direction: 'buy',
        price: 248.00,
        quantity: 100
      };

      const result = await OrderService.createOrder(orderData);

      expect(result).toBeDefined();
      expect(result.symbol).toBe('002594');
      expect(result.direction).toBe('buy');
      expect(result.status).toBe('pending');
      expect(result.order_no).toMatch(/^ORD/);
    });

    it('should create a sell order correctly', async () => {
      const orderData = {
        trading_day_id: tradingDay.id,
        symbol: '002594',
        name: '比亚迪',
        order_type: 'limit',
        direction: 'sell',
        price: 255.00,
        quantity: 100
      };

      const result = await OrderService.createOrder(orderData);

      expect(result).toBeDefined();
      expect(result.direction).toBe('sell');
    });
  });

  describe('submitOrder', () => {
    it('should submit order and change status to submitted', async () => {
      const order = await Order.create({
        trading_day_id: tradingDay.id,
        order_no: 'ORD202401170001',
        symbol: '002594',
        name: '比亚迪',
        order_type: 'limit',
        direction: 'buy',
        price: 248.00,
        quantity: 100,
        filled_quantity: 0,
        status: 'pending'
      });

      const result = await OrderService.submitOrder(order.id);

      expect(result.status).toBe('submitted');
    });

    it('should fail to submit order not in pending status', async () => {
      const order = await Order.create({
        trading_day_id: tradingDay.id,
        order_no: 'ORD202401170002',
        symbol: '002594',
        name: '比亚迪',
        order_type: 'limit',
        direction: 'buy',
        price: 248.00,
        quantity: 100,
        filled_quantity: 100,
        status: 'filled'
      });

      await expect(OrderService.submitOrder(order.id)).rejects.toThrow();
    });
  });

  describe('fillOrder', () => {
    it('should fully fill an order', async () => {
      const order = await Order.create({
        trading_day_id: tradingDay.id,
        order_no: 'ORD202401170003',
        symbol: '002594',
        name: '比亚迪',
        order_type: 'limit',
        direction: 'buy',
        price: 248.00,
        quantity: 100,
        filled_quantity: 0,
        status: 'submitted'
      });

      const result = await OrderService.fillOrder(order.id, {
        fill_quantity: 100,
        fill_price: 248.00
      });

      expect(result.status).toBe('filled');
      expect(result.filled_quantity).toBe(100);
      expect(result.avg_fill_price).toBe(248.00);
    });

    it('should partially fill an order', async () => {
      const order = await Order.create({
        trading_day_id: tradingDay.id,
        order_no: 'ORD202401170004',
        symbol: '002594',
        name: '比亚迪',
        order_type: 'limit',
        direction: 'buy',
        price: 248.00,
        quantity: 100,
        filled_quantity: 0,
        status: 'submitted'
      });

      const result = await OrderService.fillOrder(order.id, {
        fill_quantity: 50,
        fill_price: 248.00
      });

      expect(result.status).toBe('partially_filled');
      expect(result.filled_quantity).toBe(50);
    });
  });

  describe('cancelOrder', () => {
    it('should cancel a submitted order', async () => {
      const order = await Order.create({
        trading_day_id: tradingDay.id,
        order_no: 'ORD202401170005',
        symbol: '002594',
        name: '比亚迪',
        order_type: 'limit',
        direction: 'buy',
        price: 248.00,
        quantity: 100,
        filled_quantity: 0,
        status: 'submitted'
      });

      const result = await OrderService.cancelOrder(order.id, '用户主动撤单');

      expect(result.status).toBe('cancelled');
    });

    it('should fail to cancel a filled order', async () => {
      const order = await Order.create({
        trading_day_id: tradingDay.id,
        order_no: 'ORD202401170006',
        symbol: '002594',
        name: '比亚迪',
        order_type: 'limit',
        direction: 'buy',
        price: 248.00,
        quantity: 100,
        filled_quantity: 100,
        status: 'filled'
      });

      await expect(OrderService.cancelOrder(order.id, '用户主动撤单')).rejects.toThrow();
    });
  });

  describe('generateOrderNo', () => {
    it('should generate unique order numbers', () => {
      const orderNo1 = OrderService.generateOrderNo();
      const orderNo2 = OrderService.generateOrderNo();

      expect(orderNo1).toMatch(/^ORD\d{8}\d{4}$/);
      expect(orderNo2).toMatch(/^ORD\d{8}\d{4}$/);
      expect(orderNo1).not.toBe(orderNo2);
    });
  });
});
