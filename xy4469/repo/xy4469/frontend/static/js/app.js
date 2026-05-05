class MicroplasticScreenerApp {
    constructor() {
        this.api = api;
        this.state = {
            currentTab: 'batches',
            batches: [],
            batchesPage: 1,
            batchesPerPage: 20,
            batchesSearch: '',
            
            currentBatch: null,
            particles: [],
            particlesPage: 1,
            particlesPerPage: 12,
            filterClassification: '',
            filterRisk: '',
            filterReviewed: '',
            
            currentParticle: null,
            selectedReviewClass: null,
            
            selectedFiles: {
                batch: null,
                annotations: null,
                controls: null
            }
        };
        
        this.init();
    }
    
    async init() {
        this.setupEventListeners();
        await this.checkConnection();
        await this.loadBatches();
        await this.loadBatchSelects();
    }
    
    setupEventListeners() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeAllModals();
            }
        });
    }
    
    async checkConnection() {
        const statusEl = document.getElementById('connection-status');
        try {
            await this.api.getHealth();
            statusEl.textContent = '● 已连接';
            statusEl.className = 'status-indicator connected';
        } catch (error) {
            statusEl.textContent = '● 连接失败';
            statusEl.className = 'status-indicator error';
            this.showToast('无法连接到后端服务', 'error');
        }
    }
    
    switchTab(tabName) {
        this.state.currentTab = tabName;
        
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabName);
        });
        
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === `tab-${tabName}`);
        });
    }
    
    async loadBatches() {
        try {
            const result = await this.api.getBatches(
                this.state.batchesPage,
                this.state.batchesPerPage,
                this.state.batchesSearch
            );
            
            if (result.success) {
                this.state.batches = result.data.batches;
                this.renderBatchesTable(result.data);
                this.renderBatchesPagination(result.data);
            }
        } catch (error) {
            this.showToast('加载批次列表失败: ' + error.message, 'error');
        }
    }
    
    renderBatchesTable(data) {
        const tbody = document.getElementById('batches-table-body');
        
        if (!data.batches || data.batches.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="empty">暂无数据</td></tr>';
            return;
        }
        
        tbody.innerHTML = data.batches.map(batch => {
            const reviewedCount = 0;
            const particleCount = batch.particle_count || 0;
            const reviewProgress = particleCount > 0 ? Math.round(reviewedCount / particleCount * 100) : 0;
            
            return `
                <tr>
                    <td><strong>${batch.batch_id}</strong></td>
                    <td>${this.escapeHtml(batch.sample_name)}</td>
                    <td>${this.escapeHtml(batch.location || '-')}</td>
                    <td><span class="badge badge-secondary">${particleCount}</span></td>
                    <td>
                        <span class="badge ${reviewProgress === 100 ? 'badge-success' : reviewProgress > 0 ? 'badge-warning' : 'badge-secondary'}">
                            ${reviewProgress}%
                        </span>
                    </td>
                    <td>${this.formatDate(batch.created_at)}</td>
                    <td>
                        <div class="action-buttons">
                            <button class="btn btn-sm btn-secondary" onclick="app.viewBatchParticles('${batch.batch_id}')">
                                查看
                            </button>
                            <button class="btn btn-sm btn-danger" onclick="app.deleteBatch('${batch.batch_id}')">
                                删除
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }
    
    renderBatchesPagination(data) {
        const pagination = document.getElementById('batches-pagination');
        const totalPages = data.pages;
        const currentPage = data.current_page;
        
        if (totalPages <= 1) {
            pagination.innerHTML = '';
            return;
        }
        
        let html = `<span class="pagination-info">共 ${data.total} 条</span>`;
        
        html += `<button ${currentPage === 1 ? 'disabled' : ''} onclick="app.goToBatchesPage(${currentPage - 1})">上一页</button>`;
        
        const startPage = Math.max(1, currentPage - 2);
        const endPage = Math.min(totalPages, currentPage + 2);
        
        if (startPage > 1) {
            html += `<button onclick="app.goToBatchesPage(1)">1</button>`;
            if (startPage > 2) {
                html += `<span>...</span>`;
            }
        }
        
        for (let i = startPage; i <= endPage; i++) {
            html += `<button class="${i === currentPage ? 'active' : ''}" onclick="app.goToBatchesPage(${i})">${i}</button>`;
        }
        
        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                html += `<span>...</span>`;
            }
            html += `<button onclick="app.goToBatchesPage(${totalPages})">${totalPages}</button>`;
        }
        
        html += `<button ${currentPage === totalPages ? 'disabled' : ''} onclick="app.goToBatchesPage(${currentPage + 1})">下一页</button>`;
        
        pagination.innerHTML = html;
    }
    
    goToBatchesPage(page) {
        this.state.batchesPage = page;
        this.loadBatches();
    }
    
    searchBatches() {
        const input = document.getElementById('batch-search');
        this.state.batchesSearch = input.value.trim();
        this.state.batchesPage = 1;
        this.loadBatches();
    }
    
    async loadBatchSelects() {
        try {
            const result = await this.api.getBatches(1, 100, '');
            if (result.success && result.data.batches) {
                const batches = result.data.batches;
                
                const filterSelect = document.getElementById('filter-batch');
                const exportSelect = document.getElementById('export-batch');
                
                const options = batches.map(b => 
                    `<option value="${b.batch_id}">${b.batch_id} - ${b.sample_name}</option>`
                ).join('');
                
                filterSelect.innerHTML = '<option value="">选择批次...</option>' + options;
                exportSelect.innerHTML = '<option value="">选择批次...</option>' + options;
            }
        } catch (error) {
            console.error('加载批次选择框失败:', error);
        }
    }
    
    handleDragOver(event) {
        event.preventDefault();
        event.currentTarget.classList.add('dragover');
    }
    
    handleDragLeave(event) {
        event.currentTarget.classList.remove('dragover');
    }
    
    handleDrop(event, type) {
        event.preventDefault();
        event.currentTarget.classList.remove('dragover');
        
        const files = event.dataTransfer.files;
        if (files.length > 0) {
            this.selectFile(files[0], type);
        }
    }
    
    handleFileSelect(event, type) {
        const files = event.target.files;
        if (files.length > 0) {
            this.selectFile(files[0], type);
        }
    }
    
    selectFile(file, type) {
        if (!file.name.toLowerCase().endsWith('.csv')) {
            this.showToast('请选择 CSV 文件', 'warning');
            return;
        }
        
        this.state.selectedFiles[type] = file;
        this.updateSelectedFilesDisplay();
        
        const uploadArea = document.getElementById(`${type}-upload`);
        if (uploadArea) {
            uploadArea.classList.add('has-file');
        }
    }
    
    updateSelectedFilesDisplay() {
        const container = document.getElementById('selected-files');
        const importBtn = document.getElementById('import-btn');
        
        const files = [];
        if (this.state.selectedFiles.batch) {
            files.push({ type: 'batch', name: this.state.selectedFiles.batch.name, label: '批次表' });
        }
        if (this.state.selectedFiles.annotations) {
            files.push({ type: 'annotations', name: this.state.selectedFiles.annotations.name, label: '标注表' });
        }
        if (this.state.selectedFiles.controls) {
            files.push({ type: 'controls', name: this.state.selectedFiles.controls.name, label: '对照表' });
        }
        
        if (files.length === 0) {
            container.innerHTML = '';
            importBtn.disabled = true;
            return;
        }
        
        container.innerHTML = files.map(f => `
            <span class="file-tag">
                ${f.label}: ${this.escapeHtml(f.name)}
                <button onclick="app.removeFile('${f.type}')">&times;</button>
            </span>
        `).join('');
        
        importBtn.disabled = !this.state.selectedFiles.batch;
    }
    
    removeFile(type) {
        this.state.selectedFiles[type] = null;
        this.updateSelectedFilesDisplay();
        
        const uploadArea = document.getElementById(`${type}-upload`);
        if (uploadArea) {
            uploadArea.classList.remove('has-file');
        }
        
        const input = document.getElementById(`${type}-file-input`);
        if (input) {
            input.value = '';
        }
    }
    
    async importData() {
        if (!this.state.selectedFiles.batch) {
            this.showToast('请选择批次文件', 'warning');
            return;
        }
        
        const formData = new FormData();
        formData.append('batch_file', this.state.selectedFiles.batch);
        
        if (this.state.selectedFiles.annotations) {
            formData.append('annotations_file', this.state.selectedFiles.annotations);
        }
        if (this.state.selectedFiles.controls) {
            formData.append('controls_file', this.state.selectedFiles.controls);
        }
        
        try {
            this.showToast('正在导入数据...', 'warning');
            const result = await this.api.importData(formData);
            
            if (result.success) {
                this.showToast(`导入成功！批次: ${result.data.batch.batch_id}`, 'success');
                this.resetImportForm();
                await this.loadBatches();
                await this.loadBatchSelects();
            }
        } catch (error) {
            this.showToast('导入失败: ' + error.message, 'error');
        }
    }
    
    async showImportExamples() {
        if (!confirm('确定要导入示例数据吗？这将添加一个示例批次。')) {
            return;
        }
        
        try {
            this.showToast('正在导入示例数据...', 'warning');
            const result = await this.api.importExamples();
            
            if (result.success) {
                this.showToast(`示例数据导入成功！`, 'success');
                await this.loadBatches();
                await this.loadBatchSelects();
            }
        } catch (error) {
            this.showToast('导入示例数据失败: ' + error.message, 'error');
        }
    }
    
    resetImportForm() {
        this.state.selectedFiles = { batch: null, annotations: null, controls: null };
        this.updateSelectedFilesDisplay();
        
        ['batch', 'annotations', 'controls'].forEach(type => {
            const uploadArea = document.getElementById(`${type}-upload`);
            if (uploadArea) {
                uploadArea.classList.remove('has-file');
            }
            const input = document.getElementById(`${type}-file-input`);
            if (input) {
                input.value = '';
            }
        });
    }
    
    async deleteBatch(batchId) {
        if (!confirm(`确定要删除批次 ${batchId} 吗？此操作不可恢复。`)) {
            return;
        }
        
        try {
            const result = await this.api.deleteBatch(batchId);
            if (result.success) {
                this.showToast('删除成功', 'success');
                await this.loadBatches();
                await this.loadBatchSelects();
            }
        } catch (error) {
            this.showToast('删除失败: ' + error.message, 'error');
        }
    }
    
    viewBatchParticles(batchId) {
        this.state.currentBatch = batchId;
        
        document.getElementById('filter-batch').value = batchId;
        this.state.filterClassification = '';
        this.state.filterRisk = '';
        this.state.filterReviewed = '';
        this.state.particlesPage = 1;
        
        this.switchTab('particles');
        this.loadParticles();
    }
    
    async filterParticles() {
        const batchSelect = document.getElementById('filter-batch');
        const classSelect = document.getElementById('filter-classification');
        const riskSelect = document.getElementById('filter-risk');
        const reviewedSelect = document.getElementById('filter-reviewed');
        
        this.state.currentBatch = batchSelect.value;
        this.state.filterClassification = classSelect.value;
        this.state.filterRisk = riskSelect.value;
        this.state.filterReviewed = reviewedSelect.value;
        this.state.particlesPage = 1;
        
        if (!this.state.currentBatch) {
            this.renderEmptyParticlesGrid('请先选择批次');
            return;
        }
        
        await this.loadParticles();
    }
    
    async loadParticles() {
        if (!this.state.currentBatch) {
            this.renderEmptyParticlesGrid('请先选择批次');
            return;
        }
        
        try {
            const options = {
                page: this.state.particlesPage,
                perPage: this.state.particlesPerPage
            };
            
            if (this.state.filterClassification) {
                options.classification = this.state.filterClassification;
            }
            if (this.state.filterRisk) {
                options.riskLevel = this.state.filterRisk;
            }
            if (this.state.filterReviewed !== '') {
                options.isReviewed = this.state.filterReviewed === 'true';
            }
            
            const result = await this.api.getBatchParticles(this.state.currentBatch, options);
            
            if (result.success) {
                this.state.particles = result.data.particles;
                this.renderParticlesGrid(result.data);
                this.renderParticlesPagination(result.data);
            }
        } catch (error) {
            this.showToast('加载颗粒列表失败: ' + error.message, 'error');
        }
    }
    
    renderEmptyParticlesGrid(message) {
        const grid = document.getElementById('particles-grid');
        grid.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🔍</div>
                <h3>${message}</h3>
                <p>从上方下拉框选择一个批次来查看颗粒</p>
            </div>
        `;
        document.getElementById('particles-pagination').innerHTML = '';
    }
    
    renderParticlesGrid(data) {
        const grid = document.getElementById('particles-grid');
        
        if (!data.particles || data.particles.length === 0) {
            this.renderEmptyParticlesGrid('该批次暂无颗粒数据');
            return;
        }
        
        const classificationIcons = {
            fiber: '🔴',
            particle: '🟡',
            bubble: '🔵',
            scratch: '⚪',
            unclear: '⚫'
        };
        
        const classificationLabels = {
            fiber: '纤维',
            particle: '颗粒',
            bubble: '气泡',
            scratch: '划痕',
            unclear: '未明确'
        };
        
        const riskLabels = {
            high: '高风险',
            medium: '中风险',
            low: '低风险'
        };
        
        const riskClasses = {
            high: 'badge-danger',
            medium: 'badge-warning',
            low: 'badge-success'
        };
        
        grid.innerHTML = data.particles.map(particle => {
            const finalClass = particle.final_classification || 'unclear';
            const finalConf = particle.final_confidence || 0;
            const isReviewed = particle.is_reviewed;
            const isFlagged = particle.is_flagged;
            
            let cardClasses = 'particle-card';
            if (isReviewed) cardClasses += ' reviewed';
            if (isFlagged) cardClasses += ' flagged';
            
            return `
                <div class="${cardClasses}" onclick="app.openParticleModal('${particle.particle_id}')">
                    <div class="particle-image">
                        ${classificationIcons[finalClass] || '❓'}
                    </div>
                    <div class="particle-info">
                        <div class="particle-id">${this.escapeHtml(particle.particle_id)}</div>
                        <div class="particle-classification">
                            <span class="badge ${isReviewed ? 'badge-success' : 'badge-secondary'}">
                                ${classificationLabels[finalClass] || finalClass}
                            </span>
                            <span>${Math.round(finalConf * 100)}%</span>
                        </div>
                        <div class="particle-meta">
                            ${particle.risk_level ? `<span class="badge ${riskClasses[particle.risk_level] || 'badge-secondary'}">${riskLabels[particle.risk_level] || particle.risk_level}</span>` : ''}
                            ${isReviewed ? '<span class="badge badge-success">已复核</span>' : '<span class="badge badge-secondary">待复核</span>'}
                            ${isFlagged ? '<span class="badge badge-warning">已标记</span>' : ''}
                            ${particle.area ? `<span>面积: ${this.formatNumber(particle.area)}</span>` : ''}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }
    
    renderParticlesPagination(data) {
        const pagination = document.getElementById('particles-pagination');
        const totalPages = data.pages;
        const currentPage = data.current_page;
        
        if (totalPages <= 1) {
            pagination.innerHTML = '';
            return;
        }
        
        let html = `<span class="pagination-info">共 ${data.total} 条</span>`;
        
        html += `<button ${currentPage === 1 ? 'disabled' : ''} onclick="app.goToParticlesPage(${currentPage - 1})">上一页</button>`;
        
        const startPage = Math.max(1, currentPage - 2);
        const endPage = Math.min(totalPages, currentPage + 2);
        
        if (startPage > 1) {
            html += `<button onclick="app.goToParticlesPage(1)">1</button>`;
            if (startPage > 2) {
                html += `<span>...</span>`;
            }
        }
        
        for (let i = startPage; i <= endPage; i++) {
            html += `<button class="${i === currentPage ? 'active' : ''}" onclick="app.goToParticlesPage(${i})">${i}</button>`;
        }
        
        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                html += `<span>...</span>`;
            }
            html += `<button onclick="app.goToParticlesPage(${totalPages})">${totalPages}</button>`;
        }
        
        html += `<button ${currentPage === totalPages ? 'disabled' : ''} onclick="app.goToParticlesPage(${currentPage + 1})">下一页</button>`;
        
        pagination.innerHTML = html;
    }
    
    goToParticlesPage(page) {
        this.state.particlesPage = page;
        this.loadParticles();
    }
    
    async openParticleModal(particleId) {
        try {
            const result = await this.api.getParticle(particleId);
            if (result.success) {
                this.state.currentParticle = result.data;
                this.renderParticleModal(result.data);
                document.getElementById('particle-modal').classList.add('active');
            }
        } catch (error) {
            this.showToast('加载颗粒详情失败: ' + error.message, 'error');
        }
    }
    
    renderParticleModal(particle) {
        document.getElementById('modal-particle-title').textContent = `颗粒详情: ${particle.particle_id}`;
        
        const basicInfo = document.getElementById('modal-basic-info');
        basicInfo.innerHTML = `
            <div class="info-item">
                <span class="info-label">颗粒编号</span>
                <span class="info-value">${this.escapeHtml(particle.particle_id)}</span>
            </div>
            <div class="info-item">
                <span class="info-label">批次</span>
                <span class="info-value">${this.escapeHtml(particle.batch_id || '-')}</span>
            </div>
            <div class="info-item">
                <span class="info-label">X 坐标</span>
                <span class="info-value">${particle.x_coordinate !== null ? this.formatNumber(particle.x_coordinate) : '-'}</span>
            </div>
            <div class="info-item">
                <span class="info-label">Y 坐标</span>
                <span class="info-value">${particle.y_coordinate !== null ? this.formatNumber(particle.y_coordinate) : '-'}</span>
            </div>
        `;
        
        const featuresInfo = document.getElementById('modal-features-info');
        featuresInfo.innerHTML = `
            <div class="info-item">
                <span class="info-label">面积</span>
                <span class="info-value">${particle.area !== null ? this.formatNumber(particle.area) : '-'}</span>
            </div>
            <div class="info-item">
                <span class="info-label">周长</span>
                <span class="info-value">${particle.perimeter !== null ? this.formatNumber(particle.perimeter) : '-'}</span>
            </div>
            <div class="info-item">
                <span class="info-label">高宽比</span>
                <span class="info-value">${particle.aspect_ratio !== null ? this.formatNumber(particle.aspect_ratio) : '-'}</span>
            </div>
            <div class="info-item">
                <span class="info-label">圆形度</span>
                <span class="info-value">${particle.circularity !== null ? this.formatNumber(particle.circularity) : '-'}</span>
            </div>
            <div class="info-item">
                <span class="info-label">实心度</span>
                <span class="info-value">${particle.solidity !== null ? this.formatNumber(particle.solidity) : '-'}</span>
            </div>
            <div class="info-item">
                <span class="info-label">延伸度</span>
                <span class="info-value">${particle.extent !== null ? this.formatNumber(particle.extent) : '-'}</span>
            </div>
            <div class="info-item">
                <span class="info-label">平均亮度</span>
                <span class="info-value">${particle.mean_intensity !== null ? this.formatNumber(particle.mean_intensity) : '-'}</span>
            </div>
            <div class="info-item">
                <span class="info-label">风险等级</span>
                <span class="info-value">${this.getRiskLabel(particle.risk_level)}</span>
            </div>
        `;
        
        const classificationLabels = {
            fiber: '纤维',
            particle: '颗粒',
            bubble: '气泡',
            scratch: '划痕',
            unclear: '未明确'
        };
        
        const classInfo = document.getElementById('modal-classification-info');
        classInfo.innerHTML = `
            <div class="classification-item">
                <h5>自动分类</h5>
                <div>
                    <strong>${classificationLabels[particle.auto_classification] || particle.auto_classification || '-'}</strong>
                    ${particle.auto_confidence !== null ? `<span class="badge badge-secondary">${Math.round(particle.auto_confidence * 100)}%</span>` : ''}
                </div>
            </div>
            <div class="classification-item">
                <h5>人工复核</h5>
                <div>
                    <strong>${particle.manual_classification ? (classificationLabels[particle.manual_classification] || particle.manual_classification) : '未复核'}</strong>
                    ${particle.manual_confidence !== null ? `<span class="badge badge-success">${Math.round(particle.manual_confidence * 100)}%</span>` : ''}
                </div>
                ${particle.reviewed_by ? `<div class="info-label">复核人: ${this.escapeHtml(particle.reviewed_by)}</div>` : ''}
                ${particle.reviewed_at ? `<div class="info-label">时间: ${this.formatDate(particle.reviewed_at)}</div>` : ''}
                ${particle.review_notes ? `<div class="info-label">备注: ${this.escapeHtml(particle.review_notes)}</div>` : ''}
            </div>
        `;
        
        this.state.selectedReviewClass = particle.manual_classification || particle.auto_classification;
        
        document.querySelectorAll('.class-btn').forEach(btn => {
            btn.classList.toggle('selected', btn.dataset.class === this.state.selectedReviewClass);
        });
        
        const confidenceSlider = document.getElementById('review-confidence');
        const confidence = particle.manual_confidence !== null ? particle.manual_confidence : 
                            (particle.auto_confidence !== null ? particle.auto_confidence : 0.8);
        confidenceSlider.value = confidence;
        this.updateConfidenceDisplay();
        
        document.getElementById('reviewer-name').value = particle.reviewed_by || '操作员';
        document.getElementById('review-notes').value = particle.review_notes || '';
    }
    
    selectReviewClass(className) {
        this.state.selectedReviewClass = className;
        document.querySelectorAll('.class-btn').forEach(btn => {
            btn.classList.toggle('selected', btn.dataset.class === className);
        });
    }
    
    updateConfidenceDisplay() {
        const slider = document.getElementById('review-confidence');
        const display = document.getElementById('confidence-display');
        display.textContent = Math.round(slider.value * 100) + '%';
    }
    
    async submitReview() {
        if (!this.state.currentParticle) {
            return;
        }
        
        const particleId = this.state.currentParticle.particle_id;
        const confidenceSlider = document.getElementById('review-confidence');
        
        const data = {
            classification: this.state.selectedReviewClass,
            confidence: parseFloat(confidenceSlider.value),
            reviewed_by: document.getElementById('reviewer-name').value.trim(),
            notes: document.getElementById('review-notes').value.trim()
        };
        
        try {
            const result = await this.api.reviewParticle(particleId, data);
            if (result.success) {
                this.showToast('复核提交成功', 'success');
                this.closeParticleModal();
                await this.loadParticles();
            }
        } catch (error) {
            this.showToast('提交失败: ' + error.message, 'error');
        }
    }
    
    closeParticleModal() {
        document.getElementById('particle-modal').classList.remove('active');
        this.state.currentParticle = null;
    }
    
    async previewReport(format) {
        const batchSelect = document.getElementById('export-batch');
        const batchId = batchSelect.value;
        
        if (!batchId) {
            this.showToast('请先选择批次', 'warning');
            return;
        }
        
        try {
            const result = await this.api.previewReport(batchId, format);
            if (result.success) {
                this.renderPreviewModal(result.data, format);
                document.getElementById('preview-modal').classList.add('active');
            }
        } catch (error) {
            this.showToast('加载预览失败: ' + error.message, 'error');
        }
    }
    
    renderPreviewModal(data, format) {
        const titles = {
            markdown: 'Markdown 质检报告',
            csv: 'CSV 风险清单',
            json: 'JSON 审计包'
        };
        
        document.getElementById('preview-title').textContent = titles[format] || '预览';
        
        const container = document.getElementById('preview-content');
        container.className = `preview-container preview-${format}`;
        
        if (format === 'json') {
            container.innerHTML = this.escapeHtml(data.content);
        } else {
            container.innerHTML = this.escapeHtml(data.content);
        }
        
        const downloadBtn = document.getElementById('preview-download-btn');
        downloadBtn.onclick = () => this.exportReport(format);
    }
    
    exportReport(type) {
        const batchSelect = document.getElementById('export-batch');
        const batchId = batchSelect.value;
        
        if (!batchId) {
            this.showToast('请先选择批次', 'warning');
            return;
        }
        
        const url = this.api.getExportUrl(batchId, type);
        window.open(url, '_blank');
    }
    
    closePreviewModal() {
        document.getElementById('preview-modal').classList.remove('active');
    }
    
    showHelpModal() {
        document.getElementById('help-modal').classList.add('active');
    }
    
    closeHelpModal() {
        document.getElementById('help-modal').classList.remove('active');
    }
    
    closeAllModals() {
        this.closeParticleModal();
        this.closePreviewModal();
        this.closeHelpModal();
    }
    
    getRiskLabel(risk) {
        const labels = {
            high: '高风险',
            medium: '中风险',
            low: '低风险'
        };
        return labels[risk] || risk || '-';
    }
    
    formatNumber(num) {
        if (num === null || num === undefined) return '-';
        if (typeof num === 'number') {
            return num.toLocaleString('zh-CN', { maximumFractionDigits: 4 });
        }
        return num;
    }
    
    formatDate(dateStr) {
        if (!dateStr) return '-';
        try {
            const date = new Date(dateStr);
            return date.toLocaleString('zh-CN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch {
            return dateStr;
        }
    }
    
    escapeHtml(str) {
        if (str === null || str === undefined) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
    
    showToast(message, type = 'success') {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.className = `toast ${type} show`;
        
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }
}

const app = new MicroplasticScreenerApp();
