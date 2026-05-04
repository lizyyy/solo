const API_BASE = '/api';
let currentRiskPage = 1;
let currentSamplePage = 1;
const RISK_PAGE_SIZE = 10;
const SAMPLE_PAGE_SIZE = 20;
let currentRiskId = null;
let charts = {};

document.addEventListener('DOMContentLoaded', function() {
  initTabs();
  initUploadArea();
  initDateInputs();
  initFollowUpCheckbox();
  
  refreshDashboard();
  loadSamplePoints();
});

function initTabs() {
  const tabs = document.querySelectorAll('.nav-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', function() {
      const targetTab = this.dataset.tab;
      switchTab(targetTab);
    });
  });
}

function switchTab(tabName) {
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.classList.remove('active');
    if (tab.dataset.tab === tabName) {
      tab.classList.add('active');
    }
  });

  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.remove('active');
  });
  document.getElementById(tabName).classList.add('active');

  if (tabName === 'risks') {
    loadRisks();
  } else if (tabName === 'samples') {
    loadSamples();
  } else if (tabName === 'charts') {
    loadCharts();
  }
}

function initUploadArea() {
  const uploadArea = document.getElementById('uploadArea');
  const fileInput = document.getElementById('csvFile');

  uploadArea.addEventListener('click', function() {
    fileInput.click();
  });

  uploadArea.addEventListener('dragover', function(e) {
    e.preventDefault();
    this.classList.add('dragover');
  });

  uploadArea.addEventListener('dragleave', function() {
    this.classList.remove('dragover');
  });

  uploadArea.addEventListener('drop', function(e) {
    e.preventDefault();
    this.classList.remove('dragover');
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  });

  fileInput.addEventListener('change', function() {
    if (this.files.length > 0) {
      handleFileUpload(this.files[0]);
    }
  });
}

function initDateInputs() {
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('handoverDate').value = today;
  
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekAgoStr = weekAgo.toISOString().split('T')[0];
  
  document.getElementById('chartStartDate').value = weekAgoStr;
  document.getElementById('chartEndDate').value = today;
  document.getElementById('sampleStartDate').value = weekAgoStr;
  document.getElementById('sampleEndDate').value = today;
  document.getElementById('auditStartDate').value = weekAgoStr;
  document.getElementById('auditEndDate').value = today;
}

function initFollowUpCheckbox() {
  const followUpCheckbox = document.getElementById('followUpNeeded');
  const followUpTimeGroup = document.getElementById('followUpTimeGroup');
  
  followUpCheckbox.addEventListener('change', function() {
    followUpTimeGroup.style.display = this.checked ? 'block' : 'none';
  });
}

async function handleFileUpload(file) {
  if (!file.name.toLowerCase().endsWith('.csv')) {
    showImportResult('error', '请选择CSV格式的文件');
    return;
  }

  const formData = new FormData();
  formData.append('file', file);
  
  const operator = document.getElementById('importOperator').value;
  if (operator) {
    formData.append('operator', operator);
  }

  showImportResult('info', '正在导入数据...');

  try {
    const response = await fetch(`${API_BASE}/samples/import`, {
      method: 'POST',
      body: formData
    });

    const result = await response.json();

    if (result.success) {
      const data = result.data;
      showImportResult('success', 
        `导入成功！\n总记录数: ${data.total}\n成功: ${data.successCount}\n失败: ${data.errorCount}` +
        (data.errors.length > 0 ? `\n错误: ${data.errors.map(e => `行${e.row}: ${e.error}`).join(', ')}` : '')
      );
      refreshDashboard();
    } else {
      showImportResult('error', `导入失败: ${result.error}`);
    }
  } catch (error) {
    showImportResult('error', `导入失败: ${error.message}`);
  }
}

function showImportResult(type, message) {
  const resultDiv = document.getElementById('importResult');
  resultDiv.style.display = 'block';
  
  const alertClass = type === 'success' ? 'alert-success' : 
                      type === 'error' ? 'alert-error' : 
                      type === 'warning' ? 'alert-warning' : 'alert-info';
  
  resultDiv.innerHTML = `<div class="alert ${alertClass}">${message.replace(/\n/g, '<br>')}</div>`;
}

