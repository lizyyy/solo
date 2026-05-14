import { v4 as uuidv4 } from 'uuid';
import { LiveSample, Batch, SampleSource, SampleStatus, ManualAdjustment } from './types';

export class DataStore {
  private samples: Map<string, LiveSample> = new Map();
  private batches: Map<string, Batch> = new Map();
  private adjustments: Map<string, ManualAdjustment> = new Map();

  constructor() {
    this.initializeSampleData();
  }

  private initializeSampleData() {
    const batchId1 = 'BATCH-2026-0515-001';
    const batchId2 = 'BATCH-2026-0515-002';

    this.batches.set(batchId1, {
      id: batchId1,
      name: '跨天直播样品表 - 美妆专场',
      createdAt: '2026-05-14T08:00:00Z',
      createdBy: 'system',
      totalSamples: 8,
      status: 'active'
    });

    this.batches.set(batchId2, {
      id: batchId2,
      name: '618预热直播样品',
      createdAt: '2026-05-15T09:00:00Z',
      createdBy: 'admin',
      totalSamples: 5,
      status: 'active'
    });

    const samples: LiveSample[] = [
      {
        id: uuidv4(),
        batchId: batchId1,
        productId: 'SKU-MZ-001',
        productName: '莹润保湿精华液 30ml',
        source: SampleSource.SYSTEM,
        status: SampleStatus.PENDING,
        liveDate: '2026-05-15',
        streamerId: 'STR-001',
        streamerName: '美妆达人小美',
        createdAt: '2026-05-14T08:00:00Z',
        updatedAt: '2026-05-14T08:00:00Z'
      },
      {
        id: uuidv4(),
        batchId: batchId1,
        productId: 'SKU-MZ-002',
        productName: '丝绒哑光口红 #正红色',
        source: SampleSource.SYSTEM,
        status: SampleStatus.PENDING,
        liveDate: '2026-05-15',
        streamerId: 'STR-001',
        streamerName: '美妆达人小美',
        createdAt: '2026-05-14T08:00:01Z',
        updatedAt: '2026-05-14T08:00:01Z'
      },
      {
        id: uuidv4(),
        batchId: batchId1,
        productId: 'SKU-MZ-003',
        productName: '多效修护面霜 50g',
        source: SampleSource.API,
        status: SampleStatus.PENDING,
        liveDate: '2026-05-15',
        streamerId: 'STR-001',
        streamerName: '美妆达人小美',
        createdAt: '2026-05-14T08:00:02Z',
        updatedAt: '2026-05-14T08:00:02Z'
      },
      {
        id: uuidv4(),
        batchId: batchId1,
        productId: 'SKU-MZ-004',
        productName: '清透防晒乳 SPF50+',
        source: SampleSource.MANUAL,
        status: SampleStatus.PENDING,
        liveDate: '2026-05-15',
        streamerId: 'STR-001',
        streamerName: '美妆达人小美',
        createdAt: '2026-05-14T08:30:00Z',
        updatedAt: '2026-05-14T08:30:00Z'
      },
      {
        id: uuidv4(),
        batchId: batchId1,
        productId: 'SKU-MZ-005',
        productName: '无瑕持妆粉底液 自然色',
        source: SampleSource.MIXED,
        status: SampleStatus.PENDING,
        liveDate: '2026-05-15',
        streamerId: 'STR-001',
        streamerName: '美妆达人小美',
        createdAt: '2026-05-14T09:00:00Z',
        updatedAt: '2026-05-14T09:00:00Z'
      },
      {
        id: uuidv4(),
        batchId: batchId1,
        productId: 'SKU-MZ-006',
        productName: '持久定妆散粉',
        source: SampleSource.SYSTEM,
        status: SampleStatus.COMPLETED,
        liveDate: '2026-05-14',
        streamerId: 'STR-001',
        streamerName: '美妆达人小美',
        createdAt: '2026-05-14T08:00:00Z',
        updatedAt: '2026-05-14T22:00:00Z'
      },
      {
        id: uuidv4(),
        batchId: batchId1,
        productId: 'SKU-MZ-007',
        productName: '浓密纤长睫毛膏',
        source: SampleSource.SYSTEM,
        status: SampleStatus.PROCESSING,
        liveDate: '2026-05-15',
        streamerId: 'STR-001',
        streamerName: '美妆达人小美',
        createdAt: '2026-05-14T08:00:00Z',
        updatedAt: '2026-05-15T10:00:00Z'
      },
      {
        id: uuidv4(),
        batchId: batchId1,
        productId: 'SKU-MZ-008',
        productName: '珠光眼影盘 大地色系',
        source: SampleSource.API,
        status: SampleStatus.FAILED,
        liveDate: '2026-05-15',
        streamerId: 'STR-001',
        streamerName: '美妆达人小美',
        createdAt: '2026-05-14T08:00:00Z',
        updatedAt: '2026-05-15T09:30:00Z',
        remarks: '库存同步失败，需要人工核实'
      },
      {
        id: uuidv4(),
        batchId: batchId2,
        productId: 'SKU-FS-001',
        productName: '无线蓝牙耳机 Pro',
        source: SampleSource.MANUAL,
        status: SampleStatus.MANUALLY_ADJUSTED,
        liveDate: '2026-06-01',
        streamerId: 'STR-002',
        streamerName: '数码评测老王',
        createdAt: '2026-05-15T09:00:00Z',
        updatedAt: '2026-05-15T14:30:00Z',
        adjustedBy: '运营-张经理',
        adjustedAt: '2026-05-15T14:30:00Z',
        adjustmentReason: '供应商临时变更型号，原样品无法使用，紧急更换为升级款'
      },
      {
        id: uuidv4(),
        batchId: batchId2,
        productId: 'SKU-FS-002',
        productName: '智能运动手环',
        source: SampleSource.SYSTEM,
        status: SampleStatus.PENDING,
        liveDate: '2026-06-01',
        streamerId: 'STR-002',
        streamerName: '数码评测老王',
        createdAt: '2026-05-15T09:00:00Z',
        updatedAt: '2026-05-15T09:00:00Z'
      },
      {
        id: uuidv4(),
        batchId: batchId2,
        productId: 'SKU-FS-003',
        productName: '快充移动电源 20000mAh',
        source: SampleSource.SYSTEM,
        status: SampleStatus.PENDING,
        liveDate: '2026-06-01',
        streamerId: 'STR-002',
        streamerName: '数码评测老王',
        createdAt: '2026-05-15T09:00:00Z',
        updatedAt: '2026-05-15T09:00:00Z'
      },
      {
        id: uuidv4(),
        batchId: batchId2,
        productId: 'SKU-FS-004',
        productName: '降噪头戴式耳机',
        source: SampleSource.MIXED,
        status: SampleStatus.NEEDS_REVIEW,
        liveDate: '2026-06-01',
        streamerId: 'STR-002',
        streamerName: '数码评测老王',
        createdAt: '2026-05-15T09:00:00Z',
        updatedAt: '2026-05-15T11:00:00Z',
        remarks: '来源标注不明确，系统与人工记录冲突'
      },
      {
        id: uuidv4(),
        batchId: batchId2,
        productId: 'SKU-FS-005',
        productName: '磁吸无线充电器',
        source: SampleSource.SYSTEM,
        status: SampleStatus.PENDING,
        liveDate: '2026-06-01',
        streamerId: 'STR-002',
        streamerName: '数码评测老王',
        createdAt: '2026-05-15T09:00:00Z',
        updatedAt: '2026-05-15T09:00:00Z'
      }
    ];

    samples.forEach(sample => this.samples.set(sample.id, sample));

    const adjustmentId = uuidv4();
    this.adjustments.set(adjustmentId, {
      id: adjustmentId,
      sampleId: samples[8].id,
      batchId: batchId2,
      adjustedBy: '运营-张经理',
      adjustedAt: '2026-05-15T14:30:00Z',
      oldStatus: SampleStatus.CANCELLED,
      newStatus: SampleStatus.MANUALLY_ADJUSTED,
      reason: '供应商临时变更型号',
      remarks: '原样品SKU-FS-001因供应商质量问题召回，紧急更换为升级款样品，已重新安排质检'
    });
  }

