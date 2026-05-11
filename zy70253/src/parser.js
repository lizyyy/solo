const fs = require('fs');
const path = require('path');

function parseCSV(content) {
  const lines = content.split(/\r?\n/);
  if (lines.length === 0) return { headers: [], rows: [] };
  
  const headers = parseCSVLine(lines[0]);
  const rows = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === '') continue;
    const values = parseCSVLine(line);
    const row = {};
    headers.forEach((header, idx) => {
      row[header.trim()] = values[idx] !== undefined ? values[idx].trim() : '';
    });
    rows.push({ data: row, lineNumber: i + 1 });
  }
  
  return { headers, rows };
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

function parseJSON(content) {
  const data = JSON.parse(content);
  if (!Array.isArray(data)) {
    if (Array.isArray(data.records)) {
      return data.records.map((record, idx) => ({ data: record, lineNumber: idx + 1 }));
    }
    if (Array.isArray(data.rows)) {
      return data.rows.map((row, idx) => ({ data: row, lineNumber: idx + 1 }));
    }
    return [{ data, lineNumber: 1 }];
  }
  return data.map((record, idx) => ({ data: record, lineNumber: idx + 1 }));
}

function readFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`文件不存在: ${filePath}`);
  }
  return fs.readFileSync(filePath, 'utf8');
}

function parseFile(filePath) {
  const content = readFile(filePath);
  const ext = path.extname(filePath).toLowerCase();
  
  if (ext === '.json') {
    return { format: 'json', rows: parseJSON(content) };
  } else if (ext === '.csv') {
    const result = parseCSV(content);
    return { format: 'csv', headers: result.headers, rows: result.rows };
  } else {
    throw new Error(`不支持的文件格式: ${ext}，支持 .csv 和 .json`);
  }
}

function toCSV(headers, rows) {
  const headerLine = headers.map(h => `"${h}"`).join(',');
  const dataLines = rows.map(row => {
    return headers.map(h => {
      const value = row[h] !== undefined ? String(row[h]) : '';
      return `"${value.replace(/"/g, '""')}"`;
    }).join(',');
  });
  return [headerLine, ...dataLines].join('\n');
}

function toJSON(data, pretty = true) {
  return pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
}

module.exports = {
  parseCSV,
  parseCSVLine,
  parseJSON,
  readFile,
  parseFile,
  toCSV,
  toJSON
};
