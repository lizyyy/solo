const store = require('../models/store');
const { Parser } = require('json2csv');

class UnifiedDataService {
  constructor() {
    this.sourceOfTruth = store;
  }

  getSampleList(runId, options = {}) {
    const samples = this.sourceOfTruth.getNegativeSamples(runId);
    let result = samples.map(s => this._normalizeSample(s));

    if (options.filter) {
      result = this._applyFilter(result, options.filter);
    }
    if (options.sortBy) {
      result = this._applySort(result, options.sortBy, options.sortOrder);
    }
    if (options.offset !== undefined || options.limit !== undefined) {
      const start = options.offset || 0;
      const end = options.limit ? start + options.limit : result.length;
      result = result.slice(start, end);
    }

    return {
      total: samples.length,
      filtered: this._applyFilter(samples.map(s => this._normalizeSample(s)), options.filter).length,
      data: result
    };
  }

  getSampleDetail(sampleId) {
    const sample = this.sourceOfTruth.getNegativeSampleById(sampleId);
    if (!sample) return null;
    return this._normalizeSample(sample, true);
  }

  getExportData(runId, format = 'json') {
    const samples = this.sourceOfTruth.getNegativeSamples(runId);
    const normalized = samples.map(s => this._normalizeForExport(s));

    if (format === 'csv') {
      const parser = new Parser();
      return parser.parse(normalized);
    }
    return normalized;
  }

  getApiResponse(runId, options = {}) {
    const listResult = this.getSampleList(runId, options);
    return {
      runId,
      pagination: {
        total: listResult.total,
        filtered: listResult.filtered,
        offset: options.offset || 0,
        limit: options.limit || listResult.total
      },
      data: listResult.data.map(s => this._normalizeForApi(s))
    };
  }

  _normalizeSample(sample, includeRaw = false) {
    const base = {
      id: sample.id,
      runId: sample.runId,
      originalRowNumber: sample.originalRowNumber,
      userId: sample.userId,
      itemId: sample.itemId,
      predictedProb: sample.predictedProb,
      calibratedProb: sample.calibratedProb,
      label: sample.label,
      featureStatus: sample.featureStatus,
      hasMissingFeatures: sample.hasMissingFeatures,
      missingFeatureList: sample.missingFeatureList || [],
      usedDefaultScore: sample.usedDefaultScore,
      status: sample.status,
      manualEditCount: (sample.manualEdits || []).length,
      recallCandidatesReviewed: sample.recallCandidatesReviewed,
      hasExplainableSummary: !!sample.explainableSummary,
      updatedAt: sample.updatedAt
    };
    if (includeRaw) {
      base.features = sample.features;
      base.manualEdits = sample.manualEdits || [];
      base.explainableSummary = sample.explainableSummary;
      base.rawData = sample.rawData;
      base.createdAt = sample.createdAt;
    }
    return base;
  }

  _normalizeForExport(sample) {
    return {
      原始行号: sample.originalRowNumber,
      用户ID: sample.userId,
      物品ID: sample.itemId,
      预测概率: sample.predictedProb,
      校准后概率: sample.calibratedProb,
      标签: sample.label,
      特征状态: this._translateFeatureStatus(sample.featureStatus),
      是否缺失特征: sample.hasMissingFeatures ? '是' : '否',
      缺失特征列表: (sample.missingFeatureList || []).join('; '),
      是否使用默认分: sample.usedDefaultScore ? '是' : '否',
      处理状态: this._translateStatus(sample.status),
      人工修改次数: (sample.manualEdits || []).length,
      召回候选已复核: sample.recallCandidatesReviewed ? '是' : '否',
      可解释摘要: sample.explainableSummary || '',
      创建时间: sample.createdAt,
      更新时间: sample.updatedAt
    };
  }

  _normalizeForApi(sample) {
    return {
      ...sample,
      statusText: this._translateStatus(sample.status),
      featureStatusText: this._translateFeatureStatus(sample.featureStatus)
    };
  }

  _translateStatus(status) {
    const map = {
      'imported': '已导入',
      'pending_review': '待负责人复核',
      'reviewed': '已复核',
      'recomputed': '已重算',
      'normal': '正常',
      'abnormal': '异常'
    };
    return map[status] || status;
  }

  _translateFeatureStatus(status) {
    const map = {
      'ok': '正常',
      'missing': '特征缺失'
    };
    return map[status] || status;
  }

  _applyFilter(samples, filter) {
    if (!filter) return samples;
    return samples.filter(s => {
      if (filter.status && s.status !== filter.status) return false;
      if (filter.hasMissingFeatures !== undefined && s.hasMissingFeatures !== filter.hasMissingFeatures) return false;
      if (filter.usedDefaultScore !== undefined && s.usedDefaultScore !== filter.usedDefaultScore) return false;
      if (filter.search) {
        const q = filter.search.toLowerCase();
        return s.userId.toLowerCase().includes(q) || s.itemId.toLowerCase().includes(q);
      }
      return true;
    });
  }

  _applySort(samples, sortBy, sortOrder = 'asc') {
    const order = sortOrder === 'desc' ? -1 : 1;
    return [...samples].sort((a, b) => {
      let va = a[sortBy];
      let vb = b[sortBy];
      if (typeof va === 'string') {
        return va.localeCompare(vb) * order;
      }
      return (va - vb) * order;
    });
  }

  verifyConsistency(runId) {
    const listData = this.getSampleList(runId).data;
    const apiData = this.getApiResponse(runId).data;
    const exportData = this.getExportData(runId);

    const issues = [];

    if (listData.length !== apiData.length) {
      issues.push(`列表数据(${listData.length})与API数据(${apiData.length})条数不一致`);
    }
    if (listData.length !== exportData.length) {
      issues.push(`列表数据(${listData.length})与导出数据(${exportData.length})条数不一致`);
    }

    listData.forEach((s, idx) => {
      const api = apiData[idx];
      const exp = exportData[idx];
      if (!api || api.id !== s.id) issues.push(`第${idx}条ID不匹配: 列表=${s.id}, API=${api?.id}`);
      if (s.hasMissingFeatures !== api.hasMissingFeatures) issues.push(`样本${s.id}: hasMissingFeatures 列表与API不一致`);
      if (s.usedDefaultScore !== api.usedDefaultScore) issues.push(`样本${s.id}: usedDefaultScore 列表与API不一致`);
      if (s.status !== api.status) issues.push(`样本${s.id}: status 列表与API不一致`);
    });

    return {
      consistent: issues.length === 0,
      issues,
      counts: {
        list: listData.length,
        api: apiData.length,
        export: exportData.length
      }
    };
  }
}

module.exports = new UnifiedDataService();
