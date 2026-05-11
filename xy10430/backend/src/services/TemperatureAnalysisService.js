const moment = require('moment');
const { TemperatureRecord, TransportNode } = require('../models');

class TemperatureAnalysisService {
  async analyzeOvertemp(shipmentId, cargoType) {
    const { minTemp, maxTemp, maxOvertimeMinutes } = cargoType;
    
    const records = await TemperatureRecord.findAll({
      where: { shipmentId },
      order: [['recordTime', 'ASC']]
    });

    const nodes = await TransportNode.findAll({
      where: { shipmentId },
      order: [['nodeOrder', 'ASC']]
    });

    const result = {
      overtempIntervals: [],
      totalOvertempMinutes: 0,
      maxTempDeviation: 0,
      avgTempDeviation: 0,
      isSerious: false,
      responsibleNodes: [],
      overtempSummary: ''
    };

    if (records.length === 0) return result;

    let currentInterval = null;
    let overtempCount = 0;
    let totalDeviation = 0;

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const temp = parseFloat(record.temperature);
      const isOvertemp = temp < parseFloat(minTemp) || temp > parseFloat(maxTemp);
      
      if (isOvertemp) {
        const deviation = temp > parseFloat(maxTemp) 
          ? temp - parseFloat(maxTemp) 
          : parseFloat(minTemp) - temp;
        
        overtempCount++;
        totalDeviation += deviation;
        
        if (deviation > result.maxTempDeviation) {
          result.maxTempDeviation = deviation;
        }

        if (!currentInterval) {
          currentInterval = {
            startTime: record.recordTime,
            endTime: null,
            startTemp: temp,
            maxTemp: temp,
            minTemp: temp,
            responsibleNode: this.findResponsibleNode(record.recordTime, nodes)
          };
        } else {
          currentInterval.endTime = record.recordTime;
          currentInterval.maxTemp = Math.max(currentInterval.maxTemp, temp);
          currentInterval.minTemp = Math.min(currentInterval.minTemp, temp);
        }
      } else if (currentInterval) {
        const duration = moment(currentInterval.endTime).diff(
          moment(currentInterval.startTime), 
          'minutes'
        );
        currentInterval.durationMinutes = Math.max(duration, 1);
        result.overtempIntervals.push(currentInterval);
        result.totalOvertempMinutes += currentInterval.durationMinutes;
        result.responsibleNodes.push(currentInterval.responsibleNode);
        currentInterval = null;
      }
    }

    if (currentInterval) {
      const duration = moment(currentInterval.endTime || records[records.length - 1].recordTime).diff(
        moment(currentInterval.startTime), 
        'minutes'
      );
      currentInterval.durationMinutes = Math.max(duration, 1);
      result.overtempIntervals.push(currentInterval);
      result.totalOvertempMinutes += currentInterval.durationMinutes;
      result.responsibleNodes.push(currentInterval.responsibleNode);
    }

    result.avgTempDeviation = overtempCount > 0 ? totalDeviation / overtempCount : 0;
    result.isSerious = result.totalOvertempMinutes > parseInt(maxOvertimeMinutes || 0);
    
    result.overtempSummary = this.generateSummary(result, cargoType);
    
    return result;
  }

  findResponsibleNode(time, nodes) {
    for (const node of nodes) {
      const arrival = moment(node.arrivalTime);
      const departure = node.departureTime ? moment(node.departureTime) : moment().add(1, 'day');
      
      if (moment(time).isBetween(arrival, departure, null, '[]')) {
        return {
          nodeName: node.nodeName,
          responsibleParty: node.responsibleParty,
          nodeType: node.nodeType
        };
      }
    }
    
    if (nodes.length > 0 && moment(time).isBefore(moment(nodes[0].arrivalTime))) {
      return {
        nodeName: nodes[0].nodeName,
        responsibleParty: nodes[0].responsibleParty,
        nodeType: 'origin'
      };
    }
    
    return {
      nodeName: '运输途中',
      responsibleParty: '承运人',
      nodeType: 'transit'
    };
  }

  generateSummary(result, cargoType) {
    if (result.overtempIntervals.length === 0) {
      return '无超温记录，温度全程在正常范围内。';
    }

    const summaries = [];
    summaries.push(`共发生${result.overtempIntervals.length}次超温，累计超温时长${result.totalOvertempMinutes}分钟。`);
    summaries.push(`最大温度偏差${result.maxTempDeviation.toFixed(1)}℃，平均偏差${result.avgTempDeviation.toFixed(1)}℃。`);
    
    if (result.isSerious) {
      summaries.push(`超温时长超过${cargoType.maxOvertimeMinutes}分钟阈值，属于严重超温。`);
    } else {
      summaries.push(`超温时长在${cargoType.maxOvertimeMinutes}分钟阈值内。`);
    }

    const uniqueNodes = [...new Set(result.responsibleNodes.map(n => n.nodeName))];
    if (uniqueNodes.length > 0) {
      summaries.push(`责任节点：${uniqueNodes.join('、')}。`);
    }

    return summaries.join(' ');
  }
}

module.exports = new TemperatureAnalysisService();
