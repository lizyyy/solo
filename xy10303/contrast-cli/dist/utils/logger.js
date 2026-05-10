"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
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
exports.logger = {
    success: (message) => {
        console.log(`${colors.green}✓ ${message}${colors.reset}`);
    },
    error: (message) => {
        console.error(`${colors.red}✗ ${message}${colors.reset}`);
    },
    warning: (message) => {
        console.warn(`${colors.yellow}⚠ ${message}${colors.reset}`);
    },
    info: (message) => {
        console.info(`${colors.blue}ℹ ${message}${colors.reset}`);
    },
    heading: (message) => {
        console.log(`\n${colors.bright}${colors.cyan}=== ${message} ===${colors.reset}\n`);
    },
    bullet: (message) => {
        console.log(`  ${colors.dim}•${colors.reset} ${message}`);
    },
    line: () => {
        console.log('');
    },
    table: (headers, rows) => {
        const colWidths = headers.map((h, i) => {
            const headerLen = h.length;
            const maxRowLen = Math.max(...rows.map(r => String(r[i] || '').length));
            return Math.max(headerLen, maxRowLen);
        });
        const formatRow = (cells) => {
            return cells.map((cell, i) => String(cell || '').padEnd(colWidths[i])).join('  ');
        };
        console.log(formatRow(headers));
        console.log(colWidths.map(w => '-'.repeat(w)).join('  '));
        rows.forEach(row => console.log(formatRow(row)));
    },
    json: (data, indent = 2) => {
        console.log(JSON.stringify(data, null, indent));
    }
};
