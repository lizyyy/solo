const { Op } = require('sequelize');
const dayjs = require('dayjs');
const { WaterSample, Risk, DisposalRecord } = require('../models');
const {
  RISK_DETECTION_RULES,
  isOverlimit,
  getDeviationPercentage
} = require('../config/waterQualityStandards');

const PARAMETERS = ['chlorine', 'ph', 'turbidity', 'temperature'];

class RiskDetectionService {
  static async detectAllRisks() {
    const risks = [];
    
    console.log('开始检测风险...');
    
    const continuousRisks = await this.detectContinuousAnomalies();
    risks.push(...continuousRisks);
    
    const repeatedRisks = await this.detectRepeatedOverlimits();
    risks.push(...repeatedRisks);
    
    const noRecoveryRisks = await this.detectNoRecoveryAfterTreatment();
    risks.push(...noRecoveryRisks);
    
    console.log(`检测完成，共发现 ${risks.length} 个风险`);
    
    return risks;
  }

  static async detectContinuousAnomalies() {
    const risks = [];
    const rule = RISK_DETECTION_RULES.CONTINUOUS_ANOMALY;
    
    console.log('检测连续异常...');
    
    const samplePoints = await WaterSample.findAll({
      attributes: ['samplePoint'],
      group: ['samplePoint'],
      raw: true
    });
    
    for (const { samplePoint } of samplePoints) {
      for (const parameter of PARAMETERS) {
        const samples = await WaterSample.findAll({
          where: { samplePoint },
          order: [['sampleTime', 'ASC']],
          raw: true
        });
        
        if (samples.length < rule.threshold) continue;
        
        let continuousCount = 0;
        let continuousStart = null;
        let affectedSampleIds = [];
        
        for (let i = 0; i < samples.length; i++) {
          const sample = samples[i];
          const value = sample[parameter];
          
          if (isOverlimit(parameter, value)) {
            if (continuousCount === 0) {
              continuousStart = sample.sampleTime;
            }
            continuousCount++;
            affectedSampleIds.push(sample.id);
          } else {
            if (continuousCount >= rule.threshold) {
              const existingRisk = await Risk.findOne({
                where: {
                  riskType: 'CONTINUOUS_ANOMALY',
                  samplePoint,
                  affectedParameter: parameter,
                  startTime: continuousStart
                }
              });
              
              if (!existingRisk) {
                const maxDeviation = Math.max(
                  ...affectedSampleIds.map(id => {
                    const s = samples.find(samp => samp.id === id);
                    return getDeviationPercentage(parameter, s[parameter]);
                  })
                );
                
                const risk = await Risk.create({
                  riskType: 'CONTINUOUS_ANOMALY',
                  samplePoint,
                  affectedSampleIds,
                  affectedParameter: parameter,
                  startTime: continuousStart,
                  endTime: samples[i - 1].sampleTime,
                  severity: maxDeviation > 50 ? 'HIGH' : rule.severity,
                  status: 'PENDING',
                  description: `采样点 ${samplePoint} 的${parameter === 'chlorine' ? '余氯' : parameter === 'ph' ? 'pH值' : parameter === 'turbidity' ? '浊度' : '水温'}连续 ${continuousCount} 次超出标准范围`
                });
                risks.push(risk);
              }
            }
            continuousCount = 0;
            continuousStart = null;
            affectedSampleIds = [];
          }
        }
        
        if (continuousCount >= rule.threshold) {
          const existingRisk = await Risk.findOne({
            where: {
              riskType: 'CONTINUOUS_ANOMALY',
              samplePoint,
              affectedParameter: parameter,
              startTime: continuousStart
            }
          });
          
          if (!existingRisk) {
            const maxDeviation = Math.max(
              ...affectedSampleIds.map(id => {
                const s = samples.find(samp => samp.id === id);
                return getDeviationPercentage(parameter, s[parameter]);
              })
            );
            
            const risk = await Risk.create({
              riskType: 'CONTINUOUS_ANOMALY',
              samplePoint,
              affectedSampleIds,
              affectedParameter: parameter,
              startTime: continuousStart,
              endTime: samples[samples.length - 1].sampleTime,
              severity: maxDeviation > 50 ? 'HIGH' : rule.severity,
              status: 'PENDING',
              description: `采样点 ${samplePoint} 的${parameter === 'chlorine' ? '余氯' : parameter === 'ph' ? 'pH值' : parameter === 'turbidity' ? '浊度' : '水温'}连续 ${continuousCount} 次超出标准范围（持续中）`
            });
            risks.push(risk);
          }
        }
      }
    }
    
    return risks;
  }

