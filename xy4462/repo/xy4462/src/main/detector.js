class ConflictDetector {
  constructor(db) {
    this.db = db;
  }

  detectAll(date = null) {
    const event = this.db.getCurrentEvent();
    if (!event) {
      return {
        success: false,
        message: '没有当前活动',
        conflicts: []
      };
    }

    const appointments = this.db.getAppointments({ event_id: event.id });
    const volunteers = this.db.getVolunteers();
    const tools = this.db.getTools();
    const elders = this.db.getElders();
    const rooms = this.db.getRooms();
    const schedules = this.db.getVolunteerSchedules(event.id);

    const conflicts = [];

    conflicts.push(...this.detectTimeConflicts(appointments, volunteers, rooms));
    conflicts.push(...this.detectVolunteerScheduleConflicts(appointments, schedules, volunteers));
    conflicts.push(...this.detectToolConflicts(appointments, tools));
    conflicts.push(...this.detectElderSpecialNeeds(appointments, elders));
    conflicts.push(...this.detectRoomCapacityConflicts(appointments, rooms));

    const conflictGroups = this.groupConflicts(conflicts);

    return {
      success: true,
      event: event,
      totalAppointments: appointments.length,
      conflictCount: conflicts.length,
      conflictGroups: conflictGroups,
      conflicts: conflicts
    };
  }

  detectTimeConflicts(appointments, volunteers, rooms) {
    const conflicts = [];
    const appointmentsByRoom = this.groupBy(appointments, 'room_id');
    const appointmentsByVolunteer = this.groupBy(appointments, 'volunteer_id');
    const appointmentsByElder = this.groupBy(appointments, 'elder_id');

    for (const [roomId, roomAppointments] of appointmentsByRoom) {
      if (!roomId) continue;
      const room = rooms.find(r => r.id === roomId);
      const timeConflicts = this.findOverlappingAppointments(roomAppointments, room?.capacity || 1);
      
      for (const conflict of timeConflicts) {
        conflicts.push({
          type: 'room_time_conflict',
          severity: 'high',
          title: '房间时段冲突',
          description: `房间 ${room?.name || '未知'} 在 ${conflict.timeSlot} 时段有 ${conflict.count} 个预约重叠`,
          room: room,
          appointments: conflict.appointments,
          timeSlot: conflict.timeSlot,
          suggestion: '请调整其中一个预约的时间或房间'
        });
      }
    }

    for (const [volunteerId, volunteerAppointments] of appointmentsByVolunteer) {
      if (!volunteerId) continue;
      const volunteer = volunteers.find(v => v.id === volunteerId);
      const timeConflicts = this.findOverlappingAppointments(volunteerAppointments, 1);
      
      for (const conflict of timeConflicts) {
        conflicts.push({
          type: 'volunteer_time_conflict',
          severity: 'high',
          title: '志愿者时段冲突',
          description: `志愿者 ${volunteer?.name || '未知'} 在 ${conflict.timeSlot} 时段有 ${conflict.count} 个预约`,
          volunteer: volunteer,
          appointments: conflict.appointments,
          timeSlot: conflict.timeSlot,
          suggestion: '请调整志愿者的排班或预约时间'
        });
      }
    }

    for (const [elderId, elderAppointments] of appointmentsByElder) {
      if (!elderId || elderAppointments.length <= 1) continue;
      
      const timeConflicts = this.findOverlappingAppointments(elderAppointments, 1);
      
      for (const conflict of timeConflicts) {
        conflicts.push({
          type: 'elder_double_booking',
          severity: 'high',
          title: '老人重复预约',
          description: `同一老人在 ${conflict.timeSlot} 时段被重复预约`,
          appointments: conflict.appointments,
          timeSlot: conflict.timeSlot,
          suggestion: '请取消其中一个重复预约'
        });
      }
    }

    return conflicts;
  }

  findOverlappingAppointments(appointments, maxAllowed = 1) {
    const conflicts = [];
    const sorted = [...appointments].sort((a, b) => 
      this.timeToMinutes(a.start_time) - this.timeToMinutes(b.start_time)
    );

    for (let i = 0; i < sorted.length; i++) {
      const current = sorted[i];
      const currentStart = this.timeToMinutes(current.start_time);
      const currentEnd = this.timeToMinutes(current.end_time) || currentStart + 30;

      const overlapping = [current];

      for (let j = i + 1; j < sorted.length; j++) {
        const other = sorted[j];
        const otherStart = this.timeToMinutes(other.start_time);
        const otherEnd = this.timeToMinutes(other.end_time) || otherStart + 30;

        if (otherStart < currentEnd) {
          overlapping.push(other);
        }
      }

      if (overlapping.length > maxAllowed) {
        const timeSlot = `${current.start_time} - ${this.minutesToTime(currentEnd)}`;
        const existingConflict = conflicts.find(c => c.timeSlot === timeSlot);
        
        if (!existingConflict) {
          conflicts.push({
            timeSlot: timeSlot,
            count: overlapping.length,
            appointments: overlapping
          });
        }
      }
    }

    return conflicts;
  }

  detectVolunteerScheduleConflicts(appointments, schedules, volunteers) {
    const conflicts = [];
    const appointmentsByVolunteer = this.groupBy(appointments, 'volunteer_id');
    const schedulesByVolunteer = this.groupBy(schedules, 'volunteer_id');

    for (const [volunteerId, volunteerAppointments] of appointmentsByVolunteer) {
      if (!volunteerId) continue;

      const volunteer = volunteers.find(v => v.id === volunteerId);
      const volunteerSchedules = schedulesByVolunteer.get(volunteerId) || [];

      for (const appointment of volunteerAppointments) {
        const apptStart = this.timeToMinutes(appointment.start_time);
        const apptEnd = this.timeToMinutes(appointment.end_time) || apptStart + 30;

        const isCovered = volunteerSchedules.some(schedule => {
          const schedStart = this.timeToMinutes(schedule.start_time);
          const schedEnd = this.timeToMinutes(schedule.end_time);
          return apptStart >= schedStart && apptEnd <= schedEnd;
        });

        if (!isCovered && volunteerSchedules.length > 0) {
          conflicts.push({
            type: 'volunteer_not_scheduled',
            severity: 'medium',
            title: '志愿者不在排班时段',
            description: `志愿者 ${volunteer?.name || '未知'} 的预约时间不在排班范围内`,
            volunteer: volunteer,
            appointment: appointment,
            schedules: volunteerSchedules,
            suggestion: '请调整预约时间或志愿者排班'
          });
        }
      }
    }

    return conflicts;
  }

  detectToolConflicts(appointments, tools) {
    const conflicts = [];
    const toolsById = new Map(tools.map(t => [t.id, t]));

    const appointmentsByTimeSlot = new Map();

    for (const appointment of appointments) {
      if (!appointment.tool_ids) continue;

      const toolIds = JSON.parse(appointment.tool_ids || '[]');
      const apptStart = this.timeToMinutes(appointment.start_time);
      const apptEnd = this.timeToMinutes(appointment.end_time) || apptStart + 30;

      const timeSlot = `${appointment.start_time}-${this.minutesToTime(apptEnd)}`;

      if (!appointmentsByTimeSlot.has(timeSlot)) {
        appointmentsByTimeSlot.set(timeSlot, []);
      }
      appointmentsByTimeSlot.get(timeSlot).push({
        appointment,
        toolIds,
        start: apptStart,
        end: apptEnd
      });
    }

    for (const tool of tools) {
      const disinfectionRecords = this.db.getToolDisinfectionRecords(tool.id);
      const latest = disinfectionRecords[0];

      if (tool.status === 'unavailable') {
        conflicts.push({
          type: 'tool_unavailable',
          severity: 'high',
          title: '工具不可用',
          description: `工具 ${tool.name} 当前状态为不可用`,
          tool: tool,
          suggestion: '请更换其他工具或检查工具状态'
        });
      }

      if (latest) {
        const disinfectedAt = new Date(latest.disinfected_at);
        const now = new Date();
        const hoursSinceDisinfected = (now - disinfectedAt) / (1000 * 60 * 60);

        if (hoursSinceDisinfected > 24) {
          conflicts.push({
            type: 'tool_disinfection_expired',
            severity: 'medium',
            title: '工具消毒过期',
            description: `工具 ${tool.name} 距上次消毒已超过24小时`,
            tool: tool,
            lastDisinfected: latest.disinfected_at,
            suggestion: '请在使用前重新消毒'
          });
        }
      } else if (disinfectionRecords.length === 0) {
        conflicts.push({
          type: 'tool_no_disinfection_record',
          severity: 'medium',
          title: '工具无消毒记录',
          description: `工具 ${tool.name} 没有消毒记录`,
          tool: tool,
          suggestion: '请在使用前进行消毒并记录'
        });
      }
    }

    return conflicts;
  }

  detectElderSpecialNeeds(appointments, elders) {
    const conflicts = [];
    const eldersById = new Map(elders.map(e => [e.id, e]));

    for (const appointment of appointments) {
      const elder = eldersById.get(appointment.elder_id);
      if (!elder) continue;

      if (elder.needs_home_visit && appointment.room_id) {
        const rooms = this.db.getRooms();
        const room = rooms.find(r => r.id === appointment.room_id);
        
        if (room && !room.name.includes('上门')) {
          conflicts.push({
            type: 'elder_needs_home_visit',
            severity: 'high',
            title: '老人需要上门服务',
            description: `老人 ${elder.name} 需要上门服务，但当前预约在 ${room.name}`,
            elder: elder,
            appointment: appointment,
            room: room,
            suggestion: '请将预约改为上门服务'
          });
        }
      }

      if (elder.avoid_perm_dye) {
        const serviceType = (appointment.service_type || '').toLowerCase();
        if (serviceType.includes('烫') || serviceType.includes('染') || 
            serviceType.includes('烫发') || serviceType.includes('染发')) {
          conflicts.push({
            type: 'elder_avoid_perm_dye',
            severity: 'high',
            title: '老人应避开染烫',
            description: `老人 ${elder.name} 有染烫禁忌症，但预约了染烫服务`,
            elder: elder,
            appointment: appointment,
            suggestion: '请改为普通剪发服务'
          });
        }
      }

      if (elder.allergies && elder.allergies.trim()) {
        conflicts.push({
          type: 'elder_allergy_warning',
          severity: 'low',
          title: '老人有过敏史',
          description: `老人 ${elder.name} 过敏史: ${elder.allergies}`,
          elder: elder,
          appointment: appointment,
          suggestion: '请注意使用合适的产品，提前确认老人情况'
        });
      }

      if (elder.mobility_issues && elder.mobility_issues.trim()) {
        conflicts.push({
          type: 'elder_mobility_issue',
          severity: 'low',
          title: '老人行动不便',
          description: `老人 ${elder.name} 行动不便: ${elder.mobility_issues}`,
          elder: elder,
          appointment: appointment,
          suggestion: '请安排靠近门口的位置，或考虑上门服务'
        });
      }

      if (elder.special_needs && elder.special_needs.trim()) {
        conflicts.push({
          type: 'elder_special_needs',
          severity: 'low',
          title: '老人有特殊需求',
          description: `老人 ${elder.name} 特殊需求: ${elder.special_needs}`,
          elder: elder,
          appointment: appointment,
          suggestion: '请提前了解并准备'
        });
      }
    }

    return conflicts;
  }

  detectRoomCapacityConflicts(appointments, rooms) {
    const conflicts = [];
    const roomsById = new Map(rooms.map(r => [r.id, r]));
    const appointmentsByRoomAndTime = new Map();

    for (const appointment of appointments) {
      if (!appointment.room_id) continue;

      const room = roomsById.get(appointment.room_id);
      if (!room) continue;

      const apptStart = this.timeToMinutes(appointment.start_time);
      const apptEnd = this.timeToMinutes(appointment.end_time) || apptStart + 30;

      const timeSlot = this.getTimeSlot(appointment.start_time);
      const key = `${appointment.room_id}-${timeSlot};

      if (!appointmentsByRoomAndTime.has(key)) {
        appointmentsByRoomAndTime.set(key, []);
      }
      appointmentsByRoomAndTime.get(key).push({
        appointment,
        start: apptStart,
        end: apptEnd
      });
    }

    for (const [key, slotAppointments] of appointmentsByRoomAndTime) {
      const [roomId] = key.split('-');
      const room = roomsById.get(parseInt(roomId));
      const capacity = room?.capacity || 1;

      if (slotAppointments.length > capacity) {
        const timeSlot = this.getTimeSlot(slotAppointments[0].appointment.start_time);
        conflicts.push({
          type: 'room_capacity_exceeded',
          severity: 'high',
          title: '房间容量超限',
          description: `房间 ${room?.name || '未知'} 在 ${timeSlot} 时段有 ${slotAppointments.length} 个预约，超过容量 ${capacity}`,
          room: room,
          appointments: slotAppointments.map(s => s.appointment),
          timeSlot: timeSlot,
          capacity: capacity,
          actual: slotAppointments.length,
          suggestion: '请将部分预约调整到其他时间或房间'
        });
      }
    }

    return conflicts;
  }

  groupBy(items, key) {
    const map = new Map();
    for (const item of items) {
      const value = item[key];
      if (!map.has(value)) {
        map.set(value, []);
      }
      map.get(value).push(item);
    }
    return map;
  }

  timeToMinutes(timeStr) {
    if (!timeStr) return 0;
    const match = timeStr.match(/(\d{1,2}):(\d{2})/);
    if (!match) return 0;
    return parseInt(match[1]) * 60 + parseInt(match[2]);
  }

  minutesToTime(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  }

  getTimeSlot(timeStr) {
    const minutes = this.timeToMinutes(timeStr);
    const slotStart = Math.floor(minutes / 30) * 30;
    return this.minutesToTime(slotStart);
  }

  groupConflicts(conflicts) {
    const groups = {
      high: [],
      medium: [],
      low: []
    };

    for (const conflict of conflicts) {
      const severity = conflict.severity || 'medium';
      if (groups[severity]) {
        groups[severity].push(conflict);
      }
    }

    return groups;
  }
}

module.exports = ConflictDetector;
