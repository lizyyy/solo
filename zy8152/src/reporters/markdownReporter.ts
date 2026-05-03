import * as fs from 'fs';
import * as path from 'path';
import { FontReport, GlyphCheckResult, EmojiRisk, ArabicDirectionalityRisk, VariableAxisIssue, UnusedSubset, ValidationError } from '../types';
import { codePointToHex } from '../utils/unicode';

export function generateFontReportMarkdown(report: FontReport, outputDir: string): string {
  const lines: string[] = [];

  lines.push('# 字体回退链路预检报告');
  lines.push('');
  lines.push(`> 生成时间: ${new Date().toISOString()}`);
  lines.push('');

  lines.push('## 概要');
  lines.push('');
  lines.push('| 指标 | 值 |');
  lines.push('|------|-----|');
  lines.push(`| 样本总数 | ${report.summary.totalSamples} |`);
  lines.push(`| 字体数量 | ${report.summary.totalFonts} |`);
  lines.push(`| 子集数量 | ${report.summary.totalSubsets} |`);
  lines.push(`| 通过规则 | ${report.summary.passedRules} |`);
  lines.push(`| 失败规则 | ${report.summary.failedRules} |`);
  lines.push(`| 缺字数量 | ${report.summary.missingGlyphsCount} |`);
  lines.push(`| Emoji 风险 | ${report.summary.emojiRisksCount} |`);
  lines.push(`| 阿拉伯文方向性风险 | ${report.summary.arabicRisksCount} |`);
  lines.push(`| 变量字体轴问题 | ${report.summary.variableAxisIssuesCount} |`);
  lines.push(`| 无用子集 | ${report.summary.unusedSubsetsCount} |`);
  lines.push('');

  lines.push('## 规则执行结果');
  lines.push('');

  addGlyphCheckSection(lines, report);
  addEmojiCheckSection(lines, report);
  addArabicCheckSection(lines, report);
  addVariableAxisCheckSection(lines, report);
  addSubsetCheckSection(lines, report);
  addValidationErrorsSection(lines, report);

  const content = lines.join('\n');
  const outputPath = path.join(outputDir, 'font_report.md');
  ensureDirectory(outputDir);
  fs.writeFileSync(outputPath, content, 'utf-8');

  return outputPath;
}

function addGlyphCheckSection(lines: string[], report: FontReport): void {
  const { glyphChecks } = report;
  const missingOnly = glyphChecks.issues.filter(i => i.isMissing);
  const partialOnly = glyphChecks.issues.filter(i => !i.isMissing);

  lines.push('### 缺字检查');
  lines.push('');
  lines.push(`- **状态**: ${glyphChecks.passed ? '✅ 通过' : '❌ 失败'}`);
  lines.push(`- **描述**: ${glyphChecks.description}`);
  lines.push(`- **完全缺字**: ${missingOnly.length} 个`);
  lines.push(`- **部分字体缺字**: ${partialOnly.length} 个`);
  lines.push('');

  if (missingOnly.length > 0) {
    lines.push('#### 完全缺字列表');
    lines.push('');
    lines.push('| 样本ID | 语言 | 字符 | 码点 | 回退链 | 缺失字体 |');
    lines.push('|--------|------|------|------|--------|----------|');

    for (const glyph of missingOnly.slice(0, 20)) {
      lines.push(
        `| ${escapeMarkdown(glyph.sampleId)} | ${escapeMarkdown(glyph.language)} | \`${escapeMarkdown(glyph.char)}\` | ${codePointToHex(glyph.codePoint)} | ${escapeMarkdown(glyph.fallbackChain.join(' → '))} | ${escapeMarkdown(glyph.missingInFonts.join(', '))} |`
      );
    }

    if (missingOnly.length > 20) {
      lines.push(`| ... | ... | ... | ... | ... | 还有 ${missingOnly.length - 20} 个 |`);
    }
    lines.push('');
  }
}

function addEmojiCheckSection(lines: string[], report: FontReport): void {
  const { emojiChecks } = report;

  lines.push('### Emoji 风险检查');
  lines.push('');
  lines.push(`- **状态**: ${emojiChecks.passed ? '✅ 通过' : '⚠️ 警告'}`);
  lines.push(`- **描述**: ${emojiChecks.description}`);
  lines.push(`- **风险数量**: ${emojiChecks.issues.length}`);
  lines.push('');

  if (emojiChecks.issues.length > 0) {
    lines.push('#### Emoji 风险列表');
    lines.push('');
    lines.push('| 样本ID | Emoji | 码点 | 风险类型 | 描述 |');
    lines.push('|--------|-------|------|----------|------|');

    for (const risk of emojiChecks.issues.slice(0, 15)) {
      const riskTypeLabel = getEmojiRiskTypeLabel(risk.riskType);
      lines.push(
        `| ${escapeMarkdown(risk.sampleId)} | ${escapeMarkdown(risk.char)} | ${codePointToHex(risk.codePoint)} | ${riskTypeLabel} | ${escapeMarkdown(risk.description)} |`
      );
    }

    if (emojiChecks.issues.length > 15) {
      lines.push(`| ... | ... | ... | ... | 还有 ${emojiChecks.issues.length - 15} 个 |`);
    }
    lines.push('');
  }
}

