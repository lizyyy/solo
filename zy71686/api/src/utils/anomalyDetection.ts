import type {
  DataImportWarning,
  GuaranteeContract,
  CreditLine,
  Customer,
  CounterGuarantee,
  RiskLevel
} from '../../../shared/types.js';
import { v4 as uuidv4 } from 'uuid';

export interface AnomalyDetectionResult {
  anomalies: DataImportWarning[];
  duplicateGuarantees: GuaranteeContract[][];
  dateAnomalies: { type: string; objects: any[]; message: string }[];
  missingCounterGuarantees: { guaranteeId: string; guaranteeAmount: number; coverageRatio: number; message: string }[];
  cycleGuarantees: { path: string[]; totalAmount: number; message: string }[];
}

export class AnomalyDetector {
  private batchId: string;
  private customers: Customer[] = [];
  private guarantees: GuaranteeContract[] = [];
  private credits: CreditLine[] = [];
  private counterGuarantees: CounterGuarantee[] = [];

  constructor(batchId: string) {
    this.batchId = batchId;
  }

  setData(
    customers: Customer[],
    guarantees: GuaranteeContract[],
    credits: CreditLine[],
    counterGuarantees: CounterGuarantee[]
  ): void {
    this.customers = customers;
    this.guarantees = guarantees;
    this.credits = credits;
    this.counterGuarantees = counterGuarantees;
  }

  detect(): AnomalyDetectionResult {
    const result: AnomalyDetectionResult = {
      anomalies: [],
      duplicateGuarantees: [],
      dateAnomalies: [],
      missingCounterGuarantees: [],
      cycleGuarantees: []
    };

    result.duplicateGuarantees = this.detectDuplicateGuarantees();
    result.duplicateGuarantees.forEach(group => {
      group.forEach(contract => {
        result.anomalies.push(this.createWarning({
          sourceFile: contract.sourceFile,
          rowNumber: contract.sourceRow,
          objectId: contract.id,
          objectName: contract.contractNumber,
          warningType: 'duplicate_guarantee',
          severity: 'warning',
          message: `发现重复担保合同：${contract.contractNumber}，担保人ID ${contract.guarantorId} -> 被担保人ID ${contract.guaranteedId}`,
          suggestion: '请确认哪一份是有效合同，删除或标记重复记录',
          rawData: { contract }
        }));
      });
    });

    result.dateAnomalies = this.detectDateAnomalies();
    result.dateAnomalies.forEach(anomaly => {
      anomaly.objects.forEach(obj => {
        const credit = obj as CreditLine;
        result.anomalies.push(this.createWarning({
          sourceFile: credit.sourceFile,
          rowNumber: credit.sourceRow,
          objectId: credit.id,
          objectName: credit.customerId,
          warningType: anomaly.type,
          severity: anomaly.type === 'date_out_of_range' ? 'error' : 'warning',
          message: anomaly.message,
          suggestion: anomaly.type === 'date_out_of_range' 
            ? '请检查授信余额日期是否正确，日期应在当前日期±90天范围内'
            : '同一客户多份授信余额日期跨度超过30天，请确认数据口径一致性',
          rawData: { credit }
        }));
      });
    });

    result.missingCounterGuarantees = this.detectMissingCounterGuarantees();
    result.missingCounterGuarantees.forEach(item => {
      const contract = this.guarantees.find(g => g.id === item.guaranteeId);
      if (contract) {
        result.anomalies.push(this.createWarning({
          sourceFile: contract.sourceFile,
          rowNumber: contract.sourceRow,
          objectId: contract.id,
          objectName: contract.contractNumber,
          warningType: 'missing_counter_guarantee',
          severity: item.coverageRatio < 0.3 ? 'error' : 'warning',
          message: `担保合同 ${contract.contractNumber} 反担保覆盖率为 ${(item.coverageRatio * 100).toFixed(1)}%，低于要求的50%`,
          suggestion: '请补充反担保材料或提高反担保金额，确保覆盖率达到50%以上',
          rawData: { contract, coverageRatio: item.coverageRatio }
        }));
      }
    });

    result.cycleGuarantees = this.detectCycleGuarantees();
    result.cycleGuarantees.forEach(cycle => {
      cycle.path.forEach((customerId, index) => {
        const customer = this.customers.find(c => c.id === customerId);
        if (customer) {
          result.anomalies.push(this.createWarning({
            sourceFile: customer.sourceFile,
            rowNumber: 0,
            objectId: customer.id,
            objectName: customer.name,
            warningType: 'cycle_guarantee',
            severity: 'error',
            message: `检测到循环担保：${cycle.path.map(id => {
              const c = this.customers.find(cust => cust.id === id);
              return c ? c.name : id;
            }).join(' -> ')}，总金额 ${cycle.totalAmount.toLocaleString()} 元`,
            suggestion: '循环担保存在风险传导隐患，请评估各主体实际还款能力，考虑逐步压降风险敞口',
            rawData: { cyclePath: cycle.path, totalAmount: cycle.totalAmount }
          }));
        }
      });
    });

    const fieldErrors = this.detectFieldErrors();
    result.anomalies.push(...fieldErrors);

    return result;
  }

