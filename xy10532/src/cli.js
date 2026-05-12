const storage = require('./storage');
const rules = require('./rules');
const samples = require('./samples');

const STATUS_MAP = {
  IMPORTED: { label: '已导入', color: '\x1b[36m', symbol: '📥' },
  PENDING_CHECK: { label: '待检查', color: '\x1b[33m', symbol: '⏳' },
  ACCEPTABLE: { label: '可受理', color: '\x1b[32m', symbol: '✅' },
  ACCEPTABLE_WITH_WARNING: { label: '可受理(有警告)', color: '\x1b[32m', symbol: '⚠️' },
  NEEDS_SUPPLEMENT: { label: '需补件', color: '\x1b[31m', symbol: '📋' },
  AMOUNT_ISSUE: { label: '金额异常', color: '\x1b[35m', symbol: '💰' },
  ERROR: { label: '错误', color: '\x1b[41m\x1b[37m', symbol: '❌' },
  CORRECTED: { label: '已修正', color: '\x1b[34m', symbol: '🔧' }
};

const SOURCE_MAP = {
  hospital: '医院',
  police: '交警',
  customer: '客户上传'
};

function formatStatus(status) {
  const info = STATUS_MAP[status] || STATUS_MAP.ERROR;
  return `${info.color}${info.symbol} ${info.label}\x1b[0m`;
}

