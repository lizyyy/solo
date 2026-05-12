const Experiment = require('../models/Experiment');
const ShadowRequest = require('../models/ShadowRequest');

class ExperimentManager {
  constructor() {
    this.experiments = new Map();
    this.requestHistory = new Map();
    this.processors = new Map();
  }

  registerProcessor(name, processor) {
    this.processors.set(name, processor);
  }

  getProcessor(name) {
    return this.processors.get(name);
  }

  registerExperiment(config) {
    if (!config.name || !config.endpoint) {
      throw new Error('实验名称和 endpoint 是必填项');
    }

    if (config.samplingRate === undefined || config.samplingRate < 0 || config.samplingRate > 1) {
      throw new Error('采样比例必须在 0 到 1 之间');
    }

    if (!config.oldProcessor || !config.newProcessor) {
      throw new Error('必须指定旧处理器和新处理器');
    }

    if (!this.processors.has(config.oldProcessor)) {
      throw new Error(`旧处理器不存在: ${config.oldProcessor}`);
    }

    if (!this.processors.has(config.newProcessor)) {
      throw new Error(`新处理器不存在: ${config.newProcessor}`);
    }

    const experiment = new Experiment(config);
    this.experiments.set(experiment.id, experiment);
    return experiment;
  }

  getExperiment(id) {
    return this.experiments.get(id);
  }

  getExperiments() {
    return Array.from(this.experiments.values()).map(exp => exp.getStats());
  }

  hasProcessedRequest(requestId) {
    return this.requestHistory.has(requestId);
  }

  markRequestProcessed(requestId, shadowRequest) {
    this.requestHistory.set(requestId, shadowRequest);
  }

  getProcessedRequest(requestId) {
    return this.requestHistory.get(requestId);
  }

  async processShadowRequest(experimentId, requestData) {
    const experiment = this.getExperiment(experimentId);
    if (!experiment) {
      return {
        success: false,
        error: '实验不存在',
        code: 'EXPERIMENT_NOT_FOUND'
      };
    }

    if (!experiment.isActive()) {
      return {
        success: false,
        error: `实验已暂停: ${experiment.pausedReason}`,
        code: 'EXPERIMENT_PAUSED',
        pausedReason: experiment.pausedReason
      };
    }

    if (!requestData.requestId) {
      return {
        success: false,
        error: '缺少请求标识',
        code: 'MISSING_REQUEST_ID'
      };
    }

    if (this.hasProcessedRequest(requestData.requestId)) {
      const existingRequest = this.getProcessedRequest(requestData.requestId);
      return {
        success: false,
        error: '请求已处理过',
        code: 'DUPLICATE_REQUEST',
        existingRequestId: existingRequest.id
      };
    }

    if (!experiment.shouldSample()) {
      experiment.totalRequests++;
      return {
        success: true,
        sampled: false,
        message: '请求未被采样'
      };
    }

    experiment.totalRequests++;

    const oldProcessor = this.getProcessor(experiment.oldProcessor);
    const newProcessor = this.getProcessor(experiment.newProcessor);

    let oldResponse, newResponse;
    try {
      oldResponse = await oldProcessor(requestData);
    } catch (err) {
      return {
        success: false,
        error: `旧处理器执行失败: ${err.message}`,
        code: 'OLD_PROCESSOR_ERROR'
      };
    }

    try {
      newResponse = await newProcessor(requestData);
    } catch (err) {
      return {
        success: false,
        error: `新处理器执行失败: ${err.message}`,
        code: 'NEW_PROCESSOR_ERROR'
      };
    }

    const comparisonResult = this.compareResponses(
      experiment,
      oldResponse,
      newResponse
    );

    const shadowRequest = new ShadowRequest({
      experimentId: experiment.id,
      endpoint: experiment.endpoint,
      tenantId: requestData.tenantId,
      requestId: requestData.requestId,
      requestBody: requestData.body,
      requestHeaders: requestData.headers,
      oldResponse,
      newResponse,
      differences: comparisonResult.differences,
      hasSideEffectRisk: comparisonResult.hasSideEffectRisk,
      sideEffectRisk: comparisonResult.sideEffectRisk
    });

    this.markRequestProcessed(requestData.requestId, shadowRequest);

    if (comparisonResult.hasSideEffectRisk) {
      experiment.addSideEffectRisk(comparisonResult.sideEffectRisk);
    } else if (comparisonResult.differences.length > 0) {
      experiment.addDifference({
        requestId: shadowRequest.id,
        differences: comparisonResult.differences,
        timestamp: new Date()
      });
    } else {
      experiment.matchedRequests++;
    }

    return {
      success: true,
      sampled: true,
      shadowRequestId: shadowRequest.id,
      hasDifferences: shadowRequest.hasDifferences(),
      hasSideEffectRisk: shadowRequest.hasSideEffectRisk,
      differences: comparisonResult.differences,
      sideEffectRisk: comparisonResult.sideEffectRisk
    };
  }

