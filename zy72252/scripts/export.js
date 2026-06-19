#!/usr/bin/env node

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';

function getIssueTypeLabel(type) {
  const labels = {
    'route_not_recalculated': '补录路线未重新计算长度'
  };
  return labels[type] || type;
}

function getStatusLabel(status) {
  const labels = {
    'open': '待处理',
    'supplemented': '已补充待复核',
    'resolved': '已解决'
  };
  return labels[status] || status;
}

function getNextActionLabel(action) {
  const labels = {
    'contact_customer': '请联系展陈客户',
    'contact_designer': '请联系展陈设计师阿景'
  };
  return labels[action] || action;
}

function getWhyLeft(issue) {
  if (issue.type === 'route_not_recalculated') {
    return '该路线为补录路线，未重新计算长度，可能存在安全隐患。需确认实际路线长度与设计值一致后才能放行。';
  }
  return '该问题需要人工复核确认后才能放行。';
}

function generateSummary(project, issues) {
  const openIssues = issues.filter(i => i.status !== 'resolved');
  if (openIssues.length === 0) {
    return `项目"${project.name}"所有路线已通过检测，长度计算完整，无待处理问题。`;
  }
  return `项目"${project.name}"检测到 ${openIssues.length} 个待处理问题，主要为补录路线未重新计算长度，需要展陈客户复核确认。`;
}

function generateNextSteps(issues) {
  const steps = [];
  const openIssues = issues.filter(i => i.status !== 'resolved');

  openIssues.forEach(issue => {
    if (issue.status === 'open') {
      steps.push(`【${issue.description}】→ 联系设计师阿景补录楼层剖面草图`);
    } else if (issue.status === 'supplemented') {
      steps.push(`【${issue.description}】→ 请展陈客户复核确认，确认后标记为已解决`);
    }
  });

  if (steps.length === 0) {
    steps.push('所有问题已解决，可安排现场施工');
  }

  return steps;
}

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const value = argv[i + 1];
      if (value && !value.startsWith('--')) {
        args[key] = value;
        i++;
      } else {
        args[key] = true;
      }
    }
  }
  return args;
}

function printHelp() {
  console.log(`
舞台吊点安全检测 - 报告导出工具

用法:
  node scripts/export.js --input <项目JSON文件> [--output <输出文件>] [--format json|text]

参数:
  --input    输入项目 JSON 文件路径 (必填)
  --output   输出报告文件路径 (可选，默认 stdout)
  --format   输出格式: json 或 text (默认 json)
  --notes    添加补充说明到报告中 (可选)
  --help     显示帮助信息

示例:
  node scripts/export.js --input ./data/demo-project-2.json
  node scripts/export.js --input ./data/demo-project-2.json --output report.json --format json
  node scripts/export.js --input ./data/demo-project-2.json --output report.txt --format text
  node scripts/export.js --input ./data/demo-project-2.json --notes "客户已确认复核"

报告包含内容:
  - 项目摘要和统计数据
  - 每个问题的详细说明
  - 「为什么这条被留下？」的原因解释
  - 「还缺什么材料？」清单
  - 「下一步该找谁？」责任人指引
  - 后续行动清单
  - 复核意见 (如有)
`);
}

