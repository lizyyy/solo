// 海草床调查报告汇总 - 应用逻辑

const state = {
  currentTab: 'overview',
  currentSiteId: null,
  siteFilter: 'all'
};

function init() {
  renderStats();
  renderDensityChart();
  renderHighPriorityIssues();
  renderGapList();
  renderSiteTable();
  renderActionItems();
  renderVersionHistory();
  renderSiteSelector();
  bindTabEvents();
  bindFilterEvents();
}

// ====== Tab 切换 ======
function bindTabEvents() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.dataset.tab;
      switchTab(tabId);
    });
  });
}

function switchTab(tabId) {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabId);
  });
  document.querySelectorAll('.tab-panel').forEach(panel => {
    panel.classList.toggle('active', panel.id === tabId);
  });
  state.currentTab = tabId;
}

// ====== 统计卡片 ======
function renderStats() {
  const p = mockData.progress;
  document.querySelector('.stat-completed .stat-value').innerHTML = 
    `${p.completedSites}<span class="stat-unit">/${p.totalSites}</span>`;
  document.querySelector('.stat-samples .stat-value').innerHTML = 
    `${p.samplesWithData}<span class="stat-unit">/${p.totalSamples}</span>`;
  document.querySelector('.stat-problem .stat-value').textContent = p.problemSites + (p.pendingSites > 0 ? ' (+' + p.pendingSites + '待补)' : '');
}

// ====== 密度对比图 ======
function renderDensityChart() {
  const chart = document.getElementById('densityChart');
  chart.innerHTML = '';
  
  const maxDensity = Math.max(...mockData.sites.map(s => s.seagrassDensity || 0));
  
  mockData.sites.forEach(site => {
    const barItem = document.createElement('div');
    barItem.className = 'bar-item';
    if (site.status === 'problem') barItem.classList.add('problem');
    if (site.status === 'pending') barItem.classList.add('pending');
    
    const height = site.seagrassDensity 
      ? (site.seagrassDensity / maxDensity * 100) + '%'
      : '20%';
    
    barItem.innerHTML = `
      <div class="bar" style="height: ${height}">
        <span class="bar-value">${site.seagrassDensity || '待补'}</span>
        ${site.hasAbnormality ? '<span class="abnormal-dot">!</span>' : ''}
      </div>
      <div class="bar-label">${site.id}</div>
    `;
    
    barItem.addEventListener('click', () => openSiteDetail(site.id));
    chart.appendChild(barItem);
  });
}

// ====== 高优先级异常 ======
function renderHighPriorityIssues() {
  const container = document.getElementById('highPriorityIssues');
  const highItems = mockData.actionItems.filter(item => item.priority === 'high');
  
  container.innerHTML = highItems.map(item => `
    <div class="issue-item" onclick="goToTrace('${item.site}')">
      <div class="issue-title">
        <span class="issue-priority ${item.priority}">高优</span>
        ${item.siteName}
      </div>
      <div class="issue-meta">${item.issue}</div>
      <div class="issue-meta" style="margin-top:4px">需补：${item.requiredMaterial}</div>
    </div>
  `).join('');
}

// ====== 材料缺口清单 ======
function renderGapList() {
  const container = document.getElementById('gapList');
  const incompleteSites = mockData.sites.filter(s => !s.materialsComplete);
  
  container.innerHTML = incompleteSites.map(site => `
    <div class="gap-item" onclick="goToTrace('${site.id}')" style="cursor:pointer">
      <div class="gap-site">${site.id} ${site.name}</div>
      <div class="gap-material">缺：${site.missingMaterials.join('、')}</div>
    </div>
  `).join('');
}

// ====== 站点表格 ======
function bindFilterEvents() {
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.siteFilter = btn.dataset.filter;
      renderSiteTable();
    });
  });
}

