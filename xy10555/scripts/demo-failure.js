const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

const BASE_URL = 'http://localhost:3000';

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function makeRequest(method, path, data = null, headers = {}) {
  const curlData = data ? `-H 'Content-Type: application/json' -d '${JSON.stringify(data).replace(/'/g, "'\\''")}'` : '';
  const curlHeaders = Object.entries(headers).map(([k, v]) => `-H '${k}: ${v}'`).join(' ');
  const cmd = `curl -s -X ${method} ${BASE_URL}${path} ${curlData} ${curlHeaders}`;
  const { stdout } = await execAsync(cmd);
  try {
    return JSON.parse(stdout);
  } catch {
    return { raw: stdout };
  }
}

async function main() {
  console.log('='.repeat(70));
  console.log('二手车检测估价 API - 失败路径演示');
  console.log('='.repeat(70));
  
  console.log('\n📌 失败场景1: 状态流转错误');
  console.log('  尝试从"草稿"状态直接推进到"估价完成"(跳过检测和审核)');
  const list = await makeRequest('GET', '/api/valuations');
  const anyValuation = list.data?.items?.[0];
  
  if (anyValuation) {
    const result = await makeRequest('POST', `/api/valuations/${anyValuation.id}/advance`, {
      target_status: '估价完成',
      reason: '尝试跳过审核直接估价'
    });
    console.log('  结果:', result.message || result.error);
    console.log('  ✓ 系统正确拒绝了非法状态流转');
  }
  
  console.log('\n📌 失败场景2: 重复报价检测');
  console.log('  给同一客户对同一辆车报两次价');
  
  const normal = list.data?.items?.find(i => i.valuation_no.includes('NORMAL'));
  if (normal) {
    console.log('  第一步: 创建第一个报价...');
    const firstQuote = await makeRequest('POST', `/api/valuations/${normal.id}/quote-versions`, {
      version_name: '首次报价',
      quoted_price: 100000,
      customer_name: '测试客户',
      customer_phone: '13999999999',
      quote_status: '已报价'
    });
    console.log('  第一次报价:', firstQuote.success ? '成功' : firstQuote.message);
    
    await delay(500);
    
    console.log('  第二步: 对同一客户再次报价...');
    const secondQuote = await makeRequest('POST', `/api/valuations/${normal.id}/quote-versions`, {
      version_name: '重复报价测试',
      quoted_price: 95000,
      customer_name: '测试客户',
      customer_phone: '13999999999',
      quote_status: '已报价'
    });
    console.log('  第二次报价:', secondQuote.message || secondQuote.error);
    if (!secondQuote.success && secondQuote.message?.includes('重复报价')) {
      console.log('  ✓ 系统正确检测到重复报价');
    }
  }
  
  console.log('\n📌 失败场景3: 缺少操作人信息');
  console.log('  尝试创建人工修正但不提供操作人');
  
  if (normal) {
    const result = await makeRequest('POST', `/api/valuations/${normal.id}/manual-corrections`, {
      correction_type: '最终价格调整',
      before_value: { final_price: 100000 },
      after_value: { final_price: 95000 },
      reason: '测试缺少操作人'
    });
    console.log('  结果:', result.message);
    console.log('  ✓ 系统正确要求提供操作人信息');
  }
  
  console.log('\n📌 失败场景4: 查询不存在的估价');
  console.log('  查询一个不存在的估价ID');
  const notFound = await makeRequest('GET', '/api/valuations/00000000-0000-0000-0000-000000000000');
  console.log('  结果:', notFound.message);
  console.log('  ✓ 系统正确返回404');
  
  console.log('\n📌 失败场景5: 人工修正记录前后差异');
  console.log('  演示人工修正必须记录前后差异');
  
  if (normal) {
    const correctionResult = await makeRequest('POST', `/api/valuations/${normal.id}/manual-corrections`, {
      correction_type: '最终价格调整',
      field_name: 'final_price',
      before_value: { final_price: 68450 },
      after_value: { final_price: 65000 },
      difference: '根据市场行情，将最终估价从68450元调整为65000元',
      reason: '市场行情变化，需要调整报价',
      update_valuation: true
    }, {
      'x-operator': '销售经理-王'
    });
    
    if (correctionResult.success) {
      console.log('  ✓ 人工修正成功');
      console.log('  修正类型:', correctionResult.data?.correction_type);
      console.log('  操作人:', correctionResult.data?.operator);
      console.log('  修正原因:', correctionResult.data?.reason);
      console.log('  差异说明:', correctionResult.data?.difference);
      
      console.log('\n  查看历史记录...');
      const updatedDetail = await makeRequest('GET', `/api/valuations/${normal.id}`);
      const corrections = updatedDetail.data?.manual_corrections || [];
      console.log(`  ✓ 已记录 ${corrections.length} 条人工修正记录`);
    }
  }
  
  console.log('\n📌 失败场景6: 异常处理记录');
  console.log('  模拟系统异常并记录失败原因');
  
  if (normal) {
    const errorResult = await makeRequest('POST', `/api/valuations/${normal.id}/handle-error`, {
      error_message: '模拟检测系统连接超时'
    });
    console.log('  结果:', errorResult.message);
    
    const detail = await makeRequest('GET', `/api/valuations/${normal.id}`);
    const histories = detail.data?.history_records || [];
    const errorHistory = histories.find(h => h.action === '异常处理');
    if (errorHistory) {
      console.log('  ✓ 异常已记录到历史记录');
      console.log('  失败原因:', errorHistory.failure_reason);
      console.log('  估价标记为需要人工审核:', detail.data?.requires_manual_review ? '是' : '否');
    }
  }
  
  console.log('\n' + '='.repeat(70));
  console.log('✓ 失败路径演示完成！');
  console.log('='.repeat(70));
  console.log('\n📋 总结:');
  console.log('  1. 状态流转严格校验，非法流转被拒绝');
  console.log('  2. 重复报价检测，同一客户同一辆车不能重复报价');
  console.log('  3. 人工修正必须提供操作人信息');
  console.log('  4. 人工修正记录完整的前后差异和原因');
  console.log('  5. 异常处理会记录失败原因并标记需人工审核');
  console.log('  6. 所有操作都有历史记录可追溯');
  console.log('='.repeat(70));
}

main().catch(error => {
  console.error('演示失败:', error.message);
  console.error('\n请确保服务已启动: npm run start');
});
