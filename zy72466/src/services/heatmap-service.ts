import {
  ComplaintRecord,
  ComplaintStatus,
  HeatmapInfo,
  OperationType,
} from '../types';
import { dataStore } from '../store';
import { StatusManager } from './status-manager';
import {
  shouldPendingReview,
  isMissingSamplingCausingLow,
  BoundaryRules,
} from '../boundary-rules';
import { now } from '../utils';

export class HeatmapService {
  static updateHeatmap(
    recordId: string,
    odorLevel: number,
    isMissingSampling: boolean,
    samplingTime: string,
    operator: string
  ): ComplaintRecord | null {
    const record = dataStore.getRecord(recordId);
    if (!record) return null;

    const isLowDueToMissing = isMissingSamplingCausingLow(
      odorLevel,
      isMissingSampling
    );

    const targetStatus = shouldPendingReview(isMissingSampling, odorLevel)
      ? ComplaintStatus.HEATMAP_PENDING_REVIEW
      : ComplaintStatus.HEATMAP_NORMAL;

    const remark = isLowDueToMissing
      ? `夜间缺采样，热力值偏低(${odorLevel})，待街道规划员复核`
      : `热力值更新: ${odorLevel}${isMissingSampling ? '（缺采样）' : ''}`;

    return StatusManager.executeWithTransition(
      record.id,
      targetStatus,
      OperationType.UPDATE_HEATMAP,
      operator,
      r => {
        r.heatmap = {
          odorLevel,
          samplingTime,
          isMissingSampling,
          isLowDueToMissing,
        };
      },
      remark
    );
  }

  static reviewHeatmap(
    recordId: string,
    isNormal: boolean,
    reviewNote: string,
    reviewer: string
  ): ComplaintRecord | null {
    const record = dataStore.getRecord(recordId);
    if (!record) return null;

    if (record.currentStatus !== ComplaintStatus.HEATMAP_PENDING_REVIEW) {
      throw new Error('该记录不处于待复核状态');
    }

    if (!record.heatmap) {
      throw new Error('该记录没有热力图数据');
    }

    const targetStatus = isNormal
      ? ComplaintStatus.REVIEWED_NORMAL
      : ComplaintStatus.REVIEWED_ABNORMAL;

    const reviewConclusion = isNormal ? '正常' : '异常';

    return StatusManager.executeWithTransition(
      record.id,
      targetStatus,
      OperationType.REVIEW_HEATMAP,
      reviewer,
      r => {
        if (r.heatmap) {
          r.heatmap.reviewNote = reviewNote;
          r.heatmap.reviewedBy = reviewer;
          r.heatmap.reviewedAt = now();
        }
      },
      `复核结论: ${reviewConclusion}, 备注: ${reviewNote}`
    );
  }

  static reheatHeatmapAfterReview(
    recordId: string,
    odorLevel: number,
    isMissingSampling: boolean,
    samplingTime: string,
    operator: string,
    reason?: string
  ): ComplaintRecord | null {
    const record = dataStore.getRecord(recordId);
    if (!record) return null;

    const allowedForRework = [
      ComplaintStatus.REVIEWED_NORMAL,
      ComplaintStatus.REVIEWED_ABNORMAL,
      ComplaintStatus.HEATMAP_NORMAL,
    ];
    if (!allowedForRework.includes(record.currentStatus)) {
      throw new Error(
        `该状态(${record.currentStatus})不支持返工修改热力值，请先回滚复核`
      );
    }

    const isLowDueToMissing = isMissingSamplingCausingLow(
      odorLevel,
      isMissingSampling
    );

    const targetStatus = shouldPendingReview(isMissingSampling, odorLevel)
      ? ComplaintStatus.HEATMAP_PENDING_REVIEW
      : ComplaintStatus.HEATMAP_NORMAL;

    const remark = isLowDueToMissing
      ? `返工-夜间缺采样，热力值偏低(${odorLevel})，待复核`
      : `返工-热力值更新为 ${odorLevel}${isMissingSampling ? '（缺采样）' : ''}${reason ? `，原因: ${reason}` : ''}`;

    return StatusManager.executeManualEdit(
      record.id,
      operator,
      r => {
        r.heatmap = {
          odorLevel,
          samplingTime,
          isMissingSampling,
          isLowDueToMissing,
        };
        r.currentStatus = targetStatus;
      },
      remark
    );
  }

  static getDisplayOdorLevel(record: ComplaintRecord): number {
    if (!record.heatmap) return 0;

    if (record.heatmap.isMissingSampling) {
      if (
        record.currentStatus === ComplaintStatus.HEATMAP_PENDING_REVIEW ||
        record.currentStatus === ComplaintStatus.REVIEWED_ABNORMAL
      ) {
        return BoundaryRules.heatmap.missingSamplingDisplayLevel;
      }
      if (record.currentStatus === ComplaintStatus.REVIEWED_NORMAL) {
        return record.heatmap.odorLevel;
      }
    }

    return record.heatmap.odorLevel;
  }

  static getPendingReviewRecords(): ComplaintRecord[] {
    return dataStore
      .getAllRecords()
      .filter(r => r.currentStatus === ComplaintStatus.HEATMAP_PENDING_REVIEW);
  }
}