function renderSiteTable() {
  const tbody = document.getElementById('siteTableBody');
  let sites = [...mockData.sites];
  
  if (state.siteFilter !== 'all') {
    sites = sites.filter(s => s.status === state.siteFilter);
  }
  
  tbody.innerHTML = sites.map(site => {
    const statusText = {
      'completed': '已完成',
      'problem': '有异常',
      'pending': '待补'
    }[site.status];
    
    const tideDisplay = site.avgTideLevel !== null 
      ? `${site.avgTideLevel} ${site.tideUnit}`
      : '待补';
    
    const materialText = site.materialsComplete ? '齐全' : '缺' + site.missingMaterials.length + '项';
    const materialClass = site.materialsComplete ? 'complete' : 'incomplete';
    const materialIcon = site.materialsComplete ? '✓' : '!';
    
    return `
      <div class="table-row ${site.status}">
        <div class="td site-name-cell">
          <span class="site-id">${site.id}</span>${site.name}
        </div>
        <div class="td">${site.location}</div>
        <div class="td">${site.sampleCount}</div>
        <div class="td">${site.seagrassDensity || '—'}</div>
        <div class="td">${site.biomass || '—'}</div>
        <div class="td" style="${site.hasAbnormality && site.abnormalityType === 'tide_unit_mismatch' ? 'color:#dc2626;font-weight:600' : ''}">
          ${tideDisplay}
          ${site.hasAbnormality && site.abnormalityType === 'tide_unit_mismatch' ? ' ⚠️' : ''}
        </div>
        <div class="td"><span class="status-badge ${site.status}">${statusText}</span></div>
        <div class="td">
          <span class="material-indicator ${materialClass}">
            ${materialIcon} ${materialText}
          </span>
        </div>
        <div class="td">
          <button class="action-btn" onclick="openSiteDetail('${site.id}')">查看详情</button>
        </div>
      </div>
    `;
  }).join('');
}

