const moment = require('moment');
const FileManager = require('./fileManager');

class SchedulingEngine {
  constructor() {
    this.tideData = null;
    this.berthData = null;
    this.bargeData = null;
  }

  loadData() {
    this.tideData = FileManager.loadTideData();
    this.berthData = FileManager.loadBerthData();
    this.bargeData = FileManager.loadBargeData();
  }

  canCalculate() {
    return this.tideData && this.berthData && this.bargeData;
  }

  calculateSchedule() {
    if (!this.canCalculate()) {
      return {
        error: '缺少必要数据，请先导入潮汐、泊位和驳船数据',
        missing: {
          tide: !this.tideData,
          berth: !this.berthData,
          barge: !this.bargeData
        }
      };
    }

    const result = {
      generatedAt: new Date().toISOString(),
      barges: [],
      conflicts: [],
      warnings: []
    };

    for (const barge of this.bargeData.barges) {
      const bargeSchedule = this.calculateBargeSchedule(barge);
      result.barges.push(bargeSchedule);
    }

    result.conflicts = this.detectAllConflicts(result.barges);
    result.warnings = this.generateWarnings(result);

    return result;
  }

  calculateBargeSchedule(barge) {
    const timeWindows = this.findAvailableTimeWindows(barge);
    const berthAssignment = this.suggestBerth(barge);

    return {
      id: barge.id || barge.name,
      name: barge.name,
      draft: barge.draft,
      cargoType: barge.cargoType,
      loadingTime: barge.loadingTime || 120,
      preferredTime: barge.preferredTime,
      availableWindows: timeWindows,
      suggestedBerth: berthAssignment,
      assignedBerth: berthAssignment,
      assignedTime: timeWindows.length > 0 ? timeWindows[0] : null,
      notes: barge.notes || ''
    };
  }

  findAvailableTimeWindows(barge) {
    const windows = [];
    const minHeight = this.getMinWaterHeight(barge);
    const maxCurrent = this.getMaxAllowedCurrent(barge);
    const workingHours = this.getWorkingHours();
    
    if (!this.tideData || !this.tideData.records || this.tideData.records.length === 0) {
      return windows;
    }

    const records = this.tideData.records;
    let currentWindow = null;

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const time = moment(record.time);
      const isSafe = this.isTimeSafe(record, minHeight, maxCurrent);
      const isWorkingHour = this.isWithinWorkingHours(time, workingHours);
      const isAvailable = isSafe && isWorkingHour;

      if (isAvailable) {
        if (!currentWindow) {
          currentWindow = {
            startTime: record.time,
            endTime: record.time,
            minHeight: record.height,
            maxCurrent: record.current,
            issues: []
          };
        } else {
          currentWindow.endTime = record.time;
          currentWindow.minHeight = Math.min(currentWindow.minHeight, record.height);
          currentWindow.maxCurrent = Math.max(currentWindow.maxCurrent, record.current);
        }
      } else {
        if (currentWindow) {
          if (this.isWindowDurationValid(currentWindow, barge.loadingTime || 120)) {
            currentWindow.issues = this.analyzeWindowIssues(currentWindow, barge, minHeight, maxCurrent);
            windows.push({ ...currentWindow });
          }
          currentWindow = null;
        }
      }
    }

    if (currentWindow) {
      if (this.isWindowDurationValid(currentWindow, barge.loadingTime || 120)) {
        currentWindow.issues = this.analyzeWindowIssues(currentWindow, barge, minHeight, maxCurrent);
        windows.push(currentWindow);
      }
    }

