import {
  PhysicsSolution,
  PhysicsProblem,
  ExportOptions,
  ExportFormat,
} from '../../../shared/types';
import { formatValue } from '../physics/units';

export function exportSolution(
  problem: PhysicsProblem,
  solution: PhysicsSolution,
  options: ExportOptions
): string {
  switch (options.format) {
    case 'markdown':
      return exportToMarkdown(problem, solution, options);
    case 'html':
      return exportToHtml(problem, solution, options);
    case 'json':
      return exportToJson(problem, solution);
    default:
      return exportToJson(problem, solution);
  }
}

function exportToJson(problem: PhysicsProblem, solution: PhysicsSolution): string {
  return JSON.stringify({
    problem,
    solution,
    exportedAt: new Date().toISOString(),
  }, null, 2);
}

function exportToMarkdown(
  problem: PhysicsProblem,
  solution: PhysicsSolution,
  options: ExportOptions
): string {
  const lines: string[] = [];

  lines.push(`# ${problem.title}`);
  lines.push('');
  lines.push(`**题目类型：** ${getProblemTypeLabel(problem.type)}`);
  lines.push('');
  lines.push(`**题目描述：** ${problem.description}`);
  lines.push('');

  if (problem.notes) {
    lines.push('## 老师备注');
    lines.push('');
    lines.push(problem.notes);
    lines.push('');
  }

  lines.push('## 输入参数');
  lines.push('');
  lines.push('| 参数 | 符号 | 值 | 单位 | 说明 |');
  lines.push('|------|------|-----|------|------|');
  problem.parameters.forEach(param => {
    lines.push(`| ${param.label} | \\(${param.name}\\) | ${param.value} | ${param.unit || '-'} | ${param.description || '-'} |`);
  });
  lines.push('');

  lines.push('## 基本公式');
  lines.push('');
  solution.equations.forEach(eq => {
    lines.push(`### ${eq.description}`);
    lines.push('');
    lines.push(`$$${eq.latex}$$`);
    lines.push('');
  });

  if (options.includeDerivations) {
    lines.push('## 推导过程');
    lines.push('');
    lines.push('### 公式推导');
    lines.push('');
    solution.derivations.forEach(step => {
      lines.push(`**步骤 ${step.step}：** ${step.explanation}`);
      lines.push('');
      if (step.rule) {
        lines.push(`> 依据：${step.rule}`);
        lines.push('');
      }
      lines.push(`$$${step.latex}$$`);
      lines.push('');
    });

    lines.push('### 数值代入');
    lines.push('');
    solution.substitutions.forEach(step => {
      lines.push(`**步骤 ${step.step}：** ${step.explanation}`);
      lines.push('');
      lines.push(`$$${step.latex}$$`);
      lines.push('');
    });
  }

  lines.push('## 关键物理量');
  lines.push('');
  lines.push('| 物理量 | 符号 | 值 | 单位 | 说明 |');
  lines.push('|--------|------|-----|------|------|');
  solution.results.forEach(result => {
    lines.push(`| ${result.label} | \\(${result.name}\\) | ${formatValue(result.value)} | ${result.unit} | ${result.description || '-'} |`);
  });
  lines.push('');

  lines.push('## 最终答案');
  lines.push('');
  solution.finalAnswers.forEach(answer => {
    lines.push(`- **${answer.label}：** $$${answer.latex}$$`);
  });
  lines.push('');

  if (options.includeTrajectory) {
    lines.push('## 轨迹采样数据');
    lines.push('');
    lines.push('| 时间(s) | x位置(m) | y位置(m) | x速度(m/s) | y速度(m/s) |');
    lines.push('|---------|----------|----------|------------|------------|');
    const samplePoints = solution.trajectory.filter((_, index) => index % Math.ceil(solution.trajectory.length / 20) === 0);
    samplePoints.forEach(point => {
      lines.push(`| ${formatValue(point.time)} | ${formatValue(point.x)} | ${formatValue(point.y)} | ${point.vx !== undefined ? formatValue(point.vx) : '-'} | ${point.vy !== undefined ? formatValue(point.vy) : '-'} |`);
    });
    lines.push('');
    lines.push(`> 共 ${solution.trajectory.length} 个采样点，此处显示 ${samplePoints.length} 个关键帧。`);
    lines.push('');
  }

  lines.push('---');
  lines.push('');
  lines.push(`*导出时间：${new Date().toLocaleString()}*`);

  return lines.join('\n');
}

