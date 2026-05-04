const { listEvents, getFailureStatistics, getProviderStatistics } = require('../dao/eventDao');
const { getFailureReasons, getAttemptStatistics } = require('../dao/attemptDao');
const { getAuditStats } = require('../dao/auditDao');
const { EVENT_STATUSES } = require('../db/schema');

function formatTimestamp(ts) {
  if (!ts) return '-';
  const date = new Date(ts * 1000);
  return date.toISOString();
}

async function generateJSONReport(since, until, providerName = null) {
  const filters = {};
  if (since) filters.since = since;
  if (until) filters.until = until;
  if (providerName) filters.provider_name = providerName;
  
  const events = await listEvents(filters);
  const eventStats = providerName 
    ? await getProviderStatistics(providerName, since, until)
    : await getFailureStatistics(since, until);
  const failureReasons = await getFailureReasons(since, until);
  const attemptStats = await getAttemptStatistics(since, until);
  const auditStats = await getAuditStats(since, until);
  
  const summary = {
    totalEvents: events.length,
    byStatus: {},
    timeRange: {
      since: since ? formatTimestamp(since) : null,
      until: until ? formatTimestamp(until) : null,
    },
    generatedAt: new Date().toISOString(),
  };
  
  Object.values(EVENT_STATUSES).forEach(status => {
    summary.byStatus[status] = events.filter(e => e.status === status).length;
  });
  
  return {
    summary,
    eventStats,
    failureReasons,
    attemptStats,
    auditStats,
    events: events.map(e => ({
      id: e.id,
      provider_name: e.provider_name,
      event_id: e.event_id,
      status: e.status,
      received_at: formatTimestamp(e.received_at),
      processed_at: formatTimestamp(e.processed_at),
      attempt_count: e.attempt_count,
      next_retry_at: formatTimestamp(e.next_retry_at),
    })),
  };
}

async function generateCSVReport(since, until, providerName = null) {
  const filters = {};
  if (since) filters.since = since;
  if (until) filters.until = until;
  if (providerName) filters.provider_name = providerName;
  
  const events = await listEvents(filters);
  
  const headers = [
    'ID',
    'Provider',
    'Event ID',
    'Status',
    'Received At',
    'Processed At',
    'Attempt Count',
    'Next Retry At',
  ];
  
  const rows = [headers.join(',')];
  
  events.forEach(e => {
    const row = [
      e.id,
      e.provider_name,
      e.event_id || '',
      e.status,
      formatTimestamp(e.received_at),
      formatTimestamp(e.processed_at),
      e.attempt_count,
      formatTimestamp(e.next_retry_at),
    ];
    rows.push(row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
  });
  
  return rows.join('\n');
}

async function generateMarkdownReport(since, until, providerName = null) {
  const report = await generateJSONReport(since, until, providerName);
  
  let md = `# Webhook Debugger Report\n\n`;
  
  md += `**Generated:** ${report.summary.generatedAt}\n\n`;
  
  if (report.summary.timeRange.since || report.summary.timeRange.until) {
    md += `**Time Range:** `;
    const parts = [];
    if (report.summary.timeRange.since) parts.push(`From ${report.summary.timeRange.since}`);
    if (report.summary.timeRange.until) parts.push(`Until ${report.summary.timeRange.until}`);
    md += parts.join(' / ') + '\n\n';
  }
  
  md += `## Summary\n\n`;
  md += `- **Total Events:** ${report.summary.totalEvents}\n`;
  
  Object.entries(report.summary.byStatus).forEach(([status, count]) => {
    if (count > 0) {
      md += `- **${status}:** ${count}\n`;
    }
  });
  
  md += '\n';
  
  if (report.failureReasons && report.failureReasons.length > 0) {
    md += `## Failure Reasons\n\n`;
    md += `| Reason | Count |\n`;
    md += `|--------|-------|\n`;
    report.failureReasons.forEach(r => {
      const reason = (r.error_message || '').replace(/\n/g, ' ').substring(0, 80);
      md += `| ${reason} | ${r.count} |\n`;
    });
    md += '\n';
  }
  
  if (report.auditStats && report.auditStats.length > 0) {
    md += `## Audit Summary\n\n`;
    md += `| Action | Count |\n`;
    md += `|--------|-------|\n`;
    report.auditStats.forEach(s => {
      md += `| ${s.action} | ${s.count} |\n`;
    });
    md += '\n';
  }
  
  if (report.events && report.events.length > 0) {
    md += `## Events\n\n`;
    md += `| ID | Provider | Event ID | Status | Received | Attempts |\n`;
    md += `|----|----------|----------|--------|----------|----------|\n`;
    
    report.events.slice(0, 50).forEach(e => {
      const receivedShort = e.received_at ? e.received_at.substring(0, 19) : '-';
      const eventId = (e.event_id || '-').substring(0, 20);
      md += `| ${e.id} | ${e.provider_name} | ${eventId} | ${e.status} | ${receivedShort} | ${e.attempt_count} |\n`;
    });
    
    if (report.events.length > 50) {
      md += `\n*... and ${report.events.length - 50} more events*\n`;
    }
  }
  
  return md;
}

module.exports = {
  generateJSONReport,
  generateCSVReport,
  generateMarkdownReport,
};
