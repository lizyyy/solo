const API_BASE = '/api';

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toast-message');
    toastMessage.textContent = message;
    toast.className = `fixed bottom-4 right-4 px-6 py-3 rounded-lg shadow-lg ${
        type === 'error' ? 'bg-red-500' : type === 'success' ? 'bg-green-500' : 'bg-gray-800'
    } text-white`;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 3000);
}

function showModal(content) {
    document.getElementById('modal-content').innerHTML = content;
    document.getElementById('modal').classList.remove('hidden');
}

function hideModal() {
    document.getElementById('modal').classList.add('hidden');
}

document.getElementById('modal').addEventListener('click', (e) => {
    if (e.target.id === 'modal') hideModal();
});

function switchTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('[id^="tab-"]').forEach(el => {
        el.classList.remove('tab-active');
        el.classList.add('bg-white', 'text-gray-700', 'hover:bg-gray-50');
    });
    
    document.getElementById(`content-${tabName}`).classList.remove('hidden');
    const activeTab = document.getElementById(`tab-${tabName}`);
    activeTab.classList.add('tab-active');
    activeTab.classList.remove('bg-white', 'text-gray-700', 'hover:bg-gray-50');

    if (tabName === 'documents') loadDocuments();
    if (tabName === 'rules') loadRules();
    if (tabName === 'previews') loadPreviewOptions();
    if (tabName === 'versions') loadVersionOptions();
    if (tabName === 'logs') loadLogs();
}

async function loadDocuments() {
    const search = document.getElementById('doc-search').value;
    const status = document.getElementById('doc-status-filter').value;
    
    try {
        const params = new URLSearchParams();
        if (search) params.append('search', search);
        if (status) params.append('status', status);
        
        const res = await fetch(`${API_BASE}/documents?${params}`);
        const data = await res.json();
        
        const list = document.getElementById('documents-list');
        if (data.data.length === 0) {
            list.innerHTML = '<div class="text-center text-gray-500 py-8">暂无文档</div>';
            return;
        }
        
        list.innerHTML = data.data.map(doc => `
            <div class="border rounded-lg p-4 hover:shadow-md transition-shadow">
                <div class="flex justify-between items-start">
                    <div>
                        <h3 class="font-semibold text-lg">${doc.title}</h3>
                        <p class="text-sm text-gray-500 mt-1">
                            ID: ${doc.id} | 类型: ${doc.file_type} | 责任节点: ${doc.responsibility_node || '-'}
                        </p>
                        <p class="text-xs text-gray-400 mt-1">创建于: ${doc.created_at}</p>
                    </div>
                    <div class="flex gap-2 items-center">
                        <span class="px-2 py-1 rounded text-xs status-${doc.status}">${doc.status}</span>
                        <button onclick="viewDocument(${doc.id})" class="text-blue-500 hover:text-blue-700">查看</button>
                        <button onclick="updateDocumentStatus(${doc.id})" class="text-green-500 hover:text-green-700">状态</button>
                        <button onclick="deleteDocument(${doc.id})" class="text-red-500 hover:text-red-700">删除</button>
                    </div>
                </div>
            </div>
        `).join('');
    } catch (err) {
        showToast('加载文档失败', 'error');
    }
}

function showCreateDocumentModal() {
    showModal(`
        <h3 class="text-xl font-semibold mb-4">新建文档</h3>
        <form onsubmit="createDocument(event)">
            <div class="mb-4">
                <label class="block text-sm font-medium text-gray-700 mb-1">文档标题</label>
                <input type="text" id="new-doc-title" required class="w-full border rounded-lg px-4 py-2">
            </div>
            <div class="mb-4">
                <label class="block text-sm font-medium text-gray-700 mb-1">文档内容 (Markdown)</label>
                <textarea id="new-doc-content" rows="10" required class="w-full border rounded-lg px-4 py-2"></textarea>
            </div>
            <div class="mb-4">
                <label class="block text-sm font-medium text-gray-700 mb-1">责任节点</label>
                <input type="text" id="new-doc-responsibility" class="w-full border rounded-lg px-4 py-2">
            </div>
            <div class="flex gap-2 justify-end">
                <button type="button" onclick="hideModal()" class="px-4 py-2 border rounded-lg hover:bg-gray-50">取消</button>
                <button type="submit" class="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600">创建</button>
            </div>
        </form>
    `);
}

