import { Pattern, ValidationIssue, DrumTrack } from '@/types';

const VELOCITY_MIN = 20;
const VELOCITY_MAX = 110;
const DENSITY_WINDOW = 3;
const DENSITY_THRESHOLD = 2;
const EMPTY_MEASURE_STEPS = 16;

export const generateId = (): string => {
  return Math.random().toString(36).substring(2, 11);
};

export const validatePattern = (pattern: Pattern): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];

  pattern.tracks.forEach((track) => {
    const activeNotes = track.notes.filter(n => n.isActive);
    
    activeNotes.forEach((note) => {
      if (note.velocity > VELOCITY_MAX) {
        issues.push({
          id: generateId(),
          type: 'velocity_over',
          severity: 'warning',
          trackId: track.id,
          step: note.step,
          message: `${track.name} 第 ${note.step + 1} 步力度过高 (${note.velocity})`,
          suggestion: '建议降低到 80-100 范围',
        });
      }
      
      if (note.velocity < VELOCITY_MIN) {
        issues.push({
          id: generateId(),
          type: 'velocity_low',
          severity: 'warning',
          trackId: track.id,
          step: note.step,
          message: `${track.name} 第 ${note.step + 1} 步力度过低 (${note.velocity})`,
          suggestion: '建议提升到 30-50 范围',
        });
      }
    });

    const sortedNotes = [...activeNotes].sort((a, b) => a.step - b.step);
    for (let i = 0; i < sortedNotes.length; i++) {
      const windowNotes = sortedNotes.filter(
        n => n.step >= sortedNotes[i].step && n.step < sortedNotes[i].step + DENSITY_WINDOW
      );
      if (windowNotes.length >= DENSITY_THRESHOLD) {
        const exists = issues.some(
          iss => iss.type === 'density_high' && iss.step === sortedNotes[i].step && iss.trackId === track.id
        );
        if (!exists) {
          issues.push({
            id: generateId(),
            type: 'density_high',
            severity: 'warning',
            trackId: track.id,
            step: sortedNotes[i].step,
            message: `${track.name} 第 ${sortedNotes[i].step + 1} 步附近密度过高`,
            suggestion: '考虑分散音符位置或降低数量',
          });
        }
      }
    }
  });

  const totalNotes = pattern.tracks.reduce(
    (sum, track) => sum + track.notes.filter(n => n.isActive).length,
    0
  );
  if (totalNotes === 0) {
    issues.push({
      id: generateId(),
      type: 'empty_measure',
      severity: 'error',
      trackId: '',
      step: 0,
      message: '当前 Pattern 为空，没有任何音符',
      suggestion: '请添加一些鼓点开始创作',
    });
  } else if (totalNotes < 4) {
    issues.push({
      id: generateId(),
      type: 'empty_measure',
      severity: 'warning',
      trackId: '',
      step: 0,
      message: '当前 Pattern 音符较少，可能存在空拍问题',
      suggestion: '检查是否遗漏了重要的节奏元素',
    });
  }

  return issues;
};

export const fixVelocityIssue = (track: DrumTrack, step: number, targetVelocity: number): DrumTrack => {
  return {
    ...track,
    notes: track.notes.map(note =>
      note.step === step ? { ...note, velocity: targetVelocity } : note
    ),
  };
};

export const removeDensityIssue = (track: DrumTrack, startStep: number): DrumTrack => {
  const notesInWindow = track.notes.filter(
    n => n.isActive && n.step >= startStep && n.step < startStep + DENSITY_WINDOW
  );
  if (notesInWindow.length >= 2) {
    const noteToRemove = notesInWindow[notesInWindow.length - 1];
    return {
      ...track,
      notes: track.notes.map(note =>
        note.step === noteToRemove.step ? { ...note, isActive: false } : note
      ),
    };
  }
  return track;
};
