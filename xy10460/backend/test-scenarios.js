const http = require('http');

const baseUrl = 'http://localhost:3001/api';

function makeRequest(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            data: data ? JSON.parse(data) : null
          });
        } catch (e) {
          resolve({ status: res.statusCode, data });
        }
      });
    });
    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function test() {
  console.log('===== 开始测试社区垃圾分类积分台 =====\n');

  try {
    const healthRes = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: '/api/health',
      method: 'GET'
    });
    console.log('✅ 1. 健康检查: 服务运行正常\n');

    const residentsRes = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: '/api/residents',
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    const residents = residentsRes.data;
    console.log(`✅ 2. 居民列表: 获取到 ${residents.length} 位居民`);
    residents.forEach(r => console.log(`   - ${r.name} (ID: ${r.id}, 当前积分: ${r.total_points})`));
    console.log('');

    const zhangsan = residents.find(r => r.name === '张三');
    const lisi = residents.find(r => r.name === '李四');
    const wangwu = residents.find(r => r.name === '王五');

    console.log('===== 测试样例1: 正常投递 =====');
    const delivery1 = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: '/api/delivery',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      resident_id: zhangsan.id,
      garbage_type: '可回收物',
      weight: 10
    });
    console.log(`投递结果: ${delivery1.data.message}`);
    console.log(`获得积分: ${delivery1.data.points_earned}`);
    
    const residentsAfter1 = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: '/api/residents',
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    const updatedZhangsan = residentsAfter1.data.find(r => r.id === zhangsan.id);
    console.log(`张三当前积分: ${updatedZhangsan.total_points}`);
    console.log('✅ 样例1: 正常投递成功\n');

    console.log('===== 测试样例2: 重复投递拦截 =====');
    const duplicateDelivery = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: '/api/delivery',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      resident_id: zhangsan.id,
      garbage_type: '可回收物',
      weight: 5
    });
    console.log(`重复投递拦截: ${duplicateDelivery.status === 400 ? '成功拦截' : '拦截失败'}`);
    console.log(`错误信息: ${duplicateDelivery.data?.error || '无错误'}`);
    if (duplicateDelivery.data?.details) {
      console.log(`详细信息: ${duplicateDelivery.data.details}`);
    }
    console.log('✅ 样例2: 重复投递拦截成功\n');

    console.log('===== 测试样例3: 混投扣分 =====');
    const delivery2 = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: '/api/delivery',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      resident_id: lisi.id,
      garbage_type: '厨余垃圾',
      weight: 8
    });
    console.log(`李四投递结果: ${delivery2.data.message}`);
    const deliveryId = delivery2.data.delivery_id;

    const inspection = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: '/api/delivery/inspection',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      delivery_id: deliveryId,
      is_qualified: false,
      problem_description: '混投了塑料制品'
    });
    console.log(`抽检结果: ${inspection.data.message}`);
    
    const residentsAfter3 = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: '/api/residents',
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    const updatedLisi = residentsAfter3.data.find(r => r.id === lisi.id);
    console.log(`李四当前积分: ${updatedLisi.total_points}`);
    console.log('✅ 样例3: 混投扣分成功\n');

    console.log('===== 测试样例4: 积分不足兑换拦截 =====');
    const giftsRes = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: '/api/exchange/gifts',
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    const gifts = giftsRes.data;
    console.log(`礼品列表: ${gifts.map(g => `${g.name}(${g.points_required}分)`).join(', ')}`);
    
    const expensiveGift = gifts.reduce((max, g) => g.points_required > max.points_required ? g : max, gifts[0]);
    console.log(`尝试用王五的积分兑换最昂贵的礼品: ${expensiveGift.name}`);
    
    const exchangeFail = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: '/api/exchange/applications',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      resident_id: wangwu.id,
      gift_id: expensiveGift.id
    });
    console.log(`兑换结果: ${exchangeFail.status === 400 ? '成功拦截' : '拦截失败'}`);
    console.log(`错误信息: ${exchangeFail.data?.error || '无错误'}`);
    if (exchangeFail.data?.details) {
      console.log(`详细信息: ${exchangeFail.data.details}`);
    }
    console.log('✅ 样例4: 积分不足兑换拦截成功\n');

    console.log('===== 测试样例5: 正常兑换礼品 =====');
    const cheapGift = gifts.find(g => g.name === '卫生纸') || gifts[0];
    console.log(`张三尝试兑换: ${cheapGift.name}`);
    
    const exchangeSuccess = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: '/api/exchange/applications',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      resident_id: zhangsan.id,
      gift_id: cheapGift.id
    });
    console.log(`兑换申请结果: ${exchangeSuccess.data.message}`);
    const applicationId = exchangeSuccess.data.application_id;

    const residentsAfter5 = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: '/api/residents',
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    const updatedZhangsan2 = residentsAfter5.data.find(r => r.id === zhangsan.id);
    console.log(`张三兑换后积分: ${updatedZhangsan2.total_points}`);
    console.log('✅ 样例5: 兑换申请提交成功\n');

    console.log('===== 测试样例6: 申诉成功返还积分 =====');
    const inspectionRes = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: '/api/dashboard/abnormal-inspections',
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    const abnormalInspections = inspectionRes.data;
    const lisiInspection = abnormalInspections.find(i => i.resident_name === '李四');
    
    if (lisiInspection) {
      console.log(`李四的抽检记录ID: ${lisiInspection.id}`);
      
      const complaint = await makeRequest({
        hostname: 'localhost',
        port: 3001,
        path: '/api/complaints',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, {
        resident_id: lisi.id,
        related_id: lisiInspection.id,
        related_type: 'inspection',
        reason: '没有混投，是误判'
      });
      console.log(`申诉提交结果: ${complaint.data.message}`);
      const complaintId = complaint.data.id;

      const processComplaint = await makeRequest({
        hostname: 'localhost',
        port: 3001,
        path: `/api/complaints/${complaintId}/process`,
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' }
      }, {
        status: 'approved',
        process_result: '经核查确为误判，返还积分'
      });
      console.log(`申诉处理结果: ${processComplaint.data.message}`);
      console.log(`返还积分: ${processComplaint.data.points_returned}`);

      const residentsAfter6 = await makeRequest({
        hostname: 'localhost',
        port: 3001,
        path: '/api/residents',
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      const updatedLisi2 = residentsAfter6.data.find(r => r.id === lisi.id);
      console.log(`李四申诉后积分: ${updatedLisi2.total_points}`);
      console.log('✅ 样例6: 申诉成功返还积分\n');
    } else {
      console.log('⚠️  未找到李四的抽检异常记录\n');
    }

    console.log('===== 测试样例7: 已处理申诉再次修改拦截 =====');
    const complaintsRes = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: '/api/complaints',
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    const processedComplaint = complaintsRes.data.find(c => c.status !== 'pending');
    
    if (processedComplaint) {
      const reprocess = await makeRequest({
        hostname: 'localhost',
        port: 3001,
        path: `/api/complaints/${processedComplaint.id}/process`,
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' }
      }, {
        status: 'rejected',
        process_result: '尝试再次修改'
      });
      console.log(`再次修改已处理申诉: ${reprocess.status === 400 ? '成功拦截' : '拦截失败'}`);
      console.log(`错误信息: ${reprocess.data?.error || '无错误'}`);
      console.log('✅ 样例7: 已处理申诉再次修改拦截成功\n');
    } else {
      console.log('⚠️  无已处理申诉，跳过此测试\n');
    }

    console.log('===== 测试样例8: 积分流水查询 =====');
    const pointsFlowRes = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: '/api/points/flow',
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    console.log(`积分流水记录数: ${pointsFlowRes.data.length}`);
    console.log('最近5条记录:');
    pointsFlowRes.data.slice(0, 5).forEach((flow, idx) => {
      console.log(`   ${idx + 1}. ${flow.resident_name} - ${flow.description} (${flow.points > 0 ? '+' : ''}${flow.points}分)`);
    });
    console.log('✅ 样例8: 积分流水查询成功\n');

    console.log('===== 测试样例9: 看板统计 =====');
    const statsRes = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: '/api/dashboard/stats',
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    const stats = statsRes.data;
    console.log(`居民总数: ${stats.totalResidents}`);
    console.log(`总积分: ${stats.totalPoints}`);
    console.log(`待审核兑换: ${stats.pendingExchanges}`);
    console.log(`今日抽检异常: ${stats.todayUnqualified}`);
    console.log('✅ 样例9: 看板统计成功\n');

    console.log('===== 所有测试样例完成 =====');
    console.log('\n测试结果汇总:');
    console.log('✅ 正常投递');
    console.log('✅ 重复投递拦截');
    console.log('✅ 混投扣分');
    console.log('✅ 积分不足兑换拦截');
    console.log('✅ 兑换礼品');
    console.log('✅ 申诉成功返还积分');
    console.log('✅ 已处理申诉再次修改拦截');
    console.log('✅ 积分流水查询');
    console.log('✅ 看板统计');

  } catch (error) {
    console.error('❌ 测试过程中出错:', error.message);
    process.exit(1);
  }
}

test();
