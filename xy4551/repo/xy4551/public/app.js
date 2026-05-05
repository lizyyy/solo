const API_BASE = '';

let currentRiskData = null;
let currentNoteData = null;

document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    initFileInputs();
    loadAllData();
});

function initTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const tabName = btn.dataset.tab;
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
            });
            document.getElementById(`tab-${tabName}`).classList.add('active');
        });
    });
}

function initFileInputs() {
    const types = ['surgery', 'cage', 'oxygen', 'recovery', 'owner'];
    types.forEach(type => {
        const fileInput = document.getElementById(`file-${type}`);
        const btnImport = document.getElementById(`btn-import-${type}`);
        const fileNameSpan = document.getElementById(`filename-${type}`);

        if (fileInput) {
            fileInput.addEventListener('change', () => {
                if (fileInput.files.length > 0) {
                    fileNameSpan.textContent = fileInput.files[0].name;
                    btnImport.disabled = false;
                } else {
                    fileNameSpan.textContent = '';
                    btnImport.disabled = true;
                }
            });
        }
    });
}

async function loadAllData() {
    try {
        const response = await fetch(`${API_BASE}/api/data`);
        const data = await response.json();
        
        renderSurgeryTable(data.surgerySchedule || [], data.additionalNotes || {});
        renderCagesTable(data.postOpCages || [], data.additionalNotes || {});
        renderOxygenTable(data.oxygenLogs || [], data.additionalNotes || {});
        renderRecoveryTable(data.anesthesiaRecovery || [], data.additionalNotes || {});
        renderOwnerTable(data.ownerNotes || [], data.additionalNotes || {});
        
        await detectRisks();
        
    } catch (error) {
        console.error('加载数据失败:', error);
        showToast('加载数据失败', 'error');
    }
}

async function importData(dataType) {
    const fileInput = document.getElementById(`file-${dataType}`);
    const btnImport = document.getElementById(`btn-import-${dataType}`);
    const fileNameSpan = document.getElementById(`filename-${dataType}`);
    const statusDiv = document.getElementById('import-status');

    if (!fileInput.files.length) {
        showToast('请先选择文件', 'error');
        return;
    }

    const formData = new FormData();
    formData.append('file', fileInput.files[0]);
    formData.append('dataType', dataType);

    try {
        btnImport.disabled = true;
        btnImport.textContent = '导入中...';

        const response = await fetch(`${API_BASE}/api/data/import`, {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (result.success) {
            showToast(`成功导入 ${result.importedCount} 条记录`, 'success');
            
            fileInput.value = '';
            fileNameSpan.textContent = '';
            btnImport.disabled = true;
            btnImport.textContent = '导入';

            statusDiv.style.display = 'block';
            statusDiv.classList.remove('error');
            statusDiv.innerHTML = `✅ 导入成功: ${result.dataType} 类型，共 ${result.importedCount} 条记录`;

            await loadAllData();

            setTimeout(() => {
                statusDiv.style.display = 'none';
            }, 3000);
        } else {
            throw new Error(result.error || '导入失败');
        }

    } catch (error) {
        console.error('导入失败:', error);
        showToast(`导入失败: ${error.message}`, 'error');
        
        btnImport.disabled = false;
        btnImport.textContent = '导入';

        statusDiv.style.display = 'block';
        statusDiv.classList.add('error');
        statusDiv.innerHTML = `❌ 导入失败: ${error.message}`;
    }
}

async function detectRisks() {
    try {
        const dataResponse = await fetch(`${API_BASE}/api/data`);
        const data = await dataResponse.json();

        const riskResponse = await fetch(`${API_BASE}/api/risk/detect`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data })
        });

        const riskResult = await riskResponse.json();

        if (riskResult.success) {
            renderRiskList(riskResult.risks || [], riskResult.summary || {});
        }

    } catch (error) {
        console.error('风险检测失败:', error);
        showToast('风险检测失败', 'error');
    }
}

