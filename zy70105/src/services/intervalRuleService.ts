import { IntervalRule, RequisitionItem, ViolationRecord, ViolationType, ViolationSeverity, BaseEntity } from '../types';
import { store } from '../dataStore/inMemoryStore';
import { BusinessRuleViolationError, NotFoundError } from '../utils/errors';
import { LoggerContext, createLoggerContext } from '../utils/logger';
import { addDays, differenceInDays, isAfter, isBefore } from 'date-fns';

interface IntervalCheckResult {
  passed: boolean;
  rule: IntervalRule | null;
  violations: ViolationDetail[];
  warnings: ViolationDetail[];
}

interface ViolationDetail {
  type: ViolationType;
  severity: ViolationSeverity;
  description: string;
  ruleId?: string;
  details: Record<string, unknown>;
}

class IntervalRuleService {
  private logger: LoggerContext;

  constructor(logger?: LoggerContext) {
    this.logger = logger || createLoggerContext();
    this.logger.addContext('service', 'IntervalRuleService');
  }

  async findActiveRule(pesticideId: string, cropId: string): Promise<IntervalRule | null> {
    this.logger.debug('Finding active interval rule', { pesticideId, cropId });
    
    const rules = store.intervalRulesStore().findByPesticideAndCrop(pesticideId, cropId);
    
    if (rules.length === 0) {
      this.logger.warn('No active interval rule found', { pesticideId, cropId });
      return null;
    }
    
    this.logger.info('Found active interval rule', { ruleId: rules[0].id });
    return rules[0];
  }

  async checkItemCompliance(
    item: RequisitionItem,
    previousApplications: RequisitionItem[]
  ): Promise<IntervalCheckResult> {
    this.logger.addContext('requisitionItemId', item.id);
    this.logger.info('Checking item compliance', { 
      pesticideId: item.pesticideId, 
      cropId: item.cropId,
      plotId: item.plotId
    });

    const result: IntervalCheckResult = {
      passed: true,
      rule: null,
      violations: [],
      warnings: []
    };

    const rule = await this.findActiveRule(item.pesticideId, item.cropId);
    result.rule = rule;

    if (!rule) {
      result.violations.push({
        type: 'OTHER',
        severity: 'MEDIUM',
        description: '未找到该农药和作物组合的安全间隔期规则',
        details: { pesticideId: item.pesticideId, cropId: item.cropId }
      });
      result.passed = false;
      return result;
    }

    await this.checkSafetyInterval(item, rule, previousApplications, result);
    await this.checkMaxApplications(item, rule, previousApplications, result);
    await this.checkApplicationInterval(item, rule, previousApplications, result);

    if (result.violations.length > 0) {
      result.passed = false;
      this.logger.warn('Item compliance check failed', { 
        violationCount: result.violations.length 
      });
    } else {
      this.logger.info('Item compliance check passed');
    }

    return result;
  }

  private async checkSafetyInterval(
    item: RequisitionItem,
    rule: IntervalRule,
    previousApplications: RequisitionItem[],
    result: IntervalCheckResult
  ): Promise<void> {
    const plot = store.plotsStore().findById(item.plotId);
    if (!plot || !plot.expectedHarvestDate) {
      this.logger.warn('Plot or expected harvest date not found for safety interval check', {
        plotId: item.plotId
      });
      return;
    }

    const applicationDate = item.expectedApplicationDate;
    const harvestDate = plot.expectedHarvestDate;
    const daysToHarvest = differenceInDays(harvestDate, applicationDate);

    this.logger.debug('Checking safety interval', {
      applicationDate: applicationDate.toISOString(),
      harvestDate: harvestDate.toISOString(),
      daysToHarvest,
      requiredInterval: rule.safetyIntervalDays
    });

    if (daysToHarvest < rule.safetyIntervalDays) {
      result.violations.push({
        type: 'SAFETY_INTERVAL_VIOLATION',
        severity: 'HIGH',
        description: `安全间隔期违规：预计喷施日期距离收获日期仅${daysToHarvest}天，不足规定的${rule.safetyIntervalDays}天`,
        ruleId: rule.id,
        details: {
          applicationDate: applicationDate.toISOString(),
          harvestDate: harvestDate.toISOString(),
          actualDays: daysToHarvest,
          requiredDays: rule.safetyIntervalDays
        }
      });
    }
  }

  private async checkMaxApplications(
    item: RequisitionItem,
    rule: IntervalRule,
    previousApplications: RequisitionItem[],
    result: IntervalCheckResult
  ): Promise<void> {
    const plot = store.plotsStore().findById(item.plotId);
    if (!plot || !plot.plantingDate) {
      this.logger.warn('Plot or planting date not found for max applications check', {
        plotId: item.plotId
      });
      return;
    }

    const seasonApplications = previousApplications.filter(prev => {
      return prev.pesticideId === item.pesticideId &&
             prev.expectedApplicationDate >= plot.plantingDate! &&
             prev.expectedApplicationDate <= item.expectedApplicationDate;
    });

    const totalApplications = seasonApplications.length + 1;

    this.logger.debug('Checking max applications', {
      seasonApplications: seasonApplications.length,
      newApplication: 1,
      totalApplications,
      maxAllowed: rule.maxApplicationsPerSeason
    });

    if (totalApplications > rule.maxApplicationsPerSeason) {
      result.violations.push({
        type: 'MAX_APPLICATIONS_EXCEEDED',
        severity: 'HIGH',
        description: `本季度施用次数超限：已施用${seasonApplications.length}次，加上本次共${totalApplications}次，超过最大次数${rule.maxApplicationsPerSeason}次`,
        ruleId: rule.id,
        details: {
          previousCount: seasonApplications.length,
          newCount: 1,
          total: totalApplications,
          maxAllowed: rule.maxApplicationsPerSeason
        }
      });
    }
  }

