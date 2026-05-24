const probe = require('../modules/probe');
const rules = require('../modules/rules');
const risks = require('../modules/risks');
const planner = require('../modules/planner');
const reporter = require('../modules/reporter');

module.exports = {
  probe,
  rules,
  risks,
  planner,
  reporter,
  generatePlan: planner.generatePlan,
  detectRisks: risks.detectAllRisks,
  exportReport: reporter.exportMarkdown,
  exportJSON: reporter.exportJSON
};
