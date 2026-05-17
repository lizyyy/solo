const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');

class InputReader {
  constructor(options = {}) {
    this.delimiter = options.delimiter || ',';
    this.encoding = options.encoding || 'utf-8';
  }

  readFile(filePath) {
    const absolutePath = path.resolve(filePath);
    if (!fs.existsSync(absolutePath)) {
      return {
        success: false,
        error: `文件不存在: ${absolutePath}`,
        tasks: [],
        badLines: []
      };
    }

    const content = fs.readFileSync(absolutePath, this.encoding);
    const ext = path.extname(filePath).toLowerCase();

    if (ext === '.json') {
      return this.parseJson(content, absolutePath);
    } else if (ext === '.csv') {
      return this.parseCsv(content, absolutePath);
    }

    return {
      success: false,
      error: `不支持的文件格式: ${ext}`,
      tasks: [],
      badLines: []
    };
  }

  parseJson(content, filePath) {
    try {
      const data = JSON.parse(content);
      const tasks = [];
      const badLines = [];

      if (Array.isArray(data)) {
        data.forEach((item, index) => {
          const result = this.validateTask(item, index + 1);
          if (result.valid) {
            tasks.push(result.task);
          } else {
            badLines.push({
              lineNumber: index + 1,
              raw: JSON.stringify(item),
              reason: result.reason
            });
          }
        });
      }

      return {
        success: true,
        source: filePath,
        format: 'json',
        tasks,
        badLines,
        totalCount: tasks.length + badLines.length
      };
    } catch (error) {
      return {
        success: false,
        error: `JSON解析错误: ${error.message}`,
        tasks: [],
        badLines: []
      };
    }
  }

  parseCsv(content, filePath) {
    try {
      const records = parse(content, {
        delimiter: this.delimiter,
        columns: true,
        skip_empty_lines: true,
        relax_column_count: true
      });

      const tasks = [];
      const badLines = [];

      records.forEach((record, index) => {
        const lineNumber = index + 2;
        const result = this.validateTask(record, lineNumber);
        if (result.valid) {
          tasks.push(result.task);
        } else {
          badLines.push({
            lineNumber,
            raw: Object.values(record).join(this.delimiter),
            reason: result.reason
          });
        }
      });

      return {
        success: true,
        source: filePath,
        format: 'csv',
        tasks,
        badLines,
        totalCount: tasks.length + badLines.length
      };
    } catch (error) {
      return {
        success: false,
        error: `CSV解析错误: ${error.message}`,
        tasks: [],
        badLines: []
      };
    }
  }

  validateTask(data, lineNumber) {
    const taskName = data.taskName || data.task_name || data.name || '';
    const cronExpression = data.cronExpression || data.cron_expression || data.cron || '';
    const timezone = data.timezone || data.tz || '';
    const description = data.description || data.desc || '';
    const owner = data.owner || data.team || '';
    const service = data.service || data.module || '';

    const errors = [];

    if (!taskName.trim()) {
      errors.push('缺少任务名称');
    }

    if (!cronExpression.trim()) {
      errors.push('缺少Cron表达式');
    } else {
      const parts = cronExpression.trim().split(/\s+/);
      if (parts.length < 5 || parts.length > 6) {
        errors.push(`Cron表达式格式错误: 需要5-6个字段，当前${parts.length}个`);
      }
    }

    if (!timezone.trim()) {
      errors.push('缺少时区信息');
    }

    if (errors.length > 0) {
      return {
        valid: false,
        reason: errors.join('; ')
      };
    }

    return {
      valid: true,
      task: {
        lineNumber,
        taskName: taskName.trim(),
        cronExpression: cronExpression.trim(),
        timezone: timezone.trim(),
        description: description.trim(),
        owner: owner.trim(),
        service: service.trim()
      }
    };
  }

  expandRunWindow(task, startDate, endDate) {
    const { cronExpression, timezone } = task;
    const runs = [];
    
    try {
      const { CronTimezoneAuditor } = require('./core');
      const auditor = new CronTimezoneAuditor();
      const parsed = auditor.parseCronExpression(cronExpression, timezone);
      
      if (!parsed.valid) {
        return {
          task,
          success: false,
          error: parsed.error,
          runs: []
        };
      }

      const start = new Date(startDate);
      const end = new Date(endDate);
      let current = parsed.interval.next();
      let runDate = current.toDate();

      while (runDate <= end) {
        if (runDate >= start) {
          runs.push({
            utc: runDate.toISOString(),
            local: new Date(runDate).toLocaleString('en-US', { timeZone: timezone })
          });
        }
        current = parsed.interval.next();
        runDate = current.toDate();
      }

      return {
        task,
        success: true,
        runCount: runs.length,
        runs: runs.slice(0, 100),
        truncated: runs.length > 100
      };
    } catch (error) {
      return {
        task,
        success: false,
        error: error.message,
        runs: []
      };
    }
  }
}

module.exports = { InputReader };
