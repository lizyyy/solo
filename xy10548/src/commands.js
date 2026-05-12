const path = require('path');
const fs = require('fs');
const storage = require('./utils/storage');
const logger = require('./utils/logger');
const validator = require('./core/validator');
const diffEngine = require('./core/diff-engine');

function getOrCreateCurrentAudit(workDir) {
  let auditId = storage.getCurrentAuditId(workDir);
  
  if (!auditId) {
    const audits = storage.listAudits(workDir);
    if (audits.length > 0) {
      auditId = audits[0].id;
      storage.setCurrentAuditId(workDir, auditId);
    }
  }
  
  return auditId;
}

function requireCurrentAudit(workDir) {
  const auditId = getOrCreateCurrentAudit(workDir);
  if (!auditId) {
    throw new Error('当前没有活动的盘点任务，请先运行 init 命令');
  }
  return auditId;
}

async function init({ name, workDir }) {
  const auditId = storage.generateId();
  const now = new Date().toISOString();
  
  const auditData = {
    name: name || `盘点任务-${now.split('T')[0]}`,
    status: 'initialized',
    createdAt: now,
    updatedAt: now,
    dataTypes: {
      book: false,
      scan: false,
      freeze: false,
      manual: false,
      recheck: false
    }
  };
  
  const auditDir = storage.getAuditDir(workDir, auditId);
  storage.ensureDir(auditDir);
  storage.saveAuditData(workDir, auditId, auditData);
  storage.setCurrentAuditId(workDir, auditId);
  
  storage.addLogEntry(workDir, auditId, {
    action: 'init',
    message: `初始化盘点任务: ${auditData.name}`,
    operator: process.env.USER || 'system'
  });
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ 盘点任务初始化成功');
  console.log('='.repeat(60));
  console.log(`  任务ID: ${auditId}`);
  console.log(`  任务名称: ${auditData.name}`);
  console.log(`  创建时间: ${auditData.createdAt}`);
  console.log('\n下一步: 导入数据');
  console.log('  inv-diff import book <账面库存文件>');
  console.log('  inv-diff import scan <扫码结果文件>');
  console.log('  inv-diff import freeze <冻结库位文件>');
  console.log('='.repeat(60) + '\n');
  
  return auditId;
}

async function importData({ type, filePath, workDir, operator }) {
  const auditId = requireCurrentAudit(workDir);
  
  if (!validator.isValidType(type)) {
    throw new Error(`不支持的数据类型: ${type}. 支持: book, scan, freeze, manual, recheck`);
  }
  
  const absolutePath = path.resolve(filePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`文件不存在: ${absolutePath}`);
  }
  
  const data = storage.readJson(absolutePath);
  if (!data) {
    throw new Error(`无法读取文件: ${absolutePath}`);
  }
  
  const errors = validator.validate(type, data);
  if (errors.length > 0) {
    console.log('\n❌ 数据验证失败:');
    for (const err of errors) {
      console.log(`   - ${err.field}: ${err.message}`);
    }
    throw new Error(`数据验证失败，共 ${errors.length} 个错误`);
  }
  
  const existingData = storage.readDataType(workDir, auditId, type);
  const existingCount = existingData.length;
  
  const duplicates = findDuplicateEntries(existingData, data, type);
  if (duplicates.length > 0) {
    console.log(`\n⚠️  发现 ${duplicates.length} 条重复记录（幂等性保护，将跳过）:`);
    for (const dup of duplicates.slice(0, 5)) {
      console.log(`   - ${JSON.stringify(dup.key)}`);
    }
    if (duplicates.length > 5) {
      console.log(`   ... 还有 ${duplicates.length - 5} 条`);
    }
  }
  
  const newData = filterDuplicates(existingData, data, type);
  const addedCount = newData.length;
  
  const mergedData = [...existingData, ...newData];
  storage.writeDataType(workDir, auditId, type, mergedData);
  
  const auditData = storage.getAuditData(workDir, auditId);
  auditData.dataTypes[type] = true;
  auditData.updatedAt = new Date().toISOString();
  storage.saveAuditData(workDir, auditId, auditData);
  
  storage.addLogEntry(workDir, auditId, {
    action: 'import',
    type,
    message: `导入 ${type} 数据`,
    details: {
      filePath: absolutePath,
      existingCount,
      addedCount,
      duplicateCount: duplicates.length
    },
    operator
  });
  
  console.log('\n' + '='.repeat(60));
  console.log(`✅ 导入成功: ${getTypeName(type)}`);
  console.log('='.repeat(60));
  console.log(`  原有记录: ${existingCount} 条`);
  console.log(`  新增记录: ${addedCount} 条`);
  console.log(`  重复跳过: ${duplicates.length} 条`);
  console.log(`  当前总数: ${mergedData.length} 条`);
  console.log('='.repeat(60) + '\n');
  
  return { addedCount, duplicateCount: duplicates.length };
}

