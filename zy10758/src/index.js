const parser = require('./parser');
const validator = require('./validator');
const aggregator = require('./aggregator');
const reporter = require('./reporter');

async function analyzeMetrics(inputPath, options = {}) {
  const {
    changedMetrics = [],
    changeType = '口径定义变更',
    outputDir = './output',
    reportName = 'impact_report'
  } = options;

  let parsedFiles;

  const fs = require('fs');
  const path = require('path');
  const stat = fs.statSync(inputPath);

  if (stat.isDirectory()) {
    parsedFiles = await parser.parseDirectory(inputPath);
  } else {
    parsedFiles = [await parser.parseCSVFile(inputPath)];
  }

  const validationResult = validator.validateAll(parsedFiles, {
    changedMetrics,
    changeType
  });

  const aggregatedResult = aggregator.aggregateAll(validationResult);

  const reports = reporter.generateAllReports(aggregatedResult, outputDir, reportName);

  reporter.printConsoleSummary(aggregatedResult);

  return {
    parsed: parsedFiles,
    validated: validationResult,
    aggregated: aggregatedResult,
    reports
  };
}

module.exports = {
  analyzeMetrics,
  parser,
  validator,
  aggregator,
  reporter
};
