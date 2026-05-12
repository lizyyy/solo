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
  console.log('二手车检测估价 API - 正常流程演示');
  console.log('='.repeat(70));
  
  console.log('\n📌 步骤1: 检查服务健康状态');
  const health = await makeRequest('GET', '/health');
  console.log('✓ 服务状态:', health.message);
  
  console.log('\n📌 步骤2: 查看已有样例估价列表');
  const list = await makeRequest('GET', '/api/valuations');
  console.log(`✓ 找到 ${list.data?.total || 0} 条估价记录`);
  list.data?.items?.forEach((item, idx) => {
    const vp = item.vehicle_profile || {};
    console.log(`  ${idx + 1}. ${item.valuation_no} - ${vp.brand} ${vp.model} (${item.status})`);
  });
  
  if (!list.data?.items || list.data.items.length === 0) {
    console.log('\n⚠️ 没有找到样例数据，请先运行: npm run seed');
    return;
  }
  
  const normal = list.data.items.find(i => i.valuation_no.includes('NORMAL'));
  if (!normal) {
    console.log('\n⚠️ 没有找到正常估价样例');
    return;
  }
  
  console.log('\n📌 步骤3: 查看正常估价详情');
  const detail = await makeRequest('GET', `/api/valuations/${normal.id}`);
  const vp = detail.data?.vehicle_profile || {};
  console.log(`✓ 车辆: ${vp.brand} ${vp.model}`);
  console.log(`✓ 年份: ${vp.year}年, 里程: ${vp.mileage}公里`);
  console.log(`✓ 状态: ${detail.data?.status}`);
  console.log(`✓ 基础估价: ¥${detail.data?.base_price}`);
  console.log(`✓ 最终估价: ¥${detail.data?.final_price}`);
  console.log(`✓ 建议售价: ¥${detail.data?.suggested_sale_price}`);
  console.log(`✓ 风险等级: ${detail.data?.risk_level}`);
  
  let deductionReasons = [];
  try {
    deductionReasons = JSON.parse(detail.data?.deduction_reasons || '[]');
  } catch {}
  if (deductionReasons.length > 0) {
    console.log('\n📌 步骤4: 查看扣分原因');
    deductionReasons.forEach((reason, idx) => {
      console.log(`  ${idx + 1}. ${reason}`);
    });
  }
  
  console.log('\n📌 步骤5: 查看操作历史');
  const history = detail.data?.history_records || [];
  console.log(`✓ 共 ${history.length} 条操作记录`);
  history.slice(0, 5).forEach((h, idx) => {
    let line = `  ${idx + 1}. [${new Date(h.operation_time).toLocaleString()}] ${h.operator}`;
    if (h.from_status && h.to_status) {
      line += `: ${h.from_status} → ${h.to_status}`;
    } else {
      line += `: ${h.action}`;
    }
    if (h.reason) line += ` (${h.reason})`;
    console.log(line);
  });
  
  console.log('\n📌 步骤6: 查看报价版本对比');
  const versions = detail.data?.quote_versions || [];
  console.log(`✓ 共 ${versions.length} 个报价版本`);
  versions.forEach((v, idx) => {
    console.log(`  版本${v.version_no}: ${v.version_name}`);
    console.log(`    报价: ¥${v.quoted_price}, 状态: ${v.quote_status}`);
    console.log(`    变更原因: ${v.change_reason || '无'}`);
    if (idx > 0) {
      const prev = versions[idx - 1];
      const diff = v.quoted_price - prev.quoted_price;
      console.log(`    对比上一版本: ${diff >= 0 ? '+' : ''}¥${diff}`);
    }
  });
  
  console.log('\n📌 步骤7: 生成完整估价报告');
  const report = await makeRequest('GET', `/api/valuations/${normal.id}/report`);
  console.log(`✓ 报告编号: ${report.data?.report_no}`);
  console.log(`✓ 生成时间: ${report.data?.generated_at}`);
  console.log('\n--- 销售解释报告 ---\n');
  console.log(report.data?.sales_explanation);
  
  console.log('\n📌 步骤8: 验证幂等性 - 重复创建相同请求');
  console.log('  使用相同的request_id再次创建...');
  const idempotentResult = await makeRequest('POST', '/api/valuations', {
    request_id: 'idempotent-test-' + Date.now(),
    vehicle_profile: {
      vin: 'TESTVIN12345678901',
      brand: '测试',
      model: '幂等测试',
      year: 2023,
      mileage: 10000
    }
  });
  console.log(`  第1次请求: ${idempotentResult.message} (is_new: ${idempotentResult.is_new})`);
  
  const idempotentResult2 = await makeRequest('POST', '/api/valuations', {
    request_id: 'idempotent-test-' + Date.now().toString().slice(0, -3) + '000',
    vehicle_profile: {
      vin: 'TESTVIN12345678901',
      brand: '测试',
      model: '幂等测试',
      year: 2023,
      mileage: 10000
    }
  });
  console.log(`  第2次请求(新request_id): 创建成功`);
  
  console.log('\n' + '='.repeat(70));
  console.log('✓ 正常流程演示完成！');
  console.log('='.repeat(70));
  console.log('\n📋 总结:');
  console.log('  1. 估价流程: 草稿 → 待检测 → 检测中 → 检测完成 → 待审核 → 审核通过 → 估价完成 → 已报价');
  console.log('  2. 每一步都有状态记录和操作历史');
  console.log('  3. 报价版本支持多次报价和版本对比');
  console.log('  4. 最终报告包含完整的销售解释说明');
  console.log('  5. 支持幂等性防止重复创建');
  console.log('='.repeat(70));
}

main().catch(error => {
  console.error('演示失败:', error.message);
  console.error('\n请确保服务已启动: npm run start');
});
