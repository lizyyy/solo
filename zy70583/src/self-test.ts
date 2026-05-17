import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { DataParser } from './parser';
import { Denoiser } from './denoiser';
import { Reporter } from './reporter';
import { Alert, Rule, Silence } from './types';

export class SelfTester {
  private tempDir: string;
  private passed = 0;
  private failed = 0;

  constructor() {
    this.tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'alert-denoiser-test-'));
  }

  async runAllTests(): Promise<boolean> {
    console.log('');
    console.log('═'.repeat(80));
    console.log('  Alert规则消噪CLI - 自检模式');
    console.log('═'.repeat(80));
    console.log('');
    console.log(`测试目录: ${this.tempDir}`);
    console.log('');

    try {
      await this.testJsonParsing();
      await this.testCsvParsing();
      await this.testBadRowHandling();
      await this.testNoiseScoring();
      await this.testSilenceMatching();
      await this.testReportGeneration();
      await this.testEdgeCases();

      console.log('');
      console.log('═'.repeat(80));
      console.log(`  测试结果: ${this.passed} 通过, ${this.failed} 失败`);
      console.log('═'.repeat(80));
      console.log('');

      return this.failed === 0;
    } finally {
      this.cleanup();
    }
  }

  private async testJsonParsing(): Promise<void> {
    console.log('🧪 测试1: JSON格式解析...');

    const alerts: Alert[] = this.generateTestAlerts(50);
    const rules: Rule[] = this.generateTestRules(10);
    const silences: Silence[] = this.generateTestSilences(5);

    const alertsPath = path.join(this.tempDir, 'alerts.json');
    const rulesPath = path.join(this.tempDir, 'rules.json');
    const silencesPath = path.join(this.tempDir, 'silences.json');

    fs.writeFileSync(alertsPath, JSON.stringify(alerts));
    fs.writeFileSync(rulesPath, JSON.stringify(rules));
    fs.writeFileSync(silencesPath, JSON.stringify(silences));

    const parser = new DataParser();
    const parsedAlerts = parser.parseAlerts(alertsPath);
    const parsedRules = parser.parseRules(rulesPath);
    const parsedSilences = parser.parseSilences(silencesPath);
    const errors = parser.getParseErrors();

    if (parsedAlerts.length === 50 && parsedRules.length === 10 && parsedSilences.length === 5 && errors.length === 0) {
      this.pass(`JSON解析正常 - 告警:${parsedAlerts.length}, 规则:${parsedRules.length}, 静默:${parsedSilences.length}`);
    } else {
      this.fail(`JSON解析异常 - 错误:${errors.length}`);
    }
  }

  private async testCsvParsing(): Promise<void> {
    console.log('🧪 测试2: CSV格式解析...');

    const alertsCsv = [
      'id,ruleId,ruleName,severity,timestamp,labels',
      'a1,r1,HighCPU,critical,1700000000000,"{""env"":""prod""}"',
      'a2,r1,HighCPU,critical,1700000100000,"{""env"":""prod""}"',
      'a3,r2,LowMemory,warning,1700000200000,"{""env"":""staging""}"',
    ].join('\n');

    const csvPath = path.join(this.tempDir, 'alerts.csv');
    fs.writeFileSync(csvPath, alertsCsv);

    const parser = new DataParser();
    const parsedAlerts = parser.parseAlerts(csvPath);
    const errors = parser.getParseErrors();

    if (parsedAlerts.length === 3 && errors.length === 0) {
      this.pass(`CSV解析正常 - 告警:${parsedAlerts.length}`);
    } else {
      this.fail(`CSV解析异常 - 错误:${errors.length}, 告警数:${parsedAlerts.length}`);
    }
  }

  private async testBadRowHandling(): Promise<void> {
    console.log('🧪 测试3: 坏行和异常样本处理...');

    const alertsWithErrors = [
      { ruleId: 'r1', ruleName: 'ValidAlert', severity: 'info' },
      'this is not a valid json object',
      { ruleName: '' },
      { ruleId: 'r2', ruleName: 'AnotherValid', severity: 'warning' },
    ];

    const jsonContent = JSON.stringify(alertsWithErrors);
    const filePath = path.join(this.tempDir, 'bad-alerts.json');
    fs.writeFileSync(filePath, jsonContent);

    const parser = new DataParser();
    const parsedAlerts = parser.parseAlerts(filePath);
    const errors = parser.getParseErrors();

    if (parsedAlerts.length >= 2 && errors.length >= 1) {
      this.pass(`坏行处理正常 - 有效:${parsedAlerts.length}, 错误:${errors.length}`);
      errors.forEach((e, i) => {
        console.log(`   ${i + 1}. 行${e.lineNumber}: ${e.error}`);
      });
    } else {
      this.fail(`坏行处理异常 - 有效:${parsedAlerts.length}, 错误:${errors.length}`);
    }
  }

  private async testNoiseScoring(): Promise<void> {
    console.log('🧪 测试4: 噪声评分算法...');

    const noisyAlerts = this.generateTestAlerts(200, 'noisy-rule');
    const normalAlerts = this.generateTestAlerts(5, 'normal-rule');

    const denoiser = new Denoiser([...noisyAlerts, ...normalAlerts], [], [], 50);
    const aggregations = denoiser.aggregateAlerts();
    const scores = denoiser.calculateNoiseScores(aggregations);

    const noisyScore = scores.find((s) => s.ruleName === 'noisy-rule-0');
    const normalScore = scores.find((s) => s.ruleName === 'normal-rule-0');

    if (noisyScore && normalScore && noisyScore.totalScore > normalScore.totalScore) {
      this.pass(`噪声评分正常 - 高噪声:${noisyScore.totalScore}, 低噪声:${normalScore.totalScore}`);
    } else {
      this.fail('噪声评分异常');
    }
  }

  private async testSilenceMatching(): Promise<void> {
    console.log('🧪 测试5: 静默规则匹配...');

    const alerts: Alert[] = [
      {
        id: 'a1',
        ruleId: 'r1',
        ruleName: 'TestAlert',
        severity: 'warning',
        timestamp: Date.now(),
        labels: { env: 'prod', service: 'api' },
        annotations: {},
      },
    ];

    const silences: Silence[] = [
      {
        id: 's1',
        comment: '静默prod环境',
        createdBy: 'test',
        startsAt: Date.now(),
        endsAt: Date.now() + 86400000,
        status: 'active',
        matchers: [{ name: 'env', value: 'prod', isRegex: false, isEqual: true }],
      },
    ];

    const denoiser = new Denoiser(alerts, [], silences, 50);
    const aggregations = denoiser.aggregateAlerts();
    const matches = denoiser.matchSilences(aggregations);

    if (matches[0]?.matches.length === 1) {
      this.pass(`静默匹配正常 - 匹配数:${matches[0].matches.length}`);
    } else {
      this.fail(`静默匹配异常 - 匹配数:${matches[0]?.matches.length || 0}`);
    }
  }

  private async testReportGeneration(): Promise<void> {
    console.log('🧪 测试6: 报告生成...');

    const alerts = this.generateTestAlerts(100);
    const rules = this.generateTestRules(5);
    const silences = this.generateTestSilences(2);

    const denoiser = new Denoiser(alerts, rules, silences, 50);
    const aggregations = denoiser.aggregateAlerts();
    const matchedSilences = denoiser.matchSilences(aggregations);
    const noiseScores = denoiser.calculateNoiseScores(aggregations);
    const candidates = denoiser.generateCandidates(noiseScores, matchedSilences);

    const reporter = new Reporter({
      metadata: {
        generatedAt: Date.now(),
        inputFiles: {},
        totalAlerts: alerts.length,
        totalRules: rules.length,
        totalSilences: silences.length,
      },
      aggregations,
      noiseScores,
      matchedSilences,
      candidates,
      parseErrors: [],
    });

    const terminalOutput = reporter.generateTerminalSummary();
    const jsonOutput = reporter.generateJsonReport(false);
    const markdownOutput = reporter.generateMarkdownReport();

    if (terminalOutput.length > 0 && jsonOutput.length > 0 && markdownOutput.length > 0) {
      this.pass('报告生成正常 - 三种格式均已生成');
    } else {
      this.fail('报告生成异常');
    }
  }

  private async testEdgeCases(): Promise<void> {
    console.log('🧪 测试7: 边界情况...');

    let allPassed = true;

    const denoiser1 = new Denoiser([], [], [], 50);
    const aggregations1 = denoiser1.aggregateAlerts();
    if (aggregations1.length === 0) {
      this.pass('  - 空输入正常');
    } else {
      this.fail('  - 空输入异常');
      allPassed = false;
    }

    const singleAlert: Alert[] = [
      { id: 'a1', ruleId: 'r1', ruleName: 'Single', severity: 'info', timestamp: Date.now(), labels: {}, annotations: {} },
    ];
    const denoiser2 = new Denoiser(singleAlert, [], [], 50);
    const scores2 = denoiser2.calculateNoiseScores(denoiser2.aggregateAlerts());
    if (scores2.length === 1) {
      this.pass('  - 单条告警正常');
    } else {
      this.fail('  - 单条告警异常');
      allPassed = false;
    }

    const manyLabels: Alert[] = [];
    for (let i = 0; i < 10; i++) {
      manyLabels.push({
        id: `a${i}`,
        ruleId: 'r1',
        ruleName: 'ManyLabels',
        severity: 'warning',
        timestamp: Date.now(),
        labels: { [`label${i}`]: `value${i}` },
        annotations: {},
      });
    }
    const denoiser3 = new Denoiser(manyLabels, [], [], 50);
    const aggregations3 = denoiser3.aggregateAlerts();
    if (aggregations3[0]?.totalCount === 10) {
      this.pass('  - 多标签聚合正常');
    } else {
      this.fail('  - 多标签聚合异常');
      allPassed = false;
    }

    if (allPassed) {
      this.pass('边界情况测试全部通过');
    }
  }

  private generateTestAlerts(count: number, rulePrefix: string = 'test-rule'): Alert[] {
    const alerts: Alert[] = [];
    for (let i = 0; i < count; i++) {
      const ruleIndex = i % 10;
      alerts.push({
        id: `alert-${i}`,
        ruleId: `${rulePrefix}-${ruleIndex}`,
        ruleName: `${rulePrefix}-${ruleIndex}`,
        severity: ['critical', 'warning', 'info'][i % 3] as any,
        timestamp: Date.now() - i * 60000,
        labels: {
          env: ['prod', 'staging', 'dev'][i % 3],
          service: `service-${i % 5}`,
        },
        annotations: {
          summary: `Test alert ${i}`,
        },
        fingerprint: `fp-${i % 20}`,
      });
    }
    return alerts;
  }

  private generateTestRules(count: number): Rule[] {
    const rules: Rule[] = [];
    for (let i = 0; i < count; i++) {
      rules.push({
        id: `rule-${i}`,
        name: `test-rule-${i}`,
        expr: `sum(rate(metric_total[5m])) > ${i + 1}`,
        severity: ['critical', 'warning', 'info'][i % 3],
        labels: { team: `team-${i % 3}` },
        annotations: { description: `Rule ${i}` },
      });
    }
    return rules;
  }

  private generateTestSilences(count: number): Silence[] {
    const silences: Silence[] = [];
    for (let i = 0; i < count; i++) {
      silences.push({
        id: `silence-${i}`,
        comment: `Test silence ${i}`,
        createdBy: `user${i}`,
        startsAt: Date.now(),
        endsAt: Date.now() + 86400000,
        status: 'active',
        matchers: [
          { name: 'env', value: ['prod', 'staging', 'dev'][i % 3], isRegex: false, isEqual: true },
        ],
      });
    }
    return silences;
  }

  private pass(message: string): void {
    console.log(`  ✅ ${message}`);
    this.passed++;
  }

  private fail(message: string): void {
    console.log(`  ❌ ${message}`);
    this.failed++;
  }

  private cleanup(): void {
    try {
      fs.rmSync(this.tempDir, { recursive: true, force: true });
    } catch {
    }
  }
}