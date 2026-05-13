const API_BASE = 'http://localhost:3000';
let currentBillId = null;
let trialData = null;
let allBills = [];
let allRules = [];

document.addEventListener('DOMContentLoaded', () => {
    loadOverview();
    loadBills();
    loadCorrections();
    loadAnomalies();
});

function switchTab(tabName) {
    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    document.querySelector(`.tab[onclick="switchTab('${tabName}')"]`).classList.add('active');
    document.getElementById(tabName).classList.add('active');
    
    if (tabName === 'overview') loadOverview();
    if (tabName === 'bills') loadBills();
    if (tabName === 'corrections') loadCorrections();
    if (tabName === 'anomalies') loadAnomalies();
}

async function apiCall(url, options = {}) {
    const response = await fetch(API_BASE + url, {
        headers: { 'Content-Type': 'application/json', ...options.headers },
        ...options
    });
    const data = await response.json();
    if (!data.success && data.error) {
        alert('错误: ' + data.error);
        throw new Error(data.error);
    }
    return data;
}

async function loadOverview() {
    const container = document.getElementById('overviewStats');
    container.innerHTML = '<div class="loading">加载中...</div>';
    
    try {
        const response = await apiCall('/api/overview');
        const data = response.data;
        
        container.innerHTML = `
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-value">${data.bills.total}</div>
                    <div class="stat-label">账单总数</div>
                    <div class="stat-sub">已支付: ${data.bills.paid} / 未支付: ${data.bills.pending}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${data.anomalies.open}</div>
                    <div class="stat-label">待处理异常</div>
                    <div class="stat-sub">总异常: ${data.anomalies.total} / 已解决: ${data.anomalies.resolved}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${data.corrections.draft + data.corrections.approved}</div>
                    <div class="stat-label">待处理订正</div>
                    <div class="stat-sub">已发布: ${data.corrections.published} / 已驳回: ${data.corrections.rejected}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${data.versions.total}</div>
                    <div class="stat-label">版本总数</div>
                    <div class="stat-sub">活跃版本: ${data.versions.active}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value" style="color: ${data.notifications.failed > 0 ? '#f56c6c' : '#667eea'}">${data.notifications.failed}</div>
                    <div class="stat-label">通知失败</div>
                    <div class="stat-sub">待发送: ${data.notifications.pending} / 已发送: ${data.notifications.sent} / 已跳过: ${data.notifications.skipped}</div>
                </div>
            </div>
        `;
    } catch (error) {
        container.innerHTML = '<div class="loading">加载失败，请确保后端服务已启动</div>';
    }
}

