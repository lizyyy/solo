#!/usr/bin/env node

const importer = require('./src/importer');
const verification = require('./src/verification');
const query = require('./src/query');
const { log } = require('./src/utils');

function showHelp() {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║            汽修保养套餐核销 CLI 工具 v1.0.0                    ║
╚══════════════════════════════════════════════════════════════╝

使用方法:
  node index.js <命令> [参数]

可用命令:
  数据导入:
    import vehicles <文件路径>     - 导入车辆数据
    import packages <文件路径>     - 导入套餐数据
    import rights <文件路径>       - 导入套餐权益数据
    import shops <文件路径>        - 导入门店数据

  核销操作:
    verify <核销文件路径>          - 批量处理核销记录
    cancel <核销单ID> [原因]       - 撤销指定核销单
    trace <核销单ID>               - 查看核销单追溯信息

  查询统计:
    details <车牌或VIN>            - 查看车辆明细
    reconcile <门店ID> [开始日期] [结束日期] [输出文件]
                                  - 导出门店对账

示例:
  # 导入数据
  node index.js import vehicles ./samples/vehicles.csv
  node index.js import packages ./samples/packages.csv
  node index.js import rights ./samples/rights.csv
  node index.js import shops ./samples/shops.csv

  # 处理核销
  node index.js verify ./samples/verifications.csv

  # 撤销核销
  node index.js cancel VER001 "客户退单"

  # 查看追溯
  node index.js trace VER001

  # 查询车辆明细
  node index.js details 京A12345
  node index.js details LSVNB4183JN123456

  # 导出门店对账
  node index.js reconcile SH001
  node index.js reconcile SH001 2024-01-01 2024-12-31
  node index.js reconcile SH001 2024-01-01 2024-12-31 ./output/report.csv

数据文件格式:
  - 所有数据文件均为 CSV 格式
  - 支持中英文列名
  - 详细格式请参考 samples 目录下的样例文件
`);
}

function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === 'help' || args[0] === '--help' || args[0] === '-h') {
    showHelp();
    process.exit(0);
  }

  const command = args[0];
  const subCommand = args[1];

  try {
    switch (command) {
      case 'import':
        handleImport(subCommand, args.slice(2));
        break;
      case 'verify':
        handleVerify(args[1]);
        break;
      case 'cancel':
        handleCancel(args[1], args.slice(2).join(' '));
        break;
      case 'trace':
        handleTrace(args[1]);
        break;
      case 'details':
        handleDetails(args[1]);
        break;
      case 'reconcile':
        handleReconcile(args[1], args[2], args[3], args[4]);
        break;
      default:
        log(`未知命令: ${command}`, 'error');
        showHelp();
        process.exit(1);
    }
  } catch (error) {
    log(`执行错误: ${error.message}`, 'error');
    if (process.env.DEBUG) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

function handleImport(type, args) {
  if (!type || args.length < 1) {
    log('导入命令参数不完整', 'error');
    console.log('用法: import <类型> <文件路径>');
    console.log('类型: vehicles, packages, rights, shops');
    process.exit(1);
  }

  const filePath = args[0];

  switch (type) {
    case 'vehicles':
    case 'vehicle':
      importer.importVehicles(filePath);
      break;
    case 'packages':
    case 'package':
      importer.importPackages(filePath);
      break;
    case 'rights':
    case 'right':
      importer.importPackageRights(filePath); break;
    case 'shops':
    case 'shop':
      importer.importShops(filePath);
      break;
    default:
      log(`未知导入类型: ${type}`, 'error');
      console.log('可用类型: vehicles, packages, rights, shops');
      process.exit(1);
  }
}

function handleVerify(filePath) {
  if (!filePath) {
    log('请指定核销文件路径', 'error');
    console.log('用法: verify <核销文件路径>');
    process.exit(1);
  }

  verification.processVerification(filePath);
}

function handleCancel(recordId, reason) {
  if (!recordId) {
    log('请指定核销单ID', 'error');
    console.log('用法: cancel <核销单ID> [原因]');
    process.exit(1);
  }

  verification.cancelVerification(recordId, reason);
}

function handleTrace(recordId) {
  if (!recordId) {
    log('请指定核销单ID', 'error');
    console.log('用法: trace <核销单ID>');
    process.exit(1);
  }

  const result = verification.getRecordTrace(recordId);
  if (result.success) {
    log(`\n=== 核销单追溯信息 (${recordId}) ==`, 'success');
    log(`来源文件: ${result.trace.sourceFile || '-'}`, 'info');
    log(`录入动作: ${result.trace.action || '-'}`, 'info');
    log(`最终结果: ${result.trace.finalResult || '-'}`, 'info');
    log(`\n状态: ${result.trace.status}`, 'info');
    log(`日期: ${result.trace.date}`, 'info');
    log(`车辆: ${result.trace.vehicle}`, 'info');
    log(`门店: ${result.trace.shop}`, 'info');
    if (result.trace.materials && result.trace.materials.length > 0) {
      log(`使用材料:`, 'info');
      result.trace.materials.forEach(m => {
        log(`  - ${m.name}: ${m.quantity}${m.unit || ''}`, 'info');
      });
    }
  } else {
    log(result.message, 'error');
  }
}

function handleDetails(vehicleIdentifier) {
  if (!vehicleIdentifier) {
    log('请指定车牌号码或VIN', 'error');
    console.log('用法: details <车牌或VIN>');
    process.exit(1);
  }

  query.getVehicleDetails(vehicleIdentifier);
}

function handleReconcile(shopId, startDate, endDate, outputFile) {
  if (!shopId) {
    log('请指定门店ID', 'error');
    console.log('用法: reconcile <门店ID> [开始日期] [结束日期] [输出文件]');
    process.exit(1);
  }

  query.exportShopReconciliation(shopId, startDate, endDate, outputFile);
}

// 运行主程序
if (require.main === module) {
  main();
}

module.exports = {
  main,
  importer,
  verification,
  query
};
