window.DashboardPage = {};

window.DashboardPage.render = function() {
    const container = document.getElementById('page-dashboard');
    const residentStats = DataService.Residents.getStatistics();
    const screeningStats = DataService.Screenings.getStatistics();
    const retestStats = DataService.Retests.getStatistics();
    const followupStats = DataService.Followups.getStatistics();

    const totalAbnormal = screeningStats.riskCounts.high + 
                         screeningStats.riskCounts.medium + 
                         screeningStats.riskCounts.low;

    container.innerHTML = `
        <div class="page-header">
            <h2 class="page-title">数据看板</h2>
            <div class="btn-group">
                <button class="btn btn-primary" onclick="DataService.Export.exportDashboardReport(); Utils.showToast('报表导出成功', 'success')">
                    📊 导出统计报表
                </button>
            </div>
        </div>

        <div class="process-flow">
            <div class="process-step completed">
                <span>📋 居民建档</span>
            </div>
            <span class="process-arrow">→</span>
            <div class="process-step ${screeningStats.total > 0 ? 'completed' : ''}">
                <span>🩺 血压筛查</span>
            </div>
            <span class="process-arrow">→</span>
            <div class="process-step ${screeningStats.statusCounts.need_retest > 0 ? 'active' : ''}">
                <span>🔄 复测确认</span>
            </div>
            <span class="process-arrow">→</span>
            <div class="process-step ${followupStats.total > 0 ? 'active' : ''}">
                <span>📞 随访管理</span>
            </div>
        </div>

        <div class="quick-actions">
            <div class="quick-action-card" onclick="App.navigateTo('residents'); setTimeout(function(){ResidentsPage.showCreateModal();}, 100)">
                <div class="quick-action-icon">👤</div>
                <div class="quick-action-title">新建居民</div>
                <div class="quick-action-desc">录入居民基础档案</div>
            </div>
            <div class="quick-action-card" onclick="App.navigateTo('screenings'); setTimeout(function(){ScreeningsPage.showCreateModal();}, 100)">
                <div class="quick-action-icon">🩺</div>
                <div class="quick-action-title">录入血压</div>
                <div class="quick-action-desc">添加筛查血压数据</div>
            </div>
            <div class="quick-action-card" onclick="App.navigateTo('screenings'); setTimeout(function(){ScreeningsPage.showImportModal();}, 100)">
                <div class="quick-action-icon">📥</div>
                <div class="quick-action-title">批量导入</div>
                <div class="quick-action-desc">导入筛查数据</div>
            </div>
            <div class="quick-action-card" onclick="App.navigateTo('screenings')">
                <div class="quick-action-icon">👁️</div>
                <div class="quick-action-title">待复核 (${screeningStats.statusCounts.pending_review})</div>
                <div class="quick-action-desc">风险等级复核</div>
            </div>
        </div>

        <div class="stats-container">
            <div class="stat-card">
                <div class="stat-title">居民档案</div>
                <div class="stat-value">${residentStats.total}</div>
                <div class="stat-subtitle">有病史 ${residentStats.withHistory} 人</div>
            </div>
            <div class="stat-card">
                <div class="stat-title">筛查记录</div>
                <div class="stat-value">${screeningStats.total}</div>
                <div class="stat-subtitle">本月新增 ${screeningStats.thisMonthCount} 条</div>
            </div>
            <div class="stat-card high-risk">
                <div class="stat-title">高危预警</div>
                <div class="stat-value">${screeningStats.riskCounts.high}</div>
                <div class="stat-subtitle">需立即关注</div>
            </div>
            <div class="stat-card medium-risk">
                <div class="stat-title">中低危</div>
                <div class="stat-value">${screeningStats.riskCounts.medium + screeningStats.riskCounts.low}</div>
                <div class="stat-subtitle">需复测确认</div>
            </div>
            <div class="stat-card warning">
                <div class="stat-title">待复测</div>
                <div class="stat-value">${retestStats.statusCounts.pending}</div>
                <div class="stat-subtitle">逾期 ${retestStats.overdue} 人</div>
            </div>
            <div class="stat-card">
                <div class="stat-title">随访中</div>
                <div class="stat-value">${followupStats.statusCounts.assigned + followupStats.statusCounts.in_progress}</div>
                <div class="stat-subtitle">已完成 ${followupStats.statusCounts.completed} 人</div>
            </div>
        </div>

        <div class="charts-container">
            <div class="chart-card">
                <h3 class="chart-title">风险分层分布</h3>
                ${this.renderRiskBar(screeningStats)}
                <div class="risk-legend">
                    <div class="risk-legend-item">
                        <span class="risk-legend-dot high"></span>
                        <span>高危 (${screeningStats.riskCounts.high})</span>
                    </div>
                    <div class="risk-legend-item">
                        <span class="risk-legend-dot medium"></span>
                        <span>中危 (${screeningStats.riskCounts.medium})</span>
                    </div>
                    <div class="risk-legend-item">
                        <span class="risk-legend-dot low"></span>
                        <span>低危 (${screeningStats.riskCounts.low})</span>
                    </div>
                    <div class="risk-legend-item">
                        <span class="risk-legend-dot normal"></span>
                        <span>正常 (${screeningStats.riskCounts.normal})</span>
                    </div>
                </div>
            </div>

            <div class="chart-card">
                <h3 class="chart-title">流程闭环统计</h3>
                <div class="detail-grid" style="grid-template-columns: repeat(2, 1fr);">
                    <div class="detail-item">
                        <div class="detail-item-label">筛查待复核</div>
                        <div class="detail-item-value" style="color: #f39c12; font-size: 1.2rem;">
                            ${screeningStats.statusCounts.pending_review}
                        </div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-item-label">需创建复测</div>
                        <div class="detail-item-value" style="color: #9b59b6; font-size: 1.2rem;">
                            ${screeningStats.statusCounts.need_retest}
                        </div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-item-label">复测仍异常</div>
                        <div class="detail-item-value" style="color: #e74c3c; font-size: 1.2rem;">
                            ${retestStats.statusCounts.still_abnormal}
                        </div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-item-label">已结案</div>
                        <div class="detail-item-value" style="color: #27ae60; font-size: 1.2rem;">
                            ${screeningStats.statusCounts.resolved}
                        </div>
                    </div>
                </div>
            </div>
        </div>

        ${this.renderRecentActivities()}
    `;
};

