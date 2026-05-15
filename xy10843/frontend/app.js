const API_BASE = '/api';
let currentAnnotators = [];
let currentSamples = [];

document.addEventListener('DOMContentLoaded', () => {
    loadStatistics();
    loadSamples();
    loadTasks();
    loadSkips();
    loadReworks();
    loadAnnotators();
});

function showSection(sectionId) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    
    document.getElementById(sectionId).classList.add('active');
    event.target.classList.add('active');
    
    if (sectionId === 'samples') loadSamples();
    if (sectionId === 'tasks') loadTasks();
    if (sectionId === 'skips') loadSkips();
    if (sectionId === 'reworks') loadReworks();
    if (sectionId === 'annotators') loadAnnotators();
}

async function loadStatistics() {
    try {
        const res = await fetch(`${API_BASE}/statistics`);
        const stats = await res.json();
        const statsGrid = document.getElementById('statsGrid');
        
        statsGrid.innerHTML = `
            <div class="stat-card">
                <h3>总样本数</h3>
                <div class="number">${stats.total_samples}</div>
            </div>
            <div class="stat-card">
                <h3>待分配</h3>
                <div class="number">${stats.pending_samples}</div>
            </div>
            <div class="stat-card">
                <h3>已完成</h3>
                <div class="number">${stats.completed_samples}</div>
            </div>
            <div class="stat-card">
                <h3>待复核跳过</h3>
                <div class="number">${stats.pending_skips}</div>
            </div>
            <div class="stat-card">
                <h3>待返工</h3>
                <div class="number">${stats.pending_reworks}</div>
            </div>
        `;
    } catch (e) {
        console.error('Failed to load statistics:', e);
    }
}

async function loadSamples() {
    try {
        const status = document.getElementById('sampleStatusFilter').value;
        const url = status ? `${API_BASE}/samples?status=${status}` : `${API_BASE}/samples`;
        const res = await fetch(url);
        const samples = await res.json();
        currentSamples = samples;
        
        const tbody = document.getElementById('samplesTable');
        tbody.innerHTML = samples.map(s => `
            <tr>
                <td>${s.id}</td>
                <td>${s.content.substring(0, 50)}...</td>
                <td><span class="status-badge status-${s.status}">${getStatusText(s.status)}</span></td>
                <td>${s.current_annotation ? s.current_annotation.substring(0, 30) + '...' : '-'}</td>
                <td>
                    <button class="action-btn view" onclick="viewSample(${s.id})">查看</button>
                </td>
            </tr>
        `).join('');
    } catch (e) {
        console.error('Failed to load samples:', e);
    }
}

async function loadTasks() {
    try {
        const status = document.getElementById('taskStatusFilter').value;
        const url = status ? `${API_BASE}/tasks?status=${status}` : `${API_BASE}/tasks`;
        const res = await fetch(url);
        const tasks = await res.json();
        
        const annotatorsRes = await fetch(`${API_BASE}/annotators`);
        const annotators = await annotatorsRes.json();
        const annotatorMap = {};
        annotators.forEach(a => annotatorMap[a.id] = a.name);
        
        const tbody = document.getElementById('tasksTable');
        tbody.innerHTML = tasks.map(t => `
            <tr>
                <td>${t.id}</td>
                <td>${t.name}</td>
                <td>${annotatorMap[t.annotator_id] || t.annotator_id}</td>
                <td><span class="status-badge status-${t.status}">${getStatusText(t.status)}</span></td>
                <td>${new Date(t.assigned_at).toLocaleString('zh-CN')}</td>
                <td>
                    <button class="action-btn view" onclick="viewTask(${t.id})">查看</button>
                </td>
            </tr>
        `).join('');
    } catch (e) {
        console.error('Failed to load tasks:', e);
    }
}

