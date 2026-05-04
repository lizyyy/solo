const dayjs = require('dayjs');
const db = require('../models');
const { Op } = require('sequelize');
const positionService = require('./PositionService');
const riskService = require('./RiskService');

const DEFAULT_INITIAL_CASH = 1000000;

class TradingDayService {
  constructor() {
    this.sequelize = db.sequelize;
  }

  async getOrCreateTradingDay(date, initialCash = DEFAULT_INITIAL_CASH) {
    const transaction = await this.sequelize.transaction();
    
    try {
      let tradingDay = await db.TradingDay.findOne({
        where: { date }
      }, { transaction });

      if (tradingDay) {
        await transaction.commit();
        return tradingDay;
      }

      const prevTradingDay = await db.TradingDay.findOne({
        where: {
          date: { [Op.lt]: date },
          status: { [Op.ne]: 'pending' }
        },
        order: [['date', 'DESC']],
        { transaction }
      });

      let cashForToday = initialCash;
      if (prevTradingDay) {
        const prevCashAccount = await db.CashAccount.findOne({
          where: {
            trading_day_id: prevTradingDay.id,
            account_type: 'main'
          },
          { transaction }
        });
        
        if (prevCashAccount) {
          cashForToday = prevCashAccount.available_balance + prevCashAccount.frozen_balance;
        }
      }

      tradingDay = await db.TradingDay.create({
        date,
        status: 'pending',
        initial_cash: cashForToday,
        final_cash: cashForToday,
        total_asset: cashForToday
      }, { transaction });

      await db.CashAccount.create({
        trading_day_id: tradingDay.id,
        account_type: 'main',
        opening_balance: cashForToday,
        closing_balance: cashForToday,
        available_balance: cashForToday,
        frozen_balance: 0
      }, { transaction });

      if (prevTradingDay) {
        await positionService.copyPositionsToNextDay(prevTradingDay.id, tradingDay.id, transaction);
      }

      await transaction.commit();
      return tradingDay;

    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async openTradingDay(date, initialCash = null) {
    const transaction = await this.sequelize.transaction();
    
    try {
      let tradingDay = await db.TradingDay.findOne({
        where: { date }
      }, { transaction });

      if (!tradingDay) {
        tradingDay = await this.getOrCreateTradingDay(date, initialCash || DEFAULT_INITIAL_CASH);
        tradingDay = await db.TradingDay.findByPk(tradingDay.id, { transaction });
      }

      if (tradingDay.status === 'active') {
        await transaction.commit();
        return tradingDay;
      }

      if (tradingDay.status !== 'pending') {
        throw new Error(`交易日状态为 ${tradingDay.status}，无法开盘`);
      }

      tradingDay.status = 'active';
      tradingDay.opened_at = new Date();
      await tradingDay.save({ transaction });

      await transaction.commit();
      return tradingDay;

    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async closeTradingDay(tradingDayId) {
    const transaction = await this.sequelize.transaction();
    
    try {
      const tradingDay = await db.TradingDay.findByPk(tradingDayId, { transaction });
      
      if (!tradingDay) {
        throw new Error('交易日不存在');
      }

      if (tradingDay.status !== 'active') {
        throw new Error(`交易日状态为 ${tradingDay.status}，无法收盘`);
      }

      const pendingOrders = await db.Order.findAll({
        where: {
          trading_day_id: tradingDayId,
          status: { [Op.in]: ['pending', 'submitted', 'partially_filled'] }
        },
        { transaction }
      });

      for (const order of pendingOrders) {
        if (order.status === 'partially_filled') {
          order.status = 'cancelled';
          order.cancel_time = new Date();
          order.cancel_reason = '收盘未成交自动撤单';
          await order.save({ transaction });
        } else {
          order.status = 'expired';
          order.cancel_time = new Date();
          await order.save({ transaction });
        }
      }

      const cashAccount = await db.CashAccount.findOne({
        where: {
          trading_day_id: tradingDayId,
          account_type: 'main'
        },
        { transaction }
      });

      if (cashAccount) {
        cashAccount.closing_balance = cashAccount.available_balance + cashAccount.frozen_balance;
        await cashAccount.save({ transaction });
        tradingDay.final_cash = cashAccount.closing_balance;
      }

      const metrics = await positionService.calculatePortfolioMetrics(tradingDayId, transaction);
      
      tradingDay.total_market_value = metrics.totalMarketValue;
      tradingDay.total_asset = metrics.totalAsset;
      tradingDay.daily_pnl = metrics.dailyPnl;
      tradingDay.daily_pnl_percent = metrics.dailyPnlPercent;
      tradingDay.position_ratio = metrics.positionRatio;

      const tradeStats = await this.getTradeStatistics(tradingDayId, transaction);
      tradingDay.buy_count = tradeStats.buyCount;
      tradingDay.sell_count = tradeStats.sellCount;
      tradingDay.total_trades = tradeStats.totalTrades;
      tradingDay.win_count = tradeStats.winCount;
      tradingDay.lose_count = tradeStats.loseCount;
      tradingDay.win_rate = tradeStats.winRate;

      const alerts = await riskService.runAllChecks(tradingDayId, positionService, transaction);
      tradingDay.risk_alert_count = alerts.length;

      tradingDay.status = 'closed';
      tradingDay.closed_at = new Date();
      await tradingDay.save({ transaction });

      await transaction.commit();

      return {
        tradingDay,
        metrics,
        tradeStats,
        alerts
      };

    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async reviewTradingDay(tradingDayId, summary = '') {
    const transaction = await this.sequelize.transaction();
    
    try {
      const tradingDay = await db.TradingDay.findByPk(tradingDayId, { transaction });
      
      if (!tradingDay) {
        throw new Error('交易日不存在');
      }

      if (tradingDay.status !== 'closed') {
        throw new Error(`交易日状态为 ${tradingDay.status}，无法复盘`);
      }

      tradingDay.status = 'reviewed';
      tradingDay.reviewed_at = new Date();
      if (summary) {
        tradingDay.summary = summary;
      }
      await tradingDay.save({ transaction });

      await transaction.commit();
      return tradingDay;

    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async getCurrentTradingDay() {
    const today = dayjs().format('YYYY-MM-DD');
    let tradingDay = await db.TradingDay.findOne({
      where: { date: today }
    });

    if (!tradingDay) {
      tradingDay = await this.getOrCreateTradingDay(today);
    }

    return tradingDay;
  }

  async getActiveTradingDay() {
    return await db.TradingDay.findOne({
      where: { status: 'active' },
      order: [['date', 'DESC']]
    });
  }

  async getTradingDays(options = {}) {
    const { status, startDate, endDate, page = 1, pageSize = 30 } = options;
    
    const where = {};
    if (status) where.status = status;
    if (startDate) where.date = { [Op.gte]: startDate };
    if (endDate) where.date = { ...where.date, [Op.lte]: endDate };

    const { count, rows } = await db.TradingDay.findAndCountAll({
      where,
      order: [['date', 'DESC']],
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

  async getTradingDayById(tradingDayId) {
    return await db.TradingDay.findByPk(tradingDayId, {
      include: [
        { model: db.Position, as: 'positions' },
        { model: db.RiskAlert, as: 'riskAlerts' },
        { model: db.ReviewNote, as: 'reviewNotes' }
      ]
    });
  }

  async getTradeStatistics(tradingDayId, transaction = null) {
    const options = transaction ? { transaction } : {};
    
    const tradeHistories = await db.TradeHistory.findAll({
      where: { trading_day_id: tradingDayId },
      ...options
    });

    const buyTrades = tradeHistories.filter(t => t.trade_type === 'buy');
    const sellTrades = tradeHistories.filter(t => t.trade_type === 'sell');

    const realizedTrades = sellTrades.filter(t => t.realized_pnl !== null);
    const winTrades = realizedTrades.filter(t => t.realized_pnl >= 0);
    const loseTrades = realizedTrades.filter(t => t.realized_pnl < 0);

    return {
      totalTrades: tradeHistories.length,
      buyCount: buyTrades.length,
      sellCount: sellTrades.length,
      realizedCount: realizedTrades.length,
      winCount: winTrades.length,
      loseCount: loseTrades.length,
      winRate: realizedTrades.length > 0 ? (winTrades.length / realizedTrades.length) * 100 : 0
    };
  }

  async getPortfolioSummary(tradingDayId) {
    const tradingDay = await db.TradingDay.findByPk(tradingDayId);
    if (!tradingDay) {
      throw new Error('交易日不存在');
    }

    const cashAccount = await db.CashAccount.findOne({
      where: {
        trading_day_id: tradingDayId,
        account_type: 'main'
      }
    });

    const positions = await positionService.getAllPositionsByTradingDay(tradingDayId);
    const metrics = await positionService.calculatePortfolioMetrics(tradingDayId);
    const tradeStats = await this.getTradeStatistics(tradingDayId);
    const alerts = await riskService.getActiveAlerts(tradingDayId, { status: null, page: 1, pageSize: 1000 });

    const allDays = await db.TradingDay.findAll({
      where: {
        status: { [Op.ne]: 'pending' }
      },
      order: [['date', 'ASC']]
    });

    let cumulativePnl = 0;
    let maxAsset = 0;
    let maxDrawdown = 0;
    let peakAsset = 0;

    for (const day of allDays) {
      cumulativePnl += day.daily_pnl || 0;
      const asset = day.total_asset || (day.final_cash + day.total_market_value);
      
      if (asset > peakAsset) {
        peakAsset = asset;
      }
      
      if (peakAsset > 0) {
        const dd = ((peakAsset - asset) / peakAsset) * 100;
        if (dd > maxDrawdown) {
          maxDrawdown = dd;
        }
      }
      
      if (asset > maxAsset) {
        maxAsset = asset;
      }
    }

    return {
      tradingDay,
      cashAccount,
      positions,
      metrics,
      tradeStats,
      alerts: alerts.data,
      portfolioStats: {
        cumulativePnl,
        maxAsset,
        maxDrawdown,
        tradingDays: allDays.length
      }
    };
  }
}

module.exports = new TradingDayService();
