import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { parseLogFile, parseJsonFile } from './parser';
import { normalizeFailure, calculateSimilarity } from './normalizer';
import { clusterFailures, buildClusterResult, createBaselineFromResult } from './clusterer';
import { printConsoleSummary, writeJsonReport, writeMarkdownReport } from './reporter';

const SAMPLE_LOG = `
===== TEST FAILED =====
Test: LoginPage.should_display_error_message
Error: AssertionError: expected 'Success' to equal 'Error'
    at Context.<anonymous> (tests/login.spec.js:42:21)
    at processImmediate (internal/timers.js:464:21)

===== TEST FAILED =====
Test: LoginPage.should_validate_email_format
Error: AssertionError: expected 'Success' to equal 'ValidationError'
    at Context.<anonymous> (tests/login.spec.js:58:15)
    at processImmediate (internal/timers.js:464:21)

===== TEST FAILED =====
Test: Dashboard.should_load_user_data
Error: TimeoutError: Timeout of 5000ms exceeded
    at Context.<anonymous> (tests/dashboard.spec.js:23:10)

===== TEST FAILED =====
Test: Dashboard.should_refresh_data
Error: TimeoutError: Timeout of 3000ms exceeded
    at Context.<anonymous> (tests/dashboard.spec.js:45:8)

This is a bad line that should be caught as parse error

===== TEST FAILED =====
Test: API.should_return_404_for_missing
Error: NetworkError: connect ECONNREFUSED 127.0.0.1:3000
    at ClientRequest.<anonymous> (node_modules/superagent/lib/node/index.js:892:15)
`;

const SAMPLE_JSON = `[
  {"testName": "LoginPage.test1", "errorMessage": "AssertionError: expected a to equal b"},
  {"testName": "LoginPage.test2", "errorMessage": "AssertionError: expected x to equal y"},
  {"missingFields": "this should fail"}
]`;

export async function runSelfTest(): Promise<boolean> {
  console.log('🧪 运行测试失败聚类 CLI 自检...\n');
  
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tfc-test-'));
  const logPath = path.join(tempDir, 'test-failures.log');
  const jsonPath = path.join(tempDir, 'test-failures.json');
  const outputJson = path.join(tempDir, 'result.json');
  const outputMd = path.join(tempDir, 'report.md');
  
  try {
    fs.writeFileSync(logPath, SAMPLE_LOG, 'utf-8');
    fs.writeFileSync(jsonPath, SAMPLE_JSON, 'utf-8');
    
    console.log('✅ 1/6 日志解析测试');
    const logResult = parseLogFile(logPath);
    console.log(`   - 成功解析 ${logResult.successes.length} 个失败条目`);
    console.log(`   - 捕获 ${logResult.errors.length} 个解析错误`);
    
    if (logResult.successes.length !== 5) {
      throw new Error(`预期解析 5 个失败，实际 ${logResult.successes.length}`);
    }
    if (logResult.errors.length === 0) {
      throw new Error('预期至少 1 个解析错误');
    }
    
    console.log('\n✅ 2/6 JSON 解析测试');
    const jsonResult = parseJsonFile(jsonPath);
    console.log(`   - 成功解析 ${jsonResult.successes.length} 个失败条目`);
    console.log(`   - 捕获 ${jsonResult.errors.length} 个解析错误`);
    
    if (jsonResult.errors.length !== 1) {
      throw new Error(`预期 1 个 JSON 解析错误，实际 ${jsonResult.errors.length}`);
    }
    
    console.log('\n✅ 3/6 归一化和相似度测试');
    const f1 = logResult.successes[0];
    const f2 = logResult.successes[1];
    const n1 = normalizeFailure(f1);
    const n2 = normalizeFailure(f2);
    const similarity = calculateSimilarity(n1, n2);
    console.log(`   - 提取特征数: ${n1.features.length}`);
    console.log(`   - 同类错误相似度: ${similarity.toFixed(2)}`);
    
    if (n1.features.length === 0) {
      throw new Error('预期提取至少一个特征');
    }
    if (similarity < 0.5) {
      throw new Error('同类错误相似度过低');
    }
    
    console.log('\n✅ 4/6 聚类算法测试');
    const clusters = clusterFailures(logResult.successes, 0.6);
    console.log(`   - 生成 ${clusters.length} 个聚类`);
    
    const assertionCluster = clusters.find(c => c.label.includes('AssertionError'));
    const timeoutCluster = clusters.find(c => c.label.includes('TimeoutError'));
    
    if (!assertionCluster || assertionCluster.frequency !== 2) {
      throw new Error('预期 AssertionError 应该聚类为一组');
    }
    if (!timeoutCluster || timeoutCluster.frequency !== 2) {
      throw new Error('预期 TimeoutError 应该聚类为一组');
    }
    
    console.log('\n✅ 5/6 基线对比测试');
    const initialResult = buildClusterResult(logResult, clusters);
    const baseline = createBaselineFromResult(initialResult);
    
    const newFailures = [...logResult.successes.slice(0, 3)];
    newFailures.push({
      id: 'new-one',
      testName: 'NewFeature.should_work',
      errorMessage: 'TypeError: Cannot read property of undefined',
      stackTrace: ''
    });
    
    const clustersWithBaseline = clusterFailures(newFailures, 0.6, baseline);
    const resultWithBaseline = buildClusterResult({ successes: newFailures, errors: [] }, clustersWithBaseline, baseline);
    
    console.log(`   - 基线指纹数: ${baseline.fingerprints.length}`);
    console.log(`   - 新增错误数: ${resultWithBaseline.newFailures}`);
    
    if (resultWithBaseline.newFailures !== 1) {
      throw new Error(`预期 1 个新增错误，实际 ${resultWithBaseline.newFailures}`);
    }
    
    console.log('\n✅ 6/6 报告生成测试');
    writeJsonReport(resultWithBaseline, outputJson);
    writeMarkdownReport(resultWithBaseline, outputMd);
    
    const jsonExists = fs.existsSync(outputJson);
    const mdExists = fs.existsSync(outputMd);
    console.log(`   - JSON 报告: ${jsonExists ? '生成成功' : '生成失败'}`);
    console.log(`   - Markdown 报告: ${mdExists ? '生成成功' : '生成失败'}`);
    
    if (!jsonExists || !mdExists) {
      throw new Error('报告生成失败');
    }
    
    console.log('\n' + '='.repeat(50));
    console.log('🎉 所有自检通过！');
    console.log('='.repeat(50));
    console.log('\n📋 终端输出预览：');
    printConsoleSummary(resultWithBaseline, false);
    
    return true;
    
  } catch (error: any) {
    console.error('\n❌ 自检失败:', error.message);
    console.error(error.stack);
    return false;
  } finally {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (e) {}
  }
}
