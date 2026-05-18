const fs = require('fs');

function parsePrintQueue(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.trim().split('\n');
  const jobs = [];

  for (const line of lines) {
    if (line.startsWith('#') || !line.trim()) continue;
    
    const parts = line.split('|').map(p => p.trim());
    if (parts.length < 6) continue;

    const job = {
      jobId: parts[0],
      fileName: parts[1],
      printer: parts[2],
      status: parts[3],
      timestamp: parts[4],
      retryCount: parseInt(parts[5]) || 0,
      originalLine: line
    };

    if (parts.length > 6) {
      job.errorMessage = parts[6];
    }

    jobs.push(job);
  }

  return jobs;
}

function parseRetryHistory(jobs) {
  const retryGroups = {};
  
  for (const job of jobs) {
    const baseName = job.fileName.replace(/_retry\d*$/, '');
    if (!retryGroups[baseName]) {
      retryGroups[baseName] = [];
    }
    retryGroups[baseName].push(job);
  }

  return retryGroups;
}

module.exports = {
  parsePrintQueue,
  parseRetryHistory
};
