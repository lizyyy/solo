import type { AudioFile, Track, LoudnessData, PeakMark, ProtectedRegion, HistoryRecord, ProcessReport, ProcessConfig } from '../types';

const now = Date.now();

const defaultConfig: ProcessConfig = {
  targetLufs: -16,
  lufsTolerance: 1,
  truePeakLimit: -1,
  compressorThreshold: -20,
  compressorRatio: 4,
  attackTime: 10,
  releaseTime: 100,
  enableAutoGain: true,
  enablePeakLimiter: true,
  protectIntro: true,
  protectOutro: true,
  introDuration: 5,
  outroDuration: 5,
  fadeInDuration: 0.5,
  fadeOutDuration: 0.5
};

const audioFiles: AudioFile[] = [
  {
    id: 'audio-001',
    name: '科技前沿播客_EP01.mp3',
    duration: 1234,
    format: 'mp3',
    sampleRate: 44100,
    channels: 2,
    status: 'completed',
    integratedLufs: -16.2,
    truePeak: -1.1,
    createdAt: now - 7 * 24 * 60 * 60 * 1000,
    updatedAt: now - 6 * 24 * 60 * 60 * 1000
  },
  {
    id: 'audio-002',
    name: '创业故事分享_EP02.wav',
    duration: 2456,
    format: 'wav',
    sampleRate: 48000,
    channels: 1,
    status: 'ready',
    integratedLufs: -22.3,
    truePeak: 1.2,
    createdAt: now - 5 * 24 * 60 * 60 * 1000,
    updatedAt: now - 4 * 24 * 60 * 60 * 1000
  },
  {
    id: 'audio-003',
    name: '音乐漫谈_EP03.mp3',
    duration: 1890,
    format: 'mp3',
    sampleRate: 44100,
    channels: 2,
    status: 'processing',
    integratedLufs: -15.8,
    truePeak: -0.8,
    createdAt: now - 3 * 24 * 60 * 60 * 1000,
    updatedAt: now - 2 * 24 * 60 * 60 * 1000
  },
  {
    id: 'audio-004',
    name: '读书分享会_EP04.m4a',
    duration: 3125,
    format: 'm4a',
    sampleRate: 44100,
    channels: 2,
    status: 'analyzing',
    integratedLufs: -24.1,
    truePeak: 2.5,
    createdAt: now - 2 * 24 * 60 * 60 * 1000,
    updatedAt: now - 1 * 24 * 60 * 60 * 1000
  },
  {
    id: 'audio-005',
    name: '职场对话_EP05.wav',
    duration: 1567,
    format: 'wav',
    sampleRate: 48000,
    channels: 2,
    status: 'ready',
    integratedLufs: -19.7,
    truePeak: 0.5,
    createdAt: now - 1 * 24 * 60 * 60 * 1000,
    updatedAt: now
  }
];

const tracks: Track[] = [
  { id: 'track-001', audioId: 'audio-001', name: '主播轨道', guestName: '张三', gain: 0, muted: false, solo: false, color: '#3b82f6' },
  { id: 'track-002', audioId: 'audio-001', name: '嘉宾轨道', guestName: '李四', gain: -2, muted: false, solo: false, color: '#8b5cf6' },
  { id: 'track-003', audioId: 'audio-002', name: '主播轨道', guestName: '王五', gain: 0, muted: false, solo: false, color: '#10b981' },
  { id: 'track-004', audioId: 'audio-003', name: '音乐轨道', guestName: '赵六', gain: -5, muted: false, solo: false, color: '#f59e0b' },
  { id: 'track-005', audioId: 'audio-003', name: '人声轨道', guestName: '钱七', gain: 0, muted: false, solo: false, color: '#ef4444' },
  { id: 'track-006', audioId: 'audio-004', name: '主播轨道', guestName: '孙八', gain: 1, muted: false, solo: false, color: '#06b6d4' },
  { id: 'track-007', audioId: 'audio-005', name: '访谈轨道', guestName: '周九', gain: 0, muted: false, solo: false, color: '#ec4899' }
];

