const dataModel = require('../models/dataModel');

// 获取今天的日期（格式：YYYY-MM-DD）
function getTodayDate() {
  const today = new Date();
  return today.toISOString().split('T')[0];
}

// 检查吊篮是否可用
function isGondolaAvailable(gondola, facadeId) {
  if (gondola.status !== 'available') return false;
  if (!gondola.facades.includes(facadeId)) return false;
  return true;
}

// 检查工人是否符合要求
function isWorkerQualified(worker, specialRequirements) {
  if (worker.status !== 'available') return false;
  
  // 工人必须有高空作业证
  if (!worker.certifications.includes('高空作业')) return false;
  
  // 检查特殊要求
  for (const req of specialRequirements) {
    if (!worker.certifications.includes(req)) return false;
  }
  
  return true;
}

// 检查风速是否适合
function isWindSuitable(windForecast, facadeDirection, gondolaMaxWindSpeed) {
  const today = getTodayDate();
  const todayWind = windForecast.find(w => w.date === today);
  
  if (!todayWind) return { suitable: true, reason: '无今日风速预报，假设适合' };
  
  // 检查风速是否超过吊篮的最大允许风速
  if (todayWind.maxSpeed > gondolaMaxWindSpeed) {
    return { 
      suitable: false, 
      reason: `风速过大（${todayWind.maxSpeed}m/s），超过吊篮最大允许风速（${gondolaMaxWindSpeed}m/s）` 
    };
  }
  
  // 检查风向是否与立面方向相同（可能增加风险）
  const directionMap = { 'N': '北', 'S': '南', 'E': '东', 'W': '西' };
  const directionCN = directionMap[facadeDirection] || facadeDirection;
  const windDirectionCN = directionMap[todayWind.direction] || todayWind.direction;
  
  if (todayWind.direction === facadeDirection && todayWind.speed >= 6) {
    return { 
      suitable: false, 
      reason: `风向与立面方向相同（${windDirectionCN}风，${todayWind.speed}m/s），风险较高` 
    };
  }
  
  return { 
    suitable: true, 
    reason: `风速适宜（${todayWind.speed}m/s，最大${todayWind.maxSpeed}m/s），风向为${windDirectionCN}` 
  };
}

// 检查是否在禁噪时段
function isInNoiseRestriction(noiseRestrictions, currentTime = null) {
  const today = getTodayDate();
  const todayRestrictions = noiseRestrictions.filter(n => n.date === today);
  
  if (todayRestrictions.length === 0) return { restricted: false, reason: '今日无禁噪限制' };
  
  // 如果没有指定时间，默认检查是否有任何禁噪时段
  if (!currentTime) {
    const reasons = todayRestrictions.map(r => `${r.startTime}-${r.endTime}: ${r.reason}`);
    return { 
      restricted: true, 
      reason: `今日存在禁噪时段：${reasons.join('；')}` 
    };
  }
  
  // 检查当前时间是否在禁噪时段内
  for (const restriction of todayRestrictions) {
    if (currentTime >= restriction.startTime && currentTime <= restriction.endTime) {
      return { 
        restricted: true, 
        reason: `当前时间（${currentTime}）在禁噪时段内：${restriction.reason}` 
      };
    }
  }
  
  return { restricted: false, reason: '当前时间不在禁噪时段内' };
}

// 计算单个立面的开工可行性
function calculateFacadeFeasibility(facade, gondolas, workers, windForecast, noiseRestrictions) {
  const result = {
    facadeId: facade.id,
    facadeName: facade.name,
    direction: facade.direction,
    floors: facade.floors,
    area: facade.area,
    specialRequirements: facade.specialRequirements,
    feasible: false,
    reasons: [],
    availableGondolas: [],
    availableWorkers: [],
    windStatus: null,
    noiseStatus: null,
    suggestions: []
  };
  
  // 1. 检查风速
  result.windStatus = { suitable: true, reason: '待检查' };
  const suitableGondolas = gondolas.filter(g => isGondolaAvailable(g, facade.id));
  
  if (suitableGondolas.length === 0) {
    result.reasons.push('没有可用的吊篮覆盖此立面');
    result.suggestions.push('请检查吊篮状态或分配吊篮到该立面');
  } else {
    result.availableGondolas = suitableGondolas;
    
    // 检查风速对所有可用吊篮的影响
    let windSuitable = true;
    for (const gondola of suitableGondolas) {
      const windCheck = isWindSuitable(windForecast, facade.direction, gondola.maxWindSpeed);
      if (!windCheck.suitable) {
        windSuitable = false;
        result.windStatus = windCheck;
        result.reasons.push(windCheck.reason);
        result.suggestions.push('建议等待风速降低后再作业');
        break;
      }
      result.windStatus = windCheck;
    }
  }
  
  // 2. 检查工人
  const qualifiedWorkers = workers.filter(w => isWorkerQualified(w, facade.specialRequirements));
  
  if (qualifiedWorkers.length === 0) {
    result.reasons.push(`没有符合要求的工人（需要：高空作业${facade.specialRequirements.length > 0 ? '、' + facade.specialRequirements.join('、') : ''}）`);
    result.suggestions.push('请安排具备相应资质的工人，或调整作业计划');
  } else {
    result.availableWorkers = qualifiedWorkers;
  }
  
  // 3. 检查禁噪时段
  result.noiseStatus = isInNoiseRestriction(noiseRestrictions);
  
  // 综合判断
  result.feasible = (
    result.availableGondolas.length > 0 &&
    result.availableWorkers.length > 0 &&
    result.windStatus.suitable
  );
  
  if (result.feasible) {
    result.reasons = ['所有条件满足，可以开工'];
  }
  
  // 检查是否需要提醒禁噪时段
  if (result.noiseStatus.restricted) {
    result.reasons.push(`注意：${result.noiseStatus.reason}`);
    result.suggestions.push('请在禁噪时段外安排作业，或使用低噪音设备');
  }
  
  return result;
}

