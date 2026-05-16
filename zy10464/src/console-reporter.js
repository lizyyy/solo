class ConsoleReporter {
  constructor(options = {}) {
    this.verbose = options.verbose || false;
    this.quiet = options.quiet || false;
  }

  async generate(auditResult) {
    if (this.quiet) return;

    this.printHeader(auditResult);
    this.printAssertionSummary(auditResult.assertions);
    this.printExampleSummary(auditResult.examples);
    
    if (this.verbose) {
      this.printAssertionDetails(auditResult.assertions);
      this.printExampleDetails(auditResult.examples);
    }
    
    this.printIssues(auditResult);
    this.printFooter(auditResult);
  }

  printHeader(auditResult) {
    const metadata = auditResult.metadata;
    console.log('\n' + '='.repeat(70));
    console.log('  Postman Collection 覆盖审计报告');
    console.log('='.repeat(70));
    console.log(`  Collection: ${metadata.collectionName}`);
    console.log(`  审计时间: ${new Date(metadata.auditTime).toLocaleString('zh-CN')}`);
    console.log(`  请求总数: ${metadata.totalRequests}`);
    console.log('='.repeat(70));
  }

  printAssertionSummary(assertionResults) {
    console.log('\n📊 断言覆盖统计');
    console.log('-'.repeat(70));
    
    const coverageBar = this.createProgressBar(assertionResults.coverageRate);
    
    console.log(`  覆盖率: ${coverageBar} ${assertionResults.coverageRate}%`);
    console.log(`  有断言: ${assertionResults.withAssertions} / ${assertionResults.total} 请求`);
    console.log(`  无断言: ${assertionResults.withoutAssertions} / ${assertionResults.total} 请求`);
    console.log(`  断言总数: ${assertionResults.assertionCount} 个`);
    
    if (Object.keys(assertionResults.assertionTypes).length > 0) {
      console.log(`  断言类型: ${Object.entries(assertionResults.assertionTypes).map(([k, v]) => `${k}(${v})`).join(', ')}`);
    }
  }

  printExampleSummary(exampleResults) {
    console.log('\n📋 示例响应覆盖统计');
    console.log('-'.repeat(70));
    
    const coverageBar = this.createProgressBar(exampleResults.coverageRate);
    
    console.log(`  覆盖率: ${coverageBar} ${exampleResults.coverageRate}%`);
    console.log(`  有示例: ${exampleResults.withExamples} / ${exampleResults.total} 请求`);
    console.log(`  无示例: ${exampleResults.withoutExamples} / ${exampleResults.total} 请求`);
    console.log(`  示例总数: ${exampleResults.totalExamples} 个`);
    
    if (Object.keys(exampleResults.statusCodeDistribution).length > 0) {
      const statusCodes = Object.entries(exampleResults.statusCodeDistribution)
        .map(([k, v]) => `${k}(${v})`)
        .join(', ');
      console.log(`  状态码分布: ${statusCodes}`);
    }
  }

  printAssertionDetails(assertionResults) {
    const withoutAssertions = assertionResults.details.filter(d => !d.hasAssertions);
    
    if (withoutAssertions.length > 0) {
      console.log('\n❌ 缺少断言的请求');
      console.log('-'.repeat(70));
      
      for (const req of withoutAssertions) {
        console.log(`  [${req.requestMethod}] ${req.requestName}`);
        console.log(`    路径: ${req.requestPath || '根目录'}`);
        console.log(`    URL: ${req.requestUrl}`);
        console.log(`    源文件: ${req.sourceFile}`);
        console.log(`    位置: item[${req.sourceLocation.itemIndices.join('][')}]`);
        console.log('');
      }
    }
  }

  printExampleDetails(exampleResults) {
    const withoutExamples = exampleResults.details.filter(d => !d.hasExamples);
    
    if (withoutExamples.length > 0) {
      console.log('\n❌ 缺少示例响应的请求');
      console.log('-'.repeat(70));
      
      for (const req of withoutExamples) {
        console.log(`  [${req.requestMethod}] ${req.requestName}`);
        console.log(`    路径: ${req.requestPath || '根目录'}`);
        console.log(`    URL: ${req.requestUrl}`);
        console.log(`    源文件: ${req.sourceFile}`);
        console.log(`    位置: item[${req.sourceLocation.itemIndices.join('][')}]`);
        console.log('');
      }
    }
  }

  printIssues(auditResult) {
    const allIssues = [
      ...auditResult.assertions.issues.map(i => ({ ...i, category: '断言' })),
      ...auditResult.examples.issues.map(i => ({ ...i, category: '示例' }))
    ];
    
    if (auditResult.variables?.issues) {
      allIssues.push(...auditResult.variables.issues.map(i => ({ ...i, category: '变量' })));
    }
    
    if (allIssues.length > 0) {
      console.log('\n⚠️  发现的问题');
      console.log('-'.repeat(70));
      
      const grouped = {
        error: allIssues.filter(i => i.severity === 'error'),
        warning: allIssues.filter(i => i.severity === 'warning'),
        info: allIssues.filter(i => i.severity === 'info')
      };
      
      for (const severity of ['error', 'warning', 'info']) {
        const issues = grouped[severity];
        if (issues.length === 0) continue;
        
        const icon = severity === 'error' ? '🔴' : severity === 'warning' ? '🟡' : '🔵';
        console.log(`  ${icon} ${severity.toUpperCase()} (${issues.length})`);
        
        for (const issue of issues) {
          console.log(`    [${issue.category}] ${issue.type}: ${issue.message}`);
          if (issue.suggestion) {
            console.log(`       建议: ${issue.suggestion}`);
          }
        }
        console.log('');
      }
    }
  }

  printFooter(auditResult) {
    console.log('\n' + '='.repeat(70));
    
    const assertionRate = auditResult.summary.assertions.coverageRate;
    const exampleRate = auditResult.summary.examples.coverageRate;
    
    let overallStatus = '✅ 通过';
    if (assertionRate < 50 || exampleRate < 50) {
      overallStatus = '🔴 需要改进';
    } else if (assertionRate < 80 || exampleRate < 80) {
      overallStatus = '🟡 基本达标';
    }
    
    console.log(`  总体评价: ${overallStatus}`);
    console.log(`  断言覆盖率: ${assertionRate}% | 示例覆盖率: ${exampleRate}%`);
    console.log('='.repeat(70) + '\n');
  }

  createProgressBar(percentage, width = 30) {
    const filled = Math.round(width * percentage / 100);
    const empty = width - filled;
    
    let color = '\x1b[31m';
    if (percentage >= 80) color = '\x1b[32m';
    else if (percentage >= 50) color = '\x1b[33m';
    
    const reset = '\x1b[0m';
    
    return `${color}[${'█'.repeat(filled)}${'░'.repeat(empty)}]${reset}`;
  }
}

module.exports = ConsoleReporter;
