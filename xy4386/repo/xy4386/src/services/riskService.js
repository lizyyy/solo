const { v4: uuidv4 } = require('uuid');
const dayjs = require('dayjs');
const store = require('../data/store');
const config = require('../config');
const { 
  validatePersonnelQualification, 
  validateTemperature, 
  validateHumidity, 
  validateOxygenLevel 
} = require('../utils/validator');

const RISK_TYPES = {
  OXYGEN_RECOVERY_INSUFFICIENT: 'oxygen_recovery_insufficient',
  TEMPERATURE_HUMIDITY_OUT_OF_BOUNDS: 'temperature_humidity_out_of_bounds',
  ACCESS_CONTROL_REPAIR_NOT_CLOSED: 'access_control_repair_not_closed',
  DUPLICATE_RACK_RETRIEVAL: 'duplicate_rack_retrieval',
  PERSONNEL_QUALIFICATION_MISMATCH: 'personnel_qualification_mismatch'
};

const RISK_SEVERITY = {
  CRITICAL: 'critical',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low'
};

class RiskService {
  constructor() {
    this.riskTypes = RISK_TYPES;
    this.riskSeverity = RISK_SEVERITY;
  }

  createRisk(type, severity, warehouseId, description, details = {}) {
    return {
      riskId: uuidv4(),
      type,
      severity,
      warehouseId,
      description,
      details,
      status: 'pending',
      detectedAt: dayjs().toISOString(),
      reviewedAt: null,
      reviewDecision: null,
      reviewComments: null
    };
  }

  checkOxygenRecovery(warehouse, timeWindowHours = config.risk.oxygen.recoveryTimeWindow) {
    const risks = [];
    const { measurements, warehouseId, warehouseName } = warehouse;
    
    if (!measurements || measurements.length === 0) {
      return risks;
    }

    const sortedMeasurements = [...measurements].sort((a, b) => 
      dayjs(a.timestamp).valueOf() - dayjs(b.timestamp).valueOf()
    );

    const latestMeasurement = sortedMeasurements[sortedMeasurements.length - 1];
    const latestOxygen = latestMeasurement.oxygen;
    const recoveryThreshold = config.risk.oxygen.recoveryThreshold;
    const minAcceptableValue = config.risk.oxygen.minAcceptableValue;

    const recentMeasurements = sortedMeasurements.filter(m => {
      const measurementTime = dayjs(m.timestamp);
      const latestTime = dayjs(latestMeasurement.timestamp);
      return latestTime.diff(measurementTime, 'hour') <= timeWindowHours;
    });

    const oxygenLevels = recentMeasurements.map(m => m.oxygen);
    const minOxygen = Math.min(...oxygenLevels);
    const maxOxygen = Math.max(...oxygenLevels);
    const avgOxygen = oxygenLevels.reduce((a, b) => a + b, 0) / oxygenLevels.length;

    if (latestOxygen < recoveryThreshold) {
      const recoveryGap = recoveryThreshold - latestOxygen;
      const details = {
        latestOxygen,
        recoveryThreshold,
        minOxygen,
        maxOxygen,
        avgOxygen,
        timeWindowHours,
        measurementsCount: recentMeasurements.length,
        latestTimestamp: latestMeasurement.timestamp
      };

      let severity = RISK_SEVERITY.MEDIUM;
      if (latestOxygen < minAcceptableValue) {
        severity = RISK_SEVERITY.CRITICAL;
      } else if (recoveryGap > 2) {
        severity = RISK_SEVERITY.HIGH;
      }

      const risk = this.createRisk(
        RISK_TYPES.OXYGEN_RECOVERY_INSUFFICIENT,
        severity,
        warehouseId,
        `库房 [${warehouseName}] 氧浓度回升不足，当前氧浓度 ${latestOxygen}%，目标阈值 ${recoveryThreshold}%`,
        details
      );

      risks.push(risk);
    }

    return risks;
  }

