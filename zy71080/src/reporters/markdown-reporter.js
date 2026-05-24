const fs = require('fs');
const path = require('path');

class MarkdownReporter {
  generate(report) {
    const lines = [];

    lines.push('# 邮件模板变量预检报告');
    lines.push('');
    lines.push(`> 生成时间: ${new Date().toLocaleString('zh-CN')}`);
    lines.push('');

    lines.push(this._generateSummarySection(report.summary, report.exitCode));
    lines.push('');

    if (report.templateResults && report.templateResults.length > 0) {
      lines.push(this._generateTemplateSection(report.templateResults));
      lines.push('');
    }

    if (report.i18nComparison) {
      lines.push(this._generateI18nSection(report.i18nComparison));
      lines.push('');
    }

    if (report.renderedSamples && report.renderedSamples.length > 0) {
      lines.push(this._generateRenderSection(report.renderedSamples));
      lines.push('');
    }

    lines.push(this._generateIssueExplanation());

    return lines.join('\n');
  }

  writeToFile(report, filePath) {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, this.generate(report), 'utf-8');
  }

  _generateSummarySection(summary, exitCode) {
    const lines = [];

    lines.push('## 📊 检查摘要');
    lines.push('');

    const status = summary.errors > 0
      ? '❌ **发现错误 - 需要修复**'
      : summary.warnings > 0
        ? '⚠️ **存在警告 - 建议检查**'
        : '✅ **全部通过**';

    lines.push(`**状态:** ${status}`);
    lines.push('');
    lines.push('| 指标 | 数值 |');
    lines.push('|------|------|');
    lines.push(`| 扫描模板 | ${summary.templatesScanned} |`);
    lines.push(`| 发现变量 | ${summary.totalVariables} |`);
    lines.push(`| ❌ 错误 | ${summary.errors} |`);
    lines.push(`| ⚠️ 警告 | ${summary.warnings} |`);
    lines.push(`| ℹ️ 信息 | ${summary.info || 0} |`);
    lines.push(`| **退出码** | **${exitCode}** |`);

    return lines.join('\n');
  }

  _generateTemplateSection(templateResults) {
    const lines = [];
    lines.push('## 📄 模板检查详情');
    lines.push('');

    templateResults.forEach((result, index) => {
      const locale = result.locale ? ` [${result.locale}]` : '';
      const status = result.validation.summary.errors > 0
        ? '❌ 错误'
        : result.validation.summary.warnings > 0
          ? '⚠️ 警告'
          : '✅ 通过';

      lines.push(`### ${index + 1}. ${result.templatePath}${locale}`);
      lines.push('');
      lines.push(`**状态:** ${status}`);
      lines.push('');

      lines.push('#### 发现的变量');
      lines.push('');
      lines.push('| 变量名 | 默认值 | 出现次数 | 条件变量 |');
      lines.push('|--------|--------|----------|----------|');

      result.validation.templateVariables.forEach(v => {
        const hasDefault = v.hasDefault ? '✅' : '❌';
        const isConditional = v.isConditional ? '✅' : '❌';
        lines.push(`| \`${v.rawName}\` | ${hasDefault} | ${v.occurrences} | ${isConditional} |`);
      });

      lines.push('');

      if (result.validation.issues.length > 0) {
        lines.push('#### 发现的问题');
        lines.push('');

        result.validation.issues.forEach(issue => {
          lines.push(this._formatMarkdownIssue(issue));
        });
      } else {
        lines.push('> ✅ 未发现问题');
      }

      lines.push('');
    });

    return lines.join('\n');
  }

  _generateI18nSection(i18nComparison) {
    const lines = [];
    lines.push('## 🌐 多语言一致性检查');
    lines.push('');

    if (i18nComparison.issues.length === 0) {
      lines.push('> ✅ 所有语言版本变量一致');
      return lines.join('\n');
    }

    lines.push('| 类型 | 严重程度 | 描述 |');
    lines.push('|------|----------|------|');

    i18nComparison.issues.forEach(issue => {
      const severity = issue.severity === 'error' ? '❌ 错误' : '⚠️ 警告';
      lines.push(`| \`${issue.type}\` | ${severity} | ${issue.message} |`);
    });

    lines.push('');
    lines.push('### 各语言版本变量对比');
    lines.push('');

    const locales = Object.keys(i18nComparison.localeVariables);
    const allVars = new Set();
    locales.forEach(locale => {
      i18nComparison.localeVariables[locale].forEach(v => allVars.add(v));
    });

    const header = ['变量名', ...locales].join(' | ');
    lines.push(`| ${header} |`);
    lines.push(`| ${Array(locales.length + 1).fill('---').join(' | ')} |`);

    allVars.forEach(varName => {
      const row = [
        `\`${varName}\``,
        ...locales.map(locale =>
          i18nComparison.localeVariables[locale].includes(varName) ? '✅' : '❌'
        )
      ];
      lines.push(`| ${row.join(' | ')} |`);
    });

    return lines.join('\n');
  }

  _generateRenderSection(renderedSamples) {
    const lines = [];
    lines.push('## 🎨 样例渲染');
    lines.push('');

    renderedSamples.forEach(sample => {
      const locale = sample.locale ? ` [${sample.locale}]` : '';
      const status = sample.renderResult.hasErrors
        ? '❌ 错误'
        : sample.renderResult.hasWarnings
          ? '⚠️ 警告'
          : '✅ 成功';

      lines.push(`### ${sample.templatePath}${locale}`);
      lines.push('');
      lines.push(`**状态:** ${status}`);
      lines.push('');

      if (sample.previewPath) {
        lines.push(`- 预览文件: [${path.basename(sample.previewPath)}](${sample.previewPath})`);
      }

      if (sample.renderResult.errors.length > 0) {
        lines.push('');
        lines.push('#### 错误');
        sample.renderResult.errors.forEach(err => {
          lines.push(`- ❌ ${err.message}`);
        });
      }

      if (sample.renderResult.warnings.length > 0) {
        lines.push('');
        lines.push('#### 警告');
        sample.renderResult.warnings.forEach(warn => {
          lines.push(`- ⚠️ ${warn.message}`);
        });
      }

      lines.push('');
    });

    return lines.join('\n');
  }

  _formatMarkdownIssue(issue) {
    const lines = [];
    const severityIcon = issue.severity === 'error' ? '❌' : issue.severity === 'warning' ? '⚠️' : 'ℹ️';

    lines.push(`##### ${severityIcon} ${issue.message}`);
    lines.push('');

    if (issue.details) {
      if (issue.details.occurrences && issue.details.occurrences.length > 0) {
        lines.push('**出现位置:**');
        issue.details.occurrences.slice(0, 5).forEach((occ, i) => {
          const lineInfo = occ.line ? `第 ${occ.line} 行` : `位置 ${occ.position}`;
          const context = occ.context ? ` - \`${occ.context}\`` : '';
          lines.push(`- ${lineInfo}${context}`);
        });
        if (issue.details.occurrences.length > 5) {
          lines.push(`- ... 还有 ${issue.details.occurrences.length - 5} 处`);
        }
        lines.push('');
      }

      if (issue.details.variations) {
        lines.push(`**命名变体:** ${issue.details.variations.map(v => `\`${v}\``).join(', ')}`);
        lines.push('');
      }

      if (issue.details.description) {
        lines.push(`**说明:** ${issue.details.description}`);
        lines.push('');
      }
    }

    return lines.join('\n');
  }

  _generateIssueExplanation() {
    const lines = [];
    lines.push('## 📖 问题类型说明');
    lines.push('');
    lines.push('| 问题类型 | 严重程度 | 说明 | 修复建议 |');
    lines.push('|----------|----------|------|----------|');
    lines.push('| `missing_variable` | ❌ 错误 | 变量清单中标记为必填的变量未在模板中使用 | 检查模板是否遗漏该变量，或更新清单 |');
    lines.push('| `extra_variable` | ⚠️ 警告 | 模板中使用了变量清单中不存在的变量 | 确认变量是否必要，或添加到变量清单 |');
    lines.push('| `case_inconsistency` | ⚠️ 警告 | 同一变量在模板中大小写不一致 | 统一变量命名风格 |');
    lines.push('| `i18n_missing_variable` | ❌ 错误 | 某语言版本缺少其他版本有的变量 | 检查翻译版本是否遗漏变量 |');
    lines.push('| `conditional_issue` | ⚠️ 警告 | 条件块可能存在问题 | 检查条件逻辑和内容 |');
    lines.push('| `missing_conditional_control` | ❌ 错误 | 条件块控制变量在样例数据中缺失 | 补充样例数据中的条件控制变量 |');
    lines.push('| `missing_sample` | ⚠️ 警告 | 样例数据中缺少该变量且无默认值 | 补充样例数据或设置默认值 |');
    lines.push('');

    return lines.join('\n');
  }
}

module.exports = { MarkdownReporter };
