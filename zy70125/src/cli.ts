#!/usr/bin/env node

import { Command } from 'commander';
import * as cityService from './services/cityService';
import * as caseService from './services/caseService';
import * as borrowService from './services/borrowService';
import * as damageService from './services/damageService';
import * as compensationService from './services/compensationService';
import * as tourService from './services/tourService';
import * as reportService from './services/reportService';
import { getDBPath, resetDB } from './storage';
import { ServiceResult } from './types';

const program = new Command();

program
  .name('tour')
  .description('剧场设备巡演调拨服务')
  .version('1.0.0');

function printResult(result: ServiceResult): void {
  const prefix = result.success ? '[成功]' : '[失败]';
  console.log(`\n${prefix} ${result.message}`);
  if (result.suggestions && result.suggestions.length > 0) {
    console.log('\n【建议】');
    result.suggestions.forEach((s, i) => console.log(`  ${i + 1}. ${s}`));
  }
  if (result.data) {
    console.log('\n【数据详情】');
    console.log(JSON.stringify(result.data, null, 2));
  }
  console.log('');
}

// ========== 城市节点命令 ==========
const cityCmd = program.command('city').description('城市节点管理');

cityCmd
  .command('create')
  .description('创建城市节点')
  .argument('<name>', '城市名称')
  .argument('<code>', '城市代码（如 BJ、SH）')
  .option('-d, --description <text>', '城市描述')
  .action((name, code, options) => {
    const result = cityService.createCity(name, code, options.description);
    printResult(result);
  });

cityCmd
  .command('list')
  .description('列出所有城市节点')
  .action(() => {
    const result = cityService.listCities();
    if (result.success && result.data) {
      console.log(`\n${result.message}\n`);
      console.log('代码  城市名称              状态');
      console.log('----  --------------------  ------');
      result.data.forEach(city => {
        const status = city.isActive ? '启用' : '停用';
        console.log(`${city.code.padEnd(4)}  ${city.name.padEnd(20)}  ${status}`);
      });
      console.log('');
    } else {
      printResult(result);
    }
  });

cityCmd
  .command('deactivate')
  .description('停用城市节点')
  .argument('<cityId>', '城市ID')
  .action(cityId => {
    const result = cityService.deactivateCity(cityId);
    printResult(result);
  });

// ========== 设备箱命令 ==========
const caseCmd = program.command('case').description('设备箱管理（核心入口）');

caseCmd
  .command('create')
  .description('创建设备箱')
  .argument('<caseNumber>', '设备箱编号')
  .argument('<name>', '设备箱名称')
  .argument('<cityIdentifier>', '所在城市（ID/代码/名称）')
  .argument('<itemsJson>', '设备项JSON数组: [{"name":"灯光控制台","quantity":1,"unitValue":15000}]')
  .option('-d, --description <text>', '设备箱描述')
  .action((caseNumber, name, cityIdentifier, itemsJson, options) => {
    try {
      const items = JSON.parse(itemsJson);
      const result = caseService.createCase({
        caseNumber,
        name,
        description: options.description,
        cityIdentifier,
        items,
      });
      printResult(result);
    } catch (e) {
      printResult({
        success: false,
        message: `设备项JSON格式错误：${e instanceof Error ? e.message : String(e)}`,
      });
    }
  });

caseCmd
  .command('list')
  .description('列出设备箱')
  .option('-c, --city <identifier>', '按城市过滤')
  .option('-s, --status <status>', '按状态过滤')
  .action(options => {
    const result = caseService.listCases(options.city, options.status);
    if (result.success && result.data) {
      console.log(`\n${result.message}\n`);
      console.log('箱号      名称                  状态      所在城市      设备数  价值');
      console.log('--------  --------------------  --------  ----------  ------  ----------');
      result.data.forEach(c => {
        const cityResult = cityService.getCityByIdentifier(c.currentCityId);
        const cityName = cityResult.success ? cityResult.data!.name : '未知';
        console.log(
          `${c.caseNumber.padEnd(8)}  ${c.name.padEnd(20)}  ${caseService.getCaseStatusLabel(c.status).padEnd(8)}  ${cityName.padEnd(10)}  ${String(c.items.length).padEnd(6)}  ¥${c.totalValue.toFixed(2).padStart(10)}`
        );
      });
      console.log('');
    } else {
      printResult(result);
    }
  });

