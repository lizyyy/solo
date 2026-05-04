const SMOKE_THRESHOLD_HIGH = 10.0;
const SMOKE_THRESHOLD_MEDIUM = 5.0;
const EXPOSURE_TIME_LIMIT_SECONDS = 1800;
const EXHAUST_FLOW_MIN = 0.1;

class RiskDetector {
  constructor(db) {
    this.db = db;
  }

  async detectRisksForShift(date, shiftType) {
    const shiftResult = this.db.db.exec(
      'SELECT id FROM shifts WHERE date = ? AND shift_type = ?',
      [date, shiftType]
    );

    if (shiftResult.length === 0 || shiftResult[0].values.length === 0) {
      return { risks: [], summary: { 红色: 0, 黄色: 0, 绿色: 0 } };
    }

    const shiftId = shiftResult[0].values[0][0];
    
    const existingRisks = this.db.getRisksForShift(shiftId);
    if (existingRisks.length > 0) {
      return this.formatRiskResult(existingRisks);
    }

    const weldingRecords = this.db.getWeldingRecordsForShift(shiftId);
    const exhaustData = this.db.getExhaustDataForShift(shiftId);
    const schedule = this.db.getEmployeeScheduleForShift(shiftId);
    const inspections = this.db.getHelmetInspectionsForShift(shiftId);

    const risks = [];

    risks.push(...this.detectSmokeExposureRisks(exhaustData, weldingRecords, shiftId));
    risks.push(...this.detectExhaustFailureRisks(exhaustData, weldingRecords, shiftId));
    risks.push(...this.detectCrossStationExposureRisks(schedule, weldingRecords, exhaustData, shiftId));
    risks.push(...this.detectHelmetInspectionRisks(inspections, shiftId));

    risks.forEach(risk => {
      this.db.addRisk(
        shiftId,
        risk.risk_type,
        risk.risk_level,
        risk.station_id,
        risk.employee_name,
        risk.start_time,
        risk.end_time,
        risk.description,
        risk.smoke_level,
        risk.exhaust_flow
      );
    });

    const allRisks = this.db.getRisksForShift(shiftId);
    return this.formatRiskResult(allRisks);
  }

  formatRiskResult(risks) {
    const summary = { 红色: 0, 黄色: 0, 绿色: 0 };
    risks.forEach(r => {
      if (summary[r.risk_level] !== undefined) {
        summary[r.risk_level]++;
      }
    });

    return {
      risks,
      summary
    };
  }

  detectSmokeExposureRisks(exhaustData, weldingRecords, shiftId) {
    const risks = [];
    const stationData = this.groupByStation(exhaustData);

    Object.keys(stationData).forEach(stationId => {
      const dataPoints = stationData[stationId].sort((a, b) => 
        new Date(a.timestamp) - new Date(b.timestamp)
      );

      let exposureStartTime = null;
      let maxSmokeLevel = 0;
      let totalExposureSeconds = 0;

      dataPoints.forEach((point, index) => {
        const smokeLevel = parseFloat(point.smoke_level) || 0;
        const currentTime = new Date(point.timestamp);

        if (smokeLevel >= SMOKE_THRESHOLD_MEDIUM) {
          if (!exposureStartTime) {
            exposureStartTime = currentTime;
          }
          
          if (smokeLevel > maxSmokeLevel) {
            maxSmokeLevel = smokeLevel;
          }

          if (index < dataPoints.length - 1) {
            const nextPoint = dataPoints[index + 1];
            const duration = (new Date(nextPoint.timestamp) - currentTime) / 1000;
            totalExposureSeconds += duration;
          }

          if (totalExposureSeconds >= EXPOSURE_TIME_LIMIT_SECONDS) {
            const riskLevel = maxSmokeLevel >= SMOKE_THRESHOLD_HIGH ? '红色' : '黄色';
            risks.push({
              risk_type: '烟尘暴露超时',
              risk_level: riskLevel,
              station_id: stationId,
              start_time: exposureStartTime.toISOString(),
              end_time: currentTime.toISOString(),
              duration_seconds: Math.floor(totalExposureSeconds),
              smoke_level: maxSmokeLevel,
              description: `工位 ${stationId} 烟尘暴露超时，累计 ${Math.floor(totalExposureSeconds / 60)} 分钟，最高浓度 ${maxSmokeLevel.toFixed(1)} mg/m³`
            });
            exposureStartTime = null;
            totalExposureSeconds = 0;
            maxSmokeLevel = 0;
          }
        } else {
          if (exposureStartTime && totalExposureSeconds > 60) {
            const riskLevel = maxSmokeLevel >= SMOKE_THRESHOLD_HIGH ? '黄色' : '绿色';
            risks.push({
              risk_type: '烟尘暴露超时',
              risk_level: riskLevel,
              station_id: stationId,
              start_time: exposureStartTime.toISOString(),
              end_time: currentTime.toISOString(),
              duration_seconds: Math.floor(totalExposureSeconds),
              smoke_level: maxSmokeLevel,
              description: `工位 ${stationId} 烟尘暴露，累计 ${Math.floor(totalExposureSeconds / 60)} 分钟，最高浓度 ${maxSmokeLevel.toFixed(1)} mg/m³`
            });
          }
          exposureStartTime = null;
          totalExposureSeconds = 0;
          maxSmokeLevel = 0;
        }
      });
    });

    return risks;
  }

