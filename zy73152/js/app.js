// 海洋牧场时序回放 - 主应用逻辑

let currentRunId = 'run-2026-06-18-v3';
let currentStepId = null;

function init() {
  renderRunList();
  loadRun(currentRunId);
  bindEvents();
}

function bindEvents() {
  document.getElementById('btn-rerun').addEventListener('click', openRerunModal);
  document.getElementById('btn-sample').addEventListener('click', openSampleModal);
  
  document.getElementById('modal-close').addEventListener('click', closeRerunModal);
  document.getElementById('modal-cancel').addEventListener('click', closeRerunModal);
  document.getElementById('modal-confirm').addEventListener('click', handleRerun);
  document.querySelector('#rerun-modal .modal-overlay').addEventListener('click', closeRerunModal);
  
  document.getElementById('sample-close').addEventListener('click', closeSampleModal);
  document.getElementById('sample-cancel').addEventListener('click', closeSampleModal);
  document.querySelector('#sample-modal .modal-overlay').addEventListener('click', closeSampleModal);
  
  document.querySelectorAll('.sample-item').forEach(item => {
    item.addEventListener('click', () => {
      const runId = item.dataset.run;
      currentRunId = runId;
      loadRun(runId);
      closeSampleModal();
    });
  });
  
  document.querySelectorAll('.nav-card').forEach(card => {
    card.addEventListener('click', () => {
      const nav = card.dataset.nav;
      scrollToSection(nav);
    });
  });
}

