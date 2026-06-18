const { v4: uuidv4 } = require('uuid');

const TIDE_UNITS = {
  METERS: ['m', '米', 'meter', 'meters', 'M', 'Meters'],
  CENTIMETERS: ['cm', '厘米', 'centimeter', 'centimeters', 'CM', 'Centimeters'],
  FEET: ['ft', '英尺', 'feet', 'foot', 'FT', 'Feet'],
  FATHOMS: ['fm', '浔', 'fathom', 'fathoms', 'FM', 'Fathoms']
};

function normalizeUnit(unitStr) {
  if (!unitStr) return null;
  const trimmed = unitStr.trim();
  for (const [standard, variants] of Object.entries(TIDE_UNITS)) {
    if (variants.some(v => v.toLowerCase() === trimmed.toLowerCase())) {
      return standard;
    }
  }
  return null;
}

function detectTideUnitMismatch(records) {
  const issues = [];
  const unitsFound = new Set();
  
  for (const record of records) {
    if (record.tideLevel !== undefined && record.tideLevel !== null) {
      const rawUnit = record.tideUnit || '';
      const normalized = normalizeUnit(rawUnit);
      if (normalized) {
        unitsFound.add(normalized);
      } else if (rawUnit) {
        unitsFound.add('UNKNOWN:' + rawUnit);
      }
    }
  }

  if (unitsFound.size > 1) {
    const unitList = Array.from(unitsFound);
    for (const record of records) {
      if (record.tideLevel !== undefined && record.tideLevel !== null) {
        const rawUnit = record.tideUnit || '';
        const normalized = normalizeUnit(rawUnit);
        const currentUnit = normalized || ('UNKNOWN:' + rawUnit);
        if (unitsFound.size > 1) {
          issues.push({
            recordId: record.id,
            stationId: record.stationId,
            sampleTime: record.sampleTime,
            tideLevel: record.tideLevel,
            tideUnit: rawUnit,
            normalizedUnit: normalized,
            reason: `潮位单位混写：检测到 ${unitList.length} 种单位 (${unitList.join(', ')})，当前记录使用 "${rawUnit || '无单位'}"`
          });
        }
      }
    }
  }

  return {
    hasMismatch: unitsFound.size > 1,
    unitsFound: Array.from(unitsFound),
    affectedRecords: issues
  };
}

function detectOutliers(records, options = {}) {
  const result = [];
  const stationGroups = {};
  
  for (const record of records) {
    const key = record.stationId || 'unknown';
    if (!stationGroups[key]) {
      stationGroups[key] = [];
    }
    stationGroups[key].push(record);
  }

  for (const [stationId, stationRecords] of Object.entries(stationGroups)) {
    const numericFields = ['temperature', 'salinity', 'dissolvedOxygen', 'pH', 'chlorophyll', 'turbidity'];
    for (const field of numericFields) {
      const values = stationRecords
        .map(r => r[field])
        .filter(v => v !== undefined && v !== null && !isNaN(Number(v)))
        .map(Number);
      
      if (values.length < 3) continue;

      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const stdDev = Math.sqrt(values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length);
      const threshold = options.sigma || 2.0;

      for (const record of stationRecords) {
        const val = Number(record[field]);
        if (isNaN(val)) continue;
        const zScore = stdDev > 0 ? Math.abs((val - mean) / stdDev) : 0;
        if (zScore > threshold) {
          result.push({
            recordId: record.id,
            stationId: record.stationId,
            sampleTime: record.sampleTime,
            field: field,
            value: val,
            mean: parseFloat(mean.toFixed(3)),
            stdDev: parseFloat(stdDev.toFixed(3)),
            zScore: parseFloat(zScore.toFixed(3)),
            severity: zScore > threshold * 1.5 ? 'high' : 'medium',
            note: '疑似离群值（类噪声），保留但标记，不直接删除'
          });
        }
      }
    }
  }

  return result;
}

function parseLabReport(rawData, sourceInfo = {}) {
  const records = [];
  
  if (Array.isArray(rawData)) {
    for (const row of rawData) {
      const record = {
        id: uuidv4(),
        stationId: row.stationId || row['站点编号'] || row['站号'] || '',
        stationName: row.stationName || row['站点名称'] || row['站名'] || '',
        sampleTime: row.sampleTime || row['采样时间'] || row['时间'] || '',
        longitude: row.longitude !== undefined ? row.longitude : (row['经度'] !== undefined ? row['经度'] : null),
        latitude: row.latitude !== undefined ? row.latitude : (row['纬度'] !== undefined ? row['纬度'] : null),
        temperature: row.temperature !== undefined ? row.temperature : (row['水温'] !== undefined ? row['水温'] : null),
        salinity: row.salinity !== undefined ? row.salinity : (row['盐度'] !== undefined ? row['盐度'] : null),
        dissolvedOxygen: row.dissolvedOxygen !== undefined ? row.dissolvedOxygen : (row['溶解氧'] !== undefined ? row['溶解氧'] : null),
        pH: row.pH !== undefined ? row.pH : (row['pH值'] !== undefined ? row['pH值'] : null),
        chlorophyll: row.chlorophyll !== undefined ? row.chlorophyll : (row['叶绿素'] !== undefined ? row['叶绿素'] : null),
        turbidity: row.turbidity !== undefined ? row.turbidity : (row['浊度'] !== undefined ? row['浊度'] : null),
        tideLevel: row.tideLevel !== undefined ? row.tideLevel : (row['潮位'] !== undefined ? row['潮位'] : null),
        tideUnit: row.tideUnit || row['潮位单位'] || row['单位'] || '',
        source: sourceInfo.name || 'lab-report',
        sourceType: 'lab',
        importTime: new Date().toISOString(),
        isOutlier: false,
        outlierInfo: [],
        status: 'normal',
        pendingReasons: []
      };
      records.push(record);
    }
  }

  const tideCheck = detectTideUnitMismatch(records);
  const outliers = detectOutliers(records);

  const outlierMap = new Map();
  for (const o of outliers) {
    if (!outlierMap.has(o.recordId)) {
      outlierMap.set(o.recordId, []);
    }
    outlierMap.get(o.recordId).push(o);
  }

  for (const record of records) {
    if (outlierMap.has(record.id)) {
      record.isOutlier = true;
      record.outlierInfo = outlierMap.get(record.id);
    }
  }

  if (tideCheck.hasMismatch) {
    const affectedIds = new Set(tideCheck.affectedRecords.map(r => r.recordId));
    for (const record of records) {
      if (affectedIds.has(record.id)) {
        record.status = 'pending';
        const issue = tideCheck.affectedRecords.find(r => r.recordId === record.id);
        if (issue) {
          record.pendingReasons.push({
            type: 'tide_unit_mismatch',
            reason: issue.reason,
            detail: {
              tideLevel: issue.tideLevel,
              tideUnit: issue.tideUnit,
              normalizedUnit: issue.normalizedUnit
            }
          });
        }
      }
    }
  }

  return {
    records,
    qualityCheck: {
      tideUnitMismatch: tideCheck,
      outliers: outliers,
      totalOutliers: outliers.length,
      pendingConfirmRecords: records.filter(r => r.status === 'pending').length
    }
  };
}

