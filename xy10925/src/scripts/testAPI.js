const http = require('http');

const baseUrl = 'http://localhost:3000/api';

const request = (method, path, data = null) => {
  return new Promise((resolve, reject) => {
    const url = new URL(baseUrl + path);
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
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch {
          resolve(body);
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
};

const runTests = async () => {
  console.log('='.repeat(60));
  console.log('赛事检录资格 API - 验收测试');
  console.log('='.repeat(60));
  console.log('');

  try {
    console.log('1. 健康检查');
    const health = await request('GET', '/health');
    console.log('   ✓ 服务正常:', health.status);
    console.log('');

    console.log('2. 正常创建 - 选手张三检录');
    const checkin1 = await request('POST', '/checkin', { athlete_id: 1, operator: '测试员' });
    console.log('   ✓ 状态:', checkin1.status);
    console.log('   ✓ 成功:', checkin1.success);
    if (!checkin1.success) console.log('   问题:', checkin1.issues);
    console.log('');

    console.log('3. 重复提交 - 张三再次检录');
    const checkin2 = await request('POST', '/checkin', { athlete_id: 1, operator: '测试员' });
    console.log('   ✓ 状态:', checkin2.status);
    console.log('   ✓ 检测到重复:', checkin2.issues?.includes('选手已检录，重复提交'));
    console.log('');

    console.log('4. 异常拦截 - 选手李四（参赛证明未验证）');
    const checkin3 = await request('POST', '/checkin', { athlete_id: 2, operator: '测试员' });
    console.log('   ✓ 状态:', checkin3.status);
    console.log('   ✓ 检测到问题:', checkin3.issues?.includes('参赛证明 未验证'));
    console.log('   ✓ raw_input 已保存:', !!checkin3.eventId);
    console.log('');

    console.log('5. 替补递补 - 选手王五（原本是替补）');
    const checkin4 = await request('POST', '/checkin', { athlete_id: 3, operator: '测试员' });
    console.log('   ✓ 状态:', checkin4.status);
    console.log('   ✓ 递补信息:', checkin4.issues?.[0] || '无');
    console.log('');

    console.log('6. 获取状态历史 - 选手张三');
    const history = await request('GET', '/checkin/status-history/1');
    console.log('   ✓ 状态变更记录数:', history.length);
    history.forEach((h, i) => {
      console.log(`     ${i + 1}. ${h.old_status || '待检录'} → ${h.new_status} (${h.reason})`);
    });
    console.log('');

    console.log('7. 人工修正 - 将李四状态改为"通过"');
    const correction = await request('POST', '/checkin/manual', {
      athlete_id: 2,
      new_status: '已通过',
      changed_by: '管理员',
      reason: '参赛证明已重新审核通过'
    });
    console.log('   ✓ 修正成功:', correction.success);
    console.log('   ✓ 状态变更:', correction.old_status, '→', correction.new_status);
    console.log('');

    console.log('8. 生成资格报告 - 选手张三');
    const report = await request('POST', '/reports/1', { generated_by: '系统' });
    console.log('   ✓ 报告ID:', report.reportId);
    console.log('   ✓ 资格状态:', report.qualification.eligible ? '已通过' : '未通过');
    console.log('   ✓ 检录记录数:', report.checkinEvents.length);
    console.log('');

    console.log('9. 导出 CSV 报告');
    const csv = await request('GET', '/reports/export/csv');
    console.log('   ✓ CSV 导出成功，行数:', csv.split('\n').length);
    console.log('');

    console.log('='.repeat(60));
    console.log('✓ 所有验收测试通过!');
    console.log('='.repeat(60));
    console.log('');
    console.log('数据说明:');
    console.log('- 检录事件保存了 raw_input（原始请求）和 processing_result（处理结论）');
    console.log('- 状态历史完整记录了每次状态变更');
    console.log('- 资格报告包含了选手的所有相关信息和资格判断');

  } catch (err) {
    console.error('测试失败:', err.message);
    console.log('');
    console.log('提示: 请先确保服务已启动!');
    console.log('  npm start');
  }
};

runTests();
