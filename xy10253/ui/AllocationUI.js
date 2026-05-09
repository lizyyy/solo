const AllocationUI = {
    app: null,
    
    init: function(app) {
        this.app = app;
        this.bindEvents();
    },
    
    bindEvents: function() {
        document.getElementById('run-allocation-btn').addEventListener('click', () => this.runAllocation());
        document.getElementById('reset-allocation-btn').addEventListener('click', () => this.resetAllocation());
    },
    
    runAllocation: function() {
        const settings = {
            useVoiceRange: document.getElementById('use-voice-range').checked,
            usePreference: document.getElementById('use-preference').checked,
            useStanding: document.getElementById('use-standing').checked,
            balanceSections: document.getElementById('balance-sections').checked
        };
        
        const result = this.app.runAllocation(settings);
        this.render(result);
        this.showToast('分配完成', 'success');
    },
    
    resetAllocation: function() {
        this.app.resetAllocation();
        document.getElementById('allocation-result').innerHTML = `
            <div class="empty-state">
                <p>点击"开始分配"按钮进行声部分配</p>
            </div>
        `;
        this.showToast('分配已重置', 'info');
    },
    
    manualAllocate: function(memberId, sectionId) {
        const result = this.app.manualAllocate(memberId, sectionId);
        this.render(result);
        this.showToast('分配已更新', 'success');
    },
    
    render: function(result) {
        const container = document.getElementById('allocation-result');
        const members = this.app.state.members;
        const sections = this.app.state.sections;
        
        if (!result) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>点击"开始分配"按钮进行声部分配</p>
                </div>
            `;
            return;
        }
        
        const summary = result.getSummary(members, sections);
        
        let html = this.renderStats(result);
        html += this.renderSummarySection(summary);
        
        for (const sectionId in summary.sections) {
            html += this.renderSectionAllocation(summary.sections[sectionId]);
        }
        
        if (summary.unallocated.length > 0) {
            html += this.renderUnallocated(summary.unallocated, sections);
        }
        
        container.innerHTML = html;
    },
    
    renderStats: function(result) {
        const stats = result.stats;
        
        return `
            <div class="stats-panel">
                <div class="stat-item">
                    <div class="stat-value">${stats.totalMembers}</div>
                    <div class="stat-label">出勤总人数</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value" style="color: var(--success-color)">${stats.allocated}</div>
                    <div class="stat-label">已分配</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value" style="color: ${stats.unallocated > 0 ? 'var(--error-color)' : 'var(--text-secondary)'}">${stats.unallocated}</div>
                    <div class="stat-label">未分配</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value" style="color: ${stats.voiceRangeMatchRate < 1 ? 'var(--warning-color)' : 'var(--success-color)'}">${(stats.voiceRangeMatchRate * 100).toFixed(0)}%</div>
                    <div class="stat-label">音域匹配率</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value" style="color: ${stats.preferenceMatchRate < 1 ? 'var(--warning-color)' : 'var(--success-color)'}">${(stats.preferenceMatchRate * 100).toFixed(0)}%</div>
                    <div class="stat-label">偏好匹配率</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value" style="color: ${stats.sectionsBalanced ? 'var(--success-color)' : 'var(--warning-color)'}">${stats.sectionsBalanced ? '✓' : '✗'}</div>
                    <div class="stat-label">声部平衡</div>
                </div>
            </div>
        `;
    },
    
    renderSummarySection: function(summary) {
        let html = '<div class="summary-section"><h3>分配结果汇总</h3>';
        
        if (summary.unallocated.length === 0 && summary.conflicts.length === 0) {
            html += '<p><strong>当前状态：</strong>分配正常完成，所有成员已分配到合适的声部</p>';
            html += '<p><strong>处理建议：</strong>可以直接使用此分配方案进行排练</p>';
        } else {
            if (summary.unallocated.length > 0) {
                html += `<p><strong>当前状态：</strong>${summary.unallocated.length} 位成员未能分配到声部</p>`;
            }
            if (summary.conflicts.length > 0) {
                html += `<p><strong>当前状态：</strong>存在 ${summary.conflicts.length} 个分配冲突</p>`;
            }
            html += '<p><strong>处理建议：</strong>请查看下方详细信息，考虑调整音域设置或声部容量后重新分配</p>';
        }
        
        if (summary.warnings.length > 0) {
            html += '<h4 style="margin-top: 16px; margin-bottom: 8px;">警告信息：</h4>';
            summary.warnings.forEach(warning => {
                html += `<p style="color: var(--warning-color); margin-left: 16px;">⚠ ${warning.message}</p>`;
            });
        }
        
        html += '</div>';
        return html;
    },
    
    renderSectionAllocation: function(sectionData) {
        const section = sectionData.section;
        const members = sectionData.members;
        const allSections = this.app.state.sections;
        
        let statusClass = '';
        let statusText = '';
        
        if (sectionData.isOverMax) {
            statusClass = 'error';
            statusText = '（超额）';
        } else if (sectionData.isBelowMin) {
            statusClass = 'warning';
            statusText = '（不足）';
        }
        
        return `
            <div class="section-allocation" style="background: ${section.color}20;">
                <div class="section-allocation-header">
                    <h3>${section.name}${section.shortName ? ` (${section.shortName})` : ''}
                        <span style="font-size: 14px; font-weight: normal; color: var(--text-secondary); margin-left: 8px;">
                            ${statusText}
                        </span>
                    </h3>
                    <div class="section-capacity">
                        ${sectionData.count} / ${section.minCapacity}-${section.maxCapacity} 人
                        <span style="margin-left: 12px; font-family: monospace;">
                            ${section.voiceLow} - ${section.voiceHigh}
                        </span>
                    </div>
                </div>
                <div class="section-allocation-members">
                    ${members.length === 0 ? `
                        <div style="grid-column: 1/-1; text-align: center; color: var(--text-secondary); padding: 20px;">
                            暂无人分配到此声部
                        </div>
                    ` : members.map(m => `
                        <div class="allocated-member">
                            <div>
                                <strong>${m.member.name}</strong>
                                ${m.member.isCoreMember ? '<span class="core-badge" style="margin-left: 4px;">核心</span>' : ''}
                            </div>
                            <div style="margin-left: auto;">
                                <span class="voice-range" style="font-size: 11px;">
                                    ${m.member.voiceLow}-${m.member.voiceHigh}
                                </span>
                                <select 
                                    style="margin-left: 8px; padding: 4px 8px; font-size: 12px; border: 1px solid var(--border-color); border-radius: 4px;"
                                    onchange="AllocationUI.manualAllocate('${m.member.id}', this.value)"
                                >
                                    <option value="${section.id}">${section.displayName}</option>
                                    ${allSections.filter(s => s.id !== section.id).map(s => `
                                        <option value="${s.id}">${s.displayName}</option>
                                    `).join('')}
                                </select>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    },
    
    renderUnallocated: function(unallocated, sections) {
        return `
            <div class="section-allocation unallocated-section">
                <div class="section-allocation-header">
                    <h3>未分配成员</h3>
                    <div class="section-capacity">
                        ${unallocated.length} 人
                    </div>
                </div>
                <div class="section-allocation-members">
                    ${unallocated.map(u => `
                        <div class="allocated-member">
                            <div>
                                <strong>${u.member.name}</strong>
                                <div style="font-size: 12px; color: var(--error-color); margin-top: 4px;">
                                    原因：${u.reason}
                                </div>
                            </div>
                            <div style="margin-left: auto;">
                                <span class="voice-range" style="font-size: 11px;">
                                    ${u.member.voiceLow}-${u.member.voiceHigh}
                                </span>
                                <select 
                                    style="margin-left: 8px; padding: 4px 8px; font-size: 12px; border: 1px solid var(--border-color); border-radius: 4px;"
                                    onchange="AllocationUI.manualAllocate('${u.member.id}', this.value)"
                                >
                                    <option value="">手动分配...</option>
                                    ${sections.map(s => `
                                        <option value="${s.id}">${s.displayName}</option>
                                    `).join('')}
                                </select>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    },
    
    showToast: function(message, type = 'info') {
        if (typeof window.app !== 'undefined' && window.app.showToast) {
            window.app.showToast(message, type);
        }
    }
};
