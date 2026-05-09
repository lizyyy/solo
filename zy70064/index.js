const yargs = require('yargs');
const { hideBin } = require('yargs/helpers');
const db = require('./db');
const service = require('./service');

function printResult(result) {
  if (result.success) {
    console.log('✅', result.message);
    if (result.details) {
      console.log('   详情:', JSON.stringify(result.details, null, 2));
    }
  }
}

function printError(err) {
  console.error('❌', err.message);
}

function printTable(data) {
  if (!data || data.length === 0) {
    console.log('（无数据）');
    return;
  }
  
  const keys = Object.keys(data[0]);
  const widths = keys.map(k => Math.max(k.length, ...data.map(r => String(r[k] || '').length)));
  
  console.log(keys.map((k, i) => k.padEnd(widths[i])).join(' | '));
  console.log('-'.repeat(widths.reduce((a, b) => a + b, 0) + keys.length * 3 - 1));
  
  for (const row of data) {
    console.log(keys.map((k, i) => String(row[k] || '').padEnd(widths[i])).join(' | '));
  }
}

async function main() {
  await db.initDB();

  const argv = yargs(hideBin(process.argv))
    .command('create-position <name> <quota>', '创建实习岗位', (yargs) => {
      yargs
        .positional('name', { describe: '岗位名称', type: 'string' })
        .positional('quota', { describe: '总名额', type: 'number' });
    })
    .command('list-positions', '查看所有岗位')
    .command('lock <position> <college> <student>', '推荐锁定名额', (yargs) => {
      yargs
        .positional('position', { describe: '岗位名称', type: 'string' })
        .positional('college', { describe: '学院名称', type: 'string' })
        .positional('student', { describe: '学生姓名', type: 'string' })
        .option('duration', { alias: 'd', describe: '锁定时长（分钟）', type: 'number', default: service.DEFAULT_LOCK_DURATION_MINUTES });
    })
    .command('interview <position> <college> <student> <round> <result>', '更新面试结果', (yargs) => {
      yargs
        .positional('position', { describe: '岗位名称', type: 'string' })
        .positional('college', { describe: '学院名称', type: 'string' })
        .positional('student', { describe: '学生姓名', type: 'string' })
        .positional('round', { describe: '面试轮次', type: 'number' })
        .positional('result', { describe: '结果：PASSED/FAILED', type: 'string', choices: ['PASSED', 'FAILED'] })
        .option('notes', { alias: 'n', describe: '备注', type: 'string', default: '' });
    })
    .command('confirm <position> <college> <student>', '确认录用', (yargs) => {
      yargs
        .positional('position', { describe: '岗位名称', type: 'string' })
        .positional('college', { describe: '学院名称', type: 'string' })
        .positional('student', { describe: '学生姓名', type: 'string' });
    })
    .command('withdraw <position> <college> <student>', '撤回推荐', (yargs) => {
      yargs
        .positional('position', { describe: '岗位名称', type: 'string' })
        .positional('college', { describe: '学院名称', type: 'string' })
        .positional('student', { describe: '学生姓名', type: 'string' })
        .option('reason', { alias: 'r', describe: '撤回原因', type: 'string', default: '' });
    })
    .command('process-timeout', '处理超时锁定（后台任务）')
    .command('stats', '查看学院统计')
    .command('list-locks', '查看锁定记录', (yargs) => {
      yargs
        .option('college', { alias: 'c', describe: '按学院筛选', type: 'string' })
        .option('status', { alias: 's', describe: '按状态筛选', type: 'string', choices: Object.values(service.LOCK_STATUS) });
    })
    .command('logs [limit]', '查看审计日志', (yargs) => {
      yargs.positional('limit', { describe: '显示条数', type: 'number', default: 50 });
    })
    .demandCommand(1, '请指定一个命令')
    .help()
    .argv;

  const command = argv._[0];

  try {
    switch (command) {
      case 'create-position':
        printResult(await service.createPosition(argv.name, argv.quota));
        break;
      
      case 'list-positions':
        printTable(await service.listPositions());
        break;
      
      case 'lock':
        printResult(await service.createLock(argv.position, argv.college, argv.student, argv.duration));
        break;
      
      case 'interview':
        printResult(await service.updateInterview(argv.position, argv.college, argv.student, argv.round, argv.result, argv.notes));
        break;
      
      case 'confirm':
        printResult(await service.confirmAcceptance(argv.position, argv.college, argv.student));
        break;
      
      case 'withdraw':
        printResult(await service.withdrawLock(argv.position, argv.college, argv.student, argv.reason));
        break;
      
      case 'process-timeout':
        const timeoutResults = await service.processTimeout();
        if (timeoutResults.length === 0) {
          console.log('✅ 没有需要处理的超时锁定');
        } else {
          console.log(`✅ 已处理 ${timeoutResults.length} 个超时锁定：`);
          timeoutResults.forEach(r => console.log(`   - ${r.college} - ${r.studentName} -> ${r.positionName}`));
        }
        break;
      
      case 'stats':
        printTable(await service.getCollegeStats());
        break;
      
      case 'list-locks':
        printTable(await service.listLocks(argv.college, argv.status));
        break;
      
      case 'logs':
        printTable(await service.listAuditLogs(argv.limit));
        break;
      
      default:
        console.log('未知命令:', command);
    }
  } catch (err) {
    printError(err);
    process.exit(1);
  } finally {
    await db.closeDB();
  }
}

main().catch(err => {
  console.error('程序运行出错:', err);
  process.exit(1);
});
