import type {
  TimelineRecord,
  WrongNoteRecord,
  AutoAnalysis,
  RecordingRecord,
  SectionLeaderNote,
  RehearsalSummary,
} from '../types';

const ANALYZER_VERSION = '1.0.0';

export function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

export function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function formatDate(ts: number): string {
  return new Date(ts).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getSourceLabel(source: string): string {
  const labels: Record<string, string> = {
    recording: '排练录音',
    section_leader: '声部长备注',
    metronome: '节拍器记录',
  };
  return labels[source] || source;
}

export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    confirmed: '已确认',
    pending: '待补充',
    corrected: '人工更正',
    duplicate: '重复项',
    late_arrival: '晚到附件',
  };
  return labels[status] || status;
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    confirmed: '#10b981',
    pending: '#f59e0b',
    corrected: '#6366f1',
    duplicate: '#6b7280',
    late_arrival: '#ec4899',
  };
  return colors[status] || '#6b7280';
}

export function getAnalysisResultLabel(result: string): string {
  const labels: Record<string, string> = {
    correct: '正确',
    wrong_note: '错音',
    rhythm_error: '节奏错误',
    key_mismatch: '转调不同步',
    tempo_mismatch: '速度不符',
    other: '其他问题',
  };
  return labels[result] || result;
}

export function detectDuplicates(
  records: TimelineRecord[]
): Map<string, { duplicateOfId: string; confidence: number; reasons: string[] }> {
  const duplicates = new Map<
    string,
    { duplicateOfId: string; confidence: number; reasons: string[] }
  >();
  const processed = new Set<string>();

  for (let i = 0; i < records.length; i++) {
    const rec1 = records[i];
    if (processed.has(rec1.id)) continue;

    for (let j = i + 1; j < records.length; j++) {
      const rec2 = records[j];
      if (processed.has(rec2.id)) continue;
      if (rec1.source !== rec2.source) continue;

      const reasons: string[] = [];
      let confidence = 0;

      if (
        rec1.source === 'section_leader' &&
        rec2.source === 'section_leader'
      ) {
        const s1 = rec1 as SectionLeaderNote;
        const s2 = rec2 as SectionLeaderNote;

        if (s1.sectionName === s2.sectionName) {
          confidence += 0.3;
          reasons.push('声部名称相同');
        }
        if (s1.authorName === s2.authorName) {
          confidence += 0.2;
          reasons.push('作者相同');
        }
        if (Math.abs(s1.timestamp - s2.timestamp) < 60000) {
          confidence += 0.2;
          reasons.push('时间戳接近');
        }
        const contentSim = calculateSimilarity(s1.content, s2.content);
        if (contentSim > 0.8) {
          confidence += contentSim * 0.3;
          reasons.push(`内容相似度${(contentSim * 100).toFixed(0)}%`);
        }
      }

      if (confidence >= 0.7) {
        duplicates.set(rec2.id, {
          duplicateOfId: rec1.id,
          confidence,
          reasons,
        });
        processed.add(rec2.id);
      }
    }
  }

  return duplicates;
}

function calculateSimilarity(s1: string, s2: string): number {
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;

  if (longer.length === 0) return 1.0;

  const costs: number[] = [];
  for (let i = 0; i <= shorter.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= longer.length; j++) {
      if (i === 0) {
        costs[j] = j;
      } else if (j > 0) {
        let newValue = costs[j - 1];
        if (shorter.charAt(i - 1) !== longer.charAt(j - 1)) {
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
        }
        costs[j - 1] = lastValue;
        lastValue = newValue;
      }
    }
    if (i > 0) costs[longer.length] = lastValue;
  }

  return (longer.length - costs[longer.length]) / longer.length;
}

export function detectLateArrivals(
  records: TimelineRecord[]
): Map<string, { expectedTime: number; delayMs: number; reason: string }> {
  const lateArrivals = new Map<
    string,
    { expectedTime: number; delayMs: number; reason: string }
  >();

  const recordings = records.filter(
    (r) => r.source === 'recording'
  ) as RecordingRecord[];

  for (const rec of records) {
    if (rec.source !== 'section_leader') continue;

    const note = rec as SectionLeaderNote;
    const delayMs = note.createdAt - note.timestamp;

    if (delayMs > 120000) {
      const relevantRecording = recordings.find(
        (r) =>
          r.timestamp <= note.timestamp &&
          r.timestamp + r.duration * 1000 >= note.timestamp
      );

      lateArrivals.set(note.id, {
        expectedTime: note.timestamp,
        delayMs,
        reason: relevantRecording
          ? `对应录音片段「${relevantRecording.segmentName}」已结束${(delayMs / 60000).toFixed(1)}分钟后收到`
          : '备注提交时间比标注时间晚2分钟以上',
      });
    }
  }

  return lateArrivals;
}

