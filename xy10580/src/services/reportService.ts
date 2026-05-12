import { dbPrepare } from '../db/database';
import { getHistoryByAppealId } from './historyService';
import { Appeal, AppealHistory, AppealCorrection, PlatformPenalty, Order } from '../types';
import { getReportsDir } from '../utils/config';
import path from 'path';
import fs from 'fs';

interface FullAppealDetail {
  appeal: Appeal;
  order?: Order;
  penalty?: PlatformPenalty;
  history: AppealHistory[];
  corrections: AppealCorrection[];
}

export async function getAppealDetail(appealId: string): Promise<FullAppealDetail> {
  const appealStmt = await dbPrepare(`
    SELECT 
      id, order_no as orderNo, rider_id as riderId,
      appeal_type as appealType, appeal_reason as appealReason,
      submit_time as submitTime, status,
      check_result as checkResult, check_evidence as checkEvidence,
      check_time as checkTime, reverted_amount as revertedAmount,
      operator
    FROM appeals WHERE id = ?
  `);
  const appealRow = await appealStmt.get(appealId) as any;
  
  if (!appealRow) {
    throw new Error(`未找到申诉记录: ${appealId}`);
  }
  
  const appeal = appealRow as Appeal;
  
  const orderStmt = await dbPrepare(`
    SELECT 
      id, order_no as orderNo, rider_id as riderId, rider_name as riderName,
      merchant_id as merchantId, merchant_name as merchantName,
      user_id as userId, user_name as userName,
      merchant_address as merchantAddress, delivery_address as deliveryAddress,
      estimated_delivery_time as estimatedDeliveryTime,
      actual_delivery_time as actualDeliveryTime,
      promised_time as promisedTime, create_time as createTime,
      accept_time as acceptTime, arrive_merchant_time as arriveMerchantTime,
      pick_up_time as pickUpTime, deliver_time as deliverTime,
      status, cancel_reason as cancelReason,
      cancel_time as cancelTime, cancel_initiator as cancelInitiator
    FROM orders WHERE order_no = ?
  `);
  const orderRow = await orderStmt.get(appeal.orderNo) as Order | undefined;
  
  const penaltyStmt = await dbPrepare(`
    SELECT 
      id, order_no as orderNo, rider_id as riderId,
      penalty_type as penaltyType, penalty_amount as penaltyAmount,
      penalty_reason as penaltyReason, create_time as createTime,
      status, reverted_amount as revertedAmount
    FROM platform_penalties 
    WHERE order_no = ? AND rider_id = ?
  `);
  const penalty = await penaltyStmt.get(appeal.orderNo, appeal.riderId) as PlatformPenalty | undefined;
  
  const history = await getHistoryByAppealId(appealId);
  
  const correctionStmt = await dbPrepare(`
    SELECT 
      id, appeal_id as appealId, operator,
      before_status as beforeStatus, after_status as afterStatus,
      before_reverted_amount as beforeRevertedAmount,
      after_reverted_amount as afterRevertedAmount,
      before_check_result as beforeCheckResult,
      after_check_result as afterCheckResult,
      reason, create_time as createTime
    FROM appeal_corrections WHERE appeal_id = ?
    ORDER BY create_time ASC
  `);
  const corrections = await correctionStmt.all(appealId) as AppealCorrection[];
  
  return {
    appeal,
    order: orderRow,
    penalty,
    history,
    corrections
  };
}

export async function listAppeals(options: {
  status?: string;
  riderId?: string;
  orderNo?: string;
  appealType?: string;
} = {}): Promise<Appeal[]> {
  let sql = `
    SELECT 
      id, order_no as orderNo, rider_id as riderId,
      appeal_type as appealType, appeal_reason as appealReason,
      submit_time as submitTime, status,
      check_result as checkResult, check_evidence as checkEvidence,
      check_time as checkTime, reverted_amount as revertedAmount,
      operator
    FROM appeals WHERE 1=1
  `;
  const params: any[] = [];
  
  if (options.status) {
    sql += ' AND status = ?';
    params.push(options.status);
  }
  if (options.riderId) {
    sql += ' AND rider_id = ?';
    params.push(options.riderId);
  }
  if (options.orderNo) {
    sql += ' AND order_no = ?';
    params.push(options.orderNo);
  }
  if (options.appealType) {
    sql += ' AND appeal_type = ?';
    params.push(options.appealType);
  }
  
  sql += ' ORDER BY submit_time DESC';
  
  const stmt = await dbPrepare(sql);
  const appeals = await stmt.all(...params);
  return appeals as Appeal[];
}

interface SummaryStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  corrected: number;
  totalPenaltyAmount: number;
  totalRevertedAmount: number;
  byType: Record<string, number>;
}

