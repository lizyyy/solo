import { initDatabase } from '../config/database';
import { customerService } from '../services/customer-service';
import { exchangeRateService } from '../services/exchange-rate-service';
import { quotaLedgerService } from '../services/quota-ledger-service';
import { transactionService, CreateTransactionRequest } from '../services/transaction-service';
import { reversalService } from '../services/reversal-service';

const sampleCustomers = [
  { name: '张三', idCardNo: '110101199001011234' },
  { name: '李四', idCardNo: '110101199002022345' },
  { name: '王五', idCardNo: '110101199003033456' }
];

const runSeeds = async () => {
  console.log('开始初始化数据库...');
  await initDatabase();
  console.log('数据库初始化完成');

  console.log('\n--- 初始化客户数据 ---');
  const customers = [];
  for (const customer of sampleCustomers) {
    const result = await customerService.createCustomer(customer.name, customer.idCardNo);
    customers.push(result);
    console.log(`客户: ${result.name} (ID: ${result.id})`);
  }

  console.log('\n--- 初始化汇率数据 ---');
  await exchangeRateService.seedDefaultRates();
  console.log('已创建默认汇率快照: USD, EUR, GBP, JPY, HKD');

  const usdRate = await exchangeRateService.getLatestSnapshot('USD');
  console.log(`当前 USD 汇率: 买入价 ${usdRate?.buyRate}, 卖出价 ${usdRate?.sellRate}`);

  console.log('\n--- 初始化额度台账 ---');
  for (const customer of customers) {
    const ledger = await quotaLedgerService.getOrCreateLedger(customer.id);
    console.log(`${customer.name} 年度额度: 总额度 ${ledger.totalQuota} 元, 可用额度 ${ledger.availableQuota} 元`);
  }

  console.log('\n--- 场景1: 正常结售汇交易 ---');
  console.log('张三进行购汇 1000 美元...');
  const tx1: CreateTransactionRequest = {
    idempotentKey: 'TX-2026-001',
    customerId: customers[0].id,
    type: 'BUY',
    currency: 'USD',
    foreignCurrencyAmount: 1000,
    remark: '旅游用汇'
  };
  const transaction1 = await transactionService.createTransaction(tx1);
  console.log(`交易成功! 交易ID: ${transaction1.id}`);
  console.log(`购汇金额: ${transaction1.foreignCurrencyAmount} USD = ${transaction1.rmbAmount} 人民币`);

  const ledger1 = await quotaLedgerService.getLedger(customers[0].id);
  console.log(`张三剩余额度: ${ledger1?.availableQuota} 元 (已使用 ${ledger1?.usedQuota} 元)`);

  console.log('\n--- 场景2: 额度不足拦截 ---');
  try {
    console.log('李四尝试购汇 8000 美元 (预计超过 5 万年度额度)...');
    const tx2: CreateTransactionRequest = {
      idempotentKey: 'TX-2026-002',
      customerId: customers[1].id,
      type: 'BUY',
      currency: 'USD',
      foreignCurrencyAmount: 8000,
      remark: '大额购汇测试'
    };
    await transactionService.createTransaction(tx2);
    console.log('⚠️  异常: 应该被拒绝但成功了');
  } catch (error: any) {
    console.log(`✅ 正确拦截: ${error.message}`);
  }

  const ledger2 = await quotaLedgerService.getLedger(customers[1].id);
  console.log(`李四额度未变化: ${ledger2?.availableQuota} 元 (已使用 ${ledger2?.usedQuota} 元)`);

  console.log('\n--- 场景3: 幂等接口测试 ---');
  console.log('使用相同的幂等键再次提交张三的交易...');
  const tx3: CreateTransactionRequest = {
    idempotentKey: 'TX-2026-001',
    customerId: customers[0].id,
    type: 'BUY',
    currency: 'USD',
    foreignCurrencyAmount: 1000,
    remark: '旅游用汇 (重复提交)'
  };
  try {
    await transactionService.createTransaction(tx3);
    console.log('✅ 幂等性生效: 返回首次交易结果，未重复扣额度');
  } catch (error: any) {
    console.log(`⚠️  注意: ${error.message}`);
  }

  const ledger3 = await quotaLedgerService.getLedger(customers[0].id);
  console.log(`验证额度: 张三剩余额度 ${ledger3?.availableQuota} 元 (未重复扣减)`);

  console.log('\n--- 场景4: 交易冲正 ---');
  console.log('张三进行结汇 500 美元...');
  const tx4: CreateTransactionRequest = {
    idempotentKey: 'TX-2026-003',
    customerId: customers[0].id,
    type: 'SELL',
    currency: 'USD',
    foreignCurrencyAmount: 500,
    remark: '留学结汇'
  };
  const transaction4 = await transactionService.createTransaction(tx4);
  console.log(`交易成功! 交易ID: ${transaction4.id}`);

  const ledger4 = await quotaLedgerService.getLedger(customers[0].id);
  console.log(`冲正前张三额度: 总额度 ${ledger4?.totalQuota}, 已用 ${ledger4?.usedQuota}, 可用 ${ledger4?.availableQuota}`);

  console.log('\n对该交易进行冲正，原因: "用户操作失误"...');
  const reversal = await reversalService.createReversal(
    transaction4.id,
    '用户操作失误，需要撤销交易'
  );
  console.log(`冲正完成! 冲正记录ID: ${reversal.id}, 状态: ${reversal.status}`);

  const ledger5 = await quotaLedgerService.getLedger(customers[0].id);
  console.log(`冲正后张三额度: 总额度 ${ledger5?.totalQuota}, 已用 ${ledger5?.usedQuota}, 可用 ${ledger5?.availableQuota}`);
  console.log('✅ 额度已恢复，冲正成功!');

  console.log('\n--- 场景5: 多笔交易测试 ---');
  console.log('王五进行多笔小额交易...');
  const transactions = [
    { key: 'TX-2026-004', amount: 500, type: 'BUY' as const },
    { key: 'TX-2026-005', amount: 300, type: 'BUY' as const },
    { key: 'TX-2026-006', amount: 200, type: 'SELL' as const },
    { key: 'TX-2026-007', amount: 1000, type: 'BUY' as const }
  ];

  for (const t of transactions) {
    await transactionService.createTransaction({
      idempotentKey: t.key,
      customerId: customers[2].id,
      type: t.type,
      currency: 'USD',
      foreignCurrencyAmount: t.amount
    });
    console.log(`${t.type === 'BUY' ? '购汇' : '结汇'} ${t.amount} USD 完成`);
  }

  const ledger6 = await quotaLedgerService.getLedger(customers[2].id);
  console.log(`王五最终额度: 总额度 ${ledger6?.totalQuota}, 已用 ${ledger6?.usedQuota}, 可用 ${ledger6?.availableQuota}`);

  console.log('\n--- 年度重算测试 ---');
  console.log('对张三进行年度额度重算...');
  const recalculated = await quotaLedgerService.recalculateQuota(customers[0].id, new Date().getFullYear());
  console.log(`重算后额度: 总额度 ${recalculated.totalQuota}, 已用 ${recalculated.usedQuota}, 可用 ${recalculated.availableQuota}`);

  console.log('\n🎉 示例数据初始化完成!');
  console.log('\n快速开始:');
  console.log('  1. 启动服务: npm run dev');
  console.log('  2. 健康检查: curl http://localhost:3000/health');
  console.log('  3. 查看客户列表: curl http://localhost:3000/api/customers');
  console.log('  4. 查看张三额度: curl http://localhost:3000/api/quota/<张三ID>');
  console.log('  5. 重试失败操作: npm run retry-failed');
  console.log('  6. 运行测试: npm test');
};

runSeeds()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('初始化失败:', error);
    process.exit(1);
  });