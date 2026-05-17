function printSummary(results) {
  const { summary, missingAssets } = results;
  
  console.log('\n' + '='.repeat(70));
  console.log('  🔍 前端资源404扫描报告');
  console.log('='.repeat(70));
  console.log(`\n  📁 扫描目录: ${summary.baseDir}`);
  console.log(`  📄 扫描文件数: ${summary.totalFilesScanned}`);
  console.log(`  🔗 发现资源数: ${summary.totalAssetsFound}`);
  console.log(`  ⏱️  扫描耗时: ${summary.scanDuration}ms`);
  
  console.log('\n  📊 缺失资源统计:');
  console.log(`     🖼️  图片: ${summary.missingByType.image}`);
  console.log(`     🔤 字体: ${summary.missingByType.font}`);
  console.log(`     🎨 样式: ${summary.missingByType.css}`);
  console.log(`     📜 脚本: ${summary.missingByType.script}`);
  console.log(`     🎬 媒体: ${summary.missingByType.media}`);
  console.log(`     📦 其他: ${summary.missingByType.other}`);
  console.log(`     ───────────────`);
  console.log(`     📝 总计: ${summary.missingAssetsCount}`);

  if (missingAssets.length > 0) {
    console.log('\n  ❌ 缺失资源详情:');
    
    for (const asset of missingAssets) {
      console.log(`\n    ┌─────────────────────────────────────────────────────────────`);
      console.log(`    │  🔗 URL: ${asset.url}`);
      console.log(`    │  📍 类型: ${asset.type}`);
      console.log(`    │  📂 解析路径: ${asset.resolvedPath}`);
      console.log(`    │  🔢 引用次数: ${asset.occurrenceCount}`);
      console.log(`    │`);
      console.log(`    │  📍 引用位置:`);
      
      for (const occ of asset.occurrences) {
        const sourceIcon = occ.source === 'html' ? '📄' : '🎨';
        console.log(`    │     ${sourceIcon} ${occ.filePath}:${occ.line}:${occ.column}`);
        console.log(`    │        ${occ.context.trim().replace(/\s+/g, ' ')}`);
      }
      console.log(`    └─────────────────────────────────────────────────────────────`);
    }
  }

  console.log('\n' + '='.repeat(70));
  
  if (summary.missingAssetsCount === 0) {
    console.log('  ✅ 未发现缺失资源，一切正常！');
  } else {
    console.log(`  ⚠️  发现 ${summary.missingAssetsCount} 个缺失资源，请检查修复！`);
  }
  console.log('='.repeat(70) + '\n');
  
  return summary.missingAssetsCount;
}

module.exports = { printSummary };