async function loadBills() {
    const container = document.getElementById('billsTable');
    container.innerHTML = '<div class="loading">加载中...</div>';
    
    try {
        const response = await apiCall('/api/bills');
        allBills = response.data;
        
        if (allBills.length === 0) {
            container.innerHTML = '<div class="empty-state">暂无账单数据，点击"加载样例数据"开始测试</div>';
            return;
        }
        
        let html = `
            <table>
                <thead>
                    <tr>
                        <th>账单编号</th>
                        <th>客户</th>
                        <th>账单月份</th>
                        <th>原始金额</th>
                        <th>当前金额</th>
                        <th>状态</th>
                        <th>异常数</th>
                        <th>订正数</th>
                        <th>操作</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        for (const bill of allBills) {
            const activeVersion = bill.active_version || {};
            html += `
                <tr>
                    <td><strong>${bill.bill_number}</strong></td>
                    <td>${bill.customer_name}</td>
                    <td>${bill.bill_month}</td>
                    <td>￥${bill.original_amount.toFixed(2)}</td>
                    <td><strong>￥${activeVersion.final_amount ? activeVersion.final_amount.toFixed(2) : '-'}</strong></td>
                    <td>${getStatusBadge(bill.status)}</td>
                    <td>${bill.open_anomalies_count > 0 ? `<span class="badge badge-danger">${bill.open_anomalies_count}</span>` : '<span class="badge badge-info">0</span>'}</td>
                    <td>${bill.corrections_count > 0 ? `<span class="badge badge-warning">${bill.corrections_count}</span>` : '<span class="badge badge-info">0</span>'}</td>
                    <td>
                        <button class="btn btn-primary btn-sm" onclick="viewBillDetail('${bill.id}')">详情</button>
                        <button class="btn btn-success btn-sm" onclick="openCreateCorrection('${bill.id}')">订正</button>
                    </td>
                </tr>
            `;
        }
        
        html += '</tbody></table>';
        container.innerHTML = html;
    } catch (error) {
        container.innerHTML = '<div class="loading">加载失败</div>';
    }
}

async function loadCorrections() {
    const container = document.getElementById('correctionsTable');
    container.innerHTML = '<div class="loading">加载中...</div>';
    
    try {
        const response = await apiCall('/api/corrections');
        const corrections = response.data;
        
        if (corrections.length === 0) {
            container.innerHTML = '<div class="empty-state">暂无订正申请</div>';
            return;
        }
        
        let html = `
            <table>
                <thead>
                    <tr>
                        <th>账单编号</th>
                        <th>客户</th>
                        <th>订正类型</th>
                        <th>目标规则</th>
                        <th>调整金额</th>
                        <th>状态</th>
                        <th>申请人</th>
                        <th>申请时间</th>
                        <th>操作</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        for (const corr of corrections) {
            html += `
                <tr>
                    <td><strong>${corr.bill_number}</strong></td>
                    <td>${corr.customer_name}</td>
                    <td>${corr.correction_type === 'adjustment' ? '<span class="badge badge-warning">差额调整</span>' : '<span class="badge badge-primary">全额重算</span>'}</td>
                    <td>${corr.target_rule_name || '无折扣'}</td>
                    <td>${corr.adjustment_amount !== null ? `￥${corr.adjustment_amount.toFixed(2)}` : '-'}</td>
                    <td>${getCorrectionStatusBadge(corr.status)}</td>
                    <td>${corr.requested_by}</td>
                    <td>${formatDate(corr.requested_at)}</td>
                    <td>
                        <button class="btn btn-primary btn-sm" onclick="viewCorrectionDetail('${corr.id}')">详情</button>
                        ${(corr.status === 'draft' || corr.status === 'pending_approval') ? `
                            <button class="btn btn-success btn-sm" onclick="approveCorrection('${corr.id}')">审批</button>
                            <button class="btn btn-danger btn-sm" onclick="rejectCorrection('${corr.id}')">驳回</button>
                        ` : ''}
                        ${corr.status === 'approved' ? `
                            <button class="btn btn-primary btn-sm" onclick="publishCorrection('${corr.id}')">发布</button>
                        ` : ''}
                    </td>
                </tr>
            `;
        }
        
        html += '</tbody></table>';
        container.innerHTML = html;
    } catch (error) {
        container.innerHTML = '<div class="loading">加载失败</div>';
    }
}

