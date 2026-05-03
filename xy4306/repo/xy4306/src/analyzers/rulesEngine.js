const dayjs = require('dayjs');
const { CONFIG, ISSUE_TYPES, ISSUE_SEVERITY, ISSUE_DESCRIPTIONS } = require('../config/constants');

class RulesEngine {
  constructor() {
    this.issues = [];
    this.analysisResults = {};
  }

  analyzeBatch(batchData) {
    const { temperatures, doorEvents, notes, vehicle, batch } = batchData;
    
    if (!temperatures || temperatures.length === 0) {
      return {
        vehicle,
        batch,
        issues: [],
        statistics: this.getEmptyStatistics()
      };
    }

    const issues = [];

    const continuousOvertempIssues = this.analyzeContinuousOvertemp(temperatures, doorEvents);
    issues.push(...continuousOvertempIssues);

    const shortFluctuationIssues = this.analyzeShortFluctuations(temperatures, doorEvents);
    issues.push(...shortFluctuationIssues);

    const doorExceededIssues = this.analyzeDoorExceeded(doorEvents);
    issues.push(...doorExceededIssues);

    const sensorGapIssues = this.analyzeSensorGaps(temperatures);
    issues.push(...sensorGapIssues);

    const sensorDriftIssues = this.analyzeSensorDrift(temperatures);
    issues.push(...sensorDriftIssues);

    const noteIssues = this.analyzeNotes(notes, temperatures);
    issues.push(...noteIssues);

    this.crossValidateIssues(issues, doorEvents, notes);

    const statistics = this.calculateStatistics(temperatures, doorEvents, notes, issues);

    const result = {
      vehicle,
      batch,
      issues: this.sortIssues(issues),
      statistics,
      temperatures,
      doorEvents,
      notes
    };

    this.analysisResults[`${vehicle}-${batch}`] = result;

    return result;
  }

  analyzeContinuousOvertemp(temperatures, doorEvents) {
    const issues = [];
    const threshold = CONFIG.TEMPERATURE.THRESHOLD.SAFE_MAX;
    const minDuration = CONFIG.TEMPERATURE.RULES.CONTINUOUS_OVERTEMP_MINUTES;

    let currentOvertempStart = null;
    let currentOvertempRecords = [];

    for (const record of temperatures) {
      if (record.temperature > threshold) {
        if (!currentOvertempStart) {
          currentOvertempStart = record.timestamp;
        }
        currentOvertempRecords.push(record);
      } else {
        if (currentOvertempStart && currentOvertempRecords.length > 0) {
          const durationMinutes = dayjs(record.timestamp).diff(
            dayjs(currentOvertempStart), 
            'minute', 
            true
          );

          if (durationMinutes >= minDuration) {
            const isAffectedByDoor = this.isAffectedByDoorEvents(
              currentOvertempStart, 
              record.timestamp, 
              doorEvents
            );

            const maxTemp = Math.max(...currentOvertempRecords.map(r => r.temperature));
            const avgTemp = currentOvertempRecords.reduce((sum, r) => sum + r.temperature, 0) / 
                           currentOvertempRecords.length;

            let severity = ISSUE_SEVERITY.MEDIUM;
            if (maxTemp > CONFIG.TEMPERATURE.THRESHOLD.DANGER_MAX) {
              severity = ISSUE_SEVERITY.CRITICAL;
            } else if (durationMinutes > 60) {
              severity = ISSUE_SEVERITY.HIGH;
            }

            issues.push({
              id: `OT-${issues.length + 1}`,
              type: ISSUE_TYPES.CONTINUOUS_OVERTEMP,
              severity,
              startTime: currentOvertempStart,
              endTime: record.timestamp,
              startTimeStr: dayjs(currentOvertempStart).format('YYYY-MM-DD HH:mm:ss'),
              endTimeStr: dayjs(record.timestamp).format('YYYY-MM-DD HH:mm:ss'),
              durationMinutes,
              durationFormatted: this.formatDuration(durationMinutes),
              maxTemperature: maxTemp,
              avgTemperature: avgTemp,
              isDoorRelated: isAffectedByDoor,
              affectedRecords: currentOvertempRecords.length,
              description: `连续超温 ${this.formatDuration(durationMinutes)}，最高 ${maxTemp.toFixed(1)}℃，平均 ${avgTemp.toFixed(1)}℃${isAffectedByDoor ? '（可能与开门相关）' : ''}`
            });
          }
        }
        currentOvertempStart = null;
        currentOvertempRecords = [];
      }
    }

    if (currentOvertempStart && currentOvertempRecords.length > 0) {
      const lastRecord = temperatures[temperatures.length - 1];
      const durationMinutes = dayjs(lastRecord.timestamp).diff(
        dayjs(currentOvertempStart), 
        'minute', 
        true
      );

      if (durationMinutes >= minDuration) {
        const maxTemp = Math.max(...currentOvertempRecords.map(r => r.temperature));
        const avgTemp = currentOvertempRecords.reduce((sum, r) => sum + r.temperature, 0) / 
                       currentOvertempRecords.length;

        let severity = ISSUE_SEVERITY.MEDIUM;
        if (maxTemp > CONFIG.TEMPERATURE.THRESHOLD.DANGER_MAX) {
          severity = ISSUE_SEVERITY.CRITICAL;
        }

        issues.push({
          id: `OT-${issues.length + 1}`,
          type: ISSUE_TYPES.CONTINUOUS_OVERTEMP,
          severity,
          startTime: currentOvertempStart,
          endTime: lastRecord.timestamp,
          startTimeStr: dayjs(currentOvertempStart).format('YYYY-MM-DD HH:mm:ss'),
          endTimeStr: dayjs(lastRecord.timestamp).format('YYYY-MM-DD HH:mm:ss') + '（持续中）',
          durationMinutes,
          durationFormatted: this.formatDuration(durationMinutes) + '（持续中）',
          maxTemperature: maxTemp,
          avgTemperature: avgTemp,
          isDoorRelated: false,
          affectedRecords: currentOvertempRecords.length,
          isOngoing: true,
          description: `持续超温中，已达 ${this.formatDuration(durationMinutes)}，最高 ${maxTemp.toFixed(1)}℃`
        });
      }
    }

    return issues;
  }

