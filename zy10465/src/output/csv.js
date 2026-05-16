const fs = require('fs');
const path = require('path');

function escapeCsv(value) {
  if (value === null || value === undefined) {
    return '';
  }
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

async function generateCsvOutput(result, outputDir) {
  const { metadata, summary, domains, resourceTypes, statusCodes, allRequests, errors } = result;

  const requestsCsvPath = path.join(outputDir, 'requests.csv');
  const requestsHeader = ['index', 'url', 'domain', 'resourceType', 'status', 'latency_ms', 'bucket', 'bucketLabel', 'method', 'source'];
  const requestsRows = allRequests.map(req => [
    req.index,
    req.url,
    req.domain,
    req.resourceType,
    req.status,
    req.latency,
    req.bucket,
    req.bucketLabel,
    req.method,
    req.source
  ]);
  const requestsContent = [requestsHeader, ...requestsRows].map(row => row.map(escapeCsv).join(',')).join('\n');
  fs.writeFileSync(requestsCsvPath, requestsContent + '\n', 'utf8');

  const domainsCsvPath = path.join(outputDir, 'domains.csv');
  const domainsHeader = ['domain', 'count', 'avgLatency_ms', 'totalLatency_ms', ...metadata.bucketLabels];
  const domainsRows = domains.map(d => [
    d.domain,
    d.count,
    d.avgLatency,
    d.totalLatency,
    ...d.buckets
  ]);
  const domainsContent = [domainsHeader, ...domainsRows].map(row => row.map(escapeCsv).join(',')).join('\n');
  fs.writeFileSync(domainsCsvPath, domainsContent + '\n', 'utf8');

  const typesCsvPath = path.join(outputDir, 'resource-types.csv');
  const typesHeader = ['type', 'count', 'avgLatency_ms', 'totalLatency_ms', ...metadata.bucketLabels];
  const typesRows = resourceTypes.map(t => [
    t.type,
    t.count,
    t.avgLatency,
    t.totalLatency,
    ...t.buckets
  ]);
  const typesContent = [typesHeader, ...typesRows].map(row => row.map(escapeCsv).join(',')).join('\n');
  fs.writeFileSync(typesCsvPath, typesContent + '\n', 'utf8');

  const summaryCsvPath = path.join(outputDir, 'summary.csv');
  const summaryHeader = ['bucket', 'label', 'count', 'percentage'];
  const summaryRows = summary.bucketStats.map(s => [
    s.bucket,
    s.label,
    s.count,
    s.percentage
  ]);
  const summaryContent = [summaryHeader, ...summaryRows].map(row => row.map(escapeCsv).join(',')).join('\n');
  fs.writeFileSync(summaryCsvPath, summaryContent + '\n', 'utf8');

  if (errors.length > 0) {
    const errorsCsvPath = path.join(outputDir, 'errors.csv');
    const errorsHeader = ['index', 'source', 'errors', 'entry_snippet'];
    const errorsRows = errors.map(e => [
      e.index,
      e.source,
      e.errors.join('; '),
      e.entry
    ]);
    const errorsContent = [errorsHeader, ...errorsRows].map(row => row.map(escapeCsv).join(',')).join('\n');
    fs.writeFileSync(errorsCsvPath, errorsContent + '\n', 'utf8');
  }

  const metaCsvPath = path.join(outputDir, 'metadata.csv');
  const metaRows = [
    ['harFile', metadata.harFile],
    ['analyzedAt', metadata.analyzedAt],
    ['totalEntries', metadata.totalEntries],
    ['validEntries', metadata.validEntries],
    ['errorCount', metadata.errorCount],
    ['totalRequests', summary.totalRequests],
    ['avgLatency_ms', summary.avgLatency],
    ['totalLatency_ms', summary.totalLatency],
    ['buckets', metadata.buckets.join(',')]
  ];
  const metaContent = metaRows.map(row => row.map(escapeCsv).join(',')).join('\n');
  fs.writeFileSync(metaCsvPath, metaContent + '\n', 'utf8');
}

module.exports = { generateCsvOutput };
