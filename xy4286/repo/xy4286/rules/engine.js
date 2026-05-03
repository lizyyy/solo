const moment = require('moment');
const config = require('../config');
const repositories = require('../repositories');
const models = require('../models');
const { RISK_TYPES, SEVERITY_LEVELS } = require('../models/riskEvent');

class RuleEngine {
  constructor() {
    this.batchRepo = new repositories.BatchRepository();
    this.temperatureLogRepo = new repositories.TemperatureLogRepository();
    this.handoverFormRepo = new repositories.HandoverFormRepository();
    this.riskEventRepo = new repositories.RiskEventRepository();
    this.auditEventRepo = new repositories.AuditEventRepository();
    
    this.rules = {
      temperature: this.checkTemperatureRule.bind(this),
      delay: this.checkDelayRule.bind(this),
      signature: this.checkSignatureRule.bind(this),
      chainBreak: this.checkChainBreakRule.bind(this)
    };
  }

  async runAllRules(batchId = null) {
    const results = {
      batchId,
      runAt: moment().toISOString(),
      risks: [],
      resolved: [],
      errors: []
    };

    try {
      const batches = batchId 
        ? [this.batchRepo.findById(batchId)].filter(b => b)
        : this.batchRepo.findAll();

      for (const batch of batches) {
        const batchResults = await this.runRulesForBatch(batch);
        results.risks.push(...batchResults.risks);
        results.resolved.push(...batchResults.resolved);
      }
    } catch (error) {
      results.errors.push(error.message);
    }

    return results;
  }

  async runRulesForBatch(batch) {
    const results = {
      risks: [],
      resolved: []
    };

    const rulesToRun = ['temperature', 'delay', 'signature', 'chainBreak'];

    for (const ruleName of rulesToRun) {
      try {
        const ruleResult = await this.rules[ruleName](batch);
        if (ruleResult.risks) {
          results.risks.push(...ruleResult.risks);
        }
        if (ruleResult.resolved) {
          results.resolved.push(...ruleResult.resolved);
        }
      } catch (error) {
        console.error(`Error running rule ${ruleName}:`, error);
      }
    }

    return results;
  }

  async checkTemperatureRule(batch) {
    const results = { risks: [], resolved: [] };
    
    if (!batch.boxId) {
      return results;
    }

    const logs = this.temperatureLogRepo.findByBoxId(batch.boxId);
    
    if (logs.length === 0) {
      return results;
    }

    const { min: minTemp, max: maxTemp } = config.rules.temperature;
    const { maxOverTempDuration, maxUnderTempDuration } = config.rules.temperature;

    let overTempPeriods = [];
    let underTempPeriods = [];
    let currentOverTempPeriod = null;
    let currentUnderTempPeriod = null;

    for (let i = 0; i < logs.length; i++) {
      const log = logs[i];
      const temp = log.temperature;
      const timestamp = moment(log.timestamp);

      if (temp > maxTemp) {
        if (!currentOverTempPeriod) {
          currentOverTempPeriod = {
            start: timestamp,
            end: timestamp,
            maxTemp: temp,
            logs: [log]
          };
        } else {
          currentOverTempPeriod.end = timestamp;
          currentOverTempPeriod.maxTemp = Math.max(currentOverTempPeriod.maxTemp, temp);
          currentOverTempPeriod.logs.push(log);
        }
        
        if (currentUnderTempPeriod) {
          underTempPeriods.push(currentUnderTempPeriod);
          currentUnderTempPeriod = null;
        }
      } else if (temp < minTemp) {
        if (!currentUnderTempPeriod) {
          currentUnderTempPeriod = {
            start: timestamp,
            end: timestamp,
            minTemp: temp,
            logs: [log]
          };
        } else {
          currentUnderTempPeriod.end = timestamp;
          currentUnderTempPeriod.minTemp = Math.min(currentUnderTempPeriod.minTemp, temp);
          currentUnderTempPeriod.logs.push(log);
        }
        
        if (currentOverTempPeriod) {
          overTempPeriods.push(currentOverTempPeriod);
          currentOverTempPeriod = null;
        }
      } else {
        if (currentOverTempPeriod) {
          overTempPeriods.push(currentOverTempPeriod);
          currentOverTempPeriod = null;
        }
        if (currentUnderTempPeriod) {
          underTempPeriods.push(currentUnderTempPeriod);
          currentUnderTempPeriod = null;
        }
      }
    }

    if (currentOverTempPeriod) {
      overTempPeriods.push(currentOverTempPeriod);
    }
    if (currentUnderTempPeriod) {
      underTempPeriods.push(currentUnderTempPeriod);
    }

    let totalOverTempMinutes = 0;
    let totalUnderTempMinutes = 0;

    overTempPeriods.forEach(period => {
      const duration = period.end.diff(period.start, 'minutes');
      totalOverTempMinutes += duration;
      
      if (duration > maxOverTempDuration || period.maxTemp > maxTemp + 2) {
        const risk = this._createTemperatureRisk(batch, 'over', period, duration);
        results.risks.push(risk);
      }
    });

    underTempPeriods.forEach(period => {
      const duration = period.end.diff(period.start, 'minutes');
      totalUnderTempMinutes += duration;
      
      if (duration > maxUnderTempDuration || period.minTemp < minTemp - 2) {
        const risk = this._createTemperatureRisk(batch, 'under', period, duration);
        results.risks.push(risk);
      }
    });

    if (results.risks.length > 0) {
      batch.setRiskFlag('temperatureViolation', true);
      this.batchRepo.update(batch);
    } else {
      const existingRisks = this.riskEventRepo.findByFields({
        batchId: batch.id,
        type: RISK_TYPES.TEMPERATURE_VIOLATION,
        status: 'open'
      });
      
      existingRisks.forEach(risk => {
        risk.updateStatus('resolved', '温度已恢复正常范围');
        this.riskEventRepo.update(risk);
        results.resolved.push(risk);
      });
    }

    return results;
  }

