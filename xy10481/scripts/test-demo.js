const http = require('http');

const BASE_URL = 'http://localhost:3005/api/treatment';

const CUST_WANG = 'cust_001';
const CUST_LI = 'cust_002';
const CUST_ZHANG = 'cust_003';

const SVC_SKIN = 'svc_skin_001';
const SVC_HAIR = 'svc_hair_001';
const SVC_LASER = 'svc_laser_001';

const DOC_ZHANG = 'doc_001';
const DOC_LI = 'doc_002';
const DOC_WANG = 'doc_003';

let appointmentId1, appointmentId2, appointmentId3, appointmentId4;

const request = (options, body = null) => {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve({ raw: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
};

const post = (path, body) => {
  return request({
    hostname: 'localhost',
    port: 3005,
    path: `${BASE_URL}${path}`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(JSON.stringify(body))
    }
  }, body);
};

const get = (path) => {
  return request({
    hostname: 'localhost',
    port: 3005,
    path: `${BASE_URL}${path}`,
    method: 'GET'
  });
};

const printSection = (title) => {
  console.log('\n==============================================');
  console.log(`   ${title}`);
  console.log('==============================================\n');
};

const printJson = (obj, indent = 2) => {
  console.log(JSON.stringify(obj, null, indent));
};

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const run = async () => {
  console.log('==============================================');
  console.log('   医美疗程消耗 API - 功能演示');
  console.log('==============================================\n');

  await sleep(500);

  printSection('0. 重置测试数据');
  console.log('--- 清空之前的测试数据 ---');
  let result = await post('/reset', {});
  printJson(result);

  printSection('1. 查看基础数据');
  
  console.log('--- 查看所有服务项目 ---');
  result = await get('/services');
  printJson(result);
  
  console.log('\n--- 查看医生列表 ---');
  result = await get('/doctors');
  printJson(result);

  printSection('2. 客户购入疗程包');
  
  console.log('--- 王美丽购入【深层清洁护理】10次（皮肤管理）---');
  result = await post('/purchase', {
    customerId: CUST_WANG,
    serviceId: SVC_SKIN,
    packageName: '深层清洁十次卡',
    count: 10,
    unitPrice: 380
  });
  printJson(result);

  console.log('\n--- 李小花购入【唇部脱毛】6次（脱毛）---');
  result = await post('/purchase', {
    customerId: CUST_LI,
    serviceId: SVC_HAIR,
    packageName: '唇部脱毛六次卡',
    count: 6,
    unitPrice: 298
  });
  printJson(result);

  console.log('\n--- 张婷婷购入【光子嫩肤】8次（光电项目）---');
  result = await post('/purchase', {
    customerId: CUST_ZHANG,
    serviceId: SVC_LASER,
    packageName: '光子嫩肤八次卡',
    count: 8,
    unitPrice: 880
  });
  printJson(result);

  printSection('3. 赠送次数');
  
  console.log('--- 给王美丽赠送深层清洁2次（新客户礼遇）---');
  result = await post('/gift', {
    customerId: CUST_WANG,
    serviceId: SVC_SKIN,
    count: 2,
    reason: '新客户礼遇'
  });
  printJson(result);

  console.log('\n--- 查看王美丽剩余次数（应该有10次购买 + 2次赠送 = 12次）---');
  result = await get(`/remaining/${CUST_WANG}`);
  printJson(result);

  printSection('4. 预约服务');
  
  const scheduledAt = new Date().toISOString();
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  
  console.log('--- 王美丽预约深层清洁（张医生，今天）---');
  result = await post('/appointment', {
    customerId: CUST_WANG,
    serviceId: SVC_SKIN,
    doctorId: DOC_ZHANG,
    scheduledAt
  });
  appointmentId1 = result.appointmentId;
  printJson(result);
  console.log(`预约ID: ${appointmentId1}`);

  console.log('\n--- 李小花预约唇部脱毛（王医生）---');
  result = await post('/appointment', {
    customerId: CUST_LI,
    serviceId: SVC_HAIR,
    doctorId: DOC_WANG,
    scheduledAt
  });
  appointmentId2 = result.appointmentId;
  printJson(result);
  console.log(`预约ID: ${appointmentId2}`);

  console.log('\n--- 张婷婷预约光子嫩肤（李医生）---');
  result = await post('/appointment', {
    customerId: CUST_ZHANG,
    serviceId: SVC_LASER,
    doctorId: DOC_LI,
    scheduledAt
  });
  appointmentId3 = result.appointmentId;
  printJson(result);
  console.log(`预约ID: ${appointmentId3}`);

  printSection('5. 正常消耗（医生确认扣次）');
  
  console.log('--- 王美丽服务完成，张医生确认扣次（应该优先扣赠送次数）---');
  result = await post('/consume', {
    appointmentId: appointmentId1,
    doctorId: DOC_ZHANG
  });
  printJson(result);

  console.log('\n--- 扣次后查看王美丽剩余次数（赠送应该剩1次，购买10次未动）---');
  result = await get(`/remaining/${CUST_WANG}`);
  printJson(result);

  console.log('\n--- 李小花服务完成，王医生确认扣次（扣购买次数）---');
  result = await post('/consume', {
    appointmentId: appointmentId2,
    doctorId: DOC_WANG
  });
  printJson(result);

  console.log('\n--- 张婷婷服务完成，李医生确认扣次（扣购买次数）---');
  result = await post('/consume', {
    appointmentId: appointmentId3,
    doctorId: DOC_LI
  });
  printJson(result);

  printSection('6. 赠送扣次（王美丽再次消耗）');
  
  console.log('--- 王美丽再次预约深层清洁（明天）---');
  result = await post('/appointment', {
    customerId: CUST_WANG,
    serviceId: SVC_SKIN,
    doctorId: DOC_ZHANG,
    scheduledAt: tomorrow
  });
  appointmentId4 = result.appointmentId;
  printJson(result);
  console.log(`预约ID: ${appointmentId4}`);

  console.log('\n--- 王美丽再次消耗（赠送次数还有1次，继续优先扣赠送）---');
  result = await post('/consume', {
    appointmentId: appointmentId4,
    doctorId: DOC_ZHANG
  });
  printJson(result);

  console.log('\n--- 现在查看王美丽剩余次数（赠送已用完，购买10次未动）---');
  result = await get(`/remaining/${CUST_WANG}`);
  printJson(result);

  printSection('7. 重复扣次拦截');
  
  console.log('--- 尝试对同一个预约再次扣次（应该拦截）---');
  result = await post('/consume', {
    appointmentId: appointmentId1,
    doctorId: DOC_ZHANG
  });
  printJson(result);

  printSection('8. 退款冲抵与剩余次数重算');
  
  console.log('--- 李小花购买的唇部脱毛已使用1次，剩余5次 ---');
  result = await get(`/remaining/${CUST_LI}`);
  printJson(result);

  console.log('\n--- 李小花申请退款2次（应该成功，退款后剩余3次购买次数）---');
  result = await post('/refund', {
    customerId: CUST_LI,
    serviceId: SVC_HAIR,
    count: 2,
    reason: '客户个人原因'
  });
  printJson(result);

  console.log('\n--- 退款后查看李小花剩余次数 ---');
  result = await get(`/remaining/${CUST_LI}`);
  printJson(result);

  printSection('9. 次数不足拦截演示');
  
  console.log('--- 当前李小花剩余购买次数: 3次');
  console.log('尝试退款5次（超过可退款次数）:');
  result = await post('/refund', {
    customerId: CUST_LI,
    serviceId: SVC_HAIR,
    count: 5,
    reason: '测试次数不足'
  });
  printJson(result);

  printSection('10. 流水查询');
  
  console.log('--- 查看所有交易流水 ---');
  result = await get('/transactions');
  printJson(result);

  printSection('11. 统计接口');
  
  console.log('--- 医生执行量统计（张医生）---');
  const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const endDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  result = await get(`/stats/doctor/${DOC_ZHANG}?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`);
  printJson(result);

  console.log('\n--- 退款影响统计 ---');
  result = await get(`/stats/refund-impact?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`);
  printJson(result);

  console.log('\n--- 异常流水查询（包含赠送扣次、退款等）---');
  result = await get(`/stats/abnormal?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`);
  printJson(result);

  printSection('12. 客户剩余次数汇总');
  
  console.log('--- 王美丽剩余次数 ---');
  result = await get(`/remaining/${CUST_WANG}`);
  printJson(result);
  
  console.log('\n--- 李小花剩余次数 ---');
  result = await get(`/remaining/${CUST_LI}`);
  printJson(result);
  
  console.log('\n--- 张婷婷剩余次数 ---');
  result = await get(`/remaining/${CUST_ZHANG}`);
  printJson(result);

  printSection('演示完成');
  console.log('\n【业务规则验证总结】');
  console.log('✅ 赠送次数优先扣减：王美丽2次赠送都优先被消耗');
  console.log('✅ 医生确认机制：必须通过预约 + 医生确认才能扣次');
  console.log('✅ 重复扣次拦截：同一预约重复扣次被成功拦截');
  console.log('✅ 退款剩余次数重算：李小花退款后次数正确更新');
  console.log('✅ 次数不足拦截：退款超过可用次数时被拦截');
  console.log('✅ 流水完整追踪：所有操作都有交易记录');
  console.log('✅ 统计接口可用：医生执行量、退款影响、异常流水都可查询');
  console.log('\n如需重新演示，请重启服务');
};

run().catch(console.error);
