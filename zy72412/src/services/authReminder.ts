import { getDb, saveDb, getNextReminderId } from '../db/database';
import { getTicketById, getTicketsByBatch, getBatchById } from './ticketImporter';
import { AuthReminder, AuthStatus, ReviewRole } from '../types';

export function detectMixedBatches(): string[] {
  const db = getDb();
  return db.ticketBatches
    .filter(b => b.hasMixedTypes && b.reviewStatus === 'new')
    .map(b => b.batchId);
}

export function generateInitialRemindersForBatch(batchId: string): AuthReminder[] {
  const batch = getBatchById(batchId);
  if (!batch) return [];

  const tickets = getTicketsByBatch(batchId);
  const reminders: AuthReminder[] = [];
  const db = getDb();
  const now = new Date().toISOString();

  for (const ticket of tickets) {
    if (!ticket.id) continue;

    let status: AuthStatus = 'pending';
    let reason = '';
    let missingMaterials: string[] = [];
    let nextStep = '';
    let assignee: ReviewRole = 'copyright_operations';

    if (batch.hasMixedTypes) {
      status = 'needs_review';
      reason = `该票所属批次(${batchId})存在赠票与售票混排情况，需录音师复核确认授权边界`;
      missingMaterials = ['录音师复核确认', '音频文件授权备注'];
      nextStep = '请录音师确认该票是否在授权范围内，补充音频文件备注后版权运营可继续处理';
      assignee = 'recording_engineer';
    } else if (ticket.ticketType === 'complimentary') {
      status = 'needs_review';
      reason = '赠票需确认是否在采样包授权范围内';
      missingMaterials = ['赠票授权确认函', '音频文件备注'];
      nextStep = '请版权运营小鹿核对赠票名单，确认是否需要额外授权材料';
      assignee = 'copyright_operations';
    } else {
      status = 'pending';
      reason = '售票待核对音频文件备注';
      missingMaterials = ['音频文件备注'];
      nextStep = '请版权运营小鹿补录音频文件备注信息';
      assignee = 'copyright_operations';
    }

    const existingReminderIdx = db.authReminders.findIndex(r => r.ticketId === ticket.id);
    const reminderId = existingReminderIdx >= 0 ? db.authReminders[existingReminderIdx].id : getNextReminderId();

    const reminder: AuthReminder = {
      id: reminderId,
      ticketId: ticket.id,
      ticketNo: ticket.ticketNo,
      batchId,
      status,
      reason,
      missingMaterials,
      nextStep,
      assignee,
      isRead: false,
      createdAt: existingReminderIdx >= 0 ? db.authReminders[existingReminderIdx].createdAt : now,
      updatedAt: now
    };

    if (existingReminderIdx >= 0) {
      db.authReminders[existingReminderIdx] = reminder;
    } else {
      db.authReminders.push(reminder);
    }

    reminders.push(reminder);

    const ticketIdx = db.tickets.findIndex(t => t.id === ticket.id);
    if (ticketIdx >= 0) {
      db.tickets[ticketIdx].authStatus = status;
      db.tickets[ticketIdx].updatedAt = now;
    }
  }

  const batchIdx = db.ticketBatches.findIndex(b => b.batchId === batchId);
  if (batchIdx >= 0) {
    db.ticketBatches[batchIdx].reviewStatus = 'in_review';
  }

  saveDb();
  return reminders;
}

