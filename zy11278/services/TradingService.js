const dayjs = require('dayjs');
const db = require('../models');
const { Op } = require('sequelize');
const orderService = require('./OrderService');
const positionService = require('./PositionService');
const riskService = require('./RiskService');

const COMMISSION_RATE = 0.0003;
const STAMP_DUTY_RATE = 0.001;
const MIN_COMMISSION = 5;

class TradingService {
  constructor() {
    this.sequelize = db.sequelize;
  }

  calculateCommission(amount) {
    const commission = amount * COMMISSION_RATE;
    return commission < MIN_COMMISSION ? MIN_COMMISSION : commission;
  }

  calculateStampDuty(amount, tradeType) {
    if (tradeType === 'sell') {
      return amount * STAMP_DUTY_RATE;
    }
    return 0;
  }

  async executeBuy(orderData) {
    const transaction = await this.sequelize.transaction();
    
    try {
      const { trading_day_id, symbol, name, price, quantity, trade_plan_id, remark, order_subtype = 'limit' } = orderData;

      const cashAccount = await db.CashAccount.findOne({
        where: { 
          trading_day_id,
          account_type: 'main'
        },
        { transaction }
      });

      if (!cashAccount) {
        throw new Error('现金账户不存在');
      }

      const estimatedAmount = price * quantity;
      const estimatedCommission = this.calculateCommission(estimatedAmount);
      const estimatedStampDuty = 0;
      const estimatedTotalCost = estimatedAmount + estimatedCommission + estimatedStampDuty;

      if (cashAccount.available_balance < estimatedTotalCost) {
        throw new Error(`可用余额不足，需要 ${estimatedTotalCost}，当前可用 ${cashAccount.available_balance}`);
      }

      const order = await orderService.createOrder({
        trading_day_id,
        symbol,
        name,
        order_type: 'buy',
        order_subtype,
        price,
        quantity,
        trade_plan_id,
        remark
      }, transaction);

      await orderService.submitOrder(order.id, transaction);

      const commission = this.calculateCommission(estimatedAmount);
      const stampDuty = 0;
      const totalCost = estimatedAmount + commission + stampDuty;

      cashAccount.available_balance -= totalCost;
      cashAccount.frozen_balance += totalCost;
      cashAccount.total_outflow += totalCost;
      await cashAccount.save({ transaction });

      const fillResult = await orderService.fillOrder(order.id, {
        fill_quantity: quantity,
        fill_price: price,
        fill_time: new Date(),
        commission,
        tax: stampDuty
      }, transaction);

      cashAccount.frozen_balance -= totalCost;
      cashAccount.commission_paid += commission;
      cashAccount.tax_paid += stampDuty;
      await cashAccount.save({ transaction });

      await positionService.updatePositionAfterBuy(
        trading_day_id,
        symbol,
        quantity,
        price,
        commission,
        stampDuty,
        transaction
      );

      const quote = await db.Quote.findOne({
        where: { trading_day_id, symbol },
        { transaction }
      });

      if (quote && quote.prev_close) {
        await riskService.checkChaseHighBuy(
          fillResult.order,
          price,
          parseFloat(quote.prev_close),
          transaction
        );
      }

      await transaction.commit();

      return {
        order: fillResult.order,
        tradeHistory: fillResult.tradeHistory,
        cashAccount
      };

    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async executeSell(orderData) {
    const transaction = await this.sequelize.transaction();
    
    try {
      const { trading_day_id, symbol, name, price, quantity, trade_plan_id, remark, order_subtype = 'limit' } = orderData;

      const position = await positionService.getOrCreatePosition(trading_day_id, symbol, 'long', transaction);

      if (position.available_quantity < quantity) {
        throw new Error(`可用持仓不足，当前可用 ${position.available_quantity}，卖出 ${quantity}`);
      }

      const order = await orderService.createOrder({
        trading_day_id,
        symbol,
        name,
        order_type: 'sell',
        order_subtype,
        price,
        quantity,
        trade_plan_id,
        remark
      }, transaction);

      await orderService.submitOrder(order.id, transaction);

      await positionService.freezePosition(trading_day_id, symbol, quantity, transaction);

      const estimatedAmount = price * quantity;
      const estimatedCommission = this.calculateCommission(estimatedAmount);
      const estimatedStampDuty = this.calculateStampDuty(estimatedAmount, 'sell');
      const estimatedNetAmount = estimatedAmount - estimatedCommission - estimatedStampDuty;

      const cashAccount = await db.CashAccount.findOne({
        where: { 
          trading_day_id,
          account_type: 'main'
        },
        { transaction }
      });

      const fillResult = await orderService.fillOrder(order.id, {
        fill_quantity: quantity,
        fill_price: price,
        fill_time: new Date(),
        commission: estimatedCommission,
        tax: estimatedStampDuty
      }, transaction);

      const sellResult = await positionService.updatePositionAfterSell(
        trading_day_id,
        symbol,
        quantity,
        price,
        estimatedCommission,
        estimatedStampDuty,
        transaction
      );

      await positionService.unfreezePosition(trading_day_id, symbol, quantity, transaction);

      const netAmount = estimatedAmount - estimatedCommission - estimatedStampDuty;
      
      if (cashAccount) {
        cashAccount.available_balance += netAmount;
        cashAccount.total_inflow += estimatedAmount;
        cashAccount.commission_paid += estimatedCommission;
        cashAccount.tax_paid += estimatedStampDuty;
        cashAccount.realized_pnl += sellResult.realizedPnl;
        await cashAccount.save({ transaction });

        const tradeHistory = fillResult.tradeHistory;
        tradeHistory.realized_pnl = sellResult.realizedPnl;
        tradeHistory.realized_pnl_percent = sellResult.realizedPnlPercent;
        tradeHistory.avg_cost_price = sellResult.avgCostPrice;
        tradeHistory.is_win = sellResult.realizedPnl >= 0;
        await tradeHistory.save({ transaction });
      }

      await transaction.commit();

      return {
        order: fillResult.order,
        tradeHistory: fillResult.tradeHistory,
        realizedPnl: sellResult.realizedPnl,
        realizedPnlPercent: sellResult.realizedPnlPercent
      };

    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async cancelOrder(orderId, cancelReason = '') {
    const transaction = await this.sequelize.transaction();
    
    try {
      const order = await orderService.getOrderById(orderId);
      if (!order) {
        throw new Error('订单不存在');
      }

      if (!['pending', 'submitted', 'partially_filled'].includes(order.status)) {
        throw new Error('该订单状态不能撤单');
      }

      const remainingQuantity = order.quantity - order.filled_quantity;

      if (order.order_type === 'sell' && remainingQuantity > 0) {
        await positionService.unfreezePosition(
          order.trading_day_id,
          order.symbol,
          remainingQuantity,
          transaction
        );
      }

      if (order.order_type === 'buy' && remainingQuantity > 0) {
        const cashAccount = await db.CashAccount.findOne({
          where: { 
            trading_day_id: order.trading_day_id,
            account_type: 'main'
          },
          { transaction }
        });

        if (cashAccount && cashAccount.frozen_balance > 0) {
          const frozenAmount = (remainingQuantity * order.price) + 
            this.calculateCommission(remainingQuantity * order.price);
          cashAccount.available_balance += frozenAmount;
          cashAccount.frozen_balance -= frozenAmount;
          await cashAccount.save({ transaction });
        }
      }

      const cancelledOrder = await orderService.cancelOrder(orderId, cancelReason, transaction);

      await transaction.commit();
      return cancelledOrder;

    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async executePartialFill(orderId, fillQuantity, fillPrice) {
    const transaction = await this.sequelize.transaction();
    
    try {
      const order = await orderService.getOrderById(orderId);
      if (!order) {
        throw new Error('订单不存在');
      }

      if (!['submitted', 'partially_filled'].includes(order.status)) {
        throw new Error('该订单状态不能部分成交');
      }

      const remainingQuantity = order.quantity - order.filled_quantity;
      if (fillQuantity > remainingQuantity) {
        throw new Error(`成交数量不能大于剩余数量：${remainingQuantity}`);
      }

      const commission = this.calculateCommission(fillQuantity * fillPrice);
      const stampDuty = order.order_type === 'sell' 
        ? this.calculateStampDuty(fillQuantity * fillPrice, 'sell') 
        : 0;

      if (order.order_type === 'buy') {
        const position = await positionService.updatePositionAfterBuy(
          order.trading_day_id,
          order.symbol,
          fillQuantity,
          fillPrice,
          commission,
          stampDuty,
          transaction
        );

        const totalCost = fillQuantity * fillPrice + commission + stampDuty;
        const cashAccount = await db.CashAccount.findOne({
          where: { 
            trading_day_id: order.trading_day_id,
            account_type: 'main'
          },
          { transaction }
        });

        if (cashAccount) {
          cashAccount.frozen_balance -= totalCost;
          cashAccount.commission_paid += commission;
          await cashAccount.save({ transaction });
        }
      } else {
        const sellResult = await positionService.updatePositionAfterSell(
          order.trading_day_id,
          order.symbol,
          fillQuantity,
          fillPrice,
          commission,
          stampDuty,
          transaction
        );

        const netAmount = fillQuantity * fillPrice - commission - stampDuty;
        const cashAccount = await db.CashAccount.findOne({
          where: { 
            trading_day_id: order.trading_day_id,
            account_type: 'main'
          },
          { transaction }
        });

        if (cashAccount) {
          cashAccount.available_balance += netAmount;
          cashAccount.total_inflow += fillQuantity * fillPrice;
          cashAccount.commission_paid += commission;
          cashAccount.tax_paid += stampDuty;
          cashAccount.realized_pnl += sellResult.realizedPnl;
          await cashAccount.save({ transaction });
        }
      }

      const fillResult = await orderService.fillOrder(orderId, {
        fill_quantity: fillQuantity,
        fill_price: fillPrice,
        fill_time: new Date(),
        commission,
        tax: stampDuty
      }, transaction);

      await transaction.commit();
      return fillResult;

    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async getTradeHistoryByTradingDay(tradingDayId, options = {}) {
    const { symbol, trade_type, page = 1, pageSize = 50 } = options;
    
    const where = { trading_day_id: tradingDayId };
    if (symbol) where.symbol = symbol;
    if (trade_type) where.trade_type = trade_type;

    const { count, rows } = await db.TradeHistory.findAndCountAll({
      where,
      include: [{
        model: db.Order,
        as: 'order'
      }],
      order: [['trade_time', 'DESC']],
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

  async getTradeStatistics(tradingDayId) {
    const tradeHistories = await db.TradeHistory.findAll({
      where: { trading_day_id: tradingDayId }
    });

    const buyTrades = tradeHistories.filter(t => t.trade_type === 'buy');
    const sellTrades = tradeHistories.filter(t => t.trade_type === 'sell');

    const realizedTrades = sellTrades.filter(t => t.realized_pnl !== null);
    const winTrades = realizedTrades.filter(t => t.realized_pnl >= 0);
    const loseTrades = realizedTrades.filter(t => t.realized_pnl < 0);

    const totalRealizedPnl = realizedTrades.reduce((sum, t) => sum + (t.realized_pnl || 0), 0);
    const totalCommission = tradeHistories.reduce((sum, t) => sum + (t.commission || 0), 0);
    const totalTax = tradeHistories.reduce((sum, t) => sum + (t.tax || 0), 0);

    const buyAmount = buyTrades.reduce((sum, t) => sum + (t.amount || 0), 0);
    const sellAmount = sellTrades.reduce((sum, t) => sum + (t.amount || 0), 0);

    return {
      totalTrades: tradeHistories.length,
      buyCount: buyTrades.length,
      sellCount: sellTrades.length,
      realizedCount: realizedTrades.length,
      winCount: winTrades.length,
      loseCount: loseTrades.length,
      winRate: realizedTrades.length > 0 ? (winTrades.length / realizedTrades.length) * 100 : 0,
      totalRealizedPnl,
      totalCommission,
      totalTax,
      buyAmount,
      sellAmount,
      turnover: buyAmount + sellAmount
    };
  }
}

module.exports = new TradingService();
