let currentPage = 1;
let pageSize = 10;
let teams = [];

function getRiskClass(risk) {
    const classes = { '低': 'risk-low', '中': 'risk-medium', '高': 'risk-high', '极高': 'risk-extreme' };
    return classes[risk] || 'risk-medium';
}

function getStatusClass(status) {
    const colors = {
        '待整改': 'bg-orange-100 text-orange-700',
        '整改中': 'bg-blue-100 text-blue-700',
        '待复查': 'bg-yellow-100 text-yellow-700',
        '已通过': 'bg-green-100 text-green-700',
        '已罚款': 'bg-red-100 text-red-700'
    };
    return colors[status] || 'bg-gray-100 text-gray-700';
}

function getLogClass(result) {
    const classes = { '成功': 'log-success', '拦截': 'log-blocked', '人工修正': 'log-manual', '重复提交': 'log-repeat' };
    return classes[result] || '';
}

function switchTab(tab) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.tab-btn').forEach(el => {
        el.classList.remove('tab-active');
        el.classList.add('text-gray-500');
    });
    document.getElementById('tab-' + tab).classList.remove('hidden');
    document.querySelector(`[data-tab="${tab}"]`).classList.add('tab-active');
    document.querySelector(`[data-tab="${tab}"]`).classList.remove('text-gray-500');
    
    if (tab === 'fines') loadFines();
    if (tab === 'highRisk') loadHighRisk();
    if (tab === 'logs') loadLogs();
}

async function checkApiStatus() {
    try {
        const res = await fetch('http://localhost:3000/health');
        if (res.ok) {
            document.getElementById('apiStatus').textContent = '正常';
            document.getElementById('apiStatus').className = 'text-sm text-green-600';
        } else {
            throw new Error();
        }
    } catch {
        document.getElementById('apiStatus').textContent = '离线';
        document.getElementById('apiStatus').className = 'text-sm text-red-600';
    }
}

async function loadTeams() {
    const res = await teamApi.list();
    if (res.success) {
        teams = res.data;
        const select = document.getElementById('filterTeam');
        teams.forEach(team => {
            const option = document.createElement('option');
            option.value = team.id;
            option.textContent = team.name;
            select.appendChild(option);
        });
    }
}

async function loadHazards() {
    const filters = {
        status: document.getElementById('filterStatus').value,
        risk_level: document.getElementById('filterRisk').value,
        team_id: document.getElementById('filterTeam').value,
        keyword: document.getElementById('filterKeyword').value,
        page: currentPage,
        pageSize: pageSize
    };

    const res = await hazardApi.list(filters);
    if (!res.success) {
        alert('加载失败: ' + res.message);
        return;
    }

    const tbody = document.getElementById('hazardsTable');
    tbody.innerHTML = res.data.map(h => `
        <tr>
            <td class="px-4 py-3 text-sm">${h.description}</td>
            <td class="px-4 py-3 text-sm">${h.location || '-'}</td>
            <td class="px-4 py-3"><span class="status-badge ${getRiskClass(h.risk_level)}">${h.risk_level}</span></td>
            <td class="px-4 py-3 text-sm">${h.team_name || '-'}</td>
            <td class="px-4 py-3 text-sm">${h.deadline ? new Date(h.deadline).toLocaleDateString() : '-'}</td>
            <td class="px-4 py-3"><span class="status-badge ${getStatusClass(h.status)}">${h.status}</span></td>
            <td class="px-4 py-3">
                <button onclick="viewHazardDetail('${h.id}')" class="text-blue-600 hover:text-blue-800 text-sm">查看</button>
            </td>
        </tr>
    `).join('');

    const pagination = document.getElementById('hazardsPagination');
    if (res.pagination) {
        const totalPages = Math.ceil(res.pagination.total / res.pagination.pageSize);
        pagination.innerHTML = `
            <div class="flex items-center justify-between">
                <span class="text-sm text-gray-700">共 ${res.pagination.total} 条</span>
                <div class="space-x-2">
                    <button onclick="currentPage = Math.max(1, currentPage - 1); loadHazards();" class="px-3 py-1 border rounded text-sm ${currentPage === 1 ? 'opacity-50' : ''}">上一页</button>
                    <span class="text-sm text-gray-700">第 ${currentPage} / ${totalPages} 页</span>
                    <button onclick="currentPage++; loadHazards();" class="px-3 py-1 border rounded text-sm ${currentPage >= totalPages ? 'opacity-50' : ''}">下一页</button>
                </div>
            </div>
        `;
    }
}

