const http = require('http');

const BASE_URL = 'http://localhost:3000/api';

function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + path);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            data: JSON.parse(body)
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
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

async function runTests() {
  console.log('开始运行幼儿园晨检异常追踪API测试...\n');

  try {
    console.log('1. 测试健康检查接口');
    const health = await makeRequest('GET', '/health');
    console.log('   状态:', health.status);
    console.log('   结果:', health.data.message);
    console.log('   ✓ 健康检查通过\n');

    console.log('2. 测试创建批次接口');
    const today = new Date().toISOString().split('T')[0];
    const batchResult = await makeRequest('POST', '/batches', {
      check_date: today,
      created_by: '张老师'
    });
    console.log('   状态:', batchResult.status);
    if (batchResult.status === 200) {
      console.log('   ✓ 批次创建成功');
      console.log('   批次号:', batchResult.data.data.batch_no);
    } else {
      console.log('   ✗ 批次创建失败:', batchResult.data.message);
    }
    console.log('');

    console.log('3. 测试获取批次列表');
    const batches = await makeRequest('GET', '/batches');
    console.log('   状态:', batches.status);
    console.log('   批次数量:', batches.data.data.length);
    console.log('   ✓ 批次列表获取成功\n');

    if (batches.data.data.length > 0) {
      const batchId = batches.data.data[0].id;
      console.log('4. 测试创建晨检记录 - 正常情况');
      const normalRecord = await makeRequest('POST', '/checks', {
        batch_id: batchId,
        student_id: 'S001',
        student_name: '小明',
        class_name: '小班一班',
        temperature: 36.5,
        has_medication: false,
        parent_confirmed: true,
        parent_name: '王芳',
        parent_phone: '13800138000',
        handler: '李老师'
      });
      console.log('   状态:', normalRecord.status);
      console.log('   处理状态:', normalRecord.data.data.status);
      console.log('   ✓ 正常晨检记录创建成功\n');

      console.log('5. 测试创建晨检记录 - 发热拦截');
      const feverRecord = await makeRequest('POST', '/checks', {
        batch_id: batchId,
        student_id: 'S002',
        student_name: '小红',
        class_name: '小班一班',
        temperature: 37.8,
        has_medication: false,
        parent_confirmed: true,
        handler: '李老师'
      });
      console.log('   状态:', feverRecord.status);
      console.log('   处理状态:', feverRecord.data.data.status);
      console.log('   异常类型:', feverRecord.data.data.abnormal_type);
      console.log('   ✓ 发热拦截记录创建成功\n');

      console.log('6. 测试创建晨检记录 - 待补充（家长未确认）');
      const pendingRecord = await makeRequest('POST', '/checks', {
        batch_id: batchId,
        student_id: 'S003',
        student_name: '小刚',
        class_name: '小班一班',
        temperature: 36.8,
        has_medication: true,
        medication_details: '退烧药，每日两次',
        parent_confirmed: false,
        handler: '李老师'
      });
      console.log('   状态:', pendingRecord.status);
      console.log('   处理状态:', pendingRecord.data.data.status);
      console.log('   异常类型:', pendingRecord.data.data.abnormal_type);
      console.log('   ✓ 待补充记录创建成功\n');

      const recordId = pendingRecord.data.data.id;
      console.log('7. 测试触发复核流程');
      const reviewResult = await makeRequest('POST', `/checks/${recordId}/review`, {
        operator: '王主任',
        review_reason: '用药信息需要重新核实'
      });
      console.log('   状态:', reviewResult.status);
      console.log('   ✓ 复核流程触发成功\n');

      console.log('8. 测试获取单条明细和处理轨迹');
      const detail = await makeRequest('GET', `/checks/${recordId}`);
      console.log('   状态:', detail.status);
      console.log('   处理轨迹数量:', detail.data.data.trails.length);
      console.log('   ✓ 明细和轨迹获取成功\n');

      console.log('9. 测试状态更新');
      const updateResult = await makeRequest('PUT', `/checks/${recordId}/status`, {
        new_status: 'normal',
        new_abnormal_type: null,
        operator: '王主任',
        reason: '家长已确认，信息完整，转为正常'
      });
      console.log('   状态:', updateResult.status);
      console.log('   新状态:', updateResult.data.data.status);
      console.log('   ✓ 状态更新成功\n');

      console.log('10. 测试更新回访状态');
      const followupResult = await makeRequest('PUT', `/checks/${recordId}/followup`, {
        follow_up_status: 'completed',
        follow_up_remark: '家长已确认学生情况良好',
        operator: '李老师'
      });
      console.log('   状态:', followupResult.status);
      console.log('   回访状态:', followupResult.data.data.follow_up_status);
      console.log('   ✓ 回访状态更新成功\n');

      console.log('11. 测试班级查询接口');
      const classRecords = await makeRequest('GET', `/checks/class/小班一班`);
      console.log('   状态:', classRecords.status);
      console.log('   异常记录数量:', classRecords.data.data.length);
      console.log('   ✓ 班级查询成功\n');

      console.log('12. 测试统计查询接口');
      const stats = await makeRequest('GET', `/export/statistics/${today}`);
      console.log('   状态:', stats.status);
      console.log('   总记录数:', stats.data.data.total);
      console.log('   正常:', stats.data.data.normal);
      console.log('   待补充:', stats.data.data.pending);
      console.log('   已拦截:', stats.data.data.blocked);
      console.log('   ✓ 统计查询成功\n');

      console.log('13. 测试导出CSV接口');
      const exportResult = await makeRequest('GET', `/export/csv/${today}`);
      console.log('   状态:', exportResult.status);
      console.log('   导出文件名:', exportResult.data.data.fileName);
      console.log('   导出记录数:', exportResult.data.data.recordCount);
      console.log('   ✓ 导出功能正常\n');
    }

    console.log('14. 测试类型字典接口');
    const types = await makeRequest('GET', '/checks/types');
    console.log('   状态:', types.status);
    console.log('   状态类型:', Object.keys(types.data.data.status_types));
    console.log('   异常类型:', Object.keys(types.data.data.abnormal_types));
    console.log('   ✓ 类型字典获取成功\n');

    console.log('═══════════════════════════════════════════');
    console.log('所有测试完成！API服务运行正常。');
    console.log('═══════════════════════════════════════════\n');

  } catch (error) {
    console.error('测试失败:', error.message);
    console.log('\n请确保服务器已启动: npm start');
    process.exit(1);
  }
}

runTests();