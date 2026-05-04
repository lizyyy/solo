#!/usr/bin/env node

const { program } = require('commander');
const path = require('path');

const { initDatabase, closeDatabase } = require('./database');
const { 
  scanRepairOrders, 
  scanShutterTests, 
  scanAccessories, 
  scanPhotosDirectory,
  clearScanResults
} = require('./scanner');
const { 
  runAllChecks, 
  markNotified, 
  updateOrderStatus,
  resolveAnomaly,
  getUnresolvedAnomalies,
  getAllOrders
} = require('./service');
const { 
  exportHandoverMarkdown, 
  exportAuditJSON,
  generateHandoverMarkdown
} = require('./exporter');

program
  .name('camera-repair')
  .description('二手相机维修铺本地管理工具')
  .version('1.0.0');

program
  .command('scan')
  .description('扫描数据文件并导入数据库')
  .option('--orders <file>', '送修单 CSV 文件路径')
  .option('--shutter <file>', '快门测试 CSV 文件路径')
  .option('--accessories <file>', '配件到货 JSON 文件路径')
  .option('--photos <dir>', '维修照片目录路径')
  .action(async (options) => {
    initDatabase();
    clearScanResults();
    
    console.log('开始扫描数据...\n');
    
    try {
      if (options.orders) {
        const result = await scanRepairOrders(options.orders);
        if (result.success) {
          console.log(`✓ 送修单: 导入 ${result.count} 条记录`);
        } else {
          console.log(`✗ 送修单: ${result.error}`);
        }
      }
      
      if (options.shutter) {
        const result = await scanShutterTests(options.shutter);
        if (result.success) {
          console.log(`✓ 快门测试: 导入 ${result.count} 条记录`);
        } else {
          console.log(`✗ 快门测试: ${result.error}`);
        }
      }
      
      if (options.accessories) {
        const result = scanAccessories(options.accessories);
        if (result.success) {
          console.log(`✓ 配件到货: 导入 ${result.count} 条记录`);
        } else {
          console.log(`✗ 配件到货: ${result.error}`);
        }
      }
      
      if (options.photos) {
        const result = scanPhotosDirectory(options.photos);
        if (result.success) {
          console.log(`✓ 维修照片: 发现 ${result.count} 张照片`);
        } else {
          console.log(`✗ 维修照片: ${result.error}`);
        }
      }
      
      console.log('\n扫描完成，运行异常检测...');
      const checkResult = runAllChecks();
      console.log(`异常检测完成: 发现 ${checkResult.total} 个异常`);
      if (checkResult.total > 0) {
        console.log('异常分布:');
        if (checkResult.byType.shutter_abnormal > 0) {
          console.log(`  - 快门次数异常: ${checkResult.byType.shutter_abnormal} 个`);
        }
        if (checkResult.byType.accessory_missing > 0) {
          console.log(`  - 配件未到货: ${checkResult.byType.accessory_missing} 个`);
        }
        if (checkResult.byType.photo_missing > 0) {
          console.log(`  - 照片缺失: ${checkResult.byType.photo_missing} 个`);
        }
        if (checkResult.byType.duplicate_repair > 0) {
          console.log(`  - 重复送修: ${checkResult.byType.duplicate_repair} 个`);
        }
      }
      
    } catch (error) {
      console.error('扫描过程出错:', error.message);
      process.exit(1);
    }
    
    closeDatabase();
  });

program
  .command('recheck')
  .description('重新运行所有异常检测')
  .option('--list', '列出所有未解决的异常')
  .option('--resolve <id>', '标记指定异常为已解决')
  .action((options) => {
    initDatabase();
    
    try {
      if (options.resolve) {
        const result = resolveAnomaly(parseInt(options.resolve));
        if (result.success) {
          console.log(`✓ 异常 #${options.resolve} 已标记为已解决`);
        } else {
          console.log(`✗ 未找到异常 #${options.resolve}`);
        }
      } else {
        console.log('运行异常检测...\n');
        const checkResult = runAllChecks();
        
        console.log(`检测完成: 共发现 ${checkResult.total} 个异常\n`);
        
        if (options.list || checkResult.total > 0) {
          const anomalies = getUnresolvedAnomalies();
          if (anomalies.length > 0) {
            console.log('未解决的异常列表:\n');
            anomalies.forEach(a => {
              const typeMap = {
                'shutter_abnormal': '快门异常',
                'accessory_missing': '配件缺失',
                'photo_missing': '照片缺失',
                'duplicate_repair': '重复送修'
              };
              console.log(`[${a.id}] ${typeMap[a.anomaly_type] || a.anomaly_type}`);
              console.log(`    机身编号: ${a.body_serial || 'N/A'}`);
              console.log(`    描述: ${a.description}`);
              console.log();
            });
          }
        }
      }
    } catch (error) {
      console.error('检测过程出错:', error.message);
      process.exit(1);
    }
    
    closeDatabase();
  });