function renderRiskList(risks, summary) {
    const listDiv = document.getElementById('risk-list');
    
    document.getElementById('count-critical').textContent = summary.critical || 0;
    document.getElementById('count-warning').textContent = summary.warning || 0;
    document.getElementById('count-info').textContent = summary.info || 0;
    document.getElementById('count-dismissed').textContent = summary.dismissed || 0;

    if (!risks || risks.length === 0) {
        listDiv.innerHTML = `
            <div class="empty-state">
                <p>✨ 暂无风险检测结果，数据一切正常！</p>
                <button class="btn btn-primary" onclick="detectRisks()">重新检测</button>
            </div>
        `;
        return;
    }

    let html = '';
    risks.forEach(risk => {
        const severity = risk.effectiveSeverity || risk.severity;
        const isDismissed = severity === 'dismissed';
        
        html += `
            <div class="risk-item ${severity}">
                <div class="risk-item-header">
                    <div class="risk-item-title">
                        <span class="risk-badge ${severity}">${getSeverityLabel(severity)}</span>
                        ${risk.title}
                    </div>
                    <small>ID: ${risk.id}</small>
                </div>
                <p class="risk-item-description">${risk.description}</p>
                ${risk.details ? `
                <div class="risk-item-details">
                    <strong>详细信息：</strong>
                    <ul style="margin-top: 0.5rem; padding-left: 1.25rem;">
                        ${Object.entries(risk.details).map(([key, value]) => 
                            `<li><strong>${getDetailLabel(key)}</strong>: ${value}</li>`
                        ).join('')}
                    </ul>
                </div>
                ` : ''}
                ${risk.override ? `
                <div class="risk-item-details" style="background: #fff7e6; border-left: 3px solid #faad14;">
                    <strong>人工改判：</strong> ${getOverrideStatusLabel(risk.override.status)}
                    ${risk.override.overrideNote ? `<br><em>说明：${risk.override.overrideNote}</em>` : ''}
                </div>
                ` : ''}
                <div class="risk-item-actions">
                    <button class="btn btn-secondary" onclick="openOverrideModal('${risk.id}', '${risk.title}')">
                        人工改判
                    </button>
                    <button class="btn btn-secondary" onclick="addNoteToRisk('${risk.id}', '${risk.type}')">
                        添加备注
                    </button>
                </div>
            </div>
        `;
    });

    listDiv.innerHTML = html;
}

function getSeverityLabel(severity) {
    const labels = {
        'critical': '严重',
        'warning': '警告',
        'info': '提示',
        'dismissed': '已忽略'
    };
    return labels[severity] || severity;
}

function getDetailLabel(key) {
    const labels = {
        'cageNumber': '笼位号',
        'patientName': '宠物名',
        'patient1': '宠物1',
        'patient2': '宠物2',
        'time1': '时间1',
        'time2': '时间2',
        'time': '时间',
        'flowRate': '流量(L/min)',
        'gapMinutes': '间隔(分钟)',
        'previousTime': '上次记录',
        'currentTime': '当前记录',
        'surgeryEndTime': '手术结束时间',
        'elapsedMinutes': '已过(分钟)',
        'thresholdMinutes': '阈值(分钟)',
        'hasExtubation': '是否拔管',
        'hasFullRecovery': '是否完全苏醒',
        'extubationTime': '拔管时间',
        'postExtubMinutes': '拔管后(分钟)',
        'surgeryType': '手术类型',
        'hasSurgeryNotes': '是否有手术备注',
        'surgeryNotes': '手术备注',
        'ownerNotesCount': '主人备注数'
    };
    return labels[key] || key;
}

function getOverrideStatusLabel(status) {
    const labels = {
        'dismissed': '已忽略',
        'confirmed': '已确认',
        'resolved': '已解决'
    };
    return labels[status] || status;
}

function openOverrideModal(riskId, riskTitle) {
    currentRiskData = { id: riskId, title: riskTitle };
    
    const infoDiv = document.getElementById('override-risk-info');
    infoDiv.innerHTML = `
        <h4>风险信息</h4>
        <p><strong>ID:</strong> ${riskId}</p>
        <p><strong>标题:</strong> ${riskTitle}</p>
    `;
    
    document.getElementById('override-status').value = 'dismissed';
    document.getElementById('override-note').value = '';
    
    document.getElementById('override-modal').classList.add('active');
}

