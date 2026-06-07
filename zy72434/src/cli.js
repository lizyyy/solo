const chalk = require('chalk');
const core = require('./core');

const args = process.argv.slice(2);
const command = args[0] || 'help';

const STATUS_LABELS = {
  pending_review: chalk.yellow('待复核'),
  needs_more_info: chalk.magenta('缺材料'),
  confirmed: chalk.green('已确认'),
  flagged: chalk.red('标红待处理'),
};

const ACTION_LABELS = {
  ask_music_teacher: '找音乐老师',
  ask_amei: '找巡演统筹阿梅',
  wait_license: '等授权',
  ok_ready: '没问题了',
};

function printHelp() {
  console.log(`
${chalk.bold('🎷 爵士即兴段落标注系统 - CLI')}

${chalk.underline('用法:')}
  node src/cli.js <command> [options]

${chalk.underline('命令:')}
  list [status]           列出所有标注（可按状态过滤）
  detail <id>             查看某条标注的详细信息（含授权页和调音师留言）
  import-license <file>   从JSON文件导入授权期限页
  import-note <file>      从JSON文件导入调音师留言
  review <id> <decision>  音乐老师复核（decision: confirm_same_song / need_more_info / different_songs）
  report                  生成店长周报
  seed                    载入示例数据，走一遍完整流程
  help                    显示帮助

${chalk.underline('示例:')}
  node src/cli.js list
  node src/cli.js list flagged
  node src/cli.js detail abc123
  node src/cli.js report
  `);
}

function cmdList() {
  const status = args[1];
  const list = core.listAnnotations(status);
  if (list.length === 0) {
    console.log(chalk.gray('还没有标注记录，先用 import-license 导入授权期限页吧'));
    return;
  }
  console.log(`\n${chalk.bold('📋 标注列表')}${status ? ` (${status})` : ''}\n`);
  for (const item of list) {
    const conflict = item.hasNameConflict ? chalk.red(' ⚠️ 曲名冲突') : '';
    console.log(
      `  ${chalk.gray(item.id.slice(0, 8))}  ${STATUS_LABELS[item.status]}${conflict}`
    );
    console.log(`     现场名: ${item.liveName || chalk.gray('(未填)')}`);
    console.log(`     版权名: ${item.copyrightName || chalk.gray('(未填)')}`);
    console.log(`     下一步: ${ACTION_LABELS[item.nextAction]}`);
    console.log();
  }
}

function cmdDetail() {
  const id = args[1];
  if (!id) {
    console.log(chalk.red('请传入标注 ID，例如: node src/cli.js detail abc123'));
    return;
  }
  const detail = core.getAnnotationDetail(id);
  if (!detail) {
    console.log(chalk.red('找不到这条标注'));
    return;
  }
  const { annotation, song, licenses, engineerNotes } = detail;

  console.log(`\n${chalk.bold('🔍 标注详情')} ${chalk.gray(id)}\n`);
  console.log(`  状态: ${STATUS_LABELS[annotation.status]}`);
  console.log(`  现场名: ${song.liveName || chalk.gray('(未填)')}`);
  console.log(`  版权名: ${song.copyrightName || chalk.gray('(未填)')}`);
  if (annotation.hasNameConflict) {
    console.log(`  ${chalk.red('⚠️  曲名冲突：现场名 ≠ 版权名，留给音乐老师复核')}`);
  }
  console.log();

  console.log(chalk.underline('📄 关联的授权期限页：'));
  if (licenses.length === 0) {
    console.log(`  ${chalk.gray('(还没有关联授权)')}`);
  }
  for (const lic of licenses) {
    console.log(`  ✅ 版权方: ${lic.copyrightOwner}`);
    console.log(`     版权名: ${lic.copyrightName}`);
    console.log(`     有效期: ${lic.validFrom} ~ ${lic.validTo}`);
    console.log(`     地区: ${lic.territory}`);
    console.log();
  }

  console.log(chalk.underline('🎛️  调音师留言：'));
  if (engineerNotes.length === 0) {
    console.log(`  ${chalk.gray('(还没有调音师留言)')}`);
  }
  for (const note of engineerNotes) {
    console.log(`  🎧 调音师: ${note.engineerName} | 场地: ${note.venue} | 日期: ${note.date}`);
    console.log(`     现场曲名: ${note.liveName}`);
    console.log(`     留言: ${note.noteText}`);
    console.log();
  }

  console.log(chalk.underline('📝 标注记录：'));
  console.log(`  留下原因: ${annotation.reason || chalk.gray('(无)')}`);
  console.log(`  缺材料: ${annotation.missingMaterials.length > 0 ? annotation.missingMaterials.join('、') : chalk.gray('不缺')}`);
  console.log(`  下一步: ${ACTION_LABELS[annotation.nextAction]}`);
  console.log(`  复核人: ${annotation.reviewedBy || chalk.gray('(还没人复核)')}`);
  console.log(`  更新时间: ${new Date(annotation.updatedAt).toLocaleString('zh-CN')}`);
  console.log();
}

