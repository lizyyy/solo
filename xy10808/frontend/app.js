const API_BASE = 'http://localhost:3001/api';

let currentMerchants = [];
let selectedMerchantSecret = '';

document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    loadMerchants();
    loadRecords();
    loadSamples();
    
    document.getElementById('status-filter').addEventListener('change', loadRecords);
    document.getElementById('merchant-filter').addEventListener('change', loadRecords);
});

function initNavigation() {
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const page = tab.dataset.page;
            showPage(page);
        });
    });
}

function showPage(pageName) {
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    
    document.querySelector(`[data-page="${pageName}"]`).classList.add('active');
    document.getElementById(`${pageName}-page`).classList.add('active');
}

async function apiRequest(endpoint, options = {}) {
    try {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            headers: { 'Content-Type': 'application/json' },
            ...options
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error('API请求失败:', error);
        alert(`请求失败: ${error.message}`);
        throw error;
    }
}

async function loadMerchants() {
    try {
        const merchants = await apiRequest('/merchants');
        currentMerchants = merchants;
        
        const tableBody = document.querySelector('#merchants-table tbody');
        tableBody.innerHTML = merchants.map(m => `
            <tr>
                <td><code>${m.merchant_id}</code></td>
                <td>${m.merchant_name}</td>
                <td>${m.algorithm}</td>
                <td>${m.time_window}s</td>
            </tr>
        `).join('');
        
        const merchantSelect = document.getElementById('create-merchant-id');
        const merchantFilter = document.getElementById('merchant-filter');
        
        const merchantOptions = merchants.map(m => 
            `<option value="${m.merchant_id}">${m.merchant_name} (${m.merchant_id})</option>`
        ).join('');
        
        merchantSelect.innerHTML = '<option value="">选择商家</option>' + merchantOptions;
        merchantFilter.innerHTML = '<option value="">全部</option>' + merchantOptions;
        
        merchantSelect.addEventListener('change', (e) => {
            const merchant = merchants.find(m => m.merchant_id === e.target.value);
            selectedMerchantSecret = merchant ? merchant.secret_key : '';
        });
    } catch (e) {}
}

async function addMerchant() {
    const merchant_id = document.getElementById('merchant-id').value;
    const merchant_name = document.getElementById('merchant-name').value;
    const secret_key = document.getElementById('merchant-secret').value;
    const algorithm = document.getElementById('merchant-algorithm').value;
    const time_window = parseInt(document.getElementById('merchant-window').value);
    
    if (!merchant_id || !merchant_name || !secret_key) {
        alert('请填写完整的商家信息');
        return;
    }
    
    try {
        await apiRequest('/merchants', {
            method: 'POST',
            body: JSON.stringify({ merchant_id, merchant_name, secret_key, algorithm, time_window })
        });
        alert('商家添加成功');
        loadMerchants();
        
        document.getElementById('merchant-id').value = '';
        document.getElementById('merchant-name').value = '';
        document.getElementById('merchant-secret').value = '';
    } catch (e) {}
}

async function loadRecords() {
    const status = document.getElementById('status-filter').value;
    const merchant_id = document.getElementById('merchant-filter').value;
    
    let url = '/records?limit=100';
    if (status) url += `&status=${status}`;
    if (merchant_id) url += `&merchant_id=${merchant_id}`;
    
    try {
        const records = await apiRequest(url);
        const tableBody = document.querySelector('#records-table tbody');
        
        tableBody.innerHTML = records.map(r => `
            <tr>
                <td><span class="link" onclick="showDetail('${r.record_id}')">${r.record_id}</span></td>
                <td><code>${r.merchant_id}</code></td>
                <td>${new Date(r.timestamp * 1000).toLocaleString()}</td>
                <td><span class="status-badge status-${r.status}">${r.status}</span></td>
                <td>${new Date(r.created_at).toLocaleString()}</td>
                <td>
                    <button class="btn btn-success" style="padding:0.25rem 0.5rem;font-size:0.8rem" onclick="verifyRecord('${r.record_id}')">验证</button>
                    <button class="btn btn-warning" style="padding:0.25rem 0.5rem;font-size:0.8rem" onclick="retryRecord('${r.record_id}')">重试</button>
                </td>
            </tr>
        `).join('');
    } catch (e) {}
}

