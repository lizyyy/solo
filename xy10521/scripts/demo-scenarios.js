const demoService = require('../src/services/demoService');

async function runAllScenarios() {
  console.log('='.repeat(80));
  console.log('设备租赁押金系统 - 完整演示场景测试');
  console.log('='.repeat(80));
  console.log();
  
  const scenarios = [
    'normal-return',
    'overdue-fee',
    'damage-fee',
    'renew-then-return',
    'duplicate-refund',
    'overdue-and-damage',
    'damage-exceeds-deposit',
    'manual-adjust'
  ];
  
  const results = [];
  
  for (const scenarioId of scenarios) {
    console.log('─'.repeat(80));
    console.log(`运行场景: ${scenarioId}`);
    console.log('─'.repeat(80));
    
    try {
      const result = await demoService.runScenario(scenarioId);
      results.push({ scenarioId, success: true, finalState: result.finalState });
      
      console.log(`场景名称: ${result.name}`);
      console.log(`场景描述: ${result.description}`);
      console.log();
      console.log('执行步骤:');
      result.steps.forEach(step => {
        const idemNote = step.data.isIdempotent ? ' [幂等]' : '';
        console.log(`  ${step.step}. ${step.action}${idemNote}`);
      });
      console.log();
      console.log('最终状态:');
      Object.entries(result.finalState).forEach(([key, value]) => {
        console.log(`  ${key}: ${JSON.stringify(value)}`);
      });
      console.log();
      console.log('✓ 场景执行成功');
      console.log();
    } catch (error) {
      results.push({ scenarioId, success: false, error: error.message });
      console.error('✗ 场景执行失败:', error.message);
      console.error(error.stack);
      console.log();
    }
  }
  
  console.log('='.repeat(80));
  console.log('测试结果汇总');
  console.log('='.repeat(80));
  
  results.forEach(r => {
    const status = r.success ? '✓ PASS' : '✗ FAIL';
    console.log(`${status} - ${r.scenarioId}`);
    if (!r.success && r.error) {
      console.log(`    错误: ${r.error}`);
    }
  });
  
  const successCount = results.filter(r => r.success).length;
  console.log();
  console.log(`总计: ${successCount}/${results.length} 个场景成功`);
  console.log();
  
  return results;
}

runAllScenarios().catch(console.error);