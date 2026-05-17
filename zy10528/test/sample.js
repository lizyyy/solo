const http = require('http');
const moment = require('moment');

const BASE_URL = 'localhost';
const PORT = 3000;

const request = (options, body = null) => {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: BASE_URL,
      port: PORT,
      path: options.path,
      method: options.method,
      headers: {
        'Content-Type': 'application/json',
      }
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve({ statusCode: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ statusCode: res.statusCode, data: data });
        }
      });
    });
    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
};

const runSample = async () => {
  console.log('========================================');
  console.log('数据权限申诉API - 调用样例');
  console.log('========================================\n');

  try {
    console.log('1. 检查服务健康状态...');
    const health = await request({ path: '/api/health', method: 'GET' });
    console.log('   服务状态:', health.data.status, health.data.message, '\n');

    console.log('2. 创建申诉...');
    const createResult = await request({ path: '/api/appeals', method: 'POST' }, {
      employee_id: 'EMP001',
      employee_name: '张三',
      data_scope: '销售数据-华东区域',
      revoke_reason: '岗位调整-临时权限收回',
      appeal_material: '工作交接单截图、主管审批邮件',
      operator_id: 'OP001',
      operator_name: '系统管理员'
    });
    console.log('   创建结果:', createResult.data);
    const appealId = createResult.data.data.appeal_id;
    const appealNo = createResult.data.data.appeal_no;
    console.log('   申诉ID:', appealId, '申诉编号:', appealNo, '\n');

    console.log('3. 查询申诉详情...');
    const appealDetail = await request({ path: `/api/appeals/${appealId}`, method: 'GET' });
    console.log('   申诉详情:', JSON.stringify(appealDetail.data.data, null, 2), '\n');

    console.log('4. 推进申诉状态到处理中...');
    const updateStatus = await request({ path: `/api/appeals/${appealId}/status`, method: 'PUT' }, {
      to_status: 'PROCESSING',
      handler_id: 'HD001',
      handler_name: '李四',
      operator_id: 'OP001',
      operator_name: '系统管理员',
      remark: '已分配处理人，开始审核申诉材料'
    });
    console.log('   状态更新结果:', updateStatus.data, '\n');

    console.log('5. 创建临时恢复权限...');
    const tempRestore = await request({ path: `/api/appeals/${appealId}/temp-restore`, method: 'POST' }, {
      start_time: moment().format('YYYY-MM-DD HH:mm:ss'),
      end_time: moment().add(3, 'days').format('YYYY-MM-DD HH:mm:ss'),
      operator_id: 'OP002',
      operator_name: '王五',
      remark: '紧急业务处理需要，临时恢复3天权限'
    });
    console.log('   临时恢复结果:', tempRestore.data, '\n');

    console.log('6. 查询申诉状态历史...');
    const history = await request({ path: `/api/appeals/${appealId}/history`, method: 'GET' });
    console.log('   状态历史记录数:', history.data.data.length);
    history.data.data.forEach((h, i) => {
      console.log(`   ${i + 1}. ${h.action_type}: ${h.from_status || '初始'} -> ${h.to_status} (${h.operator_name})`);
    });
    console.log('');

    console.log('7. 处理申诉结论-通过...');
    const conclusion = await request({ path: `/api/appeals/${appealId}/conclusion`, method: 'POST' }, {
      conclusion: 'APPROVED',
      conclusion_text: '申诉材料齐全，同意恢复数据权限',
      handler_id: 'HD001',
      handler_name: '李四'
    });
    console.log('   结论处理结果:', conclusion.data, '\n');

    console.log('8. 查询所有申诉列表...');
    const list = await request({ path: '/api/appeals/query', method: 'GET' });
    console.log('   申诉列表总数:', list.data.data.length, '\n');

    console.log('9. 查询统计数据...');
    const stats = await request({ path: '/api/appeals/stats', method: 'GET' });
    console.log('   统计数据:', JSON.stringify(stats.data.data, null, 2), '\n');

    console.log('10. 人工修正申诉数据...');
    const correct = await request({ path: `/api/appeals/${appealId}/manual-correct`, method: 'POST' }, {
      appeal_material: '工作交接单截图、主管审批邮件、部门负责人签字确认',
      operator_id: 'OP001',
      operator_name: '系统管理员',
      remark: '补充申诉材料信息'
    });
    console.log('   修正结果:', correct.data, '\n');

    console.log('11. 查询异常记录...');
    const exceptions = await request({ path: '/api/appeals/exceptions', method: 'GET' });
    console.log('   异常记录总数:', exceptions.data.data.length, '\n');

    console.log('========================================');
    console.log('所有样例调用完成！');
    console.log('========================================');

  } catch (error) {
    console.error('调用失败:', error.message);
    console.log('\n请确保服务已启动: npm start');
  }
};

runSample();
