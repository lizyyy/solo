const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');

dayjs.extend(utc);
dayjs.extend(timezone);

const HQ_TIMEZONE = 'Asia/Shanghai';
const STORE_TIMEZONES = {
  'store-bj': 'Asia/Shanghai',
  'store-la': 'America/Los_Angeles',
};

function getStoreTimezone(storeId) {
  return STORE_TIMEZONES[storeId] || HQ_TIMEZONE;
}

function convertToTimezone(utcTimestamp, targetTimezone) {
  return dayjs.utc(utcTimestamp * 1000).tz(targetTimezone);
}

function getDateRange(rangeType, timezone, customStart = null, customEnd = null) {
  const now = dayjs().tz(timezone);
  let start, end;

  switch (rangeType) {
    case 'today':
      start = now.startOf('day').valueOf() / 1000;
      end = now.endOf('day').valueOf() / 1000;
      break;
    case 'week':
      start = now.startOf('week').valueOf() / 1000;
      end = now.endOf('week').valueOf() / 1000;
      break;
    case 'month':
      start = now.startOf('month').valueOf() / 1000;
      end = now.endOf('month').valueOf() / 1000;
      break;
    case 'custom':
      if (customStart && customEnd) {
        start = dayjs.tz(customStart, timezone).startOf('day').valueOf() / 1000;
        end = dayjs.tz(customEnd, timezone).endOf('day').valueOf() / 1000;
      } else {
        start = now.startOf('day').valueOf() / 1000;
        end = now.endOf('day').valueOf() / 1000;
      }
      break;
    default:
      start = now.startOf('day').valueOf() / 1000;
      end = now.endOf('day').valueOf() / 1000;
  }

  return { start: Math.floor(start), end: Math.floor(end) };
}

function filterTicketsByTimezone(tickets, filterMode, rangeType, customStart, customEnd) {
  let targetTimezone;
  let rangeStart, rangeEnd;

  switch (filterMode) {
    case 'store-local':
      return tickets.map(ticket => {
        const storeTz = getStoreTimezone(ticket.store_id);
        const range = getDateRange(rangeType, storeTz, customStart, customEnd);
        const ticketTime = convertToTimezone(ticket.created_utc, storeTz);
        const isInRange = ticket.created_utc >= range.start && ticket.created_utc <= range.end;
        
        return {
          ...ticket,
          isInRange,
          displayTime: ticketTime.format('YYYY-MM-DD HH:mm:ss'),
          displayTimezone: storeTz,
          rangeInfo: {
            type: rangeType,
            filterMode: 'store-local',
            timezone: storeTz,
            rangeStart: dayjs.utc(range.start * 1000).tz(storeTz).format('YYYY-MM-DD HH:mm:ss'),
            rangeEnd: dayjs.utc(range.end * 1000).tz(storeTz).format('YYYY-MM-DD HH:mm:ss')
          }
        };
      });

    case 'hq-timezone':
      targetTimezone = HQ_TIMEZONE;
      break;
    case 'utc':
      targetTimezone = 'UTC';
      break;
    default:
      targetTimezone = HQ_TIMEZONE;
  }

  const range = getDateRange(rangeType, targetTimezone, customStart, customEnd);
  rangeStart = range.start;
  rangeEnd = range.end;

  return tickets.map(ticket => {
    const ticketTime = convertToTimezone(ticket.created_utc, targetTimezone);
    const isInRange = ticket.created_utc >= rangeStart && ticket.created_utc <= rangeEnd;

    return {
      ...ticket,
      isInRange,
      displayTime: ticketTime.format('YYYY-MM-DD HH:mm:ss'),
      displayTimezone: targetTimezone,
      rangeInfo: {
        type: rangeType,
        filterMode,
        timezone: targetTimezone,
        rangeStart: dayjs.utc(rangeStart * 1000).tz(targetTimezone).format('YYYY-MM-DD HH:mm:ss'),
        rangeEnd: dayjs.utc(rangeEnd * 1000).tz(targetTimezone).format('YYYY-MM-DD HH:mm:ss')
      }
    };
  });
}

