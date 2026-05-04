const Papa = require('papaparse');
const dayjs = require('dayjs');

const { toDateString } = require('../utils/date');

const REQUIRED_NOTES_COLUMNS = ['date', 'note'];
const OPTIONAL_NOTES_COLUMNS = ['tags', 'source', '熬夜', '喝酒', '出差', '生病', '压力', '咖啡', '酒精'];

function parseDailyNotesCSV(csvContent) {
  const result = Papa.parse(csvContent, {
    header: true,
    skipEmptyLines: true,
    trimHeaders: true,
  });

  if (result.errors.length > 0) {
    console.warn('CSV parsing warnings:', result.errors);
  }

  const headers = result.meta.fields || [];
  const hasRequired = REQUIRED_NOTES_COLUMNS.every(col => 
    headers.some(h => h.toLowerCase() === col.toLowerCase())
  );

  if (!hasRequired) {
    throw new Error(`CSV must contain columns: ${REQUIRED_NOTES_COLUMNS.join(', ')}`);
  }

  const notes = [];
  const errors = [];

  for (let i = 0; i < result.data.length; i++) {
    const row = result.data[i];
    const rowNumber = i + 2;

    try {
      const parsed = parseNoteRow(row, headers);
      if (parsed) {
        notes.push(parsed);
      }
    } catch (e) {
      errors.push({ row: rowNumber, error: e.message });
    }
  }

  return {
    notes,
    errors,
    totalRows: result.data.length,
    parsedCount: notes.length,
    errorCount: errors.length,
  };
}

function parseNoteRow(row, headers) {
  const dateValue = findColumnValue(row, headers, 'date');
  const noteValue = findColumnValue(row, headers, 'note') || '';
  const tagsValue = findColumnValue(row, headers, 'tags') || '';
  const sourceValue = findColumnValue(row, headers, 'source') || 'csv-import';

  if (!dateValue) {
    throw new Error('Missing date value');
  }

  const parsedDate = dayjs(dateValue);
  if (!parsedDate.isValid()) {
    throw new Error(`Invalid date format: ${dateValue}`);
  }

  const date = toDateString(parsedDate);

  const autoTags = [];
  
  const tagColumns = ['熬夜', '喝酒', '出差', '生病', '压力', '咖啡', '酒精', 'alcohol', 'coffee', 'travel', 'sick', 'stress', 'late'];
  for (const col of tagColumns) {
    const value = findColumnValue(row, headers, col);
    if (value && (value === '1' || value === 'true' || value.toLowerCase() === 'yes' || value === '✓')) {
      autoTags.push(mapToStandardTag(col));
    }
  }

  let allTags = [];
  if (tagsValue) {
    const csvTags = tagsValue.split(/[,，\s]+/).filter(Boolean);
    allTags = [...csvTags];
  }
  allTags = [...new Set([...allTags, ...autoTags])];

  return {
    id: `note_${date}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    date,
    tags: allTags.join(','),
    tagsArray: allTags,
    note: noteValue,
    source: sourceValue,
  };
}

function findColumnValue(row, headers, columnName) {
  const lowerName = columnName.toLowerCase();
  const matchingHeader = headers.find(h => h.toLowerCase() === lowerName);
  
  if (matchingHeader) {
    return row[matchingHeader]?.toString().trim() || '';
  }
  
  return row[columnName]?.toString().trim() || '';
}

function mapToStandardTag(tag) {
  const tagMap = {
    '熬夜': '熬夜',
    '喝酒': '喝酒',
    '出差': '出差',
    '生病': '生病',
    '压力': '压力',
    '咖啡': '咖啡',
    '酒精': '喝酒',
    'alcohol': '喝酒',
    'coffee': '咖啡',
    'travel': '出差',
    'sick': '生病',
    'stress': '压力',
    'late': '熬夜',
  };
  
  return tagMap[tag.toLowerCase()] || tag;
}

function genericCSVParser(csvContent, options = {}) {
  const result = Papa.parse(csvContent, {
    header: options.header !== false,
    skipEmptyLines: true,
    dynamicTyping: options.dynamicTyping !== false,
    ...options,
  });

  return {
    data: result.data,
    errors: result.errors,
    meta: result.meta,
  };
}

module.exports = {
  parseDailyNotesCSV,
  genericCSVParser,
};