caseCmd
  .command('show')
  .description('查看设备箱详情')
  .argument('<identifier>', '设备箱ID或编号')
  .action(identifier => {
    const result = caseService.getCaseByIdentifier(identifier);
    if (result.success && result.data) {
      const c = result.data;
      const cityResult = cityService.getCityByIdentifier(c.currentCityId);
      const cityName = cityResult.success ? cityResult.data!.name : '未知';
      
      console.log(`\n设备箱信息：`);
      console.log(`  箱号：${c.caseNumber}`);
      console.log(`  名称：${c.name}`);
      console.log(`  状态：${caseService.getCaseStatusLabel(c.status)}`);
      console.log(`  所在城市：${cityName}`);
      console.log(`  总价值：¥${c.totalValue.toFixed(2)}`);
      
      if (c.description) {
        console.log(`  描述：${c.description}`);
      }
      
      console.log(`\n箱内设备（共 ${c.items.length} 项）：`);
      console.log('  序号  名称                  数量  单价          小计          状态');
      console.log('  ----  --------------------  ----  ------------  ------------  ----');
      c.items.forEach((item, i) => {
        const conditionLabels: Record<string, string> = {
          new: '全新',
          good: '良好',
          fair: '一般',
          poor: '较差',
        };
        const subtotal = item.quantity * item.unitValue;
        console.log(
          `  ${String(i + 1).padEnd(4)}  ${item.name.padEnd(20)}  ${String(item.quantity).padEnd(4)}  ¥${item.unitValue.toFixed(2).padEnd(10)}  ¥${subtotal.toFixed(2).padEnd(10)}  ${conditionLabels[item.condition] || item.condition}`
        );
      });
      console.log('');
    } else {
      printResult(result);
    }
  });

// ========== 借出归还命令 ==========
const borrowCmd = program.command('borrow').description('借出归还管理（主要推进规则）');

borrowCmd
  .command('out')
  .description('借出设备箱')
  .argument('<caseIdentifier>', '设备箱ID或编号')
  .argument('<borrowedBy>', '借用人')
  .option('-t, --to-city <identifier>', '目标城市（跨城调拨时使用）')
  .option('-e, --expected-return <time>', '预计归还时间')
  .option('-r, --remarks <text>', '备注')
  .action((caseIdentifier, borrowedBy, options) => {
    const result = borrowService.borrowCase({
      caseIdentifier,
      borrowedBy,
      toCityIdentifier: options.toCity,
      expectedReturnTime: options.expectedReturn,
      remarks: options.remarks,
    });
    printResult(result);
  });

borrowCmd
  .command('in')
  .description('归还设备箱')
  .argument('<caseIdentifier>', '设备箱ID或编号')
  .option('-c, --return-city <identifier>', '归还到的城市（默认回到借出城市）')
  .option('-i, --items <json>', '归还时的设备状态JSON数组（用于核对缺件和损坏）')
  .option('-r, --remarks <text>', '备注')
  .action((caseIdentifier, options) => {
    let itemsAtReturn;
    if (options.items) {
      try {
        itemsAtReturn = JSON.parse(options.items);
      } catch (e) {
        printResult({
          success: false,
          message: `设备项JSON格式错误：${e instanceof Error ? e.message : String(e)}`,
        });
        return;
      }
    }
    
    const result = borrowService.returnCase({
      caseIdentifier,
      returnedToCityIdentifier: options.returnCity,
      itemsAtReturn,
      remarks: options.remarks,
    });
    printResult(result);
  });

borrowCmd
  .command('active')
  .description('查看设备箱当前借出记录')
  .argument('<caseIdentifier>', '设备箱ID或编号')
  .action(caseIdentifier => {
    const result = borrowService.getActiveBorrow(caseIdentifier);
    printResult(result);
  });

// ========== 损坏记录命令 ==========
const damageCmd = program.command('damage').description('损坏记录（兜底和复查）');

