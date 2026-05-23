import fs from 'fs';
import path from 'path';

export function loadConfig(options) {
  const config = {
    orders: options.orders || './data/orders.csv',
    leaders: options.leaders || './data/leaders.csv',
    refunds: options.refunds || './data/refunds.csv',
    commission: options.commission || './data/commission.json',
    output: options.output || './output',
    append: options.append || false,
    force: options.force || false,
    formats: (options.format || 'terminal,json,csv,report').split(',').map(f => f.trim()),
    quiet: options.quiet || false
  };

  return config;
}

export function checkOutputConflicts(outputDir, config) {
  const files = [
    'split-summary.json',
    'split-details.csv',
    'leader-commission.csv',
    'platform-fees.csv',
    'refund-offsets.csv',
    'errors.json',
    'report.md'
  ];

  const conflicts = [];
  files.forEach(file => {
    const filePath = path.join(outputDir, file);
    if (fs.existsSync(filePath)) {
      conflicts.push(file);
    }
  });

  return conflicts;
}

export function resolveFileConflict(filePath, config) {
  if (config.force) {
    return 'overwrite';
  }
  if (config.append) {
    return 'append';
  }
  return 'error';
}
