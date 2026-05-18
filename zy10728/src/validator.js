export class ScheduleValidator {
  constructor() {
    this.conflicts = [];
    this.processedFiles = [];
  }

  validateAll(parsedResults) {
    const allSchedules = [];
    
    for (const result of parsedResults) {
      this.processedFiles.push(result.file);
      for (const schedule of result.schedules) {
        allSchedules.push({
          ...schedule,
          file: result.file
        });
      }
    }

    this.findDriverConflicts(allSchedules);
    this.findVehicleConflicts(allSchedules);

    return {
      conflicts: this.conflicts,
      totalSchedules: allSchedules.length,
      totalFiles: parsedResults.length
    };
  }

  findDriverConflicts(allSchedules) {
    const driverSchedules = {};
    
    for (const schedule of allSchedules) {
      if (!driverSchedules[schedule.driverName]) {
        driverSchedules[schedule.driverName] = [];
      }
      driverSchedules[schedule.driverName].push(schedule);
    }

    for (const [driverName, schedules] of Object.entries(driverSchedules)) {
      if (schedules.length < 2) continue;

      for (let i = 0; i < schedules.length; i++) {
        for (let j = i + 1; j < schedules.length; j++) {
          const s1 = schedules[i];
          const s2 = schedules[j];
          
          if (this.hasTimeOverlap(s1, s2)) {
            this.addConflict({
              type: 'DRIVER_TIME_CONFLICT',
              severity: s1.isConcurrent || s2.isConcurrent ? 'WARNING' : 'ERROR',
              driverName,
              schedule1: this.formatScheduleInfo(s1),
              schedule2: this.formatScheduleInfo(s2),
              overlap: this.calculateOverlap(s1, s2),
              message: this.generateConflictMessage('司机', driverName, s1, s2)
            });
          }
        }
      }
    }
  }

  findVehicleConflicts(allSchedules) {
    const vehicleSchedules = {};
    
    for (const schedule of allSchedules) {
      if (!schedule.vehicleNo) continue;
      
      if (!vehicleSchedules[schedule.vehicleNo]) {
        vehicleSchedules[schedule.vehicleNo] = [];
      }
      vehicleSchedules[schedule.vehicleNo].push(schedule);
    }

    for (const [vehicleNo, schedules] of Object.entries(vehicleSchedules)) {
      if (schedules.length < 2) continue;

      for (let i = 0; i < schedules.length; i++) {
        for (let j = i + 1; j < schedules.length; j++) {
          const s1 = schedules[i];
          const s2 = schedules[j];
          
          if (this.hasTimeOverlap(s1, s2)) {
            this.addConflict({
              type: 'VEHICLE_TIME_CONFLICT',
              severity: s1.isMaintenance || s2.isMaintenance ? 'WARNING' : 'ERROR',
              vehicleNo,
              schedule1: this.formatScheduleInfo(s1),
              schedule2: this.formatScheduleInfo(s2),
              overlap: this.calculateOverlap(s1, s2),
              message: this.generateConflictMessage('车辆', vehicleNo, s1, s2)
            });
          }
        }
      }
    }
  }

  hasTimeOverlap(s1, s2) {
    return s1.startDateTime < s2.endDateTime && s2.startDateTime < s1.endDateTime;
  }

  calculateOverlap(s1, s2) {
    const overlapStart = new Date(Math.max(s1.startDateTime.getTime(), s2.startDateTime.getTime()));
    const overlapEnd = new Date(Math.min(s1.endDateTime.getTime(), s2.endDateTime.getTime()));
    const durationMinutes = Math.round((overlapEnd - overlapStart) / (1000 * 60));
    
    return {
      start: overlapStart,
      end: overlapEnd,
      durationMinutes
    };
  }

  formatScheduleInfo(schedule) {
    return {
      file: schedule.file,
      row: schedule.rowNum,
      date: schedule.shiftDate,
      startTime: `${String(schedule.startTime.hour).padStart(2, '0')}:${String(schedule.startTime.minute).padStart(2, '0')}`,
      endTime: `${String(schedule.endTime.hour).padStart(2, '0')}:${String(schedule.endTime.minute).padStart(2, '0')}`,
      route: schedule.route || '未指定',
      vehicleNo: schedule.vehicleNo || '未指定',
      isMaintenance: schedule.isMaintenance,
      isConcurrent: schedule.isConcurrent
    };
  }

  generateConflictMessage(entityType, entityName, s1, s2) {
    let message = `${entityType}"${entityName}"存在时间冲突：\n`;
    message += `  - 班次1: ${this.formatDateTime(s1.startDateTime)} - ${this.formatDateTime(s1.endDateTime)}`;
    if (s1.route) message += ` (${s1.route})`;
    message += ` [文件: ${s1.file.split('/').pop()}, 行: ${s1.rowNum}]\n`;
    message += `  - 班次2: ${this.formatDateTime(s2.startDateTime)} - ${this.formatDateTime(s2.endDateTime)}`;
    if (s2.route) message += ` (${s2.route})`;
    message += ` [文件: ${s2.file.split('/').pop()}, 行: ${s2.rowNum}]\n`;
    
    const overlap = this.calculateOverlap(s1, s2);
    message += `  - 重叠时间: ${overlap.durationMinutes} 分钟`;
    
    if (s1.isMaintenance || s2.isMaintenance) {
      message += ` [含车辆保养]`;
    }
    if (s1.isConcurrent || s2.isConcurrent) {
      message += ` [含司机兼岗]`;
    }
    
    return message;
  }

  formatDateTime(date) {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hour = String(date.getHours()).padStart(2, '0');
    const minute = String(date.getMinutes()).padStart(2, '0');
    return `${month}-${day} ${hour}:${minute}`;
  }

  addConflict(conflict) {
    this.conflicts.push(conflict);
  }

  getConflicts() {
    return this.conflicts;
  }

  getConflictsBySeverity(severity) {
    return this.conflicts.filter(c => c.severity === severity);
  }

  getErrorCount() {
    return this.getConflictsBySeverity('ERROR').length;
  }

  getWarningCount() {
    return this.getConflictsBySeverity('WARNING').length;
  }
}
