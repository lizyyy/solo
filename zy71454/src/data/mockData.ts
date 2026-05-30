import { PianoKeyData, KeyNote, EvidenceRecord, DataSnapshot, KeyStatus } from '../types';

const NOTE_NAMES = ['A', 'A#', 'B', 'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#'];
const BLACK_KEYS = new Set(['A#', 'C#', 'D#', 'F#', 'G#']);

function generatePressureCurve(basePressure: number): number[] {
  const curve: number[] = [];
  for (let i = 0; i < 20; i++) {
    const t = i / 19;
    const peak = basePressure * (1.2 + Math.random() * 0.3);
    const value = peak * Math.sin(t * Math.PI) * (0.8 + Math.random() * 0.2);
    curve.push(Math.round(value));
  }
  return curve;
}

function getStatus(pressure: number, reboundTime: number): KeyStatus {
  if (pressure < 45 || pressure > 75 || reboundTime > 150) return 'error';
  if (pressure < 50 || pressure > 68 || reboundTime > 120) return 'warning';
  return 'normal';
}

export function generate88Keys(): PianoKeyData[] {
  const keys: PianoKeyData[] = [];
  
  for (let keyNumber = 1; keyNumber <= 88; keyNumber++) {
    const noteIndex = (keyNumber - 1) % 12;
    const octave = Math.floor((keyNumber + 8) / 12);
    const noteName = NOTE_NAMES[noteIndex];
    const isBlack = BLACK_KEYS.has(noteName);
    
    const basePressure = isBlack ? 58 : 55;
    const pressureVariation = (Math.random() - 0.5) * 30;
    const pressure = Math.round(basePressure + pressureVariation);
    const reboundTime = Math.round(80 + Math.random() * 80);
    
    keys.push({
      keyNumber,
      noteName: `${noteName}${octave}`,
      isBlack,
      pressure,
      reboundTime,
      status: getStatus(pressure, reboundTime),
      pressureCurve: generatePressureCurve(pressure),
      octave,
    });
  }
  
  return keys;
}

export function generateMockNotes(): KeyNote[] {
  return [
    {
      id: 'note-1',
      keyNumber: 40,
      content: '此键下压力偏高，需调整击弦机弹簧张力。建议减少0.5圈。',
      createdAt: '2026-05-28T10:30:00Z',
      author: '张师傅',
      version: 'v1.0',
    },
    {
      id: 'note-2',
      keyNumber: 44,
      content: '回弹时间过长，检查制音器呢毡磨损情况。已更换新呢毡。',
      createdAt: '2026-05-27T14:20:00Z',
      author: '李师傅',
      version: 'v2.1',
    },
    {
      id: 'note-3',
      keyNumber: 49,
      content: '中音区A4键，调律时发现琴弦张力不均，已重新校准。',
      createdAt: '2026-05-26T09:15:00Z',
      author: '王师傅',
      version: 'v1.2',
    },
    {
      id: 'note-4',
      keyNumber: 25,
      content: '低音区键程较深，用户反馈手感重。已调整卡钉高度降低2mm。',
      createdAt: '2026-05-25T16:45:00Z',
      author: '张师傅',
      version: 'v1.0',
    },
    {
      id: 'note-5',
      keyNumber: 70,
      content: '高音区杂音，发现联动杆螺丝松动，已紧固。',
      createdAt: '2026-05-24T11:00:00Z',
      author: '刘师傅',
      version: 'v1.1',
    },
  ];
}

export function generateMockEvidence(): EvidenceRecord[] {
  return [
    {
      id: 'ev-1',
      keyNumber: 40,
      type: 'pressure_adjust',
      beforeValue: '78g',
      afterValue: '62g',
      timestamp: '2026-05-28T11:00:00Z',
      operator: '张师傅',
      description: '调整击弦机弹簧，减少0.5圈张力',
    },
    {
      id: 'ev-2',
      keyNumber: 44,
      type: 'note_change',
      beforeValue: 'v1.0: 检查制音器',
      afterValue: 'v2.1: 已更换新呢毡',
      timestamp: '2026-05-27T15:30:00Z',
      operator: '李师傅',
      description: '备注版本更新',
    },
    {
      id: 'ev-3',
      keyNumber: 52,
      type: 'key_mismatch',
      beforeValue: '键号52 (C5)',
      afterValue: '键号53 (C#5)',
      timestamp: '2026-05-26T14:00:00Z',
      operator: '王师傅',
      description: '人工核查发现键号错位，已修正',
    },
    {
      id: 'ev-4',
      keyNumber: 36,
      type: 'unit_conversion',
      beforeValue: '1.3N',
      afterValue: '132g',
      timestamp: '2026-05-25T10:20:00Z',
      operator: '张师傅',
      description: '单位转换：牛顿转克，保留原始记录',
    },
    {
      id: 'ev-5',
      keyNumber: 25,
      type: 'pressure_adjust',
      beforeValue: '72g',
      afterValue: '58g',
      timestamp: '2026-05-25T17:00:00Z',
      operator: '张师傅',
      description: '调整卡钉高度降低2mm',
    },
  ];
}

export function generateMockSnapshots(keys: PianoKeyData[]): DataSnapshot[] {
  return [
    {
      id: 'snap-1',
      name: '初检状态',
      createdAt: '2026-05-20T09:00:00Z',
      keyData: keys.map(k => ({ ...k, pressure: Math.round(k.pressure * 1.1) })),
      reason: '钢琴进厂初始状态记录',
      operator: '张师傅',
    },
    {
      id: 'snap-2',
      name: '调整后状态',
      createdAt: '2026-05-25T18:00:00Z',
      keyData: keys,
      reason: '完成主要调整工作，待验收',
      operator: '张师傅',
    },
  ];
}

export function getHeatmapColor(pressure: number, min: number = 40, max: number = 80): string {
  const normalized = Math.max(0, Math.min(1, (pressure - min) / (max - min)));
  
  if (normalized < 0.25) {
    const t = normalized / 0.25;
    return `rgb(${Math.round(59 + t * 30)}, ${Math.round(130 + t * 70)}, ${Math.round(246 - t * 50)})`;
  } else if (normalized < 0.5) {
    const t = (normalized - 0.25) / 0.25;
    return `rgb(${Math.round(89 + t * 80)}, ${Math.round(200 - t * 30)}, ${Math.round(196 - t * 60)})`;
  } else if (normalized < 0.75) {
    const t = (normalized - 0.5) / 0.25;
    return `rgb(${Math.round(169 + t * 80)}, ${Math.round(170 - t * 30)}, ${Math.round(136 - t * 80)})`;
  } else {
    const t = (normalized - 0.75) / 0.25;
    return `rgb(${Math.round(249 + t * 6)}, ${Math.round(140 - t * 60)}, ${Math.round(56 - t * 20)})`;
  }
}

export function getStatusColor(status: KeyStatus): string {
  switch (status) {
    case 'normal': return '#22c55e';
    case 'warning': return '#eab308';
    case 'error': return '#ef4444';
  }
}
