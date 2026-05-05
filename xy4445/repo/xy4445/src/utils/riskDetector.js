import { RISK_TYPES, RISK_LEVELS, QUEEN_STATUS, HIVE_STATUS } from '../models';

const OVERHEATING_THRESHOLD = 35;
const HIGH_HUMIDITY_THRESHOLD = 60;
const ROBBING_DISTANCE_THRESHOLD = 2;
const MAX_DAYS_SINCE_WATERING = 3;

export const detectOverheatingRisk = (sensorData) => {
  if (!sensorData) return null;
  
  const { temperature, humidity } = sensorData;
  
  if (temperature > OVERHEATING_THRESHOLD) {
    if (temperature > 38) {
      return {
        type: RISK_TYPES.OVERHEATING,
        level: RISK_LEVELS.HIGH,
        description: `严重过热：温度 ${temperature}°C，远超安全阈值`,
        recommendations: ['立即开启通风', '增加遮阴', '考虑喷水降温']
      };
    } else {
      return {
        type: RISK_TYPES.OVERHEATING,
        level: RISK_LEVELS.MEDIUM,
        description: `温度偏高：${temperature}°C，接近临界值`,
        recommendations: ['加强通风', '监控温度变化', '准备遮阴措施']
      };
    }
  }
  
  if (humidity > HIGH_HUMIDITY_THRESHOLD && temperature > 32) {
    return {
      type: RISK_TYPES.OVERHEATING,
      level: RISK_LEVELS.MEDIUM,
      description: `高温高湿环境：${temperature}°C，湿度 ${humidity}%`,
      recommendations: ['加强通风除湿', '监控蜂群活动']
    };
  }
  
  return null;
};

export const detectWaterShortageRisk = (sensorData, wateringSchedule) => {
  const risks = [];
  
  if (sensorData && sensorData.humidity < 30) {
    risks.push({
      type: RISK_TYPES.WATER_SHORTAGE,
      level: sensorData.humidity < 20 ? RISK_LEVELS.HIGH : RISK_LEVELS.MEDIUM,
      description: `环境湿度过低：${sensorData.humidity}%，可能导致缺水`,
      recommendations: ['检查蜂群饮水情况', '补充水源', '监控采水蜂活动']
    });
  }
  
  if (wateringSchedule) {
    const { lastWatering, nextWatering } = wateringSchedule;
    
    if (lastWatering) {
      const lastDate = new Date(lastWatering);
      const today = new Date();
      const daysSinceWatering = Math.floor((today - lastDate) / (1000 * 60 * 60 * 24));
      
      if (daysSinceWatering > MAX_DAYS_SINCE_WATERING) {
        risks.push({
          type: RISK_TYPES.WATER_SHORTAGE,
          level: daysSinceWatering > 5 ? RISK_LEVELS.HIGH : RISK_LEVELS.MEDIUM,
          description: `已超过${daysSinceWatering}天未补水`,
          recommendations: ['立即安排补水', '检查蜂群状态']
        });
      }
    }
    
    if (nextWatering) {
      const nextDate = new Date(nextWatering);
      const today = new Date();
      const daysUntilWatering = Math.ceil((nextDate - today) / (1000 * 60 * 60 * 24));
      
      if (daysUntilWatering <= 1) {
        risks.push({
          type: RISK_TYPES.WATER_SHORTAGE,
          level: RISK_LEVELS.LOW,
          description: `补水计划即将到期（${daysUntilWatering}天后）`,
          recommendations: ['准备补水工作', '确认水源充足']
        });
      }
    }
  }
  
  return risks.length > 0 ? risks : null;
};