  detectExhaustFailureRisks(exhaustData, weldingRecords, shiftId) {
    const risks = [];
    const stationData = this.groupByStation(exhaustData);
    const stationWelding = this.groupByStation(weldingRecords, 'station_id');

    Object.keys(stationData).forEach(stationId => {
      const dataPoints = stationData[stationId].sort((a, b) => 
        new Date(a.timestamp) - new Date(b.timestamp)
      );

      const stationRecords = stationWelding[stationId] || [];

      dataPoints.forEach(point => {
        const timestamp = new Date(point.timestamp);
        const exhaustFlow = parseFloat(point.exhaust_flow) || 0;
        const isExhaustActive = point.is_exhaust_active === 1 || point.is_exhaust_active === true;

        const isWeldingActive = stationRecords.some(record => {
          const startTime = new Date(record.start_time);
          const endTime = record.end_time ? new Date(record.end_time) : new Date(startTime.getTime() + 3600000);
          return timestamp >= startTime && timestamp <= endTime;
        });

        if (isWeldingActive && (!isExhaustActive || exhaustFlow < EXHAUST_FLOW_MIN)) {
          risks.push({
            risk_type: '排风失效开焊',
            risk_level: '红色',
            station_id: stationId,
            start_time: timestamp.toISOString(),
            end_time: timestamp.toISOString(),
            exhaust_flow: exhaustFlow,
            description: `工位 ${stationId} 在焊接期间排风系统失效，排风流量 ${exhaustFlow.toFixed(2)} m³/min`
          });
        }
      });
    });

    const uniqueRisks = this.deduplicateRisks(risks, '排风失效开焊');
    return uniqueRisks;
  }

