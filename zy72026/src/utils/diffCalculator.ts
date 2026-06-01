import type { GameSession, TeacherNote } from '../types';

export interface NoteDiff {
  originalNotes: TeacherNote[];
  supplementaryNotes: TeacherNote[];
  diffText: string;
  countChange: {
    original: number;
    current: number;
    added: number;
  };
}

export function calculateNoteDiff(session: GameSession): NoteDiff {
  const originalNotes = session.notes.filter((n) => !n.isSupplementary);
  const supplementaryNotes = session.notes.filter((n) => n.isSupplementary);

  const diffLines: string[] = [];

  if (supplementaryNotes.length === 0) {
    return {
      originalNotes,
      supplementaryNotes,
      diffText: '本次演练未补录任何备注，所有备注均为老师预置。',
      countChange: {
        original: originalNotes.length,
        current: session.notes.length,
        added: 0,
      },
    };
  }

  diffLines.push(`【备注补录差异报告】`);
  diffLines.push('');
  diffLines.push(`原始备注数量：${originalNotes.length} 条（老师预置）`);
  diffLines.push(`补录备注数量：${supplementaryNotes.length} 条（讲解员小夏补录）`);
  diffLines.push(`当前总备注数：${session.notes.length} 条`);
  diffLines.push('');
  diffLines.push('────────────────────────────────────');
  diffLines.push('补录备注详情：');
  diffLines.push('');

  supplementaryNotes.forEach((note, index) => {
    const time = new Date(note.timestamp).toLocaleString('zh-CN');
    const location = note.problemId ? `关联问题ID: ${note.problemId}` : '全局备注';
    diffLines.push(`${index + 1}. [${time}] ${note.author}`);
    diffLines.push(`   ${location}`);
    diffLines.push(`   内容：${note.content}`);
    diffLines.push('');
  });

  diffLines.push('────────────────────────────────────');
  diffLines.push('补录前后对比：');
  diffLines.push(`  • 备注数量：${originalNotes.length} → ${session.notes.length}（+${supplementaryNotes.length}）`);
  diffLines.push(`  • 补录时间：${new Date().toLocaleString('zh-CN')}`);
  diffLines.push(`  • 补录人员：${supplementaryNotes[0]?.author || '讲解员小夏'}`);

  return {
    originalNotes,
    supplementaryNotes,
    diffText: diffLines.join('\n'),
    countChange: {
      original: originalNotes.length,
      current: session.notes.length,
      added: supplementaryNotes.length,
    },
  };
}

export function formatSessionTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
}

export function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function generateEventId(): string {
  return `evt_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function generateSessionId(): string {
  return `sess_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