  analyzeShortFluctuations(temperatures, doorEvents) {
    const issues = [];
    const threshold = CONFIG.TEMPERATURE.THRESHOLD.SAFE_MAX;
    const maxDuration = CONFIG.TEMPERATURE.RULES.SHORT_FLUCTUATION_MINUTES;

    if (doorEvents.length === 0) {
      return issues;
    }

    for (const doorEvent of doorEvents) {
      if (doorEvent.isExceeded) continue;

      const doorCloseTime = doorEvent.closeTime ? dayjs(doorEvent.closeTime) : null;
      if (!doorCloseTime) continue;

      const impactEndTime = doorCloseTime.add(CONFIG.DOOR.IMPACT_DURATION_AFTER_CLOSE_MINUTES, 'minute');

      const relevantTemps = temperatures.filter(t => {
        const tempTime = dayjs(t.timestamp);
        return tempTime.isAfter(doorCloseTime.subtract(5, 'minute')) && 
               tempTime.isBefore(impactEndTime);
      });

      if (relevantTemps.length < 2) continue;

      const overtempRecords = relevantTemps.filter(t => t.temperature > threshold);
      
      if (overtempRecords.length > 0) {
        const firstOvertemp = overtempRecords[0];
        const lastOvertemp = overtempRecords[overtempRecords.length - 1];
        const durationMinutes = dayjs(lastOvertemp.timestamp).diff(
          dayjs(firstOvertemp.timestamp), 
          'minute', 
          true
        );

        if (durationMinutes <= maxDuration && durationMinutes > 0) {
          const maxTemp = Math.max(...overtempRecords.map(r => r.temperature));

          issues.push({
            id: `SF-${issues.length + 1}`,
            type: ISSUE_TYPES.SHORT_FLUCTUATION,
            severity: ISSUE_SEVERITY.LOW,
            startTime: firstOvertemp.timestamp,
            endTime: lastOvertemp.timestamp,
            startTimeStr: dayjs(firstOvertemp.timestamp).format('YYYY-MM-DD HH:mm:ss'),
            endTimeStr: dayjs(lastOvertemp.timestamp).format('YYYY-MM-DD HH:mm:ss'),
            durationMinutes,
            durationFormatted: this.formatDuration(durationMinutes),
            maxTemperature: maxTemp,
            doorEvent: {
              openTime: doorEvent.openTimeStr,
              closeTime: doorEvent.closeTimeStr,
              durationMinutes: doorEvent.durationMinutes
            },
            affectedRecords: overtempRecords.length,
            isDoorRelated: true,
            isExplainable: true,
            description: `短时温度波动（${this.formatDuration(durationMinutes)}，最高 ${maxTemp.toFixed(1)}℃），与开门事件相关，可解释`
          });
        }
      }
    }

    return issues;
  }

