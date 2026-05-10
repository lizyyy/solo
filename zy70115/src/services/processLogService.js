const db = require('../config/database');
const { getCurrentTimestamp } = require('../utils/common');

const STEPS = [
  { name: '配餐计划创建', order: 1 },
  { name: '过敏源规则校验', order: 2 },
  { name: '人数变更审核', order: 3 },
  { name: '配送线路匹配', order: 4 },
  { name: '线路装载确认', order: 5 },
  { name: '签收回执', order: 6 },
  { name: '配餐完成', order: 7 }
];

function logProcessStep(mealPlanId, stepName, status, resultMessage, operator, checkpointData = {}) {
  return new Promise((resolve, reject) => {
    const step = STEPS.find(s => s.name === stepName);
    const stepOrder = step ? step.order : 99;
    
    db.run(
      `INSERT INTO process_flow_logs (meal_plan_id, step_name, step_order, status, result_message, operator, checkpoint_data, created_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [mealPlanId, stepName, stepOrder, status, resultMessage, operator || 'system', JSON.stringify(checkpointData), getCurrentTimestamp()],
      function(err) {
        if (err) reject(err);
        else resolve({ id: this.lastID });
      }
    );
  });
}

function getProcessStatus(mealPlanId) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT * FROM process_flow_logs WHERE meal_plan_id = ? ORDER BY step_order ASC, created_at ASC`,
      [mealPlanId],
      (err, logs) => {
        if (err) return reject(err);
        
        const result = {
          mealPlanId,
          currentStep: null,
          currentStatus: '未开始',
          isBlocked: false,
          blockedStep: null,
          lastSuccessfulStep: null,
          allSteps: STEPS.map(step => {
            const stepLogs = logs.filter(l => l.step_name === step.name);
            const latest = stepLogs[stepLogs.length - 1];
            return {
              name: step.name,
              order: step.order,
              logs: stepLogs,
              latestStatus: latest ? latest.status : '未执行',
              latestMessage: latest ? latest.result_message : null,
              latestTime: latest ? latest.created_at : null
            };
          })
        };

        const rejectedSteps = result.allSteps.filter(s => s.latestStatus === 'rejected');
        if (rejectedSteps.length > 0) {
          result.isBlocked = true;
          result.blockedStep = rejectedSteps[rejectedSteps.length - 1];
          result.currentStatus = `被卡阻在: ${result.blockedStep.name}`;
        } else {
          const executedSteps = result.allSteps.filter(s => s.latestStatus !== '未执行');
          if (executedSteps.length > 0) {
            const latestStep = executedSteps[executedSteps.length - 1];
            result.currentStep = latestStep;
            result.currentStatus = latestStep.latestStatus === 'completed' ? 
              `已完成: ${latestStep.name}` : 
              `${latestStep.name} (${latestStep.latestStatus})`;
            
            if (latestStep.latestStatus === 'completed') {
              result.lastSuccessfulStep = latestStep;
            }
          }
        }

        resolve(result);
      }
    );
  });
}

function getPreviousProcessRecord(mealPlanId, stepName) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT * FROM process_flow_logs 
       WHERE meal_plan_id = ? AND step_name = ? 
       ORDER BY created_at DESC`,
      [mealPlanId, stepName],
      (err, logs) => {
        if (err) return reject(err);
        
        if (logs.length === 0) {
          resolve(null);
        } else {
          resolve({
            latest: logs[0],
            history: logs.slice(1)
          });
        }
      }
    );
  });
}

module.exports = {
  STEPS,
  logProcessStep,
  getProcessStatus,
  getPreviousProcessRecord
};
