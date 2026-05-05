import { getDb, ValidationIssue, ReviewConclusion } from '../db';

export interface ReviewOptions {
  list?: boolean;
  issueId?: number;
  conclusion?: string;
  decision?: string;
  reviewer?: string;
  notes?: string;
  batch?: string;
  unresolved?: boolean;
}

interface IssueWithConclusion extends ValidationIssue {
  conclusion?: string;
  decision?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNotes?: string;
}

export async function reviewData(options: ReviewOptions): Promise<void> {
  const db = getDb();

  if (options.list) {
    await listIssues(db, options.batch, options.unresolved);
    return;
  }

  if (options.issueId) {
    if (!options.conclusion || !options.decision || !options.reviewer) {
      console.error('错误: 添加结论需要提供 --conclusion、--decision 和 --reviewer 参数');
      console.error('可用的 decision 值: accept, reject, pending, resolved');
      process.exit(1);
    }

    const validDecisions = ['accept', 'reject', 'pending', 'resolved'];
    if (!validDecisions.includes(options.decision)) {
      console.error(`错误: 无效的 decision 值 "${options.decision}"，有效值为: ${validDecisions.join(', ')}`);
      process.exit(1);
    }

    await addConclusion(db, options);
    return;
  }

  console.log('Review 命令使用方法:');
  console.log('');
  console.log('  列出所有验证问题:');
  console.log('    puppet review --list [--batch <批次号>] [--unresolved]');
  console.log('');
  console.log('  为问题添加人工结论:');
  console.log('    puppet review --issue-id <问题ID> --conclusion <结论> --decision <决策> --reviewer <审核人> [--notes <备注>]');
  console.log('');
  console.log('  决策类型 (--decision):');
  console.log('    accept   - 接受/放行');
  console.log('    reject   - 拒绝/召回');
  console.log('    pending  - 待进一步确认');
  console.log('    resolved - 问题已解决');
  console.log('');
}

async function listIssues(db: any, batch?: string, unresolved?: boolean): Promise<void> {
  let query = `
    SELECT 
      vi.*,
      rc.conclusion,
      rc.decision,
      rc.reviewed_by as reviewedBy,
      rc.reviewed_at as reviewedAt,
      rc.notes as reviewNotes
    FROM validation_issues vi
    LEFT JOIN review_conclusions rc ON vi.id = rc.validation_issue_id
  `;
  const params: string[] = [];
  const conditions: string[] = [];

  if (batch) {
    conditions.push('vi.validation_batch = ?');
    params.push(batch);
  }

  if (unresolved) {
    conditions.push('rc.id IS NULL');
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' ORDER BY vi.severity = "high" DESC, vi.severity = "medium" DESC, vi.created_at ASC';

  const issues = db.prepare(query).all(...params) as IssueWithConclusion[];

  if (issues.length === 0) {
    console.log('没有找到验证问题');
    return;
  }

  console.log('='.repeat(80));
  console.log(`验证问题列表 (共 ${issues.length} 个)`);
  console.log('='.repeat(80));

  for (const issue of issues) {
    const severityColor = issue.severity === 'high' ? '🔴 高' :
                         issue.severity === 'medium' ? '🟡 中' : '🟢 低';
    const status = issue.conclusion ? `[已审核: ${issue.decision}]` : '[待审核]';
    
    console.log('');
    console.log(`[ID: ${issue.id}] ${severityColor} - ${issue.issueType} ${status}`);
    console.log(`  描述: ${issue.description}`);
    console.log(`  批次: ${issue.validationBatch}`);
    console.log(`  创建时间: ${issue.createdAt}`);
    
    if (issue.relatedItem) console.log(`  相关物品: ${issue.relatedItem}`);
    if (issue.relatedBox) console.log(`  相关箱号: ${issue.relatedBox}`);
    if (issue.relatedShow) console.log(`  相关演出: ${issue.relatedShow}`);
    if (issue.relatedVehicle) console.log(`  相关车辆: ${issue.relatedVehicle}`);

    if (issue.conclusion) {
      console.log('');
      console.log('  --- 审核结论 ---');
      console.log(`  决策: ${formatDecision(issue.decision || '')}`);
      console.log(`  结论: ${issue.conclusion}`);
      console.log(`  审核人: ${issue.reviewedBy}`);
      console.log(`  审核时间: ${issue.reviewedAt}`);
      if (issue.reviewNotes) console.log(`  备注: ${issue.reviewNotes}`);
    }

    console.log('  ' + '-'.repeat(60));
  }

  const stats = {
    total: issues.length,
    pending: issues.filter(i => !i.conclusion).length,
    accept: issues.filter(i => i.decision === 'accept').length,
    reject: issues.filter(i => i.decision === 'reject').length,
    resolved: issues.filter(i => i.decision === 'resolved').length
  };

  console.log('');
  console.log('='.repeat(80));
  console.log('统计汇总:');
  console.log(`  总数: ${stats.total}`);
  console.log(`  待审核: ${stats.pending}`);
  console.log(`  已接受: ${stats.accept}`);
  console.log(`  已拒绝: ${stats.reject}`);
  console.log(`  已解决: ${stats.resolved}`);
  console.log('='.repeat(80));
}

async function addConclusion(db: any, options: ReviewOptions): Promise<void> {
  const { issueId, conclusion, decision, reviewer, notes = '' } = options;

  const issue = db.prepare(`
    SELECT * FROM validation_issues WHERE id = ?
  `).get(issueId) as ValidationIssue;

  if (!issue) {
    console.error(`错误: 未找到 ID 为 ${issueId} 的验证问题`);
    process.exit(1);
  }

  const existingReview = db.prepare(`
    SELECT * FROM review_conclusions WHERE validation_issue_id = ?
  `).get(issueId);

  const reviewedAt = new Date().toISOString();

  if (existingReview) {
    db.prepare(`
      UPDATE review_conclusions
      SET conclusion = ?, decision = ?, reviewed_by = ?, reviewed_at = ?, notes = ?
      WHERE validation_issue_id = ?
    `).run(conclusion, decision, reviewer, reviewedAt, notes, issueId);
    console.log(`已更新问题 #${issueId} 的审核结论`);
  } else {
    db.prepare(`
      INSERT INTO review_conclusions 
      (validation_issue_id, conclusion, decision, reviewed_by, reviewed_at, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(issueId, conclusion, decision, reviewer, reviewedAt, notes);
    console.log(`已为问题 #${issueId} 添加审核结论`);
  }

  const severityLabel = issue.severity === 'high' ? '🔴 高' :
                       issue.severity === 'medium' ? '🟡 中' : '🟢 低';

  console.log('');
  console.log('问题详情:');
  console.log(`  ID: ${issueId}`);
  console.log(`  类型: ${issue.issueType}`);
  console.log(`  严重程度: ${severityLabel}`);
  console.log(`  描述: ${issue.description}`);
  console.log('');
  console.log('审核结论:');
  console.log(`  决策: ${formatDecision(decision || '')}`);
  console.log(`  结论: ${conclusion}`);
  console.log(`  审核人: ${reviewer}`);
  console.log(`  审核时间: ${reviewedAt}`);
  if (notes) console.log(`  备注: ${notes}`);
}

function formatDecision(decision: string): string {
  const map: Record<string, string> = {
    'accept': '✅ 接受/放行',
    'reject': '❌ 拒绝/召回',
    'pending': '⏳ 待确认',
    'resolved': '✔️ 已解决'
  };
  return map[decision] || decision;
}
