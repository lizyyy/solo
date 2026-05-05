const XLSX = require('xlsx');
const Papa = require('papaparse');
const fs = require('fs');
const path = require('path');

class DataImporter {
  constructor(db) {
    this.db = db;
  }

  async importFiles(filePaths, options = {}) {
    const results = {
      total: 0,
      successful: 0,
      failed: 0,
      errors: [],
      imported: {
        elders: [],
        volunteers: [],
        appointments: [],
        tools: [],
        schedules: []
      }
    };

    for (const filePath of filePaths) {
      try {
        const ext = path.extname(filePath).toLowerCase();
        let data;

        if (ext === '.xlsx' || ext === '.xls') {
          data = this.parseExcel(filePath);
        } else if (ext === '.csv') {
          data = this.parseCSV(filePath);
        } else {
          throw new Error(`不支持的文件格式: ${ext}`);
        }

        const importResult = this.autoDetectAndImport(data, options);
        results.successful++;
        results.total++;

        for (const [type, items] of Object.entries(importResult)) {
          results.imported[type] = [...results.imported[type], ...items];
        }
      } catch (error) {
        results.failed++;
        results.total++;
        results.errors.push({
          file: filePath,
          message: error.message
        });
      }
    }

    return results;
  }

  parseExcel(filePath) {
    const workbook = XLSX.readFile(filePath);
    const allData = {};

    for (const sheetName of workbook.SheetNames) {
      const worksheet = workbook.Sheets[sheetName];
      allData[sheetName] = XLSX.utils.sheet_to_json(worksheet, { header: 'A' });
    }

    return allData;
  }

  parseCSV(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const result = Papa.parse(content, {
      header: true,
      skipEmptyLines: true,
      encoding: 'utf8'
    });

    if (result.errors.length > 0) {
      throw new Error(`CSV解析错误: ${result.errors.map(e => e.message).join(', ')}`);
    }

    return { Sheet1: result.data };
  }

  autoDetectAndImport(data, options) {
    const results = {
      elders: [],
      volunteers: [],
      appointments: [],
      tools: [],
      schedules: []
    };

    const eventId = options.eventId || this.getCurrentEventId();

    for (const [sheetName, rows] of Object.entries(data)) {
      if (!rows || rows.length === 0) continue;

      const detectedType = this.detectDataType(rows);
      
      switch (detectedType) {
        case 'elders':
          results.elders = this.importElders(rows);
          break;
        case 'volunteers':
          results.volunteers = this.importVolunteers(rows);
          break;
        case 'appointments':
          results.appointments = this.importAppointments(rows, eventId);
          break;
        case 'tools':
          results.tools = this.importTools(rows);
          break;
        case 'schedules':
          results.schedules = this.importSchedules(rows, eventId);
          break;
        default:
          const fallbackResult = this.tryFallbackImport(rows, eventId);
          for (const [type, items] of Object.entries(fallbackResult)) {
            results[type] = [...results[type], ...items];
          }
      }
    }

    return results;
  }

  detectDataType(rows) {
    const headerRow = rows[0];
    const headers = Object.keys(headerRow).map(k => headerRow[k]?.toString().toLowerCase() || '');

    const elderKeywords = ['姓名', '房间', '床号', '过敏', '行动不便', '上门', '染烫'];
    const volunteerKeywords = ['志愿者', '电话', '技能', '排班', '时段'];
    const appointmentKeywords = ['预约', '时段', '服务类型', '老人'];
    const toolKeywords = ['工具', '消毒', '有效期', '下次消毒'];
    const scheduleKeywords = ['排班', '志愿者', '开始时间', '结束时间'];

    const hasKeywords = (keywords) => 
      keywords.some(kw => headers.some(h => h.includes(kw)));

    if (hasKeywords(elderKeywords)) return 'elders';
    if (hasKeywords(volunteerKeywords)) return 'volunteers';
    if (hasKeywords(appointmentKeywords)) return 'appointments';
    if (hasKeywords(toolKeywords)) return 'tools';
    if (hasKeywords(scheduleKeywords)) return 'schedules';

    return 'unknown';
  }

