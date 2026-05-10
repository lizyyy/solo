const { BLACKLIST_STATUS, EXEMPTION_STATUS, AUDIT_ACTION, RISK_LEVEL } = require('./constants');
const DateUtils = require('../utils/date-utils');

class ReportRules {
  static calculateRiskLevel(hitCount, exemptionCount, daysActive) {
    let score = 0;

    if (hitCount > 10) score += 3;
    else if (hitCount > 5) score += 2;
    else if (hitCount > 0) score += 1;

    if (exemptionCount > 3) score += 2;
    else if (exemptionCount > 0) score += 1;

    if (daysActive > 90) score += 2;
    else if (daysActive > 30) score += 1;

    if (score >= 5) return RISK_LEVEL.CRITICAL;
    if (score >= 3) return RISK_LEVEL.HIGH;
    if (score >= 1) return RISK_LEVEL.MEDIUM;
    return RISK_LEVEL.LOW;
  }

  static groupByTimeRange(records, startDate, endDate, groupBy = 'day') {
    const groups = {};
    let current = DateUtils.startOfDay(startDate);
    const end = DateUtils.endOfDay(endDate);

    while (DateUtils.isBefore(current, end) || DateUtils.isBetween(current, startDate, endDate)) {
      const key = DateUtils.format(current, groupBy === 'day' ? 'YYYY-MM-DD' : 'YYYY-MM');
      groups[key] = {
        period: key,
        total: 0,
        active: 0,
        exempted: 0,
        hits: 0,
      };

      if (groupBy === 'day') {
        current = DateUtils.addDays(current, 1);
      } else {
        current = new Date(current.getFullYear(), current.getMonth() + 1, 1);
      }
    }

    for (const record of records) {
      const recordDate = DateUtils.format(
        record.createdAt || record.hitAt,
        groupBy === 'day' ? 'YYYY-MM-DD' : 'YYYY-MM'
      );

      if (groups[recordDate]) {
        groups[recordDate].total++;
        if (record.status === BLACKLIST_STATUS.ACTIVE) groups[recordDate].active++;
        if (record.status === BLACKLIST_STATUS.EXEMPTED) groups[recordDate].exempted++;
        if (record.action === AUDIT_ACTION.HIT) groups[recordDate].hits++;
      }
    }

    return Object.values(groups);
  }

  static calculateSyncMetrics(localVersion, sharedVersions = []) {
    if (sharedVersions.length === 0) {
      return {
        isSync: true,
        localVersion,
        latestSharedVersion: null,
        versionsBehind: 0,
        lastSyncAt: null,
      };
    }

    const latestShared = sharedVersions
      .filter(v => v.status === 'published')
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];

    if (!latestShared) {
      return {
        isSync: true,
        localVersion,
        latestSharedVersion: null,
        versionsBehind: 0,
        lastSyncAt: null,
      };
    }

    const localParts = localVersion.split('.').map(Number);
    const latestParts = latestShared.versionNumber.split('.').map(Number);

    let behind = 0;
    for (let i = 0; i < localParts.length; i++) {
      if (localParts[i] < latestParts[i]) {
        behind += latestParts[i] - localParts[i];
      }
    }

    return {
      isSync: behind === 0,
      localVersion,
      latestSharedVersion: latestShared.versionNumber,
      versionsBehind: behind,
      lastSyncAt: latestShared.publishedAt,
    };
  }

  static generateAuditTrail(events) {
    const sorted = [...events].sort(
      (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
    );

    return sorted.map((event, index) => ({
      sequence: index + 1,
      action: event.action,
      actor: event.actorName,
      timestamp: event.createdAt,
      description: this.describeEvent(event),
      ipAddress: event.ipAddress,
      userAgent: event.userAgent,
    }));
  }

  static describeEvent(event) {
    const actionDescriptions = {
      [AUDIT_ACTION.ADD]: '加入黑名单',
      [AUDIT_ACTION.REMOVE]: '从黑名单移除',
      [AUDIT_ACTION.UPDATE]: '更新黑名单信息',
      [AUDIT_ACTION.SYNC]: '同步黑名单数据',
      [AUDIT_ACTION.HIT]: '命中黑名单检查',
      [AUDIT_ACTION.MANUAL_CORRECT]: '人工修正状态',
      [AUDIT_ACTION.EXEMPTION_REQUEST]: '申请豁免',
      [AUDIT_ACTION.EXEMPTION_APPROVE]: '审批通过豁免',
      [AUDIT_ACTION.EXEMPTION_REJECT]: '拒绝豁免申请',
      [AUDIT_ACTION.EXEMPTION_EXPIRE]: '豁免过期',
      [AUDIT_ACTION.EXEMPTION_REVOKE]: '撤销豁免',
      [AUDIT_ACTION.VERSION_PUBLISH]: '发布共享版本',
      [AUDIT_ACTION.VERSION_ARCHIVE]: '归档版本',
      [AUDIT_ACTION.EXPORT]: '导出数据',
    };

    const base = actionDescriptions[event.action] || event.action;

    if (event.metadata) {
      const parts = [];
      if (event.metadata.reason) parts.push(`原因: ${event.metadata.reason}`);
      if (event.metadata.versionNumber) parts.push(`版本: ${event.metadata.versionNumber}`);
      if (event.metadata.durationDays) parts.push(`时长: ${event.metadata.durationDays}天`);

      if (parts.length > 0) {
        return `${base} (${parts.join('; ')})`;
      }
    }

    return base;
  }

  static validateReportParameters(params) {
    const errors = [];

    if (params.startDate && params.endDate) {
      if (DateUtils.isAfter(params.startDate, params.endDate)) {
        errors.push('开始时间不能晚于结束时间');
      }

      const maxDays = 90;
      const days = DateUtils.diffInDays(params.endDate, params.startDate);
      if (days > maxDays) {
        errors.push(`查询时间范围不能超过 ${maxDays} 天`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}

module.exports = ReportRules;
