import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { parseSRT, parseClipsCSV, parseAdSchedule } from '../src/parsers/index.js';

describe('srtParser.js - SRT解析', () => {
  it('应该正确解析SRT格式', () => {
    const srtContent = `1
00:00:00,500 --> 00:00:03,200
大家好，欢迎收听本期节目

2
00:00:03,500 --> 00:00:07,000
今天我们要聊的话题是人工智能`;
    
    const subtitles = parseSRT(srtContent);
    
    assert.equal(subtitles.length, 2);
    assert.equal(subtitles[0].id, 1);
    assert.equal(subtitles[0].startTime, 500);
    assert.equal(subtitles[0].endTime, 3200);
    assert.equal(subtitles[0].text, '大家好，欢迎收听本期节目');
    assert.equal(subtitles[1].id, 2);
    assert.equal(subtitles[1].startTime, 3500);
  });
  
  it('应该处理空内容', () => {
    assert.deepEqual(parseSRT(''), []);
    assert.deepEqual(parseSRT('\n\n\n'), []);
  });
});

describe('csvParser.js - CSV片段解析', () => {
  it('应该正确解析CSV格式', () => {
    const csvContent = `序号,片段名,开始时间,结束时间,类型
1,开场问候,0:00:00.000,0:00:15.500,正文
2,第一章,0:00:14.000,0:02:30.000,章节`;
    
    const clips = parseClipsCSV(csvContent);
    
    assert.equal(clips.length, 2);
    assert.equal(clips[0].name, '开场问候');
    assert.equal(clips[0].startTime, 0);
    assert.equal(clips[0].endTime, 15500);
    assert.equal(clips[1].name, '第一章');
    assert.equal(clips[1].startTime, 14000);
  });
});

describe('adParser.js - 广告表解析', () => {
  it('应该正确解析文本格式的广告表', () => {
    const adContent = `1,"某品牌咖啡广告",0:02:28.000,0:03:00.000,32.0,中场
2,"赞助商鸣谢",0:06:30.000,0:06:40.000,10.0,结尾`;
    
    const ads = parseAdSchedule(adContent);
    
    assert.equal(ads.length, 2);
    assert.equal(ads[0].name, '某品牌咖啡广告');
    assert.equal(ads[0].position, 'mid');
    assert.equal(ads[1].name, '赞助商鸣谢');
    assert.equal(ads[1].position, 'post');
  });
  
  it('应该解析简单的时间格式', () => {
    const adContent = `02:28 某品牌咖啡广告`;
    const ads = parseAdSchedule(adContent);
    
    assert.equal(ads.length, 1);
    assert.equal(ads[0].startTime, 148000);
  });
});
