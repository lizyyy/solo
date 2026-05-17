#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { applyPatch } = require('fast-json-patch');
const chalk = require('chalk');
const { Command } = require('commander');

const program = new Command();

program
  .name('jsonpatch-preview')
  .description('JSON Patch 预演工具 - 批量修改 JSON 配置前的安全预演')
  .version('1.0.0');

program
  .argument('<json-file>', '目标 JSON 文件路径')
  .argument('<patch-file>', 'JSON Patch 文件路径')
  .option('-o, --output <dir>', '报告输出目录', './reports')
  .option('--no-terminal', '不在终端输出摘要')
  .option('--json-report', '输出机器可读的 JSON 报告')
  .option('--human-report', '输出可读的 Markdown 报告')
  .action((jsonFile, patchFile, options) => {
    try {
      const originalJson = JSON.parse(fs.readFileSync(jsonFile, 'utf-8'));
      const patches = JSON.parse(fs.readFileSync(patchFile, 'utf-8'));

      const result = previewFile(jsonFile, originalJson, patches);
      const report = generateReport([result]);

      if (options.terminal) {
        console.log(generateTerminalSummary(report));
      }

      if (!fs.existsSync(options.output)) {
        fs.mkdirSync(options.output, { recursive: true });
      }

      if (options.jsonReport) {
        const jsonReportPath = path.join(options.output, 'preview-report.json');
        fs.writeFileSync(jsonReportPath, JSON.stringify(report, null, 2));
        console.log(`JSON 报告已保存到: ${jsonReportPath}`);
      }

      if (options.humanReport) {
        const mdReportPath = path.join(options.output, 'preview-report.md');
        fs.writeFileSync(mdReportPath, generateHumanReadable(report));
        console.log(`Markdown 报告已保存到: ${mdReportPath}`);
      }

      process.exit(report.summary.errorCount > 0 ? 1 : 0);
    } catch (error) {
      console.error(chalk.red(`❌ 错误: ${error.message}`));
      process.exit(1);
    }
  });

program
  .command('batch')
  .description('批量处理多个 JSON 文件')
  .requiredOption('-d, --dir <directory>', '包含 JSON 文件的目录')
  .requiredOption('-p, --patch <file>', 'Patch 文件路径')
  .option('-o, --output <dir>', '报告输出目录', './reports')
  .action((options) => {
    try {
      const patches = JSON.parse(fs.readFileSync(options.patch, 'utf-8'));
      const files = fs.readdirSync(options.dir)
        .filter(f => f.endsWith('.json'))
        .map(f => path.join(options.dir, f));

      const results = [];

      for (const file of files) {
        const originalJson = JSON.parse(fs.readFileSync(file, 'utf-8'));
        results.push(previewFile(file, originalJson, patches));
      }

      const report = generateReport(results);

      console.log(generateTerminalSummary(report));

      if (!fs.existsSync(options.output)) {
        fs.mkdirSync(options.output, { recursive: true });
      }

      const jsonReportPath = path.join(options.output, 'preview-report.json');
      fs.writeFileSync(jsonReportPath, JSON.stringify(report, null, 2));
      console.log(`JSON 报告已保存到: ${jsonReportPath}`);

      const mdReportPath = path.join(options.output, 'preview-report.md');
      fs.writeFileSync(mdReportPath, generateHumanReadable(report));
      console.log(`Markdown 报告已保存到: ${mdReportPath}`);

      process.exit(report.summary.errorCount > 0 ? 1 : 0);
    } catch (error) {
      console.error(chalk.red(`❌ 错误: ${error.message}`));
      process.exit(1);
    }
  });

function previewFile(filePath, originalJson, patches) {
  const validation = validatePatches(patches);
  const conflicts = detectConflicts(patches, originalJson);

  const hasErrors = !validation.valid || conflicts.some(c => c.severity === 'error');
  const previews = generatePatchPreviews(patches, originalJson);

  let patchedJson = originalJson;
  let success = !hasErrors;

  if (!hasErrors) {
    try {
      const result = applyPatch(JSON.parse(JSON.stringify(originalJson)), patches, true, true);
      patchedJson = result.newDocument;
    } catch (error) {
      success = false;
      conflicts.push({
        type: 'patch_application_error',
        path: '/',
        message: `Patch application failed: ${error.message}`,
        severity: 'error'
      });
    }
  }

  return {
    filePath,
    originalJson: JSON.parse(JSON.stringify(originalJson)),
    patches,
    patchedJson,
    validation,
    conflicts,
    previews,
    diff: calculateDiff(originalJson, patchedJson),
    success
  };
}

