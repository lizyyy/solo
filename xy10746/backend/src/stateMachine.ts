import { PluginVersionStatus, ApiResponseStatus } from './types';
import { db } from './database';
import { v4 as uuidv4 } from 'uuid';

export class PluginStateMachine {
  private validTransitions: Map<PluginVersionStatus, PluginVersionStatus[]> = new Map([
    [PluginVersionStatus.DRAFT, [PluginVersionStatus.SUBMITTED]],
    [PluginVersionStatus.SUBMITTED, [PluginVersionStatus.SECURITY_SCANNING]],
    [PluginVersionStatus.SECURITY_SCANNING, [PluginVersionStatus.SECURITY_PASSED, PluginVersionStatus.SECURITY_FAILED]],
    [PluginVersionStatus.SECURITY_PASSED, [PluginVersionStatus.PENDING_REVIEW]],
    [PluginVersionStatus.SECURITY_FAILED, [PluginVersionStatus.SECURITY_SCANNING, PluginVersionStatus.REVIEW_REJECTED]],
    [PluginVersionStatus.PENDING_REVIEW, [PluginVersionStatus.REVIEW_APPROVED, PluginVersionStatus.REVIEW_REJECTED, PluginVersionStatus.PENDING_RECHECK]],
    [PluginVersionStatus.REVIEW_APPROVED, [PluginVersionStatus.PENDING_RECHECK, PluginVersionStatus.PUBLISHED]],
    [PluginVersionStatus.REVIEW_REJECTED, [PluginVersionStatus.PENDING_RECHECK, PluginVersionStatus.ARCHIVED]],
    [PluginVersionStatus.PENDING_RECHECK, [PluginVersionStatus.REVIEW_APPROVED, PluginVersionStatus.REVIEW_REJECTED]],
    [PluginVersionStatus.PUBLISHED, [PluginVersionStatus.UNPUBLISHED]],
    [PluginVersionStatus.UNPUBLISHED, [PluginVersionStatus.PUBLISHED, PluginVersionStatus.ARCHIVED]],
    [PluginVersionStatus.ARCHIVED, []]
  ]);

  canTransition(currentStatus: PluginVersionStatus, newStatus: PluginVersionStatus): boolean {
    const allowed = this.validTransitions.get(currentStatus);
    return allowed ? allowed.includes(newStatus) : false;
  }

  async transition(versionId: string, newStatus: PluginVersionStatus, actor: string, reason?: string): Promise<{ success: boolean; status: ApiResponseStatus; message: string }> {
    const version = await db.getVersion(versionId);
    if (!version) {
      return { success: false, status: ApiResponseStatus.BLOCKED, message: '版本不存在' };
    }

    if (!this.canTransition(version.status, newStatus)) {
      return { success: false, status: ApiResponseStatus.BLOCKED, message: `无法从 ${version.status} 转换到 ${newStatus}` };
    }

    if (newStatus === PluginVersionStatus.SECURITY_SCANNING && version.retryCount >= version.maxRetries) {
      return { success: false, status: ApiResponseStatus.BLOCKED, message: '已达到最大重试次数，无法重新扫描' };
    }

    const extra: any = {};
    if (newStatus === PluginVersionStatus.REVIEW_APPROVED || newStatus === PluginVersionStatus.REVIEW_REJECTED) {
      extra.reviewedBy = actor;
      extra.reviewedAt = new Date().toISOString();
    }
    if (newStatus === PluginVersionStatus.PUBLISHED) {
      extra.publishedBy = actor;
      extra.publishedAt = new Date().toISOString();
    }
    if (newStatus === PluginVersionStatus.UNPUBLISHED) {
      extra.unpublishedBy = actor;
      extra.unpublishedAt = new Date().toISOString();
      extra.unpublishedReason = reason;
    }
    if (newStatus === PluginVersionStatus.SECURITY_SCANNING) {
      extra.retryCount = version.retryCount + 1;
    }

    await db.updateVersionStatus(versionId, newStatus, extra);

    const eventType = this.getEventType(newStatus);
    await db.createTimelineEvent({
      versionId,
      type: eventType,
      title: this.getEventTitle(newStatus),
      description: reason || this.getEventDescription(newStatus, version.status),
      actor,
      timestamp: new Date().toISOString()
    });

    let apiStatus = ApiResponseStatus.SUCCESS;
    if (newStatus === PluginVersionStatus.PENDING_REVIEW || newStatus === PluginVersionStatus.PENDING_RECHECK) {
      apiStatus = ApiResponseStatus.PENDING_REVIEW;
    } else if (newStatus === PluginVersionStatus.SECURITY_FAILED) {
      apiStatus = ApiResponseStatus.RETRYABLE;
    }

    return { success: true, status: apiStatus, message: '状态转换成功' };
  }

  private getEventType(status: PluginVersionStatus): string {
    switch (status) {
      case PluginVersionStatus.SUBMITTED: return 'submission';
      case PluginVersionStatus.SECURITY_SCANNING: return 'security_scan';
      case PluginVersionStatus.SECURITY_PASSED: return 'security_pass';
      case PluginVersionStatus.SECURITY_FAILED: return 'security_fail';
      case PluginVersionStatus.PENDING_REVIEW: return 'review_pending';
      case PluginVersionStatus.REVIEW_APPROVED: return 'review_approved';
      case PluginVersionStatus.REVIEW_REJECTED: return 'review_rejected';
      case PluginVersionStatus.PUBLISHED: return 'published';
      case PluginVersionStatus.UNPUBLISHED: return 'unpublished';
      default: return 'status_change';
    }
  }

  private getEventTitle(status: PluginVersionStatus): string {
    switch (status) {
      case PluginVersionStatus.SUBMITTED: return '版本已提交';
      case PluginVersionStatus.SECURITY_SCANNING: return '开始安全扫描';
      case PluginVersionStatus.SECURITY_PASSED: return '安全扫描通过';
      case PluginVersionStatus.SECURITY_FAILED: return '安全扫描失败';
      case PluginVersionStatus.PENDING_REVIEW: return '等待人工审核';
      case PluginVersionStatus.REVIEW_APPROVED: return '审核通过';
      case PluginVersionStatus.REVIEW_REJECTED: return '审核驳回';
      case PluginVersionStatus.PENDING_RECHECK: return '等待复核';
      case PluginVersionStatus.PUBLISHED: return '版本已上架';
      case PluginVersionStatus.UNPUBLISHED: return '版本已下架';
      case PluginVersionStatus.ARCHIVED: return '版本已归档';
      default: return '状态变更';
    }
  }

  private getEventDescription(newStatus: PluginVersionStatus, oldStatus: PluginVersionStatus): string {
    return `状态从 ${oldStatus} 变更为 ${newStatus}`;
  }
}

export const stateMachine = new PluginStateMachine();