function cmdImportLicense() {
  const file = args[1];
  if (!file) {
    console.log(chalk.red('请传入文件路径，例如: node src/cli.js import-license sample-licenses.json'));
    return;
  }
  try {
    const data = require(file.startsWith('/') ? file : './' + file);
    const result = core.importLicenses(Array.isArray(data) ? data : [data]);
    console.log(chalk.green(`✅ 成功导入 ${result.length} 条授权期限记录`));
    for (const r of result) {
      console.log(`  标注ID: ${r.annotationId.slice(0, 8)}`);
    }
  } catch (e) {
    console.log(chalk.red('导入失败: ' + e.message));
  }
}

function cmdImportNote() {
  const file = args[1];
  if (!file) {
    console.log(chalk.red('请传入文件路径，例如: node src/cli.js import-note sample-notes.json'));
    return;
  }
  try {
    const data = require(file.startsWith('/') ? file : './' + file);
    const result = core.importEngineerNotes(Array.isArray(data) ? data : [data]);
    console.log(chalk.green(`✅ 成功导入 ${result.length} 条调音师留言`));
    for (const r of result) {
      if (r.hasConflict) {
        console.log(`  ${chalk.red('⚠️  曲名冲突')} 标注ID: ${r.annotationId.slice(0, 8)} - 已标红，留给音乐老师复核`);
      } else {
        console.log(`  标注ID: ${r.annotationId.slice(0, 8)}`);
      }
    }
  } catch (e) {
    console.log(chalk.red('导入失败: ' + e.message));
  }
}

function cmdReview() {
  const id = args[1];
  const decision = args[2];
  const feedback = args.slice(3).join(' ');
  if (!id || !decision) {
    console.log(chalk.red('用法: node src/cli.js review <id> <decision> [feedback]'));
    console.log('  decision 可选: confirm_same_song | need_more_info | different_songs');
    return;
  }
  const result = core.reviewAnnotation(id, '音乐老师（CLI）', decision, feedback);
  if (!result) {
    console.log(chalk.red('找不到这条标注'));
    return;
  }
  console.log(chalk.green('✅ 复核完成'));
  console.log(`  新状态: ${STATUS_LABELS[result.status]}`);
  console.log(`  下一步: ${ACTION_LABELS[result.nextAction]}`);
  console.log(`  备注: ${result.reason}`);
}

function cmdReport() {
  const report = core.getWeeklyReport();
  const s = report.summary;

  console.log(`\n${chalk.bold('📊 店长周报 - 爵士即兴段落标注')}`);
  console.log(`${chalk.gray('生成时间: ' + new Date(report.generatedAt).toLocaleString('zh-CN'))}\n`);

  console.log(chalk.underline('📈 本周概览：'));
  console.log(`  总曲目数: ${s.total}`);
  console.log(`  ${chalk.green('已确认可用: ' + s.confirmed)}`);
  console.log(`  ${chalk.yellow('待复核: ' + s.pending)}`);
  console.log(`  ${chalk.red('标红待处理: ' + s.flagged)}`);
  console.log(`  ${chalk.magenta('缺材料: ' + s.needsInfo)}`);
  console.log(`  ${chalk.red('⚠️  曲名冲突: ' + s.hasNameConflict + ' 条（先别归正常，留给音乐老师）')}`);
  console.log();

  console.log(chalk.underline('🎯 下一步分工：'));
  console.log(`  找音乐老师确认: ${s.nextActionBreakdown.askMusicTeacher} 条`);
  console.log(`  找巡演统筹阿梅补材料: ${s.nextActionBreakdown.askAmei} 条`);
  console.log(`  已搞定: ${s.nextActionBreakdown.ready} 条`);
  console.log();

  if (report.flaggedItems.length > 0) {
    console.log(chalk.red(chalk.underline('🚨 需要特别注意的曲目：')));
    console.log(chalk.gray('（这些同一首歌有现场名和版权名，先别急着归正常）\n'));
    for (const item of report.flaggedItems) {
      console.log(`  ${chalk.red('⚠')}  ${item.liveName} / ${item.copyrightName}`);
      console.log(`     留下原因: ${item.reason}`);
      console.log(`     还缺材料: ${item.missingMaterials.join('、')}`);
      console.log(`     下一步: ${ACTION_LABELS[item.nextAction]}`);
      if (item.licenses.length > 0) {
        console.log(`     授权方: ${item.licenses.map(l => l.owner + '（至' + l.validTo + '）').join(', ')}`);
      }
      console.log();
    }
  }

  console.log(chalk.gray('---'));
  for (const note of report.notes) {
    console.log(chalk.gray('💡 ' + note));
  }
  console.log();
}

