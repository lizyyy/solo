const fs = require('fs');

class Exporter {
  constructor(db) {
    this.db = db;
  }

  exportMarkdown(filePath, options = {}) {
    const event = this.db.getCurrentEvent();
    if (!event) {
      throw new Error('没有当前活动');
    }

    const appointments = this.db.getAppointments({ event_id: event.id });
    const volunteers = this.db.getVolunteers();
    const elders = this.db.getElders();
    const tools = this.db.getTools();
    const rooms = this.db.getRooms();
    const schedules = this.db.getVolunteerSchedules(event.id);

    const volunteersById = new Map(volunteers.map(v => [v.id, v]));
    const eldersById = new Map(elders.map(e => [e.id, e]));
    const roomsById = new Map(rooms.map(r => [r.id, r]));

    let markdown = this.generateMarkdownHeader(event);
    markdown += this.generateVolunteerScheduleSection(schedules, volunteersById);
    markdown += this.generateAppointmentsByRoomSection(appointments, eldersById, volunteersById, roomsById);
    markdown += this.generateSpecialNeedsSection(appointments, eldersById);
    markdown += this.generateToolStatusSection(tools);
    markdown += this.generateSummarySection(event, appointments, volunteers, conflicts);
    markdown += this.generateNotesSection();

    fs.writeFileSync(filePath, markdown, 'utf8');
    return { success: true, path: filePath };
  }

