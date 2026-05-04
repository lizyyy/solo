const dayjs = require('dayjs');
const db = require('../models');
const { Op } = require('sequelize');
const tradingDayService = require('./TradingDayService');
const positionService = require('./PositionService');
const riskService = require('./RiskService');

class ExportService {
  constructor() {
    this.sequelize = db.sequelize;
  }

  async generateReportData(tradingDayId, options = {}) {
    const { includeHistory = true, historyDays = 30 } = options;
    
    const tradingDay = await db.TradingDay.findByPk(tradingDayId);
    if (!tradingDay) {
      throw new Error('交易日不存在');
    }

    const summary = await tradingDayService.getPortfolioSummary(tradingDayId);
    
    const tradeHistories = await db.TradeHistory.findAll({
      where: { trading_day_id: tradingDayId },
      include: [{
        model: db.Order,
        as: 'order'
      }],
      order: [['trade_time', 'ASC']]
    });

    const alerts = await db.RiskAlert.findAll({
      where: { trading_day_id: tradingDayId },
      order: [['severity', 'DESC'], ['created_at', 'ASC']]
    });

    const reviewNotes = await db.ReviewNote.findAll({
      where: { trading_day_id: tradingDayId },
      order: [['created_at', 'ASC']]
    });

    const orders = await db.Order.findAll({
      where: { trading_day_id: tradingDayId },
      include: [{
        model: db.TradePlan,
        as: 'tradePlan'
      }],
      order: [['created_at', 'ASC']]
    });

    let historyStats = null;
    if (includeHistory) {
      historyStats = await this.getHistoryStats(tradingDay.date, historyDays);
    }

    const positionsForReview = await this.getPositionsForReview(tradingDayId);
    const ordersForReview = await this.getOrdersForReview(orders, tradeHistories);
    const pnlAttribution = await this.calculatePnlAttribution(tradeHistories);

    return {
      tradingDay,
      summary,
      tradeHistories,
      alerts,
      reviewNotes,
      orders,
      historyStats,
      positionsForReview,
      ordersForReview,
      pnlAttribution,
      generatedAt: new Date()
    };
  }

  async getHistoryStats(currentDate, days = 30) {
    const startDate = dayjs(currentDate).subtract(days, 'day').format('YYYY-MM-DD');
    
    const tradingDays = await db.TradingDay.findAll({
      where: {
        date: {
          [Op.between]: [startDate, currentDate]
        },
        status: { [Op.ne]: 'pending' }
      },
      order: [['date', 'ASC']]
    });

    if (tradingDays.length === 0) {
      return null;
    }

    let totalPnl = 0;
    let winDays = 0;
    let loseDays = 0;
    let maxDrawdown = 0;
    let peakAsset = 0;
    let maxAsset = 0;
    let totalTrades = 0;
    let totalTurnover = 0;

    for (const day of tradingDays) {
      totalPnl += day.daily_pnl || 0;
      
      if ((day.daily_pnl || 0) >= 0) {
        winDays++;
      } else {
        loseDays++;
      }

      const asset = day.total_asset || (day.final_cash + day.total_market_value);
      totalTrades += day.total_trades || 0;
      
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
      period: `${days}天`,
      tradingDays: tradingDays.length,
      winDays,
      loseDays,
      winRate: tradingDays.length > 0 ? (winDays / tradingDays.length) * 100 : 0,
      totalPnl,
      maxDrawdown,
      maxAsset,
      totalTrades,
      dailyStats: tradingDays.map(d => ({
        date: d.date,
        pnl: d.daily_pnl,
        pnlPercent: d.daily_pnl_percent,
        totalAsset: d.total_asset || (d.final_cash + d.total_market_value),
        trades: d.total_trades
      }))
    };
  }

  async getPositionsForReview(tradingDayId) {
    const positions = await positionService.getAllPositionsByTradingDay(tradingDayId);
    
    return positions.map(p => ({
      symbol: p.symbol,
      name: p.name,
      quantity: p.quantity,
      availableQuantity: p.available_quantity,
      avgCostPrice: p.avg_cost_price,
      currentPrice: p.current_price,
      marketValue: p.market_value,
      floatingPnl: p.floating_pnl,
      floatingPnlPercent: p.floating_pnl_percent,
      positionRatio: p.position_ratio,
      maxFloatingPnl: p.max_floating_pnl,
      maxDrawdown: p.max_drawdown,
      entryDate: p.entry_date,
      holdingDays: p.holding_days,
      reviewFlags: {
        needsReview: (p.floating_pnl_percent && Math.abs(p.floating_pnl_percent) > 5) || 
                       (p.max_drawdown && p.max_drawdown > 10) ||
                       (p.holding_days && p.holding_days > 20),
        isHighDrawdown: p.max_drawdown && p.max_drawdown > 10,
        isLongHolding: p.holding_days && p.holding_days > 20,
        isLargePnl: p.floating_pnl_percent && Math.abs(p.floating_pnl_percent) > 5
      }
    }));
  }

