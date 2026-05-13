function explain(configManager, requestSimulator, versionId, options = {}) {
  const versions = configManager.getVersions();
  
  if (versionId < 0 || versionId >= versions.length) {
    console.log(`\n错误: 版本号 ${versionId} 无效`);
    console.log(`可用版本范围: 0 - ${versions.length - 1}`);
    return null;
  }

  const version = versions[versionId];
  const prevVersion = versionId > 0 ? versions[versionId - 1] : null;

  console.log('\n' + '='.repeat(80));
  console.log(`变更分析 - 版本 ${versionId}`);
  console.log('='.repeat(80));

  console.log(`\n时间: ${version.timestamp}`);
  console.log(`类型: ${version.isSnapshot ? '初始快照' : '配置变更'}`);

  if (prevVersion) {
    const prevResult = requestSimulator.simulateAllRequests(prevVersion.config);
    const currResult = requestSimulator.simulateAllRequests(version.config);

    const delta = currResult.summary.avgLatency - prevResult.summary.avgLatency;
    const deltaPercent = ((delta / prevResult.summary.avgLatency) * 100);

    console.log(`\n性能对比:`);
    console.log(`  前一版本 (v${versionId - 1}): ${prevResult.summary.avgLatency.toFixed(2)}ms`);
    console.log(`  当前版本 (v${versionId}): ${currResult.summary.avgLatency.toFixed(2)}ms`);
    console.log(`  变化: ${delta >= 0 ? '+' : ''}${delta.toFixed(2)}ms (${deltaPercent >= 0 ? '+' : ''}${deltaPercent.toFixed(1)}%)`);

    if (delta > 50) {
      console.log(`  ⚠️  严重性能退化`);
    } else if (delta > 20) {
      console.log(`  ⚠  中等性能退化`);
    } else if (delta > 0) {
      console.log(`  ℹ  轻微性能变化`);
    } else if (delta < 0) {
      console.log(`  ✓ 性能改善`);
    }
  }

  if (version.changes && version.changes.length > 0) {
    console.log(`\n变更项 (${version.changes.length}):`);
    console.log('-'.repeat(80));
    
    version.changes.forEach((change, idx) => {
      const isFrozen = configManager.isKeyFrozen(change.key);
      const frozenTag = isFrozen ? ' [冻结配置]' : '';
      
      console.log(`\n${idx + 1}. ${change.key}${frozenTag}`);
      console.log(`   旧值: ${JSON.stringify(change.oldValue)}`);
      console.log(`   新值: ${JSON.stringify(change.newValue)}`);
      console.log(`   操作: ${change.action}`);
      
      const impact = analyzeChangeImpact(change, version.config);
      console.log(`   预估影响: ${impact.description}`);
      if (impact.latencyChange) {
        console.log(`   预估耗时变化: ${impact.latencyChange}`);
      }
    });
  } else {
    console.log('\n变更项: 无（初始快照版本）');
  }

  if (options.detail) {
    console.log(`\n当前版本配置:`);
    console.log(JSON.stringify(version.config, null, 2));
  }

  console.log('\n' + '='.repeat(80) + '\n');

  return {
    versionId,
    version,
    prevVersion,
    analysis: version.changes.map(c => ({
      change: c,
      impact: analyzeChangeImpact(c, version.config),
      isFrozen: configManager.isKeyFrozen(c.key)
    }))
  };
}

function analyzeChangeImpact(change, config) {
  const key = change.key;
  const parts = key.split('.');
  const category = parts[0];

  if (category === 'rateLimit') {
    return analyzeRateLimitChange(change, config);
  } else if (category === 'recommendation') {
    return analyzeRecommendationChange(change, config);
  } else if (category === 'caching') {
    return analyzeCachingChange(change, config);
  }

  return {
    description: '未知配置项变更',
    latencyChange: null
  };
}