function addArabicCheckSection(lines: string[], report: FontReport): void {
  const { arabicChecks } = report;

  lines.push('### 阿拉伯文方向性风险检查');
  lines.push('');
  lines.push(`- **状态**: ${arabicChecks.passed ? '✅ 通过' : '⚠️ 警告'}`);
  lines.push(`- **描述**: ${arabicChecks.description}`);
  lines.push(`- **风险数量**: ${arabicChecks.issues.length}`);
  lines.push('');

  if (arabicChecks.issues.length > 0) {
    lines.push('#### 方向性风险列表');
    lines.push('');

    for (const risk of arabicChecks.issues.slice(0, 10)) {
      lines.push(`**样本: ${escapeMarkdown(risk.sampleId)}**`);
      lines.push('');
      lines.push(`- 文本: \`${escapeMarkdown(risk.sampleText)}\``);
      lines.push(`- 混合方向: ${risk.mixedDirection ? '是' : '否'}`);
      lines.push(`- 中性字符: ${risk.hasNeutralChars ? '是' : '否'}`);
      lines.push(`- 描述: ${escapeMarkdown(risk.description)}`);
      lines.push(`- 上下文: ${escapeMarkdown(risk.context)}`);
      lines.push('');
    }

    if (arabicChecks.issues.length > 10) {
      lines.push(`> 还有 ${arabicChecks.issues.length - 10} 个方向性风险未在此处显示。`);
      lines.push('');
    }
  }
}

function addVariableAxisCheckSection(lines: string[], report: FontReport): void {
  const { variableAxisChecks } = report;

  lines.push('### 变量字体轴范围检查');
  lines.push('');
  lines.push(`- **状态**: ${variableAxisChecks.passed ? '✅ 通过' : '❌ 失败'}`);
  lines.push(`- **描述**: ${variableAxisChecks.description}`);
  lines.push(`- **问题数量**: ${variableAxisChecks.issues.length}`);
  lines.push('');

  if (variableAxisChecks.issues.length > 0) {
    lines.push('#### 变量字体轴问题列表');
    lines.push('');
    lines.push('| 字体名 | 轴标签 | 轴名称 | 请求值 | 最小值 | 最大值 | 问题类型 |');
    lines.push('|--------|--------|--------|--------|--------|--------|----------|');

    for (const issue of variableAxisChecks.issues) {
      const issueTypeLabel = issue.issueType === 'underflow' ? '低于最小值' : '高于最大值';
      lines.push(
        `| ${escapeMarkdown(issue.fontName)} | \`${escapeMarkdown(issue.axisTag)}\` | ${escapeMarkdown(issue.axisName)} | ${issue.requestedValue} | ${issue.minValue} | ${issue.maxValue} | ${issueTypeLabel} |`
      );
    }
    lines.push('');
  }
}

function addSubsetCheckSection(lines: string[], report: FontReport): void {
  const { subsetChecks } = report;

  lines.push('### 无用子集检查');
  lines.push('');
  lines.push(`- **状态**: ${subsetChecks.passed ? '✅ 通过' : '⚠️ 警告'}`);
  lines.push(`- **描述**: ${subsetChecks.description}`);
  lines.push(`- **问题数量**: ${subsetChecks.issues.length}`);
  lines.push('');

  if (subsetChecks.issues.length > 0) {
    lines.push('#### 无用子集列表');
    lines.push('');

    for (const issue of subsetChecks.issues) {
      lines.push(`**子集: ${escapeMarkdown(issue.subsetName)}**`);
      lines.push('');
      lines.push(`- 原因: ${escapeMarkdown(issue.reason)}`);
      if (issue.subsetDefinition.description) {
        lines.push(`- 描述: ${escapeMarkdown(issue.subsetDefinition.description)}`);
      }
      lines.push(`- Unicode 范围数量: ${issue.subsetDefinition.unicodeRanges.length}`);
      lines.push('');
    }
  }
}

function addValidationErrorsSection(lines: string[], report: FontReport): void {
  if (report.validationErrors.length === 0) return;

  lines.push('## 验证错误');
  lines.push('');
  lines.push(`共发现 ${report.validationErrors.length} 个验证错误。`);
  lines.push('');

  lines.push('| 类型 | 来源 | 消息 | 详情 |');
  lines.push('|------|------|------|------|');

  for (const error of report.validationErrors) {
    const typeLabel = getValidationTypeLabel(error.type);
    lines.push(
      `| ${typeLabel} | ${escapeMarkdown(error.source)} | ${escapeMarkdown(error.message)} | ${escapeMarkdown(error.detail || '-')} |`
    );
  }
  lines.push('');
}

function getEmojiRiskTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    directionality: '方向性',
    color: '颜色',
    missing: '缺失字体'
  };
  return labels[type] || type;
}

function getValidationTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    font: '字体配置',
    sample: '样本数据',
    fallback: '回退配置',
    subset: '子集定义',
    general: '通用'
  };
  return labels[type] || type;
}

function escapeMarkdown(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\*/g, '\\*')
    .replace(/_/g, '\\_')
    .replace(/{/g, '\\{')
    .replace(/}/g, '\\}')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/#/g, '\\#')
    .replace(/\+/g, '\\+')
    .replace(/-/g, '\\-')
    .replace(/\./g, '\\.')
    .replace(/!/g, '\\!')
    .replace(/\|/g, '\\|')
    .replace(/\n/g, ' ');
}

function ensureDirectory(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}
