// 全局状态
let currentSchedule = null;
let currentFacadeId = null;
let allData = null;

// DOM 元素
const elements = {
  currentDate: document.getElementById('currentDate'),
  refreshBtn: document.getElementById('refreshBtn'),
  importSampleBtn: document.getElementById('importSampleBtn'),
  dataContent: document.getElementById('dataContent'),
  scheduleList: document.getElementById('scheduleList'),
  totalFacades: document.getElementById('totalFacades'),
  feasibleCount: document.getElementById('feasibleCount'),
  notFeasibleCount: document.getElementById('notFeasibleCount'),
  saveScheduleBtn: document.getElementById('saveScheduleBtn'),
  exportMarkdownBtn: document.getElementById('exportMarkdownBtn'),
  exportJsonBtn: document.getElementById('exportJsonBtn'),
  viewHistoryBtn: document.getElementById('viewHistoryBtn'),
  detailModal: document.getElementById('detailModal'),
  modalTitle: document.getElementById('modalTitle'),
  modalBody: document.getElementById('modalBody'),
  modalClose: document.querySelector('.modal-close'),
  reviewText: document.getElementById('reviewText'),
  reviewDecision: document.getElementById('reviewDecision'),
  saveReviewBtn: document.getElementById('saveReviewBtn'),
  historyModal: document.getElementById('historyModal'),
  historyBody: document.getElementById('historyBody'),
  notification: document.getElementById('notification'),
  notificationMessage: document.getElementById('notificationMessage')
};

// API 基础 URL
const API_BASE = '/api';

// 初始化应用
async function initApp() {
  // 显示当前日期
  const today = new Date();
  elements.currentDate.textContent = today.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long'
  });

  // 绑定事件
  bindEvents();

  // 加载数据
  await loadAllData();
  await loadSchedule();

  // 设置数据标签页
  setupDataTabs();
}

// 绑定事件
function bindEvents() {
  // 刷新按钮
  elements.refreshBtn.addEventListener('click', async () => {
    showNotification('正在刷新数据...', 'info');
    await loadAllData();
    await loadSchedule();
    showNotification('数据已刷新', 'success');
  });

  // 导入示例数据按钮
  elements.importSampleBtn.addEventListener('click', async () => {
    if (confirm('确定要导入示例数据吗？这将覆盖现有数据。')) {
      try {
        const response = await fetch(`${API_BASE}/import-sample`, { method: 'POST' });
        const result = await response.json();
        if (result.success) {
          showNotification('示例数据导入成功', 'success');
          await loadAllData();
          await loadSchedule();
        } else {
          showNotification(result.message, 'error');
        }
      } catch (error) {
        showNotification('导入失败: ' + error.message, 'error');
      }
    }
  });

  // 保存排班按钮
  elements.saveScheduleBtn.addEventListener('click', async () => {
    if (!currentSchedule) {
      showNotification('没有可保存的排班数据', 'error');
      return;
    }
    try {
      const response = await fetch(`${API_BASE}/schedule/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schedule: currentSchedule })
      });
      const result = await response.json();
      if (result.success) {
        showNotification('排班已保存', 'success');
      } else {
        showNotification(result.message, 'error');
      }
    } catch (error) {
      showNotification('保存失败: ' + error.message, 'error');
    }
  });

  // 导出 Markdown 按钮
  elements.exportMarkdownBtn.addEventListener('click', async () => {
    if (!currentSchedule) {
      showNotification('没有可导出的排班数据', 'error');
      return;
    }
    try {
      const response = await fetch(`${API_BASE}/export/markdown`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduleData: currentSchedule })
      });
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `开工单-${new Date().toISOString().split('T')[0]}.md`;
      a.click();
      window.URL.revokeObjectURL(url);
      showNotification('Markdown 开工单已导出', 'success');
    } catch (error) {
      showNotification('导出失败: ' + error.message, 'error');
    }
  });

  // 导出 JSON 按钮
  elements.exportJsonBtn.addEventListener('click', async () => {
    if (!currentSchedule) {
      showNotification('没有可导出的排班数据', 'error');
      return;
    }
    try {
      const response = await fetch(`${API_BASE}/export/json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduleData: currentSchedule })
      });
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `审计明细-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      window.URL.revokeObjectURL(url);
      showNotification('JSON 审计明细已导出', 'success');
    } catch (error) {
      showNotification('导出失败: ' + error.message, 'error');
    }
  });

  // 查看历史记录按钮
  elements.viewHistoryBtn.addEventListener('click', async () => {
    await loadHistory();
    elements.historyModal.classList.add('active');
  });

  // 模态框关闭按钮
  elements.modalClose.addEventListener('click', () => {
    elements.detailModal.classList.remove('active');
    elements.historyModal.classList.remove('active');
  });

  // 点击模态框外部关闭
  elements.detailModal.addEventListener('click', (e) => {
    if (e.target === elements.detailModal) {
      elements.detailModal.classList.remove('active');
    }
  });

  elements.historyModal.addEventListener('click', (e) => {
    if (e.target === elements.historyModal) {
      elements.historyModal.classList.remove('active');
    }
  });

  // 保存复核备注
  elements.saveReviewBtn.addEventListener('click', async () => {
    if (!currentFacadeId) return;
    
    const reviewData = {
      text: elements.reviewText.value,
      decision: elements.reviewDecision.value
    };
    
    try {
      const response = await fetch(`${API_BASE}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ facadeId: currentFacadeId, reviewData })
      });
      const result = await response.json();
      if (result.success) {
        showNotification('复核备注已保存', 'success');
        elements.detailModal.classList.remove('active');
      } else {
        showNotification(result.message, 'error');
      }
    } catch (error) {
      showNotification('保存失败: ' + error.message, 'error');
    }
  });
}

