const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const Table = require('cli-table3');

class ReportGenerator {
  constructor(result, outputDir) {
    this.result = result;
    this.outputDir = outputDir;
  }

  generateConsoleReport() {
    console.log('\n');
    console.log(chalk.bold.cyan('════════════════════════════════════════════════════════════════'));
    console.log(chalk.bold.cyan('              人群包发布记录撤销渠道核对报告'));
    console.log(chalk.bold.cyan('════════════════════════════════════════════════════════════════'));
    console.log('');
    console.log(chalk.gray(`核对时间: ${this.result.checkTime.toLocaleString('zh-CN')}`));
    console.log('');

    this.printSummary();
    this.printFileErrors();
    this.printCheckResultTable();
    this.printFailDetails();
    this.printWarningDetails();
    this.printSpecialScenarios();
    
    console.log('');
    console.log(chalk.bold.cyan('════════════════════════════════════════════════════════════════'));
    console.log('');
  }

  printSummary() {
    const { totalPackages, passed, failed, warning } = this.result;
    
    console.log(chalk.bold('📊 核对汇总'));
    console.log('');
    
    const table = new Table({
      head: ['总人群包数', chalk.green('✅ 通过'), chalk.red('❌ 失败'), chalk.yellow('⚠️ 警告')],
      colWidths: [15, 15, 15, 15],
      style: { head: ['cyan'] }
    });
    
    table.push([totalPackages, passed, failed, warning]);
    console.log(table.toString());
    console.log('');
  }

  printFileErrors() {
    const { fileErrors } = this.result;
    const hasErrors = Object.values(fileErrors).some(errors => errors.length > 0);
    
    if (!hasErrors) return;

    console.log(chalk.bold.red('❌ 文件读取错误'));
    console.log('');

    for (const [fileType, errors] of Object.entries(fileErrors)) {
      if (errors.length > 0) {
        console.log(chalk.red(`  ${this.getFileTypeName(fileType)}: ${errors.length} 个错误`));
        errors.forEach(error => {
          console.log(chalk.gray(`    第${error.line}行: ${error.error}`));
          console.log(chalk.gray(`      数据: ${JSON.stringify(error.data)}`));
        });
      }
    }
    console.log('');
  }

  getFileTypeName(fileType) {
    const names = {
      crowdPackages: '人群包文件',
      channelDelivery: '渠道投放文件',
      revokeRecords: '撤销记录文件'
    };
    return names[fileType] || fileType;
  }

  printCheckResultTable() {
    console.log(chalk.bold('📋 人群包核对详情'));
    console.log('');

    const table = new Table({
      head: [
        '序号',
        '人群包ID',
        '人群包名称',
        '状态',
        '规则版本',
        '总渠道数',
        '已撤销',
        '未撤销',
        '备注'
      ],
      colWidths: [8, 15, 20, 10, 10, 12, 10, 10, 30],
      style: { head: ['cyan'] }
    });

    this.result.details.forEach((detail, index) => {
      const statusColor = this.getStatusColor(detail.status);
      const statusLabel = this.getStatusLabel(detail.status);
      
      table.push([
        index + 1,
        detail.packageId,
        detail.packageName || '-',
        statusColor(statusLabel),
        detail.ruleVersion || '-',
        detail.totalChannels || detail.details?.deliveryChannels?.length || '-',
        detail.revokedChannels || '-',
        detail.unrevokedChannels || '-',
        this.truncateMessage(detail.message, 28)
      ]);
    });

    console.log(table.toString());
    console.log('');
  }

  printFailDetails() {
    const failedItems = this.result.details.filter(d => d.status === 'FAIL');
    if (failedItems.length === 0) return;

    console.log(chalk.bold.red('❌ 失败详情'));
    console.log('');

    failedItems.forEach((item, index) => {
      console.log(chalk.red(`  ${index + 1}. 人群包 ${item.packageId} - ${item.packageName}`));
      console.log(chalk.gray(`     原因: ${item.message}`));
      console.log(chalk.gray(`     规则版本: ${item.ruleVersion}`));
      console.log(chalk.gray(`     撤销记录数: ${item.revokeCount}`));
      
      if (item.details && item.details.channelCheckDetails) {
        console.log(chalk.gray(`     渠道核对:`));
        item.details.channelCheckDetails.forEach(check => {
          const status = check.isRevoked ? chalk.green('✓') : chalk.red('✗');
          console.log(chalk.gray(`       ${status} ${check.channelName || check.channelCode}: ${check.reason}`));
        });
      }
      console.log('');
    });
  }

  printWarningDetails() {
    const warningItems = this.result.details.filter(d => d.status === 'WARNING');
    if (warningItems.length === 0) return;

    console.log(chalk.bold.yellow('⚠️ 警告详情'));
    console.log('');

    warningItems.forEach((item, index) => {
      console.log(chalk.yellow(`  ${index + 1}. 人群包 ${item.packageId} - ${item.packageName}`));
      console.log(chalk.gray(`     原因: ${item.message}`));
      console.log('');
    });
  }

