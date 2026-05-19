const { v4: uuidv4 } = require('uuid');
const Compensation = require('../models/Compensation');
const Order = require('../models/Order');
const Shortage = require('../models/Shortage');
const CompensationRule = require('../models/CompensationRule');
const DataStore = require('../utils/DataStore');
const path = require('path');

class CompensationService {
  constructor(dataDir) {
    this.dataStore = new DataStore(dataDir || path.join(__dirname, '../data'));
  }

  matchRule(order, shortage, rules) {
    const applicableRules = rules.filter(rule => 
      rule.enabled && 
      rule.matches(shortage.productId, '*', shortage.shortageQuantity)
    ).sort((a, b) => b.priority - a.priority);

    return applicableRules.length > 0 ? applicableRules[0] : null;
  }

  generateCompensation(order, shortage, rule) {
    const compensation = new Compensation({
      orderId: order.id,
      orderNo: order.orderNo,
      shortageId: shortage.id,
      ruleId: rule.id,
      userId: order.userId,
      userName: order.userName,
      phone: order.phone,
      productId: order.productId,
      productName: order.productName,
      shortageQuantity: Math.min(order.quantity, shortage.shortageQuantity),
      compensationType: rule.compensationType,
    });

    switch (rule.compensationType) {
      case 'refund':
        compensation.refundAmount = Math.min(order.quantity, shortage.shortageQuantity) * 
                                   order.unitPrice * 
                                   rule.refundRate;
        break;
      case 'coupon':
        compensation.couponId = 'CPN' + Date.now() + Math.floor(Math.random() * 1000);
        compensation.couponValue = rule.couponValue;
        break;
      case 'exchange':
        compensation.exchangeProductId = rule.exchangeProductId;
        compensation.exchangeProductName = rule.exchangeProductName;
        compensation.exchangeQuantity = Math.min(order.quantity, shortage.shortageQuantity);
        break;
    }

    return compensation;
  }

  async processBatch(retryFailed = false) {
    const orders = this.dataStore.findAll('orders', Order);
    const shortages = this.dataStore.findAll('shortages', Shortage);
    const rules = this.dataStore.findAll('rules', CompensationRule);
    const existingCompensations = this.dataStore.findAll('compensations', Compensation);

    const processedOrderIds = new Set(
      existingCompensations
        .filter(c => retryFailed ? c.status !== 'pending' : true)
        .map(c => c.orderId)
    );

    const results = {
      success: [],
      failed: [],
      skipped: [],
      total: 0,
    };

    for (const shortage of shortages) {
      const affectedOrders = orders.filter(o => 
        o.productId === shortage.productId && 
        !processedOrderIds.has(o.id)
      );

      for (const order of affectedOrders) {
        results.total++;
        
        try {
          const rule = this.matchRule(order, shortage, rules);
          
          if (!rule) {
            results.skipped.push({
              orderId: order.id,
              orderNo: order.orderNo,
              reason: '未找到匹配的补偿规则',
            });
            continue;
          }

          const compensation = this.generateCompensation(order, shortage, rule);
          this.dataStore.insert('compensations', compensation);
          
          this.dataStore.update('orders', order.id, (o) => {
            o.status = 'compensated';
          }, Order);

          results.success.push({
            orderId: order.id,
            orderNo: order.orderNo,
            compensationId: compensation.id,
            compensationType: compensation.compensationType,
          });
        } catch (error) {
          results.failed.push({
            orderId: order.id,
            orderNo: order.orderNo,
            error: error.message,
          });
        }
      }
    }

    return results;
  }

  retryFailedCompensations() {
    const compensations = this.dataStore.find(
      'compensations',
      c => c.status === 'failed',
      Compensation
    );

    const results = {
      success: [],
      failed: [],
      total: compensations.length,
    };

    for (const compensation of compensations) {
      try {
        this.dataStore.update('compensations', compensation.id, (c) => {
          c.status = 'pending';
          c.updatedAt = new Date();
        }, Compensation);

        results.success.push({
          compensationId: compensation.id,
          orderNo: compensation.orderNo,
        });
      } catch (error) {
        results.failed.push({
          compensationId: compensation.id,
          orderNo: compensation.orderNo,
          error: error.message,
        });
      }
    }

    return results;
  }

  approveCompensation(compensationId, operator) {
    const compensation = this.dataStore.findById('compensations', compensationId, Compensation);
    
    if (!compensation) {
      throw new Error(`补偿记录不存在: ${compensationId}`);
    }

    if (compensation.status !== 'pending') {
      throw new Error(`补偿记录状态不正确，当前状态: ${compensation.status}`);
    }

    this.dataStore.update('compensations', compensationId, (c) => {
      c.status = 'approved';
      c.processedBy = operator;
      c.processedAt = new Date();
    }, Compensation);

    return this.dataStore.findById('compensations', compensationId, Compensation);
  }

  executeCompensation(compensationId) {
    const compensation = this.dataStore.findById('compensations', compensationId, Compensation);
    
    if (!compensation) {
      throw new Error(`补偿记录不存在: ${compensationId}`);
    }

    if (compensation.status !== 'approved') {
      throw new Error(`补偿记录需要先审核通过，当前状态: ${compensation.status}`);
    }

    this.dataStore.update('compensations', compensationId, (c) => {
      c.status = 'executed';
    }, Compensation);

    return this.dataStore.findById('compensations', compensationId, Compensation);
  }

  getCompensationsByStatus(status) {
    return this.dataStore.find(
      'compensations',
      c => !status || c.status === status,
      Compensation
    );
  }

  getBadRecords(status = 'unresolved') {
    return this.dataStore.find(
      'badRecords',
      b => !status || b.status === status,
      require('../models/BadRecord')
    );
  }

  resolveBadRecord(recordId, resolutionNote, resolver) {
    const BadRecord = require('../models/BadRecord');
    const record = this.dataStore.findById('badRecords', recordId, BadRecord);
    
    if (!record) {
      throw new Error(`坏记录不存在: ${recordId}`);
    }

    this.dataStore.update('badRecords', recordId, (r) => {
      r.status = 'resolved';
      r.resolvedBy = resolver;
      r.resolvedAt = new Date();
      r.resolutionNote = resolutionNote;
    }, BadRecord);

    return this.dataStore.findById('badRecords', recordId, BadRecord);
  }
}

module.exports = CompensationService;
