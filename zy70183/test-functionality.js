const http = require('http');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3000';

function request(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ statusCode: res.statusCode, data: parsed });
        } catch {
          resolve({ statusCode: res.statusCode, data: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function checkHealth() {
  console.log('\n=== 1. 健康检查 ===');
  const res = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/health',
    method: 'GET'
  });
  console.log('状态码:', res.statusCode);
  console.log('结果:', res.data.success ? '✅ 服务正常' : '❌ 服务异常');
  return res.data.success;
}

async function checkMasterData() {
  console.log('\n=== 2. 主数据检查 ===');
  
  console.log('\n查询企业列表...');
  const enterprises = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/master/enterprises',
    method: 'GET'
  });
  console.log('企业数量:', enterprises.data?.data?.enterprises?.length || 0);
  
  console.log('\n查询申报期...');
  const periods = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/master/periods',
    method: 'GET'
  });
  console.log('申报期数量:', periods.data?.data?.periods?.length || 0);
  
  console.log('\n查询校验规则...');
  const rules = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/master/rules',
    method: 'GET'
  });
  console.log('规则数量:', rules.data?.data?.rules?.length || 0);
  
  return {
    enterprises: enterprises.data?.data?.enterprises || [],
    periods: periods.data?.data?.periods || []
  };
}

async function uploadTestAttachment(enterpriseCode, periodCode) {
  console.log('\n=== 3. 附件上传测试 ===');
  
  const testFile = path.join(__dirname, 'test-upload.pdf');
  fs.writeFileSync(testFile, 'Test PDF content for attachment upload');
  
  const formData = `------WebKitFormBoundary\r
Content-Disposition: form-data; name="file"; filename="test-upload.pdf"\r
Content-Type: application/pdf\r

Test PDF content for attachment upload\r
------WebKitFormBoundary\r
Content-Disposition: form-data; name="enterpriseCode"\r

${enterpriseCode}\r
------WebKitFormBoundary\r
Content-Disposition: form-data; name="periodCode"\r

${periodCode}\r
------WebKitFormBoundary\r
Content-Disposition: form-data; name="attachmentType"\r

INVOICE_SUMMARY\r
------WebKitFormBoundary\r
Content-Disposition: form-data; name="sourceSystem"\r

TEST_SYSTEM\r
------WebKitFormBoundary--\r
`;
  
  console.log('\n上传附件 (INVOICE_SUMMARY)...');
  const res = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/attachments/upload',
    method: 'POST',
    headers: {
      'Content-Type': 'multipart/form-data; boundary=----WebKitFormBoundary',
      'Content-Length': Buffer.byteLength(formData),
      'x-operator': 'test-user'
    }
  }, formData);
  
  console.log('上传状态:', res.data?.success ? '✅ 成功' : '❌ 失败');
  console.log('附件ID:', res.data?.data?.attachmentId || '无');
  
  try { fs.unlinkSync(testFile); } catch(e) {}
  
  return res.data?.data;
}

async function checkDeclarationStatus(enterpriseCode, periodCode) {
  console.log('\n=== 4. 申报状态检查（缺件拦截测试）===');
  
  console.log(`\n查询企业 ${enterpriseCode} 申报期 ${periodCode} 的状态...`);
  const res = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/declarations/${enterpriseCode}/${periodCode}`,
    method: 'GET'
  });
  
  const status = res.data?.data?.record?.overallStatus;
  console.log('当前状态:', status);
  
  if (status === 'MISSING_ATTACHMENTS') {
    console.log('✅ 缺件拦截功能正常！缺少 FINANCIAL_STATEMENT 附件');
  } else if (status === 'READY_TO_DECLARE') {
    console.log('⚠️ 状态正常（可能已上传所有附件）');
  }
  
  const missing = res.data?.data?.record?.validationResult?.missingAttachments || [];
  console.log('缺失附件数量:', missing.length);
  missing.forEach((m, i) => {
    console.log(`  ${i + 1}. ${m.attachmentName} (${m.attachmentType})`);
  });
  
  return res.data?.data;
}

async function testManualCorrection(enterpriseCode, periodCode, attachmentId) {
  console.log('\n=== 5. 人工修正测试 ===');
  
  if (!attachmentId) {
    console.log('⚠️ 跳过：没有可修正的附件');
    return;
  }
  
  console.log('\n人工修正附件状态...');
  const res = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/attachments/${attachmentId}/manual-correct`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-operator': 'admin-user'
    }
  }, JSON.stringify({
    reason: '测试人工修正：纸质文件已审核通过',
    targetStatus: 'MANUAL_CORRECTED'
  }));
  
  console.log('修正状态:', res.data?.success ? '✅ 成功' : '❌ 失败');
  console.log('新状态:', res.data?.data?.validationStatus);
  
  console.log('\n验证审计日志...');
  const logs = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/audit-logs?logType=MANUAL_CORRECTION&pageSize=5',
    method: 'GET'
  });
  
  console.log('人工修正日志数量:', logs.data?.data?.logs?.length || 0);
  if (logs.data?.data?.logs?.length > 0) {
    const log = logs.data.data.logs[0];
    console.log('最新日志:', {
      操作人: log.operator,
      时间: log.createdAt,
      原因: log.reason
    });
  }
}

