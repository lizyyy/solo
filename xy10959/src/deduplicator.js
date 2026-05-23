const Fuse = require('fuse.js');

function normalizeCompanyName(name) {
  if (!name) return '';
  
  return name
    .toLowerCase()
    .replace(/(?:有限公司|有限责任公司|股份有限公司|集团|公司|科技|贸易|实业)$/g, '')
    .replace(/[（\(].*?[）\)]/g, '')
    .replace(/[^\w\u4e00-\u9fa5]/g, '')
    .trim();
}

function deduplicateLeads(leads, options = {}) {
  const {
    priorityMap = {},
    threshold = 0.85,
    keepAll = false
  } = options;

  const total = leads.length;
  const duplicateGroups = [];
  const cleaned = [];
  const processedIndices = new Set();
  const mergeSuggestions = [];

  const exactPhoneGroups = groupByExactMatch(leads, '_phoneNormalized');
  const exactEmailGroups = groupByExactMatch(leads, '_emailNormalized');

  const mergedGroups = mergeGroups(exactPhoneGroups, exactEmailGroups, leads);

  for (const group of mergedGroups) {
    if (group.length > 1) {
      processDuplicateGroup(group, duplicateGroups, cleaned, priorityMap, keepAll, processedIndices, mergeSuggestions);
    } else if (!processedIndices.has(group[0]._rowIndex)) {
      cleaned.push(group[0]);
      processedIndices.add(group[0]._rowIndex);
    }
  }

  const remaining = leads.filter(l => !processedIndices.has(l._rowIndex));
  const fuzzyGroups = findFuzzyDuplicates(remaining, threshold);

  for (const group of fuzzyGroups) {
    if (group.length > 1) {
      processDuplicateGroup(group, duplicateGroups, cleaned, priorityMap, keepAll, processedIndices, mergeSuggestions);
    } else if (!processedIndices.has(group[0]._rowIndex)) {
      cleaned.push(group[0]);
      processedIndices.add(group[0]._rowIndex);
    }
  }

  const duplicateCount = duplicateGroups.reduce((sum, g) => sum + g.members.length, 0);

  return {
    total,
    cleaned,
    duplicateGroups,
    duplicateCount,
    mergeSuggestions
  };
}

function groupByExactMatch(leads, field) {
  const groups = new Map();
  
  for (const lead of leads) {
    const value = lead[field];
    if (value && value.length > 0) {
      if (!groups.has(value)) {
        groups.set(value, []);
      }
      groups.get(value).push(lead);
    }
  }

  return Array.from(groups.values()).filter(g => g.length > 0);
}

function mergeGroups(phoneGroups, emailGroups, leads) {
  const leadToGroups = new Map();
  
  for (let i = 0; i < leads.length; i++) {
    leadToGroups.set(leads[i]._rowIndex, new Set());
  }

  for (let i = 0; i < phoneGroups.length; i++) {
    for (const lead of phoneGroups[i]) {
      leadToGroups.get(lead._rowIndex).add(`phone_${i}`);
    }
  }

  for (let i = 0; i < emailGroups.length; i++) {
    for (const lead of emailGroups[i]) {
      leadToGroups.get(lead._rowIndex).add(`email_${i}`);
    }
  }

  const groupClusters = [];
  const processedGroups = new Set();

  for (const lead of leads) {
    const groups = leadToGroups.get(lead._rowIndex);
    if (groups.size > 0) {
      const cluster = new Set();
      const stack = [...groups];
      
      while (stack.length > 0) {
        const groupId = stack.pop();
        if (!processedGroups.has(groupId)) {
          processedGroups.add(groupId);
          cluster.add(groupId);
          
          for (const l of leads) {
            if (leadToGroups.get(l._rowIndex).has(groupId)) {
              for (const g of leadToGroups.get(l._rowIndex)) {
                if (!processedGroups.has(g)) {
                  stack.push(g);
                }
              }
            }
          }
        }
      }
      
      if (cluster.size > 0) {
        groupClusters.push(cluster);
      }
    }
  }

  const allGroups = [...phoneGroups, ...emailGroups];
  const mergedResults = [];
  const processedLeads = new Set();

  for (const cluster of groupClusters) {
    const clusterLeads = new Set();
    for (const groupId of cluster) {
      const groupIndex = parseInt(groupId.split('_')[1]);
      const group = groupId.startsWith('phone_') 
        ? phoneGroups[groupIndex] 
        : emailGroups[groupIndex];
      for (const lead of group) {
        clusterLeads.add(lead);
      }
    }
    mergedResults.push([...clusterLeads]);
    for (const lead of clusterLeads) {
      processedLeads.add(lead._rowIndex);
    }
  }

  for (const lead of leads) {
    if (!processedLeads.has(lead._rowIndex)) {
      mergedResults.push([lead]);
    }
  }

  return mergedResults;
}

