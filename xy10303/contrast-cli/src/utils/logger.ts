const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
};

export const logger = {
  success: (message: string) => {
    console.log(`${colors.green}✓ ${message}${colors.reset}`);
  },
  
  error: (message: string) => {
    console.error(`${colors.red}✗ ${message}${colors.reset}`);
  },
  
  warning: (message: string) => {
    console.warn(`${colors.yellow}⚠ ${message}${colors.reset}`);
  },
  
  info: (message: string) => {
    console.info(`${colors.blue}ℹ ${message}${colors.reset}`);
  },
  
  heading: (message: string) => {
    console.log(`\n${colors.bright}${colors.cyan}=== ${message} ===${colors.reset}\n`);
  },
  
  bullet: (message: string) => {
    console.log(`  ${colors.dim}•${colors.reset} ${message}`);
  },
  
  line: () => {
    console.log('');
  },
  
  table: (headers: string[], rows: any[][]) => {
    const colWidths = headers.map((h, i) => {
      const headerLen = h.length;
      const maxRowLen = Math.max(...rows.map(r => String(r[i] || '').length));
      return Math.max(headerLen, maxRowLen);
    });

    const formatRow = (cells: any[]) => {
      return cells.map((cell, i) => String(cell || '').padEnd(colWidths[i])).join('  ');
    };

    console.log(formatRow(headers));
    console.log(colWidths.map(w => '-'.repeat(w)).join('  '));
    rows.forEach(row => console.log(formatRow(row)));
  },

  json: (data: any, indent: number = 2) => {
    console.log(JSON.stringify(data, null, indent));
  }
};