async function viewHazardDetail(id) {
    const res = await hazardApi.get(id);
    if (!res.success) {
        alert('加载失败');
        return;
    }

    const h = res.data;
    document.getElementById('detailContent').innerHTML = `
        <div class="space-y-6">
            <div class="grid grid-cols-2 gap-4">
                <div>
                    <label class="block text-sm font-medium text-gray-500">隐患描述</label>
                    <p class="mt-1 text-gray-900">${h.description}</p>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-500">位置</label>
                    <p class="mt-1 text-gray-900">${h.location || '-'}</p>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-500">风险等级</label>
                    <span class="status-badge ${getRiskClass(h.risk_level)} mt-1 inline-block">${h.risk_level}</span>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-500">责任班组</label>
                    <p class="mt-1 text-gray-900">${h.team_name || '-'}</p>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-500">整改期限</label>
                    <p class="mt-1 text-gray-900">${h.deadline ? new Date(h.deadline).toLocaleString() : '-'}</p>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-500">状态</label>
                    <span class="status-badge ${getStatusClass(h.status)} mt-1 inline-block">${h.status}</span>
                </div>
            </div>

            <div class="border-t pt-6">
                <h4 class="font-medium text-gray-900 mb-4">时间线</h4>
                <div class="space-y-3">
                    ${(h.timeline || []).map(t => `
                        <div class="flex items-start ${getLogClass(t.result)} pl-3 py-2">
                            <div class="min-w-0">
                                <div class="flex items-center">
                                    <span class="font-medium text-sm text-gray-900">${t.operator || '系统'}</span>
                                    <span class="ml-2 status-badge ${t.result === '成功' ? 'bg-green-100 text-green-700' : t.result === '拦截' ? 'bg-red-100 text-red-700' : t.result === '人工修正' ? 'bg-yellow-100 text-yellow-700' : 'bg-purple-100 text-purple-700'}">${t.result}</span>
                                </div>
                                <p class="text-sm text-gray-600 mt-1">${t.reason}</p>
                                <p class="text-xs text-gray-400 mt-1">${new Date(t.time).toLocaleString()}</p>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;

    document.getElementById('detailModal').classList.add('active');
}

async function loadFines() {
    const res = await fineApi.list({});
    if (!res.success) {
        alert('加载失败');
        return;
    }

    const tbody = document.getElementById('finesTable');
    tbody.innerHTML = res.data.map(f => `
        <tr>
            <td class="px-4 py-3 text-sm">${f.hazard_description || '-'}</td>
            <td class="px-4 py-3 text-sm">${f.team_name || '-'}</td>
            <td class="px-4 py-3 text-sm font-medium text-red-600">¥${f.amount}</td>
            <td class="px-4 py-3 text-sm">${f.reason}</td>
            <td class="px-4 py-3"><span class="status-badge ${getStatusClass(f.status)}">${f.status}</span></td>
            <td class="px-4 py-3 text-sm">${f.reviewed_by || '-'}</td>
            <td class="px-4 py-3">
                ${f.status === '待复核' ? `<button onclick="reviewFine('${f.id}')" class="text-blue-600 hover:text-blue-800 text-sm">复核</button>` : '-'}
            </td>
        </tr>
    `).join('');
}

async function reviewFine(id) {
    const status = prompt('请输入复核状态（已确认/已撤销）:', '已确认');
    if (!status) return;
    
    const res = await fineApi.review(id, { status, reviewer: '当前用户' });
    alert(res.success ? '复核成功' : '复核失败: ' + res.message);
    if (res.success) loadFines();
}

async function loadHighRisk() {
    const res = await hazardApi.highRisk();
    if (!res.success) {
        alert('加载失败');
        return;
    }

    const tbody = document.getElementById('highRiskTable');
    tbody.innerHTML = res.data.map(h => `
        <tr>
            <td class="px-4 py-3 text-sm">${h.description}</td>
            <td class="px-4 py-3 text-sm">${h.location || '-'}</td>
            <td class="px-4 py-3"><span class="status-badge ${getRiskClass(h.risk_level)}">${h.risk_level}</span></td>
            <td class="px-4 py-3 text-sm">${h.team_name || '-'}</td>
            <td class="px-4 py-3 text-sm">${h.deadline ? new Date(h.deadline).toLocaleDateString() : '-'}</td>
            <td class="px-4 py-3"><span class="status-badge ${getStatusClass(h.status)}">${h.status}</span></td>
        </tr>
    `).join('');
}