const loudnessData: Record<string, LoudnessData> = {
  'audio-001': {
    id: 'loudness-001',
    audioId: 'audio-001',
    integratedLufs: -18.5,
    rangeLufs: 8.2,
    truePeak: -0.3,
    momentaryLufs: Array.from({ length: 1234 }, (_, i) => -18.5 + Math.sin(i * 0.1) * 3 + (Math.random() - 0.5) * 2),
    shortTermLufs: Array.from({ length: 247 }, (_, i) => -18.5 + Math.sin(i * 0.05) * 2 + (Math.random() - 0.5) * 1),
    samplePoints: Array.from({ length: 1234 }, (_, i) => i)
  },
  'audio-002': {
    id: 'loudness-002',
    audioId: 'audio-002',
    integratedLufs: -22.3,
    rangeLufs: 12.5,
    truePeak: 1.2,
    momentaryLufs: Array.from({ length: 2456 }, (_, i) => -22.3 + Math.sin(i * 0.08) * 5 + (Math.random() - 0.5) * 3),
    shortTermLufs: Array.from({ length: 492 }, (_, i) => -22.3 + Math.sin(i * 0.04) * 3 + (Math.random() - 0.5) * 1.5),
    samplePoints: Array.from({ length: 2456 }, (_, i) => i)
  },
  'audio-003': {
    id: 'loudness-003',
    audioId: 'audio-003',
    integratedLufs: -15.8,
    rangeLufs: 6.7,
    truePeak: -0.8,
    momentaryLufs: Array.from({ length: 1890 }, (_, i) => -15.8 + Math.sin(i * 0.12) * 2.5 + (Math.random() - 0.5) * 1.5),
    shortTermLufs: Array.from({ length: 378 }, (_, i) => -15.8 + Math.sin(i * 0.06) * 1.5 + (Math.random() - 0.5) * 0.8),
    samplePoints: Array.from({ length: 1890 }, (_, i) => i)
  },
  'audio-004': {
    id: 'loudness-004',
    audioId: 'audio-004',
    integratedLufs: -24.1,
    rangeLufs: 15.3,
    truePeak: 2.5,
    momentaryLufs: Array.from({ length: 3125 }, (_, i) => -24.1 + Math.sin(i * 0.06) * 7 + (Math.random() - 0.5) * 4),
    shortTermLufs: Array.from({ length: 625 }, (_, i) => -24.1 + Math.sin(i * 0.03) * 4 + (Math.random() - 0.5) * 2),
    samplePoints: Array.from({ length: 3125 }, (_, i) => i)
  },
  'audio-005': {
    id: 'loudness-005',
    audioId: 'audio-005',
    integratedLufs: -19.7,
    rangeLufs: 9.8,
    truePeak: 0.5,
    momentaryLufs: Array.from({ length: 1567 }, (_, i) => -19.7 + Math.sin(i * 0.09) * 4 + (Math.random() - 0.5) * 2.5),
    shortTermLufs: Array.from({ length: 314 }, (_, i) => -19.7 + Math.sin(i * 0.045) * 2.5 + (Math.random() - 0.5) * 1.2),
    samplePoints: Array.from({ length: 1567 }, (_, i) => i)
  }
};

const peakMarks: PeakMark[] = [
  { id: 'peak-001', audioId: 'audio-001', time: 125.5, value: -0.3, fixed: true, type: 'overshoot' },
  { id: 'peak-002', audioId: 'audio-001', time: 456.2, value: -0.5, fixed: true, type: 'overshoot' },
  { id: 'peak-003', audioId: 'audio-001', time: 789.8, value: -0.2, fixed: false, type: 'clip' },
  { id: 'peak-004', audioId: 'audio-002', time: 234.1, value: 1.2, fixed: false, type: 'clip' },
  { id: 'peak-005', audioId: 'audio-002', time: 567.3, value: 0.8, fixed: true, type: 'clip' },
  { id: 'peak-006', audioId: 'audio-002', time: 1234.5, value: 1.0, fixed: false, type: 'clip' },
  { id: 'peak-007', audioId: 'audio-002', time: 1890.2, value: 0.5, fixed: true, type: 'overshoot' },
  { id: 'peak-008', audioId: 'audio-002', time: 2345.6, value: 0.9, fixed: false, type: 'clip' },
  { id: 'peak-009', audioId: 'audio-003', time: 345.7, value: -0.8, fixed: true, type: 'overshoot' },
  { id: 'peak-010', audioId: 'audio-003', time: 987.6, value: -0.6, fixed: true, type: 'overshoot' },
  { id: 'peak-011', audioId: 'audio-004', time: 123.4, value: 2.5, fixed: false, type: 'clip' },
  { id: 'peak-012', audioId: 'audio-004', time: 567.8, value: 1.8, fixed: false, type: 'clip' },
  { id: 'peak-013', audioId: 'audio-004', time: 1234.5, value: 2.1, fixed: false, type: 'clip' },
  { id: 'peak-014', audioId: 'audio-004', time: 2345.6, value: 1.5, fixed: false, type: 'overshoot' },
  { id: 'peak-015', audioId: 'audio-004', time: 2890.1, value: 2.0, fixed: false, type: 'clip' },
  { id: 'peak-016', audioId: 'audio-005', time: 234.5, value: 0.5, fixed: false, type: 'overshoot' },
  { id: 'peak-017', audioId: 'audio-005', time: 789.1, value: 0.3, fixed: false, type: 'overshoot' },
  { id: 'peak-018', audioId: 'audio-005', time: 1234.8, value: 0.7, fixed: false, type: 'clip' }
];

