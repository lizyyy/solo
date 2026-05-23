const fs = require('fs');
const path = require('path');

const dirs = [
  'src/models',
  'src/commands',
  'src/utils',
  'src/parsers',
  'data/imports',
  'data/exports',
  'data/reports',
  'data/history',
  'samples',
  'tests',
  'demo'
];

dirs.forEach(dir => {
  const fullPath = path.join(__dirname, dir);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
    console.log(`Created: ${fullPath}`);
  }
});
