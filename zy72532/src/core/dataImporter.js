const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');

function readCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  return parse(content, { columns: true, skip_empty_lines: true });
}

function readJSON(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content);
}

function importModelOutput(filePath) {
  const records = readCSV(filePath);
  return records.map(record => ({
    ...record,
    source: 'model_output',
    import_time: new Date().toISOString(),
    warnings: []
  }));
}

function importManualReview(filePath) {
  const records = readCSV(filePath);
  return records.map(record => ({
    ...record,
    source: 'manual_review',
    import_time: new Date().toISOString()
  }));
}

function importCorrectionLog(filePath) {
  return readJSON(filePath);
}

module.exports = {
  readCSV,
  readJSON,
  importModelOutput,
  importManualReview,
  importCorrectionLog
};