export function updateReminderAfterAudioRemark(ticketId: number, audioRemark: string): AuthReminder | null {
  const ticket = getTicketById(ticketId);
  if (!ticket || !ticket.id) return null;

  const db = getDb();
  const now = new Date().toISOString();
  const batch = getBatchById(ticket.batchId);

  let newStatus: AuthStatus = 'audio_verified';
  let reason = '';
  let missingMaterials: string[] = [];
  let nextStep = '';
  let assignee: ReviewRole = 'copyright_operations';

  if (batch?.hasMixedTypes) {
    newStatus = 'needs_review';
    reason = `音频备注已补充: "${audioRemark}"，但批次存在混排，仍需录音师最终确认`;
    missingMaterials = ['录音师最终复核确认'];
    nextStep = '请录音师根据音频备注确认该票授权状态';
    assignee = 'recording_engineer';
  } else if (ticket.ticketType === 'complimentary') {
    newStatus = 'audio_verified';
    reason = `音频备注已补充: "${audioRemark}"，赠票待版权运营最终确认`;
    missingMaterials = ['赠票最终授权确认'];
    nextStep = '请版权运营小鹿根据音频备注确认赠票授权';
    assignee = 'copyright_operations';
  } else {
    newStatus = 'audio_verified';
    reason = `音频备注已补充: "${audioRemark}"，售票信息完整`;
    missingMaterials = [];
    nextStep = '授权材料完整，可进入下一流程';
    assignee = 'copyright_operations';
  }

  const ticketIdx = db.tickets.findIndex(t => t.id === ticketId);
  if (ticketIdx >= 0) {
    db.tickets[ticketIdx].audioRemark = audioRemark;
    db.tickets[ticketIdx].authStatus = newStatus;
    db.tickets[ticketIdx].updatedAt = now;
  }

  const reminderIdx = db.authReminders.findIndex(r => r.ticketId === ticketId);
  if (reminderIdx >= 0) {
    db.authReminders[reminderIdx] = {
      ...db.authReminders[reminderIdx],
      status: newStatus,
      reason,
      missingMaterials,
      nextStep,
      assignee,
      updatedAt: now
    };
  }

  saveDb();
  return getReminderByTicketId(ticketId);
}

export function recordingEngineerReview(ticketId: number, approve: boolean, remark: string): AuthReminder | null {
  const ticket = getTicketById(ticketId);
  if (!ticket || !ticket.id) return null;

  const db = getDb();
  const now = new Date().toISOString();

  const newStatus: AuthStatus = approve ? 'approved' : 'rejected';
  const reason = approve 
    ? `录音师复核通过: "${remark}"，授权确认` 
    : `录音师复核驳回: "${remark}"，不在授权范围内`;
  const missingMaterials: string[] = [];
  const nextStep = approve ? '授权已确认，可归档处理' : '需进一步沟通确认或补充材料';
  const assignee: ReviewRole = 'copyright_operations';

  const ticketIdx = db.tickets.findIndex(t => t.id === ticketId);
  if (ticketIdx >= 0) {
    db.tickets[ticketIdx].authStatus = newStatus;
    db.tickets[ticketIdx].updatedAt = now;
  }

  const reminderIdx = db.authReminders.findIndex(r => r.ticketId === ticketId);
  if (reminderIdx >= 0) {
    db.authReminders[reminderIdx] = {
      ...db.authReminders[reminderIdx],
      status: newStatus,
      reason,
      missingMaterials,
      nextStep,
      assignee,
      updatedAt: now
    };
  }

  const ticketIdsInBatch = db.tickets.filter(t => t.batchId === ticket.batchId);
  const allReviewed = ticketIdsInBatch.every(t => 
    t.authStatus === 'approved' || t.authStatus === 'rejected' || t.authStatus === 'audio_verified'
  );

  if (allReviewed) {
    const batchIdx = db.ticketBatches.findIndex(b => b.batchId === ticket.batchId);
    if (batchIdx >= 0) {
      db.ticketBatches[batchIdx].reviewStatus = 'reviewed';
      db.ticketBatches[batchIdx].reviewedBy = 'recording_engineer';
      db.ticketBatches[batchIdx].reviewedAt = now;
    }
  }

  saveDb();
  return getReminderByTicketId(ticketId);
}

export function getReminderByTicketId(ticketId: number): AuthReminder | null {
  const db = getDb();
  const reminder = db.authReminders.find(r => r.ticketId === ticketId);
  return reminder || null;
}

export function getRemindersByAssignee(assignee: ReviewRole): AuthReminder[] {
  const db = getDb();
  return db.authReminders
    .filter(r => r.assignee === assignee && !r.isRead)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function getAllReminders(): AuthReminder[] {
  const db = getDb();
  return [...db.authReminders]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function markReminderRead(reminderId: number): boolean {
  const db = getDb();
  const idx = db.authReminders.findIndex(r => r.id === reminderId);
  if (idx >= 0) {
    db.authReminders[idx].isRead = true;
    saveDb();
    return true;
  }
  return false;
}