async function loadAnomalies() {
    const container = document.getElementById('anomaliesTable');
    container.innerHTML = '<div class="loading">加载中...</div>';
    
    try {
        const billsResponse = await apiCall('/api/bills');
        const bills = billsResponse.data;
        let allAnomalies = [];
        
        for (const bill of bills) {
            const detailResponse = await apiCall(`/api/bills/${bill.id}`);
            const billDetail = detailResponse.data;
            if (billDetail.anomalies) {
                for (const anomaly of billDetail.anomalies) {
                    allAnomalies.push({
                        ...anomaly,
                        bill_number: billDetail.bill_number,
                        customer_name: billDetail.customer_name
                    });
                }
            }
        }
        
        if (allAnomalies.length === 0) {
            container.innerHTML = '<div class="empty-state">暂无异常记录</div>';
            return;
        }
        
        let html = `
            <table>
                <thead>
                    <tr>
                        <th>账单编号</th>
                        <th>客户</th>
                        <th>异常类型</th>
                        <th>异常原因</th>
                        <th>版本</th>
                        <th>状态</th>
                        <th>发现人</th>
                        <th>发现时间</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        for (const anomaly of allAnomalies) {
            html += `
                <tr>
                    <td><strong>${anomaly.bill_number}</strong></td>
                    <td>${anomaly.customer_name}</td>
                    <td>${getAnomalyTypeBadge(anomaly.anomaly_type)}</td>
                    <td>${anomaly.anomaly_reason}</td>
                    <td>v${anomaly.version_number}</td>
                    <td>${anomaly.status === 'open' ? '<span class="badge badge-danger">待处理</span>' : '<span class="badge badge-success">已解决</span>'}</td>
                    <td>${anomaly.detected_by}</td>
                    <td>${formatDate(anomaly.detected_at)}</td>
                </tr>
            `;
        }
        
        html += '</tbody></table>';
        container.innerHTML = html;
    } catch (error) {
        container.innerHTML = '<div class="loading">加载失败</div>';
    }
}

function getStatusBadge(status) {
    const badges = {
        'paid': '<span class="badge badge-success">已支付</span>',
        'pending': '<span class="badge badge-warning">未支付</span>',
        'partial': '<span class="badge badge-info">部分支付</span>'
    };
    return badges[status] || status;
}

function getCorrectionStatusBadge(status) {
    const badges = {
        'draft': '<span class="badge badge-info">草稿</span>',
        'pending_approval': '<span class="badge badge-warning">待审批</span>',
        'approved': '<span class="badge badge-primary">已审批</span>',
        'published': '<span class="badge badge-success">已发布</span>',
        'rejected': '<span class="badge badge-danger">已驳回</span>'
    };
    return badges[status] || status;
}

function getAnomalyTypeBadge(type) {
    const badges = {
        'wrong_discount': '<span class="badge badge-danger">折扣错误</span>',
        'missing_item': '<span class="badge badge-warning">漏项</span>',
        'wrong_amount': '<span class="badge badge-danger">金额错误</span>',
        'other': '<span class="badge badge-info">其他</span>'
    };
    return badges[type] || type;
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleString('zh-CN');
}

async function viewBillDetail(billId) {
    currentBillId = billId;
    const modal = document.getElementById('billDetailModal');
    const content = document.getElementById('billDetailContent');
    const title = document.getElementById('billDetailTitle');
    
    content.innerHTML = '<div class="loading">加载中...</div>';
    modal.classList.add('active');
    
    try {
        const response = await apiCall(`/api/bills/${billId}`);
        const bill = response.data;
        
        title.innerHTML = `账单详情 - ${bill.bill_number}`;
        
        let versionsHtml = '';
        if (bill.versions && bill.versions.length > 0) {
            versionsHtml = '<div class="version-timeline">';
            for (const version of bill.versions) {
                const isActive = version.is_active === 1;
                versionsHtml += `
                    <div class="version-item ${isActive ? 'active' : ''}">
                        <div class="version-info">
                            <div class="version-number">
                                版本 v${version.version_number}
                                ${isActive ? '<span class="badge badge-success">当前活跃</span>' : ''}
                            </div>
                            <div class="version-meta">
                                <strong>规则：</strong>${version.rule_name || '无折扣'}<br>
                                <strong>折扣类型：</strong>${version.discount_type === 'percentage' ? '百分比' : version.discount_type === 'fixed' ? '固定金额' : '-'}<br>
                                <strong>折扣值：</strong>${version.discount_type === 'percentage' ? version.discount_value + '%' : '￥' + (version.discount_value || 0).toFixed(2)}<br>
                                <strong>应用折扣：</strong>￥${version.applied_discount.toFixed(2)}<br>
                                <strong>最终金额：</strong>￥${version.final_amount.toFixed(2)}<br>
                                <strong>生成人：</strong>${version.created_by}<br>
                                <strong>创建时间：</strong>${formatDate(version.created_at)}<br>
                                <strong>说明：</strong>${version.reason || '-'}
                            </div>
                            ${!isActive ? `
                                <div style="margin-top: 10px;">
                                    <button class="btn btn-warning btn-sm" onclick="rollbackToVersion('${bill.id}', '${version.id}')">回滚到此版本</button>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                `;
            }
            versionsHtml += '</div>';
        }
        
        let rollbacksHtml = '';
        if (bill.rollbacks && bill.rollbacks.length > 0) {
            rollbacksHtml = '<ul>';
            for (const rb of bill.rollbacks) {
                rollbacksHtml += `
                    <li style="margin-bottom: 10px; padding: 10px; background: #fef0f0; border-radius: 4px;">
                        <div class="rollback-badge">🔄 已回滚</div>
                        <br>
                        <strong>回滚版本：</strong>v${rb.rolled_back_version_number} (￥${rb.rolled_back_amount.toFixed(2)})<br>
                        <strong>恢复版本：</strong>v${rb.restored_version_number} (￥${rb.restored_amount.toFixed(2)})<br>
                        <strong>原因：</strong>${rb.reason}<br>
                        <strong>操作人：</strong>${rb.rolled_back_by}<br>
                        <strong>时间：</strong>${formatDate(rb.rolled_back_at)}
                    </li>
                `;
            }
            rollbacksHtml += '</ul>';
        }
        
        content.innerHTML = `
            <div class="card" style="margin-bottom: 15px;">
                <h4 class="section-title">基本信息</h4>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                    <div><strong>账单编号：</strong>${bill.bill_number}</div>
                    <div><strong>客户：</strong>${bill.customer_name}</div>
                    <div><strong>邮箱：</strong>${bill.customer_email || '-'}</div>
                    <div><strong>电话：</strong>${bill.customer_phone || '-'}</div>
                    <div><strong>账单月份：</strong>${bill.bill_month}</div>
                    <div><strong>状态：</strong>${getStatusBadge(bill.status)}</div>
                    <div><strong>原始金额：</strong>￥${bill.original_amount.toFixed(2)}</div>
                    <div><strong>创建时间：</strong>${formatDate(bill.created_at)}</div>
                </div>
            </div>
            
            <div class="card" style="margin-bottom: 15px;">
                <h4 class="section-title">版本历史</h4>
                ${versionsHtml || '<div class="empty-state">暂无版本</div>'}
            </div>
            
            ${bill.anomalies && bill.anomalies.length > 0 ? `
            <div class="card" style="margin-bottom: 15px;">
                <h4 class="section-title">异常记录</h4>
                <table>
                    <thead>
                        <tr><th>类型</th><th>原因</th><th>版本</th><th>状态</th><th>发现人</th><th>时间</th></tr>
                    </thead>
                    <tbody>
                        ${bill.anomalies.map(a => `
                            <tr>
                                <td>${getAnomalyTypeBadge(a.anomaly_type)}</td>
                                <td>${a.anomaly_reason}</td>
                                <td>v${a.version_number}</td>
                                <td>${a.status === 'open' ? '<span class="badge badge-danger">待处理</span>' : '<span class="badge badge-success">已解决</span>'}</td>
                                <td>${a.detected_by}</td>
                                <td>${formatDate(a.detected_at)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            ` : ''}
            
            ${bill.corrections && bill.corrections.length > 0 ? `
            <div class="card" style="margin-bottom: 15px;">
                <h4 class="section-title">订正申请记录</h4>
                <table>
                    <thead>
                        <tr><th>类型</th><th>目标规则</th><th>调整金额</th><th>状态</th><th>审批数</th><th>通知数</th><th>时间</th></tr>
                    </thead>
                    <tbody>
                        ${bill.corrections.map(c => `
                            <tr>
                                <td>${c.correction_type === 'adjustment' ? '<span class="badge badge-warning">差额调整</span>' : '<span class="badge badge-primary">全额重算</span>'}</td>
                                <td>${c.target_rule_name || '无折扣'}</td>
                                <td>${c.adjustment_amount !== null ? `￥${c.adjustment_amount.toFixed(2)}` : '-'}</td>
                                <td>${getCorrectionStatusBadge(c.status)}</td>
                                <td>${c.approval_count}</td>
                                <td>${c.notification_count}</td>
                                <td>${formatDate(c.requested_at)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            ` : ''}
            
            ${rollbacksHtml ? `
            <div class="card" style="margin-bottom: 15px;">
                <h4 class="section-title">回滚记录</h4>
                ${rollbacksHtml}
            </div>
            ` : ''}
            
            <div class="card">
                <h4 class="section-title">快捷操作</h4>
                <div class="alert alert-info">
                    <strong>标记异常：</strong>
                    <div class="form-group" style="margin-top: 10px;">
                        <select id="anomalyType" class="form-control">
                            <option value="wrong_discount">折扣错误</option>
                            <option value="wrong_amount">金额错误</option>
                            <option value="missing_item">漏项</option>
                            <option value="other">其他</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <input type="text" id="anomalyReason" class="form-control" placeholder="异常原因说明">
                    </div>
                    <div class="form-group">
                        <input type="text" id="anomalyDetectedBy" class="form-control" placeholder="发现人" value="billing_team">
                    </div>
                    <button class="btn btn-warning" onclick="markAnomaly()">标记异常</button>
                </div>
            </div>
        `;
    } catch (error) {
        content.innerHTML = '<div class="loading">加载失败</div>';
    }
}

async function openCreateCorrection(billId) {
    currentBillId = billId;
    trialData = null;
    const modal = document.getElementById('createCorrectionModal');
    const content = document.getElementById('createCorrectionContent');
    
    content.innerHTML = '<div class="loading">加载中...</div>';
    modal.classList.add('active');
    
    try {
        const rulesResponse = await apiCall('/api/rules');
        allRules = rulesResponse.data;
        
        content.innerHTML = `
            <div class="form-group">
                <label>目标折扣规则</label>
                <select id="targetRuleSelect" class="form-control" onchange="runTrial()">
                    <option value="">无折扣</option>
                    ${allRules.map(r => `<option value="${r.id}">${r.name} (${r.discount_type === 'percentage' ? r.discount_value + '%' : '￥' + r.discount_value})</option>`).join('')}
                </select>
            </div>
            
            <div id="trialResult" style="display: none;"></div>
            
            <div class="form-group">
                <label>申请人</label>
                <input type="text" id="requestedBy" class="form-control" value="analyst1">
            </div>
            
            <div class="form-group">
                <label>备注说明</label>
                <textarea id="correctionNotes" class="form-control" placeholder="订正原因说明"></textarea>
            </div>
        `;
    } catch (error) {
        content.innerHTML = '<div class="loading">加载失败</div>';
    }
}

async function runTrial() {
    const ruleId = document.getElementById('targetRuleSelect').value;
    const resultDiv = document.getElementById('trialResult');
    
    try {
        const response = await apiCall('/api/corrections/trial', {
            method: 'POST',
            body: JSON.stringify({ billId: currentBillId, targetRuleId: ruleId || null })
        });
        
        trialData = response.data;
        const c = trialData.comparison;
        
        const amountDiff = c.amount_diff;
        const discountDiff = c.discount_diff;
        
        resultDiv.style.display = 'block';
        resultDiv.innerHTML = `
            <div class="comparison-card">
                <h4 style="margin-bottom: 15px;">📊 订正试算结果</h4>
                
                ${trialData.is_paid ? `
                    <div class="alert alert-warning">
                        ⚠️ <strong>该账单已支付</strong>，将生成<span class="badge badge-warning">差额调整单</span>而非覆盖原账单
                    </div>
                ` : `
                    <div class="alert alert-info">
                        ℹ️ <strong>该账单未支付</strong>，将生成<span class="badge badge-primary">新版本</span>，旧版本保留
                    </div>
                `}
                
                <div class="comparison-grid">
                    <div class="comparison-item old">
                        <div class="comparison-label">当前版本（订正前）</div>
                        <div class="comparison-value red">￥${c.old_final.toFixed(2)}</div>
                        <div class="version-meta">
                            原始金额: ￥${c.original_amount.toFixed(2)}<br>
                            规则: ${trialData.source_version.rule_name}<br>
                            折扣: ￥${c.old_discount.toFixed(2)}
                        </div>
                    </div>
                    <div class="comparison-item new">
                        <div class="comparison-label">目标版本（订正后）</div>
                        <div class="comparison-value green">￥${c.new_final.toFixed(2)}</div>
                        <div class="version-meta">
                            原始金额: ￥${c.original_amount.toFixed(2)}<br>
                            规则: ${trialData.target.rule_name}<br>
                            折扣: ￥${c.new_discount.toFixed(2)}
                        </div>
                    </div>
                </div>
                
                <div style="margin-top: 20px; text-align: center;">
                    <span class="diff-badge ${amountDiff <= 0 ? 'positive' : 'negative'}">
                        金额变化: ${amountDiff >= 0 ? '+' : ''}￥${amountDiff.toFixed(2)}
                    </span>
                    <span class="diff-badge ${discountDiff >= 0 ? 'positive' : 'negative'}" style="margin-left: 10px;">
                        折扣变化: ${discountDiff >= 0 ? '+' : ''}￥${discountDiff.toFixed(2)}
                    </span>
                </div>
                
                ${trialData.correction_type === 'adjustment' ? `
                    <div style="margin-top: 15px; text-align: center;">
                        <div class="alert alert-danger">
                            🔧 <strong>差额调整金额：￥${trialData.adjustment_amount.toFixed(2)}</strong>
                        </div>
                    </div>
                ` : ''}
                
                ${!trialData.can_notify && !trialData.is_paid ? `
                    <div style="margin-top: 15px;">
                        <div class="alert alert-info">
                            🔔 客户通知将在<strong>审批发布后</strong>自动生成
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    } catch (error) {
        resultDiv.innerHTML = `<div class="alert alert-danger">试算失败: ${error.message}</div>`;
    }
}

async function submitCorrection() {
    if (!trialData) {
        alert('请先选择规则并查看试算结果');
        return;
    }
    
    const requestedBy = document.getElementById('requestedBy').value;
    const notes = document.getElementById('correctionNotes').value;
    const ruleId = document.getElementById('targetRuleSelect').value;
    
    try {
        const response = await apiCall('/api/corrections', {
            method: 'POST',
            body: JSON.stringify({
                billId: currentBillId,
                targetRuleId: ruleId || null,
                requestedBy,
                notes
            })
        });
        
        alert('订正申请创建成功！ID: ' + response.data.id.substring(0, 8));
        closeModal('createCorrectionModal');
        loadCorrections();
        loadBills();
    } catch (error) {
        console.error(error);
    }
}

async function markAnomaly() {
    const type = document.getElementById('anomalyType').value;
    const reason = document.getElementById('anomalyReason').value;
    const detectedBy = document.getElementById('anomalyDetectedBy').value;
    
    if (!reason) {
        alert('请填写异常原因');
        return;
    }
    
    try {
        await apiCall(`/api/bills/${currentBillId}/anomalies`, {
            method: 'POST',
            body: JSON.stringify({ anomalyType: type, anomalyReason: reason, detectedBy })
        });
        
        alert('异常标记成功！');
        viewBillDetail(currentBillId);
        loadAnomalies();
    } catch (error) {
        console.error(error);
    }
}

async function viewCorrectionDetail(correctionId) {
    const modal = document.getElementById('correctionDetailModal');
    const content = document.getElementById('correctionDetailContent');
    const title = document.getElementById('correctionDetailTitle');
    
    content.innerHTML = '<div class="loading">加载中...</div>';
    modal.classList.add('active');
    
    try {
        const response = await apiCall(`/api/corrections/${correctionId}`);
        const corr = response.data;
        
        title.innerHTML = `订正申请详情 - ${corr.bill_number}`;
        
        let notificationsHtml = '';
        if (corr.notifications && corr.notifications.length > 0) {
            notificationsHtml = '<table><thead><tr><th>类型</th><th>状态</th><th>错误信息</th><th>发送时间</th><th>操作</th></tr></thead><tbody>';
            for (const n of corr.notifications) {
                const statusBadge = {
                    'pending': '<span class="badge badge-warning">待发送</span>',
                    'sent': '<span class="badge badge-success">已发送</span>',
                    'failed': '<span class="badge badge-danger">发送失败</span>',
                    'skipped': '<span class="badge badge-info">已跳过</span>'
                }[n.status] || n.status;
                
                notificationsHtml += `
                    <tr>
                        <td>${n.notification_type === 'adjustment_notice' ? '差额调整通知' : '账单更新通知'}</td>
                        <td>${n.status === 'failed' ? `<div class="notification-status"><span class="pulse-dot"></span>${statusBadge}</div>` : statusBadge}</td>
                        <td>${n.error_message || '-'}</td>
                        <td>${formatDate(n.sent_at)}</td>
                        <td>${n.status === 'failed' || n.status === 'pending' ? `<button class="btn btn-primary btn-sm" onclick="resendNotification('${n.id}')">重发</button>` : '-'}</td>
                    </tr>
                `;
            }
            notificationsHtml += '</tbody></table>';
        }
        
        let approvalsHtml = '';
        if (corr.approvals && corr.approvals.length > 0) {
            approvalsHtml = '<ul>';
            for (const a of corr.approvals) {
                approvalsHtml += `
                    <li style="margin-bottom: 10px; padding: 10px; background: ${a.action === 'approve' ? '#f0f9eb' : '#fef0f0'}; border-radius: 4px;">
                        <strong>${a.action === 'approve' ? '✅ 审批通过' : '❌ 审批驳回'}</strong> - ${a.approver}<br>
                        <strong>时间：</strong>${formatDate(a.approved_at)}<br>
                        ${a.comment ? `<strong>意见：</strong>${a.comment}` : ''}
                    </li>
                `;
            }
            approvalsHtml += '</ul>';
        }
        
        const hasFailedNotifications = corr.notifications && corr.notifications.some(n => n.status === 'failed');
        const hasPendingNotifications = corr.notifications && corr.notifications.some(n => n.status === 'pending');
        
        content.innerHTML = `
            ${hasFailedNotifications ? `
                <div class="alert alert-danger">
                    ⚠️ <strong>订正流程未完全完成</strong> - 存在客户通知失败
                    <br><small>请点击下方"重发"按钮重试通知</small>
                </div>
            ` : ''}
            ${hasPendingNotifications && !hasFailedNotifications ? `
                <div class="alert alert-warning">
                    ⚠️ <strong>订正流程未完全完成</strong> - 存在待发送的客户通知
                </div>
            ` : ''}
            
            <div class="card" style="margin-bottom: 15px;">
                <h4 class="section-title">基本信息</h4>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                    <div><strong>账单编号：</strong>${corr.bill_number}</div>
                    <div><strong>客户：</strong>${corr.customer_name}</div>
                    <div><strong>账单月份：</strong>${corr.bill_month}</div>
                    <div><strong>账单状态：</strong>${getStatusBadge(corr.bill_status)}</div>
                    <div><strong>订正类型：</strong>${corr.correction_type === 'adjustment' ? '<span class="badge badge-warning">差额调整</span>' : '<span class="badge badge-primary">全额重算</span>'}</div>
                    <div><strong>状态：</strong>${getCorrectionStatusBadge(corr.status)}</div>
                    <div><strong>申请人：</strong>${corr.requested_by}</div>
                    <div><strong>申请时间：</strong>${formatDate(corr.requested_at)}</div>
                </div>
            </div>
            
            <div class="card" style="margin-bottom: 15px;">
                <h4 class="section-title">金额对比</h4>
                <div class="comparison-grid">
                    <div class="comparison-item old">
                        <div class="comparison-label">源版本</div>
                        <div class="comparison-value red">￥${corr.source_final_amount.toFixed(2)}</div>
                        <div class="version-meta">
                            版本: v${corr.source_version_number}<br>
                            规则: ${corr.source_rule_name}<br>
                            折扣: ￥${corr.source_discount.toFixed(2)}
                        </div>
                    </div>
                    <div class="comparison-item new">
                        <div class="comparison-label">目标版本</div>
                        <div class="comparison-value green">￥${corr.trial_final_amount.toFixed(2)}</div>
                        <div class="version-meta">
                            规则: ${corr.target_rule_name}<br>
                            ${corr.correction_type === 'adjustment' ? `差额: ￥${corr.adjustment_amount.toFixed(2)}` : ''}
                        </div>
                    </div>
                </div>
                <div style="margin-top: 15px; text-align: center;">
                    <span class="diff-badge ${(corr.trial_final_amount - corr.source_final_amount) <= 0 ? 'positive' : 'negative'}">
                        金额变化: ${(corr.trial_final_amount - corr.source_final_amount) >= 0 ? '+' : ''}￥${(corr.trial_final_amount - corr.source_final_amount).toFixed(2)}
                    </span>
                </div>
            </div>
            
            ${corr.approvals && corr.approvals.length > 0 ? `
            <div class="card" style="margin-bottom: 15px;">
                <h4 class="section-title">审批记录</h4>
                ${approvalsHtml}
            </div>
            ` : ''}
            
            ${corr.notifications && corr.notifications.length > 0 ? `
            <div class="card" style="margin-bottom: 15px;">
                <h4 class="section-title">客户通知记录</h4>
                ${notificationsHtml}
            </div>
            ` : ''}
            
            ${corr.generated_version ? `
            <div class="card">
                <h4 class="section-title">生成的版本</h4>
                <div class="version-info">
                    <div class="version-number">版本 v${corr.generated_version.version_number}</div>
                    <div class="version-meta">
                        <strong>规则：</strong>${corr.generated_version.rule_name || '无折扣'}<br>
                        <strong>最终金额：</strong>￥${corr.generated_version.final_amount.toFixed(2)}<br>
                        <strong>创建人：</strong>${corr.generated_version.created_by}<br>
                        <strong>创建时间：</strong>${formatDate(corr.generated_version.created_at)}<br>
                        <strong>是否活跃：</strong>${corr.generated_version.is_active === 1 ? '<span class="badge badge-success">是</span>' : '<span class="badge badge-info">否</span>'}
                    </div>
                </div>
            </div>
            ` : ''}
            
            ${corr.notes ? `
            <div class="card" style="margin-top: 15px;">
                <h4 class="section-title">备注说明</h4>
                <p>${corr.notes}</p>
            </div>
            ` : ''}
        `;
    } catch (error) {
        content.innerHTML = '<div class="loading">加载失败</div>';
    }
}

async function approveCorrection(correctionId) {
    const approver = prompt('请输入审批人姓名:', 'manager1');
    if (!approver) return;
    
    const comment = prompt('审批意见 (可选):');
    
    try {
        await apiCall(`/api/corrections/${correctionId}/approve`, {
            method: 'POST',
            body: JSON.stringify({ approver, comment })
        });
        
        alert('审批通过！');
        loadCorrections();
        loadOverview();
    } catch (error) {
        console.error(error);
    }
}

async function rejectCorrection(correctionId) {
    const approver = prompt('请输入审批人姓名:', 'manager1');
    if (!approver) return;
    
    const comment = prompt('驳回原因:');
    if (!comment) {
        alert('请填写驳回原因');
        return;
    }
    
    try {
        await apiCall(`/api/corrections/${correctionId}/reject`, {
            method: 'POST',
            body: JSON.stringify({ approver, comment })
        });
        
        alert('已驳回！');
        loadCorrections();
        loadOverview();
    } catch (error) {
        console.error(error);
    }
}

async function publishCorrection(correctionId) {
    if (!confirm('发布后将生成新版本并创建客户通知（未支付账单），确定继续吗？')) return;
    
    const approver = prompt('请输入发布人姓名:', 'manager1');
    if (!approver) return;
    
    try {
        const response = await apiCall(`/api/corrections/${correctionId}/publish`, {
            method: 'POST',
            body: JSON.stringify({ approver })
        });
        
        const data = response.data;
        let msg = `发布成功！\n新版本: v${data.version_number}\n金额: ￥${data.final_amount.toFixed(2)}`;
        
        if (data.can_notify) {
            msg += `\n\n客户通知状态: ${data.notification_status}`;
            if (data.notification_status === 'pending') {
                msg += '\n(通知已创建，待发送)';
            }
        } else {
            msg += '\n\n该账单已支付，客户通知已跳过';
        }
        
        alert(msg);
        loadCorrections();
        loadBills();
        loadOverview();
    } catch (error) {
        console.error(error);
    }
}

async function rollbackToVersion(billId, versionId) {
    if (!confirm('回滚将激活目标版本并停用当前版本，确定继续吗？')) return;
    
    const rolledBackBy = prompt('请输入操作人姓名:', 'manager1');
    if (!rolledBackBy) return;
    
    const reason = prompt('回滚原因:');
    if (!reason) {
        alert('请填写回滚原因');
        return;
    }
    
    try {
        const response = await apiCall(`/api/bills/${billId}/rollback`, {
            method: 'POST',
            body: JSON.stringify({ targetVersionId: versionId, rolledBackBy, reason })
        });
        
        const data = response.data;
        alert(`回滚成功！\n回滚版本: v${data.rolled_back_version.version_number}\n恢复版本: v${data.restored_version.version_number}`);
        
        closeModal('billDetailModal');
        loadBills();
        loadOverview();
    } catch (error) {
        console.error(error);
    }
}

async function resendNotification(notificationId) {
    try {
        const response = await apiCall(`/api/notifications/${notificationId}/send`, {
            method: 'POST'
        });
        
        const data = response.data;
        if (data.status === 'sent') {
            alert('通知发送成功！');
        } else {
            alert(`通知发送失败: ${data.error_message}\n(这是模拟的随机失败，请重试)`);
        }
        
        loadCorrections();
        loadOverview();
    } catch (error) {
        console.error(error);
    }
}

async function seedSampleData() {
    if (!confirm('这将清空现有数据并加载样例数据，确定继续吗？')) return;
    
    try {
        const response = await apiCall('/api/seed/samples', { method: 'POST' });
        const data = response.data;
        
        alert(`样例数据加载成功！\n\n📊 数据统计:\n- 客户: ${data.customers}\n- 规则: ${data.rules}\n- 账单: ${data.bills}\n- 版本: ${data.versions}\n- 异常: ${data.anomalies}\n- 订正: ${data.corrections}\n- 通知: ${data.notifications}\n- 回滚: ${data.rollbacks}\n\n🎯 样例场景:\n1. ${data.sample_scenarios.scenario1_unpaid_recalc.bill_number} - 未支付账单重算\n2. ${data.sample_scenarios.scenario2_paid_adjustment.bill_number} - 已支付账单差额调整（已驳回）\n3. ${data.sample_scenarios.scenario3_repeat_correction.bill_number} - 重复订正比并回滚（通知失败）`);
        
        loadOverview();
        loadBills();
        loadCorrections();
        loadAnomalies();
    } catch (error) {
        console.error(error);
    }
}

async function importBills() {
    const fileInput = document.getElementById('importFile');
    if (!fileInput.files || fileInput.files.length === 0) {
        alert('请选择文件');
        return;
    }
    
    const formData = new FormData();
    formData.append('file', fileInput.files[0]);
    
    try {
        const response = await fetch(API_BASE + '/api/import/bills', {
            method: 'POST',
            body: formData
        });
        const data = await response.json();
        
        if (data.success) {
            alert(`导入成功！\n新增: ${data.data.imported}\n更新: ${data.data.updated}\n错误: ${data.data.errors.length}`);
            closeModal('importModal');
            loadBills();
            loadOverview();
        } else {
            alert('导入失败: ' + data.error);
        }
    } catch (error) {
        alert('导入失败: ' + error.message);
    }
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
        e.target.classList.remove('active');
    }
});
