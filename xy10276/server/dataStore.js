const { v4: uuidv4 } = require('uuid');

let inspections = [];
let mergedGroups = [];
let history = [];
let statusHistory = [];
let currentStep = 'import';

const RISK_CONFIG = {
  LOOSENESS: { base: 30, levels: { '轻微': 1, '中度': 2, '严重': 3 } },
  SETTLEMENT: { base: 40, levels: { '轻微': 1, '中度': 2, '严重': 3 } },
  DUPLICATE_REPORT: { base: 50, perReport: 20 },
  TIME_FACTOR: { critical: 10, high: 5, normal: 1 }
};

const WORKFLOW_STEPS = {
  import: { name: '巡检导入', description: '从各队伍导入巡检记录', next: 'risk_scoring' },
  risk_scoring: { name: '风险评分', description: '对巡检记录进行风险评估', next: 'merge' },
  merge: { name: '重复点合并', description: '合并同一井盖的多次报修', next: 'processing' },
  processing: { name: '处理中', description: '等待现场处理', next: 'completed' },
  completed: { name: '已完成', description: '所有任务已处理', next: null }
};

function addHistory(type, entityId, action, before, after, operator, reason) {
  const record = {
    id: uuidv4(),
    type,
    entityId,
    action,
    before,
    after,
    operator: operator || 'system',
    reason: reason || null,
    timestamp: Date.now()
  };
  history.push(record);
  return record;
}

function addStatusHistory(step, message) {
  statusHistory.push({
    step,
    message,
    timestamp: Date.now()
  });
}

function calculateRisk(inspection) {
  let score = 0;
  let factors = [];

  if (inspection.looseness && RISK_CONFIG.LOOSENESS.levels[inspection.looseness]) {
    const level = RISK_CONFIG.LOOSENESS.levels[inspection.looseness];
    score += RISK_CONFIG.LOOSENESS.base * level;
    factors.push({ type: 'looseness', level: inspection.looseness, weight: RISK_CONFIG.LOOSENESS.base * level });
  }

  if (inspection.settlement && RISK_CONFIG.SETTLEMENT.levels[inspection.settlement]) {
    const level = RISK_CONFIG.SETTLEMENT.levels[inspection.settlement];
    score += RISK_CONFIG.SETTLEMENT.base * level;
    factors.push({ type: 'settlement', level: inspection.settlement, weight: RISK_CONFIG.SETTLEMENT.base * level });
  }

  if (inspection.reportCount && inspection.reportCount > 1) {
    score += RISK_CONFIG.DUPLICATE_REPORT.base + (inspection.reportCount - 1) * RISK_CONFIG.DUPLICATE_REPORT.perReport;
    factors.push({ type: 'duplicate', count: inspection.reportCount, weight: RISK_CONFIG.DUPLICATE_REPORT.base + (inspection.reportCount - 1) * RISK_CONFIG.DUPLICATE_REPORT.perReport });
  }

  const now = Date.now();
  const inspectionTime = inspection.inspectionTime || now;
  const hoursDiff = (now - inspectionTime) / (1000 * 60 * 60);
  let timeFactor = 1;
  if (hoursDiff > 72) {
    timeFactor = RISK_CONFIG.TIME_FACTOR.critical;
    factors.push({ type: 'time', description: '超过72小时未处理', weight: 10 });
  } else if (hoursDiff > 24) {
    timeFactor = RISK_CONFIG.TIME_FACTOR.high;
    factors.push({ type: 'time', description: '超过24小时未处理', weight: 5 });
  }

  score = Math.min(100, Math.round(score * timeFactor));

  let level = 'low';
  if (score >= 70) level = 'critical';
  else if (score >= 40) level = 'high';
  else if (score >= 20) level = 'medium';

  return { score, level, factors };
}

function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c * 1000;
}

function findDuplicateGroups(threshold = 5) {
  const groups = [];
  const used = new Set();

  inspections.forEach((ins, i) => {
    if (used.has(ins.id)) return;

    const group = [ins];
    used.add(ins.id);

    inspections.forEach((other, j) => {
      if (i === j || used.has(other.id)) return;

      const distance = calculateDistance(
        ins.location.lat, ins.location.lng,
        other.location.lat, other.location.lng
      );

      const hasSameTag = ins.manholeTag && other.manholeTag && ins.manholeTag === other.manholeTag;

      if (distance <= threshold || hasSameTag) {
        group.push(other);
        used.add(other.id);
      }
    });

    if (group.length > 1) {
      groups.push({
        id: uuidv4(),
        status: 'pending',
        inspections: group.map(g => g.id),
        suggestedPrimary: group.reduce((prev, curr) => {
          const prevRisk = calculateRisk(prev);
          const currRisk = calculateRisk(curr);
          return currRisk.score > prevRisk.score ? curr : prev;
        }).id,
        createdAt: Date.now()
      });
    }
  });

  return groups;
}

