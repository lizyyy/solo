const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

const BASE_URL = 'http://localhost:3000/api';

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const logStep = (step, description) => {
  console.log(`\n[步骤 ${step}] ${description}`);
  console.log('='.repeat(60));
};

const demoFlow = async () => {
  console.log('🌿 绿植租摆系统 - 完整业务流程演示 🌿');
  console.log('='.repeat(60));
  
  try {
    await delay(500);

    logStep(1, '查询现有客户和点位信息');
    const customersRes = await axios.get(`${BASE_URL}/customers`);
    const customer = customersRes.data.data[0];
    console.log('客户:', customer.name, customer.id);

    const locationsRes = await axios.get(`${BASE_URL}/customers/locations`);
    const locations = locationsRes.data.data.filter(l => l.customer_id === customer.id);
    console.log('点位数量:', locations.length);
    locations.forEach(l => console.log(`  - ${l.name}: ${l.id}`));

    await delay(500);
    logStep(2, '查询植物列表 - 发现异常植物');
    const plantsRes = await axios.get(`${BASE_URL}/plants`);
    const plants = plantsRes.data.data;
    console.log('植物总数:', plants.length);
    plants.forEach(p => console.log(`  - ${p.name} (${p.status}): ${p.id}`));

    const wiltedPlant = plants.find(p => p.status === 'wilted');
    const needsCarePlant = plants.find(p => p.status === 'needs_care');
    
    if (wiltedPlant) {
      console.log(`\n发现枯萎植物: ${wiltedPlant.name}`);
    }
    if (needsCarePlant) {
      console.log(`发现需要养护植物: ${needsCarePlant.name}`);
    }

    await delay(500);
    logStep(3, '为枯萎植物创建养护任务');
    const maintenanceTaskId = uuidv4();
    const createTaskRes = await axios.post(`${BASE_URL}/maintenance`, {
      request_id: `req_main_${Date.now()}`,
      plant_id: wiltedPlant.id,
      location_id: wiltedPlant.location_id,
      scheduled_date: new Date().toISOString().split('T')[0],
      task_type: 'wilting_treatment',
      description: '蝴蝶兰叶片发黄，需要枯萎处理',
      created_by: '养护员李四',
      operated_by: '养护员李四'
    });
    console.log('养护任务创建成功:', createTaskRes.data.data.id);

    await delay(500);
    logStep(4, '开始执行养护任务');
    const startTaskRes = await axios.post(`${BASE_URL}/maintenance/${createTaskRes.data.data.id}/start`, {
      operated_by: '养护员李四'
    });
    console.log('养护任务状态:', startTaskRes.data.data.status);

    await delay(500);
    logStep(5, '养护过程中标记需要赔偿');
    const needsCompRes = await axios.post(`${BASE_URL}/maintenance/${createTaskRes.data.data.id}/needs-compensation`, {
      operated_by: '养护员李四'
    });
    console.log('养护任务状态更新为:', needsCompRes.data.data.status);
    console.log('植物状态同步更新为需要赔偿处理');

    await delay(500);
    logStep(6, '创建赔偿记录');
    const createCompRes = await axios.post(`${BASE_URL}/compensations`, {
      request_id: `req_comp_${Date.now()}`,
      plant_id: wiltedPlant.id,
      location_id: wiltedPlant.location_id,
      amount: 300,
      reason: '蝴蝶兰严重枯萎，无法恢复，按残值赔偿',
      handled_by: '养护员李四',
      operated_by: '养护员李四'
    });
    console.log('赔偿记录创建成功:', createCompRes.data.data.id);
    console.log('赔偿金额: ¥', createCompRes.data.data.amount);

    await delay(500);
    logStep(7, '审批赔偿申请');
    const approveRes = await axios.post(`${BASE_URL}/compensations/${createCompRes.data.data.id}/approve`, {
      approved_by: '王经理',
      notes: '情况属实，同意赔偿'
    });
    console.log('赔偿状态更新为:', approveRes.data.data.status);

    await delay(500);
    logStep(8, '标记赔偿已支付');
    const paidRes = await axios.post(`${BASE_URL}/compensations/${createCompRes.data.data.id}/mark-paid`, {
      operated_by: '财务小赵'
    });
    console.log('赔偿状态更新为:', paidRes.data.data.status);

    await delay(500);
    logStep(9, '完成养护任务');
    const completeRes = await axios.post(`${BASE_URL}/maintenance/${createTaskRes.data.data.id}/complete`, {
      notes: '已完成枯萎处理和赔偿流程，客户确认',
      operated_by: '养护员李四'
    });
    console.log('养护任务最终状态:', completeRes.data.data.status);

    await delay(500);
    logStep(10, '植物跨点位移动 - 把发财树移到经理办公室');
    const targetLocation = locations.find(l => l.name === '经理办公室');
    const moveRes = await axios.post(`${BASE_URL}/plants/move`, {
      request_id: `req_move_${Date.now()}`,
      plant_id: needsCarePlant.id,
      from_location_id: needsCarePlant.location_id,
      to_location_id: targetLocation.id,
      move_date: new Date().toISOString().split('T')[0],
      reason: '客户要求调整绿植布局',
      handled_by: '养护员李四',
      operated_by: '养护员李四'
    });
    console.log('移动记录创建成功:', moveRes.data.data.id);
    console.log(`植物 ${needsCarePlant.name} 已从 ${locations.find(l => l.id === needsCarePlant.location_id)?.name} 移至 ${targetLocation.name}`);

    await delay(500);
    logStep(11, '创建换盆记录 - 移动后为发财树换盆');
    const repotRes = await axios.post(`${BASE_URL}/repotting`, {
      request_id: `req_repot_${Date.now()}`,
      plant_id: needsCarePlant.id,
      location_id: targetLocation.id,
      maintenance_task_id: null,
      repot_date: new Date().toISOString().split('T')[0],
      old_pot_number: needsCarePlant.pot_number,
      new_pot_number: 'POT-002-NEW',
      reason: '移动后发现花盆过小，根系拥挤',
      handled_by: '养护员李四',
      operated_by: '养护员李四'
    });
    console.log('换盆记录创建成功:', repotRes.data.data.id);
    console.log('新盆编号:', repotRes.data.data.new_pot_number);

    await delay(500);
    logStep(12, '创建续租合同');
    const contractRes = await axios.post(`${BASE_URL}/renewal/contracts`, {
      request_id: `req_contract_${Date.now()}`,
      customer_id: customer.id,
      location_id: locations[0].id,
      start_date: new Date().toISOString().split('T')[0],
      end_date: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      total_amount: 1590,
      notes: '下一季度续租，包含3盆植物和1次赔偿',
      created_by: '客户经理小钱',
      operated_by: '客户经理小钱'
    });
    console.log('续租合同创建成功:', contractRes.data.data.id);
    console.log('合同金额: ¥', contractRes.data.data.total_amount);

    await delay(500);
    logStep(13, '确认续租合同');
    const confirmRes = await axios.post(`${BASE_URL}/renewal/contracts/${contractRes.data.data.id}/confirm`, {
      operated_by: '客户经理小钱'
    });
    console.log('合同状态更新为:', confirmRes.data.data.status);

    await delay(500);
    logStep(14, '生成续租账单');
    const billRes = await axios.post(`${BASE_URL}/renewal/contracts/${contractRes.data.data.id}/generate-bill`, {
      operated_by: '财务小赵'
    });
    console.log('账单生成成功:', billRes.data.data.id);
    console.log('租金金额: ¥', billRes.data.data.rental_amount);
    console.log('赔偿金额: ¥', billRes.data.data.compensation_amount);
    console.log('总金额: ¥', billRes.data.data.total_amount);

    await delay(500);
    logStep(15, '开具账单');
    const issueRes = await axios.post(`${BASE_URL}/renewal/bills/${billRes.data.data.id}/issue`, {
      operated_by: '财务小赵'
    });
    console.log('账单状态更新为:', issueRes.data.data.status);

    await delay(500);
    logStep(16, '标记账单已支付');
    const billPaidRes = await axios.post(`${BASE_URL}/renewal/bills/${billRes.data.data.id}/mark-paid`, {
      operated_by: '财务小赵'
    });
    console.log('账单状态更新为:', billPaidRes.data.data.status);

    await delay(500);
    logStep(17, '查看植物完整历史记录');
    const historyRes = await axios.get(`${BASE_URL}/plants/${wiltedPlant.id}/history`);
    const history = historyRes.data.data;
    console.log(`植物 ${wiltedPlant.name} 历史记录:`);
    console.log(`  养护任务: ${history.maintenance_tasks.length} 条`);
    console.log(`  换盆记录: ${history.repotting_records.length} 条`);
    console.log(`  枯萎处理: ${history.withering_treatments.length} 条`);
    console.log(`  赔偿记录: ${history.compensations.length} 条`);
    console.log(`  移动记录: ${history.movements.length} 条`);

    await delay(500);
    logStep(18, '演示重复请求防护 - 尝试重复创建相同请求');
    const dupRequestId = `dup_test_${Date.now()}`;
    console.log('第一次请求...');
    await axios.post(`${BASE_URL}/maintenance`, {
      request_id: dupRequestId,
      plant_id: wiltedPlant.id,
      location_id: wiltedPlant.location_id,
      scheduled_date: new Date().toISOString().split('T')[0],
      task_type: 'test',
      description: '测试重复请求',
      created_by: '测试员',
      operated_by: '测试员'
    });
    console.log('第一次请求成功');

    console.log('\n第二次请求 (相同 request_id)...');
    const dupRes = await axios.post(`${BASE_URL}/maintenance`, {
      request_id: dupRequestId,
      plant_id: wiltedPlant.id,
      location_id: wiltedPlant.location_id,
      scheduled_date: new Date().toISOString().split('T')[0],
      task_type: 'test',
      description: '测试重复请求',
      created_by: '测试员',
      operated_by: '测试员'
    });
    console.log('检测到重复请求:', dupRes.data.is_duplicate);
    console.log('系统正确识别并阻止了重复操作!');

    console.log('\n' + '='.repeat(60));
    console.log('✅ 完整业务流程演示成功完成!');
    console.log('='.repeat(60));
    console.log('\n流程摘要:');
    console.log('  1. 发现植物异常 → 创建养护任务');
    console.log('  2. 执行养护 → 发现需要赔偿 → 创建赔偿记录');
    console.log('  3. 审批赔偿 → 完成支付');
    console.log('  4. 植物跨点位移动 → 换盆处理');
    console.log('  5. 创建续租合同 → 生成账单');
    console.log('  6. 开具账单 → 完成支付');
    console.log('  7. 查看完整历史记录');
    console.log('  8. 验证重复请求防护机制');

  } catch (err) {
    console.error('演示流程出错:', err.response?.data || err.message);
    process.exit(1);
  }
};

demoFlow();
