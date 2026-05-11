const { isMatch } = require('./matcher');
const { exportResults } = require('./exporter');
const { displayResults } = require('./display');
const readline = require('readline');

const SOURCE_NAMES = {
  form: '表单',
  live: '直播',
  customer_service: '客服',
  community: '社群',
  other: '其他'
};

function mergeLeads(lead, existingLead) {
  const mergedSources = [...new Set([...(existingLead.sources || [existingLead.originalSource]), lead.originalSource])];
  const mergedSourceNames = [...new Set([...(existingLead.sourceNames || [existingLead.originalSourceName]), lead.originalSourceName])];
  
  const latestFollowDate = existingLead.followDate && lead.followDate
    ? (existingLead.followDate > lead.followDate ? existingLead.followDate : lead.followDate)
    : (existingLead.followDate || lead.followDate);

  const primarySource = mergedSources.reduce((best, source) => {
    const bestPriority = getSourcePriority(best);
    const currentPriority = getSourcePriority(source);
    return currentPriority < bestPriority ? source : best;
  }, existingLead.primarySource || existingLead.originalSource);

  return {
    ...existingLead,
    sources: mergedSources,
    sourceNames: mergedSourceNames,
    primarySource,
    primarySourceName: SOURCE_NAMES[primarySource],
    followDate: latestFollowDate,
    phone: lead.phone || existingLead.phone,
    wechat: lead.wechat || existingLead.wechat,
    nickname: lead.nickname || existingLead.nickname,
    originalRecords: [
      ...(existingLead.originalRecords || [{
        source: existingLead.originalSource,
        sourceName: existingLead.originalSourceName,
        sales: existingLead.sales,
        fileSource: existingLead.fileSource,
        originalData: existingLead.originalData
      }]),
      {
        source: lead.originalSource,
        sourceName: lead.originalSourceName,
        sales: lead.sales,
        fileSource: lead.fileSource,
        originalData: lead.originalData
      }
    ]
  };
}

function getSourcePriority(source) {
  const priorities = {
    form: 1,
    live: 2,
    customer_service: 3,
    community: 4,
    other: 99
  };
  return priorities[source] || 99;
}

function checkBlacklist(lead, blacklist) {
  if (!blacklist) return false;
  
  if (lead.phone && blacklist.phones && blacklist.phones.has(lead.phone)) {
    return { inBlacklist: true, reason: '手机号在黑名单中' };
  }
  if (lead.wechat && blacklist.wechats && blacklist.wechats.has(lead.wechat)) {
    return { inBlacklist: true, reason: '微信号在黑名单中' };
  }
  if (lead.nickname && blacklist.nicknames && blacklist.nicknames.has(lead.nickname)) {
    return { inBlacklist: true, reason: '昵称在黑名单中' };
  }
  
  return { inBlacklist: false, reason: '' };
}

function detectConflicts(mergedLead) {
  const conflicts = [];
  const originalRecords = mergedLead.originalRecords || [];
  
  const uniqueSales = [...new Set(originalRecords.map(r => r.sales).filter(s => s))];
  if (uniqueSales.length > 1) {
    conflicts.push({
      type: 'sales_conflict',
      reason: `多个销售跟进同一线索: ${uniqueSales.join(', ')}`,
      sales: uniqueSales,
      records: originalRecords
    });
  }
  
  const originalSources = originalRecords.map(r => r.source);
  const sourceCount = {};
  originalSources.forEach(source => {
    sourceCount[source] = (sourceCount[source] || 0) + 1;
  });
  
  Object.entries(sourceCount).forEach(([source, count]) => {
    if (count > 1) {
      conflicts.push({
        type: 'duplicate_source',
        reason: `同一来源重复导入: ${SOURCE_NAMES[source]} (${count}次)`,
        source,
        count
      });
    }
  });
  
  if (!mergedLead.phone) {
    conflicts.push({
      type: 'missing_phone',
      reason: '手机号缺失'
    });
  }
  
  return conflicts;
}

