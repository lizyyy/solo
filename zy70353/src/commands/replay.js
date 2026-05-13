function replay(configManager, requestSimulator, options = {}) {
  const versions = configManager.getVersions();
  const detailLevel = options.detail || 'summary';
  
  console.log('\n' + '='.repeat(80));
  console.log('配置版本重放分析');
  console.log('='.repeat(80));
  
  const results = [];

  versions.forEach((version) => {
    const simulation = requestSimulator.simulateAllRequests(version.config);
    results.push({
      versionId: version.id,
      timestamp: version.timestamp,
      changes: version.changes,
      isSnapshot: version.isSnapshot,
      simulation
    });

    if (detailLevel === 'full') {
      console.log(`\n${'-'.repeat(80)}`);
      console.log(`版本 ${version.id} - ${version.timestamp}`);
      console.log(`${'-'.repeat(80)}`);
      
      if (version.changes.length > 0) {
        console.log('变更:');
        version.changes.forEach(c => 
          console.log(`  ${c.key}: ${JSON.stringify(c.oldValue)} → ${JSON.stringify(c.newValue)}`)
        );
      }
      
      console.log(`\n请求摘要:`);
      console.log(`  总计: ${simulation.summary.total}`);
      console.log(`  适用: ${simulation.summary.applicable}`);
      console.log(`  不适用: ${simulation.summary.notApplicable}`);
      console.log(`  平均耗时: ${simulation.summary.avgLatency.toFixed(2)}ms`);
      console.log(`  总耗时: ${simulation.summary.totalLatency.toFixed(2)}ms`);

      console.log('\n详细结果:');
      simulation.results.forEach(r => {
        if (r.applicable) {
          console.log(`  请求 ${r.requestId}: ${r.latency.toFixed(2)}ms`);
          console.log(`    命中规则: ${r.rulesHit.map(x => x.rule).join(', ')}`);
        } else {
          console.log(`  请求 ${r.requestId}: 不适用 (${r.reason})`);
        }
      });
    }
  });

  console.log('\n' + '='.repeat(80));
  console.log('性能对比摘要');
  console.log('='.repeat(80));

  console.log('\n' + '版本 | 时间戳 | 平均耗时 | 总耗时 | 变更数');
  console.log('-'.repeat(80));
  
  let prevLatency = null;
  results.forEach((r, index) => {
    const delta = prevLatency !== null ? r.simulation.summary.avgLatency - prevLatency : 0;
    const deltaStr = index > 0 ? ` (${delta > 0 ? '+' : ''}${delta.toFixed(1)}ms)` : '';
    const marker = delta > 50 ? ' ⚠️' : (delta > 20 ? ' ⚠' : '');
    
    console.log(
      `${String(r.versionId).padStart(4)} | ${r.timestamp.substring(11, 19)} | ` +
      `${r.simulation.summary.avgLatency.toFixed(1).padStart(7)}ms${deltaStr} | ` +
      `${String(r.simulation.summary.totalLatency.toFixed(0)).padStart(6)}ms | ` +
      `${r.changes.length}` +
      marker
    );
    
    prevLatency = r.simulation.summary.avgLatency;
  });

  console.log('='.repeat(80) + '\n');

  return results;
}

module.exports = replay;
