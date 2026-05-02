import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  detectOverlaps,
  detectGaps,
  detectOutOfOrder,
  runAllAudioDetectors
} from '../src/detectors/index.js';
import { Severity, IssueType } from '../src/types.js';

describe('audioDetector.js - 重叠检测', () => {
  it('应该检测到片段重叠', () => {
    const events = [
      { id: '1', type: 'clip', name: '片段1', startTime: 0, endTime: 10000, duration: 10000 },
      { id: '2', type: 'clip', name: '片段2', startTime: 9000, endTime: 20000, duration: 11000 }
    ];
    
    const issues = detectOverlaps(events);
    
    assert.equal(issues.length, 1);
    assert.equal(issues[0].type, IssueType.OVERLAP);
    assert.equal(issues[0].severity, Severity.CRITICAL);
    assert.equal(issues[0].duration, 1000);
  });
  
  it('不应该检测到轻微重叠或无重叠', () => {
    const events = [
      { id: '1', type: 'clip', name: '片段1', startTime: 0, endTime: 10000, duration: 10000 },
      { id: '2', type: 'clip', name: '片段2', startTime: 10000, endTime: 20000, duration: 10000 }
    ];
    
    const issues = detectOverlaps(events);
    assert.equal(issues.length, 0);
  });
});

describe('audioDetector.js - 空洞检测', () => {
  it('应该检测到片段之间的空洞', () => {
    const events = [
      { id: '1', type: 'clip', name: '片段1', startTime: 0, endTime: 10000, duration: 10000 },
      { id: '2', type: 'clip', name: '片段2', startTime: 15000, endTime: 20000, duration: 5000 }
    ];
    
    const issues = detectGaps(events, 20000, { gapThreshold: 2000 });
    
    assert.equal(issues.length, 1);
    assert.equal(issues[0].type, IssueType.GAP);
    assert.equal(issues[0].duration, 5000);
  });
  
  it('应该检测到开头和结尾的空洞', () => {
    const events = [
      { id: '1', type: 'clip', name: '片段1', startTime: 2000, endTime: 8000, duration: 6000 }
    ];
    
    const issues = detectGaps(events, 10000, { gapThreshold: 1000 });
    
    assert.equal(issues.length, 2);
    const startGap = issues.find(i => i.startTime === 0);
    const endGap = issues.find(i => i.endTime === 10000);
    
    assert.ok(startGap);
    assert.ok(endGap);
  });
});

describe('audioDetector.js - 顺序检测', () => {
  it('应该检测到顺序错误', () => {
    const clips = [
      { id: '1', order: 2, name: '片段2', startTime: 0, endTime: 10000, duration: 10000 },
      { id: '2', order: 1, name: '片段1', startTime: 10000, endTime: 20000, duration: 10000 }
    ];
    
    const issues = detectOutOfOrder(clips);
    
    assert.equal(issues.length, 1);
    assert.equal(issues[0].type, IssueType.OUT_OF_ORDER);
    assert.equal(issues[0].severity, Severity.CRITICAL);
  });
});

describe('audioDetector.js - 综合检测', () => {
  it('runAllAudioDetectors 应该运行所有检测器', () => {
    const events = [
      { id: '1', type: 'clip', name: '片段1', startTime: 0, endTime: 10000, duration: 10000 },
      { id: '2', type: 'clip', name: '片段2', startTime: 8000, endTime: 20000, duration: 12000 }
    ];
    
    const timeline = {
      allEvents: events,
      clips: events,
      totalDuration: 20000
    };
    
    const result = runAllAudioDetectors(timeline, null);
    
    assert.ok(result.issues.length > 0);
    assert.ok(result.summary.total > 0);
  });
});
