const API_BASE = '';

const app = {
    complaintsPage: 1,
    operationsPage: 1,
    versionsPage: 1,
    currentFile: null,
    allClusters: [],

    init() {
        this.bindNavigation();
        this.bindImport();
        this.bindModals();
        this.bindButtons();
        this.loadDashboard();
    },

    bindNavigation() {
        const navBtns = document.querySelectorAll('.nav-btn');
        const tabs = document.querySelectorAll('.tab-content');
        
        navBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                navBtns.forEach(b => b.classList.remove('active'));
                tabs.forEach(t => t.classList.remove('active'));
                
                btn.classList.add('active');
                const tabId = btn.dataset.tab;
                document.getElementById(tabId).classList.add('active');
                
                switch(tabId) {
                    case 'dashboard':
                        this.loadDashboard();
                        break;
                    case 'clusters':
                        this.loadClusters();
                        break;
                    case 'complaints':
                        this.loadComplaints();
                        break;
                    case 'rules':
                        this.loadRules();
                        break;
                    case 'history':
                        this.loadVersions();
                        break;
                    case 'operations':
                        this.loadOperations();
                        break;
                }
            });
        });
    },

    bindImport() {
        const uploadArea = document.getElementById('upload-area');
        const fileInput = document.getElementById('file-input');
        const selectFileBtn = document.getElementById('select-file-btn');
        const importConfig = document.getElementById('import-config');
        const fileName = document.getElementById('file-name');

        selectFileBtn.addEventListener('click', () => fileInput.click());
        
        uploadArea.addEventListener('click', () => fileInput.click());
        
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });
        
        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('dragover');
        });
        
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            if (e.dataTransfer.files.length) {
                this.handleFileSelect(e.dataTransfer.files[0]);
            }
        });
        
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length) {
                this.handleFileSelect(e.target.files[0]);
            }
        });
        
        document.getElementById('import-btn').addEventListener('click', () => this.uploadFile());
        
        document.getElementById('cancel-import-btn').addEventListener('click', () => {
            importConfig.style.display = 'none';
            uploadArea.style.display = 'block';
            this.currentFile = null;
        });
    },

    handleFileSelect(file) {
        this.currentFile = file;
        document.getElementById('file-name').textContent = file.name;
        document.getElementById('upload-area').style.display = 'none';
        document.getElementById('import-config').style.display = 'block';
    },

    async uploadFile() {
        if (!this.currentFile) return;
        
        const formData = new FormData();
        formData.append('file', this.currentFile);
        formData.append('text_column', document.getElementById('text-column').value);
        formData.append('tag_column', document.getElementById('tag-column').value);
        const idColumn = document.getElementById('id-column').value;
        if (idColumn) formData.append('id_column', idColumn);
        
        try {
            const res = await fetch(`${API_BASE}/api/import/upload`, {
                method: 'POST',
                body: formData
            });
            const data = await res.json();
            
            if (data.success) {
                this.showToast(`成功导入 ${data.data.total} 条投诉`, 'success');
                document.getElementById('import-config').style.display = 'none';
                document.getElementById('upload-area').style.display = 'block';
                this.currentFile = null;
                this.loadDashboard();
            } else {
                this.showToast(data.error || '导入失败', 'error');
            }
        } catch (e) {
            this.showToast('导入失败', 'error');
        }
    },

    bindButtons() {
        document.getElementById('run-clustering-btn').addEventListener('click', () => this.runClustering());
        document.getElementById('refresh-clusters-btn').addEventListener('click', () => this.loadClusters());
        document.getElementById('refresh-complaints-btn').addEventListener('click', () => this.loadComplaints());
        document.getElementById('refresh-rules-btn').addEventListener('click', () => this.loadRules());
        document.getElementById('create-cluster-btn').addEventListener('click', () => this.showCreateClusterModal());
        document.getElementById('create-rule-btn').addEventListener('click', () => this.showCreateRuleModal());
        document.getElementById('filter-cluster').addEventListener('change', () => {
            this.complaintsPage = 1;
            this.loadComplaints();
        });
        
        document.querySelectorAll('.export-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const type = btn.dataset.export;
                if (type === 'clusters-csv') window.location.href = `${API_BASE}/api/report/export/clusters?format=csv`;
                if (type === 'clusters-excel') window.location.href = `${API_BASE}/api/report/export/clusters?format=xlsx`;
                if (type === 'operations-csv') window.location.href = `${API_BASE}/api/report/export/operations?format=csv`;
                if (type === 'operations-excel') window.location.href = `${API_BASE}/api/report/export/operations?format=xlsx`;
            });
        });
    },

    bindModals() {
        document.getElementById('modal-close').addEventListener('click', () => this.closeModal());
        document.getElementById('modal').addEventListener('click', (e) => {
            if (e.target.id === 'modal') this.closeModal();
        });
    },

    async loadDashboard() {
        try {
            const statsRes = await fetch(`${API_BASE}/api/import/stats`);
            const statsData = await statsRes.json();
            
            if (statsData.success) {
                document.getElementById('stat-total').textContent = statsData.data.total_complaints;
                document.getElementById('stat-with-cluster').textContent = statsData.data.with_cluster;
                document.getElementById('stat-without-cluster').textContent = statsData.data.without_cluster;
                document.getElementById('stat-versions').textContent = statsData.data.versions;
            }
            
            const summaryRes = await fetch(`${API_BASE}/api/report/summary`);
            const summaryData = await summaryRes.json();
            
            const summaryContent = document.getElementById('summary-content');
            
            if (summaryData.success && summaryData.data.all_clusters.length) {
                let html = '<h4>聚类分布 (Top 10)</h4>';
                html += '<ul style="margin-top: 1rem;">';
                
                summaryData.data.top_clusters.forEach((cluster => {
                    const color = cluster.is_manual ? '#f6a623' : '#667eea';
                    html += `<li style="margin-bottom: 0.5rem; display: flex; justify-content: space-between;">
                        <span>${cluster.cluster_name}</span>
                        <span style="color: ${color}; font-weight: 500;">${cluster.count} 条</span>
                    </li>`;
                }));
                
                html += '</ul>';
                html += `<p style="margin-top: 1rem; color: #666;">聚类率: ${summaryData.data.summary.cluster_rate}%</p>`;
                summaryContent.innerHTML = html;
            } else {
                summaryContent.innerHTML = '<div class="empty-state"><h4>暂无聚类数据</h4><p>请先导入数据并运行聚类</p></div>';
            }
        } catch (e) {
            document.getElementById('summary-content').innerHTML = '<p class="loading">加载失败</p>';
        }
    },

    async loadClusters() {
        try {
            const res = await fetch(`${API_BASE}/api/cluster/clusters`);
            const data = await res.json();
            
            const listEl = document.getElementById('clusters-list');
            
            if (data.success && data.data.length) {
                this.allClusters = data.data;
                
                let html = '';
                data.data.forEach(cluster => {
                    const manualClass = cluster.is_manual ? 'manual' : '';
                    html += `<div class="cluster-card ${manualClass}">
                        <div class="cluster-header">
                            <span class="cluster-name">${this.escapeHtml(cluster.name)}</span>
                            <span class="cluster-count">${cluster.complaint_count} 条</span>
                        </div>
                        <div class="cluster-meta">
                            <span>${cluster.is_manual ? '手动创建' : '自动聚类'}</span>
                            <span>${new Date(cluster.created_at).toLocaleString()}</span>
                        </div>
                        ${cluster.keywords ? `<div class="cluster-keywords">关键词: ${this.escapeHtml(cluster.keywords)}</div>` : ''}
                        <div class="cluster-actions">
                            <button onclick="app.viewClusterComplaints(${cluster.id})">查看投诉</button>
                            <button onclick="app.editCluster(${cluster.id})">编辑</button>
                        </div>
                    </div>`;
                });
                
                listEl.innerHTML = html;
                
                this.updateClusterFilter();
            } else {
                listEl.innerHTML = '<div class="empty-state"><h4>暂无聚类</h4><p>请运行聚类分析</p></div>';
            }
        } catch (e) {
            document.getElementById('clusters-list').innerHTML = '<p class="loading">加载失败</p>';
        }
    },

    async viewClusterComplaints(clusterId) {
        const navBtns = document.querySelectorAll('.nav-btn');
        const tabs = document.querySelectorAll('.tab-content');
        navBtns.forEach(b => b.classList.remove('active'));
        tabs.forEach(t => t.classList.remove('active'));
        
        const targetBtn = Array.from(navBtns).find(btn => btn.dataset.tab === 'complaints');
        if (targetBtn) {
            targetBtn.classList.add('active');
            document.getElementById('complaints').classList.add('active');
        }
        
        setTimeout(() => {
            document.getElementById('filter-cluster').value = clusterId;
            this.loadComplaints();
        }, 100);
    },

    async loadComplaints() {
        const clusterId = document.getElementById('filter-cluster').value;
        
        const params = new URLSearchParams();
        params.append('page', this.complaintsPage);
        params.append('per_page', 20);
        if (clusterId) params.append('cluster_id', clusterId);
        
        try {
            const res = await fetch(`${API_BASE}/api/import/complaints?${params}`);
            const data = await res.json();
            
            const listEl = document.getElementById('complaints-list');
            
            if (data.success && data.data.items.length) {
                let html = '';
                data.data.items.forEach(complaint => {
                    const cluster = this.allClusters.find(c => c.id === complaint.current_cluster_id);
                    const clusterName = cluster ? cluster.name : '未知';
                    html += `<div class="complaint-card">
                        <div class="complaint-text">${this.escapeHtml(complaint.text)}</div>
                        <div class="complaint-meta">
                            ${complaint.original_tags ? `<span>原始标签: ${this.escapeHtml(complaint.original_tags)}</span>` : ''}
                            ${complaint.current_cluster_id ? `<span>当前聚类: ${this.escapeHtml(clusterName)}</span>` : '<span style="color: #f44336;">未分类</span>'}
                        </div>
                        <div class="complaint-actions">
                            <button onclick="app.viewComplaintHistory(${complaint.id})">查看历史</button>
                            ${complaint.current_cluster_id ? `<button onclick="app.moveComplaint(${complaint.id})">移动</button>` : ''}
                        </div>
                    </div>`;
                });
                
                if (data.data.pages > 1) {
                    html += `<div class="pagination">
                        <button ${this.complaintsPage <= 1 ? 'disabled' : ''} onclick="app.complaintsPage--; app.loadComplaints()">&laquo;</button>
                        <span class="page-info">${this.complaintsPage} / ${data.data.pages}</span>
                        <button ${this.complaintsPage >= data.data.pages ? 'disabled' : ''} onclick="app.complaintsPage++; app.loadComplaints()">&raquo;</button>
                    </div>`;
                }
                
                listEl.innerHTML = html;
            } else {
                listEl.innerHTML = '<div class="empty-state"><h4>暂无投诉</h4><p>请先导入数据</p></div>';
            }
        } catch (e) {
            document.getElementById('complaints-list').innerHTML = '<p class="loading">加载失败</p>';
        }
    },

    updateClusterFilter() {
        const select = document.getElementById('filter-cluster');
        const currentValue = select.value;
        
        let html = '<option value="">全部聚类</option>';
        this.allClusters.forEach(cluster => {
            html += `<option value="${cluster.id}">${this.escapeHtml(cluster.name)}</option>`;
        });
        
        select.innerHTML = html;
        if (currentValue) select.value = currentValue;
    },

    async loadRules() {
        try {
            const res = await fetch(`${API_BASE}/api/rules/`);
            const data = await res.json();
            
            const listEl = document.getElementById('rules-list');
            
            if (data.success && data.data.length) {
                let html = '';
                data.data.forEach(rule => {
                    const inactiveClass = rule.is_active ? '' : 'inactive';
                    html += `<div class="rule-card ${inactiveClass}">
                        <div class="rule-header">
                            <span class="rule-name">${this.escapeHtml(rule.name)}</span>
                            <span class="cluster-count">优先级: ${rule.priority}</span>
                        </div>
                        <div class="rule-pattern">${this.escapeHtml(rule.pattern)}</div>
                        <div class="rule-meta">
                            <span>类型: ${rule.pattern_type === 'keyword' ? '关键词' : '正则'}</span>
                            <span>目标聚类: ${this.escapeHtml(rule.cluster_name || rule.name)}</span>
                        </div>
                        <div class="rule-actions">
                            <button onclick="app.toggleRule(${rule.id})">${rule.is_active ? '禁用' : '启用'}</button>
                            <button onclick="app.editRule(${rule.id})">编辑</button>
                            <button onclick="app.deleteRule(${rule.id})">删除</button>
                        </div>
                    </div>`;
                });
                listEl.innerHTML = html;
            } else {
                listEl.innerHTML = '<div class="empty-state"><h4>暂无规则</h4><p>创建规则来提高聚类精度</p></div>';
            }
        } catch (e) {
            document.getElementById('rules-list').innerHTML = '<p class="loading">加载失败</p>';
        }
    },

    async loadVersions() {
        const params = new URLSearchParams();
        params.append('page', this.versionsPage);
        params.append('per_page', 20);
        
        try {
            const res = await fetch(`${API_BASE}/api/history/versions?${params}`);
            const data = await res.json();
            
            const listEl = document.getElementById('versions-list');
            
            if (data.success && data.data.items.length) {
                let html = '';
                data.data.items.forEach(version => {
                    const currentClass = version.is_current ? 'current' : '';
                    const typeClass = version.type || '';
                    html += `<div class="version-card ${currentClass}">
                        <div class="version-header">
                            <span class="version-name">
                                <span class="version-type ${typeClass}">${this.getVersionTypeLabel(version.type)}</span>
                                ${this.escapeHtml(version.name)}</span>
                            ${version.is_current ? '<span class="current-badge">当前</span>' : ''}
                        </div>
                        <div class="version-meta">
                            <span>${new Date(version.created_at).toLocaleString()}</span>
                            <span>聚类: ${version.cluster_count}</span>
                            <span>操作: ${version.operation_count}</span>
                        </div>
                        <div class="version-description">${this.escapeHtml(version.description || '')}</div>
                        <div class="version-actions">
                            <button onclick="app.viewVersionDetails(${version.id})">查看详情</button>
                            ${!version.is_current ? `<button onclick="app.rollbackToVersion(${version.id})">回滚</button>` : ''}
                        </div>
                    </div>`;
                });
                
                if (data.data.pages > 1) {
                    html += `<div class="pagination">
                        <button ${this.versionsPage <= 1 ? 'disabled' : ''} onclick="app.versionsPage--; app.loadVersions()">&laquo;</button>
                        <span class="page-info">${this.versionsPage} / ${data.data.pages}</span>
                        <button ${this.versionsPage >= data.data.pages ? 'disabled' : ''} onclick="app.versionsPage++; app.loadVersions()">&raquo;</button>
                    </div>`;
                }
                
                listEl.innerHTML = html;
            } else {
                listEl.innerHTML = '<div class="empty-state"><h4>暂无版本</h4><p>导入数据或运行聚类</p></div>';
            }
        } catch (e) {
            document.getElementById('versions-list').innerHTML = '<p class="loading">加载失败</p>';
        }
    },

    async loadOperations() {
        const params = new URLSearchParams();
        params.append('page', this.operationsPage);
        params.append('per_page', 20);
        
        try {
            const res = await fetch(`${API_BASE}/api/report/operations?${params}`);
            const data = await res.json();
            
            const listEl = document.getElementById('operations-list');
            
            if (data.success && data.data.items.length) {
                let html = '';
                data.data.items.forEach(op => {
                    html += `<div class="operation-card">
                        <div class="operation-type">${this.getOperationTypeLabel(op.operation_type)}</div>
                        <div class="operation-meta">
                            <span>${new Date(op.created_at).toLocaleString()}</span>
                            <span>版本: ${this.escapeHtml(op.version_name || '')}</span>
                        </div>
                        ${op.reason ? `<div class="version-description">原因: ${this.escapeHtml(op.reason)}</div>` : ''}
                        <div class="operation-values">
                            <div class="operation-old">
                                <label>变更前</label>
                                ${op.old_value ? this.escapeHtml(op.old_value) : '<em>无</em>'}
                            </div>
                            <div class="operation-new">
                                <label>变更后</label>
                                ${op.new_value ? this.escapeHtml(op.new_value) : '<em>无</em>'}
                            </div>
                        </div>
                    </div>`;
                });
                
                if (data.data.pages > 1) {
                    html += `<div class="pagination">
                        <button ${this.operationsPage <= 1 ? 'disabled' : ''} onclick="app.operationsPage--; app.loadOperations()">&laquo;</button>
                        <span class="page-info">${this.operationsPage} / ${data.data.pages}</span>
                        <button ${this.operationsPage >= data.data.pages ? 'disabled' : ''} onclick="app.operationsPage++; app.loadOperations()">&raquo;</button>
                    </div>`;
                }
                
                listEl.innerHTML = html;
            } else {
                listEl.innerHTML = '<div class="empty-state"><h4>暂无操作记录</h4></div>';
            }
        } catch (e) {
            document.getElementById('operations-list').innerHTML = '<p class="loading">加载失败</p>';
        }
    },

    async runClustering() {
        if (!confirm('确认运行聚类分析？')) return;
        
        try {
            const res = await fetch(`${API_BASE}/api/cluster/run`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            const data = await res.json();
            
            if (data.success) {
                this.showToast('聚类完成', 'success');
                this.loadClusters();
                this.loadDashboard();
            } else {
                this.showToast(data.error || '聚类失败', 'error');
            }
        } catch (e) {
            this.showToast('聚类失败', 'error');
        }
    },

    async viewComplaintHistory(complaintId) {
        try {
            const res = await fetch(`${API_BASE}/api/history/complaint/${complaintId}`);
            const data = await res.json();
            
            if (data.success) {
                let html = `<div class="complaint-text" style="margin-bottom: 1rem;">
                    <strong>投诉内容:</strong> ${this.escapeHtml(data.data.complaint.text)}</div>`;
                
                if (data.data.complaint.original_tags) {
                    html += `<div class="complaint-meta" style="margin-bottom: 1rem;">
                        原始标签: ${this.escapeHtml(data.data.complaint.original_tags)}</div>`;
                }
                
                html += '<h4 style="margin-bottom: 0.5rem;">聚类历史</h4>';
                
                if (data.data.assignments.length) {
                    data.data.assignments.forEach(assn => {
                        const manualClass = assn.is_manual ? 'manual' : '';
                        const confText = assn.confidence ? `置信度: ${(assn.confidence * 100).toFixed(0)}% | ` : '';
                        html += `<div class="history-item ${manualClass}">
                            <div>
                                <strong>聚类: ${this.escapeHtml(assn.cluster_name || '未知')}</strong>
                                ${assn.is_manual ? ' (手动)' : ''}
                            </div>
                            <div style="color: #666; font-size: 0.8rem;">
                                ${confText}版本: ${this.escapeHtml(assn.version_name || '未知')} | ${new Date(assn.created_at).toLocaleString()}
                            </div>
                            ${assn.reason ? `<div style="margin-top: 0.25rem; color: #888;">原因: ${this.escapeHtml(assn.reason)}</div>` : ''}
                        </div>`;
                    });
                } else {
                    html += '<p style="color: #999;">暂无聚类历史</p>';
                }
                
                this.openModal('投诉历史', html, '');
            }
        } catch (e) {
            this.showToast('加载失败', 'error');
        }
    },

    async moveComplaint(complaintId) {
        if (!this.allClusters.length) {
            this.showToast('没有可用聚类', 'error');
            return;
        }
        
        let html = '<div class="form-group"><label for="move-to-cluster">目标聚类</label>';
        html += '<select id="move-to-cluster" class="form-control">';
        
        this.allClusters.forEach(c => {
            html += `<option value="${c.id}">${this.escapeHtml(c.name)}</option>`;
        });
        
        html += '</select></div>';
        html += '<div class="form-group"><label for="move-reason">修正原因</label>';
        html += '<textarea id="move-reason" class="form-control" rows="3" placeholder="请输入修正原因..."></textarea>';
        html += '</div>';
        
        const footer = `<button class="primary-btn" onclick="app.doMoveComplaint(${complaintId})">确认移动</button>`;
        
        this.openModal('移动投诉', html, footer);
    },

    async doMoveComplaint(complaintId) {
        const targetClusterId = parseInt(document.getElementById('move-to-cluster').value);
        const reason = document.getElementById('move-reason').value;
        
        try {
            const res = await fetch(`${API_BASE}/api/review/move`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    complaint_id: complaintId,
                    target_cluster_id: targetClusterId,
                    reason: reason || undefined
                })
            });
            const data = await res.json();
            
            if (data.success) {
                this.showToast('移动成功', 'success');
                this.closeModal();
                this.loadComplaints();
                this.loadDashboard();
            } else {
                this.showToast(data.error || '移动失败', 'error');
            }
        } catch (e) {
            this.showToast('移动失败', 'error');
        }
    },

    async editCluster(clusterId) {
        const cluster = this.allClusters.find(c => c.id === clusterId);
        if (!cluster) return;
        
        let html = '<div class="form-group"><label for="edit-cluster-name">聚类名称</label>';
        html += `<input type="text" id="edit-cluster-name" class="form-control" value="${this.escapeHtml(cluster.name)}">`;
        html += '</div>';
        html += '<div class="form-group"><label for="edit-cluster-desc">聚类描述</label>';
        html += `<textarea id="edit-cluster-desc" class="form-control" rows="3">${this.escapeHtml(cluster.description || '')}</textarea>`;
        html += '</div>';
        html += '<div class="form-group"><label for="edit-cluster-reason">修改原因</label>';
        html += '<textarea id="edit-cluster-reason" class="form-control" rows="2" placeholder="请输入修改原因..."></textarea>';
        html += '</div>';
        
        const footer = `<button class="primary-btn" onclick="app.doEditCluster(${clusterId})">保存</button>`;
        
        this.openModal('编辑聚类', html, footer);
    },

    async doEditCluster(clusterId) {
        const name = document.getElementById('edit-cluster-name').value;
        const description = document.getElementById('edit-cluster-desc').value;
        const reason = document.getElementById('edit-cluster-reason').value;
        
        try {
            const res = await fetch(`${API_BASE}/api/review/cluster/${clusterId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, description, reason: reason || undefined })
            });
            const data = await res.json();
            
            if (data.success) {
                this.showToast('修改成功', 'success');
                this.closeModal();
                this.loadClusters();
            } else {
                this.showToast(data.error || '修改失败', 'error');
            }
        } catch (e) {
            this.showToast('修改失败', 'error');
        }
    },

    showCreateClusterModal() {
        let html = '<div class="form-group"><label for="new-cluster-name">聚类名称</label>';
        html += '<input type="text" id="new-cluster-name" class="form-control" placeholder="请输入聚类名称">';
        html += '</div>';
        html += '<div class="form-group"><label for="new-cluster-desc">聚类描述</label>';
        html += '<textarea id="new-cluster-desc" class="form-control" rows="3" placeholder="请输入聚类描述..."></textarea>';
        html += '</div>';
        html += '<div class="form-group"><label for="new-cluster-reason">创建原因</label>';
        html += '<textarea id="new-cluster-reason" class="form-control" rows="2" placeholder="请输入创建原因..."></textarea>';
        html += '</div>';
        
        const footer = `<button class="primary-btn" onclick="app.doCreateCluster()">创建</button>`;
        
        this.openModal('新建聚类', html, footer);
    },

    async doCreateCluster() {
        const name = document.getElementById('new-cluster-name').value;
        if (!name) {
            this.showToast('请输入名称', 'error');
            return;
        }
        
        const description = document.getElementById('new-cluster-desc').value;
        const reason = document.getElementById('new-cluster-reason').value;
        
        try {
            const res = await fetch(`${API_BASE}/api/review/cluster`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, description, reason: reason || undefined })
            });
            const data = await res.json();
            
            if (data.success) {
                this.showToast('创建成功', 'success');
                this.closeModal();
                this.loadClusters();
            } else {
                this.showToast(data.error || '创建失败', 'error');
            }
        } catch (e) {
            this.showToast('创建失败', 'error');
        }
    },

    showCreateRuleModal() {
        let html = '<div class="form-group"><label for="new-rule-name">规则名称</label>';
        html += '<input type="text" id="new-rule-name" class="form-control" placeholder="例如：物流问题">';
        html += '</div>';
        html += '<div class="form-group"><label for="new-rule-pattern">匹配模式</label>';
        html += '<input type="text" id="new-rule-pattern" class="form-control" placeholder="关键词用逗号分隔，如：物流,快递,送货,配送">';
        html += '</div>';
        html += '<div class="form-row">';
        html += '<div class="form-group"><label for="new-rule-type">类型</label>';
        html += '<select id="new-rule-type" class="form-control">';
        html += '<option value="keyword">关键词</option>';
        html += '<option value="regex">正则</option>';
        html += '</select>';
        html += '</div>';
        html += '<div class="form-group"><label for="new-rule-priority">优先级</label>';
        html += '<input type="number" id="new-rule-priority" class="form-control" value="0">';
        html += '</div>';
        html += '</div>';
        html += '<div class="form-group"><label for="new-rule-cluster">目标聚类名称</label>';
        html += '<input type="text" id="new-rule-cluster" class="form-control" placeholder="例如：物流配送问题">';
        html += '</div>';
        
        const footer = `<button class="primary-btn" onclick="app.doCreateRule()">创建</button>`;
        
        this.openModal('新建规则', html, footer);
    },

    async doCreateRule() {
        const name = document.getElementById('new-rule-name').value;
        const pattern = document.getElementById('new-rule-pattern').value;
        if (!name || !pattern) {
            this.showToast('请填写必填项', 'error');
            return;
        }
        
        const data = {
            name,
            pattern,
            pattern_type: document.getElementById('new-rule-type').value,
            priority: parseInt(document.getElementById('new-rule-priority').value) || 0,
            cluster_name: document.getElementById('new-rule-cluster').value || name
        };
        
        try {
            const res = await fetch(`${API_BASE}/api/rules/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const result = await res.json();
            
            if (result.success) {
                this.showToast('创建成功', 'success');
                this.closeModal();
                this.loadRules();
            } else {
                this.showToast(result.error || '创建失败', 'error');
            }
        } catch (e) {
            this.showToast('创建失败', 'error');
        }
    },

    async toggleRule(ruleId) {
        try {
            const res = await fetch(`${API_BASE}/api/rules/${ruleId}/toggle`, {
                method: 'POST'
            });
            const data = await res.json();
            
            if (data.success) {
                this.showToast('切换成功', 'success');
                this.loadRules();
            } else {
                this.showToast(data.error || '操作失败', 'error');
            }
        } catch (e) {
            this.showToast('操作失败', 'error');
        }
    },

    async editRule(ruleId) {
        try {
            const res = await fetch(`${API_BASE}/api/rules/${ruleId}`);
            const data = await res.json();
            
            if (!data.success) {
                this.showToast('加载失败', 'error');
                return;
            }
            
            const rule = data.data;
            
            let html = '<div class="form-group"><label for="edit-rule-name">规则名称</label>';
            html += `<input type="text" id="edit-rule-name" class="form-control" value="${this.escapeHtml(rule.name)}">`;
            html += '</div>';
            html += '<div class="form-group"><label for="edit-rule-pattern">匹配模式</label>';
            html += `<input type="text" id="edit-rule-pattern" class="form-control" value="${this.escapeHtml(rule.pattern)}">`;
            html += '</div>';
            html += '<div class="form-row">';
            html += '<div class="form-group"><label for="edit-rule-type">类型</label>';
            html += '<select id="edit-rule-type" class="form-control">';
            html += `<option value="keyword" ${rule.pattern_type === 'keyword' ? 'selected' : ''}>关键词</option>`;
            html += `<option value="regex" ${rule.pattern_type === 'regex' ? 'selected' : ''}>正则</option>`;
            html += '</select>';
            html += '</div>';
            html += '<div class="form-group"><label for="edit-rule-priority">优先级</label>';
            html += `<input type="number" id="edit-rule-priority" class="form-control" value="${rule.priority}">`;
            html += '</div>';
            html += '</div>';
            html += '<div class="form-group"><label for="edit-rule-cluster">目标聚类名称</label>';
            html += `<input type="text" id="edit-rule-cluster" class="form-control" value="${this.escapeHtml(rule.cluster_name || '')}">`;
            html += '</div>';
            
            const footer = `<button class="primary-btn" onclick="app.doEditRule(${ruleId})">保存</button>`;
            
            this.openModal('编辑规则', html, footer);
        } catch (e) {
            this.showToast('加载失败', 'error');
        }
    },

    async doEditRule(ruleId) {
        const data = {
            name: document.getElementById('edit-rule-name').value,
            pattern: document.getElementById('edit-rule-pattern').value,
            pattern_type: document.getElementById('edit-rule-type').value,
            priority: parseInt(document.getElementById('edit-rule-priority').value) || 0,
            cluster_name: document.getElementById('edit-rule-cluster').value
        };
        
        try {
            const res = await fetch(`${API_BASE}/api/rules/${ruleId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const result = await res.json();
            
            if (result.success) {
                this.showToast('修改成功', 'success');
                this.closeModal();
                this.loadRules();
            } else {
                this.showToast(result.error || '修改失败', 'error');
            }
        } catch (e) {
            this.showToast('修改失败', 'error');
        }
    },

    async deleteRule(ruleId) {
        if (!confirm('确认删除该规则？')) return;
        
        try {
            const res = await fetch(`${API_BASE}/api/rules/${ruleId}`, {
                method: 'DELETE'
            });
            const data = await res.json();
            
            if (data.success) {
                this.showToast('删除成功', 'success');
                this.loadRules();
            } else {
                this.showToast(data.error || '删除失败', 'error');
            }
        } catch (e) {
            this.showToast('删除失败', 'error');
        }
    },

    async viewVersionDetails(versionId) {
        try {
            const res = await fetch(`${API_BASE}/api/history/versions/${versionId}`);
            const data = await res.json();
            
            if (!data.success) {
                this.showToast('加载失败', 'error');
                return;
            }
            
            let html = `<div style="margin-bottom: 1rem;">`;
            html += `<strong>版本:</strong> ${this.escapeHtml(data.data.name)}<br>`;
            html += `<strong>类型:</strong> ${this.getVersionTypeLabel(data.data.type)}<br>`;
            html += `<strong>时间:</strong> ${new Date(data.data.created_at).toLocaleString()}<br>`;
            html += `<strong>描述:</strong> ${this.escapeHtml(data.data.description || '')}<br>`;
            if (data.data.parent) {
                html += `<strong>父版本:</strong> ${this.escapeHtml(data.data.parent.name)}`;
            }
            html += '</div>';
            
            html += `<h4 style="margin-top: 1rem; margin-bottom: 0.5rem;">聚类 (${data.data.clusters.length})</h4>`;
            if (data.data.clusters.length) {
                data.data.clusters.forEach(cluster => {
                    html += `<div class="history-item">
                        ${this.escapeHtml(cluster.name)} - ${cluster.complaint_count} 条投诉
                    </div>`;
                });
            } else {
                html += '<p style="color: #999;">无</p>';
            }
            
            html += '<h4 style="margin-top: 1rem; margin-bottom: 0.5rem;">操作记录</h4>';
            if (data.data.operations.length) {
                data.data.operations.forEach(op => {
                    html += `<div class="history-item">
                        <div><strong>${this.getOperationTypeLabel(op.operation_type)}</strong></div>
                        <div style="color: #666; font-size: 0.8rem;">${new Date(op.created_at).toLocaleString()}</div>
                        ${op.reason ? `<div style="margin-top: 0.25rem;">原因: ${this.escapeHtml(op.reason)}</div>` : ''}
                    </div>`;
                });
            } else {
                html += '<p style="color: #999;">无</p>';
            }
            
            this.openModal('版本详情', html, '');
        } catch (e) {
            this.showToast('加载失败', 'error');
        }
    },

    async rollbackToVersion(versionId) {
        if (!confirm('确认回滚到该版本？这会创建一个新的版本，而不是删除历史。')) return;
        
        let html = '<div class="form-group"><label for="rollback-reason">回滚原因</label>';
        html += '<textarea id="rollback-reason" class="form-control" rows="2" placeholder="请输入回滚原因..."></textarea>';
        html += '</div>';
        
        const footer = `<button class="primary-btn" onclick="app.doRollback(${versionId})">确认回滚</button>`;
        
        this.openModal('回滚版本', html, footer);
    },

    async doRollback(versionId) {
        const reason = document.getElementById('rollback-reason').value;
        
        try {
            const res = await fetch(`${API_BASE}/api/history/versions/${versionId}/rollback`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reason: reason || undefined })
            });
            const data = await res.json();
            
            if (data.success) {
                this.showToast('回滚成功', 'success');
                this.closeModal();
                this.loadVersions();
                this.loadDashboard();
            } else {
                this.showToast(data.error || '回滚失败', 'error');
            }
        } catch (e) {
            this.showToast('回滚失败', 'error');
        }
    },

    openModal(title, body, footer) {
        document.getElementById('modal-title').textContent = title;
        document.getElementById('modal-body').innerHTML = body;
        document.getElementById('modal-footer').innerHTML = footer;
        document.getElementById('modal').style.display = 'flex';
    },

    closeModal() {
        document.getElementById('modal').style.display = 'none';
    },

    showToast(message, type='info') {
        const toast = document.createElement('div');
        toast.className = `toast ${type} show`;
        toast.textContent = message;
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => document.body.removeChild(toast), 300);
        }, 2000);
    },

    getVersionTypeLabel(type) {
        const map = {
            'import': '数据导入',
            'clustering': '自动聚类',
            'manual': '人工修正',
            'rollback': '版本回滚'
        };
        return map[type] || type || '未知';
    },

    getOperationTypeLabel(type) {
        const map = {
            'rule_assign': '规则匹配',
            'vector_assign': '向量聚类',
            'manual_move': '手动移动',
            'manual_create_and_move': '新建并移动',
            'cluster_update': '修改聚类',
            'rollback': '版本回滚',
            'unassign': '取消聚类'
        };
        return map[type] || type || '未知';
    },

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

document.addEventListener('DOMContentLoaded', () => app.init());
