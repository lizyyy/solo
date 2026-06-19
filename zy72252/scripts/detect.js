#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

function generateId() {
  return 'ISSUE-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();
}

function detectSupplementaryRoutes(routes) {
  const issues = [];

  for (const route of routes) {
    if (route.isSupplementary && !route.recalculated) {
      const hasLengthDiff = route.calculatedLength !== undefined &&
        Math.abs(route.length - route.calculatedLength) > 0.5;

      issues.push({
        id: generateId(),
        type: 'route_not_recalculated',
        routeId: route.id,
        severity: 'warning',
        description: hasLengthDiff
          ? `补录路线 "${route.name}" 长度不一致：记录 ${route.length}m，实测 ${route.calculatedLength}m`
          : `补录路线 "${route.name}" 没有重新计算长度`,
        status: 'open',
        nextAction: 'contact_designer',
        missingMaterials: hasLengthDiff
          ? ['长度复核计算书', '现场测量照片']
          : ['楼层剖面草图（避让段）', '复核确认记录'],
        createdAt: new Date().toISOString()
      });
    }
  }

  return issues;
}

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
舞台吊点安全检测 - 路线检测工具

用法:
  node scripts/detect.js --input <项目JSON文件> [--output <输出文件>] [--json]

参数:
  --input    输入项目 JSON 文件路径 (必填)
  --output   输出检测结果到文件 (可选)
  --json     以 JSON 格式输出 (可选，默认文本格式)
  --help     显示帮助信息

示例:
  node scripts/detect.js --input ./data/demo-project-2.json
  node scripts/detect.js --input ./data/demo-project-2.json --output result.json --json
`);
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

  let data;
  try {
    const content = readFileSync(inputPath, 'utf-8');
    data = JSON.parse(content);
  } catch (err) {
    console.error(`错误: 无法读取文件 ${inputPath}`);
    console.error(err.message);
    process.exit(1);
  }

  const { project, routes, obstacles, sketches, issues: existingIssues } = data;

  if (!project || !routes) {
    console.error('错误: 输入文件格式不正确，需要包含 project 和 routes 字段');
    process.exit(1);
  }

  const detectedIssues = detectSupplementaryRoutes(routes);
  const allIssues = [...(existingIssues || []), ...detectedIssues.filter(
    newIssue => !(existingIssues || []).some(ei => ei.routeId === newIssue.routeId && ei.type === newIssue.type)
  )];

  if (args.json) {
    const result = {
      projectId: project.id,
      projectName: project.name,
      totalRoutes: routes.length,
      supplementaryRoutes: routes.filter(r => r.isSupplementary).length,
      totalIssues: allIssues.length,
      openIssues: allIssues.filter(i => i.status !== 'resolved').length,
      resolvedIssues: allIssues.filter(i => i.status === 'resolved').length,
      issues: allIssues,
      detectedAt: new Date().toISOString()
    };

    if (args.output) {
      const outputPath = resolve(process.cwd(), args.output);
      writeFileSync(outputPath, JSON.stringify(result, null, 2), 'utf-8');
      console.log(`检测结果已保存到: ${outputPath}`);
    } else {
      console.log(JSON.stringify(result, null, 2));
    }
  } else {
    console.log('========================================');
    console.log('  舞台吊点安全检测报告');
    console.log('========================================');
    console.log(`项目名称: ${project.name}`);
    console.log(`项目ID: ${project.id}`);
    console.log(`检测时间: ${new Date().toLocaleString('zh-CN')}`);
    console.log('----------------------------------------');
    console.log(`路线总数: ${routes.length}`);
    console.log(`补录路线: ${routes.filter(r => r.isSupplementary).length}`);
    console.log(`检测问题: ${allIssues.length} 个`);
    console.log(`  待处理: ${allIssues.filter(i => i.status === 'open').length} 个`);
    console.log(`  待复核: ${allIssues.filter(i => i.status === 'supplemented').length} 个`);
    console.log(`  已解决: ${allIssues.filter(i => i.status === 'resolved').length} 个`);
    console.log('----------------------------------------');

    if (allIssues.length === 0) {
      console.log('✅ 所有路线检测通过，无安全隐患');
    } else {
      console.log('问题详情:');
      console.log('');
      allIssues.forEach((issue, index) => {
        const route = routes.find(r => r.id === issue.routeId);
        const routeObstacles = (obstacles || []).filter(o => o.routeId === issue.routeId);

        console.log(`【${index + 1}】${issue.description}`);
        console.log(`    类型: ${getIssueTypeLabel(issue.type)}`);
        console.log(`    状态: ${getStatusLabel(issue.status)}`);
        console.log(`    严重程度: ${issue.severity === 'warning' ? '⚠️  警告' : '❌ 错误'}`);

        if (route) {
          console.log(`    路线: ${route.name} (${route.id})`);
          console.log(`    记录长度: ${route.length}m`);
          if (route.calculatedLength) {
            console.log(`    实测长度: ${route.calculatedLength}m`);
            console.log(`    差异: ${(Math.abs(route.length - route.calculatedLength)).toFixed(2)}m`);
          }
        }

        if (issue.missingMaterials && issue.missingMaterials.length > 0) {
          console.log(`    缺失材料: ${issue.missingMaterials.join('、')}`);
        }

        if (routeObstacles.length > 0) {
          console.log(`    障碍物备注:`);
          routeObstacles.forEach(obs => {
            console.log(`      - ${obs.content}`);
          });
        }

        console.log(`    为什么被留下: 该路线为补录路线，未重新计算长度，可能存在安全隐患`);
        console.log(`    下一步: ${getNextActionLabel(issue.nextAction)}`);

        if (issue.reviewNotes) {
          console.log(`    复核意见: ${issue.reviewNotes}`);
        }

        console.log('');
      });
    }

    console.log('========================================');

    if (args.output) {
      const outputPath = resolve(process.cwd(), args.output);
      const result = {
        projectId: project.id,
        projectName: project.name,
        totalRoutes: routes.length,
        supplementaryRoutes: routes.filter(r => r.isSupplementary).length,
        totalIssues: allIssues.length,
        openIssues: allIssues.filter(i => i.status !== 'resolved').length,
        resolvedIssues: allIssues.filter(i => i.status === 'resolved').length,
        issues: allIssues,
        detectedAt: new Date().toISOString()
      };
      writeFileSync(outputPath, JSON.stringify(result, null, 2), 'utf-8');
      console.log(`\n检测结果已保存到: ${outputPath}`);
    }
  }
}

main();
