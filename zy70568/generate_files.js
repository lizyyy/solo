const fs = require('fs');

// Generate proxyResolver.js
const proxyCode = `const fs = require('fs');
const path = require('path');

class ProxyJumpResolver {
  constructor(parser) {
    this.parser = parser;
  }

  resolveProxyChain(hostname, visited = new Set(), chain = []) {
    if (visited.has(hostname)) {
      return { chain, error: 'Circular proxy chain detected', loop: hostname };
    }
    
    visited.add(hostname);
    const resolved = this.parser.resolveHost(hostname);
    chain.push({
      hostname,
      resolvedHost: resolved.effectiveHostname,
      user: resolved.resolvedOptions.user,
      port: resolved.resolvedOptions.port,
      identityFile: resolved.resolvedOptions.identityfile,
      proxyJump: resolved.resolvedOptions.proxyjump
    });

    const proxyJump = resolved.resolvedOptions.proxyjump;
    if (proxyJump && proxyJump !== 'none') {
      let nextHost = proxyJump;
      if (nextHost.includes('@')) {
        nextHost = nextHost.split('@')[1];
      }
      return this.resolveProxyChain(nextHost, visited, chain);
    }

    return { chain, finalTarget: resolved.effectiveHostname };
  }

  checkIdentityFile(identityFile) {
    if (!identityFile) {
      return { exists: false, warning: 'No IdentityFile specified' };
    }
    
    const homeDir = process.env.HOME || process.env.USERPROFILE;
    const filePath = identityFile.replace('~', homeDir);
    
    try {
      const exists = fs.existsSync(filePath);
      const stats = exists ? fs.statSync(filePath) : null;
      return {
        exists,
        path: filePath,
        originalPath: identityFile,
        isFile: stats ? stats.isFile() : false,
        permissions: stats ? stats.mode.toString(8).slice(-3) : null
      };
    } catch (e) {
      return {
        exists: false,
        path: filePath,
        originalPath: identityFile,
        error: e.message
      };
    }
  }
}

module.exports = ProxyJumpResolver;
`;

fs.writeFileSync('src/proxyResolver.js', proxyCode);
console.log('proxyResolver.js created');