  analyzeDoorExceeded(doorEvents) {
    const issues = [];

    for (const event of doorEvents) {
      if (event.isExceeded) {
        let severity = ISSUE_SEVERITY.MEDIUM;
        if (event.durationMinutes > 30) {
          severity = ISSUE_SEVERITY.HIGH;
        }
        if (event.isOpenAtEnd) {
          severity = ISSUE_SEVERITY.CRITICAL;
        }

        issues.push({
          id: `DE-${issues.length + 1}`,
          type: ISSUE_TYPES.DOOR_OPEN_EXCEEDED,
          severity,
          startTime: event.openTime,
          endTime: event.closeTime,
          startTimeStr: event.openTimeStr,
          endTimeStr: event.closeTimeStr,
          durationMinutes: event.durationMinutes,
          durationFormatted: event.durationFormatted,
          acceptableMinutes: CONFIG.DOOR.ACCEPTABLE_OPEN_MINUTES,
          exceededMinutes: event.durationMinutes - CONFIG.DOOR.ACCEPTABLE_OPEN_MINUTES,
          isOpenAtEnd: event.isOpenAtEnd || false,
          description: `开门时间超出合理范围：${event.durationFormatted}（阈值 ${CONFIG.DOOR.ACCEPTABLE_OPEN_MINUTES} 分钟）`
        });
      }
    }

    return issues;
  }

  analyzeSensorGaps(temperatures) {
    const issues = [];
    const gapThreshold = CONFIG.TEMPERATURE.RULES.SENSOR_GAP_MINUTES;

    for (let i = 1; i < temperatures.length; i++) {
      const prev = temperatures[i - 1];
      const current = temperatures[i];
      
      const gapMinutes = dayjs(current.timestamp).diff(
        dayjs(prev.timestamp), 
        'minute', 
        true
      );

      if (gapMinutes > gapThreshold) {
        let severity = ISSUE_SEVERITY.MEDIUM;
        if (gapMinutes > 120) {
          severity = ISSUE_SEVERITY.HIGH;
        }

        issues.push({
          id: `SG-${issues.length + 1}`,
          type: ISSUE_TYPES.SENSOR_GAP,
          severity,
          startTime: prev.timestamp,
          endTime: current.timestamp,
          startTimeStr: dayjs(prev.timestamp).format('YYYY-MM-DD HH:mm:ss'),
          endTimeStr: dayjs(current.timestamp).format('YYYY-MM-DD HH:mm:ss'),
          durationMinutes: gapMinutes,
          durationFormatted: this.formatDuration(gapMinutes),
          gapThreshold,
          beforeTemperature: prev.temperature,
          afterTemperature: current.temperature,
          description: `传感器数据断点：${this.formatDuration(gapMinutes)}（阈值 ${gapThreshold} 分钟）`
        });
      }
    }

    return issues;
  }

