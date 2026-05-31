import type { VoicePart, Student, RecordingBatch, Note, PitchDeviation } from '../types';

export const voiceParts: VoicePart[] = [
  { id: 'vp-s', name: 'soprano', displayName: '女高音', color: '#e91e63' },
  { id: 'vp-a', name: 'alto', displayName: '女低音', color: '#9c27b0' },
  { id: 'vp-t', name: 'tenor', displayName: '男高音', color: '#2196f3' },
  { id: 'vp-b', name: 'bass', displayName: '男低音', color: '#4caf50' },
];

export const students: Student[] = [
  { id: 's1', name: '林小雅', voicePartId: 'vp-s' },
  { id: 's2', name: '王美琪', voicePartId: 'vp-s' },
  { id: 's3', name: '陈思雨', voicePartId: 'vp-s' },
  { id: 's4', name: '张雨晴', voicePartId: 'vp-s' },
  { id: 's5', name: '刘芳', voicePartId: 'vp-a' },
  { id: 's6', name: '赵丽娜', voicePartId: 'vp-a' },
  { id: 's7', name: '黄佳怡', voicePartId: 'vp-a', partChanged: true, previousVoicePart: 'vp-s', partChangeBatchId: 'batch-3' },
  { id: 's8', name: '吴梦瑶', voicePartId: 'vp-a' },
  { id: 's9', name: '孙浩然', voicePartId: 'vp-t' },
  { id: 's10', name: '周子轩', voicePartId: 'vp-t' },
  { id: 's11', name: '郑天宇', voicePartId: 'vp-t' },
  { id: 's12', name: '马志远', voicePartId: 'vp-b' },
  { id: 's13', name: '朱伟', voicePartId: 'vp-b' },
  { id: 's14', name: '胡建国', voicePartId: 'vp-b' },
];

export const batches: RecordingBatch[] = [
  {
    id: 'batch-1',
    title: '第一次排练录音',
    rehearsalDate: '2026-05-10',
    songName: '《茉莉花》混声合唱版',
    keySignature: 'F大调',
    totalMeasures: 16,
    recordingFileName: '20260510_排练1.m4a',
    status: 'final',
  },
  {
    id: 'batch-2',
    title: '第二次排练录音',
    rehearsalDate: '2026-05-13',
    songName: '《茉莉花》混声合唱版',
    keySignature: 'F大调',
    totalMeasures: 16,
    recordingFileName: '20260513_排练2.m4a',
    status: 'final',
  },
  {
    id: 'batch-3',
    title: '第三次排练录音',
    rehearsalDate: '2026-05-17',
    songName: '《茉莉花》混声合唱版',
    keySignature: 'F大调',
    totalMeasures: 16,
    missingMeasures: [7, 8],
    recordingFileName: '20260517_排练3.m4a',
    status: 'reviewed',
  },
  {
    id: 'batch-4',
    title: '第四次排练录音（转调）',
    rehearsalDate: '2026-05-20',
    songName: '《茉莉花》混声合唱版',
    keySignature: 'G大调',
    keyChanged: true,
    previousKey: 'F大调',
    totalMeasures: 16,
    recordingFileName: '20260520_排练4.m4a',
    status: 'reviewed',
  },
  {
    id: 'batch-5',
    title: '第五次排练录音',
    rehearsalDate: '2026-05-24',
    songName: '《茉莉花》混声合唱版',
    keySignature: 'G大调',
    totalMeasures: 16,
    recordingFileName: '20260524_排练5.m4a',
    status: 'draft',
  },
];

