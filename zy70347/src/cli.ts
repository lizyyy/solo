import chalk = require('chalk');
import * as fs from 'fs';
import * as path from 'path';
import { Command } from 'commander';
import * as store from './store';
import * as engine from './engine';
import { FeatureFlag, Rule, UserAttributes, Environment } from './types';

const program = new Command();

function parseUserAttributes(str: string): UserAttributes {
  try {
    return JSON.parse(str);
  } catch {
    const attrs: UserAttributes = { userId: str };
    return attrs;
  }
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString('zh-CN');
}

function printEvaluationResult(result: ReturnType<typeof engine.evaluate>, json: boolean) {
  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log('\n' + chalk.bold.blue('══════════════════════════════════════════════════════════'));
  console.log(chalk.bold.blue('  特性开关评估结果'));
  console.log(chalk.bold.blue('══════════════════════════════════════════════════════════\n'));

  console.log(chalk.bold('开关信息:'));
  console.log(`  ID:         ${chalk.cyan(result.flag.id)}`);
  console.log(`  名称:       ${chalk.cyan(result.flag.name)}`);
  console.log(`  版本:       ${chalk.yellow(`v${result.version}`)}`);
  console.log(`  状态:       ${result.enabled ? chalk.green.bold('✓ 命中') : chalk.red.bold('✗ 未命中')}`);
  console.log(`  原因:       ${chalk.white(result.reason)}`);

  console.log('\n' + chalk.bold('计算字段:'));
  console.log(`  用户ID:     ${chalk.magenta(result.computedFields.userId)}`);
  console.log(`  环境:       ${chalk.magenta(result.computedFields.environment)}`);
  if (result.computedFields.bucket !== undefined) {
    console.log(`  分桶值:     ${chalk.magenta(result.computedFields.bucket)}`);
  }
  if (result.computedFields.percentage !== undefined) {
    console.log(`  灰度比例:   ${chalk.magenta(`${result.computedFields.percentage}%`)}`);
  }

  console.log('\n' + chalk.bold('评估路径:'));
  result.path.forEach((line, index) => {
    const prefix = index === 0 ? '  ' : '  ';
    if (line.includes('→')) {
      const [before, after] = line.split('→');
      console.log(`${prefix}${before}${chalk.yellow('→')}${chalk.white(after)}`);
    } else {
      console.log(`${prefix}${line}`);
    }
  });

  if (result.matchedRule) {
    console.log('\n' + chalk.bold('命中规则:'));
    console.log(`  规则ID:     ${chalk.cyan(result.matchedRule.id)}`);
    console.log(`  规则名称:   ${chalk.cyan(result.matchedRule.name)}`);
    if (result.matchedRule.description) {
      console.log(`  描述:       ${chalk.gray(result.matchedRule.description)}`);
    }
  }

  console.log('\n' + chalk.bold.blue('══════════════════════════════════════════════════════════\n'));
}

function printHistory(flagId: string, json: boolean) {
  const versions = store.getFlagVersions(flagId);
  
  if (versions.length === 0) {
    console.log(chalk.yellow(`Flag ${flagId} 没有历史版本`));
    return;
  }

  if (json) {
    console.log(JSON.stringify(versions, null, 2));
    return;
  }

  const flag = store.getFlag(flagId);
  
  console.log('\n' + chalk.bold.blue('══════════════════════════════════════════════════════════'));
  console.log(chalk.bold.blue(`  历史版本: ${flag?.name || flagId}`));
  console.log(chalk.bold.blue('══════════════════════════════════════════════════════════\n'));

  versions.forEach((v, index) => {
    const isCurrent = index === versions.length - 1;
    const actionColor = 
      v.action === 'create' ? chalk.green :
      v.action === 'update' ? chalk.blue :
      chalk.yellow;
    
    console.log(chalk.bold(`版本 ${v.version}${isCurrent ? chalk.green(' (当前)') : ''}`));
    console.log(`  时间:       ${formatDate(v.timestamp)}`);
    console.log(`  操作类型:   ${actionColor(v.action.toUpperCase())}`);
    if (v.previousVersion !== undefined) {
      console.log(`  从版本:     ${v.previousVersion} → ${v.version}`);
    }
    console.log(`  全局关闭:   ${v.flag.globallyDisabled ? chalk.red('是') : chalk.green('否')}`);
    console.log(`  规则数量:   ${v.flag.rules.length} 条`);
    
    if (v.flag.rules.length > 0) {
      console.log(`  规则列表:`);
      v.flag.rules.forEach((rule, i) => {
        const status = rule.enabled ? chalk.green('✓') : chalk.red('✗');
        console.log(`    ${i + 1}. [${status}] ${rule.name} (${rule.environment})`);
        if (rule.percentage !== undefined) {
          console.log(`         灰度: ${rule.percentage}%`);
        }
        if (rule.whitelist && rule.whitelist.length > 0) {
          console.log(`         白名单: ${rule.whitelist.join(', ')}`);
        }
      });
    }
    
    if (index < versions.length - 1) {
      console.log('');
    }
  });

  console.log('\n' + chalk.bold.blue('══════════════════════════════════════════════════════════\n'));
}