window.DashboardPage.renderRiskBar = function(stats) {
    const total = stats.total;
    if (total === 0) {
        return '<div class="empty-state"><div class="empty-state-icon">📊</div><div class="empty-state-text">暂无筛查数据</div></div>';
    }

    const highPercent = (stats.riskCounts.high / total * 100).toFixed(1);
    const mediumPercent = (stats.riskCounts.medium / total * 100).toFixed(1);
    const lowPercent = (stats.riskCounts.low / total * 100).toFixed(1);
    const normalPercent = (stats.riskCounts.normal / total * 100).toFixed(1);

    let bar = '<div class="risk-bar">';
    if (stats.riskCounts.high > 0) bar += '<div class="risk-bar-segment high" style="width: ' + highPercent + '%">' + highPercent + '%</div>';
    if (stats.riskCounts.medium > 0) bar += '<div class="risk-bar-segment medium" style="width: ' + mediumPercent + '%">' + mediumPercent + '%</div>';
    if (stats.riskCounts.low > 0) bar += '<div class="risk-bar-segment low" style="width: ' + lowPercent + '%">' + lowPercent + '%</div>';
    if (stats.riskCounts.normal > 0) bar += '<div class="risk-bar-segment normal" style="width: ' + normalPercent + '%">' + normalPercent + '%</div>';
    bar += '</div>';

    return bar;
};