module.exports = {
  getCurrentStep: () => currentStep,
  setCurrentStep: (step) => {
    const oldStep = currentStep;
    currentStep = step;
    addStatusHistory(step, `从 ${WORKFLOW_STEPS[oldStep]?.name || '未知'} 进入 ${WORKFLOW_STEPS[step]?.name || '未知'}`);
  },
  getWorkflowSteps: () => WORKFLOW_STEPS,

  getAllInspections: () => inspections,
  getInspectionById: (id) => inspections.find(i => i.id === id),

  addInspection: (data, operator = 'system') => {
    const inspection = {
      id: uuidv4(),
      team: data.team,
      location: data.location,
      manholeTag: data.manholeTag || null,
      looseness: data.looseness || null,
      settlement: data.settlement || null,
      description: data.description || '',
      inspectionTime: data.inspectionTime || Date.now(),
      reporter: data.reporter || null,
      status: 'pending',
      riskScore: null,
      riskLevel: null,
      riskFactors: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    inspections.push(inspection);
    addHistory('inspection', inspection.id, 'create', null, inspection, operator, '新增巡检记录');
    addStatusHistory('import', `队伍 ${data.team} 新增1条巡检记录`);
    return inspection;
  },

  batchImport: (records, operator = 'system') => {
    const results = { success: 0, failed: 0, errors: [] };
    records.forEach((record, index) => {
      try {
        if (!record.team || !record.location) {
          throw new Error(`第${index + 1}条记录缺少必要字段`);
        }
        module.exports.addInspection(record, operator);
        results.success++;
      } catch (err) {
        results.failed++;
        results.errors.push(err.message);
      }
    });
    addStatusHistory('import', `批量导入完成: 成功${results.success}条, 失败${results.failed}条`);
    return results;
  },

  updateInspection: (id, updates, operator = 'system', reason = '修改记录') => {
    const index = inspections.findIndex(i => i.id === id);
    if (index === -1) return null;

    const before = JSON.parse(JSON.stringify(inspections[index]));
    inspections[index] = {
      ...inspections[index],
      ...updates,
      updatedAt: Date.now()
    };

    const after = inspections[index];
    addHistory('inspection', id, 'update', before, after, operator, reason);
    addStatusHistory('import', `巡检记录 ${id} 已更新`);
    return after;
  },

  withdrawInspection: (id, operator = 'system', reason) => {
    const index = inspections.findIndex(i => i.id === id);
    if (index === -1) return null;

    const before = JSON.parse(JSON.stringify(inspections[index]));
    inspections.splice(index, 1);

    mergedGroups = mergedGroups.map(group => ({
      ...group,
      inspections: group.inspections.filter(iid => iid !== id)
    })).filter(group => group.inspections.length > 1);

    addHistory('inspection', id, 'withdraw', before, null, operator, reason || '撤回记录');
    addStatusHistory('import', `巡检记录 ${id} 已撤回`);
    return before;
  },

  calculateAllRisks: (operator = 'system') => {
    inspections.forEach(ins => {
      const before = JSON.parse(JSON.stringify(ins));
      const risk = calculateRisk(ins);
      ins.riskScore = risk.score;
      ins.riskLevel = risk.level;
      ins.riskFactors = risk.factors;
      ins.updatedAt = Date.now();
      addHistory('risk', ins.id, 'score', before, JSON.parse(JSON.stringify(ins)), operator, '自动风险评分');
    });

    currentStep = 'risk_scoring';
    addStatusHistory('risk_scoring', `已完成 ${inspections.length} 条记录的风险评分`);
    return inspections.map(i => ({
      id: i.id,
      score: i.riskScore,
      level: i.riskLevel,
      factors: i.riskFactors
    }));
  },

  getHighRiskCount: () => {
    return inspections.filter(i => i.riskLevel === 'high' || i.riskLevel === 'critical').length;
  },

  detectDuplicates: (threshold = 5, operator = 'system') => {
    const groups = findDuplicateGroups(threshold);
    mergedGroups = groups;

    groups.forEach(group => {
      addHistory('merge_group', group.id, 'detect', null, group, operator, `检测到 ${group.inspections.length} 条重复记录`);
    });

    currentStep = 'merge';
    addStatusHistory('merge', `检测到 ${groups.length} 组重复记录待合并`);
    return groups;
  },

  getPendingMerges: () => mergedGroups.filter(g => g.status === 'pending'),
  getAllMerges: () => mergedGroups,

  confirmMerge: (groupId, primaryId, operator = 'system') => {
    const group = mergedGroups.find(g => g.id === groupId);
    if (!group) return null;

    const primary = inspections.find(i => i.id === primaryId);
    if (!primary) return null;

    const mergedIds = group.inspections.filter(id => id !== primaryId);
    const mergedRecords = mergedIds.map(id => inspections.find(i => i.id === id)).filter(Boolean);

    let reportCount = 1;
    const descriptions = [primary.description];
    const teams = [primary.team];

    mergedRecords.forEach(r => {
      reportCount++;
      if (r.description && r.description !== primary.description) {
        descriptions.push(r.description);
      }
      if (!teams.includes(r.team)) {
        teams.push(r.team);
      }
      if (r.looseness && !primary.looseness) primary.looseness = r.looseness;
      if (r.settlement && !primary.settlement) primary.settlement = r.settlement;
    });

    const before = JSON.parse(JSON.stringify(primary));
    primary.reportCount = reportCount;
    primary.mergedFrom = mergedIds;
    primary.mergedTeams = teams;
    primary.description = descriptions.filter(Boolean).join(' | ');
    primary.updatedAt = Date.now();

    const risk = calculateRisk(primary);
    primary.riskScore = risk.score;
    primary.riskLevel = risk.level;
    primary.riskFactors = risk.factors;

    mergedIds.forEach(id => {
      const idx = inspections.findIndex(i => i.id === id);
      if (idx !== -1) {
        const merged = inspections[idx];
        merged.mergedInto = primaryId;
        merged.status = 'merged';
        addHistory('inspection', id, 'merge', JSON.parse(JSON.stringify(merged)), null, operator, `合并到主记录 ${primaryId}`);
      }
    });

    group.status = 'merged';
    group.primaryId = primaryId;
    group.mergedAt = Date.now();

    addHistory('merge_group', groupId, 'confirm', null, group, operator, '确认合并');
    addHistory('inspection', primaryId, 'update', before, primary, operator, '合并重复记录，更新风险评分');
    addStatusHistory('merge', `合并组 ${groupId} 已处理，主记录 ${primaryId}`);

    return { primary, mergedCount: mergedIds.length };
  },

  getHistory: (entityType, entityId) => {
    return history
      .filter(h => (!entityType || h.type === entityType) && (!entityId || h.entityId === entityId))
      .sort((a, b) => b.timestamp - a.timestamp);
  },

  getStatusHistory: () => statusHistory,

  initDemoData: () => {
    const teams = ['巡查一队', '巡查二队', '应急组'];
    const baseData = [
      { team: '巡查一队', location: { lat: 39.9042, lng: 116.4074 }, looseness: '严重', settlement: null, description: '井盖松动严重，有异响' },
      { team: '巡查一队', location: { lat: 39.9043, lng: 116.4075 }, looseness: '中度', settlement: '轻微', description: '略有沉降' },
      { team: '巡查二队', location: { lat: 39.9042, lng: 116.4074 }, looseness: null, settlement: '中度', description: '市民反映井盖沉降' },
      { team: '巡查二队', location: { lat: 39.905, lng: 116.408 }, looseness: '轻微', settlement: null, description: '例行检查发现松动' },
      { team: '应急组', location: { lat: 39.9042, lng: 116.4074 }, looseness: '严重', settlement: null, description: '接到12345报修，井盖异响' },
      { team: '应急组', location: { lat: 39.906, lng: 116.409 }, looseness: null, settlement: '严重', description: '沉降明显，有安全隐患' }
    ];

    baseData.forEach((data, i) => {
      const inspection = {
        id: uuidv4(),
        team: data.team,
        location: data.location,
        manholeTag: i % 3 === 0 ? `MH-${1000 + Math.floor(i / 3)}` : null,
        looseness: data.looseness,
        settlement: data.settlement,
        description: data.description,
        inspectionTime: Date.now() - (i * 3600000),
        reporter: `队员${i + 1}`,
        status: 'pending',
        riskScore: null,
        riskLevel: null,
        riskFactors: [],
        createdAt: Date.now() - (i * 3600000),
        updatedAt: Date.now() - (i * 3600000)
      };
      inspections.push(inspection);
    });

    addStatusHistory('import', '系统初始化完成，已加载演示数据');
  },

  resetData: () => {
    inspections = [];
    mergedGroups = [];
    history = [];
    statusHistory = [];
    currentStep = 'import';
    module.exports.initDemoData();
  }
};
