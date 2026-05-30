import type { Track, TimelineEvent, Conflict, ImportBatch, EmotionTag } from '../shared/types';

const generateId = () => Math.random().toString(36).substring(2, 11);

const now = new Date();
const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();

const emotionTags: EmotionTag[] = ['happy', 'sad', 'energetic', 'calm', 'romantic', 'angry', 'nostalgic', 'hopeful'];

const trackTitles = [
  { title: '夜曲', artist: '周杰伦', album: '十一月的萧邦' },
  { title: '稻香', artist: '周杰伦', album: '魔杰座' },
  { title: '晴天', artist: '周杰伦', album: '叶惠美' },
  { title: '七里香', artist: '周杰伦', album: '七里香' },
  { title: '青花瓷', artist: '周杰伦', album: '我很忙' },
  { title: '告白气球', artist: '周杰伦', album: '周杰伦的床边故事' },
  { title: '简单爱', artist: '周杰伦', album: '范特西' },
  { title: '搁浅', artist: '周杰伦', album: '七里香' },
  { title: '听妈妈的话', artist: '周杰伦', album: '依然范特西' },
  { title: '以父之名', artist: '周杰伦', album: '叶惠美' },
  { title: '光辉岁月', artist: 'Beyond', album: '命运派对' },
  { title: '海阔天空', artist: 'Beyond', album: '乐与怒' },
  { title: '真的爱你', artist: 'Beyond', album: 'Beyond IV' },
  { title: '不再犹豫', artist: 'Beyond', album: '犹豫' },
  { title: '冷雨夜', artist: 'Beyond', album: '现代舞台' },
  { title: '喜欢你', artist: 'Beyond', album: '秘密警察' },
  { title: '情人', artist: 'Beyond', album: '乐与怒' },
  { title: '大地', artist: 'Beyond', album: '秘密警察' },
  { title: 'AMANI', artist: 'Beyond', album: '犹豫' },
  { title: '长城', artist: 'Beyond', album: '继续革命' },
  { title: '童话', artist: '光良', album: '童话' },
  { title: '勇气', artist: '梁静茹', album: '勇气' },
  { title: '后来', artist: '刘若英', album: '我等你' },
  { title: '遇见', artist: '孙燕姿', album: 'The Moment' },
  { title: '开始懂了', artist: '孙燕姿', album: '我要的幸福' },
];

const randomEmotions = (count: number): EmotionTag[] => {
  const shuffled = [...emotionTags].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
};

const algorithmBias = (): EmotionTag[] => {
  const base = randomEmotions(3);
  if (Math.random() > 0.7) {
    return base;
  }
  return base;
};

const manualBias = (algorithm: EmotionTag[]): EmotionTag[] => {
  if (Math.random() > 0.6) {
    return algorithm;
  }
  const manual = [...algorithm];
  if (Math.random() > 0.5 && manual.length > 1) {
    manual.pop();
  }
  const newTags = emotionTags.filter(t => !manual.includes(t));
  if (newTags.length > 0 && Math.random() > 0.5) {
    manual.push(newTags[Math.floor(Math.random() * newTags.length)]);
  }
  return manual;
};

export const mockTracks: Track[] = trackTitles.map((t, index) => {
  const algorithmTags = algorithmBias();
  const manualTags = manualBias(algorithmTags);
  const copyrightStatus = Math.random() > 0.15 ? 'active' : 'removed';
  const isRecommended = Math.random() > 0.5;
  const hasConflict = algorithmTags.join(',') !== manualTags.join(',') ||
    (copyrightStatus === 'removed' && isRecommended);

  return {
    id: generateId(),
    trackId: `TRK${String(index + 1).padStart(6, '0')}`,
    title: t.title,
    artist: t.artist,
    album: t.album,
    algorithmTags,
    manualTags,
    copyrightStatus,
    isRecommended,
    status: hasConflict ? 'pending' : copyrightStatus === 'removed' ? 'removed' : 'active',
    createdAt: daysAgo(Math.floor(Math.random() * 30)),
    updatedAt: daysAgo(Math.floor(Math.random() * 7)),
    importBatchId: 'BATCH001',
  };
});

