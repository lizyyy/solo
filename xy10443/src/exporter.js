const fs = require('fs');
const path = require('path');
const { createObjectCsvWriter } = require('csv-writer');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function formatDate(date) {
  if (!date) return '';
  if (date instanceof Date) {
    return date.toISOString().split('T')[0];
  }
  return String(date);
}

async function exportMergedLeads(leads, outputDir) {
  const records = leads.map(lead => ({
    id: lead.id,
    nickname: lead.nickname,
    phone: lead.phone,
    wechat: lead.wechat,
    sales: lead.sales,
    primary_source: lead.primarySourceName,
    all_sources: (lead.sourceNames || []).join('; '),
    source_count: (lead.sources || []).length,
    last_follow_date: formatDate(lead.followDate),
    match_reason: lead.matchReason || '',
    original_files: (lead.originalRecords || []).map(r => r.fileSource).join('; ')
  }));

  if (records.length > 0) {
    const csvWriter = createObjectCsvWriter({
      path: path.join(outputDir, 'merged_leads.csv'),
      header: [
        { id: 'id', title: 'ID' },
        { id: 'nickname', title: '昵称' },
        { id: 'phone', title: '手机号' },
        { id: 'wechat', title: '微信号' },
        { id: 'sales', title: '归属销售' },
        { id: 'primary_source', title: '主要来源' },
        { id: 'all_sources', title: '所有来源' },
        { id: 'source_count', title: '来源数量' },
        { id: 'last_follow_date', title: '最近跟进日期' },
        { id: 'match_reason', title: '匹配原因' },
        { id: 'original_files', title: '原始文件' }
      ]
    });
    await csvWriter.writeRecords(records);
  }
}

async function exportConflictLeads(leads, outputDir) {
  const records = leads.map(lead => {
    const salesConflict = lead.conflicts?.find(c => c.type === 'sales_conflict');
    const duplicateSource = lead.conflicts?.find(c => c.type === 'duplicate_source');
    const missingPhone = lead.conflicts?.find(c => c.type === 'missing_phone');
    
    return {
      id: lead.id,
      nickname: lead.nickname,
      phone: lead.phone,
      wechat: lead.wechat,
      all_sales: salesConflict ? salesConflict.sales.join('; ') : lead.sales,
      all_sources: (lead.sourceNames || []).join('; '),
      has_sales_conflict: salesConflict ? '是' : '否',
      has_duplicate_source: duplicateSource ? '是' : '否',
      has_missing_phone: missingPhone ? '是' : '否',
      conflict_reasons: lead.conflicts?.map(c => c.reason).join('; ') || '',
      needs_review: lead.needsReview ? '是' : '否',
      review_reason: lead.reviewReason || '',
      original_records: (lead.originalRecords || []).map((r, idx) => 
        `${idx + 1}. [${r.sourceName}] ${r.sales || '未分配'} (${r.fileSource})`
      ).join('\n')
    };
  });

  if (records.length > 0) {
    const csvWriter = createObjectCsvWriter({
      path: path.join(outputDir, 'conflict_leads.csv'),
      header: [
        { id: 'id', title: 'ID' },
        { id: 'nickname', title: '昵称' },
        { id: 'phone', title: '手机号' },
        { id: 'wechat', title: '微信号' },
        { id: 'all_sales', title: '涉及销售' },
        { id: 'all_sources', title: '所有来源' },
        { id: 'has_sales_conflict', title: '销售冲突' },
        { id: 'has_duplicate_source', title: '重复导入' },
        { id: 'has_missing_phone', title: '手机号缺失' },
        { id: 'conflict_reasons', title: '冲突原因' },
        { id: 'needs_review', title: '需复核' },
        { id: 'review_reason', title: '复核原因' },
        { id: 'original_records', title: '原始来源记录' }
      ]
    });
    await csvWriter.writeRecords(records);
  }
}

async function exportBlacklistLeads(leads, outputDir) {
  const records = leads.map(lead => ({
    nickname: lead.nickname,
    phone: lead.phone,
    wechat: lead.wechat,
    source: lead.originalSourceName,
    blacklist_reason: lead.blacklistReason
  }));

  if (records.length > 0) {
    const csvWriter = createObjectCsvWriter({
      path: path.join(outputDir, 'blacklist_leads.csv'),
      header: [
        { id: 'nickname', title: '昵称' },
        { id: 'phone', title: '手机号' },
        { id: 'wechat', title: '微信号' },
        { id: 'source', title: '来源' },
        { id: 'blacklist_reason', title: '黑名单原因' }
      ]
    });
    await csvWriter.writeRecords(records);
  }
}

async function exportSalesDistribution(result, outputDir) {
  const records = Object.entries(result.salesBySalesperson).map(([sales, leads]) => {
    const conflictCount = leads.filter(l => 
      l.conflicts && l.conflicts.some(c => c.type === 'sales_conflict')
    ).length;
    const mergedCount = leads.filter(l => 
      !l.conflicts || !l.conflicts.some(c => c.type === 'sales_conflict')
    ).length;
    const sources = [...new Set(leads.flatMap(l => l.sourceNames || []))].join('; ');
    
    return {
      sales,
      total_leads: leads.length,
      merged_leads: mergedCount,
      conflict_leads: conflictCount,
      sources,
      lead_nicknames: leads.map(l => l.nickname || l.phone || l.wechat).join('; ')
    };
  });

  if (records.length > 0) {
    const csvWriter = createObjectCsvWriter({
      path: path.join(outputDir, 'sales_distribution.csv'),
      header: [
        { id: 'sales', title: '销售姓名' },
        { id: 'total_leads', title: '总线索数' },
        { id: 'merged_leads', title: '已分配线索' },
        { id: 'conflict_leads', title: '冲突线索' },
        { id: 'sources', title: '涉及来源' },
        { id: 'lead_nicknames', title: '线索列表' }
      ]
    });
    await csvWriter.writeRecords(records);
  }
}

async function exportSummaryReport(result, outputDir) {
  const summary = {
    处理时间: new Date().toLocaleString('zh-CN'),
    原始线索总数: result.originalCount,
    成功合并线索: result.mergedLeads.length,
    冲突线索数: result.conflictLeads.length,
    需人工复核: result.needsReview.length,
    黑名单线索: result.blacklistLeads.length,
    重复导入线索: result.duplicateImportLeads.length,
    手机号缺失: result.missingPhoneLeads.length,
    涉及销售数: Object.keys(result.salesBySalesperson).length
  };

  const csvWriter = createObjectCsvWriter({
    path: path.join(outputDir, 'summary_report.csv'),
    header: [
      { id: 'metric', title: '指标' },
      { id: 'value', title: '数值' }
    ]
  });

  const records = Object.entries(summary).map(([metric, value]) => ({
    metric,
    value
  }));

  await csvWriter.writeRecords(records);
}

async function exportResults(result, outputDir) {
  ensureDir(outputDir);

  await Promise.all([
    exportMergedLeads(result.mergedLeads, outputDir),
    exportConflictLeads(result.conflictLeads, outputDir),
    exportBlacklistLeads(result.blacklistLeads, outputDir),
    exportSalesDistribution(result, outputDir),
    exportSummaryReport(result, outputDir)
  ]);
}

module.exports = {
  exportResults
};
