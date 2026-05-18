const LogParser = require('./parser');
const Statistics = require('./statistics');
const Reporter = require('./reporter');
const { EVENT_TYPES, LOG_PATTERNS } = require('./constants');

class QueueStats {
  constructor(options = {}) {
    this.verbose = options.verbose || false;
    this.outputFile = options.outputFile || null;
    this.format = options.format || 'console';
    
    this.parser = new LogParser({ verbose: this.verbose });
    this.statistics = new Statistics();
    this.reporter = new Reporter({ 
      verbose: this.verbose, 
      outputFile: this.outputFile 
    });
  }

  async processFiles(filePaths) {
    this.parser.reset();
    this.statistics.reset();

    const records = await this.parser.parseFiles(filePaths);

    records.forEach(record => {
      this.statistics.addRecord(record);
    });

    return this.generateReport();
  }

  generateReport() {
    const summary = this.statistics.getSummary();
    const detailed = this.statistics.getDetailedReport();
    const reportData = this.verbose ? detailed : summary;

    if (this.outputFile) {
      const jsonReport = this.reporter.generateJsonReport(
        summary, 
        this.verbose ? detailed.detailedRecords : null
      );
      this.reporter.saveReport(jsonReport);
    }

    if (this.format === 'json') {
      return reportData;
    }

    this.reporter.printConsole(
      summary, 
      this.verbose ? detailed.detailedRecords : null
    );

    return reportData;
  }

  reset() {
    this.parser.reset();
    this.statistics.reset();
  }
}

module.exports = {
  QueueStats,
  LogParser,
  Statistics,
  Reporter,
  EVENT_TYPES,
  LOG_PATTERNS
};