function scrollToSection(nav) {
  const map = {
    summary: 'run-header',
    materials: 'coord-panel',
    anomaly: 'cloud-panel',
    export: 'timeline-section'
  };
  const el = document.getElementById(map[nav]);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function renderRunList() {
  const container = document.getElementById('run-list');
  container.innerHTML = SAMPLE_RUNS.map(run => {
    const baseRun = getBaseRun(run);
    const isActive = run.id === currentRunId;
    return `
      <div class="run-item ${isActive ? 'active' : ''}" data-run-id="${run.id}">
        <div class="run-item-name">${run.name}</div>
        <div class="run-item-meta">
          <span>⏱ ${run.date}</span>
          <span>👤 ${run.operator}</span>
        </div>
        ${baseRun ? `<div class="run-item-base">${baseRun.name}</div>` : ''}
      </div>
    `;
  }).join('');
  
  container.querySelectorAll('.run-item').forEach(item => {
    item.addEventListener('click', () => {
      currentRunId = item.dataset.runId;
      currentStepId = null;
      loadRun(currentRunId);
      renderRunList();
    });
  });
}

function loadRun(runId) {
  const run = getRunById(runId);
  if (!run) return;
  
  renderRunHeader(run);
  renderTimeline(run);
  renderCoordTable(run);
  renderLateAttachments(run);
  renderCloudTable(run);
  renderStepDetail(run, null);
  updateAnomalyCount(run);
}

function renderRunHeader(run) {
  const header = document.getElementById('run-header');
  const baseRun = getBaseRun(run);
  
  header.innerHTML = `
    <h2>${run.name}</h2>
    <div class="run-header-meta">
      <span>📅 运行时间: ${run.date}</span>
      <span>👤 操作人: ${run.operator}</span>
      <span>📊 状态: <span style="color: #059669;">已完成</span></span>
      <span>📍 数据点: ${run.labResults.length} 个</span>
      <span>☁️ 云遮挡: ${run.cloudRecords.length} 景</span>
      ${baseRun ? `<span>🔗 基于: ${baseRun.name}</span>` : ''}
    </div>
    ${run.remark ? `<div class="run-header-remark">${run.remark}</div>` : ''}
  `;
}

function renderTimeline(run) {
  const timeline = document.getElementById('timeline');
  const baseRun = getBaseRun(run);
  
  timeline.innerHTML = run.steps.map((step, idx) => {
    const hasDiff = step.diffFromBase && Object.keys(step.diffFromBase).length > 0;
    const isActive = step.id === currentStepId;
    
    const inputCount = step.inputs ? step.inputs.length : 0;
    const outputCount = step.outputs ? step.outputs.length : 0;
    
    let summary = '';
    if (step.paramSnapshot) {
      const keys = Object.keys(step.paramSnapshot);
      if (keys.length > 0) {
        summary = `<span>${keys[0]}: ${step.paramSnapshot[keys[0]]}</span>`;
      }
    }
    
    return `
      <div class="timeline-step ${hasDiff ? 'has-diff' : ''} ${isActive ? 'active' : ''}" data-step-id="${step.id}">
        <div class="timeline-dot"></div>
        <div class="timeline-step-title">${idx + 1}. ${step.name}</div>
        <div class="timeline-step-time">${step.startTime} - ${step.endTime}</div>
        <div class="timeline-step-summary">
          <span>📥 输入 ${inputCount}</span>
          <span>📤 输出 ${outputCount}</span>
          ${summary}
        </div>
      </div>
    `;
  }).join('');
  
  timeline.querySelectorAll('.timeline-step').forEach(el => {
    el.addEventListener('click', () => {
      const stepId = el.dataset.stepId;
      currentStepId = stepId;
      renderTimeline(run);
      renderStepDetail(run, stepId);
    });
  });
}

function renderStepDetail(run, stepId) {
  const detail = document.getElementById('step-detail');
  const baseRun = getBaseRun(run);
  
  if (!stepId) {
    detail.innerHTML = `
      <div class="detail-placeholder">
        <div class="placeholder-icon">👆</div>
        <p>点击上方步骤卡片查看详细信息</p>
        <p style="font-size: 12px; margin-top: 8px; color: #9ca3af;">
          ${baseRun ? '橙色标记的步骤表示与上一版相比有参数变化' : '选择左侧步骤开始查看'}
        </p>
      </div>
    `;
    return;
  }
  
  const step = run.steps.find(s => s.id === stepId);
  if (!step) return;
  
  let baseStep = null;
  if (baseRun) {
    baseStep = baseRun.steps.find(s => s.id === stepId);
  }
  
  const hasDiff = step.diffFromBase && Object.keys(step.diffFromBase).length > 0;
  
  let html = `
    <div class="detail-header">
      <h3>📋 ${step.name} - 详细信息</h3>
    </div>
    <div class="detail-body">
  `;
  
  html += `<div class="detail-section-title">参数快照</div>`;
  if (step.paramSnapshot) {
    html += `<div class="param-grid">`;
    for (const [key, value] of Object.entries(step.paramSnapshot)) {
      const isDiff = step.diffFromBase && step.diffFromBase[key];
      const oldValue = isDiff ? step.diffFromBase[key] : null;
      
      html += `
        <div class="param-item ${isDiff ? 'diff' : ''}">
          <div class="param-label">${formatParamLabel(key)}</div>
          <div class="param-value">${value}</div>
          ${oldValue ? `<div class="param-diff-old">旧: ${oldValue}</div>` : ''}
        </div>
      `;
    }
    html += `</div>`;
  }
  
  if (hasDiff && baseStep) {
    html += `
      <div class="compare-section">
        <div class="compare-title">与上一版对比变化</div>
        <div class="diff-list">
          ${Object.entries(step.diffFromBase).map(([key, val]) => `
            <div class="diff-list-item">
              <span class="diff-key">${formatParamLabel(key)}</span>
              <span class="diff-val">${val}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }
  
  html += `<div class="detail-section-title">输入输出</div>`;
  html += `<div class="io-list">`;
  if (step.inputs) {
    step.inputs.forEach(input => {
      html += `
        <div class="io-item input">
          <span class="io-tag input">输入</span>
          <span>${input}</span>
        </div>
      `;
    });
  }
  if (step.outputs) {
    step.outputs.forEach(output => {
      html += `
        <div class="io-item">
          <span class="io-tag output">输出</span>
          <span>${output}</span>
        </div>
      `;
    });
  }
  html += `</div>`;
  
  if (step.anomalies && step.anomalies.length > 0) {
    html += `<div class="detail-section-title">异常记录</div>`;
    step.anomalies.forEach(a => {
      html += `
        <div style="padding: 10px 12px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; margin-bottom: 8px;">
          <span class="anomaly-tag">${a.type === 'cloud_cover' ? '云遮挡' : a.type}</span>
          <span style="margin-left: 8px; font-size: 13px; color: #7f1d1d;">${a.desc}（${a.count}条）</span>
        </div>
      `;
    });
  }
  
  if (step.coordIssues && step.coordIssues.length > 0) {
    html += `<div class="detail-section-title">坐标格式问题</div>`;
    html += `
      <table class="coord-table" style="margin-top: 8px;">
        <thead>
          <tr>
            <th>原始纬度</th>
            <th>原始经度</th>
            <th>说明</th>
          </tr>
        </thead>
        <tbody>
          ${step.coordIssues.map(issue => `
            <tr>
              <td><span class="coord-original">${issue.originalLat}</span></td>
              <td><span class="coord-original">${issue.originalLon}</span></td>
              <td>${issue.note}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }
  
  if (step.lateArrival) {
    html += `<div class="detail-section-title">晚到附件处理</div>`;
    html += `
      <div style="padding: 12px; background: #fffbeb; border: 1px solid #fde68a; border-radius: 6px;">
        <div style="font-weight: 600; color: #92400e; margin-bottom: 6px;">
          📎 ${step.lateArrival.attachment}
        </div>
        <div style="font-size: 12px; color: #a16207; line-height: 1.8;">
          <div>📥 收到时间: ${step.lateArrival.receivedAt}</div>
          <div>⚙️ 处理环节: ${step.lateArrival.processedIn}</div>
          <div>📝 原因: ${step.lateArrival.reason}</div>
          <div>🎯 影响样品: ${step.lateArrival.affected.join(', ')}</div>
        </div>
      </div>
    `;
  }
  
  html += `</div>`;
  detail.innerHTML = html;
}

function formatParamLabel(key) {
  const map = {
    sourceCount: '数据条数',
    dateRange: '日期范围',
    cloudThreshold: '云量阈值',
    keepPartial: '保留部分云',
    targetFormat: '目标格式',
    targetDatum: '目标基准面',
    coordIssues: '坐标问题数',
    model: '反演模型',
    resolution: '空间分辨率',
    sampleCount: '样品数量',
    outputVersion: '输出版本',
    format: '导出格式',
    includeAnomaly: '包含异常',
    remark: '备注',
    outputFile: '输出文件',
    filteredOut: '剔除数量',
    note: '说明',
    inputScenes: '输入影像'
  };
  return map[key] || key;
}

function renderCoordTable(run) {
  const container = document.getElementById('coord-table');
  
  const formatMap = {
    dms: { label: '度分秒', cls: 'dms' },
    decimal: { label: '十进制度', cls: 'decimal' },
    dm: { label: '度分', cls: 'dm' }
  };
  
  container.innerHTML = `
    <table class="coord-table">
      <thead>
        <tr>
          <th>采样点</th>
          <th>原始写法</th>
          <th>标准化后（WGS84 十进制度）</th>
        </tr>
      </thead>
      <tbody>
        ${run.labResults.map(lab => {
          const nc = normalizeCoord(lab.originalLat, lab.originalLon);
          const fmt = formatMap[lab.sourceFormat] || { label: lab.sourceFormat, cls: '' };
          return `
            <tr class="lab-row ${lab.isLateArrival ? 'late-arrival' : ''}">
              <td>
                <strong>${lab.siteName}</strong>
                <div style="font-size: 11px; color: #9ca3af; margin-top: 2px;">${lab.sampleId}</div>
              </td>
              <td>
                <div><span class="coord-original">${lab.originalLat}</span></div>
                <div style="margin-top: 2px;"><span class="coord-original">${lab.originalLon}</span></div>
                <span class="format-tag ${fmt.cls}">${fmt.label}</span>
              </td>
              <td>
                <div class="coord-normalized">${nc.lat}° N</div>
                <div class="coord-normalized" style="margin-top: 2px;">${nc.lon}° E</div>
              </td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;
}

function renderLateAttachments(run) {
  const container = document.getElementById('late-list');
  const badge = document.getElementById('late-badge');
  
  if (!run.lateAttachments || run.lateAttachments.length === 0) {
    badge.textContent = '无';
    badge.className = 'panel-badge late-badge';
    container.innerHTML = `<div class="late-empty">本次运行无晚到附件</div>`;
    return;
  }
  
  badge.textContent = `${run.lateAttachments.length} 个`;
  badge.className = 'panel-badge late-badge';
  
  container.innerHTML = run.lateAttachments.map(late => {
    const stepNum = late.processedStep ? late.processedStep.replace('step-', '') : '?';
    return `
      <div class="late-item">
        <div class="late-file">${late.fileName}</div>
        <div class="late-meta">
          <span>📥 收到: ${late.receivedAt}</span>
          <span>⚙️ 处理于: 第${stepNum}步</span>
          <span>📝 原因: ${late.reason}</span>
          <span>📊 含 ${late.sampleCount} 条样品数据</span>
          <span>💬 ${late.content}</span>
        </div>
      </div>
    `;
  }).join('');
}

function renderCloudTable(run) {
  const container = document.getElementById('cloud-table');
  
  container.innerHTML = `
    <table class="cloud-table">
      <thead>
        <tr>
          <th>影像编号</th>
          <th>日期</th>
          <th>云量</th>
          <th>原因说明</th>
        </tr>
      </thead>
      <tbody>
        ${run.cloudRecords.map(record => {
          const percent = record.cloudPercent;
          const barWidth = Math.min(100, percent * 1.5);
          return `
            <tr class="cloud-row">
              <td style="font-family: monospace; font-size: 12px;">${record.sceneId}</td>
              <td>${record.date}</td>
              <td>
                <div class="cloud-percent">
                  <span style="font-weight: 600; color: #dc2626;">${percent}%</span>
                  <div class="cloud-bar">
                    <div class="cloud-bar-fill" style="width: ${barWidth}%;"></div>
                  </div>
                </div>
              </td>
              <td class="cloud-reason">${record.reason}</td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
    <div style="margin-top: 12px; padding: 10px; background: #fef2f2; border-radius: 6px; font-size: 12px; color: #7f1d1d;">
      <strong>⚠️ 说明:</strong> 以上 ${run.cloudRecords.length} 景影像因云量超标已被单独拎出，
      <strong>不计入正常生物量反演结果</strong>。可在"云检测与筛选"步骤中查看详细筛选规则。
    </div>
  `;
}

function updateAnomalyCount(run) {
  const badge = document.getElementById('anomaly-count');
  if (badge) {
    badge.textContent = run.cloudRecords.length;
  }
}

function openRerunModal() {
  document.getElementById('rerun-modal').classList.add('active');
  document.getElementById('rerun-remark').value = '';
  document.getElementById('rerun-remark').focus();
}

function closeRerunModal() {
  document.getElementById('rerun-modal').classList.remove('active');
}

function openSampleModal() {
  document.getElementById('sample-modal').classList.add('active');
}

function closeSampleModal() {
  document.getElementById('sample-modal').classList.remove('active');
}

function handleRerun() {
  const remark = document.getElementById('rerun-remark').value.trim();
  if (!remark) {
    alert('请填写备注说明');
    return;
  }
  
  const baseRun = getRunById(currentRunId);
  const runNum = SAMPLE_RUNS.length + 1;
  const today = new Date().toISOString().split('T')[0];
  const now = new Date().toTimeString().slice(0, 5);
  
  const newRun = JSON.parse(JSON.stringify(baseRun));
  newRun.id = `run-${today}-v${runNum}`;
  newRun.name = `${today} 第${runNum}次跑（补备注重跑）`;
  newRun.date = `${today} ${now}`;
  newRun.operator = '小林';
  newRun.remark = remark;
  newRun.baseRunId = currentRunId;
  
  newRun.steps.forEach(step => {
    if (step.diffFromBase) {
      delete step.diffFromBase;
    }
  });
  
  if (newRun.steps[4] && newRun.steps[4].paramSnapshot) {
    newRun.steps[4].paramSnapshot.remark = remark;
    newRun.steps[4].diffFromBase = { remark: remark };
    newRun.steps[4].outputs = [`海洋牧场时序报告_${today.replace(/-/g, '')}_v${runNum}.pdf`];
  }
  
  SAMPLE_RUNS.push(newRun);
  currentRunId = newRun.id;
  currentStepId = null;
  
  closeRerunModal();
  renderRunList();
  loadRun(currentRunId);
  
  setTimeout(() => {
    const stepEl = document.querySelector(`.timeline-step[data-step-id="step-5"]`);
    if (stepEl) {
      stepEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, 100);
}

document.addEventListener('DOMContentLoaded', init);
