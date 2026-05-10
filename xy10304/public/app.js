const API = {
  async get(url) {
    const res = await fetch(url);
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || '请求失败');
    }
    return res.json();
  },
  async post(url, data) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || '请求失败');
    }
    return res.json();
  },
  async put(url, data) {
    const res = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || '请求失败');
    }
    return res.json();
  }
};

const statusLabels = {
  'assigned': '已指派',
  'in_progress': '进行中',
  'completed': '已完成',
  'inspected': '已检查',
  'redo_needed': '需返工',
  'redo_in_progress': '返工中',
  'redo_completed': '返工完成',
  'closed': '已关闭'
};

const priorityLabels = {
  'high': '紧急',
  'normal': '正常',
  'low': '低'
};

function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast show ${type}`;
  setTimeout(() => {
    toast.className = 'toast';
  }, 3000);
}

function openModal(content) {
  const modal = document.getElementById('modal');
  const modalContent = document.getElementById('modalContent');
  modalContent.innerHTML = content;
  modal.classList.add('show');
  
  modal.querySelector('.modal-close')?.addEventListener('click', () => {
    modal.classList.remove('show');
  });
  
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.classList.remove('show');
    }
  });
}

function closeModal() {
  document.getElementById('modal').classList.remove('show');
}

async function loadTasks() {
  const params = new URLSearchParams();
  const status = document.getElementById('filterStatus').value;
  const propertyId = document.getElementById('filterProperty').value;
  const cleanerId = document.getElementById('filterCleaner').value;
  const bookingId = document.getElementById('filterBookingId').value;
  const startDate = document.getElementById('filterStartDate').value;
  const endDate = document.getElementById('filterEndDate').value;
  
  if (status) params.append('status', status);
  if (propertyId) params.append('property_id', propertyId);
  if (cleanerId) params.append('cleaner_id', cleanerId);
  if (bookingId) params.append('booking_id', bookingId);
  if (startDate) params.append('start_date', startDate);
  if (endDate) params.append('end_date', endDate);
  
  try {
    const tasks = await API.get(`/api/tasks?${params.toString()}`);
    renderTasks(tasks);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function renderTasks(tasks) {
  const tbody = document.getElementById('tasksTableBody');
  document.getElementById('taskCount').textContent = `共 ${tasks.length} 条任务`;
  
  if (tasks.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="11">
          <div class="empty-state">
            <div class="icon">📭</div>
            <div class="text">暂无任务数据</div>
          </div>
        </td>
      </tr>
    `;
    return;
  }
  
  tbody.innerHTML = tasks.map(task => `
    <tr>
      <td>#${task.id}</td>
      <td>${task.booking_id || '-'}</td>
      <td>${task.property_name || '-'}</td>
      <td>${task.cleaner_name || '未分配'}</td>
      <td>${task.guest_name || '-'}</td>
      <td><span class="status-badge status-${task.status}">${statusLabels[task.status]}</span></td>
      <td><span class="priority-${task.priority}">${priorityLabels[task.priority]}</span></td>
      <td>${task.redo_count > 0 ? `<span class="redo-badge">${task.redo_count}次</span>` : '-'}</td>
      <td>
        ${task.total_penalty > 0 ? `罚:¥${task.total_penalty}` : ''}
        ${task.total_compensation > 0 ? ` 赔:¥${task.total_compensation}` : ''}
        ${task.total_penalty === 0 && task.total_compensation === 0 ? '-' : ''}
      </td>
      <td>${task.assigned_at?.slice(0, 16) || '-'}</td>
      <td>
        <div class="action-btns">
          <button class="btn-outline" onclick="viewTaskDetail(${task.id})">详情</button>
          ${renderTaskActions(task)}
        </div>
      </td>
    </tr>
  `).join('');
}

