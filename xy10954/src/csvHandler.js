const fs = require('fs');
const { validateCSVRow } = require('./validator');

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
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  
  return result;
}

function parseCSV(content) {
  const lines = content.split(/\r?\n/).filter(line => line.trim() !== '');
  
  if (lines.length === 0) {
    return [];
  }

  const headers = parseCSVLine(lines[0]);
  const records = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const record = {};
    
    for (let j = 0; j < headers.length; j++) {
      record[headers[j]] = values[j] || '';
    }
    
    records.push(record);
  }

  return records;
}

function toCSVLine(values) {
  return values.map(v => {
    const str = String(v !== null && v !== undefined ? v : '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  }).join(',');
}

async function readCSV(filePath, options = {}) {
  const content = fs.readFileSync(filePath, 'utf8');
  const records = parseCSV(content);

  return records.map((record, index) => ({
    ...record,
    _originalRow: index + 2,
    _sourceFile: filePath
  }));
}

function normalizeBatchId(batchId) {
  if (!batchId) return '';
  return String(batchId).trim().toUpperCase().replace(/[-_\s]/g, '');
}

function mergeData(arrivalData, temperatureData) {
  const arrivalColumns = ['batchId', 'supplier', 'category', 'quantity', 'arrivalDate'];
  const temperatureColumns = ['batchId', 'temperature', 'measureTime', 'measurePoint'];

  const badRows = [];
  const validArrival = [];
  const validTemperature = [];

  for (const record of arrivalData) {
    const validation = validateCSVRow(record, record._originalRow, arrivalColumns, 'arrival');
    if (validation.isValid) {
      validArrival.push(record);
    } else {
      badRows.push({
        ...record,
        _validationErrors: validation.errors,
        _fileType: 'arrival'
      });
    }
  }

  for (const record of temperatureData) {
    const validation = validateCSVRow(record, record._originalRow, temperatureColumns, 'temperature');
    if (validation.isValid) {
      validTemperature.push(record);
    } else {
      badRows.push({
        ...record,
        _validationErrors: validation.errors,
        _fileType: 'temperature'
      });
    }
  }

  const temperatureMap = new Map();
  for (const temp of validTemperature) {
    const normalizedId = normalizeBatchId(temp.batchId);
    if (!temperatureMap.has(normalizedId)) {
      temperatureMap.set(normalizedId, []);
    }
    temperatureMap.get(normalizedId).push(temp);
  }

  const mergedData = [];
  const unmatchedArrival = [];
  const matchedTemperatureIds = new Set();

  for (const arrival of validArrival) {
    const normalizedId = normalizeBatchId(arrival.batchId);
    const temperatures = temperatureMap.get(normalizedId) || [];

    if (temperatures.length === 0) {
      unmatchedArrival.push(arrival);
      continue;
    }

    const avgTemp = temperatures.reduce((sum, t) => sum + parseFloat(t.temperature), 0) / temperatures.length;
    const maxTemp = Math.max(...temperatures.map(t => parseFloat(t.temperature)));
    const minTemp = Math.min(...temperatures.map(t => parseFloat(t.temperature)));

    mergedData.push({
      batchId: arrival.batchId,
      supplier: arrival.supplier,
      category: arrival.category,
      quantity: parseInt(arrival.quantity) || 0,
      arrivalDate: arrival.arrivalDate,
      temperature: {
        average: parseFloat(avgTemp.toFixed(2)),
        max: parseFloat(maxTemp.toFixed(2)),
        min: parseFloat(minTemp.toFixed(2)),
        samples: temperatures.length,
        records: temperatures.map(t => ({
          temperature: parseFloat(t.temperature),
          measureTime: t.measureTime,
          measurePoint: t.measurePoint,
          _originalRow: t._originalRow
        }))
      },
      _arrivalRow: arrival._originalRow,
      _temperatureRows: temperatures.map(t => t._originalRow)
    });

    temperatures.forEach(t => matchedTemperatureIds.add(t._originalRow));
  }

  const unmatchedTemperature = validTemperature.filter(t => !matchedTemperatureIds.has(t._originalRow));

  return {
    mergedData,
    unmatchedArrival,
    unmatchedTemperature,
    badRows
  };
}

async function writeCSV(data, filePath) {
  if (data.length === 0) {
    fs.writeFileSync(filePath, '', 'utf8');
    return;
  }

  const headers = Object.keys(data[0]);
  const lines = [toCSVLine(headers)];

  for (const record of data) {
    const values = headers.map(h => record[h]);
    lines.push(toCSVLine(values));
  }

  fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
}

module.exports = {
  readCSV,
  mergeData,
  writeCSV,
  normalizeBatchId,
  parseCSV,
  parseCSVLine
};