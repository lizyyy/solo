const { parseRetryHistory } = require('./parser');

const MAX_RETRY_ALLOWED = 3;
const RENAME_INDICATORS = ['(重命名)', '(改名)', '-new', '-old', '_v2'];

function validateJobs(jobs) {
  const issues = [];
  const retryGroups = parseRetryHistory(jobs);

  for (const [baseName, groupJobs] of Object.entries(retryGroups)) {
    if (groupJobs.length > 1) {
      issues.push({
        type: 'TASK_RETRY',
        severity: 'warning',
        message: `文件 "${baseName}" 存在 ${groupJobs.length} 次重试记录`,
        details: groupJobs.map(j => ({
          jobId: j.jobId,
          printer: j.printer,
          status: j.status,
          retryCount: j.retryCount
        }))
      });

      const maxRetry = Math.max(...groupJobs.map(j => j.retryCount));
      if (maxRetry >= MAX_RETRY_ALLOWED) {
        issues.push({
          type: 'EXCESSIVE_RETRY',
          severity: 'error',
          message: `文件 "${baseName}" 重试次数 (${maxRetry}) 超过阈值 (${MAX_RETRY_ALLOWED})`,
          details: { baseName, retryCount: maxRetry }
        });
      }
    }
  }

  const printerChanges = detectPrinterNameChanges(jobs);
  for (const change of printerChanges) {
    issues.push({
      type: 'PRINTER_RENAME',
      severity: 'info',
      message: `检测到打印机名称变化: "${change.oldName}" → "${change.newName}"`,
      details: change
    });
  }

  const failedJobs = jobs.filter(j => j.status === 'FAILED' || j.status === 'ERROR');
  if (failedJobs.length > 0) {
    issues.push({
      type: 'FAILED_JOBS',
      severity: 'error',
      message: `发现 ${failedJobs.length} 个失败任务`,
      details: failedJobs.map(j => ({
        jobId: j.jobId,
        fileName: j.fileName,
        printer: j.printer,
        error: j.errorMessage || '未知错误'
      }))
    });
  }

  const stuckJobs = jobs.filter(j => j.status === 'PENDING' && j.retryCount > 0);
  if (stuckJobs.length > 0) {
    issues.push({
      type: 'STUCK_JOBS',
      severity: 'warning',
      message: `发现 ${stuckJobs.length} 个可能卡住的任务`,
      details: stuckJobs.map(j => ({
        jobId: j.jobId,
        fileName: j.fileName,
        printer: j.printer
      }))
    });
  }

  return {
    issues,
    summary: {
      total: jobs.length,
      errors: issues.filter(i => i.severity === 'error').length,
      warnings: issues.filter(i => i.severity === 'warning').length,
      infos: issues.filter(i => i.severity === 'info').length
    }
  };
}

function detectPrinterNameChanges(jobs) {
  const changes = [];
  const printerAliases = {};

  for (const job of jobs) {
    for (const indicator of RENAME_INDICATORS) {
      if (job.printer.includes(indicator)) {
        const baseName = job.printer.replace(indicator, '').trim();
        if (printerAliases[baseName] && !printerAliases[baseName].includes(job.printer)) {
          changes.push({
            oldName: printerAliases[baseName][0],
            newName: job.printer,
            detectedIn: job.jobId
          });
        }
        if (!printerAliases[baseName]) {
          printerAliases[baseName] = [];
        }
        printerAliases[baseName].push(job.printer);
      }
    }
  }

  const uniqueChanges = [];
  const seen = new Set();
  for (const change of changes) {
    const key = `${change.oldName}→${change.newName}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueChanges.push(change);
    }
  }

  return uniqueChanges;
}

function generateRerunJobs(jobs) {
  return jobs.filter(j => 
    j.status === 'FAILED' || 
    j.status === 'ERROR' ||
    (j.status === 'PENDING' && j.retryCount >= 2)
  ).map(j => ({
    ...j,
    suggestedAction: 'RERUN',
    suggestedPrinter: suggestAlternativePrinter(j.printer)
  }));
}

function suggestAlternativePrinter(currentPrinter) {
  const alternatives = {
    'HP-LaserJet-1楼': ['HP-LaserJet-2楼', 'Canon-MF-1楼'],
    'HP-LaserJet-2楼': ['HP-LaserJet-1楼', 'Canon-MF-2楼'],
    'Canon-MF-1楼': ['HP-LaserJet-1楼', 'Canon-MF-2楼'],
    'Canon-MF-2楼': ['HP-LaserJet-2楼', 'Canon-MF-1楼']
  };
  return alternatives[currentPrinter] || ['其他可用打印机'];
}

module.exports = {
  validateJobs,
  generateRerunJobs
};
