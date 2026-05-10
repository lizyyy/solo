#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const DataStore = require('./src/dataStore');
const Scheduler = require('./src/scheduler');

const store = new DataStore('.');
const scheduler = new Scheduler(store);

function printHelp() {
  console.log(`
商场广告位排期 CLI 工具

用法:
  ad-scheduler <命令> [选项]

命令:
  import-screens <文件>    导入广告屏档案
  import-contract <文件>   导入客户合同（含投放时段）
  add-gift <文件>          添加赠送时段
  add-change <文件>        添加换刊申请
  preview <开始日期> <结束日期>  预览排期
  confirm-publish          确认发布
  export-week [日期]       导出周计划
  clear-data               清空所有数据
  help                     显示帮助信息

示例:
  ad-scheduler import-screens screens.json
  ad-scheduler import-contract contract_normal.json
  ad-scheduler preview 2026-05-10 2026-05-16
  ad-scheduler export-week 2026-05-10
`);
}

function readJsonFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error(`错误: 文件不存在 ${filePath}`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function commandImportScreens(args) {
  if (args.length < 1) {
    console.error('错误: 请指定广告屏文件');
    process.exit(1);
  }
  
  const screens = readJsonFile(args[0]);
  let count = 0;
  
  for (const screen of screens) {
    if (store.addScreen(screen)) {
      count++;
    } else {
      console.warn(`警告: 屏幕 ${screen.id} 已存在，跳过`);
    }
  }
  
  console.log(`成功导入 ${count} 个广告屏`);
}

function commandImportContract(args) {
  if (args.length < 1) {
    console.error('错误: 请指定合同文件');
    process.exit(1);
  }
  
  const contract = readJsonFile(args[0]);
  const result = scheduler.importContract(contract);
  
  if (result.success) {
    console.log(`合同导入成功: ${result.contractId}`);
    console.log(`新增投放时段: ${result.placementsAdded} 个`);
  } else {
    console.error('合同导入失败:');
    for (const error of result.errors) {
      console.error(`  - ${error}`);
    }
    process.exit(1);
  }
}

function commandAddGift(args) {
  if (args.length < 1) {
    console.error('错误: 请指定赠送时段文件');
    process.exit(1);
  }
  
  const gift = readJsonFile(args[0]);
  const result = scheduler.addGift(gift);
  
  if (result.success) {
    console.log('赠送时段添加成功');
  } else {
    console.error('赠送时段添加失败:');
    for (const error of result.errors) {
      console.error(`  - ${error}`);
    }
    process.exit(1);
  }
}

function commandAddChange(args) {
  if (args.length < 1) {
    console.error('错误: 请指定换刊申请文件');
    process.exit(1);
  }
  
  const change = readJsonFile(args[0]);
  const result = scheduler.processChange(change);
  
  if (result.success) {
    console.log('换刊申请添加成功');
  } else {
    console.error('换刊申请添加失败:');
    for (const error of result.errors) {
      console.error(`  - ${error}`);
    }
    process.exit(1);
  }
}

function commandPreview(args) {
  if (args.length < 2) {
    console.error('错误: 请指定开始和结束日期');
    process.exit(1);
  }
  
  const schedule = scheduler.generateSchedule(args[0], args[1]);
  printSchedule(schedule);
}

function printSchedule(schedule) {
  console.log('\n' + '='.repeat(80));
  console.log('排期预览');
  console.log('='.repeat(80));
  
  for (const [screenId, screenData] of Object.entries(schedule)) {
    console.log(`\n【屏幕】${screenId} - ${screenData.screenName} (${screenData.location})`);
    console.log('-'.repeat(80));
    
    const dates = Object.keys(screenData.dailySchedule).sort();
    
    for (const date of dates) {
      const daySchedule = screenData.dailySchedule[date];
      
      console.log(`\n  日期: ${date}`);
      
      if (daySchedule.placements.length === 0 && daySchedule.gifts.length === 0) {
        console.log('    (无投放)');
        continue;
      }
      
      for (const placement of daySchedule.placements) {
        let statusIcon = '✓';
        let statusText = '正常';
        
        if (placement.status === 'waiting-material') {
          statusIcon = '!';
          statusText = '缺少素材';
        } else if (placement.status === 'waiting-approval') {
          statusIcon = '○';
          statusText = '待审批';
        }
        
        console.log(`    [${statusIcon}] ${placement.startTime}-${placement.endTime} | 客户: ${placement.client} (${placement.contractId})`);
        console.log(`        素材: ${placement.material}`);
        console.log(`        状态: ${statusText}`);
        
        if (placement.pendingReasons.length > 0) {
          console.log('        待处理原因:');
          for (const reason of placement.pendingReasons) {
            console.log(`          - ${reason}`);
          }
        }
      }
      
      for (const gift of daySchedule.gifts) {
        console.log(`    [赠] ${gift.startTime}-${gift.endTime} | 客户: ${gift.client} (${gift.contractId})`);
        console.log(`        素材: ${gift.material}`);
      }
    }
  }
  
  console.log('\n' + '='.repeat(80) + '\n');
}

function commandConfirmPublish() {
  const published = scheduler.confirmPublish();
  console.log(`发布成功! 发布时间: ${published.publishDate}`);
  console.log(`包含 ${published.placements.length} 个投放时段`);
  console.log(`包含 ${published.changes.filter(c => c.status === 'published').length} 个已发布换刊`);
}

function commandExportWeek(args) {
  const baseDate = args[0] || new Date().toISOString().split('T')[0];
  const weekDates = scheduler.getWeekDates(baseDate);
  const startDate = weekDates[0];
  const endDate = weekDates[6];
  
  console.log(`\n导出周计划: ${startDate} 至 ${endDate}`);
  console.log('='.repeat(80));
  
  const schedule = scheduler.generateSchedule(startDate, endDate);
  printWeekTable(schedule, weekDates);
  
  const exportPath = path.join('.', `weekplan_${startDate}_${endDate}.json`);
  fs.writeFileSync(exportPath, JSON.stringify(schedule, null, 2));
  console.log(`\n周计划已导出到: ${exportPath}`);
}

function printWeekTable(schedule, weekDates) {
  const dayNames = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
  
  for (const [screenId, screenData] of Object.entries(schedule)) {
    console.log(`\n【${screenId}】${screenData.screenName}`);
    
    for (let i = 0; i < weekDates.length; i++) {
      const date = weekDates[i];
      const daySchedule = screenData.dailySchedule[date];
      
      console.log(`\n  ${dayNames[i]} (${date}):`);
      
      if (daySchedule.placements.length === 0 && daySchedule.gifts.length === 0) {
        console.log('    空闲');
        continue;
      }
      
      const allSlots = [
        ...daySchedule.placements.map(p => ({ ...p, type: '投放' })),
        ...daySchedule.gifts.map(g => ({ ...g, type: '赠送' }))
      ].sort((a, b) => a.startTime.localeCompare(b.startTime));
      
      for (const slot of allSlots) {
        let status = '';
        if (slot.type === '投放' && slot.status === 'waiting-material') {
          status = ' [缺素材]';
        } else if (slot.type === '投放' && slot.status === 'waiting-approval') {
          status = ' [待审批]';
        }
        
        console.log(`    ${slot.startTime}-${slot.endTime} | ${slot.client} (${slot.type})${status}`);
      }
    }
  }
}

function commandClearData() {
  store.clearAll();
  console.log('所有数据已清空');
}

function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const commandArgs = args.slice(1);
  
  if (!command || command === 'help') {
    printHelp();
    return;
  }
  
  switch (command) {
    case 'import-screens':
      commandImportScreens(commandArgs);
      break;
    case 'import-contract':
      commandImportContract(commandArgs);
      break;
    case 'add-gift':
      commandAddGift(commandArgs);
      break;
    case 'add-change':
      commandAddChange(commandArgs);
      break;
    case 'preview':
      commandPreview(commandArgs);
      break;
    case 'confirm-publish':
      commandConfirmPublish();
      break;
    case 'export-week':
      commandExportWeek(commandArgs);
      break;
    case 'clear-data':
      commandClearData();
      break;
    default:
      console.error(`未知命令: ${command}`);
      printHelp();
      process.exit(1);
  }
}

main();