async function loadSkips() {
    try {
        const reviewed = document.getElementById('skipReviewFilter').value;
        let url = `${API_BASE}/skips`;
        if (reviewed !== '') url += `?reviewed=${reviewed}`;
        
        const res = await fetch(url);
        const skips = await res.json();
        
        const tbody = document.getElementById('skipsTable');
        tbody.innerHTML = skips.map(s => `
            <tr>
                <td>${s.id}</td>
                <td>${s.sample_id}</td>
                <td>${s.reason.substring(0, 30)}...</td>
                <td>${s.reviewed ? '已复核' : '待复核'}</td>
                <td>${s.review_result ? getReviewResultText(s.review_result) : '-'}</td>
                <td>${new Date(s.created_at).toLocaleString('zh-CN')}</td>
                <td>
                    ${!s.reviewed ? `<button class="action-btn review" onclick="reviewSkip(${s.id})">复核</button>` : '<button class="action-btn view" onclick="viewSkip(' + s.id + ')">查看</button>'}
                </td>
            </tr>
        `).join('');
    } catch (e) {
        console.error('Failed to load skips:', e);
    }
}

async function loadReworks() {
    try {
        const status = document.getElementById('reworkStatusFilter').value;
        const url = status ? `${API_BASE}/reworks?status=${status}` : `${API_BASE}/reworks`;
        const res = await fetch(url);
        const reworks = await res.json();
        
        const tbody = document.getElementById('reworksTable');
        tbody.innerHTML = reworks.map(r => `
            <tr>
                <td>${r.id}</td>
                <td>${r.sample_id}</td>
                <td>${r.original_annotation.substring(0, 30)}...</td>
                <td>${r.reason.substring(0, 30)}...</td>
                <td><span class="status-badge status-${r.status}">${getStatusText(r.status)}</span></td>
                <td>${new Date(r.created_at).toLocaleString('zh-CN')}</td>
                <td>
                    ${r.status === 'pending' ? 
                        `<button class="action-btn complete" onclick="completeRework(${r.id})">完成返工</button>` : 
                        `<button class="action-btn view" onclick="viewRework(${r.id})">查看</button>`}
                </td>
            </tr>
        `).join('');
    } catch (e) {
        console.error('Failed to load reworks:', e);
    }
}

async function loadAnnotators() {
    try {
        const res = await fetch(`${API_BASE}/annotators`);
        const annotators = await res.json();
        currentAnnotators = annotators;
        
        const tbody = document.getElementById('annotatorsTable');
        tbody.innerHTML = annotators.map(a => `
            <tr>
                <td>${a.id}</td>
                <td>${a.name}</td>
                <td>${a.email}</td>
                <td><span class="status-badge status-${a.is_active ? 'completed' : 'skipped'}">${a.is_active ? '活跃' : '禁用'}</span></td>
                <td>${new Date(a.created_at).toLocaleString('zh-CN')}</td>
            </tr>
        `).join('');
    } catch (e) {
        console.error('Failed to load annotators:', e);
    }
}

function getStatusText(status) {
    const map = {
        'pending': '待分配',
        'assigned': '已分配',
        'completed': '已完成',
        'skipped': '已跳过',
        'rework': '待返工'
    };
    return map[status] || status;
}

function getReviewResultText(result) {
    const map = {
        'reassign': '重新分配',
        'accept': '接受跳过'
    };
    return map[result] || result;
}

function showModal(content) {
    document.getElementById('modalBody').innerHTML = content;
    document.getElementById('modal').style.display = 'block';
}

function closeModal() {
    document.getElementById('modal').style.display = 'none';
}

async function viewSample(id) {
    try {
        const res = await fetch(`${API_BASE}/samples/${id}`);
        const sample = await res.json();
        
        showModal(`
            <h3>样本详情 #${sample.id}</h3>
            <div class="detail-item">
                <label>内容</label>
                <div class="sample-content">${sample.content}</div>
            </div>
            <div class="detail-item">
                <label>原始标注</label>
                <div class="value">${sample.original_annotation || '-'}</div>
            </div>
            <div class="detail-item">
                <label>当前标注</label>
                <div class="value">${sample.current_annotation || '-'}</div>
            </div>
            <div class="detail-item">
                <label>状态</label>
                <div class="value"><span class="status-badge status-${sample.status}">${getStatusText(sample.status)}</span></div>
            </div>
            <div class="detail-item">
                <label>创建时间</label>
                <div class="value">${new Date(sample.created_at).toLocaleString('zh-CN')}</div>
            </div>
            <div class="form-actions">
                <button class="cancel-btn" onclick="closeModal()">关闭</button>
                ${sample.status === 'completed' ? `<button class="submit-btn" onclick="createReworkForSample(${sample.id}, '${sample.current_annotation}')">申请返工</button>` : ''}
            </div>
        `);
    } catch (e) {
        alert('加载样本失败');
    }
}

