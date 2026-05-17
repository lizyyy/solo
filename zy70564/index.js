#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { applyPatch } = require('fast-json-patch');
const chalk = require('chalk');
const { Command } = require('commander');

const program = new Command();

function validatePatches(patches) {
  const validOps = ['add', 'remove', 'replace', 'move', 'copy', 'test'];
  const errors = [];
  const warnings = [];

  patches.forEach((patch, index) => {
    if (!validOps.includes(patch.op)) {
      errors.push({
        type: 'invalid_operation',
        message: `Invalid operation "${patch.op}"`,
        patchIndex: index,
        path: patch.path
      });
    }

    if (!patch.path || !patch.path.startsWith('/')) {
      errors.push({
        type: 'invalid_path',
        message: `Path must start with "/"`,
        patchIndex: index
      });
    }

    if (['add', 'replace', 'test'].includes(patch.op) && patch.value === undefined) {
      errors.push({
        type: 'missing_value',
        message: `Operation "${patch.op}" requires a value`,
        patchIndex: index
      });
    }
  });

  return { valid: errors.length === 0, errors, warnings };
}

function getValueAtPath(obj, pathStr) {
  if (pathStr === '/') return obj;
  const parts = pathStr.split('/').filter(p => p !== '');
  let current = obj;

  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (Array.isArray(current)) {
      const index = parseInt(part, 10);
      if (isNaN(index)) return undefined;
      current = current[index];
    } else if (typeof current === 'object') {
      current = current[part];
    } else {
      return undefined;
    }
  }
  return current;
}

function pathExists(obj, pathStr) {
  if (pathStr === '/') return true;
  const parts = pathStr.split('/').filter(p => p !== '');
  let current = obj;

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (current === null || current === undefined) return false;

    if (Array.isArray(current)) {
      const index = parseInt(part, 10);
      if (isNaN(index) || index < 0 || index >= current.length) {
        if (i === parts.length - 1 && part === '-') return true;
        return false;
      }
      current = current[index];
    } else if (typeof current === 'object') {
      if (!(part in current)) return false;
      current = current[part];
    } else {
      return false;
    }
  }
  return true;
}

function detectConflicts(patches, originalJson) {
  const conflicts = [];

  patches.forEach((patch, index) => {
    const exists = pathExists(originalJson, patch.path);

    if (!exists) {
      if (patch.op === 'replace' || patch.op === 'remove' || patch.op === 'test') {
        conflicts.push({
          type: 'path_not_exists',
          path: patch.path,
          message: `Path "${patch.path}" does not exist. Operation "${patch.op}" will fail.`,
          severity: 'error',
          patchIndex: index
        });
      }
    }

    if (exists && (patch.op === 'add' || patch.op === 'replace')) {
      const existing = getValueAtPath(originalJson, patch.path);
      if (typeof existing === 'object' && existing !== null && patch.value !== undefined) {
        if (typeof patch.value !== 'object' || patch.value === null) {
          conflicts.push({
            type: 'would_overwrite_nested',
            path: patch.path,
            message: `Path "${patch.path}" has nested object but will be overwritten with non-object value.`,
            severity: 'warning',
            patchIndex: index
          });
        }
      }
    }

    if (patch.op === 'test' && exists) {
      const existing = getValueAtPath(originalJson, patch.path);
      if (JSON.stringify(existing) !== JSON.stringify(patch.value)) {
        conflicts.push({
          type: 'test_failure',
          path: patch.path,
          message: `Test failed at path "${patch.path}". Value mismatch.`,
          severity: 'error',
          patchIndex: index
        });
      }
    }
  });

  const pathCounts = new Map();
  patches.forEach((patch, index) => {
    const existing = pathCounts.get(patch.path) || [];
    existing.push(index);
    pathCounts.set(patch.path, existing);
  });

  pathCounts.forEach((indices, path) => {
    if (indices.length > 1) {
      conflicts.push({
        type: 'duplicate_path',
        path,
        message: `Multiple patches target the same path "${path}".`,
        severity: 'warning',
        patchIndex: indices[0]
      });
    }
  });

  return conflicts;
}