function validatePatches(patches) {
  const errors = [];
  const warnings = [];
  const validOperations = ['add', 'remove', 'replace', 'move', 'copy', 'test'];

  patches.forEach((patch, index) => {
    if (!validOperations.includes(patch.op)) {
      errors.push({
        type: 'invalid_operation',
        message: `Invalid operation "${patch.op}". Must be one of: ${validOperations.join(', ')}`,
        patchIndex: index,
        path: patch.path
      });
    }

    if (!patch.path || typeof patch.path !== 'string') {
      errors.push({
        type: 'missing_path',
        message: 'Patch must have a valid path string',
        patchIndex: index
      });
    } else if (!patch.path.startsWith('/')) {
      errors.push({
        type: 'invalid_path_format',
        message: `Path "${patch.path}" must start with "/"`,
        patchIndex: index,
        path: patch.path
      });
    }

    if (['add', 'replace', 'test'].includes(patch.op) && patch.value === undefined) {
      errors.push({
        type: 'missing_value',
        message: `Operation "${patch.op}" requires a "value" field`,
        patchIndex: index,
        path: patch.path
      });
    }

    if (['move', 'copy'].includes(patch.op)) {
      if (!patch.from) {
        errors.push({
          type: 'missing_from',
          message: `Operation "${patch.op}" requires a "from" field`,
          patchIndex: index,
          path: patch.path
        });
      } else if (!patch.from.startsWith('/')) {
        errors.push({
          type: 'invalid_from_format',
          message: `"from" path "${patch.from}" must start with "/"`,
          patchIndex: index,
          path: patch.from
        });
      }
    }

    if (patch.op === 'remove' && patch.value !== undefined) {
      warnings.push({
        type: 'unnecessary_value',
        message: `Operation "remove" does not need a "value" field - it will be ignored`,
        patchIndex: index,
        path: patch.path
      });
    }
  });

  return { valid: errors.length === 0, errors, warnings };
}

function detectConflicts(patches, originalJson) {
  const conflicts = [];

  patches.forEach((patch, index) => {
    const patchConflicts = detectPatchConflicts(patch, index, originalJson);
    conflicts.push(...patchConflicts);
  });

  const duplicateConflicts = detectDuplicatePaths(patches);
  conflicts.push(...duplicateConflicts);

  return conflicts;
}

function detectPatchConflicts(patch, patchIndex, originalJson) {
  const conflicts = [];
  const pathExists = pathExistsInJson(originalJson, patch.path);

  if (!pathExists) {
    if (patch.op === 'replace' || patch.op === 'remove' || patch.op === 'test') {
      conflicts.push({
        type: 'path_not_exists',
        path: patch.path,
        message: `Path "${patch.path}" does not exist in target JSON. Operation "${patch.op}" will fail.`,
        severity: 'error',
        patchIndex
      });
    }
  }

  if (pathExists && (patch.op === 'add' || patch.op === 'replace')) {
    const existingValue = getValueAtPath(originalJson, patch.path);
    if (typeof existingValue === 'object' && existingValue !== null && patch.value !== undefined) {
      if (typeof patch.value !== 'object' || patch.value === null) {
        conflicts.push({
          type: 'would_overwrite_nested',
          path: patch.path,
          message: `Path "${patch.path}" contains nested object/array but will be overwritten with a non-object value.`,
          severity: 'warning',
          patchIndex,
          existingValue,
          newValue: patch.value
        });
      }
    }
  }

  if (patch.op === 'test' && pathExists) {
    const existingValue = getValueAtPath(originalJson, patch.path);
    if (JSON.stringify(existingValue) !== JSON.stringify(patch.value)) {
      conflicts.push({
        type: 'test_failure',
        path: patch.path,
        message: `Test operation failed at path "${patch.path}". Expected value does not match.`,
        severity: 'error',
        patchIndex,
        existingValue,
        newValue: patch.value
      });
    }
  }

  return conflicts;
}