async function createReworkForSample(sampleId, currentAnnotation) {
    const reason = prompt('请输入返工原因：');
    if (!reason) return;
    
    try {
        const res = await fetch(`${API_BASE}/reworks/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sample_id: sampleId,
                requester_id: 1,
                original_annotation: currentAnnotation,
                reason: reason
            })
        });
        
        if (res.ok) {
            alert('返工申请已创建');
            closeModal();
            loadStatistics();
            loadSamples();
            loadReworks();
        } else {
            alert('创建失败');
        }
    } catch (e) {
        alert('创建失败');
    }
}

async function viewTask(id) {
    try {
        const [taskRes, itemsRes] = await Promise.all([
            fetch(`${API_BASE}/tasks/${id}`),
            fetch(`${API_BASE}/tasks/${id}/items`)
        ]);
        const task = await taskRes.json();
        const items = await itemsRes.json();
        
        const annotator = currentAnnotators.find(a => a.id === task.annotator_id);
        
        let itemsHtml = items.map((item, idx) => `
            <div class="detail-item" style="margin-bottom: 10px; padding: 10px;">
                <strong>样本 #${idx + 1} (ID: ${item.sample_id})</strong>
                <div style="margin-top: 8px;">
                    <label>状态：</label>
                    <span class="status-badge status-${item.status}">${getStatusText(item.status)}</span>
                </div>
                ${item.status === 'completed' ? `
                    <div style="margin-top: 8px;">
                        <label>标注结果：</label>
                        <div>${item.annotation_result}</div>
                    </div>
                ` : item.status === 'assigned' ? `
                    <div style="margin-top: 10px;">
                        <textarea id="annotation-${item.id}" placeholder="输入标注结果" rows="3" style="width: 100%; padding: 8px;"></textarea>
                        <button class="action-btn view" style="margin-top: 8px;" onclick="submitTaskItemAnnotation(${item.id})">提交标注</button>
                        <button class="action-btn" style="margin-top: 8px; background: #e74c3c; color: white;" onclick="skipTaskItem(${item.sample_id}, ${task.annotator_id})">跳过样本</button>
                    </div>
                ` : ''}
            </div>
        `).join('');
        
        showModal(`
            <h3>任务包详情 #${task.id}</h3>
            <div class="detail-item">
                <label>任务名称</label>
                <div class="value">${task.name}</div>
            </div>
            <div class="detail-item">
                <label>标注员</label>
                <div class="value">${annotator ? annotator.name : task.annotator_id}</div>
            </div>
            <div class="detail-item">
                <label>状态</label>
                <div class="value"><span class="status-badge status-${task.status}">${getStatusText(task.status)}</span></div>
            </div>
            <div class="detail-item">
                <label>样本列表</label>
                <div>${itemsHtml}</div>
            </div>
            <div class="form-actions">
                <button class="cancel-btn" onclick="closeModal()">关闭</button>
            </div>
        `);
    } catch (e) {
        alert('加载任务失败');
    }
}

async function submitTaskItemAnnotation(itemId) {
    const annotation = document.getElementById(`annotation-${itemId}`).value;
    if (!annotation) {
        alert('请输入标注结果');
        return;
    }
    
    try {
        const res = await fetch(`${API_BASE}/tasks/items/${itemId}/submit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ annotation_result: annotation })
        });
        
        if (res.ok) {
            alert('标注提交成功');
            closeModal();
            loadStatistics();
            loadTasks();
            loadSamples();
        } else {
            const data = await res.json();
            alert(data.detail || '提交失败');
        }
    } catch (e) {
        alert('提交失败');
    }
}

