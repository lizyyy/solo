const http = require('http');

function makeRequest(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ statusCode: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ statusCode: res.statusCode, data: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

const baseOptions = {
  hostname: 'localhost',
  port: 3000,
  headers: { 'Content-Type': 'application/json' }
};

async function testAll() {
  console.log('=== Testing Data Repair Ticket Service ===\n');

  console.log('1. Health Check...');
  const health = await makeRequest({ ...baseOptions, method: 'GET', path: '/api/health' });
  console.log('   Status:', health.statusCode, health.data.status === 'ok' ? '✓ PASS' : '✗ FAIL');

  console.log('\n2. Create Repair Request...');
  const createBody = {
    title: '修复用户订单状态异常',
    description: '由于系统BUG，部分订单状态显示为异常',
    business_type: 'order',
    applicant_id: 'user_001',
    applicant_name: '张三',
    department: '技术部',
    urgency: 'high',
    risk_level: 'medium',
    sql_contents: [{
      sql_text: "UPDATE orders SET status = 'completed' WHERE status = 'abnormal'",
      sql_type: 'UPDATE',
      target_table: 'orders',
      target_database: 'prod_main'
    }],
    impact_estimation: {
      estimated_rows: 500,
      affected_tables: 'orders',
      backup_strategy: '执行前全量备份orders表',
      rollback_plan: '使用UPDATE语句回滚',
      risk_assessment: '中等风险'
    }
  };
  const create = await makeRequest({ ...baseOptions, method: 'POST', path: '/api/requests' }, createBody);
  console.log('   Status:', create.statusCode, create.statusCode === 201 ? '✓ PASS' : '✗ FAIL');
  const requestId = create.data.id;
  const ticketNo = create.data.ticket_no;
  console.log('   Ticket No:', ticketNo);

  console.log('\n3. Submit for Review...');
  const submit = await makeRequest({ 
    ...baseOptions, 
    method: 'POST', 
    path: `/api/requests/${requestId}/submit-review` 
  }, { operator_id: 'user_001', operator_name: '张三' });
  console.log('   Status:', submit.statusCode, submit.data.current_status === 'pending_review' ? '✓ PASS' : '✗ FAIL');

  console.log('\n4. Approve Review...');
  const review = await makeRequest({ 
    ...baseOptions, 
    method: 'POST', 
    path: `/api/reviews/${requestId}` 
  }, { 
    reviewer_id: 'reviewer_001', 
    reviewer_name: '李四',
    review_result: 'approved',
    review_comments: 'SQL逻辑正确，可以执行',
    sql_suggestions: '建议添加LIMIT限制'
  });
  console.log('   Status:', review.statusCode, review.data.request.current_status === 'review_approved' ? '✓ PASS' : '✗ FAIL');

  console.log('\n5. Start Execution...');
  const startExec = await makeRequest({ 
    ...baseOptions, 
    method: 'POST', 
    path: `/api/executions/${requestId}/start` 
  }, { executor_id: 'exec_001', executor_name: '王五' });
  console.log('   Status:', startExec.statusCode, startExec.data.request.current_status === 'executing' ? '✓ PASS' : '✗ FAIL');

  console.log('\n6. Complete Execution (Success)...');
  const completeExec = await makeRequest({ 
    ...baseOptions, 
    method: 'POST', 
    path: `/api/executions/${requestId}/complete` 
  }, { 
    executor_id: 'exec_001', 
    executor_name: '王五',
    execution_status: 'success',
    affected_rows: 487,
    execution_log: 'SQL executed successfully',
    rollback_sql: "UPDATE orders SET status = 'abnormal' WHERE status = 'completed' AND created_at > '2024-01-01'"
  });
  console.log('   Status:', completeExec.statusCode, completeExec.data.request.current_status === 'execution_success' ? '✓ PASS' : '✗ FAIL');
  console.log('   Affected rows:', completeExec.data.execution.affected_rows);

  console.log('\n7. Generate Audit Report...');
  const audit = await makeRequest({ 
    ...baseOptions, 
    method: 'POST', 
    path: `/api/audit/${requestId}` 
  }, { generated_by: 'audit_system' });
  console.log('   Status:', audit.statusCode, audit.statusCode === 201 ? '✓ PASS' : '✗ FAIL');
  console.log('   Report ID:', audit.data.id);
  console.log('   Has manual corrections:', audit.data.report_summary.has_manual_corrections);

  console.log('\n8. Manual Status Correction (Test feature)...');
  const manual = await makeRequest({ 
    ...baseOptions, 
    method: 'POST', 
    path: `/api/requests/${requestId}/manual-status` 
  }, { 
    new_status: 'closed',
    operator_id: 'admin_001',
    operator_name: '系统管理员',
    reason: '测试人工修正功能 - 特殊情况处理'
  });
  console.log('   Status:', manual.statusCode, manual.statusCode === 200 ? '✓ PASS' : '✗ FAIL');

  console.log('\n9. Get Status Statistics...');
  const stats = await makeRequest({ ...baseOptions, method: 'GET', path: '/api/statistics/status' });
  console.log('   Status:', stats.statusCode, stats.statusCode === 200 ? '✓ PASS' : '✗ FAIL');
  console.log('   Total requests:', stats.data.total);

  console.log('\n10. Export Requests (JSON)...');
  const exportJson = await makeRequest({ ...baseOptions, method: 'GET', path: '/api/exports/requests?include_details=true' });
  console.log('   Status:', exportJson.statusCode, exportJson.statusCode === 200 ? '✓ PASS' : '✗ FAIL');
  console.log('   Exported count:', exportJson.data.total);

  console.log('\n11. Export Statistics...');
  const exportStats = await makeRequest({ ...baseOptions, method: 'GET', path: '/api/exports/statistics' });
  console.log('   Status:', exportStats.statusCode, exportStats.statusCode === 200 ? '✓ PASS' : '✗ FAIL');
  console.log('   Manual corrections:', exportStats.data.overview.manual_corrections);

  console.log('\n=== Test Summary ===');
  console.log('Ticket created:', ticketNo);
  console.log('Full request ID:', requestId);
  console.log('Audit report ID:', audit.data.id);
  console.log('\nDatabase file is persisted at: data/app.db');
  console.log('Restart server will retain all history.');
}

testAll().catch(console.error);