import chalk from 'chalk';
import { table } from 'table';
import { loadConfig } from '../storage.js';
import { getAccessType, getAccessTypeLabel } from '../test-engine.js';

function explainTestCase(testCase) {
  const accessType = getAccessType(testCase.method, testCase.path);
  const isRead = ['GET', 'HEAD', 'OPTIONS'].includes(testCase.method.toUpperCase());
  const isWrite = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(testCase.method.toUpperCase());
  
  const details = [];
  
  details.push({
    label: '操作类型',
    value: `${getAccessTypeLabel(accessType)} (${isRead ? '读操作' : isWrite ? '写操作' : '其他'})`,
  });
  
  details.push({
    label: 'HTTP 方法',
    value: testCase.method,
  });
  
  details.push({
    label: 'API 路径',
    value: testCase.path,
  });
  
  details.push({
    label: '描述',
    value: testCase.description || '无',
  });
  
  if (testCase.requiresAdmin) {
    details.push({
      label: '权限要求',
      value: chalk.yellow('需要管理员权限'),
    });
  }
  
  if (testCase.targetResourceId) {
    details.push({
      label: '目标资源',
      value: testCase.targetResourceId,
    });
  }
  
  if (testCase.skip) {
    details.push({
      label: '状态',
      value: chalk.gray(`跳过 (${testCase.skipReason || '未说明'})`),
    });
  }
  
  return details;
}

export async function handleExplain(options) {
  const configPath = options.config || 'tit-config.json';
  
  let config;
  try {
    config = loadConfig(configPath);
  } catch (error) {
    console.error(chalk.red(`错误: ${error.message}`));
    process.exit(1);
  }
  
  if (options.testCase) {
    const testCase = config.testCases.find(tc => tc.id === options.testCase);
    if (!testCase) {
      console.error(chalk.red(`未找到测试用例: ${options.testCase}`));
      process.exit(1);
    }
    
    console.log(chalk.bold('\n测试用例详情'));
    console.log(chalk.bold('─'.repeat(40)));
    console.log(chalk.cyan(`ID: ${testCase.id}`));
    
    const details = explainTestCase(testCase);
    for (const detail of details) {
      console.log(`${chalk.gray(detail.label + ':')} ${detail.value}`);
    }
    
    if (testCase.body) {
      console.log(`${chalk.gray('请求体:')}`);
      console.log(JSON.stringify(testCase.body, null, 2));
    }
    
    if (testCase.queryParams) {
      console.log(`${chalk.gray('查询参数:')}`);
      console.log(JSON.stringify(testCase.queryParams, null, 2));
    }
    
    if (testCase.notes) {
      console.log(`${chalk.gray('备注:')} ${testCase.notes}`);
    }
    
    console.log();
    console.log(chalk.bold('测试策略:'));
    console.log(`  1. ${chalk.green('正常访问')}: 使用目标租户的令牌访问自己的资源，验证可访问`);
    console.log(`  2. ${chalk.red('越权测试')}: 使用其他租户的令牌访问目标资源，验证被拒绝`);
    console.log(`  3. ${chalk.blue('判断标准')}: 越权访问应返回 401/403/404，返回 2xx 则视为漏洞`);
    
    return;
  }
  
  console.log(chalk.bold('\n接口用例列表'));
  console.log(chalk.bold('═'.repeat(70)));
  
  const headers = [
    chalk.bold('ID'),
    chalk.bold('方法'),
    chalk.bold('路径'),
    chalk.bold('类型'),
    chalk.bold('权限'),
    chalk.bold('状态'),
  ];
  
  const rows = [headers];
  
  for (const testCase of config.testCases) {
    const accessType = getAccessType(testCase.method, testCase.path);
    const isRead = ['GET', 'HEAD', 'OPTIONS'].includes(testCase.method.toUpperCase());
    
    rows.push([
      testCase.id,
      testCase.method,
      testCase.path.length > 30 ? testCase.path.slice(0, 27) + '...' : testCase.path,
      getAccessTypeLabel(accessType),
      testCase.requiresAdmin ? '管理员' : '-',
      testCase.skip ? chalk.gray('跳过') : (isRead ? chalk.blue('读') : chalk.magenta('写')),
    ]);
  }
  
  console.log(table(rows, {
    columns: [
      { width: 12 },
      { width: 8 },
      { width: 25 },
      { width: 6 },
      { width: 8 },
      { width: 8 },
    ],
  }));
  
  console.log(chalk.gray(`共 ${config.testCases.length} 个测试用例`));
  console.log(chalk.gray(`使用 tit explain --test-case <id> 查看详细信息`));
}