// 生成今日排班
function generateTodaySchedule() {
  const allData = dataModel.getAllData();
  const { gondolas, workers, facades, windForecast, noiseRestrictions } = allData;
  
  const scheduleResults = facades.map(facade => 
    calculateFacadeFeasibility(facade, gondolas, workers, windForecast, noiseRestrictions)
  );
  
  // 统计结果
  const feasibleCount = scheduleResults.filter(r => r.feasible).length;
  const notFeasibleCount = scheduleResults.filter(r => !r.feasible).length;
  
  // 按方向分组
  const groupedByDirection = {};
  scheduleResults.forEach(result => {
    const direction = result.direction;
    if (!groupedByDirection[direction]) {
      groupedByDirection[direction] = [];
    }
    groupedByDirection[direction].push(result);
  });
  
  return {
    date: getTodayDate(),
    totalFacades: scheduleResults.length,
    feasibleCount,
    notFeasibleCount,
    results: scheduleResults,
    groupedByDirection,
    windForecast: windForecast.find(w => w.date === getTodayDate()),
    noiseRestrictions: noiseRestrictions.filter(n => n.date === getTodayDate())
  };
}

// 保存排班结果
function saveSchedule(scheduleData) {
  const schedules = dataModel.readData('schedules');
  
  // 检查是否已有今日的排班
  const today = getTodayDate();
  const existingIndex = schedules.findIndex(s => s.date === today);
  
  if (existingIndex >= 0) {
    schedules[existingIndex] = { ...scheduleData, updatedAt: new Date().toISOString() };
  } else {
    schedules.push({ ...scheduleData, createdAt: new Date().toISOString() });
  }
  
  return dataModel.saveData('schedules', schedules);
}

// 获取历史排班
function getScheduleHistory() {
  return dataModel.readData('schedules');
}

// 保存复核备注
function saveReview(facadeId, reviewData) {
  const reviews = dataModel.readData('reviews');
  const today = getTodayDate();
  
  // 检查是否已有该立面今日的复核
  const existingIndex = reviews.findIndex(r => r.facadeId === facadeId && r.date === today);
  
  const reviewEntry = {
    id: existingIndex >= 0 ? reviews[existingIndex].id : `R${Date.now()}`,
    facadeId,
    date: today,
    ...reviewData,
    updatedAt: new Date().toISOString()
  };
  
  if (existingIndex >= 0) {
    reviews[existingIndex] = reviewEntry;
  } else {
    reviews.push(reviewEntry);
  }
  
  return dataModel.saveData('reviews', reviews);
}

// 获取复核备注
function getReviews(date = null) {
  const reviews = dataModel.readData('reviews');
  if (date) {
    return reviews.filter(r => r.date === date);
  }
  return reviews;
}