damageCmd
  .command('report')
  .description('报告设备损坏')
  .argument('<caseIdentifier>', '设备箱ID或编号')
  .argument('<cityIdentifier>', '发现城市')
  .argument('<reportedBy>', '报告人')
  .argument('<severity>', '严重程度：minor|medium|major|critical')
  .argument('<description>', '损坏描述')
  .option('-i, --item <name>', '具体设备名称（可选）')
  .option('-t, --time <time>', '损坏时间（可选，默认当前时间）')
  .option('-c, --cost <number>', '预估费用（可选）')
  .action((caseIdentifier, cityIdentifier, reportedBy, severity, description, options) => {
    const validSeverities = ['minor', 'medium', 'major', 'critical'];
    if (!validSeverities.includes(severity)) {
      printResult({
        success: false,
        message: `严重程度必须是：${validSeverities.join('、')}`,
      });
      return;
    }
    
    const result = damageService.reportDamage({
      caseIdentifier,
      itemName: options.item,
      cityIdentifier,
      reportedBy,
      severity: severity as any,
      description,
      damageTime: options.time,
      estimatedCost: options.cost ? parseFloat(options.cost) : undefined,
    });
    printResult(result);
  });

damageCmd
  .command('resolve')
  .description('解决损坏记录')
  .argument('<damageId>', '损坏记录ID')
  .argument('<resolvedBy>', '处理人')
  .argument('<resolution>', '处理方案')
  .option('-r, --responsibility <person>', '责任归属')
  .action((damageId, resolvedBy, resolution, options) => {
    const result = damageService.resolveDamage({
      damageId,
      resolvedBy,
      resolution,
      responsibility: options.responsibility,
    });
    printResult(result);
  });

damageCmd
  .command('list')
  .description('列出损坏记录')
  .option('-c, --case <identifier>', '按设备箱过滤')
  .option('-u, --unresolved', '仅显示未解决')
  .action(options => {
    const result = damageService.listDamageRecords(options.case, options.unresolved);
    if (result.success && result.data) {
      console.log(`\n${result.message}\n`);
      console.log('ID        设备箱  城市  严重程度  状态    报告人    报告时间');
      console.log('--------  ------  ----  --------  ------  --------  -------------------');
      result.data.forEach(d => {
        const caseResult = caseService.getCaseByIdentifier(d.caseId);
        const cityResult = cityService.getCityByIdentifier(d.cityId);
        console.log(
          `${d.id.slice(0, 8).padEnd(8)}  ${(caseResult.success ? caseResult.data!.caseNumber : '?').padEnd(6)}  ${(cityResult.success ? cityResult.data!.code : '?').padEnd(4)}  ${damageService.getDamageSeverityLabel(d.severity).padEnd(8)}  ${(d.isResolved ? '已解决' : '未解决').padEnd(6)}  ${d.reportedBy.padEnd(8)}  ${new Date(d.damageTime).toLocaleString().padEnd(19)}`
        );
      });
      console.log('');
    } else {
      printResult(result);
    }
  });

// ========== 维修记录命令 ==========
const repairCmd = program.command('repair').description('维修记录（兜底和复查）');

repairCmd
  .command('start')
  .description('启动维修')
  .argument('<caseIdentifier>', '设备箱ID或编号')
  .argument('<startedBy>', '维修负责人')
  .argument('<description>', '维修描述')
  .option('-d, --damage <id>', '关联的损坏记录ID')
  .option('-i, --item <name>', '具体维修的设备名称')
  .action((caseIdentifier, startedBy, description, options) => {
    const result = damageService.startRepair({
      caseIdentifier,
      damageId: options.damage,
      itemName: options.item,
      startedBy,
      description,
    });
    printResult(result);
  });

repairCmd
  .command('complete')
  .description('完成维修')
  .argument('<repairId>', '维修记录ID')
  .option('-c, --cost <number>', '维修费用')
  .option('-n, --note <text>', '完成备注')
  .action((repairId, options) => {
    const result = damageService.completeRepair({
      repairId,
      cost: options.cost ? parseFloat(options.cost) : undefined,
      completionNote: options.note,
    });
    printResult(result);
  });

