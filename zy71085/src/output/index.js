'use strict'

const {
  printTerminalSummary,
  printHeader,
  printAppInfo,
  printSummary,
  printRiskSummary
} = require('./terminal')

const {
  writeJsonReport,
  buildJsonReport
} = require('./json')

const {
  writeMarkdownReport,
  buildMarkdownReport
} = require('./markdown')

module.exports = {
  printTerminalSummary,
  printHeader,
  printAppInfo,
  printSummary,
  printRiskSummary,
  writeJsonReport,
  buildJsonReport,
  writeMarkdownReport,
  buildMarkdownReport
}
