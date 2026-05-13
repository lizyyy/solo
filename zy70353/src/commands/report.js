const bisect = require('./bisect');
const replay = require('./replay');

function report(configManager, requestSimulator, options = {}) {
  console.log('\n' + '='.repeat(80));
  console.log('配置热更新性能分析报告');
  console.log('='.repeat(80));

  const replayResults = replay(configManager, requestSimulator, { detail: 'summary' });
  
  const bisectResult = bisect(configManager, requestSimulator, {
    threshold: options.threshold || 20,
    verbose: false
  });

  console.log('\n' + '='.repeat(80));
  console.log('详细分析报告');
  console.log('='.repeat(80));

  const versions = configManager.getVersions();
  const frozenKeys = configManager.getFrozenKeys();
  
  const firstVersion = versions[0];
  const lastVersion = versions[versions.length - 1];
  
  const firstResult = replayResults[0].simulation;
  const lastResult = replayResults[replayResults.length - 1].simulation;
  
  const totalDegradation = lastResult.summary.avgLatency - firstResult.summary.avgLatency;
  const degradationPercent = (totalDegradation / firstResult.summary.avgLatency) * 100;

  console.log('\n【一、概览】');
  console.log('-'.repeat(80));
  console.log(`分析时间: ${new Date().toISOString()}`);
  console.log(`配置版本数: ${versions.length}`);
  console.log(`请求样本数: ${requestSimulator.getRequests().length}`);
  console.log(`冻结配置键: ${frozenKeys.length > 0 ? frozenKeys.join(', ') : '无'}`);
  
  console.log(`\n性能变化:`);
  console.log(`  基准平均耗时: ${firstResult.summary.avgLatency.toFixed(2)}ms`);
  console.log(`  最新平均耗时: ${lastResult.summary.avgLatency.toFixed(2)}ms`);
  console.log(`  总退化量: ${totalDegradation >= 0 ? '+' : ''}${totalDegradation.toFixed(2)}ms (${degradationPercent >= 0 ? '+' : ''}${degradationPercent.toFixed(1)}%)`);

  console.log('\n【二、性能变化时间线】');
  console.log('-'.repeat(80));
  
  let prevLatency = firstResult.summary.avgLatency;
  console.log(`\n  版本  时间          耗时      变化      说明`);
  console.log(`  ${'-'.repeat(75)}`);
  
  replayResults.forEach((r, index) => {
    const delta = index > 0 ? r.simulation.summary.avgLatency - prevLatency : 0;
    const deltaStr = index > 0 ? (delta >= 0 ? '+' : '') + delta.toFixed(1) + 'ms' : '基准';
    const changeCount = r.changes.length;
    const changeDesc = index === 0 ? '初始快照' : (changeCount > 0 ? `${changeCount}项变更` : '无变更');
    const marker = delta > 50 ? ' ⚠️  严重' : (delta > 20 ? ' ⚠  中等' : (delta < 0 ? ' ✓ 改善' : ''));
    
    console.log(`  v${String(r.versionId).padEnd(3)}  ${r.timestamp.substring(11, 19)}  ${String(r.simulation.summary.avgLatency.toFixed(1)).padStart(6)}ms  ${String(deltaStr).padStart(8)}  ${changeDesc}${marker}`);
    
    if (index > 0) prevLatency = r.simulation.summary.avgLatency;
  });

  console.log('\n【三、疑似问题变更分析】');
  console.log('-'.repeat(80));

  if (!bisectResult.success || !bisectResult.candidates || bisectResult.candidates.length === 0) {
    console.log('\n未检测到明显的性能退化点。');
    console.log('建议：');
    console.log('  1. 降低 bisect 的阈值参数重新分析');
    console.log('  2. 检查是否存在渐进式性能下降');
    console.log('  3. 验证请求样本是否具有代表性');
  } else {
    console.log(`\n检测到 ${bisectResult.candidates.length} 个疑似问题变更（按影响程度排序）:`);
    
    bisectResult.candidates.forEach((candidate, idx) => {
      console.log(`\n【候选 #${idx + 1}】`);
      console.log(`  版本: v${candidate.versionId}`);
      console.log(`  时间: ${candidate.timestamp}`);
      console.log(`  性能影响: ${candidate.latencyDelta >= 0 ? '+' : ''}${candidate.latencyDelta.toFixed(1)}ms`);
      console.log(`  置信度: ${candidate.confidence}%`);
      
      console.log(`\n  变更详情:`);
      candidate.changes.forEach((change, cIdx) => {
        const isFrozen = configManager.isKeyFrozen(change.key);
        const frozenTag = isFrozen ? ' [冻结-不可回滚]' : '';
        console.log(`    ${cIdx + 1}. ${change.key}${frozenTag}`);
        console.log(`       旧值: ${JSON.stringify(change.oldValue)}`);
        console.log(`       新值: ${JSON.stringify(change.newValue)}`);
      });

      console.log(`\n  支撑样本 (${candidate.supportingSamples.length}):`);
      if (candidate.supportingSamples.length > 0) {
        candidate.supportingSamples.forEach((s, sIdx) => {
          console.log(`    ${sIdx + 1}. 请求 ${s.requestId}: +${s.delta.toFixed(1)}ms`);
          console.log(`       命中规则: ${s.rulesHit.join(', ')}`);
        });
      } else {
        console.log(`    无`);
      }

      if (candidate.counterSamples && candidate.counterSamples.length > 0) {
        console.log(`\n  反例样本 (${candidate.counterSamples.length}):`);
        candidate.counterSamples.forEach((s, sIdx) => {
          console.log(`    ${sIdx + 1}. 请求 ${s.requestId}: ${s.delta.toFixed(1)}ms`);
          console.log(`       命中规则: ${s.rulesHit.join(', ')}`);
        });
      }
    });
  }

  console.log('\n【四、回滚建议】');
  console.log('-'.repeat(80));
  
  const rollbackRecommendations = generateRollbackRecommendations(
    configManager,
    bisectResult,
    replayResults
  );

  if (rollbackRecommendations.length === 0) {
    console.log('\n暂无回滚建议。整体性能在可接受范围内。');
  } else {
    console.log(`\n建议回滚以下变更（已排除冻结配置）:`);
    
    rollbackRecommendations.forEach((rec, idx) => {
      console.log(`\n建议 #${idx + 1}:`);
      console.log(`  版本: v${rec.versionId}`);
      console.log(`  回滚理由: ${rec.reason}`);
      console.log(`  预期收益: 减少约 ${rec.expectedGain.toFixed(1)}ms`);
      
      console.log(`\n  建议回滚的配置项:`);
      rec.changes.forEach((c, cIdx) => {
        console.log(`    ${cIdx + 1}. ${c.key}`);
        console.log(`       从: ${JSON.stringify(c.newValue)}`);
        console.log(`       回滚到: ${JSON.stringify(c.oldValue)}`);
      });

      if (rec.frozenSkipped && rec.frozenSkipped.length > 0) {
        console.log(`\n  ⚠️  以下冻结配置已排除，不会被自动回滚:`);
        rec.frozenSkipped.forEach(fk => {
          console.log(`       - ${fk}`);
        });
      }

      console.log(`\n  风险评估: ${rec.riskLevel}`);
      console.log(`  建议操作: ${rec.action}`);
    });
  }

  console.log('\n【五、排查建议】');
  console.log('-'.repeat(80));
  console.log(`
  1. 优先验证
     - 使用 bisect 定位的高置信度变更进行灰度验证
     - 回滚单个配置项而非整批变更
     - 观察支撑样本请求的性能变化

  2. 验证方法
     - 在测试环境单独应用候选变更
     - 对比回滚前后的性能指标
     - 确认反例样本是否为特殊场景

  3. 注意事项
     - 冻结配置不会被自动回滚建议覆盖
     - 同一键的多次修改需按顺序回滚
     - 考虑配置间的依赖关系
`);

  console.log('='.repeat(80) + '\n');

  return {
    overview: {
      versionCount: versions.length,
      requestCount: requestSimulator.getRequests().length,
      frozenKeys,
      baselineLatency: firstResult.summary.avgLatency,
      latestLatency: lastResult.summary.avgLatency,
      totalDegradation,
      degradationPercent
    },
    timeline: replayResults,
    candidates: bisectResult.candidates || [],
    recommendations: rollbackRecommendations
  };
}

