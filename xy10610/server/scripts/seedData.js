const { v4: uuidv4 } = require('uuid');
const { runQuery, getQuery, initDatabase } = require('../db/database');

async function createPackage(trackingNumber, status = 'pending') {
  const packageId = uuidv4();
  await runQuery(
    `INSERT INTO packages (id, tracking_number, sender_name, sender_country, receiver_name, receiver_address, weight, declared_value, currency, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [
      packageId,
      trackingNumber,
      'Zhang Wei',
      'China',
      'John Smith',
      '123 Main St, New York, NY 10001',
      2.5,
      150.00,
      'USD',
      status
    ]
  );

  await runQuery(
    `INSERT INTO declaration_items (id, package_id, hs_code, product_name, quantity, unit_price, total_value, category)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [uuidv4(), packageId, '851712', 'Smart Phone', 1, 150.00, 150.00, 'electronics']
  );

  return packageId;
}

async function createSuccessPath() {
  console.log('创建演示路径1: 清关成功');
  
  const packageId = await createPackage('DEMO-SUCCESS-001');
  
  await runQuery(
    `INSERT INTO tax_calculations (id, package_id, customs_duty, value_added_tax, consumption_tax, total_tax, calculation_rules, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'calculated', CURRENT_TIMESTAMP)`,
    [uuidv4(), packageId, 15.00, 21.45, 0, 36.45, JSON.stringify({ dutyRate: 0.1, vatRate: 0.13 })]
  );

  await runQuery(
    `INSERT INTO customs_callbacks (id, package_id, callback_type, status, message, customs_reference, callback_data, created_at)
     VALUES (?, ?, 'clearance_success', 'success', '清关完成，税费已缴纳', 'CUST-REF-001', ?, CURRENT_TIMESTAMP)`,
    [uuidv4(), packageId, JSON.stringify({ clearance_date: new Date().toISOString() })]
  );

  await runQuery(
    'UPDATE packages SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    ['cleared', packageId]
  );

  await runQuery(
    `INSERT INTO operation_logs (id, package_id, operation_type, operator, details, created_at)
     VALUES (?, ?, 'demo_seed', 'system', ?, CURRENT_TIMESTAMP)`,
    [uuidv4(), packageId, JSON.stringify({ path: 'success', description: '清关成功演示路径' })]
  );

  console.log('  清关成功路径创建完成');
  return packageId;
}