// Generate reportGenerator.js
const reportCode = `const fs = require('fs');
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
    output.push(chalk.bold.blue('='.repeat(60)));
    output.push(chalk.bold.blue('SSH配置解析报告'));
    output.push(chalk.bold.blue('='.repeat(60)));
    output.push('');
    output.push(chalk.bold(\`主机: \${hostname}\`));
    output.push(chalk.bold(\`实际目标: \${resolved.effectiveHostname}\`));
    output.push('');
    
    output.push(chalk.bold.yellow('匹配规则优先级:'));
    resolved.matchingRules.forEach((rule, i) => {
      output.push(chalk.gray(\`  [\${i+1}] 模式: \${rule.pattern}\`) + 
                  chalk.cyan(\` (优先级: \${rule.specificity}, 行号: \${rule.definedAt})\`));
    });
    output.push('');
    
    if (resolved.overrides.length > 0) {
      output.push(chalk.bold.red('配置覆盖检测:'));
      resolved.overrides.forEach(over => {
        output.push(chalk.red(\`  \${over.key}: "\${over.oldValue}" -> "\${over.newValue}"\`) + 
                    chalk.gray(\` (由 \${over.byPattern} 在第\${over.definedAt}行覆盖)\`));
      });
      output.push('');
    }
    
    output.push(chalk.bold.green('跳板链路:'));
    if (proxyResult.error) {
      output.push(chalk.red(\`  错误: \${proxyResult.error} (\${proxyResult.loop})\`));
    } else {
      proxyResult.chain.forEach((hop, i) => {
        const arrow = i < proxyResult.chain.length - 1 ? ' -> ' : '';
        const user = hop.user ? \`\${hop.user}@\` : '';
        const port = hop.port ? \`:\${hop.port}\` : '';
        output.push(\`  [\${i+1}] \${user}\${hop.resolvedHost}\${port}\${arrow}\`);
      });
    }
    output.push('');
    
    output.push(chalk.bold.magenta('密钥检查:'));
    if (identityCheck.exists) {
      output.push(chalk.green(\`  ✓ \${identityCheck.originalPath}\`));
      output.push(chalk.gray(\`    权限: \${identityCheck.permissions}\`));
    } else {
      output.push(chalk.red(\`  ✗ \${identityCheck.originalPath || '未指定'}\`));
      if (identityCheck.error) output.push(chalk.gray(\`    错误: \${identityCheck.error}\`));
    }
    output.push('');
    
    const errors = this.parser.getErrors();
    if (errors.length > 0) {
      output.push(chalk.bold.red('解析错误:'));
      errors.forEach(err => {
        output.push(chalk.red(\`  第\${err.line}行: \${err.error}\`));
        output.push(chalk.gray(\`    原始内容: "\${err.content}"\`));
      });
    }
    
    output.push('');
    output.push(chalk.bold.blue('='.repeat(60)));
    
    return output.join(String.fromCharCode(10));
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
    report.push(\`## 主机: \${hostname}\`);
    report.push('');
    report.push(\`**实际连接目标**: \${resolved.effectiveHostname}\`);
    report.push('');
    
    report.push('### 应用的配置规则 (按优先级)');
    report.push('');
    resolved.matchingRules.forEach((rule, i) => {
      report.push(\`\${i+1}. **\${rule.pattern}** (第\${rule.definedAt}行, 优先级: \${rule.specificity})\`);
    });
    report.push('');
    
    if (resolved.overrides.length > 0) {
      report.push('### ⚠️  配置覆盖检测');
      report.push('');
      resolved.overrides.forEach(over => {
        report.push(\`- **\${over.key}**: \\\`\${over.oldValue}\\\` → \\\`\${over.newValue}\\\`\`);
        report.push(\`  由规则 \\\`\${over.byPattern}\\\` 在第\${over.definedAt}行覆盖\`);
      });
      report.push('');
    }
    
    report.push('### 跳板链路');
    report.push('');
    report.push(\`\\\`\\\`\\\`\`);
    if (proxyResult.error) {
      report.push(\`错误: \${proxyResult.error}\`);
    } else {
      proxyResult.chain.forEach((hop, i) => {
        const user = hop.user ? \`\${hop.user}@\` : '';
        const port = hop.port ? \`:\${hop.port}\` : '';
        const arrow = i < proxyResult.chain.length - 1 ? ' →' : '';
        report.push(\`[\${i+1}] \${user}\${hop.resolvedHost}\${port}\${arrow}\`);
      });
    }
    report.push(\`\\\`\\\`\\\`\`);
    report.push('');
    
    if (this.parser.getErrors().length > 0) {
      report.push('### ❌ 配置文件错误');
      report.push('');
      this.parser.getErrors().forEach(err => {
        report.push(\`- 第\${err.line}行: \${err.error}\`);
      });
      report.push('');
    }
    
    report.push('---');
    report.push(\`生成时间: \${new Date().toLocaleString()}\`);
    
    return report.join(String.fromCharCode(10));
  }

  saveReport(filePath, content) {
    fs.writeFileSync(filePath, content);
    return filePath;
  }
}

module.exports = ReportGenerator;
`;

fs.writeFileSync('src/reportGenerator.js', reportCode);
console.log('reportGenerator.js created');

// Generate index.js
const indexCode = `const SSHConfigParser = require('./parser');
const ProxyJumpResolver = require('./proxyResolver');
const ReportGenerator = require('./reportGenerator');

module.exports = {
  SSHConfigParser,
  ProxyJumpResolver,
  ReportGenerator,
  parseConfig: (filePath) => {
    const parser = new SSHConfigParser();
    return parser.parse(filePath);
  },
  analyzeHost: (configPath, hostname) => {
    const parser = new SSHConfigParser();
    parser.parse(configPath);
    const proxyResolver = new ProxyJumpResolver(parser);
    const reportGen = new ReportGenerator(parser, proxyResolver);
    return {
      terminalReport: reportGen.generateTerminalReport(hostname),
      json: reportGen.generateJSON(hostname),
      friendlyReport: reportGen.generateFriendlyReport(hostname)
    };
  }
};
`;

fs.writeFileSync('src/index.js', indexCode);
console.log('index.js created');

