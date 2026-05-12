const chalk = require('chalk');
const inquirer = require('inquirer');
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

const printAssessment = (result) => {
  if (result.isDuplicate) {
    console.log(chalk.gray(`  跳过: ${result.alertId} - ${result.message}`));
    return;
  }
  
  const assessment = result.assessment;
  const color = getStatusColor(assessment.status);
  
  console.log(color(`  ${assessment.status}`) + chalk.cyan(` [${assessment.severity}] `) + chalk.white(result.alertId));
  
  if (result.reassessed) {
    console.log(chalk.gray(`    (重新评估 #${assessment.checkCount})`));
  }
  
  if (assessment.recommendation) {
    console.log(chalk.gray(`    建议: ${assessment.recommendation}`));
  }
  
  if (assessment.violations > 0) {
    console.log(chalk.gray(`    违规点: ${assessment.violations} 个`));
  }
  
  if (assessment.mitigations && assessment.mitigations.length > 0) {
    assessment.mitigations.forEach(m => {
      console.log(chalk.yellow(`    ⚠ ${m}`));
    });
  }
  
  if (assessment.affectedBatches && assessment.affectedBatches.length > 0) {
    console.log(chalk.red(`    受影响批次: ${assessment.affectedBatches.length} 个`));
    assessment.affectedBatches.forEach(b => {
      console.log(chalk.gray(`      - ${b.id}: ${b.productName} (${b.quantity}${b.unit || ''})`));
    });
  }
};

const askManualCorrection = async (alertId, currentAssessment) => {
  console.log('');
  console.log(chalk.yellow('=== 人工修正 ==='));
  
  const { doCorrect } = await inquirer.prompt([{
    type: 'confirm',
    name: 'doCorrect',
    message: '是否进行人工修正?',
    default: false
  }]);
  
  if (!doCorrect) return null;
  
  const { operator } = await inquirer.prompt([{
    type: 'input',
    name: 'operator',
    message: '操作者姓名:',
    validate: (v) => v.trim() ? true : '必须填写操作者'
  }]);
  
  const { newStatus } = await inquirer.prompt([{
    type: 'list',
    name: 'newStatus',
    message: '新状态:',
    choices: [
      { name: 'RESOLVED - 已解决', value: 'RESOLVED' },
      { name: 'PENDING - 待处理', value: 'PENDING' },
      { name: 'CRITICAL - 严重', value: 'CRITICAL' },
      { name: 'LOW - 低风险', value: 'LOW' }
    ],
    default: currentAssessment.status
  }]);
  
  const { newSeverity } = await inquirer.prompt([{
    type: 'list',
    name: 'newSeverity',
    message: '新严重程度:',
    choices: [
      { name: 'INFO', value: 'INFO' },
      { name: 'LOW', value: 'LOW' },
      { name: 'MEDIUM', value: 'MEDIUM' },
      { name: 'HIGH', value: 'HIGH' }
    ],
    default: currentAssessment.severity
  }]);
  
  const { recommendation } = await inquirer.prompt([{
    type: 'input',
    name: 'recommendation',
    message: '处理建议:',
    default: currentAssessment.recommendation || ''
  }]);
  
  return {
    operator,
    corrections: {
      status: newStatus,
      severity: newSeverity,
      recommendation
    }
  };
};

module.exports = async (options) => {
  if (!options.id && !options.all) {
    console.log(chalk.yellow('请指定检查范围:'));
    console.log('  --id <alertId>    检查指定告警');
    console.log('  --all             检查所有未处理告警');
    console.log('  --force           强制重新检查已处理的告警');
    return;
  }
  
  if (options.id) {
    const alert = dataStore.get('alerts', options.id);
    if (!alert) {
      console.log(chalk.red(`告警不存在: ${options.id}`));
      return;
    }
    
    console.log(chalk.cyan(`正在评估告警: ${options.id}`));
    console.log('');
    
    const result = assessor.checkAlert(options.id, options.force);
    printAssessment(result);
    
    if (!result.isDuplicate && result.assessment) {
      const manual = await askManualCorrection(options.id, result.assessment);
      if (manual) {
        const correctionResult = assessor.manualCorrect(
          options.id, 
          manual.corrections, 
          manual.operator
        );
        console.log('');
        console.log(chalk.green('✓ 人工修正已记录'));
        console.log(chalk.gray(`  操作者: ${correctionResult.operator}`));
        console.log(chalk.gray(`  变更:`));
        Object.entries(correctionResult.diff).forEach(([key, val]) => {
          if (key !== 'updatedAt' && key !== 'manuallyCorrected' && key !== 'correctedBy' && key !== 'correctedAt') {
            console.log(chalk.gray(`    ${key}: ${val.before} → ${val.after}`));
          }
        });
      }
    }
  } else {
    console.log(chalk.cyan('正在评估所有告警...'));
    console.log('');
    
    const results = assessor.checkAll(options.force);
    const success = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    success.forEach(r => printAssessment(r));
    
    if (failed.length > 0) {
      console.log('');
      console.log(chalk.red('失败项:'));
      failed.forEach(r => {
        console.log(chalk.red(`  ✗ ${r.alertId}: ${r.error}`));
      });
    }
    
    console.log('');
    const resolved = success.filter(r => !r.isDuplicate && r.assessment?.status === 'RESOLVED').length;
    const pending = success.filter(r => !r.isDuplicate && (r.assessment?.status === 'PENDING' || r.assessment?.status === 'CRITICAL')).length;
    const skipped = success.filter(r => r.isDuplicate).length;
    
    console.log(chalk.bold('评估结果:'));
    console.log(`  ${chalk.green('已解决:')} ${resolved}`);
    console.log(`  ${chalk.yellow('待处理:')} ${pending}`);
    console.log(`  ${chalk.gray('已跳过:')} ${skipped}`);
    if (failed.length > 0) console.log(`  ${chalk.red('失败:')} ${failed.length}`);
  }
};