repairCmd
  .command('list')
  .description('列出维修记录')
  .option('-c, --case <identifier>', '按设备箱过滤')
  .option('-s, --status <status>', '按状态过滤：pending|in_progress|completed')
  .action(options => {
    const result = damageService.listRepairRecords(options.case, options.status as any);
    if (result.success && result.data) {
      console.log(`\n${result.message}\n`);
      console.log('ID        设备箱  状态    负责人    开始时间');
      console.log('--------  ------  ------  --------  -------------------');
      result.data.forEach(r => {
        const caseResult = caseService.getCaseByIdentifier(r.caseId);
        const statusLabels: Record<string, string> = {
          pending: '待开始',
          in_progress: '进行中',
          completed: '已完成',
        };
        console.log(
          `${r.id.slice(0, 8).padEnd(8)}  ${(caseResult.success ? caseResult.data!.caseNumber : '?').padEnd(6)}  ${(statusLabels[r.status] || r.status).padEnd(6)}  ${r.startedBy.padEnd(8)}  ${new Date(r.startTime).toLocaleString().padEnd(19)}`
        );
      });
      console.log('');
    } else {
      printResult(result);
    }
  });

// ========== 补偿动作命令 ==========
const compensationCmd = program.command('compensation').description('补偿动作（失败后可重试）');

compensationCmd
  .command('create')
  .description('创建补偿动作')
  .argument('<relatedRecordId>', '关联记录ID')
  .argument('<relatedRecordType>', '关联记录类型：borrow|damage|repair|tour')
  .argument('<actionType>', '动作类型')
  .argument('<description>', '动作描述')
  .option('-p, --params <json>', '参数JSON')
  .option('-m, --max-attempts <number>', '最大重试次数，默认5')
  .action((relatedRecordId, relatedRecordType, actionType, description, options) => {
    const validTypes = ['borrow', 'damage', 'repair', 'tour'];
    if (!validTypes.includes(relatedRecordType)) {
      printResult({
        success: false,
        message: `关联记录类型必须是：${validTypes.join('、')}`,
      });
      return;
    }
    
    let parameters = {};
    if (options.params) {
      try {
        parameters = JSON.parse(options.params);
      } catch (e) {
        printResult({
          success: false,
          message: `参数JSON格式错误：${e instanceof Error ? e.message : String(e)}`,
        });
        return;
      }
    }
    
    const result = compensationService.createCompensationAction({
      relatedRecordId,
      relatedRecordType: relatedRecordType as any,
      actionType,
      description,
      parameters,
      maxAttempts: options.maxAttempts ? parseInt(options.maxAttempts) : undefined,
    });
    printResult(result);
  });

compensationCmd
  .command('list')
  .description('列出补偿动作')
  .option('-s, --status <status>', '按状态过滤：pending|in_progress|success|failed_permanent')
  .option('-t, --type <type>', '按关联类型过滤：borrow|damage|repair|tour')
  .action(options => {
    const result = compensationService.listCompensationActions(options.status, options.type);
    if (result.success && result.data) {
      console.log(`\n${result.message}\n`);
      console.log('ID        类型    动作类型              状态      尝试次数  创建时间');
      console.log('--------  ------  --------------------  --------  --------  -------------------');
      result.data.forEach(a => {
        console.log(
          `${a.id.slice(0, 8).padEnd(8)}  ${compensationService.getRelatedRecordTypeLabel(a.relatedRecordType).padEnd(6)}  ${a.actionType.padEnd(20)}  ${compensationService.getCompensationStatusLabel(a.status).padEnd(8)}  ${`${a.attemptCount}/${a.maxAttempts}`.padEnd(8)}  ${new Date(a.createdAt).toLocaleString().padEnd(19)}`
        );
      });
      console.log('');
    } else {
      printResult(result);
    }
  });

compensationCmd
  .command('retry-all')
  .description('重试所有待执行的补偿动作')
  .action(() => {
    const result = compensationService.retryAllPending();
    printResult(result);
  });

// ========== 巡演清单命令 ==========
const tourCmd = program.command('tour').description('巡演清单（兜底和复查）');

