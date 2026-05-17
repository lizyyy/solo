import { Transaction } from 'sequelize';
import {
  SamplingBatch,
  SamplingRule,
  OriginalRecord,
  ExceptionLog,
  sequelize,
} from '../models';
import { BatchStatus } from '../models/SamplingBatch';
import { SamplingMethod } from '../models/SamplingRule';
import { ExceptionType } from '../models/ExceptionLog';

export class SamplingService {
  async createBatch(data: {
    name: string;
    description?: string;
    ruleId: string;
    createdBy: string;
  }): Promise<SamplingBatch> {
    const rule = await SamplingRule.findByPk(data.ruleId);
    if (!rule) {
      throw new Error('抽样规则不存在');
    }

    const batchNo = `BATCH-${Date.now()}`;
    return SamplingBatch.create({
      ...data,
      batchNo,
      status: BatchStatus.DRAFT,
      totalRecords: 0,
      sampledCount: 0,
    });
  }

  async importRecords(
    batchId: string,
    records: Array<{
      originalId: string;
      dataSource: string;
      content: Record<string, any>;
      rawInput: string;
    }>
  ): Promise<{ success: number; failed: number }> {
    const batch = await SamplingBatch.findByPk(batchId);
    if (!batch) {
      throw new Error('抽样批次不存在');
    }

    let success = 0;
    let failed = 0;

    for (const record of records) {
      try {
        await OriginalRecord.create({
          batchId,
          originalId: record.originalId,
          dataSource: record.dataSource,
          content: record.content,
          rawInput: record.rawInput,
          isSampled: false,
        });
        success++;
      } catch (error) {
        failed++;
        await ExceptionLog.create({
          batchId,
          type: ExceptionType.DATA_IMPORT_ERROR,
          errorMessage: error instanceof Error ? error.message : '未知错误',
          rawInput: JSON.stringify(record),
        });
      }
    }

    await batch.update({ totalRecords: batch.totalRecords + success });

    return { success, failed };
  }

  async executeSampling(batchId: string): Promise<{ sampledCount: number }> {
    const t = await sequelize.transaction();

    try {
      const batch = await SamplingBatch.findByPk(batchId, {
        include: ['rule'],
        transaction: t,
      });

      if (!batch) {
        throw new Error('抽样批次不存在');
      }

      await batch.update({ status: BatchStatus.SAMPLING }, { transaction: t });

      const rule = batch.rule as SamplingRule;
      if (!rule) {
        throw new Error('抽样规则不存在');
      }

      const records = await OriginalRecord.findAll({
        where: { batchId, isSampled: false },
        transaction: t,
      });

      if (records.length === 0) {
        throw new Error('没有可抽样的记录');
      }

      let sampledRecords: OriginalRecord[] = [];

      switch (rule.method) {
        case SamplingMethod.RANDOM:
          sampledRecords = this.randomSampling(records, rule.sampleSize);
          break;
        case SamplingMethod.SYSTEMATIC:
          sampledRecords = this.systematicSampling(records, rule.sampleSize);
          break;
        case SamplingMethod.STRATIFIED:
          sampledRecords = this.stratifiedSampling(
            records,
            rule.sampleSize,
            rule.stratifyField
          );
          break;
        case SamplingMethod.RULE_BASED:
          sampledRecords = this.ruleBasedSampling(
            records,
            rule.sampleSize,
            rule.filterConditions
          );
          break;
        default:
          sampledRecords = this.randomSampling(records, rule.sampleSize);
      }

      const now = new Date();
      for (const record of sampledRecords) {
        await record.update(
          { isSampled: true, sampledAt: now, samplingWeight: 1 },
          { transaction: t }
        );
      }

      await batch.update(
        {
          status: BatchStatus.SAMPLING_COMPLETED,
          sampledCount: sampledRecords.length,
        },
        { transaction: t }
      );

      await t.commit();

      return { sampledCount: sampledRecords.length };
    } catch (error) {
      await t.rollback();
      await ExceptionLog.create({
        batchId,
        type: ExceptionType.SAMPLING_ERROR,
        errorMessage: error instanceof Error ? error.message : '未知错误',
        errorStack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  private randomSampling(
    records: OriginalRecord[],
    sampleSize: number
  ): OriginalRecord[] {
    const shuffled = [...records].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(sampleSize, records.length));
  }

  private systematicSampling(
    records: OriginalRecord[],
    sampleSize: number
  ): OriginalRecord[] {
    const interval = Math.floor(records.length / sampleSize);
    const result: OriginalRecord[] = [];
    for (let i = 0; i < records.length && result.length < sampleSize; i += interval) {
      result.push(records[i]);
    }
    return result;
  }

  private stratifiedSampling(
    records: OriginalRecord[],
    sampleSize: number,
    stratifyField?: string
  ): OriginalRecord[] {
    if (!stratifyField) {
      return this.randomSampling(records, sampleSize);
    }

    const groups = new Map<string, OriginalRecord[]>();
    for (const record of records) {
      const key = String(record.content[stratifyField] || 'unknown');
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(record);
    }

    const result: OriginalRecord[] = [];
    const perGroup = Math.ceil(sampleSize / groups.size);

    for (const group of groups.values()) {
      const sampled = this.randomSampling(group, perGroup);
      result.push(...sampled);
    }

    return result.slice(0, sampleSize);
  }

  private ruleBasedSampling(
    records: OriginalRecord[],
    sampleSize: number,
    filterConditions?: Record<string, any>
  ): OriginalRecord[] {
    if (!filterConditions) {
      return this.randomSampling(records, sampleSize);
    }

    let filtered = records;

    if (filterConditions.where) {
      filtered = records.filter((record) => {
        for (const [key, value] of Object.entries(filterConditions.where)) {
          if (record.content[key] !== value) {
            return false;
          }
        }
        return true;
      });
    }

    return this.randomSampling(filtered, sampleSize);
  }

  async getBatchById(batchId: string): Promise<SamplingBatch | null> {
    return SamplingBatch.findByPk(batchId, {
      include: ['rule'],
    });
  }

  async listBatches(params?: {
    status?: BatchStatus;
    page?: number;
    pageSize?: number;
  }): Promise<{ rows: SamplingBatch[]; count: number }> {
    const { status, page = 1, pageSize = 20 } = params || {};
    const where: any = {};
    if (status) {
      where.status = status;
    }

    return SamplingBatch.findAndCountAll({
      where,
      include: ['rule'],
      offset: (page - 1) * pageSize,
      limit: pageSize,
      order: [['createdAt', 'DESC']],
    });
  }
}