  tryFallbackImport(rows, eventId) {
    const results = {
      elders: [],
      volunteers: [],
      appointments: [],
      tools: [],
      schedules: []
    };

    const firstRow = rows[0];
    const keys = Object.keys(firstRow);

    if (keys.length >= 2) {
      if (this.looksLikeElderData(firstRow)) {
        results.elders = this.importElders(rows);
      } else if (this.looksLikeVolunteerData(firstRow)) {
        results.volunteers = this.importVolunteers(rows);
      } else if (this.looksLikeAppointmentData(firstRow)) {
        results.appointments = this.importAppointments(rows, eventId);
      }
    }

    return results;
  }

  looksLikeElderData(row) {
    const values = Object.values(row).map(v => v?.toString() || '');
    return values.some(v => v.includes('过敏') || v.includes('行动不便') || v.includes('房间'));
  }

  looksLikeVolunteerData(row) {
    const values = Object.values(row).map(v => v?.toString() || '');
    return values.some(v => v.includes('志愿者') || v.includes('技能') || v.match(/1[3-9]\d{9}/));
  }

  looksLikeAppointmentData(row) {
    const values = Object.values(row).map(v => v?.toString() || '');
    return values.some(v => v.match(/\d{1,2}:\d{2}/) || v.includes('预约') || v.includes('理发'));
  }

  getCurrentEventId() {
    const event = this.db.getCurrentEvent();
    return event ? event.id : null;
  }

  importElders(rows) {
    const imported = [];
    const existingElders = this.db.getElders();
    const nameMap = new Map(existingElders.map(e => [e.name, e]));

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const values = Object.values(row);
      
      if (values.every(v => !v || v.toString().trim() === '')) continue;

      const elder = this.parseElderRow(row);
      
      if (!elder.name || elder.name.trim() === '') continue;

      if (nameMap.has(elder.name)) {
        const existing = nameMap.get(elder.name);
        this.db.updateElder({ ...existing, ...elder, id: existing.id });
        imported.push({ ...existing, ...elder, updated: true });
      } else {
        const id = this.db.insertElder(elder);
        imported.push({ ...elder, id, created: true });
      }
    }

