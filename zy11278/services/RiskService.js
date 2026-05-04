const dayjs = require('dayjs');
const db = require('../models');
const { Op } = require('sequelize');

const RISK_CONFIG = {
  maxPositionRatio: 80,
  maxSingleStockWeight: 30,
  maxContinuousLossDays: 3,
  maxDrawdownThreshold: 10,
  maxLossPerTrade: 2000,
  chaseHighThreshold: 5,
  maxDailyTrades: 10
};

class RiskService {
  constructor() {
    this.sequelize = db.sequelize;
    this.config = RISK_CONFIG;
  }

  async createAlert(alertData, transaction = null) {
    const options = transaction ? { transaction } : {};
    
    return await db.RiskAlert.create({
      trading_day_id: alertData.trading_day_id,
      alert_type: alertData.alert_type,
      severity: alertData.severity || 'warning',
      status: 'active',
      symbol: alertData.symbol,
      name: alertData.name,
      title: alertData.title,
      message: alertData.message,
      trigger_value: alertData.trigger_value,
      threshold_value: alertData.threshold_value,
      unit: alertData.unit,
      order_id: alertData.order_id,
      position_id: alertData.position_id,
      metadata: alertData.metadata
    }, options);
  }

  async checkOverPosition(tradingDayId, positionService, transaction = null) {
    const alerts = [];
    const options = transaction ? { transaction } : {};
    
    const tradingDay = await db.TradingDay.findByPk(tradingDayId, options);
    if (!tradingDay) return alerts;

    const metrics = await positionService.calculatePortfolioMetrics(tradingDayId, transaction);
    
    if (metrics.positionRatio > this.config.maxPositionRatio) {
      const alert = await this.createAlert({
        trading_day_id: tradingDayId,
        alert_type: 'over_position',
        severity: metrics.positionRatio > 90 ? 'critical' : 'danger',
        symbol: null,
        name: null,
        title: '仓位超限预警',
        message: `当前仓位比例为 ${metrics.positionRatio.toFixed(2)}%，超过阈值 ${this.config.maxPositionRatio}%`,
        trigger_value: metrics.positionRatio,
        threshold_value: this.config.maxPositionRatio,
        unit: '%',
        metadata: {
          totalAsset: metrics.totalAsset,
          totalMarketValue: metrics.totalMarketValue,
          cash: metrics.cash
        }
      }, transaction);
      alerts.push(alert);
    }

    return alerts;
  }

  async checkSingleStockOverWeight(tradingDayId, positionService, transaction = null) {
    const alerts = [];
    const options = transaction ? { transaction } : {};
    
    const positions = await positionService.getAllPositionsByTradingDay(tradingDayId);
    const metrics = await positionService.calculatePortfolioMetrics(tradingDayId, transaction);
    
    for (const position of positions) {
      const marketValue = position.market_value || (position.quantity * (position.current_price || position.avg_cost_price));
      const weight = metrics.totalAsset > 0 ? (marketValue / metrics.totalAsset) * 100 : 0;
      
      if (weight > this.config.maxSingleStockWeight) {
        const alert = await this.createAlert({
          trading_day_id: tradingDayId,
          alert_type: 'single_stock_over_weight',
          severity: weight > 40 ? 'critical' : 'danger',
          symbol: position.symbol,
          name: position.name,
          title: `单票仓位过重: ${position.symbol}`,
          message: `${position.name} (${position.symbol}) 当前仓位占比为 ${weight.toFixed(2)}%，超过阈值 ${this.config.maxSingleStockWeight}%`,
          trigger_value: weight,
          threshold_value: this.config.maxSingleStockWeight,
          unit: '%',
          position_id: position.id,
          metadata: {
            quantity: position.quantity,
            marketValue,
            avgCostPrice: position.avg_cost_price,
            currentPrice: position.current_price
          }
        }, transaction);
        alerts.push(alert);
      }
    }

    return alerts;
  }

