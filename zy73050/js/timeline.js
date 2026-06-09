// ============================================================
// 历史时间线模块：处理状态流转 + 人工改判追溯
// ============================================================

const Timeline = {
  // 根据事件类型获取图标
  getIcon(type) {
    const icons = {
      created: '📝',
      assigned: '👥',
      in_progress: '🔧',
      parts_late: '⏰',
      sampling_abnormal: '⚠️',
      override: '✎',
      confirmed: '✅',
      returned: '↩️',
    };
    return icons[type] || '•';
  },

  // 渲染整条时间线
  render(workorder, showOverride = true) {
    const timelineEl = document.getElementById('timeline');
    if (!timelineEl) return '';

    let events = workorder.timeline || [];
    if (!showOverride) {
      events = events.filter(e => !e.isOverride);
    }
    if (events.length === 0) {
      timelineEl.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📭</div><div class="empty-state-text">暂无时间线记录</div></div>`;
      return;
    }

    const html = events.map(e => this.renderItem(e)).join('');
    timelineEl.innerHTML = html;
  },

  // 渲染单个时间线节点
  renderItem(event) {
    const dotClass = ['timeline-dot'];
    if (event.dotClass) dotClass.push(event.dotClass);
    if (event.isOverride) dotClass.push('override');

    const contentClass = ['timeline-content'];
    if (event.isOverride) contentClass.push('override');

    // 状态流转 HTML
    let transitionHtml = '';
    if (event.statusFrom && event.statusTo) {
      transitionHtml = `
        <div class="status-transition">
          <span class="st-from">${event.statusFrom}</span>
          <span class="st-arrow">→</span>
          <span class="st-to ${event.statusClass}">${event.statusTo}</span>
        </div>`;
    }

    // 人工改判标记
    let overrideBadge = '';
    if (event.isOverride) {
      overrideBadge = `<span class="override-tag">✎ 人工改判 · ${event.overrideReason || '负责人审批'}</span>`;
    }

    return `
      <div class="timeline-item">
        <div class="${dotClass.join(' ')}" title="${event.isOverride ? '人工改判节点' : '系统/正常节点'}">
          <span style="font-size:9px;">${this.getIcon(event.type)}</span>
        </div>
        <div class="${contentClass.join(' ')}">
          <div class="timeline-head">
            <div class="timeline-title">
              ${this.getIcon(event.type)} ${event.title}
              ${overrideBadge}
            </div>
            <div class="timeline-time">${event.time}</div>
          </div>
          <div class="timeline-desc">${event.desc}</div>
          <div class="timeline-meta">
            <span>操作人：<strong>${event.operator}</strong>（${event.operatorRole}）</span>
            ${transitionHtml}
          </div>
        </div>
      </div>`;
  },
};