  private async checkApplicationInterval(
    item: RequisitionItem,
    rule: IntervalRule,
    previousApplications: RequisitionItem[],
    result: IntervalCheckResult
  ): Promise<void> {
    const samePesticideApplications = previousApplications
      .filter(prev => prev.pesticideId === item.pesticideId)
      .sort((a, b) => b.expectedApplicationDate.getTime() - a.expectedApplicationDate.getTime());

    if (samePesticideApplications.length === 0) {
      this.logger.debug('No previous applications of the same pesticide');
      return;
    }

    const lastApplication = samePesticideApplications[0];
    const daysSinceLastApplication = differenceInDays(
      item.expectedApplicationDate,
      lastApplication.expectedApplicationDate
    );

    this.logger.debug('Checking application interval', {
      lastApplicationDate: lastApplication.expectedApplicationDate.toISOString(),
      currentApplicationDate: item.expectedApplicationDate.toISOString(),
      daysSinceLastApplication,
      minInterval: rule.minIntervalBetweenApplications
    });

    if (daysSinceLastApplication < rule.minIntervalBetweenApplications) {
      result.violations.push({
        type: 'SAFETY_INTERVAL_VIOLATION',
        severity: 'MEDIUM',
        description: `施用间隔违规：距离上次施用仅${daysSinceLastApplication}天，少于规定的${rule.minIntervalBetweenApplications}天`,
        ruleId: rule.id,
        details: {
          lastApplicationDate: lastApplication.expectedApplicationDate.toISOString(),
          currentApplicationDate: item.expectedApplicationDate.toISOString(),
          actualDays: daysSinceLastApplication,
          minRequiredDays: rule.minIntervalBetweenApplications
        }
      });
    }
  }

  async getPreviousApplications(
    plotId: string,
    beforeDate: Date,
    excludeItemId?: string
  ): Promise<RequisitionItem[]> {
    this.logger.debug('Getting previous applications', { plotId, beforeDate: beforeDate.toISOString(), excludeItemId });

    const sixMonthsAgo = addDays(beforeDate, -180);
    
    const allItems = store.requisitionItemsStore().findByPlotIdAndDate(
      plotId,
      sixMonthsAgo,
      beforeDate
    );

    return allItems.filter(item => item.id !== excludeItemId);
  }

  async createViolationRecords(
    requisitionId: string,
    item: RequisitionItem,
    violations: ViolationDetail[]
  ): Promise<ViolationRecord[]> {
    this.logger.info('Creating violation records', { 
      requisitionId, 
      itemId: item.id, 
      count: violations.length 
    });

    const records: ViolationRecord[] = [];

    for (const violation of violations) {
      const record = store.violationRecordsStore().create({
        requisitionId,
        requisitionItemId: item.id,
        violationType: violation.type,
        severity: violation.severity,
        description: violation.description,
        ruleId: violation.ruleId || null,
        isResolved: false,
        resolvedAt: null,
        resolvedById: null
      });
      records.push(record);
    }

    return records;
  }

  async createRule(data: Omit<IntervalRule, keyof BaseEntity> & { isActive?: boolean }): Promise<IntervalRule> {
    this.logger.info('Creating interval rule', { ...data });
    
    const existingRules = store.intervalRulesStore().findByPesticideAndCrop(data.pesticideId, data.cropId);
    if (existingRules.length > 0) {
      throw new BusinessRuleViolationError(
        '该农药和作物组合的间隔期规则已存在',
        { pesticideId: data.pesticideId, cropId: data.cropId }
      );
    }

    const rule = store.intervalRulesStore().create({
      pesticideId: data.pesticideId,
      cropId: data.cropId,
      safetyIntervalDays: data.safetyIntervalDays,
      maxApplicationsPerSeason: data.maxApplicationsPerSeason,
      minIntervalBetweenApplications: data.minIntervalBetweenApplications,
      maxDosagePerApplication: data.maxDosagePerApplication,
      isActive: data.isActive ?? true
    });

    this.logger.info('Interval rule created', { ruleId: rule.id });
    return rule;
  }

  async updateRule(id: string, updates: Partial<IntervalRule>): Promise<IntervalRule> {
    this.logger.info('Updating interval rule', { id, updates });

    const existing = store.intervalRulesStore().findById(id);
    if (!existing) {
      throw new NotFoundError('IntervalRule', id);
    }

    const updated = store.intervalRulesStore().update(id, updates);
    if (!updated) {
      throw new NotFoundError('IntervalRule', id);
    }

    this.logger.info('Interval rule updated', { id });
    return updated;
  }
}

export const intervalRuleService = new IntervalRuleService();
export { IntervalCheckResult, ViolationDetail };
