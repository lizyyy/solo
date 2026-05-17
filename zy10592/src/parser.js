const fs = require('fs');
const path = require('path');
const readline = require('readline');

function parseJsonLine(line, fileInfo, lineNumber) {
  try {
    const data = JSON.parse(line);
    
    const path = data.path || data.url_path || data.endpoint || data.uri || '';
    const tenant = data.tenant || data.tenant_id || data.org || data.org_id || '';
    const statusCode = data.status || data.status_code || data.http_status || 0;
    const latency = data.latency || data.duration || data.response_time || data.ms || 0;
    const requestId = data.request_id || data.req_id || data.trace_id || '';
    const timestamp = data.timestamp || data.time || data.ts || Date.now();
    
    if (!path) {
      return {
        valid: false,
        error: '缺少路径字段 (path/url_path/endpoint/uri)',
        raw: line
      };
    }
    
    if (typeof latency !== 'number' || isNaN(latency) || latency < 0) {
      return {
        valid: false,
        error: `耗时尚无效 (${latency})`,
        raw: line
      };
    }
    
    return {
      valid: true,
      record: {
        path: String(path),
        tenant: String(tenant),
        statusCode: Number(statusCode),
        latency: Number(latency),
        requestId: String(requestId),
        timestamp: Number(timestamp),
        sourceFile: fileInfo.filename,
        lineNumber,
        raw: data
      }
    };
  } catch (e) {
    return {
      valid: false,
      error: `JSON解析失败: ${e.message}`,
      raw: line
    };
  }
}

function parseNginxLine(line, fileInfo, lineNumber) {
  const nginxPattern = /(\S+) - (\S+) \[([^\]]+)\] "(\S+) (\S+) (\S+)" (\d+) (\d+) "([^"]*)" "([^"]*)" (\d+)/;
  const match = line.match(nginxPattern);
  
  if (!match) {
    return {
      valid: false,
      error: 'Nginx日志格式不匹配',
      raw: line
    };
  }
  
  const [, , , , path, , statusCode, , , , latency] = match;
  
  return {
    valid: true,
    record: {
      path: String(path),
      tenant: '',
      statusCode: Number(statusCode),
      latency: Number(latency) / 1000,
      requestId: '',
      timestamp: Date.now(),
      sourceFile: fileInfo.filename,
      lineNumber,
      raw: line
    }
  };
}

async function parseLogFile(filePath, options) {
  const records = [];
  const badLines = [];
  const filename = path.basename(filePath);
  
  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });
  
  let lineNumber = 0;
  
  for await (const line of rl) {
    lineNumber++;
    
    if (!line.trim()) {
      continue;
    }
    
    let result;
    if (options.logFormat === 'json') {
      result = parseJsonLine(line, { filename }, lineNumber);
    } else if (options.logFormat === 'nginx') {
      result = parseNginxLine(line, { filename }, lineNumber);
    } else {
      result = parseJsonLine(line, { filename }, lineNumber);
    }
    
    if (result.valid) {
      records.push(result.record);
    } else {
      badLines.push({
        filename,
        lineNumber,
        error: result.error,
        raw: result.raw
      });
    }
  }
  
  return { records, badLines };
}

async function parseLogs(inputDir, options) {
  const absoluteInputDir = path.resolve(inputDir);
  
  if (!fs.existsSync(absoluteInputDir)) {
    throw new Error(`输入目录不存在: ${absoluteInputDir}`);
  }
  
  const files = fs.readdirSync(absoluteInputDir)
    .filter(file => {
      const ext = path.extname(file).toLowerCase();
      return ext === '.log' || ext === '.json' || ext === '.txt' || !ext;
    })
    .map(file => path.join(absoluteInputDir, file));
  
  if (files.length === 0) {
    throw new Error(`输入目录中没有找到日志文件: ${absoluteInputDir}`);
  }
  
  console.log(`📄 找到 ${files.length} 个日志文件`);
  
  let allRecords = [];
  let allBadLines = [];
  
  for (const file of files) {
    console.log(`   解析中: ${path.basename(file)}`);
    const { records, badLines } = await parseLogFile(file, options);
    allRecords = allRecords.concat(records);
    allBadLines = allBadLines.concat(badLines);
  }
  
  return {
    records: allRecords,
    badLines: allBadLines
  };
}

module.exports = {
  parseLogs,
  parseJsonLine,
  parseNginxLine
};
