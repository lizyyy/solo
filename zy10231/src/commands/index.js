const fs = require('fs');
const path = require('path');
const attendeeModel = require('../models/attendee');
const historyModel = require('../models/history');
const storage = require('../storage');
const validator = require('../validator');
const formatter = require('../formatter');

function parseCSV(csvText) {
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  
  const header = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const data = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === 0) continue;
    
    const row = {};
    header.forEach((h, idx) => {
      row[h] = values[idx] || '';
    });
    data.push(row);
  }
  
  return data;
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function normalizeHeaders(row) {
  const mapping = {
    '姓名': 'name', 'name': 'name',
    '公司': 'company', '公司名称': 'company', 'company': 'company',
    '胸牌编号': 'badgeNumber', '编号': 'badgeNumber', 'badge': 'badgeNumber', 'badgeNumber': 'badgeNumber',
    '嘉宾类型': 'guestType', '类型': 'guestType', 'guestType': 'guestType',
    '权限区域': 'permissionZone', '权限': 'permissionZone', 'permissionZone': 'permissionZone',
    '签到状态': 'checkinStatus', '签到': 'checkinStatus', 'checkinStatus': 'checkinStatus',
    '电话': 'phone', '手机号': 'phone', 'phone': 'phone',
    '邮箱': 'email', 'email': 'email'
  };
  
  const normalized = {};
  for (const [key, value] of Object.entries(row)) {
    const newKey = mapping[key] || key;
    normalized[newKey] = value;
  }
  return normalized;
}

function cmdImport(args) {
  storage.initFiles();
  
  const filePath = args._[1];
  if (!filePath) {
    console.log('用法: badge import <csv文件路径>');
    console.log('CSV 格式: 姓名,公司,胸牌编号,嘉宾类型[,权限区域][,签到状态]');
    process.exit(1);
  }
  
  const absPath = path.resolve(filePath);
  if (!fs.existsSync(absPath)) {
    console.error(`文件不存在: ${absPath}`);
    process.exit(1);
  }
  
  const csvText = fs.readFileSync(absPath, 'utf-8');
  const rawData = parseCSV(csvText);
  
  if (rawData.length === 0) {
    console.error('CSV 文件为空或格式错误');
    process.exit(1);
  }
  
  console.log(formatter.printHeader(`导入数据 - ${rawData.length} 条记录`));
  
  let successCount = 0;
  let updateCount = 0;
  let errorCount = 0;
  const allErrors = [];
  
  for (let i = 0; i < rawData.length; i++) {
    const row = normalizeHeaders(rawData[i]);
    
    console.log(`\n[第 ${i + 1} 条] ${row.name || '未知'} (${row.company || '未知'})`);
    
    const validation = validator.validateImportData(row);
    console.log(formatter.formatValidationReport(validation));
    
    if (!validation.isValid) {
      errorCount++;
      allErrors.push(`第 ${i + 1} 条: ${validation.errors.join('; ')}`);
      continue;
    }
    
    const { attendee, isNew } = attendeeModel.createOrUpdate(row);
    
    if (isNew) {
      successCount++;
      console.log(`  ✓ 新增: ${attendee.badgeNumber} - ${attendee.name}`);
    } else {
      updateCount++;
      console.log(`  ✓ 更新: ${attendee.badgeNumber} - ${attendee.name}`);
    }
  }
  
  historyModel.recordOperation('import', {
    file: filePath,
    total: rawData.length,
    success: successCount,
    updated: updateCount,
    errors: errorCount
  });
  
  console.log(formatter.printHeader('导入完成'));
  console.log(`  总计: ${rawData.length} 条`);
  console.log(`  新增: ${successCount} 条`);
  console.log(`  更新: ${updateCount} 条`);
  console.log(`  失败: ${errorCount} 条`);
  
  if (errorCount > 0) {
    console.log(`\n  错误详情:`);
    allErrors.forEach(err => console.log(`    - ${err}`));
  }
}

