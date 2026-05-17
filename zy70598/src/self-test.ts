import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { WebSocketLogParser } from './parser';
import { ReplayEngine } from './replay-engine';
import { ReportGenerator } from './report-generator';

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
}

export async function runSelfTest(): Promise<void> {
  const results: TestResult[] = [];

  console.log('\n' + '='.repeat(60));
  console.log('🧪 WebSocket 会话回放工具 - 自检程序');
  console.log('='.repeat(60) + '\n');

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ws-replay-test-'));

  try {
    results.push(await testStandardFormatParsing(tempDir));
    results.push(await testJsonFormatParsing(tempDir));
    results.push(await testBadRowHandling(tempDir));
    results.push(await testTimeSorting(tempDir));
    results.push(await testStateReconstruction(tempDir));
    results.push(await testReportGeneration(tempDir));
    results.push(await testConnectionFiltering(tempDir));
    results.push(await testEmptyFileHandling(tempDir));
    results.push(await testTimestampFormats(tempDir));

    printSummary(results);

  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

async function testStandardFormatParsing(tempDir: string): Promise<TestResult> {
  const testFile = path.join(tempDir, 'standard.log');
  const content = `
2024-01-15T10:30:00.000Z [conn-001] IN text {"type":"message","data":"hello"}
2024-01-15T10:30:01.000Z [conn-001] OUT text {"type":"message","data":"world"}
2024-01-15T10:30:02.000Z [conn-002] IN ping {}
  `.trim();

  fs.writeFileSync(testFile, content, 'utf-8');

  const parser = new WebSocketLogParser();
  const frames = await parser.parseFile(testFile);
  const validFrames = frames.filter(f => f.isValid);

  const passed = validFrames.length === 3 &&
    frames[0].direction === 'in' &&
    frames[1].direction === 'out' &&
    frames[0].connectionId === 'conn-001';

  return {
    name: '标准格式解析',
    passed,
    message: passed ? `成功解析 ${validFrames.length} 帧` : `期望 3 帧，实际 ${validFrames.length} 帧`,
  };
}

async function testJsonFormatParsing(tempDir: string): Promise<TestResult> {
  const testFile = path.join(tempDir, 'json.log');
  const content = JSON.stringify({
    timestamp: 1705314600000,
    connectionId: 'ws-123',
    direction: 'receive',
    opcode: 'text',
    payload: { event: 'update', data: 42 },
  }) + '\n' + JSON.stringify({
    timestamp: '2024-01-15T10:30:00.000Z',
    session: 'ws-456',
    dir: 'send',
    data: 'test message',
  });

  fs.writeFileSync(testFile, content, 'utf-8');

  const parser = new WebSocketLogParser();
  const frames = await parser.parseFile(testFile);
  const validFrames = frames.filter(f => f.isValid);

  const passed = validFrames.length === 2 &&
    frames[0].connectionId === 'ws-123' &&
    frames[1].connectionId === 'ws-456';

  return {
    name: 'JSON 格式解析',
    passed,
    message: passed ? `成功解析 ${validFrames.length} 帧` : `期望 2 帧，实际 ${validFrames.length} 帧`,
  };
}

async function testBadRowHandling(tempDir: string): Promise<TestResult> {
  const testFile = path.join(tempDir, 'bad-rows.log');
  const content = `
2024-01-15T10:30:00.000Z [conn-001] IN text valid frame

这是一行无法解析的垃圾数据
--- 分割线 ---
2024-01-15T10:30:01.000Z [conn-001] OUT text another valid frame
{ invalid json here }
  `.trim();

  fs.writeFileSync(testFile, content, 'utf-8');

  const parser = new WebSocketLogParser();
  const frames = await parser.parseFile(testFile);

  const invalidFrames = frames.filter(f => !f.isValid);
  const validFrames = frames.filter(f => f.isValid);

  const allHaveLineNumbers = frames.every(f => f.lineNumber > 0);
  const allHaveRawContent = frames.every(f => f.raw.length > 0);
  const invalidHaveParseError = invalidFrames.every(f => f.parseError);

  const passed = validFrames.length === 2 &&
    invalidFrames.length >= 1 &&
    allHaveLineNumbers &&
    allHaveRawContent &&
    invalidHaveParseError;

  return {
    name: '坏行保留机制',
    passed,
    message: passed
      ? `有效帧 ${validFrames.length}, 无效帧 ${invalidFrames.length}, 均保留行号和原始内容`
      : `坏行处理不正确 - 有效: ${validFrames.length}, 无效: ${invalidFrames.length}`,
  };
}

async function testTimeSorting(tempDir: string): Promise<TestResult> {
  const testFile = path.join(tempDir, 'unsorted.log');
  const content = `
2024-01-15T10:30:05.000Z [conn-001] IN text frame5
2024-01-15T10:30:01.000Z [conn-001] IN text frame1
2024-01-15T10:30:03.000Z [conn-001] IN text frame3
2024-01-15T10:30:02.000Z [conn-001] IN text frame2
2024-01-15T10:30:04.000Z [conn-001] IN text frame4
  `.trim();

  fs.writeFileSync(testFile, content, 'utf-8');

  const parser = new WebSocketLogParser();
  const frames = await parser.parseFile(testFile);
  const sorted = parser.sortFramesByTime(frames);

  let isSorted = true;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].timestamp < sorted[i - 1].timestamp) {
      isSorted = false;
      break;
    }
  }

  const passed = isSorted && sorted.length === 5;

  return {
    name: '时间排序功能',
    passed,
    message: passed ? '乱序输入帧已正确按时间排序' : '帧排序结果不正确',
  };
}

