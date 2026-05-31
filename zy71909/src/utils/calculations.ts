import type { PitchDeviation, RecordingBatch, Student, VoicePart, TrendDataPoint, HeatmapCellData, CategoryStats } from '../types';

export function calculateVoicePartAverage(
  deviations: PitchDeviation[],
  voicePartId: string,
  students: Student[],
  batchId?: string
): number {
  const partStudentIds = students
    .filter(s => s.voicePartId === voicePartId)
    .map(s => s.id);

  const relevantDeviations = deviations.filter(d =>
    partStudentIds.includes(d.studentId) &&
    !d.isAnomaly &&
    (batchId ? d.batchId === batchId : true)
  );

  if (relevantDeviations.length === 0) return 0;

  const sum = relevantDeviations.reduce((acc, d) => acc + Math.abs(d.deviationCents), 0);
  return Math.round(sum / relevantDeviations.length);
}

export function calculateOverallAverage(
  deviations: PitchDeviation[],
  students: Student[],
  voiceParts: VoicePart[],
  batchId?: string
): number {
  const partAverages = voiceParts.map(vp => {
    const avg = calculateVoicePartAverage(deviations, vp.id, students, batchId);
    const count = students.filter(s => s.voicePartId === vp.id).length;
    return { avg, count };
  });

  const totalStudents = partAverages.reduce((acc, p) => acc + p.count, 0);
  if (totalStudents === 0) return 0;

  const weightedSum = partAverages.reduce((acc, p) => acc + p.avg * p.count, 0);
  return Math.round(weightedSum / totalStudents);
}

export function getTrendData(
  batches: RecordingBatch[],
  deviations: PitchDeviation[],
  students: Student[],
  voiceParts: VoicePart[]
): TrendDataPoint[] {
  const sortedBatches = [...batches].sort((a, b) => 
    a.rehearsalDate.localeCompare(b.rehearsalDate)
  );

  return sortedBatches.map(batch => {
    const point: TrendDataPoint = {
      date: batch.rehearsalDate.slice(5),
      batchId: batch.id,
      average: calculateOverallAverage(deviations, students, voiceParts, batch.id),
    };

    voiceParts.forEach(vp => {
      point[vp.name] = calculateVoicePartAverage(deviations, vp.id, students, batch.id);
    });

    return point;
  });
}

export function getHeatmapData(
  batchId: string,
  deviations: PitchDeviation[],
  students: Student[],
  totalMeasures: number,
  filters?: { voicePartId?: string | null; category?: string | null; showAnomaliesOnly?: boolean }
): HeatmapCellData[] {
  const filteredStudents = filters?.voicePartId
    ? students.filter(s => s.voicePartId === filters.voicePartId)
    : students;

  const batchDeviations = deviations.filter(d => d.batchId === batchId);

  const cells: HeatmapCellData[] = [];

  filteredStudents.forEach(student => {
    for (let measure = 1; measure <= totalMeasures; measure++) {
      const deviation = batchDeviations.find(
        d => d.studentId === student.id && d.measure === measure
      );

      if (!deviation) continue;

      if (filters?.showAnomaliesOnly && !deviation.isAnomaly) return;
      if (filters?.category && deviation.category !== filters.category) return;

      cells.push({
        studentId: student.id,
        studentName: student.name,
        measure,
        deviationCents: deviation.deviationCents,
        isAnomaly: deviation.isAnomaly,
        anomalyType: deviation.anomalyType,
        category: deviation.category,
        reviewed: deviation.reviewed,
        deviationId: deviation.id,
      });
    }
  });

  return cells;
}

export function getCategoryStats(
  deviations: PitchDeviation[],
  batchId: string
): CategoryStats {
  const batchDeviations = deviations.filter(d => d.batchId === batchId);

  return {
    persistent: batchDeviations.filter(d => d.category === 'persistent').length,
    occasional: batchDeviations.filter(d => d.category === 'occasional').length,
    unreviewed: batchDeviations.filter(d => d.category === 'unreviewed').length,
    normal: batchDeviations.filter(d => d.category === 'normal' || !d.category).length,
  };
}

export function getDeviationColor(cents: number, isAnomaly: boolean, reviewed: boolean): string {
  if (isAnomaly) return '#95a5a6';
  
  const absCents = Math.abs(cents);
  
  if (absCents > 50) return '#c0392b';
  if (absCents > 30) return '#e67e22';
  if (!reviewed && absCents > 20) return '#f39c12';
  return '#27ae60';
}

export function getDeviationOpacity(cents: number, isAnomaly: boolean): number {
  if (isAnomaly) return 0.4;
  
  const absCents = Math.abs(cents);
  if (absCents > 50) return 1;
  if (absCents > 30) return 0.8;
  if (absCents > 20) return 0.6;
  return 0.3;
}

export function getStudentDeviationHistory(
  studentId: string,
  measure: number,
  deviations: PitchDeviation[],
  batches: RecordingBatch[]
): Array<{ date: string; batchId: string; deviationCents: number; isAnomaly: boolean }> {
  const sortedBatches = [...batches].sort((a, b) => 
    a.rehearsalDate.localeCompare(b.rehearsalDate)
  );

  return sortedBatches.map(batch => {
    const deviation = deviations.find(
      d => d.studentId === studentId && d.measure === measure && d.batchId === batch.id
    );

    return {
      date: batch.rehearsalDate.slice(5),
      batchId: batch.id,
      deviationCents: deviation?.deviationCents || 0,
      isAnomaly: deviation?.isAnomaly || false,
    };
  });
}

export function getRelatedNotes<T extends { batchId: string; relatedMeasure?: number; relatedStudentId?: string }>(
  batchId: string,
  measure: number | undefined,
  studentId: string | undefined,
  notes: T[]
): T[] {
  return notes.filter(n => {
    if (n.batchId !== batchId) return false;
    if (measure && n.relatedMeasure && n.relatedMeasure !== measure) return false;
    if (studentId && n.relatedStudentId && n.relatedStudentId !== studentId) return false;
    return true;
  });
}