function generateDiff(oldObj, newObj, prefix = '') {
  const diffs = [];
  const oldKeys = oldObj && typeof oldObj === 'object' ? Object.keys(oldObj) : [];
  const newKeys = newObj && typeof newObj === 'object' ? Object.keys(newObj) : [];
  const allKeys = new Set([...oldKeys, ...newKeys]);

  for (const key of allKeys) {
    const path = prefix ? `${prefix}/${key}` : `/${key}`;
    const oldVal = oldObj?.[key];
    const newVal = newObj?.[key];

    if (!newObj || !(key in newObj)) {
      diffs.push({ path, op: 'remove', oldValue: oldVal });
    } else if (!oldObj || !(key in oldObj)) {
      diffs.push({ path, op: 'add', newValue: newVal });
    } else if (typeof oldVal === 'object' && typeof newVal === 'object' && oldVal !== null && newVal !== null) {
      diffs.push(...generateDiff(oldVal, newVal, path));
    } else if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      diffs.push({ path, op: 'replace', oldValue: oldVal, newValue: newVal });
    }
  }

  return diffs;
}

function previewFile(filePath, originalJson, patches) {
  const validation = validatePatches(patches);
  const conflicts = detectConflicts(patches, originalJson);

  let patchedJson = originalJson;
  let diff = [];

  try {
    const result = applyPatch(JSON.parse(JSON.stringify(originalJson)), patches, true, true);
    patchedJson = result.newDocument;
    diff = generateDiff(originalJson, patchedJson);
  } catch (error) {
    validation.errors.push({
      type: 'patch_application_error',
      message: `Failed to apply patches: ${error.message}`
    });
  }

  return {
    filePath,
    originalJson,
    patches,
    patchedJson,
    validation,
    conflicts,
    diff,
    success: validation.valid && conflicts.every(c => c.severity !== 'error')
  };
}

function generateTerminalReport(report) {
  const lines = [];
  lines.push('');
  lines.push(chalk.bold.cyan('='.repeat(60)));
  lines.push(chalk.bold.cyan('          JSON PATCH 预演报告'));
  lines.push(chalk.bold.cyan('='.repeat(60)));
  lines.push('');

  lines.push(chalk.bold('📊 统计信息'));
  lines.push(`   总文件数: ${report.summary.totalFiles}`);
  lines.push(`   总补丁数: ${report.summary.totalPatches}`);
  lines.push(`   成功文件: ${report.summary.successCount}/${report.summary.totalFiles}`);
  lines.push(`   变更文件: ${report.summary.changedFiles}/${report.summary.totalFiles}`);
  
  if (report.summary.errorCount > 0) {
    lines.push(`   ${chalk.red('错误数量')}: ${report.summary.errorCount}`);
  }
  if (report.summary.warningCount > 0) {
    lines.push(`   ${chalk.yellow('警告数量')}: ${report.summary.warningCount}`);
  }
  lines.push('');

  for (const result of report.results) {
    const statusIcon = result.success ? chalk.green('✅') : chalk.red('❌');
    lines.push(`${statusIcon} ${chalk.bold(result.filePath)}`);
    
    if (result.conflicts.length > 0) {
      lines.push('   冲突:');
      for (const conflict of result.conflicts) {
        const icon = conflict.severity === 'error' ? chalk.red('  ✗') : chalk.yellow('  ⚠');
        lines.push(`   ${icon} [${conflict.type}] ${conflict.path}`);
        lines.push(`      ${conflict.message}`);
      }
    }

    if (result.diff.length > 0) {
      lines.push(`   ${chalk.bold('变更:')} ${result.diff.length} 处`);
      for (const d of result.diff.slice(0, 5)) {
        const opColor = d.op === 'add' ? chalk.green : d.op === 'remove' ? chalk.red : chalk.blue;
        lines.push(`      ${opColor(d.op.toUpperCase())} ${d.path}`);
      }
      if (result.diff.length > 5) {
        lines.push(`      ... 还有 ${result.diff.length - 5} 处变更`);
      }
    }
    lines.push('');
  }

  lines.push(chalk.cyan(`报告生成时间: ${report.generatedAt}`));
  lines.push('');

  return lines.join('\n');
}

