class BisectRunner {
  constructor(configManager, requestSimulator, options = {}) {
    this.configManager = configManager;
    this.requestSimulator = requestSimulator;
    this.options = options;
    this.threshold = options.threshold || 20;
    this.verbose = options.verbose || false;
  }

  run() {
    const versions = this.configManager.getVersions();
    const n = versions.length;
    
    if (n < 2) {
      return {
        success: false,
        reason: '版本数量不足，无法进行二分查找'
      };
    }

    console.log('\n' + '='.repeat(80));
    console.log('二分查找：定位性能问题配置变更');
    console.log('='.repeat(80));
    console.log(`\n配置版本总数: ${n}`);
    console.log(`性能退化阈值: +${this.threshold}ms`);

    const firstVersion = versions[0];
    const lastVersion = versions[n - 1];
    
    const firstResult = this._simulateVersion(firstVersion);
    const lastResult = this._simulateVersion(lastVersion);

    console.log('\n基准版本 (v0):');
    console.log(`  时间: ${firstVersion.timestamp}`);
    console.log(`  平均耗时: ${firstResult.summary.avgLatency.toFixed(2)}ms`);

    console.log('\n问题版本 (latest):');
    console.log(`  时间: ${lastVersion.timestamp}`);
    console.log(`  平均耗时: ${lastResult.summary.avgLatency.toFixed(2)}ms`);
    console.log(`  性能变化: ${(lastResult.summary.avgLatency - firstResult.summary.avgLatency).toFixed(2)}ms`);

    const totalDegradation = lastResult.summary.avgLatency - firstResult.summary.avgLatency;
    
    if (totalDegradation < this.threshold) {
      console.log('\n✓ 整体性能变化未超过阈值，无需深入分析');
      return {
        success: false,
        reason: `整体性能变化(${totalDegradation.toFixed(1)}ms)未超过阈值(${this.threshold}ms)`
      };
    }

    console.log('\n开始二分查找...');
    console.log('-'.repeat(80));

    const steps = [];
    const candidates = [];
    
    let left = 0;
    let right = n - 1;
    
    while (left < right) {
      const mid = Math.floor((left + right) / 2);
      const midVersion = versions[mid];
      const midResult = this._simulateVersion(midVersion);
      
      const leftVersion = versions[left];
      const leftResult = this._simulateVersion(leftVersion);
      const rightVersion = versions[right];
      const rightResult = this._simulateVersion(rightVersion);
      
      const leftToMid = midResult.summary.avgLatency - leftResult.summary.avgLatency;
      const midToRight = rightResult.summary.avgLatency - midResult.summary.avgLatency;

      const step = {
        step: steps.length + 1,
        left: { id: left, latency: leftResult.summary.avgLatency },
        mid: { id: mid, latency: midResult.summary.avgLatency },
        right: { id: right, latency: rightResult.summary.avgLatency },
        leftToMid,
        midToRight
      };
      steps.push(step);

      if (this.verbose) {
        console.log(`\n步骤 ${step.step}:`);
        console.log(`  左边界 v${left}: ${leftResult.summary.avgLatency.toFixed(1)}ms`);
        console.log(`  中间点 v${mid}: ${midResult.summary.avgLatency.toFixed(1)}ms`);
        console.log(`  右边界 v${right}: ${rightResult.summary.avgLatency.toFixed(1)}ms`);
        console.log(`  左→中: ${leftToMid >= 0 ? '+' : ''}${leftToMid.toFixed(1)}ms`);
        console.log(`  中→右: ${midToRight >= 0 ? '+' : ''}${midToRight.toFixed(1)}ms`);
      }

      const leftDegradation = leftToMid >= this.threshold;
      const rightDegradation = midToRight >= this.threshold;

      if (leftDegradation && rightDegradation) {
        console.log(`  ⚠️  两侧均检测到性能退化，同时追踪`);
        const leftCandidates = this._findInRange(left, mid, firstResult.summary.avgLatency);
        const rightCandidates = this._findInRange(mid, right, firstResult.summary.avgLatency);
        candidates.push(...leftCandidates, ...rightCandidates);
        break;
      } else if (leftDegradation) {
        console.log(`  → 选择左侧区间 [v${left}, v${mid}]`);
        if (mid - left === 1) {
          candidates.push(this._analyzeChange(left, mid, firstResult.summary.avgLatency));
          break;
        }
        right = mid;
      } else if (rightDegradation) {
        console.log(`  → 选择右侧区间 [v${mid}, v${right}]`);
        if (right - mid === 1) {
          candidates.push(this._analyzeChange(mid, right, firstResult.summary.avgLatency));
          break;
        }
        left = mid;
      } else {
        if (right - left <= 2) {
          console.log(`  ⚠️  区间已缩小，分析所有相邻变更`);
          for (let i = left; i < right; i++) {
            const candidate = this._analyzeChange(i, i + 1, firstResult.summary.avgLatency);
            if (candidate) candidates.push(candidate);
          }
          break;
        }
        console.log(`  → 继续缩小范围`);
        left = mid;
      }
    }

    const uniqueCandidates = this._deduplicateCandidates(candidates);
    
    console.log('\n' + '='.repeat(80));
    console.log('二分查找结果');
    console.log('='.repeat(80));

    if (uniqueCandidates.length === 0) {
      console.log('\n⚠️  未找到明确的性能退化点');
      return {
        success: false,
        reason: '无法精确定位，建议手动排查',
        steps
      };
    }

    console.log(`\n找到 ${uniqueCandidates.length} 个疑似问题变更（按影响程度排序）:`);
    console.log('-'.repeat(80));

    uniqueCandidates.forEach((c, i) => {
      console.log(`\n候选 #${i + 1}:`);
      console.log(`  版本: v${c.versionId}`);
      console.log(`  时间: ${c.timestamp}`);
      console.log(`  性能影响: ${c.latencyDelta >= 0 ? '+' : ''}${c.latencyDelta.toFixed(1)}ms`);
      console.log(`  置信度: ${c.confidence}%`);
      console.log(`  变更项:`);
      c.changes.forEach(change => {
        const isFrozen = this.configManager.isKeyFrozen(change.key);
        const frozenTag = isFrozen ? ' [冻结]' : '';
        console.log(`    - ${change.key}: ${JSON.stringify(change.oldValue)} → ${JSON.stringify(change.newValue)}${frozenTag}`);
      });
    });

    console.log('\n' + '='.repeat(80) + '\n');

    return {
      success: true,
      steps,
      candidates: uniqueCandidates,
      baseline: firstResult.summary.avgLatency,
      latest: lastResult.summary.avgLatency,
      totalDegradation
    };
  }

