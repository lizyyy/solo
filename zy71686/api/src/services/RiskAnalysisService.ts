import type {
  RiskAnalysisRequest,
  RiskAnalysisResponse,
  RiskAnalysisResult,
  GraphRequest,
  GraphResponse,
  DashboardStats,
  BatchTask
} from '../../../shared/types.js';
import { customerRepository } from '../repositories/CustomerRepository.js';
import { guaranteeRepository } from '../repositories/GuaranteeRepository.js';
import { creditRepository } from '../repositories/CreditRepository.js';
import { riskRepository } from '../repositories/RiskRepository.js';
import { versionRepository } from '../repositories/VersionRepository.js';
import { RiskCalculator, buildGraph } from '../utils/riskCalculation.js';
import { v4 as uuidv4 } from 'uuid';

const CALCULATION_VERSION = '1.0.0';

export class RiskAnalysisService {
  async analyze(request: RiskAnalysisRequest, operator: string): Promise<RiskAnalysisResponse> {
    const version = request.version || versionRepository.getActiveSnapshot()?.id;
    if (!version) {
      throw new Error('没有可用的数据版本，请先导入数据');
    }

    if (request.batch) {
      const taskId = uuidv4();
      const task = creditRepository.createBatchTask({
        type: 'recalculate',
        status: 'running',
        totalCount: 0,
        successCount: 0,
        failedCount: 0,
        progress: 0,
        startedAt: new Date().toISOString(),
        failedItems: []
      });

      setImmediate(async () => {
        try {
          await this.batchCalculate(version, task.id, operator);
        } catch (error) {
          console.error('Batch calculation error:', error);
          creditRepository.completeBatchTask(task.id, 'failed');
        }
      });

      return {
        results: [],
        taskId: task.id
      };
    }

    const customers = request.customerIds && request.customerIds.length > 0
      ? request.customerIds.map(id => customerRepository.findById(id, version)).filter(Boolean)
      : customerRepository.list(version);

    const guarantees = guaranteeRepository.findAllContracts(version);
    const credits = creditRepository.findAllCreditLines(version);
    const counterGuarantees = guaranteeRepository.findAllCounterGuarantees(version);
    const customerMap = new Map(customers.map(c => [c!.id, c!]));

    const results: RiskAnalysisResult[] = [];
    for (const customer of customers) {
      if (!customer) continue;

      const calculator = new RiskCalculator({
        customerId: customer.id,
        customers: customerMap,
        guarantees,
        credits,
        counterGuarantees,
        version,
        calculationVersion: CALCULATION_VERSION
      });

      const result = calculator.calculate();
      results.push(result);
    }

    riskRepository.deleteByVersion(version);
    riskRepository.bulkCreateResults(results);

    versionRepository.createOperationLog({
      operationType: 'risk_analysis',
      operator,
      description: `风险分析完成，共分析 ${results.length} 个客户`,
      affectedObjects: results.map(r => r.customerId).slice(0, 50),
      previousSnapshotId: version,
      canUndo: false
    });

    return { results };
  }

  private async batchCalculate(version: string, taskId: string, operator: string): Promise<void> {
    const customers = customerRepository.list(version);
    const guarantees = guaranteeRepository.findAllContracts(version);
    const credits = creditRepository.findAllCreditLines(version);
    const counterGuarantees = guaranteeRepository.findAllCounterGuarantees(version);
    const customerMap = new Map(customers.map(c => [c.id, c]));

    const totalCount = customers.length;
    creditRepository.updateBatchTaskProgress(taskId, 0, 0, 0, undefined);

    const results: RiskAnalysisResult[] = [];
    const failedItems: any[] = [];
    let successCount = 0;
    let failedCount = 0;

    for (let i = 0; i < customers.length; i++) {
      const customer = customers[i];
      try {
        const calculator = new RiskCalculator({
          customerId: customer.id,
          customers: customerMap,
          guarantees,
          credits,
          counterGuarantees,
          version,
          calculationVersion: CALCULATION_VERSION
        });

        const result = calculator.calculate();
        results.push(result);
        successCount++;
      } catch (error) {
        failedCount++;
        failedItems.push({
          index: i,
          objectId: customer.id,
          objectName: customer.name,
          errorMessage: error instanceof Error ? error.message : '计算失败',
          errorCode: 'CALCULATION_ERROR',
          rawData: { customerId: customer.id }
        });
      }

      if (i % 10 === 0 || i === customers.length - 1) {
        const progress = Math.round(((i + 1) / totalCount) * 100);
        creditRepository.updateBatchTaskProgress(taskId, progress, successCount, failedCount);
        await new Promise(resolve => setImmediate(resolve));
      }
    }

    riskRepository.deleteByVersion(version);
    if (results.length > 0) {
      riskRepository.bulkCreateResults(results);
    }

    const finalStatus = failedCount === 0 ? 'completed' : 
                       successCount > 0 ? 'partial' : 'failed';
    creditRepository.completeBatchTask(taskId, finalStatus, failedItems);

    versionRepository.createOperationLog({
      operationType: 'batch_risk_analysis',
      operator,
      description: `批量风险分析完成，成功 ${successCount}，失败 ${failedCount}`,
      affectedObjects: results.map(r => r.customerId).slice(0, 50),
      previousSnapshotId: version,
      canUndo: false
    });
  }