// ====== 待办事项 ======
function renderActionItems() {
  const container = document.getElementById('actionItems');
  
  const sortedItems = [...mockData.actionItems].sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
  
  container.innerHTML = sortedItems.map(item => {
    const priorityText = { high: '高优先级', medium: '中优先级', low: '低优先级' }[item.priority];
    
    return `
      <div class="action-item-card ${item.priority}">
        <div class="action-header">
          <div>
            <div class="action-title">${item.issue}</div>
            <div class="action-site">${item.site} · ${item.siteName}</div>
          </div>
          <span class="action-priority-tag ${item.priority}">${priorityText}</span>
        </div>
        <div class="action-description">${item.description}</div>
        <div class="action-meta">
          <div class="action-meta-item">
            <span class="action-meta-label">需补材料：</span>
            <span class="action-meta-value">${item.requiredMaterial}</span>
          </div>
          <div class="action-meta-item">
            <span class="action-meta-label">负责人：</span>
            <span class="action-meta-value">${item.responsible}</span>
          </div>
          <div class="action-meta-item">
            <span class="action-meta-label">截止日期：</span>
            <span class="action-meta-value" style="color:#dc2626">${item.deadline}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// ====== 版本历史 ======
function renderVersionHistory() {
  const container = document.getElementById('versionTimeline');
  
  container.innerHTML = mockData.versionHistory.map(v => `
    <div class="version-item">
      <div class="version-header">
        <span class="version-tag">${v.version}</span>
        <span class="version-date">${v.date}</span>
        <span class="version-author">${v.author}</span>
      </div>
      <div class="version-changes">${v.changes}</div>
      <div class="version-impact">📌 数据影响：${v.impact}</div>
    </div>
  `).join('');
}

// ====== 数据溯源 - 站点选择 ======
function renderSiteSelector() {
  const container = document.getElementById('siteSelector');
  
  container.innerHTML = mockData.sites.map(site => {
    const statusText = {
      'completed': '完成',
      'problem': '异常',
      'pending': '待补'
    }[site.status];
    
    return `
      <div class="site-select-item" data-site="${site.id}" onclick="selectTraceSite('${site.id}')">
        <span class="site-select-name">${site.id} ${site.name}</span>
        <span class="site-select-status ${site.status}">${statusText}</span>
      </div>
    `;
  }).join('');
}

function selectTraceSite(siteId) {
  state.currentSiteId = siteId;
  
  document.querySelectorAll('.site-select-item').forEach(item => {
    item.classList.toggle('active', item.dataset.site === siteId);
  });
  
  renderTraceDetail(siteId);
}

function goToTrace(siteId) {
  switchTab('trace');
  setTimeout(() => {
    selectTraceSite(siteId);
  }, 100);
}

// ====== 数据溯源 - 详情展示 ======
function renderTraceDetail(siteId) {
  const site = mockData.sites.find(s => s.id === siteId);
  const titleEl = document.getElementById('traceSiteTitle');
  const contentEl = document.getElementById('traceContent');
  
  titleEl.textContent = `🔍 ${site.id} ${site.name} - 数据溯源`;
  
  const samples = mockData.sampleDetails[siteId] || [];
  const shipLogs = mockData.shipLogs[siteId] || [];
  const labReports = mockData.labReports[siteId] || [];
  
  const tideDisplay = site.avgTideLevel !== null 
    ? `${site.avgTideLevel} ${site.tideUnit}`
    : '待补充';
  
  contentEl.innerHTML = `
    <div class="trace-layers">
      <!-- 第一层：汇总数据 -->
      <div class="trace-layer">
        <div class="trace-layer-header">
          <span class="trace-layer-title">📊 第一层：汇总数据</span>
          <span class="trace-layer-badge">页面摘要</span>
        </div>
        <div class="trace-layer-body">
          <div class="summary-grid">
            <div class="summary-item">
              <div class="summary-item-value">${site.sampleCount}</div>
              <div class="summary-item-label">样本数</div>
            </div>
            <div class="summary-item ${site.seagrassDensity ? '' : 'abnormal'}">
              <div class="summary-item-value">${site.seagrassDensity || '待补'}</div>
              <div class="summary-item-label">密度(株/m²)</div>
            </div>
            <div class="summary-item">
              <div class="summary-item-value">${site.biomass || '待补'}</div>
              <div class="summary-item-label">生物量(g/m²)</div>
            </div>
            <div class="summary-item ${site.hasAbnormality && site.abnormalityType === 'tide_unit_mismatch' ? 'abnormal' : ''}">
              <div class="summary-item-value">${tideDisplay}</div>
              <div class="summary-item-label">平均潮位${site.hasAbnormality && site.abnormalityType === 'tide_unit_mismatch' ? ' ⚠️' : ''}</div>
            </div>
          </div>
          ${site.hasAbnormality ? `
            <div style="margin-top:12px;padding:10px 14px;background:#fef2f2;border-radius:8px;border-left:4px solid #ef4444;">
              <div style="font-size:13px;font-weight:600;color:#991b1b;margin-bottom:4px;">
                ⚠️ 异常标记：${site.abnormalityType === 'tide_unit_mismatch' ? '潮位单位混写' : '采样时间不匹配'}
              </div>
              <div style="font-size:12px;color:#b91c1c;">
                ${site.abnormalityType === 'tide_unit_mismatch' 
                  ? '部分样本潮位用米记录，部分用厘米记录，可能影响汇总数据准确性' 
                  : '部分样本采样时间与实验室检测时间间隔异常，需核实数据有效性'}
              </div>
            </div>
          ` : ''}
        </div>
      </div>

      <!-- 第二层：样本明细 -->
      <div class="trace-layer">
        <div class="trace-layer-header">
          <span class="trace-layer-title">🧪 第二层：样本明细</span>
          <span class="trace-layer-badge">实验室数据 ${samples.length}条</span>
        </div>
        <div class="trace-layer-body">
          <div class="sample-detail-list">
            ${samples.map(sample => {
              const statusText = {
                'normal': '正常',
                'abnormal': '异常',
                'pending': '待补'
              }[sample.status];
              
              return `
                <div class="sample-detail-item ${sample.status}">
                  <div class="sample-detail-header">
                    <span class="sample-id">${sample.id}</span>
                    <span class="sample-status-tag ${sample.status}">${statusText}</span>
                  </div>
                  <div class="sample-detail-meta">
                    <div class="sample-meta-item">
                      <span class="sample-meta-label">采样时间：</span>
                      <span class="sample-meta-value">${sample.sampleTime}</span>
                    </div>
                    <div class="sample-meta-item">
                      <span class="sample-meta-label">检测时间：</span>
                      <span class="sample-meta-value">${sample.labTestTime}</span>
                    </div>
                    <div class="sample-meta-item">
                      <span class="sample-meta-label">潮位：</span>
                      <span class="sample-meta-value" style="${sample.abnormality === 'tide_unit_mismatch' ? 'color:#dc2626;font-weight:600' : ''}">
                        ${sample.tideLevel || '—'} ${sample.tideUnit || ''}
                      </span>
                    </div>
                  </div>
                  <div class="sample-detail-meta" style="margin-top:6px">
                    <div class="sample-meta-item">
                      <span class="sample-meta-label">密度：</span>
                      <span class="sample-meta-value">${sample.density || '—'} 株/m²</span>
                    </div>
                    <div class="sample-meta-item">
                      <span class="sample-meta-label">生物量：</span>
                      <span class="sample-meta-value">${sample.biomass || '—'} g/m²</span>
                    </div>
                    <div class="sample-meta-item">
                      <span class="sample-meta-label">状态：</span>
                      <span class="sample-meta-value">${sample.notes || ''}</span>
                    </div>
                  </div>
                  ${sample.labNote ? `
                    <div class="sample-note ${sample.status === 'abnormal' ? 'abnormal-note' : ''}">
                      📝 ${sample.labNote}
                    </div>
                  ` : ''}
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>

      <!-- 第三层：原始材料 - 船上记录本 -->
      <div class="trace-layer">
        <div class="trace-layer-header">
          <span class="trace-layer-title">📓 第三层：船上记录本（原始材料）</span>
          <span class="trace-layer-badge">${shipLogs.length} 次记录</span>
        </div>
        <div class="trace-layer-body">
          <div class="ship-log-list">
            ${shipLogs.map(log => {
              let logClass = '';
              let tagText = '';
              let tagClass = '';
              
              if (log.isOriginal) {
                logClass = 'original';
                tagText = '原始记录';
                tagClass = 'original-tag';
              } else if (log.status === 'processed') {
                logClass = 'processed';
                tagText = '处理记录';
                tagClass = 'processed-tag';
              } else if (log.status === 'pending') {
                logClass = 'pending';
                tagText = '待补充';
                tagClass = '';
              } else {
                logClass = 'supplement';
                tagText = log.supplementNote || '补遗';
                tagClass = 'supplement-tag';
              }
              
              return `
                <div class="ship-log-item ${logClass}">
                  <div class="ship-log-header">
                    <span class="ship-log-version">第 ${log.version} 版</span>
                    <span class="ship-log-tag ${tagClass}">${tagText}</span>
                  </div>
                  <div class="ship-log-meta">
                    ${log.submitter} · ${log.submitDate}
                  </div>
                  <div class="ship-log-content">${log.content}</div>
                </div>
              `;
            }).join('')}
          </div>
          <div style="margin-top:12px;padding:10px 14px;background:#f0f9ff;border-radius:8px;border-left:4px solid #0ea5e9;">
            <div style="font-size:12px;color:#0369a1;">
              💡 <strong>说明：</strong>船上记录本分多次补齐，后补材料不覆盖早先记录。所有版本均保留，可对比查看数据变化过程。
            </div>
          </div>
        </div>
      </div>

      <!-- 第四层：实验室报告 -->
      <div class="trace-layer">
        <div class="trace-layer-header">
          <span class="trace-layer-title">🔬 第四层：实验室检测报告（原始材料）</span>
          <span class="trace-layer-badge">${labReports.length} 批次</span>
        </div>
        <div class="trace-layer-body">
          <div class="lab-report-list">
            ${labReports.map(report => {
              const isPending = report.status === 'pending';
              
              return `
                <div class="lab-report-item ${isPending ? 'pending' : ''}">
                  <div class="lab-report-header">
                    <span class="lab-report-batch">${report.batch}（${report.sampleCount}个样本）</span>
                    <span class="lab-report-status">${isPending ? '待出' : '已收到'}</span>
                  </div>
                  <div class="lab-report-dates">
                    收样：${report.receiveDate} · 检测：${report.testDate} · 出报告：${report.reportDate}
                  </div>
                  ${report.note ? `
                    <div class="lab-report-note">📝 ${report.note}</div>
                  ` : ''}
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    </div>
  `;
}

// ====== 站点详情弹窗 ======
function openSiteDetail(siteId) {
  const site = mockData.sites.find(s => s.id === siteId);
  const modal = document.getElementById('siteModal');
  const titleEl = document.getElementById('modalTitle');
  const bodyEl = document.getElementById('modalBody');
  
  titleEl.textContent = `${site.id} ${site.name} - 站点详情`;
  
  const statusText = {
    'completed': '已完成',
    'problem': '有异常',
    'pending': '待补材料'
  }[site.status];
  
  const samples = mockData.sampleDetails[siteId] || [];
  
  bodyEl.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px;">
      <div style="background:#f8fafc;padding:16px;border-radius:8px;">
        <div style="font-size:12px;color:#64748b;margin-bottom:4px;">位置</div>
        <div style="font-size:14px;font-weight:500;">${site.location}</div>
      </div>
      <div style="background:#f8fafc;padding:16px;border-radius:8px;">
        <div style="font-size:12px;color:#64748b;margin-bottom:4px;">状态</div>
        <div><span class="status-badge ${site.status}">${statusText}</span></div>
      </div>
      <div style="background:#f8fafc;padding:16px;border-radius:8px;">
        <div style="font-size:12px;color:#64748b;margin-bottom:4px;">样本数</div>
        <div style="font-size:20px;font-weight:700;color:#0ea5e9;">${site.sampleCount}</div>
      </div>
      <div style="background:#f8fafc;padding:16px;border-radius:8px;">
        <div style="font-size:12px;color:#64748b;margin-bottom:4px;">数据版本</div>
        <div style="font-size:20px;font-weight:700;color:#8b5cf6;">v${site.versions}</div>
      </div>
      <div style="background:#f8fafc;padding:16px;border-radius:8px;">
        <div style="font-size:12px;color:#64748b;margin-bottom:4px;">海草密度</div>
        <div style="font-size:20px;font-weight:700;color:#10b981;">${site.seagrassDensity || '—'} <span style="font-size:13px;font-weight:400;">株/m²</span></div>
      </div>
      <div style="background:#f8fafc;padding:16px;border-radius:8px;">
        <div style="font-size:12px;color:#64748b;margin-bottom:4px;">生物量</div>
        <div style="font-size:20px;font-weight:700;color:#10b981;">${site.biomass || '—'} <span style="font-size:13px;font-weight:400;">g/m²</span></div>
      </div>
    </div>

    ${site.hasAbnormality ? `
      <div style="background:#fef2f2;padding:14px;border-radius:8px;border-left:4px solid #ef4444;margin-bottom:20px;">
        <div style="font-size:14px;font-weight:600;color:#991b1b;margin-bottom:6px;">
          ⚠️ 异常提醒
        </div>
        <div style="font-size:13px;color:#b91c1c;line-height:1.6;">
          ${site.abnormalityType === 'tide_unit_mismatch' 
            ? '<strong>潮位单位混写：</strong>该站点样本潮位记录单位不统一（部分cm、部分m），汇总数据需谨慎引用。建议优先核实船上记录本第3次补遗后再使用。' 
            : '<strong>采样时间不匹配：</strong>部分样本采样到检测间隔超过72小时，可能影响数据有效性。需等实验室批次2报告确认更多细节。'}
        </div>
      </div>
    ` : ''}

    ${!site.materialsComplete ? `
      <div style="background:#fffbeb;padding:14px;border-radius:8px;border-left:4px solid #f59e0b;margin-bottom:20px;">
        <div style="font-size:14px;font-weight:600;color:#92400e;margin-bottom:6px;">
          📋 缺失材料
        </div>
        <div style="font-size:13px;color:#b45309;">
          ${site.missingMaterials.map(m => `• ${m}`).join('<br>')}
        </div>
      </div>
    ` : ''}

    <div style="display:flex;gap:12px;margin-top:20px;">
      <button class="action-btn" style="flex:1;padding:10px;font-size:14px;background:#0ea5e9;color:white;" 
              onclick="closeModal(); goToTrace('${siteId}')">
        🔍 查看完整数据溯源
      </button>
      <button class="action-btn" style="padding:10px 20px;font-size:14px;" 
              onclick="closeModal()">
        关闭
      </button>
    </div>
  `;
  
  modal.classList.add('show');
}

function closeModal() {
  document.getElementById('siteModal').classList.remove('show');
}

// ====== 初始化 ======
document.addEventListener('DOMContentLoaded', init);

// 按ESC关闭弹窗
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeModal();
});