function generateReport(data, customNotes) {
  const { project, routes, obstacles, sketches, issues } = data;
  const openIssues = issues.filter(i => i.status !== 'resolved');
  const resolvedIssues = issues.filter(i => i.status === 'resolved');

  const report = {
    reportId: `SS-${project.id.toUpperCase().slice(0, 8)}-${Date.now().toString(36).toUpperCase()}`,
    title: '舞台吊点安全检测报告',
    projectId: project.id,
    projectName: project.name,
    projectDescription: project.description || '',
    generatedAt: new Date().toISOString(),
    generatedBy: '舞台吊点安全演示系统',
    summary: generateSummary(project, issues),
    customNotes: customNotes || '',
    statistics: {
      totalRoutes: routes.length,
      supplementaryRoutes: routes.filter(r => r.isSupplementary).length,
      totalPoints: (data.points || []).length,
      totalObstacles: (obstacles || []).length,
      totalSketches: (sketches || []).length,
      totalIssues: issues.length,
      openIssues: openIssues.length,
      supplementedIssues: issues.filter(i => i.status === 'supplemented').length,
      resolvedIssues: resolvedIssues.length
    },
    issues: issues.map(issue => {
      const route = routes.find(r => r.id === issue.routeId);
      const issueObstacles = (obstacles || []).filter(o => o.routeId === issue.routeId);
      const issueSketches = (sketches || []).filter(s =>
        s.relatedRouteIds && s.relatedRouteIds.includes(issue.routeId)
      );

      return {
        id: issue.id,
        type: issue.type,
        typeLabel: getIssueTypeLabel(issue.type),
        description: issue.description,
        severity: issue.severity,
        status: issue.status,
        statusLabel: getStatusLabel(issue.status),
        createdAt: issue.createdAt,
        supplementedAt: issue.supplementedAt || null,
        resolvedAt: issue.resolvedAt || null,
        route: route ? {
          id: route.id,
          name: route.name,
          length: route.length,
          calculatedLength: route.calculatedLength || null,
          isSupplementary: route.isSupplementary,
          recalculated: route.recalculated
        } : null,
        obstacles: issueObstacles.map(o => ({
          id: o.id,
          content: o.content,
          createdBy: o.createdBy,
          createdAt: o.createdAt
        })),
        sketches: issueSketches.map(s => ({
          id: s.id,
          floor: s.floor,
          imageUrl: s.imageUrl,
          description: s.description,
          uploadedBy: s.uploadedBy,
          uploadedAt: s.uploadedAt
        })),
        missingMaterials: issue.missingMaterials || [],
        whyLeft: getWhyLeft(issue),
        nextAction: issue.nextAction,
        nextActionLabel: getNextActionLabel(issue.nextAction),
        responsiblePerson: issue.nextAction === 'contact_designer' ? '展陈设计师阿景' : '展陈客户',
        reviewNotes: issue.reviewNotes || null
      };
    }),
    nextSteps: generateNextSteps(issues)
  };

  return report;
}

