import {
  WeeklyRecord,
  FileItem,
  Track,
  Annotation,
  Conflict,
  Note,
  WeeklyReport,
} from '@/types';
import { generateId } from '@/utils/storage';
import { getWeekKey, getWeekDateRange } from '@/utils/dateUtils';

export interface SampleData {
  record: WeeklyRecord;
  files: FileItem[];
  tracks: Track[];
  annotations: Annotation[];
  conflicts: Conflict[];
  notes: Note[];
  reports: Record<string, WeeklyReport>;
}

export function getSampleData(): SampleData {
  const weekKey = getWeekKey(new Date(2026, 5, 2));
  const { start, end } = getWeekDateRange(weekKey);
  const recordId = generateId();

  const record: WeeklyRecord = {
    id: recordId,
    weekKey,
    title: `2026年6月第23周 钢琴陪练周报`,
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    status: 'draft',
    operator: '老许',
    createdAt: new Date(2026, 5, 2, 10, 0).toISOString(),
    updatedAt: new Date(2026, 5, 2, 15, 30).toISOString(),
  };

  const files: FileItem[] = [
    {
      id: generateId(),
      recordId,
      name: '曲目表-6月第一周.txt',
      type: 'tracklist',
      size: 256,
      status: 'success',
      uploadTime: new Date(2026, 5, 2, 10, 5).toISOString(),
      metadata: {
        content: `1. 月光奏鸣曲 - 贝多芬 - 5:30
2. 致爱丽丝 - 贝多芬 - 3:15
3. 童年的回忆 - 克莱德曼 - 4:20`,
        tracks: [
          { trackNo: 1, name: '月光奏鸣曲', composer: '贝多芬', duration: 330 },
          { trackNo: 2, name: '致爱丽丝', composer: '贝多芬', duration: 195 },
          { trackNo: 3, name: '童年的回忆', composer: '克莱德曼', duration: 260 },
        ],
      },
    },
    {
      id: generateId(),
      recordId,
      name: '01_月光奏鸣曲.mp3',
      type: 'audio',
      size: 8 * 1024 * 1024,
      status: 'success',
      uploadTime: new Date(2026, 5, 2, 10, 6).toISOString(),
      duration: 332,
      metadata: { sampleRate: 44100, channels: 2 },
    },
    {
      id: generateId(),
      recordId,
      name: '02_致爱丽丝.mp3',
      type: 'audio',
      size: 5 * 1024 * 1024,
      status: 'success',
      uploadTime: new Date(2026, 5, 2, 10, 7).toISOString(),
      duration: 198,
      metadata: { sampleRate: 44100, channels: 2 },
    },
    {
      id: generateId(),
      recordId,
      name: '03_童年的回忆.mp3',
      type: 'audio',
      size: 6 * 1024 * 1024,
      status: 'warning',
      warningReason: '时长偏差8%，比曲目表标注的短一些',
      uploadTime: new Date(2026, 5, 2, 10, 8).toISOString(),
      duration: 245,
      metadata: { sampleRate: 44100, channels: 2 },
    },
    {
      id: generateId(),
      recordId,
      name: '04_损坏文件.mp3',
      type: 'audio',
      size: 128,
      status: 'error',
      errorReason: '文件太小，可能已经损坏，无法解码',
      uploadTime: new Date(2026, 5, 2, 10, 9).toISOString(),
      metadata: {},
    },
    {
      id: generateId(),
      recordId,
      name: '排练群聊天记录.txt',
      type: 'text',
      size: 512,
      status: 'success',
      uploadTime: new Date(2026, 5, 2, 10, 10).toISOString(),
      metadata: {
        content: `老王：月光奏鸣曲第三小节速度再慢点
小李：致爱丽丝结尾那个音老许说要重录
老许：童年的回忆按4分10秒版来，别按曲目表`,
        annotations: [
          { author: '老王', content: '月光奏鸣曲第三小节速度再慢点' },
          { author: '小李', content: '致爱丽丝结尾那个音老许说要重录' },
          { author: '老许', content: '童年的回忆按4分10秒版来，别按曲目表' },
        ],
      },
    },
    {
      id: generateId(),
      recordId,
      name: '合同截图-6月.png',
      type: 'image',
      size: 2 * 1024 * 1024,
      status: 'success',
      uploadTime: new Date(2026, 5, 2, 10, 11).toISOString(),
      previewUrl: '',
      metadata: {},
    },
  ];

  const audioFile1 = files[1];
  const audioFile2 = files[2];
  const audioFile3 = files[3];

  const tracks: Track[] = [
    {
      id: generateId(),
      recordId,
      fileId: audioFile1.id,
      name: '月光奏鸣曲',
      trackNo: 1,
      composer: '贝多芬',
      duration: 332,
      expectedDuration: 330,
      status: 'matched',
      rawData: {},
    },
    {
      id: generateId(),
      recordId,
      fileId: audioFile2.id,
      name: '致爱丽丝',
      trackNo: 2,
      composer: '贝多芬',
      duration: 198,
      expectedDuration: 195,
      status: 'matched',
      rawData: {},
    },
    {
      id: generateId(),
      recordId,
      fileId: audioFile3.id,
      name: '童年的回忆',
      trackNo: 3,
      composer: '克莱德曼',
      duration: 245,
      expectedDuration: 260,
      status: 'matched',
      rawData: {},
    },
  ];

  const track1 = tracks[0];
  const track2 = tracks[1];
  const track3 = tracks[2];

  const annotations: Annotation[] = [
    {
      id: generateId(),
      recordId,
      trackId: track1.id,
      source: 'chat',
      content: '月光奏鸣曲第三小节速度再慢点',
      author: '老王',
      timestamp: new Date(2026, 5, 1, 14, 30).toISOString(),
    },
    {
      id: generateId(),
      recordId,
      trackId: track2.id,
      source: 'chat',
      content: '致爱丽丝结尾那个音老许说要重录',
      author: '小李',
      timestamp: new Date(2026, 5, 1, 15, 0).toISOString(),
    },
    {
      id: generateId(),
      recordId,
      trackId: track3.id,
      source: 'chat',
      content: '童年的回忆按4分10秒版来，别按曲目表',
      author: '老许',
      timestamp: new Date(2026, 5, 1, 16, 20).toISOString(),
    },
  ];

  const conflicts: Conflict[] = [
    {
      id: generateId(),
      recordId,
      trackId: track3.id,
      type: 'duration_mismatch',
      sideA: {
        source: '曲目表',
        value: '4分20秒 (260秒)',
        evidence: '曲目表-6月第一周.txt 第3行',
      },
      sideB: {
        source: '群聊（老许）',
        value: '4分10秒 (250秒)',
        evidence: '排练群聊天记录.txt 第3条',
      },
      suggestion: '建议按老许说的4分10秒来，毕竟是他拍板的。实际音频是4分05秒，差5秒可能是开头结尾没剪齐，可以问问。',
      resolution: 'unresolved',
    },
  ];

  const notes: Note[] = [
    {
      id: generateId(),
      recordId,
      trackId: track2.id,
      content: '致爱丽丝已重录，新文件在U盘里，下周补',
      author: '老许',
      isSupplement: true,
      previousContent: '',
      createdAt: new Date(2026, 5, 2, 15, 30).toISOString(),
    },
  ];

  const report: WeeklyReport = {
    recordId,
    generatedAt: new Date(2026, 5, 2, 16, 0).toISOString(),
    summary: {
      totalTracks: 3,
      totalDuration: (332 + 198 + 245) / 60,
      matchedTracks: 3,
      unmatchedTracks: 0,
      conflicts: 1,
      resolvedConflicts: 0,
      annotations: 3,
      notes: 1,
    },
    content: '',
    anomalies: [
      {
        trackId: track3.id,
        trackName: '童年的回忆',
        issue: '时长三方不一致：曲目表4:20，群聊说按4:10，实际音频4:05',
        status: '待处理',
      },
      {
        trackId: audioFile3.id,
        trackName: '03_童年的回忆.mp3',
        issue: '时长偏差8%，比曲目表标注的短',
        status: '有异常',
      },
      {
        trackId: files[4].id,
        trackName: '04_损坏文件.mp3',
        issue: '文件损坏，无法解码',
        status: '导入失败',
      },
    ],
  };

  return {
    record,
    files,
    tracks,
    annotations,
    conflicts,
    notes,
    reports: { [recordId]: report },
  };
}

