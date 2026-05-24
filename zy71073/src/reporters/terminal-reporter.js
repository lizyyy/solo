const chalk = require('chalk');

class TerminalReporter {
  report(result, options = {}) {
    const { workbook, graph, graphInstance } = result;

    console.log('\n' + chalk.bold.cyan('══════════════════════════════════════════════════════════'));
    console.log(chalk.bold.cyan('           Excel 公式依赖图分析报告'));
    console.log(chalk.bold.cyan('══════════════════════════════════════════════════════════\n'));

    console.log(chalk.bold.yellow('📁 工作簿信息'));
    console.log('   ' + chalk.gray('文件:') + ' ' + workbook.filePath);
    console.log('   ' + chalk.gray('工作表数量:') + ' ' + workbook.sheets.length);
    console.log('   ' + chalk.gray('命名区域:') + ' ' + workbook.namedRanges.length + ' 个');
    console.log('   ' + chalk.gray('外部链接:') + ' ' + (workbook.externalLinks.length > 0
      ? chalk.red(`${workbook.externalLinks.length} 个`)
      : chalk.green('无')));
    console.log('');

    console.log(chalk.bold.yellow('📊 工作表统计'));
    workbook.sheets.forEach(sheet => {
      const hidden = sheet.isHidden ? chalk.gray(' [隐藏]') : '';
      const veryHidden = sheet.isVeryHidden ? chalk.gray(' [深度隐藏]') : '';
      console.log(`   ${sheet.name}${hidden}${veryHidden}: ${chalk.blue(sheet.cellCount)} 单元格, ${chalk.magenta(sheet.formulaCount)} 公式`);
    });
    console.log('');

    console.log(chalk.bold.yellow('🔗 依赖图统计'));
    console.log('   ' + chalk.gray('节点数:') + ' ' + graph.nodeCount);
    console.log('   ' + chalk.gray('依赖边:') + ' ' + graph.edgeCount);
    console.log('   ' + chalk.gray('循环引用:') + ' ' + (graph.hasCircularReferences
      ? chalk.red(`${graph.circularReferences.length} 个 ⚠️`)
      : chalk.green('无 ✓')));
    console.log('');

    if (graph.hasCircularReferences) {
      console.log(chalk.bold.red('⚠️  检测到循环引用:'));
      graph.circularReferences.slice(0, 5).forEach((cycle, i) => {
        console.log(`   ${i + 1}. ${cycle.join(' → ')}`);
      });
      if (graph.circularReferences.length > 5) {
        console.log(`   ... 还有 ${graph.circularReferences.length - 5} 个`);
      }
      console.log('');
    }

    console.log(chalk.bold.yellow('📈 最具影响力的单元格 (被引用最多)'));
    const topDependents = graphInstance.getTopDependents(5);
    topDependents.forEach((cell, i) => {
      console.log(`   ${i + 1}. ${chalk.green(cell.address)} - 被 ${chalk.blue(cell.dependentCount)} 个单元格引用`);
    });
    console.log('');

    console.log(chalk.bold.yellow('📉 最复杂的公式 (依赖最多)'));
    const topDependencies = graphInstance.getTopDependencies(5);
    topDependencies.forEach((cell, i) => {
      const formula = cell.formula?.substring(0, 40) || '';
      console.log(`   ${i + 1}. ${chalk.magenta(cell.address)} - 依赖 ${chalk.blue(cell.dependencyCount)} 个单元格`);
      console.log(`      ${chalk.gray(formula + (cell.formula?.length > 40 ? '...' : ''))}`);
    });
    console.log('');

    if (options.cell) {
      const impact = graphInstance.getImpactPath(options.cell);
      this._printImpact(impact);
    }

    if (options.dependency) {
      const deps = graphInstance.getDependencyPath(options.dependency);
      this._printDependencies(deps);
    }

    if (workbook.externalLinks.length > 0) {
      console.log(chalk.bold.yellow('🌐 外部链接'));
      workbook.externalLinks.forEach(link => {
        console.log(`   • 文件: ${link.file}`);
        console.log(`     位置: ${link.path} (在 ${link.sourceCell} 中引用)`);
      });
      console.log('');
    }

    if (workbook.namedRanges.length > 0) {
      console.log(chalk.bold.yellow('📛 命名区域'));
      workbook.namedRanges.slice(0, 10).forEach(named => {
        console.log(`   • ${chalk.cyan(named.name)} = ${named.reference}`);
      });
      if (workbook.namedRanges.length > 10) {
        console.log(`   ... 还有 ${workbook.namedRanges.length - 10} 个`);
      }
      console.log('');
    }
  }