async function refreshDashboard() {
  try {
    const [samplesResponse, risksResponse] = await Promise.all([
      fetch(`${API_BASE}/samples/statistics`),
      fetch(`${API_BASE}/risks/statistics/summary`)
    ]);

    const samplesData = await samplesResponse.json();
    const risksData = await risksResponse.json();

    if (samplesData.success) {
      const stats = samplesData.data;
      document.getElementById('stat-samples').textContent = stats.totalSamples;
      document.getElementById('stat-active-risks').textContent = stats.activeRisks;
      document.getElementById('stat-warning').textContent = stats.statusDistribution.warning;
      document.getElementById('stat-normal').textContent = stats.statusDistribution.normal;
    }

    if (risksData.success) {
      const stats = risksData.data;
      document.getElementById('stat-pending').textContent = stats.byStatus.pending;
      document.getElementById('stat-reviewing').textContent = stats.byStatus.reviewing;
      document.getElementById('stat-resolved').textContent = stats.byStatus.resolved;
      document.getElementById('stat-total-risks').textContent = 
        stats.byStatus.pending + stats.byStatus.reviewing + stats.byStatus.resolved;
    }
  } catch (error) {
    console.error('Error loading dashboard:', error);
  }
}

async function loadSamplePoints() {
  try {
    const response = await fetch(`${API_BASE}/samples/sample-points`);
    const result = await response.json();

    if (result.success) {
      const samplePoints = result.data;
      
      const chartSelect = document.getElementById('chartSamplePoint');
      const sampleSelect = document.getElementById('samplePointFilter');
      
      chartSelect.innerHTML = '<option value="">全部采样点</option>';
      sampleSelect.innerHTML = '<option value="">全部</option>';
      
      samplePoints.forEach(point => {
        chartSelect.innerHTML += `<option value="${point}">${point}</option>`;
        sampleSelect.innerHTML += `<option value="${point}">${point}</option>`;
      });
    }
  } catch (error) {
    console.error('Error loading sample points:', error);
  }
}

