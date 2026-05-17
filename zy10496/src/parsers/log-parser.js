const fs = require('fs');
const path = require('path');
const readline = require('readline');

const LOG_FORMATS = {
  nginx: /^(\S+) - (\S+) \[([^\]]+)\] "(\S+) (\S+) (\S+)" (\d+) (\d+) "([^"]*)" "([^"]*)"$/,
  combined: /^(\S+) - (\S+) \[([^\]]+)\] "(\S+) (\S+) (\S+)" (\d+) (\d+) "([^"]*)" "([^"]*)"$/,
  common: /^(\S+) - (\S+) \[([^\]]+)\] "(\S+) (\S+) (\S+)" (\d+) (\d+)$/,
  apache: /^(\S+) - (\S+) \[([^\]]+)\] "(\S+) (\S+) (\S+)" (\d+) (\d+) "([^"]*)" "([^"]*)"$/
};

function parseLogLine(line, format = 'nginx') {
  const regex = LOG_FORMATS[format];
  if (!regex) {
    throw new Error(`不支持的日志格式: ${format}`);
  }

  const match = line.match(regex);
  if (!match) {
    return null;
  }

  const record = {
    ip: match[1],
    remoteUser: match[2],
    timestamp: match[3],
    method: match[4],
    path: match[5],
    protocol: match[6],
    status: parseInt(match[7], 10),
    size: parseInt(match[8], 10)
  };

  if (format !== 'common' && match[9] !== undefined) {
    record.referer = match[9];
    record.userAgent = match[10];
  }

  return record;
}

async function parseFile(filePath, options) {
  const records = [];
  const badLines = [];
  let lineNumber = 0;

  const rl = readline.createInterface({
    input: fs.createReadStream(filePath),
    crlfDelay: Infinity
  });

  for await (const line of rl) {
    lineNumber++;
    if (!line.trim()) {
      continue;
    }

    try {
      const record = parseLogLine(line, options.format);
      if (record) {
        record.sourceFile = path.basename(filePath);
        record.lineNumber = lineNumber;
        record.rawLine = line;
        records.push(record);
      } else {
        badLines.push({
          file: filePath,
          lineNumber,
          content: line,
          reason: '格式不匹配'
        });
      }
    } catch (error) {
      badLines.push({
        file: filePath,
        lineNumber,
        content: line,
        reason: error.message
      });
    }
  }

  return { records, badLines, totalLines: lineNumber };
}

async function parseLogs(inputPath, options) {
  const allRecords = [];
  const allBadLines = [];
  let totalLines = 0;

  const stats = fs.statSync(inputPath);

  if (stats.isFile()) {
    const result = await parseFile(inputPath, options);
    allRecords.push(...result.records);
    allBadLines.push(...result.badLines);
    totalLines += result.totalLines;
  } else if (stats.isDirectory()) {
    const files = fs.readdirSync(inputPath)
      .filter(f => f.endsWith('.log') || f.endsWith('.txt'))
      .map(f => path.join(inputPath, f));

    for (const file of files) {
      const result = await parseFile(file, options);
      allRecords.push(...result.records);
      allBadLines.push(...result.badLines);
      totalLines += result.totalLines;
    }
  }

  return {
    records: allRecords,
    badLines: allBadLines,
    totalLines,
    parsedCount: allRecords.length,
    badLineCount: allBadLines.length,
    inputPath
  };
}

function parseTimestamp(timestampStr) {
  const match = timestampStr.match(/^(\d+)\/(\w+)\/(\d+):(\d+):(\d+):(\d+)\s+([+-])(\d{4})$/);
  if (!match) {
    return new Date(timestampStr);
  }

  const months = {
    Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
    Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11
  };

  const day = parseInt(match[1], 10);
  const month = months[match[2]];
  const year = parseInt(match[3], 10);
  const hour = parseInt(match[4], 10);
  const minute = parseInt(match[5], 10);
  const second = parseInt(match[6], 10);

  return new Date(year, month, day, hour, minute, second);
}

module.exports = {
  parseLogs,
  parseLogLine,
  parseTimestamp,
  LOG_FORMATS
};