function processDuplicateGroup(group, duplicateGroups, cleaned, priorityMap, keepAll, processedIndices, mergeSuggestions) {
  const sortedGroup = [...group].sort((a, b) => {
    const priorityA = priorityMap[a['来源渠道']] || 99;
    const priorityB = priorityMap[b['来源渠道']] || 99;
    return priorityA - priorityB;
  });

  const groupId = `GROUP_${duplicateGroups.length + 1}`;
  const selected = { ...sortedGroup[0] };
  const duplicates = sortedGroup.slice(1);

  const mergeResults = smartMergeFields(selected, sortedGroup, priorityMap);

  const conflicts = findConflicts(selected, duplicates);
  const suggestions = generateMergeSuggestions(selected, duplicates, groupId, mergeResults);
  mergeSuggestions.push(...suggestions);

  duplicateGroups.push({
    groupId,
    selected: createLeadSummary(selected),
    members: sortedGroup.map((lead, idx) => ({
      ...createLeadSummary(lead),
      isSelected: idx === 0
    })),
    conflicts,
    mergedFields: mergeResults,
    suggestionCount: suggestions.length
  });

  if (keepAll) {
    for (const lead of sortedGroup) {
      lead._duplicateGroup = groupId;
      lead._isSelected = lead._rowIndex === selected._rowIndex;
      cleaned.push(lead);
      processedIndices.add(lead._rowIndex);
    }
  } else {
    selected._duplicateGroup = groupId;
    selected._mergedFrom = sortedGroup.map(l => l._rowIndex);
    selected._mergedFields = mergeResults;
    cleaned.push(selected);
    for (const lead of sortedGroup) {
      processedIndices.add(lead._rowIndex);
    }
  }
}

function smartMergeFields(selected, allMembers, priorityMap) {
  const mergeResults = [];
  const keyFields = ['手机号', '邮箱', '公司名', '联系人', '备注'];

  for (const field of keyFields) {
    const currentValue = selected[field];
    
    if (!currentValue || !currentValue.trim()) {
      for (const member of allMembers) {
        const memberValue = member[field];
        if (memberValue && memberValue.trim()) {
          selected[field] = memberValue;
          
          if (field === '手机号') {
            selected._phoneNormalized = memberValue.replace(/\D/g, '');
          } else if (field === '邮箱') {
            selected._emailNormalized = memberValue.toLowerCase().trim();
          } else if (field === '公司名') {
            selected._companyNormalized = normalizeCompanyName(memberValue);
          }
          
          mergeResults.push({
            field,
            originalValue: currentValue || '(空)',
            mergedValue: memberValue,
            sourceRow: member._rowIndex,
            sourceChannel: member['来源渠道'] || '未知',
            action: 'auto-filled'
          });
          break;
        }
      }
    } else {
      const alternatives = allMembers
        .filter(m => m._rowIndex !== selected._rowIndex)
        .filter(m => m[field] && m[field].trim() && m[field] !== currentValue);
      
      if (alternatives.length > 0) {
        mergeResults.push({
          field,
          originalValue: currentValue,
          alternatives: alternatives.map(m => ({
            value: m[field],
            sourceRow: m._rowIndex,
            sourceChannel: m['来源渠道'] || '未知'
          })),
          action: 'conflict'
        });
      }
    }
  }

  return mergeResults;
}

