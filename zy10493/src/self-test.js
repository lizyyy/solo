const fs = require('fs');
const path = require('path');
const { logger, formatDuration } = require('./utils');
const { JsonlReader } = require('./reader');
const { SessionStitcher } = require('./stitcher');
const { OutputWriter } = require('./writer');

class TestDataGenerator {
  constructor(outputDir) {
    this.outputDir = outputDir;
    this.testFiles = [];
  }

  generate() {
    logger.info('生成测试数据...');

    const baseTime = Date.now() - 86400000;

    const shard1Events = [];
    const shard2Events = [];

    for (let u = 1; u <= 3; u++) {
      const userId = `user_${u}`;
      
      for (let s = 1; s <= 2; s++) {
        const sessionId = `session_${u}_${s}`;
        const sessionStart = baseTime + (u - 1) * 3600000 + (s - 1) * 1800000;

        for (let e = 1; e <= 5; e++) {
          const event = {
            user_id: userId,
            session_id: sessionId,
            timestamp: sessionStart + e * 10000,
            event_type: e % 2 === 0 ? 'click' : 'view',
            page: `/page/${e}`,
            value: Math.floor(Math.random() * 100)
          };

          if (e % 2 === 1) {
            shard1Events.push(event);
          } else {
            shard2Events.push(event);
          }
        }
      }
    }

    for (let i = 0; i < 3; i++) {
      shard1Events.push({ invalid: 'data' });
    }
    shard2Events.push('');

    const shard1Path = path.join(this.outputDir, 'shard1.jsonl');
    const shard2Path = path.join(this.outputDir, 'shard2.jsonl');

    const absShard1 = this.writeJsonl(shard1Path, shard1Events);
    const absShard2 = this.writeJsonl(shard2Path, shard2Events);

    this.testFiles = [absShard1, absShard2];

    logger.success(`测试数据已生成: ${this.testFiles.length} 个文件`);
    return this.testFiles;
  }

  writeJsonl(filePath, events) {
    const absolutePath = path.resolve(filePath);
    const dir = path.dirname(absolutePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const stream = fs.createWriteStream(absolutePath, { encoding: 'utf8' });
    for (const event of events) {
      stream.write(JSON.stringify(event) + '\n');
    }
    stream.end();
    return absolutePath;
  }
}

async function runSelfTest(outputDir) {
  const startTime = Date.now();

  logger.info('='.repeat(60));
  logger.info('🧪 开始自检流程');
  logger.info('='.repeat(60));

  const testDataDir = path.join(outputDir, 'test-data');
  const resultDir = path.join(outputDir, 'results');

  const generator = new TestDataGenerator(testDataDir);
  const testFiles = generator.generate();

  const config = {
    files: testFiles,
    outputDir: resultDir,
    userKey: 'user_id',
    sessionKey: 'session_id',
    timeKey: 'timestamp',
    timeFormat: 'ms',
    gapThreshold: 30 * 60 * 1000,
    outputFormats: ['ndjson', 'csv', 'report'],
    encoding: 'utf8',
    verbose: true,
    dryRun: false
  };

  logger.info('读取和解析文件...');
  const reader = new JsonlReader(config);
  const events = await reader.readAllFiles();
  logger.success(`读取完成: ${events.length} 个有效事件`);

  logger.info('会话缝合处理...');
  const stitcher = new SessionStitcher(config);
  const sessions = stitcher.processEvents(events);
  logger.success(`缝合完成: ${sessions.length} 个会话`);

  const readerStats = reader.getStats();
  const stitcherStats = stitcher.getStats();
  const invalidEvents = reader.getInvalidEvents();
  const gapDetails = stitcher.getGapDetails();

  logger.info('输出结果文件...');
  const writer = new OutputWriter(config, readerStats, stitcherStats, invalidEvents, gapDetails);
  await writer.writeAll(sessions);

  const tests = [
    {
      name: '文件读取',
      passed: readerStats.totalFiles === 2,
      expected: 2,
      actual: readerStats.totalFiles
    },
    {
      name: '有效事件数',
      passed: readerStats.validEvents > 0,
      expected: '> 0',
      actual: readerStats.validEvents
    },
    {
      name: '无效事件检测',
      passed: readerStats.invalidEvents > 0,
      expected: '> 0',
      actual: readerStats.invalidEvents
    },
    {
      name: '用户数量',
      passed: stitcherStats.totalUsers === 3,
      expected: 3,
      actual: stitcherStats.totalUsers
    },
    {
      name: '会话数量',
      passed: sessions.length > 0,
      expected: '> 0',
      actual: sessions.length
    },
    {
      name: '输出文件生成',
      passed: fs.existsSync(path.join(config.outputDir, 'stitched-sessions.ndjson')),
      expected: '文件存在',
      actual: fs.existsSync(path.join(config.outputDir, 'stitched-sessions.ndjson')) ? '文件存在' : '文件不存在'
    }
  ];

  console.log('\n' + '='.repeat(60));
  console.log('📋 测试结果');
  console.log('='.repeat(60));

  let passedCount = 0;
  for (const test of tests) {
    const status = test.passed ? '✅' : '❌';
    console.log(`${status} ${test.name}`);
    if (!test.passed) {
      console.log(`   期望: ${test.expected}, 实际: ${test.actual}`);
    } else {
      passedCount++;
    }
  }

  console.log('\n' + '-'.repeat(60));
  console.log(`总计: ${passedCount}/${tests.length} 测试通过`);
  console.log(`总耗时: ${formatDuration(Date.now() - startTime)}`);
  console.log(`测试文件: ${testDataDir}`);
  console.log(`结果文件: ${resultDir}`);
  console.log('='.repeat(60) + '\n');

  if (passedCount === tests.length) {
    logger.success('🎉 所有自检通过！工具运行正常。');
    return true;
  } else {
    logger.warn('⚠  部分测试未通过，请检查配置和数据。');
    return false;
  }
}

module.exports = { run: runSelfTest, TestDataGenerator };