async function skipTaskItem(sampleId, annotatorId) {
    const reason = prompt('请输入跳过原因：');
    if (!reason) return;
    
    try {
        const res = await fetch(`${API_BASE}/skips/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sample_id: sampleId,
                annotator_id: annotatorId,
                reason: reason
            })
        });
        
        if (res.ok) {
            alert('跳过记录已创建');
            closeModal();
            loadStatistics();
            loadTasks();
            loadSamples();
            loadSkips();
        } else {
            alert('创建失败');
        }
    } catch (e) {
        alert('创建失败');
    }
}

async function reviewSkip(id) {
    try {
        const res = await fetch(`${API_BASE}/skips/${id}`);
        const skip = await res.json();
        
        showModal(`
            <h3>复核跳过记录 #${skip.id}</h3>
            <div class="detail-item">
                <label>样本ID</label>
                <div class="value">${skip.sample_id}</div>
            </div>
            <div class="detail-item">
                <label>跳过原因</label>
                <div class="value">${skip.reason}</div>
            </div>
            <div class="detail-item">
                <label>样本内容</label>
                <div class="sample-content">${skip.sample ? skip.sample.content : '加载中...'}</div>
            </div>
            <div class="form-group">
                <label>复核结果</label>
                <select id="reviewResult">
                    <option value="reassign">重新分配</option>
                    <option value="accept">接受跳过</option>
                </select>
            </div>
            <div class="form-group">
                <label>复核备注</label>
                <textarea id="reviewNote" rows="3"></textarea>
            </div>
            <div class="form-actions">
                <button class="cancel-btn" onclick="closeModal()">取消</button>
                <button class="submit-btn" onclick="submitSkipReview(${skip.id})">提交复核</button>
            </div>
        `);
    } catch (e) {
        alert('加载失败');
    }
}

async function viewSkip(id) {
    try {
        const res = await fetch(`${API_BASE}/skips/${id}`);
        const skip = await res.json();
        
        showModal(`
            <h3>跳过记录详情 #${skip.id}</h3>
            <div class="detail-item">
                <label>样本ID</label>
                <div class="value">${skip.sample_id}</div>
            </div>
            <div class="detail-item">
                <label>跳过原因</label>
                <div class="value">${skip.reason}</div>
            </div>
            <div class="detail-item">
                <label>复核状态</label>
                <div class="value">${skip.reviewed ? '已复核' : '待复核'}</div>
            </div>
            ${skip.reviewed ? `
                <div class="detail-item">
                    <label>复核结果</label>
                    <div class="value">${getReviewResultText(skip.review_result)}</div>
                </div>
                <div class="detail-item">
                    <label>复核备注</label>
                    <div class="value">${skip.review_note || '-'}</div>
                </div>
            ` : ''}
            <div class="form-actions">
                <button class="cancel-btn" onclick="closeModal()">关闭</button>
            </div>
        `);
    } catch (e) {
        alert('加载失败');
    }
}

async function submitSkipReview(skipId) {
    const result = document.getElementById('reviewResult').value;
    const note = document.getElementById('reviewNote').value;
    
    try {
        const res = await fetch(`${API_BASE}/skips/${skipId}/review`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                review_result: result,
                review_note: note,
                reviewed_by: 1
            })
        });
        
        if (res.ok) {
            alert('复核提交成功');
            closeModal();
            loadStatistics();
            loadSkips();
            loadSamples();
        } else {
            const data = await res.json();
            alert(data.detail || '提交失败');
        }
    } catch (e) {
        alert('提交失败');
    }
}

async function completeRework(id) {
    try {
        const res = await fetch(`${API_BASE}/reworks/${id}`);
        const rework = await res.json();
        
        showModal(`
            <h3>完成返工 #${rework.id}</h3>
            <div class="detail-item">
                <label>样本ID</label>
                <div class="value">${rework.sample_id}</div>
            </div>
            <div class="annotation-diff">
                <div class="old-annotation">
                    <label>原始标注</label>
                    <div>${rework.original_annotation}</div>
                </div>
                <div class="new-annotation">
                    <label>返工原因</label>
                    <div>${rework.reason}</div>
                </div>
            </div>
            <div class="detail-item">
                <label>样本内容</label>
                <div class="sample-content">${rework.sample ? rework.sample.content : '加载中...'}</div>
            </div>
            <div class="form-group">
                <label>新标注结果</label>
                <textarea id="reworkAnnotation" rows="4">${rework.original_annotation}</textarea>
            </div>
            <div class="form-actions">
                <button class="cancel-btn" onclick="closeModal()">取消</button>
                <button class="submit-btn" onclick="submitRework(${rework.id})">提交返工</button>
            </div>
        `);
    } catch (e) {
        alert('加载失败');
    }
}

async function viewRework(id) {
    try {
        const res = await fetch(`${API_BASE}/reworks/${id}`);
        const rework = await res.json();
        
        showModal(`
            <h3>返工记录详情 #${rework.id}</h3>
            <div class="detail-item">
                <label>样本ID</label>
                <div class="value">${rework.sample_id}</div>
            </div>
            <div class="annotation-diff">
                <div class="old-annotation">
                    <label>原始标注</label>
                    <div>${rework.original_annotation}</div>
                </div>
                <div class="new-annotation">
                    <label>返工原因</label>
                    <div>${rework.reason}</div>
                </div>
            </div>
            ${rework.rework_annotation ? `
                <div class="detail-item">
                    <label>返工后标注</label>
                    <div class="value">${rework.rework_annotation}</div>
                </div>
                <div class="detail-item">
                    <label>完成时间</label>
                    <div class="value">${new Date(rework.reworked_at).toLocaleString('zh-CN')}</div>
                </div>
            ` : ''}
            <div class="form-actions">
                <button class="cancel-btn" onclick="closeModal()">关闭</button>
            </div>
        `);
    } catch (e) {
        alert('加载失败');
    }
}

async function submitRework(reworkId) {
    const annotation = document.getElementById('reworkAnnotation').value;
    if (!annotation) {
        alert('请输入标注结果');
        return;
    }
    
    try {
        const res = await fetch(`${API_BASE}/reworks/${reworkId}/complete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rework_annotation: annotation })
        });
        
        if (res.ok) {
            alert('返工提交成功');
            closeModal();
            loadStatistics();
            loadReworks();
            loadSamples();
        } else {
            const data = await res.json();
            alert(data.detail || '提交失败');
        }
    } catch (e) {
        alert('提交失败');
    }
}

