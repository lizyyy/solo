import express from 'express';
import { Store } from '../data/store.js';
import { simulatorService } from '../services/simulatorService.js';

const router = express.Router();

router.get('/plans', (req, res) => {
  res.json(Store.getDrillPlans());
});

router.get('/plans/:id', (req, res) => {
  const plan = Store.getDrillPlanById(req.params.id);
  if (!plan) return res.status(404).json({ error: '演练计划不存在' });
  res.json(plan);
});

router.post('/plans', (req, res) => {
  const plan = Store.createDrillPlan(req.body);
  res.status(201).json(plan);
});

router.put('/plans/:id', (req, res) => {
  const current = Store.getCurrentDrill();
  if (current && current.status === 'running') {
    return res.status(409).json({ error: '演练进行中，禁止修改计划' });
  }
  const plan = Store.updateDrillPlan(req.params.id, req.body);
  if (!plan) return res.status(404).json({ error: '演练计划不存在' });
  res.json(plan);
});

router.get('/current', (req, res) => {
  res.json(Store.getCurrentDrill());
});

router.post('/start/:planId', async (req, res) => {
  try {
    const result = await simulatorService.executeDrill(req.params.planId);
    res.json(result);
  } catch (error) {
    res.status(409).json({ error: error.message });
  }
});

router.post('/recovery/:resultId', async (req, res) => {
  try {
    const result = await simulatorService.runRecovery(req.params.resultId);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/results', (req, res) => {
  res.json(Store.getDrillResults());
});

router.get('/results/:id', (req, res) => {
  const result = Store.getDrillResultById(req.params.id);
  if (!result) return res.status(404).json({ error: '演练结果不存在' });
  res.json(result);
});

router.get('/results/:id/export', (req, res) => {
  const result = Store.getDrillResultById(req.params.id);
  if (!result) return res.status(404).json({ error: '演练结果不存在' });

  const report = generateReport(result);
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="drill-report-${result.id.substring(0, 8)}.txt"`
  );
  res.send(report);
});

function generateReport(result) {
  const lines = [];
  lines.push('='.repeat(60));
  lines.push('服务降级演练复盘报告');
  lines.push('='.repeat(60));
  lines.push('');
  lines.push(`演练名称: ${result.planName}`);
  lines.push(`演练 ID: ${result.id}`);
  lines.push(`开始时间: ${result.startedAt}`);
  lines.push(`结束时间: ${result.completedAt}`);
  lines.push(`演练状态: ${result.status}`);
  lines.push('');
  lines.push('-'.repeat(60));
  lines.push('一、故障注入配置');
  lines.push('-'.repeat(60));

  if (result.summary?.faultInjections?.length) {
    result.summary.faultInjections.forEach((f, i) => {
      lines.push(`  ${i + 1}. 服务: ${f.service}`);
      lines.push(`     故障类型: ${f.fault}`);
    });
  } else {
    lines.push('  无故障注入');
  }

  lines.push('');
  lines.push('-'.repeat(60));
  lines.push('二、基线测试 (无故障)');
  lines.push('-'.repeat(60));
  if (result.baselineResult) {
    lines.push(`  请求成功: ${result.baselineResult.success}`);
    lines.push(`  用户可见结果: ${result.baselineResult.userVisibleResult}`);
    lines.push(`  命中规则: ${result.baselineResult.matchedRules?.length || 0} 条`);
  }

  lines.push('');
  lines.push('-'.repeat(60));
  lines.push('三、故障注入测试');
  lines.push('-'.repeat(60));
  if (result.degradedResult) {
    lines.push(`  请求成功: ${result.degradedResult.success}`);
    lines.push(`  请求被阻断: ${result.degradedResult.blocked}`);
    lines.push(`  用户可见影响: ${result.degradedResult.userVisibleResult}`);
    lines.push(`  命中降级规则:`);
    result.degradedResult.matchedRules?.forEach((r) => {
      lines.push(`    - ${r.name}`);
    });
  }

  lines.push('');
  lines.push('-'.repeat(60));
  lines.push('四、请求调用链路');
  lines.push('-'.repeat(60));
  result.degradedResult?.trace?.forEach((t) => {
    lines.push(`  [${t.timestamp.split('T')[1].split('.')[0]}] ${t.serviceId}: ${t.event}`);
    if (t.data && Object.keys(t.data).length) {
      const dataStr = JSON.stringify(t.data).substring(0, 80);
      lines.push(`      -> ${dataStr}`);
    }
  });

  lines.push('');
  lines.push('-'.repeat(60));
  lines.push('五、基线 vs 故障 对比差异');
  lines.push('-'.repeat(60));
  if (result.comparison?.hasDifferences) {
    result.comparison.differences.forEach((d, i) => {
      lines.push(`  ${i + 1}. ${d.field}`);
      lines.push(`     基线: ${JSON.stringify(d.baseline)}`);
      lines.push(`     故障: ${JSON.stringify(d.test)}`);
      lines.push(`     影响: ${d.impact}`);
    });
  } else {
    lines.push('  无差异');
  }

  if (result.recoveryResult) {
    lines.push('');
    lines.push('-'.repeat(60));
    lines.push('六、恢复后复测结果');
    lines.push('-'.repeat(60));
    lines.push(`  复测时间: ${result.recoveryRunAt}`);
    lines.push(`  复测通过: ${result.recoveryPassed ? '是' : '否'}`);
    if (result.recoveryComparison?.hasDifferences) {
      lines.push(`  恢复后与基线仍有差异:`);
      result.recoveryComparison.differences.forEach((d) => {
        lines.push(`    - ${d.field}: ${d.impact}`);
      });
    } else {
      lines.push('  恢复后与基线一致');
    }
  }

  lines.push('');
  lines.push('='.repeat(60));
  lines.push('报告生成时间: ' + new Date().toISOString());
  lines.push('='.repeat(60));

  return lines.join('\n');
}

export default router;