async function loadRisks() {
  const container = document.getElementById('risksContainer');
  container.innerHTML = '<div class="loading">加载中</div>';

  const status = document.getElementById('riskStatusFilter').value;
  const riskType = document.getElementById('riskTypeFilter').value;
  const severity = document.getElementById('riskSeverityFilter').value;

  let url = `${API_BASE}/risks?page=${currentRiskPage}&limit=${RISK_PAGE_SIZE}&includeResolved=true`;
  
  if (status) url += `&status=${status}`;
  if (riskType) url += `&riskType=${riskType}`;
  if (severity) url += `&severity=${severity}`;

  try {
    const response = await fetch(url);
    const result = await response.json();

    if (result.success) {
      const { risks, pagination } = result.data;
      
      if (risks.length === 0) {
        container.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon">✅</div>
            <h3>暂无风险记录</h3>
            <p>导入数据后，系统会自动检测风险</p>
          </div>
        `;
      } else {
        container.innerHTML = risks.map(risk => renderRiskItem(risk)).join('');
      }

      updateRiskPagination(pagination);
    } else {
      container.innerHTML = `<div class="alert alert-error">加载失败: ${result.error}</div>`;
    }
  } catch (error) {
    container.innerHTML = `<div class="alert alert-error">加载失败: ${error.message}</div>`;
  }
}

function renderRiskItem(risk) {
  const detectionTime = new Date(risk.detectionTime).toLocaleString('zh-CN');
  
  return `
    <div class="risk-item">
      <div class="risk-header" onclick="toggleRiskBody(this)">
        <div class="risk-info">
          <div class="risk-severity ${risk.severity}"></div>
          <div>
            <div class="risk-title">#${risk.id} - ${risk.riskTypeName}</div>
            <div class="risk-meta">
              <span>采样点: ${risk.samplePoint}</span>
              <span>参数: ${risk.affectedParameterName}</span>
              <span>检测时间: ${detectionTime}</span>
            </div>
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <span class="risk-status ${risk.status}">${risk.statusName}</span>
          <span style="color: var(--text-secondary);">▼</span>
        </div>
      </div>
      <div class="risk-body">
        <div class="risk-section">
          <div class="risk-section-title">风险详情</div>
          <div class="risk-detail">
            <div class="risk-detail-item">
              <span class="risk-detail-label">风险类型</span>
              <span>${risk.riskTypeName}</span>
            </div>
            <div class="risk-detail-item">
              <span class="risk-detail-label">严重程度</span>
              <span>${risk.severityName}</span>
            </div>
            <div class="risk-detail-item">
              <span class="risk-detail-label">采样点</span>
              <span>${risk.samplePoint}</span>
            </div>
            <div class="risk-detail-item">
              <span class="risk-detail-label">受影响参数</span>
              <span>${risk.affectedParameterName}</span>
            </div>
          </div>
        </div>
        
        <div class="risk-section">
          <div class="risk-section-title">描述</div>
          <p style="font-size: 0.9rem; color: var(--text-secondary);">${risk.description}</p>
        </div>
        
        ${risk.revisedStatus ? `
        <div class="risk-section">
          <div class="risk-section-title">改判信息</div>
          <div class="risk-detail">
            <div class="risk-detail-item">
              <span class="risk-detail-label">改判状态</span>
              <span>${risk.revisedStatus}</span>
            </div>
            <div class="risk-detail-item">
              <span class="risk-detail-label">改判原因</span>
              <span>${risk.revisedReason || '-'}</span>
            </div>
            <div class="risk-detail-item">
              <span class="risk-detail-label">改判人员</span>
              <span>${risk.revisedBy || '-'}</span>
            </div>
          </div>
        </div>
        ` : ''}
        
        ${risk.disposals && risk.disposals.length > 0 ? `
        <div class="risk-section">
          <div class="risk-section-title">处置记录 (${risk.disposals.length})</div>
          ${risk.disposals.slice(0, 3).map(d => `
            <div style="padding: 0.5rem; background: var(--bg-color); border-radius: 4px; margin-bottom: 0.5rem; font-size: 0.85rem;">
              <div><strong>${new Date(d.disposedAt).toLocaleString('zh-CN')}</strong> - ${d.disposer}</div>
              <div>类型: ${d.disposalType === 'CHLORINE_ADD' ? '加氯' : d.disposalType === 'PH_ADJUST' ? '调pH' : d.disposalType === 'FILTER_BACKWASH' ? '反冲洗' : d.disposalType === 'WATER_REPLACE' ? '换水' : d.disposalType === 'ALGAECIDE_ADD' ? '除藻' : '其他'}</div>
              ${d.description ? `<div>描述: ${d.description}</div>` : ''}
            </div>
          `).join('')}
        </div>
        ` : ''}
        
        <div class="risk-actions">
          ${(risk.status === 'PENDING' || risk.status === 'REVIEWING') ? `
            <button class="btn btn-warning" onclick="openReviseModal(${risk.id})">
              ✏️ 改判
            </button>
            <button class="btn btn-primary" onclick="openDisposeModal(${risk.id})">
              🔧 处置
            </button>
            <button class="btn btn-success" onclick="openResolveModal(${risk.id})">
              ✅ 解决
            </button>
            <button class="btn btn-secondary" onclick="dismissRisk(${risk.id})">
              📤 忽略
            </button>
          ` : ''}
        </div>
      </div>
    </div>
  `;
}

function toggleRiskBody(header) {
  const body = header.nextElementSibling;
  body.classList.toggle('expanded');
}

function updateRiskPagination(pagination) {
  const paginationDiv = document.getElementById('riskPagination');
  
  if (pagination.totalPages <= 1) {
    paginationDiv.style.display = 'none';
    return;
  }
  
  paginationDiv.style.display = 'flex';
  document.getElementById('riskPageInfo').textContent = `第 ${pagination.page} 页 / 共 ${pagination.totalPages} 页`;
  
  document.getElementById('prevRiskPage').disabled = pagination.page <= 1;
  document.getElementById('nextRiskPage').disabled = pagination.page >= pagination.totalPages;
}

function prevRiskPage() {
  if (currentRiskPage > 1) {
    currentRiskPage--;
    loadRisks();
  }
}

function nextRiskPage() {
  currentRiskPage++;
  loadRisks();
}

function clearRiskFilters() {
  document.getElementById('riskStatusFilter').value = '';
  document.getElementById('riskTypeFilter').value = '';
  document.getElementById('riskSeverityFilter').value = '';
  currentRiskPage = 1;
  loadRisks();
}

async function loadSamples() {
  const tbody = document.getElementById('samplesTableBody');
  tbody.innerHTML = '<tr><td colspan="8" class="loading">加载中</td></tr>';

  const samplePoint = document.getElementById('samplePointFilter').value;
  const startDate = document.getElementById('sampleStartDate').value;
  const endDate = document.getElementById('sampleEndDate').value;

  let url = `${API_BASE}/samples?page=${currentSamplePage}&limit=${SAMPLE_PAGE_SIZE}`;
  
  if (samplePoint) url += `&samplePoint=${samplePoint}`;
  if (startDate) url += `&startDate=${startDate}`;
  if (endDate) url += `&endDate=${endDate}`;

  try {
    const response = await fetch(url);
    const result = await response.json();

    if (result.success) {
      const { samples, pagination } = result.data;
      
      if (samples.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="empty-state" style="text-align: center;">暂无采样数据</td></tr>';
      } else {
        tbody.innerHTML = samples.map(sample => renderSampleRow(sample)).join('');
      }

      updateSamplePagination(pagination);
    } else {
      tbody.innerHTML = `<tr><td colspan="8" class="alert alert-error">加载失败: ${result.error}</td></tr>`;
    }
  } catch (error) {
    tbody.innerHTML = `<tr><td colspan="8" class="alert alert-error">加载失败: ${error.message}</td></tr>`;
  }
}

function renderSampleRow(sample) {
  const sampleTime = new Date(sample.sampleTime).toLocaleString('zh-CN');
  
  return `
    <tr>
      <td>${sample.samplePoint}</td>
      <td>${sampleTime}</td>
      <td>
        <span class="status-badge ${sample.parameterStatus.chlorine}">${sample.chlorine}</span>
      </td>
      <td>
        <span class="status-badge ${sample.parameterStatus.ph}">${sample.ph}</span>
      </td>
      <td>
        <span class="status-badge ${sample.parameterStatus.turbidity}">${sample.turbidity}</span>
      </td>
      <td>
        <span class="status-badge ${sample.parameterStatus.temperature}">${sample.temperature}°C</span>
      </td>
      <td>${sample.operator || '-'}</td>
      <td>${sample.sourceFile || '-'}</td>
    </tr>
  `;
}

function updateSamplePagination(pagination) {
  const paginationDiv = document.getElementById('samplePagination');
  
  if (pagination.totalPages <= 1) {
    paginationDiv.style.display = 'none';
    return;
  }
  
  paginationDiv.style.display = 'flex';
  document.getElementById('samplePageInfo').textContent = `第 ${pagination.page} 页 / 共 ${pagination.totalPages} 页`;
  
  document.getElementById('prevSamplePage').disabled = pagination.page <= 1;
  document.getElementById('nextSamplePage').disabled = pagination.page >= pagination.totalPages;
}

function prevSamplePage() {
  if (currentSamplePage > 1) {
    currentSamplePage--;
    loadSamples();
  }
}

function nextSamplePage() {
  currentSamplePage++;
  loadSamples();
}

async function loadCharts() {
  const samplePoint = document.getElementById('chartSamplePoint').value;
  const startDate = document.getElementById('chartStartDate').value;
  const endDate = document.getElementById('chartEndDate').value;

  let url = `${API_BASE}/samples/chart-data?`;
  const params = [];
  
  if (samplePoint) params.push(`samplePoint=${samplePoint}`);
  if (startDate) params.push(`startDate=${startDate}`);
  if (endDate) params.push(`endDate=${endDate}`);
  
  url += params.join('&');

  try {
    const response = await fetch(url);
    const result = await response.json();

    if (result.success) {
      const chartData = result.data;
      renderCharts(chartData);
    }
  } catch (error) {
    console.error('Error loading charts:', error);
  }
}

function renderCharts(chartData) {
  const samplePoints = Object.keys(chartData);
  
  if (samplePoints.length === 0) {
    return;
  }

  const selectedPoint = samplePoints[0];
  
  Object.keys(charts).forEach(key => {
    if (charts[key]) {
      charts[key].destroy();
    }
  });

  const params = ['chlorine', 'ph', 'turbidity', 'temperature'];
  const colors = {
    chlorine: 'rgb(52, 152, 219)',
    ph: 'rgb(46, 204, 113)',
    turbidity: 'rgb(241, 196, 15)',
    temperature: 'rgb(231, 76, 60)'
  };

  params.forEach(param => {
    const data = chartData[selectedPoint]?.[param];
    if (!data) return;

    const ctx = document.getElementById(`${param}Chart`).getContext('2d');
    
    const datasets = [{
      label: selectedPoint,
      data: data.values,
      borderColor: colors[param],
      backgroundColor: colors[param].replace('rgb', 'rgba').replace(')', ', 0.1)'),
      fill: true,
      tension: 0.4,
      pointRadius: 4,
      pointHoverRadius: 6
    }];

    if (samplePoints.length > 1) {
      samplePoints.forEach((point, idx) => {
        if (idx === 0) return;
        const pointData = chartData[point]?.[param];
        if (pointData) {
          const hue = (idx * 360 / samplePoints.length) % 360;
          datasets.push({
            label: point,
            data: pointData.values,
            borderColor: `hsl(${hue}, 70%, 50%)`,
            backgroundColor: `hsla(${hue}, 70%, 50%, 0.1)`,
            fill: false,
            tension: 0.4,
            pointRadius: 3,
            pointHoverRadius: 5
          });
        }
      });
    }

    charts[param] = new Chart(ctx, {
      type: 'line',
      data: {
        labels: data.labels,
        datasets: datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: samplePoints.length > 1,
            position: 'top'
          },
          tooltip: {
            mode: 'index',
            intersect: false
          }
        },
        scales: {
          x: {
            display: true,
            grid: {
              display: false
            }
          },
          y: {
            display: true,
            grid: {
              color: 'rgba(0,0,0,0.05)'
            }
          }
        },
        interaction: {
          mode: 'nearest',
          axis: 'x',
          intersect: false
        }
      }
    });
  });
}

function openReviseModal(riskId) {
  currentRiskId = riskId;
  document.getElementById('revisedStatus').value = 'NORMAL';
  document.getElementById('revisedReason').value = '';
  document.getElementById('revisedBy').value = '';
  document.getElementById('reviseModal').classList.add('active');
}

function openDisposeModal(riskId) {
  currentRiskId = riskId;
  document.getElementById('disposer').value = '';
  document.getElementById('disposalType').value = 'CHLORINE_ADD';
  document.getElementById('disposalAmount').value = '';
  document.getElementById('disposalUnit').value = '';
  document.getElementById('beforeValue').value = '';
  document.getElementById('targetValue').value = '';
  document.getElementById('disposalDescription').value = '';
  document.getElementById('followUpNeeded').checked = false;
  document.getElementById('followUpTimeGroup').style.display = 'none';
  document.getElementById('followUpTime').value = '';
  document.getElementById('disposalRemark').value = '';
  document.getElementById('disposeModal').classList.add('active');
}

function openResolveModal(riskId) {
  currentRiskId = riskId;
  document.getElementById('treatmentResult').value = '';
  document.getElementById('treatedBy').value = '';
  document.getElementById('afterValue').value = '';
  document.getElementById('resolveModal').classList.add('active');
}

function closeModal(modalId) {
  document.getElementById(modalId).classList.remove('active');
  currentRiskId = null;
}

async function submitRevise() {
  const revisedStatus = document.getElementById('revisedStatus').value;
  const revisedReason = document.getElementById('revisedReason').value;
  const revisedBy = document.getElementById('revisedBy').value;

  if (!revisedReason) {
    alert('请填写改判原因');
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/risks/${currentRiskId}/revise`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        revisedStatus,
        revisedReason,
        revisedBy: revisedBy || '系统'
      })
    });

    const result = await response.json();

    if (result.success) {
      alert('改判成功！');
      closeModal('reviseModal');
      loadRisks();
      refreshDashboard();
    } else {
      alert(`改判失败: ${result.error}`);
    }
  } catch (error) {
    alert(`改判失败: ${error.message}`);
  }
}

