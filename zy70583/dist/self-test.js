"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.SelfTester = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const parser_1 = require("./parser");
const denoiser_1 = require("./denoiser");
const reporter_1 = require("./reporter");
class SelfTester {
    tempDir;
    passed = 0;
    failed = 0;
    constructor() {
        this.tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'alert-denoiser-test-'));
    }
    async runAllTests() {
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
        }
        finally {
            this.cleanup();
        }
    }
    async testJsonParsing() {
        console.log('🧪 测试1: JSON格式解析...');
        const alerts = this.generateTestAlerts(50);
        const rules = this.generateTestRules(10);
        const silences = this.generateTestSilences(5);
        const alertsPath = path.join(this.tempDir, 'alerts.json');
        const rulesPath = path.join(this.tempDir, 'rules.json');
        const silencesPath = path.join(this.tempDir, 'silences.json');
        fs.writeFileSync(alertsPath, JSON.stringify(alerts));
        fs.writeFileSync(rulesPath, JSON.stringify(rules));
        fs.writeFileSync(silencesPath, JSON.stringify(silences));
        const parser = new parser_1.DataParser();
        const parsedAlerts = parser.parseAlerts(alertsPath);
        const parsedRules = parser.parseRules(rulesPath);
        const parsedSilences = parser.parseSilences(silencesPath);
        const errors = parser.getParseErrors();
        if (parsedAlerts.length === 50 && parsedRules.length === 10 && parsedSilences.length === 5 && errors.length === 0) {
            this.pass(`JSON解析正常 - 告警:${parsedAlerts.length}, 规则:${parsedRules.length}, 静默:${parsedSilences.length}`);
        }
        else {
            this.fail(`JSON解析异常 - 错误:${errors.length}`);
        }
    }
    async testCsvParsing() {
        console.log('🧪 测试2: CSV格式解析...');
        const alertsCsv = [
            'id,ruleId,ruleName,severity,timestamp,labels',
            'a1,r1,HighCPU,critical,1700000000000,"{""env"":""prod""}"',
            'a2,r1,HighCPU,critical,1700000100000,"{""env"":""prod""}"',
            'a3,r2,LowMemory,warning,1700000200000,"{""env"":""staging""}"',
        ].join('\n');
        const csvPath = path.join(this.tempDir, 'alerts.csv');
        fs.writeFileSync(csvPath, alertsCsv);
        const parser = new parser_1.DataParser();
        const parsedAlerts = parser.parseAlerts(csvPath);
        const errors = parser.getParseErrors();
        if (parsedAlerts.length === 3 && errors.length === 0) {
            this.pass(`CSV解析正常 - 告警:${parsedAlerts.length}`);
        }
        else {
            this.fail(`CSV解析异常 - 错误:${errors.length}, 告警数:${parsedAlerts.length}`);
        }
    }
    async testBadRowHandling() {
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
        const parser = new parser_1.DataParser();
        const parsedAlerts = parser.parseAlerts(filePath);
        const errors = parser.getParseErrors();
        if (parsedAlerts.length >= 2 && errors.length >= 1) {
            this.pass(`坏行处理正常 - 有效:${parsedAlerts.length}, 错误:${errors.length}`);
            errors.forEach((e, i) => {
                console.log(`   ${i + 1}. 行${e.lineNumber}: ${e.error}`);
            });
        }
        else {
            this.fail(`坏行处理异常 - 有效:${parsedAlerts.length}, 错误:${errors.length}`);
        }
    }
    async testNoiseScoring() {
        console.log('🧪 测试4: 噪声评分算法...');
        const noisyAlerts = this.generateTestAlerts(200, 'noisy-rule');
        const normalAlerts = this.generateTestAlerts(5, 'normal-rule');
        const denoiser = new denoiser_1.Denoiser([...noisyAlerts, ...normalAlerts], [], [], 50);
        const aggregations = denoiser.aggregateAlerts();
        const scores = denoiser.calculateNoiseScores(aggregations);
        const noisyScore = scores.find((s) => s.ruleName === 'noisy-rule-0');
        const normalScore = scores.find((s) => s.ruleName === 'normal-rule-0');
        if (noisyScore && normalScore && noisyScore.totalScore > normalScore.totalScore) {
            this.pass(`噪声评分正常 - 高噪声:${noisyScore.totalScore}, 低噪声:${normalScore.totalScore}`);
        }
        else {
            this.fail('噪声评分异常');
        }
    }
    async testSilenceMatching() {
        console.log('🧪 测试5: 静默规则匹配...');
        const alerts = [
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
        const silences = [
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
        const denoiser = new denoiser_1.Denoiser(alerts, [], silences, 50);
        const aggregations = denoiser.aggregateAlerts();
        const matches = denoiser.matchSilences(aggregations);
        if (matches[0]?.matches.length === 1) {
            this.pass(`静默匹配正常 - 匹配数:${matches[0].matches.length}`);
        }
        else {
            this.fail(`静默匹配异常 - 匹配数:${matches[0]?.matches.length || 0}`);
        }
    }
    async testReportGeneration() {
        console.log('🧪 测试6: 报告生成...');
        const alerts = this.generateTestAlerts(100);
        const rules = this.generateTestRules(5);
        const silences = this.generateTestSilences(2);
        const denoiser = new denoiser_1.Denoiser(alerts, rules, silences, 50);
        const aggregations = denoiser.aggregateAlerts();
        const matchedSilences = denoiser.matchSilences(aggregations);
        const noiseScores = denoiser.calculateNoiseScores(aggregations);
        const candidates = denoiser.generateCandidates(noiseScores, matchedSilences);
        const reporter = new reporter_1.Reporter({
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
        }
        else {
            this.fail('报告生成异常');
        }
    }
    async testEdgeCases() {
        console.log('🧪 测试7: 边界情况...');
        let allPassed = true;
        const denoiser1 = new denoiser_1.Denoiser([], [], [], 50);
        const aggregations1 = denoiser1.aggregateAlerts();
        if (aggregations1.length === 0) {
            this.pass('  - 空输入正常');
        }
        else {
            this.fail('  - 空输入异常');
            allPassed = false;
        }
        const singleAlert = [
            { id: 'a1', ruleId: 'r1', ruleName: 'Single', severity: 'info', timestamp: Date.now(), labels: {}, annotations: {} },
        ];
        const denoiser2 = new denoiser_1.Denoiser(singleAlert, [], [], 50);
        const scores2 = denoiser2.calculateNoiseScores(denoiser2.aggregateAlerts());
        if (scores2.length === 1) {
            this.pass('  - 单条告警正常');
        }
        else {
            this.fail('  - 单条告警异常');
            allPassed = false;
        }
        const manyLabels = [];
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
        const denoiser3 = new denoiser_1.Denoiser(manyLabels, [], [], 50);
        const aggregations3 = denoiser3.aggregateAlerts();
        if (aggregations3[0]?.totalCount === 10) {
            this.pass('  - 多标签聚合正常');
        }
        else {
            this.fail('  - 多标签聚合异常');
            allPassed = false;
        }
        if (allPassed) {
            this.pass('边界情况测试全部通过');
        }
    }
    generateTestAlerts(count, rulePrefix = 'test-rule') {
        const alerts = [];
        for (let i = 0; i < count; i++) {
            const ruleIndex = i % 10;
            alerts.push({
                id: `alert-${i}`,
                ruleId: `${rulePrefix}-${ruleIndex}`,
                ruleName: `${rulePrefix}-${ruleIndex}`,
                severity: ['critical', 'warning', 'info'][i % 3],
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
    generateTestRules(count) {
        const rules = [];
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
    generateTestSilences(count) {
        const silences = [];
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
    pass(message) {
        console.log(`  ✅ ${message}`);
        this.passed++;
    }
    fail(message) {
        console.log(`  ❌ ${message}`);
        this.failed++;
    }
    cleanup() {
        try {
            fs.rmSync(this.tempDir, { recursive: true, force: true });
        }
        catch {
        }
    }
}
exports.SelfTester = SelfTester;