// 设置数据标签页
function setupDataTabs() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      // 移除所有活跃状态
      tabBtns.forEach(b => b.classList.remove('active'));
      // 设置当前活跃
      btn.classList.add('active');
      // 显示对应数据
      const tabType = btn.dataset.tab;
      renderDataContent(tabType);
    });
  });
  // 默认显示第一个标签页
  renderDataContent('gondolas');
}

// 渲染数据内容
function renderDataContent(type) {
  if (!allData) {
    elements.dataContent.innerHTML = '<div class="loading">加载中...</div>';
    return;
  }

  let html = '';
  const typeNames = {
    gondolas: '吊篮',
    workers: '工人',
    facades: '立面分区',
    wind: '风速预报',
    noise: '禁噪时段'
  };

  switch (type) {
    case 'gondolas':
      allData.gondolas.forEach(item => {
        const statusText = item.status === 'available' ? '可用' : item.status === 'maintenance' ? '维护中' : '不可用';
        const statusClass = item.status === 'available' ? 'status-feasible' : 'status-not-feasible';
        html += `
          <div class="data-item">
            <div class="data-item-name">${item.name} <span class="schedule-item-status ${statusClass}">${statusText}</span></div>
            <div class="data-item-detail">
              容量: ${item.capacity}人 | 最大风速: ${item.maxWindSpeed}m/s<br>
              覆盖立面: ${item.facades.join(', ')}
            </div>
          </div>
        `;
      });
      break;

    case 'workers':
      allData.workers.forEach(item => {
        const statusText = item.status === 'available' ? '在岗' : item.status === 'leave' ? '休假' : '不可用';
        const statusClass = item.status === 'available' ? 'status-feasible' : 'status-not-feasible';
        html += `
          <div class="data-item">
            <div class="data-item-name">${item.name} <span class="schedule-item-status ${statusClass}">${statusText}</span></div>
            <div class="data-item-detail">
              工龄: ${item.experience}年<br>
              资质: ${item.certifications.join('、')}
            </div>
          </div>
        `;
      });
      break;

    case 'facades':
      allData.facades.forEach(item => {
        const directionMap = { 'N': '北', 'S': '南', 'E': '东', 'W': '西' };
        html += `
          <div class="data-item">
            <div class="data-item-name">${item.name}</div>
            <div class="data-item-detail">
              方向: ${directionMap[item.direction] || item.direction} | 楼层: ${item.floors} | 面积: ${item.area}㎡
              ${item.specialRequirements.length > 0 ? `<br>特殊要求: ${item.specialRequirements.join('、')}` : ''}
            </div>
          </div>
        `;
      });
      break;

    case 'wind':
      if (allData.windForecast.length === 0) {
        html = '<div class="empty-state"><div class="empty-state-icon">🌬️</div><div class="empty-state-text">暂无风速预报数据</div></div>';
      } else {
        const directionMap = { 'N': '北', 'S': '南', 'E': '东', 'W': '西' };
        const riskMap = { 'low': '低', 'medium': '中', 'high': '高' };
        allData.windForecast.forEach(item => {
          const riskClass = item.riskLevel === 'low' ? 'status-feasible' : item.riskLevel === 'medium' ? 'schedule-item-status' : 'status-not-feasible';
          html += `
            <div class="data-item">
              <div class="data-item-name">${item.date} <span class="schedule-item-status ${riskClass}">风险: ${riskMap[item.riskLevel]}</span></div>
              <div class="data-item-detail">
                风向: ${directionMap[item.direction] || item.direction} | 风速: ${item.speed}m/s (最大 ${item.maxSpeed}m/s)
              </div>
            </div>
          `;
        });
      }
      break;

    case 'noise':
      if (allData.noiseRestrictions.length === 0) {
        html = '<div class="empty-state"><div class="empty-state-icon">🔇</div><div class="empty-state-text">暂无禁噪时段数据</div></div>';
      } else {
        // 按日期分组
        const grouped = {};
        allData.noiseRestrictions.forEach(item => {
          if (!grouped[item.date]) grouped[item.date] = [];
          grouped[item.date].push(item);
        });
        
        Object.keys(grouped).forEach(date => {
          html += `
            <div class="data-item">
              <div class="data-item-name">${date}</div>
              <div class="data-item-detail">
                ${grouped[date].map(item => `${item.startTime} - ${item.endTime}: ${item.reason}`).join('<br>')}
              </div>
            </div>
          `;
        });
      }
      break;
  }

  if (html === '') {
    html = '<div class="empty-state"><div class="empty-state-icon">📋</div><div class="empty-state-text">暂无数据，请导入示例数据</div></div>';
  }

  elements.dataContent.innerHTML = html;
}

