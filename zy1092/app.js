/**
 * CueDesk 主应用逻辑
 * 负责连接所有模块，处理用户界面交互
 */

// 应用状态
class CueDeskApp {
    constructor() {
        this.currentProjectId = null;
        this.selectedCueId = null;
        this.sortable = null;
        this.init();
    }

    /**
     * 初始化应用
     */
    init() {
        this.loadCurrentProject();
        this.bindEvents();
        this.renderProjectSelector();
        this.renderUI();
    }

    /**
     * 加载当前项目
     */
    loadCurrentProject() {
        this.currentProjectId = dataStore.getCurrentProjectId();
    }

    /**
     * 绑定所有事件监听器
     */
    bindEvents() {
        // 项目管理事件
        document.getElementById('create-project-btn').addEventListener('click', () => {
            this.showCreateProjectModal();
        });

        document.getElementById('project-selector').addEventListener('change', (e) => {
            this.switchProject(e.target.value);
        });

        // 创建项目模态框事件
        document.getElementById('close-create-project-modal').addEventListener('click', () => {
            this.hideCreateProjectModal();
        });

        document.getElementById('cancel-create-project-btn').addEventListener('click', () => {
            this.hideCreateProjectModal();
        });

        document.getElementById('confirm-create-project-btn').addEventListener('click', () => {
            this.createProject();
        });

        document.getElementById('create-project-form').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.createProject();
            }
        });

        // 流程管理事件
        document.getElementById('add-cue-btn').addEventListener('click', () => {
            this.addNewCue();
        });

        document.getElementById('status-filter').addEventListener('change', () => {
            this.renderCueList();
        });

        // 编辑表单事件
        document.getElementById('cue-edit-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveCurrentCue();
        });

        document.getElementById('cancel-edit-btn').addEventListener('click', () => {
            this.cancelEdit();
        });

        document.getElementById('move-up-btn').addEventListener('click', () => {
            this.moveCueUp();
        });

        document.getElementById('move-down-btn').addEventListener('click', () => {
            this.moveCueDown();
        });

        document.getElementById('delete-cue-btn').addEventListener('click', () => {
            this.deleteCurrentCue();
        });

        // 音频文件选择事件
        document.getElementById('select-audio-btn').addEventListener('click', () => {
            document.getElementById('audio-file-input').click();
        });

        document.getElementById('audio-file-input').addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                const file = e.target.files[0];
                document.getElementById('cue-audio-path').value = file.name;
                this.showToast('已选择音频文件: ' + file.name, 'info');
            }
        });

        // 风险检查事件
        document.getElementById('check-risk-btn').addEventListener('click', () => {
            this.checkRisks();
        });

        // 导入导出事件
        document.getElementById('import-btn').addEventListener('click', () => {
            this.showImportModal();
        });

        document.getElementById('close-import-modal').addEventListener('click', () => {
            this.hideImportModal();
        });

        document.getElementById('cancel-import-btn').addEventListener('click', () => {
            this.hideImportModal();
        });

        document.getElementById('confirm-import-btn').addEventListener('click', () => {
            this.confirmImport();
        });

        // 导入文件选择事件
        document.getElementById('file-upload-area').addEventListener('click', () => {
            document.getElementById('import-file-input').click();
        });

        document.getElementById('import-file-input').addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.handleFileSelect(e.target.files[0]);
            }
        });

        // 拖放事件
        const uploadArea = document.getElementById('file-upload-area');
        
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });

        uploadArea.addEventListener('dragleave', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            
            if (e.dataTransfer.files.length > 0) {
                this.handleFileSelect(e.dataTransfer.files[0]);
            }
        });

        // 导出按钮事件
        document.getElementById('export-json-btn').addEventListener('click', () => {
            this.exportToJson();
        });

        document.getElementById('export-md-btn').addEventListener('click', () => {
            this.exportToMarkdown();
        });

        document.getElementById('export-html-btn').addEventListener('click', () => {
            this.exportToHtml();
        });

        document.getElementById('export-csv-btn').addEventListener('click', () => {
            this.exportToCsv();
        });

        document.getElementById('export-checklist-btn').addEventListener('click', () => {
            this.exportChecklist();
        });

        // 点击模态框外部关闭模态框
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.style.display = 'none';
                }
            });
        });
    }

    /**
     * 渲染整个 UI
     */
    renderUI() {
        this.renderProjectSelector();
        this.renderCueList();
        this.checkRisks();
    }

    /**
     * 渲染项目选择器
     */
    renderProjectSelector() {
        const selector = document.getElementById('project-selector');
        const projects = dataStore.getProjects();
        
        selector.innerHTML = '<option value="">选择项目</option>';
        
        projects.forEach(project => {
            const option = document.createElement('option');
            option.value = project.id;
            option.textContent = project.name;
            if (project.id === this.currentProjectId) {
                option.selected = true;
            }
            selector.appendChild(option);
        });

        // 启用/禁用相关按钮
        const hasProject = this.currentProjectId !== null;
        document.getElementById('add-cue-btn').disabled = !hasProject;
        document.getElementById('import-btn').disabled = !hasProject;
        document.getElementById('check-risk-btn').disabled = !hasProject;
        document.getElementById('export-json-btn').disabled = !hasProject;
        document.getElementById('export-md-btn').disabled = !hasProject;
        document.getElementById('export-html-btn').disabled = !hasProject;
        document.getElementById('export-csv-btn').disabled = !hasProject;
        document.getElementById('export-checklist-btn').disabled = !hasProject;
    }

    /**
     * 渲染流程列表
     */
    renderCueList() {
        const listContainer = document.getElementById('cue-list');
        
        if (!this.currentProjectId) {
            listContainer.innerHTML = `
                <div class="empty-state">
                    <p>请先选择或创建一个项目</p>
                    <button class="btn btn-primary" onclick="app.showCreateProjectModal()">创建项目</button>
                </div>
            `;
            return;
        }

        let cues = dataStore.getCues(this.currentProjectId);
        
        // 应用状态过滤
        const statusFilter = document.getElementById('status-filter').value;
        if (statusFilter) {
            cues = cues.filter(cue => cue.status === statusFilter);
        }

        if (cues.length === 0) {
            listContainer.innerHTML = `
                <div class="empty-state">
                    <p>暂无流程</p>
                    <p>点击"添加流程"开始创建</p>
                </div>
            `;
            return;
        }

        listContainer.innerHTML = '';
        
        cues.forEach(cue => {
            const statusLabel = CUE_STATUS_LABELS[cue.status] || cue.status;
            const statusClass = `status-${cue.status}`;
            
            const item = document.createElement('div');
            item.className = `cue-item ${cue.id === this.selectedCueId ? 'selected' : ''}`;
            item.dataset.cueId = cue.id;
            
            item.innerHTML = `
                <div class="cue-item-header">
                    <span class="cue-order">${cue.order}.</span>
                    <span class="cue-name">${this.escapeHtml(cue.name)}</span>
                    <span class="cue-status ${statusClass}">${this.escapeHtml(statusLabel)}</span>
                </div>
                <div class="cue-item-details">
                    ${cue.responsible ? `<div class="cue-item-detail"><span class="cue-item-detail-label">负责人:</span> ${this.escapeHtml(cue.responsible)}</div>` : ''}
                    ${cue.duration ? `<div class="cue-item-detail"><span class="cue-item-detail-label">时长:</span> ${cue.duration} 分钟</div>` : ''}
                    ${cue.startTime ? `<div class="cue-item-detail"><span class="cue-item-detail-label">时间:</span> ${this.escapeHtml(cue.startTime)}</div>` : ''}
                    ${cue.microphones.length > 0 ? `<div class="cue-item-detail"><span class="cue-item-detail-label">麦克风:</span> ${this.escapeHtml(cue.microphones.join(', '))}</div>` : ''}
                </div>
            `;

            item.addEventListener('click', () => {
                this.selectCue(cue.id);
            });

            listContainer.appendChild(item);
        });

        // 初始化拖拽排序
        this.initSortable();
    }

    /**
     * 初始化拖拽排序
     */
    initSortable() {
        if (this.sortable) {
            this.sortable.destroy();
        }

        const listContainer = document.getElementById('cue-list');
        
        this.sortable = new Sortable(listContainer, {
            animation: 150,
            handle: '.cue-item',
            ghostClass: 'sortable-ghost',
            chosenClass: 'sortable-chosen',
            dragClass: 'sortable-drag',
            onEnd: (evt) => {
                const { oldIndex, newIndex } = evt;
                const cueId = evt.item.dataset.cueId;
                
                if (oldIndex !== newIndex) {
                    this.reorderCues(oldIndex, newIndex);
                }
            }
        });
    }

    /**
     * 重新排序流程
     * @param {number} oldIndex - 旧索引
     * @param {number} newIndex - 新索引
     */
    reorderCues(oldIndex, newIndex) {
        if (!this.currentProjectId) return;

        const cues = dataStore.getCues(this.currentProjectId);
        
        if (oldIndex < 0 || oldIndex >= cues.length || newIndex < 0 || newIndex >= cues.length) {
            return;
        }

        const cueToMove = cues[oldIndex];
        const newOrder = newIndex + 1;

        dataStore.moveCue(this.currentProjectId, cueToMove.id, newOrder);
        
        this.renderCueList();
        this.checkRisks();
        this.showToast('流程顺序已更新', 'success');
    }

    /**
     * 选择流程
     * @param {string} cueId - 流程ID
     */
    selectCue(cueId) {
        this.selectedCueId = cueId;
        this.renderCueList();
        this.loadCueToForm();
        this.enableEditButtons();
    }

    /**
     * 加载流程到表单
     */
    loadCueToForm() {
        if (!this.selectedCueId || !this.currentProjectId) return;

        const cue = dataStore.getCueById(this.currentProjectId, this.selectedCueId);
        if (!cue) return;

        document.getElementById('edit-section-title').textContent = `编辑: ${cue.name}`;
        document.getElementById('cue-name').value = cue.name;
        document.getElementById('cue-order').value = cue.order;
        document.getElementById('cue-status').value = cue.status;
        document.getElementById('cue-responsible').value = cue.responsible || '';
        document.getElementById('cue-duration').value = cue.duration || '';
        document.getElementById('cue-start-time').value = cue.startTime || '';
        document.getElementById('cue-microphones').value = cue.microphones.length > 0 ? cue.microphones.join(', ') : '';
        document.getElementById('cue-audio-path').value = cue.audioPath || '';
        document.getElementById('cue-script').value = cue.script || '';
        document.getElementById('cue-notes').value = cue.notes || '';

        // 启用保存和取消按钮
        document.getElementById('save-cue-btn').disabled = false;
        document.getElementById('cancel-edit-btn').disabled = false;
    }

    /**
     * 启用编辑按钮
     */
    enableEditButtons() {
        if (!this.selectedCueId || !this.currentProjectId) return;

        const cue = dataStore.getCueById(this.currentProjectId, this.selectedCueId);
        if (!cue) return;

        const cues = dataStore.getCues(this.currentProjectId);
        
        document.getElementById('move-up-btn').disabled = cue.order <= 1;
        document.getElementById('move-down-btn').disabled = cue.order >= cues.length;
        document.getElementById('delete-cue-btn').disabled = false;
    }

    /**
     * 取消编辑
     */
    cancelEdit() {
        this.selectedCueId = null;
        this.renderCueList();
        this.resetEditForm();
    }

    /**
     * 重置编辑表单
     */
    resetEditForm() {
        document.getElementById('edit-section-title').textContent = '选择流程进行编辑';
        document.getElementById('cue-edit-form').reset();
        document.getElementById('save-cue-btn').disabled = true;
        document.getElementById('cancel-edit-btn').disabled = true;
        document.getElementById('move-up-btn').disabled = true;
        document.getElementById('move-down-btn').disabled = true;
        document.getElementById('delete-cue-btn').disabled = true;
    }

    /**
     * 保存当前流程
     */
    saveCurrentCue() {
        if (!this.selectedCueId || !this.currentProjectId) return;

        const formData = {
            name: document.getElementById('cue-name').value.trim(),
            status: document.getElementById('cue-status').value,
            responsible: document.getElementById('cue-responsible').value.trim(),
            duration: parseFloat(document.getElementById('cue-duration').value) || 0,
            startTime: document.getElementById('cue-start-time').value,
            microphones: document.getElementById('cue-microphones').value
                .split(/[,，]/)
                .map(m => m.trim())
                .filter(m => m),
            audioPath: document.getElementById('cue-audio-path').value.trim(),
            script: document.getElementById('cue-script').value.trim(),
            notes: document.getElementById('cue-notes').value.trim()
        };

        if (!formData.name) {
            this.showToast('流程名称不能为空', 'error');
            return;
        }

        const updatedCue = dataStore.updateCue(this.currentProjectId, this.selectedCueId, formData);
        
        if (updatedCue) {
            this.renderCueList();
            this.checkRisks();
            this.showToast('流程已保存', 'success');
        } else {
            this.showToast('保存失败', 'error');
        }
    }

    /**
     * 上移当前流程
     */
    moveCueUp() {
        if (!this.selectedCueId || !this.currentProjectId) return;

        const success = dataStore.moveCueUp(this.currentProjectId, this.selectedCueId);
        if (success) {
            this.renderCueList();
            this.loadCueToForm();
            this.enableEditButtons();
            this.checkRisks();
            this.showToast('流程已上移', 'success');
        }
    }

    /**
     * 下移当前流程
     */
    moveCueDown() {
        if (!this.selectedCueId || !this.currentProjectId) return;

        const success = dataStore.moveCueDown(this.currentProjectId, this.selectedCueId);
        if (success) {
            this.renderCueList();
            this.loadCueToForm();
            this.enableEditButtons();
            this.checkRisks();
            this.showToast('流程已下移', 'success');
        }
    }

    /**
     * 删除当前流程
     */
    deleteCurrentCue() {
        if (!this.selectedCueId || !this.currentProjectId) return;

        const cue = dataStore.getCueById(this.currentProjectId, this.selectedCueId);
        if (!cue) return;

        if (!confirm(`确定要删除流程 "${cue.name}" 吗？`)) {
            return;
        }

        const success = dataStore.deleteCue(this.currentProjectId, this.selectedCueId);
        
        if (success) {
            this.selectedCueId = null;
            this.renderCueList();
            this.resetEditForm();
            this.checkRisks();
            this.showToast('流程已删除', 'success');
        } else {
            this.showToast('删除失败', 'error');
        }
    }

    /**
     * 添加新流程
     */
    addNewCue() {
        if (!this.currentProjectId) {
            this.showToast('请先选择或创建一个项目', 'warning');
            return;
        }

        const cues = dataStore.getCues(this.currentProjectId);
        const newOrder = cues.length + 1;

        const newCue = {
            name: `新流程 ${newOrder}`,
            status: CUE_STATUSES.PENDING,
            order: newOrder
        };

        const cue = dataStore.addCue(this.currentProjectId, newCue);
        
        if (cue) {
            this.selectCue(cue.id);
            this.renderCueList();
            this.checkRisks();
            this.showToast('已添加新流程', 'success');
            
            document.getElementById('cue-name').focus();
            document.getElementById('cue-name').select();
        } else {
            this.showToast('添加失败', 'error');
        }
    }

    /**
     * 切换项目
     * @param {string} projectId - 项目ID
     */
    switchProject(projectId) {
        if (!projectId) {
            this.currentProjectId = null;
            dataStore.setCurrentProjectId(null);
        } else {
            this.currentProjectId = projectId;
            dataStore.setCurrentProjectId(projectId);
        }

        this.selectedCueId = null;
        this.renderUI();
        this.resetEditForm();
    }

    /**
     * 显示创建项目模态框
     */
    showCreateProjectModal() {
        document.getElementById('create-project-modal').style.display = 'flex';
        document.getElementById('project-name').focus();
    }

    /**
     * 隐藏创建项目模态框
     */
    hideCreateProjectModal() {
        document.getElementById('create-project-modal').style.display = 'none';
        document.getElementById('create-project-form').reset();
    }

    /**
     * 创建新项目
     */
    createProject() {
        const name = document.getElementById('project-name').value.trim();
        const description = document.getElementById('project-description').value.trim();

        if (!name) {
            this.showToast('项目名称不能为空', 'error');
            document.getElementById('project-name').focus();
            return;
        }

        const project = dataStore.createProject({
            name: name,
            description: description
        });

        if (project) {
            this.currentProjectId = project.id;
            this.hideCreateProjectModal();
            this.renderUI();
            this.showToast(`项目 "${project.name}" 已创建`, 'success');
        } else {
            this.showToast('创建项目失败', 'error');
        }
    }

    /**
     * 检查风险
     */
    checkRisks() {
        const riskListContainer = document.getElementById('risk-list');
        
        if (!this.currentProjectId) {
            riskListContainer.innerHTML = `
                <div class="empty-state">
                    <p>请先选择一个项目</p>
                </div>
            `;
            return;
        }

        const risks = riskChecker.checkAll(this.currentProjectId);
        const formattedRisks = riskChecker.formatRisksForDisplay(risks);

        if (formattedRisks.length === 0) {
            riskListContainer.innerHTML = `
                <div class="empty-state">
                    <p>✅ 未发现风险</p>
                    <p>所有流程状态正常</p>
                </div>
            `;
            return;
        }

        riskListContainer.innerHTML = '';
        
        formattedRisks.forEach(risk => {
            const item = document.createElement('div');
            item.className = `risk-item ${risk.levelClass}`;
            item.dataset.riskId = risk.id;
            
            item.innerHTML = `
                <div class="risk-title">
                    <span>${risk.icon}</span>
                    <span>${this.escapeHtml(risk.levelLabel)}</span>
                </div>
                <div class="risk-description">
                    ${this.escapeHtml(risk.description)}
                </div>
            `;

            riskListContainer.appendChild(item);
        });
    }

    /**
     * 显示导入模态框
     */
    showImportModal() {
        document.getElementById('import-modal').style.display = 'flex';
        this.resetImportState();
    }

    /**
     * 隐藏导入模态框
     */
    hideImportModal() {
        document.getElementById('import-modal').style.display = 'none';
        this.resetImportState();
    }

    /**
     * 重置导入状态
     */
    resetImportState() {
        document.getElementById('import-preview').style.display = 'none';
        document.getElementById('import-preview-content').innerHTML = '';
        document.getElementById('confirm-import-btn').disabled = true;
        document.getElementById('import-file-input').value = '';
        this.importData = null;
    }

    /**
     * 处理文件选择
     * @param {File} file - 选择的文件
     */
    async handleFileSelect(file) {
        try {
            const content = await importExportManager.readFileContent(file);
            const importType = document.querySelector('input[name="import-type"]:checked').value;
            
            let cues;
            if (importType === 'json') {
                cues = importExportManager.parseJson(content);
            } else {
                cues = importExportManager.parseCsv(content);
            }

            if (cues.length === 0) {
                this.showToast('文件中没有有效的流程数据', 'warning');
                return;
            }

            this.importData = cues;

            const previewContainer = document.getElementById('import-preview');
            const previewContent = document.getElementById('import-preview-content');
            
            previewContent.innerHTML = `
                <p><strong>文件名称:</strong> ${this.escapeHtml(file.name)}</p>
                <p><strong>流程数量:</strong> ${cues.length} 条</p>
                <p><strong>预览:</strong></p>
                <ul>
                    ${cues.slice(0, 5).map(cue => `<li>${cue.order}. ${this.escapeHtml(cue.name)}</li>`).join('')}
                    ${cues.length > 5 ? `<li>... 还有 ${cues.length - 5} 条</li>` : ''}
                </ul>
            `;
            
            previewContainer.style.display = 'block';
            document.getElementById('confirm-import-btn').disabled = false;
            
            this.showToast(`已解析 ${cues.length} 条流程数据`, 'success');
            
        } catch (error) {
            this.showToast(`解析失败: ${error.message}`, 'error');
        }
    }

    /**
     * 确认导入
     */
    confirmImport() {
        if (!this.importData || !this.currentProjectId) {
            return;
        }

        if (confirm(`确定要导入 ${this.importData.length} 条流程吗？\n\n这将添加到当前项目中。`)) {
            dataStore.addCuesBatch(this.currentProjectId, this.importData, false);
            
            this.hideImportModal();
            this.renderUI();
            this.showToast(`成功导入 ${this.importData.length} 条流程`, 'success');
        }
    }

    /**
     * 导出为 JSON
     */
    exportToJson() {
        if (!this.currentProjectId) return;

        try {
            const content = importExportManager.exportToJson(this.currentProjectId);
            const project = dataStore.getProjectById(this.currentProjectId);
            const filename = `${project.name}_${this.getTimestamp()}.json`;
            
            importExportManager.downloadFile(content, filename, 'application/json');
            this.showToast('JSON 备份已导出', 'success');
        } catch (error) {
            this.showToast(`导出失败: ${error.message}`, 'error');
        }
    }

    /**
     * 导出为 Markdown
     */
    exportToMarkdown() {
        if (!this.currentProjectId) return;

        try {
            const content = importExportManager.exportToMarkdown(this.currentProjectId);
            const project = dataStore.getProjectById(this.currentProjectId);
            const filename = `${project.name}_CueSheet_${this.getTimestamp()}.md`;
            
            importExportManager.downloadFile(content, filename, 'text/markdown');
            this.showToast('Markdown Cue Sheet 已导出', 'success');
        } catch (error) {
            this.showToast(`导出失败: ${error.message}`, 'error');
        }
    }

    /**
     * 导出为 HTML
     */
    exportToHtml() {
        if (!this.currentProjectId) return;

        try {
            const content = importExportManager.exportToHtml(this.currentProjectId);
            const project = dataStore.getProjectById(this.currentProjectId);
            const filename = `${project.name}_CueSheet_${this.getTimestamp()}.html`;
            
            importExportManager.downloadFile(content, filename, 'text/html');
            this.showToast('HTML Cue Sheet 已导出', 'success');
        } catch (error) {
            this.showToast(`导出失败: ${error.message}`, 'error');
        }
    }

    /**
     * 导出为 CSV
     */
    exportToCsv() {
        if (!this.currentProjectId) return;

        try {
            const content = importExportManager.exportToCsv(this.currentProjectId);
            const project = dataStore.getProjectById(this.currentProjectId);
            const filename = `${project.name}_物料清单_${this.getTimestamp()}.csv`;
            
            importExportManager.downloadFile(content, filename, 'text/csv');
            this.showToast('CSV 物料清单已导出', 'success');
        } catch (error) {
            this.showToast(`导出失败: ${error.message}`, 'error');
        }
    }

    /**
     * 导出急救清单
     */
    exportChecklist() {
        if (!this.currentProjectId) return;

        try {
            const content = importExportManager.exportChecklist(this.currentProjectId);
            const project = dataStore.getProjectById(this.currentProjectId);
            const filename = `${project.name}_急救清单_${this.getTimestamp()}.md`;
            
            importExportManager.downloadFile(content, filename, 'text/markdown');
            this.showToast('开场前 10 分钟急救清单已导出', 'success');
        } catch (error) {
            this.showToast(`导出失败: ${error.message}`, 'error');
        }
    }

    /**
     * 获取时间戳字符串
     * @returns {string} 时间戳字符串
     */
    getTimestamp() {
        const now = new Date();
        return now.toISOString().slice(0, 19).replace(/[:T]/g, '-');
    }

    /**
     * 转义 HTML 特殊字符
     * @param {string} text - 原始文本
     * @returns {string} 转义后的文本
     */
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * 显示提示消息
     * @param {string} message - 消息内容
     * @param {string} type - 消息类型 (success/error/warning/info)
     */
    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        
        const typeClass = {
            success: 'toast-success',
            error: 'toast-error',
            warning: 'toast-warning',
            info: 'toast-info'
        }[type] || 'toast-info';

        toast.className = `toast ${typeClass}`;
        toast.textContent = message;
        
        container.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'slideIn 0.3s ease reverse';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, 3000);
    }
}

// 初始化应用
const app = new CueDeskApp();

// 导出应用实例供调试使用
window.app = app;
