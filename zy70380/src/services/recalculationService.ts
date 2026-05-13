import { v4 as uuidv4 } from 'uuid';
import { 
  RecalculationTask, 
  RecalculationSummary, 
  MemberRecalculationResult, 
  RecalculationDetailSource,
  CompensationAdjustment 
} from '../types';
import { getDbOne, getDbAll, runDb } from '../database';
import { getPointRuleVersionById } from './pointRuleService';
import { getTransactionsByMemberId } from './transactionService';
import { getPointLogsByTransactionId, createPointLog } from './pointLogService';
import { getTotalLockedPoints } from './redemptionService';
import { getAllMembers } from './memberService';

function dbRowToRecalculationTask(row: any): RecalculationTask {
  return {
    id: row.id,
    name: row.name,
    description: row.description || '',
    ruleVersionId: row.rule_version_id,
    memberIds: row.member_ids ? JSON.parse(row.member_ids) : undefined,
    startTime: row.start_time || undefined,
    endTime: row.end_time || undefined,
    status: row.status,
    totalMembers: row.total_members,
    processedMembers: row.processed_members,
    progress: row.progress,
    summary: row.summary ? JSON.parse(row.summary) : undefined,
    createdAt: row.created_at,
    completedAt: row.completed_at || undefined
  };
}

function dbRowToMemberRecalculationResult(row: any): MemberRecalculationResult {
  return {
    taskId: row.task_id,
    memberId: row.member_id,
    originalPoints: row.original_points,
    newPoints: row.new_points,
    difference: row.difference,
    lockedPoints: row.locked_points,
    netDifference: row.net_difference,
    status: row.status,
    detailSources: JSON.parse(row.detail_sources),
    createdAt: row.created_at
  };
}

function dbRowToCompensationAdjustment(row: any): CompensationAdjustment {
  return {
    id: row.id,
    taskId: row.task_id,
    memberId: row.member_id,
    amount: row.amount,
    type: row.type,
    status: row.status,
    pointLogId: row.point_log_id || undefined,
    reason: row.reason,
    createdAt: row.created_at,
    approvedAt: row.approved_at || undefined,
    rejectedAt: row.rejected_at || undefined
  };
}

export async function getRecalculationTaskById(id: string): Promise<RecalculationTask | undefined> {
  const row = await getDbOne('SELECT * FROM recalculation_tasks WHERE id = ?', [id]);
  return row ? dbRowToRecalculationTask(row) : undefined;
}

export async function findExistingRecalculationTask(
  ruleVersionId: string,
  memberIds?: string[],
  startTime?: string,
  endTime?: string
): Promise<RecalculationTask | undefined> {
  let sql = `
    SELECT * FROM recalculation_tasks 
    WHERE rule_version_id = ? 
    AND status IN ('processing', 'completed')
  `;
  const params: any[] = [ruleVersionId];
  
  if (startTime) {
    sql += ' AND start_time = ?';
    params.push(startTime);
  } else {
    sql += ' AND start_time IS NULL';
  }
  
  if (endTime) {
    sql += ' AND end_time = ?';
    params.push(endTime);
  } else {
    sql += ' AND end_time IS NULL';
  }
  
  if (memberIds && memberIds.length > 0) {
    sql += ' AND member_ids = ?';
    params.push(JSON.stringify(memberIds));
  } else {
    sql += ' AND member_ids IS NULL';
  }
  
  const rows = await getDbAll(sql, params);
  return rows.length > 0 ? dbRowToRecalculationTask(rows[0]) : undefined;
}

export async function getMemberRecalculationResult(taskId: string, memberId: string): Promise<MemberRecalculationResult | undefined> {
  const row = await getDbOne(
    'SELECT * FROM member_recalculation_results WHERE task_id = ? AND member_id = ?',
    [taskId, memberId]
  );
  return row ? dbRowToMemberRecalculationResult(row) : undefined;
}

