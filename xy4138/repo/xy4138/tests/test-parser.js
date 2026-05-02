#!/usr/bin/env node

const path = require('path');
const fs = require('fs');

const JSONLParser = require('../src/server/parsers/jsonl-parser');
const CSVParser = require('../src/server/parsers/csv-parser');
const { YAMLParser, CheckpointType } = require('../src/server/parsers/yaml-parser');
const { DataParser } = require('../src/server/parsers');

const TEST_DATA_DIR = path.join(__dirname, '..', 'data');

async function testJSONLParser() {
  console.log('\n' + '='.repeat(60));
  console.log('测试 JSONL 解析器');
  console.log('='.repeat(60));

  const parser = new JSONLParser({ strictMode: false });
  const testFile = path.join(TEST_DATA_DIR, 'sample-telemetry.jsonl');

  if (!fs.existsSync(testFile)) {
    console.log('❌ 测试文件不存在: sample-telemetry.jsonl');
    return false;
  }

  try {
    const result = await parser.parseFile(testFile);
    const records = result.records;
    
    console.log(`✅ 解析成功: ${records.length} 条记录`);
    
    if (records.length === 0) {
      console.log('❌ 记录数为 0');
      return false;
    }

    if (result.errors.length > 0) {
      console.log(`⚠️  解析错误: ${result.errors.length} 个`);
    }
    if (result.warnings.length > 0) {
      console.log(`⚠️  解析警告: ${result.warnings.length} 个`);
    }

    const firstRecord = records[0];
    const requiredFields = ['timestamp', 'sequence', 'state', 'position'];
    const missingFields = requiredFields.filter(f => !(f in firstRecord));
    
    if (missingFields.length > 0) {
      console.log(`❌ 缺少字段: ${missingFields.join(', ')}`);
      return false;
    }
    console.log(`✅ 必需字段完整: ${requiredFields.join(', ')}`);

    const timeRange = parser.getTimeRange(records);
    console.log(`✅ 时间范围: ${new Date(timeRange.start).toISOString()} - ${new Date(timeRange.end).toISOString()}`);
    console.log(`✅ 总时长: ${(timeRange.end - timeRange.start) / 1000} 秒`);

    return true;
  } catch (error) {
    console.log(`❌ 解析失败: ${error.message}`);
    console.log(error.stack);
    return false;
  }
}

async function testCSVParser() {
  console.log('\n' + '='.repeat(60));
  console.log('测试 CSV 解析器');
  console.log('='.repeat(60));

  const parser = new CSVParser({ strictMode: false });
  const testFile = path.join(TEST_DATA_DIR, 'sample-commands.csv');

  if (!fs.existsSync(testFile)) {
    console.log('❌ 测试文件不存在: sample-commands.csv');
    return false;
  }

  try {
    const result = await parser.parseFile(testFile);
    const records = result.records;
    
    console.log(`✅ 解析成功: ${records.length} 条记录`);

    if (records.length === 0) {
      console.log('❌ 记录数为 0');
      return false;
    }

    if (result.errors.length > 0) {
      console.log(`⚠️  解析错误: ${result.errors.length} 个`);
    }

    const commandTypes = [...new Set(records.map(r => r.command_type).filter(t => t))];
    if (commandTypes.length > 0) {
      console.log(`✅ 包含命令类型: ${commandTypes.join(', ')}`);
    }

    const emergencyCount = records.filter(r => 
      r.command_type === 'EMERGENCY_STOP' || r.command_type === 'STOP'
    ).length;
    if (emergencyCount > 0) {
      console.log(`✅ 包含急停命令: ${emergencyCount} 条`);
    }

    return true;
  } catch (error) {
    console.log(`❌ 解析失败: ${error.message}`);
    console.log(error.stack);
    return false;
  }
}

