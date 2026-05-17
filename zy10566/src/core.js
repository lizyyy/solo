const cronParser = require('cron-parser');
const { DateTime, Settings } = require('luxon');

Settings.defaultZone = 'UTC';

class CronTimezoneAuditor {
  constructor(options = {}) {
    this.dstWindowDays = options.dstWindowDays || 7;
  }

  parseCronExpression(expression, timezone) {
    try {
      const options = {
        tz: timezone,
        currentDate: DateTime.now().setZone(timezone).toJSDate()
      };
      const interval = cronParser.parseExpression(expression, options);
      return {
        valid: true,
        interval,
        expression,
        timezone
      };
    } catch (error) {
      return {
        valid: false,
        error: error.message,
        expression,
        timezone
      };
    }
  }

  getNextRuns(expression, timezone, count = 10) {
    const parsed = this.parseCronExpression(expression, timezone);
    if (!parsed.valid) {
      return { valid: false, error: parsed.error, runs: [] };
    }

    const runs = [];
    let current = parsed.interval.next();
    for (let i = 0; i < count; i++) {
      const dt = DateTime.fromJSDate(current.toDate()).setZone(timezone);
      runs.push({
        utc: dt.toUTC().toISO(),
        local: dt.toISO(),
        timestamp: dt.toMillis(),
        isDST: dt.isInDST
      });
      current = parsed.interval.next();
    }
    return { valid: true, runs };
  }

  detectDSTTransitions(timezone, startDate, endDate) {
    const transitions = [];
    let current = DateTime.fromISO(startDate).setZone(timezone);
    const end = DateTime.fromISO(endDate).setZone(timezone);

    while (current < end) {
      const nextHour = current.plus({ hours: 1 });
      const currentOffset = current.offset;
      const nextOffset = nextHour.offset;

      if (currentOffset !== nextOffset) {
        transitions.push({
          datetime: current.toISO(),
          utcDatetime: current.toUTC().toISO(),
          offsetChange: nextOffset - currentOffset,
          type: nextOffset > currentOffset ? 'spring-forward' : 'fall-back',
          timezone
        });
      }
      current = nextHour;
    }
    return transitions;
  }

  checkDSTImpact(task, transition) {
    const { cronExpression, timezone, taskName, lineNumber } = task;
    const issues = [];

    const transitionDt = DateTime.fromISO(transition.utcDatetime).setZone('UTC');
    const windowStart = transitionDt.minus({ days: this.dstWindowDays });
    const windowEnd = transitionDt.plus({ days: this.dstWindowDays });

    const parsed = this.parseCronExpression(cronExpression, timezone);
    if (!parsed.valid) {
      return {
        taskName,
        lineNumber,
        cronExpression,
        timezone,
        valid: false,
        parseError: parsed.error
      };
    }

    const runsInWindow = [];
    let current = parsed.interval.next();
    let runDt = DateTime.fromJSDate(current.toDate()).toUTC();
    
    while (runDt < windowEnd) {
      if (runDt >= windowStart) {
        const localDt = runDt.setZone(timezone);
        runsInWindow.push({
          utc: runDt.toISO(),
          local: localDt.toISO(),
          localHour: localDt.hour,
          localMinute: localDt.minute,
          isDST: localDt.isInDST
        });
      }
      current = parsed.interval.next();
      runDt = DateTime.fromJSDate(current.toDate()).toUTC();
    }

    if (runsInWindow.length >= 2) {
      const hours = runsInWindow.map(r => r.localHour);
      const uniqueHours = [...new Set(hours)];
      
      if (uniqueHours.length > 1) {
        issues.push({
          type: 'hour-shift',
          severity: 'high',
          message: `夏令时切换导致执行小时变化: ${uniqueHours.join(' → ')}点`,
          details: {
            transitionType: transition.type,
            hours: uniqueHours,
            affectedRuns: runsInWindow
          }
        });
      }

      if (transition.type === 'spring-forward') {
        const missingHour = transitionDt.setZone(timezone).hour;
        const runsAtMissingHour = runsInWindow.filter(r => r.localHour === missingHour);
        if (runsAtMissingHour.length === 0 && this.isHourInCron(cronExpression, missingHour)) {
          issues.push({
            type: 'missing-run',
            severity: 'critical',
            message: `夏令时跳过时任务丢失: ${missingHour}点的执行被跳过`,
            details: { missingHour, transitionType: 'spring-forward' }
          });
        }
      }

      if (transition.type === 'fall-back') {
        const repeatedHour = transitionDt.setZone(timezone).hour;
        const runsAtRepeatedHour = runsInWindow.filter(r => r.localHour === repeatedHour);
        if (runsAtRepeatedHour.length > 1) {
          issues.push({
            type: 'duplicate-run',
            severity: 'high',
            message: `冬令时回拨任务重复执行: ${repeatedHour}点执行${runsAtRepeatedHour.length}次`,
            details: { repeatedHour, runCount: runsAtRepeatedHour.length }
          });
        }
      }
    }

    return {
      taskName,
      lineNumber,
      cronExpression,
      timezone,
      valid: true,
      transition: {
        type: transition.type,
        datetime: transition.datetime,
        utcDatetime: transition.utcDatetime
      },
      runsInWindow: runsInWindow.slice(0, 5),
      issues,
      hasIssues: issues.length > 0
    };
  }

  isHourInCron(expression, hour) {
    const parts = expression.split(' ');
    const hourPart = parts[1];
    
    if (hourPart === '*') return true;
    if (hourPart === String(hour)) return true;
    
    if (hourPart.includes(',')) {
      const hours = hourPart.split(',').map(Number);
      return hours.includes(hour);
    }
    
    if (hourPart.includes('-')) {
      const [start, end] = hourPart.split('-').map(Number);
      return hour >= start && hour <= end;
    }
    
    if (hourPart.includes('/')) {
      const [base, step] = hourPart.split('/');
      if (base === '*') {
        return hour % Number(step) === 0;
      }
      return (hour - Number(base)) % Number(step) === 0;
    }
    
    return false;
  }

  convertTimezone(expression, fromTZ, toTZ) {
    const parsed = this.parseCronExpression(expression, fromTZ);
    if (!parsed.valid) {
      return { valid: false, error: parsed.error };
    }

    const runs = this.getNextRuns(expression, fromTZ, 5);
    if (!runs.valid) {
      return { valid: false, error: runs.error };
    }

    const convertedHours = runs.runs.map(r => {
      const dt = DateTime.fromISO(r.utc).setZone(toTZ);
      return dt.hour;
    });

    const uniqueHours = [...new Set(convertedHours)];
    const newCronParts = expression.split(' ');
    
    if (uniqueHours.length === 1) {
      newCronParts[1] = String(uniqueHours[0]);
    } else {
      newCronParts[1] = uniqueHours.sort((a, b) => a - b).join(',');
    }

    return {
      valid: true,
      original: { expression, timezone: fromTZ },
      converted: {
        expression: newCronParts.join(' '),
        timezone: toTZ
      },
      note: uniqueHours.length > 1 ? '注意：转换后可能导致多小时执行' : null
    };
  }
}

module.exports = { CronTimezoneAuditor };