  getOrdersForReview(orders, tradeHistories) {
    const reviewOrders = [];

    for (const order of orders) {
      const orderTrades = tradeHistories.filter(t => t.order_id === order.id);
      
      let reviewFlags = {
        needsReview: false,
        isChaseHigh: false,
        isStopLossMissed: false,
        isLargeOrder: false,
        isCanceled: ['cancelled', 'rejected', 'expired'].includes(order.status)
      };

      if (orderTrades.length > 0 && order.order_type === 'buy') {
        const avgPrice = order.filled_price || order.price;
        if (order.tradePlan) {
          const planMaxPrice = order.tradePlan.entry_price_max;
          if (planMaxPrice && avgPrice > planMaxPrice) {
            reviewFlags.isChaseHigh = true;
            reviewFlags.needsReview = true;
          }
        }
      }

      if (order.quantity > 10000) {
        reviewFlags.isLargeOrder = true;
        reviewFlags.needsReview = true;
      }

      if (order.status === 'cancelled' && order.filled_quantity > 0) {
        reviewFlags.needsReview = true;
      }

      reviewOrders.push({
        orderNo: order.order_no,
        symbol: order.symbol,
        name: order.name,
        orderType: order.order_type,
        orderSubtype: order.order_subtype,
        status: order.status,
        price: order.price,
        quantity: order.quantity,
        filledQuantity: order.filled_quantity,
        filledPrice: order.filled_price,
        filledAmount: order.filled_amount,
        commission: order.commission,
        tax: order.tax,
        triggerType: order.trigger_type,
        submitTime: order.submit_time,
        fillTime: order.fill_time,
        cancelTime: order.cancel_time,
        cancelReason: order.cancel_reason,
        remark: order.remark,
        tradePlan: order.tradePlan ? {
          entryPriceMin: order.tradePlan.entry_price_min,
          entryPriceMax: order.tradePlan.entry_price_max,
          stopLossPrice: order.tradePlan.stop_loss_price,
          targetPrice: order.tradePlan.target_price
        } : null,
        trades: orderTrades,
        reviewFlags
      });
    }

    return reviewOrders;
  }