  _findInRange(start, end, baseline) {
    const versions = this.configManager.getVersions();
    const candidates = [];
    
    for (let i = start; i < end; i++) {
      const candidate = this._analyzeChange(i, i + 1, baseline);
      if (candidate) candidates.push(candidate);
    }
    
    return candidates;
  }

  _analyzeChange(prevId, currId, baseline) {
    const versions = this.configManager.getVersions();
    const prevVersion = versions[prevId];
    const currVersion = versions[currId];
    
    const prevResult = this._simulateVersion(prevVersion);
    const currResult = this._simulateVersion(currVersion);
    
    const delta = currResult.summary.avgLatency - prevResult.summary.avgLatency;
    
    if (delta <= 0 && currResult.summary.avgLatency >= baseline) {
      return null;
    }

    const totalDelta = currResult.summary.avgLatency - baseline;
    const confidence = Math.min(99, Math.max(30, Math.round((delta / Math.max(1, totalDelta)) * 100)));

    const supportingSamples = [];
    const counterSamples = [];

    currResult.results.forEach((r, idx) => {
      if (!r.applicable) return;
      
      const prevRequestResult = prevResult.results[idx];
      if (!prevRequestResult || !prevRequestResult.applicable) return;
      
      const requestDelta = r.latency - prevRequestResult.latency;
      
      if (requestDelta > this.threshold / 2) {
        supportingSamples.push({
          requestId: r.requestId,
          delta: requestDelta,
          rulesHit: r.rulesHit.map(x => x.rule)
        });
      } else if (requestDelta < -this.threshold / 4) {
        counterSamples.push({
          requestId: r.requestId,
          delta: requestDelta,
          rulesHit: r.rulesHit.map(x => x.rule)
        });
      }
    });

    return {
      versionId: currId,
      timestamp: currVersion.timestamp,
      changes: currVersion.changes,
      latencyDelta: delta,
      totalLatency: currResult.summary.avgLatency,
      confidence,
      supportingSamples: supportingSamples.slice(0, 5),
      counterSamples: counterSamples.slice(0, 3),
      prevLatency: prevResult.summary.avgLatency,
      currLatency: currResult.summary.avgLatency
    };
  }

  _simulateVersion(version) {
    return this.requestSimulator.simulateAllRequests(version.config);
  }

  _deduplicateCandidates(candidates) {
    const seen = new Set();
    const unique = [];
    
    candidates
      .filter(c => c && !seen.has(c.versionId))
      .forEach(c => {
        seen.add(c.versionId);
        unique.push(c);
      });
    
    return unique.sort((a, b) => Math.abs(b.latencyDelta) - Math.abs(a.latencyDelta));
  }
}

function bisect(configManager, requestSimulator, options = {}) {
  const runner = new BisectRunner(configManager, requestSimulator, options);
  return runner.run();
}

module.exports = bisect;
