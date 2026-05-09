import { initDatabase } from '../config/database';
import { reversalService } from '../services/reversal-service';
import { failedOperationService } from '../services/failed-operation-service';

const runRetry = async () => {
  console.log('开始重试失败操作...');
  await initDatabase();

  console.log('\n--- 检查失败冲正记录 ---');
  const failedReversals = await reversalService.getFailedReversals();
  console.log(`发现 ${failedReversals.length} 条待重试的冲正记录`);

  if (failedReversals.length > 0) {
    console.log('\n开始重试冲正记录...');
    const result = await reversalService.retryFailedReversals();
    console.log(`冲正重试结果: 成功 ${result.success} 条, 失败 ${result.failed} 条`);
  }

  console.log('\n--- 检查失败操作队列 ---');
  const pendingOperations = await failedOperationService.getPendingOperations();
  console.log(`发现 ${pendingOperations.length} 条待处理的失败操作`);

  if (pendingOperations.length > 0) {
    for (const op of pendingOperations) {
      console.log(`\n操作类型: ${op.operationType}`);
      console.log(`  重试次数: ${op.retryCount}`);
      console.log(`  下次重试: ${op.nextRetryAt}`);
      console.log(`  错误信息: ${op.errorMessage}`);
      console.log(`  原始Payload: ${op.payload}`);
    }

    console.log('\n⚠️  注意: 失败操作需要根据具体类型进行手动处理');
    console.log('   - CREATE_TRANSACTION: 检查客户余额和汇率后重试');
    console.log('   - REVERSAL: 检查原始交易状态后调用冲正API');
    console.log('\n可以使用以下命令查询:');
    console.log('  curl http://localhost:3000/api/operations');
    console.log('  curl http://localhost:3000/api/operations/pending');
  }

  const allOperations = await failedOperationService.getAllOperations(50);
  console.log(`\n历史失败操作总数: ${allOperations.length}`);

  console.log('\n✅ 失败操作重试完成');
};

runRetry()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('重试失败:', error);
    process.exit(1);
  });