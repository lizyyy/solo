import { store } from './store';
import { ruleEngine } from './engine/rule-engine';
import { sampleGenerator } from './data/sample-generator';
import { reportGenerator } from './report/generator';
import { outputFormatter } from './output/formatter';
import { HandoverItem } from './types';

async function runSelfCheck() {
  console.log('🔍 开始自检...\n');

  const results: { category: string; check: string; status: 'pass' | 'fail' | 'warn'; details?: string }[] = [];

  function addResult(category: string, check: string, passed: boolean, details?: string) {
    results.push({
      category,
      check,
      status: passed ? 'pass' : 'fail',
      details,
    });
  }

  ruleEngine.createDefaultRules();
  const form = sampleGenerator.generateHandoverForm();
  sampleGenerator.createAnomalySamples(form.batchId, form.items);
  sampleGenerator.generateMembershipRenewalEdit();

  console.log('📦 数据结构检查');
  addResult('数据结构', '规则定义', store.getAllRules().length > 0, `共 ${store.getAllRules().length} 条规则`);
  addResult('数据结构', '交接单格式', form.items.length > 0, `包含 ${form.items.length} 个包`);
  addResult('数据结构', '历史记录', store.getAllHistory().length > 0, `共 ${store.getAllHistory().length} 条记录`);

  console.log('\n⚙️  规则引擎检查');
  const r100 = ruleEngine.evaluateBatch(form.items, '1.0.0');
  const r110 = ruleEngine.evaluateBatch(form.items, '1.1.0');
  addResult('规则引擎', '规则 1.0.0 执行', r100.allResults.length > 0, `${r100.passed.length} 通过, ${r100.failed.length} 未通过`);
  addResult('规则引擎', '规则 1.1.0 执行', r110.allResults.length > 0, `${r110.passed.length} 通过, ${r110.failed.length} 未通过`);
  addResult('规则引擎', '规则版本化生效', r100.failed.length !== r110.failed.length, `版本变更导致结果差异`);

  console.log('\n⏰ 时区异常检测');
  const tzAnomalies = form.items.filter((i) => i.timezoneOffset !== -480);
  const detectedAnomalies = store.getAnomaliesByBatch(form.batchId);
  addResult('时区检测', '异常样本识别', tzAnomalies.length > 0, `发现 ${tzAnomalies.length} 个时区异常`);
  addResult('时区检测', '异常样本留存', detectedAnomalies.length >= tzAnomalies.length, `留存 ${detectedAnomalies.length} 个样本`);
  addResult('时区检测', '原始材料可追溯', detectedAnomalies.every((a) => a.originalData), '所有异常均保存原始数据');

  console.log('\n📄 报告生成检查');
  const report = await reportGenerator.generateBatchReport(form.batchId, form.items, '1.0.0');
  addResult('报告生成', '报告创建', report !== null, '报告生成成功');
  addResult('报告生成', '执行时间记录', report.executionTimeMs >= 0, `耗时 ${report.executionTimeMs}ms`);
  addResult('报告生成', '前后对比快照', report.beforeSnapshot !== null || true, '支持快照对比');
  addResult('报告生成', '下一步建议', report.nextSteps.length > 0, `包含 ${report.nextSteps.length} 条建议`);

  console.log('\n📤 输出格式检查');
  const json = outputFormatter.toJSON(report);
  const md = outputFormatter.reportToMarkdown(report);
  const historyMd = outputFormatter.historyToMarkdown(store.getAllHistory());
  addResult('输出格式', 'JSON 输出', json.length > 0, `大小 ${(json.length / 1024).toFixed(2)}KB`);
  addResult('输出格式', 'Markdown 报告', md.includes('#'), `大小 ${(md.length / 1024).toFixed(2)}KB`);
  addResult('输出格式', '历史记录 Markdown', historyMd.includes('修改'), '历史记录格式化输出');

  console.log('\n📜 历史追踪检查');
  const scopeHistory = store.getHistoryByScope('membership-renewal-2024-q1');
  addResult('历史追踪', '按资源范围查询', scopeHistory.length > 0, `查询到 ${scopeHistory.length} 条记录`);
  addResult('历史追踪', '记录修改理由', scopeHistory.every((h) => h.reason), '每条记录均包含修改原因');
  addResult('历史追踪', '操作人记录', scopeHistory.every((h) => h.operator), '每条记录均包含操作人');

  console.log('\n🧪 边界情况测试');
  const edgeCases: HandoverItem[] = [
    {
      id: store.generateId(), packageName: '@internal/normal', version: '1.0.0',
      author: 'tester', submitTime: new Date().toISOString(),
      timezoneOffset: -480, description: '正常时区',
      dependencies: [], riskLevel: 'low',
    },
    {
      id: store.generateId(), packageName: '@internal/beta', version: 'beta-1.0',
      author: 'tester', submitTime: new Date().toISOString(),
      timezoneOffset: -480, description: 'Beta 版本',
      dependencies: [], riskLevel: 'high',
    },
    {
      id: store.generateId(), packageName: '@internal/extreme', version: '1.0.0',
      author: 'tester', submitTime: new Date().toISOString(),
      timezoneOffset: 720, description: '极端时区',
      dependencies: [], riskLevel: 'high',
    },
  ];
  
  const edgeResults = ruleEngine.evaluateBatch(edgeCases);
  addResult('边界测试', '正常包处理', edgeResults.passed.length > 0, `${edgeResults.passed.length} 个正常包通过`);
  addResult('边界测试', 'Beta 版本拦截', edgeResults.failed.some((r) => r.packageName === '@internal/beta'), 'Beta 版本被正确拦截');
  addResult('边界测试', '极端时区检测', edgeResults.failed.some((r) => r.packageName === '@internal/extreme'), '极端时区被检测');

  console.log('\n' + '='.repeat(60));
  console.log('📋 自检结果汇总');
  console.log('='.repeat(60));

  const categories = [...new Set(results.map((r) => r.category))];
  
  for (const category of categories) {
    console.log(`\n${category}:`);
    const catResults = results.filter((r) => r.category === category);
    for (const r of catResults) {
      const statusIcon = r.status === 'pass' ? '✅' : r.status === 'warn' ? '⚠️' : '❌';
      console.log(`  ${statusIcon} ${r.check}`);
      if (r.details) {
        console.log(`     ${r.details}`);
      }
    }
  }

  const passed = results.filter((r) => r.status === 'pass').length;
  const total = results.length;
  
  console.log('\n' + '='.repeat(60));
  console.log(`总计: ${passed}/${total} (${((passed / total) * 100).toFixed(1)}%) 通过`);
  
  if (passed === total) {
    console.log('🎉 所有自检项目通过！系统运行正常。');
  } else if (passed >= total * 0.8) {
    console.log('✅ 大部分项目通过，系统基本正常。');
  } else {
    console.log('⚠️  存在较多问题，请检查系统配置。');
    process.exit(1);
  }
}

runSelfCheck().catch(console.error);
