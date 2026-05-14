const API_BASE = 'http://localhost:5000/api';
let currentTrials = [];
let currentTrialId = null;

document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    loadCoupons();
    loadRules();
    refreshTrials();
    initTrialForm();
});

function initNavigation() {
    const navBtns = document.querySelectorAll('.nav-btn');
    navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            navBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            const section = btn.dataset.section;
            document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
            document.getElementById(`${section}-section`).classList.add('active');
        });
    });
}

async function fetchAPI(endpoint, options = {}) {
    try {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        });
        return await response.json();
    } catch (error) {
        console.error('API Error:', error);
        return { error: error.message };
    }
}

async function loadCoupons() {
    const coupons = await fetchAPI('/coupons');
    const container = document.getElementById('coupon-list');
    
    if (Array.isArray(coupons)) {
        container.innerHTML = coupons.map(coupon => `
            <label class="checkbox-item">
                <input type="checkbox" name="coupon" value="${coupon.coupon_id}">
                <span>${coupon.name} (${coupon.type})</span>
            </label>
        `).join('');
    }
}

async function loadRules() {
    const rules = await fetchAPI('/rules');
    const container = document.getElementById('rules-list');
    
    if (Array.isArray(rules)) {
        container.innerHTML = rules.map(rule => `
            <div class="rule-card">
                <h5>${rule.rule_id}: ${rule.name}</h5>
                <p>${rule.description}</p>
                <p style="margin-top: 8px;">状态: ${rule.enabled ? '✓ 已启用' : '✗ 已禁用'}</p>
            </div>
        `).join('');
    }
}

async function refreshTrials() {
    const trials = await fetchAPI('/trials');
    const stats = await fetchAPI('/stats');
    
    if (Array.isArray(trials)) {
        currentTrials = trials;
        renderTrialsTable(trials);
    }
    
    if (stats) {
        document.getElementById('total-trials').textContent = stats.total_trials || 0;
        document.getElementById('success-trials').textContent = stats.status_breakdown?.success || 0;
        document.getElementById('blocked-trials').textContent = stats.status_breakdown?.blocked || 0;
        document.getElementById('pending-trials').textContent = stats.status_breakdown?.pending_review || 0;
    }
}

function filterTrials() {
    const status = document.getElementById('status-filter').value;
    let filtered = currentTrials;
    
    if (status) {
        filtered = currentTrials.filter(t => t.status === status);
    }
    
    renderTrialsTable(filtered);
}

function renderTrialsTable(trials) {
    const tbody = document.getElementById('trials-table-body');
    
    if (trials.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: #999;">暂无数据</td></tr>';
        return;
    }
    
    tbody.innerHTML = trials.map(trial => `
        <tr>
            <td><strong>${trial.trial_id}</strong></td>
            <td>${trial.cart_id}</td>
            <td>¥${trial.original_total.toFixed(2)}</td>
            <td>¥${trial.final_total.toFixed(2)}</td>
            <td><span class="status-badge ${trial.status}">${getStatusText(trial.status)}</span></td>
            <td>${formatDate(trial.created_at)}</td>
            <td>
                <button class="btn btn-primary btn-small" onclick="viewTrialDetail('${trial.trial_id}')">详情</button>
                ${trial.rollback_history?.length > 0 ? `
                    <button class="btn btn-danger btn-small" onclick="rollbackTrial('${trial.trial_id}')">回滚</button>
                ` : ''}
            </td>
        </tr>
    `).join('');
}

function getStatusText(status) {
    const map = {
        'success': '成功',
        'pending_review': '待复核',
        'blocked': '已拦截',
        'retryable': '可重试'
    };
    return map[status] || status;
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleString('zh-CN', { hour12: false });
}

function initTrialForm() {
    const form = document.getElementById('trial-form');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const cartId = document.getElementById('cart-select').value;
        const couponIds = Array.from(document.querySelectorAll('input[name="coupon"]:checked'))
            .map(cb => cb.value);
        
        if (!cartId) {
            alert('请选择购物车');
            return;
        }
        
        if (couponIds.length === 0) {
            alert('请至少选择一个优惠券');
            return;
        }
        
        const result = await fetchAPI('/trial', {
            method: 'POST',
            body: JSON.stringify({ cart_id: cartId, coupon_ids: couponIds })
        });
        
        if (result.error) {
            alert('试算失败: ' + result.error);
        } else {
            alert(`试算完成！ID: ${result.trial_id}\n状态: ${getStatusText(result.status)}\n最终价格: ¥${result.final_total.toFixed(2)}`);
            refreshTrials();
        }
    });
}

