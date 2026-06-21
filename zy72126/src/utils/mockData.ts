import type { Track, Annotation, Conflict, ImportRecord, ChannelTableEntry } from '@/types';
import { generateId } from './fileParser';

export const generateMockData = (): {
  channelTable: ChannelTableEntry[];
  tracks: Track[];
  annotations: Annotation[];
  conflicts: Conflict[];
  importRecords: ImportRecord[];
} => {
  const now = new Date().toISOString();

  const ch1 = generateId();
  const ch2 = generateId();
  const ch3 = generateId();
  const ch4 = generateId();
  const ch5 = generateId();
  const ch6 = generateId();

  const channelTable: ChannelTableEntry[] = [
    { id: ch1, channelNo: '1', trackName: '夜曲', artist: '周杰伦', duration: '3:45', source: '微信聊天记录', fileStatus: 'matched', createdAt: now, updatedAt: now },
    { id: ch2, channelNo: '2', trackName: '稻香', artist: '周杰伦', duration: '3:43', source: '林老师手写', fileStatus: 'matched', createdAt: now, updatedAt: now },
    { id: ch3, channelNo: '3', trackName: '晴天', artist: '周杰伦', duration: '4:29', fileStatus: 'matched', createdAt: now, updatedAt: now },
    { id: ch4, channelNo: '4', trackName: '七里香', artist: '周杰伦', duration: '4:59', fileStatus: 'matched', createdAt: now, updatedAt: now },
    { id: ch5, channelNo: '5', trackName: '青花瓷', artist: '周杰伦', duration: '3:52', source: '邮件附件', note: '春晚版本', fileStatus: 'matched', createdAt: now, updatedAt: now },
    { id: ch6, channelNo: '6', trackName: '双截棍', artist: '周杰伦', duration: '3:20', source: '短信记录', note: '待补传文件', fileStatus: 'pending', createdAt: now, updatedAt: now },
  ];

  const trackId1 = generateId();
  const trackId2 = generateId();
  const trackId3 = generateId();
  const trackId4 = generateId();
  const trackId5 = generateId();
  const trackId6 = generateId();

  const tracks: Track[] = [
    {
      id: trackId1, channelNo: '1', trackName: '夜曲', artist: '周杰伦', duration: '3:45',
      fileName: '01_夜曲_周杰伦.mp3', fileSize: 4523000, status: 'normal',
      metadata: { version: '原版', originalName: '01_夜曲_周杰伦.mp3' },
      channelTableId: ch1, createdAt: now, updatedAt: now,
    },
    {
      id: trackId2, channelNo: '2', trackName: '稻香', artist: '周杰伦', duration: '3:43',
      fileName: '02稻香 - 周杰伦.wav', fileSize: 28450000, status: 'normal',
      metadata: { version: 'live', originalName: '02稻香 - 周杰伦.wav' },
      channelTableId: ch2, createdAt: now, updatedAt: now,
    },
    {
      id: trackId3, channelNo: '3', trackName: '晴天', artist: '周杰伦', duration: '4:29',
      fileName: '晴天_Jay_Chou.mp3', fileSize: 5120000, status: 'conflict',
      metadata: { version: 'remix', originalName: '晴天_Jay_Chou.mp3' },
      channelTableId: ch3, createdAt: now, updatedAt: now,
    },
    {
      id: trackId4, channelNo: '4', trackName: '七里香', artist: '周杰伦', duration: '4:59',
      fileName: '04 七里香.flac', fileSize: 32500000, status: 'normal',
      metadata: { originalName: '04 七里香.flac' },
      channelTableId: ch4, createdAt: now, updatedAt: now,
    },
    {
      id: trackId5, channelNo: '5', trackName: '青花瓷', artist: '周杰伦', duration: '3:52',
      fileName: '05_青花瓷_周杰伦.mp3', fileSize: 4100000, status: 'normal',
      metadata: { originalName: '05_青花瓷_周杰伦.mp3' },
      channelTableId: ch5, createdAt: now, updatedAt: now,
    },
    {
      id: trackId6, channelNo: '', trackName: '告白气球', artist: '周杰伦', duration: '3:35',
      fileName: '告白气球.mp3', fileSize: 3800000, status: 'conflict',
      metadata: { originalName: '告白气球.mp3' },
      createdAt: now, updatedAt: now,
    },
  ];

  const annotations: Annotation[] = [
    {
      id: generateId(), trackId: trackId1,
      content: '这是林老师提供的原版录音，用于舞台主通道。版权归属确认无误。',
      author: '林老师', createdAt: now, version: 1,
    },
    {
      id: generateId(), trackId: trackId2,
      content: '现场演出版本，掌声已处理。建议核对演出日期和场次信息。',
      author: '林老师', createdAt: now, version: 1,
    },
    {
      id: generateId(), trackId: trackId3,
      content: '文件名中艺术家写为"Jay Chou"，与通道表"周杰伦"不一致，疑似同一人不同写法。',
      author: '林老师', createdAt: now, version: 1,
    },
    {
      id: generateId(), trackId: trackId6,
      content: '此文件在通道表中找不到对应记录，可能是额外加入的曲目或命名不一致。',
      author: '林老师', createdAt: now, version: 1,
    },
  ];

  const conflicts: Conflict[] = [
    {
      id: generateId(), trackId: trackId3, channelEntryId: ch3,
      conflictType: 'value_mismatch',
      sourceA: '舞台通道表', sourceB: '导入文件',
      field: 'artist', valueA: '周杰伦', valueB: 'Jay Chou',
      originalValueA: '周杰伦', originalValueB: 'Jay Chou',
      status: 'pending',
      suggestedAction: '艺术家名写法不同（通道表: 周杰伦, 文件: Jay Chou），疑似同一人，建议统一',
      createdAt: now,
    },
    {
      id: generateId(), trackId: trackId6,
      conflictType: 'extra_file',
      sourceA: '舞台通道表', sourceB: '导入文件',
      field: 'trackName', valueA: '无匹配记录', valueB: '告白气球',
      originalValueA: '无匹配记录', originalValueB: '告白气球',
      status: 'pending',
      suggestedAction: '文件"告白气球.mp3"在舞台通道表中找不到匹配项。可能是多余文件，或通道表尚未录入，建议人工确认',
      createdAt: now,
    },
    {
      id: generateId(), channelEntryId: ch6,
      conflictType: 'missing_file',
      sourceA: '缺失检测', sourceB: '舞台通道表',
      field: 'trackName', valueA: '双截棍', valueB: '未找到对应文件',
      originalValueA: '双截棍', originalValueB: '未找到对应文件',
      status: 'pending',
      suggestedAction: '通道表第6通道"双截棍"没有对应的导入文件。可能漏传文件，或文件名无法匹配，建议人工确认',
      createdAt: now,
    },
  ];

  const importRecords: ImportRecord[] = [
    { id: generateId(), fileName: '01_夜曲_周杰伦.mp3', fileSize: 4523000, status: 'success', importedAt: now, trackId: trackId1 },
    { id: generateId(), fileName: '02稻香 - 周杰伦.wav', fileSize: 28450000, status: 'success', importedAt: now, trackId: trackId2 },
    { id: generateId(), fileName: '晴天_Jay_Chou.mp3', fileSize: 5120000, status: 'success', importedAt: now, trackId: trackId3 },
    { id: generateId(), fileName: '04 七里香.flac', fileSize: 32500000, status: 'success', importedAt: now, trackId: trackId4 },
    { id: generateId(), fileName: '05_青花瓷_周杰伦.mp3', fileSize: 4100000, status: 'success', importedAt: now, trackId: trackId5 },
    { id: generateId(), fileName: '坏文件.txt', fileSize: 0, status: 'failed', errorReason: '不支持的文件格式: .txt，仅支持 .mp3, .wav, .flac, .aac, .m4a, .ogg', importedAt: now },
    { id: generateId(), fileName: '告白气球.mp3', fileSize: 3800000, status: 'success', importedAt: now, trackId: trackId6 },
  ];

  return { channelTable, tracks, annotations, conflicts, importRecords };
};