  _printImpact(impact) {
    console.log(chalk.bold.yellow('🎯 单元格影响分析: ' + impact.startCell));
    console.log('   ' + chalk.gray('影响单元格总数:') + ' ' + impact.totalImpacted);
    console.log('');
    if (impact.totalImpacted > 0) {
      console.log('   ' + chalk.gray('受影响的工作表:'));
      impact.impactedSheets.forEach(sheet => {
        console.log(`   • ${sheet.sheetName}: ${sheet.count} 个单元格`);
      });
      console.log('');
      const topCells = impact.impactedCells.slice(1, 11);
      console.log('   ' + chalk.gray('受影响的单元格 (前10):'));
      topCells.forEach(cell => {
        console.log(`     - ${cell}`);
      });
      if (impact.totalImpacted > 10) {
        console.log(`     ... 还有 ${impact.totalImpacted - 10} 个`);
      }
      console.log('');
    }
  }

  _printDependencies(deps) {
    console.log(chalk.bold.yellow('🔍 单元格依赖链: ' + deps.endCell));
    console.log('   ' + chalk.gray('依赖单元格总数:') + ' ' + deps.totalDependencies);
    console.log('');
    if (deps.totalDependencies > 0) {
      console.log('   ' + chalk.gray('涉及的工作表:'));
      deps.dependencySheets.forEach(sheet => {
        console.log(`   • ${sheet.sheetName}: ${sheet.count} 个单元格`);
      });
      console.log('');
    }
  }

  reportImpact(impact, result) {
    console.log('\n' + chalk.bold.cyan('══════════════════════════════════════════════════════════'));
    console.log(chalk.bold.cyan('                 单元格影响分析报告'));
    console.log(chalk.bold.cyan('══════════════════════════════════════════════════════════\n'));

    const node = result.graphInstance.getNode(impact.startCell);
    console.log(chalk.bold.yellow('📌 目标单元格'));
    console.log('   ' + chalk.gray('地址:') + ' ' + chalk.green(impact.startCell));
    if (node) {
      if (node.formula) {
        console.log('   ' + chalk.gray('公式:') + ' ' + node.formula);
      }
      if (node.value !== undefined) {
        console.log('   ' + chalk.gray('当前值:') + ' ' + node.value);
      }
    }
    console.log('');

    console.log(chalk.bold.yellow('📊 影响统计'));
    console.log('   ' + chalk.gray('影响单元格总数:') + ' ' + chalk.blue(impact.totalImpacted));
    console.log('   ' + chalk.gray('涉及工作表数:') + ' ' + chalk.blue(impact.impactedSheets.length));
    console.log('');

    if (impact.totalImpacted > 0) {
      console.log(chalk.bold.yellow('📋 受影响的工作表'));
      impact.impactedSheets.forEach(sheet => {
        console.log(`   • ${chalk.yellow(sheet.sheetName)}: ${chalk.blue(sheet.count)} 个单元格`);
        const sheetCells = sheet.cells.slice(0, 5);
        sheetCells.forEach(cell => {
          console.log(`     - ${cell}`);
        });
        if (sheet.count > 5) {
          console.log(`     ... 还有 ${sheet.count - 5} 个`);
        }
      });
      console.log('');

      console.log(chalk.bold.gray('💡 修改此单元格会影响以上所有单元格'));
    } else {
      console.log(chalk.green('   ✓ 此单元格没有被其他单元格引用'));
    }
    console.log('');
  }

