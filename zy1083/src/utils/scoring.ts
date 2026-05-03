import {
  House,
  VisitNote,
  RatingConfig,
  WeightConfig,
  ScoredHouse,
  HouseScores,
  RiskFactor,
} from '../types';

export const DEFAULT_WEIGHTS: WeightConfig = {
  monthlyRent: 15,
  depositRisk: 12,
  commuteTime: 12,
  lighting: 10,
  noise: 10,
  waterLeak: 8,
  odor: 8,
  repairCost: 10,
  surroundingSafety: 10,
  agencyFee: 3,
  additionalFees: 2,
};

export const DEFAULT_RATING_CONFIG: RatingConfig = {
  weights: DEFAULT_WEIGHTS,
  scoreRanges: {
    excellent: { min: 85, max: 100 },
    good: { min: 70, max: 84 },
    fair: { min: 50, max: 69 },
    poor: { min: 0, max: 49 },
  },
};

export const calculateMonthlyHiddenCost = (house: House): number => {
  let hiddenCost = 0;

  if (house.agencyFee > 0) {
    const term = house.contractTerm || 12;
    hiddenCost += house.agencyFee / term;
  }

  house.additionalFees.forEach((fee) => {
    switch (fee.period) {
      case '月付':
        hiddenCost += fee.amount;
        break;
      case '季付':
        hiddenCost += fee.amount / 3;
        break;
      case '年付':
        hiddenCost += fee.amount / 12;
        break;
      case '一次性':
        hiddenCost += fee.amount / 12;
        break;
    }
  });

  return hiddenCost;
};

export const calculateCommuteTimeCost = (house: House): { minutes: number; costPerMonth: number } => {
  const dailyMinutes = house.commuteTime * 2;
  const workDaysPerMonth = 22;
  const monthlyMinutes = dailyMinutes * workDaysPerMonth;

  const hourlyWage = 50;
  const costPerMonth = (monthlyMinutes / 60) * hourlyWage;

  return {
    minutes: monthlyMinutes,
    costPerMonth,
  };
};

export const calculateDepositRisk = (house: House): { score: number; description: string; riskLevel: '低' | '中' | '高' } => {
  let riskScore = 0;
  let description = '';

  switch (house.depositType) {
    case '押一付一':
      riskScore = 20;
      description = '押一付一，押金风险较低';
      break;
    case '押二付一':
      riskScore = 50;
      description = '押二付一，押金金额较高，需注意退租条款';
      break;
    case '押三付一':
      riskScore = 80;
      description = '押三付一，押金金额很高，退租风险较大';
      break;
    case '其他':
      riskScore = 60;
      description = '押金条款不明确，需进一步确认';
      break;
  }

  const depositToRentRatio = house.deposit / (house.monthlyRent || 1);
  if (depositToRentRatio > 3) {
    riskScore = Math.min(100, riskScore + 20);
    description += '，且押金超过月租金3倍，风险极高';
  } else if (depositToRentRatio > 2) {
    riskScore = Math.min(100, riskScore + 10);
    description += '，押金超过月租金2倍';
  }

  if (house.landlordPromises.length === 0) {
    description += '，未记录房东口头承诺，建议补充';
  }

  const riskLevel: '低' | '中' | '高' = riskScore < 30 ? '低' : riskScore < 60 ? '中' : '高';

  return {
    score: 100 - riskScore,
    description,
    riskLevel,
  };
};

export const calculateRepairRisk = (
  visitNote?: VisitNote
): { score: number; description: string; riskLevel: '低' | '中' | '高'; estimatedCost: number } => {
  if (!visitNote) {
    return {
      score: 70,
      description: '暂无看房记录，无法评估维修风险',
      riskLevel: '中',
      estimatedCost: 0,
    };
  }

  let riskScore = 0;
  let estimatedCost = 0;
  const issues: string[] = [];

  if (visitNote.waterLeak) {
    riskScore += 30;
    estimatedCost += 500;
    issues.push(`漏水问题: ${visitNote.waterLeakDescription || '未详细描述'}`);
  }

  if (visitNote.odor) {
    riskScore += 20;
    issues.push(`异味问题: ${visitNote.odorDescription || '未详细描述'}`);
  }

  visitNote.repairItems.forEach((item) => {
    let cost = 0;
    let scoreAdd = 0;

    switch (item.severity) {
      case '轻微':
        cost = 100;
        scoreAdd = 5;
        break;
      case '中等':
        cost = 500;
        scoreAdd = 15;
        break;
      case '严重':
        cost = 2000;
        scoreAdd = 30;
        break;
    }

    if (item.needsLandlordRepair) {
      scoreAdd = Math.max(0, scoreAdd - 5);
      issues.push(`${item.item} (${item.severity}，需房东维修)`);
    } else {
      issues.push(`${item.item} (${item.severity}，需自行维修)`);
    }

    estimatedCost += cost;
    riskScore += scoreAdd;
  });

  visitNote.applianceStatus.forEach((appliance) => {
    if (appliance.status === '故障') {
      riskScore += 10;
      estimatedCost += 300;
      issues.push(`${appliance.name} 故障: ${appliance.notes || '未描述'}`);
    } else if (appliance.status === '缺失') {
      riskScore += 5;
      issues.push(`${appliance.name} 缺失`);
    }
  });

  riskScore = Math.min(100, riskScore);

  let description = '';
  if (issues.length === 0) {
    description = '未发现明显维修问题';
  } else if (issues.length <= 2) {
    description = `存在 ${issues.length} 项维修问题: ${issues.slice(0, 2).join('、')}`;
  } else {
    description = `存在 ${issues.length} 项维修问题: ${issues.slice(0, 2).join('、')} 等`;
  }

  const riskLevel: '低' | '中' | '高' = riskScore < 20 ? '低' : riskScore < 50 ? '中' : '高';

  return {
    score: 100 - riskScore,
    description,
    riskLevel,
    estimatedCost,
  };
};