  checkTemperatureHumidity(warehouse) {
    const risks = [];
    const { measurements, warehouseId, warehouseName } = warehouse;
    
    if (!measurements || measurements.length === 0) {
      return risks;
    }

    const tempMin = config.risk.temperature.min;
    const tempMax = config.risk.temperature.max;
    const humidityMin = config.risk.humidity.min;
    const humidityMax = config.risk.humidity.max;

    const outOfBoundsMeasurements = measurements.filter(m => {
      const tempOk = m.temperature >= tempMin && m.temperature <= tempMax;
      const humidityOk = m.humidity >= humidityMin && m.humidity <= humidityMax;
      return !tempOk || !humidityOk;
    });

    if (outOfBoundsMeasurements.length > 0) {
      const recentOutOfBounds = outOfBoundsMeasurements
        .sort((a, b) => dayjs(b.timestamp).valueOf() - dayjs(a.timestamp).valueOf())
        .slice(0, 5);

      const tempViolations = measurements.filter(m => 
        m.temperature < tempMin || m.temperature > tempMax
      ).length;

      const humidityViolations = measurements.filter(m => 
        m.humidity < humidityMin || m.humidity > humidityMax
      ).length;

      const details = {
        tempMin,
        tempMax,
        humidityMin,
        humidityMax,
        totalViolations: outOfBoundsMeasurements.length,
        tempViolations,
        humidityViolations,
        recentViolations: recentOutOfBounds.map(m => ({
          timestamp: m.timestamp,
          temperature: m.temperature,
          humidity: m.humidity,
          tempOutOfBounds: m.temperature < tempMin || m.temperature > tempMax,
          humidityOutOfBounds: m.humidity < humidityMin || m.humidity > humidityMax
        }))
      };

      let severity = RISK_SEVERITY.MEDIUM;
      if (outOfBoundsMeasurements.length > measurements.length * 0.5) {
        severity = RISK_SEVERITY.HIGH;
      }
      if (recentOutOfBounds.length > 0) {
        const latest = recentOutOfBounds[0];
        if (latest.temperature < tempMin - 2 || latest.temperature > tempMax + 2) {
          severity = RISK_SEVERITY.HIGH;
        }
        if (latest.humidity < humidityMin - 5 || latest.humidity > humidityMax + 5) {
          severity = RISK_SEVERITY.HIGH;
        }
      }

      const risk = this.createRisk(
        RISK_TYPES.TEMPERATURE_HUMIDITY_OUT_OF_BOUNDS,
        severity,
        warehouseId,
        `库房 [${warehouseName}] 温湿度越界，共 ${outOfBoundsMeasurements.length} 条记录超出正常范围`,
        details
      );

      risks.push(risk);
    }

    return risks;
  }

  checkAccessControlRepairs(warehouse) {
    const risks = [];
    const { repairs = [], warehouseId, warehouseName } = warehouse;
    
    if (!repairs || repairs.length === 0) {
      return risks;
    }

    const openRepairs = repairs.filter(r => r.status !== 'closed');

    if (openRepairs.length > 0) {
      openRepairs.forEach(repair => {
        const details = {
          repairId: repair.repairId,
          repairDate: repair.repairDate,
          description: repair.description,
          status: repair.status,
          assignee: repair.assignee,
          closedDate: repair.closedDate,
          daysOpen: repair.repairDate ? 
            dayjs().diff(dayjs(repair.repairDate), 'day') : null
        };

        let severity = RISK_SEVERITY.MEDIUM;
        if (details.daysOpen > 7) {
          severity = RISK_SEVERITY.HIGH;
        }
        if (details.daysOpen > 14) {
          severity = RISK_SEVERITY.CRITICAL;
        }

        const risk = this.createRisk(
          RISK_TYPES.ACCESS_CONTROL_REPAIR_NOT_CLOSED,
          severity,
          warehouseId,
          `库房 [${warehouseName}] 门禁维修未闭环，维修单号 [${repair.repairId}] 状态为 [${repair.status}]`,
          details
        );

        risks.push(risk);
      });
    }

    return risks;
  }

  checkDuplicateRackRetrieval(date) {
    const risks = [];
    const tasks = date ? store.getTasksByDate(date) : store.getAllTasks();

    if (!tasks || tasks.length === 0) {
      return risks;
    }

    const rackTaskMap = {};
    tasks.forEach(task => {
      const key = `${task.warehouseId}-${task.rackId}`;
      if (!rackTaskMap[key]) {
        rackTaskMap[key] = [];
      }
      rackTaskMap[key].push(task);
    });

    for (const [key, taskList] of Object.entries(rackTaskMap)) {
      if (taskList.length > 1) {
        const [warehouseId, rackId] = key.split('-');
        const warehouse = store.getWarehouse(warehouseId);
        const warehouseName = warehouse ? warehouse.warehouseName : warehouseId;

        const details = {
          rackId,
          taskCount: taskList.length,
          tasks: taskList.map(t => ({
            taskId: t.taskId,
            date: t.date,
            personnel: t.personnel
          }))
        };

        let severity = RISK_SEVERITY.MEDIUM;
        if (taskList.length > 2) {
          severity = RISK_SEVERITY.HIGH;
        }

        const risk = this.createRisk(
          RISK_TYPES.DUPLICATE_RACK_RETRIEVAL,
          severity,
          warehouseId,
          `库房 [${warehouseName}] 密集架 [${rackId}] 存在重复调阅任务，共 ${taskList.length} 个任务`,
          details
        );

        risks.push(risk);
      }
    }

    return risks;
  }

