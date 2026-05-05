'use strict';

const Scanner = require('./scanner');
const ReportGenerator = require('./report');
const BaselineManager = require('./baseline');
const SeedProject = require('./seed');
const DatabaseChecker = require('./database-checker');

module.exports = {
  Scanner,
  ReportGenerator,
  BaselineManager,
  SeedProject,
  DatabaseChecker,
  scan: async (options) => {
    const scanner = new Scanner(options);
    return scanner.scan();
  }
};