function cmdCheck(args) {
  storage.initFiles();
  
  const action = args._[1];
  
  if (!action) {
    const pending = historyModel.getPendingList();
    console.log(formatter.formatPendingList(pending));
    return;
  }
  
  switch (action) {
    case 'reprint':
      checkReprint(args);
      break;
    case 'name':
    case 'company':
    case 'badge':
    case 'permission':
      checkUpdate(action, args);
      break;
    case 'checkin':
      checkCheckin(args);
      break;
    default:
      console.log('用法: badge check [操作类型] [参数]');
      console.log('  badge check                    - 查看所有待确认操作');
      console.log('  badge check reprint [选项]     - 检查补打');
      console.log('  badge check name [编号] [新名] - 检查改名');
      console.log('  badge check company [编号] [新公司] - 检查改公司');
      console.log('  badge check badge [编号] [新编号] - 检查换号');
      console.log('  badge check permission [编号] [新权限] - 检查改权限');
      console.log('  badge check checkin [编号]     - 检查并添加签到');
      break;
  }
}

function checkReprint(args) {
  const badgeNumber = args['--badge'] || args.badge || args._[2];
  const name = args['--name'] || args.name;
  const company = args['--company'] || args.company;
  const reason = args['--reason'] || args.reason || '未说明';
  
  if (!badgeNumber && (!name || !company)) {
    console.log('请提供胸牌编号 (--badge) 或 姓名+公司 (--name --company)');
    process.exit(1);
  }
  
  const attendeeData = {
    badgeNumber: badgeNumber,
    name,
    company
  };
  
  console.log(formatter.printHeader('补打检查'));
  
  const validation = validator.validateReprint(attendeeData, reason);
  console.log(formatter.formatValidationReport(validation, '参会人资格与数据验证'));
  
  if (!validation.attendee) {
    console.log('\n  无法找到参会人，请检查信息是否正确。');
    process.exit(1);
  }
  
  const attendee = validation.attendee;
  
  console.log(`\n  参会人信息:`);
  console.log(`    编号: ${attendee.badgeNumber}`);
  console.log(`    姓名: ${attendee.name}`);
  console.log(`    公司: ${attendee.company}`);
  console.log(`    类型: ${attendee.guestType}`);
  console.log(`    权限: ${attendee.permissionZone || '(未设置)'}`);
  console.log(`    签到: ${attendee.checkinStatus}`);
  console.log(`    历史补打: ${attendee.reprintCount || 0} 次`);
  
  if (validation.isValid) {
    const key = attendeeModel.buildAttendeeKey(attendee);
    const isDuplicate = validator.checkDuplicateOperation(key, 'reprint', attendee.badgeNumber);
    
    if (isDuplicate) {
      console.log(`\n  ⚠ 该补打已在待确认列表中，无需重复添加。`);
    } else {
      const pending = historyModel.getPendingList();
      const added = historyModel.addPendingItem({
        attendeeId: attendee.id,
        attendeeKey: key,
        operationType: 'reprint',
        name: attendee.name,
        company: attendee.company,
        badgeNumber: attendee.badgeNumber,
        reprintReason: reason,
        originalAttendee: { ...attendee }
      });
      
      if (added) {
        console.log(`\n  ✓ 已添加到待确认列表 (当前 ${pending.length + 1} 项)`);
        console.log(`  补打原因: ${reason}`);
        console.log(`\n  下一步: badge confirm 确认后打印`);
      } else {
        console.log(`\n  ⚠ 该操作已存在于待确认列表中`);
      }
    }
  }
}

