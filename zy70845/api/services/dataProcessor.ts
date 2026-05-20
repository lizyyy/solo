import Papa from 'papaparse';
import {
  NormalItem,
  PendingItem,
  FailedItem,
  ImportResponse,
  DataSource,
  ValidationContext,
} from '../../shared/types';
import {
  applyRules,
  getItemStatus,
  normalizeItem,
  getStandardSku,
  skuAliasMap,
} from './ruleEngine';

const batchStore = new Map<string, ImportResponse>();

export function checkBatchExists(batchId: string): boolean {
  return batchStore.has(batchId);
}

export function getBatchResult(batchId: string): ImportResponse | undefined {
  return batchStore.get(batchId);
}

export function saveBatchResult(batchId: string, result: ImportResponse): void {
  batchStore.set(batchId, result);
}

export function getAllBatches(): ImportResponse[] {
  return Array.from(batchStore.values());
}

export function parseCsv(content: string): any[] {
  const result = Papa.parse(content, {
    header: true,
    skipEmptyLines: true,
    encoding: 'UTF-8',
  });
  return result.data;
}

export function parseJson(content: string): any[] {
  const data = JSON.parse(content);
  return Array.isArray(data) ? data : [data];
}

export function processData(
  items: any[],
  source: DataSource,
  storeId: string,
  batchId: string
): {
  normal: NormalItem[];
  pending: PendingItem[];
  failed: FailedItem[];
} {
  const normal: NormalItem[] = [];
  const pending: PendingItem[] = [];
  const failed: FailedItem[] = [];

  const context: ValidationContext = {
    storeId,
    skuAliases: skuAliasMap,
    expectedSales: {
      SKU001: 100,
      SKU002: 80,
      SKU003: 150,
      SKU004: 60,
      SKU005: 40,
    },
  };

  let itemIndex = 0;

  for (const item of items) {
    const normalized = normalizeItem(item, source, storeId);
    const validationResults = applyRules(item, context);
    const status = getItemStatus(validationResults);

    const itemId = `${batchId}-${source}-${itemIndex++}`;

    if (status === 'normal') {
      const standardSku = getStandardSku(normalized.skuName);
      normal.push({
        id: itemId,
        sku: standardSku?.sku || normalized.sku,
        skuName: standardSku?.name || normalized.skuName,
        quantity: normalized.quantity,
        source: normalized.source,
        storeId: normalized.storeId,
      });
    } else if (status === 'pending') {
      const warnings = validationResults.filter((r) => !r.passed);
      const standardSku = getStandardSku(normalized.skuName);
      pending.push({
        id: itemId,
        sku: standardSku?.sku || normalized.sku,
        skuName: standardSku?.name || normalized.skuName,
        quantity: normalized.quantity,
        source: normalized.source as DataSource,
        reason: warnings.map((w) => w.message).join('; '),
        confidence: Math.min(
          ...warnings.map((w) => w.confidence || 0.5)
        ),
        storeId: normalized.storeId,
      });
    } else {
      const errors = validationResults.filter(
        (r) => !r.passed && r.confidence === 0
      );
      failed.push({
        id: itemId,
        originalData: normalized.originalData,
        source: normalized.source as DataSource,
        errorType: errors[0]?.errorType || 'UNKNOWN_ERROR',
        errorMessage: errors.map((e) => e.message).join('; '),
        suggestion: errors[0]?.suggestion || '请检查数据格式是否正确',
        storeId: normalized.storeId,
      });
    }
  }

  return { normal, pending, failed };
}

export function mergeResults(
  inventoryResult: ReturnType<typeof processData>,
  salesResult: ReturnType<typeof processData>,
  replenishmentResult: ReturnType<typeof processData>
): ReturnType<typeof processData> {
  return {
    normal: [
      ...inventoryResult.normal,
      ...salesResult.normal,
      ...replenishmentResult.normal,
    ],
    pending: [
      ...inventoryResult.pending,
      ...salesResult.pending,
      ...replenishmentResult.pending,
    ],
    failed: [
      ...inventoryResult.failed,
      ...salesResult.failed,
      ...replenishmentResult.failed,
    ],
  };
}