function renderTaskActions(task) {
  const isSettled = task.is_settled === 1;
  const isClosed = task.status === 'closed';
  const canModify = !isSettled && !isClosed;
  
  let actions = '';
  
  if (!canModify) {
    return actions;
  }
  
  switch (task.status) {
    case 'assigned':
      actions += `<button class="btn-success" onclick="performTaskAction(${task.id}, 'start')">开始</button>`;
      if (task.cleaner_id) {
        actions += `<button class="btn-outline" onclick="reassignTask(${task.id})">改派</button>`;
      }
      break;
    case 'in_progress':
    case 'redo_in_progress':
      actions += `<button class="btn-primary" onclick="performTaskAction(${task.id}, 'complete')">完成</button>`;
      break;
    case 'completed':
    case 'redo_completed':
      actions += `<button class="btn-warning" onclick="inspectTask(${task.id})">检查</button>`;
      break;
    case 'inspected':
      actions += `<button class="btn-success" onclick="closeTask(${task.id})">关闭</button>`;
      actions += `<button class="btn-warning" onclick="submitFeedback(${task.id})">反馈</button>`;
      break;
    case 'redo_needed':
      actions += `<button class="btn-primary" onclick="performTaskAction(${task.id}, 'start_redo')">开始返工</button>`;
      actions += `<button class="btn-outline" onclick="reassignTask(${task.id})">改派</button>`;
      break;
  }
  
  return actions;
}

