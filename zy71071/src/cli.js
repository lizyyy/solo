#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { Command } = require('commander');

const { EXIT_CODES, OUTPUT_FORMATS } = require('./constants');
const { normalizeTimezone, DateTime } = require('./time-utils');
const { 
  parseICSFile, 
  expandRecurringEvents, 
  filterEventsByTimeRange,
  filterEventsByRoom,
  filterEventsByOrganizer,
  groupEventsByRoom
} = require('./ics-parser');
const { 
  detectConflictsByRoom, 
  getConflictSummary 
} = require('./conflict-detector');
const { 
  processCancellations, 
  getCancellationStats,
  removeCancelledEvents 
} = require('./cancellation-handler');
const { 
  generateReports, 
  printTerminalSummary,
  ensureOutputDir 
} = require('./report-generator');

const program = new Command();

function validateInput(options) {
  const errors = [];
  const warnings = [];
  
  if (!fs.existsSync(options.input)) {
    errors.push(`ICS文件不存在: ${options.input}`);
  }
  
  if (options.startDate) {
    const startDt = DateTime.fromISO(options.startDate);
    if (!startDt.isValid) {
      errors.push(`开始日期格式无效: ${options.startDate}，请使用 ISO 格式 (YYYY-MM-DD)`);
    }
  }
  
  if (options.endDate) {
    const endDt = DateTime.fromISO(options.endDate);
    if (!endDt.isValid) {
      errors.push(`结束日期格式无效: ${options.endDate}，请使用 ISO 格式 (YYYY-MM-DD)`);
    }
  }
  
  if (options.startDate && options.endDate) {
    const startDt = DateTime.fromISO(options.startDate);
    const endDt = DateTime.fromISO(options.endDate);
    if (startDt > endDt) {
      errors.push(`开始日期不能晚于结束日期`);
    }
  }
  
  if (options.minOverlap && (isNaN(options.minOverlap) || options.minOverlap < 0)) {
    errors.push(`最小重叠时间必须是非负整数: ${options.minOverlap}`);
  }
  
  if (options.timezone) {
    const normalized = normalizeTimezone(options.timezone);
    if (normalized === 'UTC' && options.timezone !== 'UTC') {
      warnings.push(`无法识别时区 "${options.timezone}"，已自动使用 UTC`);
    }
  }
  
  const validFormats = [OUTPUT_FORMATS.JSON, OUTPUT_FORMATS.MARKDOWN, OUTPUT_FORMATS.ALL];
  if (!validFormats.includes(options.format)) {
    errors.push(`无效的输出格式: ${options.format}，有效值为: ${validFormats.join(', ')}`);
  }
  
  return { isValid: errors.length === 0, errors, warnings };
}

function calculateExitCode(results, options) {
  const summary = results.summary || {};
  
  if (options.strict && summary.totalConflicts > 0) {
    return EXIT_CODES.CONFLICTS_FOUND;
  }
  
  if (options.strictCancellations && summary.cancelNotEffective > 0) {
    return EXIT_CODES.CANCELLED_EVENTS;
  }
  
  const hasHighSeverity = summary.bySeverity && summary.bySeverity.high > 0;
  if (hasHighSeverity) {
    return EXIT_CODES.CONFLICTS_FOUND;
  }
  
  return EXIT_CODES.SUCCESS;
}