  async checkContinuousLoss(tradingDayId, transaction = null) {
    const alerts = [];
    const options = transaction ? { transaction } : {};
    
    const tradingDay = await db.TradingDay.findByPk(tradingDayId, options);
    if (!tradingDay) return alerts;

    const recentDays = await db.TradingDay.findAll({
      where: {
        date: {
          [Op.lte]: tradingDay.date
        }
      },
      order: [['date', 'DESC']],
      limit: this.config.maxContinuousLossDays + 1,
      ...options
    });

    let continuousLossDays = 0;
    const lossDays = [];
    
    for (const day of recentDays) {
      if (day.daily_pnl < 0) {
        continuousLossDays++;
        lossDays.push({
          date: day.date,
          pnl: day.daily_pnl
        });
      } else {
        break;
      }
    }

    if (continuousLossDays >= this.config.maxContinuousLossDays) {
      const alert = await this.createAlert({
        trading_day_id: tradingDayId,
        alert_type: 'continuous_loss',
        severity: continuousLossDays >= 5 ? 'critical' : 'danger',
        symbol: null,
        name: null,
        title: '连续亏损预警',
        message: `已连续 ${continuousLossDays} 个交易日亏损，请检查交易策略`,
        trigger_value: continuousLossDays,
        threshold_value: this.config.maxContinuousLossDays,
        unit: '天',
        metadata: {
          lossDays,
          totalLoss: lossDays.reduce((sum, d) => sum + d.pnl, 0)
        }
      }, transaction);
      alerts.push(alert);
    }

    return alerts;
  }

  async checkMaxDrawdown(tradingDayId, transaction = null) {
    const alerts = [];
    const options = transaction ? { transaction } : {};
    
    const tradingDay = await db.TradingDay.findByPk(tradingDayId, options);
    if (!tradingDay) return alerts;

    const allDays = await db.TradingDay.findAll({
      where: {
        status: { [Op.ne]: 'pending' }
      },
      order: [['date', 'ASC']],
      ...options
    });

    if (allDays.length < 2) return alerts;

    let peakAsset = 0;
    let maxDrawdown = 0;
    let currentDrawdown = 0;

    for (const day of allDays) {
      const asset = day.total_asset || (day.final_cash + day.total_market_value);
      
      if (asset > peakAsset) {
        peakAsset = asset;
      }
      
      if (peakAsset > 0) {
        currentDrawdown = ((peakAsset - asset) / peakAsset) * 100;
        if (currentDrawdown > maxDrawdown) {
          maxDrawdown = currentDrawdown;
        }
      }
    }

    if (maxDrawdown > this.config.maxDrawdownThreshold) {
      const alert = await this.createAlert({
        trading_day_id: tradingDayId,
        alert_type: 'max_drawdown_exceed',
        severity: maxDrawdown > 15 ? 'critical' : 'danger',
        symbol: null,
        name: null,
        title: '最大回撤预警',
        message: `当前最大回撤为 ${maxDrawdown.toFixed(2)}%，超过阈值 ${this.config.maxDrawdownThreshold}%`,
        trigger_value: maxDrawdown,
        threshold_value: this.config.maxDrawdownThreshold,
        unit: '%',
        metadata: {
          peakAsset,
          currentAsset: tradingDay.total_asset || (tradingDay.final_cash + tradingDay.total_market_value)
        }
      }, transaction);
      alerts.push(alert);
    }

    return alerts;
  }

  async checkStopLossNotExecuted(tradingDayId, transaction = null) {
    const alerts = [];
    const options = transaction ? { transaction } : {};
    
    const tradePlans = await db.TradePlan.findAll({
      where: {
        trading_day_id: tradingDayId,
        status: { [Op.in]: ['active', 'partially_executed'] },
        stop_loss_price: { [Op.ne]: null }
      },
      include: [{
        model: db.Order,
        as: 'orders'
      }],
      ...options
    });

    for (const plan of tradePlans) {
      const quotes = await db.Quote.findOne({
        where: {
          trading_day_id: tradingDayId,
          symbol: plan.symbol
        },
        ...options
      });

      if (!quotes) continue;

      const stopLossPrice = parseFloat(plan.stop_loss_price);
      const low = parseFloat(quotes.low);
      const currentPrice = parseFloat(quotes.close);

      if (stopLossPrice > 0 && low <= stopLossPrice) {
        const hasStopLossOrder = plan.orders?.some(o => 
          o.order_subtype === 'stop_loss' && 
          ['pending', 'submitted', 'partially_filled'].includes(o.status)
        );

        if (!hasStopLossOrder) {
          const alert = await this.createAlert({
            trading_day_id: tradingDayId,
            alert_type: 'stop_loss_not_executed',
            severity: 'warning',
            symbol: plan.symbol,
            name: plan.name,
            title: `止损未执行: ${plan.symbol}`,
            message: `${plan.name} (${plan.symbol}) 价格已触及止损价 ${stopLossPrice}，但未触发止损订单`,
            trigger_value: currentPrice,
            threshold_value: stopLossPrice,
            unit: '元',
            metadata: {
              planId: plan.id,
              low: quotes.low,
              stopLossPrice,
              currentPrice,
              plannedQuantity: plan.planned_quantity
            }
          }, transaction);
          alerts.push(alert);
        }
      }
    }

    return alerts;
  }