function showAddSampleModal() {
    showModal(`
        <h3>添加样本</h3>
        <div class="form-group">
            <label>样本内容</label>
            <textarea id="sampleContent" rows="4" placeholder="输入样本内容"></textarea>
        </div>
        <div class="form-group">
            <label>原始标注（可选）</label>
            <textarea id="sampleAnnotation" rows="2" placeholder="输入原始标注"></textarea>
        </div>
        <div class="form-actions">
            <button class="cancel-btn" onclick="closeModal()">取消</button>
            <button class="submit-btn" onclick="addSample()">添加</button>
        </div>
    `);
}

async function addSample() {
    const content = document.getElementById('sampleContent').value;
    const annotation = document.getElementById('sampleAnnotation').value;
    
    if (!content) {
        alert('请输入样本内容');
        return;
    }
    
    try {
        const res = await fetch(`${API_BASE}/samples/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                content: content,
                original_annotation: annotation || null
            })
        });
        
        if (res.ok) {
            alert('样本添加成功');
            closeModal();
            loadStatistics();
            loadSamples();
        } else {
            alert('添加失败');
        }
    } catch (e) {
        alert('添加失败');
    }
}

function showAddAnnotatorModal() {
    showModal(`
        <h3>添加标注员</h3>
        <div class="form-group">
            <label>姓名</label>
            <input type="text" id="annotatorName" placeholder="输入姓名">
        </div>
        <div class="form-group">
            <label>邮箱</label>
            <input type="email" id="annotatorEmail" placeholder="输入邮箱">
        </div>
        <div class="form-actions">
            <button class="cancel-btn" onclick="closeModal()">取消</button>
            <button class="submit-btn" onclick="addAnnotator()">添加</button>
        </div>
    `);
}

async function addAnnotator() {
    const name = document.getElementById('annotatorName').value;
    const email = document.getElementById('annotatorEmail').value;
    
    if (!name || !email) {
        alert('请填写完整信息');
        return;
    }
    
    try {
        const res = await fetch(`${API_BASE}/annotators/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: name, email: email })
        });
        
        if (res.ok) {
            alert('标注员添加成功');
            closeModal();
            loadAnnotators();
        } else {
            const data = await res.json();
            alert(data.detail || '添加失败');
        }
    } catch (e) {
        alert('添加失败');
    }
}

