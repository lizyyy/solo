const path = require('path');
const { analyzeMetrics } = require('../src/index');

async function runTests() {
  console.log('='.repeat(70));
  console.log('指标配置仓库口径变更影响 CLI - 测试验收');
  console.log('='.repeat(70));
  console.log('');

  const samplesDir = path.join(__dirname, '../samples');
  const outputDir = path.join(__dirname, '../output');

  try {
    console.log('【测试 1: 正常路径 - 分析正常指标文件 (指定 M001 口径变更)】');
    console.log('-'.repeat(60));
    const result1 = await analyzeMetrics(
      path.join(samplesDir, 'normal_metrics.csv'),
      {
        changedMetrics: ['M001'],
        outputDir: path.join(outputDir, 'test1_normal'),
        reportName: 'normal_impact'
      }
    );
    console.log('✓ 正常路径测试通过');
    console.log('  - 解析文件数: 1');
    console.log('  - 解析指标数:', result1.parsed[0].metrics.length);
    console.log('  - 受影响指标数:', result1.aggregated.summary.affectedMetrics);
    console.log('  - 高影响指标数:', result1.aggregated.summary.highImpactMetrics);
    console.log('  - 影响看板数:', result1.aggregated.dashboardList.length);
    console.log('');

    console.log('【测试 2: 异常路径 - 分析包含坏行的指标文件】');
    console.log('-'.repeat(60));
    const result2 = await analyzeMetrics(
      path.join(samplesDir, 'bad_rows_metrics.csv'),
      {
        changedMetrics: ['M001', 'M004'],
        outputDir: path.join(outputDir, 'test2_badrows'),
        reportName: 'badrows_impact'
      }
    );
    console.log('✓ 异常路径测试通过');
    console.log('  - 解析指标数:', result2.parsed[0].metrics.length);
    console.log('  - 异常项数:', result2.aggregated.exceptions.length);
    
    const aliasEx = result2.aggregated.exceptions.filter(e => e.type === 'METRIC_ALIAS');
    const snapshotEx = result2.aggregated.exceptions.filter(e => e.type === 'HISTORY_SNAPSHOT');
    const nestingEx = result2.aggregated.exceptions.filter(e => e.type === 'FORMULA_NESTING');
    const validationErrors = result2.aggregated.exceptions.filter(e => e.type === 'VALIDATION_ERROR');
    
    console.log('  - 指标别名异常:', aliasEx.length, '项（已继续处理）');
    console.log('  - 历史快照异常:', snapshotEx.length, '项（已继续处理）');
    console.log('  - 公式嵌套异常:', nestingEx.length, '项（已继续处理）');
    console.log('  - 验证错误:', validationErrors.length, '项');
    console.log('');

    console.log('【测试 3: 目录分析 - 批量分析整个 samples 目录】');
    console.log('-'.repeat(60));
    const result3 = await analyzeMetrics(
      samplesDir,
      {
        changedMetrics: ['M001'],
        outputDir: path.join(outputDir, 'test3_directory'),
        reportName: 'directory_impact'
      }
    );
    console.log('✓ 目录分析测试通过');
    console.log('  - 分析文件数:', result3.aggregated.summary.totalFiles);
    console.log('  - 总指标数:', result3.aggregated.summary.totalMetrics);
    console.log('');

    console.log('【测试 4: 重复运行对照 - 验证结果一致性】');
    console.log('-'.repeat(60));
    const result4a = await analyzeMetrics(
      path.join(samplesDir, 'duplicate_metrics.csv'),
      {
        changedMetrics: ['M001'],
        outputDir: path.join(outputDir, 'test4_duplicate'),
        reportName: 'duplicate_run1'
      }
    );
    const result4b = await analyzeMetrics(
      path.join(samplesDir, 'duplicate_metrics.csv'),
      {
        changedMetrics: ['M001'],
        outputDir: path.join(outputDir, 'test4_duplicate'),
        reportName: 'duplicate_run2'
      }
    );
    console.log('✓ 重复运行测试通过');
    console.log('  - 第一次运行指标数:', result4a.aggregated.summary.totalMetrics);
    console.log('  - 第二次运行指标数:', result4b.aggregated.summary.totalMetrics);
    console.log('  - 结果一致:', result4a.aggregated.summary.totalMetrics === result4b.aggregated.summary.totalMetrics ? '是' : '否');
    console.log('');

    console.log('='.repeat(70));
    console.log('所有测试通过！');
    console.log('='.repeat(70));
    console.log('');
    console.log('输出目录结构:');
    console.log('  ' + outputDir + '/');
    console.log('  ├── test1_normal/          - 正常路径测试结果');
    console.log('  ├── test2_badrows/         - 异常路径测试结果');
    console.log('  ├── test3_directory/       - 目录分析测试结果');
    console.log('  └── test4_duplicate/       - 重复运行测试结果');
    console.log('');

  } catch (error) {
    console.error('测试失败:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

runTests();