  generateMarkdownHeader(event) {
    const now = new Date();
    const dateStr = now.toLocaleDateString('zh-CN');
    const timeStr = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });

    return `# 公益理发服务交接单

## 基本信息

| 项目 | 内容 |
|------|------|
| 活动名称 | ${event.name || '未命名'} |
| 服务日期 | ${event.date || dateStr} |
| 服务地点 | ${event.location || '待定'} |
| 生成时间 | ${dateStr} ${timeStr} |
| 活动备注 | ${event.notes || '无'} |

---

`;
  }

  generateVolunteerScheduleSection(schedules, volunteersById) {
    if (schedules.length === 0) {
      return `## 志愿者排班

暂无排班信息

---

`;
    }

    let content = `## 志愿者排班

| 志愿者 | 开始时间 | 结束时间 | 角色 | 备注 |
|---------|----------|----------|------|------|
`;

    for (const schedule of schedules) {
      const volunteer = volunteersById.get(schedule.volunteer_id);
      content += `| ${volunteer?.name || '未知'} | ${schedule.start_time} | ${schedule.end_time} | ${schedule.role || ''} | ${schedule.notes || ''} |
`;
    }

    content += `
---

`;
    return content;
  }

  generateAppointmentsByRoomSection(appointments, eldersById, volunteersById, roomsById) {
    if (appointments.length === 0) {
      return `## 预约安排

暂无预约信息

---

`;
    }

    const appointmentsByRoom = new Map();
    for (const appointment of appointments) {
      const roomId = appointment.room_id || 'unassigned';
      if (!appointmentsByRoom.has(roomId)) {
        appointmentsByRoom.set(roomId, []);
      }
      appointmentsByRoom.get(roomId).push(appointment);
    }

    let content = `## 预约安排（按房间/时段）

`;

    for (const [roomId, roomAppointments] of appointmentsByRoom) {
      const room = roomsById.get(parseInt(roomId));
      const roomName = room?.name || (roomId === 'unassigned' ? '未分配房间' : '未知房间');
      
      content += `### ${roomName}

| 时段 | 老人 | 房间/床号 | 服务类型 | 志愿者 | 状态 | 备注 |
|------|------|-----------|----------|--------|------|------|
`;

      const sorted = [...roomAppointments].sort((a, b) => 
        this.timeToMinutes(a.start_time) - this.timeToMinutes(b.start_time)
      );

      for (const appointment of sorted) {
        const elder = eldersById.get(appointment.elder_id);
        const volunteer = volunteersById.get(appointment.volunteer_id);
        
        const statusText = this.getStatusText(appointment.status);
        const endTime = appointment.end_time || this.addMinutes(appointment.start_time, 30);
        
        content += `| ${appointment.start_time} - ${endTime} | ${elder?.name || '未知'} | ${elder?.room_number || ''}${elder?.bed_number ? '/' + elder.bed_number : ''} | ${appointment.service_type || '剪发'} | ${volunteer?.name || ''} | ${statusText} | ${appointment.notes || ''} |
`;
      }

      content += `
`;
    }

    content += `---

`;
    return content;
  }

  generateSpecialNeedsSection(appointments, eldersById) {
    const specialNeedsAppointments = [];

    for (const appointment of appointments) {
      const elder = eldersById.get(appointment.elder_id);
      if (!elder) continue;

      const hasSpecialNeeds = elder.needs_home_visit || elder.avoid_perm_dye || 
                             elder.allergies || elder.mobility_issues || elder.special_needs;
      
      if (hasSpecialNeeds) {
        specialNeedsAppointments.push({ appointment, elder });
      }
    }

    if (specialNeedsAppointments.length === 0) {
      return `## 特殊需求提醒

暂无特殊需求

---

`;
    }

    let content = `## 特殊需求提醒

| 老人 | 时段 | 特殊需求 |
|------|------|----------|
`;

    for (const { appointment, elder } of specialNeedsAppointments) {
      const needs = [];
      if (elder.needs_home_visit) needs.push('⚠️ 需上门服务');
      if (elder.avoid_perm_dye) needs.push('🚫 避开染烫');
      if (elder.allergies) needs.push(`⚠️ 过敏: ${elder.allergies}`);
      if (elder.mobility_issues) needs.push(`🚶 行动不便: ${elder.mobility_issues}`);
      if (elder.special_needs) needs.push(`📋 ${elder.special_needs}`);

      content += `| ${elder.name} | ${appointment.start_time} | ${needs.join('；')} |
`;
    }

    content += `
---

`;
    return content;
  }

  generateToolStatusSection(tools) {
    if (tools.length === 0) {
      return `## 工具状态

暂无工具信息

---

`;
    }

    let content = `## 工具状态

| 工具名称 | 类型 | 状态 | 备注 |
|----------|------|------|------|
`;

    for (const tool of tools) {
      const statusEmoji = tool.status === 'available' ? '✅ 可用' : 
                        tool.status === 'unavailable' ? '❌ 不可用' : '❓ 未知';
      
      content += `| ${tool.name} | ${tool.type || ''} | ${statusEmoji} | ${tool.notes || ''} |
`;
    }

    content += `
---

`;
    return content;
  }

  generateSummarySection(event, appointments, volunteers, conflicts) {
    const totalAppointments = appointments.length;
    const byStatus = this.groupByStatus(appointments);
    
    let content = `## 统计汇总

| 项目 | 数量 |
|------|------|
| 总预约数 | ${totalAppointments} |
| 志愿者人数 | ${volunteers.length} |
| 待确认 | ${byStatus.get('scheduled')?.length || 0} |
| 已确认 | ${byStatus.get('confirmed')?.length || 0} |
| 已完成 | ${byStatus.get('completed')?.length || 0} |
| 已取消 | ${byStatus.get('cancelled')?.length || 0} |

---

`;
    return content;
  }

  generateNotesSection() {
    return `## 交接备注

### 注意事项
1. 请提前确认所有工具消毒情况
2. 上门服务请提前联系确认老人情况
3. 有过敏史的老人请确认使用产品
4. 行动不便老人请安排合适位置

### 人工改判记录
（如有需要，请在此处记录）

---

*交接单生成完毕，请妥善保管*
`;
  }

  exportJson(filePath, options = {}) {
    const event = this.db.getCurrentEvent();
    if (!event) {
      throw new Error('没有当前活动');
    }

    const appointments = this.db.getAppointments({ event_id: event.id });
    const volunteers = this.db.getVolunteers();
    const elders = this.db.getElders();
    const tools = this.db.getTools();
    const rooms = this.db.getRooms();
    const schedules = this.db.getVolunteerSchedules(event.id);

    const exportData = {
      exportInfo: {
        exportedAt: new Date().toISOString(),
        version: '1.0'
      },
      event: event,
      volunteers: volunteers,
      volunteersSchedules: schedules,
      elders: elders,
      tools: tools,
      rooms: rooms,
      appointments: appointments.map(appt => ({
        ...appt,
        elder: elders.find(e => e.id === appt.elder_id),
        volunteer: volunteers.find(v => v.id === appt.volunteer_id),
        room: rooms.find(r => r.id === appt.room_id)
      })),
      statistics: {
        totalAppointments: appointments.length,
        byStatus: this.groupByStatus(appointments),
        byRoom: this.groupByRoom(appointments, rooms)
      }
    };

    const jsonString = JSON.stringify(exportData, null, 2);
    fs.writeFileSync(filePath, jsonString, 'utf8');
    
    return { success: true, path: filePath };
  }

  groupByStatus(appointments) {
    const groups = new Map();
    for (const appt of appointments) {
      const status = appt.status || 'scheduled';
      if (!groups.has(status)) {
        groups.set(status, []);
      }
      groups.get(status).push(appt);
    }
    return groups;
  }

  groupByRoom(appointments, rooms) {
    const groups = new Map();
    const roomsById = new Map(rooms.map(r => [r.id, r]));
    
    for (const appt of appointments) {
      const roomId = appt.room_id || 'unassigned';
      const room = roomsById.get(roomId);
      const roomName = room?.name || '未分配';
      
      if (!groups.has(roomName)) {
        groups.set(roomName, []);
      }
      groups.get(roomName).push(appt);
    }
    return groups;
  }

  timeToMinutes(timeStr) {
    if (!timeStr) return 0;
    const match = timeStr.match(/(\d{1,2}):(\d{2})/);
    if (!match) return 0;
    return parseInt(match[1]) * 60 + parseInt(match[2]);
  }

  addMinutes(timeStr, minutesToAdd) {
    const minutes = this.timeToMinutes(timeStr) + minutesToAdd;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  }

  getStatusText(status) {
    const statusMap = {
      'scheduled': '⏳ 待确认',
      'confirmed': '✅ 已确认',
      'completed': '✔️ 已完成',
      'cancelled': '❌ 已取消',
      'rescheduled': '🔄 已改期'
    };
    return statusMap[status] || '⏳ 待确认';
  }
}

module.exports = Exporter;