async function testStateReconstruction(tempDir: string): Promise<TestResult> {
  const testFile = path.join(tempDir, 'state.log');
  const content = `
2024-01-15T10:30:00.000Z [conn-001] IN text {"type":"state","user":"alice","score":100}
2024-01-15T10:30:01.000Z [conn-001] OUT text {"type":"update","score":150}
2024-01-15T10:30:02.000Z [conn-001] IN text {"type":"state","level":5}
  `.trim();

  fs.writeFileSync(testFile, content, 'utf-8');

  const parser = new WebSocketLogParser();
  const frames = await parser.parseFile(testFile);

  const engine = new ReplayEngine();
  const result = engine.replay(frames, testFile);

  const stateAtFrame1 = engine.getStateAtFrame(0);
  const stateAtFrame3 = engine.getStateAtFrame(2);

  const passed = result.frames.length === 3 &&
    result.stateSnapshots.length === 3 &&
    result.stateDiffs.length > 0;

  return {
    name: '状态重建引擎',
    passed,
    message: passed
      ? `成功重建状态，快照数 ${result.stateSnapshots.length}, 状态变更数 ${result.stateDiffs.length}`
      : '状态重建失败',
  };
}

async function testReportGeneration(tempDir: string): Promise<TestResult> {
  const testFile = path.join(tempDir, 'report.log');
  const content = `
2024-01-15T10:30:00.000Z [conn-001] IN text {"event":"test"}
2024-01-15T10:30:01.000Z [conn-001] OUT text {"response":"ok"}
  `.trim();

  fs.writeFileSync(testFile, content, 'utf-8');

  const parser = new WebSocketLogParser();
  const frames = await parser.parseFile(testFile);

  const engine = new ReplayEngine();
  const result = engine.replay(frames, testFile);

  const generator = new ReportGenerator();
  const reports = generator.generate(result);

  const hasTerminal = reports.terminal.length > 0;
  const hasJson = reports.machineReadable.length > 0;
  const hasHtml = reports.html.includes('<!DOCTYPE html>');

  const passed = hasTerminal && hasJson && hasHtml;

  return {
    name: '报告生成器',
    passed,
    message: passed
      ? '终端摘要、JSON 报告、HTML 报告均已生成'
      : `报告缺失 - 终端: ${hasTerminal}, JSON: ${hasJson}, HTML: ${hasHtml}`,
  };
}