  analyzeSensorDrift(temperatures) {
    const issues = [];
    const driftThreshold = CONFIG.TEMPERATURE.RULES.DRIFT_THRESHOLD;
    const windowSize = 5;

    if (temperatures.length < windowSize * 2) {
      return issues;
    }

    for (let i = windowSize; i < temperatures.length - windowSize; i++) {
      const windowBefore = temperatures.slice(i - windowSize, i);
      const windowAfter = temperatures.slice(i, i + windowSize);

      const avgBefore = windowBefore.reduce((sum, r) => sum + r.temperature, 0) / windowBefore.length;
      const avgAfter = windowAfter.reduce((sum, r) => sum + r.temperature, 0) / windowAfter.length;

      const drift = Math.abs(avgAfter - avgBefore);

      if (drift >= driftThreshold) {
        const beforeRange = [
          Math.min(...windowBefore.map(r => r.temperature)),
          Math.max(...windowBefore.map(r => r.temperature))
        ];
        const afterRange = [
          Math.min(...windowAfter.map(r => r.temperature)),
          Math.max(...windowAfter.map(r => r.temperature))
        ];

        let severity = ISSUE_SEVERITY.LOW;
        if (drift >= driftThreshold * 2) {
          severity = ISSUE_SEVERITY.MEDIUM;
        }

        const driftRecord = temperatures[i];
        
        issues.push({
          id: `SD-${issues.length + 1}`,
          type: ISSUE_TYPES.SENSOR_DRIFT,
          severity,
          startTime: windowBefore[0].timestamp,
          endTime: windowAfter[windowAfter.length - 1].timestamp,
          startTimeStr: dayjs(windowBefore[0].timestamp).format('YYYY-MM-DD HH:mm:ss'),
          endTimeStr: dayjs(windowAfter[windowAfter.length - 1].timestamp).format('YYYY-MM-DD HH:mm:ss'),
          driftPoint: driftRecord.timestamp,
          driftPointStr: dayjs(driftRecord.timestamp).format('YYYY-MM-DD HH:mm:ss'),
          driftAmount: drift,
          avgBefore,
          avgAfter,
          beforeRange,
          afterRange,
          description: `疑似传感器漂移：在 ${dayjs(driftRecord.timestamp).format('HH:mm:ss')} 附近，平均温度变化 ${drift.toFixed(2)}℃`
        });
        
        i += windowSize;
      }
    }

    return issues;
  }

  analyzeNotes(notes, temperatures) {
    const issues = [];

    for (const note of notes) {
      if (!note.isAnomalyRelated) continue;

      let severity = ISSUE_SEVERITY.MEDIUM;
      if (note.content.includes('严重') || note.content.includes('重大') || note.content.includes('critical')) {
        severity = ISSUE_SEVERITY.HIGH;
      }

      const relatedTemperatures = [];
      if (note.timestamp && temperatures.length > 0) {
        const noteTime = dayjs(note.timestamp);
        relatedTemperatures.push(...temperatures.filter(t => {
          const tempTime = dayjs(t.timestamp);
          return tempTime.isAfter(noteTime.subtract(30, 'minute')) && 
                 tempTime.isBefore(noteTime.add(30, 'minute'));
        }));
      }

      issues.push({
        id: `NM-${issues.length + 1}`,
        type: ISSUE_TYPES.NOTE_MENTIONED,
        severity,
        startTime: note.timestamp,
        endTime: note.timestamp,
        timeStr: note.time,
        noteContent: note.content,
        category: note.category,
        extractedTemperature: note.extractedTemperature,
        extractedDuration: note.extractedDuration,
        relatedTemperatureCount: relatedTemperatures.length,
        description: `人工备注提及异常：${note.content}`,
        source: 'note'
      });
    }

    return issues;
  }

  crossValidateIssues(issues, doorEvents, notes) {
    for (const issue of issues) {
      if (issue.type === ISSUE_TYPES.CONTINUOUS_OVERTEMP && !issue.isDoorRelated) {
        const isExplainable = this.checkIfExplainableByNote(issue, notes);
        if (isExplainable) {
          issue.isExplainable = true;
          issue.description += '（人工备注可解释）';
        }
      }
    }

    const noteTimeRanges = notes
      .filter(n => n.timestamp && n.isAnomalyRelated)
      .map(n => ({
        start: dayjs(n.timestamp).subtract(30, 'minute'),
        end: dayjs(n.timestamp).add(30, 'minute'),
        note: n
      }));

    for (const issue of issues) {
      if (issue.type === ISSUE_TYPES.NOTE_MENTIONED) continue;

      const issueStart = dayjs(issue.startTime);
      const issueEnd = dayjs(issue.endTime);

      for (const timeRange of noteTimeRanges) {
        if (issueStart.isBefore(timeRange.end) && issueEnd.isAfter(timeRange.start)) {
          issue.relatedNote = {
            content: timeRange.note.content,
            time: timeRange.note.time
          };
          break;
        }
      }
    }
  }