  static async detectRepeatedOverlimits() {
    const risks = [];
    const rule = RISK_DETECTION_RULES.REPEATED_OVERLIMIT;
    
    console.log('检测反复超标...');
    
    const samplePoints = await WaterSample.findAll({
      attributes: ['samplePoint'],
      group: ['samplePoint'],
      raw: true
    });
    
    for (const { samplePoint } of samplePoints) {
      for (const parameter of PARAMETERS) {
        const now = dayjs();
        const timeWindowStart = now.subtract(rule.timeWindowHours, 'hour').toDate();
        
        const overlimitSamples = await WaterSample.findAll({
          where: {
            samplePoint,
            sampleTime: {
              [Op.gte]: timeWindowStart
            }
          },
          order: [['sampleTime', 'ASC']],
          raw: true
        });
        
        const overlimitCount = overlimitSamples.filter(s => 
          isOverlimit(parameter, s[parameter])
        ).length;
        
        if (overlimitCount >= rule.countThreshold) {
          const affectedSamples = overlimitSamples.filter(s => 
            isOverlimit(parameter, s[parameter])
          );
          const affectedSampleIds = affectedSamples.map(s => s.id);
          
          const existingRisk = await Risk.findOne({
            where: {
              riskType: 'REPEATED_OVERLIMIT',
              samplePoint,
              affectedParameter: parameter,
              startTime: {
                [Op.gte]: timeWindowStart
              }
            }
          });
          
          if (!existingRisk) {
            const maxDeviation = Math.max(
              ...affectedSamples.map(s => getDeviationPercentage(parameter, s[parameter]))
            );
            
            const risk = await Risk.create({
              riskType: 'REPEATED_OVERLIMIT',
              samplePoint,
              affectedSampleIds,
              affectedParameter: parameter,
              startTime: affectedSamples[0].sampleTime,
              endTime: affectedSamples[affectedSamples.length - 1].sampleTime,
              severity: maxDeviation > 50 ? 'CRITICAL' : rule.severity,
              status: 'PENDING',
              description: `采样点 ${samplePoint} 的${parameter === 'chlorine' ? '余氯' : parameter === 'ph' ? 'pH值' : parameter === 'turbidity' ? '浊度' : '水温'}在 ${rule.timeWindowHours} 小时内超标 ${overlimitCount} 次`
            });
            risks.push(risk);
          }
        }
      }
    }
    
    return risks;
  }

  static async detectNoRecoveryAfterTreatment() {
    const risks = [];
    const rule = RISK_DETECTION_RULES.NO_RECOVERY_AFTER_TREATMENT;
    
    console.log('检测补药后未恢复...');
    
    const disposals = await DisposalRecord.findAll({
      where: {
        effectAssessment: 'UNKNOWN'
      },
      include: [{
        model: Risk,
        as: 'risk',
        where: {
          status: {
            [Op.in]: ['PENDING', 'REVIEWING']
          }
        }
      }],
      order: [['disposedAt', 'ASC']]
    });
    
    for (const disposal of disposals) {
      if (!disposal.risk) continue;
      
      const parameter = disposal.risk.affectedParameter;
      const samplePoint = disposal.risk.samplePoint;
      const disposedAt = dayjs(disposal.disposedAt);
      
      const checkStartTime = disposedAt.toDate();
      const checkEndTime = disposedAt.add(rule.checkHours, 'hour').toDate();
      
      const subsequentSamples = await WaterSample.findAll({
        where: {
          samplePoint,
          sampleTime: {
            [Op.between]: [checkStartTime, checkEndTime]
          }
        },
        order: [['sampleTime', 'ASC']],
        raw: true
      });
      
      if (subsequentSamples.length > 0) {
        const allOverlimit = subsequentSamples.every(s => 
          isOverlimit(parameter, s[parameter])
        );
        
        if (allOverlimit) {
          const affectedSampleIds = subsequentSamples.map(s => s.id);
          
          const existingRisk = await Risk.findOne({
            where: {
              riskType: 'NO_RECOVERY_AFTER_TREATMENT',
              samplePoint,
              affectedParameter: parameter,
              startTime: disposedAt.toDate()
            }
          });
          
          if (!existingRisk) {
            const maxDeviation = Math.max(
              ...subsequentSamples.map(s => getDeviationPercentage(parameter, s[parameter]))
            );
            
            const risk = await Risk.create({
              riskType: 'NO_RECOVERY_AFTER_TREATMENT',
              samplePoint,
              affectedSampleIds,
              affectedParameter: parameter,
              startTime: disposedAt.toDate(),
              endTime: subsequentSamples[subsequentSamples.length - 1].sampleTime,
              severity: maxDeviation > 30 ? 'CRITICAL' : rule.severity,
              status: 'PENDING',
              description: `采样点 ${samplePoint} 在执行处置操作后，${parameter === 'chlorine' ? '余氯' : parameter === 'ph' ? 'pH值' : parameter === 'turbidity' ? '浊度' : '水温'}仍未恢复到正常范围`
            });
            risks.push(risk);
          }
        }
      }
    }
    
    return risks;
  }
}

module.exports = RiskDetectionService;
