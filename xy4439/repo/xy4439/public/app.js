const API_BASE = '';

let currentDate = '';
let currentShiftType = '';
let allRisks = [];
let currentFilter = 'all';

document.addEventListener('DOMContentLoaded', () => {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('import-date').value = today;
    document.getElementById('review-date').value = today;

    loadShifts();
    initTabs();
    initUploadAreas();
    initButtons();
});

function initTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabName = btn.dataset.tab;
            
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
            });
            document.getElementById(`${tabName}-tab`).classList.add('active');

            if (tabName === 'shifts') {
                loadShifts();
            }
        });
    });
}

function initUploadAreas() {
    const uploadConfigs = [
        { area: 'welding-upload', file: 'welding-file', type: 'welding', status: 'welding-status' },
        { area: 'exhaust-upload', file: 'exhaust-file', type: 'exhaust', status: 'exhaust-status' },
        { area: 'schedule-upload', file: 'schedule-file', type: 'schedule', status: 'schedule-status' },
        { area: 'helmet-upload', file: 'helmet-file', type: 'helmet', status: 'helmet-status' }
    ];

    uploadConfigs.forEach(config => {
        const area = document.getElementById(config.area);
        const fileInput = document.getElementById(config.file);
        const statusEl = document.getElementById(config.status);

        area.addEventListener('click', () => fileInput.click());

        area.addEventListener('dragover', (e) => {
            e.preventDefault();
            area.classList.add('dragover');
        });

        area.addEventListener('dragleave', () => {
            area.classList.remove('dragover');
        });

        area.addEventListener('drop', (e) => {
            e.preventDefault();
            area.classList.remove('dragover');
            const files = e.dataTransfer.files;
            if (files.length > 0 && files[0].name.endsWith('.csv')) {
                fileInput.files = files;
                handleFileUpload(config.type, files[0], statusEl);
            } else {
                showToast('请上传 CSV 文件', 'error');
            }
        });

        fileInput.addEventListener('change', () => {
            if (fileInput.files.length > 0) {
                handleFileUpload(config.type, fileInput.files[0], statusEl);
            }
        });
    });
}

async function handleFileUpload(type, file, statusEl) {
    const date = document.getElementById('import-date').value;
    const shiftType = document.getElementById('import-shift').value;

    if (!date) {
        showToast('请选择日期', 'error');
        return;
    }

    statusEl.innerHTML = `<span style="color: #3498db;">上传中...</span>`;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('date', date);
    formData.append('shiftType', shiftType);

    const endpoints = {
        welding: '/api/upload/welding-records',
        exhaust: '/api/upload/exhaust-sensor',
        schedule: '/api/upload/employee-schedule',
        helmet: '/api/upload/helmet-inspection'
    };

    try {
        const response = await fetch(endpoints[type], {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (result.success) {
            statusEl.innerHTML = `<span style="color: #27ae60;">✅ ${result.message}</span>`;
            showToast(result.message, 'success');
        } else {
            statusEl.innerHTML = `<span style="color: #e74c3c;">❌ 上传失败</span>`;
            showToast(result.error || '上传失败', 'error');
        }
    } catch (error) {
        statusEl.innerHTML = `<span style="color: #e74c3c;">❌ 上传失败</span>`;
        showToast('上传失败: ' + error.message, 'error');
    }
}

function initButtons() {
    document.getElementById('analyze-btn').addEventListener('click', analyzeRisks);
    document.getElementById('clear-imports').addEventListener('click', clearImports);
    document.getElementById('load-risks-btn').addEventListener('click', loadRisks);
    document.getElementById('export-md-btn').addEventListener('click', exportMarkdown);
    document.getElementById('export-json-btn').addEventListener('click', exportJSON);

    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            renderRiskList();
        });
    });
}

async function loadShifts() {
    const shiftList = document.getElementById('shift-list');
    
    try {
        const response = await fetch(`${API_BASE}/api/shifts`);
        const shifts = await response.json();

        if (shifts.length === 0) {
            shiftList.innerHTML = `
                <div class="empty-state">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    <p>暂无班次数据</p>
                    <p class="upload-hint">请先导入数据创建新班次</p>
                </div>
            `;
            return;
        }

        shiftList.innerHTML = shifts.map(shift => `
            <div class="shift-card" data-date="${shift.date}" data-shift="${shift.shift_type}">
                <div class="date">${shift.date}</div>
                <div class="shift-type">${shift.shift_type}</div>
                <div class="created">创建于 ${new Date(shift.created_at).toLocaleString('zh-CN')}</div>
            </div>
        `).join('');

        document.querySelectorAll('.shift-card').forEach(card => {
            card.addEventListener('click', () => {
                const date = card.dataset.date;
                const shiftType = card.dataset.shift;
                
                document.getElementById('review-date').value = date;
                document.getElementById('review-shift').value = shiftType;
                
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                document.querySelector('.tab-btn[data-tab="review"]').classList.add('active');
                document.querySelectorAll('.tab-content').forEach(content => {
                    content.classList.remove('active');
                });
                document.getElementById('review-tab').classList.add('active');
                
                loadRisks();
            });
        });
    } catch (error) {
        showToast('加载班次列表失败: ' + error.message, 'error');
    }
}

