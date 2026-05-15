#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const inquirer = require('inquirer');
const ora = require('ora');
const fs = require('fs');
const path = require('path');

const ValidationService = require('./utils/service');

async function safePrompt(questions) {
  try {
    if (!process.stdin.isTTY) {
      throw new Error('非交互模式下需要通过命令行参数提供值');
    }
    return await inquirer.prompt(questions);
  } catch (error) {
    if (error.message && (error.message.includes('ERR_USE_AFTER_CLOSE') || error.message.includes('非交互模式'))) {
      throw new Error('输入流已关闭，请在交互终端中运行此命令，或使用命令行参数提供所有必需值');
    }
    throw error;
  }
}

const program = new Command();

program
  .name('log-validator')
  .description('日志脱敏验证命令行工具')
  .version('1.0.0');

program
  .command('submit')
  .description('提交验证批次')
  .option('-n, --name <name>', '批次名称')
  .option('-o, --operator <operator>', '操作者')
  .option('-f, --file <file>', '材料文件路径(JSON格式)')
  .option('-r, --risk <riskType>', '风险类型')
  .option('-y, --yes', '非交互模式，跳过所有确认')
  .action(async (options) => {
    try {
      const defaultName = options.name || `灰度巡检-${new Date().toISOString().slice(0, 10)}`;
      const defaultOperator = options.operator || 'system';
      const defaultRiskType = options.risk || 'general';
      
      let answers = {
        name: defaultName,
        operator: defaultOperator,
        riskType: defaultRiskType
      };
      
      const hasAllParams = options.operator && options.file;
      const isNonInteractive = options.yes || !process.stdin.isTTY;
      
      if (!hasAllParams && !isNonInteractive) {
        try {
          answers = await safePrompt([
            {
              type: 'input',
              name: 'name',
              message: '批次名称:',
              default: defaultName
            },
            {
              type: 'input',
              name: 'operator',
              message: '操作者:',
              default: defaultOperator
            },
            {
              type: 'input',
              name: 'riskType',
              message: '风险类型:',
              default: defaultRiskType
            }
          ]);
        } catch (promptError) {
          console.log(chalk.yellow('使用默认参数继续...'));
        }
      }

      let materials = [];
      
      if (options.file && fs.existsSync(options.file)) {
        const fileContent = fs.readFileSync(options.file, 'utf8');
        materials = JSON.parse(fileContent);
        console.log(chalk.blue(`从文件加载了 ${materials.length} 个材料`));
      } else {
        console.log(chalk.yellow('未指定材料文件，将使用示例数据进行演示'));
        materials = [
          {
            fileName: '用户信息表_2024.csv',
            content: '姓名: 张三, 电话: 138******00, 邮箱: zhang***@example.com\n姓名: 李四, 电话: 139******00, 邮箱: li***@example.com',
            materialType: 'user_data',
            downloadUrl: 'https://example.com/download?token=expired_123'
          },
          {
            fileName: '订单日志.log',
            content: '订单ID: 12345, 金额: 100.00, 状态: 完成\n订单ID: 12346, 金额: 200.00, 状态: 完成',
            materialType: 'order_log',
            downloadUrl: 'https://example.com/download?token=valid_123'
          },
          {
            fileName: '财务结转表_2024Q1.xlsx',
            content: '期间: 2024Q1, 收入: 1000000.00, 支出: 500000.00, 净利润: 500000.00',
            materialType: '财务结转表',
            downloadUrl: 'https://example.com/download?token=finance_123'
          }
        ];
      }

      const spinner = ora('正在创建批次...').start();
      const batchId = await ValidationService.createBatch(answers.name, answers.operator, answers.riskType);
      spinner.succeed(`批次创建成功: ${chalk.cyan(batchId)}`);

      spinner.start('正在验证材料...');
      const result = await ValidationService.submitBatch(batchId, materials, answers.operator);
      spinner.succeed('验证完成');

      console.log('\n' + chalk.bold('=== 验证结果 ==='));
      
      if (result.validated.length > 0) {
        console.log(chalk.blue(`\n新验证 (${result.validated.length}):`));
        result.validated.forEach(item => {
          const statusColor = item.success ? chalk.green : chalk.red;
          const statusText = item.success ? '✓ 成功' : '✗ 失败';
          console.log(`  ${statusColor(statusText)} ${item.fileName}`);
          console.log(`    风险等级: ${chalk.yellow(item.riskLevel)}`);
          if (item.failureReason) {
            console.log(`    失败原因: ${chalk.red(item.failureReason)}`);
          }
          if (item.requiresManualConfirm) {
            console.log(`    ${chalk.magenta('⚠ 需要人工确认')}`);
          }
        });
      }

      if (result.reused.length > 0) {
        console.log(chalk.green(`\n复用旧结论 (${result.reused.length}):`));
        result.reused.forEach(item => {
          console.log(`  ✓ ${item.material.fileName} - ${item.message}`);
        });
      }

      if (result.conflicts.length > 0) {
        console.log(chalk.yellow(`\n冲突检测 (${result.conflicts.length}):`));
        result.conflicts.forEach(item => {
          console.log(`  ⚠ ${item.material.fileName} - ${item.message}`);
        });
      }

      console.log('\n' + chalk.bold('=== 统一查询入口 ==='));
      console.log(`查询本批次详情: ${chalk.cyan(`log-validator query ${batchId}`)}`);
      console.log(`查询所有历史: ${chalk.cyan('log-validator history')}`);

    } catch (error) {
      console.error(chalk.red('错误:'), error.message);
      process.exit(1);
    }
  });