export async function getSummaryStats(): Promise<SummaryStats> {
  const statsStmt = await dbPrepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
      SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected,
      SUM(CASE WHEN status = 'corrected' THEN 1 ELSE 0 END) as corrected,
      COALESCE(SUM(reverted_amount), 0) as totalRevertedAmount
    FROM appeals
  `);
  const stats = await statsStmt.get() as any;
  
  const penaltyStmt = await dbPrepare(`
    SELECT COALESCE(SUM(penalty_amount), 0) as totalPenaltyAmount
    FROM platform_penalties
  `);
  const penaltyStats = await penaltyStmt.get() as any;
  
  const typeStmt = await dbPrepare(`
    SELECT appeal_type as type, COUNT(*) as count
    FROM appeals
    GROUP BY appeal_type
  `);
  const typeStats = await typeStmt.all() as { type: string; count: number }[];
  
  const byType: Record<string, number> = {};
  typeStats.forEach(row => {
    byType[row.type] = row.count;
  });
  
  return {
    total: stats?.total || 0,
    pending: stats?.pending || 0,
    approved: stats?.approved || 0,
    rejected: stats?.rejected || 0,
    corrected: stats?.corrected || 0,
    totalPenaltyAmount: penaltyStats?.totalPenaltyAmount || 0,
    totalRevertedAmount: stats?.totalRevertedAmount || 0,
    byType
  };
}

export async function generateReport(appealId: string, format: 'text' | 'json' = 'text'): Promise<string> {
  const detail = await getAppealDetail(appealId);
  const { appeal, order, penalty, history, corrections } = detail;
  
  if (format === 'json') {
    return JSON.stringify({
      appeal,
      order,
      penalty,
      history,
      corrections,
      generatedAt: Date.now()
    }, null, 2);
  }
  
  const lines: string[] = [];
  
  lines.push('╔════════════════════════════════════════════════════════════╗');
  lines.push('║              外 卖 骑 手 申 诉 报 告                         ║');
  lines.push('╚════════════════════════════════════════════════════════════╝');
  lines.push('');
  
  lines.push('【申诉基本信息】');
  lines.push('─'.repeat(60));
  lines.push(`申诉ID:     ${appeal.id}`);
  lines.push(`订单号:     ${appeal.orderNo}`);
  lines.push(`骑手ID:     ${appeal.riderId}`);
  lines.push(`申诉类型:   ${appeal.appealType}`);
  lines.push(`申诉状态:   ${appeal.status}`);
  lines.push(`提交时间:   ${new Date(appeal.submitTime).toLocaleString()}`);
  lines.push(`申诉原因:   ${appeal.appealReason}`);
  if (appeal.checkTime) {
    lines.push(`审核时间:   ${new Date(appeal.checkTime).toLocaleString()}`);
  }
  lines.push('');
  
  if (order) {
    lines.push('【订单信息】');
    lines.push('─'.repeat(60));
    lines.push(`骑手姓名:   ${order.riderName}`);
    lines.push(`商家名称:   ${order.merchantName}`);
    lines.push(`用户姓名:   ${order.userName}`);
    lines.push(`订单状态:   ${order.status}`);
    lines.push(`预计配送:   ${order.estimatedDeliveryTime / 60000} 分钟`);
    lines.push(`承诺送达:   ${new Date(order.promisedTime).toLocaleString()}`);
    if (order.actualDeliveryTime) {
      lines.push(`实际送达:   ${new Date(order.actualDeliveryTime).toLocaleString()}`);
    }
    if (order.status === 'cancelled') {
      lines.push(`取消原因:   ${order.cancelReason || '未知'}`);
      lines.push(`取消发起:   ${order.cancelInitiator || '未知'}`);
    }
    lines.push('');
  }
  
  if (penalty) {
    lines.push('【平台处罚信息】');
    lines.push('─'.repeat(60));
    lines.push(`处罚类型:   ${penalty.penaltyType}`);
    lines.push(`处罚金额:   ¥${penalty.penaltyAmount.toFixed(2)}`);
    lines.push(`处罚原因:   ${penalty.penaltyReason}`);
    lines.push(`处罚状态:   ${penalty.status}`);
    lines.push(`已退金额:   ¥${(penalty.revertedAmount || 0).toFixed(2)}`);
    lines.push('');
  }
  
  if (appeal.checkResult) {
    lines.push('【审核结果】');
    lines.push('─'.repeat(60));
    lines.push(appeal.checkResult);
    if (appeal.revertedAmount !== undefined && appeal.revertedAmount > 0) {
      lines.push(`退回金额:   ¥${appeal.revertedAmount.toFixed(2)}`);
    }
    lines.push('');
  }
  
  if (corrections.length > 0) {
    lines.push('【人工修正记录】');
    lines.push('─'.repeat(60));
    corrections.forEach((corr, idx) => {
      lines.push(`[${idx + 1}] 操作员: ${corr.operator}`);
      lines.push(`    时间: ${new Date(corr.createTime).toLocaleString()}`);
      lines.push(`    状态变化: ${corr.beforeStatus} -> ${corr.afterStatus}`);
      lines.push(`    金额变化: ¥${(corr.beforeRevertedAmount || 0).toFixed(2)} -> ¥${(corr.afterRevertedAmount || 0).toFixed(2)}`);
      lines.push(`    修正原因: ${corr.reason}`);
      lines.push('');
    });
  }
  
  lines.push('【申诉历史】');
  lines.push('─'.repeat(60));
  history.forEach((h, idx) => {
    const time = new Date(h.createTime).toLocaleString();
    const statusChange = h.fromStatus && h.toStatus ? ` [${h.fromStatus} -> ${h.toStatus}]` : '';
    const op = h.operator ? ` (${h.operator})` : '';
    lines.push(`[${idx + 1}] ${time}${op} | ${h.action}${statusChange}`);
    if (h.details) {
      lines.push(`    ${h.details}`);
    }
  });
  
  lines.push('');
  lines.push('─'.repeat(60));
  lines.push(`报告生成时间: ${new Date().toLocaleString()}`);
  
  return lines.join('\n');
}

export async function exportReportToFile(appealId: string, format: 'text' | 'json' = 'text'): Promise<string> {
  const content = await generateReport(appealId, format);
  const reportsDir = getReportsDir();
  const ext = format === 'json' ? 'json' : 'txt';
  const fileName = `appeal-${appealId}-${Date.now()}.${ext}`;
  const filePath = path.join(reportsDir, fileName);
  
  fs.writeFileSync(filePath, content, 'utf-8');
  return filePath;
}
