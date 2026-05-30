import {
  Rehearsal,
  AudioTrack,
  VoicePart,
  ScoreSection,
  Misnote,
  OperationLog,
  Comment,
  Report,
  DetectionRun,
  ProblemType,
  generateId,
} from '@/types';

const rehearsalNames = [
  '2024年春季排练 - 第3次',
  '儿童乐团排练 - 莫扎特小夜曲',
  '周末排练 - 贝多芬第5号',
  '新年音乐会彩排',
  '暑期集训 - 第2周',
];

const studentNames = {
  violin: ['小明', '小红', '小华', '小李'],
  flute: ['小王', '小张', '小陈', '小赵'],
};

const sectionNames = [
  '第一乐章 - 开场',
  '第二乐章 - 抒情',
  '第三乐章 - 活泼',
  '第四乐章 - 终曲',
];

export function generateMockRehearsal(): Rehearsal {
  return {
    id: generateId(),
    name: rehearsalNames[Math.floor(Math.random() * rehearsalNames.length)],
    date: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    description: '儿童乐团日常排练，包含小提琴和长笛声部',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

export function generateMockVoiceParts(rehearsalId: string): VoicePart[] {
  const parts: VoicePart[] = [];

  for (let i = 0; i < 3; i++) {
    parts.push({
      id: generateId(),
      rehearsalId,
      name: `小提琴 ${i + 1}`,
      instrument: 'violin',
      studentName: studentNames.violin[i],
      sourceType: i < 2 ? 'system' : 'manual',
      createdAt: new Date(),
    });
  }

  for (let i = 0; i < 2; i++) {
    parts.push({
      id: generateId(),
      rehearsalId,
      name: `长笛 ${i + 1}`,
      instrument: 'flute',
      studentName: studentNames.flute[i],
      sourceType: i === 0 ? 'system' : 'manual',
      createdAt: new Date(),
    });
  }

  return parts;
}

export function generateMockScoreSections(rehearsalId: string, duration: number): ScoreSection[] {
  const sections: ScoreSection[] = [];
  const sectionCount = 4;
  const sectionDuration = duration / sectionCount;

  for (let i = 0; i < sectionCount; i++) {
    sections.push({
      id: generateId(),
      rehearsalId,
      name: sectionNames[i % sectionNames.length],
      startTime: i * sectionDuration,
      endTime: (i + 1) * sectionDuration,
      expectedNotes: 'C4 D4 E4 F4 G4 A4 B4 C5',
      sourceType: i < 2 ? 'system' : 'manual',
      createdAt: new Date(),
    });
  }

  return sections;
}

export function generateMockMisnotes(
  rehearsalId: string,
  voiceParts: VoicePart[],
  duration: number
): { detectionRun: DetectionRun; misnotes: Misnote[] } {
  const detectionRunId = generateId();
  const problemTypes: ProblemType[] = ['voice_overlap', 'section_misalignment', 'noise_misjudgment'];

  const detectionRun: DetectionRun = {
    id: detectionRunId,
    rehearsalId,
    type: 'full',
    config: JSON.stringify({ sensitivity: 0.5 }),
    status: 'completed',
    startedAt: new Date(Date.now() - 10 * 60 * 1000),
    finishedAt: new Date(Date.now() - 8 * 60 * 1000),
  };

  const misnotes: Misnote[] = [];
  const misnoteCount = 45 + Math.floor(Math.random() * 30);

  for (let i = 0; i < misnoteCount; i++) {
    const problemType = problemTypes[Math.floor(Math.random() * problemTypes.length)];
    const voicePart = voiceParts[Math.floor(Math.random() * voiceParts.length)];
    const time = Math.random() * duration;

    const expectedFreq = 261.63 + Math.random() * 200;
    const actualFreq = expectedFreq * (1 + (Math.random() - 0.5) * 0.2);
    const deviation = Math.abs(1200 * Math.log2(actualFreq / expectedFreq));

    const statusRoll = Math.random();
    let confirmationStatus: 'pending' | 'confirmed' | 'rejected' = 'pending';
    if (statusRoll > 0.6) confirmationStatus = 'confirmed';
    else if (statusRoll > 0.4) confirmationStatus = 'rejected';

    const sourceRoll = Math.random();
    const sourceType: 'system' | 'manual' = sourceRoll > 0.85 ? 'manual' : 'system';

    misnotes.push({
      id: generateId(),
      rehearsalId,
      detectionRunId,
      voicePartId: voicePart.id,
      time,
      duration: 0.1 + Math.random() * 0.5,
      problemType,
      expectedPitch: frequencyToNote(expectedFreq),
      actualPitch: frequencyToNote(actualFreq),
      deviationCents: deviation,
      confidence: 0.3 + Math.random() * 0.7,
      confirmationStatus,
      sourceType,
      createdAt: new Date(),
    });
  }

  return { detectionRun, misnotes: misnotes.sort((a, b) => a.time - b.time) };
}

function frequencyToNote(frequency: number): string {
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const noteNum = 12 * (Math.log2(frequency / 440)) + 69;
  const note = noteNames[Math.round(noteNum) % 12];
  const octave = Math.floor(Math.round(noteNum) / 12) - 1;
  return `${note}${octave}`;
}

export function generateMockOperationLogs(
  rehearsalId: string,
  misnotes: Misnote[]
): OperationLog[] {
  const logs: OperationLog[] = [];
  const operations: Array<{ type: OperationLog['operationType']; note: string }> = [
    { type: 'detection_run', note: '首次运行错音检测' },
    { type: 'confirm', note: '确认了多个错音标记' },
    { type: 'reject', note: '驳回了部分误判' },
    { type: 'comment_add', note: '添加了老师点评' },
    { type: 'rerun', note: '重新计算了第2段落' },
  ];

  for (let i = 0; i < operations.length; i++) {
    const op = operations[i];
    const targetMisnote = misnotes[i % misnotes.length];

    logs.push({
      id: generateId(),
      rehearsalId,
      operationType: op.type,
      targetEntity: 'misnote',
      targetId: targetMisnote.id,
      snapshotBefore: JSON.stringify({
        misnoteCount: misnotes.length,
        confirmedCount: misnotes.filter((m) => m.confirmationStatus === 'confirmed').length,
      }),
      snapshotAfter: JSON.stringify({
        misnoteCount: misnotes.length + (op.type === 'manual_add' ? 1 : 0),
        confirmedCount: misnotes.filter((m) => m.confirmationStatus === 'confirmed').length + (op.type === 'confirm' ? 1 : 0),
      }),
      operator: '李老师',
      note: op.note,
      createdAt: new Date(Date.now() - (operations.length - i) * 15 * 60 * 1000),
    });
  }

  return logs;
}

export function generateMockComments(misnotes: Misnote[]): Comment[] {
  const comments: Comment[] = [];
  const commentTexts = [
    '这个音进早了，注意看指挥的手势',
    '音准偏低，下次排练前多练这个音',
    '和长笛配合时注意音量平衡',
    '节奏有点抢，慢一点稳一点',
    '这个段落需要单独练习',
  ];

  for (let i = 0; i < 8; i++) {
    const misnote = misnotes[i % misnotes.length];
    const isTeacher = Math.random() > 0.3;

    comments.push({
      id: generateId(),
      misnoteId: misnote.id,
      authorType: isTeacher ? 'teacher' : 'student',
      authorName: isTeacher ? '李老师' : misnote.voicePartId.includes('violin') ? '小明' : '小王',
      content: commentTexts[i % commentTexts.length],
      createdAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
    });
  }

  return comments;
}

export function generateMockReports(rehearsalId: string): Report[] {
  const reports: Report[] = [];

  for (let i = 0; i < 2; i++) {
    reports.push({
      id: generateId(),
      rehearsalId,
      name: `排练分析报告 - 第${i + 1}版`,
      format: i === 0 ? 'pdf' : 'xlsx',
      filtersApplied: JSON.stringify({
        problemTypes: ['voice_overlap', 'section_misalignment'],
        voicePartIds: [],
      }),
      timeRangeStart: 0,
      timeRangeEnd: 180,
      filePath: `/reports/report-${i + 1}.${i === 0 ? 'pdf' : 'xlsx'}`,
      createdAt: new Date(Date.now() - i * 24 * 60 * 60 * 1000),
      misnoteCount: 35 + i * 5,
    });
  }

  return reports;
}

export function generateMockAudioData(duration: number, sampleRate: number = 44100): Float32Array {
  const totalSamples = Math.floor(duration * sampleRate);
  const data = new Float32Array(totalSamples);

  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;
    let sample = 0;

    const baseFreq = 261.63 + Math.sin(t * 0.5) * 50;
    sample += Math.sin(2 * Math.PI * baseFreq * t) * 0.3;

    const harmonic1 = baseFreq * 2 + Math.sin(t * 0.7) * 10;
    sample += Math.sin(2 * Math.PI * harmonic1 * t) * 0.15;

    const harmonic2 = baseFreq * 3;
    sample += Math.sin(2 * Math.PI * harmonic2 * t) * 0.08;

    if (Math.random() > 0.995) {
      const wrongFreq = baseFreq * (1 + (Math.random() - 0.5) * 0.15);
      sample += Math.sin(2 * Math.PI * wrongFreq * t) * 0.4;
    }

    sample += (Math.random() - 0.5) * 0.05;

    if (t > 30 && t < 35) {
      sample *= 0.5 + Math.sin(t * 10) * 0.3;
    }
    if (t > 60 && t < 62) {
      sample *= 1.5;
    }

    data[i] = Math.max(-1, Math.min(1, sample));
  }

  return data;
}

export function generateWaveformData(audioData: Float32Array, samplesPerPixel: number = 100): {
  min: number[];
  max: number[];
  peaks: number[];
} {
  const width = Math.ceil(audioData.length / samplesPerPixel);
  const min: number[] = new Array(width);
  const max: number[] = new Array(width);
  const peaks: number[] = new Array(width);

  for (let i = 0; i < width; i++) {
    const start = i * samplesPerPixel;
    const end = Math.min(start + samplesPerPixel, audioData.length);

    let minVal = 0;
    let maxVal = 0;
    let peakVal = 0;

    for (let j = start; j < end; j++) {
      const val = audioData[j];
      if (val < minVal) minVal = val;
      if (val > maxVal) maxVal = val;
      const absVal = Math.abs(val);
      if (absVal > peakVal) peakVal = absVal;
    }

    min[i] = minVal;
    max[i] = maxVal;
    peaks[i] = peakVal;
  }

  return { min, max, peaks };
}
