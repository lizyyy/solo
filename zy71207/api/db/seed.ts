import { db } from './init';

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

export function seedDemoData(): void {
  const existing = db.prepare('SELECT COUNT(*) as count FROM product_contract').get() as { count: number };
  if (existing.count > 0) {
    console.log('Demo data already exists, skipping seed.');
    return;
  }

  const now = new Date().toISOString();

  const contractXId = generateId('contract');
  const contractYv1Id = generateId('contract');
  const contractYv2Id = generateId('contract');

  db.prepare(`
    INSERT INTO product_contract (id, product_id, product_name, version, effective_date, expire_date, base_rate, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(contractXId, 'PROD_X', '稳健增值计划X', 'v2', '2024-01-01', null, 0.015, now);

  db.prepare(`
    INSERT INTO product_contract (id, product_id, product_name, version, effective_date, expire_date, base_rate, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(contractYv1Id, 'PROD_Y', '量化对冲基金Y', 'v1', '2023-06-01', '2024-03-31', 0.008, now);

  db.prepare(`
    INSERT INTO product_contract (id, product_id, product_name, version, effective_date, expire_date, base_rate, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(contractYv2Id, 'PROD_Y', '量化对冲基金Y', 'v2', '2024-04-01', null, 0.012, now);

  const shareAId = generateId('share');
  const shareBId = generateId('share');

  db.prepare(`
    INSERT INTO customer_share (id, customer_id, customer_name, product_id, share_amount, purchase_date, contract_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(shareAId, 'CUST_001', '张伟（客户A）', 'PROD_X', 1000000.00, '2024-01-15', contractXId);

  db.prepare(`
    INSERT INTO customer_share (id, customer_id, customer_name, product_id, share_amount, purchase_date, contract_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(shareBId, 'CUST_002', '李娜（客户B）', 'PROD_Y', 2000000.00, '2023-10-20', contractYv1Id);

  const rateXv2Id = generateId('rate');
  const rateYv1Id = generateId('rate');
  const rateYv2Id = generateId('rate');

  db.prepare(`
    INSERT INTO rate_version (id, product_id, version, effective_date, management_fee_rate, service_fee_rate, description)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(rateXv2Id, 'PROD_X', 'v2', '2024-01-01', 0.01, 0.005, '2024年费率调整：管理费1.0%，服务费0.5%');

  db.prepare(`
    INSERT INTO rate_version (id, product_id, version, effective_date, management_fee_rate, service_fee_rate, description)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(rateYv1Id, 'PROD_Y', 'v1', '2023-06-01', 0.005, 0.003, '老合同费率：管理费0.5%，服务费0.3%');

  db.prepare(`
    INSERT INTO rate_version (id, product_id, version, effective_date, management_fee_rate, service_fee_rate, description)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(rateYv2Id, 'PROD_Y', 'v2', '2024-04-01', 0.008, 0.004, '2024年Q2费率上调：管理费0.8%，服务费0.4%');

  const promoBId = generateId('promo');

  db.prepare(`
    INSERT INTO promotion_period (id, product_id, customer_id, name, start_date, end_date, discount_rate, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(promoBId, 'PROD_Y', 'CUST_002', '老客户续期优惠（跨月）', '2024-03-15', '2024-04-15', 0.8, 'expired');

  const chargeAId = generateId('charge');
  const chargeBId = generateId('charge');

  const shareAmountA = 1000000.00;
  const correctRateA = 0.015;
  const correctAmountA = shareAmountA * correctRateA;

  db.prepare(`
    INSERT INTO charge_record (id, customer_id, product_id, charge_date, share_amount, applied_rate, charged_amount, rate_version_id, promotion_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(chargeAId, 'CUST_001', 'PROD_X', '2024-04-01', shareAmountA, correctRateA, correctAmountA, rateXv2Id, null);

  const shareAmountB = 2000000.00;
  const correctRateB = 0.008 * 0.8;
  const correctAmountB = shareAmountB * correctRateB;

  const wrongRateB = 0.012;
  const wrongAmountB = shareAmountB * wrongRateB;

  db.prepare(`
    INSERT INTO charge_record (id, customer_id, product_id, charge_date, share_amount, applied_rate, charged_amount, rate_version_id, promotion_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(chargeBId, 'CUST_002', 'PROD_Y', '2024-04-01', shareAmountB, wrongRateB, wrongAmountB, rateYv2Id, null);

  const auditAId = generateId('audit');
  const auditBId = generateId('audit');

  const reasonsA: string[] = ['合同版本匹配正确', '费率版本生效时间匹配', '无优惠期', '扣费金额与重算一致'];
  const reasonsB: string[] = [
    '老合同v1有效期至2024-03-31，扣费日期2024-04-01，应适用合同续签规则，但实际误套用新费率v2',
    '优惠期2024-03-15至2024-04-15，扣费日期在优惠期内，应享受8折优惠，但未享受',
    '优惠期跨月计算逻辑错误：4月整月未识别为优惠期',
    '费率版本匹配错误：2024-04-01虽在v2生效期，但客户持有的是老合同v1，享有合同期内费率保护条款',
    `实际扣费：¥${wrongAmountB.toFixed(2)}，应扣：¥${correctAmountB.toFixed(2)}，多扣：¥${(wrongAmountB - correctAmountB).toFixed(2)}`
  ];

  db.prepare(`
    INSERT INTO audit_record (id, customer_id, customer_name, product_id, product_name, share_id, contract_id, rate_version_id, promotion_id, charge_id, status, expected_amount, actual_amount, diff_amount, reasons, audit_time, resolved_time, rollback_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    auditAId,
    'CUST_001',
    '张伟（客户A）',
    'PROD_X',
    '稳健增值计划X',
    shareAId,
    contractXId,
    rateXv2Id,
    null,
    chargeAId,
    'normal',
    correctAmountA,
    correctAmountA,
    0,
    JSON.stringify(reasonsA),
    now,
    null,
    null
  );

  db.prepare(`
    INSERT INTO audit_record (id, customer_id, customer_name, product_id, product_name, share_id, contract_id, rate_version_id, promotion_id, charge_id, status, expected_amount, actual_amount, diff_amount, reasons, audit_time, resolved_time, rollback_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    auditBId,
    'CUST_002',
    '李娜（客户B）',
    'PROD_Y',
    '量化对冲基金Y',
    shareBId,
    contractYv1Id,
    rateYv1Id,
    promoBId,
    chargeBId,
    'abnormal',
    correctAmountB,
    wrongAmountB,
    wrongAmountB - correctAmountB,
    JSON.stringify(reasonsB),
    now,
    null,
    null
  );

  console.log('Demo data seeded successfully.');
  console.log('  Scenario 1 (Normal): Customer A - Product X - Audit Passed');
  console.log('  Scenario 2 (Abnormal): Customer B - Product Y - Cross-month promotion + wrong rate version');
}
