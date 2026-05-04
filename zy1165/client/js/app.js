const API_BASE = '/api/experiments';

let currentExperiment = null;
let allowRateChart = null;
let timelineChart = null;
let levelChart = null;
let tbLatencyChart = null;
let lbLatencyChart = null;

const PRESETS = {
  good: {
    totalRequests: 1000,
    burstDuration: 5,
    burstRate: 100,
    steadyDuration: 10,
    steadyRate: 10,
    tokenRate: 50,
    tokenCapacity: 100,
    leakRate: 50,
    leakCapacity: 100,
    queueLength: 50,
    timeout: 5000,
    seed: 42
  },
  bad: [
    {
      name: '配置1: 令牌生成速率过低',
      config: {
        totalRequests: 500,
        burstDuration: 3,
        burstRate: 100,
        steadyDuration: 5,
        steadyRate: 20,
        tokenRate: 5,
        tokenCapacity: 20,
        leakRate: 20,
        leakCapacity: 50,
        queueLength: 0,
        timeout: 5000,
        seed: 1
      }
    },
    {
      name: '配置2: 桶容量过小',
      config: {
        totalRequests: 500,
        burstDuration: 3,
        burstRate: 100,
        steadyDuration: 5,
        steadyRate: 20,
        tokenRate: 50,
        tokenCapacity: 10,
        leakRate: 50,
        leakCapacity: 10,
        queueLength: 0,
        timeout: 5000,
        seed: 2
      }
    },
    {
      name: '配置3: 队列过长导致超时',
      config: {
        totalRequests: 500,
        burstDuration: 3,
        burstRate: 100,
        steadyDuration: 5,
        steadyRate: 20,
        tokenRate: 50,
        tokenCapacity: 100,
        leakRate: 10,
        leakCapacity: 50,
        queueLength: 200,
        timeout: 2000,
        seed: 3
      }
    }
  ]
};

document.addEventListener('DOMContentLoaded', () => {
  initEventListeners();
  loadHistory();
});

function initEventListeners() {
  document.getElementById('experimentForm').addEventListener('submit', handleSubmit);
  document.getElementById('resetForm').addEventListener('click', resetForm);
  document.getElementById('loadPresetGood').addEventListener('click', () => loadPreset('good'));
  document.getElementById('loadPresetBad').addEventListener('click', () => loadPreset('bad'));
  document.getElementById('refreshHistory').addEventListener('click', loadHistory);
  document.getElementById('exportMarkdown').addEventListener('click', exportMarkdown);
  document.getElementById('exportJson').addEventListener('click', exportJson);
}

async function handleSubmit(e) {
  e.preventDefault();
  
  const config = getFormConfig();
  
  try {
    const response = await fetch(API_BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(config)
    });
    
    const data = await response.json();
    
    if (data.success) {
      currentExperiment = data.data;
      displayResults(data.data);
      document.getElementById('resultsSection').classList.remove('hidden');
      loadHistory();
      scrollToResults();
    } else {
      alert('实验失败: ' + data.error);
    }
  } catch (error) {
    alert('请求失败: ' + error.message);
  }
}

function getFormConfig() {
  return {
    name: `实验-${new Date().toLocaleString()}`,
    totalRequests: parseInt(document.getElementById('totalRequests').value),
    burstDuration: parseFloat(document.getElementById('burstDuration').value),
    burstRate: parseInt(document.getElementById('burstRate').value),
    steadyDuration: parseFloat(document.getElementById('steadyDuration').value),
    steadyRate: parseInt(document.getElementById('steadyRate').value),
    tokenRate: parseFloat(document.getElementById('tokenRate').value),
    tokenCapacity: parseInt(document.getElementById('tokenCapacity').value),
    leakRate: parseFloat(document.getElementById('leakRate').value),
    leakCapacity: parseInt(document.getElementById('leakCapacity').value),
    queueLength: parseInt(document.getElementById('queueLength').value),
    timeout: parseInt(document.getElementById('timeout').value),
    seed: document.getElementById('seed').value ? parseInt(document.getElementById('seed').value) : null
  };
}

function setFormConfig(config) {
  if (config.totalRequests) document.getElementById('totalRequests').value = config.totalRequests;
  if (config.burstDuration) document.getElementById('burstDuration').value = config.burstDuration;
  if (config.burstRate) document.getElementById('burstRate').value = config.burstRate;
  if (config.steadyDuration) document.getElementById('steadyDuration').value = config.steadyDuration;
  if (config.steadyRate) document.getElementById('steadyRate').value = config.steadyRate;
  if (config.tokenRate) document.getElementById('tokenRate').value = config.tokenRate;
  if (config.tokenCapacity) document.getElementById('tokenCapacity').value = config.tokenCapacity;
  if (config.leakRate) document.getElementById('leakRate').value = config.leakRate;
  if (config.leakCapacity) document.getElementById('leakCapacity').value = config.leakCapacity;
  if (config.queueLength !== undefined) document.getElementById('queueLength').value = config.queueLength;
  if (config.timeout) document.getElementById('timeout').value = config.timeout;
  if (config.seed) document.getElementById('seed').value = config.seed;
  else document.getElementById('seed').value = '';
}