program
  .command('export')
  .description('导出数据')
  .option('--handover <order_no>', '导出指定订单的 Markdown 交接单')
  .option('--audit', '导出完整的 JSON 审计包')
  .option('--output <dir>', '输出目录 (默认: 当前目录)', '.')
  .option('--print', '在控制台打印交接单内容')
  .action((options) => {
    initDatabase();
    
    try {
      if (options.handover) {
        if (options.print) {
          const markdown = generateHandoverMarkdown(options.handover);
          if (markdown) {
            console.log(markdown);
          } else {
            console.log(`✗ 订单 ${options.handover} 不存在`);
          }
        } else {
          const result = exportHandoverMarkdown(options.handover, options.output);
          if (result.success) {
            console.log(`✓ 交接单已导出: ${result.filePath}`);
          } else {
            console.log(`✗ 导出失败: ${result.error}`);
          }
        }
      }
      
      if (options.audit) {
        const result = exportAuditJSON(options.output);
        if (result.success) {
          console.log(`✓ 审计包已导出: ${result.filePath}`);
        } else {
          console.log(`✗ 导出失败: ${result.error}`);
        }
      }
      
      if (!options.handover && !options.audit) {
        console.log('请指定导出类型: --handover <订单号> 或 --audit');
      }
    } catch (error) {
      console.error('导出过程出错:', error.message);
      process.exit(1);
    }
    
    closeDatabase();
  });

program
  .command('notify')
  .description('管理客户通知状态')
  .argument('<order_no>', '订单号')
  .option('--status <status>', '设置通知状态: yes/no', 'yes')
  .action((orderNo, options) => {
    initDatabase();
    
    try {
      const notified = options.status === 'yes';
      const result = markNotified(orderNo, notified);
      
      if (result.success) {
        console.log(`✓ 订单 ${orderNo} 已标记为${notified ? '已通知' : '未通知'}`);
      } else {
        console.log(`✗ 未找到订单 ${orderNo}`);
      }
    } catch (error) {
      console.error('操作出错:', error.message);
      process.exit(1);
    }
    
    closeDatabase();
  });

program
  .command('status')
  .description('查看或更新订单状态')
  .argument('[order_no]', '订单号 (可选，不指定则列出所有订单)')
  .option('--set <status>', '设置订单状态: pending/in_progress/waiting_parts/completed/cancelled')
  .action((orderNo, options) => {
    initDatabase();
    
    try {
      if (orderNo && options.set) {
        const result = updateOrderStatus(orderNo, options.set);
        if (result.success) {
          const statusMap = {
            'pending': '待处理',
            'in_progress': '维修中',
            'waiting_parts': '等待配件',
            'completed': '已完成',
            'cancelled': '已取消'
          };
          console.log(`✓ 订单 ${orderNo} 状态已更新为: ${statusMap[options.set] || options.set}`);
        } else {
          console.log(`✗ ${result.error || '更新失败'}`);
        }
      } else {
        const orders = getAllOrders();
        if (orders.length === 0) {
          console.log('暂无订单数据');
        } else {
          const statusMap = {
            'pending': '待处理',
            'in_progress': '维修中',
            'waiting_parts': '等待配件',
            'completed': '已完成',
            'cancelled': '已取消'
          };
          console.log('订单列表:\n');
          orders.forEach(o => {
            console.log(`${o.order_no} | ${o.camera_model || '未知型号'} | ${o.body_serial}`);
            console.log(`  客户: ${o.customer_name || '未知'} | 状态: ${statusMap[o.status] || o.status}`);
            console.log(`  通知: ${o.notified ? '已通知' : '未通知'} | 日期: ${o.receive_date || '未知'}`);
            console.log();
          });
        }
      }
    } catch (error) {
      console.error('操作出错:', error.message);
      process.exit(1);
    }
    
    closeDatabase();
  });

program.parse(process.argv);