function detectDuplicatePaths(patches) {
  const conflicts = [];
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
        message: `Multiple patches target the same path "${path}". This may cause unexpected results.`,
        severity: 'warning',
        patchIndex: indices[0]
      });
    }
  });

  return conflicts;
}

function pathExistsInJson(obj, path) {
  if (path === '/') return true;
  
  const parts = path.split('/').filter(p => p !== '');
  let current = obj;

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i].replace(/~1/g, '/').replace(/~0/g, '~');
    
    if (current === null || current === undefined) {
      return false;
    }

    if (Array.isArray(current)) {
      const index = parseInt(part, 10);
      if (isNaN(index) || index < 0 || index >= current.length) {
        if (i === parts.length - 1 && part === '-') {
          return true;
        }
        return false;
      }
      current = current[index];
    } else if (typeof current === 'object') {
      if (!(part in current)) {
        return false;
      }
      current = current[part];
    } else {
      return false;
    }
  }

  return true;
}

function getValueAtPath(obj, path) {
  if (path === '/') return obj;
  
  const parts = path.split('/').filter(p => p !== '');
  let current = obj;

  for (const part of parts) {
    const decoded = part.replace(/~1/g, '/').replace(/~0/g, '~');
    
    if (current === null || current === undefined) {
      return undefined;
    }

    if (Array.isArray(current)) {
      const index = parseInt(decoded, 10);
      if (isNaN(index)) {
        return undefined;
      }
      current = current[index];
    } else if (typeof current === 'object') {
      current = current[decoded];
    } else {
      return undefined;
    }
  }

  return current;
}

function generatePatchPreviews(patches, originalJson) {
  const previews = [];
  let currentJson = JSON.parse(JSON.stringify(originalJson));

  patches.forEach((patch, index) => {
    try {
      const originalValue = getValueAtPath(currentJson, patch.path);
      const result = applyPatch(currentJson, [patch], true, true);
      const newValue = getValueAtPath(result.newDocument, patch.path);

      previews.push({
        originalValue,
        newValue,
        path: patch.path,
        op: patch.op,
        changed: JSON.stringify(originalValue) !== JSON.stringify(newValue)
      });

      currentJson = result.newDocument;
    } catch {
      previews.push({
        originalValue: undefined,
        newValue: undefined,
        path: patch.path,
        op: patch.op,
        changed: false
      });
    }
  });

  return previews;
}

function calculateDiff(oldObj, newObj, path = '') {
  const diffs = [];

  if (JSON.stringify(oldObj) === JSON.stringify(newObj)) {
    return diffs;
  }

  if (oldObj === null || newObj === null || typeof oldObj !== typeof newObj) {
    diffs.push({
      path: path || '/',
      op: 'replace',
      oldValue: oldObj,
      newValue: newObj
    });
    return diffs;
  }

  if (Array.isArray(oldObj) && Array.isArray(newObj)) {
    const maxLen = Math.max(oldObj.length, newObj.length);
    for (let i = 0; i < maxLen; i++) {
      const currPath = `${path}/${i}`;
      if (i >= oldObj.length) {
        diffs.push({ path: currPath, op: 'add', newValue: newObj[i] });
      } else if (i >= newObj.length) {
        diffs.push({ path: currPath, op: 'remove', oldValue: oldObj[i] });
      } else if (JSON.stringify(oldObj[i]) !== JSON.stringify(newObj[i])) {
        if (typeof oldObj[i] === 'object' && typeof newObj[i] === 'object') {
          diffs.push(...calculateDiff(oldObj[i], newObj[i], currPath));
        } else {
          diffs.push({
            path: currPath,
            op: 'replace',
            oldValue: oldObj[i],
            newValue: newObj[i]
          });
        }
      }
    }
    return diffs;
  }

  if (typeof oldObj === 'object' && typeof newObj === 'object') {
    const allKeys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)]);

    for (const key of allKeys) {
      const currPath = path ? `${path}/${key}` : `/${key}`;
      if (!(key in oldObj)) {
        diffs.push({ path: currPath, op: 'add', newValue: newObj[key] });
      } else if (!(key in newObj)) {
        diffs.push({ path: currPath, op: 'remove', oldValue: oldObj[key] });
      } else if (JSON.stringify(oldObj[key]) !== JSON.stringify(newObj[key])) {
        if (typeof oldObj[key] === 'object' && typeof newObj[key] === 'object') {
          diffs.push(...calculateDiff(oldObj[key], newObj[key], currPath));
        } else {
          diffs.push({
            path: currPath,
            op: 'replace',
            oldValue: oldObj[key],
            newValue: newObj[key]
          });
        }
      }
    }
  }

  return diffs;
}

