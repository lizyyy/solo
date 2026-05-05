const storage = require('./storage');
const dayjs = require('dayjs');

// 阈值配置
const THRESHOLDS = {
  // 照度阈值（单位：lux）
  illumination: {
    normal: { min: 100, max: 500 },    // 正常范围
    low: { max: 80 },                   // 偏低，可能衰减
    veryLow: { max: 30 }                // 极低，可能故障
  },
  // 电流阈值（单位：A）
  current: {
    normal: { min: 0.8, max: 1.2 },     // 正常工作电流
    low: { max: 0.3 },                   // 电流过低，可能断路
    high: { min: 2.0 },                  // 电流过高，可能短路
    zero: { max: 0.05 }                  // 几乎无电流
  },
  // 风险权重
  weights: {
    illumination: 0.35,
    current: 0.35,
    complaint: 0.20,
    history: 0.10
  }
};

// 计算单个灯杆的风险
function calculatePoleRisk(poleId, illuminationData, currentData, complaints, history) {
  const risks = [];
  let totalScore = 0;
  
  // 1. 分析照度数据
  const poleIllumination = illuminationData.filter(i => 
    i.poleId === poleId || i.poleId.toString() === poleId
  );
  
  if (poleIllumination.length > 0) {
    const avgIllumination = poleIllumination.reduce((sum, item) => 
      sum + (item.illumination || 0), 0) / poleIllumination.length;
    
    // 判断照度相关风险
    if (avgIllumination <= THRESHOLDS.illumination.veryLow.max) {
      risks.push({
        riskType: '线路故障',
        reason: `照度严重不足（平均值: ${avgIllumination.toFixed(1)} lux），远低于正常范围`,
        score: 90,
        source: 'illumination',
        details: { avgIllumination, threshold: THRESHOLDS.illumination.normal.min }
      });
    } else if (avgIllumination <= THRESHOLDS.illumination.low.max) {
      risks.push({
        riskType: '灯具衰减',
        reason: `照度偏低（平均值: ${avgIllumination.toFixed(1)} lux），可能存在灯具衰减`,
        score: 60,
        source: 'illumination',
        details: { avgIllumination, threshold: THRESHOLDS.illumination.normal.min }
      });
    }
  }
  
  // 2. 分析电流数据
  const poleCurrent = currentData.filter(c => 
    c.poleId === poleId || c.poleId.toString() === poleId
  );
  
  if (poleCurrent.length > 0) {
    const avgCurrent = poleCurrent.reduce((sum, item) => 
      sum + (item.current || 0), 0) / poleCurrent.length;
    
    const minCurrent = Math.min(...poleCurrent.map(c => c.current || 0));
    const maxCurrent = Math.max(...poleCurrent.map(c => c.current || 0));
    const currentVariance = maxCurrent - minCurrent;
    
    // 零电流 - 线路故障
    if (avgCurrent <= THRESHOLDS.current.zero.max) {
      risks.push({
        riskType: '线路故障',
        reason: `电流为零（平均值: ${avgCurrent.toFixed(3)} A），可能存在断路或电源问题`,
        score: 95,
        source: 'current',
        details: { avgCurrent, threshold: THRESHOLDS.current.normal.min }
      });
    } 
    // 电流过低
    else if (avgCurrent <= THRESHOLDS.current.low.max) {
      risks.push({
        riskType: '线路故障',
        reason: `电流过低（平均值: ${avgCurrent.toFixed(3)} A），可能存在接触不良或部分断路`,
        score: 75,
        source: 'current',
        details: { avgCurrent, threshold: THRESHOLDS.current.normal.min }
      });
    }
    // 电流过高
    else if (avgCurrent >= THRESHOLDS.current.high.min) {
      risks.push({
        riskType: '线路故障',
        reason: `电流过高（平均值: ${avgCurrent.toFixed(3)} A），可能存在短路或过载`,
        score: 85,
        source: 'current',
        details: { avgCurrent, threshold: THRESHOLDS.current.normal.max }
      });
    }
    // 电流波动大
    else if (currentVariance > 0.5 && poleCurrent.length > 1) {
      risks.push({
        riskType: '线路故障',
        reason: `电流波动大（波动范围: ${currentVariance.toFixed(3)} A），可能存在接触不良`,
        score: 55,
        source: 'current',
        details: { currentVariance, minCurrent, maxCurrent }
      });
    }
  }
  
  // 3. 分析报修数据
  const poleComplaints = complaints.filter(c => 
    (c.poleId && (c.poleId === poleId || c.poleId.toString() === poleId))
  );
  
  if (poleComplaints.length > 0) {
    const keywords = poleComplaints.flatMap(c => c.keywords || []);
    
    // 分析报修关键词
    if (keywords.includes('不亮') || keywords.includes('故障')) {
      risks.push({
        riskType: '线路故障',
        reason: `居民报修：${poleComplaints[0].description}`,
        score: 80,
        source: 'complaint',
        details: { complaints: poleComplaints.length, keywords }
      });
    } else if (keywords.includes('变暗') || keywords.includes('闪烁')) {
      risks.push({
        riskType: '灯具衰减',
        reason: `居民报修：${poleComplaints[0].description}`,
        score: 50,
        source: 'complaint',
        details: { complaints: poleComplaints.length, keywords }
      });
    } else {
      risks.push({
        riskType: '线路故障',
        reason: `居民报修：${poleComplaints[0].description}`,
        score: 60,
        source: 'complaint',
        details: { complaints: poleComplaints.length, keywords }
      });
    }
  }
  
  // 4. 合并风险，去重并计算综合得分
  const mergedRisks = mergeRisks(risks);
  
  // 5. 检查误报情况
  // 如果数据之间存在矛盾，可能是误报
  const checkFalsePositive = () => {
    // 有报修但传感器数据正常
    const hasComplaint = poleComplaints.length > 0;
    const hasNormalData = (poleIllumination.length > 0 || poleCurrent.length > 0);
    
    if (hasComplaint && hasNormalData) {
      let allNormal = true;
      
      // 检查照度是否正常
      if (poleIllumination.length > 0) {
        const avgIllumination = poleIllumination.reduce((sum, item) => 
          sum + (item.illumination || 0), 0) / poleIllumination.length;
        if (avgIllumination < THRESHOLDS.illumination.normal.min) {
          allNormal = false;
        }
      }
      
      // 检查电流是否正常
      if (poleCurrent.length > 0) {
        const avgCurrent = poleCurrent.reduce((sum, item) => 
          sum + (item.current || 0), 0) / poleCurrent.length;
        if (avgCurrent < THRESHOLDS.current.normal.min || 
            avgCurrent > THRESHOLDS.current.normal.max) {
          allNormal = false;
        }
      }
      
      if (allNormal && mergedRisks.length === 0) {
        return [{
          riskType: '误报',
          reason: '居民报修但传感器数据正常，建议现场确认是否为误报',
          score: 30,
          source: 'analysis',
          details: { 
            hasComplaint: poleComplaints.length,
            illuminationCount: poleIllumination.length,
            currentCount: poleCurrent.length
          }
        }];
      }
    }
    
    return [];
  };
  
  const falsePositives = checkFalsePositive();
  
  return [...mergedRisks, ...falsePositives];
}

