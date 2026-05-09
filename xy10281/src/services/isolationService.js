const { v4: uuidv4 } = require('uuid');
const FishGroupDao = require('../daos/fishGroupDao');
const TankDao = require('../daos/tankDao');
const IsolationRuleDao = require('../daos/isolationRuleDao');
const QuarantineSessionDao = require('../daos/quarantineSessionDao');
const TreatmentRecordDao = require('../daos/treatmentRecordDao');
const RiskReportDao = require('../daos/riskReportDao');
const TransferTransactionDao = require('../daos/transferTransactionDao');

class IsolationService {
  static checkWaterCompatibility(tank, rule) {
    const issues = [];
    
    if (rule.min_ph !== null && tank.water_ph < rule.min_ph) {
      issues.push(`pH 值 ${tank.water_ph} 低于最低要求 ${rule.min_ph}`);
    }
    if (rule.max_ph !== null && tank.water_ph > rule.max_ph) {
      issues.push(`pH 值 ${tank.water_ph} 高于最高要求 ${rule.max_ph}`);
    }
    if (rule.min_temperature !== null && tank.water_temperature < rule.min_temperature) {
      issues.push(`水温 ${tank.water_temperature}°C 低于最低要求 ${rule.min_temperature}°C`);
    }
    if (rule.max_temperature !== null && tank.water_temperature > rule.max_temperature) {
      issues.push(`水温 ${tank.water_temperature}°C 高于最高要求 ${rule.max_temperature}°C`);
    }
    if (rule.min_quality_score !== null && tank.water_quality_score < rule.min_quality_score) {
      issues.push(`水质评分 ${tank.water_quality_score} 低于最低要求 ${rule.min_quality_score}`);
    }
    
    return {
      compatible: issues.length === 0,
      issues
    };
  }

  static findSuitableTank(rule, requiredCount) {
    return new Promise(async (resolve, reject) => {
      try {
        const availableTanks = await TankDao.findAvailableQuarantineTanks(
          rule.required_tank_type,
          {
            minPh: rule.min_ph,
            maxPh: rule.max_ph,
            minTemperature: rule.min_temperature,
            maxTemperature: rule.max_temperature,
            minQualityScore: rule.min_quality_score
          }
        );
        
        const suitableTanks = availableTanks.filter(tank => {
          const remainingCapacity = tank.capacity - tank.current_occupancy;
          return remainingCapacity >= requiredCount;
        });
        
        if (suitableTanks.length === 0) {
          resolve(null);
        } else {
          suitableTanks.sort((a, b) => (b.capacity - b.current_occupancy) - (a.capacity - a.current_occupancy));
          resolve(suitableTanks[0]);
        }
      } catch (err) {
        reject(err);
      }
    });
  }

