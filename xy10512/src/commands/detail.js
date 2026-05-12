const chalk = require('chalk');
const dataStore = require('../utils/dataStore');
const assessor = require('../core/assessor');

const getStatusColor = (status) => {
  switch (status) {
    case 'RESOLVED': return chalk.green;
    case 'LOW': return chalk.green;
    case 'INFO': return chalk.gray;
    case 'PENDING': return chalk.yellow;
    case 'MEDIUM': return chalk.yellow;
    case 'CRITICAL': return chalk.red;
    case 'HIGH': return chalk.red;
    case 'ERROR': return chalk.red;
    default: return chalk.white;
  }
};

module.exports = async (alertId, options) => {
  const alert = dataStore.get('alerts', alertId);
  if (!alert) {
    console.log(chalk.red(`告警不存在: ${alertId}`));
    return;
  }
  
  const assessment = assessor.getAssessment(alertId);
  const temperature = dataStore.get('temperature', alert.temperatureId);
  
  console.log(chalk.cyan('='.repeat(60)));
  console.log(chalk.bold(`告警详情: ${alertId}`));
  console.log(chalk.cyan('='.repeat(60)));
  
  console.log('');
  console.log(chalk.bold('【告警基础信息】'));
  console.log(chalk.gray(`  ID:           ${alert.id}`));
  console.log(chalk.gray(`  仓库:         ${alert.warehouseId}`));
  console.log(chalk.gray(`  类型:         ${alert.type}`));
  console.log(chalk.gray(`  触发时间:     ${alert.triggeredAt}`));
  console.log(chalk.gray(`  原始消息:     ${alert.originalMessage}`));
  console.log(chalk.gray(`  温度数据ID:   ${alert.temperatureId}`));
  
  console.log('');
  console.log(chalk.bold('【评估结果】'));
  if (assessment) {
    const color = getStatusColor(assessment.status);
    console.log(color(`  状态:         ${assessment.status}`));
    console.log(chalk.gray(`  严重程度:     ${assessment.severity}`));
    console.log(chalk.gray(`  持续时间:     ${assessment.duration || 'N/A'}`));
    console.log(chalk.gray(`  违规点数:     ${assessment.violations || 0}`));
    console.log(chalk.gray(`  检查次数:     ${assessment.checkCount || 1}`));
    console.log(chalk.gray(`  检查时间:     ${assessment.checkedAt}`));
    
    if (assessment.mitigations && assessment.mitigations.length > 0) {
      console.log('');
      console.log(chalk.bold('  缓解因素:'));
      assessment.mitigations.forEach(m => {
        console.log(chalk.yellow(`    - ${m}`));
      });
    }
    
    console.log('');
    console.log(chalk.bold(`  处理建议: ${chalk.cyan(assessment.recommendation || '无')}`));
    
    if (assessment.affectedBatches && assessment.affectedBatches.length > 0) {
      console.log('');
      console.log(chalk.bold('  受影响商品批次:'));
      assessment.affectedBatches.forEach(b => {
        console.log(chalk.red(`    ${b.id}: ${b.productName}`));
        console.log(chalk.gray(`      数量: ${b.quantity}${b.unit || ''} | 要求温度: ${b.requiredTemp}°C`));
        console.log(chalk.gray(`      入库时间: ${b.inTime}`));
        if (b.outTime) console.log(chalk.gray(`      出库时间: ${b.outTime}`));
      });
      
      const highRisk = assessment.affectedBatches.filter(b => 
        assessment.status === 'CRITICAL' || assessment.severity === 'HIGH'
      );
      if (highRisk.length > 0) {
        console.log('');
        console.log(chalk.red.bold('  ⚠ 建议: 对以下批次进行复检或评估报损:'));
        highRisk.forEach(b => {
          console.log(chalk.red(`    - ${b.id} (${b.productName})`));
        });
      }
    } else {
      console.log('');
      console.log(chalk.green('  无受影响商品批次'));
    }
    
    if (assessment.manuallyCorrected) {
      console.log('');
      console.log(chalk.yellow.bold('  该记录已人工修正'));
      console.log(chalk.gray(`    修正者: ${assessment.correctedBy}`));
      console.log(chalk.gray(`    修正时间: ${assessment.correctedAt}`));
    }
  } else {
    console.log(chalk.yellow('  尚未评估，请运行: cold-chain check --id ' + alertId));
  }
  
  if (temperature) {
    console.log('');
    console.log(chalk.bold('【温度曲线数据】'));
    console.log(chalk.gray(`  传感器:       ${temperature.sensorId}`));
    console.log(chalk.gray(`  开始时间:     ${temperature.startTime}`));
    console.log(chalk.gray(`  结束时间:     ${temperature.endTime || 'N/A'}`));
    console.log(chalk.gray(`  描述:         ${temperature.description || ''}`));
    
    if (temperature.hasDuplicate) {
      console.log(chalk.yellow('  ⚠ 检测到重复传感器数据'));
    }
    if (temperature.hasBreakpoint) {
      console.log(chalk.yellow('  ⚠ 检测到数据断点:'));
      temperature.breakpoints?.forEach(bp => {
        console.log(chalk.yellow(`    - ${bp.from} 到 ${bp.to}，缺口 ${bp.gapMinutes} 分钟`));
      });
    }
    
    if (temperature.readings && temperature.readings.length > 0) {
      console.log('');
      console.log(chalk.bold('  温度读数 (' + temperature.readings.length + ' 个点):'));
      const sorted = [...temperature.readings].sort((a, b) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
      sorted.forEach(r => {
        const isViolation = r.temperature > -10 || r.temperature < -25;
        const tempColor = isViolation ? chalk.red : chalk.green;
        const marker = isViolation ? '⚠' : ' ';
        console.log(chalk.gray(`    ${marker} ${r.timestamp}: `) + tempColor(`${r.temperature}°C`));
      });
    }
  }
  
  if (options.history) {
    console.log('');
    console.log(chalk.bold('【历史记录】'));
    const history = dataStore.history('assessments', assessment?.id);
    
    if (history.length === 0) {
      console.log(chalk.gray('  暂无历史记录'));
    } else {
      history.reverse().forEach((h, idx) => {
        console.log('');
        console.log(chalk.cyan(`  [${idx + 1}] ${h.changeType} - ${h.operator} @ ${h.timestamp}`));
        
        if (h.data.diff) {
          Object.entries(h.data.diff).forEach(([key, val]) => {
            if (key !== 'updatedAt') {
              if (val.before !== undefined && val.after !== undefined) {
                console.log(chalk.gray(`    ${key}: ${JSON.stringify(val.before)} → ${JSON.stringify(val.after)}`));
              } else {
                console.log(chalk.gray(`    ${key}: ${JSON.stringify(h.data[key] || val)}`));
              }
            }
          });
        } else if (h.data.before && h.data.after) {
          Object.entries(h.data.diff || {}).forEach(([key, val]) => {
            if (key !== 'updatedAt') {
              console.log(chalk.gray(`    ${key}: ${JSON.stringify(val.before)} → ${JSON.stringify(val.after)}`));
            }
          });
        } else {
          console.log(chalk.gray(`    数据: ${JSON.stringify(h.data).substring(0, 200)}...`));
        }
      });
    }
  }
  
  console.log('');
  console.log(chalk.cyan('='.repeat(60)));
};
