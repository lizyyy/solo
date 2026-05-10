const { Command } = require('commander');
const lineService = require('../services/lineService');
const studentService = require('../services/studentService');
const driverService = require('../services/driverService');
const diversionService = require('../services/diversionService');
const notificationService = require('../services/notificationService');
const exportService = require('../services/exportService');
const { today } = require('../utils/dateUtil');

const program = new Command();

function createCli() {
  program
    .name('schoolbus')
    .description('校车临时改线通知 CLI')
    .version('1.0.0');

  const lineCmd = program.command('line')
    .description('线路管理');

  lineCmd.command('create')
    .description('创建新线路')
    .argument('<code>', '线路代码（如：L1、L2）')
    .argument('<name>', '线路名称')
    .option('-d, --description <text>', '线路描述')
    .action(async (code, name, options) => {
      const result = lineService.createLine(code, name, options.description || '');
      if (result.success) {
        console.log(`✓ 线路创建成功：${result.line.code} - ${result.line.name}`);
      } else {
        console.log(`⚠ ${result.error}`);
      }
    });

  lineCmd.command('add-stop')
    .description('添加站点到线路')
    .argument('<lineCode>', '线路代码')
    .argument('<stopCode>', '站点代码')
    .argument('<stopName>', '站点名称')
    .argument('<order>', '站点顺序')
    .option('-a, --address <text>', '站点地址')
    .action(async (lineCode, stopCode, stopName, order, options) => {
      const result = lineService.addStopToLine(lineCode, stopCode, stopName, options.address || '', parseInt(order));
      if (result.success) {
        console.log(`✓ 站点添加成功：${result.stop.code} - ${result.stop.name}`);
      } else {
        console.log(`⚠ ${result.error}`);
      }
    });

  lineCmd.command('list')
    .description('列出所有线路')
    .option('-a, --all', '包含已停用线路')
    .action(async (options) => {
      const lines = lineService.listLines(!!options.all);
      console.log(`\n共有 ${lines.length} 条线路：`);
      for (const line of lines) {
        const status = line.isActive ? '' : ' [已停用]';
        console.log(`  ${line.code} - ${line.name}${status}`);
      }
      console.log('');
    });

  lineCmd.command('show')
    .description('显示线路详情')
    .argument('<lineCode>', '线路代码')
    .option('-s, --students', '显示学生列表')
    .option('-d, --date <date>', '日期（默认今天）', today())
    .action(async (lineCode, options) => {
      if (options.students) {
        const details = lineService.getLineWithStudents(lineCode, options.date);
        if (!details) {
          console.log(`⚠ 线路不存在`);
          return;
        }
        console.log(`\n线路：${details.line.code} - ${details.line.name}`);
        for (const stop of details.stops) {
          const students = stop.students || [];
          console.log(`\n  ${stop.code} - ${stop.name} (${students.length}人)`);
          for (const s of students) {
            console.log(`    - ${s.name} (${s.grade}${s.class})`);
          }
        }
        console.log('');
      } else {
        const details = lineService.getLineDetails(lineCode);
        if (!details) {
          console.log(`⚠ 线路不存在`);
          return;
        }
        console.log(`\n线路：${details.line.code} - ${details.line.name}`);
        console.log(`描述：${details.line.description || '无'}`);
        console.log('\n站点：');
        for (const stop of details.stops) {
          const status = stop.isActive ? '' : ' [已停用]';
          console.log(`  ${stop.order}. ${stop.code} - ${stop.name}${status}`);
        }
        console.log('');
      }
    });

  const studentCmd = program.command('student')
    .description('学生管理');

  studentCmd.command('create')
    .description('创建学生')
    .argument('<studentId>', '学生编号')
    .argument('<name>', '学生姓名')
    .argument('<grade>', '年级')
    .argument('<class>', '班级')
    .action(async (studentId, name, grade, classInfo) => {
      const result = studentService.createStudent(studentId, name, grade, classInfo);
      if (result.success) {
        console.log(`✓ 学生创建成功：${result.student.studentId} - ${result.student.name}`);
      } else {
        console.log(`⚠ ${result.error}`);
      }
    });

  studentCmd.command('add-parent')
    .description('添加家长联系人')
    .argument('<studentId>', '学生编号')
    .argument('<name>', '家长姓名')
    .argument('<phone>', '联系电话')
    .argument('<relationship>', '关系（如：父亲、母亲）')
    .action(async (studentId, name, phone, relationship) => {
      const result = studentService.addParent(studentId, name, phone, relationship);
      if (result.success) {
        console.log(`✓ 家长添加成功：${result.parent.name} (${result.parent.phone})`);
      } else {
        console.log(`⚠ ${result.error}`);
      }
    });

  studentCmd.command('assign')
    .description('分配学生到线路站点')
    .argument('<studentId>', '学生编号')
    .argument('<lineCode>', '线路代码')
    .argument('<stopCode>', '站点代码')
    .action(async (studentId, lineCode, stopCode) => {
      const result = studentService.assignStudentToLine(studentId, lineCode, stopCode);
      if (result.success) {
        if (result.warning) {
          console.log(`⚠ ${result.warning}`);
        }
        console.log(`✓ 学生分配成功`);
      } else {
        console.log(`⚠ ${result.error}`);
      }
    });

  studentCmd.command('change-stop')
    .description('更改学生当前站点')
    .argument('<studentId>', '学生编号')
    .argument('<lineCode>', '线路代码')
    .argument('<newStopCode>', '新站点代码')
    .option('-u, --update-default', '同时更新默认站点')
    .action(async (studentId, lineCode, newStopCode, options) => {
      const result = studentService.changeStudentStop(studentId, lineCode, newStopCode, !!options.updateDefault);
      if (result.success) {
        console.log(`✓ 站点更改成功`);
      } else {
        console.log(`⚠ ${result.error}`);
      }
    });

  studentCmd.command('reset-stop')
    .description('将学生站点恢复为默认')
    .argument('<studentId>', '学生编号')
    .argument('<lineCode>', '线路代码')
    .action(async (studentId, lineCode) => {
      const result = studentService.resetStudentToDefaultStop(studentId, lineCode);
      if (result.success) {
        if (result.unchanged) {
          console.log(`ℹ ${result.message}`);
        } else {
          console.log(`✓ 已恢复到默认站点`);
        }
      } else {
        console.log(`⚠ ${result.error}`);
      }
    });

  studentCmd.command('leave')
    .description('添加请假记录')
    .argument('<studentId>', '学生编号')
    .argument('<date>', '请假日期（YYYY-MM-DD）')
    .option('-n, --note <text>', '请假原因')
    .action(async (studentId, date, options) => {
      const result = studentService.addLeave(studentId, date, options.note || '');
      if (result.success) {
        console.log(`✓ 请假记录添加成功`);
      } else {
        console.log(`⚠ ${result.error}`);
      }
    });

  studentCmd.command('list')
    .description('列出所有学生')
    .option('-a, --all', '包含已停用学生')
    .action(async (options) => {
      const students = studentService.listStudents(!!options.all);
      console.log(`\n共有 ${students.length} 名学生：`);
      for (const s of students) {
        const status = s.isActive ? '' : ' [已停用]';
        console.log(`  ${s.studentId} - ${s.name} (${s.grade}${s.class})${status}`);
      }
      console.log('');
    });

  studentCmd.command('show')
    .description('显示学生详情')
    .argument('<studentId>', '学生编号')
    .action(async (studentId) => {
      const details = studentService.getStudentDetails(studentId);
      if (!details) {
        console.log(`⚠ 学生不存在`);
        return;
      }
      console.log(`\n学生：${details.student.studentId} - ${details.student.name}`);
      console.log(`年级班级：${details.student.grade}${details.student.class}`);

      console.log(`\n线路分配：`);
      for (const sl of details.lines) {
        console.log(`  ${sl.lineCode} - ${sl.lineName}：`);
        console.log(`    默认站点：${sl.defaultStopCode} - ${sl.defaultStopName}`);
        console.log(`    当前站点：${sl.stopCode} - ${sl.stopName}`);
      }

      console.log(`\n家长联系人：`);
      if (details.parents.length > 0) {
        for (const p of details.parents) {
          console.log(`  ${p.name} (${p.relationship}) - ${p.phone}`);
        }
      } else {
        console.log(`  暂无联系人`);
      }
      console.log('');
    });

  const driverCmd = program.command('driver')
    .description('司机管理');

  driverCmd.command('create')
    .description('创建司机')
    .argument('<driverId>', '司机编号')
    .argument('<name>', '司机姓名')
    .argument('<phone>', '联系电话')
    .option('-p, --plate <text>', '车牌号')
    .action(async (driverId, name, phone, options) => {
      const result = driverService.createDriver(driverId, name, phone, options.plate || '');
      if (result.success) {
        console.log(`✓ 司机创建成功：${result.driver.name} (${result.driver.phone})`);
      } else {
        console.log(`⚠ ${result.error}`);
      }
    });

  driverCmd.command('create-shift')
    .description('创建班次')
    .argument('<code>', '班次代码（如：AM、PM）')
    .argument('<name>', '班次名称（如：早班、晚班）')
    .option('-s, --start <time>', '开始时间（HH:MM）')
    .option('-e, --end <time>', '结束时间（HH:MM）')
    .action(async (code, name, options) => {
      const result = driverService.createShift(code, name, options.start || '', options.end || '');
      if (result.success) {
        console.log(`✓ 班次创建成功：${result.shift.name}`);
      } else {
        console.log(`⚠ ${result.error}`);
      }
    });

  driverCmd.command('assign')
    .description('分配司机到线路班次')
    .argument('<driverId>', '司机编号')
    .argument('<lineCode>', '线路代码')
    .argument('<shiftCode>', '班次代码')
    .argument('<effectiveDate>', '生效日期（YYYY-MM-DD）')
    .action(async (driverId, lineCode, shiftCode, effectiveDate) => {
      const result = driverService.assignDriverToLine(driverId, lineCode, shiftCode, effectiveDate);
      if (result.success) {
        console.log(`✓ 分配成功：${result.assignment.driverName} → ${result.assignment.lineCode} ${result.assignment.shiftName}`);
      } else {
        console.log(`⚠ ${result.error}`);
      }
    });

  driverCmd.command('list')
    .description('列出所有司机')
    .option('-a, --all', '包含已停用司机')
    .action(async (options) => {
      const drivers = driverService.listDrivers(!!options.all);
      console.log(`\n共有 ${drivers.length} 名司机：`);
      for (const d of drivers) {
        const status = d.isActive ? '' : ' [已停用]';
        const plate = d.licensePlate ? ` (${d.licensePlate})` : '';
        console.log(`  ${d.driverId} - ${d.name}${plate}${status}`);
      }
      console.log('');
    });

  driverCmd.command('schedule')
    .description('查看司机排班')
    .argument('[date]', '日期（YYYY-MM-DD，默认今天）')
    .action(async (date) => {
      const scheduleDate = date || today();
      const schedule = driverService.getDriverSchedule(scheduleDate);
      console.log(`\n${scheduleDate} 司机排班（${schedule.length}条）：`);
      for (const item of schedule) {
        console.log(`\n  ${item.lineCode} - ${item.lineName}`);
        console.log(`    ${item.shiftName}: ${item.driverName} (${item.driverPhone}) - ${item.licensePlate || '无车牌'}`);
      }
      console.log('');
    });

  const diversionCmd = program.command('diversion')
    .description('改线管理');

  diversionCmd.command('create')
    .description('创建临时改线')
    .argument('<date>', '改线日期（YYYY-MM-DD）')
    .argument('<reason>', '改线原因')
    .argument('[changes...]', '站点变更：线路代码:原站点->新站点 或 线路代码:原站点@skip')
    .action(async (date, reason, changes) => {
      const lineChanges = [];

      for (const changeStr of changes) {
        const match1 = changeStr.match(/^([A-Za-z0-9]+):([A-Za-z0-9]+)->([A-Za-z0-9]+)$/);
        const match2 = changeStr.match(/^([A-Za-z0-9]+):([A-Za-z0-9]+)@skip$/);

        if (match1) {
          lineChanges.push({
            lineCode: match1[1],
            originalStopCode: match1[2],
            newStopCode: match1[3],
            isSkipped: false
          });
        } else if (match2) {
          lineChanges.push({
            lineCode: match2[1],
            originalStopCode: match2[2],
            newStopCode: null,
            isSkipped: true
          });
        }
      }

      const result = diversionService.createDiversion(date, reason, lineChanges);
      if (result.success) {
        if (result.isDuplicate) {
          console.log(`ℹ ${result.message}`);
        } else {
          console.log(`✓ 改线创建成功：${date} - ${reason}`);
          for (const dl of result.diversionLines) {
            const action = dl.isSkipped ? '跳过' : `→${dl.newStopName}`;
            console.log(`  ${dl.lineCode}: ${dl.originalStopName} ${action}`);
          }
          if (result.warnings && result.warnings.length > 0) {
            console.log('\n⚠ 警告：');
            for (const w of result.warnings) {
              console.log(`  ${w.message}`);
            }
          }
        }
      } else {
        console.log(`⚠ ${result.error}`);
        if (result.errors) {
          result.errors.forEach(e => console.log(`  - ${e}`));
        }
      }
    });

  diversionCmd.command('show')
    .description('查看改线详情')
    .argument('[date]', '日期（YYYY-MM-DD，默认今天）')
    .action(async (date) => {
      const showDate = date || today();
      const details = diversionService.getDiversionWithDetails(showDate);
      if (!details) {
        console.log(`ℹ ${showDate} 没有改线记录`);
        return;
      }
      console.log(`\n改线日期：${details.diversion.date}`);
      console.log(`改线原因：${details.diversion.reason}`);
      console.log(`创建时间：${details.diversion.createdAt}`);

      console.log(`\n站点变更：`);
      for (const dl of details.diversionLines) {
        const action = dl.isSkipped ? '→ 跳过' : `→ ${dl.newStopName}`;
        console.log(`  ${dl.lineCode}: ${dl.originalStopName} ${action}`);
      }

      if (details.leaves.length > 0) {
        console.log(`\n今日请假（${details.leaves.length}人）：`);
        for (const l of details.leaves) {
          console.log(`  - ${l.studentName}`);
        }
      }

      if (details.hasNotifications) {
        console.log(`\nℹ 已生成通知`);
      }
      console.log('');
    });

  const notifyCmd = program.command('notify')
    .description('通知管理');

  notifyCmd.command('generate')
    .description('生成通知')
    .argument('[date]', '日期（YYYY-MM-DD，默认今天）')
    .action(async (date) => {
      const notifyDate = date || today();
      const result = diversionService.generateNotifications(notifyDate);
      if (result.success) {
        if (result.isDuplicate) {
          console.log(`ℹ ${result.message}`);
        } else {
          console.log(`✓ 通知生成成功：${result.notificationCount} 条`);
          if (result.skippedBecauseOfLeave.length > 0) {
            console.log(`\n⚠ 因请假跳过（${result.skippedBecauseOfLeave.length}人）：`);
            for (const s of result.skippedBecauseOfLeave) {
              console.log(`  - ${s.student}`);
            }
          }
        }
      } else {
        console.log(`⚠ ${result.error}`);
      }
    });

  notifyCmd.command('driver')
    .description('显示司机版通知')
    .argument('[date]', '日期（YYYY-MM-DD，默认今天）')
    .action(async (date) => {
      const notifyDate = date || today();
      const notif = notificationService.generateDriverNotification(notifyDate);
      if (notif) {
        console.log(notificationService.formatDriverNotification(notif));
      } else {
        console.log(`ℹ ${notifyDate} 没有改线记录`);
      }
    });

  notifyCmd.command('teacher')
    .description('显示值班老师版通知')
    .argument('[date]', '日期（YYYY-MM-DD，默认今天）')
    .action(async (date) => {
      const notifyDate = date || today();
      const notif = notificationService.generateTeacherNotification(notifyDate);
      if (notif) {
        console.log(notificationService.formatTeacherNotification(notif));
      } else {
          console.log(`ℹ ${notifyDate} 没有改线记录`);
        }
    });

  notifyCmd.command('parent')
    .description('显示家长版通知')
    .argument('[date]', '日期（YYYY-MM-DD，默认今天）')
    .action(async (date) => {
      const notifyDate = date || today();
      console.log(notificationService.formatParentNotifications(notifyDate));
    });

  notifyCmd.command('all')
    .description('显示所有版本通知')
    .argument('[date]', '日期（YYYY-MM-DD，默认今天）')
    .action(async (date) => {
      const notifyDate = date || today();
      const driverNotif = notificationService.generateDriverNotification(notifyDate);
      const teacherNotif = notificationService.generateTeacherNotification(notifyDate);

      if (driverNotif) {
        console.log(notificationService.formatDriverNotification(driverNotif));
      }
      if (teacherNotif) {
        console.log(notificationService.formatTeacherNotification(teacherNotif));
      }
      console.log(notificationService.formatParentNotifications(notifyDate));
    });

  const exportCmd = program.command('export')
    .description('导出存档');

  exportCmd.command('archive')
    .description('导出改线存档')
    .argument('[date]', '日期（YYYY-MM-DD，默认今天）')
    .option('-o, --output <dir>', '输出目录', './exports')
    .action(async (date, options) => {
      const exportDate = date || today();
      const result = exportService.exportDiversionArchive(exportDate, options.output);
      if (result.success) {
        console.log(`✓ 存档导出成功：`);
        console.log(`  JSON: ${result.jsonPath}`);
        console.log(`  TXT:  ${result.textPath}`);
        console.log(`\n存档内容：`);
        console.log(`  站点变更：${result.summary.diversionLines} 处`);
        console.log(`  请假记录：${result.summary.leaves} 条`);
        console.log(`  通知记录：${result.summary.notifications} 条`);
      } else {
        console.log(`⚠ ${result.error}`);
      }
    });

  return program;
}

module.exports = {
  createCli
};