  reportInputs(inputs, totalCount, options) {
    console.log('\n' + chalk.bold.cyan('══════════════════════════════════════════════════════════'));
    console.log(chalk.bold.cyan('                  输入项分析报告'));
    console.log(chalk.bold.cyan('══════════════════════════════════════════════════════════\n'));

    console.log(chalk.bold.yellow('📊 统计信息'));
    console.log('   ' + chalk.gray('输入项总数:') + ' ' + chalk.blue(totalCount));
    console.log('   ' + chalk.gray('显示数量:') + ' ' + chalk.blue(inputs.length));
    console.log('');

    console.log(chalk.bold.yellow('📋 影响最大的输入项'));
    inputs.forEach((input, i) => {
      console.log(`   ${i + 1}. ${chalk.green(input.address)}`);
      console.log(`      ${chalk.gray('值:')} ${input.value !== undefined ? input.value : '(空)'}`);
      console.log(`      ${chalk.gray('影响:')} ${chalk.blue(input.dependentCount)} 个单元格`);
      console.log(`      ${chalk.gray('直接引用:')} ${input.directDependents.join(', ')}`);
      console.log('');
    });

    console.log(chalk.bold.gray('💡 这些单元格是输入项，修改它们会影响多个公式'));
    console.log('');
  }

  reportSheets(sheets) {
    console.log('\n' + chalk.bold.cyan('══════════════════════════════════════════════════════════'));
    console.log(chalk.bold.cyan('                  工作表列表'));
    console.log(chalk.bold.cyan('══════════════════════════════════════════════════════════\n'));

    console.log(chalk.bold.yellow('📊 工作表统计'));
    console.log('');
    sheets.forEach(sheet => {
      const hidden = sheet.isHidden ? chalk.yellow(' [隐藏]') : '';
      const veryHidden = sheet.isVeryHidden ? chalk.red(' [深度隐藏]') : '';
      console.log(chalk.bold(`   ${sheet.name}${hidden}${veryHidden}`));
      console.log(`      ${chalk.gray('索引:')} ${sheet.index}`);
      console.log(`      ${chalk.gray('单元格数:')} ${sheet.cellCount}`);
      console.log(`      ${chalk.gray('公式数:')} ${sheet.formulaCount}`);
      const formulaRate = sheet.cellCount > 0
        ? ((sheet.formulaCount / sheet.cellCount) * 100).toFixed(1)
        : 0;
      console.log(`      ${chalk.gray('公式占比:')} ${formulaRate}%`);
      console.log('');
    });
  }

  reportSelfTest(results) {
    console.log('\n' + chalk.bold.cyan('══════════════════════════════════════════════════════════'));
    console.log(chalk.bold.cyan('                    自检结果'));
    console.log(chalk.bold.cyan('══════════════════════════════════════════════════════════\n'));

    console.log(chalk.bold.yellow('📊 测试结果'));
    console.log('   ' + chalk.gray('总测试数:') + ' ' + results.totalTests);
    console.log('   ' + chalk.gray('通过:') + ' ' + chalk.green(results.passedCount));
    console.log('   ' + chalk.gray('失败:') + ' ' + (results.failedCount > 0 ? chalk.red(results.failedCount) : chalk.green('0')));
    console.log('');

    if (results.tests) {
      results.tests.forEach(test => {
        const status = test.passed
          ? chalk.green('✓ PASS')
          : chalk.red('✗ FAIL');
        console.log(`   ${status} ${test.name}`);
        if (!test.passed && test.error) {
          console.log(`      ${chalk.red(test.error)}`);
        }
      });
      console.log('');
    }

    if (results.passed) {
      console.log(chalk.green.bold('   ✓ 所有测试通过！工具功能正常。'));
    } else {
      console.log(chalk.red.bold('   ✗ 部分测试失败，请检查问题。'));
    }
    console.log('');
  }
}

module.exports = { TerminalReporter };