async function showDetail(recordId) {
    showPage('detail');
    const contentDiv = document.getElementById('detail-content');
    contentDiv.innerHTML = '<div class="loading">加载中...</div>';
    
    try {
        const record = await apiRequest(`/records/${recordId}`);
        
        contentDiv.innerHTML = `
            <div style="margin-top:1rem">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
                    <h3>记录: <code>${record.record_id}</code></h3>
                    <span class="status-badge status-${record.status}">${record.status}</span>
                </div>
                
                <div class="two-col" style="margin-bottom:1rem">
                    <div>
                        <p><strong>商家ID:</strong> <code>${record.merchant_id}</code></p>
                        <p><strong>时间戳:</strong> ${record.timestamp} (${new Date(record.timestamp * 1000).toLocaleString()})</p>
                        <p><strong>Nonce:</strong> ${record.nonce || '无'}</p>
                    </div>
                    <div>
                        <p><strong>创建时间:</strong> ${new Date(record.created_at).toLocaleString()}</p>
                        <p><strong>更新时间:</strong> ${new Date(record.updated_at).toLocaleString()}</p>
                    </div>
                </div>
                
                <h4 style="margin-bottom:0.5rem">📦 请求载荷</h4>
                <div class="payload-preview">
                    <pre>${JSON.stringify(record.original_payload, null, 2)}</pre>
                </div>
                
                <div class="compare-box">
                    <div class="compare-item">
                        <h4>🔒 提交的签名</h4>
                        <div class="payload-preview"><code>${record.signature}</code></div>
                    </div>
                    <div class="compare-item">
                        <h4>🔑 预期签名 (重新计算)</h4>
                        <div id="expected-signature" class="payload-preview"><button class="btn btn-secondary" onclick="calculateExpected('${record.record_id}')">计算</button></div>
                    </div>
                </div>
                
                ${record.error_message ? `
                    <div style="margin-bottom:1rem">
                        <h4 class="error-text">❌ 错误信息</h4>
                        <div class="payload-preview error-text">${record.error_message}</div>
                    </div>
                ` : ''}
                
                <div style="margin:1rem 0">
                    <button class="btn btn-success" onclick="verifyRecord('${record.record_id}')">✅ 执行验证</button>
                    <button class="btn btn-warning" onclick="retryRecord('${record.record_id}')">🔄 重试 (创建新记录)</button>
                    <button class="btn btn-primary" onclick="saveToSample('${record.record_id}')">📚 保存到样例库</button>
                </div>
                
                ${record.history && record.history.length > 0 ? `
                    <h4 style="margin-bottom:0.5rem">📜 状态变更历史</h4>
                    ${record.history.map(h => `
                        <div class="history-item">
                            <div><strong>${h.action}</strong></div>
                            <div>${h.status_before} → ${h.status_after}</div>
                            <div style="font-size:0.8rem;color:#a0a0a0">${new Date(h.created_at).toLocaleString()}</div>
                        </div>
                    `).join('')}
                ` : ''}
            </div>
        `;
    } catch (e) {
        contentDiv.innerHTML = `<div class="error-text">加载失败: ${e.message}</div>`;
    }
}

async function calculateExpected(recordId) {
    const record = await apiRequest(`/records/${recordId}`);
    const merchant = currentMerchants.find(m => m.merchant_id === record.merchant_id);
    
    if (!merchant) {
        alert('找不到该商家的配置');
        return;
    }
    
    const result = await apiRequest('/generate-signature', {
        method: 'POST',
        body: JSON.stringify({
            payload: record.original_payload,
            secret_key: merchant.secret_key,
            algorithm: merchant.algorithm
        })
    });
    
    document.getElementById('expected-signature').innerHTML = `<code>${result.signature}</code>`;
}

