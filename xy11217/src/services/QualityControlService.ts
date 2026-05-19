import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
import { SampleRecordDao } from '../dao/SampleRecordDao';
import { TemperatureRecordDao } from '../dao/TemperatureRecordDao';
import { WasteRecordDao } from '../dao/WasteRecordDao';
import { RuleLogDao } from '../dao/RuleLogDao';
import { RecordStatus, RuleType, RuleExecutionResult, BatchSummary, RuleLog } from '../types';

export class QualityControlService {
  private sampleDao: SampleRecordDao;
  private tempDao: TemperatureRecordDao;
  private wasteDao: WasteRecordDao;
  private ruleLogDao: RuleLogDao;

  constructor() {
    this.sampleDao = new SampleRecordDao();
    this.tempDao = new TemperatureRecordDao();
    this.wasteDao = new WasteRecordDao();
    this.ruleLogDao = new RuleLogDao();
  }

  async executeExpiredSampleCheck(currentTime?: string): Promise<RuleExecutionResult> {
    const checkTime = currentTime || dayjs().toISOString();
    const pendingSamples = await this.sampleDao.findAll({ status: RecordStatus.PENDING });

    let matched = 0;
    let blocked = 0;
    let passed = 0;

    for (const sample of pendingSamples.data) {
      const isExpired = dayjs(sample.expireTime).isBefore(dayjs(checkTime));

      if (isExpired) {
        matched++;
        await this.sampleDao.updateStatus(sample.id, RecordStatus.QUARANTINED);
        await this.ruleLogDao.create({
          ruleType: RuleType.EXPIRED_SAMPLE,
          recordId: sample.id,
          recordType: 'sample',
          storeId: sample.storeId,
          batchNo: sample.batchNo,
          action: 'quarantine',
          reason: '留样已过期',
          details: `留样时间: ${sample.sampleTime}, 过期时间: ${sample.expireTime}, 菜品: ${sample.dishName}`,
          processedBy: 'system'
        });
        blocked++;
      } else {
        passed++;
      }
    }

    return {
      total: pendingSamples.data.length,
      matched,
      blocked,
      passed
    };
  }

  async executeTemperatureCheck(): Promise<RuleExecutionResult> {
    const anomalies = await this.tempDao.findTemperatureAnomalies();

    let blocked = 0;
    let passed = 0;

    for (const temp of anomalies) {
      await this.tempDao.updateStatus(temp.id, RecordStatus.REJECTED);
      await this.ruleLogDao.create({
        ruleType: RuleType.TEMPERATURE_GAP,
        recordId: temp.id,
        recordType: 'temperature',
        storeId: temp.storeId,
        action: 'block',
        reason: '温度超出范围',
        details: `当前温度: ${temp.temperature}℃, 允许范围: ${temp.minTemp}℃ - ${temp.maxTemp}℃, 冰箱: ${temp.fridgeName}`,
        processedBy: 'system'
      });
      blocked++;
    }

    const allTemps = await this.tempDao.findAll({ status: RecordStatus.PENDING });
    passed = allTemps.data.length - blocked;

    return {
      total: allTemps.data.length,
      matched: blocked,
      blocked,
      passed
    };
  }

  async getBatchSummary(batchNo: string): Promise<BatchSummary | null> {
    const samples = await this.sampleDao.findByBatchNo(batchNo);
    const wastes = await this.wasteDao.findByBatchNo(batchNo);

    if (samples.length === 0 && wastes.length === 0) {
      return null;
    }

    const storeIds = new Set<string>();
    const storeNames = new Set<string>();

    samples.forEach((s: { storeId: string; storeName: string }) => {
      storeIds.add(s.storeId);
      storeNames.add(s.storeName);
    });

    wastes.forEach((w: { storeId: string; storeName: string }) => {
      storeIds.add(w.storeId);
      storeNames.add(w.storeName);
    });

    const anomalyCount = samples.filter((s: { status: RecordStatus }) => s.status === RecordStatus.QUARANTINED || s.status === RecordStatus.REJECTED).length;

    return {
      batchNo,
      storeIds: Array.from(storeIds),
      storeNames: Array.from(storeNames),
      sampleCount: samples.length,
      wasteCount: wastes.length,
      anomalyCount
    };
  }

  async approveRecord(recordId: string, recordType: 'sample' | 'temperature' | 'waste', reviewer: string): Promise<boolean> {
    try {
      let success = false;

      switch (recordType) {
        case 'sample':
          success = await this.sampleDao.updateStatus(recordId, RecordStatus.APPROVED);
          break;
        case 'temperature':
          success = await this.tempDao.updateStatus(recordId, RecordStatus.APPROVED);
          break;
        case 'waste':
          success = await this.wasteDao.updateStatus(recordId, RecordStatus.APPROVED);
          break;
      }

      if (success) {
        await this.ruleLogDao.create({
          ruleType: RuleType.BATCH_SUMMARY,
          recordId,
          recordType,
          storeId: '',
          action: 'pass',
          reason: '人工审核通过',
          details: `审核人: ${reviewer}`,
          processedBy: reviewer
        });
      }

      return success;
    } catch {
      return false;
    }
  }

  async rejectRecord(recordId: string, recordType: 'sample' | 'temperature' | 'waste', reviewer: string, reason: string): Promise<boolean> {
    try {
      let success = false;

      switch (recordType) {
        case 'sample':
          success = await this.sampleDao.updateStatus(recordId, RecordStatus.REJECTED);
          break;
        case 'temperature':
          success = await this.tempDao.updateStatus(recordId, RecordStatus.REJECTED);
          break;
        case 'waste':
          success = await this.wasteDao.updateStatus(recordId, RecordStatus.REJECTED);
          break;
      }

      if (success) {
        await this.ruleLogDao.create({
          ruleType: RuleType.BATCH_SUMMARY,
          recordId,
          recordType,
          storeId: '',
          action: 'block',
          reason: `人工驳回: ${reason}`,
          details: `审核人: ${reviewer}, 原因: ${reason}`,
          processedBy: reviewer
        });
      }

      return success;
    } catch {
      return false;
    }
  }

  async getRuleLogsByRecord(recordId: string, recordType: 'sample' | 'temperature' | 'waste'): Promise<RuleLog[]> {
    return this.ruleLogDao.findByRecordId(recordId, recordType);
  }

  async getRuleLogsByStore(storeId: string): Promise<RuleLog[]> {
    return this.ruleLogDao.findByStoreId(storeId);
  }
}
