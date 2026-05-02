const path = require('path');

describe('解析模块测试', () => {
  const sampleDir = path.join(__dirname, '../sample');

  test('解析 CSV 镜头清单', async () => {
    const { parseShotList } = await import('../src/parsers/index.js');
    const csvPath = path.join(sampleDir, 'shot_list.csv');
    const result = parseShotList(csvPath);
    expect(result).toBeDefined();
    expect(result.length).toBe(6);
    expect(result[0].id).toBe('S01');
    expect(result[0].filename).toBe('scene_01.mp4');
    expect(result[0].duration).toBe('10.5');
  });

  test('解析 JSON 元数据', async () => {
    const { parseMetadata } = await import('../src/parsers/index.js');
    const jsonPath = path.join(sampleDir, 'metadata.json');
    const result = parseMetadata(jsonPath);
    expect(result).toBeDefined();
    expect(result.streams).toBeDefined();
    expect(result.streams.length).toBe(5);
  });

  test('解析 SRT 字幕', async () => {
    const { parseSRT } = await import('../src/parsers/index.js');
    const srtPath = path.join(sampleDir, 'subtitle.srt');
    const result = parseSRT(srtPath);
    expect(result).toBeDefined();
    expect(result.length).toBe(6);
    expect(result[0].start).toBe(0);
    expect(result[0].end).toBe(2);
  });

  test('解析 YAML 规则', async () => {
    const { parseRules } = await import('../src/parsers/index.js');
    const yamlPath = path.join(sampleDir, 'rules.yaml');
    const result = parseRules(yamlPath);
    expect(result).toBeDefined();
    expect(result.duration.tolerance).toBe(0.5);
    expect(result.platforms.douyin.resolution).toBe('1080x1920');
  });

  test('文件不存在时抛出错误', async () => {
    const { parseShotList, parseMetadata, parseSRT, parseRules } = await import('../src/parsers/index.js');
    expect(() => parseShotList('/nonexistent/file.csv')).toThrow();
    expect(() => parseMetadata('/nonexistent/file.json')).toThrow();
    expect(() => parseSRT('/nonexistent/file.srt')).toThrow();
    expect(() => parseRules('/nonexistent/file.yaml')).toThrow();
  });
});