  calculatePnlAttribution(tradeHistories) {
    const sellTrades = tradeHistories.filter(t => t.trade_type === 'sell' && t.realized_pnl !== null);
    
    if (sellTrades.length === 0) {
      return {
        totalRealizedPnl: 0,
        bySymbol: [],
        byCategory: [],
        winLossSummary: {
          winCount: 0,
          loseCount: 0,
          winRate: 0,
          avgWinPnl: 0,
          avgLosePnl: 0,
          profitFactor: 0
        }
      };
    }

    const totalRealizedPnl = sellTrades.reduce((sum, t) => sum + (t.realized_pnl || 0), 0);

    const bySymbolMap = {};
    for (const trade of sellTrades) {
      if (!bySymbolMap[trade.symbol]) {
        bySymbolMap[trade.symbol] = {
          symbol: trade.symbol,
          name: trade.name,
          trades: 0,
          realizedPnl: 0,
          winTrades: 0,
          loseTrades: 0,
          avgHoldingDays: []
        };
      }
      bySymbolMap[trade.symbol].trades++;
      bySymbolMap[trade.symbol].realizedPnl += trade.realized_pnl || 0;
      if ((trade.realized_pnl || 0) >= 0) {
        bySymbolMap[trade.symbol].winTrades++;
      } else {
        bySymbolMap[trade.symbol].loseTrades++;
      }
      if (trade.holding_days !== null && trade.holding_days !== undefined) {
        bySymbolMap[trade.symbol].avgHoldingDays.push(trade.holding_days);
      }
    }

    const bySymbol = Object.values(bySymbolMap).map(s => ({
      ...s,
      winRate: s.trades > 0 ? (s.winTrades / s.trades) * 100 : 0,
      avgHoldingDays: s.avgHoldingDays.length > 0 
        ? s.avgHoldingDays.reduce((a, b) => a + b, 0) / s.avgHoldingDays.length 
        : 0
    }));

    const winTrades = sellTrades.filter(t => (t.realized_pnl || 0) >= 0);
    const loseTrades = sellTrades.filter(t => (t.realized_pnl || 0) < 0);

    const totalWinPnl = winTrades.reduce((sum, t) => sum + (t.realized_pnl || 0), 0);
    const totalLosePnl = Math.abs(loseTrades.reduce((sum, t) => sum + (t.realized_pnl || 0), 0));

    const stopLossTrades = sellTrades.filter(t => t.pnl_category === 'stop_loss');
    const takeProfitTrades = sellTrades.filter(t => t.pnl_category === 'take_profit');
    const normalTrades = sellTrades.filter(t => !t.pnl_category || t.pnl_category === 'normal');

    return {
      totalRealizedPnl,
      bySymbol: bySymbol.sort((a, b) => Math.abs(b.realizedPnl) - Math.abs(a.realizedPnl)),
      byCategory: [
        {
          category: '止损卖出',
          count: stopLossTrades.length,
          totalPnl: stopLossTrades.reduce((sum, t) => sum + (t.realized_pnl || 0), 0),
          avgPnl: stopLossTrades.length > 0 
            ? stopLossTrades.reduce((sum, t) => sum + (t.realized_pnl || 0), 0) / stopLossTrades.length 
            : 0
        },
        {
          category: '止盈卖出',
          count: takeProfitTrades.length,
          totalPnl: takeProfitTrades.reduce((sum, t) => sum + (t.realized_pnl || 0), 0),
          avgPnl: takeProfitTrades.length > 0 
            ? takeProfitTrades.reduce((sum, t) => sum + (t.realized_pnl || 0), 0) / takeProfitTrades.length 
            : 0
        },
        {
          category: '正常卖出',
          count: normalTrades.length,
          totalPnl: normalTrades.reduce((sum, t) => sum + (t.realized_pnl || 0), 0),
          avgPnl: normalTrades.length > 0 
            ? normalTrades.reduce((sum, t) => sum + (t.realized_pnl || 0), 0) / normalTrades.length 
            : 0
        }
      ],
      winLossSummary: {
        winCount: winTrades.length,
        loseCount: loseTrades.length,
        winRate: sellTrades.length > 0 ? (winTrades.length / sellTrades.length) * 100 : 0,
        totalWinPnl,
        totalLosePnl,
        avgWinPnl: winTrades.length > 0 ? totalWinPnl / winTrades.length : 0,
        avgLosePnl: loseTrades.length > 0 ? totalLosePnl / loseTrades.length : 0,
        profitFactor: totalLosePnl > 0 ? totalWinPnl / totalLosePnl : 0
      }
    };
  }

