const axios = require('axios');
const BASE_URL = 'http://localhost:3001/api';

async function runDemo() {
  console.log('=== 道路救援备件派单系统功能演示 ===\n');

  try {
    // 1. 查看技师列表
    console.log('1. 查看技师列表:');
    const techRes = await axios.get(`${BASE_URL}/technicians`);
    console.log('   技师数量:', techRes.data.length);
    techRes.data.forEach(t => console.log(`   - ${t.name}: ${t.currentLocation} (${t.status})`));
    console.log();

    // 2. 查看备件库存
    console.log('2. 查看备件库存:');
    const partsRes = await axios.get(`${BASE_URL}/spare-parts`);
    console.log('   备件种类:', partsRes.data.length);
    partsRes.data.forEach(p => console.log(`   - ${p.name}: ${p.quantity}${p.unit} (警戒: ${p.threshold})`));
    console.log();

    // 3. 创建工单
    console.log('3. 创建新工单:');
    const orderRes = await axios.post(`${BASE_URL}/orders`, {
      ownerName: '王测试',
      ownerPhone: '13900001111',
      ownerLocation: '朝阳区望京SOHO',
      ownerLocationLat: 39.9929,
      ownerLocationLng: 116.4735,
      faultType: '轮胎爆胎',
      faultDescription: '左前胎爆胎，需要更换备胎',
      createdBy: '客服系统'
    });
    const orderId = orderRes.data.orderId;
    console.log('   创建成功! 工单号:', orderRes.data.orderNo);
    console.log('   工单ID:', orderId);
    console.log();

    // 4. 查看工单详情
    console.log('4. 查看工单详情:');
    const detailRes = await axios.get(`${BASE_URL}/orders/${orderId}`);
    console.log('   车主:', detailRes.data.ownerName);
    console.log('   位置:', detailRes.data.ownerLocation);
    console.log('   故障:', detailRes.data.faultType);
    console.log('   当前状态:', detailRes.data.status);
    console.log();

    // 5. 派单给技师
    console.log('5. 派单给技师:');
    const assignRes = await axios.put(`${BASE_URL}/orders/${orderId}/assign`, {
      technicianId: techRes.data[0].id,
      operator: '调度员小李'
    });
    console.log('   派单成功!');
    console.log();

    // 6. 查看派单后的工单
    console.log('6. 查看派单后的工单:');
    const afterAssignRes = await axios.get(`${BASE_URL}/orders/${orderId}`);
    console.log('   技师:', afterAssignRes.data.technicianName);
    console.log('   技师位置:', afterAssignRes.data.technicianLocation);
    console.log('   预计到达时间:', afterAssignRes.data.estimatedArrivalTime, '分钟');
    console.log('   当前状态:', afterAssignRes.data.status);
    console.log();

    // 7. 推进状态：技师出发
    console.log('7. 推进状态 - 技师出发:');
    await axios.put(`${BASE_URL}/orders/${orderId}/advance`, {
      status: '技师出发',
      reason: '技师已接到派单，正在前往现场',
      operator: '技师端APP'
    });
    console.log('   状态已更新为: 技师出发');
    console.log();

    // 8. 推进状态：技师到达
    console.log('8. 推进状态 - 技师到达:');
    await axios.put(`${BASE_URL}/orders/${orderId}/advance`, {
      status: '已到达',
      reason: '技师已到达车主位置，开始检查',
      operator: '技师端APP'
    });
    console.log('   状态已更新为: 已到达');
    console.log();

    // 9. 修正车主位置信息（测试修改前后值）
    console.log('9. 修正车主位置信息:');
    await axios.put(`${BASE_URL}/orders/${orderId}/correct`, {
      ownerLocation: '朝阳区望京SOHO T3楼下',
      ownerLocationLat: 39.9930,
      ownerLocationLng: 116.4736,
      operator: '调度员小李'
    });
    console.log('   位置信息已修正');
    console.log();

    // 10. 推进状态：维修中
    console.log('10. 推进状态 - 维修中:');
    await axios.put(`${BASE_URL}/orders/${orderId}/advance`, {
      status: '维修中',
      reason: '确认故障，开始更换轮胎',
      operator: '技师端APP'
    });
    console.log('    状态已更新为: 维修中');
    console.log();

    // 11. 推进状态：已完成
    console.log('11. 推进状态 - 已完成:');
    await axios.put(`${BASE_URL}/orders/${orderId}/advance`, {
      status: '已完成',
      reason: '轮胎更换完成，车辆可以正常行驶',
      operator: '技师端APP'
    });
    console.log('    状态已更新为: 已完成');
    console.log();

    // 12. 查看完整时间线（重点：每个状态变化的原因和修改记录）
    console.log('12. 查看工单时间线（重点展示）:');
    const timelineRes = await axios.get(`${BASE_URL}/orders/${orderId}/timeline`);
    timelineRes.data.forEach((item, idx) => {
      console.log(`   ${idx + 1}. [${new Date(item.createdAt).toLocaleString()}] ${item.action}`);
      console.log(`      操作人: ${item.operator}`);
      console.log(`      原因: ${item.reason}`);
      console.log(`      状态: ${item.previousStatus || '无'} -> ${item.status}`);
      if (Object.keys(item.changes).length > 0) {
        console.log(`      变更详情:`);
        Object.entries(item.changes).forEach(([key, val]) => {
          console.log(`         - ${key}: ${JSON.stringify(val.before)} -> ${JSON.stringify(val.after)}`);
        });
      }
      console.log();
    });

    // 13. 测试取消流程（创建新工单测试取消）
    console.log('13. 测试取消流程:');
    const cancelOrderRes = await axios.post(`${BASE_URL}/orders`, {
      ownerName: '刘取消',
      ownerPhone: '13900002222',
      ownerLocation: '海淀区五道口',
      ownerLocationLat: 39.9939,
      ownerLocationLng: 116.3456,
      faultType: '电瓶没电',
      faultDescription: '车辆无法启动',
      createdBy: '客服系统'
    });
    const cancelOrderId = cancelOrderRes.data.orderId;
    
    // 先派单
    await axios.put(`${BASE_URL}/orders/${cancelOrderId}/assign`, {
      technicianId: techRes.data[1].id,
      operator: '调度员小李'
    });
    
    // 然后取消
    await axios.put(`${BASE_URL}/orders/${cancelOrderId}/advance`, {
      status: '已取消',
      reason: '车主电话说问题已自行解决，取消救援',
      operator: '客服小红'
    });
    console.log('    已创建并取消工单:', cancelOrderRes.data.orderNo);
    console.log();

    // 14. 查看所有工单列表
    console.log('14. 查看所有工单列表:');
    const ordersRes = await axios.get(`${BASE_URL}/orders`);
    console.log('    总工单数:', ordersRes.data.length);
    ordersRes.data.forEach(o => {
      console.log(`      - ${o.orderNo}: ${o.ownerName} - ${o.faultType} - ${o.status} - ${o.responsiblePerson || '未派单'}`);
    });
    console.log();

    // 15. 测试按责任人筛选
    console.log('15. 按责任人筛选工单:');
    const filterRes = await axios.get(`${BASE_URL}/orders`, {
      params: { responsiblePerson: '张师傅' }
    });
    console.log('    张师傅负责的工单:', filterRes.data.length, '个');
    console.log();

    console.log('=== 演示完成 ===');
    console.log();
    console.log('系统功能覆盖:');
    console.log('✓ 车主位置、故障类型记录');
    console.log('✓ 技师派单与到达时长计算');
    console.log('✓ 工单状态全流程闭环');
    console.log('✓ 时间线记录每个状态变化原因');
    console.log('✓ 修正功能保留修改前后值');
    console.log('✓ 客户取消人工处理流程');
    console.log('✓ 导出功能支持按责任人、时间筛选');
    console.log('✓ 备件库存管理（含警戒线）');
    console.log('✓ 批量导入支持');
    console.log();
    console.log('前端管理端地址: http://localhost:3001');
    console.log('API文档:');
    console.log('  - GET  /api/orders              工单列表');
    console.log('  - POST /api/orders              创建工单');
    console.log('  - GET  /api/orders/:id          工单详情');
    console.log('  - PUT  /api/orders/:id/assign   派单');
    console.log('  - PUT  /api/orders/:id/advance  推进状态');
    console.log('  - PUT  /api/orders/:id/correct  修正信息');
    console.log('  - GET  /api/orders/export/download  导出Excel');
    console.log('  - POST /api/orders/import       批量导入');

  } catch (error) {
    console.error('演示出错:', error.response?.data || error.message);
  }
}

runDemo();
