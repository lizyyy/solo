const UI = {
    log: function(message, type = LOG_TYPE.INFO) {
        const container = document.getElementById('logContainer');
        const time = new Date().toLocaleTimeString('zh-CN', { hour12: false });
        const entry = document.createElement('div');
        entry.className = 'log-entry';
        entry.innerHTML = `<span class="log-time">[${time}]</span><span class="log-type ${type}">${message}</span>`;
        container.appendChild(entry);
        container.scrollTop = container.scrollHeight;
    },

    loadSamples: function() {
        const sampleList = document.getElementById('sampleList');
        sampleList.innerHTML = '';
        
        Object.values(SAMPLES).forEach(sample => {
            const item = document.createElement('div');
            item.className = 'sample-item';
            item.dataset.id = sample.id;
            item.innerHTML = `
                <div>${sample.name}</div>
                <div class="sample-tag ${sample.tag}">${sample.description}</div>
            `;
            item.addEventListener('click', () => App.loadSample(sample.id));
            sampleList.appendChild(item);
        });
    },

    loadRules: function() {
        const rulesPanel = document.getElementById('rulesPanel');
        rulesPanel.innerHTML = RULES.map(rule => `
            <div class="rule-item">
                <span class="rule-icon">${rule.icon}</span>
                <div>${rule.description}</div>
            </div>
        `).join('');
    },

    renderProgramList: function(programs) {
        const programList = document.getElementById('programList');
        
        if (!programs || programs.length === 0) {
            programList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📭</div>
                    <div class="empty-state-text">暂无节目，点击下方按钮添加</div>
                </div>
            `;
            return;
        }

        programList.innerHTML = programs.map((program, index) => `
            <div class="program-card" data-id="${program.id}">
                <div class="program-header">
                    <div class="program-index">${index + 1}</div>
                    <div class="program-actions">
                        <button class="btn btn-icon btn-secondary" onclick="App.moveUp('${program.id}')" title="上移">↑</button>
                        <button class="btn btn-icon btn-secondary" onclick="App.moveDown('${program.id}')" title="下移">↓</button>
                        <button class="btn btn-icon btn-danger" onclick="App.removeProgram('${program.id}')" title="删除">🗑️</button>
                    </div>
                </div>
                <div class="program-fields">
                    <div class="field-group">
                        <label>节目名称</label>
                        <input type="text" value="${program.title}" 
                               onchange="App.updateProgram('${program.id}', 'title', this.value)">
                    </div>
                    <div class="field-group">
                        <label>时长(分钟)</label>
                        <input type="number" min="1" max="60" value="${program.duration}"
                               onchange="App.updateProgram('${program.id}', 'duration', parseInt(this.value))">
                    </div>
                    <div class="field-group">
                        <label>节目内容</label>
                        <textarea onchange="App.updateProgram('${program.id}', 'content', this.value)">${program.content}</textarea>
                    </div>
                </div>
            </div>
        `).join('');
    },

    renderDurationResult: function(result) {
        const panel = document.getElementById('durationPanel');
        
        if (!result) {
            panel.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">⏱️</div>
                    <div class="empty-state-text">点击"运行时长校验"按钮开始检查</div>
                </div>
            `;
            return;
        }

        const statusClass = result.status === CHECK_STATUS.PASS ? 'success' : 
                           result.status === CHECK_STATUS.WARNING ? 'warning' : 'error';
        const statusText = result.status === CHECK_STATUS.PASS ? '通过' : 
                          result.status === CHECK_STATUS.WARNING ? '警告' : '失败';
        const statusBadgeClass = result.status === CHECK_STATUS.PASS ? 'status-pass' : 
                                result.status === CHECK_STATUS.WARNING ? 'status-warn' : 'status-fail';

        const percentage = parseFloat(result.output.percentage);
        const barClass = result.status === CHECK_STATUS.FAIL ? 'exceed' : 
                        result.status === CHECK_STATUS.WARNING ? 'warning' : '';

        let html = `
            <div class="check-result ${statusClass}">
                <div class="check-result-header">
                    <div class="check-result-title">⏱️ 时长校验结果</div>
                    <span class="check-result-status ${statusBadgeClass}">${statusText}</span>
                </div>
                <div class="check-result-detail">
                    <p><strong>输入：</strong>${result.input.slotName}时段 (${result.input.slotDisplay})，${result.input.programCount}个节目</p>
                    <p><strong>输出：</strong>总时长${result.output.totalDuration}分钟 / 时段上限${result.output.slotMaxDuration}分钟 (${result.output.percentage}%)</p>
                </div>
                <div class="duration-bar">
                    <div class="duration-bar-fill ${barClass}" style="width: ${Math.min(percentage, 100)}%"></div>
                </div>
                <div class="duration-labels">
                    <span>0</span>
                    <span>警告阈值 (${result.output.slotWarningThreshold}分钟)</span>
                    <span>上限 (${result.output.slotMaxDuration}分钟)</span>
                </div>
        `;

        if (result.failures.length > 0) {
            html += `<div class="check-result-detail" style="margin-top: 16px;"><strong>❌ 失败原因：</strong></div>`;
            result.failures.forEach(f => {
                html += `<div class="check-result-detail">• ${f.message}</div>`;
            });
        }

        if (result.warnings.length > 0) {
            html += `<div class="check-result-detail" style="margin-top: 16px;"><strong>⚠️ 警告：</strong></div>`;
            result.warnings.forEach(w => {
                html += `<div class="check-result-detail">• ${w.message}</div>`;
            });
        }

        html += `</div>`;

        if (result.details && result.details.length > 0) {
            html += `<div class="check-result" style="margin-top: 20px;">
                <div class="check-result-header">
                    <div class="check-result-title">📋 各节目时长详情</div>
                </div>
            `;
            result.details.forEach(detail => {
                const detailStatus = detail.status === CHECK_STATUS.PASS ? 'status-pass' : 'status-fail';
                const detailStatusText = detail.status === CHECK_STATUS.PASS ? '正常' : '超限';
                html += `
                    <div class="program-check-item">
                        <div class="program-check-item-header">
                            <span>${detail.index}. ${detail.title}</span>
                            <span class="check-result-status ${detailStatus}">${detailStatusText}</span>
                        </div>
                        <div class="check-result-detail">
                            时长: ${detail.duration}分钟
                            ${detail.issues.length > 0 ? ` (超限: ${detail.issues.map(i => i.message).join('; ')})` : ''}
                        </div>
                    </div>
                `;
            });
            html += `</div>`;
        }

        panel.innerHTML = html;
    },

    renderSensitiveResult: function(result) {
        const panel = document.getElementById('sensitivePanel');
        
        if (!result) {
            panel.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">🔍</div>
                    <div class="empty-state-text">点击"运行敏感词扫描"按钮开始检查</div>
                </div>
            `;
            return;
        }

        const statusClass = result.status === CHECK_STATUS.PASS ? 'success' : 'error';
        const statusText = result.status === CHECK_STATUS.PASS ? '通过' : '发现问题';
        const statusBadgeClass = result.status === CHECK_STATUS.PASS ? 'status-pass' : 'status-fail';

        let html = `
            <div class="check-result ${statusClass}">
                <div class="check-result-header">
                    <div class="check-result-title">🔍 敏感词扫描结果</div>
                    <span class="check-result-status ${statusBadgeClass}">${statusText}</span>
                </div>
                <div class="check-result-detail">
                    <p><strong>输入：</strong>${result.input.programCount}个节目，敏感词库${result.input.dictionarySize}个词</p>
                    <p><strong>输出：</strong>发现${result.output.totalMatches}个敏感词，涉及${result.output.affectedPrograms}个节目，${result.output.cleanPrograms}个节目干净</p>
                </div>
        `;

        if (result.failures.length > 0) {
            html += `<div class="check-result-detail" style="margin-top: 16px;"><strong>❌ 发现的敏感词：</strong></div>`;
        }

        html += `</div>`;

        if (result.matches && result.matches.length > 0) {
            result.matches.forEach(programMatch => {
                html += `<div class="check-result error" style="margin-top: 16px;">
                    <div class="check-result-header">
                        <div class="check-result-title">📺 ${programMatch.programIndex}. ${programMatch.programTitle}</div>
                        <span class="check-result-status status-fail">${programMatch.matches.length}处</span>
                    </div>
                `;
                
                programMatch.matches.forEach(match => {
                    html += `
                        <div class="sensitive-match">
                            <div class="sensitive-match-title">
                                🔴 敏感词: "${match.word}" ${match.inTitle ? '(在标题中)' : ''}
                            </div>
                            <div class="sensitive-match-context">
                                上下文: ${match.highlightedContext}
                            </div>
                        </div>
                    `;
                });
                
                html += `</div>`;
            });
        }

        panel.innerHTML = html;
    },

    renderPublishResult: function(publishResult, publishStatus, scheduleData) {
        const panel = document.getElementById('publishPanel');
        
        if (!publishResult) {
            panel.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">🚪</div>
                    <div class="empty-state-text">请先完成时长校验和敏感词扫描</div>
                </div>
            `;
            return;
        }

        const slot = TIME_SLOTS[scheduleData.slot];
        
        const statusBadgeClass = publishStatus === PUBLISH_STATUS.PUBLISHED ? 'published' :
                                publishStatus === PUBLISH_STATUS.WITHDRAWN ? 'withdrawn' : 'draft';
        const statusText = publishStatus === PUBLISH_STATUS.PUBLISHED ? '✅ 已发布' :
                          publishStatus === PUBLISH_STATUS.WITHDRAWN ? '❌ 已撤回' : '📝 草稿';

        let html = `
            <div class="publish-card">
                <h3>${scheduleData.date} ${slot.name}时段节目单</h3>
                <p>时段: ${slot.display} (${slot.duration}分钟)</p>
                <p>节目数量: ${scheduleData.programs.length}个</p>
                <span class="publish-status ${statusBadgeClass}">${statusText}</span>
            </div>
        `;

        html += `
            <div class="checklist">
                <h4>📋 发布门禁检查清单</h4>
        `;

        publishResult.checklist.forEach(item => {
            const iconClass = item.checked ? 
                (item.passed ? 'pass' : 'fail') : 'pending';
            const iconText = item.checked ?
                (item.passed ? '✓' : '✗') : '?';
            
            html += `
                <div class="checklist-item">
                    <div class="checklist-icon ${iconClass}">${iconText}</div>
                    <div class="checklist-text">
                        <div class="label">${item.icon} ${item.name}</div>
                        <div class="detail">${item.detail}</div>
                    </div>
                </div>
            `;
        });

        html += `</div>`;

        if (publishResult.failures.length > 0) {
            html += `
                <div class="check-result error" style="margin-top: 20px;">
                    <div class="check-result-header">
                        <div class="check-result-title">❌ 发布被阻止</div>
                        <span class="check-result-status status-fail">禁止发布</span>
                    </div>
                    <div class="check-result-detail">
                        ${publishResult.failures.map(f => `<p>• ${f.message}</p>`).join('')}
                    </div>
                </div>
            `;
        }

        if (publishResult.canPublish) {
            html += `
                <div class="check-result success" style="margin-top: 20px;">
                    <div class="check-result-header">
                        <div class="check-result-title">✅ 所有检查通过</div>
                        <span class="check-result-status status-pass">可以发布</span>
                    </div>
                    <div class="check-result-detail">
                        <p>输入: 时长检查=${publishResult.input.durationStatus}，敏感词检查=${publishResult.input.sensitiveStatus}</p>
                        <p>输出: 发布许可=✅ 允许发布</p>
                        ${publishResult.output.durationWarning ? '<p>⚠️ 注意：总时长接近时段上限，请确认</p>' : ''}
                    </div>
                </div>
            `;
        }

        panel.innerHTML = html;
    },

    renderIssues: function(issues) {
        const panel = document.getElementById('issuesPanel');
        
        if (!issues || issues.length === 0) {
            panel.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">✅</div>
                    <div class="empty-state-text">暂无问题记录</div>
                </div>
            `;
            return;
        }

        panel.innerHTML = issues.map(issue => {
            const formatted = IssueManager.formatIssue(issue);
            const icon = issue.level === ISSUE_LEVEL.ERROR ? '❌' :
                        issue.level === ISSUE_LEVEL.WARNING ? '⚠️' : 'ℹ️';
            const levelClass = issue.level === ISSUE_LEVEL.ERROR ? 'error' :
                             issue.level === ISSUE_LEVEL.WARNING ? 'warning' : '';
            
            const sourcePreview = issue.sourceData ? 
                `${issue.sourceData.date || '未知日期'} ${TIME_SLOTS[issue.sourceData.slot]?.name || '未知时段'}` :
                '未知来源';

            return `
                <div class="issue-card ${levelClass}">
                    <div class="issue-icon">${icon}</div>
                    <div class="issue-content">
                        <div class="issue-title">${issue.title}</div>
                        <div class="check-result-detail">${formatted.levelText} | ${formatted.sourceText}</div>
                        <pre class="issue-source">来源: ${sourcePreview}</pre>
                        <div class="issue-meta">
                            <span>📅 ${formatted.timeText}</span>
                            <span>🔢 ID: ${issue.id}</span>
                            <span>📁 类型: ${issue.type}</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    },

    switchTab: function(tabName) {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });
        document.querySelectorAll('.tab-pane').forEach(pane => {
            pane.classList.toggle('active', pane.id === `tab-${tabName}`);
        });
    },

    updateSampleSelection: function(sampleId) {
        document.querySelectorAll('.sample-item').forEach(item => {
            item.classList.toggle('active', item.dataset.id === sampleId);
        });
    },

    updateScheduleInfo: function(date, slot) {
        document.getElementById('scheduleDate').value = date;
        document.getElementById('scheduleSlot').value = slot;
    },

    getScheduleData: function() {
        return {
            date: document.getElementById('scheduleDate').value,
            slot: document.getElementById('scheduleSlot').value,
            programs: App.currentSchedule.programs
        };
    }
};
