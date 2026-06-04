const UI = (() => {
  function renderCenter(step) {
    const panel = document.getElementById('centerPanel');
    switch(step) {
      case 1: renderStep1(panel); break;
      case 2: renderStep2(panel); break;
      case 3: renderStep3(panel); break;
    }
  }

  function renderStep1(panel) {
    const st = DataManager.getState().safetyThresholds;
    panel.innerHTML = `
      <div class="card">
        <div class="card-header">
          <h3>📥 导入安全阈值表</h3>
          <div style="display:flex;gap:8px;">
            <button class="btn btn-primary" onclick="App.loadDemoSafetyThresholds()">加载演示数据</button>
            <button class="btn" onclick="App.clearAll()">清空重置</button>
          </div>
        </div>
        <div class="card-body">
          <div class="import-zone" onclick="App.loadDemoSafetyThresholds()">
            <div class="iz-icon">📄</div>
            <div>点击加载安全阈值表演示数据</div>
            <div style="font-size:11px;margin-top:4px;color:var(--text-muted)">支持 CSV / Excel 格式（演示模式使用内置数据）</div>
          </div>
        </div>
      </div>
      ${st.length > 0 ? `
      <div class="card">
        <div class="card-header">
          <h3>🛡️ 安全阈值表（已导入 ${st.length} 条）</h3>
          <button class="btn btn-sm btn-success" onclick="App.confirmAllSafetyThresholds()">全部确认</button>
        </div>
        <div class="card-body" style="padding:0;overflow-x:auto;">
          <table>
            <thead>
              <tr>
                <th>参数名称</th>
                <th>数值</th>
                <th>单位</th>
                <th>单位标记</th>
                <th>备注（完整保留）</th>
                <th>状态</th>
                <th>版本</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              ${st.map(r => `
                <tr>
                  <td><strong>${r.paramName}</strong></td>
                  <td>${r.value}</td>
                  <td>${r.unit}</td>
                  <td>${renderUnitTag(r.unitFlag)}</td>
                  <td class="remark-cell">${r._originalRemark || '-'}</td>
                  <td>${renderStatusTag(r.status)}</td>
                  <td><span class="version-tag"><span class="v-num">v${r.version}</span></span></td>
                  <td>${r.status !== 'confirmed' ? `<button class="btn btn-sm btn-success" onclick="App.confirmSafetyThreshold('${r.id}')">确认</button>` : '✓'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
      ` : ''}
      ${st.length > 0 ? `
      <div style="display:flex;justify-content:flex-end;margin-top:8px;">
        <button class="btn btn-primary" onclick="App.goToStep(2)">下一步：补看设备铭牌参数 →</button>
      </div>
      ` : ''}
    `;
  }

  function renderStep2(panel) {
    const np = DataManager.getState().equipmentNameplates;
    const conflicts = DataManager.getState().conflicts;
    const st = DataManager.getState().safetyThresholds;
    const late = DataManager.getState().lateMaterials;

    const lateBanner = late.length > 0 ? `
      <div class="late-arrive-banner">
        <span class="la-icon">🕐</span>
        <div class="la-text">
          <div><strong>晚到材料已补录 ${late.length} 条</strong></div>
          <div class="la-detail">仅刷新相关明细，安全阈值表中已确认的内容不会被洗掉</div>
        </div>
      </div>
    ` : '';

    panel.innerHTML = `
      ${lateBanner}
      <div class="card">
        <div class="card-header">
          <h3>🔧 补看设备铭牌参数</h3>
          <div style="display:flex;gap:8px;">
            <button class="btn btn-primary" onclick="App.loadDemoNameplates()">加载铭牌演示数据</button>
            <button class="btn btn-warn" onclick="App.loadLateArrivalNameplates()">模拟晚到材料</button>
          </div>
        </div>
        <div class="card-body">
          <div class="import-zone" onclick="App.loadDemoNameplates()">
            <div class="iz-icon">🏷️</div>
            <div>点击加载设备铭牌参数演示数据</div>
            <div style="font-size:11px;margin-top:4px;color:var(--text-muted)">备注信息将完整保留，不会清洗为一行数据</div>
          </div>
        </div>
      </div>

      ${np.length > 0 ? `
      <div class="card">
        <div class="card-header">
          <h3>🏷️ 设备铭牌参数（已导入 ${np.length} 条）</h3>
        </div>
        <div class="card-body" style="padding:0;overflow-x:auto;">
          <table>
            <thead>
              <tr>
                <th>参数名称</th>
                <th>数值</th>
                <th>单位</th>
                <th>单位标记</th>
                <th>备注（完整保留）</th>
                <th>到达时间</th>
                <th>晚到标记</th>
              </tr>
            </thead>
            <tbody>
              ${np.map(r => `
                <tr>
                  <td><strong>${r.paramName}</strong></td>
                  <td>${r.value}</td>
                  <td>${r.unit}</td>
                  <td>${renderUnitTag(r.unitFlag)}</td>
                  <td class="remark-cell">${r._originalRemark || '-'}</td>
                  <td style="font-size:11px;color:var(--text-muted)">${formatTime(r.arrivedAt)}</td>
                  <td>${r.isLateArrival ? '<span class="tag tag-warn" style="background:var(--warn-bg);color:var(--warn)">晚到</span>' : '-'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
      ` : ''}

      ${conflicts.length > 0 ? `
      <div class="card">
        <div class="card-header">
          <h3>⚠️ 冲突检测（${conflicts.length} 处冲突）</h3>
          <div style="font-size:12px;color:var(--text-muted)">
            发现冲突时不自动拍板，请质检员小白选择确认或驳回
          </div>
        </div>
        <div class="card-body">
          ${conflicts.map(c => renderConflictCard(c)).join('')}
        </div>
      </div>
      ` : ''}

      <div style="display:flex;justify-content:space-between;margin-top:8px;">
        <button class="btn" onclick="App.navigateToStep(1)">← 返回安全阈值表</button>
        <button class="btn btn-primary" onclick="App.goToStep(3)" ${conflicts.some(c => c.status === 'pending' || c.status === 'pending_review') ? 'disabled style="opacity:0.5"' : ''}>
          下一步：交接报告更新 →
          ${conflicts.some(c => c.status === 'pending' || c.status === 'pending_review') ? '<span style="font-size:11px">（请先处理冲突）</span>' : ''}
        </button>
      </div>
    `;
  }

  function renderStep3(panel) {
    const report = DataManager.getState().handoverReport;
    const results = DataManager.buildUnifiedResult();

    panel.innerHTML = `
      <div class="card">
        <div class="card-header">
          <h3>📋 交接报告</h3>
          <button class="btn btn-primary" onclick="App.generateReport()">生成报告</button>
        </div>
        <div class="card-body">
          ${report ? `
            <div class="stats-grid">
              <div class="stat-card" style="background:var(--info-bg)">
                <div class="stat-value" style="color:var(--info)">${report.safetyThresholdCount}</div>
                <div class="stat-label">安全阈值</div>
              </div>
              <div class="stat-card" style="background:var(--success-bg)">
                <div class="stat-value" style="color:var(--success)">${report.nameplateCount}</div>
                <div class="stat-label">铭牌参数</div>
              </div>
              <div class="stat-card" style="background:var(--warn-bg)">
                <div class="stat-value" style="color:var(--warn)">${report.resolvedConflicts}/${report.conflictCount}</div>
                <div class="stat-label">冲突已解决</div>
              </div>
              <div class="stat-card" style="background:var(--error-bg)">
                <div class="stat-value" style="color:var(--error)">${report.mixedUnitItems}</div>
                <div class="stat-label">需教练复核</div>
              </div>
            </div>
          ` : `
            <div class="empty-state">
              <div class="es-icon">📋</div>
              <div>请点击"生成报告"生成交接报告</div>
            </div>
          `}
        </div>
      </div>

      ${results.length > 0 ? `
      <div class="card">
        <div class="card-header">
          <h3>📊 统一结果明细</h3>
          <div style="display:flex;gap:8px;align-items:center;">
            <span style="font-size:11px;color:var(--text-muted)">展示/导出/API 同一数据源</span>
            <button class="btn btn-sm" onclick="App.exportCSV()">导出 CSV</button>
            <button class="btn btn-sm" onclick="App.exportJSON()">导出 JSON</button>
            <button class="btn btn-sm" onclick="App.showApiReturn()">查看 API 返回</button>
          </div>
        </div>
        <div class="card-body" style="padding:0;overflow-x:auto;">
          <table>
            <thead>
              <tr>
                <th>参数名称</th>
                <th>安全阈值</th>
                <th>铭牌值</th>
                <th>冲突状态</th>
                <th>单位标记</th>
                <th>教练复核</th>
                <th>版本</th>
                <th>取舍理由</th>
              </tr>
            </thead>
            <tbody>
              ${results.map(r => `
                <tr>
                  <td><strong>${r.paramName}</strong></td>
                  <td>${r.safety ? `${r.safety.value} ${r.safety.unit}` : '-'}
                    ${r.safety && r.safety.remark ? `<div class="remark-cell" style="max-width:150px;margin-top:2px">${r.safety.remark}</div>` : ''}
                  </td>
                  <td>${r.nameplate ? `${r.nameplate.value} ${r.nameplate.unit}` : '-'}
                    ${r.nameplate && r.nameplate.remark ? `<div class="remark-cell" style="max-width:150px;margin-top:2px">${r.nameplate.remark}</div>` : ''}
                    ${r.nameplate && r.nameplate.isLateArrival ? ' <span class="tag tag-warn" style="font-size:10px;background:var(--warn-bg);color:var(--warn)">晚到</span>' : ''}
                  </td>
                  <td>${r.conflict ? renderStatusTag(r.conflict.status) : '-'}</td>
                  <td>${r.unitFlag === 'mixed' ? '<span class="tag tag-mixed">C/K 混用</span>' : (r.safety ? renderUnitTag(r.safety.unitFlag) : '-')}</td>
                  <td>${r.requiresCoachReview ? '<span class="tag tag-review">待复核</span>' : '-'}</td>
                  <td>${r.versions ? r.versions.map(v => `<span class="version-tag"><span class="v-num">v${v.version}</span></span>`).join(' ') : '-'}</td>
                  <td>${r.conflict && r.conflict.reason ? `<div class="param-reason">${r.conflict.reason}</div>` : '-'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
      ` : ''}

      <div style="display:flex;justify-content:space-between;margin-top:8px;">
        <button class="btn" onclick="App.navigateToStep(2)">← 返回设备铭牌</button>
        <button class="btn btn-success" onclick="App.runSelfCheck()">🔄 运行完整自检</button>
      </div>
    `;
  }

  function renderConflictCard(c) {
    const isReview = c.status === 'pending_review' || (c.evidence && c.evidence.requiresCoachReview);
    return `
      <div class="conflict-evidence">
        <div class="ev-title">⚠️ 冲突证据：${c.paramName}</div>
        <div class="ev-row">
          <span class="ev-label">安全阈值表：</span>
          <span>${c.safetyValue} ${c.safetyUnit}</span>
          <span style="color:var(--warn);font-size:11px;margin-left:8px">备注：${c.safetyRemark || '无'}</span>
        </div>
        <div class="ev-row">
          <span class="ev-label">设备铭牌：</span>
          <span>${c.nameplateValue} ${c.nameplateUnit}</span>
          <span style="color:var(--warn);font-size:11px;margin-left:8px">备注：${c.nameplateRemark || '无'}</span>
        </div>
        <div class="ev-row">
          <span class="ev-label">归一化差异：</span>
          <span>${c.evidence.normalizedDiff}</span>
        </div>
        ${c.evidence.mixedUnit ? `<div class="ev-row"><span class="tag tag-mixed">摄氏度/开尔文混用 - 需训练教练复核，不自动归正常</span></div>` : ''}
        ${c.status === 'pending' || c.status === 'pending_review' ? `
          <div class="conflict-actions">
            <input type="text" class="reason-input" id="reason_${c.id}" placeholder="填写取舍理由（必填）">
            <button class="btn btn-sm btn-success" onclick="App.resolveConflict('${c.id}', 'confirmed', '质检员小白')">确认（采纳铭牌值）</button>
            <button class="btn btn-sm btn-danger" onclick="App.resolveConflict('${c.id}', 'rejected', '质检员小白')">驳回（保留阈值表值）</button>
          </div>
          ${isReview ? `
            <div style="margin-top:8px;font-size:12px;color:var(--warn);background:var(--warn-bg);padding:6px 10px;border-radius:4px;">
              ⚠️ 此冲突涉及摄氏度/开尔文混用，请勿自动归正常，须留给训练教练复核后再做最终决定。
            </div>
          ` : ''}
        ` : `
          <div style="margin-top:8px;font-size:12px;">
            <span class="tag tag-${c.status === 'confirmed' ? 'confirmed' : 'rejected'}">${c.status === 'confirmed' ? '已确认' : '已驳回'}</span>
            <span style="color:var(--text-muted);margin-left:8px;">处理人：${c.decidedBy} | 理由：${c.reason || '未填写'}</span>
          </div>
        `}
      </div>
    `;
  }

  function renderUnitTag(flag) {
    switch(flag) {
      case 'celsius': return '<span class="tag tag-celsius">°C</span>';
      case 'kelvin': return '<span class="tag tag-kelvin">K</span>';
      case 'mixed': return '<span class="tag tag-mixed">C/K混用</span>';
      default: return '<span class="tag" style="background:var(--bg-hover);color:var(--text-muted)">' + (flag || '其他') + '</span>';
    }
  }

  function renderStatusTag(status) {
    switch(status) {
      case 'confirmed': return '<span class="tag tag-confirmed">已确认</span>';
      case 'imported': return '<span class="tag tag-pending">待确认</span>';
      case 'pending': return '<span class="tag tag-pending">待处理</span>';
      case 'pending_review': return '<span class="tag tag-review">待教练复核</span>';
      case 'rejected': return '<span class="tag tag-rejected">已驳回</span>';
      default: return `<span class="tag" style="background:var(--bg-hover);color:var(--text-muted)">${status}</span>`;
    }
  }

  function formatTime(iso) {
    if (!iso) return '-';
    const d = new Date(iso);
    return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  function renderSelfCheckPanel() {
    const checks = DataManager.getState().selfCheckResults;
    const container = document.getElementById('selfCheckList');
    const badge = document.getElementById('scBadge');
    const failCount = checks.filter(c => c.severity === 'fail').length;
    badge.textContent = checks.length;
    badge.style.background = failCount > 0 ? 'var(--error)' : 'var(--success)';

    if (checks.length === 0) {
      container.innerHTML = '<div style="font-size:12px;color:var(--text-muted);padding:8px;">尚未运行自检</div>';
      return;
    }

    container.innerHTML = checks.map(c => {
      const icon = c.severity === 'pass' ? '✅' : c.severity === 'warn' ? '⚠️' : '❌';
      return `
        <div class="selfcheck-item ${c.severity}">
          <span class="sc-icon">${icon}</span>
          <div class="sc-text">
            ${c.description}
            <div class="sc-detail">${c.checkType} · ${new Date(c.timestamp).toLocaleTimeString('zh-CN')}</div>
          </div>
        </div>
      `;
    }).join('');
  }

  function renderConflictSummary() {
    const conflicts = DataManager.getState().conflicts;
    const container = document.getElementById('conflictSummary');
    const badge = document.getElementById('conflictBadge');
    const pending = conflicts.filter(c => c.status === 'pending' || c.status === 'pending_review').length;
    badge.textContent = pending;
    badge.style.background = pending > 0 ? 'var(--error)' : 'var(--success)';

    if (conflicts.length === 0) {
      container.innerHTML = '<div style="font-size:12px;color:var(--text-muted);padding:8px;">暂无冲突</div>';
      return;
    }

    container.innerHTML = conflicts.map(c => `
      <div style="padding:6px 8px;border-radius:6px;margin-bottom:4px;background:var(--bg-hover);font-size:12px;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span>${c.paramName}</span>
          ${renderStatusTag(c.status)}
        </div>
        ${c.evidence && c.evidence.mixedUnit ? '<div style="font-size:11px;color:var(--warn);margin-top:2px;">C/K 混用</div>' : ''}
      </div>
    `).join('');
  }

  function renderLateMaterialSummary() {
    const late = DataManager.getState().lateMaterials;
    const container = document.getElementById('lateMaterialSummary');
    const badge = document.getElementById('lateBadge');
    badge.textContent = late.length;

    if (late.length === 0) {
      container.innerHTML = '<div style="font-size:12px;color:var(--text-muted);padding:8px;">暂无晚到材料</div>';
      return;
    }

    container.innerHTML = late.map(l => `
      <div style="padding:6px 8px;border-radius:6px;margin-bottom:4px;background:var(--warn-bg);font-size:12px;">
        <div><strong>${l.paramName}</strong>: ${l.value} ${l.unit}</div>
        ${l._originalRemark ? `<div class="remark-cell" style="margin-top:2px">${l._originalRemark}</div>` : ''}
        <div style="font-size:10px;color:var(--text-muted);margin-top:2px;">到达：${formatTime(l.arrivedAt)}</div>
      </div>
    `).join('');
  }

  function renderVersionHistory() {
    const versions = DataManager.getState().parameterVersions;
    const container = document.getElementById('versionHistory');

    if (versions.length === 0) {
      container.innerHTML = '<div style="font-size:12px;color:var(--text-muted);padding:8px;">暂无版本记录</div>';
      return;
    }

    const grouped = {};
    versions.forEach(v => {
      grouped[v.paramName] = grouped[v.paramName] || [];
      grouped[v.paramName].push(v);
    });

    container.innerHTML = Object.entries(grouped).map(([name, vers]) => `
      <div style="margin-bottom:12px;">
        <div style="font-size:12px;font-weight:600;margin-bottom:4px;">${name}</div>
        ${vers.sort((a,b) => a.version - b.version).map(v => `
          <div style="padding:4px 8px;margin:2px 0;border-left:2px solid var(--accent);font-size:11px;">
            <span class="version-tag"><span class="v-num">v${v.version}</span></span>
            <span style="color:var(--text)">${v.value} ${v.unit}</span>
            <div style="color:var(--text-muted);font-size:10px;">${v.reason}</div>
          </div>
        `).join('')}
      </div>
    `).join('');
  }

  function renderDataSourceStatus() {
    const container = document.getElementById('dataSourceStatus');
    const consistent = DataManager.verifyExportConsistency();
    const state = DataManager.getState();

    container.innerHTML = `
      <div style="font-size:12px;">
        <div style="display:flex;justify-content:space-between;padding:4px 0;">
          <span>展示数据</span>
          <span class="status-dot ${state.safetyThresholds.length > 0 ? 'green' : 'yellow'}"></span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:4px 0;">
          <span>导出数据</span>
          <span class="status-dot ${state.safetyThresholds.length > 0 ? 'green' : 'yellow'}"></span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:4px 0;">
          <span>API 返回</span>
          <span class="status-dot ${state.safetyThresholds.length > 0 ? 'green' : 'yellow'}"></span>
        </div>
        <hr class="section-divider">
        <div style="display:flex;justify-content:space-between;padding:4px 0;">
          <span>三者一致性</span>
          <span class="status-dot ${consistent ? 'green' : 'red'}"></span>
        </div>
        <div style="font-size:10px;color:var(--text-muted);margin-top:4px;">
          展示/导出/API 均读取同一份 buildUnifiedResult()
        </div>
      </div>
    `;
  }

  function updateWorkflowBar(step) {
    const steps = document.querySelectorAll('.wf-step');
    const state = DataManager.getState();
    const conflicts = state.conflicts;
    const hasMixedUnit = conflicts.some(c => c.evidence && c.evidence.mixedUnit);

    steps.forEach(s => {
      const sNum = parseInt(s.dataset.step);
      s.classList.remove('active', 'completed', 'has-warning');
      if (sNum < step) s.classList.add('completed');
      if (sNum === step) s.classList.add('active');
      if (sNum === 2 && hasMixedUnit) s.classList.add('has-warning');
    });
  }

  function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
  }

  function showModal(title, content) {
    const root = document.getElementById('modalRoot');
    root.innerHTML = `
      <div class="modal-overlay" onclick="if(event.target===this)App.closeModal()">
        <div class="modal">
          <h3>${title}</h3>
          <div>${content}</div>
          <div style="margin-top:16px;text-align:right;">
            <button class="btn" onclick="App.closeModal()">关闭</button>
          </div>
        </div>
      </div>
    `;
  }

  function closeModal() {
    document.getElementById('modalRoot').innerHTML = '';
  }

  return {
    renderCenter, renderSelfCheckPanel, renderConflictSummary,
    renderLateMaterialSummary, renderVersionHistory, renderDataSourceStatus,
    updateWorkflowBar, showToast, showModal, closeModal
  };
})();
