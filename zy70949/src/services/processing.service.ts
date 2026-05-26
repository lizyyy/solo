import {
  AddItemRecord,
  ProcessingResult,
  BatchProcessingResponse,
  RecordStatus,
  ParsedData,
} from '../types';
import { RulesEngine, RuleContext } from './rules.service';
import { IdempotencyService } from './idempotency.service';
import { v4 as uuidv4 } from 'uuid';

export class ProcessingService {
  private rulesEngine: RulesEngine;
  private idempotencyService: IdempotencyService;

  constructor() {
    this.rulesEngine = new RulesEngine();
    this.idempotencyService = new IdempotencyService();
  }

  async processBatch(
    parsedData: ParsedData,
    filePaths?: string[]
  ): Promise<BatchProcessingResponse> {
    const batchId = uuidv4();
    const warnings: string[] = [];

    if (filePaths && filePaths.length > 0) {
      const duplicateCheck = this.idempotencyService.checkFilesAlreadyProcessed(filePaths);
      if (duplicateCheck.isDuplicate) {
        warnings.push(
          `检测到重复提交：本批文件已于 ${duplicateCheck.existingBatch?.processedAt} 处理（批次ID: ${duplicateCheck.existingBatch?.batchId}），共 ${duplicateCheck.existingBatch?.recordCount} 条记录。本次处理将跳过以避免重复生效。`
        );
        return this.buildEmptyResponse(batchId, warnings);
      }
    }

    this.rulesEngine.reset();

    const context: RuleContext = {
      packages: parsedData.packages,
      unitAgreements: parsedData.unitAgreements,
      coupons: parsedData.coupons,
      allRecords: parsedData.addItems,
    };

    const normalItems: ProcessingResult[] = [];
    const pendingItems: ProcessingResult[] = [];
    const failedItems: ProcessingResult[] = [];

    let totalAmount = 0;
    let couponDiscount = 0;
    let unitSettlementAmount = 0;

    parsedData.addItems.forEach(record => {
      const checkResult = this.rulesEngine.checkRecord(record, context);
      
      const result: ProcessingResult = {
        status: checkResult.status,
        record,
        originalFields: { ...record },
        appliedRules: checkResult.appliedRules,
        suggestions: checkResult.suggestions,
        readableExplanation: checkResult.readableExplanation,
      };

      switch (checkResult.status) {
        case 'normal':
          normalItems.push(result);
          const amount = record.itemPrice * record.quantity;
          totalAmount += amount;
          if (record.couponCode) {
            couponDiscount += record.couponAmount || 0;
          }
          if (record.unitCode) {
            unitSettlementAmount += amount;
          }
          break;
        case 'pending':
          pendingItems.push(result);
          break;
        case 'failed':
          failedItems.push(result);
          break;
      }
    });

    if (filePaths && filePaths.length > 0) {
      const fileHashes = filePaths.map(fp => this.idempotencyService.generateFileHash(fp));
      this.idempotencyService.markBatchAsProcessed(batchId, fileHashes, parsedData.addItems.length);
    }

    const allResults = [...normalItems, ...pendingItems, ...failedItems];
    const ruleViolations = this.rulesEngine.generateRuleViolations(allResults);

    return {
      batchId,
      totalCount: parsedData.addItems.length,
      normalItems,
      pendingItems,
      failedItems,
      summary: {
        normalCount: normalItems.length,
        pendingCount: pendingItems.length,
        failedCount: failedItems.length,
        totalAmount,
        couponDiscount,
        unitSettlementAmount,
      },
      warnings,
      ruleViolations,
    };
  }

  private buildEmptyResponse(batchId: string, warnings: string[]): BatchProcessingResponse {
    return {
      batchId,
      totalCount: 0,
      normalItems: [],
      pendingItems: [],
      failedItems: [],
      summary: {
        normalCount: 0,
        pendingCount: 0,
        failedCount: 0,
        totalAmount: 0,
        couponDiscount: 0,
        unitSettlementAmount: 0,
      },
      warnings,
      ruleViolations: [],
    };
  }
}