function checkUpdate(type, args) {
  const badgeNumber = args._[2];
  const newValue = args._[3];
  
  if (!badgeNumber || !newValue) {
    console.log(`用法: badge check ${type} <胸牌编号> <新值>`);
    process.exit(1);
  }
  
  const attendee = attendeeModel.findByBadgeNumber(badgeNumber);
  if (!attendee) {
    console.log(`未找到编号为 ${badgeNumber} 的参会人`);
    process.exit(1);
  }
  
  console.log(formatter.printHeader(`检查: ${type === 'name' ? '修改姓名' : type === 'company' ? '修改公司' : type === 'badge' ? '更换编号' : '修改权限'}`));
  
  let validation;
  let oldValue;
  let operationType;
  
  switch (type) {
    case 'name':
      validation = validator.validateNameChange(attendee, newValue);
      oldValue = attendee.name;
      operationType = 'update_name';
      break;
    case 'company':
      validation = validator.validateCompanyChange(attendee, newValue);
      oldValue = attendee.company;
      operationType = 'update_company';
      break;
    case 'badge':
      validation = validator.validateBadgeNumberChange(attendee, newValue);
      oldValue = attendee.badgeNumber;
      operationType = 'update_badge';
      break;
    case 'permission':
      validation = validator.validatePermissionChange(attendee, newValue);
      oldValue = attendee.permissionZone || '(未设置)';
      operationType = 'update_permission';
      break;
  }
  
  console.log(formatter.formatValidationReport(validation));
  console.log(`\n  当前: ${oldValue}`);
  console.log(`  目标: ${newValue}`);
  
  if (!validation.isValid) {
    console.log('\n  存在错误，无法继续。');
    process.exit(1);
  }
  
  const key = attendeeModel.buildAttendeeKey(attendee);
  const isDuplicate = validator.checkDuplicateOperation(key, operationType, attendee.badgeNumber);
  
  if (isDuplicate) {
    console.log(`\n  ⚠ 该操作已在待确认列表中，无需重复添加。`);
    return;
  }
  
  const added = historyModel.addPendingItem({
    attendeeId: attendee.id,
    attendeeKey: key,
    operationType,
    name: attendee.name,
    company: attendee.company,
    badgeNumber: attendee.badgeNumber,
    oldValue,
    newValue,
    originalAttendee: { ...attendee }
  });
  
  if (added) {
    console.log(`\n  ✓ 已添加到待确认列表`);
    console.log(`\n  下一步: badge confirm 确认后打印`);
  }
}

function checkCheckin(args) {
  const badgeNumber = args['--badge'] || args.badge || args._[2];
  
  if (!badgeNumber) {
    console.log('用法: badge check checkin <胸牌编号>');
    console.log('  或: badge check checkin --badge XXX');
    process.exit(1);
  }
  
  const attendee = attendeeModel.findByBadgeNumber(badgeNumber);
  if (!attendee) {
    console.log(`未找到编号为 ${badgeNumber} 的参会人`);
    process.exit(1);
  }
  
  console.log(formatter.printHeader(`检查: 签到同步`));
  
  const errors = [];
  const warnings = [];
  
  if (attendee.checkinStatus === '已签到') {
    warnings.push(`${attendee.name} 已于 ${attendee.updatedAt?.substring(0, 19).replace('T', ' ') || '之前'} 签到，无需重复签到`);
  }
  
  if (attendee.checkinStatus === '已离场') {
    errors.push(`${attendee.name} 已离场，无法签到`);
  }
  
  const validation = { errors, warnings, isValid: errors.length === 0 };
  console.log(formatter.formatValidationReport(validation));
  console.log(`\n  参会人:`);
  console.log(`    编号: ${attendee.badgeNumber}`);
  console.log(`    姓名: ${attendee.name}`);
  console.log(`    公司: ${attendee.company}`);
  console.log(`    当前状态: ${attendee.checkinStatus}`);
  
  if (!validation.isValid) {
    console.log('\n  存在错误，无法继续。');
    process.exit(1);
  }
  
  const key = attendeeModel.buildAttendeeKey(attendee);
  const isDuplicate = validator.checkDuplicateOperation(key, 'checkin', attendee.badgeNumber);
  
  if (isDuplicate) {
    console.log(`\n  ⚠ 该签到操作已在待确认列表中，无需重复添加。`);
    return;
  }
  
  if (warnings.length > 0) {
    console.log(`\n  提示: ${warnings[0]}`);
    return;
  }
  
  const added = historyModel.addPendingItem({
    attendeeId: attendee.id,
    attendeeKey: key,
    operationType: 'checkin',
    name: attendee.name,
    company: attendee.company,
    badgeNumber: attendee.badgeNumber,
    originalAttendee: { ...attendee }
  });
  
  if (added) {
    console.log(`\n  ✓ 已添加到待确认列表`);
    console.log(`\n  下一步: badge confirm 确认后完成签到同步`);
  }
}

function cmdConfirm(args) {
  storage.initFiles();
  
  const pending = historyModel.getPendingList();
  
  if (pending.length === 0) {
    console.log('当前没有待确认的操作。');
    return;
  }
  
  console.log(formatter.formatPendingList(pending));
  
  if (!args['--yes'] && !args.yes) {
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    rl.question(`\n确认以上 ${pending.length} 项操作？(y/N): `, (answer) => {
      rl.close();
      if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
        doConfirm(pending);
      } else {
        console.log('已取消。');
      }
    });
  } else {
    doConfirm(pending);
  }
}