function printExport(data: ReturnType<typeof store.exportStore>) {
  console.log(JSON.stringify(data, null, 2));
}

export function setupCLI() {
  program
    .name('ff')
    .description('运行时特性开关 CLI')
    .version('1.0.0');

  program
    .command('eval <flagId>')
    .description('评估特性开关是否命中')
    .option('-u, --user <user>', '用户属性 (JSON 或 userId)', '{ "userId": "test-user-001" }')
    .option('-e, --env <environment>', '环境 (test/staging/production)', 'production')
    .option('-j, --json', '输出 JSON 格式')
    .action((flagId, options) => {
      const user = parseUserAttributes(options.user);
      const env = options.env as Environment;
      
      try {
        const result = engine.evaluate(flagId, user, env);
        printEvaluationResult(result, options.json);
      } catch (error: any) {
        console.error(chalk.red(`错误: ${error.message}`));
        process.exit(1);
      }
    });

  program
    .command('explain <flagId>')
    .description('详细解释评估过程')
    .option('-u, --user <user>', '用户属性 (JSON 或 userId)', '{ "userId": "test-user-001" }')
    .option('-e, --env <environment>', '环境 (test/staging/production)', 'production')
    .option('-j, --json', '输出 JSON 格式')
    .action((flagId, options) => {
      const user = parseUserAttributes(options.user);
      const env = options.env as Environment;
      
      try {
        const result = engine.explain(flagId, user, env);
        if (options.json) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          printEvaluationResult(result as any, false);
          
          console.log(chalk.bold('\n所有规则状态:'));
          result.allRules.forEach((rule, i) => {
            const envMatch = rule.environment === 'all' || rule.environment === env;
            console.log(`  ${i + 1}. [${rule.enabled ? chalk.green('✓') : chalk.red('✗')}] ${rule.name}`);
            console.log(`      环境: ${rule.environment} ${envMatch ? chalk.green('(匹配)') : chalk.yellow('(不匹配)')}`);
            if (rule.percentage !== undefined) {
              console.log(`      灰度: ${rule.percentage}%`);
            }
            if (rule.attributes) {
              console.log(`      属性条件: ${JSON.stringify(rule.attributes)}`);
            }
          });
        }
      } catch (error: any) {
        console.error(chalk.red(`错误: ${error.message}`));
        process.exit(1);
      }
    });

  program
    .command('set <flagId>')
    .description('设置或更新特性开关')
    .option('-n, --name <name>', '开关名称')
    .option('-d, --description <desc>', '描述')
    .option('--disable-global', '全局关闭')
    .option('--enable-global', '全局开启')
    .option('-r, --rule <ruleJson>', '添加规则 (JSON)')
    .option('--clear-rules', '清除所有规则')
    .option('--env-override <env>', '设置环境覆盖 (test/staging/production)')
    .option('--env-enabled <enabled>', '环境覆盖的启用状态 (true/false)')
    .option('--env-percentage <percentage>', '环境覆盖的灰度比例')
    .action((flagId, options) => {
      let flag = store.getFlag(flagId);
      const now = Date.now();
      
      if (!flag) {
        flag = {
          id: flagId,
          name: options.name || flagId,
          description: options.description || '',
          globallyDisabled: options.disableGlobal === true,
          rules: [],
          createdAt: now,
          updatedAt: now,
        };
        
        store.createFlag(flag);
        console.log(chalk.green(`✓ 创建开关: ${flagId}`));
      }

      let needsUpdate = false;

      if (options.name && flag.name !== options.name) {
        flag.name = options.name;
        needsUpdate = true;
      }
      
      if (options.description !== undefined && flag.description !== options.description) {
        flag.description = options.description;
        needsUpdate = true;
      }
      
      if (options.disableGlobal === true && !flag.globallyDisabled) {
        flag.globallyDisabled = true;
        needsUpdate = true;
      }
      
      if (options.enableGlobal === true && flag.globallyDisabled) {
        flag.globallyDisabled = false;
        needsUpdate = true;
      }
      
      if (options.clearRules) {
        flag.rules = [];
        needsUpdate = true;
        console.log(chalk.yellow('  已清除所有规则'));
      }
      
      if (options.rule) {
        try {
          const rule: Rule = JSON.parse(options.rule);
          rule.id = rule.id || `rule-${Date.now()}`;
          flag.rules = flag.rules.filter((r) => r.id !== rule.id);
          flag.rules.push(rule);
          needsUpdate = true;
          console.log(chalk.green(`  添加规则: ${rule.name}`));
        } catch (error: any) {
          console.error(chalk.red(`  规则解析失败: ${error.message}`));
          process.exit(1);
        }
      }
      
      if (needsUpdate) {
        store.updateFlag(flag);
        console.log(chalk.green(`✓ 更新开关: ${flagId} (版本: ${store.getLatestVersion(flagId)})`));
      }
      
      if (options.envOverride) {
        const env = options.envOverride as Environment;
        const enabled = options.envEnabled !== 'false';
        const percentage = options.envPercentage ? parseInt(options.envPercentage) : undefined;
        
        store.setEnvOverride(flagId, env, enabled, percentage);
        console.log(chalk.green(`✓ 设置环境覆盖: ${env} (enabled=${enabled}, percentage=${percentage || 'N/A'})`));
      }
    });

  program
    .command('history <flagId>')
    .description('查看历史版本')
    .option('-j, --json', '输出 JSON 格式')
    .action((flagId, options) => {
      printHistory(flagId, options.json);
    });

  program
    .command('rollback <flagId> <version>')
    .description('回滚到指定版本')
    .action((flagId, version) => {
      try {
        const v = parseInt(version);
        const result = store.rollbackFlag(flagId, v);
        console.log(chalk.green(`✓ 回滚成功: v${v} → v${result.version}`));
      } catch (error: any) {
        console.error(chalk.red(`错误: ${error.message}`));
        process.exit(1);
      }
    });

  program
    .command('export')
    .description('导出所有配置')
    .option('-o, --output <file>', '输出到文件')
    .action((options) => {
      const data = store.exportStore();
      
      if (options.output) {
        fs.writeFileSync(path.resolve(options.output), JSON.stringify(data, null, 2));
        console.log(chalk.green(`✓ 导出到: ${options.output}`));
      } else {
        printExport(data);
      }
    });

  program
    .command('import <file>')
    .description('导入配置')
    .action((file) => {
      try {
        const data = JSON.parse(fs.readFileSync(path.resolve(file), 'utf-8'));
        store.importStore(data);
        console.log(chalk.green(`✓ 导入成功: ${file}`));
      } catch (error: any) {
        console.error(chalk.red(`导入失败: ${error.message}`));
        process.exit(1);
      }
    });

  program
    .command('list')
    .description('列出所有特性开关')
    .option('-j, --json', '输出 JSON 格式')
    .action((options) => {
      const flags = store.getAllFlags();
      
      if (options.json) {
        console.log(JSON.stringify(flags, null, 2));
        return;
      }

      console.log('\n' + chalk.bold.blue('══════════════════════════════════════════════════════════'));
      console.log(chalk.bold.blue('  特性开关列表'));
      console.log(chalk.bold.blue('══════════════════════════════════════════════════════════\n'));

      flags.forEach((flag, index) => {
        const latestVersion = store.getLatestVersion(flag.id);
        console.log(`${chalk.cyan(flag.id)}`);
        console.log(`  名称:       ${flag.name}`);
        console.log(`  版本:       v${latestVersion}`);
        console.log(`  全局:       ${flag.globallyDisabled ? chalk.red('关闭') : chalk.green('开启')}`);
        console.log(`  规则:       ${flag.rules.length} 条`);
        console.log(`  更新时间:   ${formatDate(flag.updatedAt)}`);
        if (index < flags.length - 1) {
          console.log('');
        }
      });

      if (flags.length === 0) {
        console.log(chalk.yellow('  暂无特性开关'));
      }

      console.log('\n' + chalk.bold.blue('══════════════════════════════════════════════════════════\n'));
    });

  program
    .command('bucket <userId> <flagId>')
    .description('计算用户分桶值')
    .option('-p, --percentage <percentage>', '灰度比例')
    .action((userId, flagId, options) => {
      const percentage = options.percentage ? parseInt(options.percentage) : undefined;
      const result = engine.debugBucket(userId, flagId, percentage);
      
      console.log('\n' + chalk.bold.blue('══════════════════════════════════════════════════════════'));
      console.log(chalk.bold.blue('  分桶计算'));
      console.log(chalk.bold.blue('══════════════════════════════════════════════════════════\n'));
      
      console.log(`用户ID:     ${chalk.magenta(userId)}`);
      console.log(`开关ID:     ${chalk.magenta(flagId)}`);
      console.log(`分桶值:     ${chalk.cyan.bold(result.bucket)}`);
      
      if (percentage !== undefined) {
        console.log(`灰度比例:   ${percentage}%`);
        console.log(`命中结果:   ${result.willHit ? chalk.green('✓ 命中') : chalk.red('✗ 未命中')}`);
      }
      
      console.log('\n' + chalk.bold.blue('══════════════════════════════════════════════════════════\n'));
    });

  return program;
}