  async checkChaseHighBuy(order, currentPrice, prevClose, transaction = null) {
    const alerts = [];
    
    if (order.order_type !== 'buy') return alerts;

    const risePercent = prevClose > 0 ? ((currentPrice - prevClose) / prevClose) * 100 : 0;
    
    if (risePercent > this.config.chaseHighThreshold) {
      const alert = await this.createAlert({
        trading_day_id: order.trading_day_id,
        alert_type: 'chase_high_buy',
        severity: 'warning',
        symbol: order.symbol,
        name: order.name,
        title: `追高买入预警: ${order.symbol}`,
        message: `在 ${order.symbol} 涨幅 ${risePercent.toFixed(2)}% 时买入，请注意追高风险`,
        trigger_value: risePercent,
        threshold_value: this.config.chaseHighThreshold,
        unit: '%',
        order_id: order.id,
        metadata: {
          buyPrice: order.price || order.filled_price,
          currentPrice,
          prevClose,
          quantity: order.quantity || order.filled_quantity
        }
      }, transaction);
      alerts.push(alert);
    }

    return alerts;
  }

  async checkDailyTradeCount(tradingDayId, transaction = null) {
    const alerts = [];
    const options = transaction ? { transaction } : {};
    
    const tradeCount = await db.TradeHistory.count({
      where: {
        trading_day_id: tradingDayId
      },
      ...options
    });

    if (tradeCount > this.config.maxDailyTrades) {
      const alert = await this.createAlert({
        trading_day_id: tradingDayId,
        alert_type: 'rule_violation',
        severity: 'warning',
        symbol: null,
        name: null,
        title: '交易频率过高预警',
        message: `今日已完成 ${tradeCount} 笔交易，超过阈值 ${this.config.maxDailyTrades} 笔`,
        trigger_value: tradeCount,
        threshold_value: this.config.maxDailyTrades,
        unit: '笔',
        metadata: {}
      }, transaction);
      alerts.push(alert);
    }

    return alerts;
  }

  async runAllChecks(tradingDayId, positionService, transaction = null) {
    const allAlerts = [];

    const [
      overPositionAlerts,
      singleStockAlerts,
      continuousLossAlerts,
      maxDrawdownAlerts,
      stopLossAlerts,
      tradeCountAlerts
    ] = await Promise.all([
      this.checkOverPosition(tradingDayId, positionService, transaction),
      this.checkSingleStockOverWeight(tradingDayId, positionService, transaction),
      this.checkContinuousLoss(tradingDayId, transaction),
      this.checkMaxDrawdown(tradingDayId, transaction),
      this.checkStopLossNotExecuted(tradingDayId, transaction),
      this.checkDailyTradeCount(tradingDayId, transaction)
    ]);

    allAlerts.push(
      ...overPositionAlerts,
      ...singleStockAlerts,
      ...continuousLossAlerts,
      ...maxDrawdownAlerts,
      ...stopLossAlerts,
      ...tradeCountAlerts
    );

    return allAlerts;
  }

  async getActiveAlerts(tradingDayId = null, options = {}) {
    const { status = 'active', severity, alert_type, page = 1, pageSize = 50 } = options;
    
    const where = {};
    if (tradingDayId) where.trading_day_id = tradingDayId;
    if (status) where.status = status;
    if (severity) where.severity = severity;
    if (alert_type) where.alert_type = alert_type;

    const { count, rows } = await db.RiskAlert.findAndCountAll({
      where,
      include: [{
        model: db.TradingDay,
        as: 'tradingDay'
      }],
      order: [
        ['severity', 'DESC'],
        ['created_at', 'DESC']
      ],
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

  async acknowledgeAlert(alertId, acknowledgedBy = null, transaction = null) {
    const options = transaction ? { transaction } : {};
    const alert = await db.RiskAlert.findByPk(alertId, options);
    
    if (!alert) {
      throw new Error('预警不存在');
    }

    alert.status = 'acknowledged';
    alert.acknowledged_at = new Date();
    alert.acknowledged_by = acknowledgedBy;
    await alert.save(options);

    return alert;
  }

  async resolveAlert(alertId, resolutionNote, transaction = null) {
    const options = transaction ? { transaction } : {};
    const alert = await db.RiskAlert.findByPk(alertId, options);
    
    if (!alert) {
      throw new Error('预警不存在');
    }

    alert.status = 'resolved';
    alert.resolved_at = new Date();
    alert.resolution_note = resolutionNote;
    await alert.save(options);

    return alert;
  }
}

module.exports = new RiskService();
