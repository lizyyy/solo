const store = require('../models/store');
const { StatusFlow, StrategyStatus } = require('../models/constants');
const Exporter = require('../utils/exporter');

class StrategyService {
  static createStrategy(data) {
    return store.create(data);
  }

  static getStrategyById(id) {
    return store.findById(id);
  }

  static listStrategies(filters = {}) {
    return store.findAll(filters);
  }

  static updateStatus(id, newStatus, operator, reason) {
    const strategy = store.findById(id);
    if (!strategy) {
      throw new Error('策略不存在');
    }

    const allowedTransitions = StatusFlow[strategy.status];
    if (!allowedTransitions.includes(newStatus)) {
      throw new Error(`不允许从 ${strategy.status} 状态转换到 ${newStatus} 状态`);
    }

    strategy.updateStatus(newStatus, operator, reason);
    return strategy;
  }

  static publishStrategy(id, operator) {
    const strategy = store.findById(id);
    if (!strategy) {
      throw new Error('策略不存在');
    }

    if (strategy.status !== StrategyStatus.PENDING) {
      throw new Error('只有待处理状态的策略才能发布');
    }

    strategy.publish(operator);
    return strategy;
  }

  static activateStrategy(id, operator, reason = '策略激活执行') {
    return this.updateStatus(id, StrategyStatus.BLOCKED, operator, reason);
  }

  static compensateStrategy(id, operator, reason = '服务已恢复') {
    return this.updateStatus(id, StrategyStatus.COMPENSATED, operator, reason);
  }

  static revokeStrategy(id, operator, reason = '策略撤销') {
    const strategy = store.findById(id);
    if (!strategy) {
      throw new Error('策略不存在');
    }

    const finalStates = [StrategyStatus.REVOKED, StrategyStatus.COMPENSATED];
    if (finalStates.includes(strategy.status)) {
      throw new Error('该状态的策略无法撤销');
    }

    strategy.updateStatus(StrategyStatus.REVOKED, operator, reason);
    return strategy;
  }

  static manualCorrect(id, correctionData, operator) {
    const strategy = store.findById(id);
    if (!strategy) {
      throw new Error('策略不存在');
    }

    const allowedFields = ['apiGroups', 'tenantScope', 'degradationLevel', 'recoveryCondition', 'impactSummary', 'remarks'];
    const updateData = {};

    allowedFields.forEach(field => {
      if (correctionData[field] !== undefined) {
        updateData[field] = correctionData[field];
      }
    });

    updateData.operator = operator;
    strategy.statusHistory.push({
      status: strategy.status,
      timestamp: new Date().toISOString(),
      operator,
      reason: `人工修正: ${JSON.stringify(correctionData)}`
    });

    return store.update(id, updateData);
  }

  static recordFailure(id, originalInput, processingBasis, finalConclusion) {
    const strategy = store.findById(id);
    if (!strategy) {
      throw new Error('策略不存在');
    }

    strategy.setFailurePath(originalInput, processingBasis, finalConclusion);
    return strategy;
  }

  static addImpactRecord(id, record) {
    const strategy = store.findById(id);
    if (!strategy) {
      throw new Error('策略不存在');
    }

    strategy.addImpactRecord(record);
    return strategy;
  }

  static matchStrategies(apiGroup, tenantId) {
    return store.matchStrategy(apiGroup, tenantId);
  }

  static exportStrategies(options = {}) {
    let strategies = store.findAll();

    if (options.status) {
      strategies = strategies.filter(s => s.status === options.status);
    }
    if (options.startDate) {
      strategies = strategies.filter(s => new Date(s.createdAt) >= new Date(options.startDate));
    }
    if (options.endDate) {
      strategies = strategies.filter(s => new Date(s.createdAt) <= new Date(options.endDate));
    }

    const summary = Exporter.generateSummary(strategies);

    if (options.format === 'csv') {
      return {
        format: 'csv',
        summary,
        data: Exporter.toCSV(strategies)
      };
    }

    return {
      format: 'json',
      summary,
      data: strategies.map(s => s.toJSON())
    };
  }

  static exportImpactSummary(id, format = 'json') {
    const strategy = store.findById(id);
    if (!strategy) {
      throw new Error('策略不存在');
    }

    if (format === 'csv') {
      return {
        strategyId: id,
        strategyName: strategy.strategyName,
        format: 'csv',
        data: Exporter.exportImpactSummaryCSV(strategy)
      };
    }

    return {
      strategyId: id,
      strategyName: strategy.strategyName,
      format: 'json',
      data: strategy.impactRecords
    };
  }

  static getStatistics() {
    return store.getStatistics();
  }
}

module.exports = StrategyService;
