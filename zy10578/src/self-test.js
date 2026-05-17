const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const chalk = require('chalk');

const RegressionEngine = require('./engine');
const Reporter = require('./reporter');

class SelfTester {
  constructor(options) {
    this.options = options;
    this.tempDir = path.join(os.tmpdir(), 'regex-regress-test');
  }

  async run() {
    console.log(chalk.blue('🧪 开始自检...'));
    
    await this.createDemoData(this.tempDir);
    
    console.log(chalk.gray('  测试1: 验证正则解析和执行...'));
    await this.testRegexExecution();
    
    console.log(chalk.gray('  测试2: 验证边界样本处理...'));
    await this.testEdgeCases();
    
    console.log(chalk.gray('  测试3: 验证报告导出...'));
    await this.testReportExport();
    
    console.log(chalk.gray('  测试4: 验证预期标签对比...'));
    await this.testExpectedComparison();
    
    await this.cleanup();
  }

  async createDemoData(targetDir) {
    await fs.mkdir(targetDir, { recursive: true });
    const samplesDir = path.join(targetDir, 'samples');
    await fs.mkdir(samplesDir, { recursive: true });

    const rules = [
      {
        id: 'email_rule',
        name: '邮箱地址匹配',
        pattern: '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}',
        flags: 'g',
        category: 'contact'
      },
      {
        id: 'phone_rule',
        name: '手机号码匹配',
        pattern: '1[3-9]\\d{9}',
        flags: 'g',
        category: 'contact'
      },
      {
        id: 'url_rule',
        name: 'URL链接匹配',
        pattern: 'https?://[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}[^\\s]*',
        flags: 'g',
        category: 'web'
      }
    ];
    await fs.writeFile(
      path.join(targetDir, 'rules.json'),
      JSON.stringify(rules, null, 2),
      'utf-8'
    );

    const samples = [
      '用户邮箱: test@example.com 请查收',
      '联系电话: 13812345678 随时拨打',
      '访问官网: https://www.example.com 获取更多',
      '这是普通文本，不应该匹配任何规则',
      '混合内容: 请发送到 admin@test.org 或拨打15987654321',
      '无效邮箱: @missing-user.com',
      '无效手机号: 1234567890 不足11位',
      '边界测试: x@y.z 最短邮箱格式',
      '',
      '特殊字符: 测试!@#$%^&*() 字符串'
    ];
    await fs.writeFile(
      path.join(samplesDir, 'test_samples.txt'),
      samples.join('\n'),
      'utf-8'
    );

    const expected = {
      'test_samples.txt:1': { shouldMatch: true, rules: ['email_rule'] },
      'test_samples.txt:2': { shouldMatch: true, rules: ['phone_rule'] },
      'test_samples.txt:3': { shouldMatch: true, rules: ['url_rule'] },
      'test_samples.txt:4': { shouldMatch: false },
      'test_samples.txt:5': { shouldMatch: true, rules: ['email_rule', 'phone_rule'] },
      'test_samples.txt:6': { shouldMatch: false },
      'test_samples.txt:7': { shouldMatch: false },
      'test_samples.txt:8': { shouldMatch: true, rules: ['email_rule'] },
      'test_samples.txt:10': { shouldMatch: false }
    };
    await fs.writeFile(
      path.join(targetDir, 'expected.json'),
      JSON.stringify(expected, null, 2),
      'utf-8'
    );

    this.demoDir = targetDir;
    return {
      rules: path.join(targetDir, 'rules.json'),
      samples: samplesDir,
      expected: path.join(targetDir, 'expected.json')
    };
  }

  async testRegexExecution() {
    const engine = new RegressionEngine({
      rules: path.join(this.demoDir, 'rules.json'),
      samples: path.join(this.demoDir, 'samples')
    });

    const result = await engine.run();
    
    if (result.statistics.totalRules !== 3) {
      throw new Error(`规则加载失败: 预期3条，实际${result.statistics.totalRules}条`);
    }
    
    if (result.statistics.matchedSamples < 4) {
      throw new Error(`匹配结果异常: 命中样本数${result.statistics.matchedSamples}，预期至少4个`);
    }
    
    const hasEmailMatch = result.matches.some(m => 
      m.matchedRules.some(r => r.ruleId === 'email_rule')
    );
    if (!hasEmailMatch) {
      throw new Error('邮箱规则未正确匹配');
    }
  }

  async testEdgeCases() {
    const edgeDir = path.join(this.tempDir, 'edge-tests');
    await fs.mkdir(edgeDir, { recursive: true });
    const edgeSamples = path.join(edgeDir, 'samples');
    await fs.mkdir(edgeSamples, { recursive: true });

    const edgeRules = [
      { id: 'empty', name: '空匹配测试', pattern: '^$', flags: '' },
      { id: 'invalid', name: '无效正则', pattern: '[unclosed', flags: 'g' },
      { id: 'unicode', name: 'Unicode测试', pattern: '\\p{Script=Han}+', flags: 'gu' }
    ];
    await fs.writeFile(
      path.join(edgeDir, 'rules.json'),
      JSON.stringify(edgeRules, null, 2),
      'utf-8'
    );

    const samples = [
      '',
      '   ',
      '这是中文测试',
      '12345',
      'mixed中文and英文'
    ];
    await fs.writeFile(
      path.join(edgeSamples, 'edge.txt'),
      samples.join('\n'),
      'utf-8'
    );

    const engine = new RegressionEngine({
      rules: path.join(edgeDir, 'rules.json'),
      samples: edgeSamples
    });

    const result = await engine.run();
    
    if (result.errors.length === 0) {
      throw new Error('无效正则应该产生错误，但未捕获');
    }
  }

  async testReportExport() {
    const outputDir = path.join(this.tempDir, 'reports');
    
    const engine = new RegressionEngine({
      rules: path.join(this.demoDir, 'rules.json'),
      samples: path.join(this.demoDir, 'samples'),
      output: outputDir
    });

    const result = await engine.run();
    
    const reporter = new Reporter({ output: outputDir });
    await reporter.generateAll(result);
    
    const jsonReport = path.join(outputDir, 'results.json');
    const mdReport = path.join(outputDir, 'regression-report.md');
    
    try {
      await fs.access(jsonReport);
      await fs.access(mdReport);
    } catch (e) {
      throw new Error('报告文件未正确生成');
    }
    
    const jsonContent = await fs.readFile(jsonReport, 'utf-8');
    const parsed = JSON.parse(jsonContent);
    if (!parsed.statistics || !parsed.matches) {
      throw new Error('JSON报告结构不正确');
    }
  }

  async testExpectedComparison() {
    const outputDir = path.join(this.tempDir, 'comparison');
    
    const engine = new RegressionEngine({
      rules: path.join(this.demoDir, 'rules.json'),
      samples: path.join(this.demoDir, 'samples'),
      expected: path.join(this.demoDir, 'expected.json'),
      output: outputDir
    });

    const result = await engine.run();
    
    if (!result.statistics.accuracy) {
      throw new Error('应该计算准确率但未计算');
    }
    
    if (result.falseNegatives.length > 0) {
      console.log(chalk.yellow(`  注意: 检测到${result.falseNegatives.length}个漏报样本`));
    }
  }

  async cleanup() {
    try {
      await fs.rm(this.tempDir, { recursive: true, force: true });
    } catch (e) {}
  }
}

module.exports = SelfTester;