export const notes: Note[] = [
  {
    id: 'n1',
    batchId: 'batch-1',
    source: 'monitor',
    content: '第5小节女高音整体偏低，需要加强气息支撑',
    author: '声部长-林小雅',
    createdAt: '2026-05-10T20:30:00',
    relatedMeasure: 5,
  },
  {
    id: 'n2',
    batchId: 'batch-3',
    source: 'monitor',
    content: '第7-8小节录音设备故障，数据缺失，请注意',
    author: '声部长-孙浩然',
    createdAt: '2026-05-17T21:15:00',
    relatedMeasure: 7,
  },
  {
    id: 'n3',
    batchId: 'batch-4',
    source: 'selection',
    content: '根据汇演要求，从本次排练起调高调性至G大调，黄佳怡调整到女低音声部',
    author: '音乐老师-李老师',
    createdAt: '2026-05-20T18:00:00',
  },
  {
    id: 'n4',
    batchId: 'batch-4',
    source: 'teacher',
    content: '第12小节男低音进入太早，注意听前奏',
    author: '音乐老师-李老师',
    createdAt: '2026-05-20T20:45:00',
    relatedMeasure: 12,
  },
  {
    id: 'n5',
    batchId: 'batch-5',
    source: 'monitor',
    content: '陈思雨第10小节连续三次偏高，需要单独练习',
    author: '声部长-王美琪',
    createdAt: '2026-05-24T20:00:00',
    relatedMeasure: 10,
    relatedStudentId: 's3',
  },
];

function generateDeviations(): PitchDeviation[] {
  const deviations: PitchDeviation[] = [];
  let idCounter = 1;

  const persistentIssues: Record<string, number[]> = {
    's3': [10],
    's5': [3],
    's12': [12],
  };

  const occasionalIssues: Record<string, number[]> = {
    's2': [5],
    's9': [8],
    's14': [14],
  };

  batches.forEach((batch, batchIndex) => {
    students.forEach((student) => {
      for (let measure = 1; measure <= batch.totalMeasures; measure++) {
        const isMissing = batch.missingMeasures?.includes(measure);
        const isKeyChange = batch.keyChanged;
        const isPartChange = student.partChanged && batch.id >= (student.partChangeBatchId || '');
        const batchesSincePartChange = student.partChangeBatchId 
          ? batches.findIndex(b => b.id === batch.id) - batches.findIndex(b => b.id === student.partChangeBatchId)
          : -1;
        const isPartChangeGracePeriod = isPartChange && batchesSincePartChange >= 0 && batchesSincePartChange < 3;

        let baseDeviation = 0;
        const isPersistent = persistentIssues[student.id]?.includes(measure);
        const isOccasional = occasionalIssues[student.id]?.includes(measure) && batchIndex === 4;

        if (isPersistent) {
          baseDeviation = 55 + Math.random() * 20;
        } else if (isOccasional) {
          baseDeviation = 50 + Math.random() * 15;
        } else {
          baseDeviation = Math.random() * 35 - 10;
        }

        if (isKeyChange || isPartChangeGracePeriod) {
          baseDeviation += Math.random() * 30;
        }

        const isAnomaly = isMissing || isKeyChange || isPartChangeGracePeriod;
        let anomalyType: PitchDeviation['anomalyType'] | undefined;
        let anomalyReason: string | undefined;

        if (isMissing) {
          anomalyType = 'missing_measure';
          anomalyReason = '录音缺失';
        } else if (isKeyChange) {
          anomalyType = 'key_change';
          anomalyReason = `转调：${batch.previousKey} → ${batch.keySignature}`;
        } else if (isPartChangeGracePeriod) {
          anomalyType = 'part_change';
          anomalyReason = `换声部适应期（第${batchesSincePartChange + 1}/3次）`;
        }

        const deviationCents = Math.round(baseDeviation);
        const isSevere = Math.abs(deviationCents) > 50;
        const isMild = Math.abs(deviationCents) > 30;
        const reviewed = batch.status === 'final' || (batch.status === 'reviewed' && !isSevere);

        let category: PitchDeviation['category'] = 'normal';
        if (!isAnomaly) {
          if (isPersistent) {
            category = 'persistent';
          } else if (isOccasional) {
            category = 'occasional';
          } else if (isMild && !reviewed) {
            category = 'unreviewed';
          }
        }

        deviations.push({
          id: `dev-${idCounter++}`,
          studentId: student.id,
          batchId: batch.id,
          measure,
          deviationCents,
          isAnomaly,
          anomalyType,
          anomalyReason,
          reviewed,
          category,
          createdAt: `${batch.rehearsalDate}T19:00:00`,
          updatedAt: `${batch.rehearsalDate}T21:00:00`,
        });
      }
    });
  });

  return deviations;
}

export const deviations: PitchDeviation[] = generateDeviations();