export function generateWeeklyReportContent(
  record: WeeklyRecord,
  tracks: Track[],
  files: FileItem[],
  conflicts: Conflict[],
  annotations: Annotation[],
  notes: Note[]
): string {
  const totalDuration = tracks.reduce((sum, t) => sum + (t.duration || 0), 0);
  const totalDurationStr = `${Math.floor(totalDuration / 60)}分${Math.round(totalDuration % 60)}秒`;
  
  const matchedCount = tracks.filter(t => t.status === 'matched').length;
  const unmatchedCount = tracks.filter(t => t.status === 'unmatched').length;
  
  const errorFiles = files.filter(f => f.status === 'error');
  const warningFiles = files.filter(f => f.status === 'warning');
  const unresolvedConflicts = conflicts.filter(c => c.resolution === 'unresolved');
  const supplements = notes.filter(n => n.isSupplement);

  let content = `老许，这是你这周的陪练情况：\n\n`;
  
  content += `📅 ${record.title}\n`;
  content += `👤 操作人：${record.operator}\n\n`;
  
  content += `---\n\n`;
  
  content += `【本周概览】\n`;
  content += `• 共处理曲目：${tracks.length} 首\n`;
  content += `• 总时长：${totalDurationStr}\n`;
  content += `• 已匹配关联：${matchedCount} 首\n`;
  if (unmatchedCount > 0) {
    content += `• 待关联：${unmatchedCount} 首\n`;
  }
  content += `• 群聊批注：${annotations.length} 条\n\n`;
  
  content += `---\n\n`;
  
  content += `【曲目详情】\n`;
  tracks.forEach((track, index) => {
    const duration = track.duration 
      ? `${Math.floor(track.duration / 60)}:${Math.round(track.duration % 60).toString().padStart(2, '0')}`
      : '--:--';
    const statusIcon = track.status === 'matched' ? '✓' : '⚠';
    content += `${index + 1}. ${track.name} - ${track.composer || '未知'} - ${duration} ${statusIcon}\n`;
    
    const trackAnnotations = annotations.filter(a => a.trackId === track.id);
    if (trackAnnotations.length > 0) {
      trackAnnotations.forEach(a => {
        content += `   💬 ${a.author}：${a.content}\n`;
      });
    }
    
    const trackNotes = notes.filter(n => n.trackId === track.id);
    trackNotes.forEach(n => {
      if (n.isSupplement) {
        content += `   📝 [补录] ${n.author}：${n.content}\n`;
      } else {
        content += `   📝 ${n.author}：${n.content}\n`;
      }
    });
    content += '\n';
  });
  
  if (errorFiles.length > 0 || warningFiles.length > 0 || unresolvedConflicts.length > 0) {
    content += `---\n\n`;
    content += `【需要注意的问题】\n\n`;
    
    if (errorFiles.length > 0) {
      content += `❌ 导入失败的文件（${errorFiles.length} 个）：\n`;
      errorFiles.forEach(f => {
        content += `   • ${f.name}：${f.errorReason}\n`;
      });
      content += '\n';
    }
    
    if (warningFiles.length > 0) {
      content += `⚠️ 有异常的文件（${warningFiles.length} 个）：\n`;
      warningFiles.forEach(f => {
        content += `   • ${f.name}：${f.warningReason}\n`;
      });
      content += '\n';
    }
    
    if (unresolvedConflicts.length > 0) {
      content += `⚔️ 待处理的冲突（${unresolvedConflicts.length} 个）：\n`;
      unresolvedConflicts.forEach(c => {
        const track = tracks.find(t => t.id === c.trackId);
        content += `   • ${track?.name || '未知曲目'}：\n`;
        content += `     - ${c.sideA.source}：${c.sideA.value}\n`;
        content += `     - ${c.sideB.source}：${c.sideB.value}\n`;
        content += `     建议：${c.suggestion}\n\n`;
      });
    }
  }
  
  if (supplements.length > 0) {
    content += `---\n\n`;
    content += `【补录备注】\n`;
    supplements.forEach(n => {
      const track = tracks.find(t => t.id === n.trackId);
      const dateStr = new Date(n.createdAt).toLocaleString('zh-CN');
      content += `• ${track?.name || '通用'} - ${dateStr}\n`;
      content += `  ${n.author}：${n.content}\n`;
      if (n.previousContent) {
        content += `  原记录：${n.previousContent}\n`;
      }
      content += '\n';
    });
  }
  
  if (conflicts.filter(c => c.resolution !== 'unresolved').length > 0) {
    content += `---\n\n`;
    content += `【已处理的冲突】\n`;
    conflicts
      .filter(c => c.resolution !== 'unresolved')
      .forEach(c => {
        const track = tracks.find(t => t.id === c.trackId);
        const resolutionText = c.resolution === 'use_a' 
          ? `采用了「${c.sideA.source}」的说法`
          : c.resolution === 'use_b'
            ? `采用了「${c.sideB.source}」的说法`
            : '两边都保留了';
        content += `• ${track?.name || '未知曲目'}：${resolutionText}\n`;
        content += `  处理人：${c.resolvedBy}\n`;
        content += `  理由：${c.resolutionNote}\n\n`;
      });
  }
  
  content += `---\n\n`;
  content += `以上，请查阅。有问题群里说。\n`;
  
  return content;
}
