import { Conflict, PriorityRule, Schedule } from '../types';
import { priorityRuleStorage, scheduleStorage } from '../storage';

function isTimeOverlap(start1: string, end1: string, start2: string, end2: string): boolean {
  const s1 = new Date(start1).getTime();
  const e1 = new Date(end1).getTime();
  const s2 = new Date(start2).getTime();
  const e2 = new Date(end2).getTime();
  return s1 < e2 && s2 < e1;
}

export function findConflicts(newSchedule: Schedule, existingSchedules: Schedule[] = scheduleStorage.getAll()): Conflict[] {
  const conflicts: Conflict[] = [];
  
  const activeSchedules = existingSchedules.filter(s => 
    s.id !== newSchedule.id && 
    s.status !== 'CANCELLED' && 
    s.status !== 'REJECTED'
  );

  for (const screenId of newSchedule.screenIds) {
    const screenSchedules = activeSchedules.filter(s => s.screenIds.includes(screenId));
    
    for (const existing of screenSchedules) {
      if (isTimeOverlap(newSchedule.startTime, newSchedule.endTime, existing.startTime, existing.endTime)) {
        const newPriority = newSchedule.priority;
        const existingPriority = existing.priority;
        
        if (newPriority <= existingPriority) {
          conflicts.push({
            schedule1: newSchedule,
            schedule2: existing,
            screenId,
            type: 'PRIORITY_CONFLICT',
            description: `时间冲突：新排期优先级(${newPriority})不高于已有排期(${existingPriority})`
          });
        } else if (!newSchedule.isEmergency) {
          conflicts.push({
            schedule1: newSchedule,
            schedule2: existing,
            screenId,
            type: 'TIME_OVERLAP',
            description: `时间重叠：需确认是否可覆盖（优先级：${newPriority} > ${existingPriority}）`
          });
        }
      }
    }
  }
  
  return conflicts;
}

export function calculatePriority(isEmergency: boolean, contentType?: string, rules: PriorityRule[] = priorityRuleStorage.getAll()): number {
  if (isEmergency) {
    const emergencyRule = rules.find(r => r.isEmergency && (!contentType || r.contentType === contentType));
    if (emergencyRule) return emergencyRule.priority;
    const anyEmergency = rules.find(r => r.isEmergency);
    if (anyEmergency) return anyEmergency.priority;
    return 100;
  }
  
  const matchingRule = rules.find(r => !r.isEmergency && r.contentType === contentType);
  if (matchingRule) return matchingRule.priority;
  
  const defaultRule = rules.find(r => !r.isEmergency && !r.contentType);
  return defaultRule?.priority || 20;
}

export function validateSchedule(schedule: Schedule): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!schedule.contentId) {
    errors.push('必须选择内容');
  }
  if (!schedule.screenIds || schedule.screenIds.length === 0) {
    errors.push('必须选择至少一个屏幕');
  }
  if (!schedule.startTime) {
    errors.push('必须设置开始时间');
  }
  if (!schedule.endTime) {
    errors.push('必须设置结束时间');
  }
  if (new Date(schedule.startTime) >= new Date(schedule.endTime)) {
    errors.push('结束时间必须晚于开始时间');
  }
  if (new Date(schedule.endTime) < new Date()) {
    errors.push('结束时间不能早于当前时间');
  }
  
  return { valid: errors.length === 0, errors };
}