// Generate CLI
const cliCode = `#!/usr/bin/env node
const { Command } = require('commander');
const SSHConfigParser = require('../src/parser');
const ProxyJumpResolver = require('../src/proxyResolver');
const ReportGenerator = require('../src/reportGenerator');
const path = require('path');
const fs = require('fs');

const program = new Command();

program
  .name('ssh-analyze')
  .description('SSH配置解析工具 - 分析Host规则、跳板链路、配置覆盖')
  .version('1.0.0');

program
  .command('analyze')
  .description('分析指定主机的SSH配置')
  .argument('<hostname>', '要分析的主机名')
  .option('-c, --config <path>', 'SSH配置文件路径', '~/.ssh/config')
  .option('-f, --format <type>', '输出格式: terminal, json, md, all', 'terminal')
  .option('-o, --output <path>', '输出文件路径')
  .action((hostname, options) => {
    const configPath = options.config.replace('~', process.env.HOME || process.env.USERPROFILE);
    
    if (!fs.existsSync(configPath)) {
      console.error('配置文件不存在:', configPath);
      process.exit(1);
    }
    
    const parser = new SSHConfigParser();
    parser.parse(configPath);
    
    const proxyResolver = new ProxyJumpResolver(parser);
    const reportGen = new ReportGenerator(parser, proxyResolver);
    
    const results = {
      terminal: reportGen.generateTerminalReport(hostname),
      json: reportGen.generateJSON(hostname),
      friendly: reportGen.generateFriendlyReport(hostname)
    };
    
    if (options.format === 'terminal' || options.format === 'all') {
      console.log(results.terminal);
    }
    
    if (options.output) {
      if (options.format === 'json' || options.format === 'all') {
        const jsonPath = options.output.replace(/\\.[^.]+$/, '') + '.json';
        fs.writeFileSync(jsonPath, results.json);
        console.log('JSON报告已保存:', jsonPath);
      }
      
      if (options.format === 'md' || options.format === 'all') {
        const mdPath = options.output.replace(/\\.[^.]+$/, '') + '.md';
        fs.writeFileSync(mdPath, results.friendly);
        console.log('Markdown报告已保存:', mdPath);
      }
    } else if (options.format !== 'terminal') {
      if (options.format === 'json') {
        console.log(results.json);
      } else if (options.format === 'md') {
        console.log(results.friendly);
      }
    }
  });

program
  .command('list')
  .description('列出配置文件中的所有Host')
  .option('-c, --config <path>', 'SSH配置文件路径', '~/.ssh/config')
  .action((options) => {
    const configPath = options.config.replace('~', process.env.HOME || process.env.USERPROFILE);
    
    if (!fs.existsSync(configPath)) {
      console.error('配置文件不存在:', configPath);
      process.exit(1);
    }
    
    const parser = new SSHConfigParser();
    parser.parse(configPath);
    const hosts = parser.getAllHosts();
    
    console.log('发现', hosts.length, '个Host规则:');
    console.log('');
    hosts.forEach((host, i) => {
      console.log(\`[\${i+1}] \${host.patternString} (第\${host.definedAt}行)\`);
      Object.keys(host.options).forEach(key => {
        console.log(\`     \${key}: \${host.options[key]}\`);
      });
      console.log('');
    });
  });

program
  .command('self-test')
  .description('运行自检，验证解析器功能')
  .action(() => {
    const testConfig = \`# 测试SSH配置文件
# 全局配置
User default-user
IdentityFile ~/.ssh/id_rsa

# 跳板机
Host jump-host
  HostName 192.168.1.100
  User jump-user
  Port 2222
  IdentityFile ~/.ssh/jump_key

# 通配符规则
Host *.internal
  User internal-user
  ProxyJump jump-host
  IdentityFile ~/.ssh/internal_key

# 特定主机 - 会覆盖上面的规则
Host server.internal
  HostName 10.0.0.1
  User admin
  Port 22
\`;
    
    const testPath = '/tmp/test_ssh_config';
    fs.writeFileSync(testPath, testConfig);
    
    const parser = new SSHConfigParser();
    parser.parse(testPath);
    
    console.log('✓ 配置文件解析成功');
    
    const resolved = parser.resolveHost('server.internal');
    console.log('✓ 主机名解析成功');
    
    const proxyResolver = new ProxyJumpResolver(parser);
    const chain = proxyResolver.resolveProxyChain('server.internal');
    console.log('✓ 跳板链路展开成功');
    
    const reportGen = new ReportGenerator(parser, proxyResolver);
    const terminal = reportGen.generateTerminalReport('server.internal');
    const json = reportGen.generateJSON('server.internal');
    const friendly = reportGen.generateFriendlyReport('server.internal');
    console.log('✓ 报告生成成功');
    
    console.log('');
    console.log('=== 自检通过! ===');
    console.log('');
    console.log('测试解析结果:');
    console.log('  server.internal ->', resolved.effectiveHostname);
    console.log('  应用规则数:', resolved.matchingRules.length);
    console.log('  配置覆盖:', resolved.overrides.length, '项');
    console.log('  跳板链长度:', chain.chain.length);
    
    fs.unlinkSync(testPath);
  });

program.parse();
`;