function doConfirm(pending) {
  const batchNumber = storage.getNextBatchNumber();
  const operator = process.env.USER || 'operator';
  const result = historyModel.confirmPending(batchNumber, operator);
  
  if (!result.success) {
    console.log(result.message);
    return;
  }
  
  const printItems = pending.filter(item => 
    item.operationType === 'reprint' ||
    item.operationType === 'update_name' ||
    item.operationType === 'update_company' ||
    item.operationType === 'update_badge' ||
    item.operationType === 'update_permission'
  ).map(item => ({
    seq: 0,
    attendee: item.originalAttendee,
    operationType: item.operationType
  }));
  
  const updatedItems = result.operations
    .filter(op => 
      op.operationType === 'reprint' ||
      op.operationType === 'update_name' ||
      op.operationType === 'update_company' ||
      op.operationType === 'update_badge' ||
      op.operationType === 'update_permission'
    )
    .map((op, idx) => ({
      seq: idx + 1,
      attendee: op.attendee
    }));
  
  console.log(formatter.printHeader(`确认完成 - 批次 ${batchNumber}`));
  console.log(`  操作数量: ${result.itemCount} 项`);
  console.log(`  批次编号: ${batchNumber}`);
  console.log(`  操作员: ${operator}`);
  console.log(`  操作时间: ${formatter.formatTimestamp(new Date().toISOString())}`);
  
  if (updatedItems.length > 0) {
    console.log(formatter.formatPrintList(updatedItems, batchNumber));
  }
  
  console.log(`\n  历史记录已保存，可使用以下命令查看:`);
  console.log(`    badge history --batch ${batchNumber}`);
}

function cmdList(args) {
  storage.initFiles();
  
  const attendees = attendeeModel.getAll();
  
  if (attendees.length === 0) {
    console.log('暂无参会人数据，请先使用 badge import 导入。');
    return;
  }
  
  const filterType = args['--type'] || args.type;
  const filterStatus = args['--status'] || args.status;
  const search = args['--search'] || args.search;
  
  let filtered = attendees;
  
  if (filterType) {
    filtered = filtered.filter(a => a.guestType === filterType);
  }
  if (filterStatus) {
    filtered = filtered.filter(a => a.checkinStatus === filterStatus);
  }
  if (search) {
    const s = search.toLowerCase();
    filtered = filtered.filter(a => 
      a.name.toLowerCase().includes(s) ||
      a.company.toLowerCase().includes(s) ||
      a.badgeNumber.toLowerCase().includes(s)
    );
  }
  
  if (args['--pending'] || args.pending) {
    const pending = historyModel.getPendingList();
    console.log(formatter.formatPendingList(pending));
    return;
  }
  
  if (args['--csv'] || args.csv) {
    const csv = formatter.formatExportCSV(filtered, 'attendees');
    const outputPath = args['--output'] || args.output || 'attendees.csv';
    fs.writeFileSync(outputPath, csv, 'utf-8');
    console.log(`已导出 ${filtered.length} 条记录到 ${outputPath}`);
    return;
  }
  
  console.log(formatter.printHeader(`参会人列表 (${filtered.length}/${attendees.length} 人)`));
  
  const cols = { seq: 4, badge: 12, name: 12, company: 20, type: 10, zone: 14, status: 10, reprint: 8 };
  
  function pad(str, len) {
    str = String(str || '');
    if (str.length >= len) return str.substring(0, len);
    return str + ' '.repeat(len - str.length);
  }
  
  console.log(pad('序号', cols.seq) + pad('编号', cols.badge) + 
              pad('姓名', cols.name) + pad('公司', cols.company) +
              pad('类型', cols.type) + pad('权限', cols.zone) +
              pad('签到', cols.status) + pad('补打', cols.reprint));
  console.log('-'.repeat(80));
  
  filtered.forEach((a, i) => {
    console.log(
      pad(String(i + 1), cols.seq) +
      pad(a.badgeNumber, cols.badge) +
      pad(a.name, cols.name) +
      pad(a.company.substring(0, 18), cols.company) +
      pad(a.guestType, cols.type) +
      pad((a.permissionZone || '-').substring(0, 12), cols.zone) +
      pad(a.checkinStatus, cols.status) +
      pad(a.reprintCount || 0, cols.reprint)
    );
  });
  
  if (args['--summary'] || args.summary) {
    const stats = {
      totalAttendees: attendees.length,
      checkedIn: attendees.filter(a => a.checkinStatus === '已签到').length,
      notCheckedIn: attendees.filter(a => a.checkinStatus === '未签到').length,
      byType: {},
      totalPrints: attendees.reduce((sum, a) => sum + (a.reprintCount || 0) + 1, 0),
      totalReprints: attendees.reduce((sum, a) => sum + (a.reprintCount || 0), 0),
      hasReprint: attendees.filter(a => a.reprintCount > 0).length,
      pendingCount: historyModel.getPendingList().length
    };
    
    attendees.forEach(a => {
      stats.byType[a.guestType] = (stats.byType[a.guestType] || 0) + 1;
    });
    
    console.log(formatter.formatSummary(stats));
  }
}