function exportToHtml(
  problem: PhysicsProblem,
  solution: PhysicsSolution,
  options: ExportOptions
): string {
  const htmlLines: string[] = [];

  htmlLines.push('<!DOCTYPE html>');
  htmlLines.push('<html lang="zh-CN">');
  htmlLines.push('<head>');
  htmlLines.push('  <meta charset="UTF-8">');
  htmlLines.push(`  <title>${problem.title}</title>`);
  htmlLines.push('  <script src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js"></script>');
  htmlLines.push('  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">');
  htmlLines.push('  <style>');
  htmlLines.push('    body { font-family: "Microsoft YaHei", "SimHei", sans-serif; max-width: 900px; margin: 0 auto; padding: 20px; line-height: 1.6; }');
  htmlLines.push('    h1 { color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px; }');
  htmlLines.push('    h2 { color: #34495e; margin-top: 30px; }');
  htmlLines.push('    h3 { color: #7f8c8d; }');
  htmlLines.push('    table { width: 100%; border-collapse: collapse; margin: 15px 0; }');
  htmlLines.push('    th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }');
  htmlLines.push('    th { background-color: #f8f9fa; font-weight: bold; }');
  htmlLines.push('    tr:hover { background-color: #f5f5f5; }');
  htmlLines.push('    .equation { text-align: center; margin: 20px 0; padding: 15px; background-color: #f8f9fa; border-radius: 5px; }');
  htmlLines.push('    .step { margin: 20px 0; padding: 15px; border-left: 4px solid #3498db; background-color: #f8f9fa; }');
  htmlLines.push('    .step-number { font-weight: bold; color: #3498db; }');
  htmlLines.push('    .answer { margin: 10px 0; padding: 10px; background-color: #d4edda; border-radius: 5px; }');
  htmlLines.push('    .metadata { color: #6c757d; font-size: 0.9em; }');
  htmlLines.push('    .notes { background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 15px 0; }');
  htmlLines.push('  </style>');
  htmlLines.push('</head>');
  htmlLines.push('<body>');

  htmlLines.push(`  <h1>${problem.title}</h1>`);
  htmlLines.push('');
  htmlLines.push(`  <p class="metadata"><strong>题目类型：</strong>${getProblemTypeLabel(problem.type)}</p>`);
  htmlLines.push(`  <p class="metadata"><strong>题目描述：</strong>${problem.description}</p>`);
  htmlLines.push('');

  if (problem.notes) {
    htmlLines.push('  <div class="notes">');
    htmlLines.push('    <h2>老师备注</h2>');
    htmlLines.push(`    <p>${problem.notes}</p>`);
    htmlLines.push('  </div>');
    htmlLines.push('');
  }

  htmlLines.push('  <h2>输入参数</h2>');
  htmlLines.push('  <table>');
  htmlLines.push('    <tr><th>参数</th><th>符号</th><th>值</th><th>单位</th><th>说明</th></tr>');
  problem.parameters.forEach(param => {
    htmlLines.push(`    <tr><td>${param.label}</td><td>\\(${param.name}\\)</td><td>${param.value}</td><td>${param.unit || '-'}</td><td>${param.description || '-'}</td></tr>`);
  });
  htmlLines.push('  </table>');
  htmlLines.push('');

  htmlLines.push('  <h2>基本公式</h2>');
  solution.equations.forEach(eq => {
    htmlLines.push('  <div class="equation">');
    htmlLines.push(`    <p><strong>${eq.description}</strong></p>`);
    htmlLines.push(`    <div class="katex-block">$$${eq.latex}$$</div>`);
    htmlLines.push('  </div>');
  });
  htmlLines.push('');

  if (options.includeDerivations) {
    htmlLines.push('  <h2>推导过程</h2>');
    
    htmlLines.push('  <h3>公式推导</h3>');
    solution.derivations.forEach(step => {
      htmlLines.push('  <div class="step">');
      htmlLines.push(`    <p><span class="step-number">步骤 ${step.step}：</span>${step.explanation}</p>`);
      if (step.rule) {
        htmlLines.push(`    <p class="metadata">依据：${step.rule}</p>`);
      }
      htmlLines.push(`    <div class="katex-block">$$${step.latex}$$</div>`);
      htmlLines.push('  </div>');
    });

    htmlLines.push('  <h3>数值代入</h3>');
    solution.substitutions.forEach(step => {
      htmlLines.push('  <div class="step">');
      htmlLines.push(`    <p><span class="step-number">步骤 ${step.step}：</span>${step.explanation}</p>`);
      htmlLines.push(`    <div class="katex-block">$$${step.latex}$$</div>`);
      htmlLines.push('  </div>');
    });
  }

  htmlLines.push('  <h2>关键物理量</h2>');
  htmlLines.push('  <table>');
  htmlLines.push('    <tr><th>物理量</th><th>符号</th><th>值</th><th>单位</th><th>说明</th></tr>');
  solution.results.forEach(result => {
    htmlLines.push(`    <tr><td>${result.label}</td><td>\\(${result.name}\\)</td><td>${formatValue(result.value)}</td><td>${result.unit}</td><td>${result.description || '-'}</td></tr>`);
  });
  htmlLines.push('  </table>');
  htmlLines.push('');

  htmlLines.push('  <h2>最终答案</h2>');
  solution.finalAnswers.forEach(answer => {
    htmlLines.push('  <div class="answer">');
    htmlLines.push(`    <strong>${answer.label}：</strong>`);
    htmlLines.push(`    <span class="katex-inline">$${answer.latex}$</span>`);
    htmlLines.push('  </div>');
  });
  htmlLines.push('');

  if (options.includeTrajectory) {
    htmlLines.push('  <h2>轨迹采样数据</h2>');
    htmlLines.push('  <table>');
    htmlLines.push('    <tr><th>时间(s)</th><th>x位置(m)</th><th>y位置(m)</th><th>x速度(m/s)</th><th>y速度(m/s)</th></tr>');
    const samplePoints = solution.trajectory.filter((_, index) => index % Math.ceil(solution.trajectory.length / 20) === 0);
    samplePoints.forEach(point => {
      htmlLines.push(`    <tr><td>${formatValue(point.time)}</td><td>${formatValue(point.x)}</td><td>${formatValue(point.y)}</td><td>${point.vx !== undefined ? formatValue(point.vx) : '-'}</td><td>${point.vy !== undefined ? formatValue(point.vy) : '-'}</td></tr>`);
    });
    htmlLines.push('  </table>');
    htmlLines.push(`  <p class="metadata">共 ${solution.trajectory.length} 个采样点，此处显示 ${samplePoints.length} 个关键帧。</p>`);
    htmlLines.push('');
  }

  htmlLines.push('  <hr>');
  htmlLines.push(`  <p class="metadata">导出时间：${new Date().toLocaleString()}</p>`);

  htmlLines.push('  <script>');
  htmlLines.push('    document.addEventListener("DOMContentLoaded", function() {');
  htmlLines.push('      const katexBlocks = document.querySelectorAll(".katex-block");');
  htmlLines.push('      katexBlocks.forEach(block => {');
  htmlLines.push('        const tex = block.textContent.replace(/\\$\\$/g, "").trim();');
  htmlLines.push('        try {');
  htmlLines.push('          katex.render(tex, block, { displayMode: true, throwOnError: false });');
  htmlLines.push('        } catch(e) { console.error(e); }');
  htmlLines.push('      });');
  htmlLines.push('      const katexInlines = document.querySelectorAll(".katex-inline");');
  htmlLines.push('      katexInlines.forEach(inline => {');
  htmlLines.push('        const tex = inline.textContent.replace(/\\$/g, "").trim();');
  htmlLines.push('        try {');
  htmlLines.push('          katex.render(tex, inline, { displayMode: false, throwOnError: false });');
  htmlLines.push('        } catch(e) { console.error(e); }');
  htmlLines.push('      });');
  htmlLines.push('    });');
  htmlLines.push('  </script>');

  htmlLines.push('</body>');
  htmlLines.push('</html>');

  return htmlLines.join('\n');
}

function getProblemTypeLabel(type: string): string {
  const labels: { [key: string]: string } = {
    'incline': '斜面滑块',
    'projectile': '抛体运动',
    'spring': '弹簧振子',
  };
  return labels[type] || type;
}
