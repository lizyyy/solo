#!/usr/bin/env node

const BASE_URL = 'http://localhost:3000/api/v1';

async function makeRequest(method: string, endpoint: string, data?: any) {
  const url = `${BASE_URL}${endpoint}`;
  console.log(`\n=== ${method} ${url} ===`);
  if (data) {
    console.log('请求体:', JSON.stringify(data, null, 2));
  }

  try {
    const fetch = (await import('node-fetch')).default;
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: data ? JSON.stringify(data) : undefined,
    });

    const result = await response.json();
    console.log('响应状态:', response.status);
    console.log('响应数据:', JSON.stringify(result, null, 2));
    return result;
  } catch (error) {
    console.error('请求失败:', error);
    throw error;
  }
}

async function demo() {
  console.log('=== 账单重算API演示 ===\n');

  const idempotencyKey = `demo-key-${Date.now()}`;

  console.log('1. 创建重算申请');
  const createResult = await makeRequest('POST', '/applications', {
    idempotencyKey,
    billingMonth: '2024-05',
    customerAccount: 'CUST202405001',
    customerName: '北京科技有限公司',
    reasonCategory: 'PRICE_ADJUSTMENT',
    reasonDetail: '由于2024年5月产品价格调整，客户享受新的折扣政策，需要对已出账单进行重算。原折扣10%，实际应享受15%折扣。',
    triggerSource: '财务月度对账-客户投诉',
    impactDetails: [
      {
        itemCode: 'SVC-BASIC-001',
        itemName: '云服务基础套餐',
        originalAmount: 10000.00,
        newAmount: 9500.00,
        remarks: '原折扣10%，调整为15%折扣'
      },
      {
        itemCode: 'SVC-STORAGE-002',
        itemName: '数据存储服务',
        originalAmount: 5000.00,
        newAmount: 4250.00,
        remarks: '原折扣10%，调整为15%折扣'
      },
      {
        itemCode: 'SVC-BANDWIDTH-003',
        itemName: '带宽费用',
        originalAmount: 3000.00,
        newAmount: 2550.00,
        remarks: '原折扣10%，调整为15%折扣'
      }
    ],
    createdBy: '财务-李明'
  });

  const applicationId = createResult.data.id;
  console.log('\n申请ID:', applicationId);

  console.log('\n2. 重复申请测试（幂等性验证）');
  await makeRequest('POST', '/applications', {
    idempotencyKey,
    billingMonth: '2024-05',
    customerAccount: 'CUST202405001',
    customerName: '北京科技有限公司',
    reasonCategory: 'PRICE_ADJUSTMENT',
    reasonDetail: '由于2024年5月产品价格调整，客户享受新的折扣政策',
    triggerSource: '财务月度对账',
    impactDetails: [
      {
        itemCode: 'TEST',
        itemName: '测试项',
        originalAmount: 100,
        newAmount: 90,
        remarks: '测试'
      }
    ],
    createdBy: '测试用户'
  });

  console.log('\n3. 提交审批（DRAFT -> PENDING_APPROVAL）');
  await makeRequest('PUT', `/applications/${applicationId}/status`, {
    status: 'PENDING_APPROVAL',
    approver: '李明',
    approverRole: '财务专员',
    opinion: '已核对原始账单和新价格表，数据准确，提交审批。'
  });

  console.log('\n4. 审批通过（PENDING_APPROVAL -> APPROVED）');
  await makeRequest('PUT', `/applications/${applicationId}/status`, {
    status: 'APPROVED',
    approver: '王经理',
    approverRole: '财务经理',
    opinion: '审核通过，同意重算。影响金额在合理范围内，符合公司政策。'
  });

  console.log('\n5. 开始处理（APPROVED -> PROCESSING）');
  await makeRequest('PUT', `/applications/${applicationId}/status`, {
    status: 'PROCESSING',
    approver: '系统',
    approverRole: 'SYSTEM',
    opinion: '系统开始执行重算逻辑。'
  });

  console.log('\n6. 查询审批历史');
  await makeRequest('GET', `/applications/${applicationId}/approval-history`);

  console.log('\n7. 查询快照记录');
  await makeRequest('GET', `/applications/${applicationId}/snapshots`);

  console.log('\n8. 完成重算');
  await makeRequest('POST', `/applications/${applicationId}/complete`, {
    finalConclusion: '重算已完成。原账单总金额18000元，重算后16300元，客户应退款1700元。已生成调整单ADJ-2024-05-001，将在下期账单中抵扣。'
  });

  console.log('\n9. 查询最终申请详情');
  await makeRequest('GET', `/applications/${applicationId}`);

  console.log('\n10. 导出所有申请');
  await makeRequest('GET', '/export');

  console.log('\n=== 演示完成 ===');
}

demo().catch(console.error);