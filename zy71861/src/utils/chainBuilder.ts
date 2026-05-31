import { 
  StudentMistake, 
  LectureSnapshot, 
  ManualCorrection, 
  Commentary, 
  EvidenceChain, 
  TimelineNode,
  ImportResult,
  Difficulty
} from '@/types';

const generateId = (): string => {
  return Math.random().toString(36).substring(2, 15);
};

const formatTime = (date: Date): string => {
  return date.toISOString();
};

export const detectDuplicates = (mistakes: StudentMistake[]): Map<string, string[]> => {
  const groups = new Map<string, string[]>();
  
  mistakes.forEach(mistake => {
    const key = `${mistake.studentName}-${mistake.questionId}`;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(mistake.id);
  });
  
  const duplicates = new Map<string, string[]>();
  groups.forEach((ids, key) => {
    if (ids.length > 1) {
      ids.forEach(id => duplicates.set(id, ids.filter(i => i !== id)));
    }
  });
  
  return duplicates;
};

export const detectDifficultyConflicts = (
  mistakes: StudentMistake[],
  corrections: ManualCorrection[]
): string[] => {
  const conflicts: string[] = [];
  const questionDifficulties = new Map<string, Set<Difficulty>>();
  
  mistakes.forEach(mistake => {
    if (!questionDifficulties.has(mistake.questionId)) {
      questionDifficulties.set(mistake.questionId, new Set());
    }
    questionDifficulties.get(mistake.questionId)!.add(mistake.difficulty);
  });
  
  corrections.forEach(correction => {
    const mistake = mistakes.find(m => m.id === correction.mistakeId);
    if (mistake && correction.afterValue !== correction.beforeValue) {
      const difficulties = questionDifficulties.get(mistake.questionId);
      if (difficulties && difficulties.size > 1) {
        if (!conflicts.includes(mistake.id)) {
          conflicts.push(mistake.id);
        }
      }
    }
  });
  
  questionDifficulties.forEach((diffSet, questionId) => {
    if (diffSet.size > 1) {
      const relatedMistakes = mistakes.filter(m => m.questionId === questionId);
      relatedMistakes.forEach(m => {
        if (!conflicts.includes(m.id)) {
          conflicts.push(m.id);
        }
      });
    }
  });
  
  return conflicts;
};

export const buildTimeline = (
  mistake: StudentMistake,
  snapshots: LectureSnapshot[],
  corrections: ManualCorrection[],
  commentaries: Commentary[]
): TimelineNode[] => {
  const nodes: TimelineNode[] = [];
  
  nodes.push({
    id: generateId(),
    type: 'mistake_created',
    title: '学生错题录入',
    description: `${mistake.studentName} 的错题已录入系统，题目编号: ${mistake.questionId}`,
    operator: '系统自动',
    timestamp: mistake.createdAt,
    evidenceRefs: [{
      type: 'image',
      id: mistake.id,
      url: mistake.originalImage
    }]
  });
  
  const relatedSnapshots = snapshots.filter(s => s.questionId === mistake.questionId);
  relatedSnapshots.forEach(snapshot => {
    nodes.push({
      id: generateId(),
      type: 'snapshot_attached',
      title: snapshot.isLate ? '晚到讲义截图已附加' : '讲义截图已附加',
      description: `${snapshot.uploader} 上传了题目 ${mistake.questionId} 的讲义截图${snapshot.isLate ? '（晚到附件）' : ''}`,
      operator: snapshot.uploader,
      timestamp: snapshot.uploadTime,
      evidenceRefs: [{
        type: 'image',
        id: snapshot.id,
        url: snapshot.imageUrl
      }]
    });
  });
  
  const relatedCorrections = corrections.filter(c => c.mistakeId === mistake.id);
  relatedCorrections.forEach(correction => {
    nodes.push({
      id: generateId(),
      type: 'correction_made',
      title: '人工更正',
      description: `更正原因: ${correction.reason}`,
      operator: correction.operator,
      timestamp: correction.correctedAt,
      evidenceRefs: [{
        type: 'record',
        id: correction.id
      }]
    });
  });
  
  const relatedCommentaries = commentaries.filter(c => c.mistakeId === mistake.id);
  relatedCommentaries.forEach(commentary => {
    nodes.push({
      id: generateId(),
      type: 'commentary_added',
      title: '讲评稿已添加',
      description: commentary.content.substring(0, 100) + (commentary.content.length > 100 ? '...' : ''),
      operator: commentary.author,
      timestamp: commentary.createdAt,
      evidenceRefs: [{
        type: 'text',
        id: commentary.id
      }]
    });
  });
  
  const hasCorrection = relatedCorrections.length > 0;
  nodes.push({
    id: generateId(),
    type: 'conclusion_reached',
    title: '最终结论',
    description: hasCorrection 
      ? `经过人工更正，该题难度已确认。相关证据已全部归档，可回溯查看。`
      : `该题已完成归档，所有证据材料齐全，可回溯查看完整处理流程。`,
    operator: '系统自动',
    timestamp: formatTime(new Date()),
    evidenceRefs: []
  });
  
  return nodes.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
};

export const buildEvidenceChains = (
  mistakes: StudentMistake[],
  snapshots: LectureSnapshot[],
  corrections: ManualCorrection[],
  commentaries: Commentary[]
): ImportResult => {
  const duplicates = detectDuplicates(mistakes);
  const conflicts = detectDifficultyConflicts(mistakes, corrections);
  const chains: EvidenceChain[] = [];
  const missingSnapshots: string[] = [];
  
  mistakes.forEach(mistake => {
    const hasSnapshot = snapshots.some(s => s.questionId === mistake.questionId);
    const hasDuplicate = duplicates.has(mistake.id);
    const hasConflict = conflicts.includes(mistake.id);
    
    if (!hasSnapshot) {
      missingSnapshots.push(mistake.id);
    }
    
    const timeline = buildTimeline(
      mistake,
      snapshots,
      corrections,
      commentaries
    );
    
    const chain: EvidenceChain = {
      id: generateId(),
      mistakeId: mistake.id,
      currentConclusion: hasConflict ? '存在难度标签冲突，待确认' : '已完成处理',
      status: hasConflict ? 'conflict' : hasDuplicate ? 'pending' : 'confirmed',
      timeline,
      updatedAt: formatTime(new Date()),
      hasDuplicate,
      duplicateWith: duplicates.get(mistake.id)?.join(', '),
      missingSnapshot: !hasSnapshot
    };
    
    chains.push(chain);
  });
  
  const normalCount = mistakes.filter(m => m.source === 'normal').length;
  const lateCount = mistakes.filter(m => m.source === 'late').length;
  
  return {
    success: true,
    total: mistakes.length,
    normal: normalCount,
    late: lateCount,
    duplicates: Array.from(duplicates.keys()),
    conflicts,
    missingSnapshots,
    chains
  };
};

export const getDifficultyLabel = (difficulty: Difficulty): string => {
  const labels: Record<Difficulty, string> = {
    easy: '简单',
    medium: '中等',
    hard: '困难'
  };
  return labels[difficulty];
};

export const getStatusLabel = (status: string): string => {
  const labels: Record<string, string> = {
    pending: '待处理',
    confirmed: '已确认',
    conflict: '有冲突'
  };
  return labels[status] || status;
};
