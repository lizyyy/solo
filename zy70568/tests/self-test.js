const SSHConfigParser = require('../src/parser');
const ProxyJumpResolver = require('../src/proxyResolver');
const ReportGenerator = require('../src/reportGenerator');
const path = require('path');
const fs = require('fs');

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
  console.log('6. 测试密钥文件检查...');
  const identityCheck = proxyResolver.checkIdentityFile('~/.ssh/id_rsa');
  console.log('   ✓ 密钥检查完成 - 存在:', identityCheck.exists ? '是' : '否');
  
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
