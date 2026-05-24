import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { SelfCheckResult, FlagDefinition, ScanOptions } from './types';
import { loadFlagDefinitions, mergeScanOptions } from './config';
import { detectLanguage, findAllFlagMatches, readFileContent, getLineNumber, isNegatedContext } from './scanner';
import { detectDefaultValueInversion, calculateRiskLevel, analyzeFlag } from './analyzer';
import { generateJsonReport, generateMarkdownReport, generateTerminalSummary } from './reporter';
import { analyzeAllFlags } from './analyzer';

function createTempTestFile(content: string, ext: string): string {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flag-cleaner-test-'));
  const filePath = path.join(tempDir, `test${ext}`);
  fs.writeFileSync(filePath, content, 'utf-8');
  return filePath;
}

function cleanupTempFile(filePath: string): void {
  const dir = path.dirname(filePath);
  try {
    fs.unlinkSync(filePath);
    fs.rmdirSync(dir);
  } catch {
    // ignore cleanup errors
  }
}

export async function runSelfCheck(): Promise<SelfCheckResult[]> {
  const results: SelfCheckResult[] = [];

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

function testFlagDefinitionLoading(): SelfCheckResult {
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

    const flags = loadFlagDefinitions(tempFile);
    cleanupTempFile(tempFile);

    return {
      name: 'Flag 定义文件加载',
      passed: flags.length === 2 && flags[0].name === 'test_flag_1' && flags[1].defaultValue === false,
      message: `成功加载 ${flags.length} 个 flag 定义`,
      details: { count: flags.length }
    };
  } catch (error) {
    return {
      name: 'Flag 定义文件加载',
      passed: false,
      message: `加载失败: ${(error as Error).message}`
    };
  }
}

function testLanguageDetection(): SelfCheckResult {
  const testCases = [
    { file: 'test.ts', expected: 'typescript' },
    { file: 'test.js', expected: 'javascript' },
    { file: 'test.py', expected: 'python' },
    { file: 'test.go', expected: 'go' },
    { file: 'test.java', expected: 'java' },
    { file: 'test.unknown', expected: 'other' },
  ];

  try {
    const allPassed = testCases.every(tc => detectLanguage(tc.file) === tc.expected);
    return {
      name: '语言类型检测',
      passed: allPassed,
      message: allPassed ? '所有语言检测正确' : '部分语言检测失败',
      details: { testCases: testCases.length }
    };
  } catch (error) {
    return {
      name: '语言类型检测',
      passed: false,
      message: `检测失败: ${(error as Error).message}`
    };
  }
}

function testLineNumberCalculation(): SelfCheckResult {
  try {
    const content = 'line1\nline2\nline3\nflag_here\nline5';
    const flagIndex = content.indexOf('flag_here');
    const lineNum = getLineNumber(content, flagIndex);
    
    return {
      name: '行号计算',
      passed: lineNum === 4,
      message: lineNum === 4 ? `行号计算正确: ${lineNum}` : `行号计算错误: 期望 4, 实际 ${lineNum}`,
      details: { expected: 4, actual: lineNum }
    };
  } catch (error) {
    return {
      name: '行号计算',
      passed: false,
      message: `计算失败: ${(error as Error).message}`
    };
  }
}

function testNegationDetection(): SelfCheckResult {
  try {
    const content = 'if (!isEnabled("test_flag")) { ... }';
    const flagIndex = content.indexOf('test_flag');
    const isNegated = isNegatedContext(content, flagIndex, 'typescript');
    
    return {
      name: '否定上下文检测',
      passed: isNegated === true,
      message: isNegated ? '否定上下文检测正确' : '否定上下文检测失败',
      details: { isNegated }
    };
  } catch (error) {
    return {
      name: '否定上下文检测',
      passed: false,
      message: `检测失败: ${(error as Error).message}`
    };
  }
}

function testFlagMatchingTypescript(): SelfCheckResult {
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
    const matches = findAllFlagMatches(tempFile, content, ['new_checkout', 'old_payment', 'new_ui'], []);
    cleanupTempFile(tempFile);

    return {
      name: 'TypeScript Flag 匹配',
      passed: matches.length >= 3,
      message: `匹配到 ${matches.length} 个 flag`,
      details: { matches: matches.map(m => ({ flag: m.flagName, line: m.lineNumber })) }
    };
  } catch (error) {
    return {
      name: 'TypeScript Flag 匹配',
      passed: false,
      message: `匹配失败: ${(error as Error).message}`
    };
  }
}

