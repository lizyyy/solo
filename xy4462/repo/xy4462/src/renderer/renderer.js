class App {
  constructor() {
    this.currentEvent = null;
    this.volunteers = [];
    this.elders = [];
    this.tools = [];
    this.rooms = [];
    this.appointments = [];
    this.conflicts = [];
    this.activeTab = 'overview';
    this.init();
  }

  async init() {
    this.setupEventListeners();
    await this.loadInitialData();
    this.setupDefaultDate();
  }

  setupEventListeners() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => this.switchTab(btn.dataset.tab));
    });

    document.getElementById('newEventBtn').addEventListener('click', () => this.showNewEventModal());
    document.getElementById('importBtn').addEventListener('click', () => this.importData());
    document.getElementById('detectBtn').addEventListener('click', () => this.detectConflicts());
    document.getElementById('exportMarkdownBtn').addEventListener('click', () => this.exportMarkdown());
    document.getElementById('exportJsonBtn').addEventListener('click', () => this.exportJson());

    document.getElementById('modal-close').addEventListener('click', () => this.closeModal());
    document.getElementById('modal-cancel').addEventListener('click', () => this.closeModal());
    document.getElementById('modal-overlay').addEventListener('click', (e) => {
      if (e.target.id === 'modal-overlay') this.closeModal();
    });

    document.getElementById('refresh-schedule').addEventListener('click', () => this.refreshSchedule());
    document.getElementById('view-mode').addEventListener('change', () => this.refreshSchedule());
    document.getElementById('schedule-date').addEventListener('change', () => this.refreshSchedule());

    document.getElementById('appointment-status-filter').addEventListener('change', () => this.filterAppointments());
    document.getElementById('appointment-room-filter').addEventListener('change', () => this.filterAppointments());
    document.getElementById('appointment-search').addEventListener('input', () => this.filterAppointments());

    document.getElementById('conflict-severity-filter').addEventListener('change', () => this.renderConflicts());

    document.getElementById('add-volunteer-btn').addEventListener('click', () => this.showAddVolunteerModal());
    document.getElementById('add-elder-btn').addEventListener('click', () => this.showAddElderModal());
    document.getElementById('add-tool-btn').addEventListener('click', () => this.showAddToolModal());
  }

  setupDefaultDate() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('schedule-date').value = today;
  }

  async loadInitialData() {
    try {
      this.currentEvent = await window.electronAPI.getCurrentEvent();
      this.volunteers = await window.electronAPI.getVolunteers();
      this.elders = await window.electronAPI.getElders();
      this.tools = await window.electronAPI.getTools();
      this.rooms = await window.electronAPI.getRooms();

      if (this.currentEvent) {
        this.appointments = await window.electronAPI.getAppointments({ event_id: this.currentEvent.id });
      }

      this.updateStats();
      this.renderCurrentEvent();
      this.renderAppointments();
      this.renderVolunteers();
      this.renderElders();
      this.renderTools();
      this.renderRoomFilters();
    } catch (error) {
      console.error('Failed to load initial data:', error);
      this.showToast('加载数据失败', 'error');
    }
  }

  updateStats() {
    document.getElementById('stat-total-appointments').textContent = this.appointments.length;
    document.getElementById('stat-volunteers').textContent = this.volunteers.length;
    document.getElementById('stat-elders').textContent = this.elders.length;
    document.getElementById('stat-conflicts').textContent = this.conflicts.length;
  }

  renderCurrentEvent() {
    const container = document.getElementById('current-event-info');
    
    if (this.currentEvent) {
      container.innerHTML = `
        <div class="event-item">
          <div class="event-item-header">
            <span class="event-item-title">${this.currentEvent.name}</span>
            <span class="event-item-date">${this.currentEvent.date || '未设置'}</span>
          </div>
          <p><strong>地点:</strong> ${this.currentEvent.location || '待定'}</p>
          <p><strong>备注:</strong> ${this.currentEvent.notes || '无'}</p>
        </div>
      `;
    } else {
      container.innerHTML = '<p>暂无活动，请点击"新建活动"创建</p>';
    }
  }

  switchTab(tabId) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabId);
    });

    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.toggle('active', content.id === `tab-${tabId}`);
    });

    this.activeTab = tabId;

    if (tabId === 'schedule') {
      this.refreshSchedule();
    }
  }

  async showNewEventModal() {
    const today = new Date().toISOString().split('T')[0];
    
    this.showModal('新建活动', `
      <form id="new-event-form">
        <div class="form-group">
          <label for="event-name">活动名称 *</label>
          <input type="text" id="event-name" required placeholder="例如：XX养老院公益理发服务">
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="event-date">服务日期 *</label>
            <input type="date" id="event-date" required value="${today}">
          </div>
          <div class="form-group">
            <label for="event-location">服务地点</label>
            <input type="text" id="event-location" placeholder="例如：阳光养老院">
          </div>
        </div>
        <div class="form-group">
          <label for="event-notes">活动备注</label>
          <textarea id="event-notes" rows="3" placeholder="其他需要记录的信息..."></textarea>
        </div>
      </form>
    `, async () => {
      const name = document.getElementById('event-name').value.trim();
      const date = document.getElementById('event-date').value;
      const location = document.getElementById('event-location').value.trim();
      const notes = document.getElementById('event-notes').value.trim();

      if (!name || !date) {
        this.showToast('请填写活动名称和日期', 'warning');
        return false;
      }

      try {
        this.currentEvent = await window.electronAPI.createEvent({
          name,
          date,
          location,
          notes
        });
        
        this.appointments = [];
        this.updateStats();
        this.renderCurrentEvent();
        this.showToast('活动创建成功', 'success');
        return true;
      } catch (error) {
        console.error('Failed to create event:', error);
        this.showToast('创建活动失败', 'error');
        return false;
      }
    });
  }

  async importData() {
    if (!this.currentEvent) {
      this.showToast('请先创建活动', 'warning');
      return;
    }

    try {
      const result = await window.electronAPI.importData({
        eventId: this.currentEvent.id
      });

      if (result.success) {
        const { imported } = result.data;
        const totalImported = Object.values(imported).reduce((sum, arr) => sum + arr.length, 0);
        
        this.showToast(`成功导入 ${totalImported} 条数据`, 'success');
        
        await this.loadInitialData();
      } else {
        this.showToast(result.message || '导入失败', 'error');
      }
    } catch (error) {
      console.error('Import failed:', error);
      this.showToast('导入过程中出错', 'error');
    }
  }

  async detectConflicts() {
    if (!this.currentEvent) {
      this.showToast('请先创建活动并导入数据', 'warning');
      return;
    }

    try {
      const result = await window.electronAPI.detectConflicts(this.currentEvent.date);
      
      if (result.success) {
        this.conflicts = result.conflicts || [];
        this.updateStats();
        
        if (this.conflicts.length === 0) {
          this.showToast('未检测到冲突，数据状态良好！', 'success');
        } else {
          const highCount = this.conflicts.filter(c => c.severity === 'high').length;
          const mediumCount = this.conflicts.filter(c => c.severity === 'medium').length;
          
          this.showToast(`检测到 ${this.conflicts.length} 个冲突（高: ${highCount}, 中: ${mediumCount}）`, 'warning');
        }
        
        this.renderConflicts();
        this.switchTab('conflicts');
      } else {
        this.showToast(result.message || '检测失败', 'error');
      }
    } catch (error) {
      console.error('Conflict detection failed:', error);
      this.showToast('冲突检测失败', 'error');
    }
  }

  renderConflicts() {
    const container = document.getElementById('conflicts-list');
    const severityFilter = document.getElementById('conflict-severity-filter').value;

    let filteredConflicts = this.conflicts;
    if (severityFilter) {
      filteredConflicts = this.conflicts.filter(c => c.severity === severityFilter);
    }

    if (filteredConflicts.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">✅</div>
          <div class="empty-state-text">暂无冲突</div>
          <div class="empty-state-hint">点击"检测冲突"按钮检查数据状态</div>
        </div>
      `;
      return;
    }

    container.innerHTML = filteredConflicts.map((conflict, index) => `
      <div class="conflict-card ${conflict.severity}">
        <div class="conflict-header">
          <h3 class="conflict-title">
            <span>${this.getSeverityIcon(conflict.severity)}</span>
            ${conflict.title}
          </h3>
          <span class="conflict-severity ${conflict.severity}">
            ${this.getSeverityText(conflict.severity)}
          </span>
        </div>
        <p class="conflict-description">${conflict.description}</p>
        ${conflict.suggestion ? `
          <div class="conflict-suggestion">
            <strong>💡 建议:</strong> ${conflict.suggestion}
          </div>
        ` : ''}
        <div class="conflict-actions">
          <button class="btn btn-sm btn-primary" onclick="app.overrideConflict(${index})">
            人工改判
          </button>
          <button class="btn btn-sm btn-info" onclick="app.viewConflictDetails(${index})">
            查看详情
          </button>
        </div>
      </div>
    `).join('');
  }

  getSeverityIcon(severity) {
    switch (severity) {
      case 'high': return '🔴';
      case 'medium': return '🟡';
      case 'low': return '🟢';
      default: return '⚪';
    }
  }

  getSeverityText(severity) {
    switch (severity) {
      case 'high': return '高优先级';
      case 'medium': return '中优先级';
      case 'low': return '低优先级';
      default: return '未知';
    }
  }

  async overrideConflict(index) {
    const conflict = this.conflicts[index];
    
    this.showModal('人工改判', `
      <form id="override-form">
        <div class="form-group">
          <label>冲突描述</label>
          <p style="padding: 0.75rem; background: var(--light-color); border-radius: 4px;">
            ${conflict.title} - ${conflict.description}
          </p>
        </div>
        <div class="form-group">
          <label for="override-reason">改判原因 *</label>
          <textarea id="override-reason" rows="3" required placeholder="请说明改判的原因..."></textarea>
        </div>
        <div class="form-group">
          <label for="override-type">改判类型</label>
          <select id="override-type">
            <option value="ignore">忽略此冲突</option>
            <option value="resolved">标记为已解决</option>
            <option value="postpone">延后处理</option>
          </select>
        </div>
      </form>
    `, async () => {
      const reason = document.getElementById('override-reason').value.trim();
      const overrideType = document.getElementById('override-type').value;

      if (!reason) {
        this.showToast('请填写改判原因', 'warning');
        return false;
      }

      try {
        await window.electronAPI.saveManualOverride({
          appointment_id: conflict.appointment?.id,
          conflict_id: `${conflict.type}-${index}`,
          override_type: overrideType,
          reason: reason
        });

        this.conflicts.splice(index, 1);
        this.updateStats();
        this.renderConflicts();
        this.showToast('改判已保存', 'success');
        return true;
      } catch (error) {
        console.error('Failed to save override:', error);
        this.showToast('保存改判失败', 'error');
        return false;
      }
    });
  }

  viewConflictDetails(index) {
    const conflict = this.conflicts[index];
    
    let detailsHtml = `
      <div class="form-group">
        <label>冲突类型</label>
        <p>${conflict.title}</p>
      </div>
      <div class="form-group">
        <label>详细描述</label>
        <p>${conflict.description}</p>
      </div>
      <div class="form-group">
        <label>严重程度</label>
        <p>${this.getSeverityIcon(conflict.severity)} ${this.getSeverityText(conflict.severity)}</p>
      </div>
    `;

    if (conflict.appointment) {
      const elder = this.elders.find(e => e.id === conflict.appointment.elder_id);
      const volunteer = this.volunteers.find(v => v.id === conflict.appointment.volunteer_id);
      
      detailsHtml += `
        <div class="form-group">
          <label>关联预约</label>
          <div style="padding: 0.75rem; background: var(--light-color); border-radius: 4px;">
            <p><strong>老人:</strong> ${elder?.name || '未知'}</p>
            <p><strong>时段:</strong> ${conflict.appointment.start_time} - ${conflict.appointment.end_time || '待定'}</p>
            <p><strong>志愿者:</strong> ${volunteer?.name || '未分配'}</p>
          </div>
        </div>
      `;
    }

    detailsHtml += `
      <div class="form-group">
        <label>处理建议</label>
        <div style="padding: 0.75rem; background: #e7f3ff; border-radius: 4px; color: #0066cc;">
          💡 ${conflict.suggestion || '请手动检查并调整'}
        </div>
      </div>
    `;

    this.showModal('冲突详情', detailsHtml, null, true);
  }

  renderAppointments() {
    this.filterAppointments();
  }

  filterAppointments() {
    const statusFilter = document.getElementById('appointment-status-filter').value;
    const roomFilter = document.getElementById('appointment-room-filter').value;
    const searchText = document.getElementById('appointment-search').value.toLowerCase();

    let filtered = this.appointments;

    if (statusFilter) {
      filtered = filtered.filter(a => a.status === statusFilter);
    }

    if (roomFilter) {
      filtered = filtered.filter(a => a.room_id === parseInt(roomFilter));
    }

    if (searchText) {
      filtered = filtered.filter(a => {
        const elder = this.elders.find(e => e.id === a.elder_id);
        return elder?.name?.toLowerCase().includes(searchText);
      });
    }

    this.renderAppointmentsTable(filtered);
  }

  renderAppointmentsTable(appointments) {
    const tbody = document.getElementById('appointments-table-body');
    
    if (appointments.length === 0) {
      tbody.innerHTML = '<tr><td colspan="9" class="empty-state">暂无预约数据</td></tr>';
      return;
    }

    tbody.innerHTML = appointments.map(appointment => {
      const elder = this.elders.find(e => e.id === appointment.elder_id);
      const volunteer = this.volunteers.find(v => v.id === appointment.volunteer_id);
      const room = this.rooms.find(r => r.id === appointment.room_id);

      const needsBadges = [];
      if (elder) {
        if (elder.needs_home_visit) needsBadges.push('<span class="needs-badge needs-home">上门</span>');
        if (elder.avoid_perm_dye) needsBadges.push('<span class="needs-badge needs-avoid-perm">禁染烫</span>');
        if (elder.allergies) needsBadges.push('<span class="needs-badge needs-allergy">过敏</span>');
        if (elder.mobility_issues) needsBadges.push('<span class="needs-badge needs-mobility">行动不便</span>');
      }

      const endTime = appointment.end_time || this.addMinutes(appointment.start_time, 30);

      return `
        <tr>
          <td>${appointment.start_time} - ${endTime}</td>
          <td><strong>${elder?.name || '未知'}</strong></td>
          <td>${elder?.room_number || ''}${elder?.bed_number ? '/' + elder.bed_number : ''}</td>
          <td>${appointment.service_type || '剪发'}</td>
          <td>${volunteer?.name || '未分配'}</td>
          <td>${room?.name || '未分配'}</td>
          <td><span class="status-badge status-${appointment.status}">${this.getStatusText(appointment.status)}</span></td>
          <td>${needsBadges.join('') || '-'}</td>
          <td>
            <div class="action-buttons">
              <button class="action-btn edit" title="编辑" onclick="app.editAppointment(${appointment.id})">✏️</button>
              <button class="action-btn view" title="详情" onclick="app.viewAppointment(${appointment.id})">👁️</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  getStatusText(status) {
    const map = {
      'scheduled': '待确认',
      'confirmed': '已确认',
      'completed': '已完成',
      'cancelled': '已取消',
      'rescheduled': '已改期'
    };
    return map[status] || '待确认';
  }

  addMinutes(timeStr, minutesToAdd) {
    if (!timeStr) return '';
    const match = timeStr.match(/(\d{1,2}):(\d{2})/);
    if (!match) return timeStr;
    
    let hours = parseInt(match[1]);
    let minutes = parseInt(match[2]) + minutesToAdd;
    
    hours += Math.floor(minutes / 60);
    minutes = minutes % 60;
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  }

  renderRoomFilters() {
    const select = document.getElementById('appointment-room-filter');
    const currentValue = select.value;
    
    select.innerHTML = '<option value="">全部</option>';
    
    for (const room of this.rooms) {
      select.innerHTML += `<option value="${room.id}">${room.name}</option>`;
    }
    
    select.value = currentValue;
  }

  renderVolunteers() {
    const tbody = document.getElementById('volunteers-table-body');
    
    if (this.volunteers.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="empty-state">暂无志愿者数据</td></tr>';
      return;
    }

    tbody.innerHTML = this.volunteers.map(volunteer => `
      <tr>
        <td><strong>${volunteer.name}</strong></td>
        <td>${volunteer.phone || '-'}</td>
        <td>${volunteer.skills || '-'}</td>
        <td>${volunteer.notes || '-'}</td>
        <td>
          <div class="action-buttons">
            <button class="action-btn edit" title="编辑" onclick="app.editVolunteer(${volunteer.id})">✏️</button>
            <button class="action-btn delete" title="删除" onclick="app.deleteVolunteer(${volunteer.id})">🗑️</button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  renderElders() {
    const tbody = document.getElementById('elders-table-body');
    
    if (this.elders.length === 0) {
      tbody.innerHTML = '<tr><td colspan="9" class="empty-state">暂无老人数据</td></tr>';
      return;
    }

    tbody.innerHTML = this.elders.map(elder => `
      <tr>
        <td><strong>${elder.name}</strong></td>
        <td>${elder.room_number || '-'}</td>
        <td>${elder.bed_number || '-'}</td>
        <td>${elder.allergies || '-'}</td>
        <td>${elder.mobility_issues || '-'}</td>
        <td>${elder.needs_home_visit ? '✅ 是' : '❌ 否'}</td>
        <td>${elder.avoid_perm_dye ? '✅ 是' : '❌ 否'}</td>
        <td>${elder.notes || '-'}</td>
        <td>
          <div class="action-buttons">
            <button class="action-btn edit" title="编辑" onclick="app.editElder(${elder.id})">✏️</button>
            <button class="action-btn view" title="详情" onclick="app.viewElder(${elder.id})">👁️</button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  renderTools() {
    const tbody = document.getElementById('tools-table-body');
    
    if (this.tools.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="empty-state">暂无工具数据</td></tr>';
      return;
    }

    tbody.innerHTML = this.tools.map(tool => {
      const statusClass = tool.status === 'available' ? 'status-confirmed' : 'status-cancelled';
      const statusText = tool.status === 'available' ? '可用' : '不可用';

      return `
        <tr>
          <td><strong>${tool.name}</strong></td>
          <td>${tool.type || '-'}</td>
          <td>${tool.serial_number || '-'}</td>
          <td><span class="status-badge ${statusClass}">${statusText}</span></td>
          <td>-</td>
          <td>-</td>
          <td>
            <div class="action-buttons">
              <button class="action-btn edit" title="编辑" onclick="app.editTool(${tool.id})">✏️</button>
              <button class="action-btn view" title="消毒记录" onclick="app.viewToolRecords(${tool.id})">📋</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  refreshSchedule() {
    const viewMode = document.getElementById('view-mode').value;
    const grid = document.getElementById('schedule-grid');

    if (this.appointments.length === 0) {
      grid.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📅</div>
          <div class="empty-state-text">暂无排班数据</div>
          <div class="empty-state-hint">请先导入预约数据</div>
        </div>
      `;
      return;
    }

    if (viewMode === 'room') {
      this.renderScheduleByRoom(grid);
    } else {
      this.renderScheduleByTime(grid);
    }
  }

  renderScheduleByRoom(grid) {
    const appointmentsByRoom = new Map();
    
    for (const room of this.rooms) {
      appointmentsByRoom.set(room.id, {
        room: room,
        appointments: []
      });
    }

    for (const appointment of this.appointments) {
      if (appointment.room_id && appointmentsByRoom.has(appointment.room_id)) {
        appointmentsByRoom.get(appointment.room_id).appointments.push(appointment);
      }
    }

    let html = '<div class="table-container"><table class="schedule-table"><thead><tr><th>时段</th>';
    
    for (const room of this.rooms) {
      html += `<th>${room.name}</th>`;
    }
    
    html += '</tr></thead><tbody>';

    const timeSlots = this.generateTimeSlots();
    
    for (const timeSlot of timeSlots) {
      html += `<tr><td class="time-slot">${timeSlot}</td>`;
      
      for (const room of this.rooms) {
        const slotAppointments = this.appointments.filter(a => 
          a.room_id === room.id && 
          this.isTimeInSlot(a.start_time, timeSlot)
        );

        if (slotAppointments.length > 0) {
          html += '<td>';
          for (const appt of slotAppointments) {
            const elder = this.elders.find(e => e.id === appt.elder_id);
            const hasConflict = this.hasAppointmentConflict(appt);
            const conflictClass = hasConflict ? 'danger' : '';
            
            html += `
              <div class="appointment-card ${conflictClass}">
                <div class="appointment-card-header">
                  <span class="appointment-elder">${elder?.name || '未知'}</span>
                  <span class="appointment-room">${appt.start_time}</span>
                </div>
                <div class="appointment-details">
                  ${appt.service_type || '剪发'}
                </div>
              </div>
            `;
          }
          html += '</td>';
        } else {
          html += '<td>-</td>';
        }
      }
      
      html += '</tr>';
    }

    html += '</tbody></table></div>';
    grid.innerHTML = html;
  }

  renderScheduleByTime(grid) {
    const timeSlots = this.generateTimeSlots();
    
    let html = '<div class="table-container"><table class="schedule-table"><thead><tr><th>时段</th><th>房间</th><th>老人</th><th>服务类型</th><th>志愿者</th><th>状态</th></tr></thead><tbody>';

    for (const timeSlot of timeSlots) {
      const slotAppointments = this.appointments.filter(a => 
        this.isTimeInSlot(a.start_time, timeSlot)
      );

      if (slotAppointments.length === 0) {
        html += `<tr><td class="time-slot">${timeSlot}</td><td colspan="5" style="text-align: center; color: var(--text-muted);">无预约</td></tr>`;
        continue;
      }

      for (let i = 0; i < slotAppointments.length; i++) {
        const appt = slotAppointments[i];
        const elder = this.elders.find(e => e.id === appt.elder_id);
        const volunteer = this.volunteers.find(v => v.id === appt.volunteer_id);
        const room = this.rooms.find(r => r.id === appt.room_id);
        const hasConflict = this.hasAppointmentConflict(appt);

        html += `<tr${hasConflict ? ' style="background-color: #fff5f5;"' : ''}>`;
        
        if (i === 0) {
          html += `<td class="time-slot" rowspan="${slotAppointments.length}">${timeSlot}</td>`;
        }
        
        html += `
          <td>${room?.name || '未分配'}</td>
          <td><strong>${elder?.name || '未知'}</strong></td>
          <td>${appt.service_type || '剪发'}</td>
          <td>${volunteer?.name || '未分配'}</td>
          <td><span class="status-badge status-${appt.status}">${this.getStatusText(appt.status)}</span></td>
        </tr>`;
      }
    }

    html += '</tbody></table></div>';
    grid.innerHTML = html;
  }

  generateTimeSlots() {
    const slots = [];
    for (let hour = 8; hour < 18; hour++) {
      slots.push(`${hour.toString().padStart(2, '0')}:00`);
      slots.push(`${hour.toString().padStart(2, '0')}:30`);
    }
    return slots;
  }

  isTimeInSlot(timeStr, slotStart) {
    if (!timeStr) return false;
    
    const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})/);
    const slotMatch = slotStart.match(/(\d{1,2}):(\d{2})/);
    
    if (!timeMatch || !slotMatch) return false;
    
    const timeMinutes = parseInt(timeMatch[1]) * 60 + parseInt(timeMatch[2]);
    const slotMinutes = parseInt(slotMatch[1]) * 60 + parseInt(slotMatch[2]);
    
    return timeMinutes >= slotMinutes && timeMinutes < slotMinutes + 30;
  }

  hasAppointmentConflict(appointment) {
    return this.conflicts.some(c => 
      c.appointment?.id === appointment.id
    );
  }

  async exportMarkdown() {
    if (!this.currentEvent) {
      this.showToast('请先创建活动', 'warning');
      return;
    }

    try {
      const result = await window.electronAPI.exportMarkdown({
        eventId: this.currentEvent.id
      });

      if (result.success) {
        this.showToast(`交接单已导出: ${result.path}`, 'success');
      } else {
        if (result.message !== '未选择保存位置') {
          this.showToast(result.message || '导出失败', 'error');
        }
      }
    } catch (error) {
      console.error('Export failed:', error);
      this.showToast('导出失败', 'error');
    }
  }

  async exportJson() {
    if (!this.currentEvent) {
      this.showToast('请先创建活动', 'warning');
      return;
    }

    try {
      const result = await window.electronAPI.exportJson({
        eventId: this.currentEvent.id
      });

      if (result.success) {
        this.showToast(`JSON明细已导出: ${result.path}`, 'success');
      } else {
        if (result.message !== '未选择保存位置') {
          this.showToast(result.message || '导出失败', 'error');
        }
      }
    } catch (error) {
      console.error('Export failed:', error);
      this.showToast('导出失败', 'error');
    }
  }

  showAddVolunteerModal() {
    this.showModal('添加志愿者', `
      <form id="volunteer-form">
        <div class="form-group">
          <label for="volunteer-name">姓名 *</label>
          <input type="text" id="volunteer-name" required placeholder="请输入姓名">
        </div>
        <div class="form-group">
          <label for="volunteer-phone">电话</label>
          <input type="text" id="volunteer-phone" placeholder="请输入电话号码">
        </div>
        <div class="form-group">
          <label for="volunteer-skills">技能</label>
          <input type="text" id="volunteer-skills" placeholder="例如：剪发、烫染、护理">
        </div>
        <div class="form-group">
          <label for="volunteer-notes">备注</label>
          <textarea id="volunteer-notes" rows="2" placeholder="其他备注信息..."></textarea>
        </div>
      </form>
    `, async () => {
      const name = document.getElementById('volunteer-name').value.trim();
      
      if (!name) {
        this.showToast('请输入姓名', 'warning');
        return false;
      }

      this.showToast('志愿者功能需要后端支持，暂存本地', 'info');
      return true;
    });
  }

  showAddElderModal() {
    this.showModal('添加老人信息', `
      <form id="elder-form">
        <div class="form-group">
          <label for="elder-name">姓名 *</label>
          <input type="text" id="elder-name" required placeholder="请输入姓名">
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="elder-room">房间号</label>
            <input type="text" id="elder-room" placeholder="例如：101">
          </div>
          <div class="form-group">
            <label for="elder-bed">床号</label>
            <input type="text" id="elder-bed" placeholder="例如：1">
          </div>
        </div>
        <div class="form-group">
          <label for="elder-allergies">过敏史</label>
          <input type="text" id="elder-allergies" placeholder="例如：染发剂过敏">
        </div>
        <div class="form-group">
          <label for="elder-mobility">行动不便情况</label>
          <input type="text" id="elder-mobility" placeholder="例如：需要轮椅、视力不佳">
        </div>
        <div class="form-group">
          <div class="checkbox-group">
            <input type="checkbox" id="elder-home-visit">
            <label for="elder-home-visit">需要上门服务</label>
          </div>
          <div class="checkbox-group">
            <input type="checkbox" id="elder-avoid-perm">
            <label for="elder-avoid-perm">应避开染烫服务</label>
          </div>
        </div>
        <div class="form-group">
          <label for="elder-notes">特殊需求/备注</label>
          <textarea id="elder-notes" rows="2" placeholder="其他需要注意的事项..."></textarea>
        </div>
      </form>
    `, async () => {
      const name = document.getElementById('elder-name').value.trim();
      
      if (!name) {
        this.showToast('请输入姓名', 'warning');
        return false;
      }

      this.showToast('老人信息功能需要后端支持，暂存本地', 'info');
      return true;
    });
  }

  showAddToolModal() {
    this.showModal('添加工具', `
      <form id="tool-form">
        <div class="form-group">
          <label for="tool-name">工具名称 *</label>
          <input type="text" id="tool-name" required placeholder="例如：理发剪刀1号">
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="tool-type">类型</label>
            <select id="tool-type">
              <option value="">请选择</option>
              <option value="剪刀">剪刀</option>
              <option value="推子">推子</option>
              <option value="梳子">梳子</option>
              <option value="围布">围布</option>
              <option value="其他">其他</option>
            </select>
          </div>
          <div class="form-group">
            <label for="tool-status">状态</label>
            <select id="tool-status">
              <option value="available">可用</option>
              <option value="unavailable">不可用</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label for="tool-serial">编号</label>
          <input type="text" id="tool-serial" placeholder="工具编号/序列号">
        </div>
        <div class="form-group">
          <label for="tool-notes">备注</label>
          <textarea id="tool-notes" rows="2" placeholder="工具备注..."></textarea>
        </div>
      </form>
    `, async () => {
      const name = document.getElementById('tool-name').value.trim();
      
      if (!name) {
        this.showToast('请输入工具名称', 'warning');
        return false;
      }

      this.showToast('工具功能需要后端支持，暂存本地', 'info');
      return true;
    });
  }

  editAppointment(id) {
    const appointment = this.appointments.find(a => a.id === id);
    if (!appointment) return;

    const elder = this.elders.find(e => e.id === appointment.elder_id);
    const volunteer = this.volunteers.find(v => v.id === appointment.volunteer_id);

    this.showModal('编辑预约', `
      <form id="edit-appointment-form">
        <div class="form-group">
          <label>老人</label>
          <p style="padding: 0.75rem; background: var(--light-color); border-radius: 4px;">
            ${elder?.name || '未知'}
          </p>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="edit-appt-start">开始时间</label>
            <input type="time" id="edit-appt-start" value="${appointment.start_time || ''}">
          </div>
          <div class="form-group">
            <label for="edit-appt-end">结束时间</label>
            <input type="time" id="edit-appt-end" value="${appointment.end_time || ''}">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="edit-appt-room">房间</label>
            <select id="edit-appt-room">
              <option value="">请选择</option>
              ${this.rooms.map(r => `<option value="${r.id}"${r.id === appointment.room_id ? ' selected' : ''}>${r.name}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label for="edit-appt-status">状态</label>
            <select id="edit-appt-status">
              <option value="scheduled"${appointment.status === 'scheduled' ? ' selected' : ''}>待确认</option>
              <option value="confirmed"${appointment.status === 'confirmed' ? ' selected' : ''}>已确认</option>
              <option value="completed"${appointment.status === 'completed' ? ' selected' : ''}>已完成</option>
              <option value="cancelled"${appointment.status === 'cancelled' ? ' selected' : ''}>已取消</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label for="edit-appt-service">服务类型</label>
          <select id="edit-appt-service">
            <option value="剪发"${appointment.service_type === '剪发' ? ' selected' : ''}>剪发</option>
            <option value="剪发+修面"${appointment.service_type === '剪发+修面' ? ' selected' : ''}>剪发+修面</option>
            <option value="烫发"${appointment.service_type === '烫发' ? ' selected' : ''}>烫发</option>
            <option value="染发"${appointment.service_type === '染发' ? ' selected' : ''}>染发</option>
            <option value="护理"${appointment.service_type === '护理' ? ' selected' : ''}>护理</option>
          </select>
        </div>
        <div class="form-group">
          <label for="edit-appt-volunteer">志愿者</label>
          <select id="edit-appt-volunteer">
            <option value="">请选择</option>
            ${this.volunteers.map(v => `<option value="${v.id}"${v.id === appointment.volunteer_id ? ' selected' : ''}>${v.name}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label for="edit-appt-notes">备注</label>
          <textarea id="edit-appt-notes" rows="2">${appointment.notes || ''}</textarea>
        </div>
      </form>
    `, async () => {
      appointment.start_time = document.getElementById('edit-appt-start').value;
      appointment.end_time = document.getElementById('edit-appt-end').value;
      appointment.room_id = parseInt(document.getElementById('edit-appt-room').value) || null;
      appointment.status = document.getElementById('edit-appt-status').value;
      appointment.service_type = document.getElementById('edit-appt-service').value;
      appointment.volunteer_id = parseInt(document.getElementById('edit-appt-volunteer').value) || null;
      appointment.notes = document.getElementById('edit-appt-notes').value.trim();

      this.renderAppointments();
      this.showToast('预约已更新', 'success');
      return true;
    });
  }

  viewAppointment(id) {
    const appointment = this.appointments.find(a => a.id === id);
    if (!appointment) return;

    const elder = this.elders.find(e => e.id === appointment.elder_id);
    const volunteer = this.volunteers.find(v => v.id === appointment.volunteer_id);
    const room = this.rooms.find(r => r.id === appointment.room_id);

    let elderDetails = '';
    if (elder) {
      const needs = [];
      if (elder.needs_home_visit) needs.push('⚠️ 需要上门服务');
      if (elder.avoid_perm_dye) needs.push('🚫 应避开染烫');
      if (elder.allergies) needs.push(`⚠️ 过敏史: ${elder.allergies}`);
      if (elder.mobility_issues) needs.push(`🚶 行动不便: ${elder.mobility_issues}`);
      if (elder.special_needs) needs.push(`📋 特殊需求: ${elder.special_needs}`);

      elderDetails = needs.length > 0 ? `
        <div class="form-group">
          <label>老人特殊提醒</label>
          <div style="padding: 0.75rem; background: #fff8e6; border-radius: 4px; color: #cc7a00;">
            ${needs.join('<br>')}
          </div>
        </div>
      ` : '';
    }

    this.showModal('预约详情', `
      <div class="form-group">
        <label>老人</label>
        <p><strong>${elder?.name || '未知'}</strong></p>
        <p style="color: var(--text-muted); font-size: 0.9rem;">
          房间: ${elder?.room_number || '-'} | 床号: ${elder?.bed_number || '-'}
        </p>
      </div>
      ${elderDetails}
      <div class="form-group">
        <label>时段</label>
        <p>${appointment.start_time || '-'} - ${appointment.end_time || '待定'}</p>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>房间</label>
          <p>${room?.name || '未分配'}</p>
        </div>
        <div class="form-group">
          <label>服务类型</label>
          <p>${appointment.service_type || '剪发'}</p>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>志愿者</label>
          <p>${volunteer?.name || '未分配'}</p>
        </div>
        <div class="form-group">
          <label>状态</label>
          <p><span class="status-badge status-${appointment.status}">${this.getStatusText(appointment.status)}</span></p>
        </div>
      </div>
      ${appointment.notes ? `
        <div class="form-group">
          <label>备注</label>
          <p>${appointment.notes}</p>
        </div>
      ` : ''}
    `, null, true);
  }

  editVolunteer(id) {
    const volunteer = this.volunteers.find(v => v.id === id);
    if (!volunteer) return;

    this.showModal('编辑志愿者', `
      <form id="edit-volunteer-form">
        <div class="form-group">
          <label for="edit-volunteer-name">姓名</label>
          <input type="text" id="edit-volunteer-name" value="${volunteer.name || ''}">
        </div>
        <div class="form-group">
          <label for="edit-volunteer-phone">电话</label>
          <input type="text" id="edit-volunteer-phone" value="${volunteer.phone || ''}">
        </div>
        <div class="form-group">
          <label for="edit-volunteer-skills">技能</label>
          <input type="text" id="edit-volunteer-skills" value="${volunteer.skills || ''}">
        </div>
        <div class="form-group">
          <label for="edit-volunteer-notes">备注</label>
          <textarea id="edit-volunteer-notes" rows="2">${volunteer.notes || ''}</textarea>
        </div>
      </form>
    `, async () => {
      volunteer.name = document.getElementById('edit-volunteer-name').value.trim();
      volunteer.phone = document.getElementById('edit-volunteer-phone').value.trim();
      volunteer.skills = document.getElementById('edit-volunteer-skills').value.trim();
      volunteer.notes = document.getElementById('edit-volunteer-notes').value.trim();

      this.renderVolunteers();
      this.showToast('志愿者信息已更新', 'success');
      return true;
    });
  }

  deleteVolunteer(id) {
    this.showModal('确认删除', `
      <p>确定要删除此志愿者吗？此操作不可撤销。</p>
    `, async () => {
      const index = this.volunteers.findIndex(v => v.id === id);
      if (index > -1) {
        this.volunteers.splice(index, 1);
        this.renderVolunteers();
        this.updateStats();
        this.showToast('志愿者已删除', 'success');
      }
      return true;
    });
  }

  editElder(id) {
    const elder = this.elders.find(e => e.id === id);
    if (!elder) return;

    this.showModal('编辑老人信息', `
      <form id="edit-elder-form">
        <div class="form-group">
          <label for="edit-elder-name">姓名</label>
          <input type="text" id="edit-elder-name" value="${elder.name || ''}">
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="edit-elder-room">房间号</label>
            <input type="text" id="edit-elder-room" value="${elder.room_number || ''}">
          </div>
          <div class="form-group">
            <label for="edit-elder-bed">床号</label>
            <input type="text" id="edit-elder-bed" value="${elder.bed_number || ''}">
          </div>
        </div>
        <div class="form-group">
          <label for="edit-elder-allergies">过敏史</label>
          <input type="text" id="edit-elder-allergies" value="${elder.allergies || ''}">
        </div>
        <div class="form-group">
          <label for="edit-elder-mobility">行动不便情况</label>
          <input type="text" id="edit-elder-mobility" value="${elder.mobility_issues || ''}">
        </div>
        <div class="form-group">
          <div class="checkbox-group">
            <input type="checkbox" id="edit-elder-home-visit" ${elder.needs_home_visit ? 'checked' : ''}>
            <label for="edit-elder-home-visit">需要上门服务</label>
          </div>
          <div class="checkbox-group">
            <input type="checkbox" id="edit-elder-avoid-perm" ${elder.avoid_perm_dye ? 'checked' : ''}>
            <label for="edit-elder-avoid-perm">应避开染烫服务</label>
          </div>
        </div>
        <div class="form-group">
          <label for="edit-elder-notes">备注</label>
          <textarea id="edit-elder-notes" rows="2">${elder.notes || ''}</textarea>
        </div>
      </form>
    `, async () => {
      elder.name = document.getElementById('edit-elder-name').value.trim();
      elder.room_number = document.getElementById('edit-elder-room').value.trim();
      elder.bed_number = document.getElementById('edit-elder-bed').value.trim();
      elder.allergies = document.getElementById('edit-elder-allergies').value.trim();
      elder.mobility_issues = document.getElementById('edit-elder-mobility').value.trim();
      elder.needs_home_visit = document.getElementById('edit-elder-home-visit').checked;
      elder.avoid_perm_dye = document.getElementById('edit-elder-avoid-perm').checked;
      elder.notes = document.getElementById('edit-elder-notes').value.trim();

      this.renderElders();
      this.showToast('老人信息已更新', 'success');
      return true;
    });
  }

  viewElder(id) {
    const elder = this.elders.find(e => e.id === id);
    if (!elder) return;

    const needs = [];
    if (elder.needs_home_visit) needs.push('✅ 需要上门服务');
    else needs.push('❌ 不需要上门服务');
    if (elder.avoid_perm_dye) needs.push('🚫 应避开染烫服务');
    else needs.push('✅ 可接受染烫服务');

    const elderAppointments = this.appointments.filter(a => a.elder_id === elder.id);

    this.showModal('老人详情', `
      <div class="form-group">
        <label>基本信息</label>
        <p><strong>${elder.name}</strong></p>
        <p style="color: var(--text-muted);">房间: ${elder.room_number || '-'} | 床号: ${elder.bed_number || '-'}</p>
      </div>
      <div class="form-group">
        <label>特殊需求</label>
        <div style="padding: 0.75rem; background: var(--light-color); border-radius: 4px;">
          ${needs.join('<br>')}
        </div>
      </div>
      ${elder.allergies ? `
        <div class="form-group">
          <label>过敏史</label>
          <p style="color: #cc0000; background: #fff0f0; padding: 0.5rem; border-radius: 4px;">
            ⚠️ ${elder.allergies}
          </p>
        </div>
      ` : ''}
      ${elder.mobility_issues ? `
        <div class="form-group">
          <label>行动不便</label>
          <p style="color: #6600cc; background: #f0e6ff; padding: 0.5rem; border-radius: 4px;">
            🚶 ${elder.mobility_issues}
          </p>
        </div>
      ` : ''}
      ${elder.special_needs ? `
        <div class="form-group">
          <label>其他特殊需求</label>
          <p>${elder.special_needs}</p>
        </div>
      ` : ''}
      <div class="form-group">
        <label>关联预约 (${elderAppointments.length})</label>
        ${elderAppointments.length > 0 ? `
          <div style="max-height: 150px; overflow-y: auto;">
            ${elderAppointments.map(a => `
              <div style="padding: 0.5rem; border-bottom: 1px solid var(--border-color);">
                <span>${a.start_time || '-'} - ${a.service_type || '剪发'}</span>
                <span class="status-badge status-${a.status}" style="float: right;">${this.getStatusText(a.status)}</span>
              </div>
            `).join('')}
          </div>
        ` : '<p style="color: var(--text-muted);">暂无预约</p>'}
      </div>
    `, null, true);
  }

  editTool(id) {
    const tool = this.tools.find(t => t.id === id);
    if (!tool) return;

    this.showModal('编辑工具', `
      <form id="edit-tool-form">
        <div class="form-group">
          <label for="edit-tool-name">工具名称</label>
          <input type="text" id="edit-tool-name" value="${tool.name || ''}">
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="edit-tool-type">类型</label>
            <select id="edit-tool-type">
              <option value="">请选择</option>
              <option value="剪刀"${tool.type === '剪刀' ? ' selected' : ''}>剪刀</option>
              <option value="推子"${tool.type === '推子' ? ' selected' : ''}>推子</option>
              <option value="梳子"${tool.type === '梳子' ? ' selected' : ''}>梳子</option>
              <option value="围布"${tool.type === '围布' ? ' selected' : ''}>围布</option>
              <option value="其他"${tool.type === '其他' ? ' selected' : ''}>其他</option>
            </select>
          </div>
          <div class="form-group">
            <label for="edit-tool-status">状态</label>
            <select id="edit-tool-status">
              <option value="available"${tool.status === 'available' ? ' selected' : ''}>可用</option>
              <option value="unavailable"${tool.status === 'unavailable' ? ' selected' : ''}>不可用</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label for="edit-tool-serial">编号</label>
          <input type="text" id="edit-tool-serial" value="${tool.serial_number || ''}">
        </div>
        <div class="form-group">
          <label for="edit-tool-notes">备注</label>
          <textarea id="edit-tool-notes" rows="2">${tool.notes || ''}</textarea>
        </div>
      </form>
    `, async () => {
      tool.name = document.getElementById('edit-tool-name').value.trim();
      tool.type = document.getElementById('edit-tool-type').value;
      tool.status = document.getElementById('edit-tool-status').value;
      tool.serial_number = document.getElementById('edit-tool-serial').value.trim();
      tool.notes = document.getElementById('edit-tool-notes').value.trim();

      this.renderTools();
      this.showToast('工具信息已更新', 'success');
      return true;
    });
  }

  viewToolRecords(id) {
    const tool = this.tools.find(t => t.id === id);
    if (!tool) return;

    this.showModal('工具消毒记录', `
      <div class="form-group">
        <label>工具信息</label>
        <p><strong>${tool.name}</strong></p>
        <p style="color: var(--text-muted);">
          类型: ${tool.type || '-'} | 编号: ${tool.serial_number || '-'}
        </p>
      </div>
      <div class="form-group">
        <label>消毒记录</label>
        <div class="empty-state" style="padding: 1.5rem;">
          <div class="empty-state-icon">📋</div>
          <div class="empty-state-text">暂无消毒记录</div>
          <div class="empty-state-hint">请在工具管理中添加消毒记录</div>
        </div>
      </div>
    `, null, true);
  }

  showModal(title, content, onConfirm, hideFooter = false) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = content;
    
    const footer = document.querySelector('.modal-footer');
    footer.style.display = hideFooter ? 'none' : 'flex';
    
    this.modalConfirmCallback = onConfirm;
    document.getElementById('modal-overlay').classList.remove('hidden');
  }

  closeModal() {
    document.getElementById('modal-overlay').classList.add('hidden');
    this.modalConfirmCallback = null;
  }

  async confirmModal() {
    if (this.modalConfirmCallback) {
      const result = await this.modalConfirmCallback();
      if (result === true) {
        this.closeModal();
      }
    } else {
      this.closeModal();
    }
  }

  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icons = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️'
    };
    
    toast.innerHTML = `
      <span class="toast-icon">${icons[type] || icons.info}</span>
      <span class="toast-message">${message}</span>
    `;
    
    container.appendChild(toast);
    
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }
}

let app;
document.addEventListener('DOMContentLoaded', () => {
  app = new App();
  
  document.getElementById('modal-confirm').addEventListener('click', () => {
    app.confirmModal();
  });
});
