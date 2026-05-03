const API_BASE = '/api';

let appState = {
    uploadedComplaints: null,
    uploadedWorkOrders: null,
    uploadedKeywords: null,
    clusters: [],
    selectedClusterId: null,
    multipleSelectMode: false,
    selectedClusterIds: new Set(),
    currentSessionId: null,
    statistics: null
};

const elements = {
    complaintsUpload: document.getElementById('complaintsUpload'),
    complaintsFile: document.getElementById('complaintsFile'),
    complaintsStatus: document.getElementById('complaintsStatus'),
    
    workordersUpload: document.getElementById('workordersUpload'),
    workordersFile: document.getElementById('workordersFile'),
    workordersStatus: document.getElementById('workordersStatus'),
    
    keywordsUpload: document.getElementById('keywordsUpload'),
    keywordsFile: document.getElementById('keywordsFile'),
    keywordsStatus: document.getElementById('keywordsStatus'),
    
    runClusterBtn: document.getElementById('runClusterBtn'),
    
    totalClusters: document.getElementById('totalClusters'),
    totalComplaints: document.getElementById('totalComplaints'),
    urgentCount: document.getElementById('urgentCount'),
    pendingCount: document.getElementById('pendingCount'),
    
    statusFilter: document.getElementById('statusFilter'),
    districtFilter: document.getElementById('districtFilter'),
    urgencyFilter: document.getElementById('urgencyFilter'),
    
    sessionList: document.getElementById('sessionList'),
    
    selectMultipleBtn: document.getElementById('selectMultipleBtn'),
    mergeSelectedBtn: document.getElementById('mergeSelectedBtn'),
    refreshBtn: document.getElementById('refreshBtn'),
    
    clusterList: document.getElementById('clusterList'),
    contentTitle: document.getElementById('contentTitle'),
    
    detailPanel: document.getElementById('detailPanel'),
    detailTitle: document.getElementById('detailTitle'),
    detailContent: document.getElementById('detailContent'),
    closeDetailBtn: document.getElementById('closeDetailBtn'),
    
    exportWeeklyBtn: document.getElementById('exportWeeklyBtn'),
    exportDispatchBtn: document.getElementById('exportDispatchBtn'),
    exportJsonBtn: document.getElementById('exportJsonBtn'),
    
    modalOverlay: document.getElementById('modalOverlay'),
    modal: document.getElementById('modal'),
    modalTitle: document.getElementById('modalTitle'),
    modalBody: document.getElementById('modalBody'),
    modalFooter: document.getElementById('modalFooter'),
    modalCloseBtn: document.getElementById('modalCloseBtn'),
    
    toastContainer: document.getElementById('toastContainer')
};

async function apiRequest(endpoint, options = {}) {
    const url = API_BASE + endpoint;
    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json'
        },
        ...options
    };

    try {
        const response = await fetch(url, defaultOptions);
        const data = await response.json();
        return data;
    } catch (error) {
        showToast('网络请求失败', 'error');
        throw error;
    }
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icons = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
    };
    
    toast.innerHTML = `
        <span class="toast-icon">${icons[type]}</span>
        <span class="toast-message">${message}</span>
    `;
    
    elements.toastContainer.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideIn 0.3s ease reverse';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function showModal(title, bodyContent, footerButtons = []) {
    elements.modalTitle.textContent = title;
    elements.modalBody.innerHTML = bodyContent;
    
    elements.modalFooter.innerHTML = '';
    footerButtons.forEach(btn => {
        const button = document.createElement('button');
        button.className = `btn ${btn.class || 'btn-outline'}`;
        button.textContent = btn.text;
        button.onclick = btn.onClick;
        elements.modalFooter.appendChild(button);
    });
    
    elements.modalOverlay.classList.add('open');
}

function hideModal() {
    elements.modalOverlay.classList.remove('open');
}