async function verifyRecord(recordId) {
    try {
        const result = await apiRequest(`/records/${recordId}/verify`, { method: 'POST' });
        
        if (result.success) {
            alert('✅ 验证成功!');
        } else {
            alert(`❌ 验证失败:\n${result.errors ? result.errors.join('\n') : '未知错误'}`);
        }
        
        if (document.getElementById('detail-page').classList.contains('active')) {
            showDetail(recordId);
        } else {
            loadRecords();
        }
    } catch (e) {}
}

async function retryRecord(recordId) {
    try {
        const result = await apiRequest(`/records/${recordId}/retry`, { method: 'POST' });
        alert(`🔄 重试完成! 新记录ID: ${result.record_id}`);
        showDetail(result.record_id);
    } catch (e) {}
}

async function saveToSample(recordId) {
    const notes = prompt('请输入备注信息:');
    if (notes === null) return;
    
    try {
        await apiRequest(`/records/${recordId}/save-sample`, {
            method: 'POST',
            body: JSON.stringify({ notes })
        });
        alert('✅ 已保存到样例库');
        loadSamples();
    } catch (e) {}
}

async function generateSignature() {
    const merchantId = document.getElementById('create-merchant-id').value;
    const payloadStr = document.getElementById('create-payload').value;
    
    if (!merchantId || !payloadStr) {
        alert('请先选择商家并填写载荷');
        return;
    }
    
    if (!selectedMerchantSecret) {
        const merchant = currentMerchants.find(m => m.merchant_id === merchantId);
        if (merchant) selectedMerchantSecret = merchant.secret_key;
    }
    
    try {
        let payload;
        try {
            payload = JSON.parse(payloadStr);
        } catch {
            payload = payloadStr;
        }
        
        const result = await apiRequest('/generate-signature', {
            method: 'POST',
            body: JSON.stringify({
                payload,
                secret_key: selectedMerchantSecret
            })
        });
        
        document.getElementById('create-signature').value = result.signature;
    } catch (e) {}
}

async function createRecord() {
    const merchant_id = document.getElementById('create-merchant-id').value;
    const payloadStr = document.getElementById('create-payload').value;
    const signature = document.getElementById('create-signature').value;
    let timestamp = document.getElementById('create-timestamp').value;
    const nonce = document.getElementById('create-nonce').value;
    
    if (!merchant_id || !payloadStr || !signature) {
        alert('请填写必填项');
        return;
    }
    
    if (!timestamp) {
        timestamp = Math.floor(Date.now() / 1000);
    }
    
    try {
        let payload;
        try {
            payload = JSON.parse(payloadStr);
        } catch {
            payload = payloadStr;
        }
        
        const result = await apiRequest('/records', {
            method: 'POST',
            body: JSON.stringify({
                merchant_id,
                payload,
                signature,
                timestamp: parseInt(timestamp),
                nonce: nonce || undefined
            })
        });
        
        alert(`✅ 记录创建成功! ID: ${result.record_id}`);
        showDetail(result.record_id);
    } catch (e) {}
}

function clearCreateForm() {
    document.getElementById('create-payload').value = '';
    document.getElementById('create-signature').value = '';
    document.getElementById('create-timestamp').value = '';
    document.getElementById('create-nonce').value = '';
}

async function loadSamples() {
    const isSuccess = document.getElementById('sample-filter').value;
    let url = '/samples';
    if (isSuccess !== '') url += `?is_success=${isSuccess}`;
    
    try {
        const samples = await apiRequest(url);
        const tableBody = document.querySelector('#samples-table tbody');
        
        tableBody.innerHTML = samples.map(s => `
            <tr>
                <td><code>${s.sample_id}</code></td>
                <td><code>${s.merchant_id}</code></td>
                <td><span class="status-badge status-${s.is_success ? 'SUCCESS' : 'FAILED'}">${s.is_success ? '成功' : '失败'}</span></td>
                <td>${s.notes || '-'}</td>
                <td>${new Date(s.created_at).toLocaleString()}</td>
            </tr>
        `).join('');
    } catch (e) {}
}

function exportRecords() {
    window.open(`${API_BASE}/export/records`, '_blank');
}

function exportSamples() {
    window.open(`${API_BASE}/export/samples`, '_blank');
}
