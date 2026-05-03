import { CONFLICT_SEVERITY } from '../types.js';

const COLORS = {
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
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m'
};

const SEVERITY_STYLES = {
  [CONFLICT_SEVERITY.CRITICAL]: { color: COLORS.red, bg: COLORS.bgRed, icon: '✗', label: '严重' },
  [CONFLICT_SEVERITY.HIGH]: { color: COLORS.magenta, bg: '', icon: '⚠', label: '高优先级' },
  [CONFLICT_SEVERITY.MEDIUM]: { color: COLORS.yellow, bg: '', icon: '⚡', label: '中等' },
  [CONFLICT_SEVERITY.LOW]: { color: COLORS.cyan, bg: '', icon: 'ℹ', label: '信息' }
};

export class ConsolePrinter {
  constructor(options = {}) {
    this.colorsEnabled = options.colors !== false;
    this.verbose = options.verbose || false;
  }

  color(text, colorCode) {
    if (!this.colorsEnabled || !colorCode) return text;
    return `${colorCode}${text}${COLORS.reset}`;
  }

  bold(text) {
    return this.color(text, COLORS.bright);
  }

  header(text) {
    console.log('');
    console.log(this.bold(this.color('═'.repeat(60), COLORS.blue)));
    console.log(this.bold(this.color(`  ${text}`, COLORS.blue)));
    console.log(this.bold(this.color('═'.repeat(60), COLORS.blue)));
    console.log('');
  }

  subheader(text) {
    console.log('');
    console.log(this.color(`── ${text} ──`, COLORS.cyan));
    console.log('');
  }

  severityLabel(severity) {
    const style = SEVERITY_STYLES[severity] || SEVERITY_STYLES[CONFLICT_SEVERITY.LOW];
    return this.color(`[${style.label}]`, style.color);
  }

  printValidationResult(result) {
    const { summary, conflicts, stats, parseErrors } = result;

    this.header('座位表检查结果');

    if (parseErrors.length > 0) {
      this.subheader('解析错误');
      for (const error of parseErrors) {
        const lineInfo = error.lineNumber ? ` (行 ${error.lineNumber})` : '';
        console.log(`  ${this.color('✗', COLORS.red)} ${error.guest || error.table || ''}${lineInfo}: ${error.error || error.message}`);
      }
    }

    this.subheader('检查摘要');
    
    for (const msg of summary.messages) {
      const prefix = summary.status === 'pass' ? this.color('✓', COLORS.green) : this.color('✗', COLORS.red);
      console.log(`  ${prefix} ${msg}`);
    }

    console.log('');
    console.log(`  统计:`);
    console.log(`    严重冲突: ${this.color(String(stats[CONFLICT_SEVERITY.CRITICAL]), COLORS.red)}`);
    console.log(`    高优先级: ${this.color(String(stats[CONFLICT_SEVERITY.HIGH]), COLORS.magenta)}`);
    console.log(`    中等优先级: ${this.color(String(stats[CONFLICT_SEVERITY.MEDIUM]), COLORS.yellow)}`);
    console.log(`    信息提示: ${this.color(String(stats[CONFLICT_SEVERITY.LOW]), COLORS.cyan)}`);
    console.log(`    总计: ${this.bold(String(stats.total))}`);

    if (conflicts.length > 0) {
      this.subheader('详细冲突列表');
      
      const grouped = {
        critical: conflicts.filter(c => c.severity === CONFLICT_SEVERITY.CRITICAL),
        high: conflicts.filter(c => c.severity === CONFLICT_SEVERITY.HIGH),
        medium: conflicts.filter(c => c.severity === CONFLICT_SEVERITY.MEDIUM),
        low: conflicts.filter(c => c.severity === CONFLICT_SEVERITY.LOW)
      };

      for (const [severity, items] of Object.entries(grouped)) {
        if (items.length === 0) continue;

        const style = SEVERITY_STYLES[severity];
        console.log(`\n  ${this.color(`${style.icon} ${style.label}冲突 (${items.length}项)`, style.color)}`);
        console.log('  ' + '─'.repeat(50));

        for (const [index, conflict] of items.entries()) {
          console.log(`\n  ${index + 1}. ${this.bold(conflict.message)}`);
          
          if (conflict.guest) {
            console.log(`     宾客: ${conflict.guest}`);
          }
          if (conflict.tableNumber) {
            console.log(`     桌号: ${conflict.tableNumber}`);
          }
          if (conflict.lineNumber) {
            console.log(`     行号: ${conflict.lineNumber}`);
          }

          if (conflict.suggestions && conflict.suggestions.length > 0) {
            console.log(`\n     建议:`);
            for (const suggestion of conflict.suggestions) {
              console.log(`       • ${suggestion}`);
            }
          }

          if (this.verbose && conflict.guests) {
            console.log(`\n     涉及宾客:`);
            for (const g of conflict.guests) {
              const tableInfo = g.tableNumber ? ` (桌${g.tableNumber})` : '';
              console.log(`       - ${g.name}${tableInfo}`);
            }
          }
        }
      }
    }

    console.log('');
    console.log(this.color('═'.repeat(60), COLORS.blue));
    console.log('');

    return summary.status;
  }

