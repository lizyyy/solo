const { normalizeUrl, compareUrls, checkUrlParams, extractRedirectUriFromAuthUrl } = require('./urlNormalizer');
const { validateConfig, compareEnvironments, attributeErrors, categorizeError, getSuggestion, matchErrorSample, getUriValue } = require('./validator');
const { generateTerminalSummary, generateJsonReport, generateReadableReport, generateHtmlReport } = require('./reporter');
const { parseJsonWithSource, parseErrorSamplesWithSource } = require('./jsonLineParser');

module.exports = {
  normalizeUrl,
  compareUrls,
  checkUrlParams,
  extractRedirectUriFromAuthUrl,
  validateConfig,
  compareEnvironments,
  attributeErrors,
  categorizeError,
  getSuggestion,
  matchErrorSample,
  getUriValue,
  generateTerminalSummary,
  generateJsonReport,
  generateReadableReport,
  generateHtmlReport,
  parseJsonWithSource,
  parseErrorSamplesWithSource
};