// 导出 Markdown 开工单
function exportMarkdownSchedule(scheduleData) {
  const directionNames = { 'N': '北立面', 'S': '南立面', 'E': '东立面', 'W': '西立面' };
  
  let markdown = `# 外墙检修开工单\n\n`;
  markdown += `**日期**: ${scheduleData.date}\n\n`;
  markdown += `**总立面数**: ${scheduleData.totalFacades}\n`;
  markdown += `**可开工**: ${scheduleData.feasibleCount}\n`;
  markdown += `**不可开工**: ${scheduleData.notFeasibleCount}\n\n`;
  
  // 天气和禁噪信息
  if (scheduleData.windForecast) {
    const wf = scheduleData.windForecast;
    const directionMap = { 'N': '北', 'S': '南', 'E': '东', 'W': '西' };
    markdown += `## 今日气象条件\n\n`;
    markdown += `- **风向**: ${directionMap[wf.direction] || wf.direction}\n`;
    markdown += `- **风速**: ${wf.speed} m/s（最大 ${wf.maxSpeed} m/s）\n`;
    markdown += `- **风险等级**: ${wf.riskLevel === 'low' ? '低' : wf.riskLevel === 'medium' ? '中' : '高'}\n\n`;
  }
  
  if (scheduleData.noiseRestrictions && scheduleData.noiseRestrictions.length > 0) {
    markdown += `## 今日禁噪时段\n\n`;
    scheduleData.noiseRestrictions.forEach(nr => {
      markdown += `- **${nr.startTime} - ${nr.endTime}**: ${nr.reason}\n`;
    });
    markdown += `\n`;
  }
  
  // 可开工的立面
  const feasibleResults = scheduleData.results.filter(r => r.feasible);
  if (feasibleResults.length > 0) {
    markdown += `## 可开工立面\n\n`;
    feasibleResults.forEach(result => {
      const dirName = directionNames[result.direction] || result.direction;
      markdown += `### ${result.facadeName}\n\n`;
      markdown += `- **方向**: ${dirName}\n`;
      markdown += `- **楼层**: ${result.floors}\n`;
      markdown += `- **面积**: ${result.area} ㎡\n`;
      if (result.specialRequirements.length > 0) {
        markdown += `- **特殊要求**: ${result.specialRequirements.join('、')}\n`;
      }
      markdown += `- **可用吊篮**: ${result.availableGondolas.map(g => g.name).join('、')}\n`;
      markdown += `- **可用工人**: ${result.availableWorkers.map(w => w.name).join('、')}\n`;
      markdown += `- **状态**: ${result.reasons[0]}\n\n`;
    });
  }
  
  // 不可开工的立面
  const notFeasibleResults = scheduleData.results.filter(r => !r.feasible);
  if (notFeasibleResults.length > 0) {
    markdown += `## 不可开工立面\n\n`;
    notFeasibleResults.forEach(result => {
      const dirName = directionNames[result.direction] || result.direction;
      markdown += `### ${result.facadeName}\n\n`;
      markdown += `- **方向**: ${dirName}\n`;
      markdown += `- **楼层**: ${result.floors}\n`;
      markdown += `- **面积**: ${result.area} ㎡\n`;
      markdown += `\n**原因分析**:\n\n`;
      result.reasons.forEach((reason, index) => {
        markdown += `${index + 1}. ${reason}\n`;
      });
      if (result.suggestions.length > 0) {
        markdown += `\n**建议**:\n\n`;
        result.suggestions.forEach((suggestion, index) => {
          markdown += `${index + 1}. ${suggestion}\n`;
        });
      }
      markdown += `\n`;
    });
  }
  
  markdown += `\n---\n*生成时间: ${new Date().toLocaleString('zh-CN')}*\n`;
  
  return markdown;
}

// 导出 JSON 审计明细
function exportJsonAudit(scheduleData) {
  const auditData = {
    auditId: `AUDIT-${Date.now()}`,
    generatedAt: new Date().toISOString(),
    date: scheduleData.date,
    summary: {
      totalFacades: scheduleData.totalFacades,
      feasibleCount: scheduleData.feasibleCount,
      notFeasibleCount: scheduleData.notFeasibleCount
    },
    windForecast: scheduleData.windForecast,
    noiseRestrictions: scheduleData.noiseRestrictions,
    facadeDetails: scheduleData.results.map(result => ({
      facadeId: result.facadeId,
      facadeName: result.facadeName,
      direction: result.direction,
      feasible: result.feasible,
      reasons: result.reasons,
      suggestions: result.suggestions,
      availableResources: {
        gondolas: result.availableGondolas.map(g => ({
          id: g.id,
          name: g.name,
          capacity: g.capacity,
          maxWindSpeed: g.maxWindSpeed
        })),
        workers: result.availableWorkers.map(w => ({
          id: w.id,
          name: w.name,
          certifications: w.certifications,
          experience: w.experience
        }))
      },
      windStatus: result.windStatus,
      noiseStatus: result.noiseStatus
    }))
  };
  
  return JSON.stringify(auditData, null, 2);
}

module.exports = {
  generateTodaySchedule,
  saveSchedule,
  getScheduleHistory,
  saveReview,
  getReviews,
  exportMarkdownSchedule,
  exportJsonAudit,
  getTodayDate
};
