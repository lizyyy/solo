'use strict'

const config = require('./config/constants')
const parser = require('./parser')
const diff = require('./diff')
const source = require('./source')
const risk = require('./risk')
const output = require('./output')
const cli = require('./cli')

module.exports = {
  config,
  parser,
  diff,
  source,
  risk,
  output,
  cli,
  runCLI: cli.runCLI
}