async function createDocument(e) {
    e.preventDefault();
    const title = document.getElementById('new-doc-title').value;
    const content = document.getElementById('new-doc-content').value;
    const responsibility_node = document.getElementById('new-doc-responsibility').value;
    
    try {
        const res = await fetch(`${API_BASE}/documents`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, content, file_type: 'markdown', responsibility_node })
        });
        const data = await res.json();
        
        if (res.ok) {
            showToast('文档创建成功', 'success');
            hideModal();
            loadDocuments();
        } else {
            showToast(data.error || '创建失败', 'error');
        }
    } catch (err) {
        showToast('创建失败', 'error');
    }
}

async function viewDocument(id) {
    try {
        const res = await fetch(`${API_BASE}/documents/${id}`);
        const doc = await res.json();
        
        showModal(`
            <h3 class="text-xl font-semibold mb-4">${doc.title}</h3>
            <div class="mb-4 text-sm text-gray-500">
                ID: ${doc.id} | 状态: ${doc.status} | 责任节点: ${doc.responsibility_node || '-'}
            </div>
            <div class="bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto">
                <pre class="text-sm">${doc.content}</pre>
            </div>
            <div class="flex justify-end mt-4">
                <button onclick="hideModal()" class="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600">关闭</button>
            </div>
        `);
    } catch (err) {
        showToast('加载文档失败', 'error');
    }
}

function updateDocumentStatus(id) {
    showModal(`
        <h3 class="text-xl font-semibold mb-4">更新文档状态</h3>
        <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-1">选择状态</label>
            <select id="update-doc-status" class="w-full border rounded-lg px-4 py-2">
                <option value="draft">草稿</option>
                <option value="processing">处理中</option>
                <option value="completed">已完成</option>
                <option value="archived">已归档</option>
            </select>
        </div>
        <div class="flex gap-2 justify-end">
            <button onclick="hideModal()" class="px-4 py-2 border rounded-lg hover:bg-gray-50">取消</button>
            <button onclick="submitDocumentStatus(${id})" class="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600">更新</button>
        </div>
    `);
}

