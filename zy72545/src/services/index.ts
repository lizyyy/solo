import { 
  promptVersionDao, 
  sampleDao, 
  knowledgeLinkDao, 
  reviewHistoryDao,
  modelVersionDao,
} from '../dao';
import { 
  PromptVersion, 
  ProcessParamSample, 
  ImportResult, 
  ReviewStatus,
  TraceStage,
} from '../types';
import { AppError, ERROR_CODES } from '../utils/errors';
import { 
  determineConfidenceLevel, 
  isMaskedByAverage, 
  determineInitialStatus,
  canTransitionStatus,
  checkBoundaryRules,
} from '../utils/boundaryRules';

interface ImportSampleInput {
  sampleKey: string;
  params: Record<string, number>;
  confidenceScore: number;
  metrics: { avgIndex?: number; rawValue?: number };
}

interface ImportPromptInput {
  version: string;
  importedBy: string;
  description?: string;
  samples: ImportSampleInput[];
}

export const importService = {
  importPromptVersion(input: ImportPromptInput): { version: PromptVersion; result: ImportResult } {
    const now = Date.now();
    const result: ImportResult = {
      created: 0,
      updated: 0,
      skipped: 0,
      warnings: [],
    };

    let promptVersion = promptVersionDao.findByVersion(input.version);
    
    if (promptVersion) {
      result.warnings.push(`提示词版本 ${input.version} 已存在，将更新样本数据（不会重复计数）`);
    } else {
      promptVersion = promptVersionDao.insert({
        version: input.version,
        importedAt: now,
        importedBy: input.importedBy,
        description: input.description,
      });
    }

    for (const sampleInput of input.samples) {
      const existingSample = sampleDao.findByPromptAndKey(promptVersion.id, sampleInput.sampleKey);
      const confidence = determineConfidenceLevel(sampleInput.confidenceScore);
      const masked = isMaskedByAverage({
        confidenceScore: sampleInput.confidenceScore,
        metrics: sampleInput.metrics,
      });
      const initialStatus = determineInitialStatus({
        confidenceScore: sampleInput.confidenceScore,
        isMaskedByAvg: masked,
      });

      if (existingSample) {
        const hasChanges = 
          JSON.stringify(existingSample.params) !== JSON.stringify(sampleInput.params) ||
          existingSample.confidenceScore !== sampleInput.confidenceScore ||
          JSON.stringify(existingSample.metrics) !== JSON.stringify(sampleInput.metrics);

        if (hasChanges) {
          const updatedSample: ProcessParamSample = {
            ...existingSample,
            params: sampleInput.params,
            confidence,
            confidenceScore: sampleInput.confidenceScore,
            metrics: sampleInput.metrics,
            isMaskedByAvg: masked,
            status: initialStatus,
            updatedAt: now,
          };
          sampleDao.update(updatedSample);

          reviewHistoryDao.insert({
            sampleId: existingSample.id,
            stage: 'prompt_import',
            action: 'sample_updated',
            operator: input.importedBy,
            remark: '重新导入提示词版本，样本数据已更新',
            timestamp: now,
          });
          result.updated++;
        } else {
          result.skipped++;
        }
      } else {
        const newSample = sampleDao.insert({
          promptVersionId: promptVersion.id,
          sampleKey: sampleInput.sampleKey,
          params: sampleInput.params,
          confidence,
          confidenceScore: sampleInput.confidenceScore,
          metrics: sampleInput.metrics,
          isMaskedByAvg: masked,
          status: initialStatus,
          createdAt: now,
          updatedAt: now,
        });

        reviewHistoryDao.insert({
          sampleId: newSample.id,
          stage: 'prompt_import',
          action: 'sample_created',
          operator: input.importedBy,
          remark: '提示词版本导入时创建样本',
          timestamp: now,
        });

        const boundaryCheck = checkBoundaryRules(newSample);
        if (boundaryCheck.warnings.length > 0) {
          result.warnings.push(`样本 ${sampleInput.sampleKey}: ${boundaryCheck.warnings.join('; ')}`);
        }
        result.created++;
      }
    }

    return { version: promptVersion, result };
  },
};