tourCmd
  .command('create')
  .description('创建巡演清单')
  .argument('<name>', '巡演名称')
  .argument('<casesCommaSeparated>', '设备箱编号列表，逗号分隔')
  .argument('<citiesCommaSeparated>', '城市代码列表，逗号分隔（起点在前）')
  .option('-d, --description <text>', '巡演描述')
  .action((name, casesCommaSeparated, citiesCommaSeparated, options) => {
    const caseIdentifiers = casesCommaSeparated.split(',').map((s: string) => s.trim());
    const cityIdentifiers = citiesCommaSeparated.split(',').map((s: string) => s.trim());
    
    const result = tourService.createTour({
      name,
      description: options.description,
      caseIdentifiers,
      cityIdentifiers,
    });
    printResult(result);
  });

tourCmd
  .command('start')
  .description('启动巡演')
  .argument('<tourId>', '巡演清单ID')
  .action(tourId => {
    const result = tourService.startTour(tourId);
    printResult(result);
  });

tourCmd
  .command('move')
  .description('移动到下一个城市')
  .argument('<tourId>', '巡演清单ID')
  .action(tourId => {
    const result = tourService.moveToNextCity(tourId);
    printResult(result);
  });

tourCmd
  .command('complete')
  .description('完成巡演')
  .argument('<tourId>', '巡演清单ID')
  .action(tourId => {
    const result = tourService.completeTour(tourId);
    printResult(result);
  });

tourCmd
  .command('list')
  .description('列出巡演清单')
  .option('-s, --status <status>', '按状态过滤：draft|in_progress|completed')
  .action(options => {
    const result = tourService.listTours(options.status);
    if (result.success && result.data) {
      console.log(`\n${result.message}\n`);
      console.log('ID        名称                  状态      设备数  城市数  当前城市');
      console.log('--------  --------------------  --------  ------  ------  --------');
      result.data.forEach(t => {
        const currentCityResult = cityService.getCityByIdentifier(t.citySequence[t.currentCityIndex]);
        console.log(
          `${t.id.slice(0, 8).padEnd(8)}  ${t.name.padEnd(20)}  ${tourService.getTourStatusLabel(t.status).padEnd(8)}  ${String(t.caseIds.length).padEnd(6)}  ${String(t.citySequence.length).padEnd(6)}  ${(currentCityResult.success ? currentCityResult.data!.name : '?').padEnd(8)}`
        );
      });
      console.log('');
    } else {
      printResult(result);
    }
  });

// ========== 报告命令 ==========
const reportCmd = program.command('report').description('报告查询（数字和明细对得上）');

reportCmd
  .command('inventory')
  .description('库存报告')
  .action(() => {
    const result = reportService.getInventoryReport();
    if (result.success && result.data) {
      const d = result.data;
      console.log(`\n${result.message}\n`);
      
      console.log('【按状态分布】');
      for (const [status, data] of Object.entries(d.byStatus)) {
        console.log(`  ${status.padEnd(8)}: ${String(data.count).padEnd(4)} 箱，价值 ¥${data.value.toFixed(2)}`);
      }
      
      console.log('\n【按城市分布】');
      d.byCity.forEach(city => {
        console.log(`  ${city.cityCode.padEnd(4)} ${city.cityName.padEnd(20)}: ${String(city.count).padEnd(4)} 箱，价值 ¥${city.value.toFixed(2)}`);
      });
      
      console.log('\n【设备汇总】');
      console.log('  设备名称              总数量  总价值');
      console.log('  --------------------  ------  ------------');
      d.itemsSummary.forEach(item => {
        console.log(`  ${item.name.padEnd(20)}  ${String(item.totalQuantity).padEnd(6)}  ¥${item.totalValue.toFixed(2).padEnd(10)}`);
      });
      console.log('');
    } else {
      printResult(result);
    }
  });