function initUploadHandlers() {
    elements.complaintsUpload.addEventListener('click', () => {
        elements.complaintsFile.click();
    });
    elements.complaintsFile.addEventListener('change', handleComplaintsUpload);
    
    elements.workordersUpload.addEventListener('click', () => {
        elements.workordersFile.click();
    });
    elements.workordersFile.addEventListener('change', handleWorkOrdersUpload);
    
    elements.keywordsUpload.addEventListener('click', () => {
        elements.keywordsFile.click();
    });
    elements.keywordsFile.addEventListener('change', handleKeywordsUpload);
}

async function handleComplaintsUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
        const response = await fetch(API_BASE + '/upload/complaints', {
            method: 'POST',
            body: formData
        });
        const data = await response.json();
        
        if (data.success) {
            appState.uploadedComplaints = data.data;
            elements.complaintsStatus.textContent = `已上传 ${data.data.count} 条`;
            elements.complaintsUpload.classList.add('uploaded');
            showToast(data.message, 'success');
            updateRunButton();
        } else {
            showToast(data.message, 'error');
        }
    } catch (error) {
        showToast('上传失败', 'error');
    }
}

async function handleWorkOrdersUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
        const response = await fetch(API_BASE + '/upload/workorders', {
            method: 'POST',
            body: formData
        });
        const data = await response.json();
        
        if (data.success) {
            appState.uploadedWorkOrders = data.data;
            elements.workordersStatus.textContent = `已上传 ${data.data.count} 条`;
            elements.workordersUpload.classList.add('uploaded');
            showToast(data.message, 'success');
        } else {
            showToast(data.message, 'error');
        }
    } catch (error) {
        showToast('上传失败', 'error');
    }
}

async function handleKeywordsUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
        const response = await fetch(API_BASE + '/upload/keywords', {
            method: 'POST',
            body: formData
        });
        const data = await response.json();
        
        if (data.success) {
            appState.uploadedKeywords = data.data;
            elements.keywordsStatus.textContent = `已上传 ${data.data.keywords_count} 个关键词`;
            elements.keywordsUpload.classList.add('uploaded');
            showToast(data.message, 'success');
        } else {
            showToast(data.message, 'error');
        }
    } catch (error) {
        showToast('上传失败', 'error');
    }
}

function updateRunButton() {
    if (appState.uploadedComplaints && appState.uploadedComplaints.count > 0) {
        elements.runClusterBtn.disabled = false;
    } else {
        elements.runClusterBtn.disabled = true;
    }
}

async function runClustering() {
    if (!appState.uploadedComplaints) {
        showToast('请先上传投诉数据', 'warning');
        return;
    }
    
    elements.runClusterBtn.disabled = true;
    elements.runClusterBtn.innerHTML = '<span class="loading"></span> 聚类分析中...';
    
    try {
        const response = await apiRequest('/cluster', {
            method: 'POST',
            body: JSON.stringify({
                complaints: appState.uploadedComplaints.sample,
                work_orders: appState.uploadedWorkOrders?.sample || [],
                street_keywords: {}
            })
        });
        
        if (response.success) {
            appState.clusters = response.data.clusters;
            appState.currentSessionId = response.data.session_id;
            appState.statistics = response.data.statistics;
            
            updateStatistics(response.data.statistics);
            updateDistrictFilter(response.data.clusters);
            renderClusterList(response.data.clusters);
            
            elements.exportWeeklyBtn.disabled = false;
            elements.exportDispatchBtn.disabled = false;
            elements.exportJsonBtn.disabled = false;
            
            showToast(response.message, 'success');
        } else {
            showToast(response.message, 'error');
        }
    } catch (error) {
        showToast('聚类分析失败', 'error');
    } finally {
        elements.runClusterBtn.disabled = false;
        elements.runClusterBtn.innerHTML = '🔍 开始聚类分析';
    }
}

function updateStatistics(stats) {
    elements.totalClusters.textContent = stats.total_clusters || '-';
    elements.totalComplaints.textContent = stats.total_complaints || '-';
    elements.urgentCount.textContent = stats.urgency_counts?.['紧急'] || 0;
    elements.pendingCount.textContent = stats.pending_count || 0;
}

