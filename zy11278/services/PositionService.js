const dayjs = require('dayjs');
const db = require('../models');
const { Op } = require('sequelize');

class PositionService {
  constructor() {
    this.sequelize = db.sequelize;
  }

  async getOrCreatePosition(tradingDayId, symbol, direction = 'long', transaction = null) {
    const options = transaction ? { transaction } : {};
    
    let position = await db.Position.findOne({
      where: {
        trading_day_id: tradingDayId,
        symbol,
        direction
      }
    }, options);

    if (!position) {
      position = await db.Position.create({
        trading_day_id: tradingDayId,
        symbol,
        name: symbol,
        direction,
        quantity: 0,
        available_quantity: 0,
        frozen_quantity: 0,
        avg_cost_price: 0,
        total_cost: 0
      }, options);
    }

    return position;
  }

  async updatePositionAfterBuy(tradingDayId, symbol, quantity, price, commission = 0, tax = 0, transaction = null) {
    const options = transaction ? { transaction } : {};
    const position = await this.getOrCreatePosition(tradingDayId, symbol, 'long', transaction);

    const newQuantity = position.quantity + quantity;
    const newTotalCost = position.total_cost + (quantity * price) + commission + tax;
    const newAvgCostPrice = newQuantity > 0 ? newTotalCost / newQuantity : 0;

    position.quantity = newQuantity;
    position.available_quantity = position.available_quantity + quantity;
    position.total_cost = newTotalCost;
    position.avg_cost_price = newAvgCostPrice;
    
    if (!position.entry_date) {
      const tradingDay = await db.TradingDay.findByPk(tradingDayId, options);
      position.entry_date = tradingDay ? tradingDay.date : dayjs().format('YYYY-MM-DD');
    }

    await position.save(options);
    return position;
  }

  async updatePositionAfterSell(tradingDayId, symbol, quantity, price, commission = 0, tax = 0, transaction = null) {
    const options = transaction ? { transaction } : {};
    const position = await this.getOrCreatePosition(tradingDayId, symbol, 'long', transaction);

    if (position.quantity < quantity) {
      throw new Error(`持仓数量不足，当前持仓: ${position.quantity}，卖出数量: ${quantity}`);
    }

    const realizedPnl = (price - position.avg_cost_price) * quantity - commission - tax;
    const realizedPnlPercent = position.avg_cost_price > 0 
      ? (realizedPnl / (position.avg_cost_price * quantity)) * 100 
      : 0;

    const remainingQuantity = position.quantity - quantity;
    const remainingCost = remainingQuantity * position.avg_cost_price;

    position.quantity = remainingQuantity;
    position.available_quantity = position.available_quantity - quantity;
    position.total_cost = remainingCost;
    position.realized_pnl = (position.realized_pnl || 0) + realizedPnl;
    position.total_pnl = (position.total_pnl || 0) + realizedPnl;

    await position.save(options);

    return {
      position,
      realizedPnl,
      realizedPnlPercent,
      avgCostPrice: position.avg_cost_price
    };
  }

  async updatePositionPrices(tradingDayId, symbol, currentPrice, transaction = null) {
    const options = transaction ? { transaction } : {};
    const position = await this.getOrCreatePosition(tradingDayId, symbol, 'long', transaction);

    if (position.quantity > 0) {
      const marketValue = position.quantity * currentPrice;
      const floatingPnl = marketValue - position.total_cost;
      const floatingPnlPercent = position.total_cost > 0 
        ? (floatingPnl / position.total_cost) * 100 
        : 0;

      position.current_price = currentPrice;
      position.market_value = marketValue;
      position.floating_pnl = floatingPnl;
      position.floating_pnl_percent = floatingPnlPercent;
      position.total_pnl = (position.realized_pnl || 0) + floatingPnl;

      if (floatingPnl > (position.max_floating_pnl || 0)) {
        position.max_floating_pnl = floatingPnl;
      }

      if (position.max_floating_pnl > 0 && position.max_floating_pnl > floatingPnl) {
        const drawdown = ((position.max_floating_pnl - floatingPnl) / position.max_floating_pnl) * 100;
        if (drawdown > (position.max_drawdown || 0)) {
          position.max_drawdown = drawdown;
        }
      }

      await position.save(options);
    }

    return position;
  }

  async freezePosition(tradingDayId, symbol, quantity, transaction = null) {
    const options = transaction ? { transaction } : {};
    const position = await this.getOrCreatePosition(tradingDayId, symbol, 'long', transaction);

    if (position.available_quantity < quantity) {
      throw new Error(`可用持仓不足，当前可用: ${position.available_quantity}，冻结数量: ${quantity}`);
    }

    position.available_quantity -= quantity;
    position.frozen_quantity += quantity;
    await position.save(options);

    return position;
  }

  async unfreezePosition(tradingDayId, symbol, quantity, transaction = null) {
    const options = transaction ? { transaction } : {};
    const position = await this.getOrCreatePosition(tradingDayId, symbol, 'long', transaction);

    if (position.frozen_quantity < quantity) {
      throw new Error(`冻结持仓不足，当前冻结: ${position.frozen_quantity}，解冻数量: ${quantity}`);
    }

    position.frozen_quantity -= quantity;
    position.available_quantity += quantity;
    await position.save(options);

    return position;
  }