async function testReportGeneration(enterpriseCode, periodCode) {
  console.log('\n=== 6. 申报报告生成 ===');
  
  const res = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/declarations/${enterpriseCode}/${periodCode}/report`,
    method: 'GET'
  });
  
  const report = res.data?.data;
  if (!report) {
    console.log('❌ 报告生成失败');
    return;
  }
  
  console.log('✅ 报告生成成功！');
  console.log('\n报告摘要:');
  console.log('  企业:', report.enterprise?.enterpriseName);
  console.log('  申报期:', report.period?.periodCode);
  console.log('  当前状态:', report.declarationStatus?.overallStatus);
  console.log('  是否可申报:', report.canDeclare ? '是' : '否');
  console.log('\n  附件汇总:');
  console.log('    必需附件:', report.attachmentSummary?.totalRequired || 0);
  console.log('    已上传必需:', report.attachmentSummary?.uploadedRequired || 0);
  console.log('    有效必需:', report.attachmentSummary?.validRequired || 0);
  console.log('\n  缺失附件:', report.missingAttachments?.length || 0);
  console.log('  无效附件:', report.invalidAttachments?.length || 0);
  console.log('  修正历史:', report.correctionHistory?.length || 0);
  console.log('  审计日志:', report.auditLogSummary?.totalLogs || 0);
}

async function main() {
  console.log('========================================');
  console.log('  税务申报附件校验服务 - 功能测试');
  console.log('========================================');
  console.log('\n确保服务已启动：npm start');
  console.log('确保已初始化测试数据：npm run seed');
  
  try {
    const healthOk = await checkHealth();
    if (!healthOk) {
      console.log('\n❌ 服务未启动，请先运行：npm start');
      process.exit(1);
    }
    
    const { enterprises, periods } = await checkMasterData();
    
    if (enterprises.length === 0 || periods.length === 0) {
      console.log('\n⚠️ 测试数据不足，请先运行：npm run seed');
      process.exit(0);
    }
    
    const testEnterprise = enterprises[0].enterpriseCode;
    const testPeriod = periods.find(p => p.periodType === 'MONTHLY')?.periodCode || periods[0].periodCode;
    
    console.log('\n测试数据:');
    console.log('  企业代码:', testEnterprise);
    console.log('  申报期:', testPeriod);
    
    const attachment = await uploadTestAttachment(testEnterprise, testPeriod);
    
    const declaration = await checkDeclarationStatus(testEnterprise, testPeriod);
    
    await testManualCorrection(testEnterprise, testPeriod, attachment?.attachmentId);
    
    await testReportGeneration(testEnterprise, testPeriod);
    
    console.log('\n========================================');
    console.log('  测试完成！');
    console.log('========================================');
    console.log('\n下一步验证:');
    console.log('  1. 上传 FINANCIAL_STATEMENT 附件验证补传流程');
    console.log('  2. 创建补传任务：POST /api/tasks/create-from-declaration');
    console.log('  3. 查看完整审计日志：GET /api/audit-logs');
    console.log('  4. 查看任务统计：GET /api/tasks/statistics/summary');
    
  } catch (error) {
    console.error('\n❌ 测试出错:', error.message);
    console.error('请确保 MongoDB 和服务已正常启动');
  }
}

main();