function generateSummary(filteredTickets) {
  const inRangeTickets = filteredTickets.filter(t => t.isInRange);
  const outOfRangeTickets = filteredTickets.filter(t => !t.isInRange);

  const statusCount = {};
  const storeCount = {};

  inRangeTickets.forEach(ticket => {
    statusCount[ticket.status] = (statusCount[ticket.status] || 0) + 1;
    storeCount[ticket.store_name] = (storeCount[ticket.store_name] || 0) + 1;
  });

  return {
    total: filteredTickets.length,
    inRange: inRangeTickets.length,
    outOfRange: outOfRangeTickets.length,
    statusBreakdown: statusCount,
    storeBreakdown: storeCount,
    rangeInfo: filteredTickets.length > 0 ? filteredTickets[0].rangeInfo : null
  };
}

function generateMarkdownReport(summary, tickets) {
  const rangeInfo = summary.rangeInfo || {};
  const inRangeTickets = tickets.filter(t => t.isInRange);

  let markdown = `# 跨时区工单筛选报告\n\n`;
  markdown += `## 筛选条件\n\n`;
  markdown += `- 筛选模式: ${getFilterModeName(rangeInfo.filterMode)}\n`;
  markdown += `- 目标时区: ${rangeInfo.timezone || 'N/A'}\n`;
  markdown += `- 时间范围: ${getRangeTypeName(rangeInfo.type)}\n`;
  markdown += `- 范围起始: ${rangeInfo.rangeStart || 'N/A'}\n`;
  markdown += `- 范围结束: ${rangeInfo.rangeEnd || 'N/A'}\n\n`;

  markdown += `## 筛选结果摘要\n\n`;
  markdown += `| 指标 | 数值 |\n`;
  markdown += `|------|------|\n`;
  markdown += `| 总工单数量 | ${summary.total} |\n`;
  markdown += `| 范围内工单 | ${summary.inRange} |\n`;
  markdown += `| 范围外工单 | ${summary.outOfRange} |\n\n`;

  if (Object.keys(summary.statusBreakdown).length > 0) {
    markdown += `### 按状态统计\n\n`;
    markdown += `| 状态 | 数量 |\n`;
    markdown += `|------|------|\n`;
    for (const [status, count] of Object.entries(summary.statusBreakdown)) {
      markdown += `| ${status} | ${count} |\n`;
    }
    markdown += `\n`;
  }

  if (Object.keys(summary.storeBreakdown).length > 0) {
    markdown += `### 按门店统计\n\n`;
    markdown += `| 门店 | 数量 |\n`;
    markdown += `|------|------|\n`;
    for (const [store, count] of Object.entries(summary.storeBreakdown)) {
      markdown += `| ${store} | ${count} |\n`;
    }
    markdown += `\n`;
  }

  if (inRangeTickets.length > 0) {
    markdown += `## 范围内工单详情\n\n`;
    markdown += `| 工单ID | 门店 | 标题 | 状态 | 显示时间 | 时区 |\n`;
    markdown += `|--------|------|------|------|----------|------|\n`;
    
    inRangeTickets.forEach(ticket => {
      markdown += `| ${ticket.id} | ${ticket.store_name} | ${ticket.title} | ${ticket.status} | ${ticket.displayTime} | ${ticket.displayTimezone} |\n`;
    });
    markdown += `\n`;
  }

  const outOfRangeTickets = tickets.filter(t => !t.isInRange);
  if (outOfRangeTickets.length > 0) {
    markdown += `## 范围外工单(对比参考)\n\n`;
    markdown += `| 工单ID | 门店 | 标题 | 状态 | 显示时间 | 时区 |\n`;
    markdown += `|--------|------|------|------|----------|------|\n`;
    
    outOfRangeTickets.forEach(ticket => {
      markdown += `| ${ticket.id} | ${ticket.store_name} | ${ticket.title} | ${ticket.status} | ${ticket.displayTime} | ${ticket.displayTimezone} |\n`;
    });
    markdown += `\n`;
  }

  markdown += `---\n`;
  markdown += `*报告生成时间: ${dayjs().format('YYYY-MM-DD HH:mm:ss')}*\n`;

  return markdown;
}

function getFilterModeName(mode) {
  const names = {
    'store-local': '门店本地时间',
    'hq-timezone': '总部时区',
    'utc': 'UTC时间'
  };
  return names[mode] || mode;
}

function getRangeTypeName(type) {
  const names = {
    'today': '今天',
    'week': '本周',
    'month': '本月',
    'custom': '自定义'
  };
  return names[type] || type;
}

module.exports = {
  getStoreTimezone,
  convertToTimezone,
  getDateRange,
  filterTicketsByTimezone,
  generateSummary,
  generateMarkdownReport,
  HQ_TIMEZONE
};
