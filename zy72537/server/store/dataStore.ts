import { v4 as uuidv4 } from 'uuid';
import { CheckRecord, KnowledgeBaseReference, FeedbackTicket, ConflictEvidence, SelfCheckResult, ExportDetail } from '../../shared/types';

class DataStore {
  private checkRecords: Map<string, CheckRecord> = new Map();
  private importedSampleIds: Set<string> = new Set();
  private exportSnapshot: Map<string, ExportDetail[]> = new Map();

  getAllRecords(): CheckRecord[] {
    return Array.from(this.checkRecords.values()).sort((a, b) => b.updatedAt - a.updatedAt);
  }

  getRecordById(id: string): CheckRecord | undefined {
    return this.checkRecords.get(id);
  }

  getRecordsBySampleId(sampleId: string): CheckRecord[] {
    return Array.from(this.checkRecords.values()).filter(r => r.sampleId === sampleId);
  }

  createRecord(record: Omit<CheckRecord, 'id' | 'createdAt' | 'updatedAt'>): CheckRecord {
    const id = uuidv4();
    const now = Date.now();
    const newRecord: CheckRecord = {
      ...record,
      id,
      createdAt: now,
      updatedAt: now,
    };
    this.checkRecords.set(id, newRecord);
    return newRecord;
  }

  updateRecord(id: string, updates: Partial<CheckRecord>): CheckRecord | undefined {
    const record = this.checkRecords.get(id);
    if (!record) return undefined;
    
    const updatedRecord = {
      ...record,
      ...updates,
      updatedAt: Date.now(),
    };
    this.checkRecords.set(id, updatedRecord);
    return updatedRecord;
  }

  markSampleImported(sampleId: string): void {
    this.importedSampleIds.add(sampleId);
  }

  isSampleImported(sampleId: string): boolean {
    return this.importedSampleIds.has(sampleId);
  }

  clearImportedSamples(): void {
    this.importedSampleIds.clear();
  }

  saveExportSnapshot(exportId: string, data: ExportDetail[]): void {
    this.exportSnapshot.set(exportId, data);
  }

  getExportSnapshot(exportId: string): ExportDetail[] | undefined {
    return this.exportSnapshot.get(exportId);
  }

