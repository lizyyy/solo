const { DateTime } = require('luxon');
const { CronTimezoneAuditor } = require('./core');
const { InputReader } = require('./input');

class AuditOrchestrator {
  constructor(options = {}) {
    this.options = {
      dstWindowDays: options.dstWindowDays || 7,
      auditPeriodMonths: options.auditPeriodMonths || 12,
      ...options
    };
    this.auditor = new CronTimezoneAuditor({ dstWindowDays: this.options.dstWindowDays });
    this.inputReader = new InputReader();
  }

  runAudit(inputPath, options = {}) {
    const inputResult = this.inputReader.readFile(inputPath);
    
    if (!inputResult.success) {
      return {
        success: false,
        error: inputResult.error,
        summary: null,
        results: null
      };
    }

    const { tasks, badLines, totalCount } = inputResult;
    const auditStart = options.startDate || DateTime.now().toISO();
    const auditEnd = options.endDate || DateTime.now().plus({ months: this.options.auditPeriodMonths }).toISO();

    const allTimezones = [...new Set(tasks.map(t => t.timezone))];
    const dstTransitions = this.detectAllDSTTransitions(allTimezones, auditStart, auditEnd);

    const taskResults = tasks.map(task => this.auditTask(task, dstTransitions, auditStart, auditEnd));

    const anomalies = taskResults.filter(r => r.hasAnomalies);
    const parseErrors = taskResults.filter(r => !r.valid);

    const summary = {
      totalTasks: totalCount,
      validTasks: tasks.length,
      invalidTasks: badLines.length,
      tasksWithAnomalies: anomalies.length,
      parseErrors: parseErrors.length,
      timezonesChecked: allTimezones.length,
      dstTransitionsFound: dstTransitions.length,
      auditPeriod: { start: auditStart, end: auditEnd },
      anomalyBreakdown: this.getAnomalyBreakdown(anomalies),
      timezoneStats: this.getTimezoneStats(tasks)
    };

    return {
      success: true,
      generatedAt: DateTime.now().toISO(),
      summary,
      input: {
        source: inputResult.source,
        format: inputResult.format,
        badLines
      },
      dstTransitions,
      results: {
        allTasks: taskResults,
        anomalies,
        parseErrors
      }
    };
  }

  detectAllDSTTransitions(timezones, startDate, endDate) {
    const transitions = [];
    timezones.forEach(tz => {
      const tzTransitions = this.auditor.detectDSTTransitions(tz, startDate, endDate);
      transitions.push(...tzTransitions);
    });
    return transitions.sort((a, b) => new Date(a.utcDatetime) - new Date(b.utcDatetime));
  }

  auditTask(task, transitions, auditStart, auditEnd) {
    const taskTransitions = transitions.filter(t => t.timezone === task.timezone);
    
    if (taskTransitions.length === 0) {
      return {
        ...task,
        valid: true,
        hasAnomalies: false,
        anomalies: [],
        notes: ['该时区无时区切换']
      };
    }

    const allIssues = [];
    const transitionImpacts = [];

    taskTransitions.forEach(transition => {
      const impact = this.auditor.checkDSTImpact(task, transition);
      transitionImpacts.push(impact);
      if (impact.issues && impact.issues.length > 0) {
        allIssues.push(...impact.issues.map(issue => ({
          ...issue,
          transition: transition.type,
          transitionDate: transition.datetime
        })));
      }
    });

    const windowExpansion = this.inputReader.expandRunWindow(
      task,
      auditStart,
      auditEnd
    );

    return {
      ...task,
      valid: true,
      hasAnomalies: allIssues.length > 0,
      anomalies: allIssues,
      transitionImpacts,
      runWindow: windowExpansion.success ? {
        runCount: windowExpansion.runCount,
        sampleRuns: windowExpansion.runs.slice(0, 5),
        truncated: windowExpansion.truncated
      } : null
    };
  }

  getAnomalyBreakdown(anomalies) {
    const breakdown = {
      'hour-shift': 0,
      'missing-run': 0,
      'duplicate-run': 0,
      'other': 0
    };

    anomalies.forEach(task => {
      task.anomalies.forEach(anomaly => {
        if (breakdown.hasOwnProperty(anomaly.type)) {
          breakdown[anomaly.type]++;
        } else {
          breakdown['other']++;
        }
      });
    });

    return breakdown;
  }

  getTimezoneStats(tasks) {
    const stats = {};
    tasks.forEach(task => {
      const tz = task.timezone;
      if (!stats[tz]) {
        stats[tz] = { count: 0, services: new Set() };
      }
      stats[tz].count++;
      if (task.service) {
        stats[tz].services.add(task.service);
      }
    });

    return Object.entries(stats).map(([timezone, data]) => ({
      timezone,
      taskCount: data.count,
      services: [...data.services]
    }));
  }

  runSingleTaskAudit(cronExpression, timezone, options = {}) {
    const auditStart = options.startDate || DateTime.now().toISO();
    const auditEnd = options.endDate || DateTime.now().plus({ months: this.options.auditPeriodMonths }).toISO();

    const transitions = this.auditor.detectDSTTransitions(timezone, auditStart, auditEnd);
    const task = {
      lineNumber: 1,
      taskName: 'Single Task Audit',
      cronExpression,
      timezone
    };

    return this.auditTask(task, transitions, auditStart, auditEnd);
  }

  convertTimezone(cronExpression, fromTZ, toTZ) {
    return this.auditor.convertTimezone(cronExpression, fromTZ, toTZ);
  }
}

module.exports = { AuditOrchestrator };
