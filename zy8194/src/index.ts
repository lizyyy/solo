#!/usr/bin/env node

import { Command } from 'commander';
import { FileReader } from './readers';
import { VectorSearcher } from './searcher';
import { Evaluator } from './evaluator';
import { Reporter } from './reporter';
import { CLIConfig, QueryResult, EvaluationMetrics, IssueItem } from './types';

const program = new Command();

program
  .name('rag-check')
  .description('RAG 检索回归预检 CLI 工具')
  .version('1.0.0');

program
  .requiredOption('--chunks <path>', '知识块向量 JSONL 文件路径')
  .requiredOption('--queries <path>', '查询集 CSV 文件路径')
  .requiredOption('--expected <path>', '期望引用 YAML 文件路径')
  .requiredOption('--rules <path>', '评估规则 YAML 文件路径')
  .requiredOption('--output <dir>', '输出目录路径')
  .option('--top-k <number>', '检索结果数量', '10')
  .option('-v, --verbose', '显示详细日志')
  .action(async (options) => {
    const config: CLIConfig = {
      chunksPath: options.chunks,
      queriesPath: options.queries,
      expectedPath: options.expected,
      rulesPath: options.rules,
      outputDir: options.output,
      topK: parseInt(options.topK, 10),
      verbose: options.verbose || false
    };

    await runEvaluation(config);
  });

async function runEvaluation(config: CLIConfig): Promise<void> {
  console.log('🔍 RAG 检索回归预检工具启动...\n');

  try {
    console.log('📂 读取输入文件...');
    
    const { chunks: knowledgeChunks, issues: chunkIssues } = await FileReader.readKnowledgeChunks(config.chunksPath);
    if (config.verbose) console.log(`   - 加载了 ${knowledgeChunks.length} 个知识块`);
    
    const { queries, issues: queryIssues } = await FileReader.readQueries(config.queriesPath);
    if (config.verbose) console.log(`   - 加载了 ${queries.length} 个查询`);
    
    const { refs: expectedRefs, issues: refIssues } = await FileReader.readExpectedRefs(config.expectedPath);
    if (config.verbose) console.log(`   - 加载了 ${expectedRefs.size} 个期望引用`);
    
    const rules = await FileReader.readEvalRules(config.rulesPath);
    if (config.verbose) console.log(`   - 评估规则已加载`);

    const allIssues: IssueItem[] = [...chunkIssues, ...queryIssues, ...refIssues];
    const dimensionIssues = allIssues.filter(i => i.type === 'dimension_mismatch');
    if (dimensionIssues.length > 0) {
      console.log('\n⚠️  检测到向量维度不一致问题！');
      for (const issue of dimensionIssues) {
        console.log(`   - ${issue.message}`);
      }
    }

    console.log('\n🔍 执行向量搜索...');
    const maxK = Math.max(...rules.top_k_values, config.topK || 10);
    const searcher = new VectorSearcher(knowledgeChunks, expectedRefs);
    
    const queryResults: QueryResult[] = searcher.searchAllQueries(queries, maxK);
    if (config.verbose) console.log(`   - 完成 ${queryResults.length} 个查询的检索`);

    console.log('\n📊 检测重复 Chunk...');
    const duplicateChunks = searcher.findDuplicateChunks(rules.duplicate_threshold);
    if (config.verbose) {
      console.log(`   - 发现 ${duplicateChunks.length} 对重复 Chunk`);
    }

    console.log('\n📈 计算评估指标...');
    const evaluator = new Evaluator(rules);
    
    const queryMetrics: EvaluationMetrics[] = [];
    for (const result of queryResults) {
      const metrics = evaluator.calculateQueryMetrics(result);
      queryMetrics.push(metrics);
    }
    if (config.verbose) console.log(`   - 完成 ${queryMetrics.length} 个查询的指标计算`);

    console.log('\n⚠️  生成问题列表...');
    const runtimeIssues = evaluator.generateIssues(
      queryResults,
      queryMetrics,
      duplicateChunks,
      queries,
      expectedRefs
    );
    allIssues.push(...runtimeIssues);
    
    const missingRefIssues = allIssues.filter(i => i.type === 'missing_expected_refs');
    if (missingRefIssues.length > 0) {
      console.log(`   - 发现 ${missingRefIssues.length} 个查询缺少期望引用`);
    }
    if (config.verbose) console.log(`   - 总计 ${allIssues.length} 个问题`);

    console.log('\n📋 生成评估报告...');
    const report = evaluator.generateReport(
      knowledgeChunks,
      queries,
      queryResults,
      queryMetrics,
      allIssues,
      duplicateChunks
    );

    const reporter = new Reporter(config.outputDir);
    const { issuesPath, reportPath, htmlPath } = await reporter.writeReport(report, queryResults);

    console.log('\n✅ 评估完成！');
    console.log('\n📊 结果摘要：');
    console.log(`   - 总查询数: ${report.summary.total_queries}`);
    console.log(`   - 平均 MRR: ${(report.summary.average_mrr * 100).toFixed(2)}%`);
    console.log(`   - 整体通过率: ${(report.summary.overall_pass_rate * 100).toFixed(2)}%`);
    console.log(`   - 发现问题数: ${allIssues.length}`);
    
    console.log('\n📁 输出文件：');
    console.log(`   - 问题列表: ${issuesPath}`);
    console.log(`   - 评估报告: ${reportPath}`);
    console.log(`   - 排名预览: ${htmlPath}`);

    console.log('\n🎉 检索回归预检完成！');

  } catch (error) {
    console.error('\n❌ 执行出错：');
    console.error(error instanceof Error ? error.message : String(error));
    if (config.verbose && error instanceof Error) {
      console.error('\n详细错误信息：');
      console.error(error.stack);
    }
    process.exit(1);
  }
}

program.parse(process.argv);