function updateDistrictFilter(clusters) {
    const districts = new Set();
    clusters.forEach(c => {
        if (c.district) districts.add(c.district);
    });
    
    elements.districtFilter.innerHTML = '<option value="">全部街道</option>';
    districts.forEach(d => {
        const option = document.createElement('option');
        option.value = d;
        option.textContent = d;
        elements.districtFilter.appendChild(option);
    });
}

function renderClusterList(clusters) {
    if (!clusters || clusters.length === 0) {
        elements.clusterList.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📂</div>
                <h3>暂无数据</h3>
                <p>请上传投诉数据并运行聚类分析</p>
            </div>
        `;
        return;
    }
    
    elements.clusterList.innerHTML = clusters.map((cluster, index) => {
        const urgencyClass = cluster.urgency_level === '紧急' ? 'badge-urgent' : 
                            cluster.urgency_level === '高' ? 'badge-high' : 'badge-normal';
        
        const statusClass = getStatusBadgeClass(cluster.status);
        
        const similarityClass = cluster.similarity_score >= 0.8 ? 'high' : 
                               cluster.similarity_score >= 0.65 ? 'medium' : 'low';
        
        const isSelected = appState.selectedClusterId === cluster.cluster_id;
        const isMultipleSelected = appState.selectedClusterIds.has(cluster.cluster_id);
        
        const cardClass = [
            'cluster-card',
            isSelected ? 'selected' : '',
            isMultipleSelected ? 'multiple-selected' : ''
        ].filter(Boolean).join(' ');
        
        const checkbox = appState.multipleSelectMode ? `
            <input type="checkbox" class="select-checkbox" 
                   data-cluster-id="${cluster.cluster_id}"
                   ${isMultipleSelected ? 'checked' : ''}>
        ` : '';
        
        return `
            <div class="${cardClass}" data-cluster-id="${cluster.cluster_id}" data-index="${index}">
                ${checkbox}
                <div class="cluster-card-content">
                    <div class="cluster-header">
                        <span class="cluster-id">${cluster.cluster_id}</span>
                        <div class="cluster-badges">
                            <span class="badge badge-count">${cluster.count} 条</span>
                            <span class="badge ${urgencyClass}">${cluster.urgency_level}</span>
                            <span class="badge ${statusClass}">${getStatusDisplay(cluster.status)}</span>
                        </div>
                    </div>
                    <div class="cluster-summary">${cluster.representative_summary}</div>
                    <div class="cluster-meta">
                        <div class="cluster-meta-item">
                            <span>📍</span>
                            <span>${cluster.district || '未知'}</span>
                        </div>
                        <div class="cluster-meta-item">
                            <span>📊</span>
                            <span>置信度: ${(cluster.similarity_score * 100).toFixed(1)}%</span>
                        </div>
                    </div>
                    <div class="similarity-bar">
                        <div class="similarity-fill ${similarityClass}" 
                             style="width: ${cluster.similarity_score * 100}%"></div>
                    </div>
                    ${cluster.keywords && cluster.keywords.length > 0 ? `
                        <div class="cluster-keywords">
                            ${cluster.keywords.slice(0, 5).map(kw => 
                                `<span class="keyword-tag">${kw}</span>`
                            ).join('')}
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');
    
    bindClusterEvents();
}

function getStatusBadgeClass(status) {
    const map = {
        'pending_review': 'badge-status-pending',
        'reviewing': 'badge-status-reviewing',
        'confirmed': 'badge-status-confirmed',
        'assigned': 'badge-status-assigned',
        'need_split': 'badge-status-pending',
        'need_merge': 'badge-status-pending'
    };
    return map[status] || 'badge-normal';
}

function getStatusDisplay(status) {
    const map = {
        'pending_review': '待复核',
        'reviewing': '复核中',
        'confirmed': '已确认',
        'assigned': '已指派',
        'need_split': '需拆分',
        'need_merge': '需合并'
    };
    return map[status] || status;
}

function bindClusterEvents() {
    const cards = elements.clusterList.querySelectorAll('.cluster-card');
    
    cards.forEach(card => {
        card.addEventListener('click', (e) => {
            if (e.target.classList.contains('select-checkbox')) {
                return;
            }
            
            const clusterId = card.dataset.clusterId;
            
            if (appState.multipleSelectMode) {
                toggleMultipleSelect(clusterId);
            } else {
                selectCluster(clusterId);
            }
        });
        
        const checkbox = card.querySelector('.select-checkbox');
        if (checkbox) {
            checkbox.addEventListener('change', (e) => {
                e.stopPropagation();
                const clusterId = card.dataset.clusterId;
                toggleMultipleSelect(clusterId);
            });
        }
    });
}

function selectCluster(clusterId) {
    appState.selectedClusterId = clusterId;
    
    document.querySelectorAll('.cluster-card').forEach(card => {
        card.classList.remove('selected');
        if (card.dataset.clusterId === clusterId) {
            card.classList.add('selected');
        }
    });
    
    showClusterDetail(clusterId);
}

function toggleMultipleSelect(clusterId) {
    if (appState.selectedClusterIds.has(clusterId)) {
        appState.selectedClusterIds.delete(clusterId);
    } else {
        appState.selectedClusterIds.add(clusterId);
    }
    
    document.querySelectorAll('.cluster-card').forEach(card => {
        if (card.dataset.clusterId === clusterId) {
            card.classList.toggle('multiple-selected');
        }
    });
    
    updateMergeButton();
}

function updateMergeButton() {
    elements.mergeSelectedBtn.disabled = appState.selectedClusterIds.size < 2;
}

function showClusterDetail(clusterId) {
    const cluster = appState.clusters.find(c => c.cluster_id === clusterId);
    if (!cluster) return;
    
    elements.detailTitle.textContent = `${cluster.cluster_id} - 事件簇详情`;
    
    const similarityClass = cluster.similarity_score >= 0.8 ? 'high' : 
                           cluster.similarity_score >= 0.65 ? 'medium' : 'low';
    
    elements.detailContent.innerHTML = `
        <div class="detail-section">
            <h4>基本信息</h4>
            <div class="detail-item">
                <label>事件簇编号</label>
                <div class="detail-item-value">${cluster.cluster_id}</div>
            </div>
            <div class="detail-item">
                <label>投诉数量</label>
                <div class="detail-item-value">${cluster.count} 条</div>
            </div>
            <div class="detail-item">
                <label>所属街道</label>
                <div class="detail-item-value">${cluster.district || '未知'}</div>
            </div>
            <div class="detail-item">
                <label>紧急程度</label>
                <div class="detail-item-value">
                    <span class="badge ${cluster.urgency_level === '紧急' ? 'badge-urgent' : 'badge-normal'}">
                        ${cluster.urgency_level}
                    </span>
                </div>
            </div>
            <div class="detail-item">
                <label>当前状态</label>
                <div class="detail-item-value">
                    <span class="badge ${getStatusBadgeClass(cluster.status)}">
                        ${getStatusDisplay(cluster.status)}
                    </span>
                </div>
            </div>
        </div>
        
        <div class="detail-section">
            <h4>相似性分析</h4>
            <div class="detail-item">
                <label>置信度</label>
                <div class="detail-item-value">${(cluster.similarity_score * 100).toFixed(1)}%</div>
            </div>
            <div class="similarity-bar" style="margin: 12px 0;">
                <div class="similarity-fill ${similarityClass}" 
                     style="width: ${cluster.similarity_score * 100}%"></div>
            </div>
            <div class="detail-item">
                <label>相似原因</label>
                <div class="detail-item-value">
                    <ul style="list-style: disc; padding-left: 20px; margin-top: 8px;">
                        ${cluster.similar_reasons.map(r => `<li>${r}</li>`).join('')}
                    </ul>
                </div>
            </div>
            ${cluster.keywords && cluster.keywords.length > 0 ? `
                <div class="detail-item">
                    <label>关键词</label>
                    <div class="cluster-keywords" style="margin-top: 8px;">
                        ${cluster.keywords.map(kw => `<span class="keyword-tag">${kw}</span>`).join('')}
                    </div>
                </div>
            ` : ''}
        </div>
        
        <div class="detail-section">
            <h4>代表摘要</h4>
            <div class="detail-item-value" style="background: var(--bg-tertiary); padding: 12px; border-radius: var(--radius-md);">
                ${cluster.representative_summary}
            </div>
        </div>
        
        <div class="detail-section">
            <h4>投诉列表 (${cluster.complaint_ids.length} 条)</h4>
            <div class="complaint-list">
                ${cluster.complaints && cluster.complaints.length > 0 ? 
                    cluster.complaints.map((c, i) => `
                        <div class="complaint-item">
                            <div class="complaint-item-header">
                                <span class="complaint-id">${c.id || `#${i + 1}`}</span>
                                <span class="complaint-time">${c.call_time || '-'}</span>
                            </div>
                            <div class="complaint-summary">${c.summary || '-'}</div>
                        </div>
                    `).join('') : 
                    '<p class="empty-text">暂无详细数据</p>'
                }
            </div>
        </div>
        
        ${cluster.assigned_department ? `
            <div class="detail-section">
                <h4>派单信息</h4>
                <div class="detail-item">
                    <label>已指派部门</label>
                    <div class="detail-item-value">${cluster.assigned_department}</div>
                </div>
            </div>
        ` : ''}
        
        ${cluster.review_notes ? `
            <div class="detail-section">
                <h4>复核备注</h4>
                <div class="detail-item-value" style="white-space: pre-wrap; background: var(--bg-tertiary); padding: 12px; border-radius: var(--radius-md);">
                    ${cluster.review_notes}
                </div>
            </div>
        ` : ''}
        
        <div class="detail-actions">
            <div class="action-row">
                <button class="btn btn-outline btn-sm" onclick="showStatusChangeModal('${clusterId}')">
                    🔄 变更状态
                </button>
                <button class="btn btn-outline btn-sm" onclick="showAssignModal('${clusterId}')">
                    📋 指派部门
                </button>
            </div>
            <div class="action-row">
                <button class="btn btn-outline btn-sm" onclick="showNoteModal('${clusterId}')">
                    📝 添加备注
                </button>
                <button class="btn btn-warning btn-sm" onclick="showSplitModal('${clusterId}')">
                    ✂️ 拆分簇
                </button>
            </div>
        </div>
    `;
    
    elements.detailPanel.classList.add('open');
}

function showStatusChangeModal(clusterId) {
    const cluster = appState.clusters.find(c => c.cluster_id === clusterId);
    if (!cluster) return;
    
    const bodyContent = `
        <div class="form-group">
            <label>当前状态</label>
            <div style="padding: 10px; background: var(--bg-tertiary); border-radius: var(--radius-sm);">
                ${getStatusDisplay(cluster.status)}
            </div>
        </div>
        <div class="form-group">
            <label>选择新状态</label>
            <select id="newStatusSelect">
                <option value="pending_review">待复核</option>
                <option value="reviewing">复核中</option>
                <option value="confirmed">已确认</option>
                <option value="need_split">需拆分</option>
                <option value="need_merge">需合并</option>
            </select>
        </div>
    `;
    
    showModal('变更状态', bodyContent, [
        { text: '取消', class: 'btn-outline', onClick: hideModal },
        { text: '确认', class: 'btn-primary', onClick: async () => {
            const newStatus = document.getElementById('newStatusSelect').value;
            await updateClusterStatus(clusterId, newStatus);
            hideModal();
        }}
    ]);
}

async function updateClusterStatus(clusterId, newStatus) {
    try {
        const response = await apiRequest(`/clusters/${clusterId}/status`, {
            method: 'PUT',
            body: JSON.stringify({ status: newStatus })
        });
        
        if (response.success) {
            const cluster = appState.clusters.find(c => c.cluster_id === clusterId);
            if (cluster) cluster.status = newStatus;
            
            renderClusterList(appState.clusters);
            showClusterDetail(clusterId);
            showToast('状态已更新', 'success');
        } else {
            showToast(response.message, 'error');
        }
    } catch (error) {
        showToast('更新失败', 'error');
    }
}

function showAssignModal(clusterId) {
    const departments = [
        '物业管理部门', '交通管理部门', '环保部门', '环卫部门',
        '园林部门', '城管部门', '住建部门', '水务部门',
        '电力部门', '燃气公司', '质监部门', '消防部门',
        '公安部门', '司法所', '民政部门', '教育部门', '卫健部门'
    ];
    
    const bodyContent = `
        <div class="form-group">
            <label>选择责任部门</label>
            <select id="departmentSelect">
                <option value="">-- 请选择部门 --</option>
                ${departments.map(d => `<option value="${d}">${d}</option>`).join('')}
            </select>
        </div>
        <div class="form-group">
            <label>或输入其他部门</label>
            <input type="text" id="customDepartment" placeholder="请输入部门名称">
        </div>
    `;
    
    showModal('指派责任部门', bodyContent, [
        { text: '取消', class: 'btn-outline', onClick: hideModal },
        { text: '确认指派', class: 'btn-primary', onClick: async () => {
            const selectDept = document.getElementById('departmentSelect').value;
            const customDept = document.getElementById('customDepartment').value.trim();
            const department = customDept || selectDept;
            
            if (!department) {
                showToast('请选择或输入部门', 'warning');
                return;
            }
            
            await assignDepartment(clusterId, department);
            hideModal();
        }}
    ]);
}

async function assignDepartment(clusterId, department) {
    try {
        const response = await apiRequest(`/clusters/${clusterId}/assign`, {
            method: 'PUT',
            body: JSON.stringify({ department })
        });
        
        if (response.success) {
            const cluster = appState.clusters.find(c => c.cluster_id === clusterId);
            if (cluster) {
                cluster.assigned_department = department;
                cluster.status = 'assigned';
            }
            
            renderClusterList(appState.clusters);
            showClusterDetail(clusterId);
            showToast(`已指派给 ${department}`, 'success');
        } else {
            showToast(response.message, 'error');
        }
    } catch (error) {
        showToast('指派失败', 'error');
    }
}

function showNoteModal(clusterId) {
    const bodyContent = `
        <div class="form-group">
            <label>复核备注</label>
            <textarea id="noteTextarea" placeholder="请输入备注内容..."></textarea>
        </div>
    `;
    
    showModal('添加复核备注', bodyContent, [
        { text: '取消', class: 'btn-outline', onClick: hideModal },
        { text: '添加', class: 'btn-primary', onClick: async () => {
            const note = document.getElementById('noteTextarea').value.trim();
            if (!note) {
                showToast('请输入备注内容', 'warning');
                return;
            }
            await addReviewNote(clusterId, note);
            hideModal();
        }}
    ]);
}

async function addReviewNote(clusterId, note) {
    try {
        const response = await apiRequest(`/clusters/${clusterId}/notes`, {
            method: 'POST',
            body: JSON.stringify({ note })
        });
        
        if (response.success) {
            const cluster = appState.clusters.find(c => c.cluster_id === clusterId);
            if (cluster) {
                cluster.review_notes = response.data.review_notes;
            }
            
            showClusterDetail(clusterId);
            showToast('备注已添加', 'success');
        } else {
            showToast(response.message, 'error');
        }
    } catch (error) {
        showToast('添加失败', 'error');
    }
}

function showSplitModal(clusterId) {
    const cluster = appState.clusters.find(c => c.cluster_id === clusterId);
    if (!cluster || !cluster.complaints || cluster.complaints.length < 2) {
        showToast('该簇投诉数量不足，无法拆分', 'warning');
        return;
    }
    
    const bodyContent = `
        <div class="form-group">
            <label>选择要拆分的投诉</label>
            <div style="max-height: 300px; overflow-y: auto; border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 10px;">
                ${cluster.complaints.map((c, i) => `
                    <div style="padding: 8px; border-bottom: 1px solid var(--border-color); display: flex; align-items: center; gap: 10px;">
                        <input type="checkbox" class="split-checkbox" data-index="${i}" id="split-${i}">
                        <label for="split-${i}" style="flex: 1; cursor: pointer;">
                            <div style="font-weight: 500;">${c.id || `投诉 ${i + 1}`}</div>
                            <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">
                                ${(c.summary || '').substring(0, 50)}...
                            </div>
                        </label>
                    </div>
                `).join('')}
            </div>
            <p style="font-size: 12px; color: var(--text-muted); margin-top: 8px;">
                提示：选中的投诉将被拆分到新的事件簇中
            </p>
        </div>
    `;
    
    showModal('拆分事件簇', bodyContent, [
        { text: '取消', class: 'btn-outline', onClick: hideModal },
        { text: '确认拆分', class: 'btn-warning', onClick: async () => {
            const checkboxes = document.querySelectorAll('.split-checkbox:checked');
            const selectedIndices = Array.from(checkboxes).map(cb => parseInt(cb.dataset.index));
            
            if (selectedIndices.length === 0) {
                showToast('请至少选择一个投诉进行拆分', 'warning');
                return;
            }
            
            if (selectedIndices.length === cluster.complaints.length) {
                showToast('不能将所有投诉都拆分出去', 'warning');
                return;
            }
            
            await splitCluster(clusterId, selectedIndices);
            hideModal();
        }}
    ]);
}

async function splitCluster(clusterId, selectedIndices) {
    try {
        const cluster = appState.clusters.find(c => c.cluster_id === clusterId);
        const totalIndices = Array.from({ length: cluster.complaints.length }, (_, i) => i);
        const remainingIndices = totalIndices.filter(i => !selectedIndices.includes(i));
        
        const splitIndices = [remainingIndices, selectedIndices];
        
        const response = await apiRequest(`/clusters/${clusterId}/split`, {
            method: 'POST',
            body: JSON.stringify({ split_indices: splitIndices })
        });
        
        if (response.success) {
            showToast(`已拆分为 ${response.data.new_clusters_count} 个新簇`, 'success');
            await refreshClusters();
            elements.detailPanel.classList.remove('open');
        } else {
            showToast(response.message, 'error');
        }
    } catch (error) {
        showToast('拆分失败', 'error');
    }
}

async function mergeSelectedClusters() {
    if (appState.selectedClusterIds.size < 2) {
        showToast('请至少选择2个簇进行合并', 'warning');
        return;
    }
    
    const clusterIds = Array.from(appState.selectedClusterIds);
    
    try {
        const response = await apiRequest('/clusters/merge', {
            method: 'POST',
            body: JSON.stringify({ cluster_ids: clusterIds })
        });
        
        if (response.success) {
            showToast(`已合并为 ${response.data.new_cluster_id}`, 'success');
            appState.selectedClusterIds.clear();
            appState.multipleSelectMode = false;
            elements.selectMultipleBtn.textContent = '✅ 多选模式';
            document.body.classList.remove('multiselect-mode');
            updateMergeButton();
            await refreshClusters();
            elements.detailPanel.classList.remove('open');
        } else {
            showToast(response.message, 'error');
        }
    } catch (error) {
        showToast('合并失败', 'error');
    }
}

async function refreshClusters() {
    const params = new URLSearchParams();
    
    if (elements.statusFilter.value) {
        params.append('status', elements.statusFilter.value);
    }
    if (elements.districtFilter.value) {
        params.append('district', elements.districtFilter.value);
    }
    if (elements.urgencyFilter.value) {
        params.append('urgency', elements.urgencyFilter.value);
    }
    
    try {
        const response = await apiRequest(`/clusters?${params.toString()}`);
        
        if (response.success) {
            appState.clusters = response.data.clusters;
            renderClusterList(appState.clusters);
            elements.contentTitle.textContent = `事件簇列表 (${response.data.total})`;
        }
        
        const statsResponse = await apiRequest('/statistics');
        if (statsResponse.success) {
            appState.statistics = statsResponse.data;
            updateStatistics(statsResponse.data);
        }
    } catch (error) {
        showToast('刷新失败', 'error');
    }
}

function initExportHandlers() {
    elements.exportWeeklyBtn.addEventListener('click', () => {
        window.location.href = API_BASE + '/export/weekly-report';
    });
    
    elements.exportDispatchBtn.addEventListener('click', () => {
        window.location.href = API_BASE + '/export/dispatch-suggestions';
    });
    
    elements.exportJsonBtn.addEventListener('click', () => {
        window.location.href = API_BASE + '/export/clusters-json';
    });
}

function initFilterHandlers() {
    const filters = [elements.statusFilter, elements.districtFilter, elements.urgencyFilter];
    
    filters.forEach(filter => {
        filter.addEventListener('change', refreshClusters);
    });
}

function initButtonHandlers() {
    elements.runClusterBtn.addEventListener('click', runClustering);
    
    elements.closeDetailBtn.addEventListener('click', () => {
        elements.detailPanel.classList.remove('open');
        appState.selectedClusterId = null;
        document.querySelectorAll('.cluster-card').forEach(card => {
            card.classList.remove('selected');
        });
    });
    
    elements.refreshBtn.addEventListener('click', refreshClusters);
    
    elements.selectMultipleBtn.addEventListener('click', () => {
        appState.multipleSelectMode = !appState.multipleSelectMode;
        appState.selectedClusterIds.clear();
        
        if (appState.multipleSelectMode) {
            elements.selectMultipleBtn.textContent = '❌ 取消多选';
            document.body.classList.add('multiselect-mode');
        } else {
            elements.selectMultipleBtn.textContent = '✅ 多选模式';
            document.body.classList.remove('multiselect-mode');
        }
        
        updateMergeButton();
        renderClusterList(appState.clusters);
    });
    
    elements.mergeSelectedBtn.addEventListener('click', mergeSelectedClusters);
    
    elements.modalCloseBtn.addEventListener('click', hideModal);
    elements.modalOverlay.addEventListener('click', (e) => {
        if (e.target === elements.modalOverlay) {
            hideModal();
        }
    });
}

async function loadSessions() {
    try {
        const response = await apiRequest('/sessions');
        
        if (response.success && response.data.sessions.length > 0) {
            elements.sessionList.innerHTML = response.data.sessions.map(session => `
                <div class="session-item ${session.session_id === appState.currentSessionId ? 'active' : ''}" 
                     data-session-id="${session.session_id}">
                    <div class="session-id">${session.session_id}</div>
                    <div class="session-meta">
                        ${session.cluster_count} 个簇 | ${session.complaint_count} 条投诉
                    </div>
                </div>
            `).join('');
            
            document.querySelectorAll('.session-item').forEach(item => {
                item.addEventListener('click', async () => {
                    const sessionId = item.dataset.sessionId;
                    await loadSession(sessionId);
                });
            });
        } else {
            elements.sessionList.innerHTML = '<p class="empty-text">暂无历史会话</p>';
        }
    } catch (error) {
        console.error('Failed to load sessions:', error);
    }
}

async function loadSession(sessionId) {
    try {
        const response = await apiRequest(`/sessions/${sessionId}`);
        
        if (response.success) {
            appState.currentSessionId = sessionId;
            showToast('会话已加载', 'success');
            
            elements.exportWeeklyBtn.disabled = false;
            elements.exportDispatchBtn.disabled = false;
            elements.exportJsonBtn.disabled = false;
            
            await refreshClusters();
            await loadSessions();
        } else {
            showToast(response.message, 'error');
        }
    } catch (error) {
        showToast('加载会话失败', 'error');
    }
}

async function init() {
    initUploadHandlers();
    initExportHandlers();
    initFilterHandlers();
    initButtonHandlers();
    
    try {
        const healthResponse = await apiRequest('/health');
        if (healthResponse.success) {
            console.log('Backend connected');
        }
    } catch (error) {
        console.warn('Backend not available yet');
    }
    
    await loadSessions();
}

document.addEventListener('DOMContentLoaded', init);