  checkIfExplainableByNote(issue, notes) {
    const issueStart = dayjs(issue.startTime);
    const issueEnd = dayjs(issue.endTime);

    for (const note of notes) {
      if (!note.timestamp || !note.isAnomalyRelated) continue;
      
      const noteTime = dayjs(note.timestamp);
      const noteWindowStart = noteTime.subtract(60, 'minute');
      const noteWindowEnd = noteTime.add(60, 'minute');

      if (issueStart.isBefore(noteWindowEnd) && issueEnd.isAfter(noteWindowStart)) {
        const explainableKeywords = [
          '开门', '装卸货', '装卸', '搬运', '临时', '短暂',
          'door', 'temporary', 'loading', 'unloading'
        ];

        for (const keyword of explainableKeywords) {
          if (note.content.toLowerCase().includes(keyword.toLowerCase())) {
            return true;
          }
        }
      }
    }

    return false;
  }

  isAffectedByDoorEvents(startTime, endTime, doorEvents) {
    const start = dayjs(startTime);
    const end = dayjs(endTime);

    for (const event of doorEvents) {
      const eventStart = dayjs(event.openTime);
      const eventEnd = event.closeTime ? dayjs(event.closeTime) : end;
      const eventImpactEnd = eventEnd.add(CONFIG.DOOR.IMPACT_DURATION_AFTER_CLOSE_MINUTES, 'minute');

      if (start.isBefore(eventImpactEnd) && end.isAfter(eventStart)) {
        return true;
      }
    }

    return false;
  }

  calculateStatistics(temperatures, doorEvents, notes, issues) {
    if (!temperatures || temperatures.length === 0) {
      return this.getEmptyStatistics();
    }

    const temps = temperatures.map(r => r.temperature);
    const times = temperatures.map(r => dayjs(r.timestamp).valueOf());

    const safeMax = CONFIG.TEMPERATURE.THRESHOLD.SAFE_MAX;
    const dangerMax = CONFIG.TEMPERATURE.THRESHOLD.DANGER_MAX;
    const safeMin = CONFIG.TEMPERATURE.THRESHOLD.MIN;

    const safeCount = temps.filter(t => t >= safeMin && t <= safeMax).length;
    const overSafeCount = temps.filter(t => t > safeMax && t <= dangerMax).length;
    const overDangerCount = temps.filter(t => t > dangerMax).length;
    const underSafeCount = temps.filter(t => t < safeMin).length;

    const totalDurationMinutes = times.length > 1 
      ? (Math.max(...times) - Math.min(...times)) / (1000 * 60)
      : 0;

    const criticalIssues = issues.filter(i => i.severity === ISSUE_SEVERITY.CRITICAL);
    const highIssues = issues.filter(i => i.severity === ISSUE_SEVERITY.HIGH);
    const mediumIssues = issues.filter(i => i.severity === ISSUE_SEVERITY.MEDIUM);
    const lowIssues = issues.filter(i => i.severity === ISSUE_SEVERITY.LOW);

    return {
      totalRecords: temperatures.length,
      timeRange: {
        start: dayjs(Math.min(...times)).toISOString(),
        end: dayjs(Math.max(...times)).toISOString(),
        startStr: dayjs(Math.min(...times)).format('YYYY-MM-DD HH:mm:ss'),
        endStr: dayjs(Math.max(...times)).format('YYYY-MM-DD HH:mm:ss'),
        durationMinutes: totalDurationMinutes,
        durationFormatted: this.formatDuration(totalDurationMinutes)
      },
      temperature: {
        min: Math.min(...temps),
        max: Math.max(...temps),
        avg: temps.reduce((sum, t) => sum + t, 0) / temps.length,
        median: this.calculateMedian(temps),
        stdDev: this.calculateStdDev(temps)
      },
      distribution: {
        safe: { count: safeCount, percentage: (safeCount / temps.length) * 100 },
        overSafe: { count: overSafeCount, percentage: (overSafeCount / temps.length) * 100 },
        overDanger: { count: overDangerCount, percentage: (overDangerCount / temps.length) * 100 },
        underSafe: { count: underSafeCount, percentage: (underSafeCount / temps.length) * 100 }
      },
      doorEvents: {
        total: doorEvents.length,
        exceeded: doorEvents.filter(e => e.isExceeded).length
      },
      notes: {
        total: notes.length,
        anomalyRelated: notes.filter(n => n.isAnomalyRelated).length
      },
      issues: {
        total: issues.length,
        critical: criticalIssues.length,
        high: highIssues.length,
        medium: mediumIssues.length,
        low: lowIssues.length
      }
    };
  }