function analyzeRateLimitChange(change, config) {
  const key = change.key;
  
  if (key === 'rateLimit.enabled') {
    if (change.newValue === true) {
      return {
        description: '启用限流检查，会增加请求检查开销',
        latencyChange: '+5~30ms（取决于阈值大小）'
      };
    } else {
      return {
        description: '关闭限流检查，减少检查开销',
        latencyChange: '-5~30ms'
      };
    }
  }
  
  if (key === 'rateLimit.threshold') {
    const oldVal = change.oldValue || 100;
    const newVal = change.newValue || 100;
    
    if (newVal < oldVal) {
      return {
        description: `降低限流阈值 (${oldVal} → ${newVal})，检查开销降低但限流概率增加`,
        latencyChange: '检查开销减少，但可能增加被限流请求'
      };
    } else {
      return {
        description: `提高限流阈值 (${oldVal} → ${newVal})，检查开销增加`,
        latencyChange: '+5~20ms（检查开销增加）'
      };
    }
  }

  return {
    description: '限流配置变更',
    latencyChange: null
  };
}

function analyzeRecommendationChange(change, config) {
  const key = change.key;
  
  if (key === 'recommendation.enabled') {
    if (change.newValue === true) {
      const algo = config.recommendation?.algorithm || 'simple';
      const overhead = {
        'simple': '~15ms',
        'collaborative': '~50ms',
        'deep_learning': '~150ms',
        'hybrid': '~100ms'
      }[algo] || '~20ms';
      
      return {
        description: `启用推荐功能，使用 ${algo} 算法`,
        latencyChange: `+${overhead}`
      };
    } else {
      return {
        description: '关闭推荐功能，跳过推荐计算',
        latencyChange: '-15~150ms'
      };
    }
  }
  
  if (key === 'recommendation.algorithm') {
    const overheadMap = {
      'simple': 15,
      'collaborative': 50,
      'deep_learning': 150,
      'hybrid': 100
    };
    
    const oldOverhead = overheadMap[change.oldValue] || 20;
    const newOverhead = overheadMap[change.newValue] || 20;
    const delta = newOverhead - oldOverhead;
    
    return {
      description: `切换推荐算法 (${change.oldValue} → ${change.newValue})`,
      latencyChange: delta > 0 ? `+${delta}ms` : `${delta}ms`
    };
  }
  
  if (key === 'recommendation.personalization') {
    return {
      description: change.newValue ? '启用人性化推荐，增加用户特征计算' : '关闭个性化推荐',
      latencyChange: change.newValue ? '+30ms' : '-30ms'
    };
  }
  
  if (key === 'recommendation.realTime') {
    return {
      description: change.newValue ? '启用实时推荐更新' : '关闭实时更新',
      latencyChange: change.newValue ? '+50ms' : '-50ms'
    };
  }

  return {
    description: '推荐配置变更',
    latencyChange: null
  };
}

function analyzeCachingChange(change, config) {
  const key = change.key;
  
  if (key === 'caching.enabled') {
    if (change.newValue === true) {
      return {
        description: '启用缓存，缓存命中可显著减少耗时',
        latencyChange: '命中时-大部分耗时，未命中时+5~15ms'
      };
    } else {
      return {
        description: '关闭缓存，所有请求都需要完整处理',
        latencyChange: '平均耗时增加（取决于之前的缓存命中率）'
      };
    }
  }
  
  if (key === 'caching.ttl') {
    const oldVal = change.oldValue || 300;
    const newVal = change.newValue || 300;
    
    if (newVal < oldVal) {
      return {
        description: `缩短缓存 TTL (${oldVal}s → ${newVal}s)，缓存命中率可能下降`,
        latencyChange: '可能增加（缓存失效更快）'
      };
    } else {
      return {
        description: `延长缓存 TTL (${oldVal}s → ${newVal}s)，缓存命中率可能提升`,
        latencyChange: '可能减少（缓存更持久）'
      };
    }
  }

  return {
    description: '缓存配置变更',
    latencyChange: null
  };
}

module.exports = explain;
