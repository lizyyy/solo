import chalk from 'chalk';
import Table from 'cli-table3';

export class Logger {
  constructor(verbose = false) {
    this.verbose = verbose;
    this.logs = [];
  }

  info(message) {
    this.logs.push({ level: 'info', message, timestamp: new Date() });
    console.log(chalk.blue(`[INFO] ${message}`));
  }

  success(message) {
    this.logs.push({ level: 'success', message, timestamp: new Date() });
    console.log(chalk.green(`[SUCCESS] ${message}`));
  }

  warn(message) {
    this.logs.push({ level: 'warn', message, timestamp: new Date() });
    console.log(chalk.yellow(`[WARN] ${message}`));
  }

  error(message) {
    this.logs.push({ level: 'error', message, timestamp: new Date() });
    console.log(chalk.red(`[ERROR] ${message}`));
  }

  detail(message) {
    this.logs.push({ level: 'detail', message, timestamp: new Date() });
    if (this.verbose) {
      console.log(chalk.gray(`  → ${message}`));
    }
  }

  printSummary(results) {
    console.log('\n' + chalk.bold('='.repeat(60)));
    console.log(chalk.bold('合同版本目录重签版本比对 - 执行摘要'));
    console.log(chalk.bold('='.repeat(60)) + '\n');

    const table = new Table({
      head: [chalk.cyan('类别'), chalk.cyan('数量'), chalk.cyan('说明')],
      colWidths: [20, 10, 30],
    });

    table.push(['合同总数', results.totalContracts || 0, '参与比对的合同数量']);
    table.push(['比对一致', results.matched || 0, chalk.green('新旧版本无差异')]);
    table.push(['存在差异', results.differences || 0, chalk.yellow('需要人工审核')]);
    table.push(['附件漏传', results.missingAttachments || 0, chalk.red('必须补充的附件')]);
    table.push(['签章位置变化', results.signatureChanges || 0, chalk.magenta('需要重新确认')]);
    table.push(['处理异常', results.errors || 0, chalk.red('处理失败的合同')]);

    console.log(table.toString());
    console.log();

    if (results.contracts && results.contracts.length > 0) {
      this.printContractDetails(results.contracts);
    }

    console.log(chalk.bold('\n' + '='.repeat(60)));
  }

  printContractDetails(contracts) {
    console.log(chalk.bold('合同详细处理结果：'));
    console.log();

    contracts.forEach((contract, index) => {
      const statusColor = this.getStatusColor(contract.status);
      console.log(`${index + 1}. ${contract.contractNo} - ${statusColor(contract.contractName)}`);
      
      if (this.verbose || contract.status !== 'matched') {
        console.log(`   合同类型: ${contract.contractType}`);
        console.log(`   处理状态: ${statusColor(this.getStatusText(contract.status))}`);
        
        if (contract.differences && contract.differences.length > 0) {
          console.log(`   差异项:`);
          contract.differences.forEach(diff => {
            console.log(`     - ${diff.fieldName}: ${chalk.yellow(diff.oldValue)} → ${chalk.green(diff.newValue)}`);
          });
        }

        if (contract.missingAttachments && contract.missingAttachments.length > 0) {
          console.log(`   漏传附件:`);
          contract.missingAttachments.forEach(att => {
            console.log(`     - ${chalk.red(att.name)} (${att.description})`);
          });
        }

        if (contract.signatureChanges && contract.signatureChanges.length > 0) {
          console.log(`   签章位置变化:`);
          contract.signatureChanges.forEach(sig => {
            console.log(`     - ${chalk.magenta(sig.positionName)}: ${sig.oldPage}页 → ${sig.newPage}页`);
          });
        }

        if (contract.error) {
          console.log(`   错误信息: ${chalk.red(contract.error)}`);
        }
        console.log();
      }
    });
  }

  getStatusColor(status) {
    const colors = {
      matched: chalk.green,
      difference: chalk.yellow,
      missing_attachment: chalk.red,
      signature_change: chalk.magenta,
      error: chalk.red,
    };
    return colors[status] || chalk.gray;
  }

  getStatusText(status) {
    const texts = {
      matched: '比对一致',
      difference: '存在差异',
      missing_attachment: '附件漏传',
      signature_change: '签章位置变化',
      error: '处理异常',
    };
    return texts[status] || status;
  }
}