  calculateMedian(values) {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 
      ? sorted[mid] 
      : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  calculateStdDev(values) {
    const n = values.length;
    const mean = values.reduce((sum, v) => sum + v, 0) / n;
    const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
    const avgSquaredDiff = squaredDiffs.reduce((sum, d) => sum + d, 0) / n;
    return Math.sqrt(avgSquaredDiff);
  }

  getEmptyStatistics() {
    return {
      totalRecords: 0,
      timeRange: null,
      temperature: {
        min: null,
        max: null,
        avg: null,
        median: null,
        stdDev: null
      },
      distribution: {
        safe: { count: 0, percentage: 0 },
        overSafe: { count: 0, percentage: 0 },
        overDanger: { count: 0, percentage: 0 },
        underSafe: { count: 0, percentage: 0 }
      },
      doorEvents: { total: 0, exceeded: 0 },
      notes: { total: 0, anomalyRelated: 0 },
      issues: { total: 0, critical: 0, high: 0, medium: 0, low: 0 }
    };
  }

  sortIssues(issues) {
    const severityOrder = {
      [ISSUE_SEVERITY.CRITICAL]: 0,
      [ISSUE_SEVERITY.HIGH]: 1,
      [ISSUE_SEVERITY.MEDIUM]: 2,
      [ISSUE_SEVERITY.LOW]: 3
    };

    return issues.sort((a, b) => {
      const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
      if (severityDiff !== 0) return severityDiff;
      
      return dayjs(a.startTime).valueOf() - dayjs(b.startTime).valueOf();
    });
  }

  formatDuration(minutes) {
    if (minutes < 1) {
      return `${Math.round(minutes * 60)}秒`;
    }
    if (minutes < 60) {
      return `${Math.round(minutes)}分钟`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return mins > 0 ? `${hours}小时${mins}分钟` : `${hours}小时`;
  }

  getAllResults() {
    return this.analysisResults;
  }

  getConsolidatedReport() {
    const allIssues = [];
    const allStatistics = [];

    for (const [key, result] of Object.entries(this.analysisResults)) {
      allIssues.push(...result.issues.map(issue => ({
        ...issue,
        vehicle: result.vehicle,
        batch: result.batch
      })));
      allStatistics.push({
        vehicle: result.vehicle,
        batch: result.batch,
        ...result.statistics
      });
    }

    const totalIssues = allIssues.length;
    const criticalIssues = allIssues.filter(i => i.severity === ISSUE_SEVERITY.CRITICAL).length;
    const highIssues = allIssues.filter(i => i.severity === ISSUE_SEVERITY.HIGH).length;

    let overallStatus = 'normal';
    if (criticalIssues > 0) {
      overallStatus = 'critical';
    } else if (highIssues > 0) {
      overallStatus = 'warning';
    } else if (totalIssues > 0) {
      overallStatus = 'attention';
    }

    return {
      overallStatus,
      totalBatches: Object.keys(this.analysisResults).length,
      totalIssues,
      issueBreakdown: {
        critical: criticalIssues,
        high: highIssues,
        medium: allIssues.filter(i => i.severity === ISSUE_SEVERITY.MEDIUM).length,
        low: allIssues.filter(i => i.severity === ISSUE_SEVERITY.LOW).length
      },
      allIssues: this.sortIssues(allIssues),
      allStatistics,
      generatedAt: new Date().toISOString(),
      generatedAtStr: dayjs().format('YYYY-MM-DD HH:mm:ss')
    };
  }
}

module.exports = RulesEngine;
