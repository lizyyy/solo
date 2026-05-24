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
exports.runSelfCheck = runSelfCheck;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const config_1 = require("./config");
const scanner_1 = require("./scanner");
const analyzer_1 = require("./analyzer");
const reporter_1 = require("./reporter");
const analyzer_2 = require("./analyzer");
function createTempTestFile(content, ext) {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flag-cleaner-test-'));
    const filePath = path.join(tempDir, `test${ext}`);
    fs.writeFileSync(filePath, content, 'utf-8');
    return filePath;
}
function cleanupTempFile(filePath) {
    const dir = path.dirname(filePath);
    try {
        fs.unlinkSync(filePath);
        fs.rmdirSync(dir);
    }
    catch {
        // ignore cleanup errors
    }
}
async function runSelfCheck() {
    const results = [];
    results.push(testFlagDefinitionLoading());
    results.push(testLanguageDetection());
    results.push(testLineNumberCalculation());
    results.push(testNegationDetection());
    results.push(testFlagMatchingTypescript());
    results.push(testFlagMatchingPython());
    results.push(testDefaultValueInversionDetection());
    results.push(testRiskLevelCalculation());
    results.push(testJsonReportGeneration());
    results.push(testMarkdownReportGeneration());
    results.push(testTerminalSummaryGeneration());
    results.push(testDynamicFlagPattern());
    results.push(testEmptyFlagAnalysis());
    results.push(testMultipleFileAnalysis());
    return results;
}
function testFlagDefinitionLoading() {
    try {
        const tempFile = createTempTestFile(JSON.stringify([
            {
                name: 'test_flag_1',
                defaultValue: true,
                status: 'completed',
                owner: 'test@example.com',
                description: 'Test flag'
            },
            {
                name: 'test_flag_2',
                defaultValue: false,
                status: 'active'
            }
        ]), '.json');
        const flags = (0, config_1.loadFlagDefinitions)(tempFile);
        cleanupTempFile(tempFile);
        return {
            name: 'Flag 定义文件加载',
            passed: flags.length === 2 && flags[0].name === 'test_flag_1' && flags[1].defaultValue === false,
            message: `成功加载 ${flags.length} 个 flag 定义`,
            details: { count: flags.length }
        };
    }
    catch (error) {
        return {
            name: 'Flag 定义文件加载',
            passed: false,
            message: `加载失败: ${error.message}`
        };
    }
}
function testLanguageDetection() {
    const testCases = [
        { file: 'test.ts', expected: 'typescript' },
        { file: 'test.js', expected: 'javascript' },
        { file: 'test.py', expected: 'python' },
        { file: 'test.go', expected: 'go' },
        { file: 'test.java', expected: 'java' },
        { file: 'test.unknown', expected: 'other' },
    ];
    try {
        const allPassed = testCases.every(tc => (0, scanner_1.detectLanguage)(tc.file) === tc.expected);
        return {
            name: '语言类型检测',
            passed: allPassed,
            message: allPassed ? '所有语言检测正确' : '部分语言检测失败',
            details: { testCases: testCases.length }
        };
    }
    catch (error) {
        return {
            name: '语言类型检测',
            passed: false,
            message: `检测失败: ${error.message}`
        };
    }
}
function testLineNumberCalculation() {
    try {
        const content = 'line1\nline2\nline3\nflag_here\nline5';
        const flagIndex = content.indexOf('flag_here');
        const lineNum = (0, scanner_1.getLineNumber)(content, flagIndex);
        return {
            name: '行号计算',
            passed: lineNum === 4,
            message: lineNum === 4 ? `行号计算正确: ${lineNum}` : `行号计算错误: 期望 4, 实际 ${lineNum}`,
            details: { expected: 4, actual: lineNum }
        };
    }
    catch (error) {
        return {
            name: '行号计算',
            passed: false,
            message: `计算失败: ${error.message}`
        };
    }
}
function testNegationDetection() {
    try {
        const content = 'if (!isEnabled("test_flag")) { ... }';
        const flagIndex = content.indexOf('test_flag');
        const isNegated = (0, scanner_1.isNegatedContext)(content, flagIndex, 'typescript');
        return {
            name: '否定上下文检测',
            passed: isNegated === true,
            message: isNegated ? '否定上下文检测正确' : '否定上下文检测失败',
            details: { isNegated }
        };
    }
    catch (error) {
        return {
            name: '否定上下文检测',
            passed: false,
            message: `检测失败: ${error.message}`
        };
    }
}
function testFlagMatchingTypescript() {
    try {
        const content = `
import { isEnabled } from './flags';

if (isEnabled('new_checkout')) {
  console.log('new checkout');
}

if (featureFlags.old_payment) {
  console.log('old payment');
}

const useNewUI = isFeatureEnabled("new_ui");
`;
        const tempFile = createTempTestFile(content, '.ts');
        const matches = (0, scanner_1.findAllFlagMatches)(tempFile, content, ['new_checkout', 'old_payment', 'new_ui'], []);
        cleanupTempFile(tempFile);
        return {
            name: 'TypeScript Flag 匹配',
            passed: matches.length >= 3,
            message: `匹配到 ${matches.length} 个 flag`,
            details: { matches: matches.map(m => ({ flag: m.flagName, line: m.lineNumber })) }
        };
    }
    catch (error) {
        return {
            name: 'TypeScript Flag 匹配',
            passed: false,
            message: `匹配失败: ${error.message}`
        };
    }
}
function testFlagMatchingPython() {
    try {
        const content = `
from flags import is_enabled

if is_enabled('new_feature'):
    print('new feature')

if feature_flags['old_feature']:
    print('old feature')
`;
        const tempFile = createTempTestFile(content, '.py');
        const matches = (0, scanner_1.findAllFlagMatches)(tempFile, content, ['new_feature', 'old_feature'], []);
        cleanupTempFile(tempFile);
        return {
            name: 'Python Flag 匹配',
            passed: matches.length >= 2,
            message: `匹配到 ${matches.length} 个 flag`,
            details: { matches: matches.map(m => ({ flag: m.flagName, line: m.lineNumber })) }
        };
    }
    catch (error) {
        return {
            name: 'Python Flag 匹配',
            passed: false,
            message: `匹配失败: ${error.message}`
        };
    }
}
function testDefaultValueInversionDetection() {
    try {
        const flag = {
            name: 'test_flag',
            defaultValue: true,
            status: 'completed'
        };
        const matches = [
            { flagName: 'test_flag', filePath: '', lineNumber: 1, column: 1, matchType: 'negated', context: '', isNegated: true, language: 'typescript' },
            { flagName: 'test_flag', filePath: '', lineNumber: 2, column: 1, matchType: 'negated', context: '', isNegated: true, language: 'typescript' },
            { flagName: 'test_flag', filePath: '', lineNumber: 3, column: 1, matchType: 'negated', context: '', isNegated: true, language: 'typescript' },
            { flagName: 'test_flag', filePath: '', lineNumber: 4, column: 1, matchType: 'direct', context: '', isNegated: false, language: 'typescript' },
        ];
        const { inverted } = (0, analyzer_1.detectDefaultValueInversion)(flag, matches);
        return {
            name: '默认值反转检测',
            passed: inverted === true,
            message: inverted ? '正确检测到默认值反转' : '未检测到默认值反转',
            details: { inverted }
        };
    }
    catch (error) {
        return {
            name: '默认值反转检测',
            passed: false,
            message: `检测失败: ${error.message}`
        };
    }
}
function testRiskLevelCalculation() {
    try {
        const flag = {
            name: 'test_flag',
            defaultValue: true,
            status: 'active'
        };
        const { level } = (0, analyzer_1.calculateRiskLevel)(flag, [], { defaultValueInverted: false, dynamicNameUsed: true });
        return {
            name: '风险等级计算',
            passed: level === 'high' || level === 'critical',
            message: `计算得到风险等级: ${level}`,
            details: { level }
        };
    }
    catch (error) {
        return {
            name: '风险等级计算',
            passed: false,
            message: `计算失败: ${error.message}`
        };
    }
}
function testJsonReportGeneration() {
    try {
        const mockResult = createMockAnalysisResult();
        const json = (0, reporter_1.generateJsonReport)(mockResult);
        const parsed = JSON.parse(json);
        return {
            name: 'JSON 报告生成',
            passed: parsed.summary && parsed.flags && Array.isArray(parsed.flags),
            message: 'JSON 报告生成成功',
            details: { hasSummary: !!parsed.summary, flagCount: parsed.flags?.length || 0 }
        };
    }
    catch (error) {
        return {
            name: 'JSON 报告生成',
            passed: false,
            message: `生成失败: ${error.message}`
        };
    }
}
function testMarkdownReportGeneration() {
    try {
        const mockResult = createMockAnalysisResult();
        const md = (0, reporter_1.generateMarkdownReport)(mockResult);
        const hasTitle = md.includes('# Feature Flag 死码分析报告');
        const hasSummary = md.includes('## 📊 扫描摘要');
        const hasRiskSection = md.includes('## 🎯 风险分布');
        return {
            name: 'Markdown 报告生成',
            passed: hasTitle && hasSummary && hasRiskSection,
            message: 'Markdown 报告生成成功',
            details: { hasTitle, hasSummary, hasRiskSection }
        };
    }
    catch (error) {
        return {
            name: 'Markdown 报告生成',
            passed: false,
            message: `生成失败: ${error.message}`
        };
    }
}
function testTerminalSummaryGeneration() {
    try {
        const mockResult = createMockAnalysisResult();
        const summary = (0, reporter_1.generateTerminalSummary)(mockResult, false);
        const hasSummary = summary.includes('扫描摘要');
        const hasAnalysis = summary.includes('分析结果');
        return {
            name: '终端摘要生成',
            passed: hasSummary && hasAnalysis,
            message: '终端摘要生成成功',
            details: { hasSummary, hasAnalysis, length: summary.length }
        };
    }
    catch (error) {
        return {
            name: '终端摘要生成',
            passed: false,
            message: `生成失败: ${error.message}`
        };
    }
}
function testDynamicFlagPattern() {
    try {
        const content = `
const flagName = getDynamicFlag();
if (isEnabled(flagName)) {
  console.log('dynamic flag');
}
`;
        const tempFile = createTempTestFile(content, '.ts');
        const dynamicPatterns = [/getDynamicFlag\(\)/g];
        const matches = (0, scanner_1.findAllFlagMatches)(tempFile, content, [], dynamicPatterns);
        cleanupTempFile(tempFile);
        return {
            name: '动态 Flag 模式匹配',
            passed: matches.length > 0,
            message: `匹配到 ${matches.length} 个动态 flag`,
            details: { matches: matches.map(m => ({ flag: m.flagName, line: m.lineNumber })) }
        };
    }
    catch (error) {
        return {
            name: '动态 Flag 模式匹配',
            passed: false,
            message: `匹配失败: ${error.message}`
        };
    }
}
function testEmptyFlagAnalysis() {
    try {
        const flag = {
            name: 'unused_flag',
            defaultValue: false,
            status: 'archived'
        };
        const options = (0, config_1.mergeScanOptions)({
            sourceDir: '/tmp',
            flagDefinitions: [flag],
            outputDir: '/tmp/output'
        });
        const analysis = (0, analyzer_1.analyzeFlag)(flag, [], options);
        return {
            name: '未使用 Flag 分析',
            passed: analysis.canRemove === true && analysis.totalOccurrences === 0 && analysis.riskLevel === 'safe',
            message: `未使用 flag 正确标记为可删除`,
            details: { canRemove: analysis.canRemove, riskLevel: analysis.riskLevel }
        };
    }
    catch (error) {
        return {
            name: '未使用 Flag 分析',
            passed: false,
            message: `分析失败: ${error.message}`
        };
    }
}
function testMultipleFileAnalysis() {
    try {
        const flags = [
            { name: 'flag1', defaultValue: true, status: 'completed' },
            { name: 'flag2', defaultValue: false, status: 'archived' },
        ];
        const matches = [
            { flagName: 'flag1', filePath: '/a.ts', lineNumber: 1, column: 1, matchType: 'direct', context: '', isNegated: false, language: 'typescript' },
            { flagName: 'flag1', filePath: '/b.ts', lineNumber: 2, column: 1, matchType: 'direct', context: '', isNegated: false, language: 'typescript' },
            { flagName: 'flag2', filePath: '/a.ts', lineNumber: 3, column: 1, matchType: 'direct', context: '', isNegated: false, language: 'typescript' },
        ];
        const options = (0, config_1.mergeScanOptions)({
            sourceDir: '/tmp',
            flagDefinitions: flags,
            outputDir: '/tmp/output'
        });
        const result = (0, analyzer_2.analyzeAllFlags)(flags, matches, options, ['/a.ts', '/b.ts'], [], Date.now());
        return {
            name: '多文件综合分析',
            passed: result.summary.totalFlags === 2 && result.summary.totalMatches === 3,
            message: `多文件分析正确: ${result.summary.totalFlags} 个 flag, ${result.summary.totalMatches} 次匹配`,
            details: {
                totalFlags: result.summary.totalFlags,
                totalMatches: result.summary.totalMatches,
                filesScanned: result.summary.filesScanned
            }
        };
    }
    catch (error) {
        return {
            name: '多文件综合分析',
            passed: false,
            message: `分析失败: ${error.message}`
        };
    }
}
function createMockAnalysisResult() {
    const flags = [
        {
            name: 'completed_flag',
            defaultValue: true,
            status: 'completed',
            owner: 'dev@example.com',
            description: '已完成的实验'
        },
        {
            name: 'active_flag',
            defaultValue: false,
            status: 'active',
            description: '进行中的实验'
        }
    ];
    const options = (0, config_1.mergeScanOptions)({
        sourceDir: '/tmp/test',
        flagDefinitions: flags,
        outputDir: '/tmp/output'
    });
    return (0, analyzer_2.analyzeAllFlags)(flags, [
        { flagName: 'completed_flag', filePath: '/tmp/test/a.ts', lineNumber: 1, column: 1, matchType: 'direct', context: '', isNegated: false, language: 'typescript' },
        { flagName: 'active_flag', filePath: '/tmp/test/b.ts', lineNumber: 2, column: 1, matchType: 'direct', context: '', isNegated: false, language: 'typescript' },
    ], options, ['/tmp/test/a.ts', '/tmp/test/b.ts'], [], Date.now() - 100);
}
//# sourceMappingURL=self-check.js.map