  async getPositionsByTradingDay(tradingDayId, options = {}) {
    const { symbol, direction, page = 1, pageSize = 100 } = options;
    
    const where = { trading_day_id: tradingDayId };
    if (symbol) where.symbol = symbol;
    if (direction) where.direction = direction;
    where.quantity = { [Op.gt]: 0 };

    const { count, rows } = await db.Position.findAndCountAll({
      where,
      order: [['market_value', 'DESC']],
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

  async getAllPositionsByTradingDay(tradingDayId) {
    return await db.Position.findAll({
      where: { 
        trading_day_id: tradingDayId,
        quantity: { [Op.gt]: 0 }
      },
      order: [['market_value', 'DESC']]
    });
  }

  async calculatePortfolioMetrics(tradingDayId, transaction = null) {
    const options = transaction ? { transaction } : {};
    
    const tradingDay = await db.TradingDay.findByPk(tradingDayId, options);
    if (!tradingDay) {
      throw new Error('交易日不存在');
    }

    const cashAccount = await db.CashAccount.findOne({
      where: { 
        trading_day_id: tradingDayId,
        account_type: 'main'
      }
    }, options);

    const positions = await this.getAllPositionsByTradingDay(tradingDayId);

    const totalMarketValue = positions.reduce((sum, p) => sum + (p.market_value || 0), 0);
    const totalFloatingPnl = positions.reduce((sum, p) => sum + (p.floating_pnl || 0), 0);
    const totalRealizedPnl = positions.reduce((sum, p) => sum + (p.realized_pnl || 0), 0);
    const totalCost = positions.reduce((sum, p) => sum + (p.total_cost || 0), 0);

    const cash = cashAccount ? cashAccount.available_balance : 0;
    const totalAsset = cash + totalMarketValue;
    const initialCash = tradingDay.initial_cash || 0;
    const dailyPnl = totalRealizedPnl + totalFloatingPnl;
    const dailyPnlPercent = initialCash > 0 ? (dailyPnl / initialCash) * 100 : 0;

    const positionRatio = totalAsset > 0 ? (totalMarketValue / totalAsset) * 100 : 0;

    return {
      totalMarketValue,
      totalFloatingPnl,
      totalRealizedPnl,
      totalCost,
      cash,
      totalAsset,
      dailyPnl,
      dailyPnlPercent,
      positionRatio,
      positionCount: positions.length
    };
  }

  async updateTradingDayMetrics(tradingDayId, transaction = null) {
    const options = transaction ? { transaction } : {};
    const metrics = await this.calculatePortfolioMetrics(tradingDayId, transaction);
    
    const tradingDay = await db.TradingDay.findByPk(tradingDayId, options);
    
    if (tradingDay) {
      tradingDay.total_market_value = metrics.totalMarketValue;
      tradingDay.total_asset = metrics.totalAsset;
      tradingDay.daily_pnl = metrics.dailyPnl;
      tradingDay.daily_pnl_percent = metrics.dailyPnlPercent;
      tradingDay.position_ratio = metrics.positionRatio;
      await tradingDay.save(options);
    }

    return metrics;
  }

  async calculatePositionRatio(tradingDayId, symbol, totalAsset, transaction = null) {
    const position = await this.getOrCreatePosition(tradingDayId, symbol, 'long', transaction);
    
    if (totalAsset > 0 && position.quantity > 0) {
      const marketValue = position.market_value || (position.quantity * (position.current_price || position.avg_cost_price));
      position.position_ratio = (marketValue / totalAsset) * 100;
      await position.save(transaction ? { transaction } : {});
    }

    return position.position_ratio || 0;
  }

  async copyPositionsToNextDay(sourceTradingDayId, targetTradingDayId, transaction = null) {
    const options = transaction ? { transaction } : {};
    
    const sourcePositions = await db.Position.findAll({
      where: { 
        trading_day_id: sourceTradingDayId,
        quantity: { [Op.gt]: 0 }
      }
    }, options);

    for (const sourcePos of sourcePositions) {
      await db.Position.create({
        trading_day_id: targetTradingDayId,
        symbol: sourcePos.symbol,
        name: sourcePos.name,
        direction: sourcePos.direction,
        quantity: sourcePos.quantity,
        available_quantity: sourcePos.available_quantity,
        frozen_quantity: sourcePos.frozen_quantity,
        avg_cost_price: sourcePos.avg_cost_price,
        total_cost: sourcePos.total_cost,
        current_price: sourcePos.current_price,
        market_value: sourcePos.market_value,
        floating_pnl: sourcePos.floating_pnl,
        floating_pnl_percent: sourcePos.floating_pnl_percent,
        realized_pnl: sourcePos.realized_pnl,
        total_pnl: sourcePos.total_pnl,
        position_ratio: sourcePos.position_ratio,
        max_floating_pnl: sourcePos.max_floating_pnl,
        max_drawdown: sourcePos.max_drawdown,
        entry_date: sourcePos.entry_date,
        holding_days: (sourcePos.holding_days || 0) + 1,
        metadata: sourcePos.metadata
      }, options);
    }

    return sourcePositions.length;
  }
}

module.exports = new PositionService();