function cmdHistory(args) {
  storage.initFiles();
  
  const batchNumber = args['--batch'] || args.batch;
  const badgeNumber = args['--badge'] || args.badge;
  const name = args['--name'] || args.name;
  
  let history = historyModel.getAllHistory();
  let targetAttendee = null;
  
  if (batchNumber) {
    history = historyModel.findByBatch(batchNumber);
  } else if (badgeNumber) {
    targetAttendee = attendeeModel.findByBadgeNumber(badgeNumber);
    if (targetAttendee) {
      history = historyModel.findByAttendee(targetAttendee.id);
    } else {
      history = [];
    }
  } else if (name) {
    const attendees = attendeeModel.getAll();
    targetAttendee = attendees.find(a => a.name === name);
    if (targetAttendee) {
      history = historyModel.findByAttendee(targetAttendee.id);
    } else {
      history = [];
    }
  }
  
  if (history.length === 0) {
    console.log('未找到历史记录。');
    return;
  }
  
  console.log(formatter.formatReprintHistory(history, targetAttendee?.name));
  
  if (args['--csv'] || args.csv) {
    const flatRecords = [];
    history.forEach(record => {
      if (record.type === 'confirm' && record.details?.operations) {
        record.details.operations.forEach(op => {
          flatRecords.push({
            批次号: record.batchNumber,
            操作时间: formatter.formatTimestamp(record.timestamp),
            操作类型: formatter.getOperationLabel(op.operationType),
            胸牌编号: op.attendee?.badgeNumber,
            姓名: op.attendee?.name,
            公司: op.attendee?.company,
            详情: formatter.getOperationDetail(op)
          });
        });
      }
    });
    
    if (flatRecords.length > 0) {
      const csv = formatter.formatExportCSV(flatRecords, 'history');
      const outputPath = args['--output'] || args.output || 'history.csv';
      fs.writeFileSync(outputPath, csv, 'utf-8');
      console.log(`\n已导出 ${flatRecords.length} 条历史记录到 ${outputPath}`);
    }
  }
}

function cmdExport(args) {
  storage.initFiles();
  
  const type = args._[1] || 'all';
  const outputPath = args['--output'] || args.output;
  
  let data;
  let csvType;
  let defaultFilename;
  
  switch (type) {
    case 'attendees':
    case 'list':
      data = attendeeModel.getAll();
      csvType = 'attendees';
      defaultFilename = 'attendees.csv';
      break;
    case 'history':
      data = [];
      const history = historyModel.getAllHistory();
      history.forEach(record => {
        if (record.type === 'confirm' && record.details?.operations) {
          record.details.operations.forEach(op => {
            data.push({
              批次号: record.batchNumber,
              操作时间: formatter.formatTimestamp(record.timestamp),
              操作类型: formatter.getOperationLabel(op.operationType),
              胸牌编号: op.attendee?.badgeNumber,
              姓名: op.attendee?.name,
              公司: op.attendee?.company,
              详情: formatter.getOperationDetail(op)
            });
          });
        }
      });
      csvType = 'history';
      defaultFilename = 'history.csv';
      break;
    case 'print':
      const pending = historyModel.getPendingList();
      data = pending.map((item, idx) => ({
        seq: idx + 1,
        attendee: item.originalAttendee || item
      }));
      csvType = 'printList';
      defaultFilename = 'print_list.csv';
      if (data.length === 0) {
        console.log('当前没有待确认/待打印的记录。');
        return;
      }
      console.log(formatter.formatPrintList(data, '待打印'));
      break;
    default:
      console.log('用法: badge export <类型> [--output 文件名]');
      console.log('  badge export attendees  - 导出所有参会人');
      console.log('  badge export history    - 导出历史记录');
      console.log('  badge export print      - 导出待打印清单');
      return;
  }
  
  if (data.length === 0) {
    console.log('没有可导出的数据。');
    return;
  }
  
  const csv = formatter.formatExportCSV(data, csvType);
  const outPath = outputPath || defaultFilename;
  fs.writeFileSync(outPath, csv, 'utf-8');
  console.log(`\n已导出 ${data.length} 条记录到 ${outPath}`);
}

