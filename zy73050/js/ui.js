// ============================================================
// UI 渲染模块：工单列表、详情区、备件、采样
// ============================================================

const UI = {
  // ----------------------------------------------------------
  // 初始化顶部状态统计胶囊
  // ----------------------------------------------------------
  renderStatusChips() {
    const counts = Core.getCounts();
    const chips = document.getElementById('statusChips');
    if (!chips) return;
    chips.innerHTML = `
      <div class="status-chip"><span>总数</span><strong>${counts.all}</strong></div>
      <div class="status-chip"><span>已确认</span><strong>${counts.confirmed}</strong></div>
      <div class="status-chip"><span>待补件</span><strong>${counts.pending}</strong></div>
      <div class="status-chip"><span>退回</span><strong>${counts.returned}</strong></div>
    `;
  },

  // ----------------------------------------------------------
  // 渲染工单分类 Tab 计数
  // ----------------------------------------------------------
  renderFilterCounts() {
    const counts = Core.getCounts();
    ['all', 'confirmed', 'pending', 'returned', 'abnormal'].forEach(k => {
      const el = document.getElementById(`count-${k}`);
      if (el) el.textContent = counts[k];
    });
  },

  // ----------------------------------------------------------
  // 渲染左侧工单列表
  // ----------------------------------------------------------
  renderWorkorderList(filter = 'all', keyword = '', selectedId = null) {
    const list = Core.filterWorkorders(filter, keyword);
    const listEl = document.getElementById('workorderList');
    if (!listEl) return;

    if (list.length === 0) {
      listEl.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🔍</div>
          <div class="empty-state-text">没有找到匹配的工单</div>
        </div>`;
      return;
    }

    listEl.innerHTML = list.map(wo => this.renderWorkorderItem(wo, selectedId)).join('');

    // 绑定点击事件
    listEl.querySelectorAll('.wo-item').forEach(item => {
      item.addEventListener('click', () => {
        const id = item.dataset.woId;
        App.selectWorkorder(id);
      });
    });
  },

  renderWorkorderItem(wo, selectedId) {
    const tags = [];
    if (wo.hasLateParts) tags.push('<span class="wo-tag tag-warn">备件晚到</span>');
    if (wo.hasAbnormalSampling) tags.push('<span class="wo-tag tag-danger">采样断档</span>');

    const selected = wo.id === selectedId ? ' selected' : '';
    const statusText = {
      [STATUS.CONFIRMED]: '已确认',
      [STATUS.PENDING]: '待补件',
      [STATUS.RETURNED]: '退回',
    }[wo.status] || wo.status;

    // 格式化停机窗口日期
    const winStart = wo.downtimeWindow.start.slice(5, 16);

    return `
      <div class="wo-item${selected}" data-wo-id="${wo.id}">
        <div class="wo-item-head">
          <span class="wo-code">${wo.id}</span>
          <span class="wo-status ${wo.status}">${statusText}</span>
        </div>
        <div class="wo-crane">${wo.craneName}</div>
        <div style="font-size:12px;color:var(--text-secondary);">${wo.title}</div>
        <div class="wo-tags">${tags.join('')}</div>
        <div class="wo-meta">
          <span>窗口：${winStart}</span>
          <span>${wo.parts.length}项备件</span>
        </div>
      </div>`;
  },

  // ----------------------------------------------------------
  // 渲染详情区头部
  // ----------------------------------------------------------
  renderDetailHeader(wo) {
    const headerEl = document.getElementById('detailHeader');
    if (!headerEl || !wo) return;

    const statusBadgeMap = {
      [STATUS.CONFIRMED]: { cls: 'success', icon: '✅', text: '已确认' },
      [STATUS.PENDING]: { cls: 'warn', icon: '⏰', text: '待补件' },
      [STATUS.RETURNED]: { cls: 'danger', icon: '↩️', text: '退回' },
    };
    const badge = statusBadgeMap[wo.status] || { cls: 'primary', icon: '📋', text: wo.status };

    const timing = Core.analyzePartsTiming(wo);
    const samplingStats = Core.getSamplingStats(wo);

    const latePartCount = timing.lateCount;
    const abnormalCount = samplingStats.abnormalCount;

    headerEl.innerHTML = `
      <div class="dh-top">
        <div class="dh-title-group">
          <div>
            <div class="dh-code">工单编号 · ${wo.id} · ${wo.type}</div>
            <div class="dh-title">${wo.craneName} — ${wo.title}</div>
          </div>
        </div>
        <div class="dh-status-badges">
          ${latePartCount > 0 ? `<div class="dh-badge danger">⚠️ ${latePartCount}项备件晚到</div>` : ''}
          ${abnormalCount > 0 ? `<div class="dh-badge warn">⚠️ ${abnormalCount}次采样断档</div>` : ''}
          <div class="dh-badge ${badge.cls}">${badge.icon} ${badge.text}</div>
        </div>
      </div>
      <div class="dh-info">
        <div class="dh-info-item">
          <span class="dh-info-label">塔吊编号</span>
          <span class="dh-info-value">${wo.craneId}</span>
        </div>
        <div class="dh-info-item">
          <span class="dh-info-label">停机窗口</span>
          <span class="dh-info-value">${wo.downtimeWindow.start.slice(5)}</span>
        </div>
        <div class="dh-info-item">
          <span class="dh-info-label">窗口时长</span>
          <span class="dh-info-value">${timing.windowDuration} 小时</span>
        </div>
        <div class="dh-info-item">
          <span class="dh-info-label">现场调度</span>
          <span class="dh-info-value">${wo.scheduler}</span>
        </div>
        <div class="dh-info-item">
          <span class="dh-info-label">维保班组</span>
          <span class="dh-info-value">${wo.maintainer}</span>
        </div>
        <div class="dh-info-item">
          <span class="dh-info-label">断档率</span>
          <span class="dh-info-value ${samplingStats.gapRate > 30 ? 'danger' : samplingStats.gapRate > 0 ? 'warn' : ''}">${samplingStats.gapRate}% (${abnormalCount}/${wo.sampling.length})</span>
        </div>
      </div>
    `;
  },

  // ----------------------------------------------------------
  // 渲染备件清单
  // ----------------------------------------------------------
  renderPartsList(wo) {
    const el = document.getElementById('partsList');
    if (!el || !wo) return;

    if (wo.parts.length === 0) {
      el.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📦</div><div class="empty-state-text">该工单暂无备件记录</div></div>`;
      return;
    }

    el.innerHTML = `<div class="parts-list">${wo.parts.map(p => this.renderPartItem(wo, p)).join('')}</div>`;

    // 绑定版本历史查看
    el.querySelectorAll('[data-action="view-remark"]').forEach(btn => {
      btn.addEventListener('click', () => {
        App.openVersionModal(wo.id, btn.dataset.partId, 'remark');
      });
    });
    el.querySelectorAll('[data-action="view-screenshot"]').forEach(btn => {
      btn.addEventListener('click', () => {
        App.openVersionModal(wo.id, btn.dataset.partId, 'screenshot');
      });
    });
  },

  renderPartItem(wo, part) {
    const latestRemark = Core.getLatestRemark(part);
    const remarkCount = part.remarkVersions?.length || 0;
    const screenshotCount = part.screenshotVersions?.length || 0;
    const lateClass = part.isLate ? ' has-late' : '';
    const qtyText = `×${part.qty}${part.unit}`;

    // 到货状态
    const arrivalValue = part.isLate
      ? `<span class="part-info-value late">${part.actualArrival.slice(5)}</span>`
      : `<span class="part-info-value">${part.actualArrival.slice(5)}</span>`;

    // 截图缩略图
    const thumbs = (part.screenshotVersions || []).slice(0, 4).map((s, i) => {
      const oldCls = i > 0 ? ' thumb-old' : '';
      return `<div class="thumb${oldCls}" title="${s.name} · 版本${s.version}" data-action="view-screenshot" data-part-id="${part.id}">
        ${s.preview}
        <span class="thumb-v">v${s.version}</span>
      </div>`;
    }).join('');

    return `
      <div class="part-item${lateClass}">
        <div class="part-head">
          <div>
            <div class="part-name">
              ${part.name}
              ${part.isLate ? '<span style="font-size:10px;padding:2px 6px;background:rgba(239,68,68,.12);color:var(--rose);border-radius:10px;">晚于停机窗口</span>' : ''}
            </div>
            <div class="part-spec">${part.spec}</div>
          </div>
          <span class="part-qty">${qtyText}</span>
        </div>

        <div class="part-info">
          <div class="part-info-item">
            <span class="part-info-label">计划到货</span>
            <span class="part-info-value">${part.plannedArrival.slice(5)}</span>
          </div>
          <div class="part-info-item">
            <span class="part-info-label">实际到货</span>
            ${arrivalValue}
          </div>
          <div class="part-info-item">
            <span class="part-info-label">停机窗口</span>
            <span class="part-info-value">${wo.downtimeWindow.start.slice(5, 11)}</span>
          </div>
        </div>

        ${latestRemark
          ? `<div class="part-remark">📝 ${latestRemark.content}</div>`
          : `<div class="part-remark-empty">暂无备注</div>`}

        <div class="part-foot">
          <div class="part-versions">
            <span class="version-link" data-action="view-remark" data-part-id="${part.id}">
              📜 备注历史（${remarkCount}版）
            </span>
            <span style="color:var(--text-tertiary);">|</span>
            <span class="version-link" data-action="view-screenshot" data-part-id="${part.id}">
              🖼️ 截图历史（${screenshotCount}版）
            </span>
          </div>
          <div class="screenshot-thumbs">${thumbs}</div>
        </div>
      </div>`;
  },

  // ----------------------------------------------------------
  // 渲染采样记录（断档独立标注）
  // ----------------------------------------------------------
  renderSamplingList(wo) {
    const el = document.getElementById('samplingList');
    if (!el || !wo) return;

    if (wo.sampling.length === 0) {
      el.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📊</div><div class="empty-state-text">暂无采样数据</div></div>`;
      return;
    }

    const stats = Core.getSamplingStats(wo);

    // 先断档，再正常 —— 但按时间顺序展示，用样式区别
    const html = wo.sampling.map(s => {
      const isAbn = s.status === 'abnormal';
      return `
        <div class="sampling-item ${isAbn ? 'abnormal' : ''}">
          <span class="sampling-status ${s.status}"></span>
          <span class="sampling-time">${s.time}</span>
          <div class="sampling-value">
            ${isAbn
              ? `<span style="font-weight:600;color:var(--rose);">— — 断档 — —</span>`
              : `<span>${s.value.toFixed(1)} <small style="color:var(--text-tertiary);font-weight:400;">单位值</small></span>
                 <div class="sampling-value-bar">
                   <div class="sampling-value-fill ${s.pct < 50 ? 'low' : ''}" style="width:${s.pct}%;"></div>
                 </div>`}
          </div>
          <span class="sampling-reason ${s.status}">${s.reason}</span>
        </div>`;
    }).join('');

    const summary = `
      <div style="padding:10px 14px;margin-bottom:10px;border-radius:var(--radius-sm);background:linear-gradient(135deg,#f0f9ff,#e0f2fe);border:1px solid #bae6fd;display:grid;grid-template-columns:repeat(4,1fr);gap:10px;font-size:12px;">
        <div>
          <div style="color:var(--text-tertiary);font-size:10px;text-transform:uppercase;letter-spacing:.5px;">有效采样</div>
          <div style="font-weight:700;color:var(--sky);font-size:16px;margin-top:2px;">${stats.count} <small style="font-size:11px;color:var(--text-tertiary);font-weight:400;">次</small></div>
        </div>
        <div>
          <div style="color:var(--text-tertiary);font-size:10px;text-transform:uppercase;letter-spacing:.5px;">均值</div>
          <div style="font-weight:700;color:var(--text-primary);font-size:16px;margin-top:2px;">${stats.avg}</div>
        </div>
        <div>
          <div style="color:var(--text-tertiary);font-size:10px;text-transform:uppercase;letter-spacing:.5px;">最小/最大</div>
          <div style="font-weight:700;color:var(--text-primary);font-size:16px;margin-top:2px;">${stats.min} ~ ${stats.max}</div>
        </div>
        <div>
          <div style="color:var(--text-tertiary);font-size:10px;text-transform:uppercase;letter-spacing:.5px;">断档次数</div>
          <div style="font-weight:700;color:${stats.abnormalCount > 0 ? 'var(--rose)' : 'var(--green)'};font-size:16px;margin-top:2px;">${stats.abnormalCount} <small style="font-size:11px;font-weight:400;">(${stats.gapRate}%)</small></div>
        </div>
      </div>`;

    el.innerHTML = summary + `<div class="sampling-list">${html}</div>`;
  },

  // ----------------------------------------------------------
  // Toast 通知
  // ----------------------------------------------------------
  showToast(msg, type = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const icons = { success: '✅', warn: '⚠️', danger: '❌', info: 'ℹ️' };
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span class="toast-icon">${icons[type] || '✅'}</span><span>${msg}</span>`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3100);
  },

  // ----------------------------------------------------------
  // 版本历史弹窗
  // ----------------------------------------------------------
  renderVersionModal(woId, partId, type) {
    const wo = WORKORDERS.find(w => w.id === woId);
    const part = wo?.parts.find(p => p.id === partId);
    const modal = document.getElementById('versionModal');
    const title = document.getElementById('versionModalTitle');
    const list = document.getElementById('versionList');
    if (!modal || !wo || !part) return;

    title.textContent = type === 'remark'
      ? `「${part.name}」 · 备注历史版本`
      : `「${part.name}」 · 截图历史版本`;

    if (type === 'remark') {
      const versions = Core.getAllRemarkVersions(part);
      list.innerHTML = `<div class="version-list">${versions.map(v => {
        const latest = v.isLatest ? ' latest' : '';
        return `<div class="version-card${latest}">
          <div class="v-badge">
            <span class="v-label">VER</span>
            <span class="v-num">${v.version}</span>
          </div>
          <div class="v-content">
            <div class="v-text">${v.content || '<span class="v-text-empty">（无内容）</span>'}</div>
            <div class="v-meta">
              <span>👤 ${v.author}（${v.role}）</span>
              <span>🕒 ${v.createdAt}</span>
            </div>
          </div>
          <div style="align-self:flex-start;">${v.isLatest ? '<span class="v-latest-tag">最新</span>' : ''}</div>
        </div>`;
      }).join('')}</div>`;
    } else {
      const versions = Core.getAllScreenshotVersions(part);
      list.innerHTML = `<div class="screenshot-version-grid">${versions.map((v, i) => {
        const latestCls = v.isLatest ? ' latest' : '';
        const oldCls = !v.isLatest ? ' old' : '';
        return `<div class="screenshot-card">
          <div class="screenshot-preview${latestCls}${oldCls}">
            <span style="font-size:32px;">${v.preview || '🖼️'}</span>
          </div>
          <div class="screenshot-info">
            <div class="screenshot-name">${v.name} · v${v.version}</div>
            <div class="screenshot-meta">${v.author} · ${v.createdAt.slice(5)}</div>
          </div>
        </div>`;
      }).join('')}</div>`;
    }

    modal.classList.add('open');
  },

  // ----------------------------------------------------------
  // 引导步骤内容
  // ----------------------------------------------------------
  GUIDE_STEPS: [
    {
      num: 1,
      title: '材料区：备件清单从这里开始',
      desc: '小宋每次复核都要从备件清单翻起。在 <strong>① 备件清单</strong> 卡片里，每项备件都展示了 <strong>计划到货 vs 实际到货</strong> 的对比，晚于停机窗口的会用红色醒目标出。',
      tips: '💡 <strong>重点</strong>：备注和截图都按版本保留，点击「备注历史 / 截图历史」可以查看每次修改的完整记录，不再只看到最终值。',
      cls: 'guide-1',
      icon: '📦',
    },
    {
      num: 2,
      title: '重复提交不会算成两份',
      desc: '系统对每个工单自动生成 <strong>唯一哈希（塔吊+类型+窗口+备件）</strong>，相同请求再次提交时会弹窗提示「检测到重复提交」，边界样本不会被重复计数。',
      tips: '✅ <strong>你可以放心点击两次相同请求</strong>，系统会告诉你哪个工单已存在，并拒绝重复入库。',
      cls: 'guide-2',
      icon: '🔁',
    },
    {
      num: 3,
      title: '异常区：采样断档已单独拎出',
      desc: '在 <strong>② 采样记录</strong> 卡片里，正常采样用绿色圆点，断档记录用红色闪烁圆点并加红色边框，一眼就能分辨。统计数据也已排除断档。',
      tips: '🚨 <strong>侧栏筛选</strong>：左侧有专门的「⚠ 采样断档」Tab，一键筛选出所有存在断档的工单，不再需要从正常结果里挖。',
      cls: 'guide-3',
      icon: '⚠️',
    },
    {
      num: 4,
      title: '月底复核：3 种状态一清二楚',
      desc: '左侧筛选面板把工单分成了 <strong>已确认 / 待补件 / 退回</strong> 三类。月底小宋复核时，分别点击对应 Tab 即可批量处理。',
      tips: '🔍 <strong>顶部胶囊</strong>：在页面顶部可以看到每类工单的数量，整体情况一目了然。支持按工单编号或塔吊编号搜索。',
      cls: 'guide-4',
      icon: '📋',
    },
    {
      num: 5,
      title: '历史时间线 + 人工改判 + 导出',
      desc: '<strong>③ 历史时间线</strong> 卡片展示完整的处理流程，状态流转用「状态→状态」显示。人工改判的节点会用紫色✎标记并高亮。点击顶部的「重新导出」可下载当前视图的 JSON 数据。',
      tips: '🎯 <strong>接手即懂</strong>：①材料区 = 备件 + 历史版本 ②异常区 = 采样断档分离 ③时间线 = 状态+改判 ④顶部导出 = 重新导出。四个区域覆盖了复核的全部场景。',
      cls: 'guide-5',
      icon: '🗺️',
    },
  ],

  // ----------------------------------------------------------
  // 渲染接手引导
  // ----------------------------------------------------------
  renderGuide(activeIndex = 0) {
    const steps = this.GUIDE_STEPS;
    const stepsEl = document.getElementById('guideSteps');
    const dotsEl = document.getElementById('guideDots');
    const prevBtn = document.getElementById('btnGuidePrev');
    const nextBtn = document.getElementById('btnGuideNext');
    if (!stepsEl || !dotsEl) return;

    stepsEl.innerHTML = steps.map((s, i) => `
      <div class="guide-step ${i === activeIndex ? 'active' : ''}" data-step="${i}">
        <div class="guide-illustration ${s.cls}">
          <span class="guide-illustration-icon">${s.icon}</span>
        </div>
        <div class="guide-step-title">
          <span class="guide-step-num">${s.num}</span>
          ${s.title}
        </div>
        <div class="guide-step-desc">${s.desc}</div>
        <div class="guide-tips">${s.tips}</div>
      </div>`).join('');

    dotsEl.innerHTML = steps.map((_, i) =>
      `<span class="guide-dot ${i === activeIndex ? 'active' : ''}" data-dot="${i}"></span>`
    ).join('');

    dotsEl.querySelectorAll('.guide-dot').forEach(d => {
      d.addEventListener('click', () => App.setGuideStep(parseInt(d.dataset.dot)));
    });

    if (prevBtn) prevBtn.disabled = activeIndex === 0;
    if (nextBtn) {
      nextBtn.textContent = activeIndex === steps.length - 1 ? '开始使用' : '下一步';
      nextBtn.classList.toggle('btn-primary', true);
    }
  },

  // ----------------------------------------------------------
  // 提交复核材料表单
  // ----------------------------------------------------------
  renderSubmitForm() {
    const partsEl = document.getElementById('partsFormList');
    const samEl = document.getElementById('samplingFormList');
    if (partsEl) partsEl.innerHTML = '';
    if (samEl) samEl.innerHTML = '';

    document.getElementById('f_craneId').value = '';
    document.getElementById('f_craneName').value = '';
    document.getElementById('f_title').value = '';
    document.getElementById('f_type').value = '月度维保';
    document.getElementById('f_dtStart').value = '';
    document.getElementById('f_dtEnd').value = '';
    document.getElementById('f_scheduler').value = '宋建国';
    document.getElementById('f_maintainer').value = '';
    document.getElementById('f_status').value = 'pending';
    document.getElementById('f_operator').value = '现场调度';

    this.addPartRow();
    this.addSamplingRow();
  },

  addPartRow() {
    const partsEl = document.getElementById('partsFormList');
    if (!partsEl) return;
    const row = document.createElement('div');
    row.className = 'dyn-row';
    row.innerHTML = `
      <div class="form-item"><label>备件名称</label><input type="text" class="fp_name" placeholder="如 工业齿轮油 L-CKD 320"/></div>
      <div class="form-item"><label>规格型号</label><input type="text" class="fp_spec" placeholder="如 20L/桶"/></div>
      <div class="form-item"><label>数量</label><input type="number" class="fp_qty" value="1" step="0.1"/></div>
      <div class="form-item"><label>单位</label><input type="text" class="fp_unit" placeholder="桶"/></div>
      <div class="form-item"><label>计划到货</label><input type="datetime-local" class="fp_pa"/></div>
      <div class="form-item"><label>实际到货</label><input type="datetime-local" class="fp_aa"/></div>
      <button class="btn-remove-row" type="button" title="删除此备件">×</button>
    `;
    row.querySelector('.btn-remove-row').addEventListener('click', () => row.remove());
    partsEl.appendChild(row);
  },

  addSamplingRow() {
    const samEl = document.getElementById('samplingFormList');
    if (!samEl) return;
    const row = document.createElement('div');
    row.className = 'sampling-row';
    row.innerHTML = `
      <div class="form-item"><label>时间</label><input type="text" class="fs_time" placeholder="09:30"/></div>
      <div class="form-item"><label>数值</label><input type="number" class="fs_value" value="0" step="0.1"/></div>
      <div class="form-item"><label>状态</label>
        <select class="fs_status">
          <option value="normal">正常</option>
          <option value="abnormal">断档</option>
        </select>
      </div>
      <div class="form-item"><label>原因说明</label><input type="text" class="fs_reason" placeholder="如 油温正常 / 断档·传感器离线"/></div>
      <button class="btn-remove-row" type="button" title="删除此采样">×</button>
    `;
    row.querySelector('.btn-remove-row').addEventListener('click', () => row.remove());
    samEl.appendChild(row);
  },

  _dtLocalToStr(v) {
    if (!v) return '';
    return v.replace('T', ' ');
  },

  collectFormData() {
    const craneId = document.getElementById('f_craneId').value.trim();
    const title = document.getElementById('f_title').value.trim();
    const dtStart = document.getElementById('f_dtStart').value;
    const dtEnd = document.getElementById('f_dtEnd').value;

    if (!craneId || !title || !dtStart || !dtEnd) {
      return { error: '塔吊编号、工单标题、停机窗口起止为必填项' };
    }

    const parts = [];
    document.querySelectorAll('#partsFormList .dyn-row').forEach(row => {
      const name = row.querySelector('.fp_name').value.trim();
      if (!name) return;
      const spec = row.querySelector('.fp_spec').value.trim();
      const qty = parseFloat(row.querySelector('.fp_qty').value) || 1;
      const unit = row.querySelector('.fp_unit').value.trim();
      const plannedArrival = this._dtLocalToStr(row.querySelector('.fp_pa').value) || this._dtLocalToStr(dtStart);
      const actualArrival = this._dtLocalToStr(row.querySelector('.fp_aa').value) || plannedArrival;
      parts.push({
        name, spec, qty, unit,
        plannedArrival, actualArrival,
        remark: '', screenshotName: '',
        author: document.getElementById('f_operator').value.trim() || '提交人',
      });
    });
    if (parts.length === 0) {
      return { error: '至少需要一项备件' };
    }

    const sampling = [];
    document.querySelectorAll('#samplingFormList .sampling-row').forEach(row => {
      const time = row.querySelector('.fs_time').value.trim();
      if (!time) return;
      const value = parseFloat(row.querySelector('.fs_value').value) || 0;
      const status = row.querySelector('.fs_status').value;
      const reason = row.querySelector('.fs_reason').value.trim() || (status === 'abnormal' ? '采样断档' : '正常');
      const pct = Math.max(0, Math.min(100, Math.round(value)));
      sampling.push({ time, value, pct, status, reason });
    });

    return {
      data: {
        craneId,
        craneName: document.getElementById('f_craneName').value.trim() || craneId,
        title,
        type: document.getElementById('f_type').value,
        status: document.getElementById('f_status').value,
        scheduler: document.getElementById('f_scheduler').value.trim(),
        maintainer: document.getElementById('f_maintainer').value.trim(),
        downtimeWindow: { start: this._dtLocalToStr(dtStart), end: this._dtLocalToStr(dtEnd) },
        parts,
        sampling,
        operator: document.getElementById('f_operator').value.trim() || '现场调度',
        operatorRole: '现场调度',
      }
    };
  },
};
