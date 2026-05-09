import { table } from 'table';

export const colors = {
  red: (text: string) => `\x1b[31m${text}\x1b[0m`,
  green: (text: string) => `\x1b[32m${text}\x1b[0m`,
  yellow: (text: string) => `\x1b[33m${text}\x1b[0m`,
  blue: (text: string) => `\x1b[34m${text}\x1b[0m`,
  magenta: (text: string) => `\x1b[35m${text}\x1b[0m`,
  cyan: (text: string) => `\x1b[36m${text}\x1b[0m`,
  gray: (text: string) => `\x1b[90m${text}\x1b[0m`,
  bold: (text: string) => `\x1b[1m${text}\x1b[0m`,
  dim: (text: string) => `\x1b[2m${text}\x1b[0m`
};

export function printTable(rows: string[][], header?: string[]): void {
  if (header) {
    rows.unshift(header);
  }
  const config = {
    border: {
      topBody: '─',
      topJoin: '┬',
      topLeft: '┌',
      topRight: '┐',
      bottomBody: '─',
      bottomJoin: '┴',
      bottomLeft: '└',
      bottomRight: '┘',
      bodyLeft: '│',
      bodyRight: '│',
      bodyJoin: '│',
      joinBody: '─',
      joinLeft: '├',
      joinRight: '┤',
      joinJoin: '┼'
    }
  };
  console.log(table(rows, config));
}

export function printSuccess(message: string): void {
  console.log(`${colors.green('✅')} ${message}`);
}

export function printError(message: string): void {
  console.error(`${colors.red('❌')} ${message}`);
}

export function printWarning(message: string): void {
  console.warn(`${colors.yellow('⚠️')} ${message}`);
}

export function printInfo(message: string): void {
  console.log(`${colors.blue('ℹ️')} ${message}`);
}

export function printHeader(title: string): void {
  console.log('');
  console.log(colors.bold(colors.cyan(title)));
  console.log(colors.cyan('─'.repeat(title.length * 2)));
}

export function getSeverityColor(severity: string): (text: string) => string {
  switch (severity) {
    case 'critical': return colors.red;
    case 'high': return colors.yellow;
    case 'medium': return colors.magenta;
    case 'low': return colors.blue;
    default: return colors.gray;
  }
}

export function getDiffTypeLabel(type: string): string {
  switch (type) {
    case 'added': return colors.green('➕ 新增');
    case 'removed': return colors.red('➖ 删除');
    case 'modified': return colors.yellow('🔄 修改');
    case 'unchanged': return colors.gray('✅ 一致');
    default: return type;
  }
}