function runConflictCheck(options) {
  const validation = validateInput(options);
  
  if (!validation.isValid) {
    console.error('输入验证失败:');
    for (const error of validation.errors) {
      console.error(`  ❌ ${error}`);
    }
    process.exit(EXIT_CODES.INVALID_INPUT);
  }
  
  if (validation.warnings.length > 0) {
    console.warn('警告:');
    for (const warning of validation.warnings) {
      console.warn(`  ⚠️  ${warning}`);
    }
    console.warn('');
  }
  
  ensureOutputDir(options.outputDir);
  
  try {
    const icsData = parseICSFile(options.input);
    let events = icsData.events;
    
    const cancellationResults = processCancellations(events, {
      timezone: options.timezone,
      cancellationThresholdMinutes: options.cancelThreshold,
      checkRecurrenceExceptions: options.checkRecurrenceExceptions
    });
    
    if (!options.includeCancelled) {
      events = removeCancelledEvents(events);
    }
    
    if (options.expandRecurrence) {
      let rangeStart = options.startDate 
        ? DateTime.fromISO(options.startDate) 
        : DateTime.utc().minus({ months: 1 });
      let rangeEnd = options.endDate 
        ? DateTime.fromISO(options.endDate) 
        : DateTime.utc().plus({ months: 3 });
      
      const expandedEvents = [];
      for (const event of events) {
        const expanded = expandRecurringEvents(event, rangeStart, rangeEnd);
        expandedEvents.push(...expanded);
      }
      events = expandedEvents;
    }
    
    if (options.startDate || options.endDate) {
      let rangeStart = options.startDate 
        ? DateTime.fromISO(options.startDate).startOf('day') 
        : DateTime.utc().minus({ years: 10 });
      let rangeEnd = options.endDate 
        ? DateTime.fromISO(options.endDate).endOf('day') 
        : DateTime.utc().plus({ years: 10 });
      
      events = filterEventsByTimeRange(events, rangeStart, rangeEnd, options.timezone);
    }
    
    if (options.room) {
      events = filterEventsByRoom(events, options.room);
    }
    
    if (options.organizer) {
      events = filterEventsByOrganizer(events, options.organizer);
    }
    
    const eventsByRoom = groupEventsByRoom(events);
    
    const conflictOptions = {
      timezone: options.timezone,
      minOverlapMinutes: options.minOverlap,
      includeBackToBack: options.includeBackToBack,
      backToBackThresholdMinutes: options.backToBackThreshold,
      checkAllDayOverlap: options.checkAllDayOverlap
    };
    
    const conflictsByRoom = detectConflictsByRoom(eventsByRoom, conflictOptions);
    
    let allConflicts = [];
    for (const roomData of conflictsByRoom.values()) {
      if (roomData.conflicts) {
        allConflicts.push(...roomData.conflicts);
      }
    }
    
    const conflictSummary = getConflictSummary(allConflicts);
    const cancellationStats = getCancellationStats(cancellationResults);
    
    const summary = {
      totalEvents: icsData.events.length,
      activeEvents: events.length,
      cancelledEvents: cancellationStats.cancelledCount,
      totalConflicts: allConflicts.length,
      cancelNotEffective: cancellationStats.notEffectiveCount,
      byType: conflictSummary.byType,
      bySeverity: {
        high: conflictSummary.bySeverity.high + (cancellationStats.bySeverity?.high || 0),
        medium: conflictSummary.bySeverity.medium + (cancellationStats.bySeverity?.medium || 0),
        low: conflictSummary.bySeverity.low + (cancellationStats.bySeverity?.low || 0)
      }
    };
    
    const results = {
      input: {
        file: options.input,
        timezone: options.timezone,
        startDate: options.startDate,
        endDate: options.endDate,
        roomFilter: options.room,
        organizerFilter: options.organizer
      },
      calendar: icsData.calendar,
      summary,
      byRoom: conflictsByRoom,
      cancellations: cancellationResults,
      inputValidation: validation,
      generatedAt: DateTime.utc()
    };
    
    const exitCode = calculateExitCode(results, options);
    results.exitCode = exitCode;
    
    const reportFiles = generateReports(results, options.outputDir, {
      format: options.format,
      timezone: options.timezone,
      basename: options.basename
    });
    
    results.files = reportFiles;
    
    if (options.format === OUTPUT_FORMATS.ALL || options.format === OUTPUT_FORMATS.JSON) {
      const path = require('path');
      const { generateJSONReport } = require('./report-generator');
      generateJSONReport(results, path.join(options.outputDir, `${options.basename}.json`));
    }
    
    if (!options.quiet) {
      printTerminalSummary(results, { timezone: options.timezone });
    }
    
    return exitCode;
    
  } catch (error) {
    console.error(`处理失败: ${error.message}`);
    if (options.verbose) {
      console.error(error.stack);
    }
    
    if (error.message.includes('not found')) {
      return EXIT_CODES.FILE_NOT_FOUND;
    } else if (error.message.includes('parse')) {
      return EXIT_CODES.PARSE_ERROR;
    }
    return EXIT_CODES.PROCESSING_ERROR;
  }
}

program
  .name('ical-conflict')
  .description('iCal 会议室冲突检测 CLI 工具 - 检测隐藏冲突、跨天会议和取消未生效预订')
  .version('1.0.0');

