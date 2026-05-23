const { sequelize, Batch, LossRecord } = require('../src/models');
const { ReplayService } = require('../src/services');
const chalk = require('chalk');
const Table = require('cli-table3');

async function replay() {
  console.log(chalk.blue('\n╔════════════════════════════════════════════════════════════╗'));
  console.log(chalk.blue('║                   生鲜分拣损耗异常回放工具                   ║'));
  console.log(chalk.blue('╚════════════════════════════════════════════════════════════╝\n'));

  try {
    await sequelize.sync();

    const batches = await Batch.findAll({ limit: 3 });
    
    if (batches.length === 0) {
      console.log(chalk.yellow('没有找到批次数据，请先运行: npm run seed'));
      process.exit(0);
    }

    console.log(chalk.yellow('异常损耗列表:'));
    const anomalies = await ReplayService.getAnomalyList({ pageSize: 10 });
    
    if (anomalies.total === 0) {
      console.log(chalk.yellow('  没有异常记录'));
    } else {
      const table = new Table({
        head: [chalk.cyan('记录号'), chalk.cyan('类型'), chalk.cyan('商品'), chalk.cyan('损耗重量'), chalk.cyan('扣款金额'), chalk.cyan('改判')],
        colWidths: [25, 18, 15, 12, 12, 8]
      });

      for (const loss of anomalies.list) {
        table.push([
          loss.lossNo,
          loss.lossType === 'bad_fruit' ? '坏果扣款' : loss.lossType === 'secondary_sorting' ? '二次分拣' : '其他',
          loss.productName,
          `${loss.lossWeight}kg`,
          `${loss.deductionAmount || 0}元`,
          loss.isManualAdjusted ? chalk.red('是') : '否'
        ]);
      }
      console.log(table.toString());
    }

    const batchId = batches[0].id;
    console.log(chalk.yellow(`\n回放批次时间线: ${batches[0].batchNo}`));
    
    const timeline = await ReplayService.getReplayTimeline(batchId);
    
    const timelineTable = new Table({
      head: [chalk.cyan('时间'), chalk.cyan('操作人'), chalk.cyan('操作'), chalk.cyan('实体'), chalk.cyan('备注')],
      colWidths: [22, 15, 12, 15, 25]
    });

    for (const event of timeline.timeline) {
      timelineTable.push([
        new Date(event.timestamp).toLocaleTimeString(),
        event.operator,
        event.action,
        event.entityType,
        event.remark || event.actionDetail || '-'
      ]);
    }
    console.log(timelineTable.toString());

    console.log(chalk.yellow('\n状态快照变化:'));
    const snapshotTable = new Table({
      head: [chalk.cyan('时间'), chalk.cyan('事件'), chalk.cyan('送货单'), chalk.cyan('称重'), chalk.cyan('照片'), chalk.cyan('损耗'), chalk.cyan('总损耗')],
      colWidths: [22, 25, 10, 10, 10, 10, 12]
    });

    for (const snapshot of timeline.stateSnapshots) {
      snapshotTable.push([
        new Date(snapshot.timestamp).toLocaleTimeString(),
        snapshot.event,
        snapshot.state.deliveryNoteCount,
        snapshot.state.weighingRecordCount,
        snapshot.state.photoCount,
        snapshot.state.lossRecordCount,
        `${snapshot.state.totalLossWeight.toFixed(2)}kg`
      ]);
    }
    console.log(snapshotTable.toString());

    if (anomalies.total > 0) {
      const lossId = anomalies.list[0].id;
      console.log(chalk.yellow(`\n损耗详情追踪: ${anomalies.list[0].lossNo}`));
      
      const lossDetail = await ReplayService.getLossDetail(lossId);
      
      console.log(chalk.cyan('  版本历史:'));
      for (const version of lossDetail.versionHistory) {
        console.log(chalk.gray(`    V${version.version}: ${version.lossWeight}kg / ${version.deductionAmount}元 / ${version.status}`));
        if (version.isManualAdjusted) {
          console.log(chalk.red(`        → 人工改判: ${version.manualAdjustReason} (by ${version.adjustedBy})`));
        }
      }
    }

    console.log(chalk.green('\n═══════════════════════════════════════════════════════════════'));
    console.log(chalk.green('                      回放完成!'));
    console.log(chalk.green('═══════════════════════════════════════════════════════════════\n'));

    console.log(chalk.cyan('提示:'));
    console.log(chalk.cyan('  所有操作均有审计记录，可追溯谁在什么时候修改了什么'));
    console.log(chalk.cyan('  人工改判记录保留版本历史，可查看前后差异\n'));

    process.exit(0);
  } catch (error) {
    console.error(chalk.red('\n回放失败:'), error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

replay();