async function submitDocumentStatus(id) {
    const status = document.getElementById('update-doc-status').value;
    try {
        const res = await fetch(`${API_BASE}/documents/${id}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
        });
        
        if (res.ok) {
            showToast('状态更新成功', 'success');
            hideModal();
            loadDocuments();
        } else {
            showToast('更新失败', 'error');
        }
    } catch (err) {
        showToast('更新失败', 'error');
    }
}

async function deleteDocument(id) {
    if (!confirm('确定删除此文档？')) return;
    
    try {
        const res = await fetch(`${API_BASE}/documents/${id}`, { method: 'DELETE' });
        if (res.ok) {
            showToast('删除成功', 'success');
            loadDocuments();
        } else {
            showToast('删除失败', 'error');
        }
    } catch (err) {
        showToast('删除失败', 'error');
    }
}

async function loadRules() {
    const search = document.getElementById('rule-search').value;
    const status = document.getElementById('rule-status-filter').value;
    
    try {
        const params = new URLSearchParams();
        if (search) params.append('search', search);
        if (status) params.append('status', status);
        
        const res = await fetch(`${API_BASE}/rules?${params}`);
        const data = await res.json();
        
        const list = document.getElementById('rules-list');
        if (data.data.length === 0) {
            list.innerHTML = '<div class="text-center text-gray-500 py-8">暂无规则</div>';
            return;
        }
        
        list.innerHTML = data.data.map(rule => `
            <div class="border rounded-lg p-4 hover:shadow-md transition-shadow">
                <div class="flex justify-between items-start">
                    <div>
                        <h3 class="font-semibold text-lg">${rule.name} <span class="text-sm text-gray-500">v${rule.version}</span></h3>
                        <p class="text-sm text-gray-600 mt-1">${rule.description || '-'}</p>
                        <div class="mt-2 flex flex-wrap gap-2 text-xs">
                            <span class="bg-blue-100 text-blue-700 px-2 py-1 rounded">切片: ${rule.min_chunk_length}-${rule.max_chunk_length}字</span>
                            <span class="bg-green-100 text-green-700 px-2 py-1 rounded">重叠: ${rule.overlap_size}字</span>
                            <span class="bg-purple-100 text-purple-700 px-2 py-1 rounded">标题${rule.inherit_headers ? '继承' : '不继承'}</span>
                            <span class="bg-orange-100 text-orange-700 px-2 py-1 rounded">表格${rule.preserve_tables ? '保留' : '不保留'}</span>
                        </div>
                        ${rule.effect_remark ? `<p class="text-sm text-gray-500 mt-2">效果备注: ${rule.effect_remark}</p>` : ''}
                    </div>
                    <div class="flex gap-2 items-center">
                        <span class="px-2 py-1 rounded text-xs status-${rule.status}">${rule.status}</span>
                        <button onclick="editRule(${rule.id})" class="text-blue-500 hover:text-blue-700">编辑</button>
                        <button onclick="updateRuleStatus(${rule.id})" class="text-green-500 hover:text-green-700">状态</button>
                        <button onclick="deleteRule(${rule.id})" class="text-red-500 hover:text-red-700">删除</button>
                    </div>
                </div>
            </div>
        `).join('');
    } catch (err) {
        showToast('加载规则失败', 'error');
    }
}

function showCreateRuleModal() {
    showModal(`
        <h3 class="text-xl font-semibold mb-4">新建切片规则</h3>
        <form onsubmit="createRule(event)">
            <div class="mb-4">
                <label class="block text-sm font-medium text-gray-700 mb-1">规则名称</label>
                <input type="text" id="new-rule-name" required class="w-full border rounded-lg px-4 py-2">
            </div>
            <div class="mb-4">
                <label class="block text-sm font-medium text-gray-700 mb-1">描述</label>
                <textarea id="new-rule-desc" rows="2" class="w-full border rounded-lg px-4 py-2"></textarea>
            </div>
            <div class="grid grid-cols-2 gap-4 mb-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">最小切片长度</label>
                    <input type="number" id="new-rule-min" value="100" class="w-full border rounded-lg px-4 py-2">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">最大切片长度</label>
                    <input type="number" id="new-rule-max" value="500" class="w-full border rounded-lg px-4 py-2">
                </div>
            </div>
            <div class="grid grid-cols-2 gap-4 mb-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">重叠长度</label>
                    <input type="number" id="new-rule-overlap" value="50" class="w-full border rounded-lg px-4 py-2">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">标题层级</label>
                    <input type="number" id="new-rule-heading-level" value="3" class="w-full border rounded-lg px-4 py-2">
                </div>
            </div>
            <div class="grid grid-cols-2 gap-4 mb-4">
                <div>
                    <label class="flex items-center">
                        <input type="checkbox" id="new-rule-inherit-headers" checked class="mr-2">
                        继承标题路径
                    </label>
                </div>
                <div>
                    <label class="flex items-center">
                        <input type="checkbox" id="new-rule-preserve-tables" checked class="mr-2">
                        保留表格结构
                    </label>
                </div>
            </div>
            <div class="mb-4">
                <label class="block text-sm font-medium text-gray-700 mb-1">效果备注</label>
                <input type="text" id="new-rule-effect" class="w-full border rounded-lg px-4 py-2">
            </div>
            <div class="flex gap-2 justify-end">
                <button type="button" onclick="hideModal()" class="px-4 py-2 border rounded-lg hover:bg-gray-50">取消</button>
                <button type="submit" class="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600">创建</button>
            </div>
        </form>
    `);
}

async function createRule(e) {
    e.preventDefault();
    const ruleData = {
        name: document.getElementById('new-rule-name').value,
        description: document.getElementById('new-rule-desc').value,
        min_chunk_length: parseInt(document.getElementById('new-rule-min').value),
        max_chunk_length: parseInt(document.getElementById('new-rule-max').value),
        overlap_size: parseInt(document.getElementById('new-rule-overlap').value),
        heading_hierarchy_level: parseInt(document.getElementById('new-rule-heading-level').value),
        inherit_headers: document.getElementById('new-rule-inherit-headers').checked ? 1 : 0,
        preserve_tables: document.getElementById('new-rule-preserve-tables').checked ? 1 : 0,
        effect_remark: document.getElementById('new-rule-effect').value
    };
    
    try {
        const res = await fetch(`${API_BASE}/rules`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(ruleData)
        });
        const data = await res.json();
        
        if (res.ok) {
            showToast('规则创建成功', 'success');
            hideModal();
            loadRules();
        } else {
            showToast(data.error || '创建失败', 'error');
        }
    } catch (err) {
        showToast('创建失败', 'error');
    }
}

async function editRule(id) {
    try {
        const res = await fetch(`${API_BASE}/rules/${id}`);
        const rule = await res.json();
        
        showModal(`
            <h3 class="text-xl font-semibold mb-4">编辑规则: ${rule.name}</h3>
            <form onsubmit="submitEditRule(event, ${id})">
                <div class="mb-4">
                    <label class="block text-sm font-medium text-gray-700 mb-1">规则名称</label>
                    <input type="text" id="edit-rule-name" value="${rule.name}" required class="w-full border rounded-lg px-4 py-2">
                </div>
                <div class="mb-4">
                    <label class="block text-sm font-medium text-gray-700 mb-1">描述</label>
                    <textarea id="edit-rule-desc" rows="2" class="w-full border rounded-lg px-4 py-2">${rule.description || ''}</textarea>
                </div>
                <div class="grid grid-cols-2 gap-4 mb-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">最小切片长度</label>
                        <input type="number" id="edit-rule-min" value="${rule.min_chunk_length}" class="w-full border rounded-lg px-4 py-2">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">最大切片长度</label>
                        <input type="number" id="edit-rule-max" value="${rule.max_chunk_length}" class="w-full border rounded-lg px-4 py-2">
                    </div>
                </div>
                <div class="grid grid-cols-2 gap-4 mb-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">重叠长度</label>
                        <input type="number" id="edit-rule-overlap" value="${rule.overlap_size}" class="w-full border rounded-lg px-4 py-2">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">标题层级</label>
                        <input type="number" id="edit-rule-heading-level" value="${rule.heading_hierarchy_level}" class="w-full border rounded-lg px-4 py-2">
                    </div>
                </div>
                <div class="grid grid-cols-2 gap-4 mb-4">
                    <div>
                        <label class="flex items-center">
                            <input type="checkbox" id="edit-rule-inherit-headers" ${rule.inherit_headers ? 'checked' : ''} class="mr-2">
                            继承标题路径
                        </label>
                    </div>
                    <div>
                        <label class="flex items-center">
                            <input type="checkbox" id="edit-rule-preserve-tables" ${rule.preserve_tables ? 'checked' : ''} class="mr-2">
                            保留表格结构
                        </label>
                    </div>
                </div>
                <div class="mb-4">
                    <label class="block text-sm font-medium text-gray-700 mb-1">效果备注</label>
                    <input type="text" id="edit-rule-effect" value="${rule.effect_remark || ''}" class="w-full border rounded-lg px-4 py-2">
                </div>
                <div class="flex gap-2 justify-end">
                    <button type="button" onclick="hideModal()" class="px-4 py-2 border rounded-lg hover:bg-gray-50">取消</button>
                    <button type="submit" class="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600">保存</button>
                </div>
            </form>
        `);
    } catch (err) {
        showToast('加载规则失败', 'error');
    }
}

async function submitEditRule(e, id) {
    e.preventDefault();
    const ruleData = {
        name: document.getElementById('edit-rule-name').value,
        description: document.getElementById('edit-rule-desc').value,
        min_chunk_length: parseInt(document.getElementById('edit-rule-min').value),
        max_chunk_length: parseInt(document.getElementById('edit-rule-max').value),
        overlap_size: parseInt(document.getElementById('edit-rule-overlap').value),
        heading_hierarchy_level: parseInt(document.getElementById('edit-rule-heading-level').value),
        inherit_headers: document.getElementById('edit-rule-inherit-headers').checked ? 1 : 0,
        preserve_tables: document.getElementById('edit-rule-preserve-tables').checked ? 1 : 0,
        effect_remark: document.getElementById('edit-rule-effect').value
    };
    
    try {
        const res = await fetch(`${API_BASE}/rules/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(ruleData)
        });
        
        if (res.ok) {
            showToast('规则更新成功', 'success');
            hideModal();
            loadRules();
        } else {
            showToast('更新失败', 'error');
        }
    } catch (err) {
        showToast('更新失败', 'error');
    }
}

