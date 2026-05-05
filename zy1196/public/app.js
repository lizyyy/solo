const API_BASE = '/api';
let currentExperiment = null;
let currentComparison = null;
let performanceChart = null;
let comparisonChart = null;

const modelColors = {
  blocking: '#ef4444',
  non_blocking: '#f59e0b',
  multiplexing: '#10b981',
  async: '#7c3aed'
};

const modelNames = {
  blocking: '阻塞 I/O',
  non_blocking: '非阻塞 I/O',
  multiplexing: 'I/O 多路复用',
  async: '异步 I/O'
};

const fdStateClasses = {
  idle: 'fd-idle',
  waiting: 'fd-waiting',
  ready: 'fd-ready',
  processing: 'fd-processing',
  completed: 'fd-completed',
  timeout: 'fd-timeout'
};

document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  initButtons();
  loadHistory();
  initCharts();
});

function initTabs() {
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabName = btn.dataset.tab;
      
      tabButtons.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));
      
      btn.classList.add('active');
      document.getElementById(`${tabName}-tab`).classList.add('active');
    });
  });
}

function initButtons() {
  document.getElementById('run-experiment-btn').addEventListener('click', runExperiment);
  document.getElementById('quick-run-btn').addEventListener('click', quickRunSingle);
  document.getElementById('reset-config-btn').addEventListener('click', resetConfig);
  
  document.getElementById('export-markdown-btn').addEventListener('click', exportMarkdown);
  document.getElementById('export-json-btn').addEventListener('click', exportJSON);
  
  document.getElementById('refresh-history-btn').addEventListener('click', loadHistory);
  
  document.getElementById('load-default-seed').addEventListener('click', () => loadSeed('default'));
  document.getElementById('load-bad-example-1').addEventListener('click', () => loadSeed('bad-example-1'));
  document.getElementById('load-bad-example-2').addEventListener('click', () => loadSeed('bad-example-2'));
}

function initCharts() {
  const perfCtx = document.getElementById('performance-chart').getContext('2d');
  performanceChart = new Chart(perfCtx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        {
          label: 'CPU 空转',
          data: [],
          borderColor: '#ef4444',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          fill: true,
          tension: 0.4
        },
        {
          label: '轮询次数',
          data: [],
          borderColor: '#f59e0b',
          backgroundColor: 'rgba(245, 158, 11, 0.1)',
          fill: true,
          tension: 0.4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: '#9ca3af' }
        }
      },
      scales: {
        x: {
          ticks: { color: '#9ca3af' },
          grid: { color: 'rgba(255, 255, 255, 0.05)' }
        },
        y: {
          ticks: { color: '#9ca3af' },
          grid: { color: 'rgba(255, 255, 255, 0.05)' }
        }
      }
    }
  });

  const compCtx = document.getElementById('comparison-chart').getContext('2d');
  comparisonChart = new Chart(compCtx, {
    type: 'bar',
    data: {
      labels: [],
      datasets: []
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: '#9ca3af' }
        }
      },
      scales: {
        x: {
          ticks: { color: '#9ca3af' },
          grid: { color: 'rgba(255, 255, 255, 0.05)' }
        },
        y: {
          ticks: { color: '#9ca3af' },
          grid: { color: 'rgba(255, 255, 255, 0.05)' }
        }
      }
    }
  });
}

function getConfig() {
  const models = [];
  document.querySelectorAll('#model-selection input[type="checkbox"]:checked').forEach(cb => {
    models.push(cb.value);
  });

  return {
    name: document.getElementById('experiment-name').value || `实验-${Date.now()}`,
    description: document.getElementById('experiment-desc').value,
    connectionCount: parseInt(document.getElementById('connection-count').value),
    bufferSize: parseInt(document.getElementById('buffer-size').value),
    dataArrivalTime: parseInt(document.getElementById('data-arrival-time').value),
    dataArrivalJitter: parseInt(document.getElementById('data-arrival-jitter').value),
    processingTime: parseInt(document.getElementById('processing-time').value),
    processingJitter: parseInt(document.getElementById('processing-jitter').value),
    timeout: parseInt(document.getElementById('timeout').value),
    models: models
  };
}

