const App = {
    currentTab: 'batches',
    
    init() {
        this.setupEventListeners();
        this.render();
    },
    
    setupEventListeners() {
        document.querySelectorAll('.sidebar li').forEach(item => {
            item.addEventListener('click', () => {
                this.switchTab(item.dataset.tab);
            });
        });
        
        document.getElementById('store-select').addEventListener('change', (e) => {
            DataStore.currentStore = e.target.value;
            this.render();
        });
        
        document.getElementById('btn-load-samples').addEventListener('click', () => {
            this.loadSampleData();
        });
        
        document.getElementById('btn-export').addEventListener('click', () => {
            this.exportData();
        });
        
        document.getElementById('btn-export-logs').addEventListener('click', () => {
            this.exportLogs();
        });
        
        document.getElementById('btn-add-batch').addEventListener('click', () => {
            this.showBatchModal();
        });
        
        document.getElementById('btn-add-opening').addEventListener('click', () => {
            this.showOpeningModal();
        });
        
        document.getElementById('btn-add-consumption').addEventListener('click', () => {
            this.showConsumptionModal();
        });
        
        document.getElementById('btn-calculate-rotation').addEventListener('click', () => {
            this.calculateRotation();
        });
        
        document.getElementById('btn-clear-problems').addEventListener('click', () => {
            DataStore.clearResolvedProblems();
            this.render();
        });
        
        document.getElementById('log-type-filter').addEventListener('change', () => {
            this.renderLogs();
        });
        
        document.getElementById('log-search').addEventListener('input', () => {
            this.renderLogs();
        });
        
        document.getElementById('btn-run-tests').addEventListener('click', () => {
            this.runRuleTests();
        });
    },
    
    switchTab(tab) {
        this.currentTab = tab;
        
        document.querySelectorAll('.sidebar li').forEach(item => {
            item.classList.toggle('active', item.dataset.tab === tab);
        });
        
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === `tab-${tab}`);
        });
        
        this.render();
    },
    
    render() {
        switch (this.currentTab) {
            case 'batches':
                this.renderBatches();
                break;
            case 'openings':
                this.renderOpenings();
                break;
            case 'consumptions':
                this.renderConsumptions();
                break;
            case 'rotation':
                this.renderRotation();
                break;
            case 'problems':
                this.renderProblems();
                break;
            case 'logs':
                this.renderLogs();
                break;
            case 'rules':
                this.renderRules();
                break;
        }
    },
    
    renderBatches() {
        const tbody = document.querySelector('#batches-table tbody');
        const batches = DataStore.getBatchesByStore(DataStore.currentStore);
        
        tbody.innerHTML = batches.map(batch => `
            <tr>
                <td>${batch.id}</td>
                <td>${batch.coffeeType}</td>
                <td>${batch.roastDate}</td>
                <td>${batch.bestBefore}</td>
                <td>${batch.remainingQuantity}/${batch.quantity}</td>
                <td><span class="status status-${batch.status}">${this.getStatusText(batch.status)}</span></td>
                <td>
                    <button class="btn btn-sm btn-primary" onclick="App.editBatch('${batch.id}')">编辑</button>
                    ${batch.status === 'pending' ? `
                        <button class="btn btn-sm btn-success" onclick="App.confirmBatch('${batch.id}')">确认</button>
                        <button class="btn btn-sm btn-danger" onclick="App.rejectBatch('${batch.id}')">拒绝</button>
                    ` : ''}
                </td>
            </tr>
        `).join('');
    },
    
    renderOpenings() {
        const tbody = document.querySelector('#openings-table tbody');
        const openings = DataStore.getOpeningsByStore(DataStore.currentStore);
        
        tbody.innerHTML = openings.map(opening => `
            <tr>
                <td>${opening.id}</td>
                <td>${opening.batchId}</td>
                <td>${opening.coffeeType}</td>
                <td>${opening.openDate}</td>
                <td>${opening.openQuantity}</td>
                <td><span class="status status-${opening.status}">${this.getStatusText(opening.status)}</span></td>
                <td>
                    <button class="btn btn-sm btn-primary" onclick="App.editOpening('${opening.id}')">编辑</button>
                    ${opening.status === 'pending' ? `
                        <button class="btn btn-sm btn-success" onclick="App.confirmOpening('${opening.id}')">确认</button>
                        <button class="btn btn-sm btn-danger" onclick="App.rejectOpening('${opening.id}')">拒绝</button>
                    ` : ''}
                </td>
            </tr>
        `).join('');
    },
    
    renderConsumptions() {
        const tbody = document.querySelector('#consumptions-table tbody');
        const consumptions = DataStore.getConsumptionsByStore(DataStore.currentStore);
        
        tbody.innerHTML = consumptions.map(consumption => `
            <tr>
                <td>${consumption.id}</td>
                <td>${consumption.batchId}</td>
                <td>${consumption.coffeeType}</td>
                <td>${consumption.consumptionDate}</td>
                <td>${consumption.quantity}</td>
                <td>
                    <button class="btn btn-sm btn-primary" onclick="App.editConsumption('${consumption.id}')">编辑</button>
                </td>
            </tr>
        `).join('');
    },
    
    renderRotation() {
        const container = document.getElementById('rotation-results');
        container.innerHTML = '<p>点击"计算轮换"按钮生成轮换建议</p>';
    },
    
    renderProblems() {
        const tbody = document.querySelector('#problems-table tbody');
        const problems = DataStore.getProblemsByStore(DataStore.currentStore);
        
        tbody.innerHTML = problems.map(problem => `
            <tr>
                <td>${problem.id}</td>
                <td>${problem.type}</td>
                <td><code class="source-data">${problem.sourceData.substring(0, 50)}...</code></td>
                <td>${problem.description}</td>
                <td>${new Date(problem.createdAt).toLocaleString()}</td>
                <td><span class="status status-${problem.status}">${problem.status === 'open' ? '待处理' : '已解决'}</span></td>
                <td>
                    ${problem.status === 'open' ? `
                        <button class="btn btn-sm btn-success" onclick="App.resolveProblem('${problem.id}')">标记已解决</button>
                    ` : ''}
                </td>
            </tr>
        `).join('');
    },
    
    renderLogs() {
        const tbody = document.querySelector('#logs-table tbody');
        const typeFilter = document.getElementById('log-type-filter').value;
        const search = document.getElementById('log-search').value;
        
        const logs = Logger.searchLogs(DataStore.currentStore, {
            type: typeFilter,
            search
        });
        
        tbody.innerHTML = logs.map(log => {
            const formatted = Logger.formatLogEntry(log);
            return `
                <tr>
                    <td>${formatted.timestampFormatted}</td>
                    <td>${formatted.typeName}</td>
                    <td><span class="status status-${log.status}">${log.status === 'success' ? '成功' : '失败'}</span></td>
                    <td><code class="log-data">${log.input}</code></td>
                    <td><code class="log-data">${log.output}</code></td>
                    <td><code class="log-data error">${log.failureReason || '-'}</code></td>
                </tr>
            `;
        }).join('');
    },
    
    renderRules() {
        const container = document.getElementById('rules-container');
        const validationRules = CoffeeRules.RULES.filter(r => r.type === 'validation');
        const rotationRules = CoffeeRules.RULES.filter(r => r.type === 'rotation');
        
        container.innerHTML = `
            <div class="rule-category">
                <h3>验证规则</h3>
                ${validationRules.map(rule => `
                    <div class="rule-card">
                        <div class="rule-header">
                            <span class="rule-id">${rule.id}</span>
                            <span class="rule-name">${rule.name}</span>
                        </div>
                        <p class="rule-description">${rule.description}</p>
                    </div>
                `).join('')}
            </div>
            
            <div class="rule-category">
                <h3>轮换规则 (优先级: 1最高, 4最低)</h3>
                ${rotationRules.map(rule => `
                    <div class="rule-card">
                        <div class="rule-header">
                            <span class="rule-id">${rule.id}</span>
                            <span class="rule-name">${rule.name}</span>
                            <span class="rule-priority">优先级: ${rule.priority}</span>
                        </div>
                        <p class="rule-description">${rule.description}</p>
                    </div>
                `).join('')}
            </div>
        `;
    },
    
    getStatusText(status) {
        const statusMap = {
            pending: '待确认',
            confirmed: '已确认',
            rejected: '已拒绝'
        };
        return statusMap[status] || status;
    },
    
    showBatchModal(batch = null) {
        const isEdit = !!batch;
        const today = new Date().toISOString().split('T')[0];
        const defaultBestBefore = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        
        const modal = `
            <div class="modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>${isEdit ? '编辑批次' : '新增批次'}</h3>
                        <button class="modal-close" onclick="App.closeModal()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <form id="batch-form">
                            <div class="form-group">
                                <label>咖啡豆类型 *</label>
                                <input type="text" name="coffeeType" value="${batch?.coffeeType || ''}" required>
                            </div>
                            <div class="form-group">
                                <label>烘焙日期 *</label>
                                <input type="date" name="roastDate" value="${batch?.roastDate || today}" max="${today}" required>
                            </div>
                            <div class="form-group">
                                <label>最佳赏味期至 *</label>
                                <input type="date" name="bestBefore" value="${batch?.bestBefore || defaultBestBefore}" required>
                            </div>
                            <div class="form-group">
                                <label>数量(g) *</label>
                                <input type="number" name="quantity" value="${batch?.quantity || ''}" min="1" required>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="App.closeModal()">取消</button>
                        <button class="btn btn-primary" onclick="App.saveBatch(${isEdit ? `'${batch.id}'` : 'null'})">保存</button>
                    </div>
                </div>
            </div>
        `;
        
        document.getElementById('modal-container').innerHTML = modal;
    },
    
    showOpeningModal(opening = null) {
        const isEdit = !!opening;
        const today = new Date().toISOString().split('T')[0];
        const confirmedBatches = DataStore.getBatchesByStore(DataStore.currentStore)
            .filter(b => b.status === 'confirmed' && b.remainingQuantity > 0);
        
        const modal = `
            <div class="modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>${isEdit ? '编辑开封记录' : '新增开封记录'}</h3>
                        <button class="modal-close" onclick="App.closeModal()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <form id="opening-form">
                            <div class="form-group">
                                <label>选择批次 *</label>
                                <select name="batchId" required>
                                    <option value="">请选择批次</option>
                                    ${confirmedBatches.map(b => `
                                        <option value="${b.id}" ${opening?.batchId === b.id ? 'selected' : ''}>
                                            ${b.id} - ${b.coffeeType} (剩余: ${b.remainingQuantity}g)
                                        </option>
                                    `).join('')}
                                </select>
                            </div>
                            <div class="form-group">
                                <label>开封日期 *</label>
                                <input type="date" name="openDate" value="${opening?.openDate || today}" max="${today}" required>
                            </div>
                            <div class="form-group">
                                <label>开封数量(g) *</label>
                                <input type="number" name="openQuantity" value="${opening?.openQuantity || ''}" min="1" required>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="App.closeModal()">取消</button>
                        <button class="btn btn-primary" onclick="App.saveOpening(${isEdit ? `'${opening.id}'` : 'null'})">保存</button>
                    </div>
                </div>
            </div>
        `;
        
        document.getElementById('modal-container').innerHTML = modal;
    },
    
    showConsumptionModal(consumption = null) {
        const isEdit = !!consumption;
        const today = new Date().toISOString().split('T')[0];
        const confirmedOpenings = DataStore.getOpeningsByStore(DataStore.currentStore)
            .filter(o => o.status === 'confirmed');
        const batchesWithOpenings = [...new Set(confirmedOpenings.map(o => o.batchId))]
            .map(id => DataStore.getBatch(id))
            .filter(b => b);
        
        const modal = `
            <div class="modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>${isEdit ? '编辑消耗记录' : '新增消耗记录'}</h3>
                        <button class="modal-close" onclick="App.closeModal()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <form id="consumption-form">
                            <div class="form-group">
                                <label>选择批次 *</label>
                                <select name="batchId" required>
                                    <option value="">请选择批次</option>
                                    ${batchesWithOpenings.map(b => `
                                        <option value="${b.id}" ${consumption?.batchId === b.id ? 'selected' : ''}>
                                            ${b.id} - ${b.coffeeType}
                                        </option>
                                    `).join('')}
                                </select>
                            </div>
                            <div class="form-group">
                                <label>消耗日期 *</label>
                                <input type="date" name="consumptionDate" value="${consumption?.consumptionDate || today}" max="${today}" required>
                            </div>
                            <div class="form-group">
                                <label>消耗数量(g) *</label>
                                <input type="number" name="quantity" value="${consumption?.quantity || ''}" min="1" required>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="App.closeModal()">取消</button>
                        <button class="btn btn-primary" onclick="App.saveConsumption(${isEdit ? `'${consumption.id}'` : 'null'})">保存</button>
                    </div>
                </div>
            </div>
        `;
        
        document.getElementById('modal-container').innerHTML = modal;
    },
    
    closeModal() {
        document.getElementById('modal-container').innerHTML = '';
    },
    
    getFormData(formId) {
        const form = document.getElementById(formId);
        const data = {};
        new FormData(form).forEach((value, key) => {
            data[key] = key === 'quantity' || key === 'openQuantity' ? Number(value) : value;
        });
        return data;
    },
    
    saveBatch(id) {
        const data = this.getFormData('batch-form');
        const logType = id ? 'update_batch' : 'add_batch';
        
        const validation = CoffeeRules.validateBatch(data);
        
        if (!validation.valid) {
            DataStore.addProblem({
                type: 'validation_error',
                sourceData: JSON.stringify(data),
                description: validation.firstError.reason,
                store: DataStore.currentStore
            });
            
            Logger.failed(logType, data, validation.firstError.reason);
            alert(`验证失败: ${validation.firstError.reason}`);
            return;
        }
        
        if (id) {
            DataStore.updateBatch(id, data);
            Logger.success(logType, data, { batchId: id });
        } else {
            data.remainingQuantity = data.quantity;
            const batch = DataStore.addBatch(data);
            Logger.success(logType, data, { batchId: batch.id });
        }
        
        this.closeModal();
        this.render();
    },
    
    saveOpening(id) {
        const data = this.getFormData('opening-form');
        const logType = id ? 'update_opening' : 'add_opening';
        
        const batch = DataStore.getBatch(data.batchId);
        data.coffeeType = batch.coffeeType;
        
        const validation = CoffeeRules.validateOpening(data);
        
        if (!validation.valid) {
            DataStore.addProblem({
                type: 'validation_error',
                sourceData: JSON.stringify(data),
                description: validation.firstError.reason,
                store: DataStore.currentStore
            });
            
            Logger.failed(logType, data, validation.firstError.reason);
            alert(`验证失败: ${validation.firstError.reason}`);
            return;
        }
        
        if (id) {
            DataStore.updateOpening(id, data);
            Logger.success(logType, data, { openingId: id });
        } else {
            const opening = DataStore.addOpening(data);
            Logger.success(logType, data, { openingId: opening.id });
        }
        
        this.closeModal();
        this.render();
    },
    
    saveConsumption(id) {
        const data = this.getFormData('consumption-form');
        const logType = id ? 'update_consumption' : 'add_consumption';
        
        const batch = DataStore.getBatch(data.batchId);
        data.coffeeType = batch.coffeeType;
        
        const validation = CoffeeRules.validateConsumption(data);
        
        if (!validation.valid) {
            DataStore.addProblem({
                type: 'validation_error',
                sourceData: JSON.stringify(data),
                description: validation.firstError.reason,
                store: DataStore.currentStore
            });
            
            Logger.failed(logType, data, validation.firstError.reason);
            alert(`验证失败: ${validation.firstError.reason}`);
            return;
        }
        
        if (id) {
            const oldConsumption = DataStore.getConsumption(id);
            DataStore.updateBatch(data.batchId, {
                remainingQuantity: batch.remainingQuantity + oldConsumption.quantity - data.quantity
            });
            DataStore.updateConsumption(id, data);
            Logger.success(logType, data, { consumptionId: id });
        } else {
            DataStore.updateBatch(data.batchId, {
                remainingQuantity: batch.remainingQuantity - data.quantity
            });
            const consumption = DataStore.addConsumption(data);
            Logger.success(logType, data, { consumptionId: consumption.id });
        }
        
        this.closeModal();
        this.render();
    },
    
    editBatch(id) {
        const batch = DataStore.getBatch(id);
        if (batch) {
            this.showBatchModal(batch);
        }
    },
    
    editOpening(id) {
        const opening = DataStore.getOpening(id);
        if (opening) {
            this.showOpeningModal(opening);
        }
    },
    
    editConsumption(id) {
        const consumption = DataStore.getConsumption(id);
        if (consumption) {
            this.showConsumptionModal(consumption);
        }
    },
    
    confirmBatch(id) {
        DataStore.updateBatch(id, { status: 'confirmed' });
        Logger.success('confirm_batch', { batchId: id }, { status: 'confirmed' });
        this.render();
    },
    
    rejectBatch(id) {
        DataStore.updateBatch(id, { status: 'rejected' });
        Logger.success('reject_batch', { batchId: id }, { status: 'rejected' });
        this.render();
    },
    
    confirmOpening(id) {
        const opening = DataStore.getOpening(id);
        const batch = DataStore.getBatch(opening.batchId);
        
        if (opening.openQuantity > batch.remainingQuantity) {
            const error = '开封数量超过批次剩余数量';
            DataStore.addProblem({
                type: 'confirmation_error',
                sourceData: JSON.stringify({ opening, batch }),
                description: error,
                store: DataStore.currentStore
            });
            Logger.failed('confirm_opening', { openingId: id }, error);
            alert(error);
            return;
        }
        
        DataStore.updateOpening(id, { status: 'confirmed' });
        Logger.success('confirm_opening', { openingId: id }, { status: 'confirmed' });
        this.render();
    },
    
    rejectOpening(id) {
        DataStore.updateOpening(id, { status: 'rejected' });
        Logger.success('reject_opening', { openingId: id }, { status: 'rejected' });
        this.render();
    },
    
    resolveProblem(id) {
        DataStore.updateProblem(id, { status: 'resolved' });
        this.render();
    },
    
    calculateRotation() {
        const container = document.getElementById('rotation-results');
        const rotation = CoffeeRules.calculateRotation(DataStore.currentStore);
        
        Logger.success('calculate_rotation', 
            { store: DataStore.currentStore },
            { 
                criticalCount: rotation.criticalCount,
                warningCount: rotation.warningCount,
                normalCount: rotation.normalCount
            }
        );
        
        if (rotation.results.length === 0) {
            container.innerHTML = '<p>暂无已确认的批次数据</p>';
            return;
        }
        
        container.innerHTML = `
            <div class="rotation-summary">
                <div class="summary-item critical">
                    <span class="count">${rotation.criticalCount}</span>
                    <span class="label">严重问题</span>
                </div>
                <div class="summary-item warning">
                    <span class="count">${rotation.warningCount}</span>
                    <span class="label">需要关注</span>
                </div>
                <div class="summary-item normal">
                    <span class="count">${rotation.normalCount}</span>
                    <span class="label">正常状态</span>
                </div>
            </div>
            
            <div class="rotation-results">
                <h3>轮换优先级</h3>
                ${rotation.results.map((item, index) => `
                    <div class="rotation-item rotation-${item.level}">
                        <div class="rotation-header">
                            <span class="priority-badge">优先级 ${index + 1}</span>
                            <span class="coffee-name">${item.batch.coffeeType}</span>
                            <span class="rotation-score">分数: ${Math.round(item.score)}</span>
                        </div>
                        <div class="rotation-details">
                            <p><strong>批次:</strong> ${item.batch.id}</p>
                            <p><strong>烘焙日期:</strong> ${item.batch.roastDate}</p>
                            <p><strong>最佳赏味期:</strong> ${item.batch.bestBefore}</p>
                            <p><strong>剩余数量:</strong> ${item.batch.remainingQuantity}g</p>
                        </div>
                        ${item.recommendations.length > 0 ? `
                            <div class="rotation-recommendations">
                                <strong>建议:</strong>
                                <ul>
                                    ${item.recommendations.map(r => `<li>${r}</li>`).join('')}
                                </ul>
                            </div>
                        ` : ''}
                        <div class="rotation-rules">
                            <strong>规则详情:</strong>
                            <ul>
                                ${item.ruleResults.map(rule => `
                                    <li class="rule-${rule.level}">
                                        <span class="rule-badge">${rule.level === 'critical' ? '🔴' : rule.level === 'warning' ? '🟡' : '🟢'}</span>
                                        <span>${rule.ruleName}: ${rule.message} (分数: ${rule.score})</span>
                                    </li>
                                `).join('')}
                            </ul>
                        </div>
                    </div>
                `).join('')}
            </div>
            
            <div class="export-section">
                <button class="btn btn-primary" onclick="App.exportRotationReport()">导出轮换报告</button>
            </div>
        `;
    },
    
    exportRotationReport() {
        const report = CoffeeRules.generateRotationReport(DataStore.currentStore);
        this.downloadFile(report, `rotation-report-${DataStore.currentStore}-${Date.now()}.md`, 'text/markdown');
        Logger.success('export_data', { type: 'rotation_report' }, { success: true });
    },
    
    loadSampleData() {
        if (confirm('加载示例数据将覆盖当前所有数据，是否继续？')) {
            DataStore.loadSampleData();
            Logger.success('load_samples', {}, { success: true });
            this.render();
            alert('示例数据已加载');
        }
    },
    
    exportData() {
        const data = DataStore.exportAll();
        const json = JSON.stringify(data, null, 2);
        this.downloadFile(json, `coffee-rotation-data-${Date.now()}.json`, 'application/json');
        Logger.success('export_data', { type: 'all' }, { success: true });
    },
    
    exportLogs() {
        const logs = DataStore.exportLogs();
        const json = JSON.stringify(logs, null, 2);
        this.downloadFile(json, `coffee-rotation-logs-${Date.now()}.json`, 'application/json');
    },
    
    downloadFile(content, filename, type) {
        const blob = new Blob([content], { type });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    },
    
    runRuleTests() {
        const container = document.getElementById('test-results-container');
        const results = RuleTests.runAllTests();
        
        container.innerHTML = `
            <div class="test-summary">
                <div class="summary-item ${results.failed > 0 ? 'critical' : 'normal'}">
                    <span class="count">${results.total}</span>
                    <span class="label">总测试数</span>
                </div>
                <div class="summary-item normal">
                    <span class="count">${results.passed}</span>
                    <span class="label">通过</span>
                </div>
                <div class="summary-item ${results.failed > 0 ? 'critical' : 'normal'}">
                    <span class="count">${results.failed}</span>
                    <span class="label">失败</span>
                </div>
            </div>
            
            <div class="test-results-list">
                ${results.results.map(result => `
                    <div class="test-result ${result.passed ? 'passed' : 'failed'}">
                        <div class="test-header">
                            <span class="test-badge">${result.passed ? '✅ 通过' : '❌ 失败'}</span>
                            <span class="test-name">${result.id}: ${result.name}</span>
                        </div>
                        <p class="test-description">${result.description}</p>
                        ${result.error ? `<p class="test-error">错误: ${result.error}</p>` : ''}
                    </div>
                `).join('')}
            </div>
            
            <p class="test-conclusion">
                ${results.failed === 0 
                    ? '🎉 所有测试通过！系统规则验证正常。' 
                    : `⚠️ 有 ${results.failed} 个测试失败，请检查规则实现。`}
            </p>
        `;
    }
};

document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