function cmdSeed() {
  console.log(chalk.blue('🌱 正在载入示例数据，走一遍完整流程...\n'));

  console.log(chalk.gray('第一步：导入授权期限页（版权方给的正式名单）'));
  const licenses = [
    { copyrightName: 'Autumn Leaves', copyrightOwner: 'Warner Chappell', validFrom: '2026-01-01', validTo: '2026-12-31', territory: '中国大陆' },
    { copyrightName: 'Take Five', copyrightOwner: 'Sony/ATV', validFrom: '2026-01-01', validTo: '2026-06-30', territory: '中国大陆' },
    { copyrightName: 'So What', copyrightOwner: 'Sony/ATV', validFrom: '2026-01-01', validTo: '2026-12-31', territory: '中国大陆' },
  ];
  const licResult = core.importLicenses(licenses);
  console.log(chalk.green(`  ✅ 导入了 ${licResult.length} 条授权，生成了 ${licResult.length} 条待复核标注\n`));

  console.log(chalk.gray('第二步：导入调音师留言（现场演出时记下的名字）'));
  const notes = [
    { liveName: '秋叶', copyrightName: 'Autumn Leaves', engineerName: '老王', noteText: '这首有3分钟即兴solo段，萨克斯，观众反应很好', venue: 'Blue Note Beijing', date: '2026-05-10' },
    { liveName: 'Take Five', engineerName: '老张', noteText: '5/4拍那段即兴很稳，鼓和钢琴配合好', venue: 'Jazz Club Shanghai', date: '2026-05-15' },
    { liveName: '那又怎样', copyrightName: 'So What', engineerName: '老李', noteText: '钢琴手即兴了8分钟，大家都疯了', venue: 'Jazz Club Shanghai', date: '2026-05-15' },
  ];
  const noteResult = core.importEngineerNotes(notes);
  const conflicts = noteResult.filter(r => r.hasConflict).length;
  console.log(chalk.green(`  ✅ 导入了 ${noteResult.length} 条调音师留言`));
  if (conflicts > 0) {
    console.log(chalk.red(`  ⚠️  发现 ${conflicts} 条曲名冲突！（现场叫的名字和版权名不一样）`));
    console.log(chalk.red(`     已经标红，留给音乐老师复核，别急着归正常\n`));
  }

  console.log(chalk.gray('现在的标注状态：\n'));
  cmdList();

  console.log(chalk.blue('\n🎉 示例数据已载入完成！'));
  console.log(chalk.gray('试试下面的命令：'));
  console.log('  node src/cli.js list flagged   - 只看标红的');
  console.log('  node src/cli.js detail <id>    - 看某条详情，能回到授权页和调音师留言');
  console.log('  node src/cli.js report         - 看给店长的周报');
  console.log();
}

switch (command) {
  case 'list': cmdList(); break;
  case 'detail': cmdDetail(); break;
  case 'import-license': cmdImportLicense(); break;
  case 'import-note': cmdImportNote(); break;
  case 'review': cmdReview(); break;
  case 'report': cmdReport(); break;
  case 'seed': cmdSeed(); break;
  case 'help': default: printHelp(); break;
}