export const detectQueenAbnormalityRisk = (hive, inspectionRecords) => {
  const risks = [];
  
  if (hive.queenStatus === QUEEN_STATUS.ABNORMAL) {
    risks.push({
      type: RISK_TYPES.QUEEN_ABNORMALITY,
      level: RISK_LEVELS.HIGH,
      description: '蜂王状态异常',
      recommendations: ['立即检查蜂王情况', '考虑引入新王', '监控蜂群情绪']
    });
  }
  
  if (hive.queenStatus === QUEEN_STATUS.UNSEEN) {
    risks.push({
      type: RISK_TYPES.QUEEN_ABNORMALITY,
      level: RISK_LEVELS.MEDIUM,
      description: '多日未见蜂王',
      recommendations: ['仔细检查子脾情况', '确认是否失王', '准备应急措施']
    });
  }
  
  if (inspectionRecords && inspectionRecords.length > 0) {
    const latestRecord = inspectionRecords[inspectionRecords.length - 1];
    
    if (!latestRecord.queenObserved) {
      risks.push({
        type: RISK_TYPES.QUEEN_ABNORMALITY,
        level: RISK_LEVELS.MEDIUM,
        description: '最近检查未观察到蜂王',
        recommendations: ['再次确认蜂王存在', '检查是否有急造王台', '评估蜂群状态']
      });
    }
    
    if (latestRecord.broodPattern && latestRecord.broodPattern.toLowerCase() === 'irregular') {
      risks.push({
        type: RISK_TYPES.QUEEN_ABNORMALITY,
        level: RISK_LEVELS.MEDIUM,
        description: '子脾模式不规则，可能蜂王质量下降',
        recommendations: ['评估蜂王年龄', '考虑更换蜂王', '监控产卵情况']
      });
    }
  }
  
  return risks.length > 0 ? risks : null;
};

export const detectRobbingRisk = (targetHive, allHives) => {
  if (!allHives || allHives.length <= 1) return null;
  
  const nearbyHives = allHives.filter(hive => {
    if (hive.id === targetHive.id) return false;
    
    const distance = Math.sqrt(
      Math.pow(hive.x - targetHive.x, 2) + 
      Math.pow(hive.y - targetHive.y, 2)
    );
    
    return distance <= ROBBING_DISTANCE_THRESHOLD;
  });
  
  if (nearbyHives.length > 0) {
    const strongNearbyHives = nearbyHives.filter(hive => hive.colonyCount > targetHive.colonyCount);
    
    if (strongNearbyHives.length > 0) {
      return {
        type: RISK_TYPES.ROBBING_RISK,
        level: RISK_LEVELS.MEDIUM,
        description: `附近有${strongNearbyHives.length}群更强的蜂群，存在盗蜂风险`,
        recommendations: ['缩小巢门', '加强监控', '避免在蜂箱附近暴露蜜源']
      };
    }
    
    return {
      type: RISK_TYPES.ROBBING_RISK,
      level: RISK_LEVELS.LOW,
      description: `附近有${nearbyHives.length}群蜂，距离较近`,
      recommendations: ['保持巢门适当大小', '定期检查盗蜂迹象']
    };
  }
  
  return null;
};

export const assessHiveRisks = (hive, sensorData, inspectionRecords, wateringSchedule, allHives) => {
  const risks = [];
  
  const overheatingRisk = detectOverheatingRisk(sensorData);
  if (overheatingRisk) risks.push(overheatingRisk);
  
  const waterShortageRisks = detectWaterShortageRisk(sensorData, wateringSchedule);
  if (waterShortageRisks) risks.push(...waterShortageRisks);
  
  const queenAbnormalityRisks = detectQueenAbnormalityRisk(hive, inspectionRecords);
  if (queenAbnormalityRisks) risks.push(...queenAbnormalityRisks);
  
  const robbingRisk = detectRobbingRisk(hive, allHives);
  if (robbingRisk) risks.push(robbingRisk);
  
  const overallStatus = calculateOverallStatus(risks);
  
  return {
    hiveId: hive.id,
    risks,
    overallStatus,
    riskCount: risks.length,
    highRiskCount: risks.filter(r => r.level === RISK_LEVELS.HIGH).length,
    mediumRiskCount: risks.filter(r => r.level === RISK_LEVELS.MEDIUM).length,
    lowRiskCount: risks.filter(r => r.level === RISK_LEVELS.LOW).length
  };
};

const calculateOverallStatus = (risks) => {
  if (!risks || risks.length === 0) {
    return HIVE_STATUS.HEALTHY;
  }
  
  const highRisks = risks.filter(r => r.level === RISK_LEVELS.HIGH);
  const mediumRisks = risks.filter(r => r.level === RISK_LEVELS.MEDIUM);
  
  if (highRisks.length > 0) {
    return HIVE_STATUS.CRITICAL;
  }
  
  if (mediumRisks.length > 0) {
    return HIVE_STATUS.AT_RISK;
  }
  
  return HIVE_STATUS.AT_RISK;
};