  async exportToMarkdown(tradingDayId, options = {}) {
    const data = await this.generateReportData(tradingDayId, options);
    const { tradingDay, summary, tradeHistories, alerts, reviewNotes, ordersForReview, pnlAttribution, positionsForReview, historyStats } = data;

    let md = `# 交易复盘报告\n\n`;
    md += `**日期**: ${tradingDay.date}\n`;
    md += `**生成时间**: ${dayjs(data.generatedAt).format('YYYY-MM-DD HH:mm:ss')}\n\n`;
    md += `---\n\n`;

    md += `## 一、交易概览\n\n`;
    md += `### 1.1 账户状态\n\n`;
    md += `| 指标 | 数值 |\n|------|------|\n`;
    md += `| 总资产 | ¥${this.formatNumber(summary.tradingDay.total_asset || 0)} |\n`;
    md += `| 可用现金 | ¥${this.formatNumber(summary.cashAccount?.available_balance || 0)} |\n`;
    md += `| 持仓市值 | ¥${this.formatNumber(summary.metrics.totalMarketValue)} |\n`;
    md += `| 仓位比例 | ${this.formatPercent(summary.metrics.positionRatio)}% |\n`;
    md += `| 当日盈亏 | ${summary.metrics.dailyPnl >= 0 ? '+' : ''}¥${this.formatNumber(summary.metrics.dailyPnl)} (${this.formatPercent(summary.metrics.dailyPnlPercent)}%) |\n`;
    md += `| 累计盈亏 | ${summary.portfolioStats.cumulativePnl >= 0 ? '+' : ''}¥${this.formatNumber(summary.portfolioStats.cumulativePnl)} |\n`;
    md += `| 最大回撤 | ${this.formatPercent(summary.portfolioStats.maxDrawdown)}% |\n\n`;

    md += `### 1.2 当日交易统计\n\n`;
    md += `| 指标 | 数值 |\n|------|------|\n`;
    md += `| 总交易笔数 | ${summary.tradeStats.totalTrades} |\n`;
    md += `| 买入笔数 | ${summary.tradeStats.buyCount} |\n`;
    md += `| 卖出笔数 | ${summary.tradeStats.sellCount} |\n`;
    md += `| 已实现盈亏笔数 | ${summary.tradeStats.realizedCount} |\n`;
    md += `| 盈利笔数 | ${summary.tradeStats.winCount} |\n`;
    md += `| 亏损笔数 | ${summary.tradeStats.loseCount} |\n`;
    md += `| 胜率 | ${this.formatPercent(summary.tradeStats.winRate)}% |\n\n`;

    if (historyStats) {
      md += `### 1.3 历史统计 (${historyStats.period})\n\n`;
      md += `| 指标 | 数值 |\n|------|------|\n`;
      md += `| 交易日数 | ${historyStats.tradingDays} |\n`;
      md += `| 盈利天数 | ${historyStats.winDays} |\n`;
      md += `| 亏损天数 | ${historyStats.loseDays} |\n`;
      md += `| 日胜率 | ${this.formatPercent(historyStats.winRate)}% |\n`;
      md += `| 累计盈亏 | ${historyStats.totalPnl >= 0 ? '+' : ''}¥${this.formatNumber(historyStats.totalPnl)} |\n`;
      md += `| 最大回撤 | ${this.formatPercent(historyStats.maxDrawdown)}% |\n\n`;
    }

    md += `## 二、持仓变化\n\n`;
    
    if (positionsForReview.length > 0) {
      md += `### 2.1 当前持仓\n\n`;
      md += `| 股票代码 | 股票名称 | 持仓数量 | 可用数量 | 成本价 | 现价 | 市值 | 浮盈亏 | 浮盈亏% | 仓位占比 | 持有天数 | 需复盘 |\n`;
      md += `|----------|----------|----------|----------|--------|------|------|--------|---------|----------|----------|--------|\n`;
      
      for (const p of positionsForReview) {
        md += `| ${p.symbol} | ${p.name || '-'} | ${p.quantity} | ${p.availableQuantity} | ¥${this.formatNumber(p.avgCostPrice)} | ¥${this.formatNumber(p.currentPrice || 0)} | ¥${this.formatNumber(p.marketValue || 0)} | ${(p.floatingPnl || 0) >= 0 ? '+' : ''}¥${this.formatNumber(p.floatingPnl || 0)} | ${this.formatPercent(p.floatingPnlPercent || 0)}% | ${this.formatPercent(p.positionRatio || 0)}% | ${p.holdingDays || 0}天 | ${p.reviewFlags.needsReview ? '是' : '否'} |\n`;
      }
      md += `\n`;
    } else {
      md += `当前无持仓。\n\n`;
    }

    md += `## 三、风险命中\n\n`;
    
    if (alerts.length > 0) {
      md += `| 预警类型 | 严重程度 | 状态 | 股票代码 | 标题 | 触发值 | 阈值 | 时间 |\n`;
      md += `|----------|----------|------|----------|------|--------|------|------|\n`;
      
      for (const alert of alerts) {
        md += `| ${this.translateAlertType(alert.alert_type)} | ${this.translateSeverity(alert.severity)} | ${this.translateAlertStatus(alert.status)} | ${alert.symbol || '-'} | ${alert.title} | ${alert.trigger_value || '-'} | ${alert.threshold_value || '-'}${alert.unit || ''} | ${dayjs(alert.created_at).format('HH:mm:ss')} |\n`;
      }
      md += `\n`;
    } else {
      md += `当日无风险预警。\n\n`;
    }

    md += `## 四、盈亏归因\n\n`;
    
    md += `### 4.1 已实现盈亏汇总\n\n`;
    md += `| 指标 | 数值 |\n|------|------|\n`;
    md += `| 总已实现盈亏 | ${pnlAttribution.totalRealizedPnl >= 0 ? '+' : ''}¥${this.formatNumber(pnlAttribution.totalRealizedPnl)} |\n`;
    md += `| 盈利笔数 | ${pnlAttribution.winLossSummary.winCount} |\n`;
    md += `| 亏损笔数 | ${pnlAttribution.winLossSummary.loseCount} |\n`;
    md += `| 胜率 | ${this.formatPercent(pnlAttribution.winLossSummary.winRate)}% |\n`;
    md += `| 平均盈利 | ¥${this.formatNumber(pnlAttribution.winLossSummary.avgWinPnl)} |\n`;
    md += `| 平均亏损 | ¥${this.formatNumber(pnlAttribution.winLossSummary.avgLosePnl)} |\n`;
    md += `| 盈亏比 | ${pnlAttribution.winLossSummary.profitFactor.toFixed(2)} |\n\n`;

    if (pnlAttribution.bySymbol.length > 0) {
      md += `### 4.2 按股票分类\n\n`;
      md += `| 股票代码 | 股票名称 | 交易笔数 | 已实现盈亏 | 盈利笔数 | 亏损笔数 | 胜率 |\n`;
      md += `|----------|----------|----------|------------|----------|----------|------|\n`;
      
      for (const s of pnlAttribution.bySymbol) {
        md += `| ${s.symbol} | ${s.name || '-'} | ${s.trades} | ${s.realizedPnl >= 0 ? '+' : ''}¥${this.formatNumber(s.realizedPnl)} | ${s.winTrades} | ${s.loseTrades} | ${this.formatPercent(s.winRate)}% |\n`;
      }
      md += `\n`;
    }

    md += `### 4.3 按卖出类型分类\n\n`;
    md += `| 类型 | 笔数 | 总盈亏 | 平均盈亏 |\n`;
    md += `|------|------|--------|----------|\n`;
    
    for (const cat of pnlAttribution.byCategory) {
      md += `| ${cat.category} | ${cat.count} | ${cat.totalPnl >= 0 ? '+' : ''}¥${this.formatNumber(cat.totalPnl)} | ${cat.avgPnl >= 0 ? '+' : ''}¥${this.formatNumber(cat.avgPnl)} |\n`;
    }
    md += `\n`;

    md += `## 五、需复盘订单\n\n`;
    
    const needReviewOrders = ordersForReview.filter(o => o.reviewFlags.needsReview);
    
    if (needReviewOrders.length > 0) {
      md += `### 5.1 需要复盘的订单 (${needReviewOrders.length}笔)\n\n`;
      
      for (const order of needReviewOrders) {
        md += `#### 订单 ${order.orderNo}\n\n`;
        md += `- **股票**: ${order.symbol} ${order.name || ''}\n`;
        md += `- **类型**: ${order.orderType === 'buy' ? '买入' : '卖出'}\n`;
        md += `- **状态**: ${this.translateOrderStatus(order.status)}\n`;
        md += `- **委托价**: ¥${this.formatNumber(order.price)}\n`;
        md += `- **委托量**: ${order.quantity}\n`;
        md += `- **已成交**: ${order.filledQuantity} / ${order.quantity}\n`;
        if (order.filledQuantity > 0) {
          md += `- **成交均价**: ¥${this.formatNumber(order.filledPrice || 0)}\n`;
          md += `- **成交金额**: ¥${this.formatNumber(order.filledAmount || 0)}\n`;
        }
        if (order.cancelReason) {
          md += `- **撤单原因**: ${order.cancelReason}\n`;
        }
        if (order.remark) {
          md += `- **备注**: ${order.remark}\n`;
        }
        md += `- **复盘标签**: `;
        const flags = [];
        if (order.reviewFlags.isChaseHigh) flags.push('追高买入');
        if (order.reviewFlags.isLargeOrder) flags.push('大额订单');
        if (order.reviewFlags.isCanceled) flags.push('已撤单');
        md += flags.join(', ') || '无\n';
        md += `\n\n`;
      }
    } else {
      md += `当日无需要复盘的订单。\n\n`;
    }

    md += `## 六、交易流水\n\n`;
    
    if (tradeHistories.length > 0) {
      md += `| 时间 | 股票代码 | 类型 | 价格 | 数量 | 金额 | 盈亏 | 盈亏% |\n`;
      md += `|------|----------|------|------|------|------|------|-------|\n`;
      
      for (const trade of tradeHistories) {
        const pnlStr = trade.realized_pnl !== null 
          ? `${trade.realized_pnl >= 0 ? '+' : ''}¥${this.formatNumber(trade.realized_pnl)}` 
          : '-';
        const pnlPercentStr = trade.realized_pnl_percent !== null 
          ? `${this.formatPercent(trade.realized_pnl_percent)}%` 
          : '-';
        
        md += `| ${dayjs(trade.trade_time).format('HH:mm:ss')} | ${trade.symbol} | ${trade.trade_type === 'buy' ? '买入' : '卖出'} | ¥${this.formatNumber(trade.price)} | ${trade.quantity} | ¥${this.formatNumber(trade.amount)} | ${pnlStr} | ${pnlPercentStr} |\n`;
      }
      md += `\n`;
    } else {
      md += `当日无交易记录。\n\n`;
    }

    md += `## 七、复盘笔记\n\n`;
    
    if (reviewNotes.length > 0) {
      for (const note of reviewNotes) {
        md += `### ${note.title || this.translateNoteType(note.note_type)}\n\n`;
        if (note.importance) {
          md += `**重要性**: ${this.translateImportance(note.importance)}\n\n`;
        }
        if (note.tags && note.tags.length > 0) {
          md += `**标签**: ${note.tags.join(', ')}\n\n`;
        }
        md += `${note.content}\n\n`;
        if (note.action_items && note.action_items.length > 0) {
          md += `**行动项**:\n`;
          for (const item of note.action_items) {
            md += `- [ ] ${item}\n`;
          }
          md += `\n`;
        }
      }
    } else {
      md += `当日无复盘笔记。\n\n`;
    }

    md += `---\n\n`;
    md += `*本报告由股票模拟交易复盘系统自动生成*\n`;
    md += `*生成时间: ${dayjs(data.generatedAt).format('YYYY-MM-DD HH:mm:ss')}*\n`;

    return md;
  }

