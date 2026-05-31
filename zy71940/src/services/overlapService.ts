import type { TransitWindow, Conflict } from '@/types';
import { generateId, formatDuration } from '@/utils/timeUtils';

export function detectOverlaps(windows: TransitWindow[]): Conflict[] {
  const conflicts: Conflict[] = [];
  const activeWindows = windows.filter(w => w.status !== 'RESOLVED');
  
  for (let i = 0; i < activeWindows.length; i++) {
    for (let j = i + 1; j < activeWindows.length; j++) {
      const w1 = activeWindows[i];
      const w2 = activeWindows[j];
      
      const overlapStart = Math.max(
        new Date(w1.startTime).getTime(),
        new Date(w2.startTime).getTime()
      );
      const overlapEnd = Math.min(
        new Date(w1.endTime).getTime(),
        new Date(w2.endTime).getTime()
      );
      
      if (overlapStart < overlapEnd) {
        const overlapDuration = overlapEnd - overlapStart;
        conflicts.push({
          id: generateId(),
          windowId1: w1.id,
          windowId2: w2.id,
          type: 'OVERLAP',
          reason: `窗口[${w1.satelliteName}]与[${w2.satelliteName}]发生时间重叠，重叠时长为${formatDuration(overlapDuration)}`,
          suggestion: '建议根据任务优先级调整窗口时间，或合并相关任务执行',
          nextStep: '请联系任务规划人员复核窗口安排，确认资源调度可行性',
          status: 'DETECTED',
          detectedAt: new Date().toISOString(),
          overlapDuration
        });
      }
    }
  }
  
  return conflicts;
}

export function detectTimeFormatMix(windows: TransitWindow[]): Conflict[] {
  const conflicts: Conflict[] = [];
  const timeSystems = new Set(windows.map(w => w.timeSystem));
  
  if (timeSystems.size > 1) {
    const mixedWindows = windows.filter(w => w.timeSource !== 'MANUAL');
    
    mixedWindows.forEach(window => {
      const otherSystems = Array.from(timeSystems).filter(s => s !== window.timeSystem);
      const sourceText = window.timeSource === 'ORBIT' ? '轨道根数计算' : '遥测数据接收';
      const contactRole = window.timeSource === 'ORBIT' ? '轨道计算工程师' : '遥测接收人员';
      
      conflicts.push({
        id: generateId(),
        windowId1: window.id,
        type: 'TIME_FORMAT_MIX',
        reason: `检测到时间制式混合。当前窗口使用${window.timeSystem}制式，系统中同时存在${otherSystems.join('/')}制式`,
        suggestion: `该时间数据来源于${sourceText}，建议统一所有窗口到同一时间制式后再进行规划`,
        nextStep: `请联系${contactRole}确认数据时间基准，补全正确的时间戳信息`,
        status: 'DETECTED',
        detectedAt: new Date().toISOString()
      });
    });
  }
  
  return conflicts;
}

export function detectAllConflicts(windows: TransitWindow[]): Conflict[] {
  const overlapConflicts = detectOverlaps(windows);
  const timeFormatConflicts = detectTimeFormatMix(windows);
  return [...overlapConflicts, ...timeFormatConflicts];
}

export function getConflictsForWindow(conflicts: Conflict[], windowId: string): Conflict[] {
  return conflicts.filter(c => 
    c.windowId1 === windowId || c.windowId2 === windowId
  );
}

export function hasUnresolvedConflicts(conflicts: Conflict[]): boolean {
  return conflicts.some(c => c.status === 'DETECTED');
}