// 加载所有数据
async function loadAllData() {
  try {
    const response = await fetch(`${API_BASE}/data`);
    const result = await response.json();
    if (result.success) {
      allData = result.data;
      // 保存到 localStorage 作为备份
      localStorage.setItem('allData', JSON.stringify(allData));
    }
  } catch (error) {
    console.error('加载数据失败:', error);
    // 尝试从 localStorage 恢复
    const savedData = localStorage.getItem('allData');
    if (savedData) {
      allData = JSON.parse(savedData);
    }
  }
}

// 加载今日排班
async function loadSchedule() {
  try {
    const response = await fetch(`${API_BASE}/schedule/today`);
    const result = await response.json();
    if (result.success) {
      currentSchedule = result.schedule;
      // 保存到 localStorage
      localStorage.setItem('currentSchedule', JSON.stringify(currentSchedule));
      // 渲染界面
      renderScheduleSummary();
      renderBuildingVisualization();
      renderScheduleList();
    }
  } catch (error) {
    console.error('加载排班失败:', error);
    // 尝试从 localStorage 恢复
    const savedSchedule = localStorage.getItem('currentSchedule');
    if (savedSchedule) {
      currentSchedule = JSON.parse(savedSchedule);
      renderScheduleSummary();
      renderBuildingVisualization();
      renderScheduleList();
    }
  }
}

// 渲染排班摘要
function renderScheduleSummary() {
  if (!currentSchedule) return;
  
  elements.totalFacades.textContent = currentSchedule.totalFacades;
  elements.feasibleCount.textContent = currentSchedule.feasibleCount;
  elements.notFeasibleCount.textContent = currentSchedule.notFeasibleCount;
}

