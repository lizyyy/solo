const http = require('http');

function request(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve(data);
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runTest() {
  const baseOptions = {
    hostname: 'localhost',
    port: 3000,
    headers: { 'Content-Type': 'application/json' }
  };

  console.log('=== 消防维保提醒API 完整流程测试 ===\n');

  // 1. 健康检查
  console.log('1. 健康检查...');
  const health = await request({ ...baseOptions, path: '/api/health', method: 'GET' });
  console.log('   ✓', health.message, '\n');

  // 2. 创建批次
  console.log('2. 创建批次...');
  const batch = await request({ ...baseOptions, path: '/api/batches', method: 'POST' }, {
    name: '2024年5月消防维保批次',
    description: '本月度各楼宇消防维保到期提醒处理',
    created_by: '张三'
  });
  console.log('   ✓ 批次ID:', batch.id);
  console.log('   ✓ 批次名称:', batch.name, '\n');

  // 3. 登记材料
  console.log('3. 登记材料（包含3种分类测试数据）...');
  const material = await request({ ...baseOptions, path: '/api/materials/register', method: 'POST' }, {
    batch_id: batch.id,
    content: [
      {
        building_name: '阳光大厦',
        address: '北京市朝阳区xxx路123号',
        contact_person: '李经理',
        contact_phone: '13800138000',
        extinguisher_date: '2024-06-15',
        sprinkler_date: '2024-07-20',
        alarm_date: '2024-05-30'
      },
      {
        building_name: '幸福小区',
        address: '北京市海淀区xxx路456号',
        contact_person: '王主任',
        contact_phone: '',
        extinguisher_date: '2024-08-01',
        sprinkler_date: 'invalid-date',
        alarm_date: '2024-09-15'
      },
      {
        building_name: '',
        address: '',
        contact_person: '',
        contact_phone: '',
        extinguisher_date: '',
        sprinkler_date: '',
        alarm_date: ''
      }
    ],
    uploaded_by: '张三'
  });
  console.log('   ✓ 材料ID:', material.id);
  console.log('   ✓ 来源类型:', material.source_type, '\n');

  // 4. 触发处理
  console.log('4. 触发处理流程...');
  const processing = await request({ ...baseOptions, path: '/api/processing/trigger', method: 'POST' }, {
    batch_id: batch.id,
    processor: '李四'
  });
  console.log('   ✓ 处理总数:', processing.processed);
  console.log('   ✓ 正常:', processing.normal);
  console.log('   ✓ 待补充:', processing.pending_supplement);
  console.log('   ✓ 已拦截:', processing.blocked, '\n');

  // 5. 查询批次统计
  console.log('5. 查询批次统计...');
  const batchDetail = await request({ ...baseOptions, path: `/api/batches/${batch.id}`, method: 'GET' });
  console.log('   ✓ 批次状态:', batchDetail.batch.status);
  console.log('   ✓ 统计数据:', JSON.stringify(batchDetail.statistics), '\n');

  // 6. 查询明细列表
  console.log('6. 查询所有明细...');
  const details = await request({ ...baseOptions, path: `/api/details?batch_id=${batch.id}`, method: 'GET' });
  console.log('   ✓ 明细数量:', details.length);
  details.forEach((d, i) => {
    const categoryMap = { 'normal': '正常', 'pending_supplement': '待补充', 'blocked': '已拦截' };
    console.log(`     ${i + 1}. ${d.building_name || '未命名'} - ${categoryMap[d.category] || d.category}`);
    console.log(`        原因: ${d.category_reason}`);
  });
  console.log('');

  // 7. 查询单条明细和处理轨迹
  console.log('7. 查询单条明细和处理轨迹...');
  if (details.length > 0) {
    const detailWithTrace = await request({ ...baseOptions, path: `/api/details/${details[0].id}`, method: 'GET' });
    console.log('   ✓ 明细ID:', detailWithTrace.detail.id);
    console.log('   ✓ 处理人:', detailWithTrace.detail.processor);
    console.log('   ✓ 轨迹数量:', detailWithTrace.traces.length);
    detailWithTrace.traces.forEach(t => {
      console.log(`     - ${t.action}: ${t.reason}`);
    });
  }
  console.log('');

  // 8. 导出报告
  console.log('8. 导出报告...');
  const exportResult = await request({ ...baseOptions, path: `/api/exports?batch_id=${batch.id}&format=csv`, method: 'GET' });
  console.log('   ✓ 导出文件名:', exportResult.filename);
  console.log('   ✓ 下载地址:', exportResult.download_url);
  console.log('   ✓ 导出数量:', exportResult.count);
  console.log('   ✓ 统计:', JSON.stringify(exportResult.statistics), '\n');

  console.log('=== 测试完成! ===');
  console.log('\n导出的CSV报告包含:');
  console.log('- 楼宇名称、地址、联系人、联系电话');
  console.log('- 灭火器、喷淋、报警主机的维保日期和对应维保表（2套表轮换）');
  console.log('- 分类状态（正常/待补充/已拦截）和原因');
  console.log('- 后续处理动作');
  console.log('- 最后处理人');
  console.log('- 处理时间');
  process.exit(0);
}

setTimeout(runTest, 2000);

// 启动服务
require('./src/app.js');
