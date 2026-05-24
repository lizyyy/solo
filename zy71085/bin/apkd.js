#!/usr/bin/env node

'use strict'

process.title = 'android-permission-diff'

const { runCLI } = require('../src/cli')

runCLI(process.argv).then((exitCode) => {
  process.exitCode = exitCode
}).catch((err) => {
  console.error('Fatal error:', err.message)
  if (process.env.DEBUG) {
    console.error(err.stack)
  }
  process.exitCode = 1
})