function updateRuleStatus(id) {
    showModal(`
        <h3 class="text-xl font-semibold mb-4">更新规则状态</h3>
        <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-1">选择状态</label>
            <select id="update-rule-status" class="w-full border rounded-lg px-4 py-2">
                <option value="draft">草稿</option>
                <option value="testing">测试中</option>
                <option value="approved">已批准</option>
                <option value="published">已发布</option>
                <option value="deprecated">已废弃</option>
            </select>
        </div>
        <div class="flex gap-2 justify-end">
            <button onclick="hideModal()" class="px-4 py-2 border rounded-lg hover:bg-gray-50">取消</button>
            <button onclick="submitRuleStatus(${id})" class="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600">更新</button>
        </div>
    `);
}

async function submitRuleStatus(id) {
    const status = document.getElementById('update-rule-status').value;
    try {
        const res = await fetch(`${API_BASE}/rules/${id}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
        });
        
        if (res.ok) {
            showToast('状态更新成功', 'success');
            hideModal();
            loadRules();
        } else {
            showToast('更新失败', 'error');
        }
    } catch (err) {
        showToast('更新失败', 'error');
    }
}

async function deleteRule(id) {
    if (!confirm('确定删除此规则？')) return;
    
    try {
        const res = await fetch(`${API_BASE}/rules/${id}`, { method: 'DELETE' });
        if (res.ok) {
            showToast('删除成功', 'success');
            loadRules();
        } else {
            showToast('删除失败', 'error');
        }
    } catch (err) {
        showToast('删除失败', 'error');
    }
}

async function loadPreviewOptions() {
    try {
        const [docsRes, rulesRes] = await Promise.all([
            fetch(`${API_BASE}/documents`),
            fetch(`${API_BASE}/rules`)
        ]);
        const docsData = await docsRes.json();
        const rulesData = await rulesRes.json();
        
        const docSelect = document.getElementById('preview-document');
        docSelect.innerHTML = '<option value="">请选择文档</option>' +
            docsData.data.map(d => `<option value="${d.id}">${d.title}</option>`).join('');
        
        const ruleSelect = document.getElementById('preview-rule');
        ruleSelect.innerHTML = '<option value="">请选择规则</option>' +
            rulesData.data.map(r => `<option value="${r.id}">${r.name} (v${r.version})</option>`).join('');
    } catch (err) {
        showToast('加载选项失败', 'error');
    }
}

async function generatePreview() {
    const documentId = document.getElementById('preview-document').value;
    const ruleId = document.getElementById('preview-rule').value;
    
    if (!documentId || !ruleId) {
        showToast('请选择文档和规则', 'error');
        return;
    }
    
    try {
        showToast('正在生成切片...', 'info');
        const res = await fetch(`${API_BASE}/previews/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ document_id: parseInt(documentId), rule_id: parseInt(ruleId) })
        });
        const data = await res.json();
        
        if (res.ok) {
            showToast(`生成成功! 共 ${data.slices_count} 个切片`, 'success');
            loadPreviews(documentId, ruleId);
        } else {
            showToast(data.error || '生成失败', 'error');
        }
    } catch (err) {
        showToast('生成失败', 'error');
    }
}