  _createTemperatureRisk(batch, type, period, duration) {
    const isCritical = type === 'over' ? period.maxTemp > 10 : period.minTemp < 0;
    const severity = isCritical ? SEVERITY_LEVELS.CRITICAL : 
                     duration > 60 ? SEVERITY_LEVELS.HIGH : SEVERITY_LEVELS.MEDIUM;
    
    const risk = new models.RiskEvent({
      batchId: batch.id,
      boxId: batch.boxId,
      type: RISK_TYPES.TEMPERATURE_VIOLATION,
      severity,
      title: type === 'over' ? '温度超温告警' : '温度过低告警',
      description: type === 'over' 
        ? `温度超过上限 ${config.rules.temperature.max}°C，最高达到 ${period.maxTemp}°C，持续 ${duration} 分钟`
        : `温度低于下限 ${config.rules.temperature.min}°C，最低达到 ${period.minTemp}°C，持续 ${duration} 分钟`,
      details: {
        temperatureType: type,
        start: period.start.toISOString(),
        end: period.end.toISOString(),
        durationMinutes: duration,
        extremeTemp: type === 'over' ? period.maxTemp : period.minTemp,
        affectedLogs: period.logs.map(l => l.id)
      },
      occurredAt: period.start.toISOString()
    });

    return this.riskEventRepo.create(risk);
  }

  async checkDelayRule(batch) {
    const results = { risks: [], resolved: [] };
    
    const maxDelay = config.rules.time.maxDelayMinutes;
    const delayMinutes = batch.getDelayMinutes();

    if (batch.actualArrivalTime && delayMinutes > maxDelay) {
      let severity = SEVERITY_LEVELS.LOW;
      if (delayMinutes > 60) {
        severity = SEVERITY_LEVELS.HIGH;
      } else if (delayMinutes > 30) {
        severity = SEVERITY_LEVELS.MEDIUM;
      }

      const existingRisks = this.riskEventRepo.findByFields({
        batchId: batch.id,
        type: RISK_TYPES.DELAY,
        status: 'open'
      });

      if (existingRisks.length === 0) {
        const risk = new models.RiskEvent({
          batchId: batch.id,
          boxId: batch.boxId,
          type: RISK_TYPES.DELAY,
          severity,
          title: '运输延误告警',
          description: `批次 ${batch.batchNumber} 延误 ${delayMinutes} 分钟，计划到达时间 ${batch.scheduledArrivalTime}，实际到达时间 ${batch.actualArrivalTime}`,
          details: {
            scheduledArrival: batch.scheduledArrivalTime,
            actualArrival: batch.actualArrivalTime,
            delayMinutes,
            maxAllowedDelay: maxDelay
          },
          occurredAt: batch.actualArrivalTime
        });

        const savedRisk = this.riskEventRepo.create(risk);
        results.risks.push(savedRisk);

        batch.setRiskFlag('delay', true);
        this.batchRepo.update(batch);
      }
    }

    return results;
  }

