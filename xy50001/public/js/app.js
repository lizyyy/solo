let currentTab = 'dashboard';
let students = [];
let teachers = [];
let vehicles = [];
let activities = [];
let currentActivityId = null;
let editingStudentId = null;

const sampleData = {
  students: [
    { name: '张三', student_id: '2023001', class_name: '初一(1)班', gender: '男', phone: '13800138001', parent_phone: '13900139001' },
    { name: '李四', student_id: '2023002', class_name: '初一(1)班', gender: '女', phone: '13800138002', parent_phone: '13900139002' },
    { name: '王五', student_id: '2023003', class_name: '初一(1)班', gender: '男', phone: '13800138003', parent_phone: '13900139003' },
    { name: '赵六', student_id: '2023004', class_name: '初一(1)班', gender: '女', phone: '13800138004', parent_phone: '13900139004' },
    { name: '陈七', student_id: '2023005', class_name: '初一(2)班', gender: '男', phone: '13800138005', parent_phone: '13900139005' },
    { name: '刘八', student_id: '2023006', class_name: '初一(2)班', gender: '女', phone: '13800138006', parent_phone: '13900139006' },
    { name: '周九', student_id: '2023007', class_name: '初一(2)班', gender: '男', phone: '13800138007', parent_phone: '13900139007' },
    { name: '吴十', student_id: '2023008', class_name: '初一(2)班', gender: '女', phone: '13800138008', parent_phone: '13900139008' },
    { name: '郑十一', student_id: '2023009', class_name: '初一(3)班', gender: '男', phone: '13800138009', parent_phone: '13900139009' },
    { name: '孙十二', student_id: '2023010', class_name: '初一(3)班', gender: '女', phone: '13800138010', parent_phone: '13900139010' },
    { name: '钱十三', student_id: '2023011', class_name: '初一(3)班', gender: '男', phone: '13800138011', parent_phone: '13900139011' },
    { name: '冯十四', student_id: '2023012', class_name: '初二(1)班', gender: '女', phone: '13800138012', parent_phone: '13900139012' }
  ],
  teachers: [
    { name: '王老师', phone: '13700137001', role: '年级组长' },
    { name: '李老师', phone: '13700137002', role: '班主任' },
    { name: '张老师', phone: '13700137003', role: '班主任' }
  ],
  vehicles: [
    { plate_number: '粤A12345', capacity: 45, driver_name: '陈师傅', driver_phone: '13600136001' },
    { plate_number: '粤A67890', capacity: 45, driver_name: '刘师傅', driver_phone: '13600136002' }
  ],
  activities: [
    { name: '2024年春季春游 - 白云山', type: '春游', date: '2024-04-15', meeting_point: '学校正门' },
    { name: '2024年秋季秋游 - 大夫山', type: '秋游', date: '2024-10-20', meeting_point: '学校东门' }
  ],
  health_tags: [
    { student_id: 1, tag_type: 'allergy', tag_value: '花生过敏', severity: 'high', note: '接触后会皮疹' },
    { student_id: 3, tag_type: 'disease', tag_value: '哮喘', severity: 'high', note: '需随身携带药物' },
    { student_id: 5, tag_type: 'allergy', tag_value: '海鲜过敏', severity: 'medium', note: '避免食用海鲜' },
    { student_id: 8, tag_type: 'special', tag_value: '行动不便', severity: 'medium', note: '需老师陪同' }
  ]
};

async function api(url, options = {}) {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || '请求失败');
  }
  return response.json();
}

function switchTab(tabName) {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.toggle('active', content.id === `tab-${tabName}`);
  });
  currentTab = tabName;
  
  if (tabName === 'students') loadStudents();
  if (tabName === 'health') loadHealthTags();
  if (tabName === 'activities') loadActivities();
  if (tabName === 'export') loadExportActivities();
  if (tabName === 'risk') loadRiskActivities();
  if (tabName === 'dashboard') loadDashboard();
}