function generateHtmlReport(report) {
  const resultsHtml = report.results.map(r => {
    const conflictsHtml = r.conflicts.map(c => `
        <div class="conflict-item ${c.severity}">
          <div class="conflict-type">${c.type}</div>
          <div class="conflict-path">${c.path}</div>
          <div>${c.message}</div>
        </div>
    `).join('');

    const diffHtml = r.diff.map(d => `
        <div class="diff-item diff-${d.op}">
          ${d.op.toUpperCase()} ${d.path}
        </div>
    `).join('');

    return `
      <div class="file-result">
        <div class="file-header">
          <span class="file-name">📄 ${r.filePath}</span>
          <span class="status-${r.success ? 'success' : 'failed'}">
            ${r.success ? '✅ 成功' : '❌ 失败'}
          </span>
        </div>
        
        ${r.conflicts.length > 0 ? `
        <div class="section">
          <div class="section-title">⚠️ 冲突 (${r.conflicts.length})</div>
          ${conflictsHtml}
        </div>
        ` : ''}
        
        ${r.diff.length > 0 ? `
        <div class="section">
          <div class="section-title">📝 变更 (${r.diff.length})</div>
          ${diffHtml}
        </div>
        ` : ''}
      </div>
    `;
  }).join('');

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>JSON Patch 预演报告</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f5f7fa; color: #333; line-height: 1.6; }
        .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px; margin-bottom: 30px; }
        .header h1 { font-size: 28px; margin-bottom: 10px; }
        .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin-bottom: 30px; }
        .stat-card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); text-align: center; }
        .stat-value { font-size: 32px; font-weight: bold; }
        .stat-label { color: #666; font-size: 14px; }
        .file-result { background: white; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); margin-bottom: 20px; overflow: hidden; }
        .file-header { padding: 15px 20px; background: #f8f9fa; border-bottom: 1px solid #eee; display: flex; align-items: center; justify-content: space-between; }
        .file-name { font-weight: 600; font-size: 16px; }
        .status-success { color: #10b981; font-weight: bold; }
        .status-failed { color: #ef4444; font-weight: bold; }
        .section { padding: 15px 20px; border-bottom: 1px solid #eee; }
        .section-title { font-weight: 600; margin-bottom: 10px; color: #4b5563; }
        .conflict-item { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 10px 15px; margin-bottom: 8px; border-radius: 0 4px 4px 0; }
        .conflict-item.error { background: #fee2e2; border-left-color: #ef4444; }
        .conflict-type { font-weight: 600; font-size: 12px; text-transform: uppercase; }
        .conflict-path { font-family: monospace; color: #7c3aed; }
        .diff-item { font-family: monospace; padding: 5px 0; }
        .diff-add { color: #10b981; }
        .diff-remove { color: #ef4444; }
        .diff-replace { color: #3b82f6; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔍 JSON Patch 预演报告</h1>
            <p>生成时间: ${report.generatedAt}</p>
        </div>
        
        <div class="stats">
            <div class="stat-card">
                <div class="stat-value">${report.summary.totalFiles}</div>
                <div class="stat-label">总文件数</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${report.summary.totalPatches}</div>
                <div class="stat-label">总补丁数</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" style="color: ${report.summary.successCount === report.summary.totalFiles ? '#10b981' : '#f59e0b'}">${report.summary.successCount}/${report.summary.totalFiles}</div>
                <div class="stat-label">成功</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" style="color: ${report.summary.errorCount > 0 ? '#ef4444' : '#10b981'}">${report.summary.errorCount}</div>
                <div class="stat-label">错误</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" style="color: ${report.summary.warningCount > 0 ? '#f59e0b' : '#10b981'}">${report.summary.warningCount}</div>
                <div class="stat-label">警告</div>
            </div>
        </div>
        ${resultsHtml}
        <div class="footer">
            <p>JSON Patch Preview CLI 工具生成</p>
        </div>
    </div>
</body>
</html>`;
}

program
  .name('jsonpatch-preview')
  .description('JSON Patch 预演 CLI 工具')
  .version('1.0.0');

program
  .command('preview')
  .description('预演 JSON Patch 操作')
  .requiredOption('-f, --file <files...>', '目标 JSON 文件路径')
  .requiredOption('-p, --patch <patch-file>', 'JSON Patch 文件路径')
  .option('-o, --output <output-dir>', '输出报告目录', './patch-reports')
  .option('--json', '输出机器可读的 JSON 报告')
  .option('--html', '输出 HTML 格式报告')
  .option('--no-terminal', '不输出终端摘要')
  .action((options) => {
    try {
      const patchContent = fs.readFileSync(options.patch, 'utf8');
      const patches = JSON.parse(patchContent);

      if (!Array.isArray(patches)) {
        console.error('错误: Patch 文件必须是 JSON 数组');
        process.exit(1);
      }

      const results = [];

      for (const filePath of options.file) {
        if (!fs.existsSync(filePath)) {
          console.error(`错误: 文件不存在: ${filePath}`);
          process.exit(1);
        }

        const fileContent = fs.readFileSync(filePath, 'utf8');
        const json = JSON.parse(fileContent);
        const result = previewFile(filePath, json, patches);
        results.push(result);
      }

      const report = {
        summary: {
          totalFiles: options.file.length,
          totalPatches: patches.length,
          successCount: results.filter(r => r.success).length,
          conflictCount: results.reduce((sum, r) => sum + r.conflicts.length, 0),
          errorCount: results.reduce((sum, r) => sum + r.conflicts.filter(c => c.severity === 'error').length, 0),
          warningCount: results.reduce((sum, r) => sum + r.conflicts.filter(c => c.severity === 'warning').length, 0),
          changedFiles: results.filter(r => r.diff.length > 0).length
        },
        results,
        generatedAt: new Date().toISOString()
      };

      if (options.terminal !== false) {
        console.log(generateTerminalReport(report));
      }

      if (!fs.existsSync(options.output)) {
        fs.mkdirSync(options.output, { recursive: true });
      }

      if (options.json) {
        const jsonPath = path.join(options.output, 'report.json');
        fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
        console.log(`JSON 报告已保存: ${jsonPath}`);
      }

      if (options.html) {
        const htmlPath = path.join(options.output, 'report.html');
        fs.writeFileSync(htmlPath, generateHtmlReport(report));
        console.log(`HTML 报告已保存: ${htmlPath}`);
      }

      if (!options.json && !options.html) {
        const jsonPath = path.join(options.output, 'report.json');
        const htmlPath = path.join(options.output, 'report.html');
        fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
        fs.writeFileSync(htmlPath, generateHtmlReport(report));
        console.log(`报告已保存到: ${options.output}/`);
      }

      const hasErrors = !results.every(r => r.success);
      process.exit(hasErrors ? 1 : 0);
    } catch (error) {
      console.error('执行失败:', error.message);
      process.exit(1);
    }
  });

program
  .command('validate')
  .description('仅验证 JSON Patch 语法')
  .requiredOption('-p, --patch <patch-file>', 'JSON Patch 文件路径')
  .action((options) => {
    try {
      const patchContent = fs.readFileSync(options.patch, 'utf8');
      const patches = JSON.parse(patchContent);
      const validation = validatePatches(patches);

      if (validation.valid) {
        console.log(chalk.green('✅ Patch 语法验证通过'));
        console.log(`共 ${patches.length} 个操作`);
        process.exit(0);
      } else {
        console.error(chalk.red('❌ Patch 验证失败:'));
        validation.errors.forEach(err => {
          console.error(`  - [${err.type}] ${err.message}`);
        });
        process.exit(1);
      }
    } catch (error) {
      console.error('Patch 验证失败:', error.message);
      process.exit(1);
    }
  });

program.parse(process.argv);
