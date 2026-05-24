const { processCSV, generateFixedCSV, EXIT_CODES } = require('./csv-fixer');
const { detectEncoding, convertToUTF8, validateEncodingConversion, COMMON_ENCODINGS } = require('./encoding-detector');
const { inferDelimiter, parseCSVLine, parseCSVLazy, detectDuplicateHeaders, applyHeaderAliases, COMMON_DELIMITERS } = require('./csv-parser');
const { generateTerminalSummary, generateJSONReport, generateMarkdownReport, writeReports } = require('./report-generator');

module.exports = {
  processCSV,
  generateFixedCSV,
  EXIT_CODES,
  detectEncoding,
  convertToUTF8,
  validateEncodingConversion,
  COMMON_ENCODINGS,
  inferDelimiter,
  parseCSVLine,
  parseCSVLazy,
  detectDuplicateHeaders,
  applyHeaderAliases,
  COMMON_DELIMITERS,
  generateTerminalSummary,
  generateJSONReport,
  generateMarkdownReport,
  writeReports
};
