import { getDB } from '../db';
import { logHistory } from './historyService';
import { updateMilestoneStatus, updateMilestoneDate, getMilestoneById, getChildMilestones } from './milestoneService';

export type ExtensionStatus = 'pending' | 'approved' | 'rejected';

export interface ExtensionRequest {
  id?: number;
  milestone_id: number;
  requested_by: string;
  reviewed_by?: string;
  original_date: string;
  requested_date: string;
  reason: string;
  impact_scope: string;
  status?: ExtensionStatus;
  review_comment?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ValidationError {
  field: string;
  message: string;
}

export async function validateExtensionRequest(req: Omit<ExtensionRequest, 'id' | 'status' | 'created_at' | 'updated_at'>): Promise<ValidationError[]> {
  const errors: ValidationError[] = [];
  
  if (!req.milestone_id) {
    errors.push({ field: 'milestone_id', message: '里程碑ID不能为空' });
  }
  
  if (!req.requested_by) {
    errors.push({ field: 'requested_by', message: '申请人不能为空' });
  }
  
  if (!req.requested_date) {
    errors.push({ field: 'requested_date', message: '申请延期日期不能为空' });
  }
  
  if (!req.reason || req.reason.length < 5) {
    errors.push({ field: 'reason', message: '延期原因至少5个字符' });
  }
  
  if (!req.impact_scope || req.impact_scope.length < 5) {
    errors.push({ field: 'impact_scope', message: '影响范围至少5个字符' });
  }
  
  const milestone = await getMilestoneById(req.milestone_id);
  if (!milestone) {
    errors.push({ field: 'milestone_id', message: '里程碑不存在' });
    return errors;
  }
  
  if (new Date(req.requested_date) <= new Date(milestone.planned_date)) {
    errors.push({ field: 'requested_date', message: '延期日期必须晚于原计划日期' });
  }
  
  return errors;
}

export async function createExtensionRequest(req: Omit<ExtensionRequest, 'id' | 'status' | 'original_date' | 'created_at' | 'updated_at'>): Promise<{ success: boolean; id?: number; errors?: ValidationError[] }> {
  const milestone = await getMilestoneById(req.milestone_id);
  if (!milestone) {
    return { success: false, errors: [{ field: 'milestone_id', message: '里程碑不存在' }] };
  }
  
  const fullReq = { ...req, original_date: milestone.planned_date };
  const errors = await validateExtensionRequest(fullReq);
  if (errors.length > 0) {
    return { success: false, errors };
  }
  
  const db = await getDB();
  const result = await db.run(
    `INSERT INTO extension_requests (milestone_id, requested_by, original_date, requested_date, reason, impact_scope, status)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    req.milestone_id, req.requested_by, milestone.planned_date, req.requested_date, req.reason, req.impact_scope, 'pending'
  );
  
  await updateMilestoneStatus(req.milestone_id, 'extension_requested', req.requested_by, '提交延期申请');
  
  await logHistory({
    entity_type: 'extension_request',
    entity_id: result.lastID!,
    action: 'create',
    performed_by: req.requested_by,
    comment: '提交延期申请'
  });
  
  return { success: true, id: result.lastID! };
}

export async function reviewExtensionRequest(id: number, status: 'approved' | 'rejected', reviewedBy: string, comment: string): Promise<{ success: boolean; errors?: string[] }> {
  const db = await getDB();
  const request = await db.get<ExtensionRequest>('SELECT * FROM extension_requests WHERE id = ?', id);
  
  if (!request) {
    return { success: false, errors: ['申请不存在'] };
  }
  
  if (request.status !== 'pending') {
    return { success: false, errors: ['申请已处理，不能重复审核'] };
  }
  
  await db.run(
    'UPDATE extension_requests SET status = ?, reviewed_by = ?, review_comment = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    status, reviewedBy, comment, id
  );
  
  if (status === 'approved') {
    await updateMilestoneDate(request.milestone_id, request.requested_date, reviewedBy, '延期申请获批，更新计划日期');
    await updateMilestoneStatus(request.milestone_id, 'confirmed', reviewedBy, '延期申请已确认');
    
    const children = await getChildMilestones(request.milestone_id);
    for (const child of children) {
      if (child.id && new Date(child.planned_date) < new Date(request.requested_date)) {
        await logHistory({
          entity_type: 'milestone',
          entity_id: child.id,
          action: 'warning',
          field_name: 'planned_date',
          old_value: child.planned_date,
          new_value: request.requested_date,
          performed_by: reviewedBy,
          comment: `父里程碑已延期至 ${request.requested_date}，子任务日期未同步，需关注`
        });
      }
    }
  } else {
    await updateMilestoneStatus(request.milestone_id, 'in_progress', reviewedBy, '延期申请被驳回');
  }
  
  await logHistory({
    entity_type: 'extension_request',
    entity_id: id,
    action: status === 'approved' ? 'approve' : 'reject',
    performed_by: reviewedBy,
    comment
  });
  
  return { success: true };
}

export async function getExtensionById(id: number): Promise<ExtensionRequest | undefined> {
  const db = await getDB();
  return db.get<ExtensionRequest>('SELECT * FROM extension_requests WHERE id = ?', id);
}

export async function getExtensionsByMilestone(milestoneId: number): Promise<ExtensionRequest[]> {
  const db = await getDB();
  return db.all<ExtensionRequest[]>('SELECT * FROM extension_requests WHERE milestone_id = ? ORDER BY created_at DESC', milestoneId);
}

export async function getAllExtensions(): Promise<ExtensionRequest[]> {
  const db = await getDB();
  return db.all<ExtensionRequest[]>('SELECT * FROM extension_requests ORDER BY created_at DESC');
}
