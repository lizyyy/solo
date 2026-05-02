import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { createUnifiedTimeline, updateTimelineEvent, getTimelineStats } from '../src/timeline/index.js';
import { ClipType } from '../src/types.js';

describe('timelineMerger.js - 时间轴合并', () => {
  it('应该创建基本时间轴', () => {
    const clips = [
      { id: 'clip_1', order: 1, name: '片段1', startTime: 0, endTime: 10000, duration: 10000, type: ClipType.SEGMENT },
      { id: 'clip_2', order: 2, name: '片段2', startTime: 10000, endTime: 25000, duration: 15000, type: ClipType.SEGMENT }
    ];
    
    const timeline = createUnifiedTimeline({ clips });
    
    assert.equal(timeline.clips.length, 2);
    assert.equal(timeline.totalDuration, 25000);
    assert.equal(timeline.allEvents.length, 2);
  });
  
  it('应该包含字幕和广告', () => {
    const clips = [
      { id: 'clip_1', order: 1, name: '片段1', startTime: 0, endTime: 10000, duration: 10000, type: ClipType.SEGMENT }
    ];
    
    const subtitles = [
      { id: 'sub_1', startTime: 1000, endTime: 3000, duration: 2000, text: '你好' }
    ];
    
    const ads = [
      { id: 'ad_1', order: 1, name: '广告1', startTime: 5000, endTime: 8000, duration: 3000, type: ClipType.AD }
    ];
    
    const timeline = createUnifiedTimeline({ clips, subtitles, ads });
    
    assert.equal(timeline.clips.length, 1);
    assert.equal(timeline.subtitles.length, 1);
    assert.equal(timeline.ads.length, 1);
    assert.equal(timeline.allEvents.length, 3);
  });
  
  it('应该检测章节', () => {
    const clips = [
      { id: 'clip_1', order: 1, name: '开场', startTime: 0, endTime: 5000, duration: 5000, type: ClipType.SEGMENT },
      { id: 'clip_2', order: 2, name: '第一章', startTime: 5000, endTime: 20000, duration: 15000, type: ClipType.CHAPTER },
      { id: 'clip_3', order: 3, name: '正文', startTime: 5000, endTime: 15000, duration: 10000, type: ClipType.SEGMENT },
      { id: 'clip_4', order: 4, name: '第二章', startTime: 20000, endTime: 35000, duration: 15000, type: ClipType.CHAPTER }
    ];
    
    const timeline = createUnifiedTimeline({ clips });
    
    assert.ok(timeline.chapters.length >= 1);
  });
  
  it('getTimelineStats 应该返回正确统计', () => {
    const clips = [
      { id: 'clip_1', order: 1, name: '片段1', startTime: 0, endTime: 10000, duration: 10000, type: ClipType.SEGMENT },
      { id: 'clip_2', order: 2, name: '广告', startTime: 10000, endTime: 13000, duration: 3000, type: ClipType.AD }
    ];
    
    const timeline = createUnifiedTimeline({ clips });
    const stats = getTimelineStats(timeline);
    
    assert.equal(stats.totalClips, 2);
    assert.equal(stats.totalSubtitles, 0);
    assert.equal(stats.totalAds, 0);
  });
  
  it('updateTimelineEvent 应该更新事件', () => {
    const clips = [
      { id: 'clip_1', order: 1, name: '旧名称', startTime: 0, endTime: 10000, duration: 10000, type: ClipType.SEGMENT }
    ];
    
    const timeline = createUnifiedTimeline({ clips });
    
    const updated = updateTimelineEvent(timeline, 'clip_1', {
      name: '新名称',
      startTime: 500
    });
    
    assert.equal(updated.name, '新名称');
    assert.equal(updated.startTime, 500);
    assert.equal(updated.corrected, true);
  });
});