async function testYAMLParser() {
  console.log('\n' + '='.repeat(60));
  console.log('测试 YAML 解析器');
  console.log('='.repeat(60));

  const parser = new YAMLParser({ strictMode: false });
  const testFile = path.join(TEST_DATA_DIR, 'sample-track.yaml');

  if (!fs.existsSync(testFile)) {
    console.log('❌ 测试文件不存在: sample-track.yaml');
    return false;
  }

  try {
    const result = await parser.parseFile(testFile);
    const data = result.data;
    
    console.log(`✅ 解析成功`);

    if (result.errors.length > 0) {
      console.log(`⚠️  解析错误: ${result.errors.length} 个`);
    }
    if (result.warnings.length > 0) {
      console.log(`⚠️  解析警告: ${result.warnings.length} 个`);
    }

    if (!data) {
      console.log('❌ 数据为空');
      return false;
    }

    if (data.name || data.track_name) {
      console.log(`✅ 赛道名称: ${data.name || data.track_name}`);
    } else {
      console.log('⚠️  未定义赛道名称');
    }

    if (data.checkpoints && data.checkpoints.length > 0) {
      console.log(`✅ 检查点数量: ${data.checkpoints.length}`);
      data.checkpoints.forEach(cp => {
        console.log(`   - ${cp.id}: ${cp.name || 'unnamed'} (${cp.type})`);
      });
    } else {
      console.log('⚠️  未定义检查点');
    }

    if (data.obstacles && data.obstacles.length > 0) {
      console.log(`✅ 障碍物数量: ${data.obstacles.length}`);
    }

    if (data.track_bounds) {
      console.log(`✅ 赛道边界: ${data.track_bounds.width}m x ${data.track_bounds.height}m`);
    }

    return true;
  } catch (error) {
    console.log(`❌ 解析失败: ${error.message}`);
    console.log(error.stack);
    return false;
  }
}

async function testDataParser() {
  console.log('\n' + '='.repeat(60));
  console.log('测试 DataParser (数据合并与分析)');
  console.log('='.repeat(60));

  const dataParser = new DataParser();
  const jsonlParser = new JSONLParser({ strictMode: false });
  const csvParser = new CSVParser({ strictMode: false });

  try {
    const telemetryFile = path.join(TEST_DATA_DIR, 'sample-telemetry.jsonl');
    const commandsFile = path.join(TEST_DATA_DIR, 'sample-commands.csv');

    const telemetryResult = await jsonlParser.parseFile(telemetryFile);
    const telemetryRecords = telemetryResult.records;
    
    const commandsResult = await csvParser.parseFile(commandsFile);
    const commandRecords = commandsResult.records;

    console.log(`✅ 遥测记录: ${telemetryRecords.length} 条`);
    console.log(`✅ 控制指令: ${commandRecords.length} 条`);

    const mergedFrames = dataParser.mergeTelemetryAndCommands(telemetryRecords, commandRecords);
    console.log(`✅ 数据合并成功: ${mergedFrames.length} 帧`);

    const latency = dataParser.calculateLatency(commandRecords, telemetryRecords);
    console.log('\n' + '延迟统计:');
    console.log(`  最小延迟: ${latency.summary.min_command_ack}ms`);
    console.log(`  最大延迟: ${latency.summary.max_command_ack}ms`);
    console.log(`  平均延迟: ${latency.summary.avg_command_ack.toFixed(2)}ms`);
    console.log(`  总延迟次数: ${latency.command_ack.length}`);
    if (latency.summary.warnings.length > 0) {
      console.log(`  ⚠️  延迟警告: ${latency.summary.warnings.length} 个`);
    }

    const stateChanges = dataParser.detectStateChanges(telemetryRecords);
    console.log('\n' + '状态变化检测:');
    console.log(`  总状态切换次数: ${stateChanges.length}`);
    stateChanges.forEach(change => {
      console.log(`  - [${new Date(change.timestamp).toISOString()}] ${change.from_state} -> ${change.to_state}`);
    });

    const emergencyStops = dataParser.detectEmergencyStops(telemetryRecords);
    console.log('\n' + '急停事件检测:');
    console.log(`  急停次数: ${emergencyStops.length}`);
    if (emergencyStops.length > 0) {
      emergencyStops.forEach(stop => {
        console.log(`  - [${new Date(stop.timestamp).toISOString()}] sequence: ${stop.sequence}`);
      });
    }

    return true;
  } catch (error) {
    console.log(`❌ 测试失败: ${error.message}`);
    console.log(error.stack);
    return false;
  }
}