program
  .command('query <batchId>')
  .description('查询批次详情')
  .action(async (batchId) => {
    try {
      console.log(chalk.bold(`\n=== 批次详情: ${batchId} ===\n`));
      
      const detail = await ValidationService.getBatchDetail(batchId);
      
      if (!detail) {
        console.log(chalk.red('批次不存在'));
        return;
      }

      console.log(chalk.blue('批次信息:'));
      console.log(`  名称: ${detail.batch.batch_name}`);
      console.log(`  操作者: ${detail.batch.operator}`);
      console.log(`  状态: ${detail.batch.status}`);
      console.log(`  风险类型: ${detail.batch.risk_type}`);
      console.log(`  创建时间: ${new Date(detail.batch.created_at).toLocaleString()}`);

      console.log(chalk.blue(`\n材料列表 (${detail.materials.length}):`));
      detail.materials.forEach(m => {
        console.log(`  - ${m.file_name}`);
        console.log(`    ${chalk.gray(m.file_summary)}`);
      });

      console.log(chalk.blue(`\n验证结果 (${detail.results.length}):`));
      
      const successResults = detail.results.filter(r => r.status === 'success');
      const failureResults = detail.results.filter(r => r.status === 'failure');

      console.log(chalk.green(`  成功路径: ${successResults.length} 个`));
      successResults.forEach(r => {
        console.log(`    ✓ ${r.file_name} [${r.risk_level}]`);
      });

      console.log(chalk.red(`\n  异常/失败路径: ${failureResults.length} 个`));
      failureResults.forEach(r => {
        console.log(`    ✗ ${r.file_name} [${r.risk_level}]`);
        console.log(`      原因: ${r.failure_reason}`);
        if (r.requires_manual_confirm) {
          console.log(`      ${chalk.magenta('待人工确认')}`);
        }
      });

      if (detail.candidateLists.length > 0) {
        console.log(chalk.blue(`\n候选清单 (${detail.candidateLists.length}):`));
        detail.candidateLists.forEach(cl => {
          console.log(`  - ID: ${cl.id}`);
          console.log(`    类型: ${cl.action_type}`);
          console.log(`    数量: ${cl.candidates.length}`);
          console.log(`    状态: ${cl.executed ? '已执行' : '待执行'}`);
        });
      }

      console.log('\n' + chalk.bold('=== 操作入口 ==='));
      console.log(`生成清理候选清单: ${chalk.cyan(`log-validator candidate ${batchId} cleanup`)}`);
      console.log(`生成回滚候选清单: ${chalk.cyan(`log-validator candidate ${batchId} rollback`)}`);
      console.log(`按文件摘要过滤查询: ${chalk.cyan('log-validator search --summary "财务"')}`);
    } catch (error) {
      console.error(chalk.red('错误:'), error.message);
      process.exit(1);
    }
  });