function askQuestion(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function resolveConflictsInteractive(conflictLead) {
  const salesList = conflictLead.conflicts
    .filter(c => c.type === 'sales_conflict')
    .flatMap(c => c.sales);
  
  if (salesList.length > 0) {
    console.log('\n⚠️  销售冲突:');
    console.log(`  线索: ${conflictLead.nickname || conflictLead.phone || conflictLead.wechat}`);
    console.log(`  涉及销售: ${salesList.join(', ')}`);
    console.log('  原始来源记录:');
    conflictLead.originalRecords.forEach((record, idx) => {
      console.log(`    ${idx + 1}. [${record.sourceName}] ${record.sales || '未分配'} - ${record.fileSource}`);
    });
    
    const answer = await askQuestion('\n请选择归属销售 (输入序号或销售名，输入 "skip" 标记待复核): ');
    
    if (answer.toLowerCase() === 'skip') {
      conflictLead.needsReview = true;
      conflictLead.reviewReason = '销售归属待人工确认';
    } else {
      const idx = parseInt(answer);
      if (idx > 0 && idx <= conflictLead.originalRecords.length) {
        conflictLead.sales = conflictLead.originalRecords[idx - 1].sales;
        conflictLead.resolved = true;
      } else if (salesList.includes(answer)) {
        conflictLead.sales = answer;
        conflictLead.resolved = true;
      } else {
        conflictLead.sales = answer;
        conflictLead.resolved = true;
      }
    }
  }
  
  return conflictLead;
}

async function deduplicateLeads(leads, options = {}) {
  const { similarityThreshold = 0.8, blacklist, interactive = false } = options;
  
  const result = {
    originalCount: leads.length,
    mergedLeads: [],
    conflictLeads: [],
    blacklistLeads: [],
    duplicateImportLeads: [],
    missingPhoneLeads: [],
    salesBySalesperson: {},
    needsReview: []
  };

  const mergedMap = new Map();

  for (const lead of leads) {
    const blacklistCheck = checkBlacklist(lead, blacklist);
    if (blacklistCheck.inBlacklist) {
      result.blacklistLeads.push({
        ...lead,
        blacklistReason: blacklistCheck.reason
      });
      continue;
    }

    let foundMatch = false;
    let matchedKey = null;

    for (const [key, existingLead] of mergedMap) {
      const matchResult = isMatch(lead, existingLead, { similarityThreshold });
      if (matchResult.matched) {
        const mergedLead = mergeLeads(lead, existingLead);
        mergedLead.matchReason = matchResult.reason;
        mergedMap.set(key, mergedLead);
        foundMatch = true;
        matchedKey = key;
        break;
      }
    }

    if (!foundMatch) {
      const key = `${lead.phone || lead.wechat || lead.nickname}-${Date.now()}-${Math.random()}`;
      mergedMap.set(key, {
        ...lead,
        sources: [lead.originalSource],
        sourceNames: [lead.originalSourceName],
        primarySource: lead.originalSource,
        primarySourceName: lead.originalSourceName,
        originalRecords: [{
          source: lead.originalSource,
          sourceName: lead.originalSourceName,
          sales: lead.sales,
          fileSource: lead.fileSource,
          originalData: lead.originalData
        }]
      });
    }
  }

  for (const lead of mergedMap.values()) {
    const conflicts = detectConflicts(lead);
    
    if (conflicts.length > 0) {
      lead.conflicts = conflicts;
      
      if (conflicts.some(c => c.type === 'missing_phone')) {
        result.missingPhoneLeads.push(lead);
      }
      
      if (conflicts.some(c => c.type === 'duplicate_source')) {
        result.duplicateImportLeads.push(lead);
      }
      
      if (conflicts.some(c => c.type === 'sales_conflict')) {
        if (interactive) {
          await resolveConflictsInteractive(lead);
        }
        
        if (!lead.resolved) {
          lead.needsReview = true;
          lead.reviewReason = '销售归属冲突，需人工确认';
          result.needsReview.push(lead);
        }
        
        result.conflictLeads.push(lead);
      } else {
        result.mergedLeads.push(lead);
      }
    } else {
      result.mergedLeads.push(lead);
    }

    if (lead.sales) {
      if (!result.salesBySalesperson[lead.sales]) {
        result.salesBySalesperson[lead.sales] = [];
      }
      result.salesBySalesperson[lead.sales].push(lead);
    }
  }

  return result;
}

async function exportReport(result, outputDir) {
  displayResults(result);
  await exportResults(result, outputDir);
}

module.exports = {
  deduplicateLeads,
  exportReport,
  mergeLeads,
  detectConflicts,
  checkBlacklist
};