async function analyzeRisks() {
    const date = document.getElementById('import-date').value;
    const shiftType = document.getElementById('import-shift').value;

    if (!date) {
        showToast('请选择日期', 'error');
        return;
    }

    showToast('正在分析风险，请稍候...', 'info');

    try {
        const response = await fetch(`${API_BASE}/api/shifts/${date}/${shiftType}/risks`);
        const result = await response.json();

        if (result.error) {
            showToast('分析失败: ' + result.error, 'error');
            return;
        }

        const total = result.summary.红色 + result.summary.黄色 + result.summary.绿色;
        showToast(`分析完成！共检测到 ${total} 个风险：红色 ${result.summary.红色}，黄色 ${result.summary.黄色}，绿色 ${result.summary.绿色}`, 'success');

        document.getElementById('review-date').value = date;
        document.getElementById('review-shift').value = shiftType;
        
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelector('.tab-btn[data-tab="review"]').classList.add('active');
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById('review-tab').classList.add('active');
        
        loadRisks();
    } catch (error) {
        showToast('分析失败: ' + error.message, 'error');
    }
}

function clearImports() {
    const statusElements = ['welding-status', 'exhaust-status', 'schedule-status', 'helmet-status'];
    statusElements.forEach(id => {
        document.getElementById(id).innerHTML = '';
    });

    const fileInputs = ['welding-file', 'exhaust-file', 'schedule-file', 'helmet-file'];
    fileInputs.forEach(id => {
        document.getElementById(id).value = '';
    });

    showToast('已清空本次导入状态', 'info');
}

async function loadRisks() {
    const date = document.getElementById('review-date').value;
    const shiftType = document.getElementById('review-shift').value;

    if (!date) {
        showToast('请选择日期', 'error');
        return;
    }

    currentDate = date;
    currentShiftType = shiftType;

    const loading = document.getElementById('loading');
    const riskSummary = document.getElementById('risk-summary');
    const riskList = document.getElementById('risk-list');
    const emptyRisks = document.getElementById('empty-risks');
    const exportSection = document.getElementById('export-section');

    loading.classList.add('show');
    riskSummary.style.display = 'none';
    riskList.innerHTML = '';
    emptyRisks.style.display = 'none';
    exportSection.style.display = 'none';

    try {
        const response = await fetch(`${API_BASE}/api/shifts/${date}/${shiftType}/risks`);
        const result = await response.json();

        loading.classList.remove('show');

        if (result.error) {
            showToast('加载失败: ' + result.error, 'error');
            return;
        }

        allRisks = result.risks;

        if (allRisks.length === 0) {
            emptyRisks.style.display = 'block';
            return;
        }

        document.getElementById('current-shift').textContent = `${date} ${shiftType}`;
        document.getElementById('total-risks').textContent = allRisks.length;
        document.getElementById('red-count').textContent = result.summary.红色;
        document.getElementById('yellow-count').textContent = result.summary.黄色;
        document.getElementById('green-count').textContent = result.summary.绿色;

        riskSummary.style.display = 'block';
        exportSection.style.display = 'flex';
        
        currentFilter = 'all';
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        document.querySelector('.filter-btn[data-filter="all"]').classList.add('active');
        renderRiskList();
    } catch (error) {
        loading.classList.remove('show');
        showToast('加载失败: ' + error.message, 'error');
    }
}

