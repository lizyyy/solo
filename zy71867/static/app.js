const API_BASE = '/api';

let currentLectures = [];
let currentFilters = {};
let selectedLectureId = null;
let filterCriteria = null;

async function fetchFilterCriteria() {
    const response = await fetch(`${API_BASE}/filter-criteria`);
    filterCriteria = await response.json();
    
    const diffSelect = document.getElementById('filter-difficulty');
    filterCriteria.difficulty_tags.forEach(tag => {
        const option = document.createElement('option');
        option.value = tag;
        option.textContent = tag;
        diffSelect.appendChild(option);
    });
    
    const importDiffSelect = document.getElementById('import-difficulty');
    filterCriteria.difficulty_tags.forEach(tag => {
        const option = document.createElement('option');
        option.value = tag;
        option.textContent = tag;
        importDiffSelect.appendChild(option);
    });
    
    const reviseDiffSelect = document.getElementById('revise-difficulty');
    filterCriteria.difficulty_tags.forEach(tag => {
        const option = document.createElement('option');
        option.value = tag;
        option.textContent = tag;
        reviseDiffSelect.appendChild(option);
    });
}

async function fetchLectures(filters = {}) {
    const params = new URLSearchParams(filters);
    const response = await fetch(`${API_BASE}/lectures?${params}`);
    currentLectures = await response.json();
    renderLectureList();
    updateStats();
}