  async exportToHTML(tradingDayId, options = {}) {
    const markdown = await this.exportToMarkdown(tradingDayId, options);
    const data = await this.generateReportData(tradingDayId, options);
    
    const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>交易复盘报告 - ${data.tradingDay.date}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
      background: #f5f5f5;
    }
    .report-container {
      background: white;
      padding: 40px;
      border-radius: 8px;
      box-shadow: 0 2px 12px rgba(0,0,0,0.1);
    }
    h1 { font-size: 28px; color: #1a1a1a; margin-bottom: 20px; border-bottom: 2px solid #3b82f6; padding-bottom: 10px; }
    h2 { font-size: 22px; color: #1e40af; margin-top: 30px; margin-bottom: 15px; padding-left: 10px; border-left: 4px solid #3b82f6; }
    h3 { font-size: 18px; color: #374151; margin-top: 20px; margin-bottom: 10px; }
    h4 { font-size: 16px; color: #4b5563; margin-top: 15px; margin-bottom: 8px; }
    table { width: 100%; border-collapse: collapse; margin: 15px 0; font-size: 14px; }
    th, td { border: 1px solid #e5e7eb; padding: 10px; text-align: left; }
    th { background: #f3f4f6; font-weight: 600; color: #374151; }
    tr:nth-child(even) { background: #f9fafb; }
    tr:hover { background: #eff6ff; }
    .meta-info { color: #6b7280; font-size: 14px; margin-bottom: 20px; }
    .meta-info span { margin-right: 20px; }
    hr { border: none; border-top: 1px solid #e5e7eb; margin: 30px 0; }
    ul { margin: 10px 0; padding-left: 25px; }
    li { margin: 5px 0; }
    .positive { color: #10b981; font-weight: 600; }
    .negative { color: #ef4444; font-weight: 600; }
    .warning { color: #f59e0b; font-weight: 600; }
    .critical { background: #fef2f2; color: #dc2626; }
    .danger { background: #fff7ed; color: #ea580c; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #9ca3af; font-size: 12px; text-align: center; }
    code { background: #f3f4f6; padding: 2px 6px; border-radius: 4px; font-family: monospace; }
    pre { background: #1f2937; color: #e5e7eb; padding: 15px; border-radius: 6px; overflow-x: auto; }
    p { margin: 10px 0; }
    .section-title { display: flex; align-items: center; gap: 10px; }
  </style>
</head>
<body>
  <div class="report-container">
    <h1>📊 交易复盘报告</h1>
    <div class="meta-info">
      <span><strong>📅 日期:</strong> ${data.tradingDay.date}</span>
      <span><strong>🕐 生成时间:</strong> ${new Date().toLocaleString('zh-CN')}</span>
    </div>
    <hr>
    
    ${this.markdownToHTML(markdown)}
    
    <div class="footer">
      <p>本报告由股票模拟交易复盘系统自动生成</p>
      <p>生成时间: ${new Date().toLocaleString('zh-CN')}</p>
    </div>
  </div>
</body>
</html>`;

    return html;
  }

  async exportToCSV(tradingDayId, options = {}) {
    const data = await this.generateReportData(tradingDayId, options);
    
    const csvSections = [];
    
    csvSections.push('交易概览');
    csvSections.push('指标,数值');
    csvSections.push(`总资产,${data.tradingDay.total_asset || 0}`);
    csvSections.push(`可用现金,${data.cashAccount?.available_balance || 0}`);
    csvSections.push(`持仓市值,${data.metrics.totalMarketValue}`);
    csvSections.push(`仓位比例,${data.metrics.positionRatio}%`);
    csvSections.push(`当日盈亏,${data.metrics.dailyPnl}`);
    csvSections.push(`当日盈亏%,${data.metrics.dailyPnlPercent}%`);
    csvSections.push('');

    if (data.positionsForReview.length > 0) {
      csvSections.push('当前持仓');
      csvSections.push('股票代码,股票名称,持仓数量,可用数量,成本价,现价,市值,浮盈亏,浮盈亏%,仓位占比,持有天数');
      for (const p of data.positionsForReview) {
        csvSections.push(`${p.symbol},${p.name || ''},${p.quantity},${p.availableQuantity},${p.avgCostPrice},${p.currentPrice || 0},${p.marketValue || 0},${p.floatingPnl || 0},${p.floatingPnlPercent || 0},${p.positionRatio || 0},${p.holdingDays || 0}`);
      }
      csvSections.push('');
    }

    if (data.tradeHistories.length > 0) {
      csvSections.push('交易流水');
      csvSections.push('时间,股票代码,类型,价格,数量,金额,佣金,印花税,盈亏,盈亏%,持仓天数');
      for (const trade of data.tradeHistories) {
        csvSections.push(`${dayjs(trade.trade_time).format('YYYY-MM-DD HH:mm:ss')},${trade.symbol},${trade.trade_type === 'buy' ? '买入' : '卖出'},${trade.price},${trade.quantity},${trade.amount},${trade.commission},${trade.tax},${trade.realized_pnl !== null ? trade.realized_pnl : ''},${trade.realized_pnl_percent !== null ? trade.realized_pnl_percent : ''},${trade.holding_days || ''}`);
      }
      csvSections.push('');
    }

    if (data.alerts.length > 0) {
      csvSections.push('风险预警');
      csvSections.push('预警类型,严重程度,状态,股票代码,标题,消息,触发值,阈值,时间');
      for (const alert of data.alerts) {
        csvSections.push(`${this.translateAlertType(alert.alert_type)},${this.translateSeverity(alert.severity)},${this.translateAlertStatus(alert.status)},${alert.symbol || ''},"${alert.title}","${alert.message || ''}",${alert.trigger_value || ''},${alert.threshold_value || ''}${alert.unit || ''},${dayjs(alert.created_at).format('YYYY-MM-DD HH:mm:ss')}`);
      }
      csvSections.push('');
    }

    if (data.ordersForReview.filter(o => o.reviewFlags.needsReview).length > 0) {
      csvSections.push('需复盘订单');
      csvSections.push('订单号,股票代码,类型,状态,委托价,委托量,已成交量,成交均价,成交金额,撤单原因,复盘标签');
      for (const order of data.ordersForReview.filter(o => o.reviewFlags.needsReview)) {
        const flags = [];
        if (order.reviewFlags.isChaseHigh) flags.push('追高买入');
        if (order.reviewFlags.isLargeOrder) flags.push('大额订单');
        if (order.reviewFlags.isCanceled) flags.push('已撤单');
        csvSections.push(`${order.orderNo},${order.symbol},${order.orderType === 'buy' ? '买入' : '卖出'},${this.translateOrderStatus(order.status)},${order.price},${order.quantity},${order.filledQuantity},${order.filledPrice || ''},${order.filledAmount || ''},"${order.cancelReason || ''}","${flags.join(';')}"`);
      }
      csvSections.push('');
    }

    csvSections.push('盈亏归因 - 汇总');
    csvSections.push('指标,数值');
    csvSections.push(`总已实现盈亏,${data.pnlAttribution.totalRealizedPnl}`);
    csvSections.push(`盈利笔数,${data.pnlAttribution.winLossSummary.winCount}`);
    csvSections.push(`亏损笔数,${data.pnlAttribution.winLossSummary.loseCount}`);
    csvSections.push(`胜率,${data.pnlAttribution.winLossSummary.winRate}%`);
    csvSections.push(`平均盈利,${data.pnlAttribution.winLossSummary.avgWinPnl}`);
    csvSections.push(`平均亏损,${data.pnlAttribution.winLossSummary.avgLosePnl}`);
    csvSections.push(`盈亏比,${data.pnlAttribution.winLossSummary.profitFactor.toFixed(2)}`);

    return csvSections.join('\n');
  }

  formatNumber(num) {
    if (num === null || num === undefined) return '0.00';
    return Number(num).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  formatPercent(num) {
    if (num === null || num === undefined) return '0.00';
    return Number(num).toFixed(2);
  }

  translateAlertType(type) {
    const mapping = {
      'over_position': '仓位超限',
      'continuous_loss': '连续亏损',
      'stop_loss_not_executed': '止损未执行',
      'chase_high_buy': '追高买入',
      'max_drawdown_exceed': '最大回撤超限',
      'single_stock_over_weight': '单票仓位过重',
      'liquidity_warning': '流动性预警',
      'rule_violation': '规则违规',
      'other': '其他'
    };
    return mapping[type] || type;
  }

  translateSeverity(severity) {
    const mapping = {
      'info': '信息',
      'warning': '警告',
      'danger': '危险',
      'critical': '严重'
    };
    return mapping[severity] || severity;
  }

  translateAlertStatus(status) {
    const mapping = {
      'active': '活跃',
      'acknowledged': '已确认',
      'resolved': '已解决',
      'ignored': '已忽略'
    };
    return mapping[status] || status;
  }

  translateOrderStatus(status) {
    const mapping = {
      'pending': '待提交',
      'submitted': '已提交',
      'partially_filled': '部分成交',
      'filled': '已成交',
      'cancelled': '已撤单',
      'rejected': '已拒绝',
      'expired': '已过期'
    };
    return mapping[status] || status;
  }

  translateNoteType(type) {
    const mapping = {
      'daily_summary': '每日总结',
      'trade_analysis': '交易分析',
      'lesson_learned': '经验教训',
      'improvement_plan': '改进计划',
      'other': '其他'
    };
    return mapping[type] || type;
  }

  translateImportance(importance) {
    const mapping = {
      'low': '低',
      'medium': '中',
      'high': '高',
      'critical': '关键'
    };
    return mapping[importance] || importance;
  }

  markdownToHTML(markdown) {
    let html = markdown
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/^---$/gim, '<hr>')
      .replace(/^\|(.*)\|$/gim, (match) => {
        const cells = match.split('|').slice(1, -1).map(c => c.trim());
        return '<tr>' + cells.map(c => `<td>${c}</td>`).join('') + '</tr>';
      })
      .replace(/^- (.*$)/gim, '<li>$1</li>');
    
    html = html.replace(/(<h2>.*?<\/h2>)\n(<tr>.*?<\/tr>\n)+/g, (match) => {
      const header = match.match(/<h2>.*?<\/h2>/);
      const rows = match.match(/<tr>.*?<\/tr>/g);
      if (rows && rows.length > 1) {
        const thead = rows[0].replace(/<td>/g, '<th>').replace(/<\/td>/g, '</th>');
        const tbody = rows.slice(1).join('\n');
        return `${header}\n<table>\n<thead>${thead}</thead>\n<tbody>\n${tbody}\n</tbody>\n</table>\n`;
      }
      return match;
    });

    html = html.replace(/^#### (.*$)/gim, '<h4>$1</h4>');
    html = html.replace(/<li>/g, '<ul><li>').replace(/<\/li>\n(?!<li>)/g, '</li></ul>\n');
    
    return html;
  }
}

module.exports = new ExportService();
