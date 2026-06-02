import { formatDateTime } from '../utils/date';
import { downloadMarkdown, downloadJSON, downloadCSV } from '../utils/export';
import { getCheckupRunWithResults } from './checkupEngine';
import { getJudgmentLabel } from './comparisonEngine';
import type { CheckupRun, SampleResult, ModelVersion, Sample } from '../types';
import { getFromStore } from '../db';

export async function generateMarkdownReport(
  runId: string,
  includeDetails: boolean = true
): Promise<string> {
  const data = await getCheckupRunWithResults(runId);
  if (!data) {
    throw new Error('Checkup run not found');
  }

  const { run, results, modelVersion } = data;
  const samplesMap = new Map<string, Sample>();
  
  for (const result of results) {
    const sample = await getFromStore('samples', result.sampleId);
    if (sample) {
      samplesMap.set(result.sampleId, sample);
    }
  }

  let md = `# RAG知识库引用体检报告\n\n`;
  
  md += `## 基本信息\n\n`;
  md += `| 项目 | 内容 |\n|------|------|\n`;
  md += `| 报告名称 | ${run.name} |\n`;
  md += `| 模型版本 | ${modelVersion.name} (${modelVersion.version}) |\n`;
  md += `| 阈值配置 | ${modelVersion.config.threshold} |\n`;
  md += `| Top-K | ${modelVersion.config.topK} |\n`;
  md += `| 模型类型 | ${modelVersion.config.modelType} |\n`;
  md += `| 操作人 | ${run.createdBy} |\n`;
  md += `| 开始时间 | ${formatDateTime(run.startedAt)} |\n`;
  md += `| 完成时间 | ${run.completedAt ? formatDateTime(run.completedAt) : '-'} |\n`;
  md += `| 数据哈希 | \`${run.dataHash || '未计算'}\` |\n\n`;

  md += `## 核心指标\n\n`;
  md += `| 指标 | 数值 |\n|------|------|\n`;
  md += `| 准确率 | ${(run.metrics.accuracy * 100).toFixed(2)}% |\n`;
  md += `| 精确率 | ${(run.metrics.precision * 100).toFixed(2)}% |\n`;
  md += `| 召回率 | ${(run.metrics.recall * 100).toFixed(2)}% |\n`;
  md += `| F1分数 | ${(run.metrics.f1 * 100).toFixed(2)}% |\n`;
  md += `| 人工改判率 | ${(run.metrics.manualOverrideRate * 100).toFixed(2)}% |\n`;
  md += `| 样本总数 | ${run.metrics.totalSamples} |\n`;
  md += `| 冲突数量 | ${run.metrics.conflictCount} |\n\n`;

  md += `## 结果分布\n\n`;
  const correctCount = results.filter(r => r.judgment === 'correct').length;
  const partialCount = results.filter(r => r.judgment === 'partial').length;
  const incorrectCount = results.filter(r => r.judgment === 'incorrect').length;
  const unverifiedCount = results.filter(r => r.judgment === 'unverified').length;
  
  md += `- 正确: ${correctCount} (${((correctCount / results.length) * 100).toFixed(1)}%)\n`;
  md += `- 部分正确: ${partialCount} (${((partialCount / results.length) * 100).toFixed(1)}%)\n`;
  md += `- 错误: ${incorrectCount} (${((incorrectCount / results.length) * 100).toFixed(1)}%)\n`;
  md += `- 未验证: ${unverifiedCount} (${((unverifiedCount / results.length) * 100).toFixed(1)}%)\n\n`;

  if (run.metrics.conflictCount > 0) {
    md += `## 冲突清单\n\n`;
    const conflicts = results.filter(r => r.manualJudgment);
    for (const result of conflicts) {
      const sample = samplesMap.get(result.sampleId);
      md += `### ${sample?.question || '未知问题'}\n\n`;
      md += `- 模型判定: ${getJudgmentLabel(result.manualJudgment!.originalJudgment)}\n`;
      md += `- 人工改判: ${getJudgmentLabel(result.manualJudgment!.newJudgment)}\n`;
      md += `- 改判原因: ${result.manualJudgment!.reason}\n`;
      md += `- 改判人: ${result.manualJudgment!.createdBy}\n`;
      md += `- 改判时间: ${formatDateTime(result.manualJudgment!.createdAt)}\n\n`;
    }
  }

  if (includeDetails) {
    md += `## 明细数据\n\n`;
    md += `| 序号 | 问题 | 判定结果 | 置信度 | 状态 | 处理时间 |\n`;
    md += `|------|------|----------|--------|------|----------|\n`;
    
    results.forEach((result, idx) => {
      const sample = samplesMap.get(result.sampleId);
      const question = sample?.question || '未知问题';
      const shortQuestion = question.length > 30 ? question.substring(0, 30) + '...' : question;
      const statusLabel = result.status === 'manually_adjusted' ? '已人工改判' : '已处理';
      
      md += `| ${idx + 1} | ${shortQuestion} | ${getJudgmentLabel(result.judgment)} | ${(result.confidence * 100).toFixed(1)}% | ${statusLabel} | ${formatDateTime(result.processedAt)} |\n`;
    });
    md += `\n`;
  }

  if (results.some(r => r.notes.length > 0)) {
    md += `## 补录备注\n\n`;
    for (const result of results) {
      if (result.notes.length > 0) {
        const sample = samplesMap.get(result.sampleId);
        md += `### ${sample?.question || '未知问题'}\n\n`;
        for (const note of result.notes) {
          md += `> **${note.createdBy}** 于 ${formatDateTime(note.createdAt)} 补录：\n>\n`;
          if (note.diffSummary) {
            md += `> 差异说明：${note.diffSummary}\n>\n`;
          }
          md += `> ${note.content}\n\n`;
        }
      }
    }
  }

  md += `---\n\n`;
  md += `*本报告由RAG知识库引用体检系统自动生成*\n`;
  md += `*数据完整性校验哈希: \`${run.dataHash || 'N/A'}\`*\n`;

  return md;
}

