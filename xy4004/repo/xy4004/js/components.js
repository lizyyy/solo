(function(global) {
    'use strict';

    const Components = {
        draggedItem: null,
        draggedIndex: -1,

        renderCueList: function(containerId, cues, validationResults, isEditMode) {
            const container = document.getElementById(containerId);
            if (!container) return;

            container.innerHTML = '';

            if (!cues || cues.length === 0) {
                container.innerHTML = '<div class="empty-state">暂无 Cue，点击上方按钮添加</div>';
                return;
            }

            const sortedCues = [...cues].sort((a, b) => a.order - b.order);

            sortedCues.forEach((cue, index) => {
                const cueElement = this.createCueElement(cue, index, validationResults, isEditMode, sortedCues.length);
                container.appendChild(cueElement);
            });

            if (isEditMode) {
                this.setupDragAndDrop(containerId);
            }
        },

        createCueElement: function(cue, index, validationResults, isEditMode, totalCues) {
            const div = document.createElement('div');
            div.className = 'cue-item';
            div.setAttribute('data-cue-id', cue.id);
            div.setAttribute('data-index', index);
            div.setAttribute('draggable', 'true');

            const errors = validationResults ? Validation.getErrors(cue.id, validationResults) : [];
            const hasErrors = errors.length > 0;

            if (hasErrors) {
                div.classList.add('error');
            }

            const riskLabels = { 'low': '低风险', 'medium': '中风险', 'high': '高风险' };
            const dependsOnCue = cue.dependsOn ? CueState.getCueById(cue.dependsOn) : null;

            let statusClass = '';
            let actualTimingHtml = '';

            if (cue.status === 'active') {
                statusClass = 'current';
            } else if (cue.status === 'completed') {
                statusClass = 'completed';
            } else if (cue.status === 'pending') {
                statusClass = 'future';
            }

            if (cue.actualStartTime !== null || cue.actualEndTime !== null) {
                const startDeviation = cue.actualStartTime !== null 
                    ? cue.actualStartTime - cue.startTime 
                    : null;
                const actualDuration = cue.actualEndTime !== null && cue.actualStartTime !== null
                    ? cue.actualEndTime - cue.actualStartTime
                    : null;
                const durationDeviation = actualDuration !== null && cue.duration !== null
                    ? actualDuration - cue.duration
                    : null;

                actualTimingHtml = `
                    <div class="actual-timing">
                        <div>
                            实际开始: <strong>${CueState.formatTime(cue.actualStartTime)}</strong>
                            ${startDeviation !== null ? `<span class="${startDeviation > 0 ? 'positive' : startDeviation < 0 ? 'negative' : ''}">(${RehearsalManager.formatDeviation(startDeviation)})</span>` : ''}
                        </div>
                        ${actualDuration !== null ? `
                        <div>
                            实际持续: <strong>${CueState.formatDuration(actualDuration)}</strong>
                            ${durationDeviation !== null ? `<span class="${durationDeviation > 0 ? 'positive' : durationDeviation < 0 ? 'negative' : ''}">(${RehearsalManager.formatDeviation(durationDeviation)})</span>` : ''}
                        </div>` : ''}
                    </div>
                `;
            }

            div.innerHTML = `
                <div class="cue-header">
                    <div class="cue-main-info">
                        ${isEditMode ? `
                        <div class="cue-order-buttons">
                            <button class="btn btn-order btn-order-up" data-cue-id="${cue.id}" ${index === 0 ? 'disabled' : ''}>▲</button>
                            <button class="btn btn-order btn-order-down" data-cue-id="${cue.id}" ${index === totalCues - 1 ? 'disabled' : ''}>▼</button>
                        </div>` : ''}
                        <span class="cue-number">${cue.number || '未命名'}</span>
                        <span class="cue-group ${cue.group}">${cue.group}</span>
                        <span class="cue-risk ${cue.riskLevel}">${riskLabels[cue.riskLevel] || cue.riskLevel}</span>
                    </div>
                    ${isEditMode ? `
                    <div class="cue-actions">
                        <button class="btn btn-secondary" data-action="edit" data-cue-id="${cue.id}">编辑</button>
                        <button class="btn btn-danger" data-action="delete" data-cue-id="${cue.id}">删除</button>
                    </div>` : ''}
                </div>
                <div class="cue-timing">
                    <span>预计开始: <strong>${CueState.formatTime(cue.startTime)}</strong></span>
                    <span>持续: <strong>${CueState.formatDuration(cue.duration)}</strong></span>
                    ${cue.dependsOn ? `<span>依赖: <strong>${dependsOnCue ? dependsOnCue.number : '已删除'}</strong></span>` : ''}
                </div>
                ${cue.description ? `<div class="cue-description">${this.escapeHtml(cue.description)}</div>` : ''}
                ${cue.notes ? `<div class="cue-notes">备注: ${this.escapeHtml(cue.notes)}</div>` : ''}
                ${actualTimingHtml}
                ${hasErrors ? `
                <div class="error-indicator">
                    <ul>
                        ${errors.map(e => `<li>${this.escapeHtml(e.message)}</li>`).join('')}
                    </ul>
                </div>` : ''}
            `;

            if (statusClass) {
                div.classList.add(statusClass);
            }

            return div;
        },

        setupDragAndDrop: function(containerId) {
            const container = document.getElementById(containerId);
            if (!container) return;

            container.addEventListener('dragstart', (e) => {
                const target = e.target.closest('.cue-item');
                if (!target) return;

                this.draggedItem = target;
                this.draggedIndex = parseInt(target.getAttribute('data-index'));
                target.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
            });

            container.addEventListener('dragend', (e) => {
                const target = e.target.closest('.cue-item');
                if (target) {
                    target.classList.remove('dragging');
                }
                this.draggedItem = null;
                this.draggedIndex = -1;

                const items = container.querySelectorAll('.cue-item');
                items.forEach(item => item.classList.remove('drag-over'));
            });

            container.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';

                const target = e.target.closest('.cue-item');
                if (target && target !== this.draggedItem) {
                    target.classList.add('drag-over');
                }
            });

            container.addEventListener('dragleave', (e) => {
                const target = e.target.closest('.cue-item');
                if (target) {
                    target.classList.remove('drag-over');
                }
            });

            container.addEventListener('drop', (e) => {
                e.preventDefault();

                const target = e.target.closest('.cue-item');
                if (!target || !this.draggedItem || target === this.draggedItem) return;

                target.classList.remove('drag-over');

                const targetIndex = parseInt(target.getAttribute('data-index'));
                const draggedId = this.draggedItem.getAttribute('data-cue-id');

                if (this.draggedIndex !== targetIndex) {
                    CueState.moveCueToIndex(draggedId, targetIndex);
                }
            });
        },

        updateDependsOnSelect: function(selectId, currentCueId) {
            const select = document.getElementById(selectId);
            if (!select) return;

            const cues = CueState.getCues();
            select.innerHTML = '<option value="">无（并行）</option>';

            cues.forEach(cue => {
                if (cue.id !== currentCueId) {
                    const option = document.createElement('option');
                    option.value = cue.id;
                    option.textContent = `${cue.number || '未命名'} - ${CueState.formatTime(cue.startTime)}`;
                    select.appendChild(option);
                }
            });
        },

        openCueEditor: function(cueId) {
            const modal = document.getElementById('cue-editor');
            const form = document.getElementById('cue-form');
            const title = document.getElementById('editor-title');

            if (!modal || !form) return;

            if (cueId) {
                const cue = CueState.getCueById(cueId);
                if (cue) {
                    title.textContent = '编辑 Cue';
                    document.getElementById('cue-id').value = cue.id;
                    document.getElementById('cue-number').value = cue.number || '';
                    document.getElementById('cue-duration').value = cue.duration !== null ? cue.duration : '';
                    document.getElementById('cue-group').value = cue.group || '灯光';
                    document.getElementById('cue-risk').value = cue.riskLevel || 'low';
                    document.getElementById('cue-description').value = cue.description || '';
                    document.getElementById('cue-notes').value = cue.notes || '';

                    this.updateDependsOnSelect('cue-depends', cue.id);
                    if (cue.dependsOn) {
                        document.getElementById('cue-depends').value = cue.dependsOn;
                    }
                }
            } else {
                title.textContent = '新增 Cue';
                form.reset();
                document.getElementById('cue-id').value = '';
                
                const cues = CueState.getCues();
                const nextNumber = `Q${cues.length + 1}`;
                document.getElementById('cue-number').value = nextNumber;

                this.updateDependsOnSelect('cue-depends', null);
            }

            modal.classList.remove('hidden');
            document.getElementById('cue-number').focus();
        },

        closeCueEditor: function() {
            const modal = document.getElementById('cue-editor');
            if (modal) {
                modal.classList.add('hidden');
            }
        },

        renderCurrentCueDisplay: function(cue, elapsedTime, currentCueElapsed) {
            const display = document.getElementById('current-cue-display');
            if (!display) return;

            if (!cue) {
                display.classList.add('hidden');
                return;
            }

            display.classList.remove('hidden');

            const groupColors = {
                '灯光': '#f39c12',
                '音响': '#9b59b6',
                '道具': '#1abc9c',
                '服装': '#e67e22',
                '舞台': '#34495e',
                '其他': '#95a5a6'
            };

            document.getElementById('current-cue-number').textContent = cue.number || '未命名';
            document.getElementById('current-cue-group').textContent = cue.group;
            document.getElementById('current-cue-group').style.backgroundColor = groupColors[cue.group] || '#95a5a6';
            document.getElementById('current-cue-description').textContent = cue.description || '（无描述）';

            document.getElementById('expected-start').textContent = CueState.formatTime(cue.startTime);
            document.getElementById('expected-duration').textContent = CueState.formatDuration(cue.duration);
            document.getElementById('actual-start').textContent = CueState.formatTime(cue.actualStartTime);
            document.getElementById('elapsed-time').textContent = CueState.formatDuration(currentCueElapsed);
        },

        updateRehearsalTimer: function(elapsedTime) {
            const timerElement = document.getElementById('rehearsal-time');
            if (timerElement) {
                timerElement.textContent = CueState.formatTime(elapsedTime);
            }
        },

        updatePlayPauseButton: function(isRunning, isPaused) {
            const btn = document.getElementById('btn-play-pause');
            if (!btn) return;

            if (!isRunning) {
                btn.textContent = '▶ 开始';
                btn.classList.remove('btn-warning');
                btn.classList.add('btn-primary');
            } else if (isPaused) {
                btn.textContent = '▶ 继续';
                btn.classList.remove('btn-primary');
                btn.classList.add('btn-warning');
            } else {
                btn.textContent = '⏸ 暂停';
                btn.classList.remove('btn-primary');
                btn.classList.add('btn-warning');
            }
        },

        renderRehearsalSummary: function(summary) {
            const container = document.getElementById('rehearsal-summary');
            const tbody = document.getElementById('summary-body');

            if (!container || !tbody) return;

            tbody.innerHTML = '';

            summary.cues.forEach(cue => {
                const row = document.createElement('tr');

                const startDeviationClass = RehearsalManager.getDeviationClass(cue.startDeviation);
                const durationDeviationClass = RehearsalManager.getDeviationClass(cue.durationDeviation);

                row.innerHTML = `
                    <td><strong>${this.escapeHtml(cue.number || '未命名')}</strong></td>
                    <td>${this.escapeHtml(cue.group)}</td>
                    <td>${CueState.formatTime(cue.expectedStartTime)}</td>
                    <td>${CueState.formatTime(cue.actualStartTime)}</td>
                    <td class="${startDeviationClass}">${RehearsalManager.formatDeviation(cue.startDeviation)}</td>
                    <td>${CueState.formatDuration(cue.expectedDuration)}</td>
                    <td>${CueState.formatDuration(cue.actualDuration)}</td>
                    <td class="${durationDeviationClass}">${RehearsalManager.formatDeviation(cue.durationDeviation)}</td>
                `;

                tbody.appendChild(row);
            });

            container.classList.remove('hidden');
        },

        hideRehearsalSummary: function() {
            const container = document.getElementById('rehearsal-summary');
            if (container) {
                container.classList.add('hidden');
            }
        },

        switchMode: function(mode) {
            const editMode = document.getElementById('edit-mode');
            const rehearsalMode = document.getElementById('rehearsal-mode');
            const btnEdit = document.getElementById('btn-edit-mode');
            const btnRehearsal = document.getElementById('btn-rehearsal-mode');

            if (!editMode || !rehearsalMode || !btnEdit || !btnRehearsal) return;

            if (mode === 'edit') {
                editMode.classList.remove('hidden');
                rehearsalMode.classList.add('hidden');
                btnEdit.classList.add('active');
                btnRehearsal.classList.remove('active');
            } else {
                editMode.classList.add('hidden');
                rehearsalMode.classList.remove('hidden');
                btnEdit.classList.remove('active');
                btnRehearsal.classList.add('active');
            }
        },

        escapeHtml: function(text) {
            if (text === null || text === undefined) return '';
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        },

        showMessage: function(message, type) {
            const existingMessage = document.querySelector('.message-toast');
            if (existingMessage) {
                existingMessage.remove();
            }

            const toast = document.createElement('div');
            toast.className = `message-toast message-${type || 'info'}`;
            toast.textContent = message;
            toast.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 12px 24px;
                border-radius: 6px;
                color: white;
                font-weight: 500;
                z-index: 3000;
                animation: slideIn 0.3s ease;
                background-color: ${type === 'success' ? '#27ae60' : type === 'error' ? '#e74c3c' : type === 'warning' ? '#f39c12' : '#3498db'};
            `;

            document.body.appendChild(toast);

            setTimeout(() => {
                toast.style.animation = 'slideOut 0.3s ease';
                setTimeout(() => toast.remove(), 300);
            }, 3000);
        },

        confirm: function(message) {
            return confirm(message);
        },

        alert: function(message) {
            alert(message);
        }
    };

    global.Components = Components;

})(window);