// 合并相同类型的风险
function mergeRisks(risks) {
  const riskMap = new Map();
  
  risks.forEach(risk => {
    const key = risk.riskType;
    if (!riskMap.has(key)) {
      riskMap.set(key, { ...risk, sources: [risk.source] });
    } else {
      const existing = riskMap.get(key);
      existing.score = Math.max(existing.score, risk.score) * 1.1; // 多源证据加分
      existing.reason = `${existing.reason}；${risk.reason}`;
      existing.sources = [...existing.sources, risk.source];
      existing.details = { ...existing.details, ...risk.details };
    }
  });
  
  return Array.from(riskMap.values()).map(risk => ({
    ...risk,
    score: Math.min(risk.score, 100) // 限制满分
  }));
}

// 计算优先级
function calculatePriority(score) {
  if (score >= 80) return '高';
  if (score >= 50) return '中';
  return '低';
}

// 生成处置建议
function generateSuggestions(riskType, history) {
  const defaultSuggestions = {
    '灯具衰减': [
      '建议更换老化灯具',
      '检查电源输出是否稳定',
      '参考历史同类型维修记录'
    ],
    '线路故障': [
      '检查灯杆接线端子',
      '测量线路电阻判断是否断路',
      '检查保险丝和开关状态',
      '必要时更换故障线缆'
    ],
    '误报': [
      '联系报修居民确认具体情况',
      '现场核实灯具运行状态',
      '检查传感器校准情况'
    ]
  };
  
  const suggestions = [...(defaultSuggestions[riskType] || [])];
  
  // 添加历史建议
  if (history && history.length > 0) {
    const historySuggestions = history
      .filter(h => h.solution)
      .slice(0, 3)
      .map(h => `历史处置: ${h.solution}`);
    suggestions.push(...historySuggestions);
  }
  
  return suggestions;
}