function renderLectureList() {
    const list = document.getElementById('lecture-list');
    
    if (currentLectures.length === 0) {
        list.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📄</div>
                <div>暂无讲义，点击"导入讲义"开始添加</div>
            </div>
        `;
        return;
    }
    
    list.innerHTML = currentLectures.map(lecture => {
        const isSelected = lecture.id === selectedLectureId;
        const isWithdrawn = lecture.status === 'withdrawn';
        
        let checkBadge = '';
        if (lecture.check_count === 0) {
            checkBadge = '<span class="badge badge-check pending">未检查</span>';
        } else if (lecture.latest_check_result === 'passed') {
            checkBadge = '<span class="badge badge-check">检查通过</span>';
        } else if (lecture.latest_check_result === 'failed') {
            checkBadge = '<span class="badge badge-check failed">检查不通过</span>';
        } else if (lecture.latest_check_result === 'not_applicable') {
            checkBadge = '<span class="badge badge-check pending">非切线题</span>';
        }
        
        const diffBadge = lecture.difficulty_tag 
            ? `<span class="badge badge-difficulty">${lecture.difficulty_tag}</span>`
            : '<span class="badge badge-difficulty missing">缺少难度</span>';
        
        const statusBadge = isWithdrawn
            ? '<span class="badge badge-status withdrawn">已撤回</span>'
            : '<span class="badge badge-status">正常</span>';
        
        const duplicateBadge = lecture.unresolved_duplicate_count > 0
            ? `<span class="badge badge-duplicate">有重复(${lecture.unresolved_duplicate_count})</span>`
            : '';
        
        const preview = lecture.commentary_count > 0 
            ? `<div class="lecture-preview">讲评记录(${lecture.commentary_count}条)</div>`
            : '';
        
        return `
            <div class="lecture-card ${isSelected ? 'selected' : ''} ${isWithdrawn ? 'withdrawn' : ''}" 
                 data-id="${lecture.id}" onclick="selectLecture('${lecture.id}')">
                <div class="lecture-header">
                    <div class="lecture-title">${lecture.title}</div>
                    <div class="lecture-badges">
                        ${statusBadge}
                        ${diffBadge}
                        ${checkBadge}
                        ${duplicateBadge}
                    </div>
                </div>
                <div class="lecture-meta">
                    <span>版本: v${lecture.version}</span>
                    <span>创建: ${formatTime(lecture.created_at)}</span>
                    <span>更新: ${formatTime(lecture.updated_at)}</span>
                </div>
                ${preview}
            </div>
        `;
    }).join('');
}

function updateStats() {
    const all = fetchAllLectures();
    document.getElementById('stat-total').textContent = currentLectures.length;
    document.getElementById('stat-missing').textContent = 
        currentLectures.filter(l => !l.difficulty_tag).length;
    document.getElementById('stat-duplicate').textContent = 
        currentLectures.filter(l => l.unresolved_duplicate_count > 0).length;
    document.getElementById('stat-failed').textContent = 
        currentLectures.filter(l => l.latest_check_result === 'failed').length;
}

async function fetchAllLectures() {
    const response = await fetch(`${API_BASE}/lectures`);
    return await response.json();
}

async function selectLecture(id) {
    selectedLectureId = id;
    renderLectureList();
    
    const response = await fetch(`${API_BASE}/lectures/${id}`);
    const data = await response.json();
    
    showLectureDetail(data);
}

function showLectureDetail(data) {
    const panel = document.getElementById('detail-panel');
    panel.classList.remove('hidden');
    
    document.getElementById('detail-title').textContent = data.lecture.title;
    
    const content = document.getElementById('detail-content');
    
    const screenshotHtml = data.lecture.screenshot_path 
        ? `<img src="/uploads/${data.lecture.screenshot_path.split('/').pop()}" 
                class="screenshot-preview" alt="讲义截图" onclick="window.open(this.src)">`
        : '<div style="color: #999; font-style: italic;">（未上传截图）</div>';
    
    const diffHtml = data.lecture.difficulty_tag 
        ? `<span class="badge badge-difficulty">${data.lecture.difficulty_tag}</span>
           ${data.lecture.difficulty_confirmed ? '<span style="color: #52c41a; font-size: 12px;">（已确认）</span>' : ''}`
        : '<span class="badge badge-difficulty missing">缺少难度标签</span>';
    
    const statusHtml = data.lecture.status === 'withdrawn'
        ? '<span class="badge badge-status withdrawn">已撤回</span>'
        : '<span class="badge badge-status">正常</span>';
    
    const actionButtons = data.lecture.status === 'active' ? `
        <div class="action-buttons">
            <button class="btn btn-primary" onclick="checkTangent('${data.lecture.id}')">切线检查</button>
            <button class="btn btn-secondary" onclick="openCommentaryModal('${data.lecture.id}')">添加讲评</button>
            <button class="btn btn-secondary" onclick="openReviseModal('${data.lecture.id}')">修正</button>
            <button class="btn btn-danger" onclick="openWithdrawModal('${data.lecture.id}')">撤回</button>
        </div>
    ` : '';
    
    const timelineHtml = data.timeline.map(item => {
        let extraClass = '';
        if (item.type === 'duplicate') extraClass = 'duplicate';
        if (item.type === 'check') {
            extraClass = item.data.result === 'passed' ? 'check-passed' : 
                        item.data.result === 'failed' ? 'check-failed' : '';
        }
        
        let contentHtml = '';
        if (item.type === 'lecture') {
            contentHtml = `标题：${item.data.title}<br>难度：${item.data.difficulty_tag || '（未设置）'}`;
        } else if (item.type === 'commentary') {
            contentHtml = `${item.data.teacher || '匿名'}：${item.data.content}`;
        } else if (item.type === 'check') {
            const statusText = {
                'passed': '✅ 通过',
                'failed': '❌ 未通过',
                'not_applicable': '⚠️ 不适用'
            }[item.data.result] || item.data.result;
            
            contentHtml = `
                <div style="margin-bottom: 8px;">
                    <strong>结果：${statusText}</strong>
                    <div class="confidence-bar">
                        <div class="confidence-fill" style="width: ${item.data.confidence * 100}%"></div>
                    </div>
                    <div style="font-size: 12px; color: #999;">置信度：${(item.data.confidence * 100).toFixed(0)}%</div>
                </div>
                <div class="timeline-content reasoning">${item.data.reasoning}</div>
                <div class="timeline-content next-step">${item.data.next_step}</div>
                ${!item.data.manual_confirm ? `
                    <div class="action-buttons">
                        <button class="btn btn-secondary" onclick="confirmCheck('${item.data.id}', '${data.lecture.id}', true)">确认</button>
                        <button class="btn btn-danger" onclick="confirmCheck('${item.data.id}', '${data.lecture.id}', false)">驳回</button>
                    </div>
                ` : `<div style="margin-top: 8px; color: #52c41a;">已人工确认（${item.data.confirmed_by || ''}）</div>`}
            `;
        } else if (item.type === 'audit') {
            const oldVal = item.data.old_value ? JSON.parse(item.data.old_value) : null;
            const newVal = item.data.new_value ? JSON.parse(item.data.new_value) : null;
            contentHtml = `
                操作人：${item.data.operator}<br>
                ${item.data.note || ''}
                ${oldVal ? `<br><span style="color: #999;">原值：${JSON.stringify(oldVal)}</span>` : ''}
                ${newVal ? `<br><span style="color: #1890ff;">新值：${JSON.stringify(newVal)}</span>` : ''}
            `;
        } else if (item.type === 'duplicate') {
            contentHtml = `类型：${item.data.duplicate_type}<br>${item.data.resolved ? '已解决' : '未解决'}`;
        }
        
        return `
            <div class="timeline-item ${extraClass}">
                <div class="timeline-time">${formatTime(item.time)}</div>
                <div class="timeline-title">${item.icon} ${item.title}</div>
                <div class="timeline-content">${contentHtml}</div>
            </div>
        `;
    }).join('');
    
    content.innerHTML = `
        <div class="detail-section">
            <h3>基本信息</h3>
            <div class="detail-info">
                <div class="detail-info-row">
                    <span class="detail-info-label">标题</span>
                    <span class="detail-info-value">${data.lecture.title}</span>
                </div>
                <div class="detail-info-row">
                    <span class="detail-info-label">难度</span>
                    <span class="detail-info-value">${diffHtml}</span>
                </div>
                <div class="detail-info-row">
                    <span class="detail-info-label">状态</span>
                    <span class="detail-info-value">${statusHtml}</span>
                </div>
                <div class="detail-info-row">
                    <span class="detail-info-label">版本</span>
                    <span class="detail-info-value">v${data.lecture.version}</span>
                </div>
                <div class="detail-info-row">
                    <span class="detail-info-label">创建</span>
                    <span class="detail-info-value">${formatTime(data.lecture.created_at)}</span>
                </div>
            </div>
            ${screenshotHtml}
            ${actionButtons}
        </div>
        
        <div class="detail-section">
            <h3>时间线</h3>
            <div class="timeline">
                ${timelineHtml}
            </div>
        </div>
    `;
}

async function checkTangent(lectureId) {
    try {
        const response = await fetch(`${API_BASE}/lectures/${lectureId}/check-tangent`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ operator: 'user' })
        });
        
        const result = await response.json();
        
        if (result.result === 'passed') {
            showToast('切线检查通过', 'success');
        } else if (result.result === 'failed') {
            showToast('发现问题，请查看检查结果', 'warning');
        } else {
            showToast('非切线类题目', 'warning');
        }
        
        await selectLecture(lectureId);
        await fetchLectures(currentFilters);
    } catch (e) {
        showToast('检查失败', 'error');
    }
}

async function confirmCheck(checkId, lectureId, isApproved) {
    try {
        await fetch(`${API_BASE}/checks/${checkId}/confirm`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                lecture_id: lectureId,
                is_approved: isApproved,
                operator: 'user'
            })
        });
        
        showToast(isApproved ? '已确认' : '已驳回', 'success');
        await selectLecture(lectureId);
        await fetchLectures(currentFilters);
    } catch (e) {
        showToast('操作失败', 'error');
    }
}

function openModal(id) {
    document.getElementById(id).classList.add('active');
}

function closeModal(id) {
    document.getElementById(id).classList.remove('active');
}

document.getElementById('btn-import').onclick = () => {
    document.getElementById('import-form').reset();
    document.getElementById('import-warnings').classList.remove('active');
    openModal('import-modal');
};

document.getElementById('btn-submit-import').onclick = async () => {
    const form = document.getElementById('import-form');
    const formData = new FormData(form);
    
    if (!formData.get('title').trim()) {
        showToast('请输入标题', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/lectures`, {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        const warningsDiv = document.getElementById('import-warnings');
        if (result.duplicates && result.duplicates.length > 0) {
            warningsDiv.innerHTML = result.duplicates.map(d => 
                `<div class="warning-item">⚠️ ${d.message}</div>`
            ).join('');
            warningsDiv.classList.add('active');
        }
        
        if (result.missing_difficulty) {
            const existingWarnings = warningsDiv.innerHTML;
            warningsDiv.innerHTML = existingWarnings + 
                '<div class="warning-item">⚠️ 未设置难度标签，建议补充</div>';
            warningsDiv.classList.add('active');
        }
        
        if (result.duplicates && result.duplicates.length > 0) {
            showToast('导入成功，但检测到重复或缺失信息', 'warning');
        } else {
            showToast('导入成功', 'success');
            closeModal('import-modal');
        }
        
        await fetchLectures(currentFilters);
        await selectLecture(result.lecture_id);
    } catch (e) {
        showToast('导入失败', 'error');
    }
};

function openCommentaryModal(lectureId) {
    document.getElementById('commentary-form').reset();
    document.getElementById('commentary-warnings').classList.remove('active');
    document.getElementById('commentary-modal').dataset.lectureId = lectureId;
    openModal('commentary-modal');
}

document.getElementById('btn-submit-commentary').onclick = async () => {
    const lectureId = document.getElementById('commentary-modal').dataset.lectureId;
    const content = document.getElementById('commentary-content').value.trim();
    const teacher = document.getElementById('commentary-teacher').value.trim();
    
    if (!content) {
        showToast('请输入讲评内容', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/lectures/${lectureId}/commentary`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content, teacher, operator: 'user' })
        });
        
        const result = await response.json();
        
        if (result.duplicates && result.duplicates.length > 0) {
            document.getElementById('commentary-warnings').innerHTML = 
                result.duplicates.map(d => `<div class="warning-item">⚠️ ${d.message}</div>`).join('');
            document.getElementById('commentary-warnings').classList.add('active');
            showToast('添加成功，但检测到内容重复', 'warning');
        } else {
            showToast('添加成功', 'success');
            closeModal('commentary-modal');
        }
        
        await fetchLectures(currentFilters);
        await selectLecture(lectureId);
    } catch (e) {
        showToast('添加失败', 'error');
    }
};

function openWithdrawModal(lectureId) {
    document.getElementById('withdraw-reason').value = '';
    document.getElementById('withdraw-modal').dataset.lectureId = lectureId;
    openModal('withdraw-modal');
}

document.getElementById('btn-submit-withdraw').onclick = async () => {
    const lectureId = document.getElementById('withdraw-modal').dataset.lectureId;
    const reason = document.getElementById('withdraw-reason').value.trim();
    
    if (!reason) {
        showToast('请输入撤回理由', 'error');
        return;
    }
    
    try {
        await fetch(`${API_BASE}/lectures/${lectureId}/withdraw`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason, operator: 'user' })
        });
        
        showToast('撤回成功', 'success');
        closeModal('withdraw-modal');
        await fetchLectures(currentFilters);
        await selectLecture(lectureId);
    } catch (e) {
        showToast('撤回失败', 'error');
    }
};

function openReviseModal(lectureId) {
    document.getElementById('revise-form').reset();
    document.getElementById('revise-modal').dataset.lectureId = lectureId;
    openModal('revise-modal');
}

document.getElementById('btn-submit-revise').onclick = async () => {
    const lectureId = document.getElementById('revise-modal').dataset.lectureId;
    const reason = document.getElementById('revise-reason').value.trim();
    const newTitle = document.getElementById('revise-title').value.trim();
    const newDifficulty = document.getElementById('revise-difficulty').value;
    
    if (!reason) {
        showToast('请输入修正理由', 'error');
        return;
    }
    
    if (!newTitle && !newDifficulty) {
        showToast('请至少填写一项修改内容', 'error');
        return;
    }
    
    try {
        await fetch(`${API_BASE}/lectures/${lectureId}/revise`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                new_title: newTitle || undefined,
                new_difficulty: newDifficulty || undefined,
                reason,
                operator: 'user'
            })
        });
        
        showToast('修正成功', 'success');
        closeModal('revise-modal');
        await fetchLectures(currentFilters);
        await selectLecture(lectureId);
    } catch (e) {
        showToast('修正失败', 'error');
    }
};

document.getElementById('btn-export').onclick = () => {
    document.getElementById('export-result').classList.remove('active');
    openModal('export-modal');
};

document.getElementById('btn-submit-export').onclick = async () => {
    const format = document.getElementById('export-format').value;
    const useFilter = document.getElementById('export-use-filter').checked;
    
    try {
        const response = await fetch(`${API_BASE}/export`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                filters: useFilter ? currentFilters : null,
                format,
                operator: 'user'
            })
        });
        
        const result = await response.json();
        
        const resultDiv = document.getElementById('export-result');
        resultDiv.innerHTML = `
            导出成功！共 ${result.record_count} 条记录<br>
            <a href="/api/export/${result.filename}" target="_blank">点击下载 ${result.filename}</a>
        `;
        resultDiv.classList.add('active');
        showToast(`导出成功，共${result.record_count}条记录`, 'success');
    } catch (e) {
        showToast('导出失败', 'error');
    }
};

document.getElementById('btn-check-all').onclick = async () => {
    if (!confirm('确定要对所有讲义执行批量切线检查吗？')) return;
    
    let count = 0;
    for (const lecture of currentLectures) {
        if (lecture.status === 'active') {
            try {
                await fetch(`${API_BASE}/lectures/${lecture.id}/check-tangent`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ operator: 'user' })
                });
                count++;
            } catch (e) {
                console.error('Check failed for', lecture.id);
            }
        }
    }
    
    showToast(`批量检查完成，共处理${count}个讲义`, 'success');
    await fetchLectures(currentFilters);
};

document.getElementById('btn-apply-filter').onclick = () => {
    currentFilters = {
        difficulty_tag: document.getElementById('filter-difficulty').value,
        status: document.getElementById('filter-status').value,
        has_check_result: document.getElementById('filter-check').value,
        has_duplicate: document.getElementById('filter-duplicate').value,
        missing_difficulty: document.getElementById('filter-missing-diff').value
    };
    
    Object.keys(currentFilters).forEach(key => {
        if (currentFilters[key] === 'all') delete currentFilters[key];
    });
    
    fetchLectures(currentFilters);
    showToast('筛选已应用', 'success');
};

document.getElementById('btn-reset-filter').onclick = () => {
    document.getElementById('filter-difficulty').value = 'all';
    document.getElementById('filter-status').value = 'all';
    document.getElementById('filter-check').value = 'all';
    document.getElementById('filter-duplicate').value = 'all';
    document.getElementById('filter-missing-diff').value = 'all';
    currentFilters = {};
    fetchLectures();
    showToast('筛选已重置', 'success');
};

document.getElementById('btn-close-detail').onclick = () => {
    document.getElementById('detail-panel').classList.add('hidden');
    selectedLectureId = null;
    renderLectureList();
};

function formatTime(isoString) {
    if (!isoString) return '';
    const d = new Date(isoString);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast show ${type}`;
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

async function init() {
    await fetchFilterCriteria();
    await fetchLectures();
}

init();