function testFlagMatchingPython(): SelfCheckResult {
  try {
    const content = `
from flags import is_enabled

if is_enabled('new_feature'):
    print('new feature')

if feature_flags['old_feature']:
    print('old feature')
`;
    const tempFile = createTempTestFile(content, '.py');
    const matches = findAllFlagMatches(tempFile, content, ['new_feature', 'old_feature'], []);
    cleanupTempFile(tempFile);

    return {
      name: 'Python Flag 匹配',
      passed: matches.length >= 2,
      message: `匹配到 ${matches.length} 个 flag`,
      details: { matches: matches.map(m => ({ flag: m.flagName, line: m.lineNumber })) }
    };
  } catch (error) {
    return {
      name: 'Python Flag 匹配',
      passed: false,
      message: `匹配失败: ${(error as Error).message}`
    };
  }
}

function testDefaultValueInversionDetection(): SelfCheckResult {
  try {
    const flag: FlagDefinition = {
      name: 'test_flag',
      defaultValue: true,
      status: 'completed'
    };

    const matches = [
      { flagName: 'test_flag', filePath: '', lineNumber: 1, column: 1, matchType: 'negated' as const, context: '', isNegated: true, language: 'typescript' as const },
      { flagName: 'test_flag', filePath: '', lineNumber: 2, column: 1, matchType: 'negated' as const, context: '', isNegated: true, language: 'typescript' as const },
      { flagName: 'test_flag', filePath: '', lineNumber: 3, column: 1, matchType: 'negated' as const, context: '', isNegated: true, language: 'typescript' as const },
      { flagName: 'test_flag', filePath: '', lineNumber: 4, column: 1, matchType: 'direct' as const, context: '', isNegated: false, language: 'typescript' as const },
    ];

    const { inverted } = detectDefaultValueInversion(flag, matches);

    return {
      name: '默认值反转检测',
      passed: inverted === true,
      message: inverted ? '正确检测到默认值反转' : '未检测到默认值反转',
      details: { inverted }
    };
  } catch (error) {
    return {
      name: '默认值反转检测',
      passed: false,
      message: `检测失败: ${(error as Error).message}`
    };
  }
}

function testRiskLevelCalculation(): SelfCheckResult {
  try {
    const flag: FlagDefinition = {
      name: 'test_flag',
      defaultValue: true,
      status: 'active'
    };

    const { level } = calculateRiskLevel(flag, [], { defaultValueInverted: false, dynamicNameUsed: true });

    return {
      name: '风险等级计算',
      passed: level === 'high' || level === 'critical',
      message: `计算得到风险等级: ${level}`,
      details: { level }
    };
  } catch (error) {
    return {
      name: '风险等级计算',
      passed: false,
      message: `计算失败: ${(error as Error).message}`
    };
  }
}

function testJsonReportGeneration(): SelfCheckResult {
  try {
    const mockResult = createMockAnalysisResult();
    const json = generateJsonReport(mockResult);
    const parsed = JSON.parse(json);

    return {
      name: 'JSON 报告生成',
      passed: parsed.summary && parsed.flags && Array.isArray(parsed.flags),
      message: 'JSON 报告生成成功',
      details: { hasSummary: !!parsed.summary, flagCount: parsed.flags?.length || 0 }
    };
  } catch (error) {
    return {
      name: 'JSON 报告生成',
      passed: false,
      message: `生成失败: ${(error as Error).message}`
    };
  }
}

function testMarkdownReportGeneration(): SelfCheckResult {
  try {
    const mockResult = createMockAnalysisResult();
    const md = generateMarkdownReport(mockResult);

    const hasTitle = md.includes('# Feature Flag 死码分析报告');
    const hasSummary = md.includes('## 📊 扫描摘要');
    const hasRiskSection = md.includes('## 🎯 风险分布');

    return {
      name: 'Markdown 报告生成',
      passed: hasTitle && hasSummary && hasRiskSection,
      message: 'Markdown 报告生成成功',
      details: { hasTitle, hasSummary, hasRiskSection }
    };
  } catch (error) {
    return {
      name: 'Markdown 报告生成',
      passed: false,
      message: `生成失败: ${(error as Error).message}`
    };
  }
}