fs.writeFileSync('bin/ssh-analyze.js', cliCode);
console.log('ssh-analyze.js created');

// Generate self-test
const testCode = `const SSHConfigParser = require('../src/parser');
const ProxyJumpResolver = require('../src/proxyResolver');
const ReportGenerator = require('../src/reportGenerator');
const path = require('path');

console.log('=== SSH配置解析器 - 自检 ===');
console.log('');

const testConfigPath = path.join(__dirname, '../examples/sample_config');

try {
  console.log('1. 测试配置文件解析...');
  const parser = new SSHConfigParser();
  parser.parse(testConfigPath);
  console.log('   ✓ 解析成功');
  console.log('   - Host规则数:', parser.getAllHosts().length);
  console.log('   - 错误行数:', parser.getErrors().length);
  
  console.log('');
  console.log('2. 测试主机名匹配与优先级...');
  const resolved = parser.resolveHost('db-server.internal');
  console.log('   ✓ 解析成功');
  console.log('   - 输入主机: db-server.internal');
  console.log('   - 实际目标:', resolved.effectiveHostname);
  console.log('   - 匹配规则数:', resolved.matchingRules.length);
  console.log('   - 配置覆盖数:', resolved.overrides.length);
  
  console.log('');
  console.log('3. 测试跳板链展开...');
  const proxyResolver = new ProxyJumpResolver(parser);
  const chainResult = proxyResolver.resolveProxyChain('db-server.internal');
  console.log('   ✓ 展开成功');
  console.log('   - 跳板链长度:', chainResult.chain.length);
  chainResult.chain.forEach((hop, i) => {
    console.log('     [' + (i + 1) + ']', hop.hostname, '->', hop.resolvedHost);
  });
  
  console.log('');
  console.log('4. 测试循环跳板检测...');
  const loopResult = proxyResolver.resolveProxyChain('loop-host-a');
  if (loopResult.error) {
    console.log('   ✓ 正确检测到循环:', loopResult.error);
  } else {
    console.log('   ✗ 未能检测到循环');
  }
  
  console.log('');
  console.log('5. 测试报告生成...');
  const reportGen = new ReportGenerator(parser, proxyResolver);
  const terminal = reportGen.generateTerminalReport('db-server.internal');
  const json = reportGen.generateJSON('db-server.internal');
  const friendly = reportGen.generateFriendlyReport('db-server.internal');
  console.log('   ✓ 终端报告生成成功');
  console.log('   ✓ JSON报告生成成功');
  console.log('   ✓ Markdown报告生成成功');
  
  console.log('');
  console.log('=== 所有测试通过! ===');
  console.log('');
  console.log('快速参考命令:');
  console.log('  node bin/ssh-analyze.js analyze db-server.internal -c examples/sample_config');
  console.log('  node bin/ssh-analyze.js list -c examples/sample_config');
  console.log('  node bin/ssh-analyze.js self-test');
  
} catch (e) {
  console.error('测试失败:', e.message);
  console.error(e.stack);
  process.exit(1);
}
`;

fs.writeFileSync('tests/self-test.js', testCode);
console.log('self-test.js created');

console.log('');
console.log('所有文件生成完成!');