export async function getMemberRecalculationResultsByTaskId(taskId: string): Promise<MemberRecalculationResult[]> {
  const rows = await getDbAll(
    'SELECT * FROM member_recalculation_results WHERE task_id = ?',
    [taskId]
  );
  return rows.map(dbRowToMemberRecalculationResult);
}

export async function getCompensationAdjustmentsByTaskId(taskId: string): Promise<CompensationAdjustment[]> {
  const rows = await getDbAll(
    'SELECT * FROM compensation_adjustments WHERE task_id = ?',
    [taskId]
  );
  return rows.map(dbRowToCompensationAdjustment);
}

export async function getCompensationAdjustmentById(id: string): Promise<CompensationAdjustment | undefined> {
  const row = await getDbOne('SELECT * FROM compensation_adjustments WHERE id = ?', [id]);
  return row ? dbRowToCompensationAdjustment(row) : undefined;
}

export async function createRecalculationTask(
  name: string,
  ruleVersionId: string,
  description?: string,
  memberIds?: string[],
  startTime?: string,
  endTime?: string
): Promise<RecalculationTask> {
  const ruleVersion = await getPointRuleVersionById(ruleVersionId);
  if (!ruleVersion) {
    throw new Error('Point rule version not found');
  }
  if (!ruleVersion.isFrozen) {
    throw new Error('Point rule version must be frozen before creating recalculation task');
  }
  
  const existingTask = await findExistingRecalculationTask(ruleVersionId, memberIds, startTime, endTime);
  if (existingTask) {
    return existingTask;
  }
  
  let membersToProcess = memberIds && memberIds.length > 0
    ? memberIds
    : (await getAllMembers()).map(m => m.id);
  
  const now = new Date().toISOString();
  const id = uuidv4();
  
  await runDb(
    `INSERT INTO recalculation_tasks 
     (id, name, description, rule_version_id, member_ids, start_time, end_time, status, total_members, processed_members, progress, created_at) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      name,
      description || '',
      ruleVersionId,
      memberIds ? JSON.stringify(memberIds) : null,
      startTime || null,
      endTime || null,
      'pending',
      membersToProcess.length,
      0,
      0,
      now
    ]
  );
  
  const task = await getRecalculationTaskById(id);
  if (!task) {
    throw new Error('Failed to create recalculation task');
  }
  
  return task;
}

export async function executeRecalculationTask(taskId: string): Promise<void> {
  const task = await getRecalculationTaskById(taskId);
  if (!task) {
    throw new Error('Recalculation task not found');
  }
  
  if (task.status !== 'pending') {
    return;
  }
  
  const ruleVersion = await getPointRuleVersionById(task.ruleVersionId);
  if (!ruleVersion) {
    throw new Error('Point rule version not found');
  }
  
  await runDb("UPDATE recalculation_tasks SET status = 'processing' WHERE id = ?", [taskId]);
  
  const members = task.memberIds && task.memberIds.length > 0
    ? task.memberIds
    : (await getAllMembers()).map(m => m.id);
  
  const summary: RecalculationSummary = {
    totalOriginalPoints: 0,
    totalNewPoints: 0,
    totalDifference: 0,
    lockedPoints: 0,
    pendingAdjustment: 0,
    membersWithPositiveDiff: 0,
    membersWithNegativeDiff: 0,
    membersWithLockedPoints: 0
  };
  
  for (let i = 0; i < members.length; i++) {
    const memberId = members[i];
    const transactions = await getTransactionsByMemberId(memberId, task.startTime, task.endTime);
    
    let originalPoints = 0;
    let newPoints = 0;
    const detailSources: RecalculationDetailSource[] = [];
    
    for (const transaction of transactions) {
      const existingLogs = await getPointLogsByTransactionId(transaction.id);
      const transactionOriginalPoints = existingLogs
        .filter(log => log.type === 'earn')
        .reduce((sum, log) => sum + log.amount, 0);
      
      originalPoints += transactionOriginalPoints;
      
      const originalMultiplier = transactionOriginalPoints > 0 
        ? transactionOriginalPoints / transaction.amount 
        : 1;
      
      let newMultiplier = 1;
      const rule = ruleVersion.rules.find(r => r.category === transaction.category);
      if (rule) {
        newMultiplier = rule.multiplier;
      }
      
      const transactionNewPoints = Math.floor(transaction.amount * newMultiplier);
      newPoints += transactionNewPoints;
      
      detailSources.push({
        transactionId: transaction.id,
        originalPoints: transactionOriginalPoints,
        newPoints: transactionNewPoints,
        difference: transactionNewPoints - transactionOriginalPoints,
        category: transaction.category,
        originalMultiplier,
        newMultiplier
      });
    }
    
    const lockedPoints = await getTotalLockedPoints(memberId);
    const difference = newPoints - originalPoints;
    
    let netDifference = difference;
    let resultStatus: 'pending_review' | 'ready' | 'completed' = 'ready';
    
    if (difference < 0) {
      const availablePoints = Math.max(0, originalPoints - lockedPoints);
      
      if (lockedPoints >= originalPoints) {
        netDifference = 0;
        resultStatus = 'ready';
      } else if (Math.abs(difference) > availablePoints) {
        netDifference = -availablePoints;
        resultStatus = 'pending_review';
      } else {
        netDifference = difference;
        resultStatus = 'ready';
      }
    }
    
    const now = new Date().toISOString();
    
    await runDb(
      `INSERT INTO member_recalculation_results 
       (task_id, member_id, original_points, new_points, difference, locked_points, net_difference, status, detail_sources, created_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        taskId,
        memberId,
        originalPoints,
        newPoints,
        difference,
        lockedPoints,
        netDifference,
        resultStatus,
        JSON.stringify(detailSources),
        now
      ]
    );
    
    summary.totalOriginalPoints += originalPoints;
    summary.totalNewPoints += newPoints;
    summary.totalDifference += difference;
    summary.lockedPoints += lockedPoints;
    
    if (lockedPoints > 0) {
      summary.membersWithLockedPoints++;
    }
    
    if (difference > 0) {
      summary.membersWithPositiveDiff++;
    } else if (difference < 0) {
      summary.membersWithNegativeDiff++;
    }
    
    const processedMembers = i + 1;
    const progress = (processedMembers / members.length) * 100;
    
    await runDb(
      `UPDATE recalculation_tasks 
       SET processed_members = ?, progress = ? 
       WHERE id = ?`,
      [processedMembers, progress, taskId]
    );
  }
  
  summary.pendingAdjustment = summary.membersWithNegativeDiff > 0
    ? Math.abs(summary.totalDifference) - summary.lockedPoints
    : 0;
  
  const now = new Date().toISOString();
  await runDb(
    `UPDATE recalculation_tasks 
     SET status = ?, summary = ?, completed_at = ? 
     WHERE id = ?`,
    ['completed', JSON.stringify(summary), now, taskId]
  );
  
  await createPendingAdjustments(taskId);
}