async function viewTrialDetail(trialId) {
    currentTrialId = trialId;
    const trial = await fetchAPI(`/trial/${trialId}`);
    
    if (trial.error) {
        alert('获取详情失败');
        return;
    }
    
    const content = document.getElementById('detail-content');
    
    let errorsHtml = '';
    if (trial.errors && trial.errors.length > 0) {
        errorsHtml = `
            <div class="error-list">
                <strong>❌ 错误明细</strong>
                <ul>
                    ${trial.errors.map(e => `<li>${e}</li>`).join('')}
                </ul>
            </div>
        `;
    }
    
    let warningsHtml = '';
    if (trial.warnings && trial.warnings.length > 0) {
        warningsHtml = `
            <div style="background: #fff8e1; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                <strong>⚠️ 警告</strong>
                <ul>
                    ${trial.warnings.map(w => `<li>${w}</li>`).join('')}
                </ul>
            </div>
        `;
    }
    
    let stepsHtml = '';
    if (trial.calculation_steps && trial.calculation_steps.length > 0) {
        stepsHtml = `
            <div class="calc-steps">
                <strong>💰 价格计算明细</strong>
                ${trial.calculation_steps.map(step => `
                    <div class="step-item">
                        <span>${step.coupon}</span>
                        <span>¥${step.before.toFixed(2)} → ¥${step.after.toFixed(2)}</span>
                    </div>
                `).join('')}
            </div>
        `;
    }
    
    let rollbackHtml = '';
    if (trial.rollback_history && trial.rollback_history.length > 0) {
        rollbackHtml = `
            <div class="rollback-history">
                <strong>📜 历史版本 (${trial.rollback_history.length})</strong>
                ${trial.rollback_history.map((h, idx) => `
                    <div class="rollback-item">
                        <div>版本 ${idx + 1}: ${h.corrected_at ? formatDate(h.corrected_at) : ''}</div>
                        <div>状态: ${getStatusText(h.status)} | 最终价: ¥${h.final_total.toFixed(2)}</div>
                    </div>
                `).join('')}
            </div>
        `;
    }
    
    content.innerHTML = `
        <div class="detail-section">
            <h4>基本信息</h4>
            <div class="detail-grid">
                <div class="detail-item">
                    <span class="label">试算ID</span>
                    <span class="value">${trial.trial_id}</span>
                </div>
                <div class="detail-item">
                    <span class="label">状态</span>
                    <span class="value"><span class="status-badge ${trial.status}">${getStatusText(trial.status)}</span></span>
                </div>
                <div class="detail-item">
                    <span class="label">原价</span>
                    <span class="value">¥${trial.original_total.toFixed(2)}</span>
                </div>
                <div class="detail-item">
                    <span class="label">最终价</span>
                    <span class="value">¥${trial.final_total.toFixed(2)}</span>
                </div>
                <div class="detail-item">
                    <span class="label">优惠金额</span>
                    <span class="value">¥${(trial.original_total - trial.final_total).toFixed(2)}</span>
                </div>
                <div class="detail-item">
                    <span class="label">创建时间</span>
                    <span class="value">${formatDate(trial.created_at)}</span>
                </div>
                ${trial.corrected_at ? `
                    <div class="detail-item">
                        <span class="label">修正时间</span>
                        <span class="value">${formatDate(trial.corrected_at)}</span>
                    </div>
                ` : ''}
            </div>
        </div>
        
        <div class="detail-section">
            <h4>购物车信息</h4>
            <div class="cart-items">
                ${trial.cart_snapshot?.items?.map(item => `
                    <div class="cart-item">
                        <span>${item.name} × ${item.quantity}</span>
                        <span>¥${(item.price * item.quantity).toFixed(2)}</span>
                    </div>
                `).join('') || '-'}
                <div class="cart-item" style="font-weight: bold; border-top: 2px solid #ddd; margin-top: 8px; padding-top: 8px;">
                    <span>合计</span>
                    <span>¥${trial.cart_snapshot?.total_original?.toFixed(2) || 0}</span>
                </div>
            </div>
        </div>
        
        <div class="detail-section">
            <h4>使用的优惠券</h4>
            <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                ${trial.coupons_snapshot?.map(c => `
                    <span style="background: #e3f2fd; padding: 4px 10px; border-radius: 4px; font-size: 13px;">
                        ${c.name}
                    </span>
                `).join('') || '-'}
            </div>
        </div>
        
        ${errorsHtml}
        ${warningsHtml}
        ${stepsHtml}
        ${rollbackHtml}
        
        <div class="action-bar">
            ${trial.status === 'blocked' || trial.status === 'pending_review' ? `
                <button class="btn btn-success" onclick="correctTrial('${trial.trial_id}')">修正 / 强制通过</button>
            ` : ''}
            ${trial.rollback_history?.length > 0 ? `
                <button class="btn btn-danger" onclick="rollbackTrial('${trial.trial_id}')">回滚至上一版本</button>
            ` : ''}
            <button class="btn btn-primary" onclick="closeModal()">关闭</button>
        </div>
    `;
    
    document.getElementById('detail-modal').classList.add('active');
}