export const normalizeScore = (value: number, min: number, max: number, invert: boolean = false): number => {
  if (max === min) return 50;
  let normalized = ((value - min) / (max - min)) * 100;
  normalized = Math.max(0, Math.min(100, normalized));
  if (invert) normalized = 100 - normalized;
  return normalized;
};

export const calculateHouseScores = (
  house: House,
  visitNote?: VisitNote,
  allHouses: House[] = []
): HouseScores => {
  const monthlyRents = allHouses.map((h) => h.monthlyRent);
  const minRent = Math.min(...monthlyRents, house.monthlyRent);
  const maxRent = Math.max(...monthlyRents, house.monthlyRent);

  const commuteTimes = allHouses.map((h) => h.commuteTime);
  const minCommute = Math.min(...commuteTimes, house.commuteTime);
  const maxCommute = Math.max(...commuteTimes, house.commuteTime);

  const monthlyRentScore = normalizeScore(house.monthlyRent, minRent, maxRent, true);

  const depositRisk = calculateDepositRisk(house);

  const commuteTimeScore = normalizeScore(house.commuteTime, minCommute, maxCommute, true);

  const lightingScore = visitNote ? (visitNote.lighting / 5) * 100 : 50;
  const noiseScore = visitNote ? (visitNote.noise / 5) * 100 : 50;

  let waterLeakScore = 100;
  if (visitNote?.waterLeak) {
    waterLeakScore = 30;
  }

  let odorScore = 100;
  if (visitNote?.odor) {
    odorScore = 40;
  }

  const repairRisk = calculateRepairRisk(visitNote);

  const surroundingSafetyScore = visitNote ? (visitNote.surroundingSafety / 5) * 100 : 50;

  const agencyFeeScore = house.agencyFee === 0 ? 100 : Math.max(0, 100 - (house.agencyFee / house.monthlyRent) * 50);

  const additionalFeesScore =
    house.additionalFees.length === 0 ? 100 : Math.max(0, 100 - house.additionalFees.length * 10);

  return {
    monthlyRentScore,
    depositRiskScore: depositRisk.score,
    commuteTimeScore,
    lightingScore,
    noiseScore,
    waterLeakScore,
    odorScore,
    repairCostScore: repairRisk.score,
    surroundingSafetyScore,
    agencyFeeScore,
    additionalFeesScore,
  };
};

export const calculateOverallScore = (scores: HouseScores, weights: WeightConfig): number => {
  const scoreWeights: Record<keyof HouseScores, keyof WeightConfig> = {
    monthlyRentScore: 'monthlyRent',
    depositRiskScore: 'depositRisk',
    commuteTimeScore: 'commuteTime',
    lightingScore: 'lighting',
    noiseScore: 'noise',
    waterLeakScore: 'waterLeak',
    odorScore: 'odor',
    repairCostScore: 'repairCost',
    surroundingSafetyScore: 'surroundingSafety',
    agencyFeeScore: 'agencyFee',
    additionalFeesScore: 'additionalFees',
  };

  let totalWeight = 0;
  let weightedSum = 0;

  Object.entries(scores).forEach(([key, score]) => {
    const weightKey = scoreWeights[key as keyof HouseScores];
    if (weightKey && weights[weightKey] !== undefined) {
      const weight = weights[weightKey];
      totalWeight += weight;
      weightedSum += score * weight;
    }
  });

  return totalWeight > 0 ? weightedSum / totalWeight : 0;
};

export const getGradeFromScore = (
  score: number,
  config: RatingConfig = DEFAULT_RATING_CONFIG
): 'excellent' | 'good' | 'fair' | 'poor' => {
  if (score >= config.scoreRanges.excellent.min) return 'excellent';
  if (score >= config.scoreRanges.good.min) return 'good';
  if (score >= config.scoreRanges.fair.min) return 'fair';
  return 'poor';
};

