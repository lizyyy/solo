import type { Track, Annotation, Conflict, ImportRecord } from '@/types';
import { generateId } from './fileParser';

export const generateMockData = (): {
  tracks: Track[];
  annotations: Annotation[];
  conflicts: Conflict[];
  importRecords: ImportRecord[];
} => {
  const now = new Date().toISOString();
  const trackId1 = generateId();
  const trackId2 = generateId();
  const trackId3 = generateId();
  const trackId4 = generateId();
  const trackId5 = generateId();

  const tracks: Track[] = [
    {
      id: trackId1,
      channelNo: '1',
      trackName: '夜曲',
      artist: '周杰伦',
      duration: '3:45',
      fileName: '01_夜曲_周杰伦.mp3',
      fileSize: 4523000,
      status: 'normal',
      metadata: { version: '原版', originalName: '01_夜曲_周杰伦.mp3' },
      createdAt: now,
      updatedAt: now,
    },
    {
      id: trackId2,
      channelNo: '2',
      trackName: '稻香',
      artist: '周杰伦',
      duration: '3:43',
      fileName: '02稻香 - 周杰伦.wav',
      fileSize: 28450000,
      status: 'normal',
      metadata: { version: 'live', originalName: '02稻香 - 周杰伦.wav' },
      createdAt: now,
      updatedAt: now,
    },
    {
      id: trackId3,
      channelNo: '3',
      trackName: '晴天',
      artist: '周杰伦',
      duration: '4:29',
      fileName: '晴天_Jay_Chou.mp3',
      fileSize: 5120000,
      status: 'conflict',
      metadata: { version: 'remix', originalName: '晴天_Jay_Chou.mp3' },
      createdAt: now,
      updatedAt: now,
    },
    {
      id: trackId4,
      channelNo: '4',
      trackName: '七里香',
      artist: '周杰伦',
      duration: '4:59',
      fileName: '04 七里香.flac',
      fileSize: 32500000,
      status: 'normal',
      metadata: { originalName: '04 七里香.flac' },
      createdAt: now,
      updatedAt: now,
    },
    {
      id: trackId5,
      channelNo: '',
      trackName: '青花瓷',
      artist: '',
      duration: '',
      fileName: '青花.mp3',
      fileSize: 3800000,
      status: 'error',
      metadata: { originalName: '青花.mp3' },
      createdAt: now,
      updatedAt: now,
    },
  ];

  const annotations: Annotation[] = [
    {
      id: generateId(),
      trackId: trackId1,
      content: '这是林老师提供的原版录音，用于舞台主通道。版权归属确认无误。',
      author: '林老师',
      createdAt: now,
      version: 1,
    },
    {
      id: generateId(),
      trackId: trackId2,
      content: '现场演出版本，掌声已处理。建议核对演出日期和场次信息。',
      author: '林老师',
      createdAt: now,
      version: 1,
    },
    {
      id: generateId(),
      trackId: trackId3,
      content: '名称存在冲突，需要核对原始档案。文件名显示为"晴天"，但疑似是另一首歌。',
      author: '林老师',
      createdAt: now,
      version: 1,
    },
  ];

  const conflicts: Conflict[] = [
    {
      id: generateId(),
      trackId: trackId3,
      sourceA: '舞台通道表',
      sourceB: '导入文件',
      field: 'trackName',
      valueA: '晴天',
      valueB: '青花瓷',
      status: 'pending',
      suggestedAction: '建议核对原始文件的实际内容，确认曲目名称',
    },
    {
      id: generateId(),
      trackId: trackId3,
      sourceA: '舞台通道表',
      sourceB: '导入文件',
      field: 'artist',
      valueA: '周杰伦',
      valueB: 'Jay Chou',
      status: 'pending',
      suggestedAction: '两者为同一人，建议统一使用中文名称',
    },
  ];

  const importRecords: ImportRecord[] = [
    {
      id: generateId(),
      fileName: '01_夜曲_周杰伦.mp3',
      fileSize: 4523000,
      status: 'success',
      importedAt: now,
      trackId: trackId1,
    },
    {
      id: generateId(),
      fileName: '02稻香 - 周杰伦.wav',
      fileSize: 28450000,
      status: 'success',
      importedAt: now,
      trackId: trackId2,
    },
    {
      id: generateId(),
      fileName: '晴天_Jay_Chou.mp3',
      fileSize: 5120000,
      status: 'success',
      importedAt: now,
      trackId: trackId3,
    },
    {
      id: generateId(),
      fileName: '04 七里香.flac',
      fileSize: 32500000,
      status: 'success',
      importedAt: now,
      trackId: trackId4,
    },
    {
      id: generateId(),
      fileName: '坏文件.txt',
      fileSize: 0,
      status: 'failed',
      errorReason: '不支持的文件格式: .txt，仅支持 .mp3, .wav, .flac, .aac, .m4a, .ogg',
      importedAt: now,
    },
    {
      id: generateId(),
      fileName: '青花.mp3',
      fileSize: 3800000,
      status: 'success',
      importedAt: now,
      trackId: trackId5,
    },
  ];

  return { tracks, annotations, conflicts, importRecords };
};
