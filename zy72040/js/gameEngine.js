class GameEngine {
  constructor(resourceConfig) {
    this.resourceConfig = resourceConfig;
    this.state = null;
    this.eventLog = [];
    this.warningLog = [];
    this.duplicateEventIds = new Set();
    this.processedEventIds = new Set();
    this.hasNegativeResource = false;
    this.hasBoundaryViolation = false;
  }

  initState() {
    this.state = {};
    for (const [key, config] of Object.entries(this.resourceConfig)) {
      this.state[key] = config.initial;
    }
    this.eventLog = [];
    this.warningLog = [];
    this.duplicateEventIds.clear();
    this.processedEventIds.clear();
    this.hasNegativeResource = false;
    this.hasBoundaryViolation = false;
    return this.state;
  }

  validateLevel(level) {
    const errors = [];
    const warnings = [];

    if (!level || typeof level !== 'object') {
      errors.push('关卡配置无效');
      return { valid: false, errors, warnings };
    }

    if (!level.id) {
      errors.push('关卡缺少ID');
    }

    if (!level.name || level.name.trim() === '') {
      warnings.push('关卡名称为空');
    }

    if (level.events === null || level.events === undefined) {
      warnings.push('关卡事件配置为null，将视为空关卡');
    }

    if (!Array.isArray(level.events) || level.events.length === 0) {
      warnings.push('关卡没有可执行事件');
    }

    const eventIds = new Set();
    if (Array.isArray(level.events)) {
      level.events.forEach((event, index) => {
        if (!event.id) {
          warnings.push(`第${index + 1}个事件缺少ID`);
        } else if (eventIds.has(event.id)) {
          warnings.push(`检测到重复事件ID: ${event.id}`);
          this.duplicateEventIds.add(event.id);
        } else {
          eventIds.add(event.id);
        }

        if (!event.decisions || !Array.isArray(event.decisions) || event.decisions.length === 0) {
          warnings.push(`事件 ${event.id || 'unknown'} 没有可选决策`);
        }
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  processEvent(event, decision) {
    const result = {
      previousState: Utils.deepClone(this.state),
      effects: {},
      warnings: [],
      boundaryAdjustments: [],
      success: true
    };

    if (this.processedEventIds.has(event.id)) {
      result.warnings.push(`重复事件ID: ${event.id}，已处理但标记异常`);
      this.duplicateEventIds.add(event.id);
    }
    this.processedEventIds.add(event.id);

    if (event.inflowChange) {
      const storageChange = this.calculateStorageChange(event.inflowChange);
      this.applyResourceChange('storage', storageChange, result);
    }

    for (const [resource, delta] of Object.entries(decision.effects)) {
      this.applyResourceChange(resource, delta, result);
      result.effects[resource] = delta;
    }

    this.checkResourceBoundaries(result);

    const eventRecord = {
      eventId: event.id,
      eventTitle: event.title,
      decisionId: decision.id,
      decisionLabel: decision.label,
      explanation: decision.explanation,
      effects: result.effects,
      stateAfter: Utils.deepClone(this.state),
      timestamp: Date.now(),
      warnings: result.warnings
    };
    this.eventLog.push(eventRecord);

    return result;
  }

  calculateStorageChange(inflowChange) {
    return inflowChange * 3.6;
  }

  applyResourceChange(resource, delta, result) {
    if (!this.resourceConfig[resource]) {
      result.warnings.push(`未知资源类型: ${resource}`);
      return;
    }

    const config = this.resourceConfig[resource];
    let newValue = this.state[resource] + delta;

    if (newValue < config.min || newValue > config.max) {
      this.hasBoundaryViolation = true;
      const clampedValue = Utils.clamp(newValue, config.min, config.max);
      result.boundaryAdjustments.push({
        resource,
        attempted: newValue,
        adjusted: clampedValue,
        min: config.min,
        max: config.max
      });
      result.warnings.push(`${resource} 超出边界: 尝试设为 ${newValue}${config.unit}，已限制为 ${clampedValue}${config.unit}`);
      newValue = clampedValue;
    }

    if (newValue < 0) {
      this.hasNegativeResource = true;
      result.warnings.push(`${resource} 出现负值: ${newValue}${config.unit}`);
    }

    this.state[resource] = newValue;
  }

  checkResourceBoundaries(result) {
    for (const [resource, value] of Object.entries(this.state)) {
      const config = this.resourceConfig[resource];

      if (config.warning !== undefined && value >= config.warning) {
        result.warnings.push(`⚠️ ${resource} 达到警戒值: ${value}${config.unit}`);
      }
      if (config.flood !== undefined && value >= config.flood) {
        result.warnings.push(`🚨 ${resource} 超过防洪高水位: ${value}${config.unit}`);
      }
      if (value < 0) {
        this.hasNegativeResource = true;
        result.warnings.push(`❌ ${resource} 为负值: ${value}${config.unit}，需要人工确认`);
      }
    }
  }

  calculateScore() {
    return Utils.clamp(Math.round(this.state.score), 0, 100);
  }

  getGameResult() {
    const finalScore = this.calculateScore();
    const hasAnomalies = this.hasNegativeResource || this.hasBoundaryViolation || this.duplicateEventIds.size > 0;

    let status = 'normal';
    if (this.hasNegativeResource) {
      status = 'needs_manual_review';
    } else if (this.hasBoundaryViolation || this.duplicateEventIds.size > 0) {
      status = 'has_warnings';
    }

    let grade = 'F';
    if (finalScore >= 90) grade = 'A';
    else if (finalScore >= 80) grade = 'B';
    else if (finalScore >= 70) grade = 'C';
    else if (finalScore >= 60) grade = 'D';

    return {
      finalScore,
      grade,
      status,
      hasNegativeResource: this.hasNegativeResource,
      hasBoundaryViolation: this.hasBoundaryViolation,
      duplicateEventIds: Array.from(this.duplicateEventIds),
      warningLog: this.warningLog,
      totalEvents: this.eventLog.length,
      penaltyPoints: 100 - finalScore
    };
  }

  getDecisionHistory() {
    return this.eventLog;
  }

  getCurrentState() {
    return Utils.deepClone(this.state);
  }
}
