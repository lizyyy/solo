const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const db = require('../models');
const { Op } = require('sequelize');
const dayjs = require('dayjs');

class ImportService {
  constructor() {
    this.sequelize = db.sequelize;
  }

  async importQuotesFromCSV(filePath, tradingDayId) {
    const transaction = await this.sequelize.transaction();
    
    try {
      const results = [];
      
      return new Promise((resolve, reject) => {
        fs.createReadStream(filePath)
          .pipe(csv())
          .on('data', (data) => results.push(data))
          .on('end', async () => {
            try {
              if (results.length === 0) {
                await transaction.rollback();
                reject(new Error('CSV 文件为空'));
                return;
              }

              const importedCount = await this.processQuoteRecords(results, tradingDayId, transaction);
              await transaction.commit();
              resolve({
                success: true,
                count: importedCount,
                message: `成功导入 ${importedCount} 条行情数据`
              });
            } catch (error) {
              await transaction.rollback();
              reject(error);
            }
          })
          .on('error', (error) => {
            transaction.rollback();
            reject(error);
          });
      });

    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async processQuoteRecords(records, tradingDayId, transaction) {
    let count = 0;

    for (const record of records) {
      const symbol = this.cleanSymbol(record.symbol || record.code || record.stock_code || record['股票代码']);
      
      if (!symbol) continue;

      const name = record.name || record.stock_name || record['股票名称'] || symbol;
      
      const quoteData = {
        trading_day_id: tradingDayId,
        symbol,
        name,
        open: this.parseNumber(record.open || record['开盘价']),
        high: this.parseNumber(record.high || record['最高价']),
        low: this.parseNumber(record.low || record['最低价']),
        close: this.parseNumber(record.close || record['收盘价'] || record.current || record['现价']),
        volume: this.parseNumber(record.volume || record['成交量']),
        amount: this.parseNumber(record.amount || record['成交额']),
        prev_close: this.parseNumber(record.prev_close || record['昨收'] || record.pre_close),
        change: this.parseNumber(record.change || record['涨跌']),
        change_percent: this.parseNumber(record.change_percent || record['涨跌幅'] || record.pct_change),
        source: 'csv_import'
      };

      const existingQuote = await db.Quote.findOne({
        where: {
          trading_day_id: tradingDayId,
          symbol
        },
        { transaction }
      });

      if (existingQuote) {
        await existingQuote.update(quoteData, { transaction });
      } else {
        await db.Quote.create(quoteData, { transaction });
      }

      count++;
    }

    return count;
  }

  async importTradePlanFromJSON(jsonData, tradingDayId) {
    const transaction = await this.sequelize.transaction();
    
    try {
      const plans = Array.isArray(jsonData) ? jsonData : [jsonData];
      let count = 0;

      for (const plan of plans) {
        const symbol = this.cleanSymbol(plan.symbol || plan.code || plan.stock_code);
        if (!symbol) continue;

        const planData = {
          trading_day_id: tradingDayId,
          symbol,
          name: plan.name || plan.stock_name || symbol,
          plan_type: plan.plan_type || plan.type || 'watch',
          status: 'pending',
          entry_price_min: this.parseNumber(plan.entry_price_min || plan.min_price),
          entry_price_max: this.parseNumber(plan.entry_price_max || plan.max_price),
          target_price: this.parseNumber(plan.target_price || plan.take_profit),
          stop_loss_price: this.parseNumber(plan.stop_loss_price || plan.stop_loss),
          planned_quantity: this.parseNumber(plan.planned_quantity || plan.quantity),
          entry_reason: plan.entry_reason || plan.reason,
          exit_reason: plan.exit_reason,
          risk_level: plan.risk_level || 'medium',
          priority: this.parseNumber(plan.priority, 0),
          metadata: plan.metadata || {}
        };

        await db.TradePlan.create(planData, { transaction });
        count++;
      }

      await transaction.commit();
      return {
        success: true,
        count,
        message: `成功导入 ${count} 条交易计划`
      };

    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async importTradePlanFromFile(filePath, tradingDayId) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const jsonData = JSON.parse(content);
    return await this.importTradePlanFromJSON(jsonData, tradingDayId);
  }

  async parseQuoteCSV(filePath) {
    return new Promise((resolve, reject) => {
      const results = [];
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', () => resolve(results))
        .on('error', reject);
    });
  }

  async getQuotesByTradingDay(tradingDayId, options = {}) {
    const { symbol, page = 1, pageSize = 100 } = options;
    
    const where = { trading_day_id: tradingDayId };
    if (symbol) where.symbol = { [Op.like]: `%${symbol}%` };

    const { count, rows } = await db.Quote.findAndCountAll({
      where,
      order: [['symbol', 'ASC']],
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

  async getQuoteBySymbol(tradingDayId, symbol) {
    return await db.Quote.findOne({
      where: {
        trading_day_id: tradingDayId,
        symbol
      }
    });
  }

  async getTradePlansByTradingDay(tradingDayId, options = {}) {
    const { symbol, status, plan_type, page = 1, pageSize = 50 } = options;
    
    const where = { trading_day_id: tradingDayId };
    if (symbol) where.symbol = { [Op.like]: `%${symbol}%` };
    if (status) where.status = status;
    if (plan_type) where.plan_type = plan_type;

    const { count, rows } = await db.TradePlan.findAndCountAll({
      where,
      include: [{
        model: db.Order,
        as: 'orders'
      }],
      order: [['priority', 'DESC'], ['created_at', 'DESC']],
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

  async createTradePlan(planData) {
    return await db.TradePlan.create({
      trading_day_id: planData.trading_day_id,
      symbol: planData.symbol,
      name: planData.name || planData.symbol,
      plan_type: planData.plan_type || 'watch',
      status: 'pending',
      entry_price_min: this.parseNumber(planData.entry_price_min),
      entry_price_max: this.parseNumber(planData.entry_price_max),
      target_price: this.parseNumber(planData.target_price),
      stop_loss_price: this.parseNumber(planData.stop_loss_price),
      planned_quantity: this.parseNumber(planData.planned_quantity),
      entry_reason: planData.entry_reason,
      exit_reason: planData.exit_reason,
      risk_level: planData.risk_level || 'medium',
      priority: this.parseNumber(planData.priority, 0),
      metadata: planData.metadata
    });
  }

  async updateTradePlan(planId, updateData) {
    const plan = await db.TradePlan.findByPk(planId);
    if (!plan) {
      throw new Error('交易计划不存在');
    }

    const allowedFields = [
      'entry_price_min', 'entry_price_max', 'target_price', 'stop_loss_price',
      'planned_quantity', 'entry_reason', 'exit_reason', 'risk_level',
      'priority', 'status', 'metadata'
    ];

    const updateFields = {};
    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        updateFields[field] = updateData[field];
      }
    }

    return await plan.update(updateFields);
  }

  cleanSymbol(symbol) {
    if (!symbol) return null;
    return symbol.toString().trim().toUpperCase();
  }

  parseNumber(value, defaultValue = 0) {
    if (value === null || value === undefined || value === '') {
      return defaultValue;
    }
    if (typeof value === 'number') {
      return value;
    }
    const cleaned = value.toString().replace(/,/g, '').replace(/%/g, '');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? defaultValue : parsed;
  }
}

module.exports = new ImportService();
