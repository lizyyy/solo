import { allQuery } from '../db';
import { snakeToCamelAll, parseDetails } from '../utils';
import type { AuditActionType } from '../types';

interface AuditExportParams {
  entityType?: 'list_version' | 'hit_record' | 'account_freeze';
  entityId?: string;
  actionType?: AuditActionType;
  startDate?: string;
  endDate?: string;
  actor?: string;
}

interface AuditExportRow {
  序号: number;
  时间戳: string;
  操作类型: string;
  实体类型: string;
  实体ID: string;
  操作人: string;
  详情: string;
  说明: string;
}

const actionTypeMapping: Record<AuditActionType, string> = {
  'list_version_created': '创建名单版本',
  'list_version_archived': '归档名单版本',
  'hit_recorded': '记录命中',
  'hit_reviewed': '复核命中记录',
  'freeze_created': '冻结账户',
  'unfreeze_requested': '提交解冻申请',
  'unfreeze_approved': '审批通过解冻',
  'unfreeze_rejected': '审批驳回解冻',
  'freeze_lifted': '解除冻结'
};

const entityTypeMapping: Record<string, string> = {
  'list_version': '名单版本',
  'hit_record': '命中记录',
  'account_freeze': '账户冻结'
};

const formatDate = (isoDate: string): string => {
  const d = new Date(isoDate);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
};

export const queryAuditLogs = async (params: AuditExportParams = {}): Promise<any[]> => {
  let sql = `SELECT * FROM audit_logs WHERE 1=1`;
  const queryParams: any[] = [];

  if (params.entityType) {
    sql += ` AND entity_type = ?`;
    queryParams.push(params.entityType);
  }

  if (params.entityId) {
    sql += ` AND entity_id = ?`;
    queryParams.push(params.entityId);
  }

  if (params.actionType) {
    sql += ` AND action_type = ?`;
    queryParams.push(params.actionType);
  }

  if (params.actor) {
    sql += ` AND actor = ?`;
    queryParams.push(params.actor);
  }

  if (params.startDate) {
    sql += ` AND timestamp >= ?`;
    queryParams.push(params.startDate);
  }

  if (params.endDate) {
    sql += ` AND timestamp <= ?`;
    queryParams.push(params.endDate);
  }

  sql += ` ORDER BY timestamp DESC`;

  const logs = await allQuery(sql, queryParams);
  return parseDetails(snakeToCamelAll(logs));
};

export const exportAuditCSV = async (params: AuditExportParams = {}): Promise<string> => {
  const logs = await queryAuditLogs(params);
  
  const rows: AuditExportRow[] = logs.map((log, index) => {
    const details = typeof log.details === 'string' ? JSON.parse(log.details) : log.details;
    return {
      序号: index + 1,
      时间戳: formatDate(log.timestamp),
      操作类型: actionTypeMapping[log.actionType as AuditActionType] || log.actionType,
      实体类型: entityTypeMapping[log.entityType] || log.entityType,
      实体ID: log.entityId,
      操作人: log.actor,
      详情: JSON.stringify(details, null, 0),
      说明: details?.note || ''
    };
  });

  const headers = Object.keys(rows[0] || {}).join(',');
  const dataRows = rows.map(row => 
    Object.values(row).map(v => 
      typeof v === 'string' ? `"${v.replace(/"/g, '""')}"` : v
    ).join(',')
  );

  return [headers, ...dataRows].join('\n');
};

export const exportAuditJSON = async (params: AuditExportParams = {}): Promise<string> => {
  const logs = await queryAuditLogs(params);
  
  const enriched = logs.map(log => ({
    ...log,
    actionTypeLabel: actionTypeMapping[log.actionType as AuditActionType] || log.actionType,
    entityTypeLabel: entityTypeMapping[log.entityType] || log.entityType,
    formattedTime: formatDate(log.timestamp)
  }));

  return JSON.stringify({
    exportTime: new Date().toISOString(),
    params,
    totalCount: logs.length,
    records: enriched
  }, null, 2);
};