function parseBoundarySample(sampleData) {
  return {
    id: uuidv4(),
    sampleId: sampleData.sampleId || sampleData['样本编号'] || '',
    stationId: sampleData.stationId || sampleData['站点编号'] || '',
    sampleTime: sampleData.sampleTime || sampleData['采样时间'] || '',
    description: sampleData.description || sampleData['描述'] || '',
    longitude: sampleData.longitude !== undefined ? sampleData.longitude : null,
    latitude: sampleData.latitude !== undefined ? sampleData.latitude : null,
    isBoundary: true,
    boundaryType: sampleData.boundaryType || sampleData['边界类型'] || 'edge',
    note: sampleData.note || sampleData['备注'] || '',
    source: sampleData.source || 'boundary-sample',
    importTime: new Date().toISOString()
  };
}

function parseVerbalNote(noteData) {
  return {
    id: uuidv4(),
    content: noteData.content || noteData['内容'] || noteData['说明'] || '',
    reporter: noteData.reporter || noteData['报告人'] || '老何',
    timestamp: noteData.timestamp || new Date().toISOString(),
    relatedRecords: noteData.relatedRecords || [],
    source: 'verbal-note',
    importTime: new Date().toISOString()
  };
}

function mergeData(existingData, newData, source) {
  const merged = {
    records: existingData.records ? [...existingData.records] : [],
    boundarySamples: existingData.boundarySamples ? [...existingData.boundarySamples] : [],
    verbalNotes: existingData.verbalNotes ? [...existingData.verbalNotes] : []
  };

  if (newData.records) {
    const existingIds = new Set(merged.records.map(r => r.id));
    const newRecords = newData.records.filter(r => !existingIds.has(r.id));
    merged.records.push(...newRecords);
    
    const updatedCount = newData.records.filter(r => existingIds.has(r.id)).length;
    if (updatedCount > 0) {
      for (const newRec of newData.records) {
        const idx = merged.records.findIndex(r => r.id === newRec.id);
        if (idx !== -1) {
          merged.records[idx] = { ...newRec };
        }
      }
    }
  }

  if (newData.boundarySamples) {
    merged.boundarySamples.push(...newData.boundarySamples);
  }

  if (newData.verbalNotes) {
    merged.verbalNotes.push(...newData.verbalNotes);
  }

  return merged;
}

function filterRecords(records, filters = {}) {
  let result = [...records];

  if (filters.stationId) {
    result = result.filter(r => r.stationId.includes(filters.stationId));
  }

  if (filters.status) {
    result = result.filter(r => r.status === filters.status);
  }

  if (filters.hasOutlier !== undefined) {
    result = result.filter(r => r.isOutlier === filters.hasOutlier);
  }

  if (filters.startTime) {
    result = result.filter(r => r.sampleTime >= filters.startTime);
  }

  if (filters.endTime) {
    result = result.filter(r => r.sampleTime <= filters.endTime);
  }

  return result;
}

function exportData(records, format = 'json') {
  if (format === 'json') {
    return JSON.stringify(records, null, 2);
  } else if (format === 'csv') {
    if (records.length === 0) return '';
    const headers = Object.keys(records[0]);
    const headerRow = headers.join(',');
    const dataRows = records.map(r => 
      headers.map(h => {
        const val = r[h];
        if (typeof val === 'object' && val !== null) {
          return `"${JSON.stringify(val).replace(/"/g, '""')}"`;
        }
        if (typeof val === 'string' && (val.includes(',') || val.includes('"'))) {
          return `"${val.replace(/"/g, '""')}"`;
        }
        return val !== undefined && val !== null ? String(val) : '';
      }).join(',')
    );
    return [headerRow, ...dataRows].join('\n');
  }
  return JSON.stringify(records, null, 2);
}

module.exports = {
  parseLabReport,
  parseBoundarySample,
  parseVerbalNote,
  detectTideUnitMismatch,
  detectOutliers,
  mergeData,
  filterRecords,
  exportData,
  normalizeUnit,
  TIDE_UNITS
};
