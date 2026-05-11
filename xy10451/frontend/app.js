let currentDate = new Date().toISOString().split('T')[0];
let merchantsCache = [];
let resourcesCache = [];

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast show ${type}`;
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-CN');
}

function formatTime(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

function formatDateTime(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleString('zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function getStatusClass(status) {
    const statusMap = {
        'confirmed': 'status-confirmed',
        'completed': 'status-completed',
        'pending': 'status-pending',
        'reassigned': 'status-reassigned',
        'active': 'status-active',
        'inactive': 'status-inactive',
        'true': 'status-resolved',
        'false': 'status-unresolved'
    };
    return statusMap[status] || 'status-pending';
}

function getStatusText(status) {
    const statusMap = {
        'confirmed': '已确认',
        'completed': '已完成',
        'pending': '待处理',
        'reassigned': '已改派',
        'active': '启用',
        'inactive': '停用',
        'true': '已解决',
        'false': '未解决'
    };
    return statusMap[status] || status;
}

function initTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabName = btn.dataset.tab;

            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

            btn.classList.add('active');
            document.getElementById(`${tabName}-tab`).classList.add('active');

            loadTabData(tabName);
        });
    });
}

async function loadTabData(tabName) {
    switch (tabName) {
        case 'kanban':
            await loadKanban();
            break;
        case 'reservations':
            await loadReservations();
            break;
        case 'merchants':
            await loadMerchants();
            break;
        case 'resources':
            await loadResources();
            break;
        case 'faults':
            await loadFaults();
            break;
        case 'overtime':
            await loadOvertime();
            break;
        case 'fees':
            await loadFees();
            break;
    }
}

async function loadMerchants() {
    try {
        merchantsCache = await api.getMerchants();
        const table = document.getElementById('merchantsTable');

        if (merchantsCache.length === 0) {
            table.innerHTML = `<tr><td colspan="7" class="empty-state">
                <div class="empty-state-icon">👥</div>
                <div class="empty-state-text">暂无商户数据</div>
            </td></tr>`;
            return;
        }

        table.innerHTML = merchantsCache.map(m => `
            <tr>
                <td>${m.id}</td>
                <td><strong>${m.name}</strong></td>
                <td>${m.type || '-'}</td>
                <td>${m.contact || '-'}</td>
                <td>${m.phone || '-'}</td>
                <td><span class="status-badge ${getStatusClass(m.is_active ? 'active' : 'inactive')}">
                    ${getStatusText(m.is_active ? 'active' : 'inactive')}
                </span></td>
                <td class="actions-cell">
                    <button class="btn btn-sm btn-outline" onclick="editMerchant(${m.id})">编辑</button>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        showToast('加载商户失败: ' + error.message, 'error');
    }
}

