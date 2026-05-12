import { initDB, getDB } from '../src/config/database.js';
import { createCorporateAccount, useCorporateQuota } from '../src/models/CorporateAccount.js';
import { createVoucher, VOUCHER_TYPES, VOUCHER_STATUS } from '../src/models/Voucher.js';
import { createPassenger } from '../src/models/Passenger.js';

async function seed() {
  console.log('开始初始化种子数据...\n');

  await initDB();
  const db = await getDB();

  db.data.vouchers = [];
  db.data.passengers = [];
  db.data.corporateAccounts = [];
  db.data.transactions = [];
  db.data.reconciliationRecords = [];
  await db.write();

  console.log('1. 创建企业账户...');
  const companyA = await createCorporateAccount({
    name: 'A航空公司',
    totalQuota: 100,
    usedQuota: 0,
    contact: '张经理 13800138001'
  });
  console.log('   - A航空公司:', companyA.id);

  const companyB = await createCorporateAccount({
    name: 'B科技公司',
    totalQuota: 50,
    usedQuota: 0,
    contact: '李总 13900139001'
  });
  console.log('   - B科技公司:', companyB.id);

  console.log('\n2. 创建旅客...');
  const passenger1 = await createPassenger({
    name: '张三',
    idCard: '110101199001011234',
    phone: '13800138002'
  });
  console.log('   - 张三:', passenger1.id);

  const passenger2 = await createPassenger({
    name: '李四',
    idCard: '310101199002025678',
    phone: '13900139002'
  });
  console.log('   - 李四:', passenger2.id);

  console.log('\n3. 发放银行券...');
  const bankVoucher1 = await createVoucher({
    type: VOUCHER_TYPES.BANK,
    sourceId: 'BANK_ZHAOSHANG',
    amount: 1
  });
  console.log('   - 招商银行券:', bankVoucher1.code);

  const bankVoucher2 = await createVoucher({
    type: VOUCHER_TYPES.BANK,
    sourceId: 'BANK_GONGSHANG',
    amount: 1
  });
  console.log('   - 工商银行券:', bankVoucher2.code);

  console.log('\n4. 发放企业券（自动扣减额度）...');
  await useCorporateQuota(companyA.id, 1);
  const corporateVoucher1 = await createVoucher({
    type: VOUCHER_TYPES.CORPORATE,
    sourceId: 'CORP_AIRLINE_A',
    corporateId: companyA.id,
    amount: 1
  });
  console.log('   - A航空企业券:', corporateVoucher1.code);

  await useCorporateQuota(companyA.id, 1);
  const corporateVoucher2 = await createVoucher({
    type: VOUCHER_TYPES.CORPORATE,
    sourceId: 'CORP_AIRLINE_A',
    corporateId: companyA.id,
    amount: 1
  });
  console.log('   - A航空企业券:', corporateVoucher2.code);

  console.log('\n✅ 种子数据初始化完成!');
  console.log('\n数据摘要:');
  console.log('  - 企业账户:', 2, '个');
  console.log('  - 旅客:', 2, '个');
  console.log('  - 券:', 4, '张 (2张银行券 + 2张企业券)');
  console.log('\n企业额度信息:');
  console.log('  - A航空公司: 总额度 100, 已用 2, 剩余 98');
  console.log('  - B科技公司: 总额度 50, 已用 0, 剩余 50');
  console.log('\n可用券码:');
  console.log('  - 招商银行:', bankVoucher1.code);
  console.log('  - 工商银行:', bankVoucher2.code);
  console.log('  - A航空企业券 1:', corporateVoucher1.code);
  console.log('  - A航空企业券 2:', corporateVoucher2.code);
  console.log('\n提示: 运行 npm run test-flow 可以体验完整流程');
}

seed().catch(console.error);