  static createIsolationRequest(requestData) {
    return new Promise(async (resolve, reject) => {
      try {
        const { fishGroupId, disease, affectedCount = 0, operator } = requestData;
        
        const fishGroup = await FishGroupDao.getById(fishGroupId);
        if (!fishGroup) {
          return reject(new Error('鱼群不存在'));
        }

        const activeSession = await QuarantineSessionDao.getActiveByFishGroupId(fishGroupId);
        if (activeSession) {
          return reject(new Error('该鱼群已有活跃的隔离会话'));
        }

        const rule = await IsolationRuleDao.getByDisease(disease);
        if (!rule) {
          return reject(new Error(`未找到疾病 "${disease}" 的隔离规则`));
        }

        if (rule.affected_species && rule.affected_species !== fishGroup.species) {
          return reject(new Error(`该疾病规则不适用于鱼种 "${fishGroup.species}"`));
        }

        const suitableTank = await this.findSuitableTank(rule, fishGroup.count);
        if (!suitableTank) {
          return reject(new Error('没有找到符合水质和容量要求的隔离缸体'));
        }

        const sessionId = uuidv4();
        const today = new Date().toISOString().split('T')[0];
        const plannedEndDate = new Date();
        plannedEndDate.setDate(plannedEndDate.getDate() + rule.quarantine_days);

        const treatmentId = uuidv4();
        const transferId = uuidv4();
        const riskReportId = uuidv4();

        const quarantineSession = await QuarantineSessionDao.create({
          id: sessionId,
          fishGroupId: fishGroupId,
          tankId: suitableTank.id,
          startDate: today,
          plannedEndDate: plannedEndDate.toISOString().split('T')[0],
          disease: disease,
          ruleId: rule.id
        });

        await TreatmentRecordDao.create({
          id: treatmentId,
          fishGroupId: fishGroupId,
          tankId: suitableTank.id,
          disease: disease,
          treatmentPlan: `根据隔离规则 ${rule.id} 进行治疗`,
          startDate: today,
          status: 'in_progress',
          createdBy: operator
        });

        const transferReason = `疾病隔离 - ${disease}`;
        await TransferTransactionDao.create({
          id: transferId,
          fishGroupId: fishGroupId,
          fromTankId: fishGroup.tank_id,
          toTankId: suitableTank.id,
          transferCount: fishGroup.count,
          reason: transferReason,
          status: 'in_progress',
          executedAt: new Date().toISOString(),
          operator: operator
        });

        const riskLevel = affectedCount > fishGroup.count * 0.5 ? 'critical' : 
                          affectedCount > fishGroup.count * 0.2 ? 'high' : 
                          affectedCount > 0 ? 'medium' : 'low';
        const riskScore = affectedCount > fishGroup.count * 0.5 ? 90 :
                          affectedCount > fishGroup.count * 0.2 ? 70 :
                          affectedCount > 0 ? 40 : 10;
        
        await RiskReportDao.create({
          id: riskReportId,
          fishGroupId: fishGroupId,
          disease: disease,
          riskLevel: riskLevel,
          riskScore: riskScore,
          assessmentDate: today,
          affectedCount: affectedCount,
          spreadRisk: `规则优先级: ${rule.priority}`,
          recommendations: `已安排隔离治疗，隔离天数: ${rule.quarantine_days} 天`
        });

        await TankDao.updateOccupancy(suitableTank.id, fishGroup.count);
        if (fishGroup.tank_id) {
          await TankDao.updateOccupancy(fishGroup.tank_id, -fishGroup.count);
        }

        await FishGroupDao.update(fishGroupId, {
          tankId: suitableTank.id,
          healthStatus: 'sick',
          quarantineStatus: 'isolated'
        });

        resolve({
          success: true,
          message: '隔离请求已创建并执行',
          session: quarantineSession,
          tank: suitableTank,
          rule: rule,
          treatmentId: treatmentId,
          transferId: transferId,
          riskReportId: riskReportId,
          waterCompatibility: {
            compatible: true,
            tank: {
              name: suitableTank.name,
              ph: suitableTank.water_ph,
              temperature: suitableTank.water_temperature,
              qualityScore: suitableTank.water_quality_score
            },
            requirements: {
              minPh: rule.min_ph,
              maxPh: rule.max_ph,
              minTemperature: rule.min_temperature,
              maxTemperature: rule.max_temperature,
              minQualityScore: rule.min_quality_score
            }
          }
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  static advanceIsolation(sessionId, operator) {
    return new Promise(async (resolve, reject) => {
      try {
        const session = await QuarantineSessionDao.getById(sessionId);
        if (!session) {
          return reject(new Error('隔离会话不存在'));
        }
        if (session.status !== 'active') {
          return reject(new Error('只能推进活跃状态的隔离会话'));
        }

        const treatments = await TreatmentRecordDao.getByFishGroupId(session.fish_group_id);
        const activeTreatment = treatments.find(t => t.status === 'in_progress' || t.status === 'pending');
        
        if (activeTreatment) {
          if (activeTreatment.status === 'pending') {
            await TreatmentRecordDao.update(activeTreatment.id, { status: 'in_progress' });
            resolve({
              success: true,
              message: '治疗计划已开始执行',
              sessionStatus: session.status,
              treatmentStatus: 'in_progress',
              operator: operator
            });
          } else {
            const transfers = await TransferTransactionDao.getByFishGroupId(session.fish_group_id);
            const latestTransfer = transfers[0];
            
            if (latestTransfer && latestTransfer.status === 'in_progress') {
              await TransferTransactionDao.updateStatus(latestTransfer.id, 'completed', new Date().toISOString());
            }

            resolve({
              success: true,
              message: '隔离治疗进行中，转缸事务已确认完成',
              sessionStatus: session.status,
              treatmentStatus: 'in_progress',
              operator: operator
            });
          }
        } else {
          resolve({
            success: false,
            message: '没有找到活跃的治疗记录',
            sessionStatus: session.status
          });
        }
      } catch (err) {
        reject(err);
      }
    });
  }

  static withdrawIsolation(sessionId, reason, operator) {
    return new Promise(async (resolve, reject) => {
      try {
        const session = await QuarantineSessionDao.getById(sessionId);
        if (!session) {
          return reject(new Error('隔离会话不存在'));
        }
        if (session.status !== 'active') {
          return reject(new Error('只能撤回活跃状态的隔离会话'));
        }

        const fishGroup = await FishGroupDao.getById(session.fish_group_id);
        const originalTankId = fishGroup.tank_id;

        const transfers = await TransferTransactionDao.getByFishGroupId(session.fish_group_id);
        const isolationTransfer = transfers.find(t => 
          t.to_tank_id === session.tank_id && t.status === 'completed'
        );

        if (isolationTransfer && isolationTransfer.from_tank_id) {
          const originalTank = await TankDao.getById(isolationTransfer.from_tank_id);
          const remainingCapacity = originalTank.capacity - originalTank.current_occupancy;
          
          if (remainingCapacity < fishGroup.count) {
            return reject(new Error('原缸体容量不足，无法撤回'));
          }

          const returnTransferId = uuidv4();
          await TransferTransactionDao.create({
            id: returnTransferId,
            fishGroupId: session.fish_group_id,
            fromTankId: session.tank_id,
            toTankId: isolationTransfer.from_tank_id,
            transferCount: fishGroup.count,
            reason: `撤回隔离: ${reason}`,
            status: 'completed',
            executedAt: new Date().toISOString(),
            operator: operator
          });

          await TankDao.updateOccupancy(session.tank_id, -fishGroup.count);
          await TankDao.updateOccupancy(isolationTransfer.from_tank_id, fishGroup.count);
          
          await FishGroupDao.update(session.fish_group_id, {
            tankId: isolationTransfer.from_tank_id,
            healthStatus: 'healthy',
            quarantineStatus: 'none'
          });
        } else {
          await TankDao.updateOccupancy(session.tank_id, -fishGroup.count);
          await FishGroupDao.update(session.fish_group_id, {
            tankId: null,
            healthStatus: 'healthy',
            quarantineStatus: 'none'
          });
        }

        await QuarantineSessionDao.cancel(sessionId);

        const treatments = await TreatmentRecordDao.getByFishGroupId(session.fish_group_id);
        const activeTreatment = treatments.find(t => t.status === 'in_progress' || t.status === 'pending');
        if (activeTreatment) {
          await TreatmentRecordDao.update(activeTreatment.id, { 
            status: 'cancelled',
            notes: `隔离被撤回，原因: ${reason}`
          });
        }

        const pendingReports = await RiskReportDao.getByFishGroupId(session.fish_group_id, false);
        for (const report of pendingReports) {
          await RiskReportDao.resolve(report.id);
        }

        resolve({
          success: true,
          message: '隔离已撤回，鱼群已返回原缸体',
          sessionStatus: 'cancelled',
          operator: operator,
          reason: reason
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  static completeIsolation(sessionId, operator) {
    return new Promise(async (resolve, reject) => {
      try {
        const session = await QuarantineSessionDao.getById(sessionId);
        if (!session) {
          return reject(new Error('隔离会话不存在'));
        }
        if (session.status !== 'active') {
          return reject(new Error('只能完成活跃状态的隔离会话'));
        }

        await QuarantineSessionDao.complete(sessionId);

        const fishGroup = await FishGroupDao.getById(session.fish_group_id);
        
        const treatments = await TreatmentRecordDao.getByFishGroupId(session.fish_group_id);
        const activeTreatment = treatments.find(t => t.status === 'in_progress');
        if (activeTreatment) {
          await TreatmentRecordDao.update(activeTreatment.id, { 
            status: 'completed',
            endDate: new Date().toISOString().split('T')[0]
          });
        }

        const pendingReports = await RiskReportDao.getByFishGroupId(session.fish_group_id, false);
        for (const report of pendingReports) {
          await RiskReportDao.resolve(report.id);
        }

        await FishGroupDao.update(session.fish_group_id, {
          healthStatus: 'recovered',
          quarantineStatus: 'completed'
        });

        resolve({
          success: true,
          message: '隔离治疗已完成',
          sessionStatus: 'completed',
          operator: operator,
          fishGroupStatus: 'recovered'
        });
      } catch (err) {
        reject(err);
      }
    });
  }
}

module.exports = IsolationService;