  compareResponses(experiment, oldResponse, newResponse) {
    const differences = [];
    let sideEffectRisk = null;

    const ignoreField = (path) => {
      return experiment.ignoredFields.some(field => {
        if (field.includes('*')) {
          const regex = new RegExp('^' + field.replace(/\*/g, '.*') + '$');
          return regex.test(path);
        }
        return path === field || path.startsWith(field + '.');
      });
    };

    const isWhitelisted = (path) => {
      return experiment.whitelistedDifferences.some(field => {
        if (field.includes('*')) {
          const regex = new RegExp('^' + field.replace(/\*/g, '.*') + '$');
          return regex.test(path);
        }
        return path === field;
      });
    };

    const isSideEffectField = (path) => {
      return experiment.sideEffectFields.some(field => {
        if (field.includes('*')) {
          const regex = new RegExp('^' + field.replace(/\*/g, '.*') + '$');
          return regex.test(path);
        }
        return path === field || path.startsWith(field + '.');
      });
    };

    const compare = (obj1, obj2, path = '') => {
      const keys1 = Object.keys(obj1 || {});
      const keys2 = Object.keys(obj2 || {});
      const allKeys = new Set([...keys1, ...keys2]);

      for (const key of allKeys) {
        const currentPath = path ? `${path}.${key}` : key;

        if (ignoreField(currentPath)) continue;

        if (!(key in obj1)) {
          if (isSideEffectField(currentPath)) {
            sideEffectRisk = {
              field: currentPath,
              type: 'missing_in_old',
              oldValue: undefined,
              newValue: obj2[key]
            };
            return;
          }
          if (!isWhitelisted(currentPath)) {
            differences.push({
              field: currentPath,
              type: 'missing_in_old',
              oldValue: undefined,
              newValue: obj2[key]
            });
          }
          continue;
        }

        if (!(key in obj2)) {
          if (isSideEffectField(currentPath)) {
            sideEffectRisk = {
              field: currentPath,
              type: 'missing_in_new',
              oldValue: obj1[key],
              newValue: undefined
            };
            return;
          }
          if (!isWhitelisted(currentPath)) {
            differences.push({
              field: currentPath,
              type: 'missing_in_new',
              oldValue: obj1[key],
              newValue: undefined
            });
          }
          continue;
        }

        const val1 = obj1[key];
        const val2 = obj2[key];

        if (typeof val1 === 'object' && typeof val2 === 'object' && val1 !== null && val2 !== null) {
          compare(val1, val2, currentPath);
        } else if (val1 !== val2) {
          if (isSideEffectField(currentPath)) {
            sideEffectRisk = {
              field: currentPath,
              type: 'value_changed',
              oldValue: val1,
              newValue: val2
            };
            return;
          }
          if (!isWhitelisted(currentPath)) {
            differences.push({
              field: currentPath,
              type: 'value_changed',
              oldValue: val1,
              newValue: val2
            });
          }
        }
      }
    };

    compare(oldResponse, newResponse);

    return {
      differences,
      hasSideEffectRisk: sideEffectRisk !== null,
      sideEffectRisk
    };
  }

