const fs = require('fs');
const chalk = require('chalk');

class ReportGenerator {
  constructor(parser, proxyResolver) {
    this.parser = parser;
    this.proxyResolver = proxyResolver;
  }

  generateTerminalReport(hostname) {
    const resolved = this.parser.resolveHost(hostname);
    const proxyResult = this.proxyResolver.resolveProxyChain(hostname);
    const identityCheck = this.proxyResolver.checkIdentityFile(
      resolved.resolvedOptions.identityfile
    );
    
    let output = [];
    output.push(chalk.bold.blue('='.repeat(70)));
    output.push(chalk.bold.blue('SSH 配置解析报告'));
    output.push(chalk.bold.blue('='.repeat(70)));
    output.push('');
    output.push(chalk.bold(`主机: ${hostname}`));
    output.push(chalk.bold(`实际目标: ${resolved.effectiveHostname}`));
    output.push('');
    
    output.push(chalk.bold.yellow('匹配规则优先级:'));
    resolved.matchingRules.forEach((rule, i) => {
      output.push(chalk.gray(`  [${i+1}] 模式: ${rule.pattern}`) + 
                  chalk.cyan(` (优先级: ${rule.specificity}, 行号: ${rule.definedAt})`));
    });
    output.push('');
    
    if (resolved.overrides.length > 0) {
      output.push(chalk.bold.red('配置覆盖检测:'));
      resolved.overrides.forEach(over => {
        output.push(chalk.red(`  ${over.key}: "${over.oldValue}" -> "${over.newValue}"`) + 
                    chalk.gray(` (由 ${over.byPattern} 在第${over.definedAt}行覆盖)`));
      });
      output.push('');
    }
    
    output.push(chalk.bold.green('跳板链路:'));
    if (proxyResult.error) {
      output.push(chalk.red(`  错误: ${proxyResult.error} (${proxyResult.loop})`));
    } else {
      proxyResult.chain.forEach((hop, i) => {
        const arrow = i < proxyResult.chain.length - 1 ? ' ->' : '';
        const user = hop.user ? `${hop.user}@` : '';
        const port = hop.port ? `:${hop.port}` : '';
        output.push(`  [${i+1}] ${user}${hop.resolvedHost}${port}${arrow}`);
      });
    }
    output.push('');
    
    output.push(chalk.bold.magenta('密钥检查:'));
    if (identityCheck.exists) {
      output.push(chalk.green(`  ✓ ${identityCheck.originalPath}`));
      output.push(chalk.gray(`    权限: ${identityCheck.permissions}`));
    } else {
      output.push(chalk.red(`  ✗ ${identityCheck.originalPath || '未指定'}`));
      if (identityCheck.error) output.push(chalk.gray(`    错误: ${identityCheck.error}`));
    }
    output.push('');
    
    const errors = this.parser.getErrors();
    if (errors.length > 0) {
      output.push(chalk.bold.red('解析错误:'));
      errors.forEach(err => {
        output.push(chalk.red(`  第${err.line}行: ${err.error}`));
        output.push(chalk.gray(`    原始内容: "${err.content}"`));
      });
    }
    
    output.push('');
    output.push(chalk.bold.blue('='.repeat(70)));
    
    return output.join('\n');
  }

  generateJSON(hostname) {
    const resolved = this.parser.resolveHost(hostname);
    const proxyResult = this.proxyResolver.resolveProxyChain(hostname);
    const identityCheck = this.proxyResolver.checkIdentityFile(
      resolved.resolvedOptions.identityfile
    );
    
    return JSON.stringify({
      generatedAt: new Date().toISOString(),
      hostname,
      resolved,
      proxyChain: proxyResult,
      identityCheck,
      errors: this.parser.getErrors(),
      allHosts: this.parser.getAllHosts().map(h => ({
        pattern: h.patternString,
        definedAt: h.definedAt,
        options: h.options
      }))
    }, null, 2);
  }

  generateFriendlyReport(hostname) {
    const resolved = this.parser.resolveHost(hostname);
    const proxyResult = this.proxyResolver.resolveProxyChain(hostname);
    
    let report = [];
    report.push('# SSH 连接配置分析报告');
    report.push('');
    report.push(`## 主机: ${hostname}`);
    report.push('');
    report.push(`**实际连接目标**: ${resolved.effectiveHostname}`);
    report.push('');
    
    report.push('### 应用的配置规则 (按优先级)');
    report.push('');
    resolved.matchingRules.forEach((rule, i) => {
      report.push(`${i+1}. **${rule.pattern}** (第${rule.definedAt}行, 优先级: ${rule.specificity})`);
    });
    report.push('');
    
    if (resolved.overrides.length > 0) {
      report.push('### ⚠️  配置覆盖检测');
      report.push('');
      resolved.overrides.forEach(over => {
        report.push(`- **${over.key}**: \`${over.oldValue}\` → \`${over.newValue}\``);
        report.push(`  由规则 \`${over.byPattern}\` 在第${over.definedAt}行覆盖`);
      });
      report.push('');
    }
    
    report.push('### 跳板链路');
    report.push('');
    report.push('```');
    if (proxyResult.error) {
      report.push(`错误: ${proxyResult.error}`);
    } else {
      proxyResult.chain.forEach((hop, i) => {
        const user = hop.user ? `${hop.user}@` : '';
        const port = hop.port ? `:${hop.port}` : '';
        const arrow = i < proxyResult.chain.length - 1 ? ' →' : '';
        report.push(`[${i+1}] ${user}${hop.resolvedHost}${port}${arrow}`);
      });
    }
    report.push('```');
    report.push('');
    
    if (this.parser.getErrors().length > 0) {
      report.push('### ❌ 配置文件错误');
      report.push('');
      this.parser.getErrors().forEach(err => {
        report.push(`- 第${err.line}行: ${err.error}`);
      });
      report.push('');
    }
    
    report.push('---');
    report.push(`生成时间: ${new Date().toLocaleString()}`);
    
    return report.join('\n');
  }

  saveReport(filePath, content) {
    fs.writeFileSync(filePath, content);
    return filePath;
  }
}

module.exports = ReportGenerator;
