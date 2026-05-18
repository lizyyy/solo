#!/usr/bin/env node

const { CLI } = require('../src/cli.js');

const cli = new CLI();
cli.run(process.argv.slice(2));