program
  .argument('<ics-file>', 'ICS 日历文件路径')
  .option('-o, --output-dir <dir>', '输出目录', './reports')
  .option('-f, --format <format>', '输出格式: json, markdown, all', 'all')
  .option('-t, --timezone <tz>', '目标时区 (如: Asia/Shanghai, UTC)', 'Asia/Shanghai')
  .option('-s, --start-date <date>', '开始日期 (YYYY-MM-DD)')
  .option('-e, --end-date <date>', '结束日期 (YYYY-MM-DD)')
  .option('-r, --room <name>', '按会议室名称过滤')
  .option('-g, --organizer <email>', '按组织者邮箱过滤')
  .option('-m, --min-overlap <minutes>', '最小重叠时间(分钟)，小于此值的忽略', 1)
  .option('-b, --include-back-to-back', '检测紧接会议')
  .option('--back-to-back-threshold <minutes>', '紧接会议阈值(分钟)', 5)
  .option('-a, --check-all-day-overlap', '检测全天事件与常规会议冲突', true)
  .option('-x, --expand-recurrence', '展开重复规则', true)
  .option('-c, --include-cancelled', '包含已取消事件')
  .option('--cancel-threshold <minutes>', '取消生效阈值(分钟)', 60)
  .option('--check-recurrence-exceptions', '检查重复事件取消异常', true)
  .option('-n, --basename <name>', '输出文件基础名', 'conflict-report')
  .option('-q, --quiet', '静默模式，不打印终端摘要')
  .option('-v, --verbose', '详细模式，打印更多信息')
  .option('--strict', '严格模式，发现冲突时返回非零退出码')
  .option('--strict-cancellations', '取消严格模式，发现取消未生效返回非零退出码')
  .action((icsFile, options) => {
    options.input = icsFile;
    const exitCode = runConflictCheck(options);
    process.exit(exitCode);
  });

program
  .command('validate')
  .description('验证 ICS 文件格式')
  .argument('<ics-file>', 'ICS 文件路径')
  .action((icsFile) => {
    try {
      const icsData = parseICSFile(icsFile);
      console.log(`✅ 文件有效`);
      console.log(`  日历名称: ${icsData.calendar?.name || 'N/A'}`);
      console.log(`  事件数: ${icsData.events.length}`);
      console.log(`  时区定义: ${icsData.timezones.length}`);
      process.exit(EXIT_CODES.SUCCESS);
    } catch (error) {
      console.error(`❌ 文件无效: ${error.message}`);
      process.exit(EXIT_CODES.PARSE_ERROR);
    }
  });

program
  .command('list-rooms')
  .description('列出日历中所有会议室')
  .argument('<ics-file>', 'ICS 文件路径')
  .action((icsFile) => {
    try {
      const icsData = parseICSFile(icsFile);
      const rooms = new Set();
      for (const event of icsData.events) {
        if (event.location) {
          rooms.add(event.location);
        }
      }
      console.log('会议室列表:');
      for (const room of [...rooms].sort()) {
        const count = icsData.events.filter(e => e.location === room).length;
        console.log(`  ${room} (${count} 个事件)`);
      }
      process.exit(EXIT_CODES.SUCCESS);
    } catch (error) {
      console.error(`❌ 处理失败: ${error.message}`);
      process.exit(EXIT_CODES.PARSE_ERROR);
    }
  });

program
  .command('list-events')
  .description('列出日历中所有事件')
  .argument('<ics-file>', 'ICS 文件路径')
  .option('-t, --timezone <tz>', '目标时区', 'Asia/Shanghai')
  .option('-r, --room <name>', '按会议室过滤')
  .action((icsFile, options) => {
    try {
      const icsData = parseICSFile(icsFile);
      let events = icsData.events;
      
      if (options.room) {
        events = filterEventsByRoom(events, options.room);
      }
      
      const normalizedTz = normalizeTimezone(options.timezone);
      
      console.log(`事件列表 (共 ${events.length} 个):`);
      console.log('');
      
      for (const event of events.slice(0, 50)) {
        const localStart = event.startTime.setZone(normalizedTz);
        const localEnd = event.endTime.setZone(normalizedTz);
        const status = event.status === 'CANCELLED' ? '❌ ' : 
                       event.status === 'TENTATIVE' ? '⚠️  ' : '✅ ';
        
        console.log(`${status}${event.summary}`);
        console.log(`   时间: ${localStart.toFormat('yyyy-MM-dd HH:mm')} - ${localEnd.toFormat('HH:mm')}`);
        if (event.location) console.log(`   地点: ${event.location}`);
        if (event.isAllDay) console.log(`   全天事件`);
        if (event.hasRecurrence) console.log(`   重复事件`);
        console.log('');
      }
      
      if (events.length > 50) {
        console.log(`... 还有 ${events.length - 50} 个事件`);
      }
      
      process.exit(EXIT_CODES.SUCCESS);
    } catch (error) {
      console.error(`❌ 处理失败: ${error.message}`);
      process.exit(EXIT_CODES.PARSE_ERROR);
    }
  });

program.parseAsync(process.argv)
  .catch(error => {
    console.error(`错误: ${error.message}`);
    process.exit(EXIT_CODES.PROCESSING_ERROR);
  });