    return windows.sort((a, b) => {
      const scoreA = this.scoreWindow(a);
      const scoreB = this.scoreWindow(b);
      return scoreB - scoreA;
    });
  }

  isTimeSafe(record, minHeight, maxCurrent) {
    const heightOk = record.height === null || record.height >= minHeight;
    const currentOk = record.current === null || Math.abs(record.current) <= maxCurrent;
    return heightOk && currentOk;
  }

  isWithinWorkingHours(time, workingHours) {
    if (!workingHours || workingHours.length === 0) {
      return true;
    }

    const hour = time.hour();
    const minute = time.minute();
    const timeValue = hour * 60 + minute;

    for (const period of workingHours) {
      if (timeValue >= period.start && timeValue < period.end) {
        return true;
      }
    }

    return false;
  }

  getWorkingHours() {
    const config = this.berthData?.config || {};
    const startHour = config.workStartHour || 8;
    const endHour = config.workEndHour || 18;

    return [{
      start: startHour * 60,
      end: endHour * 60
    }];
  }

  getMinWaterHeight(barge) {
    const draft = barge.draft || 0;
    const clearance = this.berthData?.config?.underKeelClearance || 0.5;
    return draft + clearance;
  }

  getMaxAllowedCurrent(barge) {
    return this.berthData?.config?.maxCurrentSpeed || 2.0;
  }

  isWindowDurationValid(window, requiredMinutes) {
    const start = moment(window.startTime);
    const end = moment(window.endTime);
    const duration = end.diff(start, 'minutes');
    return duration >= requiredMinutes;
  }

  analyzeWindowIssues(window, barge, minHeight, maxCurrent) {
    const issues = [];

    const start = moment(window.startTime);
    const end = moment(window.endTime);
    
    const nightStartHour = this.berthData?.config?.nightStartHour || 18;
    const nightEndHour = this.berthData?.config?.nightEndHour || 6;
    
    const hasNightHours = this.checkNightHours(start, end, nightStartHour, nightEndHour);
    if (hasNightHours) {
      issues.push({
        type: 'night_operation',
        severity: 'warning',
        message: '包含夜间作业时段，可能人手不足'
      });
    }

    if (window.minHeight < minHeight + 0.3) {
      issues.push({
        type: 'low_tide_risk',
        severity: 'warning',
        message: `潮位接近安全临界值: ${window.minHeight.toFixed(2)}m`
      });
    }

    if (window.maxCurrent > maxCurrent * 0.8) {
      issues.push({
        type: 'high_current_risk',
        severity: 'warning',
        message: `流速接近上限: ${window.maxCurrent.toFixed(2)}节`
      });
    }

    return issues;
  }

  checkNightHours(start, end, nightStartHour, nightEndHour) {
    let current = moment(start);
    while (current.isBefore(end)) {
      const hour = current.hour();
      if (hour >= nightStartHour || hour < nightEndHour) {
        return true;
      }
      current.add(30, 'minutes');
    }
    return false;
  }

  scoreWindow(window) {
    let score = 0;
    
    const start = moment(window.startTime);
    const hour = start.hour();
    if (hour >= 9 && hour < 15) {
      score += 10;
    }

    if (window.issues) {
      for (const issue of window.issues) {
        if (issue.severity === 'warning') {
          score -= 5;
        }
      }
    }

    return score;
  }

  suggestBerth(barge) {
    if (!this.berthData || !this.berthData.berths) {
      return null;
    }

    const suitableBerths = this.berthData.berths.filter(berth => {
      const capacityOk = !berth.maxDraft || berth.maxDraft >= barge.draft;
      const lengthOk = !berth.maxLength || !barge.length || berth.maxLength >= barge.length;
      const cargoOk = !berth.allowedCargoTypes || 
        berth.allowedCargoTypes.length === 0 ||
        berth.allowedCargoTypes.includes(barge.cargoType);
      
      return capacityOk && lengthOk && cargoOk;
    });

    if (suitableBerths.length === 0) {
      return null;
    }

    return suitableBerths[0];
  }

  detectAllConflicts(bargeSchedules) {
    const conflicts = [];
    const berthGroups = {};

    for (const barge of bargeSchedules) {
      if (!barge.assignedTime || !barge.assignedBerth) continue;

      const berthId = barge.assignedBerth.id;
      if (!berthGroups[berthId]) {
        berthGroups[berthId] = [];
      }
      berthGroups[berthId].push({
        barge: barge,
        startTime: barge.assignedTime.startTime,
        endTime: barge.assignedTime.endTime
      });
    }

    for (const [berthId, assignments] of Object.entries(berthGroups)) {
      for (let i = 0; i < assignments.length; i++) {
        for (let j = i + 1; j < assignments.length; j++) {
          if (this.timeOverlap(assignments[i], assignments[j])) {
            conflicts.push({
              type: 'berth_conflict',
              severity: 'critical',
              berthId: berthId,
              berthName: assignments[i].barge.assignedBerth.name,
              barges: [
                assignments[i].barge.name,
                assignments[j].barge.name
              ],
              message: `${assignments[i].barge.name} 与 ${assignments[j].barge.name} 在泊位 ${assignments[i].barge.assignedBerth.name} 时间冲突`
            });
          }
        }
      }
    }

    return conflicts;
  }

  timeOverlap(a, b) {
    const aStart = moment(a.startTime);
    const aEnd = moment(a.endTime);
    const bStart = moment(b.startTime);
    const bEnd = moment(b.endTime);

    return aStart.isBefore(bEnd) && bStart.isBefore(aEnd);
  }

  generateWarnings(result) {
    const warnings = [];

    for (const barge of result.barges) {
      if (barge.availableWindows.length === 0) {
        warnings.push({
          type: 'no_window',
          severity: 'critical',
          barge: barge.name,
          message: `${barge.name} 在未来两天内没有找到可安全作业的时间窗`
        });
      } else if (barge.availableWindows.length < 2) {
        warnings.push({
          type: 'limited_windows',
          severity: 'warning',
          barge: barge.name,
          message: `${barge.name} 可选时间窗有限，仅有 ${barge.availableWindows.length} 个`
        });
      }
    }

    const berthOccupancy = this.calculateBerthOccupancy(result);
    for (const [berthId, occupancy] of Object.entries(berthOccupancy)) {
      if (occupancy > 0.8) {
        warnings.push({
          type: 'high_occupancy',
          severity: 'warning',
          berthId: berthId,
          occupancy: occupancy,
          message: `泊位 ${berthId} 利用率超过 80%`
        });
      }
    }

    return warnings;
  }

  calculateBerthOccupancy(result) {
    const occupancy = {};
    
    if (!this.tideData || !this.tideData.records || this.tideData.records.length < 2) {
      return occupancy;
    }

    const totalPeriod = moment(this.tideData.records[this.tideData.records.length - 1].time)
      .diff(moment(this.tideData.records[0].time), 'minutes');

    for (const barge of result.barges) {
      if (!barge.assignedTime || !barge.assignedBerth) continue;

      const berthId = barge.assignedBerth.id;
      if (!occupancy[berthId]) {
        occupancy[berthId] = 0;
      }

      const bargeTime = moment(barge.assignedTime.endTime)
        .diff(moment(barge.assignedTime.startTime), 'minutes');
      occupancy[berthId] += bargeTime / totalPeriod;
    }

    return occupancy;
  }

  validateAdjustedSchedule(adjustedSchedule) {
    const issues = [];

    for (const barge of adjustedSchedule.barges) {
      if (!barge.assignedTime || !barge.assignedBerth) continue;

      const minHeight = this.getMinWaterHeight(barge);
      const maxCurrent = this.getMaxAllowedCurrent(barge);

      const tideCoverage = this.checkTideCoverage(
        barge.assignedTime.startTime,
        barge.assignedTime.endTime,
        minHeight,
        maxCurrent
      );

      if (!tideCoverage.safe) {
        issues.push({
          type: tideCoverage.issueType,
          severity: 'critical',
          barge: barge.name,
          message: tideCoverage.message
        });
      }
    }

    const berthConflicts = this.detectAllConflicts(adjustedSchedule.barges);
    issues.push(...berthConflicts);

    return {
      valid: issues.length === 0,
      issues: issues
    };
  }

  checkTideCoverage(startTime, endTime, minHeight, maxCurrent) {
    if (!this.tideData || !this.tideData.records) {
      return { safe: false, issueType: 'no_data', message: '缺少潮汐数据' };
    }

    const start = moment(startTime);
    const end = moment(endTime);

    for (const record of this.tideData.records) {
      const recordTime = moment(record.time);
      
      if (recordTime.isBetween(start, end, null, '[]')) {
        if (record.height !== null && record.height < minHeight) {
          return {
            safe: false,
            issueType: 'low_tide',
            message: `在 ${recordTime.format('HH:mm')} 潮位 ${record.height.toFixed(2)}m 低于安全水深 ${minHeight.toFixed(2)}m`
          };
        }
        if (record.current !== null && Math.abs(record.current) > maxCurrent) {
          return {
            safe: false,
            issueType: 'high_current',
            message: `在 ${recordTime.format('HH:mm')} 流速 ${record.current.toFixed(2)}节 超过上限 ${maxCurrent.toFixed(2)}节`
          };
        }
      }
    }

    return { safe: true };
  }
}

module.exports = SchedulingEngine;
