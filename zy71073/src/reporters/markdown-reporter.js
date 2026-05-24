const fs = require('fs');
const path = require('path');

class MarkdownReporter {
  generate(result, outputPath, options = {}) {
    const { workbook, graph, graphInstance, analyzedAt } = result;

    const content = [];

    content.push('# Excel 公式依赖图分析报告');
    content.push('');
    content.push(`**生成时间**: ${new Date(analyzedAt).toLocaleString('zh-CN')}`);
    content.push(`**源文件**: \`${workbook.filePath}\``);
    content.push('');

    content.push('## 📁 工作簿概览');
    content.push('');
    content.push(`| 指标 | 数值 |`);
    content.push(`|------|------|`);
    content.push(`| 工作表数量 | ${workbook.sheets.length} |`);
    content.push(`| 命名区域 | ${workbook.namedRanges.length} 个 |`);
    content.push(`| 外部链接 | ${workbook.externalLinks.length} 个 |`);
    content.push(`| 总单元格数 | ${graph.nodeCount} |`);
    content.push(`| 依赖关系数 | ${graph.edgeCount} |`);
    content.push(`| 循环引用 | ${graph.hasCircularReferences ? `⚠️ ${graph.circularReferences.length} 个` : '✓ 无'} |`);
    content.push('');

    content.push('## 📊 工作表详情');
    content.push('');
    content.push(`| 工作表 | 单元格 | 公式 | 隐藏状态 |`);
    content.push(`|--------|--------|------|----------|`);
    workbook.sheets.forEach(sheet => {
      const status = sheet.isVeryHidden ? '深度隐藏' : sheet.isHidden ? '隐藏' : '可见';
      content.push(`| ${sheet.name} | ${sheet.cellCount} | ${sheet.formulaCount} | ${status} |`);
    });
    content.push('');

    content.push('## 🔗 依赖分析');
    content.push('');

    content.push('### 最具影响力的单元格 (被引用最多)');
    content.push('');
    const topDependents = graphInstance.getTopDependents(10);
    if (topDependents.length > 0) {
      content.push(`| 单元格 | 工作表 | 被引用次数 | 是否为公式 |`);
      content.push(`|--------|--------|------------|------------|`);
      topDependents.forEach(cell => {
        content.push(`| \`${cell.address}\` | ${cell.sheetName} | ${cell.dependentCount} | ${cell.hasFormula ? '是' : '否'} |`);
      });
    } else {
      content.push('*无数据*');
    }
    content.push('');

    content.push('### 最复杂的公式 (依赖最多)');
    content.push('');
    const topDependencies = graphInstance.getTopDependencies(10);
    if (topDependencies.length > 0) {
      content.push(`| 单元格 | 工作表 | 依赖数量 | 公式 |`);
      content.push(`|--------|--------|----------|------|`);
      topDependencies.forEach(cell => {
        const formula = (cell.formula || '').replace(/\|/g, '\\|').substring(0, 60);
        content.push(`| \`${cell.address}\` | ${cell.sheetName} | ${cell.dependencyCount} | \`${formula}\` |`);
      });
    } else {
      content.push('*无数据*');
    }
    content.push('');

    content.push('## ⚠️ 循环引用检测');
    content.push('');
    if (graph.hasCircularReferences) {
      content.push(`**检测到 ${graph.circularReferences.length} 个循环引用:**`);
      content.push('');
      graph.circularReferences.slice(0, 20).forEach((cycle, i) => {
        content.push(`${i + 1}. \`${cycle.join('` → `')}\``);
      });
      if (graph.circularReferences.length > 20) {
        content.push(`... 还有 ${graph.circularReferences.length - 20} 个循环引用`);
      }
      content.push('');
      content.push('> **注意**: 循环引用可能导致计算错误，请检查并修复。');
    } else {
      content.push('✓ **未检测到循环引用**');
    }
    content.push('');

    content.push('## 🎯 关键输入项分析');
    content.push('');
    const inputCells = graphInstance.getInputCells().slice(0, 15);
    if (inputCells.length > 0) {
      content.push('以下单元格是关键输入项（无公式但被多个公式引用），修改它们会产生较大影响：');
      content.push('');
      content.push(`| 单元格 | 工作表 | 当前值 | 影响单元格数 |`);
      content.push(`|--------|--------|--------|--------------|`);
      inputCells.forEach(cell => {
        const value = cell.value !== undefined ? String(cell.value).substring(0, 30) : '(空)';
        content.push(`| \`${cell.address}\` | ${cell.sheetName} | ${value} | ${cell.dependentCount} |`);
      });
    } else {
      content.push('*未检测到输入项*');
    }
    content.push('');

    if (workbook.externalLinks.length > 0) {
      content.push('## 🌐 外部链接');
      content.push('');
      content.push('**检测到以下外部链接:**');
      content.push('');
      workbook.externalLinks.forEach(link => {
        content.push(`- **文件**: \`${link.file}\``);
        content.push(`  - 路径: ${link.path}`);
        content.push(`  - 引用位置: \`${link.sourceCell}\``);
        content.push('');
      });
    }

    if (workbook.namedRanges.length > 0) {
      content.push('## 📛 命名区域');
      content.push('');
      content.push(`| 名称 | 引用位置 | 工作表 |`);
      content.push(`|------|----------|--------|`);
      workbook.namedRanges.forEach(named => {
        content.push(`| \`${named.name}\` | \`${named.reference}\` | ${named.sheetName} |`);
      });
      content.push('');
    }

    content.push('## 📋 完整依赖图说明');
    content.push('');
    content.push('- **节点**: 每个有值的单元格都是一个节点');
    content.push('- **边**: 从被依赖单元格指向引用它的单元格');
    content.push('- **方向**: A → B 表示 B 依赖于 A（修改 A 会影响 B）');
    content.push('');
    content.push('```');
    content.push('  A ---> B ---> C');
    content.push('  |      |');
    content.push('  v      v');
    content.push('  D      E');
    content.push('```');
    content.push('');
    content.push('*图例: 修改 A 会影响 B, C, D；修改 B 会影响 C, E*');
    content.push('');

    content.push('---');
    content.push('');
    content.push(`*本报告由 excel-dep-graph 工具生成于 ${new Date().toLocaleString('zh-CN')}*`);

    this._writeFile(outputPath, content.join('\n'));
    return outputPath;
  }

  _writeFile(outputPath, content) {
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(outputPath, content, 'utf-8');
  }
}

module.exports = { MarkdownReporter };