  generateReport(experimentId) {
    const experiment = this.getExperiment(experimentId);
    if (!experiment) {
      return null;
    }

    const byEndpoint = {};
    const byTenant = {};
    const byDifferenceType = {};
    let canExpandTraffic = experiment.isActive();
    let expansionRecommendation = '可以继续扩大流量';

    for (const [requestId, shadowRequest] of this.requestHistory.entries()) {
      if (shadowRequest.experimentId !== experimentId) continue;

      if (shadowRequest.differences.length === 0 && !shadowRequest.hasSideEffectRisk) {
        continue;
      }

      if (!byEndpoint[shadowRequest.endpoint]) {
        byEndpoint[shadowRequest.endpoint] = { count: 0, differences: [], sideEffectRisks: [] };
      }
      byEndpoint[shadowRequest.endpoint].count++;
      byEndpoint[shadowRequest.endpoint].differences.push(...shadowRequest.differences);
      if (shadowRequest.sideEffectRisk) {
        byEndpoint[shadowRequest.endpoint].sideEffectRisks.push(shadowRequest.sideEffectRisk);
      }

      if (!byTenant[shadowRequest.tenantId]) {
        byTenant[shadowRequest.tenantId] = { count: 0, differences: [], sideEffectRisks: [] };
      }
      byTenant[shadowRequest.tenantId].count++;
      byTenant[shadowRequest.tenantId].differences.push(...shadowRequest.differences);
      if (shadowRequest.sideEffectRisk) {
        byTenant[shadowRequest.tenantId].sideEffectRisks.push(shadowRequest.sideEffectRisk);
      }

      for (const d of shadowRequest.differences) {
        if (!byDifferenceType[d.type]) {
          byDifferenceType[d.type] = { count: 0, fields: new Set() };
        }
        byDifferenceType[d.type].count++;
        byDifferenceType[d.type].fields.add(d.field);
      }

      if (shadowRequest.sideEffectRisk) {
        if (!byDifferenceType['side_effect']) {
          byDifferenceType['side_effect'] = { count: 0, fields: new Set() };
        }
        byDifferenceType['side_effect'].count++;
        byDifferenceType['side_effect'].fields.add(shadowRequest.sideEffectRisk.field);
      }
    }

    for (const key in byDifferenceType) {
      byDifferenceType[key].fields = Array.from(byDifferenceType[key].fields);
    }

    if (experiment.sideEffectRisks.length > 0) {
      canExpandTraffic = false;
      expansionRecommendation = '检测到副作用风险，实验已暂停，不可扩大流量';
    } else if (experiment.differences.length > 0) {
      const diffRate = experiment.differences.length / experiment.totalRequests;
      if (diffRate > 0.1) {
        canExpandTraffic = false;
        expansionRecommendation = '差异率超过 10%，建议先修复问题再扩大流量';
      } else {
        expansionRecommendation = '有少量差异，建议先分析差异原因再考虑扩大流量';
      }
    }

    return {
      experiment: experiment.getStats(),
      summary: {
        byEndpoint,
        byTenant,
        byDifferenceType
      },
      canExpandTraffic,
      expansionRecommendation,
      responseDifferences: experiment.differences,
      sideEffectRisks: experiment.sideEffectRisks
    };
  }

  pauseExperiment(experimentId, reason) {
    const experiment = this.getExperiment(experimentId);
    if (!experiment) {
      return null;
    }
    experiment.pause(reason);
    return experiment.getStats();
  }

  resumeExperiment(experimentId) {
    const experiment = this.getExperiment(experimentId);
    if (!experiment) {
      return null;
    }
    experiment.resume();
    return experiment.getStats();
  }
}

module.exports = new ExperimentManager();