async function loadPreviews(documentId, ruleId) {
    try {
        const res = await fetch(`${API_BASE}/previews?document_id=${documentId}&rule_id=${ruleId}`);
        const data = await res.json();
        
        const list = document.getElementById('previews-list');
        if (data.data.length === 0) {
            list.innerHTML = '<div class="text-center text-gray-500 py-8">暂无切片预览</div>';
            return;
        }
        
        list.innerHTML = data.data.map((slice, idx) => `
            <div class="border rounded-lg p-4 hover:shadow-md transition-shadow">
                <div class="flex justify-between items-start mb-2">
                    <div>
                        <span class="font-semibold">切片 ${idx + 1}</span>
                        <span class="text-sm text-gray-500 ml-2">长度: ${slice.chunk_length} 字符</span>
                        ${slice.heading_path ? `<span class="text-sm text-purple-600 ml-2">📎 ${slice.heading_path}</span>` : ''}
                        ${slice.has_table ? '<span class="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded ml-2">含表格</span>' : ''}
                    </div>
                    <span class="text-sm text-green-600">质量分: ${(slice.quality_score * 100).toFixed(0)}%</span>
                </div>
                <div class="bg-gray-50 rounded p-3 text-sm max-h-40 overflow-y-auto">
                    <pre>${slice.content}</pre>
                </div>
            </div>
        `).join('');
    } catch (err) {
        showToast('加载预览失败', 'error');
    }
}