interface AddKnowledgeLinkInput {
  promptVersionId: string;
  url: string;
  title: string;
  addedBy: string;
}

interface UpdateRemarkInput {
  sampleId: string;
  newRemark: string;
  operator: string;
  role: string;
}

interface UpdateStatusInput {
  sampleId: string;
  newStatus: ReviewStatus;
  operator: string;
  role: string;
  remark?: string;
}

export const reviewService = {
  addKnowledgeLink(input: AddKnowledgeLinkInput) {
    const promptVersion = promptVersionDao.findById(input.promptVersionId);
    if (!promptVersion) {
      throw new AppError(ERROR_CODES.PROMPT_VERSION_NOT_FOUND, `Prompt version ${input.promptVersionId} not found`);
    }

    const link = knowledgeLinkDao.insert({
      promptVersionId: input.promptVersionId,
      url: input.url,
      title: input.title,
      addedAt: Date.now(),
      addedBy: input.addedBy,
    });

    const samples = sampleDao.findByPromptVersion(input.promptVersionId);
    const now = Date.now();
    for (const sample of samples) {
      reviewHistoryDao.insert({
        sampleId: sample.id,
        stage: 'knowledge_link',
        action: 'knowledge_link_added',
        operator: input.addedBy,
        remark: `知识库链接已补充: ${input.title}`,
        timestamp: now,
      });
    }

    return link;
  },

  updateRemark(input: UpdateRemarkInput) {
    const sample = sampleDao.findById(input.sampleId);
    if (!sample) {
      throw new AppError(ERROR_CODES.SAMPLE_NOT_FOUND, `Sample ${input.sampleId} not found`);
    }

    const now = Date.now();

    reviewHistoryDao.insert({
      sampleId: sample.id,
      stage: 'manual_confirm',
      action: 'remark_updated',
      operator: input.operator,
      oldRemark: undefined,
      newRemark: input.newRemark,
      remark: '备注已修改',
      timestamp: now,
    });

    return { success: true };
  },

  updateStatus(input: UpdateStatusInput) {
    const sample = sampleDao.findById(input.sampleId);
    if (!sample) {
      throw new AppError(ERROR_CODES.SAMPLE_NOT_FOUND, `Sample ${input.sampleId} not found`);
    }

    if (!canTransitionStatus(sample.status, input.newStatus, input.role)) {
      throw new AppError(
        ERROR_CODES.INVALID_STATUS_TRANSITION,
        `Cannot transition from ${sample.status} to ${input.newStatus} for role ${input.role}`
      );
    }

    if (sample.isMaskedByAvg && sample.confidence === 'low' && input.newStatus === 'confirmed' && input.role !== 'knowledge_editor') {
      throw new AppError(
        ERROR_CODES.LOW_CONFIDENCE_MASKED,
        'Low confidence sample masked by average cannot be confirmed by non-knowledge-editor'
      );
    }

    const updatedSample: ProcessParamSample = {
      ...sample,
      status: input.newStatus,
      updatedAt: Date.now(),
    };
    sampleDao.update(updatedSample);

    reviewHistoryDao.insert({
      sampleId: sample.id,
      stage: 'manual_confirm',
      action: `status_${sample.status}_to_${input.newStatus}`,
      operator: input.operator,
      remark: input.remark,
      timestamp: Date.now(),
    });

    return updatedSample;
  },

  getSampleWithTrace(sampleId: string) {
    const sample = sampleDao.findById(sampleId);
    if (!sample) {
      throw new AppError(ERROR_CODES.SAMPLE_NOT_FOUND, `Sample ${sampleId} not found`);
    }

    const history = reviewHistoryDao.findBySample(sampleId);
    const promptVersion = promptVersionDao.findById(sample.promptVersionId);
    const knowledgeLinks = knowledgeLinkDao.findByPromptVersion(sample.promptVersionId);
    const boundaryCheck = checkBoundaryRules(sample);

    return {
      sample,
      history,
      promptVersion,
      knowledgeLinks,
      boundaryCheck,
    };
  },

  getTraceByPromptVersion(promptVersionId: string) {
    const promptVersion = promptVersionDao.findById(promptVersionId);
    if (!promptVersion) {
      throw new AppError(ERROR_CODES.PROMPT_VERSION_NOT_FOUND, `Prompt version ${promptVersionId} not found`);
    }

    const samples = sampleDao.findByPromptVersion(promptVersionId);
    const knowledgeLinks = knowledgeLinkDao.findByPromptVersion(promptVersionId);
    const history = reviewHistoryDao.findByPromptVersion(promptVersionId);

    const trace = {
      promptImport: {
        stage: 'prompt_import' as TraceStage,
        operator: promptVersion.importedBy,
        timestamp: promptVersion.importedAt,
        sampleCount: samples.length,
        history: history.filter(h => h.stage === 'prompt_import'),
      },
      knowledgeLink: {
        stage: 'knowledge_link' as TraceStage,
        links: knowledgeLinks,
        history: history.filter(h => h.stage === 'knowledge_link'),
      },
      manualConfirm: {
        stage: 'manual_confirm' as TraceStage,
        history: history.filter(h => h.stage === 'manual_confirm'),
      },
    };

    return {
      promptVersion,
      samples,
      trace,
    };
  },

  getChartDataWithLinks(promptVersionId: string) {
    const data = this.getTraceByPromptVersion(promptVersionId);
    
    const chartData = data.samples.map(sample => ({
      sampleKey: sample.sampleKey,
      confidenceScore: sample.confidenceScore,
      isMaskedByAvg: sample.isMaskedByAvg,
      status: sample.status,
      params: sample.params,
      drilldownLinks: {
        promptVersion: `/prompt-versions/${data.promptVersion.id}`,
        knowledgeLinks: data.trace.knowledgeLink.links.map(l => l.url),
        sampleDetail: `/samples/${sample.id}`,
      },
    }));

    return {
      promptVersion: data.promptVersion,
      chartData,
      summary: {
        total: data.samples.length,
        highConfidence: data.samples.filter(s => s.confidence === 'high').length,
        mediumConfidence: data.samples.filter(s => s.confidence === 'medium').length,
        lowConfidence: data.samples.filter(s => s.confidence === 'low').length,
        maskedByAvg: data.samples.filter(s => s.isMaskedByAvg).length,
        needsKnowledgeReview: data.samples.filter(s => s.status === 'needs_knowledge_review').length,
      },
    };
  },

  listPromptVersions() {
    return promptVersionDao.listAll();
  },

  getSamplesByStatus(status: ReviewStatus) {
    return sampleDao.findByStatus(status);
  },
};

interface CompareModelInput {
  version: string;
  promptVersionId: string;
  comparedBy: string;
  changeSummary?: string;
}

export const modelService = {
  compareModelVersion(input: CompareModelInput) {
    const promptVersion = promptVersionDao.findById(input.promptVersionId);
    if (!promptVersion) {
      throw new AppError(ERROR_CODES.PROMPT_VERSION_NOT_FOUND, `Prompt version ${input.promptVersionId} not found`);
    }

    const modelVersion = modelVersionDao.insert({
      version: input.version,
      promptVersionId: input.promptVersionId,
      comparedAt: Date.now(),
      comparedBy: input.comparedBy,
      changeSummary: input.changeSummary,
    });

    const samples = sampleDao.findByPromptVersion(input.promptVersionId);
    const now = Date.now();
    for (const sample of samples) {
      reviewHistoryDao.insert({
        sampleId: sample.id,
        stage: 'manual_confirm',
        action: 'model_compared',
        operator: input.comparedBy,
        remark: `模型版本对比: ${input.version}`,
        timestamp: now,
      });
    }

    return modelVersion;
  },

  getModelVersions(promptVersionId: string) {
    return modelVersionDao.findByPromptVersion(promptVersionId);
  },
};