function testTerminalSummaryGeneration(): SelfCheckResult {
  try {
    const mockResult = createMockAnalysisResult();
    const summary = generateTerminalSummary(mockResult, false);

    const hasSummary = summary.includes('扫描摘要');
    const hasAnalysis = summary.includes('分析结果');

    return {
      name: '终端摘要生成',
      passed: hasSummary && hasAnalysis,
      message: '终端摘要生成成功',
      details: { hasSummary, hasAnalysis, length: summary.length }
    };
  } catch (error) {
    return {
      name: '终端摘要生成',
      passed: false,
      message: `生成失败: ${(error as Error).message}`
    };
  }
}

function testDynamicFlagPattern(): SelfCheckResult {
  try {
    const content = `
const flagName = getDynamicFlag();
if (isEnabled(flagName)) {
  console.log('dynamic flag');
}
`;
    const tempFile = createTempTestFile(content, '.ts');
    const dynamicPatterns = [/getDynamicFlag\(\)/g];
    const matches = findAllFlagMatches(tempFile, content, [], dynamicPatterns);
    cleanupTempFile(tempFile);

    return {
      name: '动态 Flag 模式匹配',
      passed: matches.length > 0,
      message: `匹配到 ${matches.length} 个动态 flag`,
      details: { matches: matches.map(m => ({ flag: m.flagName, line: m.lineNumber })) }
    };
  } catch (error) {
    return {
      name: '动态 Flag 模式匹配',
      passed: false,
      message: `匹配失败: ${(error as Error).message}`
    };
  }
}

function testEmptyFlagAnalysis(): SelfCheckResult {
  try {
    const flag: FlagDefinition = {
      name: 'unused_flag',
      defaultValue: false,
      status: 'archived'
    };

    const options: ScanOptions = mergeScanOptions({
      sourceDir: '/tmp',
      flagDefinitions: [flag],
      outputDir: '/tmp/output'
    });

    const analysis = analyzeFlag(flag, [], options);

    return {
      name: '未使用 Flag 分析',
      passed: analysis.canRemove === true && analysis.totalOccurrences === 0 && analysis.riskLevel === 'safe',
      message: `未使用 flag 正确标记为可删除`,
      details: { canRemove: analysis.canRemove, riskLevel: analysis.riskLevel }
    };
  } catch (error) {
    return {
      name: '未使用 Flag 分析',
      passed: false,
      message: `分析失败: ${(error as Error).message}`
    };
  }
}

function testMultipleFileAnalysis(): SelfCheckResult {
  try {
    const flags: FlagDefinition[] = [
      { name: 'flag1', defaultValue: true, status: 'completed' },
      { name: 'flag2', defaultValue: false, status: 'archived' },
    ];

    const matches = [
      { flagName: 'flag1', filePath: '/a.ts', lineNumber: 1, column: 1, matchType: 'direct' as const, context: '', isNegated: false, language: 'typescript' as const },
      { flagName: 'flag1', filePath: '/b.ts', lineNumber: 2, column: 1, matchType: 'direct' as const, context: '', isNegated: false, language: 'typescript' as const },
      { flagName: 'flag2', filePath: '/a.ts', lineNumber: 3, column: 1, matchType: 'direct' as const, context: '', isNegated: false, language: 'typescript' as const },
    ];

    const options: ScanOptions = mergeScanOptions({
      sourceDir: '/tmp',
      flagDefinitions: flags,
      outputDir: '/tmp/output'
    });

    const result = analyzeAllFlags(flags, matches, options, ['/a.ts', '/b.ts'], [], Date.now());

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
  } catch (error) {
    return {
      name: '多文件综合分析',
      passed: false,
      message: `分析失败: ${(error as Error).message}`
    };
  }
}

function createMockAnalysisResult() {
  const flags: FlagDefinition[] = [
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

  const options: ScanOptions = mergeScanOptions({
    sourceDir: '/tmp/test',
    flagDefinitions: flags,
    outputDir: '/tmp/output'
  });

  return analyzeAllFlags(
    flags,
    [
      { flagName: 'completed_flag', filePath: '/tmp/test/a.ts', lineNumber: 1, column: 1, matchType: 'direct' as const, context: '', isNegated: false, language: 'typescript' as const },
      { flagName: 'active_flag', filePath: '/tmp/test/b.ts', lineNumber: 2, column: 1, matchType: 'direct' as const, context: '', isNegated: false, language: 'typescript' as const },
    ],
    options,
    ['/tmp/test/a.ts', '/tmp/test/b.ts'],
    [],
    Date.now() - 100
  );
}
