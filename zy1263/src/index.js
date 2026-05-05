const database = require('./database');
const importer = require('./importer');
const analyzer = require('./analyzer');
const exporter = require('./exporter');

module.exports = {
  database,
  importer,
  analyzer,
  exporter,
  
  initDb: database.initDb,
  closeDb: database.closeDb,
  createTables: database.createTables,
  getDb: database.getDb,
  
  importAll: importer.importAll,
  importServices: importer.importServices,
  importEndpoints: importer.importEndpoints,
  importTables: importer.importTables,
  importEvents: importer.importEvents,
  importCallEdges: importer.importCallEdges,
  
  runAllAnalyses: analyzer.runAllAnalyses,
  getReport: analyzer.getReport,
  
  exportReport: exporter.exportReport,
  compareReports: exporter.compareReports,
  generateMarkdownReport: exporter.generateMarkdownReport,
  generateJSONReport: exporter.generateJSONReport
};