export const mockTimelineEvents: TimelineEvent[] = mockTracks.flatMap((track, trackIndex) => {
  const events: TimelineEvent[] = [];
  const baseDate = daysAgo(30 - trackIndex);

  events.push({
    id: generateId(),
    trackId: track.id,
    eventType: 'algorithm_tag',
    timestamp: baseDate,
    operator: 'algorithm-v2.3',
    description: `算法生成情绪标签: ${track.algorithmTags.join(', ')}`,
    metadata: { version: 'v2.3', model: 'emotion-bert' },
  });

  if (track.manualTags.length > 0) {
    events.push({
      id: generateId(),
      trackId: track.id,
      eventType: 'manual_tag',
      timestamp: daysAgo(25 - trackIndex),
      operator: '运营专员A',
      description: `人工标注情绪标签: ${track.manualTags.join(', ')}`,
      evidence: '根据歌词内容和旋律情感分析',
    });
  }

  if (track.copyrightStatus === 'removed') {
    events.push({
      id: generateId(),
      trackId: track.id,
      eventType: 'copyright_remove',
      timestamp: daysAgo(10 - trackIndex % 5),
      operator: '版权管理系统',
      description: '曲目因版权问题下架',
      metadata: { reason: '授权到期', provider: '华纳音乐' },
    });
  }

  if (track.isRecommended) {
    events.push({
      id: generateId(),
      trackId: track.id,
      eventType: 'recommend',
      timestamp: daysAgo(5 - trackIndex % 3),
      operator: '推荐引擎',
      description: '曲目加入"治愈系"歌单推荐',
      metadata: { playlistId: 'PL00123', position: 8 },
    });
  }

  if (track.algorithmTags.join(',') !== track.manualTags.join(',')) {
    events.push({
      id: generateId(),
      trackId: track.id,
      eventType: 'manual_correction',
      timestamp: daysAgo(3 - trackIndex % 2),
      operator: '运营专员B',
      description: '人工修正标签差异，补充证据说明',
      evidence: '用户调研数据显示听众更倾向于人工标注的情绪分类',
    });
  }

  return events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
});

export const mockConflicts: Conflict[] = mockTracks
  .filter(track => {
    const tagConflict = track.algorithmTags.join(',') !== track.manualTags.join(',');
    const copyrightConflict = track.copyrightStatus === 'removed' && track.isRecommended;
    return tagConflict || copyrightConflict;
  })
  .map((track, index) => {
    const tagConflict = track.algorithmTags.join(',') !== track.manualTags.join(',');
    const copyrightConflict = track.copyrightStatus === 'removed' && track.isRecommended;

    let conflictType: Conflict['conflictType'] = 'algorithm_vs_manual';
    let severity: Conflict['severity'] = 'medium';
    let description = '';

    if (copyrightConflict) {
      conflictType = 'copyright_vs_recommend';
      severity = 'high';
      description = '曲目已版权下架，但仍在推荐列表中';
    } else if (tagConflict) {
      const intersection = track.algorithmTags.filter(t => track.manualTags.includes(t));
      const similarity = intersection.length / Math.max(track.algorithmTags.length, track.manualTags.length);
      severity = similarity < 0.3 ? 'high' : similarity < 0.6 ? 'medium' : 'low';
      conflictType = similarity < 0.3 ? 'version_mismatch' : 'algorithm_vs_manual';
      description = `算法标签[${track.algorithmTags.join(',')}]与人工标签[${track.manualTags.join(',')}]不一致`;
    }

    return {
      id: generateId(),
      trackId: track.id,
      conflictType,
      severity,
      description,
      resolved: index % 3 === 0,
      resolvedAt: index % 3 === 0 ? daysAgo(index % 5) : undefined,
      resolver: index % 3 === 0 ? '运营主管' : undefined,
      resolutionNote: index % 3 === 0 ? '已确认人工标签正确，更新算法模型训练数据' : undefined,
      createdAt: daysAgo(index + 1),
    };
  });

export const mockImportBatches: ImportBatch[] = [
  {
    id: 'BATCH001',
    fileName: '情绪标签_20240115.csv',
    importedAt: daysAgo(30),
    operator: '运营专员A',
    totalCount: 25,
    newCount: 25,
    updatedCount: 0,
    unchangedCount: 0,
    status: 'completed',
  },
  {
    id: 'BATCH002',
    fileName: '情绪标签_补传_20240120.csv',
    importedAt: daysAgo(25),
    operator: '运营专员B',
    totalCount: 15,
    newCount: 5,
    updatedCount: 8,
    unchangedCount: 2,
    status: 'completed',
  },
];