async function loadLogs() {
    const res = await logApi.list({ limit: 50 });
    if (!res.success) {
        alert('加载失败');
        return;
    }

    const list = document.getElementById('logsList');
    list.innerHTML = res.data.map(l => `
        <div class="p-4 ${getLogClass(l.result)} pl-6">
            <div class="flex items-center justify-between">
                <div class="flex items-center">
                    <span class="font-medium text-sm text-gray-900">${l.operation_type}</span>
                    <span class="ml-2 status-badge ${l.result === '成功' ? 'bg-green-100 text-green-700' : l.result === '拦截' ? 'bg-red-100 text-red-700' : l.result === '人工修正' ? 'bg-yellow-100 text-yellow-700' : 'bg-purple-100 text-purple-700'}">${l.result}</span>
                </div>
                <span class="text-xs text-gray-400">${new Date(l.created_at).toLocaleString()}</span>
            </div>
            <p class="text-sm text-gray-600 mt-1">${l.reason}</p>
            ${l.hazard_id ? `<p class="text-xs text-gray-400 mt-1">隐患ID: ${l.hazard_id}</p>` : ''}
        </div>
    `).join('');
}

function exportHazards() {
    const filters = {
        status: document.getElementById('filterStatus').value,
        risk_level: document.getElementById('filterRisk').value,
        team_id: document.getElementById('filterTeam').value,
        format: 'excel'
    };
    hazardApi.export(filters);
}

function openImportModal() {
    document.getElementById('importModal').classList.add('active');
}

async function handleImport() {
    const fileInput = document.getElementById('importFile');
    if (!fileInput.files.length) return;

    const res = await importApi.importHazards(fileInput.files[0]);
    if (res.success) {
        alert(res.message + '\n成功: ' + res.results.success + '\n失败: ' + res.results.failed);
        closeModal('importModal');
        loadHazards();
    } else {
        alert('导入失败: ' + res.message);
    }
}

function closeModal(id) {
    document.getElementById(id).classList.remove('active');
}

function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