async function performTaskAction(taskId, action, data = {}) {
  try {
    await API.post(`/api/tasks/${taskId}/action`, { action, ...data });
    showToast('操作成功', 'success');
    loadTasks();
    closeModal();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function viewTaskDetail(taskId) {
  try {
    const data = await API.get(`/api/tasks/${taskId}`);
    const { task, inspections, feedbacks, compensations, history } = data;
    
    const isSettled = task.is_settled === 1;
    const statusWarning = isSettled || task.status === 'closed' 
      ? `<div style="background:#fee2e2;color:#dc2626;padding:10px;border-radius:8px;margin-bottom:15px;">⚠️ 任务已${isSettled ? '结算' : '关闭'}，无法修改</div>` 
      : '';
    
    const html = `
      <div class="modal-header">
        <h2>任务详情 #${task.id}</h2>
        <button class="modal-close">&times;</button>
      </div>
      <div class="modal-body">
        ${statusWarning}
        
        <div class="detail-section">
          <h3>基本信息</h3>
          <div class="detail-grid">
            <div class="detail-item"><span class="label">房源</span><span class="value">${task.property_name || '-'}</span></div>
            <div class="detail-item"><span class="label">保洁员</span><span class="value">${task.cleaner_name || '未分配'}</span></div>
            <div class="detail-item"><span class="label">入住单号</span><span class="value">${task.booking_id || '-'}</span></div>
            <div class="detail-item"><span class="label">住客</span><span class="value">${task.guest_name || '-'}</span></div>
            <div class="detail-item"><span class="label">入住日期</span><span class="value">${task.checkin_date || '-'}</span></div>
            <div class="detail-item"><span class="label">退房日期</span><span class="value">${task.checkout_date || '-'}</span></div>
            <div class="detail-item"><span class="label">状态</span><span class="value"><span class="status-badge status-${task.status}">${statusLabels[task.status]}</span></span></div>
            <div class="detail-item"><span class="label">优先级</span><span class="value">${priorityLabels[task.priority]}</span></div>
            <div class="detail-item"><span class="label">返工次数</span><span class="value">${task.redo_count}</span></div>
            <div class="detail-item"><span class="label">处罚/赔付</span><span class="value">罚:¥${task.total_penalty || 0} / 赔:¥${task.total_compensation || 0}</span></div>
          </div>
        </div>
        
        ${inspections.length > 0 ? `
        <div class="detail-section">
          <h3>检查记录 (${inspections.length})</h3>
          <div class="history-list">
            ${inspections.map(i => `
              <div class="history-item">
                <div class="time">${i.inspection_time}</div>
                <div class="action">${i.inspector} - ${i.result === 'pass' ? '检查通过' : i.result === 'fail' ? '检查不通过' : i.result}</div>
                <div class="details">
                  ${i.issues ? `问题: ${i.issues}<br>` : ''}
                  ${i.penalty_points > 0 ? `扣分: ${i.penalty_points}分 ` : ''}
                  ${i.penalty_amount > 0 ? `处罚: ¥${i.penalty_amount} ` : ''}
                  ${i.needs_redo ? '【需返工】' : ''}
                  ${i.notes ? `<br>备注: ${i.notes}` : ''}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
        ` : ''}
        
        ${feedbacks.length > 0 ? `
        <div class="detail-section">
          <h3>住客反馈 (${feedbacks.length})</h3>
          <div class="history-list">
            ${feedbacks.map(f => `
              <div class="history-item">
                <div class="time">${f.feedback_time}</div>
                <div class="action">${f.guest_name || '匿名'} - 评分: ${f.rating}/5</div>
                <div class="details">
                  严重程度: ${f.severity === 'high' ? '高' : f.severity === 'low' ? '低' : '中'}
                  ${f.issues ? `<br>问题: ${f.issues}` : ''}
                  ${f.needs_redo ? '<br>【要求返工】' : ''}
                  ${f.compensation_request ? '<br>【要求赔偿】' : ''}
                  ${f.notes ? `<br>备注: ${f.notes}` : ''}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
        ` : ''}
        
        ${compensations.length > 0 ? `
        <div class="detail-section">
          <h3>赔付记录 (${compensations.length})</h3>
          <div class="history-list">
            ${compensations.map(c => `
              <div class="history-item">
                <div class="time">${c.created_at}</div>
                <div class="action">赔付 ¥${c.amount}</div>
                <div class="details">
                  原因: ${c.reason}<br>
                  结算来源: ${c.settled_from_cleaner ? '保洁员工资扣除' : '公司承担'}
                  ${c.notes ? `<br>备注: ${c.notes}` : ''}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
        ` : ''}
        
        <div class="detail-section">
          <h3>操作历史</h3>
          <div class="history-list">
            ${history.map(h => `
              <div class="history-item">
                <div class="time">${h.timestamp}</div>
                <div class="action">${h.action} (${h.changed_by})</div>
                ${h.details ? `<div class="details">${h.details}</div>` : ''}
              </div>
            `).join('')}
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn-outline" onclick="closeModal()">关闭</button>
        ${!isSettled && task.status !== 'closed' ? `
          <button class="btn-warning" onclick="compensateTask(${task.id})">赔付处理</button>
        ` : ''}
      </div>
    `;
    
    openModal(html);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function createNewTask() {
  const properties = await API.get('/api/properties');
  const cleaners = await API.get('/api/cleaners');
  
  const html = `
    <div class="modal-header">
      <h2>新建保洁任务</h2>
      <button class="modal-close">&times;</button>
    </div>
    <div class="modal-body">
      <form id="newTaskForm">
        <div class="form-row">
          <div class="form-group">
            <label>房源 *</label>
            <select name="property_id" required>
              <option value="">请选择房源</option>
              ${properties.filter(p => p.status === 'active').map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>保洁员</label>
            <select name="cleaner_id">
              <option value="">暂不分配</option>
              ${cleaners.filter(c => c.status === 'active').map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>入住单号 *</label>
            <input type="text" name="booking_id" required placeholder="如: BK20260510001">
          </div>
          <div class="form-group">
            <label>住客姓名</label>
            <input type="text" name="guest_name" placeholder="住客姓名">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>入住日期</label>
            <input type="date" name="checkin_date">
          </div>
          <div class="form-group">
            <label>退房日期</label>
            <input type="date" name="checkout_date">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>优先级</label>
            <select name="priority">
              <option value="normal">正常</option>
              <option value="high">紧急</option>
              <option value="low">低</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label>备注</label>
          <textarea name="notes" placeholder="备注信息"></textarea>
        </div>
      </form>
    </div>
    <div class="modal-footer">
      <button class="btn-outline" onclick="closeModal()">取消</button>
      <button class="btn-primary" onclick="submitNewTask()">创建任务</button>
    </div>
  `;
  
  openModal(html);
}

async function submitNewTask() {
  const form = document.getElementById('newTaskForm');
  const formData = new FormData(form);
  const data = Object.fromEntries(formData);
  
  try {
    await API.post('/api/tasks', data);
    showToast('任务创建成功', 'success');
    loadTasks();
    closeModal();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function inspectTask(taskId) {
  const html = `
    <div class="modal-header">
      <h2>提交检查结果</h2>
      <button class="modal-close">&times;</button>
    </div>
    <div class="modal-body">
      <form id="inspectForm">
        <div class="form-group">
          <label>检查结果 *</label>
          <select name="result" required onchange="toggleRedoOption(this)">
            <option value="pass">检查通过</option>
            <option value="pass_with_issues">通过但有问题</option>
            <option value="fail">检查不通过</option>
          </select>
        </div>
        <div class="form-group">
          <label>发现的问题</label>
          <textarea name="issues" placeholder="描述发现的问题，如：卫生间地板有污渍"></textarea>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>扣分数</label>
            <input type="number" name="penalty_points" min="0" value="0">
          </div>
          <div class="form-group">
            <label>处罚金额 (元)</label>
            <input type="number" name="penalty_amount" min="0" step="0.01" value="0">
          </div>
        </div>
        <div class="form-group" id="redoOption">
          <label>
            <input type="checkbox" name="needs_redo" value="1">
            需要返工
          </label>
        </div>
        <div class="form-group">
          <label>检查人</label>
          <input type="text" name="inspector" placeholder="检查人姓名">
        </div>
        <div class="form-group">
          <label>备注</label>
          <textarea name="notes" placeholder="检查备注"></textarea>
        </div>
      </form>
    </div>
    <div class="modal-footer">
      <button class="btn-outline" onclick="closeModal()">取消</button>
      <button class="btn-primary" onclick="submitInspection(${taskId})">提交检查</button>
    </div>
  `;
  
  openModal(html);
}

function toggleRedoOption(select) {
  const redoOption = document.getElementById('redoOption');
  if (select.value === 'fail') {
    redoOption.querySelector('input').checked = true;
  }
}

async function submitInspection(taskId) {
  const form = document.getElementById('inspectForm');
  const formData = new FormData(form);
  const data = {
    action: 'inspect',
    result: formData.get('result'),
    issues: formData.get('issues'),
    penalty_points: parseInt(formData.get('penalty_points') || 0),
    penalty_amount: parseFloat(formData.get('penalty_amount') || 0),
    needs_redo: formData.get('needs_redo') === '1',
    inspector: formData.get('inspector'),
    notes: formData.get('notes')
  };
  
  await performTaskAction(taskId, 'inspect', data);
}

async function submitFeedback(taskId) {
  const html = `
    <div class="modal-header">
      <h2>记录住客反馈</h2>
      <button class="modal-close">&times;</button>
    </div>
    <div class="modal-body">
      <form id="feedbackForm">
        <div class="form-row">
          <div class="form-group">
            <label>住客姓名</label>
            <input type="text" name="guest_name" placeholder="住客姓名">
          </div>
          <div class="form-group">
            <label>评分 (1-5)</label>
            <select name="rating">
              <option value="5">5 - 非常满意</option>
              <option value="4">4 - 满意</option>
              <option value="3">3 - 一般</option>
              <option value="2">2 - 不满意</option>
              <option value="1">1 - 非常不满意</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label>严重程度</label>
          <select name="severity">
            <option value="medium">中</option>
            <option value="high">高</option>
            <option value="low">低</option>
          </select>
        </div>
        <div class="form-group">
          <label>反馈问题</label>
          <textarea name="issues" placeholder="描述住客反馈的问题"></textarea>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>
              <input type="checkbox" name="needs_redo" value="1">
              需要返工
            </label>
          </div>
          <div class="form-group">
            <label>
              <input type="checkbox" name="compensation_request" value="1">
              要求赔偿
            </label>
          </div>
        </div>
        <div class="form-group">
          <label>备注</label>
          <textarea name="feedback_notes" placeholder="补充说明"></textarea>
        </div>
      </form>
    </div>
    <div class="modal-footer">
      <button class="btn-outline" onclick="closeModal()">取消</button>
      <button class="btn-primary" onclick="submitFeedbackData(${taskId})">提交反馈</button>
    </div>
  `;
  
  openModal(html);
}

async function submitFeedbackData(taskId) {
  const form = document.getElementById('feedbackForm');
  const formData = new FormData(form);
  const data = {
    action: 'submit_feedback',
    guest_name: formData.get('guest_name'),
    rating: parseInt(formData.get('rating')),
    issues: formData.get('issues'),
    severity: formData.get('severity'),
    needs_redo: formData.get('needs_redo') === '1',
    compensation_request: formData.get('compensation_request') === '1',
    feedback_notes: formData.get('feedback_notes')
  };
  
  await performTaskAction(taskId, 'submit_feedback', data);
}

async function compensateTask(taskId) {
  const html = `
    <div class="modal-header">
      <h2>处理赔付</h2>
      <button class="modal-close">&times;</button>
    </div>
    <div class="modal-body">
      <form id="compensateForm">
        <div class="form-group">
          <label>赔付原因 *</label>
          <textarea name="reason" required placeholder="赔付原因，如：住客投诉卫生问题"></textarea>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>赔付金额 (元) *</label>
            <input type="number" name="amount" min="0" step="0.01" required>
          </div>
          <div class="form-group">
            <label>结算来源</label>
            <select name="settled_from_cleaner">
              <option value="1">保洁员工资扣除</option>
              <option value="0">公司承担</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label>备注</label>
          <textarea name="comp_notes" placeholder="补充说明"></textarea>
        </div>
      </form>
    </div>
    <div class="modal-footer">
      <button class="btn-outline" onclick="closeModal()">取消</button>
      <button class="btn-danger" onclick="submitCompensation(${taskId})">确认赔付</button>
    </div>
  `;
  
  openModal(html);
}

async function submitCompensation(taskId) {
  const form = document.getElementById('compensateForm');
  const formData = new FormData(form);
  const data = {
    action: 'compensate',
    reason: formData.get('reason'),
    amount: parseFloat(formData.get('amount')),
    settled_from_cleaner: formData.get('settled_from_cleaner') === '1',
    comp_notes: formData.get('comp_notes')
  };
  
  await performTaskAction(taskId, 'compensate', data);
}

async function reassignTask(taskId) {
  const cleaners = await API.get('/api/cleaners');
  
  const html = `
    <div class="modal-header">
      <h2>重新指派保洁员</h2>
      <button class="modal-close">&times;</button>
    </div>
    <div class="modal-body">
      <form id="reassignForm">
        <div class="form-group">
          <label>选择保洁员 *</label>
          <select name="cleaner_id" required>
            <option value="">请选择保洁员</option>
            ${cleaners.filter(c => c.status === 'active').map(c => `<option value="${c.id}">${c.name} (评分: ${c.rating})</option>`).join('')}
          </select>
        </div>
      </form>
    </div>
    <div class="modal-footer">
      <button class="btn-outline" onclick="closeModal()">取消</button>
      <button class="btn-primary" onclick="submitReassign(${taskId})">确认改派</button>
    </div>
  `;
  
  openModal(html);
}

async function submitReassign(taskId) {
  const form = document.getElementById('reassignForm');
  const formData = new FormData(form);
  const cleanerId = parseInt(formData.get('cleaner_id'));
  
  await performTaskAction(taskId, 'reassign', { cleaner_id: cleanerId });
}

async function closeTask(taskId) {
  if (!confirm('确认关闭并结算此任务？关闭后将无法再修改。')) {
    return;
  }
  await performTaskAction(taskId, 'close');
}

async function loadProperties() {
  try {
    const properties = await API.get('/api/properties');
    renderProperties(properties);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function renderProperties(properties) {
  const tbody = document.getElementById('propertiesTableBody');
  
  if (properties.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7">
          <div class="empty-state">
            <div class="icon">🏡</div>
            <div class="text">暂无房源数据</div>
          </div>
        </td>
      </tr>
    `;
    return;
  }
  
  tbody.innerHTML = properties.map(p => `
    <tr>
      <td>${p.id}</td>
      <td>${p.name}</td>
      <td>${p.address || '-'}</td>
      <td>${p.rooms || '-'}</td>
      <td>${p.area || '-'}</td>
      <td><span class="status-badge ${p.status === 'active' ? 'status-inspected' : 'status-closed'}">${p.status === 'active' ? '启用' : '停用'}</span></td>
      <td>
        <button class="btn-outline" onclick="editProperty(${p.id})">编辑</button>
      </td>
    </tr>
  `).join('');
}

async function createNewProperty() {
  const html = `
    <div class="modal-header">
      <h2>新建房源</h2>
      <button class="modal-close">&times;</button>
    </div>
    <div class="modal-body">
      <form id="propertyForm">
        <div class="form-group">
          <label>房源名称 *</label>
          <input type="text" name="name" required placeholder="如：阳光海景公寓">
        </div>
        <div class="form-group">
          <label>地址</label>
          <input type="text" name="address" placeholder="详细地址">
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>房间数</label>
            <input type="number" name="rooms" min="1" placeholder="如：3">
          </div>
          <div class="form-group">
            <label>面积 (㎡)</label>
            <input type="number" name="area" min="1" step="0.01" placeholder="如：120">
          </div>
        </div>
      </form>
    </div>
    <div class="modal-footer">
      <button class="btn-outline" onclick="closeModal()">取消</button>
      <button class="btn-primary" onclick="submitProperty()">保存</button>
    </div>
  `;
  
  openModal(html);
}

async function submitProperty(propertyId = null) {
  const form = document.getElementById('propertyForm');
  const formData = new FormData(form);
  const data = {
    name: formData.get('name'),
    address: formData.get('address'),
    rooms: formData.get('rooms') ? parseInt(formData.get('rooms')) : null,
    area: formData.get('area') ? parseFloat(formData.get('area')) : null,
    status: formData.get('status') || 'active'
  };
  
  try {
    if (propertyId) {
      await API.put(`/api/properties/${propertyId}`, data);
    } else {
      await API.post('/api/properties', data);
    }
    showToast('保存成功', 'success');
    loadProperties();
    loadFilterOptions();
    closeModal();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function editProperty(id) {
  const properties = await API.get('/api/properties');
  const property = properties.find(p => p.id === id);
  
  const html = `
    <div class="modal-header">
      <h2>编辑房源</h2>
      <button class="modal-close">&times;</button>
    </div>
    <div class="modal-body">
      <form id="propertyForm">
        <div class="form-group">
          <label>房源名称 *</label>
          <input type="text" name="name" required value="${property.name}">
        </div>
        <div class="form-group">
          <label>地址</label>
          <input type="text" name="address" value="${property.address || ''}">
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>房间数</label>
            <input type="number" name="rooms" min="1" value="${property.rooms || ''}">
          </div>
          <div class="form-group">
            <label>面积 (㎡)</label>
            <input type="number" name="area" min="1" step="0.01" value="${property.area || ''}">
          </div>
        </div>
        <div class="form-group">
          <label>状态</label>
          <select name="status">
            <option value="active" ${property.status === 'active' ? 'selected' : ''}>启用</option>
            <option value="inactive" ${property.status === 'inactive' ? 'selected' : ''}>停用</option>
          </select>
        </div>
      </form>
    </div>
    <div class="modal-footer">
      <button class="btn-outline" onclick="closeModal()">取消</button>
      <button class="btn-primary" onclick="submitProperty(${id})">保存</button>
    </div>
  `;
  
  openModal(html);
}

async function loadCleaners() {
  try {
    const cleaners = await API.get('/api/cleaners');
    renderCleaners(cleaners);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function renderCleaners(cleaners) {
  const tbody = document.getElementById('cleanersTableBody');
  
  if (cleaners.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8">
          <div class="empty-state">
            <div class="icon">👥</div>
            <div class="text">暂无保洁员数据</div>
          </div>
        </td>
      </tr>
    `;
    return;
  }
  
  tbody.innerHTML = cleaners.map(c => `
    <tr>
      <td>${c.id}</td>
      <td>${c.name}</td>
      <td>${c.phone || '-'}</td>
      <td>⭐ ${(c.rating || 5).toFixed(1)}</td>
      <td>${c.total_tasks || 0}</td>
      <td>${c.redo_tasks || 0}</td>
      <td><span class="status-badge ${c.status === 'active' ? 'status-inspected' : 'status-closed'}">${c.status === 'active' ? '在职' : '离职'}</span></td>
      <td>
        <button class="btn-outline" onclick="editCleaner(${c.id})">编辑</button>
      </td>
    </tr>
  `).join('');
}

async function createNewCleaner() {
  const html = `
    <div class="modal-header">
      <h2>新建保洁员</h2>
      <button class="modal-close">&times;</button>
    </div>
    <div class="modal-body">
      <form id="cleanerForm">
        <div class="form-group">
          <label>姓名 *</label>
          <input type="text" name="name" required placeholder="如：张阿姨">
        </div>
        <div class="form-group">
          <label>电话</label>
          <input type="tel" name="phone" placeholder="联系电话">
        </div>
      </form>
    </div>
    <div class="modal-footer">
      <button class="btn-outline" onclick="closeModal()">取消</button>
      <button class="btn-primary" onclick="submitCleaner()">保存</button>
    </div>
  `;
  
  openModal(html);
}

async function submitCleaner(cleanerId = null) {
  const form = document.getElementById('cleanerForm');
  const formData = new FormData(form);
  const data = {
    name: formData.get('name'),
    phone: formData.get('phone'),
    status: formData.get('status') || 'active'
  };
  
  try {
    if (cleanerId) {
      await API.put(`/api/cleaners/${cleanerId}`, data);
    } else {
      await API.post('/api/cleaners', data);
    }
    showToast('保存成功', 'success');
    loadCleaners();
    loadFilterOptions();
    closeModal();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function editCleaner(id) {
  const cleaners = await API.get('/api/cleaners');
  const cleaner = cleaners.find(c => c.id === id);
  
  const html = `
    <div class="modal-header">
      <h2>编辑保洁员</h2>
      <button class="modal-close">&times;</button>
    </div>
    <div class="modal-body">
      <form id="cleanerForm">
        <div class="form-group">
          <label>姓名 *</label>
          <input type="text" name="name" required value="${cleaner.name}">
        </div>
        <div class="form-group">
          <label>电话</label>
          <input type="tel" name="phone" value="${cleaner.phone || ''}">
        </div>
        <div class="form-group">
          <label>状态</label>
          <select name="status">
            <option value="active" ${cleaner.status === 'active' ? 'selected' : ''}>在职</option>
            <option value="inactive" ${cleaner.status === 'inactive' ? 'selected' : ''}>离职</option>
          </select>
        </div>
      </form>
    </div>
    <div class="modal-footer">
      <button class="btn-outline" onclick="closeModal()">取消</button>
      <button class="btn-primary" onclick="submitCleaner(${id})">保存</button>
    </div>
  `;
  
  openModal(html);
}

async function loadStats() {
  const params = new URLSearchParams();
  const startDate = document.getElementById('statsStartDate').value;
  const endDate = document.getElementById('statsEndDate').value;
  
  if (startDate) params.append('start_date', startDate);
  if (endDate) params.append('end_date', endDate);
  
  try {
    const stats = await API.get(`/api/stats?${params.toString()}`);
    renderStats(stats);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function renderStats(stats) {
  const { taskStats, propertyStats, cleanerStats, issueStats } = stats;
  
  const cardsHtml = `
    <div class="stat-card">
      <h4>总任务数</h4>
      <div class="value">${taskStats.total || 0}</div>
    </div>
    <div class="stat-card" style="border-left-color: #4338ca;">
      <h4>待开始</h4>
      <div class="value">${taskStats.assigned || 0}</div>
    </div>
    <div class="stat-card" style="border-left-color: #1d4ed8;">
      <h4>进行中</h4>
      <div class="value">${taskStats.in_progress || 0}</div>
    </div>
    <div class="stat-card" style="border-left-color: #16a34a;">
      <h4>已完成</h4>
      <div class="value">${taskStats.completed || 0}</div>
    </div>
    <div class="stat-card" style="border-left-color: #d97706;">
      <h4>需返工</h4>
      <div class="value">${taskStats.redo || 0}</div>
    </div>
    <div class="stat-card" style="border-left-color: #0891b2;">
      <h4>已关闭</h4>
      <div class="value">${taskStats.closed || 0}</div>
    </div>
    <div class="stat-card" style="border-left-color: #dc2626;">
      <h4>总处罚</h4>
      <div class="value">¥${taskStats.total_penalty || 0}</div>
    </div>
    <div class="stat-card" style="border-left-color: #db2777;">
      <h4>总赔付</h4>
      <div class="value">¥${taskStats.total_compensation || 0}</div>
    </div>
  `;
  
  document.getElementById('statsCards').innerHTML = cardsHtml;
  
  document.getElementById('propertyStatsBody').innerHTML = propertyStats.map(p => `
    <tr>
      <td>${p.name}</td>
      <td>${p.task_count || 0}</td>
      <td>${p.redo_count || 0}</td>
      <td>¥${p.total_penalty || 0}</td>
      <td>¥${p.total_compensation || 0}</td>
    </tr>
  `).join('');
  
  document.getElementById('cleanerStatsBody').innerHTML = cleanerStats.map(c => `
    <tr>
      <td>${c.name}</td>
      <td>⭐ ${(c.rating || 5).toFixed(1)}</td>
      <td>${c.total_tasks || 0}</td>
      <td>${c.redo_tasks || 0}</td>
      <td>¥${c.total_penalty || 0}</td>
      <td>¥${c.total_compensation || 0}</td>
    </tr>
  `).join('');
}

async function loadFilterOptions() {
  const [properties, cleaners] = await Promise.all([
    API.get('/api/properties'),
    API.get('/api/cleaners')
  ]);
  
  const propertySelect = document.getElementById('filterProperty');
  propertySelect.innerHTML = '<option value="">全部房源</option>' + 
    properties.filter(p => p.status === 'active').map(p => `<option value="${p.id}">${p.name}</option>`).join('');
  
  const cleanerSelect = document.getElementById('filterCleaner');
  cleanerSelect.innerHTML = '<option value="">全部保洁员</option>' + 
    cleaners.filter(c => c.status === 'active').map(c => `<option value="${c.id}">${c.name}</option>`).join('');
}

function exportReport() {
  const params = new URLSearchParams();
  const status = document.getElementById('filterStatus').value;
  const propertyId = document.getElementById('filterProperty').value;
  const cleanerId = document.getElementById('filterCleaner').value;
  const startDate = document.getElementById('filterStartDate').value;
  const endDate = document.getElementById('filterEndDate').value;
  
  if (status) params.append('status', status);
  if (propertyId) params.append('property_id', propertyId);
  if (cleanerId) params.append('cleaner_id', cleanerId);
  if (startDate) params.append('start_date', startDate);
  if (endDate) params.append('end_date', endDate);
  
  window.location.href = `/api/export?${params.toString()}`;
}

async function initData() {
  if (!confirm('初始化样例数据将清空现有数据并重新导入，是否继续？')) {
    return;
  }
  
  try {
    const res = await fetch('/api/init-data', { method: 'POST' });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || '初始化失败');
    }
    showToast('样例数据初始化成功', 'success');
    loadTasks();
    loadProperties();
    loadCleaners();
    loadFilterOptions();
    loadStats();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function initEventListeners() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      
      btn.classList.add('active');
      document.getElementById(`${btn.dataset.tab}-tab`).classList.add('active');
      
      if (btn.dataset.tab === 'properties') loadProperties();
      if (btn.dataset.tab === 'cleaners') loadCleaners();
      if (btn.dataset.tab === 'stats') loadStats();
    });
  });
  
  document.getElementById('newTaskBtn').addEventListener('click', createNewTask);
  document.getElementById('searchBtn').addEventListener('click', loadTasks);
  document.getElementById('resetBtn').addEventListener('click', () => {
    document.getElementById('filterStatus').value = '';
    document.getElementById('filterProperty').value = '';
    document.getElementById('filterCleaner').value = '';
    document.getElementById('filterBookingId').value = '';
    document.getElementById('filterStartDate').value = '';
    document.getElementById('filterEndDate').value = '';
    loadTasks();
  });
  
  document.getElementById('newPropertyBtn').addEventListener('click', createNewProperty);
  document.getElementById('newCleanerBtn').addEventListener('click', createNewCleaner);
  
  document.getElementById('refreshStatsBtn').addEventListener('click', loadStats);
  
  document.getElementById('exportBtn').addEventListener('click', exportReport);
  document.getElementById('initDataBtn').addEventListener('click', initData);
}

async function init() {
  initEventListeners();
  await loadFilterOptions();
  await loadTasks();
}

document.addEventListener('DOMContentLoaded', init);
