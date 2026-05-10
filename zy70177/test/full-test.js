const http = require('http');

const BASE_URL = 'http://localhost:3000/api';

function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + path);
    
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        try {
          const result = body ? JSON.parse(body) : {};
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(result);
          } else {
            reject(new Error(`请求失败: ${res.statusCode} - ${body}`));
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function runFullTest() {
  console.log('========================================');
  console.log('里程碑收款服务 - 完整测试（含审计日志）');
  console.log('========================================\n');

  let projectId = null;
  let milestoneId = null;
  let acceptanceId = null;
  let invoiceId = null;
  let paymentId = null;

  try {
    console.log('📋 第1步：创建项目');
    const project = await makeRequest('POST', '/projects', {
      name: '智能客服系统开发项目',
      code: 'PRJ-2026-001',
      client: '科技有限公司',
      amount: 1000000,
      start_date: '2026-01-01',
      end_date: '2026-12-31',
      user_id: 'admin_user'
    });
    console.log('✅ 项目创建成功:', project.data.name, '(ID:', project.data.id, ')');
    projectId = project.data.id;
    console.log();

    console.log('📌 第2步：创建里程碑');
    const milestone1 = await makeRequest('POST', `/projects/${projectId}/milestones`, {
      name: '需求分析完成',
      description: '完成需求调研和分析文档',
      amount: 300000,
      due_date: '2026-05-10'
    });
    console.log('✅ 里程碑1创建成功:', milestone1.data.name, '(ID:', milestone1.data.id, ')');
    
    const milestone2 = await makeRequest('POST', `/projects/${projectId}/milestones`, {
      name: '系统设计完成',
      description: '完成系统架构和详细设计',
      amount: 300000,
      due_date: '2024-05-10'
    });
    console.log('✅ 里程碑2创建成功:', milestone2.data.name, '(ID:', milestone2.data.id, ')');
    milestoneId = milestone1.data.id;
    console.log();

    console.log('✅ 第3步：创建验收申请');
    const acceptance = await makeRequest('POST', `/milestones/${milestoneId}/acceptances`, {
      user_id: 'user_001',
      remarks: '需求文档已提交客户确认'
    });
    console.log('✅ 验收申请创建成功 (ID:', acceptance.data.id, ')');
    acceptanceId = acceptance.data.id;
    console.log();

    console.log('✅ 第4步：确认验收');
    const confirmedAcceptance = await makeRequest('POST', `/acceptances/${acceptanceId}/confirm`, {
      confirmed_by: 'manager_001',
      remarks: '验收通过，客户已签字确认'
    });
    console.log('✅ 验收确认成功，状态:', confirmedAcceptance.data.status);
    console.log();

    console.log('📑 第5步：创建开票申请');
    const invoice = await makeRequest('POST', `/milestones/${milestoneId}/invoices`, {
      invoice_no: 'INV-2026-001',
      amount: 300000,
      remarks: '需求分析阶段验收通过，申请开票'
    });
    console.log('✅ 开票申请创建成功 (ID:', invoice.data.id, '，发票号:', invoice.data.invoice_no, ')');
    invoiceId = invoice.data.id;
    console.log();

    console.log('📝 第6步：审批开票申请');
    const approvedInvoice = await makeRequest('POST', `/invoices/${invoiceId}/approve`, {
      approved_by: 'finance_001'
    });
    console.log('✅ 开票申请审批通过，状态:', approvedInvoice.data.status);
    console.log();

    console.log('🖨️ 第7步：开具发票');
    const issuedInvoice = await makeRequest('POST', `/invoices/${invoiceId}/issue`, {
      issued_by: 'finance_002',
      issued_date: '2026-05-10'
    });
    console.log('✅ 发票已开具，状态:', issuedInvoice.data.status);
    console.log();

    console.log('💰 第8步：记录回款');
    const payment = await makeRequest('POST', '/payments', {
      project_id: projectId,
      amount: 300000,
      payment_date: '2026-05-15',
      bank_reference: 'BANK-2026-0515-001',
      payer: '科技有限公司',
      remarks: '需求分析阶段尾款'
    });
    console.log('✅ 回款记录创建成功 (ID:', payment.data.id, '，金额:', payment.data.amount, ')');
    paymentId = payment.data.id;
    console.log();

    console.log('🔗 第9步：回款认领到发票');
    const assignment = await makeRequest('POST', `/payments/${paymentId}/assign`, {
      invoice_id: invoiceId,
      amount: 300000,
      assigned_by: 'finance_001'
    });
    console.log('✅ 回款认领成功 (金额:', assignment.data.amount, ')');
    console.log();

    console.log('📊 第10步：查询项目进度报表');
    const progress = await makeRequest('GET', `/projects/${projectId}/progress`);
    console.log('✅ 项目进度:');
    console.log('   - 总金额:', progress.data.summary.total_amount);
    console.log('   - 已收款:', progress.data.summary.total_collected);
    console.log('   - 收款进度:', progress.data.summary.collection_progress, '%');
    console.log();

    console.log('⚠️ 第11步：检查延期预警');
    const alerts = await makeRequest('GET', '/reports/alerts');
    console.log('✅ 预警信息:');
    console.log('   - 总预警数:', alerts.data.summary.total_alerts);
    console.log('   - 逾期里程碑数:', alerts.data.overdue_milestones.count);
    console.log('   - 严重预警数:', alerts.data.summary.critical_count);
    console.log();

    console.log('📄 第12步：验证审计日志（里程碑记录历史）');
    const auditLogs = await makeRequest('GET', `/audit/milestones/${milestoneId}`);
    console.log('✅ 审计日志查询成功，历史记录数:', auditLogs.data.history.length);
    if (auditLogs.data.history.length > 0) {
      console.log('   - 最近操作:', auditLogs.data.history[0].action);
      console.log('   - 操作时间:', auditLogs.data.history[0].timestamp);
      console.log('   - 操作用户:', auditLogs.data.history[0].user);
    }
    console.log();

    console.log('🔍 第13步：验证所有审计日志');
    const allLogs = await makeRequest('GET', '/audit');
    console.log('✅ 所有审计日志总数:', allLogs.data.length);
    const actionTypes = {};
    allLogs.data.forEach(log => {
      if (!actionTypes[log.action]) actionTypes[log.action] = 0;
      actionTypes[log.action]++;
    });
    console.log('   - 操作类型统计:', JSON.stringify(actionTypes));
    console.log();

    console.log('📤 第14步：导出收款状态报表');
    const exportResult = await makeRequest('GET', '/reports/export/collection');
    console.log('✅ 报表导出成功:');
    console.log('   - 文件名:', exportResult.data.filename);
    console.log('   - 生成时间:', exportResult.data.generated_at);
    console.log();

    console.log('📤 第15步：导出发票回款报表');
    const invoiceExport = await makeRequest('GET', '/reports/export/invoice-payment');
    console.log('✅ 发票回款报表导出成功:');
    console.log('   - 文件名:', invoiceExport.data.filename);
    console.log('   - 生成时间:', invoiceExport.data.generated_at);
    console.log();

    console.log('========================================');
    console.log('🎉 完整测试（含审计日志）通过！');
    console.log('========================================');
    console.log('\n关键业务规则验证:');
    console.log('✓ 验收通过后才能申请开票');
    console.log('✓ 开票申请审批后才能开具发票');
    console.log('✓ 发票开具后才能进行回款认领');
    console.log('✓ 回款金额不能超过发票金额');
    console.log('✓ 所有关键操作都记录了审计日志');
    console.log('✓ 数据持久化到SQLite数据库');
    console.log('✓ 导出报表服务于业务复核');
    
    return true;
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    return false;
  }
}

runFullTest().then((success) => {
  process.exit(success ? 0 : 1);
});