function formatAmount(amount) {
  return `¥${Number(amount).toFixed(2)}`;
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleString('zh-CN', { 
    year: 'numeric', 
    month: '2-digit', 
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function printSection(title) {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`  ${title}`);
  console.log(`${'─'.repeat(60)}`);
}

async function init(workspace) {
  const result = storage.initWorkspace(workspace);
  if (result.success) {
    console.log('✅ 工作目录初始化成功!');
    console.log(`   路径: ${workspace}`);
    console.log('\n创建的目录结构:');
    console.log('   ├── cases/      # 案件数据');
    console.log('   ├── materials/  # 材料目录');
    console.log('   ├── invoices/   # 票据明细');
    console.log('   ├── rules/      # 审核规则');
    console.log('   ├── reports/    # 审核报告');
    console.log('   └── history/    # 操作历史');
    console.log('\n下一步:');
    console.log('   $ claim import --sample  # 导入样例数据');
    console.log('   $ claim check --all      # 检查所有案件');
  }
  return result;
}

async function importSample(workspace) {
  if (!storage.isInitialized(workspace)) {
    storage.initWorkspace(workspace);
  }

  const allSamples = samples.getAllSamples();
  let imported = 0;
  let skipped = 0;

  console.log('📦 正在导入样例数据...\n');

  for (const sample of allSamples) {
    const existing = storage.loadCase(workspace, sample.id);
    if (existing) {
      skipped++;
      console.log(`   ⏭️  跳过 (已存在): ${sample.id}`);
    } else {
      const saved = storage.saveCase(workspace, {
        ...sample,
        status: 'IMPORTED',
        importedAt: new Date().toISOString()
      });
      
      storage.saveHistoryEntry(workspace, sample.id, {
        action: 'IMPORT',
        actor: 'system',
        description: `导入样例案件: ${sample.claimant.name} - ${sample.diagnosis}`,
        before: null,
        after: {
          claimType: sample.claimType,
          materialCount: sample.materials.length,
          invoiceTotal: sample.invoiceTotal
        }
      });
      
      imported++;
      console.log(`   ✅ 导入成功: ${sample.id} (${sample.claimant.name})`);
    }
  }

  console.log(`\n📊 导入完成: 成功 ${imported} 个, 跳过 ${skipped} 个`);
  console.log('\n样例案件说明:');
  console.log('   🟢 门诊理赔 (张三) - 完整材料，可受理');
  console.log('   🔴 门诊理赔 (李四) - 缺少诊断书，需补件');
  console.log('   🟡 门诊理赔 (王五) - 金额不一致，金额异常');
  console.log('   🟢 住院理赔 (赵六) - 完整材料，可受理');
  console.log('   🔴 住院理赔 (孙七) - 重复票据，需处理');
  console.log('   🟢 交通事故 (周八) - 完整材料，可受理');
  console.log('   ⚠️ 交通事故 (吴九) - 材料类型不确定，有警告');
}

async function importCase(workspace, caseId, options) {
  console.log('⚠️  自定义导入请直接在 cases/ 目录下创建 JSON 文件');
  console.log('   或使用: claim import --sample 导入样例数据');
}

async function checkCase(workspace, caseId) {
  const caseData = storage.loadCase(workspace, caseId);
  if (!caseData) {
    console.log(`❌ 案件不存在: ${caseId}`);
    return;
  }

  const previousCheck = caseData.lastCheck;
  const result = rules.validateCase(caseData, workspace);
  
  const updatedCase = {
    ...caseData,
    status: result.status,
    lastCheck: {
      ...result,
      checkedAt: new Date().toISOString(),
      checkCount: (caseData.lastCheck?.checkCount || 0) + 1
    },
    previousStatus: caseData.status
  };
  
  const statusChanged = previousCheck?.status !== result.status;
  const isIdempotent = previousCheck && !statusChanged;
  
  storage.saveCase(workspace, updatedCase);
  
  storage.saveHistoryEntry(workspace, caseId, {
    action: 'CHECK',
    actor: 'system',
    description: `执行材料审核 - ${result.valid ? '通过' : '存在问题'}`,
    idempotent: isIdempotent,
    before: {
      status: caseData.status,
      valid: caseData.lastCheck?.valid
    },
    after: {
      status: result.status,
      valid: result.valid,
      errorCount: result.errors.length,
      warningCount: result.warnings.length
    }
  });

  printSection(`审核结果: ${caseId}`);
  console.log(`  案件: ${caseData.claimant.name} - ${caseData.diagnosis}`);
  console.log(`  类型: ${result.claimTypeName}`);
  console.log(`  状态: ${formatStatus(result.status)}`);
  
  if (isIdempotent) {
    console.log(`  ℹ️  幂等检测: 结果与上次一致`);
  }
  
  if (result.errors.length > 0) {
    console.log(`\n  ❌ 错误 (${result.errors.length} 项):`);
    result.errors.forEach((e, i) => {
      console.log(`     ${i + 1}. [${e.category}] ${e.message}`);
    });
  }
  
  if (result.warnings.length > 0) {
    console.log(`\n  ⚠️  警告 (${result.warnings.length} 项):`);
    result.warnings.forEach((w, i) => {
      console.log(`     ${i + 1}. [${w.category}] ${w.message}`);
    });
  }
  
  if (result.valid) {
    console.log(`\n  ✅ 所有检查通过，可以受理!`);
  }

  return result;
}

async function checkAll(workspace) {
  const cases = storage.listAllCases(workspace);
  if (cases.length === 0) {
    console.log('❌ 没有找到案件数据');
    console.log('请先执行: claim import --sample');
    return;
  }

  printSection(`批量审核 (共 ${cases.length} 个案件)`);
  
  const stats = {
    total: cases.length,
    acceptable: 0,
    needsSupplement: 0,
    amountIssue: 0,
    warning: 0,
    error: 0
  };

  for (const caseData of cases) {
    const result = await checkCase(workspace, caseData.id);
    
    switch (result.status) {
      case 'ACCEPTABLE':
        stats.acceptable++;
        break;
      case 'ACCEPTABLE_WITH_WARNING':
        stats.acceptable++;
        stats.warning++;
        break;
      case 'NEEDS_SUPPLEMENT':
        stats.needsSupplement++;
        break;
      case 'AMOUNT_ISSUE':
        stats.amountIssue++;
        break;
      default:
        stats.error++;
    }
  }

  printSection('批量审核统计');
  console.log(`  📊 总案件数: ${stats.total}`);
  console.log(`  ✅ 可受理: ${stats.acceptable}`);
  console.log(`  📋 需补件: ${stats.needsSupplement}`);
  console.log(`  💰 金额异常: ${stats.amountIssue}`);
  console.log(`  ⚠️  含警告: ${stats.warning}`);
  
  const report = {
    generatedAt: new Date().toISOString(),
    stats,
    cases: cases.map(c => ({
      id: c.id,
      name: c.claimant?.name,
      claimType: c.claimType,
      status: c.status,
      lastCheck: c.lastCheck
    }))
  };
  
  const reportPath = storage.saveReport(workspace, report);
  console.log(`\n  📄 报告已保存: ${reportPath}`);
}

async function showDetail(workspace, caseId) {
  const caseData = storage.loadCase(workspace, caseId);
  if (!caseData) {
    console.log(`❌ 案件不存在: ${caseId}`);
    return;
  }

  printSection(`案件详情: ${caseId}`);
  console.log(`  案件编号: ${caseData.id}`);
  console.log(`  理赔类型: ${caseData.claimType}`);
  console.log(`  当前状态: ${formatStatus(caseData.status)}`);
  console.log(`  创建时间: ${formatDate(caseData.createdAt)}`);
  
  console.log(`\n  ─── 申请人信息 ───`);
  if (caseData.claimant) {
    console.log(`  姓名: ${caseData.claimant.name}`);
    console.log(`  身份证: ${caseData.claimant.idCard}`);
    console.log(`  电话: ${caseData.claimant.phone}`);
  }
  
  console.log(`\n  ─── 保单信息 ───`);
  if (caseData.policy) {
    console.log(`  保单号: ${caseData.policy.policyNumber}`);
    console.log(`  保险公司: ${caseData.policy.insurer}`);
    console.log(`  保额: ${formatAmount(caseData.policy.insuredAmount)}`);
  }
  
  console.log(`\n  ─── 事故信息 ───`);
  console.log(`  事故日期: ${caseData.accidentDate}`);
  console.log(`  事故地点: ${caseData.accidentLocation}`);
  console.log(`  诊断: ${caseData.diagnosis}`);
  if (caseData.hospital) {
    console.log(`  就诊医院: ${caseData.hospital}`);
  }
  
  console.log(`\n  ─── 费用信息 ───`);
  console.log(`  发票总金额: ${formatAmount(caseData.invoiceTotal)}`);
  console.log(`  预计赔付: ${formatAmount(caseData.expectedReimbursement)}`);
  
  console.log(`\n  ─── 材料清单 (${caseData.materials.length} 份) ───`);
  caseData.materials.forEach((m, i) => {
    const typeInfo = m.type === 'UNCERTAIN' ? '❓ 不确定' : m.type;
    const sourceInfo = SOURCE_MAP[m.source] || m.source;
    console.log(`\n    [${i + 1}] ${m.name}`);
    console.log(`        类型: ${typeInfo}`);
    console.log(`        来源: ${sourceInfo}`);
    console.log(`        上传人: ${m.uploadedBy}`);
    console.log(`        上传日期: ${m.uploadDate}`);
    if (m.invoiceNumber) {
      console.log(`        发票号: ${m.invoiceNumber}`);
    }
    if (m.amount !== undefined) {
      console.log(`        金额: ${formatAmount(m.amount)}`);
    }
  });
  
  if (caseData.lastCheck) {
    console.log(`\n  ─── 最近审核 ───`);
    console.log(`  审核时间: ${formatDate(caseData.lastCheck.checkedAt)}`);
    console.log(`  审核次数: ${caseData.lastCheck.checkCount}`);
    console.log(`  审核状态: ${caseData.lastCheck.valid ? '✅ 通过' : '❌ 未通过'}`);
    
    if (caseData.lastCheck.issues && caseData.lastCheck.issues.length > 0) {
      console.log(`\n  问题清单:`);
      caseData.lastCheck.issues.forEach((issue, i) => {
        const level = issue.level === 'ERROR' ? '❌' : '⚠️';
        console.log(`    ${level} [${issue.category}] ${issue.message}`);
      });
    }
  }
}

async function generateReport(workspace) {
  const cases = storage.listAllCases(workspace);
  if (cases.length === 0) {
    console.log('❌ 没有找到案件数据');
    return;
  }

  const grouped = {
    acceptable: cases.filter(c => c.status === 'ACCEPTABLE' || c.status === 'ACCEPTABLE_WITH_WARNING'),
    needsSupplement: cases.filter(c => c.status === 'NEEDS_SUPPLEMENT'),
    amountIssue: cases.filter(c => c.status === 'AMOUNT_ISSUE'),
    pending: cases.filter(c => c.status === 'IMPORTED' || c.status === 'PENDING_CHECK')
  };

  printSection('保险理赔材料审核报告');
  console.log(`  生成时间: ${formatDate(new Date().toISOString())}`);
  console.log(`  案件总数: ${cases.length}`);

  if (grouped.acceptable.length > 0) {
    printSection('✅ 可受理案件');
    grouped.acceptable.forEach(c => {
      const name = c.claimant?.name || '未知';
      const type = c.claimType;
      const amount = formatAmount(c.invoiceTotal);
      console.log(`  ${c.id} | ${name} | ${type} | ${amount} | ${formatStatus(c.status)}`);
    });
  }

  if (grouped.needsSupplement.length > 0) {
    printSection('📋 需补件案件');
    grouped.needsSupplement.forEach(c => {
      const name = c.claimant?.name || '未知';
      const missing = c.lastCheck?.errors?.filter(e => e.category === 'MISSING_MATERIAL') || [];
      console.log(`  ${c.id} | ${name} | 缺少: ${missing.map(m => m.name).join(', ')}`);
    });
  }

  if (grouped.amountIssue.length > 0) {
    printSection('💰 金额异常案件');
    grouped.amountIssue.forEach(c => {
      const name = c.claimant?.name || '未知';
      const issues = c.lastCheck?.errors?.filter(e => e.category === 'AMOUNT_INCONSISTENCY') || [];
      console.log(`  ${c.id} | ${name}`);
      issues.forEach(issue => {
        console.log(`    ⚠️  ${issue.message}`);
      });
    });
  }

  if (grouped.pending.length > 0) {
    printSection('⏳ 待检查案件');
    grouped.pending.forEach(c => {
      const name = c.claimant?.name || '未知';
      console.log(`  ${c.id} | ${name} | 尚未审核`);
    });
  }

  printSection('补件历史摘要');
  let hasHistory = false;
  for (const c of cases) {
    const history = storage.loadHistory(workspace, c.id);
    const corrections = history.filter(h => h.action === 'CORRECT' || h.action === 'SUPPLEMENT');
    if (corrections.length > 0) {
      hasHistory = true;
      console.log(`  ${c.id} (${c.claimant?.name}): ${corrections.length} 次补件/修正`);
      corrections.forEach(corr => {
        console.log(`    - ${formatDate(corr.timestamp)} | ${corr.actor} | ${corr.description}`);
      });
    }
  }
  if (!hasHistory) {
    console.log('  暂无补件历史');
  }
}

async function generateFullReport(workspace) {
  await generateReport(workspace);
  
  const cases = storage.listAllCases(workspace);
  for (const c of cases) {
    console.log(`\n${'═'.repeat(60)}`);
    await showDetail(workspace, c.id);
  }
}

async function showHistory(workspace, caseId) {
  const caseData = storage.loadCase(workspace, caseId);
  if (!caseData) {
    console.log(`❌ 案件不存在: ${caseId}`);
    return;
  }

  const history = storage.loadHistory(workspace, caseId);
  
  printSection(`操作历史: ${caseId} (${caseData.claimant?.name})`);
  console.log(`  记录总数: ${history.length}`);
  
  if (history.length === 0) {
    console.log('  暂无历史记录');
    return;
  }

  history.forEach((entry, i) => {
    console.log(`\n  [${i + 1}] ${formatDate(entry.timestamp)}`);
    console.log(`      动作: ${entry.action}`);
    console.log(`      操作者: ${entry.actor}`);
    console.log(`      描述: ${entry.description}`);
    
    if (entry.idempotent) {
      console.log(`      ℹ️  幂等操作，结果未变`);
    }
    
    if (entry.before || entry.after) {
      console.log(`      ─── 变更详情 ───`);
      if (entry.before) {
        console.log(`      变更前:`);
        Object.entries(entry.before).forEach(([k, v]) => {
          console.log(`        ${k}: ${JSON.stringify(v)}`);
        });
      }
      if (entry.after) {
        console.log(`      变更后:`);
        Object.entries(entry.after).forEach(([k, v]) => {
          console.log(`        ${k}: ${JSON.stringify(v)}`);
        });
      }
    }
    
    if (entry.diffs && entry.diffs.length > 0) {
      console.log(`      ─── 差异明细 ───`);
      entry.diffs.forEach(diff => {
        console.log(`        ${diff.field}:`);
        console.log(`          旧值: ${JSON.stringify(diff.before)}`);
        console.log(`          新值: ${JSON.stringify(diff.after)}`);
      });
    }
  });
}

async function manualCorrect(workspace, caseId, options) {
  const caseData = storage.loadCase(workspace, caseId);
  if (!caseData) {
    console.log(`❌ 案件不存在: ${caseId}`);
    return;
  }

  const actor = options.operator || 'manual_user';
  const diffs = [];
  const before = { ...caseData };
  const after = { ...caseData };

  if (options.addMaterial) {
    const parts = options.addMaterial.split('|');
    if (parts.length >= 3) {
      const newMaterial = {
        id: `M_${Date.now()}`,
        name: parts[0],
        type: parts[1],
        source: parts[2] || 'customer',
        uploadDate: new Date().toISOString().split('T')[0],
        uploadedBy: actor
      };
      if (parts[3]) newMaterial.invoiceNumber = parts[3];
      if (parts[4]) newMaterial.amount = Number(parts[4]);
      
      after.materials = [...(after.materials || []), newMaterial];
      diffs.push({
        field: 'materials',
        operation: 'ADD',
        before: null,
        after: newMaterial
      });
    }
  }

  if (options.fixAmount && options.materialId) {
    const materialIndex = after.materials.findIndex(m => m.id === options.materialId);
    if (materialIndex !== -1) {
      const oldAmount = after.materials[materialIndex].amount;
      const newAmount = Number(options.fixAmount);
      
      after.materials[materialIndex].amount = newAmount;
      diffs.push({
        field: `materials[${materialIndex}].amount`,
        operation: 'UPDATE',
        before: oldAmount,
        after: newAmount
      });
    }
  }

  if (options.fixType && options.materialId) {
    const materialIndex = after.materials.findIndex(m => m.id === options.materialId);
    if (materialIndex !== -1) {
      const oldType = after.materials[materialIndex].type;
      
      after.materials[materialIndex].type = options.fixType;
      diffs.push({
        field: `materials[${materialIndex}].type`,
        operation: 'UPDATE',
        before: oldType,
        after: options.fixType
      });
    }
  }

  if (options.removeDuplicate && options.materialId) {
    const materialIndex = after.materials.findIndex(m => m.id === options.materialId);
    if (materialIndex !== -1) {
      const removed = after.materials[materialIndex];
      after.materials = after.materials.filter((_, i) => i !== materialIndex);
      diffs.push({
        field: 'materials',
        operation: 'REMOVE',
        before: removed,
        after: null
      });
    }
  }

  if (diffs.length === 0) {
    console.log('❌ 未指定任何修正操作');
    console.log('\n可用选项:');
    console.log('  --addMaterial "名称|类型|来源|发票号|金额"');
    console.log('  --materialId <id> --fixAmount <金额>');
    console.log('  --materialId <id> --fixType <类型>');
    console.log('  --removeDuplicate --materialId <id>');
    console.log('  --operator <操作者名称>');
    return;
  }

  after.status = 'CORRECTED';
  after.updatedAt = new Date().toISOString();

  storage.saveCase(workspace, after);
  storage.saveHistoryEntry(workspace, caseId, {
    action: 'CORRECT',
    actor,
    description: '人工修正案件材料',
    before,
    after: {
      status: after.status,
      materialCount: after.materials.length,
      corrections: diffs.length
    },
    diffs
  });

  printSection('人工修正完成');
  console.log(`  操作者: ${actor}`);
  console.log(`  修正项数: ${diffs.length}`);
  console.log(`\n  变更明细:`);
  diffs.forEach((diff, i) => {
    console.log(`    [${i + 1}] ${diff.operation}: ${diff.field}`);
    if (diff.before !== null) {
      console.log(`        旧: ${JSON.stringify(diff.before)}`);
    }
    if (diff.after !== null) {
      console.log(`        新: ${JSON.stringify(diff.after)}`);
    }
  });

  console.log(`\n  重新审核中...`);
  await checkCase(workspace, caseId);
}

async function listCases(workspace) {
  const cases = storage.listAllCases(workspace);
  if (cases.length === 0) {
    console.log('❌ 没有找到案件数据');
    return;
  }

  printSection(`案件列表 (共 ${cases.length} 个)`);
  console.log(`  ${'案件编号'.padEnd(12)} ${'申请人'.padEnd(6)} ${'类型'.padEnd(14)} ${'金额'.padEnd(12)} ${'状态'}`);
  console.log(`  ${'─'.repeat(60)}`);
  
  cases.forEach(c => {
    const name = (c.claimant?.name || '未知').padEnd(6);
    const type = (c.claimType || '').padEnd(14);
    const amount = formatAmount(c.invoiceTotal || 0).padEnd(12);
    console.log(`  ${c.id.padEnd(12)} ${name} ${type} ${amount} ${formatStatus(c.status)}`);
  });
}

module.exports = {
  init,
  importSample,
  importCase,
  checkCase,
  checkAll,
  showDetail,
  generateReport,
  generateFullReport,
  showHistory,
  manualCorrect,
  listCases
};