// 渲染楼体可视化
function renderBuildingVisualization() {
  if (!currentSchedule) return;
  
  const directionMap = {
    'N': { element: 'northZones', isHorizontal: true },
    'E': { element: 'eastZones', isHorizontal: false },
    'S': { element: 'southZones', isHorizontal: true },
    'W': { element: 'westZones', isHorizontal: false }
  };
  
  // 清空所有区域
  Object.values(directionMap).forEach(d => {
    document.getElementById(d.element).innerHTML = '';
  });
  
  // 按方向分组渲染
  currentSchedule.results.forEach(result => {
    const direction = result.direction;
    const dirConfig = directionMap[direction];
    if (!dirConfig) return;
    
    const container = document.getElementById(dirConfig.element);
    const zoneElement = document.createElement('div');
    
    // 确定状态类
    let statusClass = 'not-feasible';
    if (result.feasible) {
      // 检查是否有禁噪提示
      if (result.noiseStatus && result.noiseStatus.restricted) {
        statusClass = 'warning';
      } else {
        statusClass = 'feasible';
      }
    }
    
    zoneElement.className = `zone ${statusClass}`;
    zoneElement.textContent = result.facadeId;
    zoneElement.title = result.facadeName;
    
    // 点击事件
    zoneElement.addEventListener('click', () => {
      showFacadeDetail(result);
    });
    
    container.appendChild(zoneElement);
  });
}

// 渲染排班列表
function renderScheduleList() {
  if (!currentSchedule) {
    elements.scheduleList.innerHTML = '<div class="loading">加载中...</div>';
    return;
  }
  
  let html = '';
  
  // 先显示可开工的，再显示不可开工的
  const feasibleResults = currentSchedule.results.filter(r => r.feasible);
  const notFeasibleResults = currentSchedule.results.filter(r => !r.feasible);
  
  if (feasibleResults.length > 0) {
    html += '<h4 style="margin-bottom: 0.5rem; color: #155724;">✅ 可开工立面</h4>';
    feasibleResults.forEach(result => {
      html += createScheduleItemHTML(result, true);
    });
  }
  
  if (notFeasibleResults.length > 0) {
    html += '<h4 style="margin: 1rem 0 0.5rem; color: #721c24;">❌ 不可开工立面</h4>';
    notFeasibleResults.forEach(result => {
      html += createScheduleItemHTML(result, false);
    });
  }
  
  elements.scheduleList.innerHTML = html;
  
  // 绑定点击事件
  document.querySelectorAll('.schedule-item').forEach(item => {
    item.addEventListener('click', () => {
      const facadeId = item.dataset.facadeId;
      const result = currentSchedule.results.find(r => r.facadeId === facadeId);
      if (result) {
        showFacadeDetail(result);
      }
    });
  });
}

// 创建排班项 HTML
function createScheduleItemHTML(result, isFeasible) {
  const statusClass = isFeasible ? 'status-feasible' : 'status-not-feasible';
  const statusText = isFeasible ? '可开工' : '不可开工';
  
  // 取第一个原因作为摘要
  const reasonText = result.reasons.length > 0 ? result.reasons[0] : '';
  
  return `
    <div class="schedule-item" data-facade-id="${result.facadeId}">
      <div class="schedule-item-header">
        <span class="schedule-item-name">${result.facadeName}</span>
        <span class="schedule-item-status ${statusClass}">${statusText}</span>
      </div>
      <div class="schedule-item-reason">${reasonText}</div>
    </div>
  `;
}

