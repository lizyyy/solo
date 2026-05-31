export function renderJudgment(containerId, result) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const statusClass = result.status === 'pass' ? 'pass' : result.status === 'warn' ? 'warn' : 'fail';

    container.innerHTML = `
        <div class="judgment-result">
            <span class="judgment-status ${statusClass}">${result.label}</span>
        </div>
        <div class="judgment-reason">${result.reason}</div>
        <div class="judgment-next-step">${result.nextStep}</div>
    `;
}

export function renderStatus(areaId, message, type = 'info') {
    const area = document.getElementById(areaId);
    if (!area) return;

    const msgEl = document.createElement('div');
    msgEl.className = `status-msg ${type}`;
    msgEl.textContent = message;
    area.appendChild(msgEl);

    setTimeout(() => {
        if (msgEl.parentNode) msgEl.remove();
    }, 15000);
}

export function renderTimeline(historyList, filter = 'all') {
    const container = document.getElementById('history-list');
    if (!container) return;

    const filtered = filter === 'all'
        ? historyList
        : historyList.filter(h => h.actionType === filter);

    container.innerHTML = '';

    if (filtered.length === 0) {
        container.innerHTML = '<div style="color:var(--text-secondary);font-size:13px;padding:20px;text-align:center;">暂无记录</div>';
        return;
    }

    const sorted = [...filtered].sort((a, b) => b.timestamp - a.timestamp);

    for (const item of sorted) {
        const el = document.createElement('div');
        el.className = `timeline-item ${item.actionType}`;
        el.innerHTML = `
            <div class="timeline-time">${new Date(item.timestamp).toLocaleString()}</div>
            <div class="timeline-action">${item.action}</div>
            <div class="timeline-detail">${item.detail || ''}</div>
            ${item.judgmentReason ? `<div class="timeline-judgment">判断理由：${item.judgmentReason}</div>` : ''}
        `;
        container.appendChild(el);
    }
}

export function renderColorCardDiff(diff, oldVersion, newVersion) {
    const container = document.getElementById('colorcard-change-detail');
    if (!container) return;

    let html = '<p style="font-size:13px;margin-bottom:12px;">检测到色卡从版本 ' + oldVersion + ' 变更为版本 ' + newVersion + '，具体变化如下：</p>';

    if (diff.modified.length > 0) {
        html += '<h4 style="color:var(--warning);margin:8px 0 4px;font-size:13px;">色值变化</h4>';
        for (const item of diff.modified) {
            html += `<div class="change-diff-item modified">
                <span>"${item.name}"</span>
                <span class="color-swatch" style="background:${item.oldHex}"></span>
                <span style="font-size:11px;">${item.oldHex}</span>
                <span class="change-arrow">→</span>
                <span class="color-swatch" style="background:${item.newHex}"></span>
                <span style="font-size:11px;">${item.newHex}</span>
            </div>`;
        }
    }

    if (diff.added.length > 0) {
        html += '<h4 style="color:var(--success);margin:8px 0 4px;font-size:13px;">新增颜色</h4>';
        for (const item of diff.added) {
            html += `<div class="change-diff-item added">
                <span>+ "${item.name}"</span>
                <span class="color-swatch" style="background:${item.newHex}"></span>
                <span style="font-size:11px;">${item.newHex}</span>
            </div>`;
        }
    }

    if (diff.removed.length > 0) {
        html += '<h4 style="color:var(--danger);margin:8px 0 4px;font-size:13px;">移除颜色</h4>';
        for (const item of diff.removed) {
            html += `<div class="change-diff-item removed">
                <span>- "${item.name}"</span>
                <span class="color-swatch" style="background:${item.oldHex}"></span>
                <span style="font-size:11px;">${item.oldHex}</span>
            </div>`;
        }
    }

    html += '<p style="font-size:12px;color:var(--text-secondary);margin-top:12px;">如果确认变更，系统会保留旧版本记录，不会静默覆盖。下次复核时会标记哪些颜色发生了变化。</p>';

    container.innerHTML = html;
}

export function renderCorrectionIssues(project) {
    const container = document.getElementById('correction-issues');
    if (!container) return;

    const issues = [];

    if (project.authorization) {
        const end = new Date(project.authorization.endDate);
        const now = new Date();
        const days = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
        if (days <= 7 && days >= 0) {
            issues.push({
                id: 'auth-expiry',
                title: '授权即将到期',
                desc: `授权将在 ${days} 天后到期（${project.authorization.endDate}），建议续签。`,
                field: 'authorization.endDate',
                fixType: 'text',
                fixPlaceholder: '填入新的授权截止日期'
            });
        }
    }

    if (project.colorCards.length > 1) {
        const latest = project.colorCards[project.colorCards.length - 1];
        if (latest.changeAlert) {
            issues.push({
                id: 'colorcard-change',
                title: '色卡有变更',
                desc: latest.changeAlert,
                field: 'colorCard',
                fixType: 'info',
                fixPlaceholder: '已记录变更，确认即可'
            });
        }
    }

    if (issues.length === 0) {
        container.innerHTML = '<p style="color:var(--success);font-size:13px;">当前无待修正项。</p>';
        document.getElementById('correction-form').innerHTML = '';
        return;
    }

    container.innerHTML = '';
    const formContainer = document.getElementById('correction-form');
    formContainer.innerHTML = '';

    for (const issue of issues) {
        const el = document.createElement('div');
        el.className = 'correction-issue';
        el.innerHTML = `
            <div class="issue-title">${issue.title}</div>
            <div class="issue-desc">${issue.desc}</div>
            <div class="issue-fix">
                <input type="text" data-issue-id="${issue.id}" data-field="${issue.field}" placeholder="${issue.fixPlaceholder}">
            </div>
        `;
        container.appendChild(el);
    }
}
