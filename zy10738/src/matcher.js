export function matchNoPlateVehicles(records) {
  const noPlateRecords = records.filter(r => !r.车牌号 || r.车牌号 === '无牌' || r.车牌号 === '未知');
  const matchedResults = [];
  const unmatchedRecords = [];

  noPlateRecords.forEach((noPlate) => {
    const candidates = findMatchCandidates(noPlate, records);
    
    if (candidates.length > 0) {
      const bestMatch = candidates[0];
      matchedResults.push({
        无牌车流水号: noPlate.流水号,
        无牌车原始行号: noPlate.原始行号,
        无牌车入场时间: noPlate.入场时间,
        无牌车出场时间: noPlate.出场时间,
        无牌车应收金额: noPlate.应收金额,
        无牌车实收金额: noPlate.实收金额,
        匹配状态: '匹配成功',
        匹配置信度: bestMatch.confidence,
        匹配原因: bestMatch.reason,
        匹配到流水号: bestMatch.record.流水号,
        匹配到车牌号: bestMatch.record.车牌号,
        匹配到原始行号: bestMatch.record.原始行号,
        匹配到应收金额: bestMatch.record.应收金额,
        匹配到实收金额: bestMatch.record.实收金额,
        金额差: Math.abs(noPlate.应收金额 - bestMatch.record.应收金额),
        存在异常: noPlate.hasErrors || bestMatch.record.hasErrors
      });
    } else {
      unmatchedRecords.push({
        无牌车流水号: noPlate.流水号,
        无牌车原始行号: noPlate.原始行号,
        无牌车入场时间: noPlate.入场时间,
        无牌车出场时间: noPlate.出场时间,
        无牌车应收金额: noPlate.应收金额,
        无牌车实收金额: noPlate.实收金额,
        匹配状态: '未匹配',
        匹配置信度: 0,
        匹配原因: '未找到符合条件的匹配记录',
        存在异常: noPlate.hasErrors
      });
    }
  });

  const allResults = [...matchedResults, ...unmatchedRecords];
  
  allResults.sort((a, b) => {
    if (a.匹配状态 !== b.匹配状态) {
      return a.匹配状态 === '匹配成功' ? -1 : 1;
    }
    if (a.匹配置信度 !== b.匹配置信度) {
      return b.匹配置信度 - a.匹配置信度;
    }
    return a.无牌车流水号.localeCompare(b.无牌车流水号);
  });

  return {
    matchedResults,
    unmatchedRecords,
    allResults
  };
}

function findMatchCandidates(noPlate, allRecords) {
  const candidates = [];
  const noPlateEntry = new Date(noPlate.入场时间);
  const noPlateExit = new Date(noPlate.出场时间);
  const timeWindow = 30 * 60 * 1000;

  allRecords.forEach((record) => {
    if (record.流水号 === noPlate.流水号) return;
    if (!record.车牌号 || record.车牌号 === '无牌' || record.车牌号 === '未知') return;

    const recordEntry = new Date(record.入场时间);
    const recordExit = new Date(record.出场时间);
    const entryDiff = Math.abs(noPlateEntry - recordEntry);
    const exitDiff = Math.abs(noPlateExit - recordExit);

    let confidence = 0;
    const reasons = [];

    if (entryDiff <= timeWindow) {
      confidence += 30;
      reasons.push(`入场时间接近（${Math.round(entryDiff / 60000)}分钟）`);
    }

    if (exitDiff <= timeWindow) {
      confidence += 30;
      reasons.push(`出场时间接近（${Math.round(exitDiff / 60000)}分钟）`);
    }

    if (Math.abs(noPlate.应收金额 - record.应收金额) < 0.01) {
      confidence += 25;
      reasons.push('应收金额一致');
    }

    if (noPlate.车道编号 === record.车道编号) {
      confidence += 15;
      reasons.push('车道相同');
    }

    if (confidence >= 50) {
      candidates.push({
        record,
        confidence,
        reason: reasons.join('; ')
      });
    }
  });

  candidates.sort((a, b) => b.confidence - a.confidence);
  return candidates;
}