program
  .command('history')
  .description('查询历史记录')
  .option('-o, --operator <operator>', '按操作者过滤')
  .option('-r, --risk <riskType>', '按风险类型过滤')
  .option('-s, --status <status>', '按状态过滤')
  .action(async (options) => {
    try {
      console.log(chalk.bold('\n=== 历史查询 ===\n'));
      
      const filters = {};
      if (options.operator) filters.operator = options.operator;
      if (options.risk) filters.riskType = options.risk;
      if (options.status) filters.status = options.status;

      const history = await ValidationService.queryHistory(filters);

      if (history.length === 0) {
        console.log(chalk.yellow('无匹配记录'));
        return;
      }

      history.forEach(item => {
        console.log(chalk.cyan(`批次: ${item.batch.id}`));
        console.log(`  名称: ${item.batch.batch_name}`);
        console.log(`  操作者: ${item.batch.operator}`);
        console.log(`  风险类型: ${item.batch.risk_type}`);
        console.log(`  结果: ${chalk.green(item.results.success)}成功 / ${chalk.red(item.results.failure)}失败`);
        console.log(`  时间: ${new Date(item.batch.created_at).toLocaleString()}`);
        console.log('');
      });

      console.log(`共 ${history.length} 条记录`);
      console.log(`\n查看批次详情: ${chalk.cyan('log-validator query <batchId>')}`);
    } catch (error) {
      console.error(chalk.red('错误:'), error.message);
      process.exit(1);
    }
  });

program
  .command('candidate <batchId> <actionType>')
  .description('生成候选清单 (cleanup/rollback)')
  .option('-o, --operator <operator>', '操作者')
  .option('-y, --yes', '跳过确认直接执行')
  .option('--no-execute', '仅生成不执行')
  .action(async (batchId, actionType, options) => {
    try {
      if (!['cleanup', 'rollback'].includes(actionType)) {
        console.log(chalk.red('动作类型必须是 cleanup 或 rollback'));
        return;
      }

      console.log(chalk.bold(`\n=== 生成${actionType === 'cleanup' ? '清理' : '回滚'}候选清单 ===\n`));

      let operator = options.operator;
      if (!operator) {
        try {
          const answers = await safePrompt([
            {
              type: 'input',
              name: 'operator',
              message: '操作者:'
            }
          ]);
          operator = answers.operator;
        } catch (promptError) {
          console.error(chalk.red('错误:'), promptError.message);
          console.log(chalk.yellow('提示: 使用 -o <operator> 参数在非交互模式下指定操作者'));
          process.exit(1);
        }
      }

      const candidateList = await ValidationService.generateCandidateList(batchId, actionType, operator);

      console.log(chalk.green(`候选清单生成成功: ${candidateList.id}`));
      console.log(`包含 ${candidateList.count} 个候选项目:\n`);

      candidateList.candidates.forEach((c, i) => {
        console.log(`${i + 1}. ${c.fileName}`);
        console.log(`   ${chalk.gray(c.fileSummary)}`);
        console.log(`   风险等级: ${chalk.yellow(c.riskLevel)}`);
        if (c.failureReason) {
          console.log(`   原因: ${chalk.red(c.failureReason)}`);
        }
        console.log('');
      });

      let confirmExecute = false;
      
      if (options.yes) {
        confirmExecute = true;
        console.log(chalk.yellow('自动确认执行（-y 模式）'));
      } else if (!options.execute) {
        console.log(chalk.yellow('仅生成模式，不执行'));
        console.log(`后续执行: ${chalk.cyan(`log-validator execute ${candidateList.id}`)}`);
        return;
      } else {
        try {
          const answers = await safePrompt([
            {
              type: 'confirm',
              name: 'confirmExecute',
              message: '确认执行此候选清单? (建议先人工审核)',
              default: false
            }
          ]);
          confirmExecute = answers.confirmExecute;
        } catch (promptError) {
          console.log(chalk.yellow('未执行操作'));
          console.log(`后续执行: ${chalk.cyan(`log-validator execute ${candidateList.id}`)}`);
          console.log(chalk.gray(`或使用: log-validator candidate ${batchId} ${actionType} -o ${operator} -y 自动执行`));
          return;
        }
      }

      if (confirmExecute) {
        const result = await ValidationService.executeCandidateList(candidateList.id);
        console.log(chalk.green(`\n✓ 执行成功! 处理了 ${result.count} 个项目`));
      } else {
        console.log(chalk.yellow('\n已取消执行'));
        console.log(`后续执行: ${chalk.cyan(`log-validator execute ${candidateList.id}`)}`);
      }
    } catch (error) {
      console.error(chalk.red('错误:'), error.message);
      process.exit(1);
    }
  });

