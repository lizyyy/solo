'use strict';

const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

function readCsv(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return parse(raw, { columns: true, skip_empty_lines: true, trim: true });
}

function loadAll(dataDir) {
  return Promise.resolve().then(() => {
    const customers = readJson(path.join(dataDir, 'customers.json'));
    const rules = readJson(path.join(dataDir, 'rules.json'));
    const purchases = readCsv(path.join(dataDir, 'purchases.csv'));
    return {
      customers,
      rules,
      purchases,
      sessions: new Map()
    };
  });
}

module.exports = { loadAll, readJson, readCsv };