  checkPersonnelQualification() {
    const risks = [];
    const tasks = store.getAllTasks();

    if (!tasks || tasks.length === 0) {
      return risks;
    }

    tasks.forEach(task => {
      const invalidPersonnel = task.personnel.filter(p => 
        !validatePersonnelQualification(p.qualification)
      );

      if (invalidPersonnel.length > 0) {
        const warehouse = store.getWarehouse(task.warehouseId);
        const warehouseName = warehouse ? warehouse.warehouseName : task.warehouseId;

        const details = {
          taskId: task.taskId,
          rackId: task.rackId,
          date: task.date,
          invalidPersonnel: invalidPersonnel.map(p => ({
            id: p.id,
            name: p.name,
            qualification: p.qualification
          })),
          validQualifications: config.personnel.validQualifications
        };

        let severity = RISK_SEVERITY.MEDIUM;
        if (invalidPersonnel.length >= task.personnel.length * 0.5) {
          severity = RISK_SEVERITY.HIGH;
        }

        const risk = this.createRisk(
          RISK_TYPES.PERSONNEL_QUALIFICATION_MISMATCH,
          severity,
          task.warehouseId,
          `库房 [${warehouseName}] 调阅任务 [${task.taskId}] 存在人员资质不匹配，共 ${invalidPersonnel.length} 人`,
          details
        );

        risks.push(risk);
      }
    });

    return risks;
  }

  async runAllChecks(date = null) {
    const allRisks = [];
    const warehouses = store.getAllWarehouses();

    for (const warehouse of warehouses) {
      const oxygenRisks = this.checkOxygenRecovery(warehouse);
      const tempHumidityRisks = this.checkTemperatureHumidity(warehouse);
      const repairRisks = this.checkAccessControlRepairs(warehouse);

      allRisks.push(...oxygenRisks, ...tempHumidityRisks, ...repairRisks);
    }

    const duplicateRisks = this.checkDuplicateRackRetrieval(date);
    const qualificationRisks = this.checkPersonnelQualification();

    allRisks.push(...duplicateRisks, ...qualificationRisks);

    store.saveRisks(allRisks);

    return {
      total: allRisks.length,
      byType: {
        oxygenRecoveryInsufficient: allRisks.filter(r => r.type === RISK_TYPES.OXYGEN_RECOVERY_INSUFFICIENT).length,
        temperatureHumidityOutOfBounds: allRisks.filter(r => r.type === RISK_TYPES.TEMPERATURE_HUMIDITY_OUT_OF_BOUNDS).length,
        accessControlRepairNotClosed: allRisks.filter(r => r.type === RISK_TYPES.ACCESS_CONTROL_REPAIR_NOT_CLOSED).length,
        duplicateRackRetrieval: allRisks.filter(r => r.type === RISK_TYPES.DUPLICATE_RACK_RETRIEVAL).length,
        personnelQualificationMismatch: allRisks.filter(r => r.type === RISK_TYPES.PERSONNEL_QUALIFICATION_MISMATCH).length
      },
      bySeverity: {
        critical: allRisks.filter(r => r.severity === RISK_SEVERITY.CRITICAL).length,
        high: allRisks.filter(r => r.severity === RISK_SEVERITY.HIGH).length,
        medium: allRisks.filter(r => r.severity === RISK_SEVERITY.MEDIUM).length,
        low: allRisks.filter(r => r.severity === RISK_SEVERITY.LOW).length
      },
      risks: allRisks
    };
  }

  getAllRisks() {
    return store.getAllRisks();
  }

  getRisksByType(type) {
    return store.getRisksByType(type);
  }

  getRisksByWarehouse(warehouseId) {
    return store.getRisksByWarehouse(warehouseId);
  }

  getRiskById(riskId) {
    const risks = store.getAllRisks();
    return risks.find(r => r.riskId === riskId) || null;
  }
}

module.exports = new RiskService();
