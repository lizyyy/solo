import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { timeToMs, msToTime, msToReadable, ClipType, IssueType, Severity } from '../src/types.js';

describe('types.js - 时间转换', () => {
  it('timeToMs 应该正确转换时间字符串', () => {
    assert.equal(timeToMs('00:00:01,500'), 1500);
    assert.equal(timeToMs('00:01:30.000'), 90000);
    assert.equal(timeToMs('1:30'), 90000);
    assert.equal(timeToMs('1000'), 1000000);
  });
  
  it('msToTime 应该正确格式化时间', () => {
    assert.equal(msToTime(1500), '00:00:01,500');
    assert.equal(msToTime(90000), '00:01:30,000');
    assert.equal(msToTime(3661000), '01:01:01,000');
  });
  
  it('msToReadable 应该生成可读的时间格式', () => {
    assert.equal(msToReadable(1500), '1.50s');
    assert.equal(msToReadable(90000), '1:30');
    assert.equal(msToReadable(61000), '1:01');
  });
});

describe('types.js - 常量定义', () => {
  it('ClipType 应该包含所有片段类型', () => {
    assert.equal(ClipType.SEGMENT, 'segment');
    assert.equal(ClipType.SILENCE, 'silence');
    assert.equal(ClipType.AD, 'ad');
    assert.equal(ClipType.CHAPTER, 'chapter');
  });
  
  it('IssueType 应该包含所有问题类型', () => {
    assert.equal(IssueType.OVERLAP, 'overlap');
    assert.equal(IssueType.GAP, 'gap');
    assert.equal(IssueType.SILENCE_NOT_CUT, 'silence_not_cut');
    assert.equal(IssueType.LOUDNESS_PEAK, 'loudness_peak');
    assert.equal(IssueType.AD_OVERLAPS_CONTENT, 'ad_overlaps_content');
    assert.equal(IssueType.SUBTITLE_DRIFT, 'subtitle_drift');
    assert.equal(IssueType.OUT_OF_ORDER, 'out_of_order');
  });
  
  it('Severity 应该包含所有严重程度', () => {
    assert.equal(Severity.CRITICAL, 'critical');
    assert.equal(Severity.HIGH, 'high');
    assert.equal(Severity.MEDIUM, 'medium');
    assert.equal(Severity.LOW, 'low');
  });
});