  printSuggestions(result) {
    const { suggestions, seatPlan, criticalCount, highCount, mediumCount, infoCount } = result;

    this.header('调桌建议');

    console.log(`  冲突统计:`);
    if (criticalCount > 0) console.log(`    ${this.color(`严重: ${criticalCount}`, COLORS.red)}`);
    if (highCount > 0) console.log(`    ${this.color(`高优先级: ${highCount}`, COLORS.magenta)}`);
    if (mediumCount > 0) console.log(`    ${this.color(`中等: ${mediumCount}`, COLORS.yellow)}`);
    if (infoCount > 0) console.log(`    ${this.color(`信息提示: ${infoCount}`, COLORS.cyan)}`);

    if (suggestions.length === 0) {
      console.log('');
      console.log(this.color('  ✓ 无需要调整的项，座位表已通过所有检查！', COLORS.green));
    } else {
      this.subheader('调整建议（按优先级排序）');

      const sorted = [...suggestions].sort((a, b) => a.priority - b.priority);

      for (const [index, suggestion] of sorted.entries()) {
        console.log(`\n  ${this.bold(`${index + 1}. [${suggestion.category}] ${suggestion.title}`)}`);
        console.log(`     ${suggestion.description}`);
        
        if (suggestion.actions && suggestion.actions.length > 0) {
          console.log(`\n     可执行方案:`);
          for (const [i, action] of suggestion.actions.entries()) {
            console.log(`       ${i + 1}. ${action}`);
          }
        }
      }
    }

    this.subheader('当前座位概览');
    console.log(`  总桌数: ${seatPlan.tables.length}`);
    console.log(`  总座位: ${seatPlan.totalSeats}`);
    console.log(`  总宾客: ${seatPlan.totalGuests}`);
    console.log(`  已入座: ${seatPlan.seatedCount}`);
    console.log(`  未入座: ${this.color(String(seatPlan.unseatedCount), seatPlan.unseatedCount > 0 ? COLORS.yellow : COLORS.green)}`);

    if (seatPlan.issues && seatPlan.issues.length > 0) {
      console.log(`\n  ${this.color('待解决问题:', COLORS.yellow)}`);
      for (const issue of seatPlan.issues) {
        console.log(`    • 桌${issue.tableNumber}: ${issue.issue} - ${issue.detail}`);
      }
    }

    console.log('');
    console.log(this.color('═'.repeat(60), COLORS.blue));
    console.log('');
  }