async function submitDispose() {
  const disposer = document.getElementById('disposer').value;
  const disposalType = document.getElementById('disposalType').value;
  const disposalAmount = document.getElementById('disposalAmount').value;
  const disposalUnit = document.getElementById('disposalUnit').value;
  const beforeValue = document.getElementById('beforeValue').value;
  const targetValue = document.getElementById('targetValue').value;
  const description = document.getElementById('disposalDescription').value;
  const followUpNeeded = document.getElementById('followUpNeeded').checked;
  const followUpTime = document.getElementById('followUpTime').value;
  const remark = document.getElementById('disposalRemark').value;

  if (!disposer) {
    alert('请填写处置人员');
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/risks/${currentRiskId}/dispose`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        disposer,
        disposalType,
        disposalAmount: disposalAmount ? parseFloat(disposalAmount) : null,
        disposalUnit: disposalUnit || null,
        beforeValue: beforeValue ? parseFloat(beforeValue) : null,
        targetValue: targetValue ? parseFloat(targetValue) : null,
        description: description || null,
        followUpNeeded,
        followUpTime: followUpTime || null,
        remark: remark || null
      })
    });

    const result = await response.json();

    if (result.success) {
      alert('处置记录保存成功！');
      closeModal('disposeModal');
      loadRisks();
      refreshDashboard();
    } else {
      alert(`保存失败: ${result.error}`);
    }
  } catch (error) {
    alert(`保存失败: ${error.message}`);
  }
}

async function submitResolve() {
  const treatmentResult = document.getElementById('treatmentResult').value;
  const treatedBy = document.getElementById('treatedBy').value;
  const afterValue = document.getElementById('afterValue').value;

  if (!treatmentResult) {
    alert('请填写处理结果');
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/risks/${currentRiskId}/resolve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        treatmentResult,
        treatedBy: treatedBy || '系统',
        afterValue: afterValue ? parseFloat(afterValue) : null
      })
    });

    const result = await response.json();

    if (result.success) {
      alert('风险已解决！');
      closeModal('resolveModal');
      loadRisks();
      refreshDashboard();
    } else {
      alert(`操作失败: ${result.error}`);
    }
  } catch (error) {
    alert(`操作失败: ${error.message}`);
  }
}

async function dismissRisk(riskId) {
  if (!confirm('确定要忽略此风险吗？')) {
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/risks/${riskId}/dismiss`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        reason: '用户手动忽略'
      })
    });

    const result = await response.json();

    if (result.success) {
      alert('风险已忽略');
      loadRisks();
      refreshDashboard();
    } else {
      alert(`操作失败: ${result.error}`);
    }
  } catch (error) {
    alert(`操作失败: ${error.message}`);
  }
}