function getTypeName(type) {
  const names = {
    book: '账面库存',
    scan: '扫码结果',
    freeze: '冻结库位',
    manual: '手工补录',
    recheck: '复盘记录'
  };
  return names[type] || type;
}

function findDuplicateEntries(existing, incoming, type) {
  const duplicates = [];
  
  for (const item of incoming) {
    const key = makeItemKey(item, type);
    const exists = existing.some(e => makeItemKey(e, type) === key);
    if (exists) {
      duplicates.push({ key, item });
    }
  }
  
  return duplicates;
}

function filterDuplicates(existing, incoming, type) {
  return incoming.filter(item => {
    const key = makeItemKey(item, type);
    return !existing.some(e => makeItemKey(e, type) === key);
  });
}

function makeItemKey(item, type) {
  switch (type) {
    case 'book':
      return `${item.sku}||${item.location}`;
    case 'scan':
      return `${item.sku}||${item.location}||${item.scanTime}||${item.quantity}`;
    case 'freeze':
      return `${item.location}||${item.freezeTime}`;
    case 'manual':
      return `${item.sku}||${item.location}||${item.quantity}||${item.operator}`;
    case 'recheck':
      return `${item.sku}||${item.location}||${item.recheckTime}||${item.quantity}`;
    default:
      return JSON.stringify(item);
  }
}

async function check({ workDir }) {
  const auditId = requireCurrentAudit(workDir);
  const auditData = storage.getAuditData(workDir, auditId);
  
  console.log('\n' + '='.repeat(60));
  console.log('🔍 数据一致性检查');
  console.log('='.repeat(60));
  console.log(`  盘点任务: ${auditData.name}`);
  console.log(`  检查时间: ${new Date().toISOString()}`);
  console.log('='.repeat(60));
  
  console.log('\n📊 数据导入状态:');
  for (const [type, loaded] of Object.entries(auditData.dataTypes)) {
    const status = loaded ? '✅ 已导入' : '⚠️  未导入';
    const count = storage.readDataType(workDir, auditId, type).length;
    console.log(`  ${getTypeName(type)}: ${status} (${count} 条)`);
  }
  
  const book = storage.readDataType(workDir, auditId, 'book');
  const scans = storage.readDataType(workDir, auditId, 'scan');
  const freezes = storage.readDataType(workDir, auditId, 'freeze');
  const manuals = storage.readDataType(workDir, auditId, 'manual');
  const rechecks = storage.readDataType(workDir, auditId, 'recheck');
  
  const result = diffEngine.runAllChecks(book, scans, freezes, manuals, rechecks);
  
  console.log('\n🚩 问题检查结果:');
  if (result.issues.length === 0) {
    console.log('  ✅ 未发现问题');
  } else {
    const errors = result.issues.filter(i => i.severity === 'error');
    const warnings = result.issues.filter(i => i.severity === 'warning');
    
    if (errors.length > 0) {
      console.log(`\n  ❌ 严重问题 (${errors.length} 个):`);
      for (const issue of errors.slice(0, 10)) {
        console.log(`     - [${issue.category}] ${issue.sku || issue.location}: ${issue.detail}`);
      }
      if (errors.length > 10) {
        console.log(`     ... 还有 ${errors.length - 10} 个`);
      }
    }
    
    if (warnings.length > 0) {
      console.log(`\n  ⚠️  警告 (${warnings.length} 个):`);
      for (const issue of warnings.slice(0, 10)) {
        console.log(`     - [${issue.category}] ${issue.sku || issue.location}: ${issue.detail}`);
      }
      if (warnings.length > 10) {
        console.log(`     ... 还有 ${warnings.length - 10} 个`);
      }
    }
  }
  
  console.log('\n📈 差异汇总:');
  console.log(`  总SKU-库位组合: ${result.summary.totalItems}`);
  console.log(`  一致: ${result.summary.consistent}`);
  console.log(`  多货: ${result.summary.overstock}`);
  console.log(`  少货: ${result.summary.understock}`);
  
  storage.addLogEntry(workDir, auditId, {
    action: 'check',
    message: '执行数据一致性检查',
    details: {
      issueCount: result.issues.length,
      errorCount: result.issues.filter(i => i.severity === 'error').length,
      warningCount: result.issues.filter(i => i.severity === 'warning').length,
      summary: result.summary
    },
    operator: process.env.USER || 'system'
  });
  
  console.log('\n' + '='.repeat(60));
  if (result.issues.filter(i => i.severity === 'error').length > 0) {
    console.log('⚠️  存在严重问题，建议先修复后再生成报告');
  } else if (result.summary.overstock + result.summary.understock > 0) {
    console.log('ℹ️  存在差异，使用 detail 命令查看详情');
  } else {
    console.log('✅ 全部一致！');
  }
  console.log('='.repeat(60) + '\n');
  
  return result;
}