function findFuzzyDuplicates(leads, threshold) {
  if (leads.length < 2) return leads.map(l => [l]);

  const groups = [];
  const processed = new Set();

  const companyIndexed = leads.filter(l => l._companyNormalized && l._companyNormalized.length > 2);
  
  const fuse = new Fuse(companyIndexed, {
    keys: ['_companyNormalized'],
    threshold: 1 - threshold,
    includeScore: true
  });

  for (let i = 0; i < leads.length; i++) {
    const lead = leads[i];
    if (processed.has(lead._rowIndex)) continue;

    const group = [lead];
    processed.add(lead._rowIndex);

    if (lead._companyNormalized && lead._companyNormalized.length > 2) {
      const results = fuse.search(lead._companyNormalized);
      
      for (const result of results) {
        const match = result.item;
        if (!processed.has(match._rowIndex)) {
          const hasEmailOverlap = 
            (lead._emailNormalized && match._emailNormalized && lead._emailNormalized === match._emailNormalized) ||
            (!lead._emailNormalized && !match._emailNormalized) ||
            (!lead._emailNormalized || !match._emailNormalized);
          
          if (hasEmailOverlap) {
            group.push(match);
            processed.add(match._rowIndex);
          }
        }
      }
    }

    groups.push(group);
  }

  return groups;
}

function findConflicts(selected, duplicates) {
  const conflicts = [];
  const fieldsToCheck = ['手机号', '邮箱', '公司名', '来源渠道'];

  for (const duplicate of duplicates) {
    const fieldConflicts = [];
    for (const field of fieldsToCheck) {
      if (selected[field] && duplicate[field] && selected[field] !== duplicate[field]) {
        fieldConflicts.push({
          field,
          selectedValue: selected[field],
          duplicateValue: duplicate[field],
          duplicateRow: duplicate._rowIndex
        });
      }
    }
    if (fieldConflicts.length > 0) {
      conflicts.push({
        duplicateRow: duplicate._rowIndex,
        fields: fieldConflicts
      });
    }
  }

  return conflicts;
}

function generateMergeSuggestions(selected, duplicates, groupId, mergeResults = []) {
  const suggestions = [];
  
  for (const merge of mergeResults) {
    if (merge.action === 'auto-filled') {
      suggestions.push({
        groupId,
        field: merge.field,
        type: 'auto-merged',
        originalValue: merge.originalValue,
        mergedValue: merge.mergedValue,
        sourceRow: merge.sourceRow,
        sourceChannel: merge.sourceChannel,
        suggestion: `✅ 自动补全"${merge.field}": 原值"${merge.originalValue}" → 新值"${merge.mergedValue}"（来自行 ${merge.sourceRow}，${merge.sourceChannel}）`
      });
    } else if (merge.action === 'conflict') {
      suggestions.push({
        groupId,
        field: merge.field,
        type: 'conflict',
        selectedValue: merge.originalValue,
        selectedRow: selected._rowIndex,
        selectedChannel: selected['来源渠道'] || '未知',
        alternatives: merge.alternatives,
        suggestion: `⚠ 字段冲突"${merge.field}": 当前值"${merge.originalValue}"（行 ${selected._rowIndex}），另有 ${merge.alternatives.length} 个备选值需人工确认`
      });
    }
  }

  return suggestions;
}

function createLeadSummary(lead) {
  return {
    rowIndex: lead._rowIndex,
    phone: lead['手机号'] || '',
    email: lead['邮箱'] || '',
    companyName: lead['公司名'] || '',
    channel: lead['来源渠道'] || '',
    rawData: lead
  };
}

module.exports = {
  deduplicateLeads,
  groupByExactMatch,
  mergeGroups,
  findFuzzyDuplicates
};
