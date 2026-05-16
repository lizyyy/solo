const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const dbPath = path.join(__dirname, '../data/api_budget_freeze.db');
const db = new sqlite3.Database(dbPath);

async function initSampleData() {
  return new Promise((resolve, reject) => {
    db.serialize(async () => {
      try {
        const accountId1 = uuidv4();
        const accountId2 = uuidv4();
        const accountId3 = uuidv4();

        db.run(`
          INSERT OR REPLACE INTO customer_accounts
          (account_id, customer_name, email, phone, total_budget, used_budget, status, created_at)
          VALUES
          (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `, [
          accountId1, '阿里巴巴集团', 'contact@alibaba.com', '400-800-1688', 10000, 3500, 'active'
        ]);

        db.run(`
          INSERT OR REPLACE INTO customer_accounts
          (account_id, customer_name, email, phone, total_budget, used_budget, status, created_at)
          VALUES
          (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `, [
          accountId2, '腾讯科技', 'support@tencent.com', '400-910-9100', 8000, 4200, 'active'
        ]);

        db.run(`
          INSERT OR REPLACE INTO customer_accounts
          (account_id, customer_name, email, phone, total_budget, used_budget, status, created_at)
          VALUES
          (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `, [
          accountId3, '字节跳动', 'business@bytedance.com', '400-601-0915', 15000, 7800, 'active'
        ]);

        const groupId1 = uuidv4();
        const groupId2 = uuidv4();
        const groupId3 = uuidv4();
        const groupId4 = uuidv4();

        db.run(`
          INSERT OR REPLACE INTO api_groups
          (group_id, account_id, group_name, description, budget_limit, used_budget, created_at)
          VALUES
          (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP),
          (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP),
          (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP),
          (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `, [
          groupId1, accountId1, '电商API', '电商平台核心接口', 5000, 2000,
          groupId2, accountId1, '数据分析API', '大数据分析接口', 3000, 1500,
          groupId3, accountId2, '社交API', '社交平台接口', 4000, 2500,
          groupId4, accountId3, '内容推荐API', '智能推荐接口', 6000, 3200
        ]);

        const freezeId1 = uuidv4();
        const freezeId2 = uuidv4();
        const freezeId3 = uuidv4();

        db.run(`
          INSERT OR REPLACE INTO budget_freezes
          (freeze_id, account_id, group_id, freeze_amount, freeze_reason, freeze_category,
           complaint_id, operator_id, operator_name, status, original_request, processing_basis,
           created_at, updated_at)
          VALUES
          (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
          (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
          (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `, [
          freezeId1, accountId1, groupId1, 1500,
          '客户投诉2024年1月1日至1月15日期间API调用量异常激增，实际账单与预估相差300%',
          'customer_complaint', 'COMP-2024-0115-001',
          'CS-001', '张小凡', 'confirmed',
          JSON.stringify({
            complaintSource: '电话客服',
            customerContact: '张经理 13800138000',
            complaintTime: '2024-01-16 09:30:00',
            expectedUsage: 500,
            actualUsage: 1500
          }),
          JSON.stringify({
            initialCheck: '调用日志已核查，确实存在异常调用',
            relatedTickets: ['TICKET-2024-0116-001'],
            priority: 'high'
          }),
          freezeId2, accountId2, groupId3, 800,
          '系统检测到凌晨2-4点时段出现异常大量调用，疑似API密钥泄露',
          'suspicious_activity', null,
          'SYS-001', '系统监控', 'in_investigation',
          JSON.stringify({
            detectionTime: '2024-01-16 04:05:00',
            abnormalPeriod: '2024-01-16 02:00-04:00',
            callCount: 2500,
            averageCount: 150
          }),
          JSON.stringify({
            securityCheck: '进行中',
            ipAnalysis: '12个异常IP地址',
            estimatedLoss: 800
          }),
          freezeId3, accountId3, null, 2000,
          '客户反馈账单费用超出预算，要求临时冻结部分预算进行核查',
          'budget_exceeded', 'COMP-2024-0115-002',
          'CS-002', '李碧瑶', 'pending_review',
          JSON.stringify({
            budgetLimit: 15000,
            currentUsage: 7800,
            expectedUsage: 6000,
            overBudget: 1800
          }),
          null
        ]);

        const operationId1 = uuidv4();
        const operationId2 = uuidv4();
        const operationId3 = uuidv4();
        const operationId4 = uuidv4();

        db.run(`
          INSERT OR REPLACE INTO freeze_operations
          (operation_id, freeze_id, operation_type, from_status, to_status,
           operator_id, operator_name, remarks, created_at)
          VALUES
          (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP),
          (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP),
          (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP),
          (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `, [
          operationId1, freezeId1, 'create', null, 'pending_review',
          'CS-001', '张小凡', '客服接收到客户投诉，创建冻结记录',
          operationId2, freezeId1, 'status_transition', 'pending_review', 'confirmed',
          'CS-MGR-001', '王主管', '客服主管审核通过，确认冻结并开始调查',
          operationId3, freezeId2, 'create', null, 'pending_review',
          'SYS-001', '系统监控', '系统自动检测到异常调用，创建冻结记录',
          operationId4, freezeId2, 'status_transition', 'pending_review', 'in_investigation',
          'SEC-001', '安全团队', '安全团队介入调查疑似API密钥泄露事件'
        ]);

        const approvalId1 = uuidv4();

        db.run(`
          INSERT OR REPLACE INTO thaw_approvals
          (approval_id, freeze_id, applicant_id, applicant_name, thaw_reason,
           proposed_amount, approver_id, approver_name, approval_remarks, status, created_at)
          VALUES
          (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `, [
          approvalId1, freezeId1, 'FIN-001', '财务专员',
          '经核查，异常调用为客户系统BUG导致，客户已修复问题，申请全额解冻',
          1500, null, null, null, 'pending'
        ]);

        const today = new Date().toISOString().split('T')[0];
        const reportId1 = uuidv4();
        const reportId2 = uuidv4();

        db.run(`
          INSERT OR REPLACE INTO usage_reports
          (report_id, account_id, group_id, report_date, total_calls, total_cost,
           frozen_amount, available_budget, created_at)
          VALUES
          (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP),
          (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `, [
          reportId1, accountId1, groupId1, today, 15000, 3500, 1500, 5000,
          reportId2, accountId2, groupId3, today, 8500, 4200, 800, 3000
        ]);

        console.log('样例数据初始化完成!');
        console.log('客户账户:');
        console.log(`  阿里巴巴集团: ${accountId1}`);
        console.log(`  腾讯科技: ${accountId2}`);
        console.log(`  字节跳动: ${accountId3}`);
        console.log('');
        console.log('API分组:');
        console.log(`  电商API: ${groupId1}`);
        console.log(`  数据分析API: ${groupId2}`);
        console.log(`  社交API: ${groupId3}`);
        console.log(`  内容推荐API: ${groupId4}`);
        console.log('');
        console.log('冻结记录:');
        console.log(`  客户投诉冻结: ${freezeId1}`);
        console.log(`  疑似泄露冻结: ${freezeId2}`);
        console.log(`  预算超支冻结: ${freezeId3}`);

        resolve();
      } catch (error) {
        reject(error);
      }
    });
  });
}

db.run('PRAGMA foreign_keys = ON', async (err) => {
  if (err) {
    console.error('启用外键约束失败:', err);
    process.exit(1);
  }

  try {
    await initSampleData();
  } catch (error) {
    console.error('初始化样例数据失败:', error);
    process.exit(1);
  } finally {
    db.close();
  }
});