function renderRiskList() {
    const riskList = document.getElementById('risk-list');
    
    let filteredRisks = allRisks;
    if (currentFilter !== 'all') {
        const levelMap = { 'red': '红色', 'yellow': '黄色', 'green': '绿色' };
        filteredRisks = allRisks.filter(r => r.risk_level === levelMap[currentFilter]);
    }

    if (filteredRisks.length === 0) {
        riskList.innerHTML = `
            <div class="card empty-state">
                <p>当前筛选条件下无风险记录</p>
            </div>
        `;
        return;
    }

    riskList.innerHTML = filteredRisks.map((risk, index) => {
        const levelClass = risk.risk_level === '红色' ? 'red' : 
                           risk.risk_level === '黄色' ? 'yellow' : 'green';
        
        const statusClass = risk.review_status === 'resolved' ? 'status-resolved' :
                           risk.review_status === 'acknowledged' ? 'status-acknowledged' :
                           risk.review_status === 'rejected' ? 'status-rejected' : 'status-pending';

        const statusLabel = risk.review_status === 'resolved' ? '已解决' :
                           risk.review_status === 'acknowledged' ? '已确认' :
                           risk.review_status === 'rejected' ? '已驳回' : '待处理';

        return `
            <div class="risk-item" data-risk-id="${risk.id}">
                <div class="risk-header ${levelClass}" onclick="toggleRiskBody(${risk.id})">
                    <div>
                        <span class="risk-title">#${index + 1}</span>
                        <span class="risk-type">${risk.risk_type}</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 1rem;">
                        ${risk.latest_comment ? `<span class="status-badge ${statusClass}">${statusLabel}</span>` : ''}
                        <span>▼</span>
                    </div>
                </div>
                <div class="risk-body" id="risk-body-${risk.id}">
                    <div class="risk-detail">
                        <label>工位/员工：</label>
                        <span>${risk.station_id || risk.employee_name || '未知'}</span>
                    </div>
                    <div class="risk-detail">
                        <label>时间：</label>
                        <span>${risk.start_time ? new Date(risk.start_time).toLocaleString('zh-CN') : '未知'}</span>
                    </div>
                    ${risk.duration_seconds ? `
                    <div class="risk-detail">
                        <label>持续时间：</label>
                        <span>${Math.floor(risk.duration_seconds / 60)} 分钟</span>
                    </div>
                    ` : ''}
                    ${risk.smoke_level !== null ? `
                    <div class="risk-detail">
                        <label>烟尘浓度：</label>
                        <span>${risk.smoke_level.toFixed(1)} mg/m³</span>
                    </div>
                    ` : ''}
                    ${risk.exhaust_flow !== null ? `
                    <div class="risk-detail">
                        <label>排风流量：</label>
                        <span>${risk.exhaust_flow.toFixed(2)} m³/min</span>
                    </div>
                    ` : ''}
                    <div class="risk-detail">
                        <label>描述：</label>
                        <span>${risk.description}</span>
                    </div>

                    ${risk.latest_comment ? `
                    <div class="review-section">
                        <h4 style="margin-bottom: 0.5rem; color: #555;">复核记录</h4>
                        <div class="review-history">
                            <p><span class="reviewer">复核人：</span>${risk.reviewer || '未知'}</p>
                            <p><span class="reviewer">状态：</span><span class="status-badge ${statusClass}">${statusLabel}</span></p>
                            <p><span class="reviewer">备注：</span>${risk.latest_comment}</p>
                            <p class="time">${risk.reviewed_at ? new Date(risk.reviewed_at).toLocaleString('zh-CN') : ''}</p>
                        </div>
                    </div>
                    ` : ''}

                    <div class="review-section">
                        <h4 style="margin-bottom: 0.5rem; color: #555;">添加复核</h4>
                        <div class="form-group">
                            <label for="reviewer-${risk.id}">复核人</label>
                            <input type="text" id="reviewer-${risk.id}" placeholder="请输入复核人姓名">
                        </div>
                        <div class="form-group">
                            <label for="comment-${risk.id}">复核备注</label>
                            <textarea id="comment-${risk.id}" placeholder="请输入复核备注..."></textarea>
                        </div>
                        <div class="form-group">
                            <label>复核状态</label>
                            <select id="status-${risk.id}">
                                <option value="pending">待处理</option>
                                <option value="acknowledged">已确认</option>
                                <option value="resolved">已解决</option>
                                <option value="rejected">已驳回</option>
                            </select>
                        </div>
                        <button class="btn btn-primary" onclick="submitReview(${risk.id})">提交复核</button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function toggleRiskBody(riskId) {
    const body = document.getElementById(`risk-body-${riskId}`);
    body.classList.toggle('show');
}

async function submitReview(riskId) {
    const reviewer = document.getElementById(`reviewer-${riskId}`).value.trim();
    const comment = document.getElementById(`comment-${riskId}`).value.trim();
    const status = document.getElementById(`status-${riskId}`).value;

    if (!reviewer) {
        showToast('请输入复核人姓名', 'error');
        return;
    }

    if (!comment) {
        showToast('请输入复核备注', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/api/risks/${riskId}/review`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                reviewer,
                comment,
                status
            })
        });

        const result = await response.json();

        if (result.success) {
            showToast('复核提交成功', 'success');
            loadRisks();
        } else {
            showToast('提交失败: ' + result.error, 'error');
        }
    } catch (error) {
        showToast('提交失败: ' + error.message, 'error');
    }
}

function exportMarkdown() {
    if (!currentDate || !currentShiftType) {
        showToast('请先选择班次并加载风险', 'error');
        return;
    }

    const url = `${API_BASE}/api/shifts/${currentDate}/${currentShiftType}/export/markdown`;
    window.open(url, '_blank');
    showToast('正在导出 Markdown 交接单...', 'info');
}

function exportJSON() {
    if (!currentDate || !currentShiftType) {
        showToast('请先选择班次并加载风险', 'error');
        return;
    }

    const url = `${API_BASE}/api/shifts/${currentDate}/${currentShiftType}/export/json`;
    window.open(url, '_blank');
    showToast('正在导出 JSON 审计包...', 'info');
}

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}
