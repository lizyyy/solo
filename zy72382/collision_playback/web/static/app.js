let currentRecords = [];
let currentRecordId = null;
let filterPendingOnly = false;
const STATUS_LABELS = {
    normal: '✓ 正常',
    pending_review: '⚠ 待复核',
    reviewed: '✓ 已复核'
};

const SOURCE_LABELS = {
    original: '原始数据',
    manual_correction: '人工修正',
    photo_supplement: '照片补充'
};

const SOURCE_CLASSES = {
    original: 'source-original',
    manual_correction: 'source-manual',
    photo_supplement: 'source-photo'
};

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast show ${type}`;
    setTimeout(() => {
        toast.className = 'toast';
    }, 3000);
}

async function fetchData(url, options = {}) {
    try {
        const response = await fetch(url, options);
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || '请求失败');
        }
        return await response.json();
    } catch (error) {
        showToast(error.message, 'error');
        throw error;
    }
}

async function loadSummary() {
    try {
        const data = await fetchData('/api/summary');
        document.getElementById('total-count').textContent = data.total;
        document.getElementById('normal-count').textContent = data.normal;
        document.getElementById('pending-count').textContent = data.pending;
        document.getElementById('reviewed-count').textContent = data.reviewed;
        document.getElementById('photo-count').textContent = data.with_photos;
    } catch (e) {
        console.error('加载摘要失败', e);
    }
}

async function loadRecords() {
    try {
        const records = await fetchData('/api/details');
        currentRecords = records;
        renderRecords();
    } catch (e) {
        document.getElementById('records-list').innerHTML = '<div class="loading">加载失败，请刷新重试</div>';
    }
}

function renderRecords() {
    const listEl = document.getElementById('records-list');
    let records = [...currentRecords];

    if (filterPendingOnly) {
        records = records.filter(r => r.status === 'pending_review');
    }

    if (records.length === 0) {
        listEl.innerHTML = '<div class="empty-state"><p>暂无记录</p><p class="hint">点击"加载演示数据"开始</p></div>';
        return;
    }

    listEl.innerHTML = records.map(record => {
        const hasPendingCorrection = record.corrections.some(c => !c.reason);
        const statusClass = record.status === 'pending_review' ? 'pending' :
                           record.status === 'reviewed' ? 'reviewed' : 'normal';
        const selectedClass = currentRecordId === record.id ? 'selected' : '';
        const icons = [
            record.has_manual_correction ? '⚠️' : '',
            record.photos.length > 0 ? '📷' : '',
            hasPendingCorrection ? '🔴' : ''
        ].filter(Boolean).join(' ');

        return `
            <div class="record-item ${statusClass} ${selectedClass}" onclick="selectRecord(${record.id})">
                <div class="record-header">
                    <span class="sensor-no">${record.sensor_no} ${icons}</span>
                    <span class="status-badge status-${record.status}">${STATUS_LABELS[record.status]}</span>
                </div>
                <div class="record-meta">
                    <span>🕐 ${new Date(record.collision_time).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                    <span>⚡ <span class="momentum-value">${record.corrected_momentum?.toFixed(2) || '-'}</span></span>
                    <span>🔄 ${record.playbacks.length}次回放</span>
                </div>
            </div>
        `;
    }).join('');
}

async function selectRecord(recordId) {
    currentRecordId = recordId;
    renderRecords();
    await loadRecordDetail(recordId);
}

async function loadRecordDetail(recordId) {
    try {
        const record = await fetchData(`/api/records/${recordId}`);
        renderRecordDetail(record);
    } catch (e) {
        document.getElementById('detail-content').innerHTML = '<div class="empty-state">加载详情失败</div>';
    }
}

function renderRecordDetail(record) {
    document.getElementById('detail-sensor-no').textContent = `- ${record.sensor_no}`;

    const hasPendingCorrection = record.corrections.some(c => !c.reason);

    let html = `
        <div class="detail-content">
            <div class="info-grid">
                <div class="info-item">
                    <div class="info-label">碰撞时间</div>
                    <div class="info-value">${new Date(record.collision_time).toLocaleString('zh-CN')}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">状态</div>
                    <div class="info-value">${STATUS_LABELS[record.status]}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">小车质量</div>
                    <div class="info-value">${record.car_mass_kg} kg</div>
                </div>
                <div class="info-item">
                    <div class="info-label">碰撞速度</div>
                    <div class="info-value">${record.velocity_ms} m/s</div>
                </div>
                <div class="info-item">
                    <div class="info-label">摩擦系数</div>
                    <div class="info-value">${record.friction_coeff}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">碰撞效率</div>
                    <div class="info-value">${record.collision_efficiency}</div>
                </div>
            </div>

            <div class="result-box">
                <div class="result-row">
                    <span class="result-label">原始动量 (质量×速度)</span>
                    <span class="result-value">${record.raw_momentum.toFixed(4)} kg·m/s</span>
                </div>
                <div class="result-row">
                    <span class="result-label">修正动量 (原始×效率×(1-摩擦))</span>
                    <span class="result-value" style="color: #3498db;">${record.corrected_momentum?.toFixed(4) || '-'} kg·m/s</span>
                </div>
                <div class="result-row">
                    <span class="result-label">能量损失</span>
                    <span class="result-value" style="color: #e74c3c;">${(record.raw_momentum - (record.corrected_momentum || 0)).toFixed(4)}</span>
                </div>
            </div>
    `;

    if (record.corrections.length > 0) {
        html += `
            <h4>🔧 人工修正记录 (${record.corrections.length}条)</h4>
        `;
        record.corrections.forEach(corr => {
            const pendingClass = !corr.reason ? 'pending-reason' : '';
            const reasonText = corr.reason || '<span style="color: #e74c3c;">⚠ 未填写原因 - 待设备工程师复核</span>';
            html += `
                <div class="correction-item ${pendingClass}">
                    <div class="correction-meta">
                        ${new Date(corr.created_at).toLocaleString('zh-CN')} · ${corr.operator}
                    </div>
                    <div>
                        修改 <strong>${corr.field_name}</strong>:
                        <span class="correction-values">${corr.old_value} → ${corr.new_value}</span>
                    </div>
                    <div style="margin-top: 5px;">原因: ${reasonText}</div>
                </div>
            `;
        });
    }

    if (record.photos.length > 0) {
        html += `
            <h4>📷 工况照片 (${record.photos.length}张)</h4>
        `;
        record.photos.forEach(photo => {
            let extra = '';
            if (photo.extracted_friction_coeff !== null) {
                extra = `<div class="extracted-data">📊 从照片提取旧口径摩擦系数: <strong>${photo.extracted_friction_coeff}</strong></div>`;
            }
            html += `
                <div class="photo-item">
                    <div class="photo-meta">
                        ${new Date(photo.uploaded_at).toLocaleString('zh-CN')} · ${photo.uploader}
                    </div>
                    <div>📄 ${photo.photo_filename}</div>
                    ${photo.note ? `<div class="photo-note">备注: ${photo.note}</div>` : ''}
                    ${extra}
                </div>
            `;
        });
    }

    if (record.playbacks.length > 0) {
        html += `
            <h4>🔄 回放记录 (${record.playbacks.length}次)</h4>
            <table class="comparison-table">
                <thead>
                    <tr>
                        <th>次数</th>
                        <th>时间</th>
                        <th>来源</th>
                        <th>执行人</th>
                        <th>摩擦系数</th>
                        <th>动量结果</th>
                        <th>能量损失</th>
                    </tr>
                </thead>
                <tbody>
        `;
        [...record.playbacks].reverse().forEach((pb, idx) => {
            html += `
                <tr>
                    <td>第${idx + 1}次</td>
                    <td>${new Date(pb.run_time).toLocaleTimeString('zh-CN')}</td>
                    <td><span class="playback-source ${SOURCE_CLASSES[pb.source]}">${SOURCE_LABELS[pb.source]}</span></td>
                    <td>${pb.run_by}</td>
                    <td>${pb.parameters_used.friction_coeff}</td>
                    <td><strong>${pb.result_momentum.toFixed(4)}</strong></td>
                    <td>${pb.result_energy_loss.toFixed(4)}</td>
                </tr>
            `;
        });
        html += `
                </tbody>
            </table>
        `;
    }

    if (record.notes) {
        html += `
            <h4>📝 备注</h4>
            <div style="background: #f8f9fa; padding: 12px; border-radius: 6px;">
                ${record.notes}
            </div>
        `;
    }

    html += `
            <div class="detail-actions">
                <button class="btn btn-primary" onclick="runPlayback(${record.id})">🔄 重新回放</button>
                ${hasPendingCorrection ? `<button class="btn btn-success" onclick="reviewRecord(${record.id})">✓ 设备工程师复核</button>` : ''}
                <button class="btn btn-warning" onclick="showCorrectModal(${record.id})">🔧 人工修正</button>
                <button class="btn" onclick="showUploadModal(${record.id})">📷 上传照片</button>
            </div>
        </div>
    `;

    document.getElementById('detail-content').innerHTML = html;
}

async function loadDemoData() {
    if (!confirm('确定要加载演示数据吗？这会清空现有数据。')) return;

    try {
        showToast('正在加载演示数据...', 'info');
        await fetchData('/api/demo/load?clear_first=true', { method: 'POST' });
        showToast('演示数据加载成功！', 'success');
        await refreshData();
    } catch (e) {
        // 错误已在 fetchData 中处理
    }
}

async function refreshData() {
    await Promise.all([loadSummary(), loadRecords()]);
    if (currentRecordId) {
        await loadRecordDetail(currentRecordId);
    }
}

function togglePendingFilter() {
    filterPendingOnly = !filterPendingOnly;
    renderRecords();
    showToast(filterPendingOnly ? '只显示待复核记录' : '显示全部记录', 'info');
}

async function runPlayback(recordId) {
    try {
        const result = await fetchData(`/api/records/${recordId}/playback`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: 'run_by=老岑'
        });
        showToast('回放完成！动量 = ' + result.corrected_momentum, 'success');
        await refreshData();
    } catch (e) {}
}

async function reviewRecord(recordId) {
    if (!confirm('设备工程师确认复核通过吗？')) return;

    try {
        const result = await fetchData(`/api/records/${recordId}/review`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: 'reviewer=设备工程师'
        });
        showToast(result.message, 'success');
        await refreshData();
    } catch (e) {}
}

function showCorrectModal(recordId) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay show';
    modal.innerHTML = `
        <div class="modal">
            <h3>🔧 人工修正参数</h3>
            <div class="form-group">
                <label>修改字段</label>
                <select id="correct-field">
                    <option value="friction_coeff">摩擦系数</option>
                    <option value="collision_efficiency">碰撞效率</option>
                    <option value="car_mass_kg">小车质量</option>
                    <option value="velocity_ms">碰撞速度</option>
                </select>
            </div>
            <div class="form-group">
                <label>新值</label>
                <input type="number" id="correct-value" step="0.01" placeholder="输入新值">
            </div>
            <div class="form-group">
                <label>操作人</label>
                <input type="text" id="correct-operator" value="老岑">
            </div>
            <div class="form-group">
                <label>修正原因 <span style="color: #e74c3c;">(不填则标记为待复核)</span></label>
                <textarea id="correct-reason" rows="3" placeholder="请填写修正原因..."></textarea>
            </div>
            <div class="modal-actions">
                <button class="btn" onclick="this.closest('.modal-overlay').remove()">取消</button>
                <button class="btn btn-primary" onclick="submitCorrection(${recordId})">确认修改</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    modal.onclick = (e) => {
        if (e.target === modal) modal.remove();
    };
}