  printExportResult(result) {
    const { outputDir, files, summary } = result;

    this.header('导出结果');

    console.log(`  输出目录: ${this.bold(outputDir)}`);
    console.log('');
    console.log(`  统计:`);
    console.log(`    总宾客: ${summary.totalGuests}`);
    console.log(`    总桌数: ${summary.totalTables}`);
    console.log(`    已入座: ${summary.seatedGuests}`);
    console.log(`    未入座: ${summary.unseatedGuests}`);

    this.subheader('已生成文件');

    for (const file of files) {
      console.log(`\n  ${this.color('✓', COLORS.green)} ${this.bold(file.name)}`);
      console.log(`    描述: ${file.description}`);
      console.log(`    路径: ${file.path}`);
      
      if (file.tables !== undefined) {
        console.log(`    桌数: ${file.tables}`);
      }
      if (file.seatedGuests !== undefined) {
        console.log(`    已入座宾客: ${file.seatedGuests}`);
      }
      if (file.dietaryGuests !== undefined) {
        console.log(`    有饮食限制宾客: ${file.dietaryGuests}`);
      }
    }

    console.log('');
    console.log(this.color('═'.repeat(60), COLORS.blue));
    console.log('');
  }

  printHelp() {
    console.log('');
    console.log(this.bold('婚礼座位表和宾客关系冲突检查器'));
    console.log('');
    console.log('用法:');
    console.log(`  ${this.color('node src/cli/index.js', COLORS.cyan)} ${this.color('<command>', COLORS.yellow)} [options]`);
    console.log('');
    console.log('命令:');
    console.log(`  ${this.color('validate', COLORS.green)}    检查座位表冲突，输出风险列表`);
    console.log(`  ${this.color('suggest', COLORS.green)}     生成调桌建议`);
    console.log(`  ${this.color('export', COLORS.green)}      导出座位表、厨房注意事项和打印卡片`);
    console.log('');
    console.log('选项:');
    console.log(`  ${this.color('--guests, -g <path>', COLORS.yellow)}   指定宾客名单 CSV 文件路径`);
    console.log(`  ${this.color('--tables, -t <path>', COLORS.yellow)}   指定桌位配置 JSON 文件路径`);
    console.log(`  ${this.color('--output, -o <path>', COLORS.yellow)}   指定输出目录（仅 export 命令）`);
    console.log(`  ${this.color('--config, -c <path>', COLORS.yellow)}   指定配置文件路径`);
    console.log(`  ${this.color('--verbose, -v', COLORS.yellow)}          显示详细信息`);
    console.log(`  ${this.color('--no-colors', COLORS.yellow)}            禁用彩色输出`);
    console.log(`  ${this.color('--help, -h', COLORS.yellow)}             显示帮助信息`);
    console.log('');
    console.log('示例:');
    console.log(`  ${this.color('node src/cli/index.js validate', COLORS.cyan)}`);
    console.log(`  ${this.color('node src/cli/index.js suggest --guests my-guests.csv', COLORS.cyan)}`);
    console.log(`  ${this.color('node src/cli/index.js export -o ./result/', COLORS.cyan)}`);
    console.log('');
    console.log('宾客字段 (guests.csv):');
    console.log('  必填: 姓名, 分组, 关系标签');
    console.log('  可选: 同行人, 忌口/过敏, 行动不便, 儿童, 是否需要安静区, 优先同桌, 避免同桌, VIP, 桌号');
    console.log('');
    console.log('桌位字段 (tables.json):');
    console.log('  必填: 桌号, 容量');
    console.log('  可选: 区域, 离舞台距离, 离音箱距离, 离出口距离, 是否儿童友好, 是否安静区');
    console.log('');
  }

  printError(message, error) {
    console.error('');
    console.error(this.color('错误', COLORS.bgRed), this.bold(message));
    if (error) {
      console.error('');
      if (error.message) {
        console.error(`  ${error.message}`);
      }
      if (this.verbose && error.stack) {
        console.error('');
        console.error(this.dim(error.stack));
      }
    }
    console.error('');
  }

  printInfo(message) {
    console.log(this.color(`ℹ ${message}`, COLORS.cyan));
  }

  printSuccess(message) {
    console.log(this.color(`✓ ${message}`, COLORS.green));
  }
}

export const printer = new ConsolePrinter();

export default printer;