async function testConnectionFiltering(tempDir: string): Promise<TestResult> {
  const testFile = path.join(tempDir, 'multi-conn.log');
  const content = `
2024-01-15T10:30:00.000Z [conn-A] IN text msg1
2024-01-15T10:30:01.000Z [conn-B] IN text msg2
2024-01-15T10:30:02.000Z [conn-A] OUT text msg3
2024-01-15T10:30:03.000Z [conn-C] IN text msg4
  `.trim();

  fs.writeFileSync(testFile, content, 'utf-8');

  const parser = new WebSocketLogParser();
  const frames = await parser.parseFile(testFile);

  const connectionIds = parser.getConnectionIds(frames);
  const connAFrames = parser.filterByConnection(frames, 'conn-A');

  const passed = connectionIds.length === 3 &&
    connectionIds.includes('conn-A') &&
    connAFrames.length === 2;

  return {
    name: '连接 ID 过滤',
    passed,
    message: passed
      ? `发现 ${connectionIds.length} 个连接，conn-A 过滤后得 ${connAFrames.length} 帧`
      : `连接识别或过滤失败 - 发现: ${connectionIds.length}, conn-A帧: ${connAFrames.length}`,
  };
}

async function testEmptyFileHandling(tempDir: string): Promise<TestResult> {
  const testFile = path.join(tempDir, 'empty.log');
  fs.writeFileSync(testFile, '', 'utf-8');

  const parser = new WebSocketLogParser();
  const frames = await parser.parseFile(testFile);

  const engine = new ReplayEngine();
  const result = engine.replay(frames, testFile);

  const generator = new ReportGenerator();
  const reports = generator.generate(result);

  const passed = frames.length === 0 &&
    result.frames.length === 0 &&
    reports.terminal.length > 0;

  return {
    name: '空文件处理',
    passed,
    message: passed ? '空输入正常处理，无崩溃' : '空文件处理失败',
  };
}

async function testTimestampFormats(tempDir: string): Promise<TestResult> {
  const testFile = path.join(tempDir, 'timestamps.log');
  const content = `
1705314600000 [ms] IN text epoch ms
1705314601 [s] OUT text epoch s
2024-01-15 10:30:02.000 [iso] IN text iso format
  `.trim();

  fs.writeFileSync(testFile, content, 'utf-8');

  const parser = new WebSocketLogParser();
  const frames = await parser.parseFile(testFile);
  const validFrames = frames.filter(f => f.isValid && f.timestamp > 0);

  const passed = validFrames.length >= 2;

  return {
    name: '多时间戳格式支持',
    passed,
    message: passed
      ? `成功解析 ${validFrames.length} 种不同时间格式`
      : `部分时间戳格式解析失败，成功 ${validFrames.length}/${frames.length}`,
  };
}

function printSummary(results: TestResult[]): void {
  console.log('\n' + '='.repeat(60));
  console.log('📋 自检结果汇总');
  console.log('='.repeat(60) + '\n');

  const passed = results.filter(r => r.passed).length;
  const total = results.length;

  results.forEach((result, index) => {
    const status = result.passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${String(index + 1).padStart(2)}. ${status} - ${result.name}`);
    console.log(`     ${result.message}\n`);
  });

  console.log('-'.repeat(60));
  const color = passed === total ? '\x1b[32m' : passed > total * 0.7 ? '\x1b[33m' : '\x1b[31m';
  console.log(`${color}总计: ${passed}/${total} 测试通过\x1b[0m`);
  console.log('-'.repeat(60) + '\n');

  if (passed === total) {
    console.log('🎉 所有测试通过！工具已准备就绪。\n');
  } else {
    console.log('⚠️ 部分测试未通过，请检查代码。\n');
    process.exit(1);
  }
}

if (require.main === module) {
  runSelfTest().catch(err => {
    console.error('自检执行出错:', err);
    process.exit(1);
  });
}