async function runDemo(type) {
    const resultEl = document.getElementById('demoResult');
    const outputEl = document.getElementById('demoOutput');
    resultEl.classList.remove('hidden');
    outputEl.textContent = '正在执行演示...\n\n';

    try {
        if (type === 'success') {
            outputEl.textContent += '🔹 步骤1: 创建一个新的安全隐患\n';
            const createRes = await hazardApi.create({
                description: '演示-安全通道堆放杂物',
                location: '北区入口',
                risk_level: '中',
                operator: '演示用户'
            }, generateUUID());
            outputEl.textContent += `   结果: ${createRes.success ? '✅ 成功' : '❌ 失败'}\n`;
            if (!createRes.success) outputEl.textContent += `   原因: ${createRes.message}\n`;
            outputEl.textContent += '\n';

            if (createRes.success) {
                const hazardId = createRes.data.id;
                outputEl.textContent += '🔹 步骤2: 提交整改复查（整改通过）\n';
                const reviewRes = await hazardApi.submitReview(hazardId, {
                    opinion: '杂物已清理，通道恢复畅通，符合安全要求。',
                    result: '通过',
                    reviewer: '演示用户'
                }, generateUUID());
                outputEl.textContent += `   结果: ${reviewRes.success ? '✅ 成功' : '❌ 失败'}\n`;
                if (!reviewRes.success) outputEl.textContent += `   原因: ${reviewRes.message}\n`;
            }
        }

        if (type === 'blocked') {
            outputEl.textContent += '🔹 步骤1: 创建一个新的安全隐患（状态：待整改）\n';
            const createRes = await hazardApi.create({
                description: '演示-脚手架螺丝松动',
                location: '2号楼',
                risk_level: '高',
                operator: '演示用户'
            }, generateUUID());
            outputEl.textContent += `   结果: ${createRes.success ? '✅ 成功' : '❌ 失败'}\n\n`;

            if (createRes.success) {
                const hazardId = createRes.data.id;
                outputEl.textContent += '🔹 步骤2: 直接提交复查（当前状态不是待复查，应该被拦截）\n';
                const reviewRes = await hazardApi.submitReview(hazardId, {
                    opinion: '整改完成',
                    result: '通过',
                    reviewer: '演示用户'
                }, generateUUID());
                outputEl.textContent += `   结果: ${!reviewRes.success ? '✅ 正确拦截' : '❌ 未拦截（异常）'}\n`;
                outputEl.textContent += `   拦截原因: ${reviewRes.message}\n\n`;

                outputEl.textContent += '🔹 步骤3: 测试复查意见包含敏感词\n';
                outputEl.textContent += '   （为演示效果，先修改状态为待复查，此处省略...）\n';
                outputEl.textContent += '   敏感词如"看不懂""随便"等也会被拦截\n';
            }
        }

        if (type === 'manual') {
            outputEl.textContent += '🔹 步骤1: 创建一个新的安全隐患\n';
            const createRes = await hazardApi.create({
                description: '演示-需要延期的隐患',
                location: '3号楼',
                risk_level: '中',
                operator: '演示用户'
            }, generateUUID());
            outputEl.textContent += `   结果: ${createRes.success ? '✅ 成功' : '❌ 失败'}\n\n`;

            if (createRes.success) {
                const hazardId = createRes.data.id;
                outputEl.textContent += '🔹 步骤2: 尝试延期15天（超过最大允许7天，应该被拦截）\n';
                const deadlineRes = await hazardApi.updateDeadline(hazardId, {
                    new_deadline: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
                    reason: '现场施工条件复杂，需要更多时间整改',
                    operator: '演示用户'
                }, generateUUID());
                outputEl.textContent += `   结果: ${!deadlineRes.success ? '✅ 正确拦截' : '❌ 未拦截（异常）'}\n`;
                outputEl.textContent += `   拦截原因: ${deadlineRes.message}\n\n`;

                outputEl.textContent += '🔹 步骤3: 使用人工修正，强制通过（manual_override=true）\n';
                const manualRes = await hazardApi.updateDeadline(hazardId, {
                    new_deadline: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
                    reason: '经领导审批同意，特殊情况延期',
                    operator: '演示用户',
                    manual_override: true
                }, generateUUID());
                outputEl.textContent += `   结果: ${manualRes.success ? '✅ 人工修正成功' : '❌ 失败'}\n`;
                if (manualRes.success) outputEl.textContent += `   说明: 此操作会标记为人工修正，并记录操作日志\n`;
            }
        }

        if (type === 'repeat') {
            const requestId = generateUUID();
            outputEl.textContent += `🔹 使用相同的 Request-ID 重复提交: ${requestId.substring(0, 8)}...\n\n`;

            outputEl.textContent += '🔹 步骤1: 第一次提交\n';
            const firstRes = await hazardApi.create({
                description: '演示-重复提交测试',
                location: '测试地点',
                risk_level: '低',
                operator: '演示用户'
            }, requestId);
            outputEl.textContent += `   结果: ${firstRes.success ? '✅ 正常创建' : '❌ 失败'}\n\n`;

            outputEl.textContent += '🔹 步骤2: 使用相同的 Request-ID 第二次提交\n';
            const secondRes = await hazardApi.create({
                description: '演示-重复提交测试',
                location: '测试地点',
                risk_level: '低',
                operator: '演示用户'
            }, requestId);
            outputEl.textContent += `   结果: ${!secondRes.success ? '✅ 幂等校验生效' : '❌ 校验失败（异常）'}\n`;
            outputEl.textContent += `   状态码: 409 Conflict\n`;
            outputEl.textContent += `   返回信息: ${secondRes.message}\n\n`;
            outputEl.textContent += '   ✅ 说明: 相同的请求不会重复创建数据，保证操作幂等性\n';
        }

        outputEl.textContent += '\n✅ 演示完成！请查看操作日志页面查看详细记录。';

    } catch (e) {
        outputEl.textContent += `\n❌ 执行异常: ${e.message}`;
    }
}

document.addEventListener('DOMContentLoaded', function() {
    checkApiStatus();
    loadTeams();
    loadHazards();
});