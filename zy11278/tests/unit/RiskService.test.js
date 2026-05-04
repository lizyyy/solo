const sequelize = require('../../config/database');
const { Position, TradingDay, Order, CashAccount } = require('../../models');
const RiskService = require('../../services/RiskService');

beforeAll(async () => {
  await sequelize.sync({ force: true });
});

afterAll(async () => {
  await sequelize.close();
});

describe('RiskService', () => {
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

  describe('checkOverPosition', () => {
    it('should detect over position when position ratio exceeds threshold', async () => {
      await Position.create({
        trading_day_id: tradingDay.id,
        symbol: '002594',
        name: '比亚迪',
        direction: 'long',
        quantity: 3000,
        available_quantity: 3000,
        frozen_quantity: 0,
        avg_cost_price: 248.00,
        total_cost_amount: 744000.00,
        current_price: 250.00,
        market_value: 750000.00,
        floating_pnl: 6000.00,
        floating_pnl_percent: 0.008,
        realized_pnl: 0.00,
        position_ratio: 0.75,
        max_drawdown: -0.01
      });

      await Position.create({
        trading_day_id: tradingDay.id,
        symbol: '600519',
        name: '贵州茅台',
        direction: 'long',
        quantity: 10,
        available_quantity: 10,
        frozen_quantity: 0,
        avg_cost_price: 1690.00,
        total_cost_amount: 16900.00,
        current_price: 1700.00,
        market_value: 17000.00,
        floating_pnl: 100.00,
        floating_pnl_percent: 0.0059,
        realized_pnl: 0.00,
        position_ratio: 0.017,
        max_drawdown: -0.005
      });

      const result = await RiskService.checkOverPosition(tradingDay.id, { threshold: 0.70 });

      expect(result).toBeDefined();
      expect(result.alert_type).toBe('over_position');
      expect(result.trigger_value).toBeGreaterThan(0.70);
    });

    it('should not detect over position when position ratio is below threshold', async () => {
      await Position.create({
        trading_day_id: tradingDay.id,
        symbol: '002594',
        name: '比亚迪',
        direction: 'long',
        quantity: 100,
        available_quantity: 100,
        frozen_quantity: 0,
        avg_cost_price: 248.00,
        total_cost_amount: 24800.00,
        current_price: 250.00,
        market_value: 25000.00,
        floating_pnl: 200.00,
        floating_pnl_percent: 0.008,
        realized_pnl: 0.00,
        position_ratio: 0.025,
        max_drawdown: -0.01
      });

      const result = await RiskService.checkOverPosition(tradingDay.id, { threshold: 0.80 });

      expect(result).toBeNull();
    });
  });

  describe('checkChaseHighBuy', () => {
    it('should detect chase high buy when change percent exceeds threshold', async () => {
      const order = await Order.create({
        trading_day_id: tradingDay.id,
        order_no: 'ORD202401170001',
        symbol: '002594',
        name: '比亚迪',
        order_type: 'limit',
        direction: 'buy',
        price: 248.00,
        quantity: 100,
        filled_quantity: 100,
        status: 'filled',
        avg_fill_price: 248.00
      });

      const result = await RiskService.checkChaseHighBuy(tradingDay.id, order.id, {
        change_percent: 0.06,
        threshold: 0.05
      });

      expect(result).toBeDefined();
      expect(result.alert_type).toBe('chase_high_buy');
      expect(result.trigger_value).toBe(0.06);
    });

    it('should not detect chase high buy when change percent is below threshold', async () => {
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
        status: 'filled',
        avg_fill_price: 248.00
      });

      const result = await RiskService.checkChaseHighBuy(tradingDay.id, order.id, {
        change_percent: 0.03,
        threshold: 0.05
      });

      expect(result).toBeNull();
    });
  });

  describe('checkSingleStockOverWeight', () => {
    it('should detect single stock over weight', async () => {
      await Position.create({
        trading_day_id: tradingDay.id,
        symbol: '002594',
        name: '比亚迪',
        direction: 'long',
        quantity: 2000,
        available_quantity: 2000,
        frozen_quantity: 0,
        avg_cost_price: 248.00,
        total_cost_amount: 496000.00,
        current_price: 250.00,
        market_value: 500000.00,
        floating_pnl: 4000.00,
        floating_pnl_percent: 0.008,
        realized_pnl: 0.00,
        position_ratio: 0.50,
        max_drawdown: -0.01
      });

      const result = await RiskService.checkSingleStockOverWeight(tradingDay.id, { threshold: 0.30 });

      expect(result).toBeDefined();
      expect(result.alert_type).toBe('single_stock_over_weight');
      expect(result.symbol).toBe('002594');
    });
  });

  describe('checkMaxDrawdown', () => {
    it('should detect max drawdown exceed', async () => {
      const result = await RiskService.checkMaxDrawdown(tradingDay.id, {
        current_drawdown: -0.15,
        threshold: -0.10
      });

      expect(result).toBeDefined();
      expect(result.alert_type).toBe('max_drawdown_exceed');
      expect(result.trigger_value).toBe(-0.15);
    });

    it('should not detect max drawdown when within threshold', async () => {
      const result = await RiskService.checkMaxDrawdown(tradingDay.id, {
        current_drawdown: -0.05,
        threshold: -0.10
      });

      expect(result).toBeNull();
    });
  });
});
