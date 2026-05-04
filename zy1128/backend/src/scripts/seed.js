import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import initDatabase from './init-db.js';
import {
  importProducts,
  importTransactions,
  importSubscriptions,
  importPayoutRules
} from '../services/importService.js';
import {
  calculateExpectedPayouts
} from '../services/calculationService.js';
import {
  runAutoMatching
} from '../services/matchingService.js';
import {
  generateAllocations
} from '../services/allocationService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const seedDataDir = path.join(__dirname, '../../data/seed');

const readFile = (filePath) => {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch (e) {
    console.error(`无法读取文件: ${filePath}`);
    throw e;
  }
};

const runSeed = async () => {
  console.log('========================================');
  console.log('理财收益核对台 - 种子数据加载');
  console.log('========================================');
  console.log();

  try {
    console.log('1. 初始化数据库...');
    initDatabase();
    console.log('   ✓ 数据库初始化完成');
    console.log();

    console.log('2. 导入产品数据...');
    const productsCsv = readFile(path.join(seedDataDir, 'products.csv'));
    const productsResult = importProducts(productsCsv);
    if (!productsResult.success) {
      throw new Error(`产品导入失败: ${JSON.stringify(productsResult.errors)}`);
    }
    console.log(`   ✓ 成功导入 ${productsResult.importedCount} 个产品`);
    console.log();

    console.log('3. 导入交易流水...');
    const transactionsCsv = readFile(path.join(seedDataDir, 'transactions.csv'));
    const transactionsResult = importTransactions(transactionsCsv);
    if (!transactionsResult.success) {
      throw new Error(`交易导入失败: ${JSON.stringify(transactionsResult.errors)}`);
    }
    console.log(`   ✓ 成功导入 ${transactionsResult.importedCount} 条交易记录`);
    console.log();

    console.log('4. 导入认购份额数据...');
    const subscriptionsCsv = readFile(path.join(seedDataDir, 'subscriptions.csv'));
    const subscriptionsResult = importSubscriptions(subscriptionsCsv);
    if (!subscriptionsResult.success) {
      throw new Error(`认购导入失败: ${JSON.stringify(subscriptionsResult.errors)}`);
    }
    console.log(`   ✓ 成功导入 ${subscriptionsResult.importedCount} 条认购记录`);
    console.log();

    console.log('5. 导入收益规则...');
    const payoutRulesJson = readFile(path.join(seedDataDir, 'payout-rules.json'));
    const rulesData = JSON.parse(payoutRulesJson);
    const rulesArray = Array.isArray(rulesData.rules) ? rulesData.rules : rulesData;
    const payoutRulesResult = importPayoutRules(JSON.stringify(rulesArray));
    if (!payoutRulesResult.success) {
      throw new Error(`收益规则导入失败: ${JSON.stringify(payoutRulesResult.errors)}`);
    }
    console.log(`   ✓ 成功导入 ${payoutRulesResult.importedCount} 条收益规则`);
    console.log();

    console.log('6. 计算应到账计划...');
    const payoutResult = calculateExpectedPayouts();
    console.log(`   ✓ 生成 ${payoutResult.generatedCount} 条应到账计划`);
    console.log();

    console.log('7. 自动匹配流水...');
    const matchResult = runAutoMatching({});
    console.log(`   ✓ 匹配 ${matchResult.matchedCount} 条，未匹配 ${matchResult.unmatchedCount} 条`);
    console.log();

    console.log('8. 生成分摊记录...');
    const allocationResult = generateAllocations();
    console.log(`   ✓ 生成 ${allocationResult.generatedCount} 条分摊记录`);
    console.log();

    console.log('========================================');
    console.log('种子数据加载完成！');
    console.log('========================================');
    console.log();
    console.log('统计信息:');
    console.log('  - 产品数量:', productsResult.importedCount);
    console.log('  - 交易记录:', transactionsResult.importedCount);
    console.log('  - 认购记录:', subscriptionsResult.importedCount);
    console.log('  - 应到账计划:', payoutResult.generatedCount);
    console.log('  - 匹配记录:', matchResult.matchedCount);
    console.log('  - 分摊记录:', allocationResult.generatedCount);
    console.log();
    console.log('可以启动服务器了: npm run dev');
    console.log();

  } catch (error) {
    console.error('========================================');
    console.error('种子数据加载失败');
    console.error('========================================');
    console.error(error);
    process.exit(1);
  }
};

runSeed();
