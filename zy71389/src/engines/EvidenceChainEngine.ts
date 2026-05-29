import {
  ExposureLog,
  UserBucket,
  OperationChange,
  ConversionData,
  EvidenceChain,
  EvidenceItem,
  ContaminationType,
  CheckConfig,
  DEFAULT_CHECK_CONFIG
} from '../types';
import { BucketValidationEngine } from './BucketValidationEngine';
import { ChangeSlicingEngine } from './ChangeSlicingEngine';
import { ContaminationMarkingEngine } from './ContaminationMarkingEngine';

export interface TimelineEvent {
  id: string;
  timestamp: number;
  type: 'bucket' | 'exposure' | 'conversion' | 'config_change';
  title: string;
  description: string;
  data: any;
  isContaminationPoint?: boolean;
  contaminationType?: ContaminationType;
}

export class EvidenceChainEngine {
  static getEvidenceChain(
    exposureId: string,
    exposureLogs: Map<string, ExposureLog>,
    userBuckets: Map<string, UserBucket[]>,
    operationChanges: OperationChange[],
    conversionData: ConversionData[]
  ): EvidenceChain | null {
    const exposure = exposureLogs.get(exposureId);
    if (!exposure) return null;

    const userId = exposure.userId;
    const experimentId = exposure.experimentId;

    const bucketKey = `${userId}_${experimentId}`;
    const userBucketRecords = userBuckets.get(bucketKey) || [];

    const userExposureRecords = Array.from(exposureLogs.values())
      .filter(e => e.userId === userId && e.experimentId === experimentId)
      .sort((a, b) => a.exposureTime - b.exposureTime);

    const userConversionRecords = conversionData
      .filter(c => c.userId === userId)
      .sort((a, b) => a.conversionTime - b.conversionTime);

    const relatedConversions = conversionData
      .filter(c => c.exposureId === exposureId)
      .sort((a, b) => a.conversionTime - b.conversionTime);

    const relevantConfigChanges = operationChanges
      .filter(c => c.experimentId === experimentId)
      .sort((a, b) => a.changeTime - b.changeTime);

    const evidenceItems: EvidenceItem[] = [];

    userBucketRecords.forEach((bucket) => {
      evidenceItems.push({
        type: 'bucket',
        timestamp: bucket.bucketTime,
        label: '用户分桶',
        title: `${bucket.groupName}(${bucket.groupId})`,
        description: `分桶版本: ${bucket.bucketVersion}`,
        evidence: bucket
      });
    });

    userExposureRecords.forEach((exp) => {
      evidenceItems.push({
        type: exp.isContaminated ? 'contamination' : 'exposure',
        timestamp: exp.exposureTime,
        label: exp.isContaminated ? '污染曝光' : '实验曝光',
        title: exp.exposureId,
        description: `分组: ${exp.groupId}, 版本: ${exp.configVersion}${exp.isContaminated ? `, 污染类型: ${exp.contaminationType}` : ''}`,
        evidence: exp
      });
    });

    relevantConfigChanges.forEach((change) => {
      evidenceItems.push({
        type: 'config_change',
        timestamp: change.changeTime,
        label: '配置变更',
        title: `${change.changeType}变更`,
        description: `操作人: ${change.operator}, ${change.changeDescription}`,
        evidence: change
      });
    });

    relatedConversions.forEach((conv) => {
      evidenceItems.push({
        type: 'conversion',
        timestamp: conv.conversionTime,
        label: '转化事件',
        title: conv.conversionEvent,
        description: `转化值: ${conv.conversionValue}`,
        evidence: conv
      });
    });

    evidenceItems.sort((a, b) => a.timestamp - b.timestamp);

    const consistencyData = {
      exposureId,
      bucketRecords: userBucketRecords,
      exposureRecords: userExposureRecords,
      configChanges: relevantConfigChanges,
      conversionRecords: relatedConversions
    };
    const consistencyHash = this.generateHash(JSON.stringify(consistencyData));

    return {
      exposureId,
      userId,
      bucketRecords: userBucketRecords,
      exposureRecords: userExposureRecords,
      configChanges: relevantConfigChanges,
      conversionRecords: userConversionRecords,
      relatedConversions,
      contaminationVerdict: exposure.contaminationType,
      verdictReason: exposure.contaminationReason || '',
      evidenceItems,
      consistencyHash,
      isConsistent: true
    };
  }