const protectedRegions: ProtectedRegion[] = [
  { id: 'region-001', audioId: 'audio-001', startTime: 0, endTime: 5, type: 'intro', enabled: true },
  { id: 'region-002', audioId: 'audio-001', startTime: 1229, endTime: 1234, type: 'outro', enabled: true },
  { id: 'region-003', audioId: 'audio-001', startTime: 600, endTime: 630, type: 'music', enabled: true },
  { id: 'region-004', audioId: 'audio-002', startTime: 0, endTime: 8, type: 'intro', enabled: true },
  { id: 'region-005', audioId: 'audio-002', startTime: 2448, endTime: 2456, type: 'outro', enabled: true },
  { id: 'region-006', audioId: 'audio-002', startTime: 1200, endTime: 1250, type: 'custom', enabled: true },
  { id: 'region-007', audioId: 'audio-003', startTime: 0, endTime: 3, type: 'intro', enabled: false },
  { id: 'region-008', audioId: 'audio-003', startTime: 1885, endTime: 1890, type: 'outro', enabled: true },
  { id: 'region-009', audioId: 'audio-003', startTime: 300, endTime: 400, type: 'music', enabled: true },
  { id: 'region-010', audioId: 'audio-004', startTime: 0, endTime: 10, type: 'intro', enabled: true },
  { id: 'region-011', audioId: 'audio-004', startTime: 3115, endTime: 3125, type: 'outro', enabled: true },
  { id: 'region-012', audioId: 'audio-005', startTime: 0, endTime: 5, type: 'intro', enabled: true },
  { id: 'region-013', audioId: 'audio-005', startTime: 1562, endTime: 1567, type: 'outro', enabled: true },
  { id: 'region-014', audioId: 'audio-005', startTime: 800, endTime: 900, type: 'custom', enabled: false }
];

const historyRecords: HistoryRecord[] = [
  { id: 'history-001', audioFileId: 'audio-001', description: '导入文件', config: defaultConfig, timestamp: now - 7 * 24 * 60 * 60 * 1000 },
  { id: 'history-002', audioFileId: 'audio-001', description: '分析完成：响度 -18.5 LUFS，峰值 -0.3 dBTP', config: defaultConfig, timestamp: now - 7 * 24 * 60 * 60 * 1000 + 5000 },
  { id: 'history-003', audioFileId: 'audio-001', description: '更新参数：目标响度 -16 LUFS', config: { ...defaultConfig, targetLufs: -16 }, previousConfig: { ...defaultConfig, targetLufs: -18 }, timestamp: now - 6 * 24 * 60 * 60 * 1000 },
  { id: 'history-004', audioFileId: 'audio-001', description: '开始响度修正处理', config: { ...defaultConfig, targetLufs: -16 }, timestamp: now - 6 * 24 * 60 * 60 * 1000 + 10000 },
  { id: 'history-005', audioFileId: 'audio-001', description: '处理完成：响度 -16.2 LUFS，峰值 -1.1 dBTP', config: { ...defaultConfig, targetLufs: -16 }, timestamp: now - 6 * 24 * 60 * 60 * 1000 + 22500 },
  { id: 'history-006', audioFileId: 'audio-002', description: '导入文件', config: defaultConfig, timestamp: now - 5 * 24 * 60 * 60 * 1000 },
  { id: 'history-007', audioFileId: 'audio-002', description: '分析完成：响度 -22.3 LUFS，峰值 1.2 dBTP', config: defaultConfig, timestamp: now - 5 * 24 * 60 * 60 * 1000 + 8000 },
  { id: 'history-008', audioFileId: 'audio-002', description: '添加保护区域：1200s - 1250s', config: defaultConfig, timestamp: now - 4 * 24 * 60 * 60 * 1000 },
  { id: 'history-009', audioFileId: 'audio-003', description: '导入文件', config: defaultConfig, timestamp: now - 3 * 24 * 60 * 60 * 1000 },
  { id: 'history-010', audioFileId: 'audio-003', description: '分析完成：响度 -15.8 LUFS，峰值 -0.8 dBTP', config: defaultConfig, timestamp: now - 3 * 24 * 60 * 60 * 1000 + 6000 },
  { id: 'history-011', audioFileId: 'audio-004', description: '导入文件', config: defaultConfig, timestamp: now - 2 * 24 * 60 * 60 * 1000 },
  { id: 'history-012', audioFileId: 'audio-005', description: '导入文件', config: defaultConfig, timestamp: now - 1 * 24 * 60 * 60 * 1000 }
];

const reports: ProcessReport[] = [
  {
    id: 'report-001',
    audioFileId: 'audio-001',
    originalLufs: -18.5,
    processedLufs: -16.2,
    originalTruePeak: -0.3,
    processedTruePeak: -1.1,
    duration: 12.5,
    config: { ...defaultConfig, targetLufs: -16 },
    timestamp: now - 6 * 24 * 60 * 60 * 1000,
    peakMarksCount: 3,
    fixedPeaksCount: 2,
    processingTime: 12.5
  }
];

export const mockData = {
  audioFiles,
  tracks,
  loudnessData,
  peakMarks,
  protectedRegions,
  historyRecords,
  reports,
  defaultConfig
};