async function previewHandover() {
  const date = document.getElementById('handoverDate').value;
  const operator = document.getElementById('handoverOperator').value;
  const includeResolved = document.getElementById('includeResolved').checked;

  let url = `${API_BASE}/export/handover/preview?`;
  const params = [];
  
  if (date) params.push(`date=${date}`);
  if (operator) params.push(`operator=${encodeURIComponent(operator)}`);
  if (includeResolved) params.push(`includeResolved=true`);
  
  url += params.join('&');

  try {
    const response = await fetch(url);
    const result = await response.json();

    if (result.success) {
      document.getElementById('previewCard').style.display = 'block';
      document.getElementById('previewContent').textContent = result.data.content;
    } else {
      alert(`预览失败: ${result.error}`);
    }
  } catch (error) {
    alert(`预览失败: ${error.message}`);
  }
}

function downloadHandover() {
  const date = document.getElementById('handoverDate').value;
  const operator = document.getElementById('handoverOperator').value;
  const includeResolved = document.getElementById('includeResolved').checked;

  let url = `${API_BASE}/export/handover/markdown?`;
  const params = [];
  
  if (date) params.push(`date=${date}`);
  if (operator) params.push(`operator=${encodeURIComponent(operator)}`);
  if (includeResolved) params.push(`includeResolved=true`);
  
  url += params.join('&');
  
  window.location.href = url;
}