  private static generateHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(16, '0');
  }

  static buildTimeline(evidenceChain: EvidenceChain): TimelineEvent[] {
    const events: TimelineEvent[] = [];

    evidenceChain.bucketRecords.forEach((bucket, index) => {
      events.push({
        id: `bucket_${index}`,
        timestamp: bucket.bucketTime,
        type: 'bucket',
        title: `用户分桶 - ${bucket.groupName}`,
        description: `版本: ${bucket.bucketVersion}, 分组ID: ${bucket.groupId}`,
        data: bucket
      });
    });

    evidenceChain.exposureRecords.forEach((exposure, index) => {
      const isContaminationPoint = exposure.isContaminated && 
        exposure.exposureId === evidenceChain.exposureId;
      
      events.push({
        id: `exposure_${index}`,
        timestamp: exposure.exposureTime,
        type: 'exposure',
        title: `实验曝光${exposure.isContaminated ? ' (污染)' : ''}`,
        description: `曝光ID: ${exposure.exposureId}, 分组: ${exposure.groupId}, 版本: ${exposure.configVersion}`,
        data: exposure,
        isContaminationPoint,
        contaminationType: exposure.contaminationType
      });
    });

    evidenceChain.conversionRecords.forEach((conversion, index) => {
      events.push({
        id: `conversion_${index}`,
        timestamp: conversion.conversionTime,
        type: 'conversion',
        title: `转化事件 - ${conversion.conversionEvent}`,
        description: `转化值: ${conversion.conversionValue}, 关联曝光: ${conversion.exposureId}`,
        data: conversion
      });
    });

    evidenceChain.configChanges.forEach((change, index) => {
      events.push({
        id: `change_${index}`,
        timestamp: change.changeTime,
        type: 'config_change',
        title: `配置变更 - ${change.changeType}`,
        description: `操作人: ${change.operator}, 描述: ${change.changeDescription}`,
        data: change
      });
    });

    return events.sort((a, b) => a.timestamp - b.timestamp);
  }

  static analyzeCrossGroup(
    evidenceChain: EvidenceChain,
    config: CheckConfig = DEFAULT_CHECK_CONFIG
  ): {
    isCrossGroup: boolean;
    groups: string[];
    explanation: string;
  } {
    if (!config.markCrossGroup) {
      return { isCrossGroup: false, groups: [], explanation: '串组检查未启用' };
    }

    const buckets = evidenceChain.bucketRecords;
    const groupIds = new Set(buckets.map(b => b.groupId));
    const groups = buckets.map(b => `${b.groupName}(${b.groupId})@${new Date(b.bucketTime).toLocaleString()}`);

    if (groupIds.size > 1) {
      return {
        isCrossGroup: true,
        groups,
        explanation: `用户在实验中被分配到 ${groupIds.size} 个不同的组: ${groups.join(', ')}`
      };
    }

    return {
      isCrossGroup: false,
      groups,
      explanation: '用户分桶正常，未发现串组'
    };
  }

  static analyzeDuplicate(
    evidenceChain: EvidenceChain,
    config: CheckConfig = DEFAULT_CHECK_CONFIG
  ): {
    isDuplicate: boolean;
    totalExposures: number;
    firstExposureTime?: number;
    explanation: string;
  } {
    if (!config.markDuplicate) {
      return { isDuplicate: false, totalExposures: evidenceChain.exposureRecords.length, explanation: '重复曝光检查未启用' };
    }

    const exposures = evidenceChain.exposureRecords;
    const targetExposure = exposures.find(e => e.exposureId === evidenceChain.exposureId);
    
    if (exposures.length <= 1) {
      return {
        isDuplicate: false,
        totalExposures: exposures.length,
        explanation: '用户仅曝光一次，无重复曝光'
      };
    }

    const firstExposure = exposures[0];
    const isFirst = targetExposure?.exposureId === firstExposure.exposureId;

    if (isFirst) {
      return {
        isDuplicate: false,
        totalExposures: exposures.length,
        firstExposureTime: firstExposure.exposureTime,
        explanation: `这是用户第1次曝光，作为有效曝光保留，用户总曝光次数: ${exposures.length}`
      };
    }

    const timeDiff = targetExposure 
      ? (targetExposure.exposureTime - firstExposure.exposureTime) / (60 * 1000)
      : 0;

    return {
      isDuplicate: true,
      totalExposures: exposures.length,
      firstExposureTime: firstExposure.exposureTime,
      explanation: `这是用户第${exposures.findIndex(e => e.exposureId === evidenceChain.exposureId) + 1}次曝光，距首次曝光 ${timeDiff.toFixed(1)} 分钟，标记为重复曝光污染`
    };
  }

  static analyzeConfigChange(
    evidenceChain: EvidenceChain,
    config: CheckConfig = DEFAULT_CHECK_CONFIG
  ): {
    isNearChange: boolean;
    nearestChange?: OperationChange;
    timeDiffMinutes: number;
    explanation: string;
  } {
    if (!config.markConfigChange) {
      return { isNearChange: false, timeDiffMinutes: 0, explanation: '配置变更检查未启用' };
    }

    const targetExposure = evidenceChain.exposureRecords.find(
      e => e.exposureId === evidenceChain.exposureId
    );

    if (!targetExposure || evidenceChain.configChanges.length === 0) {
      return {
        isNearChange: false,
        timeDiffMinutes: 0,
        explanation: evidenceChain.configChanges.length === 0 
          ? '无配置变更记录' 
          : '未找到目标曝光记录'
      };
    }

    const windowResult = ChangeSlicingEngine.isInConfigChangeWindow(
      targetExposure.exposureTime,
      evidenceChain.configChanges,
      config.configChangeWindowMinutes
    );

    if (windowResult.isInWindow && windowResult.nearestChange) {
      const direction = targetExposure.exposureTime < windowResult.nearestChange.changeTime 
        ? '之前' 
        : '之后';
      
      return {
        isNearChange: true,
        nearestChange: windowResult.nearestChange,
        timeDiffMinutes: windowResult.timeDiffMinutes,
        explanation: `曝光发生在配置变更${direction}约${windowResult.timeDiffMinutes.toFixed(1)}分钟，在${config.configChangeWindowMinutes}分钟窗口期内，标记为配置变更污染。变更内容：${windowResult.nearestChange.changeDescription}`
      };
    }

    return {
      isNearChange: false,
      nearestChange: windowResult.nearestChange,
      timeDiffMinutes: windowResult.timeDiffMinutes,
      explanation: `距最近配置变更约${windowResult.timeDiffMinutes.toFixed(1)}分钟，超出${config.configChangeWindowMinutes}分钟窗口期，数据正常`
    };
  }

  static generateVerdict(
    evidenceChain: EvidenceChain,
    config: CheckConfig = DEFAULT_CHECK_CONFIG
  ): {
    verdict: ContaminationType;
    reason: string;
    details: {
      crossGroup: ReturnType<typeof EvidenceChainEngine.analyzeCrossGroup>;
      duplicate: ReturnType<typeof EvidenceChainEngine.analyzeDuplicate>;
      configChange: ReturnType<typeof EvidenceChainEngine.analyzeConfigChange>;
    };
  } {
    const crossGroupAnalysis = this.analyzeCrossGroup(evidenceChain, config);
    const duplicateAnalysis = this.analyzeDuplicate(evidenceChain, config);
    const configChangeAnalysis = this.analyzeConfigChange(evidenceChain, config);

    if (crossGroupAnalysis.isCrossGroup) {
      return {
        verdict: ContaminationType.CROSS_GROUP,
        reason: crossGroupAnalysis.explanation,
        details: {
          crossGroup: crossGroupAnalysis,
          duplicate: duplicateAnalysis,
          configChange: configChangeAnalysis
        }
      };
    }

    if (duplicateAnalysis.isDuplicate) {
      return {
        verdict: ContaminationType.DUPLICATE_EXPOSURE,
        reason: duplicateAnalysis.explanation,
        details: {
          crossGroup: crossGroupAnalysis,
          duplicate: duplicateAnalysis,
          configChange: configChangeAnalysis
        }
      };
    }

    if (configChangeAnalysis.isNearChange) {
      return {
        verdict: ContaminationType.CONFIG_CHANGE,
        reason: configChangeAnalysis.explanation,
        details: {
          crossGroup: crossGroupAnalysis,
          duplicate: duplicateAnalysis,
          configChange: configChangeAnalysis
        }
      };
    }

    return {
      verdict: ContaminationType.NONE,
      reason: '数据正常，未发现污染',
      details: {
        crossGroup: crossGroupAnalysis,
        duplicate: duplicateAnalysis,
        configChange: configChangeAnalysis
      }
    };
  }
}