function generateReport(results) {
  let errorCount = 0;
  let warningCount = 0;
  let conflictCount = 0;
  let successCount = 0;
  let changedFiles = 0;
  let totalPatches = 0;

  results.forEach(r => {
    totalPatches += r.patches.length;
    conflictCount += r.conflicts.length;
    errorCount += r.conflicts.filter(c => c.severity === 'error').length + r.validation.errors.length;
    warningCount += r.conflicts.filter(c => c.severity === 'warning').length + r.validation.warnings.length;
    if (r.success) successCount++;
    if (r.diff.length > 0) changedFiles++;
  });

  return {
    summary: {
      totalFiles: results.length,
      totalPatches,
      successCount,
      conflictCount,
      errorCount,
      warningCount,
      changedFiles
    },
    results,
    generatedAt: new Date().toISOString()
  };
}

function generateTerminalSummary(report) {
  const lines = [];
  const { summary } = report;

  lines.push('');
  lines.push(chalk.bold.cyan('═'.repeat(60)));
  lines.push(chalk.bold.cyan('           JSON PATCH 预演报告摘要'));
  lines.push(chalk.bold.cyan('═'.repeat(60)));
  lines.push('');

  lines.push(`${chalk.bold('📁 处理文件:')} ${summary.totalFiles} 个`);
  lines.push(`${chalk.bold('📝 补丁总数:')} ${summary.totalPatches} 个`);
  lines.push('');

  if (summary.errorCount > 0) {
    lines.push(chalk.red(`  ❌ 错误: ${summary.errorCount} 个`));
  }
  if (summary.warningCount > 0) {
    lines.push(chalk.yellow(`  ⚠️  警告: ${summary.warningCount} 个`));
  }
  if (summary.conflictCount > 0) {
    lines.push(chalk.magenta(`  🔀 冲突: ${summary.conflictCount} 个`));
  }
  lines.push('');

  lines.push(`${chalk.bold('✅ 成功文件:')} ${summary.successCount} 个`);
  lines.push(`${chalk.bold('🔄 有变更:')} ${summary.changedFiles} 个`);
  lines.push('');

  report.results.forEach((result) => {
    const statusIcon = result.success ? chalk.green('✅') : chalk.red('❌');
    lines.push(`${statusIcon} ${result.filePath}`);
    
    const errors = result.conflicts.filter(c => c.severity === 'error');
    const warnings = result.conflicts.filter(c => c.severity === 'warning');
    
    if (errors.length > 0) {
      lines.push(`     ${chalk.red(`错误: ${errors.length}`)}`);
      errors.slice(0, 2).forEach(e => {
        lines.push(`       • ${e.path}: ${e.message}`);
      });
      if (errors.length > 2) {
        lines.push(`       ... 还有 ${errors.length - 2} 个错误`);
      }
    }
    
    if (warnings.length > 0) {
      lines.push(`     ${chalk.yellow(`警告: ${warnings.length}`)}`);
    }
    
    if (result.diff.length > 0) {
      lines.push(`     ${chalk.blue(`变更: ${result.diff.length} 处`)}`);
    }
  });

  lines.push('');
  lines.push(chalk.gray('  详细报告请查看输出文件'));
  lines.push('');

  return lines.join('\n');
}

