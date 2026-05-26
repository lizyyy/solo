const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const testDataDir = path.join(__dirname, '..', 'test-data');
const baseUrl = 'http://localhost:3000';

function curlUpload(endpoint, filePath) {
  const absPath = path.resolve(filePath);
  const cmd = `curl -s -X POST -F "file=@${absPath}" ${baseUrl}${endpoint}`;
  console.log(`\n>>> 执行: ${cmd}`);
  try {
    const result = execSync(cmd, { encoding: 'utf8' });
    return JSON.parse(result);
  } catch (e) {
    console.error('请求失败:', e.message);
    return null;
  }
}

function curlGet(endpoint) {
  const cmd = `curl -s ${baseUrl}${endpoint}`;
  console.log(`\n>>> 执行: ${cmd}`);
  try {
    const result = execSync(cmd, { encoding: 'utf8' });
    return JSON.parse(result);
  } catch (e) {
    console.error('请求失败:', e.message);
    return null;
  }
}

async function runTests() {
  console.log('='.repeat(60));
  console.log('设备租赁客服系统 - 本地测试脚本');
  console.log('='.repeat(60));

  const health = curlGet('/api/health');
  if (!health || health.status !== 'ok') {
    console.error('❌ 服务未启动，请先运行: npm start');
    process.exit(1);
  }
  console.log('✅ 服务健康检查通过');

  console.log('\n' + '-'.repeat(60));
  console.log('步骤1: 导入押金规则');
  const rulesResult = curlUpload('/api/import/rules', path.join(testDataDir, 'deposit_rules.json'));
  if (rulesResult) {
    console.log(`✅ 规则导入完成: ${rulesResult.success_count}成功, ${rulesResult.pending_count}待确认, ${rulesResult.failed_count}失败`);
    if (rulesResult.isDuplicate) {
      console.log('   ⚠️  检测到重复文件，返回上次结果');
    }
  }

  console.log('\n' + '-'.repeat(60));
  console.log('步骤2: 导入租赁订单CSV');
  const rentalResult = curlUpload('/api/import/rental', path.join(testDataDir, 'rental_orders.csv'));
  if (rentalResult) {
    console.log(`✅ 订单导入完成: ${rentalResult.success_count}成功, ${rentalResult.pending_count}待确认, ${rentalResult.failed_count}失败`);
    if (rentalResult.isDuplicate) {
      console.log('   ⚠️  检测到重复文件，返回上次结果');
    }
  }

  console.log('\n' + '-'.repeat(60));
  console.log('步骤3: 导入维修记录JSON');
  const repairResult = curlUpload('/api/import/repair', path.join(testDataDir, 'repair_records.json'));
  if (repairResult) {
    console.log(`✅ 维修记录导入完成: ${repairResult.success_count}成功, ${repairResult.pending_count}待确认, ${repairResult.failed_count}失败`);
    if (repairResult.isDuplicate) {
      console.log('   ⚠️  检测到重复文件，返回上次结果');
    }
  }

  console.log('\n' + '-'.repeat(60));
  console.log('步骤4: 验证重复导入幂等性');
  const duplicateResult = curlUpload('/api/import/rental', path.join(testDataDir, 'rental_orders.csv'));
  if (duplicateResult && duplicateResult.isDuplicate) {
    console.log('✅ 幂等性验证通过：同一文件再次提交不重复生效');
  } else {
    console.log('❌ 幂等性验证失败');
  }

  console.log('\n' + '-'.repeat(60));
  console.log('步骤5: 查询押金流水追踪（以 ORD2024001 为例）');
  const traceResult = curlGet('/api/deposit/trace/ORD2024001');
  if (traceResult) {
    console.log(`✅ 流水追踪成功，共 ${traceResult.transactions?.length || 0} 条记录`);
    console.log(`   订单: ${traceResult.order_no}, 客户: ${traceResult.customer_name}`);
    console.log(`   押金总额: ${traceResult.total_deposit}, 已用: ${traceResult.usedAmount}, 余额: ${traceResult.balance}`);
    if (traceResult.transactions) {
      traceResult.transactions.forEach(t => {
        console.log(`   - [${t.type_desc}] ${t.amount}元, 原因: ${t.reason}`);
        console.log(`     来源: ${t.source_type}/${t.source_id}, 规则: ${t.rule_name || '-'}`);
      });
    }
  }

  console.log('\n' + '-'.repeat(60));
  console.log('步骤6: 查看所有批次');
  const batches = curlGet('/api/batches');
  if (batches) {
    console.log(`✅ 共 ${batches.length} 个导入批次`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('测试完成！');
  console.log('='.repeat(60));
  console.log('\n常用查询接口:');
  console.log('  GET /api/rental/orders?customer=张三  - 查询客户订单');
  console.log('  GET /api/repair/records?device=DEV001 - 查询设备维修');
  console.log('  GET /api/deposit/balance/ORD2024001  - 查询押金余额');
  console.log('  GET /api/deposit/trace/ORD2024001    - 押金流水追踪');
  console.log('  GET /api/rules                        - 查看所有规则');
}

runTests().catch(console.error);