async function detail({ sku, location, workDir }) {
  const auditId = requireCurrentAudit(workDir);
  
  const book = storage.readDataType(workDir, auditId, 'book');
  const scans = storage.readDataType(workDir, auditId, 'scan');
  const freezes = storage.readDataType(workDir, auditId, 'freeze');
  const manuals = storage.readDataType(workDir, auditId, 'manual');
  const rechecks = storage.readDataType(workDir, auditId, 'recheck');
  
  const result = diffEngine.runAllChecks(book, scans, freezes, manuals, rechecks);
  
  let filteredDiffs = result.diffs;
  
  if (sku) {
    filteredDiffs = filteredDiffs.filter(d => d.sku === sku);
  }
  if (location) {
    filteredDiffs = filteredDiffs.filter(d => d.location === location);
  }
  
  if (filteredDiffs.length === 0) {
    console.log('\nℹ️  未找到匹配的记录');
    return;
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('📋 差异详情');
  console.log('='.repeat(80));
  
  for (const diff of filteredDiffs) {
    console.log(`\n${'-'.repeat(80)}`);
    console.log(`  SKU: ${diff.sku}  |  库位: ${diff.location}`);
    console.log(`  状态: ${diff.status}`);
    console.log(`${'-'.repeat(80)}`);
    
    console.log(`\n  📚 账面库存: ${diff.bookQuantity}`);
    console.log(`  📱 扫码数量: ${diff.scanQuantity}`);
    console.log(`  ✏️  手工补录: ${diff.manualQuantity}`);
    console.log(`  📊 实际合计: ${diff.actualQuantity}`);
    console.log(`  🔍 账面差异: ${diff.initialDiff > 0 ? '+' : ''}${diff.initialDiff}`);
    
    if (diff.recheckQuantity !== null) {
      console.log(`\n  🔄 复盘数量: ${diff.recheckQuantity}`);
      console.log(`  📉 复盘差异: ${diff.recheckDiff > 0 ? '+' : ''}${diff.recheckDiff}`);
      if (diff.recheckDiffExpanded) {
        console.log(`  ⚠️  复盘后差异扩大!`);
      }
    }
    
    console.log(`\n  🎯 差异来源分析:`);
    for (const source of diff.source) {
      console.log(`     - [${source.type}] ${source.detail} (置信度: ${source.confidence}%)`);
    }
    
    const relatedScans = scans.filter(s => s.sku === diff.sku && s.location === diff.location);
    if (relatedScans.length > 0) {
      console.log(`\n  📱 扫码记录 (${relatedScans.length} 条):`);
      for (const scan of relatedScans) {
        console.log(`     - ${scan.scanTime}: ${scan.quantity} ${scan.operator ? `(${scan.operator})` : ''}`);
      }
    }
    
    const relatedManuals = manuals.filter(m => m.sku === diff.sku && m.location === diff.location);
    if (relatedManuals.length > 0) {
      console.log(`\n  ✏️  手工补录记录 (${relatedManuals.length} 条):`);
      for (const manual of relatedManuals) {
        console.log(`     - ${manual.quantity > 0 ? '+' : ''}${manual.quantity} (${manual.operator})`);
        console.log(`       原因: ${manual.reason}`);
      }
    }
    
    const relatedRechecks = rechecks.filter(r => r.sku === diff.sku && r.location === diff.location);
    if (relatedRechecks.length > 0) {
      console.log(`\n  🔄 复盘记录 (${relatedRechecks.length} 条):`);
      for (const recheck of relatedRechecks) {
        console.log(`     - ${recheck.recheckTime}: ${recheck.quantity} (${recheck.operator})`);
        if (recheck.reason) {
          console.log(`       原因: ${recheck.reason}`);
        }
      }
    }
  }
  
  console.log('\n' + '='.repeat(80) + '\n');
  
  storage.addLogEntry(workDir, auditId, {
    action: 'detail',
    message: '查看差异详情',
    details: {
      filter: { sku, location },
      resultCount: filteredDiffs.length
    },
    operator: process.env.USER || 'system'
  });
  
  return filteredDiffs;
}

async function report({ workDir }) {
  const auditId = requireCurrentAudit(workDir);
  const auditData = storage.getAuditData(workDir, auditId);
  
  const book = storage.readDataType(workDir, auditId, 'book');
  const scans = storage.readDataType(workDir, auditId, 'scan');
  const freezes = storage.readDataType(workDir, auditId, 'freeze');
  const manuals = storage.readDataType(workDir, auditId, 'manual');
  const rechecks = storage.readDataType(workDir, auditId, 'recheck');
  
  const result = diffEngine.runAllChecks(book, scans, freezes, manuals, rechecks);
  
  const consistentDiffs = result.diffs.filter(d => d.status === '一致');
  const overstockDiffs = result.diffs.filter(d => d.status === '多货');
  const understockDiffs = result.diffs.filter(d => d.status === '少货');
  
  const closedDiffs = result.diffs.filter(d => d.finalStatus === '一致');
  
  console.log('\n' + '='.repeat(80));
  console.log('📊 仓库盘点差异报告');
  console.log('='.repeat(80));
  console.log(`  盘点任务: ${auditData.name}`);
  console.log(`  任务ID: ${auditId}`);
  console.log(`  生成时间: ${new Date().toISOString()}`);
  console.log('='.repeat(80));
  
  console.log('\n📈 一、整体概览');
  console.log('  ' + '-'.repeat(60));
  console.log(`  总SKU-库位组合: ${result.summary.totalItems}`);
  console.log(`  账面一致: ${result.summary.consistent} (${(result.summary.consistent / result.summary.totalItems * 100).toFixed(1)}%)`);
  console.log(`  多货: ${result.summary.overstock}`);
  console.log(`  少货: ${result.summary.understock}`);
  
  if (rechecks.length > 0) {
    console.log(`  复盘后已闭环: ${closedDiffs.length}`);
  }
  
  console.log('\n🚩 二、问题清单');
  console.log('  ' + '-'.repeat(60));
  
  const categoryStats = {};
  for (const issue of result.issues) {
    if (!categoryStats[issue.category]) {
      categoryStats[issue.category] = { count: 0, severity: issue.severity };
    }
    categoryStats[issue.category].count++;
  }
  
  if (Object.keys(categoryStats).length === 0) {
    console.log('  ✅ 无问题发现');
  } else {
    for (const [category, stat] of Object.entries(categoryStats)) {
      const icon = stat.severity === 'error' ? '❌' : '⚠️';
      console.log(`  ${icon} ${category}: ${stat.count} 个`);
    }
  }
  
  console.log('\n🎯 三、差异来源分析');
  console.log('  ' + '-'.repeat(60));
  
  const sourceStats = {};
  for (const diff of result.diffs) {
    if (diff.source.length > 0) {
      const mainSource = diff.source[0].type;
      if (!sourceStats[mainSource]) {
        sourceStats[mainSource] = 0;
      }
      sourceStats[mainSource]++;
    }
  }
  
  for (const [source, count] of Object.entries(sourceStats)) {
    console.log(`  - ${source}: ${count} 项`);
  }
  
  console.log('\n📋 四、差异明细');
  console.log('  ' + '-'.repeat(60));
  
  if (overstockDiffs.length > 0) {
    console.log(`\n  📈 多货明细 (${overstockDiffs.length} 项):`);
    for (const diff of overstockDiffs.slice(0, 20)) {
      console.log(`     ${diff.sku} @ ${diff.location}: 账面${diff.bookQuantity} | 实际${diff.actualQuantity} | +${diff.initialDiff}`);
    }
    if (overstockDiffs.length > 20) {
      console.log(`     ... 还有 ${overstockDiffs.length - 20} 项`);
    }
  }
  
  if (understockDiffs.length > 0) {
    console.log(`\n  📉 少货明细 (${understockDiffs.length} 项):`);
    for (const diff of understockDiffs.slice(0, 20)) {
      console.log(`     ${diff.sku} @ ${diff.location}: 账面${diff.bookQuantity} | 实际${diff.actualQuantity} | ${diff.initialDiff}`);
    }
    if (understockDiffs.length > 20) {
      console.log(`     ... 还有 ${understockDiffs.length - 20} 项`);
    }
  }
  
  console.log('\n🔄 五、复盘结果');
  console.log('  ' + '-'.repeat(60));
  
  if (rechecks.length === 0) {
    console.log('  ℹ️  暂无复盘数据');
  } else {
    console.log(`  复盘记录数: ${rechecks.length}`);
    console.log(`  复盘后一致: ${closedDiffs.length}`);
    
    const expanded = result.diffs.filter(d => d.recheckDiffExpanded);
    if (expanded.length > 0) {
      console.log(`  ⚠️  复盘后差异扩大: ${expanded.length} 项`);
    }
  }
  
  console.log('\n✅ 六、业务闭环判断');
  console.log('  ' + '-'.repeat(60));
  
  const errors = result.issues.filter(i => i.severity === 'error');
  const hasUnresolvedDiff = overstockDiffs.length + understockDiffs.length > 0;
  
  if (errors.length > 0) {
    console.log('  ❌ 存在严重问题，业务未闭环');
    console.log(`     - 严重问题数: ${errors.length}`);
    console.log('     建议: 先修复数据问题（补录原因、冻结库位等）');
  } else if (hasUnresolvedDiff && rechecks.length === 0) {
    console.log('  ⚠️  存在未处理差异，业务未闭环');
    console.log(`     - 差异数: ${overstockDiffs.length + understockDiffs.length}`);
    console.log('     建议: 进行复盘确认差异原因');
  } else if (hasUnresolvedDiff) {
    const remainingDiff = result.diffs.filter(d => d.finalStatus && d.finalStatus !== '一致');
    if (remainingDiff.length > 0) {
      console.log('  ⚠️  复盘后仍有差异，需要进一步处理');
      console.log(`     - 剩余差异数: ${remainingDiff.length}`);
    } else {
      console.log('  ✅ 业务已闭环!');
      console.log('     所有差异已通过复盘确认处理');
    }
  } else {
    console.log('  ✅ 业务已闭环!');
    console.log('     账面与实际完全一致');
  }
  
  console.log('\n' + '='.repeat(80) + '\n');
  
  storage.addLogEntry(workDir, auditId, {
    action: 'report',
    message: '生成盘点报告',
    details: {
      summary: result.summary,
      closedCount: closedDiffs.length,
      errorCount: errors.length
    },
    operator: process.env.USER || 'system'
  });
  
  return {
    ...result,
    closedCount: closedDiffs.length
  };
}

async function list({ workDir }) {
  const audits = storage.listAudits(workDir);
  const currentId = storage.getCurrentAuditId(workDir);
  
  if (audits.length === 0) {
    console.log('\nℹ️  暂无盘点任务');
    return;
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('📋 盘点任务列表');
  console.log('='.repeat(80));
  
  for (const audit of audits) {
    const marker = audit.id === currentId ? '👉' : '  ';
    console.log(`\n${marker} ID: ${audit.id}`);
    console.log(`   名称: ${audit.name}`);
    console.log(`   状态: ${audit.status}`);
    console.log(`   创建时间: ${audit.createdAt}`);
    console.log(`   数据: ${Object.entries(audit.dataTypes).filter(([_, v]) => v).map(([k]) => getTypeName(k)).join(', ') || '无'}`);
  }
  
  console.log('\n' + '='.repeat(80) + '\n');
  
  return audits;
}

async function switchAudit({ auditId, workDir }) {
  const audits = storage.listAudits(workDir);
  const exists = audits.some(a => a.id === auditId);
  
  if (!exists) {
    throw new Error(`盘点任务不存在: ${auditId}`);
  }
  
  storage.setCurrentAuditId(workDir, auditId);
  const auditData = storage.getAuditData(workDir, auditId);
  
  console.log(`\n✅ 已切换到盘点任务: ${auditData.name} (${auditId})\n`);
  
  storage.addLogEntry(workDir, auditId, {
    action: 'switch',
    message: '切换到当前任务',
    operator: process.env.USER || 'system'
  });
  
  return auditData;
}

async function status({ workDir }) {
  const auditId = storage.getCurrentAuditId(workDir);
  
  if (!auditId) {
    console.log('\nℹ️  当前没有活动的盘点任务\n');
    return;
  }
  
  const auditData = storage.getAuditData(workDir, auditId);
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 当前盘点任务状态');
  console.log('='.repeat(60));
  console.log(`  任务ID: ${auditId}`);
  console.log(`  任务名称: ${auditData.name}`);
  console.log(`  状态: ${auditData.status}`);
  console.log(`  创建时间: ${auditData.createdAt}`);
  console.log(`  更新时间: ${auditData.updatedAt}`);
  
  console.log('\n  数据导入状态:');
  for (const [type, loaded] of Object.entries(auditData.dataTypes)) {
    const status = loaded ? '✅' : '⬜';
    const count = storage.readDataType(workDir, auditId, type).length;
    console.log(`    ${status} ${getTypeName(type)}: ${count} 条`);
  }
  
  console.log('='.repeat(60) + '\n');
  
  return auditData;
}

async function log({ workDir, limit }) {
  const auditId = requireCurrentAudit(workDir);
  const logs = storage.readLog(workDir, auditId);
  
  const recentLogs = logs.slice(-limit).reverse();
  
  if (recentLogs.length === 0) {
    console.log('\nℹ️  暂无操作记录\n');
    return;
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('📜 操作历史记录');
  console.log('='.repeat(80));
  
  for (const entry of recentLogs) {
    console.log(`\n  [${entry.timestamp}] ${entry.action.toUpperCase()}`);
    console.log(`     操作者: ${entry.operator || 'system'}`);
    console.log(`     消息: ${entry.message}`);
    if (entry.details) {
      console.log(`     详情: ${JSON.stringify(entry.details)}`);
    }
  }
  
  console.log('\n' + '='.repeat(80) + '\n');
  
  return recentLogs;
}

module.exports = {
  init,
  import: importData,
  check,
  detail,
  report,
  list,
  switch: switchAudit,
  status,
  log
};