async function loadVersionOptions() {
    try {
        const res = await fetch(`${API_BASE}/rules`);
        const data = await res.json();
        
        const select = document.getElementById('version-rule');
        select.innerHTML = '<option value="">请选择规则</option>' +
            data.data.map(r => `<option value="${r.id}">${r.name} (v${r.version})</option>`).join('');
    } catch (err) {
        showToast('加载规则失败', 'error');
    }
}

async function loadVersions() {
    const ruleId = document.getElementById('version-rule').value;
    if (!ruleId) {
        document.getElementById('versions-list').innerHTML = '';
        return;
    }
    
    try {
        const res = await fetch(`${API_BASE}/versions?rule_id=${ruleId}`);
        const data = await res.json();
        
        const list = document.getElementById('versions-list');
        if (data.data.length === 0) {
            list.innerHTML = '<div class="text-center text-gray-500 py-8">暂无发布版本</div>';
            return;
        }
        
        list.innerHTML = data.data.map(v => `
            <div class="border rounded-lg p-4 hover:shadow-md transition-shadow ${v.is_active ? 'border-green-500 bg-green-50' : ''}">
                <div class="flex justify-between items-start">
                    <div>
                        <h3 class="font-semibold text-lg">
                            ${v.version_tag}
                            ${v.is_active ? '<span class="text-sm bg-green-500 text-white px-2 py-1 rounded ml-2">当前激活</span>' : ''}
                        </h3>
                        <p class="text-sm text-gray-600 mt-1">${v.description || '-'}</p>
                        <p class="text-xs text-gray-400 mt-1">发布于: ${v.created_at} | 发布者: ${v.published_by || 'system'}</p>
                        <div class="mt-2 flex flex-wrap gap-2 text-xs">
                            <span class="bg-blue-100 text-blue-700 px-2 py-1 rounded">切片: ${v.config_snapshot.min_chunk_length}-${v.config_snapshot.max_chunk_length}字</span>
                            <span class="bg-green-100 text-green-700 px-2 py-1 rounded">重叠: ${v.config_snapshot.overlap_size}字</span>
                        </div>
                    </div>
                    ${!v.is_active ? `
                        <button onclick="rollbackVersion(${v.id})" class="text-orange-500 hover:text-orange-700">回滚到此版本</button>
                    ` : ''}
                </div>
            </div>
        `).join('');
    } catch (err) {
        showToast('加载版本失败', 'error');
    }
}

