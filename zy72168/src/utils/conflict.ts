import type { Feedback, ConflictEvidence } from '@/types';

export function detectConflicts(feedbacks: Feedback[]): Feedback[] {
  const conflicts: Feedback[] = [];
  const pointTimeMap = new Map<string, Feedback[]>();
  for (const feedback of feedbacks) {
    const key = `${feedback.pointId}-${feedback.timePeriod}`;
    if (!pointTimeMap.has(key)) {
      pointTimeMap.set(key, []);
    }
    pointTimeMap.get(key)!.push(feedback);
  }
  for (const [, group] of pointTimeMap) {
    const meetingFeedbacks = group.filter(f => f.type === 'meeting');
    const importFeedbacks = group.filter(f => f.type === 'import');
    for (const meeting of meetingFeedbacks) {
      for (const imp of importFeedbacks) {
        if (meeting.content !== imp.content && !meeting.hasConflict) {
          const conflictEvidence = generateConflictEvidence(meeting, imp);
          conflicts.push({
            ...meeting,
            hasConflict: true,
            conflictWith: imp.id,
            conflictEvidence,
          });
          conflicts.push({
            ...imp,
            hasConflict: true,
            conflictWith: meeting.id,
            conflictEvidence,
          });
        }
      }
    }
  }
  return conflicts;
}

export function generateConflictEvidence(meeting: Feedback, imp: Feedback): ConflictEvidence {
  const suggestedActions: string[] = [];
  const meetingTime = meeting.content.match(/(\d{1,2}点)/g);
  const importTime = imp.content.match(/(\d{1,2}点)/g);
  if (meetingTime && importTime && meetingTime.join(',') !== importTime.join(',')) {
    suggestedActions.push('建议查阅原始施工批复文件确认时间');
  }
  if (meeting.content.includes('单向') && imp.content.includes('双向')) {
    suggestedActions.push('建议联系施工负责人核实通行方案');
  }
  suggestedActions.push('建议24小时内到现场复核实际情况');
  return {
    meetingContent: meeting.content,
    systemContent: imp.content,
    suggestedActions,
  };
}

export function resolveConflict(
  feedback: Feedback,
  decision: 'accept_meeting' | 'accept_system' | 'custom',
  note: string
): Feedback {
  return {
    ...feedback,
    hasConflict: false,
    conflictWith: undefined,
    conflictEvidence: undefined,
    status: 'resolved',
    content: decision === 'custom' ? note : feedback.content,
  };
}

export function detectEmptyValues(feedback: Feedback): string[] {
  const emptyFields: string[] = [];
  if (!feedback.title || feedback.title.trim() === '') {
    emptyFields.push('title');
  }
  if (!feedback.content || feedback.content.trim() === '') {
    emptyFields.push('content');
  }
  if (!feedback.reporter || feedback.reporter.trim() === '') {
    emptyFields.push('reporter');
  }
  return emptyFields;
}

export function isBoundaryRecord(feedback: Feedback): boolean {
  if (feedback.timePeriod === 'night') return true;
  if (feedback.hasEmptyValue && feedback.emptyFields && feedback.emptyFields.length >= 2) return true;
  if (feedback.type === 'import' && !feedback.reporter) return true;
  return false;
}
