interface GapResult {
  missingNo: string;
  prevNo: string;
  nextNo: string;
}

interface ConflictResult {
  field: string;
  teacherNoteValue: any;
  samplingListValue: any;
}

function detectGaps(recordNos: string[]): GapResult[] {
  const gaps: GapResult[] = [];

  for (let i = 0; i < recordNos.length - 1; i++) {
    const current = recordNos[i];
    const next = recordNos[i + 1];

    const currentNum = parseInt(current, 10);
    const nextNum = parseInt(next, 10);

    if (isNaN(currentNum) || isNaN(nextNum)) {
      continue;
    }

    const diff = nextNum - currentNum;
    if (diff > 1) {
      const padLength = current.length;
      for (let missing = currentNum + 1; missing < nextNum; missing++) {
        gaps.push({
          missingNo: missing.toString().padStart(padLength, '0'),
          prevNo: current,
          nextNo: next,
        });
      }
    }
  }

  return gaps;
}

function findConflicts(note: any, sampling: any): ConflictResult[] {
  const conflicts: ConflictResult[] = [];
  const fieldsToCheck = ['date', 'teacherName', 'amount', 'itemType'];

  for (const field of fieldsToCheck) {
    const noteValue = note?.[field];
    const samplingValue = sampling?.[field];

    if (noteValue !== undefined && samplingValue !== undefined && noteValue !== samplingValue) {
      conflicts.push({
        field,
        teacherNoteValue: noteValue,
        samplingListValue: samplingValue,
      });
    }
  }

  return conflicts;
}

export { detectGaps, findConflicts };
export type { GapResult, ConflictResult };