async function correctTrial(trialId) {
    const trial = currentTrials.find(t => t.trial_id === trialId);
    if (!trial) return;
    
    const couponIds = prompt('请输入优惠券ID，多个用逗号分隔（或直接点击确定强制通过）：', 
        trial.coupon_ids.join(','));
    
    if (couponIds === null) return;
    
    const newCouponIds = couponIds ? couponIds.split(',').map(c => c.trim()).filter(c => c) : trial.coupon_ids;
    const manualOverride = confirm('是否人工强制通过互斥规则检查？');
    
    const operator = prompt('操作人姓名：', 'admin') || 'system';
    
    const result = await fetchAPI(`/trial/${trialId}/correct`, {
        method: 'POST',
        body: JSON.stringify({
            coupon_ids: newCouponIds,
            manual_override: manualOverride,
            operator: operator
        })
    });
    
    if (result.error) {
        alert('修正失败: ' + result.error);
    } else {
        alert(`修正完成！\n新状态: ${getStatusText(result.status)}\n最终价格: ¥${result.final_total.toFixed(2)}`);
        viewTrialDetail(trialId);
        refreshTrials();
    }
}

async function rollbackTrial(trialId) {
    if (!confirm('确定要回滚至上一版本吗？')) return;
    
    const result = await fetchAPI(`/trial/${trialId}/rollback`, {
        method: 'POST'
    });
    
    if (result.error) {
        alert('回滚失败: ' + result.error);
    } else {
        alert(`回滚完成！\n当前状态: ${getStatusText(result.status)}`);
        viewTrialDetail(trialId);
        refreshTrials();
    }
}

async function batchImport() {
    const dataStr = document.getElementById('batch-data').value;
    
    try {
        const data = JSON.parse(dataStr);
        if (!Array.isArray(data)) {
            throw new Error('数据格式错误，需要数组');
        }
        
        const result = await fetchAPI('/batch/import', {
            method: 'POST',
            body: JSON.stringify({ trials: data })
        });
        
        const resultBox = document.getElementById('batch-result');
        resultBox.classList.add('visible');
        resultBox.innerHTML = `
            <h4>导入结果</h4>
            <p>总计: ${result.total} | 成功: ${result.success} | 失败: ${result.failed}</p>
            <div style="max-height: 200px; overflow-y: auto; margin-top: 10px;">
                ${result.results?.map((r, idx) => `
                    <div style="padding: 8px; border-bottom: 1px solid #eee; color: ${r.success ? '#2e7d32' : '#c62828'}">
                        ${idx + 1}. ${r.success ? `✓ ${r.data.trial_id} - ¥${r.data.final_total.toFixed(2)}` : `✗ ${r.error}`}
                    </div>
                `).join('') || ''}
            </div>
        `;
        
        refreshTrials();
        
    } catch (error) {
        alert('JSON解析错误: ' + error.message);
    }
}

function closeModal() {
    document.getElementById('detail-modal').classList.remove('active');
    currentTrialId = null;
}

window.onclick = function(e) {
    const modal = document.getElementById('detail-modal');
    if (e.target === modal) {
        closeModal();
    }
};
