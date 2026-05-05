import type {
  SeedlingTray,
  MoistureSensorData,
  NozzleCalibration,
  NutrientRecipe,
  BedAnalysis,
  Risk
} from '../types';
import { RiskType } from '../types';

export const analyzeBed = (
  bedId: string,
  trays: SeedlingTray[],
  sensorData: MoistureSensorData[],
  nozzles: NozzleCalibration[],
  recipes: NutrientRecipe[]
): BedAnalysis => {
  const bedTrays = trays.filter(t => t.bedId === bedId);
  const bedSensorData = sensorData.filter(s => s.bedId === bedId);
  const bedNozzles = nozzles.filter(n => n.bedId === bedId);

  const seedlingTypes = [...new Set(bedTrays.map(t => t.seedlingType))];
  const currentStages = [...new Set(bedTrays.map(t => t.currentStage))];

  let targetMoisture = 60;
  let targetEc = 1.5;

  if (bedTrays.length > 0) {
    targetMoisture = bedTrays.reduce((sum, t) => sum + t.targetMoisture, 0) / bedTrays.length;
    targetEc = bedTrays.reduce((sum, t) => sum + t.targetEc, 0) / bedTrays.length;
  }

  if (seedlingTypes.length > 0 && currentStages.length > 0) {
    const matchingRecipe = recipes.find(r =>
      seedlingTypes.includes(r.seedlingType) && currentStages.includes(r.stage)
    );
    if (matchingRecipe) {
      targetEc = matchingRecipe.ecTarget;
    }
  }

  let avgMoisture = targetMoisture;
  let avgEc = targetEc;

  if (bedSensorData.length > 0) {
    avgMoisture = bedSensorData.reduce((sum, s) => sum + s.moisture, 0) / bedSensorData.length;
    avgEc = bedSensorData.reduce((sum, s) => sum + s.ec, 0) / bedSensorData.length;
  }

  const nozzleStatus: Record<string, 'normal' | 'clogged' | 'leaking'> = {};
  bedNozzles.forEach(n => {
    nozzleStatus[n.nozzleId] = n.status;
  });

  const risks: Risk[] = [];
  const moistureDiff = avgMoisture - targetMoisture;
  const moistureThresholdLow = targetMoisture * 0.15;
  const moistureThresholdHigh = targetMoisture * 0.2;

  if (moistureDiff < -moistureThresholdLow) {
    const severity = moistureDiff < -moistureThresholdHigh ? 'high' : 'medium';
    risks.push({
      type: RiskType.UNDER_WATERING,
      severity,
      description: `湿度偏低: 当前 ${avgMoisture.toFixed(1)}%，目标 ${targetMoisture.toFixed(1)}%，差值 ${moistureDiff.toFixed(1)}%`,
      suggestion: severity === 'high' 
        ? '建议立即增加喷灌时间或频率，检查喷头是否堵塞' 
        : '建议适当增加喷灌水量'
    });
  } else if (moistureDiff > moistureThresholdLow) {
    const severity = moistureDiff > moistureThresholdHigh ? 'high' : 'medium';
    risks.push({
      type: RiskType.OVER_WATERING,
      severity,
      description: `湿度过高: 当前 ${avgMoisture.toFixed(1)}%，目标 ${targetMoisture.toFixed(1)}%，差值 ${moistureDiff.toFixed(1)}%`,
      suggestion: severity === 'high' 
        ? '建议减少喷灌时间或频率，检查是否有喷头漏水' 
        : '建议适当减少喷灌水量'
    });
  }

  const ecDiff = avgEc - targetEc;
  const ecThreshold = targetEc * 0.2;

  if (ecDiff > ecThreshold) {
    const severity = ecDiff > targetEc * 0.4 ? 'high' : 'medium';
    risks.push({
      type: RiskType.HIGH_EC,
      severity,
      description: `EC 值偏高: 当前 ${avgEc.toFixed(2)} mS/cm，目标 ${targetEc.toFixed(2)} mS/cm`,
      suggestion: severity === 'high'
        ? '建议立即检查营养液配方，考虑增加清水喷淋稀释'
        : '建议检查营养液配比，适当调整'
    });
  }

  const cloggedNozzles = bedNozzles.filter(n => n.status === 'clogged');
  if (cloggedNozzles.length > 0) {
    const severity = cloggedNozzles.length > bedNozzles.length * 0.3 ? 'high' : 'medium';
    risks.push({
      type: RiskType.CLOGGED_NOZZLE,
      severity,
      description: `检测到 ${cloggedNozzles.length} 个喷头可能堵塞: ${cloggedNozzles.map(n => n.nozzleId).join(', ')}`,
      suggestion: severity === 'high'
        ? '建议立即疏通或更换堵塞喷头，检查过滤器'
        : '建议检查并疏通堵塞喷头'
    });
  }

  const totalFlowRate = bedNozzles.reduce((sum, n) => sum + n.flowRate, 0);
  const moistureDeficit = Math.max(0, targetMoisture - avgMoisture);
  const suggestedWateringAmount = moistureDeficit * 0.5 * bedTrays.reduce((sum, t) => sum + t.quantity, 0);
  const suggestedWateringDuration = totalFlowRate > 0 ? suggestedWateringAmount / totalFlowRate * 60 : 0;

  return {
    bedId,
    trayCount: bedTrays.length,
    seedlingTypes,
    avgMoisture,
    targetMoisture,
    avgEc,
    targetEc,
    nozzles: bedNozzles.map(n => n.nozzleId),
    nozzleStatus,
    risks,
    suggestedWateringAmount: Math.max(0, suggestedWateringAmount),
    suggestedWateringDuration: Math.max(0, Math.round(suggestedWateringDuration)),
    notes: '',
    lastUpdated: new Date().toISOString()
  };
};

export const analyzeAllBeds = (
  trays: SeedlingTray[],
  sensorData: MoistureSensorData[],
  nozzles: NozzleCalibration[],
  recipes: NutrientRecipe[]
): BedAnalysis[] => {
  const bedIds = [...new Set([
    ...trays.map(t => t.bedId),
    ...sensorData.map(s => s.bedId),
    ...nozzles.map(n => n.bedId)
  ])].filter(id => id);

  return bedIds.map(bedId =>
    analyzeBed(bedId, trays, sensorData, nozzles, recipes)
  );
};

export const getOverallRiskLevel = (risks: Risk[]): 'low' | 'medium' | 'high' => {
  if (risks.length === 0) return 'low';
  if (risks.some(r => r.severity === 'high')) return 'high';
  if (risks.some(r => r.severity === 'medium')) return 'medium';
  return 'low';
};