// 显示立面详情
function showFacadeDetail(result) {
  currentFacadeId = result.facadeId;
  elements.modalTitle.textContent = result.facadeName + ' - 详细信息';
  
  const directionMap = { 'N': '北', 'S': '南', 'E': '东', 'W': '西' };
  
  let html = `
    <div class="detail-section">
      <h4>基本信息</h4>
      <div class="detail-item">
        <span class="detail-label">立面ID:</span>
        <span class="detail-value">${result.facadeId}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">方向:</span>
        <span class="detail-value">${directionMap[result.direction] || result.direction}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">楼层:</span>
        <span class="detail-value">${result.floors}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">面积:</span>
        <span class="detail-value">${result.area} ㎡</span>
      </div>
      ${result.specialRequirements.length > 0 ? `
        <div class="detail-item">
          <span class="detail-label">特殊要求:</span>
          <span class="detail-value">${result.specialRequirements.join('、')}</span>
        </div>
      ` : ''}
    </div>
  `;
  
  // 可用资源
  html += `
    <div class="detail-section">
      <h4>可用资源</h4>
      <div class="detail-item">
        <span class="detail-label">可用吊篮:</span>
        <span class="detail-value">${result.availableGondolas.length > 0 ? result.availableGondolas.map(g => g.name).join('、') : '无'}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">可用工人:</span>
        <span class="detail-value">${result.availableWorkers.length > 0 ? result.availableWorkers.map(w => w.name).join('、') : '无'}</span>
      </div>
    </div>
  `;
  
  // 风速状态
  html += `
    <div class="detail-section">
      <h4>气象条件</h4>
      <div class="detail-item">
        <span class="detail-label">风速状态:</span>
        <span class="detail-value">${result.windStatus ? result.windStatus.reason : '未知'}</span>
      </div>
    </div>
  `;
  
  // 禁噪状态
  html += `
    <div class="detail-section">
      <h4>禁噪限制</h4>
      <div class="detail-item">
        <span class="detail-label">状态:</span>
        <span class="detail-value">${result.noiseStatus ? result.noiseStatus.reason : '无限制'}</span>
      </div>
    </div>
  `;
  
  // 原因分析
  html += `
    <div class="detail-section">
      <h4>原因分析</h4>
      <ul class="reason-list">
        ${result.reasons.map(r => `<li>${r}</li>`).join('')}
      </ul>
    </div>
  `;
  
  // 建议
  if (result.suggestions.length > 0) {
    html += `
      <div class="detail-section">
        <h4>建议措施</h4>
        <ul class="suggestion-list">
          ${result.suggestions.map(s => `<li>${s}</li>`).join('')}
        </ul>
      </div>
    `;
  }
  
  elements.modalBody.innerHTML = html;
  
  // 重置复核表单
  elements.reviewText.value = '';
  elements.reviewDecision.value = 'approved';
  
  // 加载已有复核
  loadExistingReview(result.facadeId);
  
  elements.detailModal.classList.add('active');
}

// 加载已有复核
async function loadExistingReview(facadeId) {
  try {
    const response = await fetch(`${API_BASE}/review?date=${new Date().toISOString().split('T')[0]}`);
    const result = await response.json();
    if (result.success && result.reviews.length > 0) {
      const review = result.reviews.find(r => r.facadeId === facadeId);
      if (review) {
        elements.reviewText.value = review.text || '';
        elements.reviewDecision.value = review.decision || 'approved';
      }
    }
  } catch (error) {
    console.error('加载复核记录失败:', error);
  }
}

// 加载历史记录
async function loadHistory() {
  try {
    const response = await fetch(`${API_BASE}/schedule/history`);
    const result = await response.json();
    if (result.success && result.history.length > 0) {
      let html = '';
      result.history.reverse().forEach(record => {
        html += `
          <div class="history-item">
            <div class="history-header">
              <span class="history-date">${record.date}</span>
              <span>${record.createdAt ? new Date(record.createdAt).toLocaleString('zh-CN') : ''}</span>
            </div>
            <div class="history-summary">
              <span>总立面: ${record.totalFacades}</span>
              <span style="color: #28a745;">可开工: ${record.feasibleCount}</span>
              <span style="color: #dc3545;">不可开工: ${record.notFeasibleCount}</span>
            </div>
          </div>
        `;
      });
      elements.historyBody.innerHTML = html;
    } else {
      elements.historyBody.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📅</div><div class="empty-state-text">暂无历史记录</div></div>';
    }
  } catch (error) {
    elements.historyBody.innerHTML = '<div class="empty-state"><div class="empty-state-icon">❌</div><div class="empty-state-text">加载历史记录失败</div></div>';
  }
}

// 显示通知
function showNotification(message, type = 'info') {
  elements.notificationMessage.textContent = message;
  elements.notification.className = `notification ${type} show`;
  
  setTimeout(() => {
    elements.notification.classList.remove('show');
  }, 3000);
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', initApp);

// 页面关闭前保存数据到 localStorage
window.addEventListener('beforeunload', () => {
  if (allData) {
    localStorage.setItem('allData', JSON.stringify(allData));
  }
  if (currentSchedule) {
    localStorage.setItem('currentSchedule', JSON.stringify(currentSchedule));
  }
});