  generateMockData(): void {
    const mockRecords: CheckRecord[] = [
      {
        id: uuidv4(),
        sampleId: 'SAMPLE-001',
        sampleName: '猫咪图片字幕检测',
        imageUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=cute%20cat%20sitting%20on%20sofa&image_size=square',
        caption: '一只可爱的猫咪坐在沙发上',
        status: 'conflict_detected',
        currentStep: 2,
        knowledgeReference: {
          id: uuidv4(),
          link: 'https://kb.example.com/ref/001',
          title: '图像字幕标准样本库 - 动物类',
          sampleId: 'SAMPLE-001',
          modelVersion: 'v2.1.0',
          conclusion: '字幕与图像一致',
          importedAt: Date.now() - 86400000,
          importedBy: 'system',
        },
        feedbackTicket: {
          id: uuidv4(),
          ticketNo: 'FB-2024-00123',
          title: '用户反馈字幕不准确',
          content: '用户反映图片中是橘猫，但字幕只说猫咪',
          sampleId: 'SAMPLE-001',
          modelVersion: 'v2.0.0',
          conclusion: '字幕与图像不一致',
          feedbackTime: Date.now() - 3600000,
          operator: 'user_feedback',
        },
        conflicts: [
          {
            id: uuidv4(),
            type: 'knowledge_vs_ticket',
            sampleId: 'SAMPLE-001',
            fieldName: 'conclusion',
            knowledgeValue: '字幕与图像一致',
            ticketValue: '字幕与图像不一致',
            description: '知识库结论与线上工单结论矛盾',
            detectedAt: Date.now() - 1800000,
          },
        ],
        selfCheckResults: [
          {
            type: 'duplicate_import',
            status: 'pass',
            message: '无重复导入记录',
            checkedAt: Date.now() - 7200000,
          },
          {
            type: 'model_version_changed',
            status: 'warning',
            message: '模型版本从 v2.0.0 更新为 v2.1.0，但样本编号未变化',
            details: {
              oldVersion: 'v2.0.0',
              newVersion: 'v2.1.0',
              sampleIdUnchanged: true,
            },
            checkedAt: Date.now() - 7200000,
          },
          {
            type: 'recalc_after_supplement',
            status: 'pass',
            message: '补录后已重新计算',
            checkedAt: Date.now() - 7200000,
          },
          {
            type: 'export_consistency',
            status: 'pending',
            message: '导出一致性待检查',
            checkedAt: Date.now() - 7200000,
          },
        ],
        modelVersionInfo: {
          version: 'v2.1.0',
          params: {
            threshold: 0.85,
            useBERT: true,
            imageFeatureExtractor: 'CLIP-ViT-L/14',
          },
          tradeOffReason: '提高阈值以减少误报，接受少量漏报风险；使用BERT增强语义理解',
          timestamp: Date.now() - 172800000,
        },
        calculationResult: {
          consistencyScore: 0.82,
          isConsistent: false,
          details: {
            textSimilarity: 0.78,
            imageTextMatch: 0.85,
            entityMatch: 0.82,
          },
        },
        createdAt: Date.now() - 172800000,
        updatedAt: Date.now() - 1800000,
        reviewHistory: [
          {
            action: '导入知识库引用',
            operator: 'system',
            timestamp: Date.now() - 86400000,
          },
          {
            action: '关联线上工单',
            operator: '小乔',
            timestamp: Date.now() - 3600000,
          },
          {
            action: '检测到冲突',
            operator: 'system',
            timestamp: Date.now() - 1800000,
          },
        ],
      },
      {
        id: uuidv4(),
        sampleId: 'SAMPLE-002',
        sampleName: '风景图片字幕检测',
        imageUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=beautiful%20mountain%20landscape%20with%20sunset&image_size=square',
        caption: '日落时分的山景',
        status: 'pending_review',
        currentStep: 1,
        knowledgeReference: {
          id: uuidv4(),
          link: 'https://kb.example.com/ref/002',
          title: '图像字幕标准样本库 - 风景类',
          sampleId: 'SAMPLE-002',
          modelVersion: 'v2.1.0',
          conclusion: '字幕与图像一致',
          importedAt: Date.now() - 43200000,
          importedBy: 'system',
        },
        conflicts: [],
        selfCheckResults: [
          {
            type: 'duplicate_import',
            status: 'pass',
            message: '无重复导入记录',
            checkedAt: Date.now() - 43200000,
          },
          {
            type: 'model_version_changed',
            status: 'pass',
            message: '模型版本与样本编号匹配',
            checkedAt: Date.now() - 43200000,
          },
          {
            type: 'recalc_after_supplement',
            status: 'pending',
            message: '待补录后重算',
            checkedAt: Date.now() - 43200000,
          },
          {
            type: 'export_consistency',
            status: 'pending',
            message: '导出一致性待检查',
            checkedAt: Date.now() - 43200000,
          },
        ],
        modelVersionInfo: {
          version: 'v2.1.0',
          params: {
            threshold: 0.85,
            useBERT: true,
            imageFeatureExtractor: 'CLIP-ViT-L/14',
          },
          tradeOffReason: '提高阈值以减少误报，接受少量漏报风险；使用BERT增强语义理解',
          timestamp: Date.now() - 172800000,
        },
        calculationResult: {
          consistencyScore: 0.92,
          isConsistent: true,
          details: {
            textSimilarity: 0.94,
            imageTextMatch: 0.90,
            entityMatch: 0.91,
          },
        },
        createdAt: Date.now() - 43200000,
        updatedAt: Date.now() - 43200000,
        reviewHistory: [
          {
            action: '导入知识库引用',
            operator: 'system',
            timestamp: Date.now() - 43200000,
          },
        ],
      },
      {
        id: uuidv4(),
        sampleId: 'SAMPLE-003',
        sampleName: '食物图片字幕检测',
        imageUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=delicious%20pizza%20on%20wooden%20table&image_size=square',
        caption: '木桌上的美味披萨',
        status: 'completed',
        currentStep: 3,
        knowledgeReference: {
          id: uuidv4(),
          link: 'https://kb.example.com/ref/003',
          title: '图像字幕标准样本库 - 食物类',
          sampleId: 'SAMPLE-003',
          modelVersion: 'v2.1.0',
          conclusion: '字幕与图像一致',
          importedAt: Date.now() - 259200000,
          importedBy: 'system',
        },
        feedbackTicket: {
          id: uuidv4(),
          ticketNo: 'FB-2024-00098',
          title: '用户确认字幕准确',
          content: '用户反馈字幕描述准确',
          sampleId: 'SAMPLE-003',
          modelVersion: 'v2.1.0',
          conclusion: '字幕与图像一致',
          feedbackTime: Date.now() - 172800000,
          operator: 'user_feedback',
        },
        conflicts: [],
        selfCheckResults: [
          {
            type: 'duplicate_import',
            status: 'pass',
            message: '无重复导入记录',
            checkedAt: Date.now() - 259200000,
          },
          {
            type: 'model_version_changed',
            status: 'pass',
            message: '模型版本与样本编号匹配',
            checkedAt: Date.now() - 259200000,
          },
          {
            type: 'recalc_after_supplement',
            status: 'pass',
            message: '补录后已重新计算',
            checkedAt: Date.now() - 172800000,
          },
          {
            type: 'export_consistency',
            status: 'pass',
            message: '导出数据与页面展示一致',
            checkedAt: Date.now() - 86400000,
          },
        ],
        modelVersionInfo: {
          version: 'v2.1.0',
          params: {
            threshold: 0.85,
            useBERT: true,
            imageFeatureExtractor: 'CLIP-ViT-L/14',
          },
          tradeOffReason: '提高阈值以减少误报，接受少量漏报风险；使用BERT增强语义理解',
          timestamp: Date.now() - 172800000,
        },
        calculationResult: {
          consistencyScore: 0.95,
          isConsistent: true,
          details: {
            textSimilarity: 0.96,
            imageTextMatch: 0.94,
            entityMatch: 0.95,
          },
        },
        createdAt: Date.now() - 259200000,
        updatedAt: Date.now() - 86400000,
        reviewHistory: [
          {
            action: '导入知识库引用',
            operator: 'system',
            timestamp: Date.now() - 259200000,
          },
          {
            action: '关联线上工单',
            operator: '小乔',
            timestamp: Date.now() - 172800000,
          },
          {
            action: '确认无冲突',
            operator: '小乔',
            timestamp: Date.now() - 129600000,
          },
          {
            action: '产品复盘页更新',
            operator: '产品经理',
            timestamp: Date.now() - 86400000,
          },
        ],
        productReviewUpdate: {
          updatedAt: Date.now() - 86400000,
          updatedBy: '产品经理',
          content: '该样本一致性良好，纳入正样本集',
        },
      },
    ];

    mockRecords.forEach(record => {
      this.checkRecords.set(record.id, record);
    });
  }
}

export const dataStore = new DataStore();