  printSpecialScenarios() {
    const hasDuplicate = this.result.details.some(d => d.details?.hasDuplicateRevoke);
    const hasDelay = this.result.details.some(d => d.details?.hasDelay);
    const hasVersionChange = this.result.details.some(d => d.details?.ruleVersionChanged);

    if (!hasDuplicate && !hasDelay && !hasVersionChange) return;

    console.log(chalk.bold.magenta('🔍 特殊场景检测'));
    console.log('');

    if (hasDuplicate) {
      const items = this.result.details.filter(d => d.details?.hasDuplicateRevoke);
      console.log(chalk.magenta(`  重复发布撤销: ${items.length} 个人群包`));
      items.forEach(item => {
        console.log(chalk.gray(`    - ${item.packageId} (${item.packageName}): ${item.revokeCount} 次撤销记录`));
      });
      console.log('');
    }

    if (hasDelay) {
      const items = this.result.details.filter(d => d.details?.hasDelay);
      console.log(chalk.magenta(`  渠道延迟风险: ${items.length} 个人群包`));
      items.forEach(item => {
        const delayChannel = item.details.channelCheckDetails.find(c => c.hasDelayRisk);
        console.log(chalk.gray(`    - ${item.packageId} (${item.packageName}): ${delayChannel?.channelName || '未知渠道'} 延迟${delayChannel?.delayHours?.toFixed(1) || '?'}小时`));
      });
      console.log('');
    }

    if (hasVersionChange) {
      const items = this.result.details.filter(d => d.details?.ruleVersionChanged);
      console.log(chalk.magenta(`  规则版本变更: ${items.length} 个人群包`));
      items.forEach(item => {
        const versions = [...new Set(item.details.revokeRecords.map(r => r.version))].join(' → ');
        console.log(chalk.gray(`    - ${item.packageId} (${item.packageName}): 版本变更 ${versions}`));
      });
      console.log('');
    }
  }

  getStatusColor(status) {
    const colors = {
      'PASS': chalk.green,
      'FAIL': chalk.red,
      'WARNING': chalk.yellow,
      'NO_REVOKE': chalk.gray
    };
    return colors[status] || chalk.white;
  }

  getStatusLabel(status) {
    const labels = {
      'PASS': '通过',
      'FAIL': '失败',
      'WARNING': '警告',
      'NO_REVOKE': '无撤销'
    };
    return labels[status] || status;
  }

  truncateMessage(message, maxLength) {
    if (!message) return '-';
    if (message.length <= maxLength) return message;
    return message.substring(0, maxLength - 3) + '...';
  }

  async generateFileReport() {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }

    const timestamp = this.formatTimestamp(this.result.checkTime);
    const fileName = `撤销核对报告_${timestamp}.json`;
    const filePath = path.join(this.outputDir, fileName);

    const reportData = {
      title: '人群包发布记录撤销渠道核对报告',
      checkTime: this.result.checkTime.toISOString(),
      summary: {
        totalPackages: this.result.totalPackages,
        passed: this.result.passed,
        failed: this.result.failed,
        warning: this.result.warning,
        fileErrors: this.result.fileErrors
      },
      details: this.result.details.map(d => this.serializeDetail(d))
    };

    fs.writeFileSync(filePath, JSON.stringify(reportData, null, 2), 'utf-8');
    return filePath;
  }

  formatTimestamp(date) {
    return date.toISOString()
      .replace(/[:.]/g, '-')
      .replace('T', '_')
      .substring(0, 19);
  }

  serializeDetail(detail) {
    return {
      packageId: detail.packageId,
      packageName: detail.packageName,
      status: detail.status,
      message: detail.message,
      ruleVersion: detail.ruleVersion,
      latestRevokeTime: detail.latestRevokeTime?.toISOString(),
      revokeCount: detail.revokeCount,
      totalChannels: detail.totalChannels,
      revokedChannels: detail.revokedChannels,
      unrevokedChannels: detail.unrevokedChannels,
      details: detail.details ? this.serializeDetails(detail.details) : null
    };
  }

  serializeDetails(details) {
    if (!details) return null;
    
    return {
      allRevoked: details.allRevoked,
      hasDuplicateRevoke: details.hasDuplicateRevoke,
      hasDelay: details.hasDelay,
      ruleVersionChanged: details.ruleVersionChanged,
      channelCheckDetails: details.channelCheckDetails?.map(c => ({
        channelCode: c.channelCode,
        channelName: c.channelName,
        isRevoked: c.isRevoked,
        reason: c.reason,
        hasDelayRisk: c.hasDelayRisk,
        delayHours: c.delayHours,
        checkMethod: c.checkMethod
      })),
      revokeRecords: details.revokeRecords?.map(r => ({
        time: r.time?.toISOString(),
        channel: r.channel,
        status: r.status,
        version: r.version
      }))
    };
  }
}

module.exports = ReportGenerator;