function setConfig(config) {
  if (config.name) document.getElementById('experiment-name').value = config.name;
  if (config.description) document.getElementById('experiment-desc').value = config.description;
  if (config.connectionCount) document.getElementById('connection-count').value = config.connectionCount;
  if (config.bufferSize) document.getElementById('buffer-size').value = config.bufferSize;
  if (config.dataArrivalTime) document.getElementById('data-arrival-time').value = config.dataArrivalTime;
  if (config.dataArrivalJitter) document.getElementById('data-arrival-jitter').value = config.dataArrivalJitter;
  if (config.processingTime) document.getElementById('processing-time').value = config.processingTime;
  if (config.processingJitter) document.getElementById('processing-jitter').value = config.processingJitter;
  if (config.timeout) document.getElementById('timeout').value = config.timeout;
  
  if (config.models) {
    document.querySelectorAll('#model-selection input[type="checkbox"]').forEach(cb => {
      cb.checked = config.models.includes(cb.value);
    });
  }
}

function resetConfig() {
  document.getElementById('experiment-name').value = '';
  document.getElementById('experiment-desc').value = '';
  document.getElementById('connection-count').value = 20;
  document.getElementById('buffer-size').value = 4096;
  document.getElementById('data-arrival-time').value = 200;
  document.getElementById('data-arrival-jitter').value = 50;
  document.getElementById('processing-time').value = 100;
  document.getElementById('processing-jitter').value = 20;
  document.getElementById('timeout').value = 10000;
  
  document.querySelectorAll('#model-selection input[type="checkbox"]').forEach(cb => {
    cb.checked = true;
  });
  
  showToast('配置已重置', 'success');
}

