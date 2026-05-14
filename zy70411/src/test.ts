import { store } from './store';
import { ruleEngine } from './engine/rule-engine';
import { sampleGenerator } from './data/sample-generator';
import { reportGenerator } from './report/generator';
import { outputFormatter } from './output/formatter';
import { HandoverItem } from './types';

async function runTests() {
  console.log('🧪 开始运行测试...\n');

  let passed = 0;
  let failed = 0;

  function test(name: string, fn: () => boolean) {
    try {
      const result = fn();
      if (result) {
        console.log(`✅ ${name}`);
        passed++;
      } else {
        console.log(`❌ ${name}`);
        failed++;
      }
    } catch (error) {
      console.log(`❌ ${name} - ${error}`);
      failed++;
    }
  }

  ruleEngine.createDefaultRules();
  test('创建默认规则', () => store.getAllRules().length > 0);

  const form = sampleGenerator.generateHandoverForm();
  test('生成交接单', () => form !== null && form.items.length > 0);

  test('包含正常记录和异常记录', () => {
    const normalCount = form.items.filter((i) => i.timezoneOffset === -480).length;
    const anomalyCount = form.items.filter((i) => i.timezoneOffset !== -480).length;
    return normalCount > 0 && anomalyCount > 0;
  });

  const anomalies = sampleGenerator.createAnomalySamples(form.batchId, form.items);
  test('创建异常样本', () => anomalies.length > 0);

  sampleGenerator.generateMembershipRenewalEdit();
  test('生成会员续费修改记录', () => store.getAllHistory().length > 0);

  const result100 = ruleEngine.evaluateBatch(form.items, '1.0.0');
  test('使用规则 1.0.0 校验', () => result100.allResults.length > 0);

  const result110 = ruleEngine.evaluateBatch(form.items, '1.1.0');
  test('使用规则 1.1.0 校验', () => result110.allResults.length > 0);

  test('规则变更影响校验结果', () => {
    return result100.failed.length !== result110.failed.length;
  });

  const report = await reportGenerator.generateBatchReport(form.batchId, form.items, '1.0.0');
  test('生成报告', () => report !== null);

  test('报告包含执行时间', () => report.executionTimeMs >= 0);

  test('报告包含下一步建议', () => report.nextSteps.length > 0);

  const jsonOutput = outputFormatter.toJSON(report);
  test('JSON 输出', () => jsonOutput.length > 0 && jsonOutput.includes('batchId'));

  const markdownOutput = outputFormatter.reportToMarkdown(report);
  test('Markdown 输出', () => markdownOutput.length > 0 && markdownOutput.includes('#'));

  const comparison = reportGenerator.compareRuleVersions(form.items, '1.0.0', '1.1.0');
  test('规则版本对比', () => comparison.differences.length >= 0);

  const history = store.getHistoryByScope('membership-renewal-2024-q1');
  test('按资源范围查询历史记录', () => history.length > 0);

  test('历史记录包含修改理由', () => {
    return history.every((h) => h.reason && h.reason.length > 0);
  });

  const firstAnomaly = store.getAllAnomalies()[0];
  test('异常样本保存原始材料', () => {
    return firstAnomaly && firstAnomaly.originalData !== null;
  });

  test('边界情况：空依赖列表', () => {
    const item: HandoverItem = {
      id: store.generateId(),
      packageName: '@test/empty-deps',
      version: '1.0.0',
      author: 'tester',
      submitTime: new Date().toISOString(),
      timezoneOffset: -480,
      description: '空依赖测试',
      dependencies: [],
      riskLevel: 'low',
    };
    const results = ruleEngine.evaluateItem(item, store.getActiveRules());
    return results.length > 0;
  });

  test('边界情况：极端时区偏移', () => {
    const item: HandoverItem = {
      id: store.generateId(),
      packageName: '@test/extreme-tz',
      version: '1.0.0',
      author: 'tester',
      submitTime: new Date().toISOString(),
      timezoneOffset: 9999,
      description: '极端时区测试',
      dependencies: [],
      riskLevel: 'high',
    };
    const results = ruleEngine.evaluateItem(item, store.getActiveRules());
    return results.some((r) => !r.passed);
  });

  test('边界情况：alpha 版本前缀', () => {
    const item: HandoverItem = {
      id: store.generateId(),
      packageName: '@test/alpha-pkg',
      version: 'alpha-2.0',
      author: 'tester',
      submitTime: new Date().toISOString(),
      timezoneOffset: -480,
      description: 'Alpha 版本测试',
      dependencies: [],
      riskLevel: 'high',
    };
    const results = ruleEngine.evaluateItem(item, store.getActiveRules());
    return results.some((r) => !r.passed);
  });

  test('边界情况：大量依赖', () => {
    const deps = Array.from({ length: 20 }, (_, i) => ({
      name: `dep-${i}`,
      version: '1.0.0',
    }));
    const item: HandoverItem = {
      id: store.generateId(),
      packageName: '@test/many-deps',
      version: '1.0.0',
      author: 'tester',
      submitTime: new Date().toISOString(),
      timezoneOffset: -480,
      description: '大量依赖测试',
      dependencies: deps,
      riskLevel: 'medium',
    };
    const results = ruleEngine.evaluateItem(item, store.getActiveRules());
    return results.length > 0;
  });

  console.log('\n📊 测试结果:');
  console.log(`通过: ${passed}`);
  console.log(`失败: ${failed}`);
  console.log(`总计: ${passed + failed}`);

  if (failed === 0) {
    console.log('\n🎉 所有测试通过！');
  } else {
    console.log('\n⚠️ 部分测试失败，请检查代码。');
    process.exit(1);
  }
}

runTests().catch(console.error);