function formatTextReport(report) {
  const lines = [];

  lines.push('======================================================================');
  lines.push('                     舞台吊点安全检测报告');
  lines.push('======================================================================');
  lines.push('');
  lines.push(`报告编号: ${report.reportId}`);
  lines.push(`项目名称: ${report.projectName}`);
  lines.push(`项目描述: ${report.projectDescription || '-'}`);
  lines.push(`生成时间: ${new Date(report.generatedAt).toLocaleString('zh-CN')}`);
  lines.push(`生成系统: ${report.generatedBy}`);
  lines.push('');
  lines.push('----------------------------------------------------------------------');
  lines.push('报告摘要');
  lines.push('----------------------------------------------------------------------');
  lines.push(report.summary);
  if (report.customNotes) {
    lines.push('');
    lines.push(`补充说明: ${report.customNotes}`);
  }
  lines.push('');
  lines.push('----------------------------------------------------------------------');
  lines.push('统计数据');
  lines.push('----------------------------------------------------------------------');
  const s = report.statistics;
  lines.push(`  路线总数:     ${s.totalRoutes} 条`);
  lines.push(`  补录路线:     ${s.supplementaryRoutes} 条`);
  lines.push(`  吊点总数:     ${s.totalPoints} 个`);
  lines.push(`  障碍物备注:   ${s.totalObstacles} 条`);
  lines.push(`  楼层草图:     ${s.totalSketches} 张`);
  lines.push(`  问题总数:     ${s.totalIssues} 个`);
  lines.push(`    待处理:     ${s.openIssues} 个`);
  lines.push(`    待复核:     ${s.supplementedIssues} 个`);
  lines.push(`    已解决:     ${s.resolvedIssues} 个`);
  lines.push('');

  if (report.issues.length > 0) {
    lines.push('----------------------------------------------------------------------');
    lines.push('问题详情');
    lines.push('----------------------------------------------------------------------');
    lines.push('');

    report.issues.forEach((issue, idx) => {
      lines.push(`【问题 ${idx + 1}】${issue.description}`);
      lines.push(`  类型: ${issue.typeLabel}`);
      lines.push(`  状态: ${issue.statusLabel} (${issue.severity === 'warning' ? '警告' : '错误'})`);
      lines.push(`  创建时间: ${new Date(issue.createdAt).toLocaleString('zh-CN')}`);
      if (issue.supplementedAt) {
        lines.push(`  补充时间: ${new Date(issue.supplementedAt).toLocaleString('zh-CN')}`);
      }
      if (issue.resolvedAt) {
        lines.push(`  解决时间: ${new Date(issue.resolvedAt).toLocaleString('zh-CN')}`);
      }
      lines.push('');

      if (issue.route) {
        lines.push('  📍 路线信息:');
        lines.push(`    路线名称: ${issue.route.name}`);
        lines.push(`    记录长度: ${issue.route.length}m`);
        if (issue.route.calculatedLength) {
          lines.push(`    实测长度: ${issue.route.calculatedLength}m`);
          lines.push(`    长度差异: ${(Math.abs(issue.route.length - issue.route.calculatedLength)).toFixed(2)}m`);
        }
        lines.push(`    是否补录: ${issue.route.isSupplementary ? '是' : '否'}`);
        lines.push(`    是否已重算: ${issue.route.recalculated ? '是' : '否'}`);
        lines.push('');
      }

      if (issue.missingMaterials.length > 0) {
        lines.push('  📋 还缺什么材料?');
        issue.missingMaterials.forEach(m => {
          lines.push(`    ☐ ${m}`);
        });
        lines.push('');
      }

      if (issue.obstacles.length > 0) {
        lines.push('  🚧 障碍物备注:');
        issue.obstacles.forEach(o => {
          lines.push(`    - ${o.content} (${o.createdBy === 'designer' ? '设计师' : '客户'}记录)`);
        });
        lines.push('');
      }

      if (issue.sketches.length > 0) {
        lines.push('  🏗  关联楼层剖面草图:');
        issue.sketches.forEach(s => {
          lines.push(`    - ${s.description} (${s.floor}楼, 由${s.uploadedBy}上传)`);
        });
        lines.push('');
      }

      lines.push('  ❓ 为什么这条被留下?');
      lines.push(`    ${issue.whyLeft}`);
      lines.push('');

      lines.push('  👤 下一步该找谁?');
      lines.push(`    责任人: ${issue.responsiblePerson}`);
      lines.push(`    行动: ${issue.nextActionLabel}`);
      lines.push('');

      if (issue.reviewNotes) {
        lines.push('  ✅ 复核意见:');
        lines.push(`    ${issue.reviewNotes}`);
        lines.push('');
      }

      lines.push('');
    });
  }

  lines.push('----------------------------------------------------------------------');
  lines.push('后续行动清单');
  lines.push('----------------------------------------------------------------------');
  report.nextSteps.forEach((step, idx) => {
    lines.push(`  ${idx + 1}. ${step}`);
  });
  lines.push('');

  lines.push('======================================================================');
  lines.push('                        报告结束');
  lines.push('======================================================================');

  return lines.join('\n');
}

function main() {
  const args = parseArgs(process.argv);

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  if (!args.input) {
    console.error('错误: 请指定 --input 参数');
    printHelp();
    process.exit(1);
  }

  const inputPath = resolve(process.cwd(), args.input);
  const format = args.format || 'json';

  let data;
  try {
    const content = readFileSync(inputPath, 'utf-8');
    data = JSON.parse(content);
  } catch (err) {
    console.error(`错误: 无法读取文件 ${inputPath}`);
    console.error(err.message);
    process.exit(1);
  }

  const report = generateReport(data, args.notes);

  if (format === 'text') {
    const textReport = formatTextReport(report);

    if (args.output) {
      const outputPath = resolve(process.cwd(), args.output);
      mkdirSync(dirname(outputPath), { recursive: true });
      writeFileSync(outputPath, textReport, 'utf-8');
      console.log(`报告已导出到: ${outputPath}`);
    } else {
      console.log(textReport);
    }
  } else {
    if (args.output) {
      const outputPath = resolve(process.cwd(), args.output);
      mkdirSync(dirname(outputPath), { recursive: true });
      writeFileSync(outputPath, JSON.stringify(report, null, 2), 'utf-8');
      console.log(`报告已导出到: ${outputPath}`);
    } else {
      console.log(JSON.stringify(report, null, 2));
    }
  }
}

main();