  private detectDuplicateGuarantees(): GuaranteeContract[][] {
    const groups = new Map<string, GuaranteeContract[]>();
    
    for (const contract of this.guarantees) {
      const key = `${contract.guarantorId}-${contract.guaranteedId}-${contract.contractNumber || 'no-contract'}`;
      const existing = groups.get(key) || [];
      existing.push(contract);
      groups.set(key, existing);
    }

    const duplicates: GuaranteeContract[][] = [];
    for (const group of groups.values()) {
      if (group.length > 1) {
        duplicates.push(group);
      }
    }

    return duplicates;
  }

  private detectDateAnomalies(): { type: string; objects: CreditLine[]; message: string }[] {
    const anomalies: { type: string; objects: CreditLine[]; message: string }[] = [];
    const now = new Date();
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const ninetyDaysLater = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

    const outOfRange: CreditLine[] = [];
    for (const credit of this.credits) {
      const asOfDate = new Date(credit.asOfDate);
      if (asOfDate < ninetyDaysAgo || asOfDate > ninetyDaysLater) {
        outOfRange.push(credit);
      }
    }

    if (outOfRange.length > 0) {
      anomalies.push({
        type: 'date_out_of_range',
        objects: outOfRange,
        message: `发现 ${outOfRange.length} 条授信余额日期超出合理范围（±90天）`
      });
    }

    const customerDates = new Map<string, Date[]>();
    for (const credit of this.credits) {
      const dates = customerDates.get(credit.customerId) || [];
      dates.push(new Date(credit.asOfDate));
      customerDates.set(credit.customerId, dates);
    }

    const largeSpan: CreditLine[] = [];
    for (const [customerId, dates] of customerDates) {
      if (dates.length >= 2) {
        const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
        const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
        const spanDays = (maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24);
        
        if (spanDays > 30) {
          const customerCredits = this.credits.filter(c => c.customerId === customerId);
          largeSpan.push(...customerCredits);
        }
      }
    }

    if (largeSpan.length > 0) {
      anomalies.push({
        type: 'date_span_too_large',
        objects: largeSpan,
        message: `发现 ${largeSpan.length} 条授信余额日期跨度超过30天`
      });
    }

    return anomalies;
  }

  private detectMissingCounterGuarantees(): { guaranteeId: string; guaranteeAmount: number; coverageRatio: number; message: string }[] {
    const result: { guaranteeId: string; guaranteeAmount: number; coverageRatio: number; message: string }[] = [];

    const cgByGuarantee = new Map<string, CounterGuarantee[]>();
    for (const cg of this.counterGuarantees) {
      const existing = cgByGuarantee.get(cg.guaranteeId) || [];
      existing.push(cg);
      cgByGuarantee.set(cg.guaranteeId, existing);
    }

    for (const contract of this.guarantees) {
      if (contract.isCounterGuarantee) continue;

      const cgs = cgByGuarantee.get(contract.id) || [];
      const totalCGAmount = cgs.reduce((sum, cg) => sum + cg.amount, 0);
      const coverageRatio = contract.amount > 0 ? totalCGAmount / contract.amount : 0;

      if (coverageRatio < 0.5) {
        result.push({
          guaranteeId: contract.id,
          guaranteeAmount: contract.amount,
          coverageRatio,
          message: `担保金额 ${contract.amount.toLocaleString()} 元，反担保覆盖 ${(coverageRatio * 100).toFixed(1)}%`
        });
      }
    }

    return result;
  }

  private detectCycleGuarantees(): { path: string[]; totalAmount: number; message: string }[] {
    const adjacencyList = new Map<string, { target: string; amount: number }[]>();
    
    for (const contract of this.guarantees) {
      if (contract.isCounterGuarantee) continue;
      const existing = adjacencyList.get(contract.guarantorId) || [];
      existing.push({ target: contract.guaranteedId, amount: contract.amount });
      adjacencyList.set(contract.guarantorId, existing);
    }

    const cycles: { path: string[]; totalAmount: number; message: string }[] = [];
    const visited = new Set<string>();
    const path: string[] = [];
    const pathSet = new Set<string>();

    const dfs = (node: string, amountSoFar: number) => {
      path.push(node);
      pathSet.add(node);

      const neighbors = adjacencyList.get(node) || [];
      for (const neighbor of neighbors) {
        if (pathSet.has(neighbor.target)) {
          const cycleStartIndex = path.indexOf(neighbor.target);
          const cyclePath = path.slice(cycleStartIndex);
          
          if (cyclePath.length >= 2) {
            const cycleAmount = this.calculateCycleAmount(cyclePath);
            const cycleKey = cyclePath.sort().join('-');
            
            if (!cycles.some(c => c.path.sort().join('-') === cycleKey)) {
              const namedPath = cyclePath.map(id => {
                const customer = this.customers.find(c => c.id === id);
                return customer ? customer.name : id;
              });
              
              cycles.push({
                path: cyclePath,
                totalAmount: cycleAmount,
                message: `循环担保链：${namedPath.join(' -> ')}，涉及金额 ${cycleAmount.toLocaleString()} 元`
              });
            }
          }
        } else if (!visited.has(neighbor.target)) {
          dfs(neighbor.target, amountSoFar + neighbor.amount);
        }
      }

      path.pop();
      pathSet.delete(node);
    };

    for (const customer of this.customers) {
      if (!visited.has(customer.id)) {
        dfs(customer.id, 0);
      }
    }

    return cycles;
  }