function resetForm() {
  setFormConfig({
    totalRequests: 1000,
    burstDuration: 5,
    burstRate: 100,
    steadyDuration: 10,
    steadyRate: 10,
    tokenRate: 50,
    tokenCapacity: 100,
    leakRate: 50,
    leakCapacity: 100,
    queueLength: 50,
    timeout: 5000
  });
  document.getElementById('seed').value = '';
}

function loadPreset(type) {
  if (type === 'good') {
    setFormConfig(PRESETS.good);
    alert('已加载推荐配置');
  } else if (type === 'bad') {
    const badIndex = Math.floor(Math.random() * PRESETS.bad.length);
    const badConfig = PRESETS.bad[badIndex];
    setFormConfig(badConfig.config);
    alert(`已加载坏配置示例: ${badConfig.name}`);
  }
}

async function loadHistory() {
  try {
    const response = await fetch(API_BASE);
    const data = await response.json();
    
    if (data.success && data.data.length > 0) {
      renderHistory(data.data);
    } else {
      document.getElementById('historyList').innerHTML = '<p class="empty-message">暂无历史实验</p>';
    }
  } catch (error) {
    console.error('加载历史失败:', error);
  }
}

function renderHistory(experiments) {
  const historyList = document.getElementById('historyList');
  historyList.innerHTML = experiments.map(exp => `
    <div class="history-item" data-id="${exp.id}">
      <div class="history-info">
        <h4>${exp.name}</h4>
        <p>令牌桶放行: ${exp.result.tokenBucket.stats.allowed} | 漏桶放行: ${exp.result.leakyBucket.stats.allowed}</p>
      </div>
      <div class="history-meta">
        <span>${new Date(exp.createdAt).toLocaleString()}</span>
      </div>
    </div>
  `).join('');
  
  historyList.querySelectorAll('.history-item').forEach(item => {
    item.addEventListener('click', () => loadExperiment(item.dataset.id));
  });
}

async function loadExperiment(id) {
  try {
    const response = await fetch(`${API_BASE}/${id}`);
    const data = await response.json();
    
    if (data.success) {
      currentExperiment = data.data;
      setFormConfig(data.data.config);
      displayResults(data.data);
      document.getElementById('resultsSection').classList.remove('hidden');
      scrollToResults();
    }
  } catch (error) {
    alert('加载实验失败: ' + error.message);
  }
}

function displayResults(experiment) {
  const { result } = experiment;
  const { tokenBucket, leakyBucket } = result;
  
  document.getElementById('tbAllowed').textContent = tokenBucket.stats.allowed;
  document.getElementById('tbRejected').textContent = tokenBucket.stats.rejected;
  document.getElementById('lbAllowed').textContent = leakyBucket.stats.allowed;
  document.getElementById('lbQueued').textContent = leakyBucket.stats.queued;
  
  updateStatsTable(tokenBucket.stats, leakyBucket.stats);
  
  renderAllowRateChart(tokenBucket.stats, leakyBucket.stats);
  renderTimelineChart(result);
  renderLevelChart(result);
  renderLatencyCharts(tokenBucket.latencyDistribution, leakyBucket.latencyDistribution);
}

function updateStatsTable(tbStats, lbStats) {
  const tbody = document.getElementById('statsTableBody');
  tbody.innerHTML = `
    <tr><td>总请求数</td><td>${tbStats.total}</td><td>${lbStats.total}</td></tr>
    <tr><td>放行数</td><td>${tbStats.allowed}</td><td>${lbStats.allowed}</td></tr>
    <tr><td>放行率</td><td>${(tbStats.allowed / tbStats.total * 100).toFixed(2)}%</td><td>${(lbStats.allowed / lbStats.total * 100).toFixed(2)}%</td></tr>
    <tr><td>排队数</td><td>${tbStats.queued}</td><td>${lbStats.queued}</td></tr>
    <tr><td>拒绝数</td><td>${tbStats.rejected}</td><td>${lbStats.rejected}</td></tr>
    <tr><td>超时数</td><td>${tbStats.timeout}</td><td>${lbStats.timeout}</td></tr>
    <tr><td>平均延迟(ms)</td><td>${tbStats.avgLatency.toFixed(2)}</td><td>${lbStats.avgLatency.toFixed(2)}</td></tr>
    <tr><td>最大延迟(ms)</td><td>${tbStats.maxLatency}</td><td>${lbStats.maxLatency}</td></tr>
  `;
}

function scrollToResults() {
  document.getElementById('resultsSection').scrollIntoView({ behavior: 'smooth' });
}

async function exportMarkdown() {
  if (!currentExperiment) return;
  
  try {
    const response = await fetch(`${API_BASE}/${currentExperiment.id}/export/markdown`, {
      method: 'POST'
    });
    
    if (response.ok) {
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${currentExperiment.name}.md`;
      a.click();
      URL.revokeObjectURL(url);
    }
  } catch (error) {
    alert('导出失败: ' + error.message);
  }
}

async function exportJson() {
  if (!currentExperiment) return;
  
  try {
    const response = await fetch(`${API_BASE}/${currentExperiment.id}/export/json`, {
      method: 'POST'
    });
    
    if (response.ok) {
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${currentExperiment.name}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  } catch (error) {
    alert('导出失败: ' + error.message);
  }
}
