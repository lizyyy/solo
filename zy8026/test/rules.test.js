const path = require('path');

describe('规则检查模块测试', () => {
  const sampleDir = path.join(__dirname, '../sample');
  const mediaDir = path.join(sampleDir, 'media');

  const shotList = [
    { id: 'S01', filename: 'scene_01.mp4', duration: '10.5', platform: 'douyin', lineNumber: 2 },
    { id: 'S02', filename: 'scene_02.mp4', duration: '8.3', platform: 'kuaishou', lineNumber: 3 },
    { id: 'S03', filename: 'scene_03.mp4', duration: '12.0', platform: 'douyin', lineNumber: 4 },
    { id: 'S05', filename: 'missing_file.mp4', duration: '5.0', platform: 'douyin', lineNumber: 6 },
    { id: 'S06', filename: 'scene_06.mp4', duration: '9.0', platform: 'kuaishou', lineNumber: 7 }
  ];

  const metadata = {
    streams: [
      { index: 0, codec_type: 'video', width: 1080, height: 1920, duration: '10.45', bit_rate: '5000000', tags: { filename: 'scene_01.mp4' } },
      { index: 1, codec_type: 'video', width: 1080, height: 1920, duration: '8.28', bit_rate: '4500000', tags: { filename: 'scene_02.mp4' } },
      { index: 2, codec_type: 'video', width: 960, height: 1280, duration: '12.10', bit_rate: '3000000', tags: { filename: 'scene_03.mp4' } },
      { index: 4, codec_type: 'video', width: 1080, height: 1920, duration: '9.00', bit_rate: '2000000', tags: { filename: 'scene_06.mp4' } }
    ],
    format: { filename: 'scene_01.mp4' }
  };

  const rules = {
    duration: { tolerance: 0.5 },
    subtitle: { safetyMargin: 0.5 },
    platforms: {
      douyin: { resolution: '1080x1920', minBitrate: 4000, maxBitrate: 8000 },
      kuaishou: { resolution: '1080x1920', minBitrate: 3500, maxBitrate: 7000 }
    }
  };

  test('检查文件命名 - 检测缺失文件', async () => {
    const { checkFileNaming } = await import('../src/rules/index.js');
    const issues = checkFileNaming(shotList, mediaDir);
    const missingFileIssue = issues.find(i => i.filename === 'missing_file.mp4');
    expect(missingFileIssue).toBeDefined();
    expect(missingFileIssue.severity).toBe('error');
  });

  test('检查文件命名 - 检测同名不同后缀', async () => {
    const { checkFileNaming } = await import('../src/rules/index.js');
    const issues = checkFileNaming(shotList, mediaDir);
    const duplicateIssue = issues.find(i => i.message && i.message.includes('同名不同后缀'));
    expect(duplicateIssue).toBeDefined();
    expect(duplicateIssue.severity).toBe('warning');
  });

  test('检查时长偏差', async () => {
    const { checkDuration } = await import('../src/rules/index.js');
    const issues = checkDuration(shotList, metadata, rules);
    expect(issues.length).toBeGreaterThan(0);
    
    const missingMetadataIssue = issues.find(i => i.message && i.message.includes('缺少媒体元数据'));
    expect(missingMetadataIssue).toBeDefined();
  });

  test('检查字幕越界', async () => {
    const { checkSubtitles } = await import('../src/rules/index.js');
    const subtitles = [
      { index: 1, start: 0, end: 2 },
      { index: 2, start: 20, end: 22 }
    ];
    const issues = checkSubtitles(subtitles, metadata, shotList, rules);
    const outOfBoundsIssue = issues.find(i => i.message && i.message.includes('超过视频时长'));
    expect(outOfBoundsIssue).toBeDefined();
  });

  test('检查画幅和码率', async () => {
    const { checkFormat } = await import('../src/rules/index.js');
    const issues = checkFormat(shotList, metadata, rules);
    
    const resolutionIssue = issues.find(i => i.message && i.message.includes('画幅不达标'));
    expect(resolutionIssue).toBeDefined();
    expect(resolutionIssue.filename).toBe('scene_03.mp4');
    
    const bitrateIssues = issues.filter(i => i.message && i.message.includes('码率不达标'));
    expect(bitrateIssues.length).toBeGreaterThan(0);
    
    const scene03BitrateIssue = bitrateIssues.find(i => i.filename === 'scene_03.mp4');
    expect(scene03BitrateIssue).toBeDefined();
    
    const scene06BitrateIssue = bitrateIssues.find(i => i.filename === 'scene_06.mp4');
    expect(scene06BitrateIssue).toBeDefined();
  });
});