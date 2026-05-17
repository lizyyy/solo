const { TraceParser } = require('./parser');
const { AttributeAnalyzer } = require('./analyzer');
const { Reporter } = require('./reporter');

async function analyzeFile(filePath, options = {}) {
  const parser = new TraceParser(options);
  const parsedData = await parser.parseFile(filePath);

  const analyzer = new AttributeAnalyzer(options);
  const analysisResult = analyzer.analyze(parsedData);

  const reporter = new Reporter(analysisResult, options);

  return {
    parsed: parsedData,
    analysis: analysisResult,
    reporter,
    reports: reporter.generateAllReports()
  };
}

module.exports = {
  TraceParser,
  AttributeAnalyzer,
  Reporter,
  analyzeFile
};