// 主函数：计算所有风险
async function calculateAllRisks() {
  // 获取所有数据
  const [illuminationData, currentData, complaints, workOrders] = await Promise.all([
    storage.getItem('illumination'),
    storage.getItem('currentLogs'),
    storage.getItem('complaints'),
    storage.getItem('workOrders')
  ]);
  
  // 确保都是数组
  const safeIllumination = Array.isArray(illuminationData) ? illuminationData : [];
  const safeCurrent = Array.isArray(currentData) ? currentData : [];
  const safeComplaints = Array.isArray(complaints) ? complaints : [];
  const safeWorkOrders = Array.isArray(workOrders) ? workOrders : [];
  
  // 收集所有涉及的灯杆ID
  const poleIds = new Set();
  
  safeIllumination.forEach(item => {
    if (item.poleId) poleIds.add(item.poleId.toString());
  });
  
  safeCurrent.forEach(item => {
    if (item.poleId) poleIds.add(item.poleId.toString());
  });
  
  safeComplaints.forEach(item => {
    if (item.poleId) poleIds.add(item.poleId.toString());
  });
  
  // 获取所有道路
  const roads = new Set();
  [...safeIllumination, ...safeComplaints, ...safeWorkOrders].forEach(item => {
    if (item.road) roads.add(item.road);
  });
  
  // 计算每个灯杆的风险
  const allRisks = [];
  
  for (const poleId of poleIds) {
    // 获取该灯杆的道路信息
    const roadData = [...safeIllumination, ...safeComplaints].find(
      item => item.poleId && item.poleId.toString() === poleId && item.road
    );
    const road = roadData?.road || '未知道路';
    
    // 计算风险
    const risks = calculatePoleRisk(poleId, safeIllumination, safeCurrent, safeComplaints, safeWorkOrders);
    
    // 为每个风险添加完整信息
    for (const risk of risks) {
      // 获取相似历史
      const history = workOrders.filter(wo => {
        if (wo.poleId && wo.poleId.toString() === poleId) return true;
        if (wo.issueType && risk.riskType.includes(wo.issueType)) return true;
        return false;
      }).slice(0, 5);
      
      allRisks.push({
        id: `risk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        poleId,
        road,
        riskType: risk.riskType,
        reason: risk.reason,
        score: risk.score,
        priority: calculatePriority(risk.score),
        sources: risk.sources || [risk.source],
        details: risk.details,
        suggestions: generateSuggestions(risk.riskType, history),
        history: history,
        status: '待复核',
        createdAt: dayjs().toISOString()
      });
    }
  }
  
  // 按道路分组，计算路段级别的风险
  const roadGroups = new Map();
  allRisks.forEach(risk => {
    if (!roadGroups.has(risk.road)) {
      roadGroups.set(risk.road, []);
    }
    roadGroups.get(risk.road).push(risk);
  });
  
  // 保存风险数据
  await storage.saveRisks(allRisks);
  
  return allRisks;
}

module.exports = {
  calculateAllRisks,
  calculatePoleRisk,
  calculatePriority,
  generateSuggestions
};