  detectCrossStationExposureRisks(schedule, weldingRecords, exhaustData, shiftId) {
    const risks = [];
    
    const employeeStations = {};
    schedule.forEach(item => {
      if (!employeeStations[item.employee_name]) {
        employeeStations[item.employee_name] = [];
      }
      employeeStations[item.employee_name].push({
        station_id: item.station_id,
        start_time: item.start_time,
        end_time: item.end_time
      });
    });

    const stationExhaust = this.groupByStation(exhaustData);

    Object.keys(employeeStations).forEach(employeeName => {
      const stations = employeeStations[employeeName];
      
      if (stations.length > 1) {
        let totalExposureSeconds = 0;
        let maxSmokeLevel = 0;
        const affectedStations = [];

        stations.forEach(stationAssignment => {
          const stationData = stationExhaust[stationAssignment.station_id] || [];
          
          stationData.forEach(point => {
            const pointTime = new Date(point.timestamp);
            const startTime = new Date(stationAssignment.start_time);
            const endTime = new Date(stationAssignment.end_time);

            if (pointTime >= startTime && pointTime <= endTime) {
              const smokeLevel = parseFloat(point.smoke_level) || 0;
              if (smokeLevel >= SMOKE_THRESHOLD_MEDIUM) {
                totalExposureSeconds += 60;
                if (smokeLevel > maxSmokeLevel) {
                  maxSmokeLevel = smokeLevel;
                }
                if (!affectedStations.includes(stationAssignment.station_id)) {
                  affectedStations.push(stationAssignment.station_id);
                }
              }
            }
          });
        });

        if (totalExposureSeconds >= EXPOSURE_TIME_LIMIT_SECONDS) {
          const riskLevel = maxSmokeLevel >= SMOKE_THRESHOLD_HIGH ? '红色' : '黄色';
          risks.push({
            risk_type: '跨工位累计超标',
            risk_level: riskLevel,
            employee_name: employeeName,
            start_time: stations[0].start_time,
            end_time: stations[stations.length - 1].end_time,
            duration_seconds: Math.floor(totalExposureSeconds),
            smoke_level: maxSmokeLevel,
            description: `员工 ${employeeName} 跨工位 ${affectedStations.join('、')} 累计烟尘暴露 ${Math.floor(totalExposureSeconds / 60)} 分钟，最高浓度 ${maxSmokeLevel.toFixed(1)} mg/m³`
          });
        } else if (totalExposureSeconds > 600) {
          risks.push({
            risk_type: '跨工位累计超标',
            risk_level: '绿色',
            employee_name: employeeName,
            start_time: stations[0].start_time,
            end_time: stations[stations.length - 1].end_time,
            duration_seconds: Math.floor(totalExposureSeconds),
            smoke_level: maxSmokeLevel,
            description: `员工 ${employeeName} 跨工位 ${affectedStations.join('、')} 累计烟尘暴露 ${Math.floor(totalExposureSeconds / 60)} 分钟，需关注`
          });
        }
      }
    });

    return risks;
  }

  detectHelmetInspectionRisks(inspections, shiftId) {
    const risks = [];

    inspections.forEach(inspection => {
      const isHelmetProvided = inspection.is_helmet_provided === 1 || inspection.is_helmet_provided === true;
      const isFilterValid = inspection.is_filter_valid === 1 || inspection.is_filter_valid === true;

      if (!isHelmetProvided) {
        risks.push({
          risk_type: '防护面罩缺失',
          risk_level: '红色',
          employee_name: inspection.employee_name,
          start_time: inspection.inspection_time,
          end_time: inspection.inspection_time,
          description: `员工 ${inspection.employee_name} 未配备防护面罩`
        });
      } else if (!isFilterValid) {
        risks.push({
          risk_type: '滤片失效',
          risk_level: '黄色',
          employee_name: inspection.employee_name,
          start_time: inspection.inspection_time,
          end_time: inspection.inspection_time,
          description: `员工 ${inspection.employee_name} 的防护面罩滤片已失效`
        });
      }
    });

    return risks;
  }

  groupByStation(data, key = 'station_id') {
    const groups = {};
    data.forEach(item => {
      const stationId = item[key] || item['station_id'] || item['工位'];
      if (!groups[stationId]) {
        groups[stationId] = [];
      }
      groups[stationId].push(item);
    });
    return groups;
  }

  deduplicateRisks(risks, riskType) {
    const uniqueKey = {};
    const uniqueRisks = [];

    risks.forEach(risk => {
      if (risk.risk_type !== riskType) {
        uniqueRisks.push(risk);
        return;
      }

      const key = `${risk.station_id}-${risk.start_time.substring(0, 13)}`;
      if (!uniqueKey[key]) {
        uniqueKey[key] = true;
        uniqueRisks.push(risk);
      }
    });

    return uniqueRisks;
  }
}

module.exports = { RiskDetector };
