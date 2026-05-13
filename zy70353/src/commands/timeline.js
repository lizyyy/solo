function timeline(configManager, options = {}) {
  const versions = configManager.getVersions();
  
  console.log('\n' + '='.repeat(80));
  console.log('配置版本时间线');
  console.log('='.repeat(80));
  
  if (versions.length === 0) {
    console.log('没有可用的配置版本');
    return;
  }

  const frozenKeys = configManager.getFrozenKeys();
  if (frozenKeys.length > 0) {
    console.log('\n冻结配置键（不会被自动回滚建议覆盖）:');
    frozenKeys.forEach(key => console.log(`  - ${key}`));
  }

  console.log('\n');
  versions.forEach((version, index) => {
    const isLatest = index === versions.length - 1;
    const marker = version.isSnapshot ? '[快照]' : '[变更]';
    const latestTag = isLatest ? ' <-- 最新' : '';

    console.log(`版本 ${version.id} ${marker}${latestTag}`);
    console.log(`  时间: ${version.timestamp}`);
    
    if (version.changes && version.changes.length > 0) {
      console.log(`  变更项 (${version.changes.length}):`);
      version.changes.forEach(change => {
        const isFrozen = configManager.isKeyFrozen(change.key);
        const frozenTag = isFrozen ? ' [冻结]' : '';
        console.log(`    - ${change.key}: ${JSON.stringify(change.oldValue)} → ${JSON.stringify(change.newValue)}${frozenTag}`);
      });
    } else {
      console.log('  变更项: 无（初始快照）');
    }
    
    console.log('');
  });

  console.log('='.repeat(80));
  console.log(`总计: ${versions.length} 个版本`);
  console.log('='.repeat(80) + '\n');
}

module.exports = timeline;
