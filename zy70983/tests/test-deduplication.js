const http = require('http');

const BASE_URL = 'localhost';
const PORT = 8080;

function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: BASE_URL,
      port: PORT,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          resolve({
            statusCode: res.statusCode,
            data: JSON.parse(body)
          });
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            data: body
          });
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function runDeduplicationTests() {
  console.log('='.repeat(70));
  console.log('去重逻辑验证测试');
  console.log('='.repeat(70));

  const timestamp = Date.now();

  const materialA = {
    batch_no: 'BATCH-TEST-' + timestamp,
    source: '市政运维中心',
    records: [
      {
        record_no: 'REC-001',
        streetlight_id: 'SL-10001',
        alarm_time: Date.now() - 86400000,
        alarm_level: 'high',
        alarm_type: 'power_failure'
      }
    ]
  };

  const materialB = {
    batch_no: 'BATCH-TEST-' + timestamp,
    source: '市政运维中心',
    records: [
      {
        record_no: 'REC-001',
        streetlight_id: 'SL-10001',
        alarm_time: Date.now() - 86400000,
        alarm_level: 'high',
        alarm_type: 'bulb_burnout'
      }
    ]
  };

  try {
    console.log('\n[测试 1] 健康检查');
    const health = await makeRequest('GET', '/health');
    console.log('  状态码:', health.statusCode);
    console.log('  结果:', health.data.message);
    if (health.statusCode !== 200) {
      throw new Error('健康检查失败');
    }

    console.log('\n[测试 2] 提交材料 A (alarm_type: power_failure)');
    const submitA = await makeRequest('POST', '/api/tasks', {
      material: materialA,
      handler_id: 'h001'
    });
    console.log('  状态码:', submitA.statusCode);
    console.log('  任务ID:', submitA.data.data?.task?.id);
    console.log('  是否重复:', submitA.data.data?.is_duplicate);
    if (submitA.data.data?.is_duplicate) {
      throw new Error('第一次提交不应是重复的');
    }
    const taskIdA = submitA.data.data?.task?.id;

    console.log('\n[测试 3] 再次提交材料 A (验证去重)');
    const submitAAgain = await makeRequest('POST', '/api/tasks', {
      material: materialA,
      handler_id: 'h001'
    });
    console.log('  状态码:', submitAAgain.statusCode);
    console.log('  是否重复:', submitAAgain.data.data?.is_duplicate);
    console.log('  返回任务ID:', submitAAgain.data.data?.task?.id);
    if (!submitAAgain.data.data?.is_duplicate) {
      throw new Error('相同材料提交应被识别为重复');
    }
    if (submitAAgain.data.data?.task?.id !== taskIdA) {
      throw new Error('重复提交应返回相同的任务ID');
    }
    console.log('  ✅ 正确：相同材料被识别为重复，返回原有任务');

    console.log('\n[测试 4] 提交材料 B (alarm_type: bulb_burnout)');
    console.log('  材料 B 与材料 A 批号、来源、记录数相同，但 alarm_type 不同');
    const submitB = await makeRequest('POST', '/api/tasks', {
      material: materialB,
      handler_id: 'h001'
    });
    console.log('  状态码:', submitB.statusCode);
    console.log('  任务ID:', submitB.data.data?.task?.id);
    console.log('  是否重复:', submitB.data.data?.is_duplicate);
    const taskIdB = submitB.data.data?.task?.id;
    
    if (submitB.data.data?.is_duplicate) {
      throw new Error('❌ 错误：不同材料被误判为重复！这正是我们修复的 Bug！');
    }
    if (taskIdB === taskIdA) {
      throw new Error('❌ 错误：不同材料返回了相同的任务ID！');
    }
    console.log('  ✅ 正确：不同内容的材料生成了不同的任务');

    console.log('\n[测试 5] 获取任务列表验证');
    const taskList = await makeRequest('GET', '/api/tasks?limit=10');
    console.log('  状态码:', taskList.statusCode);
    console.log('  任务总数:', taskList.data.data?.statistics?.total_tasks);
    console.log('  任务列表中的任务:');
    taskList.data.data?.tasks?.forEach((task, i) => {
      console.log(`    [${i}] ${task.id} - ${task.status}`);
    });

    console.log('\n[测试 6] 导出任务 A 结果');
    const exportA = await makeRequest('POST', `/api/tasks/${taskIdA}/export`, {
      handler_id: 'h002'
    });
    console.log('  状态码:', exportA.statusCode);
    console.log('  导出数量:', exportA.data.data?.total_count);
    if (exportA.data.data?.data?.length > 0) {
      const sample = exportA.data.data.data[0];
      console.log('  导出数据示例:');
      console.log(`    记录编号: ${sample.record_no}`);
      console.log(`    告警类型: ${sample.alarm_info.type}`);
      console.log(`    最后处理人: ${sample.last_handler.name}`);
    }

    console.log('\n' + '='.repeat(70));
    console.log('✅ 所有去重测试通过！');
    console.log('='.repeat(70));

  } catch (error) {
    console.error('\n❌ 测试失败:', error.message);
    console.log(error);
    process.exit(1);
  }
}

runDeduplicationTests();