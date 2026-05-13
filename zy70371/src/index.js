const { RULES, generateMatchId, applyReplacement, getRiskLevel, getRuleDescription } = require('./rules');
const { scanFile, scanDirectory, findFilesRecursive } = require('./scanner');
const StateManager = require('./stateManager');
const { generateSummary, canPublish, printTerminalReport } = require('./reporter');

module.exports = {
  RULES,
  scanFile,
  scanDirectory,
  findFilesRecursive,
  StateManager,
  generateSummary,
  canPublish,
  printTerminalReport,
  generateMatchId,
  applyReplacement,
  getRiskLevel,
  getRuleDescription
};
