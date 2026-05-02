import { ClipType, msToReadable, timeToMs } from '../types.js';

export function createUnifiedTimeline(options = {}) {
  const {
    clips = [],
    subtitles = [],
    ads = [],
    wavHeader = null
  } = options;
  
  const timeline = {
    totalDuration: wavHeader ? wavHeader.duration : calculateTotalDuration(clips, subtitles, ads),
    wavHeader,
    clips: [],
    subtitles: [],
    ads: [],
    chapters: [],
    allEvents: []
  };
  
  for (const clip of clips) {
    const event = createTimelineEvent(clip, 'clip');
    timeline.clips.push(event);
    timeline.allEvents.push(event);
  }
  
  for (const sub of subtitles) {
    const event = createTimelineEvent(sub, 'subtitle');
    timeline.subtitles.push(event);
    timeline.allEvents.push(event);
  }
  
  for (const ad of ads) {
    const event = createTimelineEvent(ad, 'ad');
    timeline.ads.push(event);
    timeline.allEvents.push(event);
  }
  
  timeline.chapters = detectChapters(timeline);
  
  timeline.allEvents.sort((a, b) => a.startTime - b.startTime);
  
  return timeline;
}

function createTimelineEvent(source, type) {
  return {
    id: source.id || `${type}_${Date.now()}_${Math.random()}`,
    type,
    name: source.name || source.text || `${type}`,
    startTime: source.startTime,
    endTime: source.endTime,
    duration: source.duration || (source.endTime - source.startTime),
    clipType: source.type || ClipType.SEGMENT,
    source,
    corrected: false,
    notes: ''
  };
}

function calculateTotalDuration(clips, subtitles, ads) {
  let maxEnd = 0;
  
  for (const item of [...clips, ...subtitles, ...ads]) {
    if (item.endTime > maxEnd) {
      maxEnd = item.endTime;
    }
  }
  
  return maxEnd || 3600000;
}

function detectChapters(timeline) {
  const chapters = [];
  
  const chapterClips = timeline.clips.filter(c => c.clipType === ClipType.CHAPTER);
  
  if (chapterClips.length > 0) {
    for (const chapter of chapterClips) {
      chapters.push({
        id: chapter.id,
        name: chapter.name,
        startTime: chapter.startTime,
        endTime: chapter.endTime,
        duration: chapter.duration,
        clips: [],
        subtitles: []
      });
    }
  } else {
    const orderedClips = [...timeline.clips].sort((a, b) => a.startTime - b.startTime);
    
    for (let i = 0; i < orderedClips.length; i++) {
      const clip = orderedClips[i];
      const nextClip = orderedClips[i + 1];
      
      const existingChapter = chapters.find(ch => 
        clip.startTime >= ch.startTime && clip.startTime < ch.endTime
      );
      
      if (!existingChapter) {
        const chapterStart = clip.startTime;
        const chapterEnd = nextClip ? nextClip.startTime : clip.endTime;
        
        chapters.push({
          id: `chapter_${i + 1}`,
          name: clip.name || `第 ${i + 1} 章`,
          startTime: chapterStart,
          endTime: chapterEnd,
          duration: chapterEnd - chapterStart,
          clips: [],
          subtitles: []
        });
      }
    }
  }
  
  for (const chapter of chapters) {
    chapter.clips = timeline.clips.filter(c => 
      !(c.clipType === ClipType.CHAPTER) &&
      c.startTime >= chapter.startTime && 
      c.startTime < chapter.endTime
    );
    
    chapter.subtitles = timeline.subtitles.filter(s =>
      s.startTime >= chapter.startTime && 
      s.startTime < chapter.endTime
    );
  }
  
  return chapters;
}

export function updateTimelineEvent(timeline, eventId, updates) {
  const event = timeline.allEvents.find(e => e.id === eventId);
  
  if (!event) {
    throw new Error(`Event not found: ${eventId}`);
  }
  
  Object.assign(event, updates, { corrected: true });
  
  if (event.type === 'clip') {
    const clipIndex = timeline.clips.findIndex(c => c.id === eventId);
    if (clipIndex >= 0) {
      Object.assign(timeline.clips[clipIndex], updates, { corrected: true });
    }
  } else if (event.type === 'subtitle') {
    const subIndex = timeline.subtitles.findIndex(s => s.id === eventId);
    if (subIndex >= 0) {
      Object.assign(timeline.subtitles[subIndex], updates, { corrected: true });
    }
  } else if (event.type === 'ad') {
    const adIndex = timeline.ads.findIndex(a => a.id === eventId);
    if (adIndex >= 0) {
      Object.assign(timeline.ads[adIndex], updates, { corrected: true });
    }
  }
  
  timeline.allEvents.sort((a, b) => a.startTime - b.startTime);
  timeline.chapters = detectChapters(timeline);
  
  return event;
}

export function getTimelineStats(timeline) {
  const stats = {
    totalDuration: timeline.totalDuration,
    totalClips: timeline.clips.length,
    totalSubtitles: timeline.subtitles.length,
    totalAds: timeline.ads.length,
    totalChapters: timeline.chapters.length,
    audioDuration: timeline.wavHeader ? timeline.wavHeader.duration : null,
    correctedEvents: timeline.allEvents.filter(e => e.corrected).length,
    clipTypes: {}
  };
  
  for (const clip of timeline.clips) {
    const type = clip.clipType;
    if (!stats.clipTypes[type]) {
      stats.clipTypes[type] = 0;
    }
    stats.clipTypes[type]++;
  }
  
  return stats;
}

export function printTimeline(timeline) {
  const lines = [];
  const stats = getTimelineStats(timeline);
  
  lines.push('='.repeat(80));
  lines.push('统一时间轴');
  lines.push('='.repeat(80));
  lines.push(`总时长: ${msToReadable(stats.totalDuration)}`);
  lines.push(`片段数: ${stats.totalClips} | 字幕数: ${stats.totalSubtitles} | 广告数: ${stats.totalAds} | 章节数: ${stats.totalChapters}`);
  lines.push('');
  
  lines.push('--- 章节列表 ---');
  for (const chapter of timeline.chapters) {
    lines.push(`[${msToReadable(chapter.startTime)} - ${msToReadable(chapter.endTime)}] ${chapter.name}`);
    lines.push(`    包含 ${chapter.clips.length} 个片段, ${chapter.subtitles.length} 条字幕`);
  }
  
  lines.push('');
  lines.push('--- 时间轴事件 ---');
  
  for (const event of timeline.allEvents) {
    const typeIcon = event.type === 'clip' ? '📎' : 
                     event.type === 'subtitle' ? '💬' : 
                     event.type === 'ad' ? '📢' : '⏰';
    const correctedMark = event.corrected ? ' ✏️' : '';
    
    lines.push(`${typeIcon} [${msToReadable(event.startTime)} - ${msToReadable(event.endTime)}] ${event.name}${correctedMark}`);
  }
  
  return lines.join('\n');
}