function cmdClear(args) {
  storage.initFiles();
  
  const target = args._[1];
  
  if (target === 'pending') {
    const pending = historyModel.getPendingList();
    if (pending.length === 0) {
      console.log('待确认列表已为空。');
      return;
    }
    historyModel.clearPendingList();
    console.log(`已清空待确认列表 (${pending.length} 项已丢弃)。`);
  } else if (target === 'all') {
    if (!args['--yes'] && !args.yes) {
      console.log('警告: 此操作将清空所有数据（参会人、历史、批次）！');
      console.log('如需继续，请使用: badge clear all --yes');
      return;
    }
    storage.saveAttendees([]);
    storage.saveHistory([]);
    storage.saveBatches({ nextNumber: 1 });
    storage.clearPending();
    console.log('所有数据已清空。');
  } else {
    console.log('用法: badge clear <目标>');
    console.log('  badge clear pending  - 清空待确认列表');
    console.log('  badge clear all      - 清空所有数据 (需加 --yes)');
  }
}

function cmdHelp() {
  console.log(`
活动胸牌打印补打 CLI 工具
============================

工作流程:
  1. import   导入参会人数据
  2. check    添加补打/修改/签到操作（自动去重）
  3. confirm  确认后生成打印批次
  4. export   导出打印清单/历史记录

命令说明:

  badge import <csv文件>
    导入参会人数据
    CSV格式: 姓名,公司,胸牌编号,嘉宾类型[,权限区域][,签到状态]

  badge check [操作类型] [参数]
    添加操作到待确认列表（自动检查重复）
    操作类型:
      reprint --badge XXX [--reason 原因]   补打
      name <编号> <新名>                     修改姓名
      company <编号> <新公司>                修改公司
      badge <编号> <新编号>                  更换胸牌编号
      permission <编号> <新权限>             修改权限区域
      checkin <编号>                         签到同步

  badge check
    查看当前待确认列表

  badge confirm [--yes]
    确认待确认列表中的操作，生成打印批次

  badge list [筛选条件]
    查看参会人列表
    筛选: --type VIP --status 已签到 --search 关键词
    其他: --summary 统计概览 --csv 导出CSV

  badge history [筛选条件]
    查看全部操作历史（补打、改名、改公司、签到等）
    筛选: --batch 0001 --badge XXX --name 张三
    其他: --csv 导出CSV

  badge export <类型> [--output 文件名]
    导出数据
    类型: attendees | history | print

  badge clear <目标>
    清空数据
    目标: pending (待确认列表) | all (全部)

示例:
  $ badge import attendees.csv
  $ badge check reprint --badge VIP001 --reason 胸牌丢失
  $ badge check name VIP002 张小三
  $ badge check checkin REG003
  $ badge check
  $ badge confirm
  $ badge history --batch 0001
  $ badge export history --output 操作历史.csv

业务规则:
  • 同一人同一操作重复添加会自动去重
  • 胸牌编号冲突时会阻止（编号被他人占用）
  • 临时嘉宾必须设置权限区域才能打印
  • 签到后改名/改公司会显示警告
  • 补打次数 >= 3 次会提示高频补打警告
  • 已签到人员再次签到会跳过
`);
}

module.exports = {
  cmdImport,
  cmdCheck,
  cmdConfirm,
  cmdList,
  cmdHistory,
  cmdExport,
  cmdClear,
  cmdHelp
};
