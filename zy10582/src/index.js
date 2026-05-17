const path = require('path');
const { DEFAULT_CONFIG } = require('./config');
const BundleScanner = require('./scanner');
const BundleAnalyzer = require('./analyzer');
const HistoryManager = require('./history');
const Reporter = require('./reporter');
const { logError, logSuccess } = require('./utils');

async function runBundleAnalyzer(options = {}) {
  const config = {
    ...DEFAULT_CONFIG,
    ...options,
    inputDir: options.inputDir ? path.resolve(options.inputDir) : DEFAULT_CONFIG.inputDir,
    outputDir: options.outputDir ? path.resolve(options.outputDir) : DEFAULT_CONFIG.outputDir
  };

  try {
    const scanner = new BundleScanner(config);
    const scanResult = await scanner.scan();

    const analyzer = new BundleAnalyzer(config);
    const analysisResult = analyzer.analyze(scanResult);

    const historyManager = new HistoryManager(config);
    const comparison = historyManager.compare(analysisResult);

    historyManager.save(analysisResult);

    const reporter = new Reporter(config);
    const reportPaths = reporter.generateAll(analysisResult, comparison);

    return {
      success: true,
      result: analysisResult,
      comparison,
      reports: reportPaths
    };
  } catch (error) {
    logError('分析过程出错:', error);
    throw error;
  }
}

module.exports = {
  runBundleAnalyzer,
  BundleScanner,
  BundleAnalyzer,
  HistoryManager,
  Reporter
};