export function detectKeyMismatch(
  records: TimelineRecord[]
): {
  recordId: string;
  expectedKey: string;
  actualKey: string;
  mismatchSource: 'recording' | 'section_leader';
  followUpContact: string;
}[] {
  const mismatches: {
    recordId: string;
    expectedKey: string;
    actualKey: string;
    mismatchSource: 'recording' | 'section_leader';
    followUpContact: string;
  }[] = [];

  const recordings = records.filter(
    (r) => r.source === 'recording'
  ) as RecordingRecord[];
  const notes = records.filter(
    (r) => r.source === 'section_leader'
  ) as SectionLeaderNote[];

  for (const note of notes) {
    if (!note.keySignature) continue;

    const relevantRecording = recordings.find(
      (r) =>
        r.timestamp <= note.timestamp &&
        r.timestamp + r.duration * 1000 >= note.timestamp
    );

    if (relevantRecording && relevantRecording.keySignature !== note.keySignature) {
      mismatches.push({
        recordId: note.id,
        expectedKey: relevantRecording.keySignature,
        actualKey: note.keySignature,
        mismatchSource: 'section_leader',
        followUpContact: `${note.authorName}（${note.sectionName}）、钢琴伴奏`,
      });
    }
  }

  return mismatches;
}

export function generateAutoAnalysis(
  expected: string,
  actual: string,
  context: {
    type: 'pitch' | 'rhythm' | 'key';
    source: string;
    expectedFrequency?: number;
    actualFrequency?: number;
  }
): AutoAnalysis {
  const reasons: string[] = [];
  const evidence: AutoAnalysis['evidence'] = [];
  let result: AutoAnalysis['result'] = 'wrong_note';
  let confidence = 0.7;

  if (context.type === 'pitch') {
    result = 'wrong_note';
    reasons.push(`检测到${actual}，预期${expected}`);
    if (context.expectedFrequency && context.actualFrequency) {
      const diffCents = 1200 * Math.log2(context.actualFrequency / context.expectedFrequency);
      if (Math.abs(diffCents) > 50) {
        confidence = 0.9;
        reasons.push(`音高偏差${Math.abs(diffCents).toFixed(0)}音分，明显超出正常范围`);
      } else if (Math.abs(diffCents) > 25) {
        confidence = 0.75;
        reasons.push(`音高偏差${Math.abs(diffCents).toFixed(0)}音分，可能是演唱偏差`);
      } else {
        confidence = 0.5;
        reasons.push(`音高偏差${Math.abs(diffCents).toFixed(0)}音分，在正常误差范围内，建议人工复核`);
      }
      evidence.push({
        type: 'frequency_analysis',
        description: `检测到${context.actualFrequency.toFixed(2)}Hz(${actual})，预期${context.expectedFrequency.toFixed(2)}Hz(${expected})`,
        source: context.source as any,
      });
    }
  } else if (context.type === 'rhythm') {
    result = 'rhythm_error';
    reasons.push(`实际音符时值${actual}，预期${expected}`);
    confidence = 0.85;
    evidence.push({
      type: 'duration_analysis',
      description: `实际时长${actual}，预期${expected}`,
      source: context.source as any,
    });
  } else if (context.type === 'key') {
    result = 'key_mismatch';
    reasons.push(`转调标记不一致：${actual} vs ${expected}`);
    confidence = 0.87;
    evidence.push({
      type: 'key_signature_mismatch',
      description: `声部长备注：${actual}；录音显示：${expected}`,
      source: context.source as any,
    });
  }

  return {
    analyzerVersion: ANALYZER_VERSION,
    analysisTime: Date.now(),
    result,
    confidence,
    reasons,
    evidence,
  };
}

export function generateNextStep(record: WrongNoteRecord): string {
  if (record.status === 'corrected') {
    return '已人工更正，下次排练重点抽查此段落';
  }

  if (record.keyMismatchInfo) {
    return `请${record.keyMismatchInfo.followUpContact}确认转调时间点并核对`;
  }

  if (record.autoAnalysis) {
    if (record.autoAnalysis.confidence < 0.7) {
      return `置信度较低（${(record.autoAnalysis.confidence * 100).toFixed(0)}%），请相关声部长人工复核确认`;
    }
    if (record.source === 'section_leader') {
      return '请对应声部长核对备注内容准确性';
    }
    return '已标记，下次排练前提醒对应声部注意';
  }

  return '待进一步分析确认';
}

export function generateRehearsalSummary(
  records: TimelineRecord[],
  wrongNotes: WrongNoteRecord[]
): RehearsalSummary {
  const confirmed = wrongNotes.filter((w) => w.status === 'confirmed');
  const pending = wrongNotes.filter((w) => w.status === 'pending');
  const corrected = wrongNotes.filter((w) => w.status === 'corrected');
  const keyMismatches = wrongNotes.filter((w) => w.keyMismatchInfo);

  return {
    rehearsalDate: new Date().toLocaleDateString('zh-CN'),
    totalRecords: records.length,
    confirmedCount: confirmed.length,
    pendingCount: pending.length,
    correctedCount: corrected.length,
    wrongNoteCount: wrongNotes.filter((w) => w.autoAnalysis?.result === 'wrong_note').length,
    keyMismatchCount: keyMismatches.length,
    processingPolicy:
      '1. 已确认问题：已通知相关声部，下次排练重点检查；' +
      '2. 待补充问题：已联系相关人员确认，收到回复后更新；' +
      '3. 人工更正：以更正后内容为准，已同步更新乐谱标记；' +
      '4. 转调不同步：已标注来源，需声部长与钢琴伴奏当面核对。',
    confirmedRecords: confirmed,
    pendingRecords: pending,
    correctedRecords: corrected,
  };
}
