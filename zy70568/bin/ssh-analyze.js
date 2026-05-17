#!/usr/bin/env node

const { Command } = require('commander');
const SSHConfigParser = require('../src/parser');
const ProxyJumpResolver = require('../src/proxyResolver');
const ReportGenerator = require('../src/reportGenerator');
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
        const jsonPath = options.output.replace(/\.[^.]+$/, '') + '.json';
        fs.writeFileSync(jsonPath, results.json);
        console.log('JSON报告已保存:', jsonPath);
      }
      
      if (options.format === 'md' || options.format === 'all') {
        const mdPath = options.output.replace(/\.[^.]+$/, '') + '.md';
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
      console.log(`[${i+1}] ${host.patternString} (第${host.definedAt}行)`);
      Object.keys(host.options).forEach(key => {
        console.log(`     ${key}: ${host.options[key]}`);
      });
      console.log('');
    });
  });

program
  .command('self-test')
  .description('运行自检，验证解析器功能')
  .action(() => {
    const testConfig = `# 测试SSH配置文件
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
`;
    
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