window.DashboardPage.renderRecentActivities = function() {
    const screenings = DataService.Screenings.getAll()
        .sort(function(a, b) { return new Date(b.createdAt) - new Date(a.createdAt); })
        .slice(0, 5);
    
    const retests = DataService.Retests.getAll()
        .sort(function(a, b) { return new Date(b.createdAt) - new Date(a.createdAt); })
        .slice(0, 5);
    
    const followups = DataService.Followups.getAll()
        .sort(function(a, b) { return new Date(b.createdAt) - new Date(a.createdAt); })
        .slice(0, 5);

    if (screenings.length === 0 && retests.length === 0 && followups.length === 0) {
        return `
            <div class="chart-card">
                <h3 class="chart-title">最近活动</h3>
                <div class="empty-state">
                    <div class="empty-state-icon">📋</div>
                    <div class="empty-state-text">暂无活动记录</div>
                    <div class="empty-state-hint">从"新建居民"或"录入血压"开始您的第一条记录</div>
                </div>
            </div>
        `;
    }

    const events = [];
    screenings.forEach(function(s) {
        events.push({ type: 'screening', data: s, time: s.createdAt });
    });
    retests.forEach(function(r) {
        events.push({ type: 'retest', data: r, time: r.createdAt });
    });
    followups.forEach(function(f) {
        events.push({ type: 'followup', data: f, time: f.createdAt });
    });

    events.sort(function(a, b) { return new Date(b.time) - new Date(a.time); });

    let html = `
        <div class="chart-card">
            <h3 class="chart-title">最近活动</h3>
            <div class="timeline">
    `;

    events.slice(0, 8).forEach(function(item) {
        html += DashboardPage.renderTimelineItem(item);
    });

    html += `
            </div>
        </div>
    `;

    return html;
};

window.DashboardPage.renderTimelineItem = function(item) {
    const { type, data, time } = item;
    let title = '';
    let content = '';
    let className = '';

    if (type === 'screening') {
        const riskClass = Utils.getRiskBadgeClass(data.riskLevel);
        const riskLabel = DataService.Constants.RISK_LABELS[data.riskLevel];
        title = '血压筛查 - ' + data.residentName;
        content = '血压 ' + data.systolic + '/' + data.diastolic + ' mmHg，<span class="badge ' + riskClass + '">' + riskLabel + '</span>';
        className = data.riskLevel === 'high' ? 'danger' : 
                   data.riskLevel === 'medium' ? 'warning' : 
                   data.riskLevel === 'low' ? '' : 'success';
    } else if (type === 'retest') {
        title = '复测任务 - ' + data.residentName;
        const statusLabel = DataService.Constants.RETEST_STATUS_LABELS[data.status];
        const statusClass = Utils.getStatusBadgeClass(data.status, 'retest');
        if (data.status === 'pending') {
            content = '计划复测时间：' + DataService.Utils.formatDate(data.scheduledDate) + ' ' + (data.scheduledTime || '') + '，<span class="badge ' + statusClass + '">' + statusLabel + '</span>';
        } else {
            content = '复测结果 ' + data.resultSystolic + '/' + data.resultDiastolic + ' mmHg，<span class="badge ' + statusClass + '">' + statusLabel + '</span>';
        }
        className = data.status === 'still_abnormal' ? 'danger' : 
                   data.status === 'normal' ? 'success' : '';
    } else if (type === 'followup') {
        title = '随访任务 - ' + data.residentName;
        const statusLabel = DataService.Constants.FOLLOWUP_STATUS_LABELS[data.status];
        const statusClass = Utils.getStatusBadgeClass(data.status, 'followup');
        content = '责任人：' + (data.assignedToName || '未指定') + '，<span class="badge ' + statusClass + '">' + statusLabel + '</span>';
        className = data.status === 'escalated' ? 'danger' : 
                   data.status === 'completed' ? 'success' : '';
    }

    return `
        <div class="timeline-item ${className}">
            <div class="timeline-item-header">
                <div class="timeline-item-title">${title}</div>
                <div class="timeline-item-time">${DataService.Utils.formatDateTime(time)}</div>
            </div>
            <div class="timeline-item-content">${content}</div>
        </div>
    `;
};