function generateHumanReadable(report) {
  const lines = [];

  lines.push('# JSON Patch 预演报告');
  lines.push('');
  lines.push(`生成时间: ${report.generatedAt}`);
  lines.push('');
  lines.push('## 摘要');
  lines.push('');
  lines.push(`- **处理文件**: ${report.summary.totalFiles} 个`);
  lines.push(`- **补丁总数**: ${report.summary.totalPatches} 个`);
  lines.push(`- **成功文件**: ${report.summary.successCount} 个`);
  lines.push(`- **有变更**: ${report.summary.changedFiles} 个`);
  lines.push(`- **错误**: ${report.summary.errorCount} 个`);
  lines.push(`- **警告**: ${report.summary.warningCount} 个`);
  lines.push(`- **冲突**: ${report.summary.conflictCount} 个`);
  lines.push('');

  report.results.forEach((result) => {
    lines.push('---');
    lines.push('');
    lines.push(`## 文件: \`${result.filePath}\``);
    lines.push('');
    lines.push(`**状态**: ${result.success ? '✅ 成功' : '❌ 失败'}`);
    lines.push('');

    if (result.validation.errors.length > 0) {
      lines.push('### 📋 验证错误');
      lines.push('');
      result.validation.errors.forEach((err, i) => {
        lines.push(`${i + 1}. **[${err.type}]** ${err.message}`);
        if (err.patchIndex !== undefined) {
          lines.push(`   - 补丁位置: #${err.patchIndex}`);
        }
        if (err.path) {
          lines.push(`   - 路径: \`${err.path}\``);
        }
      });
      lines.push('');
    }

    if (result.validation.warnings.length > 0) {
      lines.push('### ⚠️  验证警告');
      lines.push('');
      result.validation.warnings.forEach((warn, i) => {
        lines.push(`${i + 1}. **[${warn.type}]** ${warn.message}`);
        if (warn.patchIndex !== undefined) {
          lines.push(`   - 补丁位置: #${warn.patchIndex}`);
        }
      });
      lines.push('');
    }

    if (result.conflicts.length > 0) {
      lines.push('### 🔀 冲突检测');
      lines.push('');
      result.conflicts.forEach((conflict, i) => {
        const severity = conflict.severity === 'error' ? '🔴' : '🟡';
        lines.push(`${i + 1}. ${severity} **[${conflict.type}]** \`${conflict.path}\``);
        lines.push(`   ${conflict.message}`);
        if (conflict.patchIndex !== undefined) {
          lines.push(`   - 补丁位置: #${conflict.patchIndex}`);
        }
        if (conflict.existingValue !== undefined) {
          lines.push(`   - 现有值: \`${JSON.stringify(conflict.existingValue)}\``);
        }
        if (conflict.newValue !== undefined) {
          lines.push(`   - 新值: \`${JSON.stringify(conflict.newValue)}\``);
        }
        lines.push('');
      });
    }

    if (result.diff.length > 0) {
      lines.push('### 🔄 变更详情');
      lines.push('');
      result.diff.forEach((diff, i) => {
        const opIcon = diff.op === 'add' ? '➕' : diff.op === 'remove' ? '➖' : '🔄';
        lines.push(`${i + 1}. ${opIcon} **${diff.op.toUpperCase()}** \`${diff.path}\``);
        if (diff.oldValue !== undefined) {
          lines.push(`   - 旧值: \`${JSON.stringify(diff.oldValue)}\``);
        }
        if (diff.newValue !== undefined) {
          lines.push(`   - 新值: \`${JSON.stringify(diff.newValue)}\``);
        }
        lines.push('');
      });
    }

    if (result.success) {
      lines.push('### 📝 补丁预览');
      lines.push('');
      lines.push('```json');
      lines.push(JSON.stringify(result.patchedJson, null, 2));
      lines.push('```');
      lines.push('');
    }

    lines.push('### 📜 补丁列表');
    lines.push('');
    lines.push('| # | 操作 | 路径 | 值 |');
    lines.push('|---|------|------|----|');
    result.patches.forEach((patch, i) => {
      const value = patch.value !== undefined ? JSON.stringify(patch.value).substring(0, 50) : '-';
      lines.push(`| ${i} | ${patch.op} | \`${patch.path}\` | ${value} |`);
    });
    lines.push('');
  });

  return lines.join('\n');
}

program.parse();