async function submitCorrection(recordId) {
    const field = document.getElementById('correct-field').value;
    const value = parseFloat(document.getElementById('correct-value').value);
    const operator = document.getElementById('correct-operator').value;
    const reason = document.getElementById('correct-reason').value.trim() || null;

    if (isNaN(value)) {
        showToast('请输入有效的数值', 'error');
        return;
    }

    try {
        const body = new URLSearchParams();
        body.append('field_name', field);
        body.append('new_value', value);
        body.append('operator', operator);
        if (reason) body.append('reason', reason);

        const result = await fetchData(`/api/records/${recordId}/correct`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: body.toString()
        });
        showToast(result.message, result.status === 'pending_review' ? 'warning' : 'success');
        document.querySelector('.modal-overlay').remove();
        await refreshData();
    } catch (e) {}
}

function showUploadModal(recordId) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay show';
    modal.innerHTML = `
        <div class="modal">
            <h3>📷 上传工况照片</h3>
            <div class="form-group">
                <label>选择照片文件</label>
                <input type="file" id="upload-file" accept="image/*,.txt,.pdf">
            </div>
            <div class="form-group">
                <label>照片备注</label>
                <textarea id="upload-note" rows="2" placeholder="描述照片内容..."></textarea>
            </div>
            <div class="form-group">
                <label>从照片提取的摩擦系数(旧口径) <span style="color: #27ae60;">(填写后自动重放)</span></label>
                <input type="number" id="upload-friction" step="0.01" placeholder="例如: 0.08，不填则只存档">
            </div>
            <div class="form-group">
                <label>上传人</label>
                <input type="text" id="upload-uploader" value="老岑">
            </div>
            <div class="modal-actions">
                <button class="btn" onclick="this.closest('.modal-overlay').remove()">取消</button>
                <button class="btn btn-primary" onclick="submitPhoto(${recordId})">上传</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    modal.onclick = (e) => {
        if (e.target === modal) modal.remove();
    };
}

async function submitPhoto(recordId) {
    const fileInput = document.getElementById('upload-file');
    const note = document.getElementById('upload-note').value.trim();
    const friction = document.getElementById('upload-friction').value;
    const uploader = document.getElementById('upload-uploader').value;

    if (!fileInput.files[0]) {
        showToast('请选择文件', 'error');
        return;
    }

    try {
        const formData = new FormData();
        formData.append('file', fileInput.files[0]);
        if (note) formData.append('note', note);
        if (friction) formData.append('extracted_friction', friction);
        formData.append('uploader', uploader);

        const result = await fetchData(`/api/records/${recordId}/photo`, {
            method: 'POST',
            body: formData
        });
        showToast(result.message, result.playback_updated ? 'success' : 'info');
        document.querySelector('.modal-overlay').remove();
        await refreshData();
    } catch (e) {}
}

document.addEventListener('DOMContentLoaded', () => {
    refreshData();
});