  private calculateCycleAmount(path: string[]): number {
    let total = 0;
    for (let i = 0; i < path.length; i++) {
      const from = path[i];
      const to = path[(i + 1) % path.length];
      const contracts = this.guarantees.filter(
        g => g.guarantorId === from && g.guaranteedId === to && !g.isCounterGuarantee
      );
      total += contracts.reduce((sum, c) => sum + c.amount, 0);
    }
    return total;
  }

  private detectFieldErrors(): DataImportWarning[] {
    const warnings: DataImportWarning[] = [];

    for (const customer of this.customers) {
      if (!customer.name || customer.name.trim() === '') {
        warnings.push(this.createWarning({
          sourceFile: customer.sourceFile,
          rowNumber: 0,
          objectId: customer.id,
          objectName: customer.name,
          warningType: 'missing_customer_name',
          severity: 'error',
          message: '客户名称为空',
          suggestion: '请补充客户名称',
          rawData: { customer }
        }));
      }
      if (!customer.customerType) {
        warnings.push(this.createWarning({
          sourceFile: customer.sourceFile,
          rowNumber: 0,
          objectId: customer.id,
          objectName: customer.name,
          warningType: 'missing_customer_type',
          severity: 'warning',
          message: '客户类型未指定',
          suggestion: '请指定客户类型（企业/集团/个人）',
          rawData: { customer }
        }));
      }
    }

    for (const contract of this.guarantees) {
      if (contract.amount <= 0) {
        warnings.push(this.createWarning({
          sourceFile: contract.sourceFile,
          rowNumber: contract.sourceRow,
          objectId: contract.id,
          objectName: contract.contractNumber,
          warningType: 'invalid_guarantee_amount',
          severity: 'error',
          message: `担保金额 ${contract.amount} 不合法，必须大于0`,
          suggestion: '请修正担保金额',
          rawData: { contract }
        }));
      }
      if (contract.startDate && contract.endDate && new Date(contract.startDate) > new Date(contract.endDate)) {
        warnings.push(this.createWarning({
          sourceFile: contract.sourceFile,
          rowNumber: contract.sourceRow,
          objectId: contract.id,
          objectName: contract.contractNumber,
          warningType: 'invalid_date_range',
          severity: 'error',
          message: '担保开始日期晚于结束日期',
          suggestion: '请检查并修正日期范围',
          rawData: { contract }
        }));
      }
    }

    for (const credit of this.credits) {
      if (credit.totalAmount < 0) {
        warnings.push(this.createWarning({
          sourceFile: credit.sourceFile,
          rowNumber: credit.sourceRow,
          objectId: credit.id,
          objectName: credit.customerId,
          warningType: 'invalid_credit_amount',
          severity: 'error',
          message: `授信总额 ${credit.totalAmount} 不合法，不能为负数`,
          suggestion: '请修正授信总额',
          rawData: { credit }
        }));
      }
      if (credit.usedAmount > credit.totalAmount) {
        warnings.push(this.createWarning({
          sourceFile: credit.sourceFile,
          rowNumber: credit.sourceRow,
          objectId: credit.id,
          objectName: credit.customerId,
          warningType: 'used_exceeds_total',
          severity: 'error',
          message: `已用额度 ${credit.usedAmount} 超过授信总额 ${credit.totalAmount}`,
          suggestion: '请检查已用额度和授信总额',
          rawData: { credit }
        }));
      }
    }

    return warnings;
  }

  private createWarning(data: Omit<DataImportWarning, 'id' | 'batchId'>): DataImportWarning {
    return {
      id: uuidv4(),
      batchId: this.batchId,
      ...data
    };
  }
}

export function getRiskLevelFromScore(score: number): RiskLevel {
  if (score < 25) return 'low';
  if (score < 50) return 'medium';
  if (score < 75) return 'high';
  return 'critical';
}