function testReplayScheduler() {
  console.log('\n' + '='.repeat(60));
  console.log('测试 ReplayScheduler (回放调度器)');
  console.log('='.repeat(60));

  const { ReplayScheduler } = require('../src/server/scheduler/replay-scheduler');
  
  const scheduler = new ReplayScheduler();
  
  const testFrames = [];
  const baseTime = Date.now();
  for (let i = 0; i < 10; i++) {
    testFrames.push({
      timestamp: baseTime + i * 500,
      sequence: i + 1,
      state: i % 3 === 0 ? 'IDLE' : 'RUNNING',
      position: { x: i, y: i * 0.5, theta: i * 0.1 },
      velocity: { linear: i * 0.2, angular: i * 0.05 }
    });
  }

  const loadResult = scheduler.loadFrames(testFrames);
  console.log(`✅ 加载测试帧: ${loadResult.frameCount} 帧`);
  console.log(`✅ 时间范围: ${loadResult.timeRange.duration / 1000} 秒`);

  const stats = scheduler.getStats();
  console.log(`✅ 初始状态: currentState=${stats.currentState}, currentIndex=${stats.currentFrameIndex}`);

  scheduler.setSpeed(2.0);
  console.log(`✅ 设置速度 2x`);

  scheduler.seek(baseTime + 2000);
  const afterSeekStats = scheduler.getStats();
  console.log(`✅ seek 到 2000ms 后: currentIndex=${afterSeekStats.currentFrameIndex}`);

  const forwardFrame = scheduler.stepForward();
  console.log(`✅ 逐帧前进: seq=${forwardFrame ? forwardFrame.sequence : 'none'}`);

  return true;
}

async function testSessionStore() {
  console.log('\n' + '='.repeat(60));
  console.log('测试 SessionStore (会话存储)');
  console.log('='.repeat(60));

  const { SessionStore } = require('../src/server/storage/session-store');

  const store = new SessionStore(path.join(__dirname, '..', 'sessions'));

  const testSession = {
    id: 'test-session-' + Date.now(),
    name: '测试会话',
    description: '自动测试创建的会话',
    createdAt: new Date().toISOString(),
    tags: [
      { id: 'tag-1', timestamp: Date.now(), label: '测试标签', color: '#ff0000' }
    ],
    currentPosition: 5000,
    isPlaying: false,
    speed: 1.0
  };

  try {
    const saveResult = await store.saveSession(testSession);
    const sessionId = saveResult.id;
    console.log(`✅ 会话保存成功: ${sessionId}`);

    const sessions = await store.listSessions();
    console.log(`✅ 会话列表: ${sessions.length} 个会话`);

    const loaded = await store.loadSession(sessionId);
    console.log(`✅ 会话加载成功: ${loaded.name}`);

    await store.deleteSession(sessionId);
    console.log(`✅ 会话删除成功`);

    try {
      await store.loadSession(sessionId);
      console.log(`❌ 删除后仍能加载`);
      return false;
    } catch (e) {
      console.log(`✅ 验证删除成功 (预期错误: ${e.message})`);
    }

    return true;
  } catch (error) {
    console.log(`❌ 测试失败: ${error.message}`);
    console.log(error.stack);
    return false;
  }
}