program
  .command('execute <candidateListId>')
  .description('执行候选清单')
  .option('-y, --yes', '跳过确认直接执行')
  .action(async (candidateListId, options) => {
    try {
      const candidateList = await ValidationService.getCandidateList(candidateListId);

      if (!candidateList) {
        console.log(chalk.red('候选清单不存在'));
        return;
      }

      console.log(chalk.bold('\n=== 候选清单详情 ===\n'));
      console.log(`ID: ${candidateList.id}`);
      console.log(`类型: ${candidateList.action_type}`);
      console.log(`数量: ${candidateList.candidates.length}`);
      console.log(`状态: ${candidateList.executed ? '已执行' : '待执行'}`);

      if (candidateList.executed) {
        console.log(chalk.yellow('此候选清单已执行过'));
        return;
      }

      console.log(chalk.yellow('\n候选项目:'));
      candidateList.candidates.forEach((c, i) => {
        console.log(`  ${i + 1}. ${c.fileName}`);
      });

      let confirmed = false;
      
      if (options.yes) {
        confirmed = true;
        console.log(chalk.yellow('\n自动确认执行（-y 模式）'));
      } else {
        try {
          const answers = await safePrompt([
            {
              type: 'confirm',
              name: 'confirm',
              message: '确认执行?',
              default: false
            }
          ]);
          confirmed = answers.confirm;
        } catch (promptError) {
          console.log(chalk.yellow('\n未执行操作。使用 -y 参数在非交互模式下自动确认执行'));
          console.log(chalk.cyan(`示例: log-validator execute ${candidateListId} -y`));
          return;
        }
      }

      if (confirmed) {
        const result = await ValidationService.executeCandidateList(candidateListId);
        console.log(chalk.green(`\n✓ 执行成功!`));
      }
    } catch (error) {
      console.error(chalk.red('错误:'), error.message);
      process.exit(1);
    }
  });

program
  .command('search')
  .description('搜索查询')
  .option('--summary <keyword>', '按文件摘要搜索')
  .option('--pending', '只显示待人工确认的项目')
  .action(async (options) => {
    try {
      console.log(chalk.bold('\n=== 搜索结果 ===\n'));

      if (options.pending) {
        const pending = await ValidationService.getPendingManualConfirm();
        console.log(chalk.magenta(`待人工确认项目 (${pending.length}):\n`));
        
        pending.forEach(p => {
          console.log(`  ID: ${p.id}`);
          console.log(`  文件名: ${p.file_name}`);
          console.log(`  文件摘要: ${p.file_summary}`);
          console.log(`  确认: ${chalk.cyan(`log-validator confirm ${p.id}`)}`);
          console.log('');
        });
        return;
      }

      if (options.summary) {
        const results = await ValidationService.queryByFileSummary(options.summary);
        console.log(chalk.blue(`按文件摘要"${options.summary}"搜索到 ${results.length} 个结果:\n`));
        
        results.forEach(r => {
          console.log(`  文件: ${r.material.file_name}`);
          console.log(`  摘要: ${chalk.gray(r.material.file_summary)}`);
          console.log(`  批次ID: ${r.material.batch_id}`);
          
          r.validationResults.forEach(vr => {
            const statusColor = vr.status === 'success' ? chalk.green : chalk.red;
            console.log(`  结果: ${statusColor(vr.status)} [${vr.risk_level}]`);
            if (vr.requires_manual_confirm && !vr.manually_confirmed) {
              console.log(`  ${chalk.magenta('  ⚠ 待人工确认')}`);
            }
          });
          console.log('');
        });
      }
    } catch (error) {
      console.error(chalk.red('错误:'), error.message);
      process.exit(1);
    }
  });

program
  .command('confirm <resultId>')
  .description('人工确认验证结果')
  .option('-b, --by <confirmedBy>', '确认人')
  .action(async (resultId, options) => {
    try {
      let confirmedBy = options.by;
      
      if (!confirmedBy) {
        try {
          const answers = await safePrompt([
            {
              type: 'input',
              name: 'confirmedBy',
              message: '确认人:'
            }
          ]);
          confirmedBy = answers.confirmedBy;
        } catch (promptError) {
          console.error(chalk.red('错误:'), promptError.message);
          console.log(chalk.yellow('提示: 使用 -b <确认人> 参数在非交互模式下指定'));
          process.exit(1);
        }
      }

      await ValidationService.confirmManual(resultId, confirmedBy);
      console.log(chalk.green('✓ 人工确认完成'));
    } catch (error) {
      console.error(chalk.red('错误:'), error.message);
      process.exit(1);
    }
  });

async function main() {
  await program.parseAsync(process.argv);
}

main().catch(err => {
  console.error(chalk.red('致命错误:'), err.message);
  process.exit(1);
});