async function showCreateTaskModal() {
    try {
        const [samplesRes, annotatorsRes] = await Promise.all([
            fetch(`${API_BASE}/samples?status=pending`),
            fetch(`${API_BASE}/annotators`)
        ]);
        const samples = await samplesRes.json();
        const annotators = await annotatorsRes.json();
        
        const samplesHtml = samples.map(s => `
            <div class="checkbox-item">
                <input type="checkbox" class="sample-checkbox" value="${s.id}" id="sample-${s.id}">
                <label for="sample-${s.id}">#${s.id} - ${s.content.substring(0, 40)}...</label>
            </div>
        `).join('');
        
        const annotatorsHtml = annotators.map(a => `
            <option value="${a.id}">${a.name} (${a.email})</option>
        `).join('');
        
        showModal(`
            <h3>创建任务包</h3>
            <div class="form-group">
                <label>任务名称</label>
                <input type="text" id="taskName" placeholder="输入任务名称">
            </div>
            <div class="form-group">
                <label>分配给标注员</label>
                <select id="taskAnnotator">${annotatorsHtml}</select>
            </div>
            <div class="form-group">
                <label>选择样本（待分配样本共 ${samples.length} 个）</label>
                <div class="checkbox-group">
                    ${samplesHtml || '<p>没有待分配的样本</p>'}
                </div>
                <button type="button" style="margin-top: 10px; padding: 5px 10px;" onclick="selectAllSamples()">全选</button>
                <button type="button" style="margin-top: 10px; padding: 5px 10px; margin-left: 10px;" onclick="deselectAllSamples()">取消全选</button>
            </div>
            <div class="form-actions">
                <button class="cancel-btn" onclick="closeModal()">取消</button>
                <button class="submit-btn" onclick="createTask()">创建任务</button>
            </div>
        `);
    } catch (e) {
        alert('加载数据失败');
    }
}

function selectAllSamples() {
    document.querySelectorAll('.sample-checkbox').forEach(cb => cb.checked = true);
}

function deselectAllSamples() {
    document.querySelectorAll('.sample-checkbox').forEach(cb => cb.checked = false);
}

async function createTask() {
    const name = document.getElementById('taskName').value;
    const annotatorId = document.getElementById('taskAnnotator').value;
    const sampleIds = Array.from(document.querySelectorAll('.sample-checkbox:checked')).map(cb => parseInt(cb.value));
    
    if (!name || sampleIds.length === 0) {
        alert('请填写任务名称并选择至少一个样本');
        return;
    }
    
    try {
        const res = await fetch(`${API_BASE}/tasks/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: name,
                annotator_id: parseInt(annotatorId),
                sample_ids: sampleIds
            })
        });
        
        if (res.ok) {
            alert('任务包创建成功');
            closeModal();
            loadStatistics();
            loadTasks();
            loadSamples();
        } else {
            const data = await res.json();
            alert(data.detail || '创建失败');
        }
    } catch (e) {
        alert('创建失败');
    }
}

function exportData(type) {
    if (type === 'samples') {
        window.open(`${API_BASE}/export/samples`, '_blank');
    } else if (type === 'skips') {
        window.open(`${API_BASE}/export/skips`, '_blank');
    }
}

document.getElementById('modal').addEventListener('click', (e) => {
    if (e.target.id === 'modal') closeModal();
});