  async checkSignatureRule(batch) {
    const results = { risks: [], resolved: [] };
    
    const forms = this.handoverFormRepo.findByBatchId(batch.id);
    
    forms.forEach(form => {
      if (!form.hasCompleteSignatures()) {
        const missing = form.getMissingSignatures();
        
        const existingRisks = this.riskEventRepo.findByFields({
          batchId: batch.id,
          handoverFormId: form.id,
          type: RISK_TYPES.SIGNATURE_MISSING,
          status: 'open'
        });

        if (existingRisks.length === 0) {
          const risk = new models.RiskEvent({
            batchId: batch.id,
            boxId: batch.boxId,
            handoverFormId: form.id,
            type: RISK_TYPES.SIGNATURE_MISSING,
            severity: SEVERITY_LEVELS.MEDIUM,
            title: '交接单签名缺失',
            description: `交接单 ${form.formNumber} 缺少 ${missing.join('、')} 签名`,
            details: {
              formNumber: form.formNumber,
              missingSignatures: missing,
              hasSenderSignature: form.isSenderSigned(),
              hasReceiverSignature: form.isReceiverSigned()
            },
            occurredAt: form.createdAt
          });

          const savedRisk = this.riskEventRepo.create(risk);
          results.risks.push(savedRisk);

          batch.setRiskFlag('signatureMissing', true);
          this.batchRepo.update(batch);
        }
      } else {
        const existingRisks = this.riskEventRepo.findByFields({
          batchId: batch.id,
          handoverFormId: form.id,
          type: RISK_TYPES.SIGNATURE_MISSING,
          status: 'open'
        });

        existingRisks.forEach(risk => {
          risk.updateStatus('resolved', '签名已补全');
          this.riskEventRepo.update(risk);
          results.resolved.push(risk);
        });
      }
    });

    return results;
  }

  async checkChainBreakRule(batch) {
    const results = { risks: [], resolved: [] };
    
    const forms = this.handoverFormRepo.findByBatchId(batch.id);
    
    if (forms.length === 0) {
      return results;
    }

    const sortedForms = forms.sort((a, b) => {
      const timeA = a.handoffTime || a.createdAt;
      const timeB = b.handoffTime || b.createdAt;
      return new Date(timeA) - new Date(timeB);
    });

    for (let i = 0; i < sortedForms.length - 1; i++) {
      const current = sortedForms[i];
      const next = sortedForms[i + 1];

      if (!current.receiverSignature || !next.senderSignature) {
        const existingRisks = this.riskEventRepo.findByFields({
          batchId: batch.id,
          type: RISK_TYPES.CHAIN_BREAK,
          status: 'open'
        });

        if (existingRisks.length === 0) {
          const risk = new models.RiskEvent({
            batchId: batch.id,
            boxId: batch.boxId,
            type: RISK_TYPES.CHAIN_BREAK,
            severity: SEVERITY_LEVELS.HIGH,
            title: '交接链路中断',
            description: `交接单 ${current.formNumber} 与 ${next.formNumber} 之间的链路不完整`,
            details: {
              currentForm: current.formNumber,
              nextForm: next.formNumber,
              currentHasReceiver: current.isReceiverSigned(),
              nextHasSender: next.isSenderSigned(),
              breakBetween: [current.formNumber, next.formNumber]
            },
            occurredAt: current.receiverSignatureTime || current.actualReceiveTime || current.createdAt
          });

          const savedRisk = this.riskEventRepo.create(risk);
          results.risks.push(savedRisk);

          batch.setRiskFlag('chainBreak', true);
          this.batchRepo.update(batch);
        }
      }
    }

    return results;
  }

  getRiskSummary(batchId = null) {
    const risks = batchId 
      ? this.riskEventRepo.findByBatchId(batchId)
      : this.riskEventRepo.findAll();

    const summary = {
      total: risks.length,
      byType: {
        temperature_violation: 0,
        delay: 0,
        signature_missing: 0,
        chain_break: 0,
        other: 0
      },
      bySeverity: {
        low: 0,
        medium: 0,
        high: 0,
        critical: 0
      },
      byStatus: {
        open: 0,
        in_review: 0,
        resolved: 0,
        dismissed: 0
      },
      risks: risks.map(r => r.toJSON())
    };

    risks.forEach(risk => {
      const type = risk.type;
      const severity = risk.severity;
      const status = risk.status;

      if (summary.byType.hasOwnProperty(type)) {
        summary.byType[type]++;
      } else {
        summary.byType.other++;
      }

      if (summary.bySeverity.hasOwnProperty(severity)) {
        summary.bySeverity[severity]++;
      }

      if (summary.byStatus.hasOwnProperty(status)) {
        summary.byStatus[status]++;
      }
    });

    return summary;
  }
}

module.exports = RuleEngine;