async function loadResources() {
    try {
        resourcesCache = await api.getResources();
        const table = document.getElementById('resourcesTable');

        if (resourcesCache.length === 0) {
            table.innerHTML = `<tr><td colspan="7" class="empty-state">
                <div class="empty-state-icon">🔧</div>
                <div class="empty-state-text">暂无资源数据</div>
            </td></tr>`;
            return;
        }

        table.innerHTML = resourcesCache.map(r => `
            <tr>
                <td>${r.id}</td>
                <td><strong>${r.name}</strong></td>
                <td>${r.type || '-'}</td>
                <td>${r.location || '-'}</td>
                <td>${r.description || '-'}</td>
                <td><span class="status-badge ${getStatusClass(r.is_available ? 'active' : 'inactive')}">
                    ${r.is_available ? '可用' : '不可用'}
                </span></td>
                <td class="actions-cell">
                    <button class="btn btn-sm btn-outline" onclick="editResource(${r.id})">编辑</button>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        showToast('加载资源失败: ' + error.message, 'error');
    }
}

async function loadReservations() {
    try {
        const reservations = await api.getReservations();
        const table = document.getElementById('reservationsTable');

        if (merchantsCache.length === 0) {
            merchantsCache = await api.getMerchants();
        }
        if (resourcesCache.length === 0) {
            resourcesCache = await api.getResources();
        }

        if (reservations.length === 0) {
            table.innerHTML = `<tr><td colspan="8" class="empty-state">
                <div class="empty-state-icon">📝</div>
                <div class="empty-state-text">暂无预约数据</div>
            </td></tr>`;
            return;
        }

        const merchantMap = {};
        merchantsCache.forEach(m => merchantMap[m.id] = m.name);
        const resourceMap = {};
        resourcesCache.forEach(r => resourceMap[r.id] = r.name);

        table.innerHTML = reservations.map(r => `
            <tr>
                <td>${r.id}</td>
                <td>${merchantMap[r.merchant_id] || '未知'}</td>
                <td>${resourceMap[r.resource_id] || '未知'}</td>
                <td>${formatDate(r.date)}</td>
                <td>${formatTime(r.start_time)} - ${formatTime(r.end_time)}</td>
                <td><span class="status-badge ${getStatusClass(r.status)}">
                    ${getStatusText(r.status)}
                </span></td>
                <td>${r.has_conflict ? '<span style="color: #f12711;">⚠️ 冲突</span>' : '正常'}</td>
                <td class="actions-cell">
                    <button class="btn btn-sm btn-outline" onclick="editReservation(${r.id})">编辑</button>
                    <button class="btn btn-sm btn-warning" onclick="showReassignModal(${r.id})">改派</button>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        showToast('加载预约失败: ' + error.message, 'error');
    }
}

async function loadFaults() {
    try {
        const faults = await api.getFaults();
        const table = document.getElementById('faultsTable');

        if (resourcesCache.length === 0) {
            resourcesCache = await api.getResources();
        }

        if (faults.length === 0) {
            table.innerHTML = `<tr><td colspan="7" class="empty-state">
                <div class="empty-state-icon">✅</div>
                <div class="empty-state-text">暂无故障记录，设备运行正常</div>
            </td></tr>`;
            return;
        }

        const resourceMap = {};
        resourcesCache.forEach(r => resourceMap[r.id] = r.name);

        table.innerHTML = faults.map(f => `
            <tr>
                <td>${f.id}</td>
                <td>${resourceMap[f.resource_id] || '未知'}</td>
                <td>${formatDateTime(f.fault_time)}</td>
                <td>${f.fault_type || '-'}</td>
                <td>${f.description || '-'}</td>
                <td><span class="status-badge ${getStatusClass(f.is_resolved)}">
                    ${getStatusText(String(f.is_resolved))}
                </span></td>
                <td class="actions-cell">
                    ${!f.is_resolved ? `
                        <button class="btn btn-sm btn-success" onclick="resolveFault(${f.id})">标记已解决</button>
                    ` : '-'}
                </td>
            </tr>
        `).join('');
    } catch (error) {
        showToast('加载故障记录失败: ' + error.message, 'error');
    }
}

async function loadOvertime() {
    try {
        const overtimes = await api.getOvertimeRecords();
        const table = document.getElementById('overtimeTable');

        if (overtimes.length === 0) {
            table.innerHTML = `<tr><td colspan="8" class="empty-state">
                <div class="empty-state-icon">⏰</div>
                <div class="empty-state-text">暂无超时记录</div>
            </td></tr>`;
            return;
        }

        table.innerHTML = overtimes.map(o => `
            <tr>
                <td>${o.id}</td>
                <td>#${o.reservation_id}</td>
                <td>${formatDateTime(o.actual_end_time)}</td>
                <td>${o.overtime_minutes} 分钟</td>
                <td style="color: #f12711; font-weight: 600;">¥${o.overtime_fee.toFixed(2)}</td>
                <td>${o.affected_next_reservation_id ? '#' + o.affected_next_reservation_id : '无'}</td>
                <td><span class="status-badge ${getStatusClass(o.status)}">
                    ${getStatusText(o.status)}
                </span></td>
                <td class="actions-cell">
                    ${o.status === 'pending' ? `
                        <button class="btn btn-sm btn-success" onclick="settleOvertime(${o.id})">结算</button>
                    ` : '-'}
                </td>
            </tr>
        `).join('');
    } catch (error) {
        showToast('加载超时记录失败: ' + error.message, 'error');
    }
}

async function loadFees() {
    try {
        const fees = await api.getMerchantFees();
        const table = document.getElementById('feesTable');

        if (merchantsCache.length === 0) {
            merchantsCache = await api.getMerchants();
        }

        if (fees.length === 0) {
            table.innerHTML = `<tr><td colspan="7" class="empty-state">
                <div class="empty-state-icon">💰</div>
                <div class="empty-state-text">暂无费用记录</div>
            </td></tr>`;
            return;
        }

        const merchantMap = {};
        merchantsCache.forEach(m => merchantMap[m.id] = m.name);

        table.innerHTML = fees.map(f => `
            <tr>
                <td>${f.id}</td>
                <td>${merchantMap[f.merchant_id] || '未知'}</td>
                <td>${formatDate(f.date)}</td>
                <td>¥${f.reservation_fee.toFixed(2)}</td>
                <td style="color: #f12711;">¥${f.overtime_fee.toFixed(2)}</td>
                <td style="font-weight: 600; color: #667eea;">¥${f.total_fee.toFixed(2)}</td>
                <td>${f.note || '-'}</td>
            </tr>
        `).join('');
    } catch (error) {
        showToast('加载费用汇总失败: ' + error.message, 'error');
    }
}

async function loadKanban() {
    try {
        const data = await api.getKanban(currentDate);
        renderAlerts(data.conflicts);
        renderTimeline(data);
        renderFees(data.merchant_fees);
    } catch (error) {
        showToast('加载看板失败: ' + error.message, 'error');
    }
}

function renderAlerts(conflicts) {
    const panel = document.getElementById('alertsPanel');

    if (!conflicts || conflicts.length === 0) {
        panel.innerHTML = '';
        panel.classList.remove('has-alerts');
        return;
    }

    panel.classList.add('has-alerts');
    panel.innerHTML = conflicts.map(c => {
        if (c.type === 'fault_impact') {
            return `
                <div class="alert-item warning">
                    <div class="alert-title">⚠️ 设备故障影响: ${c.resource_name}</div>
                    <div class="alert-desc">
                        故障: ${c.fault_description}<br>
                        影响预约: ${c.affected_reservations.map(r => `${r.merchant_name} (${r.start_time}-${r.end_time})`).join('、')}
                    </div>
                </div>
            `;
        } else {
            return `
                <div class="alert-item">
                    <div class="alert-title">🚨 预约冲突: ${c.merchant_name} @ ${c.resource_name}</div>
                    <div class="alert-desc">
                        时间: ${c.start_time} - ${c.end_time}<br>
                        ${c.conflict_note || ''}
                    </div>
                </div>
            `;
        }
    }).join('');
}

function renderTimeline(data) {
    const timeline = document.getElementById('kanbanTimeline');
    const resources = data.resources || [];
    const timeSlots = data.time_slots || {};

    if (resources.length === 0) {
        timeline.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📅</div>
                <div class="empty-state-text">暂无资源数据，请先添加资源</div>
            </div>
        `;
        return;
    }

    let html = '<div class="timeline-header"><div></div>';
    for (let h = 0; h < 24; h++) {
        html += `<div class="timeline-hour">${h.toString().padStart(2, '0')}:00</div>`;
    }
    html += '</div>';

    const merchantColors = {};
    const colorPalette = [
        { bg: '#11998e', end: '#38ef7d' },
        { bg: '#4facfe', end: '#00f2fe' },
        { bg: '#667eea', end: '#764ba2' },
        { bg: '#f093fb', end: '#f5576c' },
        { bg: '#fa709a', end: '#fee140' },
        { bg: '#30cfd0', end: '#330867' }
    ];

    resources.forEach(resource => {
        const slots = timeSlots[resource.id] || [];
        html += `<div class="timeline-resource-row">
            <div class="resource-label ${!resource.is_available ? 'unavailable' : ''}">
                <div>${resource.name}</div>
                <div class="resource-type">${resource.type}</div>
            </div>
        `;

        for (let h = 0; h < 24; h++) {
            const hourStart = h;
            const hourEnd = h + 1;
            const slotInHour = slots.find(s => {
                const sHour = new Date(s.start_time).getHours();
                const eHour = new Date(s.end_time).getHours();
                return sHour <= h && eHour > h;
            });

            if (slotInHour) {
                const sHour = new Date(slotInHour.start_time).getHours();
                const sMin = new Date(slotInHour.start_time).getMinutes();
                const eHour = new Date(slotInHour.end_time).getHours();
                const eMin = new Date(slotInHour.end_time).getMinutes();

                if (sHour === h) {
                    if (!merchantColors[slotInHour.merchant_id]) {
                        const idx = Object.keys(merchantColors).length % colorPalette.length;
                        merchantColors[slotInHour.merchant_id] = colorPalette[idx];
                    }

                    const startOffset = (sMin / 60) * 100;
                    const durationHours = (eHour - sHour) + ((eMin - sMin) / 60);
                    const colSpan = Math.ceil(durationHours);
                    const widthPercent = (durationHours / colSpan) * 100;

                    const blockType = slotInHour.type || 'reservation';
                    let blockClass = 'block-confirmed';
                    let blockStyle = '';

                    if (blockType === 'cleaning') {
                        blockClass = 'block-cleaning';
                    } else if (slotInHour.status === 'completed') {
                        blockClass = 'block-completed';
                    } else if (slotInHour.status === 'reassigned') {
                        blockClass = 'block-reassigned';
                    } else if (slotInHour.has_conflict) {
                        blockClass = 'block-conflict';
                    } else if (slotInHour.merchant_id && merchantColors[slotInHour.merchant_id]) {
                        const color = merchantColors[slotInHour.merchant_id];
                        blockStyle = `background: linear-gradient(135deg, ${color.bg} 0%, ${color.end} 100%);`;
                        blockClass = '';
                    }

                    const merchantName = slotInHour.merchant_name || (blockType === 'cleaning' ? '清洁时间' : '');
                    const timeRange = `${formatTime(slotInHour.start_time)} - ${formatTime(slotInHour.end_time)}`;
                    const overtimeFee = slotInHour.overtime_fee ? `¥${slotInHour.overtime_fee}` : '';

                    html += `<div class="timeline-slot" style="grid-column: span ${colSpan}; position: relative;">
                        <div class="reservation-block ${blockClass} ${slotInHour.has_conflict ? 'conflict' : ''}"
                             style="${blockStyle} margin-left: ${startOffset}%; width: ${widthPercent}%;">
                            <div class="merchant-name">${merchantName}</div>
                            <div class="time-range">${timeRange}</div>
                            ${overtimeFee ? `<div class="overtime-badge">${overtimeFee}</div>` : ''}
                        </div>
                    </div>`;

                    h += colSpan - 1;
                    continue;
                }
            }

            html += `<div class="timeline-slot empty-slot"></div>`;
        }

        html += '</div>';
    });

    timeline.innerHTML = html;
}

function renderFees(fees) {
    const panel = document.getElementById('feesPanel');

    if (!fees || fees.length === 0) {
        panel.innerHTML = '<h3>💰 当日费用汇总</h3><p style="color: #999;">暂无当日费用数据</p>';
        return;
    }

    if (merchantsCache.length === 0) {
        api.getMerchants().then(m => {
            merchantsCache = m;
            renderFees(fees);
        });
        return;
    }

    const merchantMap = {};
    merchantsCache.forEach(m => merchantMap[m.id] = m.name);

    const totalAll = fees.reduce((sum, f) => sum + f.total_fee, 0);

    panel.innerHTML = `
        <h3>💰 当日费用汇总</h3>
        <div class="fees-grid">
            ${fees.map(f => `
                <div class="fee-card">
                    <div class="merchant-name">${merchantMap[f.merchant_id] || '未知商户'}</div>
                    <div class="fee-details"><span>预约费</span><span>¥${f.reservation_fee.toFixed(2)}</span></div>
                    <div class="fee-details"><span>超时费</span><span style="color: #f12711;">¥${f.overtime_fee.toFixed(2)}</span></div>
                    <div class="total-fee">总计: ¥${f.total_fee.toFixed(2)}</div>
                </div>
            `).join('')}
            <div class="fee-card" style="background: linear-gradient(135deg, #667eea15 0%, #764ba215 100%);">
                <div class="merchant-name" style="color: #667eea;">📊 当日总费用</div>
                <div class="total-fee" style="font-size: 20px;">¥${totalAll.toFixed(2)}</div>
            </div>
        </div>
    `;
}

function openModal(content) {
    document.getElementById('modalContent').innerHTML = content;
    document.getElementById('modalOverlay').classList.add('active');
}

function closeModal() {
    document.getElementById('modalOverlay').classList.remove('active');
}

function showMerchantForm(merchant = null) {
    const isEdit = merchant !== null;
    const title = isEdit ? '编辑商户' : '新建商户';

    openModal(`
        <div class="modal-header">
            <h3>${title}</h3>
            <button class="modal-close" onclick="closeModal()">&times;</button>
        </div>
        <form id="merchantForm">
            <div class="form-group">
                <label>商户名称 *</label>
                <input type="text" id="merchantName" value="${merchant?.name || ''}" required>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>类型</label>
                    <input type="text" id="merchantType" value="${merchant?.type || ''}" placeholder="如：早餐档、烘焙档">
                </div>
                <div class="form-group">
                    <label>联系人</label>
                    <input type="text" id="merchantContact" value="${merchant?.contact || ''}">
                </div>
            </div>
            <div class="form-group">
                <label>联系电话</label>
                <input type="tel" id="merchantPhone" value="${merchant?.phone || ''}">
            </div>
            ${isEdit ? `
            <div class="form-group">
                <label>状态</label>
                <select id="merchantStatus">
                    <option value="true" ${merchant?.is_active ? 'selected' : ''}>启用</option>
                    <option value="false" ${!merchant?.is_active ? 'selected' : ''}>停用</option>
                </select>
            </div>
            ` : ''}
            <div class="form-actions">
                <button type="button" class="btn btn-outline" onclick="closeModal()">取消</button>
                <button type="submit" class="btn btn-primary">${isEdit ? '保存' : '创建'}</button>
            </div>
        </form>
    `);

    document.getElementById('merchantForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            const data = {
                name: document.getElementById('merchantName').value,
                type: document.getElementById('merchantType').value || null,
                contact: document.getElementById('merchantContact').value || null,
                phone: document.getElementById('merchantPhone').value || null,
            };
            if (isEdit) {
                data.is_active = document.getElementById('merchantStatus').value === 'true';
                await api.updateMerchant(merchant.id, data);
            } else {
                await api.createMerchant(data);
            }
            closeModal();
            await loadMerchants();
            showToast(isEdit ? '商户已更新' : '商户已创建', 'success');
        } catch (error) {
            showToast('操作失败: ' + error.message, 'error');
        }
    });
}

function showResourceForm(resource = null) {
    const isEdit = resource !== null;
    const title = isEdit ? '编辑资源' : '新建资源';

    openModal(`
        <div class="modal-header">
            <h3>${title}</h3>
            <button class="modal-close" onclick="closeModal()">&times;</button>
        </div>
        <form id="resourceForm">
            <div class="form-row">
                <div class="form-group">
                    <label>资源名称 *</label>
                    <input type="text" id="resourceName" value="${resource?.name || ''}" required>
                </div>
                <div class="form-group">
                    <label>类型 *</label>
                    <select id="resourceType" required>
                        <option value="灶台" ${resource?.type === '灶台' ? 'selected' : ''}>灶台</option>
                        <option value="烤箱" ${resource?.type === '烤箱' ? 'selected' : ''}>烤箱</option>
                        <option value="冷库" ${resource?.type === '冷库' ? 'selected' : ''}>冷库</option>
                        <option value="其他" ${resource?.type === '其他' ? 'selected' : ''}>其他</option>
                    </select>
                </div>
            </div>
            <div class="form-group">
                <label>位置</label>
                <input type="text" id="resourceLocation" value="${resource?.location || ''}">
            </div>
            <div class="form-group">
                <label>描述</label>
                <textarea id="resourceDescription">${resource?.description || ''}</textarea>
            </div>
            ${isEdit ? `
            <div class="form-group">
                <label>可用状态</label>
                <select id="resourceAvailable">
                    <option value="true" ${resource?.is_available ? 'selected' : ''}>可用</option>
                    <option value="false" ${!resource?.is_available ? 'selected' : ''}>不可用</option>
                </select>
            </div>
            ` : ''}
            <div class="form-actions">
                <button type="button" class="btn btn-outline" onclick="closeModal()">取消</button>
                <button type="submit" class="btn btn-primary">${isEdit ? '保存' : '创建'}</button>
            </div>
        </form>
    `);

    document.getElementById('resourceForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            const data = {
                name: document.getElementById('resourceName').value,
                type: document.getElementById('resourceType').value,
                location: document.getElementById('resourceLocation').value || null,
                description: document.getElementById('resourceDescription').value || null,
            };
            if (isEdit) {
                data.is_available = document.getElementById('resourceAvailable').value === 'true';
                await api.updateResource(resource.id, data);
            } else {
                await api.createResource(data);
            }
            closeModal();
            await loadResources();
            showToast(isEdit ? '资源已更新' : '资源已创建', 'success');
        } catch (error) {
            showToast('操作失败: ' + error.message, 'error');
        }
    });
}

async function showReservationForm(reservation = null) {
    const isEdit = reservation !== null;
    const title = isEdit ? '编辑预约' : '新建预约';

    if (merchantsCache.length === 0) {
        merchantsCache = await api.getMerchants();
    }
    if (resourcesCache.length === 0) {
        resourcesCache = await api.getResources();
    }

    const today = new Date();
    const defaultDate = today.toISOString().split('T')[0];

    const startTime = reservation
        ? new Date(reservation.start_time).toISOString().slice(0, 16)
        : `${defaultDate}T08:00`;
    const endTime = reservation
        ? new Date(reservation.end_time).toISOString().slice(0, 16)
        : `${defaultDate}T10:00`;

    openModal(`
        <div class="modal-header">
            <h3>${title}</h3>
            <button class="modal-close" onclick="closeModal()">&times;</button>
        </div>
        <form id="reservationForm">
            <div class="form-row">
                <div class="form-group">
                    <label>商户 *</label>
                    <select id="reservationMerchant" required>
                        <option value="">请选择商户</option>
                        ${merchantsCache.map(m => `
                            <option value="${m.id}" ${reservation?.merchant_id === m.id ? 'selected' : ''}>
                                ${m.name}
                            </option>
                        `).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>资源 *</label>
                    <select id="reservationResource" required>
                        <option value="">请选择资源</option>
                        ${resourcesCache.map(r => `
                            <option value="${r.id}" ${reservation?.resource_id === r.id ? 'selected' : ''}>
                                ${r.name} (${r.type}) ${!r.is_available ? '[不可用]' : ''}
                            </option>
                        `).join('')}
                    </select>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>开始时间 *</label>
                    <input type="datetime-local" id="reservationStart" value="${startTime}" required>
                </div>
                <div class="form-group">
                    <label>结束时间 *</label>
                    <input type="datetime-local" id="reservationEnd" value="${endTime}" required>
                </div>
            </div>
            <div class="form-group">
                <label>用途</label>
                <textarea id="reservationPurpose">${reservation?.purpose || ''}</textarea>
            </div>
            ${isEdit ? `
            <div class="form-group">
                <label>状态</label>
                <select id="reservationStatus">
                    <option value="confirmed" ${reservation?.status === 'confirmed' ? 'selected' : ''}>已确认</option>
                    <option value="completed" ${reservation?.status === 'completed' ? 'selected' : ''}>已完成</option>
                    <option value="pending" ${reservation?.status === 'pending' ? 'selected' : ''}>待处理</option>
                </select>
            </div>
            ` : ''}
            <div id="validationResult"></div>
            <div class="form-actions">
                ${!isEdit ? `<button type="button" class="btn btn-outline" onclick="validateReservation()">检查冲突</button>` : ''}
                <button type="button" class="btn btn-outline" onclick="closeModal()">取消</button>
                <button type="submit" class="btn btn-primary">${isEdit ? '保存' : '创建'}</button>
            </div>
        </form>
    `);

    document.getElementById('reservationForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            const data = {
                merchant_id: parseInt(document.getElementById('reservationMerchant').value),
                resource_id: parseInt(document.getElementById('reservationResource').value),
                start_time: new Date(document.getElementById('reservationStart').value).toISOString(),
                end_time: new Date(document.getElementById('reservationEnd').value).toISOString(),
                purpose: document.getElementById('reservationPurpose').value || null,
            };
            if (isEdit) {
                data.status = document.getElementById('reservationStatus').value;
                await api.updateReservation(reservation.id, data);
            } else {
                await api.createReservation(data);
            }
            closeModal();
            await loadReservations();
            await loadKanban();
            showToast(isEdit ? '预约已更新' : '预约已创建', 'success');
        } catch (error) {
            showToast('操作失败: ' + error.message, 'error');
        }
    });
}

async function validateReservation() {
    try {
        const data = {
            merchant_id: parseInt(document.getElementById('reservationMerchant').value),
            resource_id: parseInt(document.getElementById('reservationResource').value),
            start_time: new Date(document.getElementById('reservationStart').value).toISOString(),
            end_time: new Date(document.getElementById('reservationEnd').value).toISOString(),
        };

        if (!data.merchant_id || !data.resource_id) {
            showToast('请选择商户和资源', 'error');
            return;
        }

        const result = await api.validateReservation(data);
        const resultDiv = document.getElementById('validationResult');

        if (result.valid) {
            let message = '<div style="color: #2e7d32; padding: 12px; background: #e8f5e9; border-radius: 8px; margin-top: 12px;">✅ 预约有效，无冲突</div>';
            if (result.warnings.length > 0) {
                message += `<div style="margin-top: 8px;"><strong>⚠️ 注意事项：</strong><ul>${result.warnings.map(w => `<li>${w}</li>`).join('')}</ul></div>`;
            }
            resultDiv.innerHTML = message;
        } else {
            resultDiv.innerHTML = `<div style="color: #c62828; padding: 12px; background: #ffebee; border-radius: 8px; margin-top: 12px;">
                <strong>🚨 发现冲突：</strong>
                <ul>${result.conflicts.map(c => `<li>${c.message}</li>`).join('')}</ul>
            </div>`;
        }
    } catch (error) {
        showToast('验证失败: ' + error.message, 'error');
    }
}

async function showReassignModal(reservationId) {
    try {
        const reservation = await api.getReservation(reservationId);
        if (resourcesCache.length === 0) {
            resourcesCache = await api.getResources();
        }

        openModal(`
            <div class="modal-header">
                <h3>改派资源</h3>
                <button class="modal-close" onclick="closeModal()">&times;</button>
            </div>
            <form id="reassignForm">
                <div class="form-group">
                    <label>当前资源</label>
                    <input type="text" value="${resourcesCache.find(r => r.id === reservation.resource_id)?.name || '未知'}" disabled>
                </div>
                <div class="form-group">
                    <label>选择新资源 *</label>
                    <select id="newResourceId" required>
                        <option value="">请选择新资源</option>
                        ${resourcesCache.filter(r => r.id !== reservation.resource_id && r.is_available).map(r => `
                            <option value="${r.id}">${r.name} (${r.type})</option>
                        `).join('')}
                    </select>
                </div>
                <div style="padding: 12px; background: #fff3e0; border-radius: 8px; margin-top: 12px;">
                    <strong>⚠️ 说明：</strong>改派后原预约将标记为"已改派"，并创建新预约。
                </div>
                <div class="form-actions">
                    <button type="button" class="btn btn-outline" onclick="closeModal()">取消</button>
                    <button type="submit" class="btn btn-warning">确认改派</button>
                </div>
            </form>
        `);

        document.getElementById('reassignForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            try {
                const newResourceId = parseInt(document.getElementById('newResourceId').value);
                await api.reassignReservation(reservationId, newResourceId);
                closeModal();
                await loadReservations();
                await loadKanban();
                showToast('预约已改派', 'success');
            } catch (error) {
                showToast('改派失败: ' + error.message, 'error');
            }
        });
    } catch (error) {
        showToast('加载预约失败: ' + error.message, 'error');
    }
}

function showFaultForm() {
    openModal(`
        <div class="modal-header">
            <h3>上报设备故障</h3>
            <button class="modal-close" onclick="closeModal()">&times;</button>
        </div>
        <form id="faultForm">
            <div class="form-group">
                <label>故障资源 *</label>
                <select id="faultResource" required>
                    <option value="">请选择资源</option>
                    ${resourcesCache.map(r => `
                        <option value="${r.id}">${r.name} (${r.type})</option>
                    `).join('')}
                </select>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>故障时间 *</label>
                    <input type="datetime-local" id="faultTime" value="${new Date().toISOString().slice(0, 16)}" required>
                </div>
                <div class="form-group">
                    <label>故障类型</label>
                    <input type="text" id="faultType" placeholder="如：设备损坏、电路故障">
                </div>
            </div>
            <div class="form-group">
                <label>故障描述 *</label>
                <textarea id="faultDescription" required placeholder="请详细描述故障情况..."></textarea>
            </div>
            <div class="form-group">
                <label>上报人</label>
                <input type="text" id="faultReporter">
            </div>
            <div style="padding: 12px; background: #ffebee; border-radius: 8px; margin-top: 12px;">
                <strong>⚠️ 注意：</strong>上报故障后，该资源将被标记为不可用，现有预约可能受到影响。
            </div>
            <div class="form-actions">
                <button type="button" class="btn btn-outline" onclick="closeModal()">取消</button>
                <button type="submit" class="btn btn-danger">上报故障</button>
            </div>
        </form>
    `);

    document.getElementById('faultForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            const data = {
                resource_id: parseInt(document.getElementById('faultResource').value),
                fault_time: new Date(document.getElementById('faultTime').value).toISOString(),
                fault_type: document.getElementById('faultType').value || null,
                description: document.getElementById('faultDescription').value,
                reported_by: document.getElementById('faultReporter').value || null,
            };
            await api.createFault(data);
            closeModal();
            await loadFaults();
            await loadResources();
            await loadKanban();
            showToast('故障已上报，资源已标记为不可用', 'success');
        } catch (error) {
            showToast('上报失败: ' + error.message, 'error');
        }
    });
}

async function showOvertimeForm() {
    try {
        const reservations = await api.getReservations();

        openModal(`
            <div class="modal-header">
                <h3>记录超时</h3>
                <button class="modal-close" onclick="closeModal()">&times;</button>
            </div>
            <form id="overtimeForm">
                <div class="form-group">
                    <label>相关预约 *</label>
                    <select id="overtimeReservation" required>
                        <option value="">请选择预约</option>
                        ${reservations.filter(r => r.status !== 'cancelled').map(r => {
                            const merchant = merchantsCache.find(m => m.id === r.merchant_id);
                            const resource = resourcesCache.find(res => res.id === r.resource_id);
                            return `<option value="${r.id}">#${r.id} - ${merchant?.name || '未知'} @ ${resource?.name || '未知'} (${formatTime(r.start_time)}-${formatTime(r.end_time)})</option>`;
                        }).join('')}
                    </select>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>实际结束时间 *</label>
                        <input type="datetime-local" id="overtimeActualEnd" value="${new Date().toISOString().slice(0, 16)}" required>
                    </div>
                    <div class="form-group">
                        <label>每小时费率 (元)</label>
                        <input type="number" id="overtimeRate" value="50" step="1" min="0">
                    </div>
                </div>
                <div class="form-group">
                    <label>备注</label>
                    <textarea id="overtimeNote" placeholder="超时原因等..."></textarea>
                </div>
                <div class="form-actions">
                    <button type="button" class="btn btn-outline" onclick="closeModal()">取消</button>
                    <button type="submit" class="btn btn-warning">记录超时</button>
                </div>
            </form>
        `);

        document.getElementById('overtimeForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            try {
                const data = {
                    reservation_id: parseInt(document.getElementById('overtimeReservation').value),
                    actual_end_time: new Date(document.getElementById('overtimeActualEnd').value).toISOString(),
                    hourly_rate: parseFloat(document.getElementById('overtimeRate').value),
                    note: document.getElementById('overtimeNote').value || null,
                };
                await api.recordOvertime(data);
                closeModal();
                await loadOvertime();
                await loadKanban();
                showToast('超时已记录', 'success');
            } catch (error) {
                showToast('记录失败: ' + error.message, 'error');
            }
        });
    } catch (error) {
        showToast('加载预约失败: ' + error.message, 'error');
    }
}

function showFeeForm() {
    openModal(`
        <div class="modal-header">
            <h3>新增费用</h3>
            <button class="modal-close" onclick="closeModal()">&times;</button>
        </div>
        <form id="feeForm">
            <div class="form-row">
                <div class="form-group">
                    <label>商户 *</label>
                    <select id="feeMerchant" required>
                        <option value="">请选择商户</option>
                        ${merchantsCache.map(m => `<option value="${m.id}">${m.name}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>日期 *</label>
                    <input type="date" id="feeDate" value="${new Date().toISOString().split('T')[0]}" required>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>预约费 (元)</label>
                    <input type="number" id="feeReservation" value="0" step="0.01" min="0">
                </div>
                <div class="form-group">
                    <label>超时费 (元)</label>
                    <input type="number" id="feeOvertime" value="0" step="0.01" min="0">
                </div>
            </div>
            <div class="form-group">
                <label>备注</label>
                <textarea id="feeNote"></textarea>
            </div>
            <div class="form-actions">
                <button type="button" class="btn btn-outline" onclick="closeModal()">取消</button>
                <button type="submit" class="btn btn-primary">创建费用</button>
            </div>
        </form>
    `);

    document.getElementById('feeForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            const resFee = parseFloat(document.getElementById('feeReservation').value) || 0;
            const overFee = parseFloat(document.getElementById('feeOvertime').value) || 0;

            const data = {
                merchant_id: parseInt(document.getElementById('feeMerchant').value),
                date: document.getElementById('feeDate').value,
                reservation_fee: resFee,
                overtime_fee: overFee,
                total_fee: resFee + overFee,
                note: document.getElementById('feeNote').value || null,
            };
            await api.createMerchantFee(data);
            closeModal();
            await loadFees();
            await loadKanban();
            showToast('费用已创建', 'success');
        } catch (error) {
            showToast('创建失败: ' + error.message, 'error');
        }
    });
}

async function editMerchant(id) {
    const merchant = merchantsCache.find(m => m.id === id);
    if (merchant) {
        showMerchantForm(merchant);
    }
}

async function editResource(id) {
    const resource = resourcesCache.find(r => r.id === id);
    if (resource) {
        showResourceForm(resource);
    }
}

async function editReservation(id) {
    const reservation = await api.getReservation(id);
    if (reservation) {
        showReservationForm(reservation);
    }
}

async function resolveFault(id) {
    if (confirm('确定要标记此故障为已解决吗？')) {
        try {
            await api.updateFault(id, { is_resolved: true });
            await loadFaults();
            await loadResources();
            await loadKanban();
            showToast('故障已标记为已解决，资源恢复可用', 'success');
        } catch (error) {
            showToast('操作失败: ' + error.message, 'error');
        }
    }
}

async function settleOvertime(id) {
    if (confirm('确定要结算此超时费用吗？')) {
        try {
            await api.updateOvertime(id, { status: 'completed' });
            await loadOvertime();
            showToast('超时已结算', 'success');
        } catch (error) {
            showToast('结算失败: ' + error.message, 'error');
        }
    }
}

function initEventListeners() {
    document.getElementById('initSampleData').addEventListener('click', async () => {
        if (confirm('确定要加载样例数据吗？这将创建演示数据。')) {
            try {
                await api.loadSampleData();
                merchantsCache = await api.getMerchants();
                resourcesCache = await api.getResources();
                await loadTabData(document.querySelector('.tab-btn.active').dataset.tab);
                showToast('样例数据加载成功！包含早餐档、烘焙档、夜宵档等演示数据', 'success');
            } catch (error) {
                showToast('加载失败: ' + error.message, 'error');
            }
        }
    });

    document.getElementById('exportSchedule').addEventListener('click', async () => {
        try {
            const content = await api.exportSchedule(currentDate);
            const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `排班表_${currentDate}.txt`;
            a.click();
            URL.revokeObjectURL(url);
            showToast('排班表已导出', 'success');
        } catch (error) {
            showToast('导出失败: ' + error.message, 'error');
        }
    });

    document.getElementById('kanbanDate').value = currentDate;
    document.getElementById('kanbanDate').addEventListener('change', (e) => {
        currentDate = e.target.value;
        loadKanban();
    });

    document.getElementById('refreshKanban').addEventListener('click', () => loadKanban());

    document.getElementById('addMerchant').addEventListener('click', () => showMerchantForm());
    document.getElementById('addResource').addEventListener('click', () => showResourceForm());
    document.getElementById('addReservation').addEventListener('click', () => showReservationForm());
    document.getElementById('addFault').addEventListener('click', async () => {
        if (resourcesCache.length === 0) {
            resourcesCache = await api.getResources();
        }
        showFaultForm();
    });
    document.getElementById('recordOvertime').addEventListener('click', async () => {
        if (merchantsCache.length === 0) {
            merchantsCache = await api.getMerchants();
        }
        if (resourcesCache.length === 0) {
            resourcesCache = await api.getResources();
        }
        showOvertimeForm();
    });
    document.getElementById('addFee').addEventListener('click', async () => {
        if (merchantsCache.length === 0) {
            merchantsCache = await api.getMerchants();
        }
        showFeeForm();
    });

    document.getElementById('modalOverlay').addEventListener('click', (e) => {
        if (e.target.id === 'modalOverlay') {
            closeModal();
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeModal();
        }
    });
}

async function init() {
    initTabs();
    initEventListeners();

    try {
        await api.health();
        merchantsCache = await api.getMerchants();
        resourcesCache = await api.getResources();
        await loadKanban();
    } catch (error) {
        console.warn('API连接失败:', error);
        showToast('无法连接到后端API，请确保后端服务已启动 (http://localhost:8000)', 'error');
    }
}

document.addEventListener('DOMContentLoaded', init);
