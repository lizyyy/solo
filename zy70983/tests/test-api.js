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

const testMaterial = {
  batch_no: 'BATCH-' + Date.now(),
  source: '市政运维中心',
  records: [
    {
      record_no: 'REC-001',
      streetlight_id: 'SL-10001',
      alarm_time: Date.now() - 86400000,
      alarm_level: 'high',
      alarm_type: 'power_failure',
      alarm_location: { x: 116.4074, y: 39.9042 },
      patrol_time: Date.now() - 43200000,
      patrol_person: '张三',
      patrol_issue: '灯泡烧毁',
      repair_time: Date.now() - 3600000,
      repair_person: '李四',
      repair_result: '已更换灯泡'
    },
    {
      record_no: 'REC-002',
      streetlight_id: 'SL-10002',
      alarm_time: Date.now() - 172800000,
      alarm_level: 'medium',
      alarm_type: 'communication_error',
      patrol_time: Date.now() - 86400000,
      patrol_person: '王五'
    },
    {
      record_no: 'REC-003',
      streetlight_id: '',
      alarm_time: Date.now() - 86400000
    },
    {
      record_no: 'REC-004',
      streetlight_id: 'SL-10004',
      alarm_time: Date.now() - 86400000,
      patrol_time: Date.now() - 172800000
    }
  ]
};

async function runTests() {
  console.log('='.repeat(60));
  console.log('智慧路灯故障派修 API 服务测试');
  console.log('='.repeat(60));

  try {
    console.log('\n[测试 1] 健康检查');
    const health = await makeRequest('GET', '/health');
    console.log('  状态码:', health.statusCode);
    console.log('  结果:', health.data.message);

    console.log('\n[测试 2] 提交新材料');
    const submit1 = await makeRequest('POST', '/api/tasks', {
      material: testMaterial,
      handler_id: 'h001'
    });
    console.log('  状态码:', submit1.statusCode);
    console.log('  任务ID:', submit1.data.data?.task?.id);
    console.log('  状态:', submit1.data.data?.task?.status);
    console.log('  总记录:', submit1.data.data?.task?.total_records);
    console.log('  有效记录:', submit1.data.data?.task?.valid_records);
    console.log('  错误记录:', submit1.data.data?.task?.error_records);
    console.log('  是否重复:', submit1.data.data?.is_duplicate);

    const taskId = submit1.data.data?.task?.id;

    console.log('\n[测试 3] 重复提交相同材料（去重测试）');
    const submit2 = await makeRequest('POST', '/api/tasks', {
      material: testMaterial,
      handler_id: 'h001'
    });
    console.log('  状态码:', submit2.statusCode);
    console.log('  结果:', submit2.data.message);
    console.log('  是否重复:', submit2.data.data?.is_duplicate);

    console.log('\n[测试 4] 获取任务详情（含错误明细）');
    const taskDetail = await makeRequest('GET', `/api/tasks/${taskId}`);
    console.log('  状态码:', taskDetail.statusCode);
    console.log('  任务ID:', taskDetail.data.data?.id);
    console.log('  处理人:', taskDetail.data.data?.handler?.name);
    console.log('  有效记录数:', taskDetail.data.data?.records?.length);
    console.log('  错误明细:');
    taskDetail.data.data?.errors?.forEach((err, i) => {
      console.log(`    [${i}] 位置:第${err.record_index}条, 类型:${err.error_type}, 字段:${err.error_field}, 信息:${err.error_message}`);
    });

    console.log('\n[测试 5] 获取任务列表和统计');
    const taskList = await makeRequest('GET', '/api/tasks?limit=10');
    console.log('  状态码:', taskList.statusCode);
    console.log('  任务总数:', taskList.data.data?.statistics?.total_tasks);
    console.log('  处理中:', taskList.data.data?.statistics?.processing);
    console.log('  待人工确认:', taskList.data.data?.statistics?.manual_confirm);
    console.log('  已导出:', taskList.data.data?.statistics?.exported);

    console.log('\n[测试 6] 导出任务结果');
    const exportResult = await makeRequest('POST', `/api/tasks/${taskId}/export`, {
      handler_id: 'h002'
    });
    console.log('  状态码:', exportResult.statusCode);
    console.log('  导出数量:', exportResult.data.data?.total_count);
    console.log('  导出数据示例:');
    if (exportResult.data.data?.data?.length > 0) {
      const sample = exportResult.data.data.data[0];
      console.log(`    记录编号: ${sample.record_no}`);
      console.log(`    路灯ID: ${sample.streetlight_id}`);
      console.log(`    告警在图上: ${sample.alarm_info.on_map}`);
      console.log(`    巡查在图上: ${sample.patrol_info.on_map}`);
      console.log(`    维修在图上: ${sample.repair_info.on_map}`);
      console.log(`    图上位置一致: ${sample.map_consistent}`);
      console.log(`    最后处理人: ${sample.last_handler.name} (${sample.last_handler.department})`);
    }

    console.log('\n[测试 7] 更新任务状态');
    const updateStatus = await makeRequest('PATCH', `/api/tasks/${taskId}/status`, {
      status: 'processing',
      handler_id: 'h003'
    });
    console.log('  状态码:', updateStatus.statusCode);
    console.log('  结果:', updateStatus.data.message);

    console.log('\n[测试 8] 获取全局统计');
    const stats = await makeRequest('GET', '/api/statistics');
    console.log('  状态码:', stats.statusCode);
    console.log('  统计数据:', JSON.stringify(stats.data.data, null, 4));

    console.log('\n' + '='.repeat(60));
    console.log('所有测试完成！');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\n测试失败:', error.message);
    console.log('\n提示: 请先启动服务，执行: npm start');
    process.exit(1);
  }
}

runTests();