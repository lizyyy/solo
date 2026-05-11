const APIClient = require('./client');

async function main() {
  const client = new APIClient();
  
  console.log('='.repeat(60));
  console.log('边界情况测试套件');
  console.log('='.repeat(60));
  
  let passed = 0;
  let failed = 0;

  function testCase(name, fn) {
    return async () => {
      try {
        await fn();
        console.log(`✅ ${name}`);
        passed++;
      } catch (e) {
        console.log(`❌ ${name}: ${e.message || JSON.stringify(e)}`);
        failed++;
      }
    };
  }

  const tests = [
    testCase('查找不存在的会议室', async () => {
      try {
        await client.get('/api/rooms/non-existent');
        throw new Error('应该抛出错误');
      } catch (e) {
        if (e.response?.error?.code !== 'ROOM_NOT_FOUND') {
          throw new Error(`错误码不对: ${e.response?.error?.code}`);
        }
      }
    }),

    testCase('查找不存在的译员', async () => {
      try {
        await client.get('/api/interpreters/non-existent');
        throw new Error('应该抛出错误');
      } catch (e) {
        if (e.response?.error?.code !== 'INTERPRETER_NOT_FOUND') {
          throw new Error(`错误码不对: ${e.response?.error?.code}`);
        }
      }
    }),

    testCase('创建译员不指定语言', async () => {
      try {
        await client.createInterpreter({
          id: 'test-no-lang',
          name: 'Test'
        });
        throw new Error('应该抛出错误');
      } catch (e) {
        if (e.response?.error?.code !== 'VALIDATION_ERROR') {
          throw new Error(`错误码不对: ${e.response?.error?.code}`);
        }
      }
    }),

    testCase('创建会议室重复ID', async () => {
      try {
        await client.createRoom({ id: 'room-main', name: 'Duplicate' });
        throw new Error('应该抛出错误');
      } catch (e) {
        if (e.response?.error?.code !== 'DUPLICATE_SUBMISSION') {
          throw new Error(`错误码不对: ${e.response?.error?.code}`);
        }
      }
    }),

    testCase('创建设备绑定不存在的会议室', async () => {
      try {
        await client.createDevice({
          id: 'test-no-room',
          name: 'Test',
          type: 'console',
          roomId: 'non-existent-room'
        });
        throw new Error('应该抛出错误');
      } catch (e) {
        if (e.response?.error?.code !== 'ROOM_NOT_FOUND') {
          throw new Error(`错误码不对: ${e.response?.error?.code}`);
        }
      }
    }),

    testCase('创建频道绑定不存在的会议', async () => {
      try {
        await client.createChannel({
          id: 'test-no-conf',
          conferenceId: 'non-existent-conf',
          language: 'en',
          channelNumber: 99
        });
        throw new Error('应该抛出错误');
      } catch (e) {
        if (e.response?.error?.code !== 'CONFERENCE_NOT_FOUND') {
          throw new Error(`错误码不对: ${e.response?.error?.code}`);
        }
      }
    }),

    testCase('会议无效时间范围', async () => {
      try {
        await client.createConference({
          id: 'test-bad-time',
          title: 'Test',
          startTime: '2026-06-15T18:00:00.000Z',
          endTime: '2026-06-15T09:00:00.000Z'
        });
        throw new Error('应该抛出错误');
      } catch (e) {
        if (e.response?.error?.code !== 'VALIDATION_ERROR') {
          throw new Error(`错误码不对: ${e.response?.error?.code}`);
        }
      }
    }),

    testCase('排班无效时间范围', async () => {
      try {
        await client.createSchedule({
          id: 'test-bad-sched-time',
          conferenceId: 'conf-2026-global',
          channelId: 'ch-en',
          interpreterId: 'int-002',
          deviceId: 'dev-c1',
          startTime: '2026-06-16T18:00:00.000Z',
          endTime: '2026-06-16T09:00:00.000Z'
        });
        throw new Error('应该抛出错误');
      } catch (e) {
        if (e.response?.error?.code !== 'VALIDATION_ERROR') {
          throw new Error(`错误码不对: ${e.response?.error?.code}`);
        }
      }
    }),

    testCase('非法状态转换 (已完成->使用中)', async () => {
      try {
        const confResult = await client.createConference({
          id: 'test-state-flow',
          title: 'State Flow Test',
          startTime: '2026-07-01T09:00:00.000Z',
          endTime: '2026-07-01T18:00:00.000Z'
        });
        
        await client.post('/api/conferences/test-state-flow/start');
        await client.post('/api/conferences/test-state-flow/complete');
        
        try {
          await client.post('/api/conferences/test-state-flow/start');
          throw new Error('应该抛出错误');
        } catch (e) {
          if (e.response?.error?.code !== 'INVALID_STATE_TRANSITION') {
            throw new Error(`错误码不对: ${e.response?.error?.code}`);
          }
        }
      } finally {
        try { await client.delete('/api/conferences/test-state-flow'); } catch (e) {}
      }
    }),

    testCase('冲突检测API缺少参数', async () => {
      try {
        await client.get('/api/reports/conflicts');
        throw new Error('应该抛出错误');
      } catch (e) {
        if (e.response?.error?.code !== 'VALIDATION_ERROR') {
          throw new Error(`错误码不对: ${e.response?.error?.code}`);
        }
      }
    }),

    testCase('全局仪表盘查询', async () => {
      const result = await client.getDashboard();
      if (!result.success || !result.data.summary) {
        throw new Error('仪表盘数据不正确');
      }
    }),

    testCase('会议仪表盘查询', async () => {
      const result = await client.getConferenceDashboard('conf-2026-global');
      if (!result.success || !result.data.conference) {
        throw new Error('会议仪表盘数据不正确');
      }
    }),

    testCase('按译员查询排班', async () => {
      const result = await client.get('/api/schedules/interpreter/int-002');
      if (!result.success) {
        throw new Error('查询失败');
      }
    }),

    testCase('按会议查询频道', async () => {
      const result = await client.getConferenceChannels('conf-2026-global');
      if (!result.success || result.data.length === 0) {
        throw new Error('应该有频道');
      }
    }),

    testCase('按会议室查询设备', async () => {
      const result = await client.get('/api/devices/room/room-main');
      if (!result.success || result.data.length === 0) {
        throw new Error('应该有设备');
      }
    })
  ];

  console.log(`\n运行 ${tests.length} 个测试...\n`);

  for (const test of tests) {
    await test();
  }

  console.log('');
  console.log('='.repeat(60));
  console.log(`测试结果: ${passed} 通过, ${failed} 失败`);
  console.log('='.repeat(60));

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch(console.error);
