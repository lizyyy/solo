const store = require('../src/storage/memoryStore');
const { TRIAL_STATUS } = require('../src/models/TrialTask');
const trialService = require('../src/services/trialService');

function generateHistorySamples(count = 100) {
  const samples = [];
  const now = Date.now();
  
  for (let i = 0; i < count; i++) {
    const isPeak = Math.random() > 0.9;
    const baseValue = 50 + Math.random() * 30;
    const value = isPeak ? baseValue + Math.random() * 50 : baseValue;
    
    samples.push({
      timestamp: new Date(now - (count - i) * 60000).toISOString(),
      value: Math.round(value * 100) / 100,
      isRealIncident: isPeak && Math.random() > 0.7
    });
  }
  
  return samples;
}

async function initSampleData() {
  console.log('开始初始化样例数据...');

  const trial1 = trialService.createTrial({
    metricName: 'CPU_Usage_Rate',
    candidateThresholds: [70, 80, 85, 90, 95],
    historySamples: generateHistorySamples(100),
    createdBy: 'admin'
  });

  await trialService.runThresholdCalculation(trial1.id);

  const trial2 = trialService.createTrial({
    metricName: 'Memory_Usage_Rate',
    candidateThresholds: [75, 80, 85, 90],
    historySamples: generateHistorySamples(80),
    createdBy: 'operator'
  });

  await trialService.runThresholdCalculation(trial2.id);
  trialService.advanceStatus(trial2.id, TRIAL_STATUS.CONFIRMING, '误报确认中');

  console.log('样例数据初始化完成!');
  console.log(`任务1 (CPU_Usage_Rate): ${trial1.id}`);
  console.log(`任务2 (Memory_Usage_Rate): ${trial2.id}`);
}

initSampleData().catch(console.error);