export const generateRiskFactors = (house: House, visitNote?: VisitNote): RiskFactor[] => {
  const riskFactors: RiskFactor[] = [];

  const depositRisk = calculateDepositRisk(house);
  if (depositRisk.riskLevel !== '低') {
    riskFactors.push({
      category: '押金风险',
      level: depositRisk.riskLevel,
      description: depositRisk.description,
      suggestion: '建议在合同中明确押金退还条件和时间，最好要求押一付一',
    });
  }

  if (house.commuteTime > 45) {
    riskFactors.push({
      category: '通勤风险',
      level: house.commuteTime > 60 ? '高' : '中',
      description: `单程通勤时间 ${house.commuteTime} 分钟，每日往返超过1.5小时`,
      suggestion: '考虑试通勤一次，确认高峰期实际耗时，或寻找更近的房源',
    });
  }

  if (visitNote?.waterLeak) {
    riskFactors.push({
      category: '房屋质量',
      level: '高',
      description: `存在漏水问题: ${visitNote.waterLeakDescription || '未详细描述'}`,
      suggestion: '要求房东在签约前修复，并在合同中注明漏水维修责任',
    });
  }

  if (visitNote?.odor) {
    riskFactors.push({
      category: '房屋质量',
      level: '中',
      description: `存在异味问题: ${visitNote.odorDescription || '未详细描述'}`,
      suggestion: '建议开窗通风后再次查看，确认异味来源是否可消除',
    });
  }

  const repairRisk = calculateRepairRisk(visitNote);
  if (repairRisk.riskLevel !== '低' && visitNote) {
    const severeItems = visitNote.repairItems.filter((i) => i.severity === '严重');
    if (severeItems.length > 0) {
      riskFactors.push({
        category: '维修风险',
        level: '高',
        description: `存在 ${severeItems.length} 项严重维修问题: ${severeItems.map((i) => i.item).join('、')}`,
        suggestion: '要求房东在签约前修复所有严重问题，并写入合同',
      });
    }
  }

  const faultyAppliances = visitNote?.applianceStatus.filter((a) => a.status === '故障') || [];
  if (faultyAppliances.length > 0) {
    riskFactors.push({
      category: '家电问题',
      level: '中',
      description: `以下家电故障: ${faultyAppliances.map((a) => a.name).join('、')}`,
      suggestion: '要求房东维修或更换故障家电，或协商降低租金',
    });
  }

  if (visitNote && visitNote.surroundingSafety < 3) {
    riskFactors.push({
      category: '安全风险',
      level: '高',
      description: '周边安全评分较低，存在安全隐患',
      suggestion: '建议在不同时间段查看周边环境，了解治安情况',
    });
  }

  if (house.landlordPromises.length === 0) {
    riskFactors.push({
      category: '合同风险',
      level: '中',
      description: '未记录房东的口头承诺',
      suggestion: '建议将房东的所有口头承诺写入合同，避免纠纷',
    });
  }

  if (house.agencyFee > 0) {
    riskFactors.push({
      category: '成本风险',
      level: '低',
      description: `需支付中介费 ${house.agencyFee} 元`,
      suggestion: '确认中介费是否可谈，或尝试直租房东房源',
    });
  }

  if (house.additionalFees.length > 0) {
    const feeNames = house.additionalFees.map((f) => `${f.name}(${f.amount}元/${f.period})`);
    riskFactors.push({
      category: '成本风险',
      level: '低',
      description: `存在额外费用: ${feeNames.join('、')}`,
      suggestion: '确认所有费用是否包含在合同中，避免签约后出现隐藏费用',
    });
  }

  return riskFactors;
};

export const scoreHouse = (
  house: House,
  visitNote?: VisitNote,
  allHouses: House[] = [],
  config: RatingConfig = DEFAULT_RATING_CONFIG
): ScoredHouse => {
  const scores = calculateHouseScores(house, visitNote, allHouses);
  const overallScore = calculateOverallScore(scores, config.weights);
  const overallGrade = getGradeFromScore(overallScore, config);
  const riskFactors = generateRiskFactors(house, visitNote);

  return {
    ...house,
    visitNote,
    scores,
    riskFactors,
    overallScore: Math.round(overallScore * 10) / 10,
    overallGrade,
  };
};

export const scoreAllHouses = (
  houses: House[],
  visitNotes: VisitNote[],
  config: RatingConfig = DEFAULT_RATING_CONFIG
): ScoredHouse[] => {
  const visitNoteMap = new Map<string, VisitNote>();
  visitNotes.forEach((vn) => {
    if (!visitNoteMap.has(vn.houseId) || vn.visitDate > visitNoteMap.get(vn.houseId)!.visitDate) {
      visitNoteMap.set(vn.houseId, vn);
    }
  });

  return houses.map((house) => {
    const visitNote = visitNoteMap.get(house.id);
    return scoreHouse(house, visitNote, houses, config);
  });
};