async function previewAudit() {
  const startDate = document.getElementById('auditStartDate').value;
  const endDate = document.getElementById('auditEndDate').value;
  const includeAllData = document.getElementById('includeAllData').checked;

  let url = `${API_BASE}/export/audit/preview?`;
  const params = [];
  
  if (startDate) params.push(`startDate=${startDate}`);
  if (endDate) params.push(`endDate=${endDate}`);
  if (includeAllData) params.push(`includeAllData=true`);
  
  url += params.join('&');

  try {
    const response = await fetch(url);
    const result = await response.json();

    if (result.success) {
      document.getElementById('previewCard').style.display = 'block';
      document.getElementById('previewContent').textContent = 
        `文件名: ${result.data.filename}\n` +
        `风险数: ${result.data.riskCount}\n` +
        `采样数: ${result.data.sampleCount}\n` +
        `生成时间: ${new Date().toLocaleString()}\n\n` +
        `点击下载按钮获取完整JSON文件`;
    } else {
      alert(`预览失败: ${result.error}`);
    }
  } catch (error) {
    alert(`预览失败: ${error.message}`);
  }
}

function downloadAudit() {
  const startDate = document.getElementById('auditStartDate').value;
  const endDate = document.getElementById('auditEndDate').value;
  const includeAllData = document.getElementById('includeAllData').checked;

  let url = `${API_BASE}/export/audit/json?`;
  const params = [];
  
  if (startDate) params.push(`startDate=${startDate}`);
  if (endDate) params.push(`endDate=${endDate}`);
  if (includeAllData) params.push(`includeAllData=true`);
  
  url += params.join('&');
  
  window.location.href = url;
}

function closePreview() {
  document.getElementById('previewCard').style.display = 'none';
}

function downloadSampleCsv() {
  const csvContent = `采样点,时间,余氯,pH,浊度,水温,当班人员
浅水池1号,2024-01-15 09:00:00,0.4,7.5,0.5,25,张三
浅水池1号,2024-01-15 10:00:00,0.38,7.6,0.6,25.5,张三
浅水池1号,2024-01-15 11:00:00,0.35,7.4,0.4,25,张三
深水池2号,2024-01-15 09:00:00,0.42,7.8,0.3,24.5,李四
深水池2号,2024-01-15 10:00:00,0.4,7.7,0.35,24,李四
深水池2号,2024-01-15 11:00:00,0.39,7.6,0.3,24.5,李四
入口池3号,2024-01-15 09:00:00,0.2,7.2,1.2,26,王五
入口池3号,2024-01-15 10:00:00,0.18,7.0,1.5,26.5,王五
入口池3号,2024-01-15 11:00:00,0.15,6.9,1.8,27,王五`;

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = '水质采样示例.csv';
  link.click();
}
