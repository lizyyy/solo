const fs = require('fs');
const path = require('path');

class ScoreExporter {
  constructor() {
    this.reviewChecklist = [];
  }

  exportToJSON(result, outputPath) {
    const exportData = {
      metadata: {
        title: result.score.title,
        originalKey: result.score.originalKey,
        targetKey: result.score.targetKey,
        exportedAt: new Date().toISOString(),
        summary: result.summary
      },
      reviewChecklist: this.generateChecklist(result),
      transposedScore: result.score,
      issues: result.issues,
      differences: result.differences
    };

    fs.writeFileSync(outputPath, JSON.stringify(exportData, null, 2), 'utf-8');
    return outputPath;
  }

  exportToText(result, outputPath) {
    let output = '';

    output += `# ${result.score.title}\n\n`;
    output += `原调: ${result.score.originalKey} → 目标调: ${result.score.targetKey}\n\n`;

    output += '---\n\n';
    output += '## 移调报告\n\n';
    output += this.generateTextReport(result);

    output += '\n---\n\n';
    output += '## 人工核对清单\n\n';
    output += this.generateTextChecklist(result);

    output += '\n---\n\n';
    output += '## 移调后谱面\n\n';

    result.score.parts.forEach(part => {
      output += `### ${part.name}\n\n`;
      
      part.sections.forEach(section => {
        output += `#### ${section.name}\n\n`;

        if (section.chords.length > 0) {
          output += '**和弦:**\n';
          section.chords.forEach(chordLine => {
            const chords = chordLine.chords.map(c => c.transposed).join('  ');
            output += `${chords}\n`;
          });
          output += '\n';
        }

        if (section.measures.length > 0) {
          output += '**音符:**\n';
          section.measures.forEach(measure => {
            const notes = measure.notes.map(n => n.transposed).join(' ');
            output += `| ${notes} |\n`;
          });
          output += '\n';
        }

        if (section.lyrics.length > 0) {
          output += '**歌词:**\n';
          section.lyrics.forEach(lyric => {
            output += `${lyric.text}\n`;
          });
          output += '\n';
        }
      });

      output += '---\n\n';
    });

    output += '\n## 差异预览\n\n';
    output += this.generateDifferencePreview(result);

    fs.writeFileSync(outputPath, output, 'utf-8');
    return outputPath;
  }

  exportDiffOnly(result, outputPath) {
    let output = `# ${result.score.title} - 移调差异报告\n\n`;
    output += `原调: ${result.score.originalKey} → 目标调: ${result.score.targetKey}\n\n`;
    
    output += this.generateTextReport(result);
    output += '\n' + this.generateDifferencePreview(result);
    output += '\n' + this.generateTextChecklist(result);

    fs.writeFileSync(outputPath, output, 'utf-8');
    return outputPath;
  }

  generateChecklist(result) {
    const checklist = [];

    checklist.push({
      item: '调号换算',
      status: this.getStatus(result.summary.errors === 0),
      description: `${result.score.originalKey} → ${result.score.targetKey}`,
      verified: false
    });

    checklist.push({
      item: '升降号检查',
      status: result.summary.accidentalChanges > 0 ? 'warning' : 'ok',
      description: `检测到 ${result.summary.accidentalChanges} 处变音记号变化`,
      verified: false,
      needsAttention: result.summary.accidentalChanges > 0
    });

    checklist.push({
      item: '和弦同步检查',
      status: this.getStatus(result.summary.chordChanges >= 0),
      description: `共移调 ${result.summary.chordChanges} 个和弦`,
      verified: false,
      needsAttention: result.issues.some(i => i.type === 'unparsed_chord')
    });

    checklist.push({
      item: '歌词对位',
      status: result.issues.some(i => i.type === 'lyrics_misalignment_risk') ? 'warning' : 'ok',
      description: '请确认歌词与音符对位正确',
      verified: false,
      needsAttention: result.issues.some(i => i.type === 'lyrics_misalignment_risk')
    });

    checklist.push({
      item: '声部分组',
      status: 'ok',
      description: `共 ${result.score.parts.length} 个声部`,
      verified: false
    });

    return checklist;
  }

  generateTextReport(result) {
    let report = '';

    report += `### 概要\n\n`;
    report += `- 音符变动: ${result.summary.noteChanges} 处\n`;
    report += `- 和弦变动: ${result.summary.chordChanges} 处\n`;
    report += `- 变音记号变化: ${result.summary.accidentalChanges} 处\n\n`;

    if (result.issues.length > 0) {
      report += `### 问题提示\n\n`;
      
      const errors = result.issues.filter(i => i.severity === 'error');
      const warnings = result.issues.filter(i => i.severity === 'warning');
      const infos = result.issues.filter(i => i.severity === 'info');

      if (errors.length > 0) {
        report += `❌ 错误 (${errors.length}):\n`;
        errors.forEach(e => {
          report += `  - ${e.message}`;
          if (e.context && e.context.line) {
            report += ` (第 ${e.context.line} 行)`;
          }
          report += '\n';
        });
        report += '\n';
      }

      if (warnings.length > 0) {
        report += `⚠️  警告 (${warnings.length}):\n`;
        warnings.forEach(w => {
          report += `  - ${w.message}`;
          if (w.context && w.context.line) {
            report += ` (第 ${w.context.line} 行)`;
          }
          report += '\n';
        });
        report += '\n';
      }

      if (infos.length > 0) {
        report += `ℹ️  信息 (${infos.length}):\n`;
        infos.forEach(i => {
          report += `  - ${i.message}\n`;
        });
        report += '\n';
      }
    }

    return report;
  }

  generateTextChecklist(result) {
    const checklist = this.generateChecklist(result);
    let output = '### 人工核对清单\n\n';
    output += '请在完成核对后标记 [x]\n\n';

    checklist.forEach((item, index) => {
      const statusIcon = item.status === 'ok' ? '✅' : item.status === 'warning' ? '⚠️' : '❌';
      const attention = item.needsAttention ? ' **[重点检查]**' : '';
      output += `- [ ] ${statusIcon} ${item.item}${attention}: ${item.description}\n`;
    });

    output += '\n';
    output += '- [ ] 整体听觉效果检查\n';
    output += '- [ ] 各声部之间的和声关系\n';
    output += '- [ ] 演唱/演奏难度评估\n';

    return output;
  }

  generateDifferencePreview(result) {
    if (result.differences.length === 0) {
      return '无差异\n';
    }

    let output = '| 类型 | 原始 | 移调后 | 位置 |\n';
    output += '|------|------|--------|------|\n';

    result.differences.slice(0, 50).forEach(diff => {
      const type = this.formatDiffType(diff.type);
      const context = this.formatContext(diff.context);
      output += `| ${type} | ${diff.original} | ${diff.transposed} | ${context} |\n`;
    });

    if (result.differences.length > 50) {
      output += `\n... 还有 ${result.differences.length - 50} 处差异，请查看完整输出\n`;
    }

    return output;
  }

  formatDiffType(type) {
    const types = {
      note: '音符',
      chord: '和弦',
      accidental: '变音'
    };
    return types[type] || type;
  }

  formatContext(context) {
    if (!context) return '-';
    const parts = [];
    if (context.partName) parts.push(context.partName);
    if (context.sectionName) parts.push(context.sectionName);
    if (context.line) parts.push(`第${context.line}行`);
    return parts.length > 0 ? parts.join(' / ') : '-';
  }

  getStatus(condition) {
    return condition ? 'ok' : 'error';
  }
}

module.exports = ScoreExporter;