export const exportHitDetailReport = async (hitId: string): Promise<string> => {
  const { getHitDetail } = await import('./queryService');
  const detail = await getHitDetail(hitId);

  const report = {
    报告生成时间: new Date().toISOString(),
    命中记录: {
      ID: detail.hitRecord.id,
      账户ID: detail.hitRecord.accountId,
      交易ID: detail.hitRecord.transactionId,
      名单版本ID: detail.hitRecord.listVersionId,
      匹配原因: detail.hitRecord.matchReason,
      匹配分数: detail.hitRecord.matchScore,
      当前状态: detail.hitRecord.status,
      状态说明: detail.statusDescription,
      当前卡点: detail.currentBlock,
      卡点说明: detail.blockInfo.description,
      创建时间: detail.hitRecord.createdAt,
      更新时间: detail.hitRecord.updatedAt
    },
    冻结情况: detail.freeze ? {
      ID: detail.freeze.id,
      冻结原因: detail.freeze.freezeReason,
      当前状态: detail.freeze.status,
      申请解冻时间: detail.freeze.unfreezeRequestedAt,
      申请解冻人: detail.freeze.unfreezeRequestedBy,
      解冻原因: detail.freeze.unfreezeReason,
      解冻时间: detail.freeze.unfrozenAt,
      解冻操作人: detail.freeze.unfrozenBy,
      创建时间: detail.freeze.createdAt
    } : '无（重复命中，未重复冻结）',
    复核记录: detail.reviewRecords.map((r: any, i: number) => ({
      序号: i + 1,
      复核人: r.reviewer,
      决策: r.decision === 'approved' ? '通过' : '驳回',
      意见: r.comment,
      复核前状态: r.previousStatus,
      复核时间: r.createdAt
    })),
    审批记录: detail.approvalRecords.map((a: any, i: number) => ({
      序号: i + 1,
      审批人: a.approver,
      决策: a.decision === 'approved' ? '通过' : '驳回',
      意见: a.comment,
      审批时间: a.createdAt
    })),
    审计日志: detail.auditLogs.map((log: any, i: number) => ({
      序号: i + 1,
      时间: formatDate(log.timestamp),
      操作人: log.actor,
      操作类型: actionTypeMapping[log.actionType as AuditActionType] || log.actionType,
      实体类型: entityTypeMapping[log.entityType] || log.entityType,
      说明: log.details?.note || '',
      详情: log.details
    }))
  };

  return JSON.stringify(report, null, 2);
};

export const exportAccountDetailReport = async (accountId: string): Promise<string> => {
  const { getAccountSummary } = await import('./queryService');
  const summary = await getAccountSummary(accountId);

  const report = {
    报告生成时间: new Date().toISOString(),
    账户ID: accountId,
    当前状态: summary.currentStatus,
    是否冻结: summary.isFrozen,
    统计汇总: {
      总命中次数: summary.summary.totalHits,
      总冻结次数: summary.summary.totalFreezes,
      已解冻次数: summary.summary.unfrozenCount,
      待复核: summary.summary.pendingReview,
      复核被驳回: summary.summary.reviewRejected,
      待解冻审批: summary.summary.pendingUnfreeze,
      解冻被驳回: summary.summary.unfreezeRejected,
      已通过: summary.summary.approved,
      已关闭: summary.summary.closed,
      总卡点记录: summary.summary.totalBlocked,
      卡在复核环节: summary.summary.blockedInReview,
      卡在解冻审批: summary.summary.blockedInUnfreeze
    },
    活跃冻结: summary.activeFreeze ? {
      ID: summary.activeFreeze.id,
      冻结原因: summary.activeFreeze.freezeReason,
      申请解冻时间: summary.activeFreeze.unfreezeRequestedAt,
      申请解冻人: summary.activeFreeze.unfreezeRequestedBy,
      解冻原因: summary.activeFreeze.unfreezeReason,
      创建时间: summary.activeFreeze.createdAt
    } : '无',
    命中记录列表: summary.hitRecords.map((h: any, i: number) => ({
      序号: i + 1,
      ID: h.id,
      状态: h.status,
      当前卡点: h.currentBlock,
      匹配原因: h.matchReason,
      匹配分数: h.matchScore,
      创建时间: h.createdAt
    })),
    冻结记录列表: summary.freezes.map((f: any, i: number) => ({
      序号: i + 1,
      ID: f.id,
      状态: f.status,
      冻结原因: f.freezeReason,
      解冻时间: f.unfrozenAt,
      创建时间: f.createdAt
    }))
  };

  return JSON.stringify(report, null, 2);
};