reportCmd
  .command('audit')
  .description('审计报告')
  .action(() => {
    const result = reportService.getAuditReport();
    if (result.success && result.data) {
      const d = result.data;
      console.log(`\n${result.message}\n`);
      
      console.log('【借出记录】');
      console.log(`  总计：${d.totalBorrowRecords} 条`);
      console.log(`  进行中：${d.activeBorrowCount} 条`);
      console.log(`  已完成：${d.completedBorrowCount} 条`);
      
      console.log('\n【损坏记录】');
      console.log(`  总计：${d.totalDamageRecords} 条`);
      console.log(`  未解决：${d.unresolvedDamageCount} 条`);
      
      console.log('\n【维修记录】');
      console.log(`  总计：${d.totalRepairRecords} 条`);
      console.log(`  进行中：${d.inProgressRepairCount} 条`);
      
      console.log('\n【补偿动作】');
      console.log(`  总计：${d.totalCompensationActions} 个`);
      console.log(`  待执行：${d.pendingCompensationCount} 个`);
      console.log(`  永久失败：${d.permanentFailedCompensationCount} 个`);
      
      console.log('\n【巡演清单】');
      console.log(`  总计：${d.totalTours} 个`);
      console.log(`  进行中：${d.activeToursCount} 个`);
      console.log(`  已完成：${d.completedToursCount} 个`);
      console.log('');
    } else {
      printResult(result);
    }
  });

reportCmd
  .command('history')
  .description('设备箱历史追踪')
  .argument('<caseIdentifier>', '设备箱ID或编号')
  .action(caseIdentifier => {
    const result = reportService.getCaseHistoryReport(caseIdentifier);
    if (result.success && result.data) {
      const d = result.data;
      console.log(`\n${result.message}\n`);
      
      console.log('【基本信息】');
      console.log(`  箱号：${d.caseNumber}`);
      console.log(`  名称：${d.caseName}`);
      console.log(`  当前状态：${d.currentStatus}`);
      console.log(`  当前城市：${d.currentCity}`);
      console.log(`  总价值：¥${d.totalValue.toFixed(2)}`);
      
      if (d.borrowHistory.length > 0) {
        console.log('\n【借出记录】');
        d.borrowHistory.forEach((b, i) => {
          console.log(`  ${i + 1}. ${b.borrowedBy} 从 ${b.fromCity} 借出到 ${b.toCity}`);
          console.log(`     借出时间：${new Date(b.borrowTime).toLocaleString()}`);
          if (b.returnTime) {
            console.log(`     归还时间：${new Date(b.returnTime).toLocaleString()}`);
          }
          console.log(`     状态：${b.status}`);
        });
      }
      
      if (d.damageHistory.length > 0) {
        console.log('\n【损坏记录】');
        d.damageHistory.forEach((dmg, i) => {
          console.log(`  ${i + 1}. [${dmg.severity}] ${dmg.city} - ${dmg.reportedBy}`);
          console.log(`     报告时间：${new Date(dmg.reportedTime).toLocaleString()}`);
          console.log(`     状态：${dmg.isResolved ? '已解决' : '未解决'}`);
        });
      }
      
      if (d.repairHistory.length > 0) {
        console.log('\n【维修记录】');
        d.repairHistory.forEach((r, i) => {
          console.log(`  ${i + 1}. ${r.startedBy} - ${r.status}`);
          console.log(`     开始时间：${new Date(r.startTime).toLocaleString()}`);
          if (r.endTime) {
            console.log(`     结束时间：${new Date(r.endTime).toLocaleString()}`);
          }
          if (r.cost !== undefined) {
            console.log(`     费用：¥${r.cost.toFixed(2)}`);
          }
        });
      }
      console.log('');
    } else {
      printResult(result);
    }
  });

// ========== 系统命令 ==========
const systemCmd = program.command('system').description('系统命令');

systemCmd
  .command('db-path')
  .description('显示数据库文件路径')
  .action(() => {
    console.log(`\n数据库文件：${getDBPath()}\n`);
  });

systemCmd
  .command('reset-db')
  .description('重置数据库（⚠️ 危险操作，将清除所有数据）')
  .option('-y, --yes', '确认重置')
  .action(options => {
    if (!options.yes) {
      console.log('\n⚠️  危险操作！此命令将清除所有数据。');
      console.log('如需确认，请使用：tour system reset-db --yes\n');
      return;
    }
    resetDB();
    console.log('\n✅ 数据库已重置，所有数据已清除。\n');
  });

program.parseAsync(process.argv).catch(err => {
  console.error('执行出错：', err.message);
  process.exit(1);
});
