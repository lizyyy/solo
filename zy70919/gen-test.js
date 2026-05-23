const fs = require('fs');
const code = `const testData = {
  elderly: [
    { name: '张奶奶', phone: '13800138001', address: '北京市朝阳区xx街道xx号', care_level: '二级', care_items: ['血压测量', '血糖检测'] },
    { name: '李爷爷', phone: '13800138002', address: '北京市朝阳区xx街道xx号', care_level: '一级', care_items: ['换药', '康复训练'] },
    { name: '王奶奶', phone: '13800138003', address: '北京市海淀区xx街道xx号', care_level: '三级', care_items: ['生活照料', '心理疏导'] }
  ],
  nurses: [
    { name: '刘护士', phone: '13900139001', skills: ['基础护理', '康复'] },
    { name: '陈护士', phone: '13900139002', skills: ['专科护理', '伤口护理'] }
  ]
};

async function runTest() {
  console.log('=== 居家护理排班API测试 ===\\n');
  const baseUrl = 'http://localhost:3000';

  try {
    console.log('1. 检查服务健康状态...');
    const healthRes = await fetch(baseUrl + '/health');
    const health = await healthRes.json();
    console.log('   ✓ 服务运行正常:', health.message);

    console.log('\\n2. 创建批次（测试幂等性）...');
    const batchRes = await fetch(baseUrl + '/api/batches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: '2024年5月第1周排班', material_data: testData, created_by: '站长张三' })
    });
    const batch = await batchRes.json();
    console.log('   ✓ 批次创建成功，批次号:', batch.batch.batch_no);
    const batchId = batch.batch.id;

    console.log('\\n3. 重复提交相同材料（测试幂等性）...');
    const dupRes = await fetch(baseUrl + '/api/batches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: '2024年5月第1周排班', material_data: testData, created_by: '站长李四' })
    });
    const dup = await dupRes.json();
    console.log('   ✓ 幂等性验证 - 是否重复:', dup.isDuplicate, '- 批次号一致:', dup.batch.batch_no === batch.batch.batch_no);

    console.log('\\n4. 登记材料并解析数据...');
    const matRes = await fetch(baseUrl + '/api/materials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ batch_id: batchId, source_type: 'json', raw_data: testData, file_name: '排班数据.json', uploaded_by: '站长张三' })
    });
    const mat = await matRes.json();
    console.log('   ✓ 材料登记成功，材料ID:', mat.material.id);

    console.log('\\n5. 触发排班计算...');
    const calcRes = await fetch(baseUrl + '/api/schedules/recalculate/' + batchId, { method: 'POST' });
    const calc = await calcRes.json();
    console.log('   ✓ 排班完成，排班数量:', calc.scheduled);

    console.log('\\n6. 查询排班列表...');
    const listRes = await fetch(baseUrl + '/api/schedules/batch/' + batchId);
    const schedules = await listRes.json();
    console.log('   ✓ 排班总数:', schedules.length);
    if (schedules.length > 0) {
      console.log('   第一条排班:', schedules[0].schedule_date, schedules[0].time_slot, schedules[0].elderly_name, '->', schedules[0].nurse_name);
    }

    console.log('\\n7. 查询批次统计...');
    const statRes = await fetch(baseUrl + '/api/batches/' + batchId + '/statistics');
    const stats = await statRes.json();
    console.log('   ✓ 统计数据 - 排班:', stats.totalSchedules, '老人:', stats.totalElderly, '护士:', stats.totalNurses);

    console.log('\\n8. 修改排班（测试审计功能）...');
    if (schedules.length > 0) {
      const updateRes = await fetch(baseUrl + '/api/schedules/' + schedules[0].id, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates: { time_slot: '09:00-11:00' }, operator: '护士长王五', reason: '调整时间更合理' })
      });
      const updated = await updateRes.json();
      console.log('   ✓ 修改后的时间段:', updated.time_slot);

      console.log('\\n9. 查询审计日志...');
      const auditRes = await fetch(baseUrl + '/api/schedules/' + schedules[0].id + '/audit');
      const audit = await auditRes.json();
      audit.forEach(log => {
        console.log('   ', log.created_at.substring(11,19), '-', log.changed_by, '修改', log.field_name, ':', log.old_value, '->', log.new_value, '原因:', log.change_reason);
      });

      console.log('\\n10. 查询处理轨迹...');
      const traceRes = await fetch(baseUrl + '/api/schedules/' + schedules[0].id + '/traces');
      const traces = await traceRes.json();
      traces.forEach(t => {
        console.log('   ', t.created_at.substring(11,19), '-', t.action, 'by', t.operator, ':', t.detail);
      });

      console.log('\\n11. 取消排班（电话协调）...');
      const cancelRes = await fetch(baseUrl + '/api/schedules/' + schedules[1].id + '/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cancel_type: 'phone_call', reason: '老人身体不适，临时取消', operator: '调度员赵六' })
      });
      const cancelled = await cancelRes.json();
      console.log('   ✓ 取消后状态:', cancelled.status);
      console.log('   ✓ 取消原因:', cancelled.cancel_reason);
      console.log('   ✓ 最后处理人:', cancelled.last_handler);
    }

    console.log('\\n12. 导出排班数据...');
    const exportRes = await fetch(baseUrl + '/api/schedules/export/' + batchId);
    const exportData = await exportRes.json();
    console.log('   ✓ 导出记录数:', exportData.length);
    if (exportData.length > 0) {
      console.log('   导出字段检查: 包含护士排班=' + (!!exportData[0].nurse_name) + ', 老人护理项目=' + (!!exportData[0].care_items) + ', 临时取消协调=' + (!!exportData[0].cancel_type) + ', 最后处理人=' + (!!exportData[0].last_handler));
    }

    console.log('\\n=== 全部测试通过! ===');
  } catch (err) {
    console.error('测试失败:', err.message);
    process.exit(1);
  }
}

runTest();
`;
fs.writeFileSync('test-api.js', code);
console.log('Generated test-api.js');