async function runExperiment() {
  const config = getConfig();
  
  if (config.models.length === 0) {
    showToast('请至少选择一个 I/O 模型', 'error');
    return;
  }

  try {
    document.getElementById('running-card').style.display = 'block';
    document.getElementById('run-experiment-btn').disabled = true;
    document.getElementById('quick-run-btn').disabled = true;
    
    updateRunningStatus('正在创建实验...', 0);
    
    const createResponse = await fetch(`${API_BASE}/experiments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
    
    const experiment = await createResponse.json();
    currentExperiment = experiment;
    
    updateRunningStatus('正在运行实验...', 10);
    
    const runResponse = await fetch(`${API_BASE}/experiments/${experiment.id}/run`, {
      method: 'POST'
    });
    
    const completedExperiment = await runResponse.json();
    currentExperiment = completedExperiment;
    
    updateRunningStatus('正在生成对比报告...', 90);
    
    const compResponse = await fetch(`${API_BASE}/experiments/${experiment.id}/comparison`);
    currentComparison = await compResponse.json();
    
    updateRunningStatus('实验完成！', 100);
    
    setTimeout(() => {
      document.getElementById('running-card').style.display = 'none';
      document.getElementById('run-experiment-btn').disabled = false;
      document.getElementById('quick-run-btn').disabled = false;
      
      displayComparison();
      switchTab('comparison');
      
      showToast('实验完成！已切换到对比分析页', 'success');
    }, 1000);
    
  } catch (error) {
    console.error('实验运行失败:', error);
    showToast('实验运行失败: ' + error.message, 'error');
    document.getElementById('running-card').style.display = 'none';
    document.getElementById('run-experiment-btn').disabled = false;
    document.getElementById('quick-run-btn').disabled = false;
  }
}

async function quickRunSingle() {
  const config = getConfig();
  
  if (config.models.length === 0) {
    showToast('请至少选择一个 I/O 模型', 'error');
    return;
  }

  const modelType = config.models[0];
  
  try {
    document.getElementById('running-card').style.display = 'block';
    document.getElementById('run-experiment-btn').disabled = true;
    document.getElementById('quick-run-btn').disabled = true;
    
    updateRunningStatus(`正在运行 ${modelNames[modelType]}...`, 0);
    
    const response = await fetch(`${API_BASE}/run-single`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        modelType,
        config: {
          connectionCount: config.connectionCount,
          bufferSize: config.bufferSize,
          dataArrivalTime: config.dataArrivalTime,
          dataArrivalJitter: config.dataArrivalJitter,
          processingTime: config.processingTime,
          processingJitter: config.processingJitter,
          timeout: config.timeout
        }
      })
    });
    
    const result = await response.json();
    
    updateRunningStatus('运行完成！', 100);
    
    displaySingleResult(result);
    
    setTimeout(() => {
      document.getElementById('running-card').style.display = 'none';
      document.getElementById('run-experiment-btn').disabled = false;
      document.getElementById('quick-run-btn').disabled = false;
      switchTab('monitor');
    }, 500);
    
  } catch (error) {
    console.error('快速运行失败:', error);
    showToast('运行失败: ' + error.message, 'error');
    document.getElementById('running-card').style.display = 'none';
    document.getElementById('run-experiment-btn').disabled = false;
    document.getElementById('quick-run-btn').disabled = false;
  }
}

function displaySingleResult(result) {
  const metrics = result.metrics;
  
  document.getElementById('metric-threads').textContent = metrics.threadCount;
  document.getElementById('metric-cpu-spins').textContent = metrics.cpuSpins;
  document.getElementById('metric-polls').textContent = metrics.pollCount;
  document.getElementById('metric-ticks').textContent = metrics.eventLoopTicks;
  document.getElementById('metric-latency').textContent = metrics.avgWaitTime ? metrics.avgWaitTime.toFixed(2) : '-';
  document.getElementById('metric-throughput').textContent = metrics.throughput || '-';
  
  if (result.fdResults) {
    displayFdStatus(result.fdResults);
  }
  
  performanceChart.data.labels = ['开始', '完成'];
  performanceChart.data.datasets[0].data = [0, metrics.cpuSpins];
  performanceChart.data.datasets[1].data = [0, metrics.emptyPollCount];
  performanceChart.update();
}

function displayFdStatus(fdResults) {
  const grid = document.getElementById('fd-status-grid');
  grid.innerHTML = '';
  
  fdResults.forEach(fd => {
    const item = document.createElement('div');
    item.className = `fd-item ${fdStateClasses[fd.state] || 'fd-idle'}`;
    item.textContent = fd.fdNum;
    item.title = `FD ${fd.fdNum}: ${fd.state}`;
    grid.appendChild(item);
  });
}

function updateRunningStatus(status, progress) {
  document.getElementById('running-status').textContent = status;
  document.getElementById('progress-fill').style.width = `${progress}%`;
  document.getElementById('progress-text').textContent = `${progress}%`;
}

function displayComparison() {
  if (!currentComparison) return;
  
  document.getElementById('comparison-empty').style.display = 'none';
  document.getElementById('comparison-content').style.display = 'block';
  
  const summary = currentComparison.summary;
  const tbody = document.getElementById('summary-tbody');
  tbody.innerHTML = '';
  
  for (const [modelType, data] of Object.entries(summary)) {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td><strong>${data.modelName}</strong></td>
      <td>${data.totalTime}ms</td>
      <td>${data.throughput}</td>
      <td><span class="badge badge-info">${data.threadCount}</span></td>
      <td><span class="badge badge-success">${data.completed}</span></td>
      <td>${data.timeout > 0 ? `<span class="badge badge-danger">${data.timeout}</span>` : '<span class="badge badge-success">0</span>'}</td>
    `;
    tbody.appendChild(row);
  }
  
  const rankingsGrid = document.getElementById('rankings-grid');
  rankingsGrid.innerHTML = '';
  
  for (const [metric, ranking] of Object.entries(currentComparison.rankings)) {
    const card = document.createElement('div');
    card.className = 'ranking-card';
    
    let listHtml = '';
    ranking.ranked.forEach(item => {
      const modelName = summary[item.modelType]?.modelName || item.modelType;
      let displayValue = item.value;
      
      if (metric === 'throughputBytes') {
        displayValue = `${(item.value / 1024).toFixed(2)} KB/s`;
      } else if (typeof item.value === 'number') {
        displayValue = item.value.toFixed(2);
      }
      
      let positionClass = 'other';
      if (item.rank === 1) positionClass = 'gold';
      else if (item.rank === 2) positionClass = 'silver';
      else if (item.rank === 3) positionClass = 'bronze';
      
      listHtml += `
        <div class="ranking-item">
          <div class="ranking-position ${positionClass}">${item.rank}</div>
          <div class="ranking-info">
            <div class="model-name">${modelName}</div>
            <div class="model-value">${displayValue}</div>
          </div>
        </div>
      `;
    });
    
    card.innerHTML = `
      <h3>${ranking.label}</h3>
      <div class="ranking-list">${listHtml}</div>
    `;
    rankingsGrid.appendChild(card);
  }
  
  updateComparisonChart();
}

function updateComparisonChart() {
  if (!currentComparison) return;
  
  const labels = Object.keys(currentComparison.summary).map(t => currentComparison.summary[t].modelName);
  
  const timeData = Object.entries(currentComparison.detailed.totalTime.values).map(([t, v]) => v);
  const throughputData = Object.entries(currentComparison.detailed.throughputBytes.values).map(([t, v]) => (v / 1024).toFixed(2));
  const threadData = Object.entries(currentComparison.detailed.threadCount.values).map(([t, v]) => v);
  const cpuData = Object.entries(currentComparison.detailed.cpuSpins.values).map(([t, v]) => v);
  
  comparisonChart.data.labels = labels;
  comparisonChart.data.datasets = [
    {
      label: '总耗时 (ms)',
      data: timeData,
      backgroundColor: 'rgba(124, 58, 237, 0.7)',
      borderColor: '#7c3aed',
      borderWidth: 1
    }
  ];
  comparisonChart.update();
}

function switchTab(tabName) {
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');
  
  tabButtons.forEach(b => b.classList.remove('active'));
  tabContents.forEach(c => c.classList.remove('active'));
  
  document.querySelector(`.tab-btn[data-tab="${tabName}"]`).classList.add('active');
  document.getElementById(`${tabName}-tab`).classList.add('active');
}

async function loadHistory() {
  try {
    const response = await fetch(`${API_BASE}/experiments`);
    const experiments = await response.json();
    
    const list = document.getElementById('history-list');
    
    if (experiments.length === 0) {
      list.innerHTML = `
        <div class="empty-state">
          <div class="icon">📁</div>
          <p>暂无历史实验记录</p>
        </div>
      `;
      return;
    }
    
    list.innerHTML = '';
    
    experiments.forEach(exp => {
      const item = document.createElement('div');
      item.className = 'experiment-item';
      
      const statusBadge = getStatusBadge(exp.status);
      const date = new Date(exp.createdAt).toLocaleString('zh-CN');
      
      item.innerHTML = `
        <div class="experiment-info">
          <h3>${exp.name}</h3>
          <p>${exp.description || '无描述'}</p>
          <div class="experiment-meta">
            <span>📅 ${date}</span>
            <span>🔗 ${exp.config.connectionCount} 连接</span>
            <span>🧪 ${exp.config.models.length} 模型</span>
            ${statusBadge}
          </div>
        </div>
        <div class="experiment-actions">
          ${exp.status === 'completed' ? `
            <button class="btn btn-secondary" onclick="viewExperiment('${exp.id}')">👁 查看</button>
            <button class="btn btn-success" onclick="loadExperimentConfig('${exp.id}')">📋 加载配置</button>
          ` : ''}
          <button class="btn btn-danger" onclick="deleteExperiment('${exp.id}')">🗑 删除</button>
        </div>
      `;
      
      list.appendChild(item);
    });
    
  } catch (error) {
    console.error('加载历史记录失败:', error);
    showToast('加载历史记录失败', 'error');
  }
}

function getStatusBadge(status) {
  switch (status) {
    case 'completed':
      return '<span class="badge badge-success"><span class="status-indicator"><span class="status-dot completed"></span> 已完成</span></span>';
    case 'running':
      return '<span class="badge badge-warning"><span class="status-indicator"><span class="status-dot running"></span> 运行中</span></span>';
    default:
      return '<span class="badge badge-info"><span class="status-indicator"><span class="status-dot pending"></span> 待运行</span></span>';
  }
}

async function viewExperiment(id) {
  try {
    const expResponse = await fetch(`${API_BASE}/experiments/${id}`);
    currentExperiment = await expResponse.json();
    
    const compResponse = await fetch(`${API_BASE}/experiments/${id}/comparison`);
    currentComparison = await compResponse.json();
    
    displayComparison();
    switchTab('comparison');
    
    showToast('已加载实验数据', 'success');
  } catch (error) {
    console.error('查看实验失败:', error);
    showToast('查看实验失败', 'error');
  }
}

async function loadExperimentConfig(id) {
  try {
    const response = await fetch(`${API_BASE}/experiments/${id}`);
    const experiment = await response.json();
    
    setConfig({
      name: experiment.name,
      description: experiment.description,
      ...experiment.config
    });
    
    switchTab('experiment');
    showToast('配置已加载，可直接运行', 'success');
  } catch (error) {
    console.error('加载配置失败:', error);
    showToast('加载配置失败', 'error');
  }
}

async function deleteExperiment(id) {
  if (!confirm('确定要删除这个实验吗？')) return;
  
  try {
    await fetch(`${API_BASE}/experiments/${id}`, { method: 'DELETE' });
    loadHistory();
    showToast('实验已删除', 'success');
  } catch (error) {
    console.error('删除实验失败:', error);
    showToast('删除实验失败', 'error');
  }
}

async function loadSeed(type) {
  try {
    let seedData;
    
    if (type === 'default') {
      const response = await fetch(`${API_BASE}/seed/default`);
      seedData = await response.json();
    } else {
      const response = await fetch(`${API_BASE}/seed/bad-examples`);
      const examples = await response.json();
      
      if (type === 'bad-example-1') {
        seedData = examples[0];
      } else {
        seedData = examples[1];
      }
    }
    
    setConfig(seedData);
    switchTab('experiment');
    showToast('预设样例已加载', 'success');
    
  } catch (error) {
    console.error('加载预设样例失败:', error);
    showToast('加载预设样例失败', 'error');
  }
}

async function exportMarkdown() {
  if (!currentExperiment) {
    showToast('请先运行或查看一个实验', 'error');
    return;
  }
  
  try {
    const response = await fetch(`${API_BASE}/experiments/${currentExperiment.id}/export/markdown`);
    const markdown = await response.text();
    
    downloadFile(markdown, `${currentExperiment.name}.md`, 'text/markdown');
    showToast('Markdown 报告已导出', 'success');
  } catch (error) {
    console.error('导出 Markdown 失败:', error);
    showToast('导出失败', 'error');
  }
}

async function exportJSON() {
  if (!currentExperiment) {
    showToast('请先运行或查看一个实验', 'error');
    return;
  }
  
  try {
    const response = await fetch(`${API_BASE}/experiments/${currentExperiment.id}/export/json`);
    const json = await response.text();
    
    downloadFile(json, `${currentExperiment.name}.json`, 'application/json');
    showToast('JSON 报告已导出', 'success');
  } catch (error) {
    console.error('导出 JSON 失败:', error);
    showToast('导出失败', 'error');
  }
}

function downloadFile(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast show ${type}`;
  
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}
