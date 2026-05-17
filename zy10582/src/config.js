const path = require('path');

const DEFAULT_CONFIG = {
  inputDir: process.cwd(),
  outputDir: path.join(process.cwd(), 'bundle-report'),
  buildPatterns: ['**/dist/**/*.js', '**/build/**/*.js', '**/*.js.map'],
  excludePatterns: ['**/node_modules/**', '**/*.min.js', '**/vendor*.js'],
  reportName: 'bundle-analysis',
  keepHistory: true,
  historyLimit: 10,
  gzip: true,
  sourceMap: true
};

const FILE_SIZE_THRESHOLDS = {
  warning: 100 * 1024,
  error: 500 * 1024
};

const DEPENDENCY_PATTERNS = {
  NODE_MODULES: /node_modules[\\/](@[^\\/]+[\\/])?[^\\/]+/,
  PACKAGE_NAME: /node_modules[\\/](@[^\\/]+[\\/][^\\/]+|[^\\/]+)/
};

module.exports = {
  DEFAULT_CONFIG,
  FILE_SIZE_THRESHOLDS,
  DEPENDENCY_PATTERNS
};