  getBatchById(batchId: string): Batch | undefined {
    return this.batches.get(batchId);
  }

  getSamplesByBatch(batchId: string): LiveSample[] {
    return Array.from(this.samples.values()).filter(s => s.batchId === batchId);
  }

  getSampleById(sampleId: string): LiveSample | undefined {
    return this.samples.get(sampleId);
  }

  updateSample(sampleId: string, updates: Partial<LiveSample>): LiveSample | null {
    const sample = this.samples.get(sampleId);
    if (!sample) return null;
    const updated = { ...sample, ...updates, updatedAt: new Date().toISOString() };
    this.samples.set(sampleId, updated);
    return updated;
  }

  addManualAdjustment(adjustment: Omit<ManualAdjustment, 'id'>): ManualAdjustment {
    const id = uuidv4();
    const newAdjustment = { ...adjustment, id };
    this.adjustments.set(id, newAdjustment);
    return newAdjustment;
  }

  getAdjustmentsByBatch(batchId: string): ManualAdjustment[] {
    return Array.from(this.adjustments.values()).filter(a => a.batchId === batchId);
  }

  getAllBatches(): Batch[] {
    return Array.from(this.batches.values());
  }

  getAllSamples(): LiveSample[] {
    return Array.from(this.samples.values());
  }

  getAllAdjustments(): ManualAdjustment[] {
    return Array.from(this.adjustments.values());
  }
}

export const dataStore = new DataStore();