async function saveOverride() {
    if (!currentRiskData) return;

    const status = document.getElementById('override-status').value;
    const note = document.getElementById('override-note').value.trim();

    try {
        const response = await fetch(`${API_BASE}/api/data/override/${currentRiskData.id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status, overrideNote: note })
        });

        const result = await response.json();
        
        if (result.success) {
            showToast('改判已保存', 'success');
            closeModal('override-modal');
            await detectRisks();
        } else {
            throw new Error(result.error || '保存失败');
        }

    } catch (error) {
        console.error('保存改判失败:', error);
        showToast('保存失败: ' + error.message, 'error');
    }
}

function addNoteToRisk(riskId, riskType) {
    openNoteModal('risk', riskId, `风险记录 (${riskType})`);
}

function openNoteModal(recordType, recordId, recordInfo) {
    currentNoteData = { type: recordType, id: recordId };
    
    const infoDiv = document.getElementById('note-record-info');
    infoDiv.innerHTML = `
        <h4>记录信息</h4>
        <p><strong>类型:</strong> ${recordType}</p>
        <p><strong>ID:</strong> ${recordId}</p>
        <p><strong>详情:</strong> ${recordInfo}</p>
    `;
    
    document.getElementById('note-content').value = '';
    document.getElementById('note-modal').classList.add('active');
}

async function saveNote() {
    if (!currentNoteData) return;

    const note = document.getElementById('note-content').value.trim();
    
    if (!note) {
        showToast('请输入备注内容', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/api/data/note/${currentNoteData.type}/${currentNoteData.id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ note })
        });

        const result = await response.json();
        
        if (result.success) {
            showToast('备注已保存', 'success');
            closeModal('note-modal');
            await loadAllData();
        } else {
            throw new Error(result.error || '保存失败');
        }

    } catch (error) {
        console.error('保存备注失败:', error);
        showToast('保存失败: ' + error.message, 'error');
    }
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
    currentRiskData = null;
    currentNoteData = null;
}

async function deleteRecord(dataType, id) {
    if (!confirm('确定要删除这条记录吗？')) return;

    try {
        const response = await fetch(`${API_BASE}/api/data/record/${dataType}/${id}`, {
            method: 'DELETE'
        });

        const result = await response.json();
        
        if (result.success) {
            showToast('记录已删除', 'success');
            await loadAllData();
        } else {
            throw new Error(result.error || '删除失败');
        }

    } catch (error) {
        console.error('删除记录失败:', error);
        showToast('删除失败: ' + error.message, 'error');
    }
}

async function clearAllData() {
    if (!confirm('确定要清空所有数据吗？此操作不可恢复！')) return;

    try {
        const response = await fetch(`${API_BASE}/api/data/clear-all`, {
            method: 'DELETE'
        });

        const result = await response.json();
        
        if (result.success) {
            showToast('所有数据已清空', 'success');
            await loadAllData();
        } else {
            throw new Error(result.error || '清空失败');
        }

    } catch (error) {
        console.error('清空数据失败:', error);
        showToast('清空失败: ' + error.message, 'error');
    }
}

function renderSurgeryTable(data, additionalNotes) {
    const container = document.getElementById('surgery-table');
    if (!data || data.length === 0) {
        container.innerHTML = '<p style="padding: 2rem; text-align: center; color: #888;">暂无数据</p>';
        return;
    }

    let html = '<table><thead><tr><th>宠物名</th><th>手术类型</th><th>预约时间</th><th>主刀医生</th><th>备注</th><th>操作</th></tr></thead><tbody>';
    
    data.forEach(item => {
        const patientName = item.patientName || item.patient_name || item.宠物名 || '-';
        const surgeryType = item.surgeryType || item.surgery_type || item.手术类型 || '-';
        const scheduledTime = item.scheduledTime || item.scheduled_time || item.预约时间 || '-';
        const surgeon = item.surgeon || item.主刀医生 || '-';
        const notes = item.notes || item.备注 || '-';
        const hasAdditionalNote = additionalNotes[`surgery:${item.id}`];

        html += `
            <tr>
                <td>${patientName}</td>
                <td>${surgeryType}</td>
                <td>${scheduledTime}</td>
                <td>${surgeon}</td>
                <td>${notes}${hasAdditionalNote ? ' <span title="有补充备注" style="color: #faad14;">📝</span>' : ''}</td>
                <td>
                    <div class="table-actions">
                        <button class="action-btn" onclick="openNoteModal('surgery', '${item.id}', '${patientName} - ${surgeryType}')">备注</button>
                        <button class="action-btn delete" onclick="deleteRecord('surgery', '${item.id}')">删除</button>
                    </div>
                </td>
            </tr>
        `;
    });

    html += '</tbody></table>';
    container.innerHTML = html;
}

function renderCagesTable(data, additionalNotes) {
    const container = document.getElementById('cages-table');
    if (!data || data.length === 0) {
        container.innerHTML = '<p style="padding: 2rem; text-align: center; color: #888;">暂无数据</p>';
        return;
    }

    let html = '<table><thead><tr><th>笼位号</th><th>宠物名</th><th>入住时间</th><th>预计离开</th><th>状态</th><th>特殊需求</th><th>操作</th></tr></thead><tbody>';
    
    data.forEach(item => {
        const cageNumber = item.cageNumber || item.cage_number || item.笼位号 || '-';
        const patientName = item.patientName || item.patient_name || item.宠物名 || '-';
        const startTime = item.startTime || item.start_time || item.开始时间 || item.入住时间 || '-';
        const endTime = item.endTime || item.end_time || item.预计离开时间 || '-';
        const status = item.status || item.状态 || '住院中';
        const specialNeeds = item.specialNeeds || item.special_needs || item.特殊需求 || '-';
        const hasAdditionalNote = additionalNotes[`cage:${item.id}`];

        html += `
            <tr>
                <td>${cageNumber}</td>
                <td>${patientName}</td>
                <td>${startTime}</td>
                <td>${endTime}</td>
                <td>${status}</td>
                <td>${specialNeeds}${hasAdditionalNote ? ' <span title="有补充备注" style="color: #faad14;">📝</span>' : ''}</td>
                <td>
                    <div class="table-actions">
                        <button class="action-btn" onclick="openNoteModal('cage', '${item.id}', '笼位 ${cageNumber} - ${patientName}')">备注</button>
                        <button class="action-btn delete" onclick="deleteRecord('cage', '${item.id}')">删除</button>
                    </div>
                </td>
            </tr>
        `;
    });

    html += '</tbody></table>';
    container.innerHTML = html;
}

function renderOxygenTable(data, additionalNotes) {
    const container = document.getElementById('oxygen-table');
    if (!data || data.length === 0) {
        container.innerHTML = '<p style="padding: 2rem; text-align: center; color: #888;">暂无数据</p>';
        return;
    }

    let html = '<table><thead><tr><th>时间</th><th>宠物名</th><th>流量(L/min)</th><th>状态</th><th>操作人</th><th>备注</th><th>操作</th></tr></thead><tbody>';
    
    data.forEach(item => {
        const timestamp = item.timestamp || item.time || item.时间 || '-';
        const patientName = item.patientName || item.patient_name || item.宠物名 || '-';
        const flowRate = item.flowRate || item.flow_rate || item.流量 || '0';
        const status = item.status || item.状态 || '-';
        const operator = item.operator || item.操作人 || '-';
        const notes = item.notes || item.备注 || '-';
        const hasAdditionalNote = additionalNotes[`oxygen:${item.id}`];

        html += `
            <tr>
                <td>${timestamp}</td>
                <td>${patientName}</td>
                <td>${flowRate}</td>
                <td>${status}</td>
                <td>${operator}</td>
                <td>${notes}${hasAdditionalNote ? ' <span title="有补充备注" style="color: #faad14;">📝</span>' : ''}</td>
                <td>
                    <div class="table-actions">
                        <button class="action-btn" onclick="openNoteModal('oxygen', '${item.id}', '${patientName} - ${timestamp}')">备注</button>
                        <button class="action-btn delete" onclick="deleteRecord('oxygen', '${item.id}')">删除</button>
                    </div>
                </td>
            </tr>
        `;
    });

    html += '</tbody></table>';
    container.innerHTML = html;
}

function renderRecoveryTable(data, additionalNotes) {
    const container = document.getElementById('recovery-table');
    if (!data || data.length === 0) {
        container.innerHTML = '<p style="padding: 2rem; text-align: center; color: #888;">暂无数据</p>';
        return;
    }

    let html = '<table><thead><tr><th>宠物名</th><th>手术结束</th><th>拔管时间</th><th>完全苏醒</th><th>状态</th><th>苏醒评分</th><th>备注</th><th>操作</th></tr></thead><tbody>';
    
    data.forEach(item => {
        const patientName = item.patientName || item.patient_name || item.宠物名 || '-';
        const surgeryEndTime = item.surgeryEndTime || item.surgery_end_time || item.手术结束时间 || '-';
        const extubationTime = item.extubationTime || item.extubation_time || item.拔管时间 || '-';
        const fullRecoveryTime = item.fullRecoveryTime || item.full_recovery_time || item.完全苏醒时间 || '-';
        const status = item.status || item.状态 || '恢复中';
        const score = item.recoveryScore || item.recovery_score || item.苏醒评分 || '-';
        const notes = item.notes || item.备注 || '-';
        const hasAdditionalNote = additionalNotes[`recovery:${item.id}`];

        html += `
            <tr>
                <td>${patientName}</td>
                <td>${surgeryEndTime}</td>
                <td>${extubationTime}</td>
                <td>${fullRecoveryTime}</td>
                <td>${status}</td>
                <td>${score}</td>
                <td>${notes}${hasAdditionalNote ? ' <span title="有补充备注" style="color: #faad14;">📝</span>' : ''}</td>
                <td>
                    <div class="table-actions">
                        <button class="action-btn" onclick="openNoteModal('recovery', '${item.id}', '${patientName}')">备注</button>
                        <button class="action-btn delete" onclick="deleteRecord('recovery', '${item.id}')">删除</button>
                    </div>
                </td>
            </tr>
        `;
    });

    html += '</tbody></table>';
    container.innerHTML = html;
}

function renderOwnerTable(data, additionalNotes) {
    const container = document.getElementById('owner-table');
    if (!data || data.length === 0) {
        container.innerHTML = '<p style="padding: 2rem; text-align: center; color: #888;">暂无数据</p>';
        return;
    }

    let html = '<table><thead><tr><th>宠物名</th><th>主人姓名</th><th>联系电话</th><th>接送时间</th><th>交接内容</th><th>特殊说明</th><th>操作</th></tr></thead><tbody>';
    
    data.forEach(item => {
        const patientName = item.patientName || item.patient_name || item.宠物名 || '-';
        const ownerName = item.ownerName || item.owner_name || item.主人姓名 || '-';
        const phone = item.phone || item.联系电话 || '-';
        const pickupTime = item.pickupTime || item.pickup_time || item.接送时间 || '-';
        const handoverContent = item.handoverContent || item.handover_content || item.交接内容 || '-';
        const specialNotes = item.specialNotes || item.special_notes || item.特殊说明 || '-';
        const hasAdditionalNote = additionalNotes[`owner:${item.id}`];

        html += `
            <tr>
                <td>${patientName}</td>
                <td>${ownerName}</td>
                <td>${phone}</td>
                <td>${pickupTime}</td>
                <td>${handoverContent}</td>
                <td>${specialNotes}${hasAdditionalNote ? ' <span title="有补充备注" style="color: #faad14;">📝</span>' : ''}</td>
                <td>
                    <div class="table-actions">
                        <button class="action-btn" onclick="openNoteModal('owner', '${item.id}', '${patientName} - ${ownerName}')">备注</button>
                        <button class="action-btn delete" onclick="deleteRecord('owner', '${item.id}')">删除</button>
                    </div>
                </td>
            </tr>
        `;
    });

    html += '</tbody></table>';
    container.innerHTML = html;
}

function exportMarkdown() {
    window.open(`${API_BASE}/api/export/markdown`, '_blank');
}

function exportJSON() {
    window.open(`${API_BASE}/api/export/json`, '_blank');
}

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
        e.target.classList.remove('active');
        currentRiskData = null;
        currentNoteData = null;
    }
});
