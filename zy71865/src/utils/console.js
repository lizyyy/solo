function printHeader(title) {
  const line = '='.repeat(Math.max(title.length + 4, 50));
  console.log('\n' + line);
  console.log(`  ${title}`);
  console.log(line + '\n');
}

function printSubHeader(title) {
  const line = '-'.repeat(Math.max(title.length + 2, 40));
  console.log('\n' + line);
  console.log(` ${title}`);
  console.log(line);
}

function printSuccess(message) {
  console.log(`✓ ${message}`);
}

function printError(message) {
  console.log(`✗ ${message}`);
}

function printWarning(message) {
  console.log(`⚠ ${message}`);
}

function printInfo(message) {
  console.log(`ℹ ${message}`);
}

function printKeyValue(key, value, indent = 0) {
  const pad = '  '.repeat(indent);
  console.log(`${pad}${key}: ${value !== undefined && value !== null ? value : '-'}`);
}

function printProgress(label, current, total) {
  const percent = total > 0 ? Math.round((current / total) * 100) : 0;
  const barLength = 20;
  const filled = Math.round((current / total) * barLength);
  const bar = '█'.repeat(filled) + '░'.repeat(barLength - filled);
  console.log(`  ${label}: [${bar}] ${percent}% (${current}/${total})`);
}

function printTable(headers, rows) {
  const colWidths = headers.map((h, i) => {
    let max = h.length;
    rows.forEach(row => {
      const val = String(row[i] !== undefined && row[i] !== null ? row[i] : '');
      max = Math.max(max, val.length);
    });
    return max + 2;
  });

  let headerLine = '|';
  headers.forEach((h, i) => {
    headerLine += ` ${h.padEnd(colWidths[i] - 1)}|`;
  });

  const separator = '+' + colWidths.map(w => '-'.repeat(w)).join('+') + '+';

  console.log(separator);
  console.log(headerLine);
  console.log(separator);

  rows.forEach(row => {
    let rowLine = '|';
    row.forEach((val, i) => {
      const strVal = String(val !== undefined && val !== null ? val : '');
      rowLine += ` ${strVal.padEnd(colWidths[i] - 1)}|`;
    });
    console.log(rowLine);
  });

  console.log(separator);
}

function printDiff(diff) {
  if (!diff || !Array.isArray(diff)) return;
  
  diff.forEach(part => {
    const prefix = part.added ? '+' : part.removed ? '-' : ' ';
    const lines = part.value.split('\n').filter(l => l.trim());
    lines.forEach(line => {
      if (part.added) {
        console.log(`  \x1b[32m${prefix} ${line}\x1b[0m`);
      } else if (part.removed) {
        console.log(`  \x1b[31m${prefix} ${line}\x1b[0m`);
      } else {
        console.log(`  ${prefix} ${line}`);
      }
    });
  });
}

module.exports = {
  printHeader,
  printSubHeader,
  printSuccess,
  printError,
  printWarning,
  printInfo,
  printKeyValue,
  printProgress,
  printTable,
  printDiff
};
