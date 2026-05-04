import * as path from 'path';
import * as fs from 'fs';
import {
  CaseInfo,
  ManifestEntry,
  HashEntry,
  RulesConfig,
  ValidationResult,
  Issue,
  ConfigPaths
} from '../types';
import {
  parseCasesCsv,
  parseManifestJsonl,
  parseHashesTxt,
  parseRulesYaml,
  createHashMap,
  groupManifestByCase
} from '../parsers';
import { checkRequiredDocuments } from './required-docs-checker';
import { checkHashes, HashCheckResult } from './hash-checker';
import { checkDuplicateFiles, DuplicateCheckResult } from './duplicate-checker';
import { checkAllCasesSecretLevel } from './secret-level-checker';
import { checkPathCaseSensitivity, checkCaseConsistency, PathCaseIssue } from './path-case-checker';
import { checkBatchAppend, checkCaseBatchConsistency, BatchAppendCase } from './batch-checker';

export interface ValidationOptions {
  verifyActualFiles?: boolean;
  skipHashCheck?: boolean;
  skipDuplicateCheck?: boolean;
  skipSecretLevelCheck?: boolean;
  skipPathCaseCheck?: boolean;
  skipBatchCheck?: boolean;
}

export async function runValidation(
  configPaths: ConfigPaths,
  options: ValidationOptions = {}
): Promise<ValidationResult> {
  const startTime = new Date();
  
  console.log('正在加载配置文件...');
  
  const cases = await parseCasesCsv(configPaths.casesCsv);
  console.log(`  ✓ 加载了 ${cases.length} 个案件`);
  
  const manifestEntries = await parseManifestJsonl(configPaths.manifestJsonl);
  console.log(`  ✓ 加载了 ${manifestEntries.length} 个文件清单条目`);
  
  const hashEntries = await parseHashesTxt(configPaths.hashesTxt);
  const hashMap = createHashMap(hashEntries);
  console.log(`  ✓ 加载了 ${hashEntries.length} 个哈希记录`);
  
  const rules = parseRulesYaml(configPaths.rulesYaml);
  console.log(`  ✓ 加载了校验规则`);
  
  console.log('\n开始执行校验...');
  
  const manifestMap = groupManifestByCase(manifestEntries);
  
  const allIssues: Issue[] = [];
  
  console.log('  检查必备文书...');
  for (const caseInfo of cases) {
    const entries = manifestMap.get(caseInfo.caseNumber) || [];
    const issues = checkRequiredDocuments(caseInfo, entries, rules);
    allIssues.push(...issues);
  }
  console.log(`    发现 ${allIssues.length} 个问题`);
  
  if (!options.skipHashCheck) {
    console.log('  检查文件哈希...');
    const hashResult: HashCheckResult = await checkHashes(
      manifestEntries,
      hashMap,
      configPaths.dossierRoot,
      options.verifyActualFiles ?? true
    );
    allIssues.push(...hashResult.issues);
    console.log(`    验证通过: ${hashResult.verifiedCount}, 失败: ${hashResult.failedCount}, 缺失: ${hashResult.missingCount}`);
  }
  
  let duplicateResult: DuplicateCheckResult = { issues: [], duplicateGroups: [] };
  if (!options.skipDuplicateCheck) {
    console.log('  检查重复文件...');
    duplicateResult = checkDuplicateFiles(manifestEntries, hashMap, rules);
    allIssues.push(...duplicateResult.issues);
    console.log(`    发现 ${duplicateResult.duplicateGroups.length} 组重复文件`);
  }
  
  if (!options.skipSecretLevelCheck) {
    console.log('  检查密级文件放置...');
    const secretLevelIssues = checkAllCasesSecretLevel(cases, manifestMap, rules);
    allIssues.push(...secretLevelIssues);
    console.log(`    发现 ${secretLevelIssues.length} 个密级问题`);
  }
  
  let pathCaseResult: { issues: Issue[]; pathCaseIssues: PathCaseIssue[] } = { issues: [], pathCaseIssues: [] };
  if (!options.skipPathCaseCheck) {
    console.log('  检查路径大小写...');
    pathCaseResult = checkPathCaseSensitivity(manifestEntries, configPaths.dossierRoot, rules);
    allIssues.push(...pathCaseResult.issues);
    console.log(`    发现 ${pathCaseResult.pathCaseIssues.length} 个路径大小写问题`);
  }
  
  let batchResult: { issues: Issue[]; batchAppendCases: BatchAppendCase[] } = { issues: [], batchAppendCases: [] };
  if (!options.skipBatchCheck) {
    console.log('  检查批次追加...');
    batchResult = checkBatchAppend(cases, manifestEntries, rules);
    allIssues.push(...batchResult.issues);
    console.log(`    发现 ${batchResult.batchAppendCases.length} 个多批次案件`);
  }
  
  console.log('  检查数据一致性...');
  const consistencyIssues = checkCaseConsistency(cases, manifestMap);
  allIssues.push(...consistencyIssues);
  
  const batchConsistencyIssues = checkCaseBatchConsistency(cases, manifestEntries);
  allIssues.push(...batchConsistencyIssues);
  
  const caseStats = buildCaseStats(cases, manifestMap, allIssues);
  
  const errors = allIssues.filter(i => i.severity === 'error').length;
  const warnings = allIssues.filter(i => i.severity === 'warning').length;
  const infos = allIssues.filter(i => i.severity === 'info').length;
  
  const endTime = new Date();
  const validationTime = `${((endTime.getTime() - startTime.getTime()) / 1000).toFixed(2)}s`;
  
  console.log(`\n校验完成!`);
  console.log(`  总案件数: ${cases.length}`);
  console.log(`  已验证: ${caseStats.length}`);
  console.log(`  总问题数: ${allIssues.length}`);
  console.log(`    错误: ${errors}`);
  console.log(`    警告: ${warnings}`);
  console.log(`    提示: ${infos}`);
  console.log(`  耗时: ${validationTime}`);
  
  return {
    totalCases: cases.length,
    validatedCases: caseStats.length,
    totalIssues: allIssues.length,
    errors,
    warnings,
    infos,
    issues: allIssues,
    caseStats,
    duplicateFiles: duplicateResult.duplicateGroups,
    pathCaseIssues: pathCaseResult.pathCaseIssues.map(p => ({
      caseNumber: p.caseNumber,
      actualPath: p.actualPath,
      expectedPath: p.expectedPath
    })),
    batchAppendCases: batchResult.batchAppendCases.map(b => ({
      caseNumber: b.caseNumber,
      batchNumbers: b.batchNumbers
    })),
    validationTime
  };
}