function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast show ${type}`;
  setTimeout(() => toast.classList.remove('show'), 3000);
}

function openModal(title, content) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = content;
  document.getElementById('modal').classList.add('active');
}

function closeModal() {
  document.getElementById('modal').classList.remove('active');
  editingStudentId = null;
}

async function loadDashboard() {
  try {
    const [studentsData, activitiesData, healthData] = await Promise.all([
      api('/api/students'),
      api('/api/activities'),
      api('/api/health-tags')
    ]);
    
    document.getElementById('stat-students').textContent = studentsData.length;
    document.getElementById('stat-activities').textContent = activitiesData.length;
    document.getElementById('stat-health').textContent = healthData.length;
    
    let riskCount = 0;
    for (const act of activitiesData) {
      const risks = await api(`/api/risk/${act.id}`);
      riskCount += risks.length;
    }
    document.getElementById('stat-risks').textContent = riskCount;
    
    const select = document.getElementById('recent-activity-select');
    select.innerHTML = '<option value="">选择活动</option>' + 
      activitiesData.map(a => `<option value="${a.id}">${a.name}</option>`).join('');
    select.onchange = (e) => showActivitySummary(e.target.value);
    
    const list = document.getElementById('recent-activities-list');
    if (activitiesData.length === 0) {
      list.innerHTML = '<div class="empty-state"><p>暂无活动，点击"创建活动方案"开始</p></div>';
    } else {
      list.innerHTML = activitiesData.map(a => `
        <div class="activity-item">
          <div class="activity-info">
            <h3>${a.name}</h3>
            <p>${a.date} | 集合点: ${a.meeting_point}</p>
          </div>
          <div>
            <button class="btn btn-sm" onclick="showActivitySummary(${a.id})">查看详情</button>
          </div>
        </div>
      `).join('');
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function showActivitySummary(activityId) {
  if (!activityId) return;
  const [activity, risks] = await Promise.all([
    api(`/api/activities/${activityId}`),
    api(`/api/risk/${activityId}`)
  ]);
  
  const content = `
    <div class="panel" style="box-shadow:none; margin:0;">
      <h3>${activity.name}</h3>
      <p><strong>日期:</strong> ${activity.date}</p>
      <p><strong>集合点:</strong> ${activity.meeting_point}</p>
      <p><strong>车辆:</strong> ${activity.vehicles?.length || 0} 辆</p>
      <p><strong>已分配学生:</strong> ${activity.assignments?.length || 0} 人</p>
      <p><strong>风险数量:</strong> <span style="color:${risks.length > 0 ? '#e74c3c' : '#27ae60'}">${risks.length} 项</span></p>
    </div>
  `;
  openModal('活动详情', content);
}

async function loadStudents() {
  try {
    students = await api('/api/students');
    const classes = await api('/api/classes');
    
    const filter = document.getElementById('student-class-filter');
    const currentVal = filter.value;
    filter.innerHTML = '<option value="all">全部班级</option>' + 
      classes.map(c => `<option value="${c.class_name}">${c.class_name}</option>`).join('');
    filter.value = currentVal;
    filter.onchange = filterStudents;
    
    filterStudents();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function filterStudents() {
  const className = document.getElementById('student-class-filter').value;
  const filtered = className === 'all' ? students : 
    students.filter(s => s.class_name === className);
  
  renderStudents(filtered);
}

function renderStudents(studentList) {
  const tbody = document.getElementById('students-table-body');
  
  if (studentList.length === 0) {
    tbody.innerHTML = `
      <tr><td colspan="8" class="empty-state">
        <p>暂无学生数据</p>
        <button class="btn" onclick="switchTab('import')">导入数据</button>
      </td></tr>
    `;
    return;
  }
  
  tbody.innerHTML = studentList.map(s => `
    <tr>
      <td>${s.name}</td>
      <td>${s.student_id || '-'}</td>
      <td>${s.class_name}</td>
      <td>${s.gender || '-'}</td>
      <td>${s.phone || '-'}</td>
      <td>${s.parent_phone || '-'}</td>
      <td>
        ${(s.health_tags || '').split(',').filter(Boolean).map(t => 
          `<span class="badge badge-allergy">${t}</span>`
        ).join('') || '-'}
      </td>
      <td>
        <button class="btn btn-sm" onclick="editStudent(${s.id})">编辑</button>
        <button class="btn btn-sm btn-danger" onclick="deleteStudent(${s.id})">删除</button>
      </td>
    </tr>
  `).join('');
}

function openStudentModal() {
  editingStudentId = null;
  renderStudentForm({});
  openModal('添加学生', getStudentFormHTML({}));
}

function editStudent(id) {
  const student = students.find(s => s.id === id);
  if (!student) return;
  editingStudentId = id;
  openModal('编辑学生', getStudentFormHTML(student));
}

function getStudentFormHTML(data) {
  return `
    <div class="form-group">
      <label>姓名 *</label>
      <input type="text" id="form-name" value="${data.name || ''}" required>
    </div>
    <div class="form-group">
      <label>学号</label>
      <input type="text" id="form-student_id" value="${data.student_id || ''}">
    </div>
    <div class="form-group">
      <label>班级 *</label>
      <input type="text" id="form-class_name" value="${data.class_name || ''}" placeholder="如: 初一(1)班">
    </div>
    <div class="form-group">
      <label>性别</label>
      <select id="form-gender">
        <option value="">请选择</option>
        <option value="男" ${data.gender === '男' ? 'selected' : ''}>男</option>
        <option value="女" ${data.gender === '女' ? 'selected' : ''}>女</option>
      </select>
    </div>
    <div class="form-group">
      <label>联系电话</label>
      <input type="tel" id="form-phone" value="${data.phone || ''}">
    </div>
    <div class="form-group">
      <label>家长电话</label>
      <input type="tel" id="form-parent_phone" value="${data.parent_phone || ''}">
    </div>
    <div class="form-actions">
      <button class="btn" onclick="closeModal()">取消</button>
      <button class="btn btn-primary" onclick="saveStudent()">保存</button>
    </div>
  `;
}

async function saveStudent() {
  const data = {
    name: document.getElementById('form-name').value,
    student_id: document.getElementById('form-student_id').value,
    class_name: document.getElementById('form-class_name').value,
    gender: document.getElementById('form-gender').value,
    phone: document.getElementById('form-phone').value,
    parent_phone: document.getElementById('form-parent_phone').value
  };
  
  if (!data.name || !data.class_name) {
    showToast('请填写必填项', 'error');
    return;
  }
  
  try {
    if (editingStudentId) {
      await api(`/api/students/${editingStudentId}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      });
      showToast('更新成功', 'success');
    } else {
      await api('/api/students', {
        method: 'POST',
        body: JSON.stringify(data)
      });
      showToast('添加成功', 'success');
    }
    closeModal();
    loadStudents();
    if (currentTab === 'dashboard') loadDashboard();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteStudent(id) {
  if (!confirm('确定要删除该学生吗？相关的健康标签也会被删除。')) return;
  try {
    await api(`/api/students/${id}`, { method: 'DELETE' });
    showToast('删除成功', 'success');
    loadStudents();
    if (currentTab === 'dashboard') loadDashboard();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function loadHealthTags() {
  try {
    const [tags, studentsData] = await Promise.all([
      api('/api/health-tags'),
      api('/api/students')
    ]);
    
    const studentMap = {};
    studentsData.forEach(s => studentMap[s.id] = s.name);
    
    const tbody = document.getElementById('health-table-body');
    if (tags.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="empty-state">暂无健康标签</td></tr>`;
      return;
    }
    
    tbody.innerHTML = tags.map(t => `
      <tr>
        <td>${studentMap[t.student_id] || `ID:${t.student_id}`}</td>
        <td><span class="badge badge-${t.tag_type === 'allergy' ? 'allergy' : t.tag_type === 'disease' ? 'disease' : 'other'}">
          ${t.tag_type === 'allergy' ? '过敏' : t.tag_type === 'disease' ? '疾病' : '其他'}
        </span></td>
        <td>${t.tag_value}</td>
        <td>${t.severity === 'high' ? '高' : t.severity === 'medium' ? '中' : '低'}</td>
        <td>${t.note || '-'}</td>
      </tr>
    `).join('');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function openHealthModal() {
  try {
    const studentsData = await api('/api/students');
    openModal('添加健康标签', `
      <div class="form-group">
        <label>学生 *</label>
        <select id="form-health-student">
          ${studentsData.map(s => `<option value="${s.id}">${s.name} (${s.class_name})</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>标签类型 *</label>
        <select id="form-health-type">
          <option value="allergy">过敏</option>
          <option value="disease">疾病</option>
          <option value="special">特殊需求</option>
          <option value="other">其他</option>
        </select>
      </div>
      <div class="form-group">
        <label>标签内容 *</label>
        <input type="text" id="form-health-value" placeholder="如: 花生过敏、哮喘">
      </div>
      <div class="form-group">
        <label>严重程度</label>
        <select id="form-health-severity">
          <option value="low">低</option>
          <option value="medium" selected>中</option>
          <option value="high">高</option>
        </select>
      </div>
      <div class="form-group">
        <label>备注</label>
        <textarea id="form-health-note" placeholder="注意事项..."></textarea>
      </div>
      <div class="form-actions">
        <button class="btn" onclick="closeModal()">取消</button>
        <button class="btn btn-primary" onclick="saveHealthTag()">保存</button>
      </div>
    `);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function saveHealthTag() {
  const data = {
    student_id: parseInt(document.getElementById('form-health-student').value),
    tag_type: document.getElementById('form-health-type').value,
    tag_value: document.getElementById('form-health-value').value,
    severity: document.getElementById('form-health-severity').value,
    note: document.getElementById('form-health-note').value
  };
  
  if (!data.tag_value) {
    showToast('请填写标签内容', 'error');
    return;
  }
  
  try {
    await api('/api/health-tags', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    showToast('添加成功', 'success');
    closeModal();
    loadHealthTags();
    if (currentTab === 'dashboard') loadDashboard();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function loadActivities() {
  try {
    activities = await api('/api/activities');
    const list = document.getElementById('activities-list');
    
    if (activities.length === 0) {
      list.innerHTML = `<div class="empty-state"><p>暂无活动方案</p><button class="btn btn-primary" onclick="openActivityModal()">创建活动</button></div>`;
      return;
    }
    
    list.innerHTML = activities.map(a => `
      <div class="activity-item">
        <div class="activity-info">
          <h3>${a.name}</h3>
          <p>${a.type || '活动'} | ${a.date} | 集合点: ${a.meeting_point || '-'}</p>
        </div>
        <div>
          <button class="btn btn-sm" onclick="editActivity(${a.id})">编辑</button>
          <button class="btn btn-sm btn-primary" onclick="viewActivityDetail(${a.id})">管理</button>
        </div>
      </div>
    `).join('');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function openActivityModal() {
  currentActivityId = null;
  openModal('创建活动方案', getActivityFormHTML({}));
}

function getActivityFormHTML(data) {
  return `
    <div class="form-group">
      <label>活动名称 *</label>
      <input type="text" id="form-act-name" value="${data.name || ''}" placeholder="如: 2024年春季春游">
    </div>
    <div class="form-group">
      <label>活动类型</label>
      <select id="form-act-type">
        <option value="春游" ${data.type === '春游' ? 'selected' : ''}>春游</option>
        <option value="秋游" ${data.type === '秋游' ? 'selected' : ''}>秋游</option>
        <option value="其他" ${data.type === '其他' ? 'selected' : ''}>其他</option>
      </select>
    </div>
    <div class="form-group">
      <label>日期</label>
      <input type="date" id="form-act-date" value="${data.date || ''}">
    </div>
    <div class="form-group">
      <label>集合点</label>
      <input type="text" id="form-act-meeting" value="${data.meeting_point || ''}" placeholder="如: 学校正门">
    </div>
    <div class="form-actions">
      <button class="btn" onclick="closeModal()">取消</button>
      <button class="btn btn-primary" onclick="saveActivity()">保存</button>
    </div>
  `;
}

async function saveActivity() {
  const data = {
    name: document.getElementById('form-act-name').value,
    type: document.getElementById('form-act-type').value,
    date: document.getElementById('form-act-date').value,
    meeting_point: document.getElementById('form-act-meeting').value
  };
  
  if (!data.name) {
    showToast('请填写活动名称', 'error');
    return;
  }
  
  try {
    if (currentActivityId) {
      await api(`/api/activities/${currentActivityId}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      });
      showToast('更新成功', 'success');
    } else {
      await api('/api/activities', {
        method: 'POST',
        body: JSON.stringify(data)
      });
      showToast('创建成功', 'success');
    }
    closeModal();
    loadActivities();
    if (currentTab === 'dashboard') loadDashboard();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function editActivity(id) {
  const activity = activities.find(a => a.id === id);
  if (!activity) return;
  currentActivityId = id;
  openModal('编辑活动方案', getActivityFormHTML(activity));
}

async function viewActivityDetail(activityId) {
  try {
    const [activity, studentsData, teachersData, vehiclesData] = await Promise.all([
      api(`/api/activities/${activityId}`),
      api('/api/students'),
      api('/api/teachers'),
      api('/api/vehicles')
    ]);
    
    currentActivityId = activityId;
    
    const assignedMap = {};
    activity.assignments.forEach(a => assignedMap[a.student_id] = a);
    const vehicleMap = {};
    activity.vehicles.forEach(v => vehicleMap[v.id] = v);
    
    document.getElementById('activity-detail-panel').style.display = 'block';
    
    const studentOptions = studentsData.map(s => 
      `<option value="${s.id}" ${assignedMap[s.id] ? 'selected' : ''}>
        ${s.name} (${s.class_name})
      </option>`
    ).join('');
    
    const vehicleOptions = vehiclesData.map(v => 
      `<option value="${v.id}">${v.plate_number}</option>`
    ).join('');
    
    const teacherOptions = teachersData.map(t => 
      `<option value="${t.id}">${t.name} - ${t.role || ''}</option>`
    ).join('');
    
    const content = `
      <div style="padding: 1.5rem;">
        <h3>${activity.name}</h3>
        <p style="margin-bottom: 1rem; color: #666;">${activity.date} | 集合点: ${activity.meeting_point}</p>
        
        <div class="form-group">
          <label>选择车辆和带队老师</label>
          <div id="vehicle-selectors">
            ${vehiclesData.map(v => {
              const assigned = activity.vehicles.find(av => av.vehicle_id === v.id);
              return `
                <div style="display:flex; gap:0.5rem; margin-bottom:0.5rem; align-items:center;">
                  <label style="flex:1; margin:0;">
                    <input type="checkbox" class="vehicle-check" value="${v.id}" ${assigned ? 'checked' : ''}>
                    ${v.plate_number} (容量: ${v.capacity})
                  </label>
                  <select class="teacher-select" data-vehicle="${v.id}">
                    <option value="">选择老师</option>
                    ${teachersData.map(t => 
                      `<option value="${t.id}" ${assigned?.teacher_id === t.id ? 'selected' : ''}>${t.name}</option>`
                    ).join('')}
                  </select>
                </div>
              `;
            }).join('')}
          </div>
        </div>
        
        <div class="form-group">
          <label>分配学生座位 (可多选)</label>
          <select multiple id="student-select" style="height: 200px;">
            ${studentOptions}
          </select>
          <p style="font-size:0.8rem; color:#666; margin-top:0.25rem;">按住 Ctrl/Cmd 可多选</p>
        </div>
        
        <div style="display:flex; gap:0.5rem; justify-content:flex-end;">
          <button class="btn" onclick="closeActivityDetail()">取消</button>
          <button class="btn btn-primary" onclick="saveActivityDetail()">保存分配</button>
        </div>
      </div>
    `;
    
    document.getElementById('activity-detail-content').innerHTML = content;
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function closeActivityDetail() {
  document.getElementById('activity-detail-panel').style.display = 'none';
  currentActivityId = null;
}

async function saveActivityDetail() {
  if (!currentActivityId) return;
  
  const activity = activities.find(a => a.id === currentActivityId);
  if (!activity) return;
  
  const vehicleChecks = document.querySelectorAll('.vehicle-check:checked');
  const teacherSelects = document.querySelectorAll('.teacher-select');
  const studentSelect = document.getElementById('student-select');
  
  const selectedVehicles = [];
  vehicleChecks.forEach(check => {
    const teacherSelect = document.querySelector(`.teacher-select[data-vehicle="${check.value}"]`);
    selectedVehicles.push({
      vehicle_id: parseInt(check.value),
      teacher_id: teacherSelect?.value ? parseInt(teacherSelect.value) : null
    });
  });
  
  const selectedStudents = Array.from(studentSelect.selectedOptions).map((opt, idx) => ({
    student_id: parseInt(opt.value),
    vehicle_id: selectedVehicles[0]?.vehicle_id || null,
    seat_number: idx + 1
  }));
  
  const data = {
    name: activity.name,
    type: activity.type,
    date: activity.date,
    meeting_point: activity.meeting_point,
    vehicles: selectedVehicles,
    assignments: selectedStudents
  };
  
  try {
    await api(`/api/activities/${currentActivityId}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
    showToast('保存成功', 'success');
    closeActivityDetail();
    loadActivities();
    if (currentTab === 'dashboard') loadDashboard();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function loadRiskActivities() {
  try {
    activities = await api('/api/activities');
    const select = document.getElementById('risk-activity-select');
    select.innerHTML = '<option value="">选择活动</option>' + 
      activities.map(a => `<option value="${a.id}">${a.name}</option>`).join('');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function checkRisks() {
  const activityId = document.getElementById('risk-activity-select').value;
  if (!activityId) {
    showToast('请选择活动', 'error');
    return;
  }
  
  try {
    const risks = await api(`/api/risk/${activityId}`);
    const container = document.getElementById('risk-results');
    
    if (risks.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <p style="color:#27ae60; font-size:1.2rem;">所有检查通过！</p>
          <p>无未授权学生或禁忌问题</p>
        </div>
      `;
      return;
    }
    
    const riskTypeLabels = {
      no_consent: '未授权',
      health_risk: '健康禁忌',
      no_assignment: '未分配',
      wrong_group: '分组错误'
    };
    
    container.innerHTML = risks.map(r => `
      <div class="risk-item">
        <div class="risk-header">
          <div>
            <strong>${r.student_name}</strong> 
            <span style="color:#666;">(${r.class_name})</span>
          </div>
          <span class="risk-badge ${r.risk_level}">
            ${riskTypeLabels[r.risk_type] || r.risk_type}
            ${r.risk_level === 'high' ? ' · 高风险' : ' · 中风险'}
          </span>
        </div>
        <p style="color:#666;">${r.message}</p>
        <div class="risk-override">
          <label style="display:flex; align-items:center; gap:0.5rem;">
            <input type="checkbox" ${r.override ? 'checked' : ''} 
              onchange="toggleOverride(${r.student_id}, ${activityId}, '${r.risk_type}', this.checked)">
            人工改判放行
          </label>
          <input type="text" placeholder="改判原因" value="${r.override_note || ''}" 
            id="override-note-${r.student_id}-${r.risk_type}"
            style="margin-top:0.5rem; width:100%;"
            onchange="saveOverrideNote(${r.student_id}, ${activityId}, '${r.risk_type}')">
        </div>
      </div>
    `).join('');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function toggleOverride(studentId, activityId, riskType, override) {
  const noteInput = document.getElementById(`override-note-${studentId}-${riskType}`);
  try {
    await api('/api/risk/override', {
      method: 'POST',
      body: JSON.stringify({
        student_id: studentId,
        activity_id: activityId,
        risk_type: riskType,
        override,
        note: noteInput?.value || ''
      })
    });
    showToast(override ? '已放行' : '已取消放行', 'success');
    checkRisks();
    if (currentTab === 'dashboard') loadDashboard();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function saveOverrideNote(studentId, activityId, riskType) {
  const noteInput = document.getElementById(`override-note-${studentId}-${riskType}`);
  const checkbox = document.querySelector(`input[onchange*="toggleOverride(${studentId}, ${activityId}, '${riskType}'"]`);
  
  try {
    await api('/api/risk/override', {
      method: 'POST',
      body: JSON.stringify({
        student_id: studentId,
        activity_id: activityId,
        risk_type: riskType,
        override: checkbox?.checked || false,
        note: noteInput?.value || ''
      })
    });
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function loadExportActivities() {
  try {
    activities = await api('/api/activities');
    const select = document.getElementById('export-activity-select');
    select.innerHTML = '<option value="">选择活动</option>' + 
      activities.map(a => `<option value="${a.id}">${a.name}</option>`).join('');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function getSelectedActivityId() {
  const id = document.getElementById('export-activity-select').value;
  if (!id) showToast('请选择活动', 'error');
  return id;
}

function downloadFile(content, filename, type = 'text/plain') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function generateDepartureMD(data) {
  let md = `# ${data.activity.name} - 出发清单\n\n`;
  md += `**日期:** ${data.activity.date}  \n`;
  md += `**集合点:** ${data.activity.meeting_point}  \n`;
  md += `**学生总数:** ${data.total_students}  \n\n`;
  md += `---\n\n`;
  
  data.vehicles.forEach((v, idx) => {
    md += `## 车辆 ${idx + 1}: ${v.plate_number}\n\n`;
    md += `- **司机:** ${v.driver_name || '-'} (${v.driver_phone || '-'})\n`;
    md += `- **带队老师:** ${v.teacher_name || '-'} (${v.teacher_phone || '-'})\n`;
    md += `- **学生人数:** ${v.student_count}/${v.capacity}\n\n`;
    
    if (v.students.length > 0) {
      md += `| 座位 | 姓名 | 班级 |\n|------|------|------|\n`;
      v.students.forEach(s => {
        md += `| ${s.seat_number || '-'} | ${s.name} | ${s.class_name} |\n`;
      });
    } else {
      md += `> 暂无学生\n`;
    }
    md += `\n`;
  });
  
  return md;
}

function generateDepartureCSV(data) {
  const rows = [['车辆', '座位', '姓名', '班级', '带队老师']];
  data.vehicles.forEach(v => {
    v.students.forEach(s => {
      rows.push([v.plate_number, s.seat_number || '', s.name, s.class_name, v.teacher_name || '']);
    });
  });
  return rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
}

async function exportDeparture(format) {
  const activityId = getSelectedActivityId();
  if (!activityId) return;
  
  try {
    const data = await api(`/api/export/departure/${activityId}`);
    const filename = `${data.activity.name}_出发清单`;
    
    if (format === 'md') {
      downloadFile(generateDepartureMD(data), `${filename}.md`, 'text/markdown');
    } else {
      downloadFile(generateDepartureCSV(data), `${filename}.csv`, 'text/csv');
    }
    showToast('导出成功', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function generateRiskMD(data) {
  let md = `# ${data.activity.name} - 风险清单\n\n`;
  md += `**日期:** ${data.activity.date}  \n`;
  md += `**风险数量:** ${data.risks.length}  \n\n`;
  
  if (data.risks.length === 0) {
    md += `> 无风险，所有检查通过！\n`;
    return md;
  }
  
  md += `| 序号 | 学生 | 班级 | 风险类型 | 风险等级 | 说明 | 改判 |\n`;
  md += `|------|------|------|----------|----------|------|------|\n`;
  
  const riskTypeLabels = {
    no_consent: '未授权',
    health_risk: '健康禁忌',
    no_assignment: '未分配',
    wrong_group: '分组错误'
  };
  
  data.risks.forEach((r, idx) => {
    md += `| ${idx + 1} | ${r.student_name} | ${r.class_name} | ` +
      `${riskTypeLabels[r.risk_type] || r.risk_type} | ` +
      `${r.risk_level === 'high' ? '高' : r.risk_level === 'medium' ? '中' : '低'} | ` +
      `${r.message} | ${r.override ? '已放行' : '待处理'} |\n`;
  });
  
  return md;
}

function generateRiskCSV(data) {
  const riskTypeLabels = {
    no_consent: '未授权',
    health_risk: '健康禁忌',
    no_assignment: '未分配',
    wrong_group: '分组错误'
  };
  
  const rows = [['序号', '学生', '班级', '风险类型', '风险等级', '说明', '改判']];
  data.risks.forEach((r, idx) => {
    rows.push([
      idx + 1, r.student_name, r.class_name,
      riskTypeLabels[r.risk_type] || r.risk_type,
      r.risk_level === 'high' ? '高' : r.risk_level === 'medium' ? '中' : '低',
      r.message, r.override ? '已放行' : '待处理'
    ]);
  });
  return rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
}

async function exportRisk(format) {
  const activityId = getSelectedActivityId();
  if (!activityId) return;
  
  try {
    const data = await api(`/api/export/risk/${activityId}`);
    const filename = `${data.activity.name}_风险清单`;
    
    if (format === 'md') {
      downloadFile(generateRiskMD(data), `${filename}.md`, 'text/markdown');
    } else {
      downloadFile(generateRiskCSV(data), `${filename}.csv`, 'text/csv');
    }
    showToast('导出成功', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function generateParentMD(data) {
  let md = `# ${data.activity.name} - 家长确认单\n\n`;
  md += `**日期:** ${data.activity.date}  \n`;
  md += `**集合点:** ${data.activity.meeting_point}  \n\n`;
  md += `请各位家长确认以下信息是否正确：\n\n`;
  md += `---\n\n`;
  
  let currentClass = '';
  data.students.forEach(s => {
    if (s.class_name !== currentClass) {
      currentClass = s.class_name;
      md += `## ${currentClass}\n\n`;
    }
    md += `### ${s.name}\n\n`;
    md += `- **学号:** ${s.student_id || '-'}\n`;
    md += `- **车辆:** ${s.plate_number || '未分配'}\n`;
    md += `- **座位号:** ${s.seat_number || '-'}\n`;
    md += `- **带队老师:** ${s.teacher_name || '-'}\n`;
    md += `- **家长同意:** ${s.consent_status}\n\n`;
    md += `家长签字: _______________  日期: _______________\n\n`;
  });
  
  return md;
}

function generateParentCSV(data) {
  const rows = [['班级', '姓名', '学号', '家长同意状态', '车辆', '座位号', '带队老师']];
  data.students.forEach(s => {
    rows.push([
      s.class_name, s.name, s.student_id || '', s.consent_status,
      s.plate_number || '', s.seat_number || '', s.teacher_name || ''
    ]);
  });
  return rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
}

async function exportParent(format) {
  const activityId = getSelectedActivityId();
  if (!activityId) return;
  
  try {
    const data = await api(`/api/export/parent-confirm/${activityId}`);
    const filename = `${data.activity.name}_家长确认单`;
    
    if (format === 'md') {
      downloadFile(generateParentMD(data), `${filename}.md`, 'text/markdown');
    } else {
      downloadFile(generateParentCSV(data), `${filename}.csv`, 'text/csv');
    }
    showToast('导出成功', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function importSampleData() {
  if (!confirm('确定要导入示例数据吗？会添加学生、老师、车辆、健康标签等数据。')) return;
  
  try {
    const total = sampleData.students.length + sampleData.teachers.length + 
                  sampleData.vehicles.length + sampleData.activities.length + 
                  sampleData.health_tags.length;
    
    let imported = 0;
    
    for (const s of sampleData.students) {
      await api('/api/students', {
        method: 'POST',
        body: JSON.stringify(s)
      });
      imported++;
    }
    
    const students = await api('/api/students');
    const studentIdMap = {};
    students.forEach((s, idx) => studentIdMap[idx + 1] = s.id);
    
    for (const t of sampleData.teachers) {
      await api('/api/teachers', {
        method: 'POST',
        body: JSON.stringify(t)
      });
      imported++;
    }
    
    for (const v of sampleData.vehicles) {
      await api('/api/vehicles', {
        method: 'POST',
        body: JSON.stringify(v)
      });
      imported++;
    }
    
    for (const a of sampleData.activities) {
      await api('/api/activities', {
        method: 'POST',
        body: JSON.stringify(a)
      });
      imported++;
    }
    
    for (const h of sampleData.health_tags) {
      const newStudentId = studentIdMap[h.student_id];
      if (newStudentId) {
        await api('/api/health-tags', {
          method: 'POST',
          body: JSON.stringify({ ...h, student_id: newStudentId })
        });
        imported++;
      }
    }
    
    showToast(`成功导入 ${imported} 条数据`, 'success');
    if (currentTab === 'dashboard') loadDashboard();
    if (currentTab === 'students') loadStudents();
    if (currentTab === 'health') loadHealthTags();
    if (currentTab === 'activities') loadActivities();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function importCSV() {
  const fileInput = document.getElementById('csv-file');
  const type = document.getElementById('csv-type').value;
  
  if (!fileInput.files[0]) {
    showToast('请选择文件', 'error');
    return;
  }
  
  const formData = new FormData();
  formData.append('file', fileInput.files[0]);
  formData.append('type', type);
  
  try {
    const response = await fetch('/api/import/csv', {
      method: 'POST',
      body: formData
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
    showToast(`成功导入 ${result.imported} 条记录`, 'success');
    fileInput.value = '';
    if (currentTab === 'dashboard') loadDashboard();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function importJSON() {
  const fileInput = document.getElementById('json-file');
  
  if (!fileInput.files[0]) {
    showToast('请选择文件', 'error');
    return;
  }
  
  const formData = new FormData();
  formData.append('file', fileInput.files[0]);
  
  try {
    const response = await fetch('/api/import/json', {
      method: 'POST',
      body: formData
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
    showToast(`成功导入 ${result.imported} 条记录`, 'success');
    fileInput.value = '';
    if (currentTab === 'dashboard') loadDashboard();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function renderStudentForm(data) {
  const form = getStudentFormHTML(data);
}

function init() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });
  
  document.getElementById('modal').addEventListener('click', (e) => {
    if (e.target.id === 'modal') closeModal();
  });
  
  loadDashboard();
}

init();
