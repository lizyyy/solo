class DataAnalyzer {
  constructor() {
    this.config = {
      dissolvedOxygen: {
        min: 0.5,
        max: 2.5,
        unit: 'mg/L'
      },
      ammoniaNitrogen: {
        max: 2.0,
        unit: 'mg/L'
      },
      blower: {
        powerThreshold: 120,
        frequencyThreshold: 45
      },
      pump: {
        minFlowRate: 50,
        unit: 'm³/h'
      },
      lab: {
        allowedDeviation: 0.3
      }
    };
  }

  analyzeAll(date, scadaData, blowerData, pumpData, labData) {
    const risks = [];
    const summary = {
      date,
      totalRecords: 0,
      risks: {
        over_aeration: 0,
        hypoxia: 0,
        pump_anomaly: 0,
        lab_mismatch: 0
      }
    };

    if (scadaData && scadaData.length > 0) {
      const scadaRisks = this.analyzeScadaData(scadaData);
      risks.push(...scadaRisks);
      summary.risks.over_aeration = scadaRisks.filter(r => r.type === 'over_aeration').length;
      summary.risks.hypoxia = scadaRisks.filter(r => r.type === 'hypoxia').length;
    }

    if (blowerData && blowerData.length > 0) {
      const blowerRisks = this.analyzeBlowerData(blowerData, scadaData);
      risks.push(...blowerRisks);
      summary.risks.over_aeration += blowerRisks.filter(r => r.type === 'over_aeration').length;
    }

    if (pumpData && pumpData.length > 0) {
      const pumpRisks = this.analyzePumpData(pumpData);
      risks.push(...pumpRisks);
      summary.risks.pump_anomaly = pumpRisks.length;
    }

    if (labData && labData.length > 0) {
      const labRisks = this.analyzeLabData(labData, scadaData);
      risks.push(...labRisks);
      summary.risks.lab_mismatch = labRisks.length;
    }

    return {
      date,
      summary,
      risks: risks.sort((a, b) => new Date(a.time) - new Date(b.time))
    };
  }

  analyzeScadaData(scadaData) {
    const risks = [];

    const groupedByTime = {};
    scadaData.forEach(record => {
      const time = record.time;
      if (!groupedByTime[time]) {
        groupedByTime[time] = [];
      }
      groupedByTime[time].push(record);
    });

    for (const [time, records] of Object.entries(groupedByTime)) {
      records.forEach(record => {
        const doValue = record.dissolvedOxygen;
        const nh3Value = record.ammoniaNitrogen;
        const tank = record.tank;

        if (doValue > this.config.dissolvedOxygen.max) {
          risks.push({
            type: 'over_aeration',
            time: time,
            tank: tank,
            metric: 'dissolvedOxygen',
            value: doValue,
            threshold: this.config.dissolvedOxygen.max,
            reason: `溶解氧过高（${doValue} mg/L > ${this.config.dissolvedOxygen.max} mg/L），可能曝气过量`
          });
        }

        if (doValue < this.config.dissolvedOxygen.min) {
          risks.push({
            type: 'hypoxia',
            time: time,
            tank: tank,
            metric: 'dissolvedOxygen',
            value: doValue,
            threshold: this.config.dissolvedOxygen.min,
            reason: `溶解氧过低（${doValue} mg/L < ${this.config.dissolvedOxygen.min} mg/L），可能存在缺氧风险`
          });
        }

        if (nh3Value > this.config.ammoniaNitrogen.max) {
          risks.push({
            type: 'hypoxia',
            time: time,
            tank: tank,
            metric: 'ammoniaNitrogen',
            value: nh3Value,
            threshold: this.config.ammoniaNitrogen.max,
            reason: `氨氮超标（${nh3Value} mg/L > ${this.config.ammoniaNitrogen.max} mg/L），硝化效果差，可能供氧不足`
          });
        }
      });
    }

    return risks;
  }

  analyzeBlowerData(blowerData, scadaData) {
    const risks = [];

    const groupedByTime = {};
    blowerData.forEach(record => {
      const time = record.time;
      if (!groupedByTime[time]) {
        groupedByTime[time] = [];
      }
      groupedByTime[time].push(record);
    });

    for (const [time, records] of Object.entries(groupedByTime)) {
      records.forEach(record => {
        const power = record.power;
        const frequency = record.frequency;

        if (power > this.config.blower.powerThreshold && 
            frequency > this.config.blower.frequencyThreshold) {
          const scadaAtTime = scadaData?.filter(s => {
            const scadaTime = new Date(s.time);
            const blowerTime = new Date(time);
            const diff = Math.abs(scadaTime - blowerTime);
            return diff < 30 * 60 * 1000;
          });

          const avgDO = scadaAtTime?.length > 0 
            ? scadaAtTime.reduce((sum, s) => sum + s.dissolvedOxygen, 0) / scadaAtTime.length
            : null;

          if (avgDO === null || avgDO > this.config.dissolvedOxygen.max) {
            risks.push({
              type: 'over_aeration',
              time: time,
              blower: record.blower,
              metric: 'blowerPower',
              value: power,
              threshold: this.config.blower.powerThreshold,
              reason: `鼓风机功率过高（${power} kW）且频率过高（${frequency} Hz），结合溶解氧数据，判断为曝气过量`
            });
          }
        }
      });
    }

    return risks;
  }

  analyzePumpData(pumpData) {
    const risks = [];

    const groupedByTime = {};
    pumpData.forEach(record => {
      const time = record.time;
      if (!groupedByTime[time]) {
        groupedByTime[time] = [];
      }
      groupedByTime[time].push(record);
    });

    for (const [time, records] of Object.entries(groupedByTime)) {
      records.forEach(record => {
        const flowRate = record.flowRate;
        const status = record.status;

        if (status === '停机') {
          risks.push({
            type: 'pump_anomaly',
            time: time,
            pump: record.pump,
            metric: 'status',
            value: status,
            threshold: '运行',
            reason: `回流泵处于停机状态，可能导致污泥回流不足，影响处理效果`
          });
        } else if (flowRate < this.config.pump.minFlowRate) {
          risks.push({
            type: 'pump_anomaly',
            time: time,
            pump: record.pump,
            metric: 'flowRate',
            value: flowRate,
            threshold: this.config.pump.minFlowRate,
            reason: `回流泵流量过低（${flowRate} m³/h < ${this.config.pump.minFlowRate} m³/h），可能存在堵塞或故障`
          });
        }
      });
    }

    return risks;
  }

  analyzeLabData(labData, scadaData) {
    const risks = [];

    labData.forEach(record => {
      const instrumentValue = record.instrumentValue;
      const labValue = record.labValue;
      const item = record.item;

      if (instrumentValue === 0 || labValue === 0) {
        return;
      }

      const deviation = Math.abs(labValue - instrumentValue) / Math.max(instrumentValue, labValue);

      if (deviation > this.config.lab.allowedDeviation) {
        risks.push({
          type: 'lab_mismatch',
          time: record.time,
          item: item,
          metric: 'deviation',
          instrumentValue: instrumentValue,
          labValue: labValue,
          deviation: deviation,
          threshold: this.config.lab.allowedDeviation,
          reason: `${item}仪表值（${instrumentValue} ${record.unit}）与化验值（${labValue} ${record.unit}）偏差较大（${(deviation * 100).toFixed(1)}% > ${(this.config.lab.allowedDeviation * 100).toFixed(0)}%），可能需要校验仪表或复核化验结果`
        });
      }

      if (record.remark && record.remark.includes('偏差')) {
        const existingRisk = risks.find(r => r.time === record.time && r.item === item);
        if (!existingRisk) {
          risks.push({
            type: 'lab_mismatch',
            time: record.time,
            item: item,
            metric: 'remark',
            instrumentValue: instrumentValue,
            labValue: labValue,
            reason: `化验备注标注：${record.remark}`
          });
        }
      }
    });

    return risks;
  }
}

module.exports = DataAnalyzer;