async function createBlockedPath() {
  console.log('创建演示路径2: 清关拦截（需要补资料）');
  
  const packageId = await createPackage('DEMO-BLOCKED-001');

  await runQuery(
    `INSERT INTO customs_callbacks (id, package_id, callback_type, status, message, customs_reference, callback_data, created_at)
     VALUES (?, ?, 'document_required', 'blocked', '需要补充商业发票和原产地证明', 'CUST-REF-002', ?, CURRENT_TIMESTAMP)`,
    [uuidv4(), packageId, JSON.stringify({ 
      required_docs: ['商业发票', '原产地证明', '装箱单'],
      failure_reason: 'INCOMPLETE_DOCUMENTS'
    })]
  );

  const ticketId = uuidv4();
  await runQuery(
    `INSERT INTO supplement_tickets (id, package_id, ticket_number, required_documents, current_owner, status, priority, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'open', 'high', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [
      ticketId, 
      packageId, 
      'TKT-DEMO-001', 
      JSON.stringify(['商业发票', '原产地证明', '装箱单']),
      'agent_chen'
    ]
  );

  await runQuery(
    'UPDATE packages SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    ['supplement_required', packageId]
  );

  await runQuery(
    `INSERT INTO operation_logs (id, package_id, operation_type, operator, details, created_at)
     VALUES (?, ?, 'demo_seed', 'system', ?, CURRENT_TIMESTAMP)`,
    [uuidv4(), packageId, JSON.stringify({ path: 'blocked', description: '清关拦截演示路径', ticket_id: ticketId })]
  );

  console.log('  清关拦截路径创建完成');
  return packageId;
}

async function createManualCorrectionPath() {
  console.log('创建演示路径3: 人工修正（退单重提）');
  
  const packageId = await createPackage('DEMO-CORRECT-001');

  await runQuery(
    `INSERT INTO customs_callbacks (id, package_id, callback_type, status, message, customs_reference, callback_data, created_at)
     VALUES (?, ?, 'returned', 'failed', '商品归类错误，需要重新申报', 'CUST-REF-003', ?, CURRENT_TIMESTAMP)`,
    [uuidv4(), packageId, JSON.stringify({ 
      failure_reason: 'MISCLASSIFICATION',
      suggested_hs_code: '852580'
    })]
  );

  const resubmitId = uuidv4();
  await runQuery(
    `INSERT INTO re_submissions (id, package_id, original_tracking_number, reason, review_status, notes, created_at)
     VALUES (?, ?, ?, ?, 'pending', ?, CURRENT_TIMESTAMP)`,
    [
      resubmitId,
      packageId,
      'DEMO-CORRECT-001',
      '商品归类错误，已重新确认HS CODE为852580',
      '等待审核人员审核重提申请'
    ]
  );

  await runQuery(
    'UPDATE packages SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    ['returned', packageId]
  );

  await runQuery(
    `INSERT INTO operation_logs (id, package_id, operation_type, operator, details, created_at)
     VALUES (?, ?, 'classification_correction', 'agent_wang', ?, CURRENT_TIMESTAMP)`,
    [uuidv4(), packageId, JSON.stringify({ old_hs_code: '851712', new_hs_code: '852580', reason: '商品归类修正' })]
  );

  await runQuery(
    `INSERT INTO operation_logs (id, package_id, operation_type, operator, details, created_at)
     VALUES (?, ?, 'demo_seed', 'system', ?, CURRENT_TIMESTAMP)`,
    [uuidv4(), packageId, JSON.stringify({ path: 'manual_correction', description: '人工修正演示路径', resubmit_id: resubmitId })]
  );

  console.log('  人工修正路径创建完成');
  return packageId;
}

async function createDuplicateSubmissionPath() {
  console.log('创建演示路径4: 重复提交（幂等性演示）');
  
  const packageId = await createPackage('DEMO-DUPLICATE-001', 'cleared');

  const idempotencyKey = 'DEMO-IDEMPOTENT-KEY-12345';
  await runQuery(
    `INSERT INTO idempotency_keys (id, idempotency_key, request_hash, response_data, created_at)
     VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
    [
      uuidv4(),
      idempotencyKey,
      'hash_' + Math.random().toString(36).substring(7),
      JSON.stringify({ 
        status: 'success', 
        message: '包裹已创建',
        package_id: packageId,
        cached: true
      })
    ]
  );

  for (let i = 1; i <= 3; i++) {
    await runQuery(
      `INSERT INTO operation_logs (id, package_id, operation_type, operator, details, created_at)
       VALUES (?, ?, 'submission_attempt', 'api_client', ?, CURRENT_TIMESTAMP)`,
      [
        uuidv4(), 
        packageId, 
        JSON.stringify({ 
          attempt: i, 
          idempotency_key: idempotencyKey,
          result: i === 1 ? 'created' : 'duplicate_detected'
        })
      ]
    );
  }

  await runQuery(
    `INSERT INTO operation_logs (id, package_id, operation_type, operator, details, created_at)
     VALUES (?, ?, 'demo_seed', 'system', ?, CURRENT_TIMESTAMP)`,
    [uuidv4(), packageId, JSON.stringify({ 
      path: 'duplicate_submission', 
      description: '重复提交演示路径',
      idempotency_key: idempotencyKey
    })]
  );

  console.log('  重复提交路径创建完成');
  return packageId;
}

async function createServiceTemplates() {
  console.log('创建客服话术模板');
  
  const templates = [
    {
      name: '文档缺失通知',
      scenario: 'document_missing',
      content: '尊敬的客户，您的包裹{trackingNumber}清关时发现缺少{documents}文件，请尽快提供以便我们继续处理。'
    },
    {
      name: '税费通知',
      scenario: 'tax_notification',
      content: '尊敬的客户，您的包裹{trackingNumber}税费计算完成，共计{totalTax}美元，请及时缴纳以便快速清关。'
    },
    {
      name: '清关成功通知',
      scenario: 'clearance_success',
      content: '尊敬的客户，恭喜！您的包裹{trackingNumber}已成功清关，即将安排派送。'
    },
    {
      name: '退单重提指引',
      scenario: 'resubmit_guide',
      content: '尊敬的客户，您的包裹{trackingNumber}因{reason}被退单，请核对信息后重新提交申报。'
    }
  ];

  for (const tpl of templates) {
    await runQuery(
      `INSERT INTO service_templates (id, template_name, scenario, content, language, is_active)
       VALUES (?, ?, ?, ?, 'zh-CN', 1)`,
      [uuidv4(), tpl.name, tpl.scenario, tpl.content]
    );
  }

  console.log('  客服话术模板创建完成');
}

async function main() {
  try {
    await initDatabase();
    console.log('开始生成演示数据...\n');

    await createServiceTemplates();
    console.log('');
    
    const successId = await createSuccessPath();
    const blockedId = await createBlockedPath();
    const correctionId = await createManualCorrectionPath();
    const duplicateId = await createDuplicateSubmissionPath();

    console.log('\n演示数据生成完成！');
    console.log('\n演示包信息:');
    console.log('  清关成功: DEMO-SUCCESS-001');
    console.log('  清关拦截: DEMO-BLOCKED-001');
    console.log('  人工修正: DEMO-CORRECT-001');
    console.log('  重复提交: DEMO-DUPLICATE-001');
    console.log('\n请启动服务器后访问前端查看演示数据。');
    
    process.exit(0);
  } catch (error) {
    console.error('生成演示数据失败:', error);
    process.exit(1);
  }
}

main();