function generateRollbackRecommendations(configManager, bisectResult, replayResults) {
  const recommendations = [];

  if (!bisectResult.success || !bisectResult.candidates) {
    return recommendations;
  }

  const candidates = bisectResult.candidates.filter(c => {
    const hasNonFrozenChanges = c.changes.some(change => !configManager.isKeyFrozen(change.key));
    return hasNonFrozenChanges && c.latencyDelta > 0;
  });

  candidates.forEach(candidate => {
    const rollbackChanges = [];
    const frozenSkipped = [];

    candidate.changes.forEach(change => {
      if (configManager.isKeyFrozen(change.key)) {
        frozenSkipped.push(change.key);
      } else {
        rollbackChanges.push(change);
      }
    });

    if (rollbackChanges.length === 0) {
      return;
    }

    const expectedGain = candidate.latencyDelta;
    const riskLevel = assessRisk(rollbackChanges, candidate);

    recommendations.push({
      versionId: candidate.versionId,
      timestamp: candidate.timestamp,
      reason: generateReason(candidate),
      expectedGain,
      changes: rollbackChanges,
      frozenSkipped,
      riskLevel,
      action: generateAction(riskLevel, rollbackChanges.length),
      confidence: candidate.confidence,
      supportingSamples: candidate.supportingSamples,
      counterSamples: candidate.counterSamples
    });
  });

  return recommendations.sort((a, b) => b.expectedGain - a.expectedGain);
}

function assessRisk(changes, candidate) {
  let risk = 0;
  
  changes.forEach(c => {
    if (c.key.includes('enabled')) {
      risk += 2;
    }
    if (c.key.includes('algorithm') || c.key.includes('strategy')) {
      risk += 3;
    }
  });

  if (candidate.counterSamples && candidate.counterSamples.length > 0) {
    risk += 1;
  }

  if (risk <= 2) return '低';
  if (risk <= 4) return '中';
  return '高';
}

function generateReason(candidate) {
  const reasons = [];
  
  if (candidate.latencyDelta > 50) {
    reasons.push('造成严重性能退化');
  } else if (candidate.latencyDelta > 20) {
    reasons.push('造成中等性能退化');
  }
  
  if (candidate.confidence >= 70) {
    reasons.push('高置信度定位');
  } else if (candidate.confidence >= 40) {
    reasons.push('中等置信度');
  }
  
  if (candidate.supportingSamples.length >= 3) {
    reasons.push(`有${candidate.supportingSamples.length}个支撑样本`);
  }

  return reasons.join('，') || '疑似性能问题';
}

function generateAction(riskLevel, changeCount) {
  if (riskLevel === '低') {
    return changeCount === 1 ? '建议直接回滚验证' : '建议逐个回滚验证';
  } else if (riskLevel === '中') {
    return '建议先在测试环境验证，再考虑灰度回滚';
  } else {
    return '高风险操作，建议充分评估后再决定，优先排查替代方案';
  }
}

module.exports = report;
