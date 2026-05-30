import { Command } from 'commander';
import { loadFromDirectory } from './loader.js';
import { validateAll } from './validator.js';
import { schedule } from './scheduler.js';
import { generateReport, writeReport, formatTerminalSummary } from './reporter.js';

const program = new Command();

program
  .name('studio-booking')
  .description('录音棚预约冲突板 - 检测房间重叠、工程师双约、设备缺失')
  .version('1.0.0')
  .requiredOption('-i, --input <dir>', '输入目录（含预约单、房间清单等数据文件）')
  .requiredOption('-o, --output <dir>', '输出目录（报告输出位置）')
  .option('--strict', '严格模式：有校验异常的记录不参与调度', false)
  .action((options) => {
    const inputDir = options.input as string;
    const outputDir = options.output as string;

    console.log(`📂 输入目录: ${inputDir}`);
    console.log(`📂 输出目录: ${outputDir}`);
    console.log('');

    const data = loadFromDirectory(inputDir);

    if (data.loadErrors.length > 0) {
      console.log('⚠️  部分文件加载失败:');
      for (const err of data.loadErrors) {
        console.log(`   ${err.file}: ${err.error}`);
      }
      console.log('');
    }

    console.log(`📥 已加载: ${data.bookings.length} 条预约, ${data.rooms.length} 个房间, ${data.engineers.length} 位工程师, ${data.equipment.length} 项设备, ${data.customerNotes.length} 条备注, ${data.legacyConflicts.length} 条历史冲突`);
    console.log('');

    const validationResults = validateAll(data.bookings, data.rooms, data.engineers, data.equipment);

    let bookingsToProcess = data.bookings;
    if (options.strict) {
      const invalidIds = new Set(
        validationResults.filter(v => !v.valid && v.recordType === 'booking').map(v => v.recordId)
      );
      bookingsToProcess = data.bookings.filter(b => !invalidIds.has(b.id));
      const removed = data.bookings.length - bookingsToProcess.length;
      if (removed > 0) {
        console.log(`🚫 严格模式: 跳过 ${removed} 条校验异常的预约`);
      }
    }

    const scheduleResult = schedule(
      bookingsToProcess,
      data.rooms,
      data.engineers,
      data.equipment,
      data.customerNotes,
      data.legacyConflicts,
      validationResults
    );

    const report = generateReport(
      inputDir,
      outputDir,
      validationResults,
      scheduleResult.processingResults,
      scheduleResult.allConflicts,
      scheduleResult.allReschedules.length,
      bookingsToProcess.length,
      { length: scheduleResult.allLocks.length }
    );

    report.rescheduleLogs = scheduleResult.allReschedules;
    report.resourceLocks = scheduleResult.allLocks;

    const outputFiles = writeReport(report, outputDir);

    console.log(formatTerminalSummary(report));
    console.log('');
    console.log('📄 输出文件:');
    for (const f of outputFiles) {
      console.log(`   ${f}`);
    }
  });

program.parse();