async function createPendingAdjustments(taskId: string): Promise<void> {
  const results = await getMemberRecalculationResultsByTaskId(taskId);
  
  for (const result of results) {
    if (result.status === 'pending_review' && result.difference < 0) {
      const pendingAmount = Math.abs(result.difference) - Math.max(0, result.originalPoints - result.lockedPoints);
      
      if (pendingAmount > 0) {
        const now = new Date().toISOString();
        const id = uuidv4();
        
        await runDb(
          `INSERT INTO compensation_adjustments 
           (id, task_id, member_id, amount, type, status, reason, created_at) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            taskId,
            result.memberId,
            pendingAmount,
            'debit',
            'pending_review',
            '积分重算负差异待审核扣减',
            now
          ]
        );
      }
    }
  }
}

export async function confirmCompensationAdjustment(adjustmentId: string, operator: string): Promise<void> {
  const adjustment = await getCompensationAdjustmentById(adjustmentId);
  if (!adjustment) {
    throw new Error('Compensation adjustment not found');
  }
  
  if (adjustment.status !== 'pending_review') {
    throw new Error('Adjustment is not pending review');
  }
  
  const now = new Date().toISOString();
  
  await runDb(
    `UPDATE compensation_adjustments 
     SET status = ?, approved_at = ? 
     WHERE id = ?`,
    ['approved', now, adjustmentId]
  );
  
  const pointLog = await createPointLog(
    adjustment.memberId,
    adjustment.amount,
    adjustment.type === 'credit' ? 'compensation' : 'adjustment',
    `积分重算补偿调整 - ${operator}`,
    { recalculationTaskId: adjustment.taskId }
  );
  
  await runDb(
    `UPDATE compensation_adjustments 
     SET point_log_id = ? 
     WHERE id = ?`,
    [pointLog.id, adjustmentId]
  );
  
  await checkAndCompleteMemberResult(adjustment.taskId, adjustment.memberId);
}

async function checkAndCompleteMemberResult(taskId: string, memberId: string): Promise<void> {
  const adjustments = await getCompensationAdjustmentsByTaskId(taskId);
  const memberAdjustments = adjustments.filter(a => a.memberId === memberId);
  
  const allApproved = memberAdjustments.every(a => a.status === 'approved');
  
  if (allApproved) {
    await runDb(
      `UPDATE member_recalculation_results 
       SET status = ? 
       WHERE task_id = ? AND member_id = ?`,
      ['completed', taskId, memberId]
    );
  }
}

export async function applyPositiveCompensations(taskId: string): Promise<void> {
  const results = await getMemberRecalculationResultsByTaskId(taskId);
  
  for (const result of results) {
    if (result.status === 'ready' && result.difference > 0) {
      const now = new Date().toISOString();
      const id = uuidv4();
      
      await runDb(
        `INSERT INTO compensation_adjustments 
         (id, task_id, member_id, amount, type, status, reason, created_at, approved_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          taskId,
          result.memberId,
          result.difference,
          'credit',
          'approved',
          '积分重算正向补偿',
          now,
          now
        ]
      );
      
      const pointLog = await createPointLog(
        result.memberId,
        result.difference,
        'compensation',
        '积分重算正向补偿',
        { recalculationTaskId: taskId }
      );
      
      await runDb(
        `UPDATE compensation_adjustments 
         SET point_log_id = ? 
         WHERE id = ?`,
        [pointLog.id, id]
      );
      
      await runDb(
        `UPDATE member_recalculation_results 
         SET status = ? 
         WHERE task_id = ? AND member_id = ?`,
        ['completed', taskId, result.memberId]
      );
    }
  }
}

export async function searchRecalculationTasks(
  params: {
    memberId?: string;
    startTime?: string;
    endTime?: string;
    status?: RecalculationTask['status'];
  }
): Promise<RecalculationTask[]> {
  let sql = 'SELECT * FROM recalculation_tasks WHERE 1=1';
  const queryParams: any[] = [];
  
  if (params.status) {
    sql += ' AND status = ?';
    queryParams.push(params.status);
  }
  
  if (params.startTime) {
    sql += ' AND created_at >= ?';
    queryParams.push(params.startTime);
  }
  
  if (params.endTime) {
    sql += ' AND created_at <= ?';
    queryParams.push(params.endTime);
  }
  
  sql += ' ORDER BY created_at DESC';
  
  const rows = await getDbAll(sql, queryParams);
  let tasks = rows.map(dbRowToRecalculationTask);
  
  if (params.memberId) {
    const results = await getMemberRecalculationResultsByMemberId(params.memberId);
    const taskIds = new Set(results.map(r => r.taskId));
    tasks = tasks.filter(t => taskIds.has(t.id));
  }
  
  return tasks;
}

async function getMemberRecalculationResultsByMemberId(memberId: string): Promise<MemberRecalculationResult[]> {
  const rows = await getDbAll(
    'SELECT * FROM member_recalculation_results WHERE member_id = ?',
    [memberId]
  );
  return rows.map(dbRowToMemberRecalculationResult);
}
