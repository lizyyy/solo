import { NoteCard, Measure, ValidationResult, WorkSlot, ErrorType } from '../types';

export function calculateMeasureBeats(slots: WorkSlot[]): number {
  return slots.reduce((total, slot) => {
    if (slot.assignedNote) {
      return total + slot.assignedNote.duration;
    }
    return total;
  }, 0);
}

export function validateNotePlacement(
  note: NoteCard,
  targetSlot: WorkSlot,
  measure: Measure,
  allSlots: WorkSlot[]
): ValidationResult {
  if (targetSlot.assignedNote) {
    return {
      isValid: false,
      errorType: 'slot-occupied',
      errorMessage: `工位 ${targetSlot.slotIndex + 1} 已经有音符了，请选择其他工位`,
      affectedElement: `slot-${targetSlot.id}`
    };
  }

  if (targetSlot.isFixed) {
    return {
      isValid: false,
      errorType: 'slot-occupied',
      errorMessage: `这是固定工位，不能放置音符`,
      affectedElement: `slot-${targetSlot.id}`
    };
  }

  const otherSlots = allSlots.filter(s => s.id !== targetSlot.id);
  const newBeats = calculateMeasureBeats([...otherSlots, { ...targetSlot, assignedNote: note }]);

  if (newBeats > measure.targetBeats) {
    const overflow = newBeats - measure.targetBeats;
    return {
      isValid: false,
      errorType: 'measure-overflow',
      errorMessage: `小节超拍！放入${note.name}后超出 ${overflow} 拍，当前小节已有 ${calculateMeasureBeats(otherSlots)} 拍，目标是 ${measure.targetBeats} 拍`,
      affectedElement: `measure-${measure.id}`
    };
  }

  if (note.hasDot && note.duration > measure.targetBeats) {
    return {
      isValid: false,
      errorType: 'dot-misplaced',
      errorMessage: `附点${note.name.replace('附点', '')}时值太长，不适合放在这个小节`,
      affectedElement: `note-${note.id}`
    };
  }

  if (note.isRest && !needsRest(measure, allSlots)) {
    return {
      isValid: true,
      errorMessage: `休止符放置成功，但请确认是否需要休止符来填满节拍`
    };
  }

  return {
    isValid: true,
    errorMessage: `放置成功！${note.name}已放入工位 ${targetSlot.slotIndex + 1}`
  };
}

function needsRest(measure: Measure, slots: WorkSlot[]): boolean {
  const currentBeats = calculateMeasureBeats(slots);
  const remainingBeats = measure.targetBeats - currentBeats;
  return remainingBeats > 0;
}

export function validateMeasureComplete(measure: Measure): ValidationResult {
  const currentBeats = calculateMeasureBeats(measure.slots);
  const filledSlots = measure.slots.filter(s => s.assignedNote !== null);
  const hasRest = filledSlots.some(s => s.assignedNote?.isRest);

  if (currentBeats < measure.targetBeats) {
    const missingBeats = measure.targetBeats - currentBeats;
    return {
      isValid: false,
      errorType: 'rest-missed',
      errorMessage: `第 ${measure.index + 1} 小节还缺 ${missingBeats} 拍！`,
      affectedElement: `measure-${measure.id}`
    };
  }

  if (currentBeats > measure.targetBeats) {
    const overflow = currentBeats - measure.targetBeats;
    return {
      isValid: false,
      errorType: 'measure-overflow',
      errorMessage: `第 ${measure.index + 1} 小节超拍 ${overflow} 拍！`,
      affectedElement: `measure-${measure.id}`
    };
  }

  return {
    isValid: true,
    errorMessage: `第 ${measure.index + 1} 小节完成！`
  };
}

export function getErrorMessageByType(errorType: ErrorType): string {
  const messages: Record<ErrorType, string> = {
    'dot-misplaced': '附点音符放置位置不正确',
    'rest-missed': '缺少必要的休止符',
    'measure-overflow': '小节拍数超出',
    'wrong-duration': '时值组合不正确',
    'slot-occupied': '工位已被占用'
  };
  return messages[errorType] || '未知错误';
}

export function calculateScore(
  measures: Measure[],
  actionHistory: { validation: { isValid: boolean } }[]
): { score: number; accuracy: number; stars: number } {
  const validActions = actionHistory.filter(a => a.validation.isValid).length;
  const totalActions = actionHistory.length || 1;
  const accuracy = Math.round((validActions / totalActions) * 100);

  const allMeasuresComplete = measures.every(m => {
    const beats = calculateMeasureBeats(m.slots);
    return beats === m.targetBeats;
  });

  let baseScore = 0;
  if (allMeasuresComplete) {
    baseScore = 100;
  } else {
    const completedMeasures = measures.filter(m => {
      const beats = calculateMeasureBeats(m.slots);
      return beats === m.targetBeats;
    }).length;
    baseScore = Math.round((completedMeasures / measures.length) * 80);
  }

  const accuracyBonus = Math.round(accuracy * 0.2);
  const finalScore = Math.min(baseScore + accuracyBonus, 100);

  let stars = 0;
  if (finalScore >= 90) stars = 3;
  else if (finalScore >= 70) stars = 2;
  else if (finalScore >= 50) stars = 1;

  return { score: finalScore, accuracy, stars };
}