    return imported;
  }

  parseElderRow(row) {
    const keys = Object.keys(row);
    const elder = {
      name: '',
      room_number: '',
      bed_number: '',
      allergies: '',
      mobility_issues: '',
      special_needs: '',
      avoid_perm_dye: false,
      needs_home_visit: false,
      notes: ''
    };

    for (const key of keys) {
      const value = row[key]?.toString() || '';
      const lowerKey = key?.toString().toLowerCase() || '';
      const lowerValue = value.toLowerCase();

      if (lowerKey.includes('姓名') || lowerValue.includes('姓名')) {
        elder.name = value.replace(/姓名[：:]\s*/, '').trim();
      } else if (lowerKey.includes('房间') || lowerValue.includes('房间')) {
        elder.room_number = value.replace(/房间[号：:\s]*/, '').trim();
      } else if (lowerKey.includes('床号') || lowerValue.includes('床号')) {
        elder.bed_number = value.replace(/床号[：:\s]*/, '').trim();
      } else if (lowerKey.includes('过敏') || lowerValue.includes('过敏')) {
        elder.allergies = value;
      } else if (lowerKey.includes('行动不便') || lowerValue.includes('行动不便')) {
        elder.mobility_issues = value;
      } else if (lowerKey.includes('上门') || lowerValue.includes('上门')) {
        elder.needs_home_visit = true;
      } else if (lowerKey.includes('染烫') || lowerKey.includes('烫染') || 
                 lowerValue.includes('染烫') || lowerValue.includes('烫染')) {
        elder.avoid_perm_dye = true;
      } else if (lowerKey.includes('特殊') || lowerValue.includes('特殊')) {
        elder.special_needs = value;
      } else if (lowerKey.includes('备注') || lowerValue.includes('备注')) {
        elder.notes = value;
      } else if (!elder.name && value && !lowerValue.includes(':')) {
        if (/^[\u4e00-\u9fa5]{2,4}$/.test(value)) {
          elder.name = value;
        }
      }
    }

    return elder;
  }

  importVolunteers(rows) {
    const imported = [];
    const existingVolunteers = this.db.getVolunteers();
    const nameMap = new Map(existingVolunteers.map(v => [v.name, v]));

    for (const row of rows) {
      const volunteer = this.parseVolunteerRow(row);
      
      if (!volunteer.name || volunteer.name.trim() === '') continue;

      if (nameMap.has(volunteer.name)) {
        const existing = nameMap.get(volunteer.name);
        imported.push({ ...existing, ...volunteer, updated: true });
      } else {
        const id = this.db.insertVolunteer(volunteer);
        imported.push({ ...volunteer, id, created: true });
      }
    }

    return imported;
  }

  parseVolunteerRow(row) {
    const volunteer = {
      name: '',
      phone: '',
      skills: '',
      notes: ''
    };

    for (const [key, value] of Object.entries(row)) {
      const strValue = value?.toString() || '';
      const lowerKey = key?.toString().toLowerCase() || '';

      if (lowerKey.includes('姓名') || lowerKey.includes('志愿者')) {
        volunteer.name = strValue.replace(/(姓名|志愿者)[：:]\s*/, '').trim();
      } else if (lowerKey.includes('电话') || lowerKey.includes('手机') || 
                 strValue.match(/1[3-9]\d{9}/)) {
        const phoneMatch = strValue.match(/1[3-9]\d{9}/);
        volunteer.phone = phoneMatch ? phoneMatch[0] : strValue;
      } else if (lowerKey.includes('技能') || lowerKey.includes('擅长')) {
        volunteer.skills = strValue;
      } else if (lowerKey.includes('备注')) {
        volunteer.notes = strValue;
      } else if (!volunteer.name && /^[\u4e00-\u9fa5]{2,4}$/.test(strValue)) {
        volunteer.name = strValue;
      }
    }

    return volunteer;
  }

  importAppointments(rows, eventId) {
    if (!eventId) return [];

    const imported = [];
    const elders = this.db.getElders();
    const elderMap = new Map(elders.map(e => [e.name, e]));
    const volunteers = this.db.getVolunteers();
    const volunteerMap = new Map(volunteers.map(v => [v.name, v]));
    const rooms = this.db.getRooms();

    for (const row of rows) {
      const appointment = this.parseAppointmentRow(row, elderMap, volunteerMap, rooms);
      
      if (!appointment.elder_id) continue;

      appointment.event_id = eventId;
      const id = this.db.insertAppointment(appointment);
      imported.push({ ...appointment, id });
    }

    return imported;
  }

  parseAppointmentRow(row, elderMap, volunteerMap, rooms) {
    const appointment = {
      elder_id: null,
      room_id: null,
      start_time: '',
      end_time: '',
      service_type: '',
      volunteer_id: null,
      tool_ids: null,
      status: 'scheduled',
      notes: ''
    };

    for (const [key, value] of Object.entries(row)) {
      const strValue = value?.toString() || '';
      const lowerKey = key?.toString().toLowerCase() || '';

      if (lowerKey.includes('姓名') || lowerKey.includes('老人')) {
        const name = strValue.replace(/(姓名|老人)[：:]\s*/, '').trim();
        if (elderMap.has(name)) {
          appointment.elder_id = elderMap.get(name).id;
        }
      } else if (lowerKey.includes('时间') || lowerKey.includes('时段') || 
                 strValue.match(/\d{1,2}:\d{2}/)) {
        const timeMatch = strValue.match(/(\d{1,2}:\d{2})/);
        if (timeMatch) {
          appointment.start_time = timeMatch[1];
        }
      } else if (lowerKey.includes('房间') || lowerKey.includes('理发室')) {
        const roomName = strValue.replace(/(房间|理发室)[：:]\s*/, '').trim();
        const room = rooms.find(r => r.name.includes(roomName) || roomName.includes(r.name));
        if (room) appointment.room_id = room.id;
      } else if (lowerKey.includes('服务') || lowerKey.includes('类型')) {
        appointment.service_type = strValue;
      } else if (lowerKey.includes('志愿者') || lowerKey.includes('理发师')) {
        const name = strValue.replace(/(志愿者|理发师)[：:]\s*/, '').trim();
        if (volunteerMap.has(name)) {
          appointment.volunteer_id = volunteerMap.get(name).id;
        }
      } else if (lowerKey.includes('备注')) {
        appointment.notes = strValue;
      }
    }

    return appointment;
  }

  importTools(rows) {
    const imported = [];
    const existingTools = this.db.getTools();
    const nameMap = new Map(existingTools.map(t => [t.name, t]));

    for (const row of rows) {
      const tool = this.parseToolRow(row);
      
      if (!tool.name || tool.name.trim() === '') continue;

      const id = this.db.insertTool(tool);
      imported.push({ ...tool, id });
    }

    return imported;
  }

  parseToolRow(row) {
    const tool = {
      name: '',
      type: '',
      serial_number: '',
      status: 'available',
      notes: ''
    };

    for (const [key, value] of Object.entries(row)) {
      const strValue = value?.toString() || '';
      const lowerKey = key?.toString().toLowerCase() || '';

      if (lowerKey.includes('名称') || lowerKey.includes('工具名')) {
        tool.name = strValue;
      } else if (lowerKey.includes('类型')) {
        tool.type = strValue;
      } else if (lowerKey.includes('编号') || lowerKey.includes('序列号')) {
        tool.serial_number = strValue;
      } else if (lowerKey.includes('状态')) {
        tool.status = strValue.includes('不可用') ? 'unavailable' : 'available';
      } else if (lowerKey.includes('备注')) {
        tool.notes = strValue;
      } else if (!tool.name && strValue) {
        tool.name = strValue;
      }
    }

    return tool;
  }

  importSchedules(rows, eventId) {
    if (!eventId) return [];

    const imported = [];
    const volunteers = this.db.getVolunteers();
    const volunteerMap = new Map(volunteers.map(v => [v.name, v]));

    for (const row of rows) {
      const schedule = this.parseScheduleRow(row, volunteerMap);
      
      if (!schedule.volunteer_id) continue;

      schedule.event_id = eventId;
      const id = this.db.insertVolunteerSchedule(schedule);
      imported.push({ ...schedule, id });
    }

    return imported;
  }

  parseScheduleRow(row, volunteerMap) {
    const schedule = {
      volunteer_id: null,
      start_time: '',
      end_time: '',
      role: '',
      notes: ''
    };

    for (const [key, value] of Object.entries(row)) {
      const strValue = value?.toString() || '';
      const lowerKey = key?.toString().toLowerCase() || '';

      if (lowerKey.includes('姓名') || lowerKey.includes('志愿者')) {
        const name = strValue.replace(/(姓名|志愿者)[：:]\s*/, '').trim();
        if (volunteerMap.has(name)) {
          schedule.volunteer_id = volunteerMap.get(name).id;
        }
      } else if (lowerKey.includes('开始') || lowerKey.includes('起始')) {
        const timeMatch = strValue.match(/(\d{1,2}:\d{2})/);
        if (timeMatch) schedule.start_time = timeMatch[1];
      } else if (lowerKey.includes('结束')) {
        const timeMatch = strValue.match(/(\d{1,2}:\d{2})/);
        if (timeMatch) schedule.end_time = timeMatch[1];
      } else if (lowerKey.includes('角色') || lowerKey.includes('职责')) {
        schedule.role = strValue;
      } else if (lowerKey.includes('备注')) {
        schedule.notes = strValue;
      }
    }

    return schedule;
  }
}

module.exports = DataImporter;