function showPublishModal() {
    const ruleId = document.getElementById('version-rule').value;
    if (!ruleId) {
        showToast('请先选择规则', 'error');
        return;
    }
    
    showModal(`
        <h3 class="text-xl font-semibold mb-4">发布新版本</h3>
        <form onsubmit="publishVersion(event)">
            <div class="mb-4">
                <label class="block text-sm font-medium text-gray-700 mb-1">版本标签 (如: v1.0.1)</label>
                <input type="text" id="publish-version-tag" required class="w-full border rounded-lg px-4 py-2">
            </div>
            <div class="mb-4">
                <label class="block text-sm font-medium text-gray-700 mb-1">版本描述</label>
                <textarea id="publish-version-desc" rows="2" class="w-full border rounded-lg px-4 py-2"></textarea>
            </div>
            <div class="mb-4">
                <label class="block text-sm font-medium text-gray-700 mb-1">发布者</label>
                <input type="text" id="publish-by" value="system" class="w-full border rounded-lg px-4 py-2">
            </div>
            <div class="flex gap-2 justify-end">
                <button type="button" onclick="hideModal()" class="px-4 py-2 border rounded-lg hover:bg-gray-50">取消</button>
                <button type="submit" class="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600">发布</button>
            </div>
        </form>
    `);
}

async function publishVersion(e) {
    e.preventDefault();
    const ruleId = document.getElementById('version-rule').value;
    
    const versionData = {
        rule_id: parseInt(ruleId),
        version_tag: document.getElementById('publish-version-tag').value,
        description: document.getElementById('publish-version-desc').value,
        published_by: document.getElementById('publish-by').value
    };
    
    try {
        const res = await fetch(`${API_BASE}/versions/publish`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(versionData)
        });
        const data = await res.json();
        
        if (res.ok) {
            showToast('版本发布成功', 'success');
            hideModal();
            loadVersions();
            loadRules();
        } else {
            showToast(data.error || '发布失败', 'error');
        }
    } catch (err) {
        showToast('发布失败', 'error');
    }
}

async function rollbackVersion(versionId) {
    if (!confirm('确定回滚到此版本？这将覆盖当前规则配置。')) return;
    
    try {
        const res = await fetch(`${API_BASE}/versions/rollback`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ version_id: versionId })
        });
        
        if (res.ok) {
            showToast('回滚成功', 'success');
            loadVersions();
            loadRules();
        } else {
            showToast('回滚失败', 'error');
        }
    } catch (err) {
        showToast('回滚失败', 'error');
    }
}

async function loadLogs() {
    const status = document.getElementById('log-status-filter').value;
    
    try {
        const params = new URLSearchParams();
        if (status) params.append('status', status);
        
        const res = await fetch(`${API_BASE}/export/logs?${params}`);
        const data = await res.json();
        
        const list = document.getElementById('logs-list');
        if (data.data.length === 0) {
            list.innerHTML = '<div class="text-center text-gray-500 py-8">暂无日志</div>';
            return;
        }
        
        list.innerHTML = data.data.map(log => `
            <div class="border rounded-lg p-3 flex items-center gap-4 ${log.status === 'error' ? 'bg-red-50' : ''}">
                <span class="text-lg">${log.status === 'success' ? '✅' : '❌'}</span>
                <div class="flex-1">
                    <div class="font-mono text-sm">${log.method} ${log.endpoint}</div>
                    <div class="text-xs text-gray-500">
                        责任节点: ${log.responsibility_node || '-'} | 
                        耗时: ${log.duration_ms}ms | 
                        ${log.created_at}
                    </div>
                    ${log.error_message ? `<div class="text-xs text-red-600 mt-1">错误: ${log.error_message}</div>` : ''}
                </div>
                <span class="px-2 py-1 rounded text-xs ${log.status === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}">
                    ${log.status}
                </span>
            </div>
        `).join('');
    } catch (err) {
        showToast('加载日志失败', 'error');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    loadDocuments();
});