function buildCaseStats(
  cases: CaseInfo[],
  manifestMap: Map<string, ManifestEntry[]>,
  allIssues: Issue[]
): ValidationResult['caseStats'] {
  const stats: ValidationResult['caseStats'] = [];
  
  for (const caseInfo of cases) {
    const entries = manifestMap.get(caseInfo.caseNumber) || [];
    const caseIssues = allIssues.filter(i => i.caseNumber === caseInfo.caseNumber);
    const batchNumbers = new Set(entries.map(e => e.batchNumber).filter(b => b));
    
    stats.push({
      caseNumber: caseInfo.caseNumber,
      batchNumbers: Array.from(batchNumbers),
      fileCount: entries.length,
      issues: caseIssues
    });
  }
  
  return stats;
}

export function discoverConfigPaths(rootDir: string): ConfigPaths {
  const casesCsv = findFile(rootDir, ['cases.csv', 'Cases.csv', 'CASES.CSV']);
  const manifestJsonl = findFile(rootDir, ['manifest.jsonl', 'Manifest.jsonl', 'MANIFEST.JSONL']);
  const hashesTxt = findFile(rootDir, ['hashes.txt', 'Hashes.txt', 'HASHES.TXT']);
  const rulesYaml = findFile(rootDir, ['rules.yaml', 'rules.yml', 'Rules.yaml', 'RULES.YAML']);
  
  return {
    casesCsv: casesCsv || path.join(rootDir, 'cases.csv'),
    manifestJsonl: manifestJsonl || path.join(rootDir, 'manifest.jsonl'),
    hashesTxt: hashesTxt || path.join(rootDir, 'hashes.txt'),
    rulesYaml: rulesYaml || path.join(rootDir, 'rules.yaml'),
    dossierRoot: rootDir
  };
}

function findFile(rootDir: string, possibleNames: string[]): string | null {
  for (const name of possibleNames) {
    const fullPath = path.join(rootDir, name);
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
      return fullPath;
    }
  }
  return null;
}
