import {
  SupervisorLedger,
  LedgerCheckpoint,
  Requisition,
  RequisitionItem
} from '../types';
import { store } from '../dataStore/inMemoryStore';
import { NotFoundError, ApprovalFlowError } from '../utils/errors';
import { LoggerContext, createLoggerContext } from '../utils/logger';
import { approvalFlowService } from './approvalFlowService';
import { intervalRuleService } from './intervalRuleService';
import { inventoryService } from './inventoryService';

interface GenerateLedgerRequest {
  requisitionId: string;
  operatorId: string;
  operatorName: string;
}

interface LedgerSummary {
  totalRecords: number;
  compliantCount: number;
  nonCompliantCount: number;
  violationCount: number;
  topViolations: { type: string; count: number }[];
}

class LedgerService {
  private logger: LoggerContext;

  constructor(logger?: LoggerContext) {
    this.logger = logger || createLoggerContext();
    this.logger.addContext('service', 'LedgerService');
  }

  async generateLedger(
    request: GenerateLedgerRequest
  ): Promise<SupervisorLedger> {
    this.logger.info('Generating supervisor ledger', {
      requisitionId: request.requisitionId
    });

    const requisition = store.requisitionsStore().findById(request.requisitionId);
    if (!requisition) {
      throw new NotFoundError('Requisition', request.requisitionId);
    }

    if (requisition.status !== 'FULFILLED' && requisition.status !== 'APPROVED') {
      throw new ApprovalFlowError('仅已完成或已审批的领用单可生成台账');
    }

    const items = store.requisitionItemsStore().findByRequisitionId(request.requisitionId);

    for (const item of items) {
      const ledger = await this.createLedgerForItem(requisition, item, request);
      this.logger.info('Ledger created for item', {
        ledgerId: ledger.id,
        itemId: item.id
      });
    }

    const ledgers = store.ledgersStore().findByRequisitionId(request.requisitionId);
    return ledgers[ledgers.length - 1];
  }

  private async createLedgerForItem(
    requisition: Requisition,
    item: RequisitionItem,
    request: GenerateLedgerRequest
  ): Promise<SupervisorLedger> {
    const checkpoints: LedgerCheckpoint[] = [];
    const now = new Date();

    checkpoints.push({
      name: '地块验证',
      passed: await this.verifyPlot(item),
      details: `地块: ${item.plotName}, 作物: ${item.cropName}`,
      checkedAt: now
    });

    const intervalCheck = await this.checkIntervalCompliance(item);
    checkpoints.push({
      name: '间隔期规则',
      passed: intervalCheck.passed,
      details: intervalCheck.details,
      checkedAt: now
    });

    const inventoryCheck = await this.checkInventoryCompliance(item);
    checkpoints.push({
      name: '库存检查',
      passed: inventoryCheck.passed,
      details: inventoryCheck.details,
      checkedAt: now
    });

    checkpoints.push({
      name: '审批流程',
      passed: requisition.status === 'FULFILLED' || requisition.status === 'APPROVED',
      details: `当前状态: ${requisition.status}, 当前阶段: ${requisition.currentStage}`,
      checkedAt: now
    });

    const violations = store.violationRecordsStore().findByRequisitionId(requisition.id)
      .filter(v => v.requisitionItemId === item.id)
      .map(v => v.description);

    const isCompliant = checkpoints.every(c => c.passed) && violations.length === 0;

    return store.ledgersStore().create({
      requisitionId: requisition.id,
      applicantName: requisition.applicantName,
      pesticideName: item.pesticideName,
      plotName: item.plotName,
      cropName: item.cropName,
      applicationDate: item.expectedApplicationDate,
      quantity: `${item.quantity} ${item.unit}`,
      isCompliant,
      violations,
      checkpoints
    });
  }

  private async verifyPlot(item: RequisitionItem): Promise<boolean> {
    const plot = store.plotsStore().findById(item.plotId);
    if (!plot) return false;
    return plot.status === 'PLANTED' && plot.currentCropId === item.cropId;
  }

  private async checkIntervalCompliance(
    item: RequisitionItem
  ): Promise<{ passed: boolean; details: string }> {
    const rule = await intervalRuleService.findActiveRule(item.pesticideId, item.cropId);
    
    if (!rule) {
      return {
        passed: false,
        details: '未找到该农药和作物组合的间隔期规则'
      };
    }

    const previousApps = await intervalRuleService.getPreviousApplications(
      item.plotId,
      item.expectedApplicationDate,
      item.id
    );

    const result = await intervalRuleService.checkItemCompliance(item, previousApps);

    if (result.passed) {
      return {
        passed: true,
        details: `安全间隔期: ${rule.safetyIntervalDays}天, 本季最大次数: ${rule.maxApplicationsPerSeason}次`
      };
    }

    return {
      passed: false,
      details: result.violations.map(v => v.description).join('; ')
    };
  }

  private async checkInventoryCompliance(
    item: RequisitionItem
  ): Promise<{ passed: boolean; details: string }> {
    const available = await inventoryService.getTotalQuantity(item.pesticideId);
    
    if (available >= item.quantity) {
      return {
        passed: true,
        details: `可用库存: ${available} ${item.unit}, 需求: ${item.quantity} ${item.unit}`
      };
    }

    return {
      passed: false,
      details: `库存不足: 可用${available} ${item.unit}, 需求${item.quantity} ${item.unit}`
    };
  }

  async getByRequisitionId(requisitionId: string): Promise<SupervisorLedger[]> {
    this.logger.debug('Getting ledgers by requisition id', { requisitionId });
    return store.ledgersStore().findByRequisitionId(requisitionId);
  }

  async getByDateRange(startDate: Date, endDate: Date): Promise<SupervisorLedger[]> {
    this.logger.debug('Getting ledgers by date range', { startDate, endDate });
    return store.ledgersStore().findByDateRange(startDate, endDate);
  }

  async getById(id: string): Promise<SupervisorLedger> {
    this.logger.debug('Getting ledger by id', { id });
    
    const ledger = store.ledgersStore().findById(id);
    if (!ledger) {
      throw new NotFoundError('SupervisorLedger', id);
    }
    
    return ledger;
  }

  async getAll(): Promise<SupervisorLedger[]> {
    this.logger.debug('Getting all ledgers');
    return store.ledgersStore().findAll();
  }

  async getSummary(dateRange?: { start: Date; end: Date }): Promise<LedgerSummary> {
    this.logger.debug('Getting ledger summary', { dateRange });

    let ledgers: SupervisorLedger[];
    if (dateRange) {
      ledgers = await this.getByDateRange(dateRange.start, dateRange.end);
    } else {
      ledgers = await this.getAll();
    }

    const compliantCount = ledgers.filter(l => l.isCompliant).length;
    const nonCompliantCount = ledgers.length - compliantCount;
    
    const violationTypeCounts: Record<string, number> = {};
    const allViolations = store.violationRecordsStore().findUnresolved();
    
    for (const violation of allViolations) {
      violationTypeCounts[violation.violationType] = 
        (violationTypeCounts[violation.violationType] || 0) + 1;
    }

    const topViolations = Object.entries(violationTypeCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([type, count]) => ({ type, count }));

    return {
      totalRecords: ledgers.length,
      compliantCount,
      nonCompliantCount,
      violationCount: allViolations.length,
      topViolations
    };
  }
}

export const ledgerService = new LedgerService();
export { GenerateLedgerRequest, LedgerSummary };
