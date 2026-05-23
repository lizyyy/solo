import * as http from 'http';
import {
  generateOrders,
  generateCleaningMessages,
  generateMaintenanceNotes,
  generateApprovalEmails,
  generateSupplierStatement
} from './seed-data';

const API_BASE = 'http://localhost:3000';

function postRequest(path: string, data: any, operator: string = 'test_script'): Promise<any> {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_BASE);
    const postData = JSON.stringify(data);

    const options: http.RequestOptions = {
      hostname: url.hostname,
      port: parseInt(url.port) || 3000,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'X-Operator': operator
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch {
          resolve(body);
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

function getRequest(path: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_BASE);

    const options: http.RequestOptions = {
      hostname: url.hostname,
      port: parseInt(url.port) || 3000,
      path: url.pathname + url.search,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch {
          resolve(body);
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('=== 民宿保洁排班验收回放链路 - API测试脚本 ===\n');

  console.log('⏳ 等待服务启动...');
  await delay(2000);

  try {
    const health = await getRequest('/api/health');
    console.log('✅ 服务健康检查:', health.status);
  } catch (e) {
    console.log('❌ 服务未启动，请先运行: npm run dev');
    console.log('  或者在另一个终端启动服务后再运行此脚本');
    process.exit(1);
  }

  console.log('\n=== 步骤1: 接入订单日历 ===');
  const orders = generateOrders();
  for (const order of orders) {
    const result = await postRequest('/api/ingest/order', order);
    const status = result.validation?.isValid ? '✅' : '⚠️';
    console.log(`  ${status} ${order.orderId}: factId=${result.factId}, dirtyTypes=${result.validation?.dirtyTypes?.join(',') || 'none'}`);
    await delay(100);
  }

  console.log('\n=== 步骤2: 接入保洁群消息 ===');
  const cleanings = generateCleaningMessages();
  for (const cleaning of cleanings) {
    const result = await postRequest('/api/ingest/cleaning', cleaning);
    const status = result.validation?.isValid ? '✅' : '⚠️';
    console.log(`  ${status} ${cleaning.messageId}: factId=${result.factId}, dirtyTypes=${result.validation?.dirtyTypes?.join(',') || 'none'}`);
    await delay(100);
  }

  console.log('\n=== 步骤3: 接入维修备注 ===');
  const maintenances = generateMaintenanceNotes();
  for (const maint of maintenances) {
    const result = await postRequest('/api/ingest/maintenance', maint);
    const status = result.validation?.isValid ? '✅' : '⚠️';
    console.log(`  ${status} ${maint.noteId}: factId=${result.factId}, dirtyTypes=${result.validation?.dirtyTypes?.join(',') || 'none'}`);
    await delay(100);
  }

  console.log('\n=== 步骤4: 接入审批邮件 ===');
  const approvals = generateApprovalEmails();
  for (const approval of approvals) {
    const result = await postRequest('/api/ingest/approval', approval);
    const status = result.validation?.isValid ? '✅' : '⚠️';
    console.log(`  ${status} ${approval.emailId}: factId=${result.factId}, dirtyTypes=${result.validation?.dirtyTypes?.join(',') || 'none'}`);
    await delay(100);
  }

  console.log('\n=== 步骤5: 查询脏记录 ===');
  const dirtyRecords = await getRequest('/api/dirty-records');
  console.log(`  发现 ${dirtyRecords.count} 条脏记录:`);
  for (const dirty of dirtyRecords.data.slice(0, 5)) {
    console.log(`    - [${dirty.dirtyType}] ${dirty.description}`);
  }
  if (dirtyRecords.count > 5) {
    console.log(`    ... 还有 ${dirtyRecords.count - 5} 条`);
  }

  console.log('\n=== 步骤6: 查询事实记录汇总 ===');
  const facts = await getRequest('/api/facts?startDate=2024-01-10&endDate=2024-01-14');
  console.log(`  共 ${facts.count} 条事实记录:`);
  for (const fact of facts.data) {
    const hasOrder = fact.orderInfo ? '📋' : '  ';
    const hasCleaning = fact.cleaningInfo ? '🧹' : '  ';
    const hasMaint = (fact.maintenanceInfo?.length || 0) > 0 ? '🔧' : '  ';
    const hasApproval = (fact.approvalInfo?.length || 0) > 0 ? '📧' : '  ';
    console.log(`    ${fact.date} 房间${fact.roomId} ${hasOrder}${hasCleaning}${hasMaint}${hasApproval} ${fact.reconciliationStatus}`);
  }

  console.log('\n=== 步骤7: 接入供应商对账单（对账阶段） ===');
  const statement = generateSupplierStatement();
  const stmtResult = await postRequest('/api/ingest/statement', statement);
  console.log(`  ${statement.statementId}: 验证${stmtResult.validation?.isValid ? '通过' : '发现问题'}`);
  if (stmtResult.validation?.issues?.length > 0) {
    console.log(`  发现 ${stmtResult.validation.issues.length} 个问题:`);
    for (const issue of stmtResult.validation.issues) {
      console.log(`    - [${issue.dirtyType}] ${issue.description}`);
    }
  }

  console.log('\n=== 步骤8: 执行对账 ===');
  const reconcileResult = await postRequest('/api/reconcile', {
    startDate: '2024-01-10',
    endDate: '2024-01-14'
  });
  console.log(reconcileResult.summary);

  console.log('\n=== 步骤9: 查看单条事实详情（含审计日志） ===');
  const sampleFact = facts.data[0];
  if (sampleFact) {
    const factDetail = await getRequest(`/api/facts/${sampleFact.factId}`);
    console.log(`  事实ID: ${factDetail.data.factId}`);
    console.log(`  审计日志: ${factDetail.auditLogs.length} 条`);
    for (const log of factDetail.auditLogs.slice(0, 3)) {
      console.log(`    - ${log.timestamp.slice(11, 19)} ${log.action} by ${log.operator}`);
    }
  }

  console.log('\n=== 步骤10: 测试幂等性 - 重复提交相同订单 ===');
  const dupOrder = orders[0];
  const dupResult = await postRequest('/api/ingest/order', dupOrder);
  console.log(`  重复提交 ${dupOrder.orderId}: isNew=${dupResult.isNew} (预期: false)`);
  console.log(`  ${dupResult.isNew === false ? '✅ 幂等性验证通过 - 重复请求更新同一条记录' : '❌ 幂等性验证失败'}`);

  console.log('\n=== 测试完成 ===');
  console.log('\n📊 后续操作建议:');
  console.log('  npm run export        # 导出数据报表');
  console.log('  npm run replay        # 回放异常修复');
  console.log('  npm run reconcile     # 重新执行对账');
  console.log('\n🔍 API接口调试:');
  console.log('  curl http://localhost:3000/api/facts?startDate=2024-01-10\\&endDate=2024-01-14');
  console.log('  curl http://localhost:3000/api/dirty-records');
}

main().catch(console.error);