export async function exportReport(
  runId: string,
  format: 'markdown' | 'json' | 'csv'
): Promise<void> {
  const data = await getCheckupRunWithResults(runId);
  if (!data) {
    throw new Error('Checkup run not found');
  }

  const { run, results } = data;
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const safeName = run.name.replace(/[^a-zA-Z0-9\u4e00-\u9fa5_-]/g, '_');

  if (format === 'markdown') {
    const md = await generateMarkdownReport(runId, true);
    downloadMarkdown(md, `RAG体检报告_${safeName}_${timestamp}.md`);
  } else if (format === 'json') {
    const samplesMap = new Map<string, Sample>();
    for (const result of results) {
      const sample = await getFromStore('samples', result.sampleId);
      if (sample) samplesMap.set(result.sampleId, sample);
    }

    const exportData = {
      report: {
        name: run.name,
        generatedAt: new Date().toISOString(),
        dataHash: run.dataHash,
      },
      run,
      modelVersion: await getFromStore('modelVersions', run.modelVersionId),
      results: await Promise.all(results.map(async r => {
        const sample = await getFromStore('samples', r.sampleId);
        return { ...r, sample };
      })),
    };

    downloadJSON(exportData, `RAG体检明细_${safeName}_${timestamp}.json`);
  } else if (format === 'csv') {
    const rows = await Promise.all(results.map(async (r, idx) => {
      const sample = await getFromStore('samples', r.sampleId);
      return {
        序号: idx + 1,
        问题: sample?.question || '',
        知识库来源: sample?.knowledgeSource || '',
        模型输出: r.modelOutput,
        参考回答: sample?.referenceAnswer || '',
        判定结果: getJudgmentLabel(r.judgment),
        置信度: (r.confidence * 100).toFixed(2) + '%',
        使用阈值: r.thresholdUsed,
        状态: r.status === 'manually_adjusted' ? '已人工改判' : '已处理',
        证据数量: r.evidences.length,
        备注数量: r.notes.length,
        处理时间: formatDateTime(r.processedAt),
      };
    }));

    downloadCSV(rows, `RAG体检明细_${safeName}_${timestamp}.csv`);
  }
}

export async function generateComparisonReport(
  comparison: any,
  format: 'markdown' | 'json'
): Promise<string> {
  const { run1, run2, metricChanges, sampleDifferences } = comparison;

  if (format === 'json') {
    return JSON.stringify(comparison, null, 2);
  }

  let md = `# 版本对比报告\n\n`;
  md += `## 对比信息\n\n`;
  md += `| 项目 | 版本 A | 版本 B |\n|------|--------|--------|\n`;
  md += `| 模型版本 | ${run1.version} | ${run2.version} |\n`;
  md += `| 批次名称 | ${run1.batchName || run1.name} | ${run2.batchName || run2.name} |\n`;
  md += `| 操作人 | ${run1.operator || run1.createdBy} | ${run2.operator || run2.createdBy} |\n`;
  md += `| 开始时间 | ${formatDateTime(run1.startedAt)} | ${formatDateTime(run2.startedAt)} |\n`;
  md += `| 数据哈希 | \`${run1.dataHash.slice(0, 16)}...\` | \`${run2.dataHash.slice(0, 16)}...\` |\n\n`;

  md += `## 指标对比\n\n`;
  md += `| 指标 | 版本 A | 版本 B | 变化 |\n|------|--------|--------|------|\n`;
  
  const metrics = [
    { key: 'accuracy', label: '准确率' },
    { key: 'precision', label: '精确率' },
    { key: 'recall', label: '召回率' },
    { key: 'f1', label: 'F1分数' },
  ];

  for (const m of metrics) {
    const v1 = (run1.metrics[m.key as keyof typeof run1.metrics] as number) * 100;
    const v2 = (run2.metrics[m.key as keyof typeof run2.metrics] as number) * 100;
    const change = (metricChanges[m.key as keyof typeof metricChanges] as number) * 100;
    const changeIcon = change > 0.01 ? '↑' : change < -0.01 ? '↓' : '-';
    const changeClass = change > 0.01 ? '上升' : change < -0.01 ? '下降' : '持平';
    md += `| ${m.label} | ${v1.toFixed(2)}% | ${v2.toFixed(2)}% | ${changeIcon} ${Math.abs(change).toFixed(2)}% (${changeClass}) |\n`;
  }
  md += `\n`;

  md += `## 差异样本 (${sampleDifferences.length})\n\n`;
  for (const diff of sampleDifferences) {
    md += `### ${diff.question}\n\n`;
    md += `| 版本 | 判定 | 置信度 |\n|------|------|--------|\n`;
    for (const d of diff.differences) {
      const run = d.runId === run1.id ? run1 : run2;
      md += `| ${run.version} | ${getJudgmentLabel(d.judgment)} | ${(d.confidence * 100).toFixed(1)}% |\n`;
    }
    md += `\n`;
  }

  md += `---\n\n`;
  md += `*本报告由RAG知识库引用体检系统自动生成*\n`;

  return md;
}

export async function validateReportIntegrity(runId: string, expectedHash: string): Promise<boolean> {
  const run = await getFromStore('checkupRuns', runId);
  if (!run) return false;
  return run.dataHash === expectedHash;
}