  getResults(version?: string, riskLevel?: string): RiskAnalysisResult[] {
    const activeVersion = version || versionRepository.getActiveSnapshot()?.id;
    if (!activeVersion) return [];

    if (riskLevel) {
      return riskRepository.findByRiskLevel(riskLevel, activeVersion);
    }
    return riskRepository.findAll(activeVersion);
  }

  getResultByCustomer(customerId: string, version?: string): RiskAnalysisResult | null {
    const activeVersion = version || versionRepository.getActiveSnapshot()?.id;
    if (!activeVersion) return null;

    return riskRepository.findByCustomerId(customerId, activeVersion);
  }

  getGraph(request: GraphRequest): GraphResponse {
    const version = request.version || versionRepository.getActiveSnapshot()?.id;
    if (!version) {
      return {
        nodes: [],
        edges: [],
        riskSummary: {
          totalCustomers: 0,
          totalGuarantees: 0,
          highRiskCount: 0,
          criticalRiskCount: 0,
          totalExposure: 0
        }
      };
    }

    const customers = customerRepository.list(version);
    const guarantees = guaranteeRepository.findAllContracts(version);
    const credits = creditRepository.findAllCreditLines(version);
    const riskResults = riskRepository.findAll(version);
    const riskMap = new Map(riskResults.map(r => [r.customerId, r]));

    const { nodes, edges } = buildGraph(
      customers,
      guarantees,
      credits,
      riskMap,
      {
        centerCustomerId: request.centerCustomerId,
        maxDepth: request.maxDepth,
        minAmount: request.minAmount,
        riskLevels: request.riskLevels
      }
    );

    const customerNodes = nodes.filter(n => n.type === 'customer');
    const guaranteeNodes = nodes.filter(n => n.type === 'guarantee');
    const highRiskCount = customerNodes.filter(n => n.riskLevel === 'high').length;
    const criticalRiskCount = customerNodes.filter(n => n.riskLevel === 'critical').length;

    const totalExposure = riskResults.reduce((sum, r) => sum + r.totalExposure, 0);

    return {
      nodes,
      edges,
      riskSummary: {
        totalCustomers: customerNodes.length,
        totalGuarantees: guaranteeNodes.length,
        highRiskCount,
        criticalRiskCount,
        totalExposure
      }
    };
  }

  getDashboardStats(): DashboardStats {
    const activeVersion = versionRepository.getActiveSnapshot();
    if (!activeVersion) {
      return {
        totalCustomers: 0,
        totalGuarantees: 0,
        totalExposure: 0,
        highRiskCount: 0,
        criticalRiskCount: 0,
        pendingTasks: 0,
        recentOperations: [],
        recentAnomalies: []
      };
    }

    const versionId = activeVersion.id;
    const riskCounts = riskRepository.countByRiskLevel(versionId);
    const totalExposure = creditRepository.getTotalExposure(versionId);
    const pendingTasks = creditRepository.listImportBatches(10).filter(
      b => b.status === 'processing' || b.status === 'pending'
    ).length;

    const recentOperations = versionRepository.listOperationLogs(10);
    const recentAnomalies = creditRepository.getRecentWarnings(20);

    return {
      totalCustomers: customerRepository.count(versionId),
      totalGuarantees: guaranteeRepository.countContracts(versionId),
      totalExposure,
      highRiskCount: riskCounts.high,
      criticalRiskCount: riskCounts.critical,
      pendingTasks,
      recentOperations,
      recentAnomalies
    };
  }

  getBatchTask(taskId: string): BatchTask | null {
    return creditRepository.getBatchTask(taskId);
  }
}

export const riskAnalysisService = new RiskAnalysisService();