async function testReportExporter() {
  console.log('\n' + '='.repeat(60));
  console.log('测试 ReportExporter (报告导出)');
  console.log('='.repeat(60));

  const { ReportExporter } = require('../src/server/exporters/report-exporter');
  const exporter = new ReportExporter();

  const testData = {
    session: {
      id: 'test-session',
      name: '测试会话',
      mode: 'replay',
      createdAt: new Date(Date.now() - 3600000).toISOString()
    },
    telemetryData: [
      { timestamp: Date.now() - 3000000, sequence: 1, state: 'IDLE', position: { x: 0, y: 0, theta: 0 }, velocity: { linear: 0, angular: 0 }, battery: 12.5, emergency_stop: false },
      { timestamp: Date.now() - 2000000, sequence: 2, state: 'RUNNING', position: { x: 1, y: 0.5, theta: 0.1 }, velocity: { linear: 1.0, angular: 0.1 }, battery: 12.4, emergency_stop: false },
      { timestamp: Date.now() - 1000000, sequence: 3, state: 'EMERGENCY_STOP', position: { x: 2, y: 1, theta: 0.2 }, velocity: { linear: 0, angular: 0 }, battery: 12.3, emergency_stop: true }
    ],
    commandData: [
      { timestamp: Date.now() - 3000000, sequence: 1, command_type: 'START', status: 'acknowledged' },
      { timestamp: Date.now() - 1000000, sequence: 2, command_type: 'EMERGENCY_STOP', status: 'completed' }
    ],
    trackData: {
      track_name: 'Test Track',
      track_length: 100,
      checkpoints: [
        { id: 1, type: 'start', position: { x: 0, y: 0 }, description: '起点' }
      ]
    },
    tags: [
      { id: 't1', timestamp: Date.now() - 1800000, label: '问题点1', description: '控制延迟过高', color: '#ff0000' },
      { id: 't2', timestamp: Date.now() - 900000, label: '问题点2', description: '状态切换异常', color: '#ffaa00' }
    ],
    events: [],
    latencyStats: {
      summary: {
        min_command_ack: 5,
        max_command_ack: 25,
        avg_command_ack: 12.5,
        warnings: []
      }
    },
    stateChanges: [
      { timestamp: Date.now() - 2500000, from_state: 'IDLE', to_state: 'INITIALIZING' },
      { timestamp: Date.now() - 2000000, from_state: 'INITIALIZING', to_state: 'RUNNING' },
      { timestamp: Date.now() - 1000000, from_state: 'RUNNING', to_state: 'EMERGENCY_STOP' }
    ],
    emergencyStops: [
      { timestamp: Date.now() - 1000000, sequence: 3, state: 'EMERGENCY_STOP' }
    ]
  };

  try {
    const mdResult = await exporter.exportMarkdown(testData);
    console.log(`✅ Markdown 导出成功: ${mdResult.filename} (${mdResult.size} 字节)`);

    const csvResult = await exporter.exportCSV(testData);
    console.log(`✅ CSV 导出成功: ${Object.keys(csvResult).length} 个文件`);

    const jsonResult = await exporter.exportJSON(testData);
    console.log(`✅ JSON 导出成功: ${jsonResult.filename} (${jsonResult.size} 字节)`);

    if (fs.existsSync(jsonResult.path)) {
      const content = fs.readFileSync(jsonResult.path, 'utf-8');
      const parsed = JSON.parse(content);
      if (parsed.session && parsed.session.name === testData.session.name) {
        console.log(`✅ JSON 验证成功`);
      }
    }

    return true;
  } catch (error) {
    console.log(`❌ 测试失败: ${error.message}`);
    console.log(error.stack);
    return false;
  }
}

async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('赛道遥测黑匣子 - 组件测试套件');
  console.log('='.repeat(60));

  const results = [];

  results.push({ name: 'JSONLParser', passed: await testJSONLParser() });
  results.push({ name: 'CSVParser', passed: await testCSVParser() });
  results.push({ name: 'YAMLParser', passed: await testYAMLParser() });
  results.push({ name: 'DataParser', passed: await testDataParser() });
  results.push({ name: 'ReplayScheduler', passed: testReplayScheduler() });
  results.push({ name: 'SessionStore', passed: await testSessionStore() });
  results.push({ name: 'ReportExporter', passed: await testReportExporter() });

  console.log('\n' + '='.repeat(60));
  console.log('测试结果汇总');
  console.log('='.repeat(60));

  let passedCount = 0;
  let failedCount = 0;

  results.forEach(result => {
    const status = result.passed ? '✅ 通过' : '❌ 失败';
    console.log(`  ${status}: ${result.name}`);
    if (result.passed) passedCount++;
    else failedCount++;
  });

  console.log('\n' + '='.repeat(60));
  console.log(`总计: ${passedCount} 通过, ${failedCount} 失败`);
  console.log('='.repeat(60));

  if (failedCount > 0) {
    console.log('\n❌ 部分测试失败，请检查错误信息');
    process.exit(1);
  } else {
    console.log('\n✅ 所有测试通过！');
    process.exit(0);
  }
}

main();
