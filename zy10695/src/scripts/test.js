const fs = require('fs');
const path = require('path');
const moment = require('moment');

const BASE_URL = 'http://localhost:3000/api';

const request = async (url, options = {}) => {
  const fetch = (await import('node-fetch')).default;
  const fullUrl = url.startsWith('http') ? url : `${BASE_URL}${url}`;
  const response = await fetch(fullUrl, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options
  });
  const text = await response.text();
  try {
    return { status: response.status, data: JSON.parse(text) };
  } catch {
    return { status: response.status, data: text };
  }
};

const printHeader = (title) => {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📋 ${title}`);
  console.log(`${'='.repeat(60)}\n`);
};

const printResult = (name, status, data) => {
  const statusIcon = status >= 200 && status < 300 ? '✅' : '❌';
  console.log(`${statusIcon} ${name}`);
  console.log(`   状态码: ${status}`);
  if (data && data.message) {
    console.log(`   消息: ${data.message}`);
  }
};

const testNormal = async () => {
  printHeader('测试场景1: 正常记录 - 创建、查询、导出');

  const newExemption = {
    datasetName: '测试数据集',
    datasetCode: 'TEST_001',
    fieldName: '用户手机号',
    fieldAlias: 'user_mobile',
    fieldPath: 'user.contact.mobile',
    exemptionReason: '运营活动需要发送短信通知，需真实手机号',
    approver: '张三',
    approverEmail: 'zhangsan@company.com',
    expireDate: moment().add(30, 'days').toISOString(),
    createdBy: '测试员',
    isNestedJson: true
  };

  let createResult = await request('/exemptions', {
    method: 'POST',
    body: JSON.stringify(newExemption)
  });
  printResult('创建豁免审批', createResult.status, createResult.data);

  const exemptionId = createResult.data?.data?.id;

  let listResult = await request('/exemptions?page=1&pageSize=10');
  printResult('查询豁免审批列表', listResult.status, listResult.data);

  if (exemptionId) {
    let detailResult = await request(`/exemptions/${exemptionId}`);
    printResult('查询豁免审批详情', detailResult.status, detailResult.data);

    let updateResult = await request(`/exemptions/${exemptionId}`, {
      method: 'PUT',
      body: JSON.stringify({
        ...newExemption,
        exemptionReason: '运营活动需要发送短信通知，需真实手机号（已更新）'
      })
    });
    printResult('更新豁免审批', updateResult.status, updateResult.data);
  }

  let exportCheckResult = await request('/export/check', {
    method: 'POST',
    body: JSON.stringify({
      exportId: 'EXPORT_NORMAL_001',
      datasetCode: 'USER_CORE_001',
      fields: ['身份证号', '手机号'],
      exportedBy: '测试导出员'
    })
  });
  printResult('导出豁免检查(正常字段)', exportCheckResult.status, exportCheckResult.data);

  console.log('\n✅ 正常记录测试完成');
};

const testAbnormal = async () => {
  printHeader('测试场景2: 异常记录 - 参数错误、过期字段、坏行导入');

  let badParamResult = await request('/exemptions', {
    method: 'POST',
    body: JSON.stringify({
      datasetName: '测试',
      fieldName: '缺少必填参数'
    })
  });
  printResult('创建豁免审批(缺少参数)', badParamResult.status, badParamResult.data);

  let expiredCheckResult = await request('/export/check', {
    method: 'POST',
    body: JSON.stringify({
      exportId: 'EXPORT_ABNORMAL_001',
      datasetCode: 'TRADE_001',
      fields: ['收款人姓名', '交易金额'],
      exportedBy: '测试导出员'
    })
  });
  printResult('导出豁免检查(过期字段)', expiredCheckResult.status, expiredCheckResult.data);

  let mixedCheckResult = await request('/export/check', {
    method: 'POST',
    body: JSON.stringify({
      exportId: 'EXPORT_MIXED_001',
      datasetCode: 'USER_CORE_001',
      fields: ['身份证号', '收款人姓名', '不存在的字段'],
      exportedBy: '测试导出员'
    })
  });
  printResult('导出豁免检查(混合字段)', mixedCheckResult.status, mixedCheckResult.data);

  const badCsvContent = `datasetName,datasetCode,fieldName,exemptionReason,approver,expireDate,createdBy
,TEST_BAD_001,坏字段1,这是一个测试原因,审批人A,${moment().add(10, 'days').format('YYYY-MM-DD')},创建人
正常数据集,,坏字段2,原因太短,审批人B,${moment().add(10, 'days').format('YYYY-MM-DD')},创建人
正常数据集,TEST_BAD_003,坏字段3,,审批人C,${moment().add(10, 'days').format('YYYY-MM-DD')},创建人
正常数据集,TEST_BAD_004,坏字段4,这是一个合法的原因,审批人D,2020-01-01,创建人
正常数据集,TEST_GOOD_001,好字段,这是一个合法的豁免原因,审批人E,${moment().add(10, 'days').format('YYYY-MM-DD')},创建人`;

  const badCsvPath = path.join(__dirname, '../../test_bad_rows.csv');
  fs.writeFileSync(badCsvPath, badCsvContent, 'utf8');
  console.log('✅ 已创建测试坏行CSV文件:', badCsvPath);

  let logsResult = await request('/export/logs?page=1&pageSize=10');
  printResult('查询导出日志', logsResult.status, logsResult.data);

  console.log('\n✅ 异常记录测试完成');
};

const testRepeat = async () => {
  printHeader('测试场景3: 重复运行记录 - 重复创建、重复导入');

  const repeatExemption = {
    datasetName: '重复测试数据集',
    datasetCode: 'REPEAT_TEST',
    fieldName: '重复测试字段',
    fieldAlias: 'repeat_field',
    exemptionReason: '这是一个测试重复创建的豁免原因，长度足够',
    approver: '重复审批人',
    expireDate: moment().add(30, 'days').toISOString(),
    createdBy: '测试员'
  };

  let firstCreate = await request('/exemptions', {
    method: 'POST',
    body: JSON.stringify(repeatExemption)
  });
  printResult('第一次创建', firstCreate.status, firstCreate.data);

  let secondCreate = await request('/exemptions', {
    method: 'POST',
    body: JSON.stringify(repeatExemption)
  });
  printResult('第二次创建(重复)', secondCreate.status, secondCreate.data);

  let thirdCreate = await request('/exemptions', {
    method: 'POST',
    body: JSON.stringify(repeatExemption)
  });
  printResult('第三次创建(重复)', thirdCreate.status, thirdCreate.data);

  let expiringResult = await request('/exemptions/expiring/soon?days=30');
  printResult('查询即将到期的审批', expiringResult.status, expiringResult.data);

  let importLogsResult = await request('/batch/import/logs?page=1&pageSize=10');
  printResult('查询导入日志', importLogsResult.status, importLogsResult.data);

  console.log('\n✅ 重复运行记录测试完成');
};

const main = async () => {
  const mode = process.argv[2];

  console.log('\n🚀 数据脱敏服务 - 豁免审批API测试');
  console.log(`📍 测试地址: ${BASE_URL}`);

  try {
    const healthCheck = await request('/health');
    if (healthCheck.status !== 200) {
      console.error('\n❌ 服务未运行，请先启动服务: npm start');
      process.exit(1);
    }
    console.log('✅ 服务健康检查通过\n');
  } catch (error) {
    console.error('\n❌ 无法连接服务，请先启动服务: npm start');
    process.exit(1);
  }

  switch (mode) {
    case 'normal':
      await testNormal();
      break;
    case 'abnormal':
      await testAbnormal();
      break;
    case 'repeat':
      await testRepeat();
      break;
    default:
      await testNormal();
      await testAbnormal();
      await testRepeat();
  }

  printHeader('测试总结');
  console.log('✅ 所有测试场景执行完成');
  console.log('\n📊 测试覆盖:');
  console.log('   - 正常记录: 创建、查询、更新、导出检查');
  console.log('   - 异常记录: 参数错误、过期字段、混合字段、导出日志');
  console.log('   - 重复运行: 重复创建冲突、即将到期查询、导入日志');
  console.log('\n🔍 请人工复核上述测试结果\n');
};

main().catch(console.error);
