const APIClient = require('./client');

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  const client = new APIClient();
  
  console.log('='.repeat(60));
  console.log('会议同传频道冲突 API - 完整演示');
  console.log('='.repeat(60));
  console.log('');

  try {
    await client.get('/api/health');
    console.log('✅ API 服务已启动');
  } catch (e) {
    console.log('❌ API 服务未启动，请先运行: npm start');
    process.exit(1);
  }

  console.log('');
  console.log('--- 步骤 1: 创建基础资源 (会议室和设备) ---');
  
  const room = await client.createRoom({
    id: 'room-main',
    name: '主会议室 A',
    capacity: 500,
    location: '3楼东侧'
  });
  console.log(`✅ 创建会议室: ${room.data.name}`);

  const devices = [
    { id: 'dev-c1', name: '同传控制台 A', type: 'console', roomId: 'room-main' },
    { id: 'dev-c2', name: '同传控制台 B', type: 'console', roomId: 'room-main' },
    { id: 'dev-t1', name: '发射机 1', type: 'transmitter', roomId: 'room-main' },
    { id: 'dev-t2', name: '发射机 2', type: 'transmitter', roomId: 'room-main' }
  ];

  for (const deviceData of devices) {
    try {
      const device = await client.createDevice(deviceData);
      console.log(`✅ 创建设备: ${device.data.name}`);
    } catch (e) {
      console.log(`⚠️  设备可能已存在: ${deviceData.id}`);
    }
  }

  console.log('');
  console.log('--- 步骤 2: 创建译员 ---');
  
  const interpreters = [
    { id: 'int-001', name: '李明', languages: ['zh', 'en'], email: 'liming@example.com' },
    { id: 'int-002', name: 'Emma Wilson', languages: ['en', 'zh', 'fr'], email: 'emma@example.com' },
    { id: 'int-003', name: '中村健一', languages: ['ja', 'zh', 'en'], email: 'nakamura@example.com' },
    { id: 'int-004', name: 'Sophie Martin', languages: ['fr', 'en', 'de'], email: 'sophie@example.com' }
  ];

  for (const intData of interpreters) {
    try {
      const interpreter = await client.createInterpreter(intData);
      console.log(`✅ 创建译员: ${interpreter.data.name} (语言: ${interpreter.data.languages.join(', ')})`);
    } catch (e) {
      console.log(`⚠️  译员可能已存在: ${intData.id}`);
    }
  }

  console.log('');
  console.log('--- 步骤 3: 创建会议 ---');

  const conference = await client.createConference({
    id: 'conf-2026-global',
    title: '2026 全球科技峰会',
    description: '年度国际科技交流会议',
    organizer: '科技交流协会',
    roomId: 'room-main',
    startTime: '2026-06-15T09:00:00.000Z',
    endTime: '2026-06-15T18:00:00.000Z'
  });
  console.log(`✅ 创建会议: ${conference.data.title}`);

  console.log('');
  console.log('--- 步骤 4: 创建语言频道 ---');

  const channels = [
    { id: 'ch-zh', conferenceId: 'conf-2026-global', language: 'zh', channelNumber: 1, description: '中文原声' },
    { id: 'ch-en', conferenceId: 'conf-2026-global', language: 'en', channelNumber: 2, description: '英语翻译' },
    { id: 'ch-ja', conferenceId: 'conf-2026-global', language: 'ja', channelNumber: 3, description: '日语翻译' },
    { id: 'ch-fr', conferenceId: 'conf-2026-global', language: 'fr', channelNumber: 4, description: '法语翻译' }
  ];

  for (const chData of channels) {
    try {
      const channel = await client.createChannel(chData);
      console.log(`✅ 创建频道: ${channel.data.language} (频道 ${channel.data.channelNumber})`);
    } catch (e) {
      console.log(`⚠️  频道可能已存在: ${chData.id}`);
    }
  }

  console.log('');
  console.log('--- 步骤 5: 创建排班（译员 + 设备绑定）---');

  const schedules = [
    {
      id: 'sch-001',
      conferenceId: 'conf-2026-global',
      channelId: 'ch-en',
      interpreterId: 'int-002',
      deviceId: 'dev-c1',
      startTime: '2026-06-15T09:00:00.000Z',
      endTime: '2026-06-15T12:00:00.000Z'
    },
    {
      id: 'sch-002',
      conferenceId: 'conf-2026-global',
      channelId: 'ch-en',
      interpreterId: 'int-001',
      deviceId: 'dev-c1',
      startTime: '2026-06-15T13:00:00.000Z',
      endTime: '2026-06-15T18:00:00.000Z'
    },
    {
      id: 'sch-003',
      conferenceId: 'conf-2026-global',
      channelId: 'ch-ja',
      interpreterId: 'int-003',
      deviceId: 'dev-c2',
      startTime: '2026-06-15T09:00:00.000Z',
      endTime: '2026-06-15T18:00:00.000Z'
    },
    {
      id: 'sch-004',
      conferenceId: 'conf-2026-global',
      channelId: 'ch-fr',
      interpreterId: 'int-004',
      deviceId: 'dev-t1',
      startTime: '2026-06-15T09:00:00.000Z',
      endTime: '2026-06-15T18:00:00.000Z'
    }
  ];

  for (const schedData of schedules) {
    try {
      const schedule = await client.createSchedule(schedData);
      console.log(`✅ 创建排班: ${schedule.data.id} (频道: ${schedule.data.channelId}, 译员: ${schedule.data.interpreterId})`);
    } catch (e) {
      if (e.response?.error?.code === 'DUPLICATE_SUBMISSION') {
        console.log(`⚠️  排班可能已存在: ${schedData.id}`);
      } else {
        console.log(`❌ 创建排班失败: ${JSON.stringify(e.response?.error || e.error)}`);
      }
    }
  }

  console.log('');
  console.log('--- 步骤 6: 确认排班 ---');

  for (let i = 1; i <= 4; i++) {
    try {
      const result = await client.confirmSchedule(`sch-00${i}`);
      console.log(`✅ 确认排班: sch-00${i} -> 状态: ${result.data.status}`);
    } catch (e) {
      console.log(`⚠️  确认失败 (可能已确认): sch-00${i}`);
    }
  }

  console.log('');
  console.log('--- 步骤 7: 查看会议仪表盘 ---');

  const dashboard = await client.getConferenceDashboard('conf-2026-global');
  const data = dashboard.data;
  
  console.log(`\n📊 会议仪表盘: ${data.conference.title}`);
  console.log(`   状态: ${data.conference.status}`);
  console.log(`   总排班数: ${data.totalSchedules}`);
  console.log(`   状态统计: 草稿 ${data.statusCounts.draft}, 已确认 ${data.statusCounts.confirmed}, 使用中 ${data.statusCounts.inUse}, 已完成 ${data.statusCounts.completed}`);
  
  console.log('\n   频道详情:');
  for (const channel of data.channels) {
    console.log(`   - ${channel.channel.language} (频道${channel.channel.channelNumber}): ${channel.stats.total} 个排班 (已确认: ${channel.stats.confirmed})`);
  }

  console.log('\n   译员排班:');
  for (const int of data.interpreters) {
    console.log(`   - ${int.interpreter.name}: ${int.schedules.length} 个排班`);
  }

  console.log('');
  console.log('--- 步骤 8: 启动会议 ---');

  const startedConf = await client.startConference('conf-2026-global');
  console.log(`✅ 会议已启动: ${startedConf.data.status}`);

  for (let i = 1; i <= 3; i++) {
    try {
      const result = await client.startSchedule(`sch-00${i}`);
      console.log(`✅ 开始排班: sch-00${i} -> 状态: ${result.data.status}`);
    } catch (e) {
      console.log(`⚠️  启动失败: sch-00${i} - ${JSON.stringify(e.response?.error || e.error)}`);
    }
  }

  console.log('');
  console.log('--- 步骤 9: 检查冲突情况 ---');

  const conflicts = await client.checkConflicts(
    '2026-06-15T08:00:00.000Z',
    '2026-06-15T20:00:00.000Z'
  );
  console.log(`🔍 冲突检测: 发现 ${conflicts.data.totalConflicts} 个冲突`);
  console.log(`   - 译员冲突: ${conflicts.data.interpreterConflicts.length}`);
  console.log(`   - 设备冲突: ${conflicts.data.deviceConflicts.length}`);

  console.log('');
  console.log('--- 步骤 10: 测试边界情况（故意制造冲突）---');

  console.log('\n测试 1: 重复提交排班');
  try {
    await client.createSchedule({
      id: 'sch-001',
      conferenceId: 'conf-2026-global',
      channelId: 'ch-en',
      interpreterId: 'int-002',
      deviceId: 'dev-c1',
      startTime: '2026-06-15T09:00:00.000Z',
      endTime: '2026-06-15T12:00:00.000Z'
    });
    console.log('❌ 应该失败但成功了');
  } catch (e) {
    console.log(`✅ 正确拦截: ${e.response?.error?.code} - ${e.response?.error?.message}`);
  }

  console.log('\n测试 2: 译员时间冲突');
  try {
    await client.createSchedule({
      id: 'sch-conflict-int',
      conferenceId: 'conf-2026-global',
      channelId: 'ch-fr',
      interpreterId: 'int-002',
      deviceId: 'dev-t2',
      startTime: '2026-06-15T10:00:00.000Z',
      endTime: '2026-06-15T11:00:00.000Z'
    });
    console.log('❌ 应该失败但成功了');
  } catch (e) {
    console.log(`✅ 正确拦截: ${e.response?.error?.code} - ${e.response?.error?.message}`);
  }

  console.log('\n测试 3: 设备时间冲突');
  try {
    await client.createSchedule({
      id: 'sch-conflict-dev',
      conferenceId: 'conf-2026-global',
      channelId: 'ch-fr',
      interpreterId: 'int-001',
      deviceId: 'dev-c1',
      startTime: '2026-06-15T09:30:00.000Z',
      endTime: '2026-06-15T10:30:00.000Z'
    });
    console.log('❌ 应该失败但成功了');
  } catch (e) {
    console.log(`✅ 正确拦截: ${e.response?.error?.code} - ${e.response?.error?.message}`);
  }

  console.log('\n测试 4: 语言能力不匹配 (让中文译员做法语翻译)');
  try {
    await client.createSchedule({
      id: 'sch-lang-mismatch',
      conferenceId: 'conf-2026-global',
      channelId: 'ch-fr',
      interpreterId: 'int-001',
      deviceId: 'dev-t2',
      startTime: '2026-06-16T09:00:00.000Z',
      endTime: '2026-06-16T12:00:00.000Z'
    });
    console.log('❌ 应该失败但成功了');
  } catch (e) {
    console.log(`✅ 正确拦截: ${e.response?.error?.code} - ${e.response?.error?.message}`);
  }

  console.log('\n测试 5: 来源记录缺失 (频道不属于该会议)');
  try {
    const otherConf = await client.createConference({
      id: 'conf-other',
      title: '另一个会议',
      startTime: '2026-07-01T09:00:00.000Z',
      endTime: '2026-07-01T18:00:00.000Z'
    });
    
    await client.createSchedule({
      id: 'sch-source-missing',
      conferenceId: 'conf-other',
      channelId: 'ch-en',
      interpreterId: 'int-002',
      deviceId: 'dev-t2',
      startTime: '2026-07-01T09:00:00.000Z',
      endTime: '2026-07-01T12:00:00.000Z'
    });
    console.log('❌ 应该失败但成功了');
  } catch (e) {
    console.log(`✅ 正确拦截: ${e.response?.error?.code} - ${e.response?.error?.message}`);
  }

  console.log('\n测试 6: 状态流转冲突 (尝试修改已确认的排班)');
  try {
    await client.put('/api/schedules/sch-001', {
      notes: '尝试修改已确认的排班'
    });
    console.log('❌ 应该失败但成功了');
  } catch (e) {
    console.log(`✅ 正确拦截: ${e.response?.error?.code} - ${e.response?.error?.message}`);
  }

  console.log('');
  console.log('='.repeat(60));
  console.log('演示完成！');
  console.log('='.repeat(60));
  console.log('');
  console.log('📌 关键流程回顾:');
  console.log('   会议室 → 设备 → 译员 → 会议 → 语言频道 → 排班 → 确认 → 启动 → 完成');
  console.log('');
  console.log('🔗 主线: 会议场次 → 语言频道 → 译员排班 → 设备绑定');
  console.log('');
  console.log('🛡️  冲突检测覆盖:');
  console.log('   - 重复提交 (DUPLICATE_SUBMISSION)');
  console.log('   - 译员时间冲突 (INTERPRETER_CONFLICT)');
  console.log('   - 设备时间冲突 (DEVICE_CONFLICT)');
  console.log('   - 语言能力不匹配 (LANGUAGE_MISMATCH)');
  console.log('   - 来源记录缺失 (SOURCE_RECORD_MISSING)');
  console.log('   - 状态流转冲突 (STATE_CONFLICT)');
  console.log('');
}

main().catch(console.error);
