#!/usr/bin/env node

const { Command } = require('commander');
const path = require('path');
const fs = require('fs');

const LaserCutterDB = require('./database');
const DataImporter = require('./importer');
const Inspector = require('./inspector');
const Reviewer = require('./reviewer');
const Exporter = require('./exporter');

const program = new Command();

// 全局配置
let db = null;
let importer = null;
let inspector = null;
let reviewer = null;
let exporter = null;

// 初始化数据库和组件
function initComponents(dbPath = './laser_cutter.db') {
  db = new LaserCutterDB(dbPath);
  importer = new DataImporter(db);
  inspector = new Inspector(db);
  reviewer = new Reviewer(db, inspector);
  exporter = new Exporter(db);
}

// 关闭数据库
function closeComponents() {
  if (db) {
    db.close();
  }
}

// 主程序
program
  .name('laser-manager')
  .description('高校创客空间激光切割机管理工具')
  .version('1.0.0')
  .option('-d, --database <path>', '数据库文件路径', './laser_cutter.db');

// 导入命令
program
  .command('import')
  .description('导入数据到数据库')
  .option('-a, --appointments <csv>', '预约CSV文件路径')
  .option('-m, --materials <json>', '材料安全表JSON文件路径')
  .option('-s, --maintenance <json>', '维护时段JSON文件路径')
  .option('-o, --operations <json>', '开机记录JSON文件路径')
  .option('-u, --users <json>', '用户数据JSON文件路径（可选）')
  .action(async (options) => {
    try {
      initComponents(program.opts().database);
      
      console.log('=== 数据导入 ===\n');

      // 导入预约
      if (options.appointments) {
        const absPath = path.resolve(options.appointments);
        if (fs.existsSync(absPath)) {
          console.log(`导入预约数据: ${absPath}`);
          const result = await importer.importAppointments(absPath);
          console.log(`  成功: ${result.success} 条, 失败: ${result.errors.length} 条`);
          if (result.errors.length > 0) {
            result.errors.forEach(e => console.log(`    行 ${e.row}: ${e.error}`));
          }
        } else {
          console.log(`文件不存在: ${absPath}`);
        }
      }

      // 导入材料
      if (options.materials) {
        const absPath = path.resolve(options.materials);
        if (fs.existsSync(absPath)) {
          console.log(`导入材料数据: ${absPath}`);
          const result = await importer.importMaterials(absPath);
          console.log(`  成功: ${result.success} 条, 失败: ${result.errors.length} 条`);
          if (result.errors.length > 0) {
            result.errors.forEach(e => console.log(`    索引 ${e.index}: ${e.error}`));
          }
        } else {
          console.log(`文件不存在: ${absPath}`);
        }
      }

      // 导入维护时段
      if (options.maintenance) {
        const absPath = path.resolve(options.maintenance);
        if (fs.existsSync(absPath)) {
          console.log(`导入维护时段: ${absPath}`);
          const result = await importer.importMaintenanceSlots(absPath);
          console.log(`  成功: ${result.success} 条, 失败: ${result.errors.length} 条`);
          if (result.errors.length > 0) {
            result.errors.forEach(e => console.log(`    索引 ${e.index}: ${e.error}`));
          }
        } else {
          console.log(`文件不存在: ${absPath}`);
        }
      }

      // 导入开机记录
      if (options.operations) {
        const absPath = path.resolve(options.operations);
        if (fs.existsSync(absPath)) {
          console.log(`导入开机记录: ${absPath}`);
          const result = await importer.importOperationRecords(absPath);
          console.log(`  成功: ${result.success} 条, 失败: ${result.errors.length} 条`);
          if (result.errors.length > 0) {
            result.errors.forEach(e => console.log(`    索引 ${e.index}: ${e.error}`));
          }
        } else {
          console.log(`文件不存在: ${absPath}`);
        }
      }

      // 导入用户数据
      if (options.users) {
        const absPath = path.resolve(options.users);
        if (fs.existsSync(absPath)) {
          console.log(`导入用户数据: ${absPath}`);
          const result = await importer.importUsers(absPath);
          console.log(`  成功: ${result.success} 条, 失败: ${result.errors.length} 条`);
          if (result.errors.length > 0) {
            result.errors.forEach(e => console.log(`    索引 ${e.index}: ${e.error}`));
          }
        } else {
          console.log(`文件不存在: ${absPath}`);
        }
      }

      console.log('\n导入完成！');
      closeComponents();
    } catch (error) {
      console.error('导入失败:', error.message);
      process.exit(1);
    }
  });

// 检查命令
program
  .command('check')
  .description('运行所有检查并生成违规记录')
  .option('--max-hours <hours>', '连续开机最大小时数', '8')
  .action((options) => {
    try {
      initComponents(program.opts().database);
      
      console.log('=== 运行安全检查 ===\n');

      // 更新最大连续运行时间
      inspector.maxContinuousHours = parseInt(options.maxHours);

      // 运行所有检查
      const result = inspector.runAllChecks();

      console.log(`检查完成！共发现 ${result.total} 条违规记录\n`);

      // 按类型显示统计
      const typeNames = {
        'FORBIDDEN_MATERIAL': '使用禁切材料',
        'THICKNESS_POWER_MISMATCH': '厚度功率不匹配',
        'MAINTENANCE_CONFLICT': '维护时段冲突',
        'CONTINUOUS_TIMEOUT': '连续开机超时',
        'UNTRAINED_USER': '未培训人员操作'
      };

      console.log('按类型统计:');
      for (const [type, items] of Object.entries(result.byType)) {
        const name = typeNames[type] || type;
        console.log(`  ${name}: ${items.length} 条`);
      }

      // 显示详细信息
      if (result.total > 0) {
        console.log('\n违规详情:');
        result.violations.forEach((v, i) => {
          const severityEmoji = v.severity === 'high' ? '🔴' : v.severity === 'medium' ? '🟡' : '🟢';
          console.log(`\n  ${i + 1}. ${severityEmoji} [${typeNames[v.violation_type] || v.violation_type}]`);
          console.log(`     严重程度: ${v.severity === 'high' ? '高危' : v.severity === 'medium' ? '中危' : '低危'}`);
          console.log(`     描述: ${v.description}`);
          if (v.user_id) console.log(`     用户: ${v.user_id}`);
          if (v.machine_id) console.log(`     机器: ${v.machine_id}`);
        });
      }

      closeComponents();
    } catch (error) {
      console.error('检查失败:', error.message);
      process.exit(1);
    }
  });

// 复核命令
program
  .command('review')
  .description('启动本地复核Web界面')
  .option('-p, --port <port>', 'Web服务器端口', '3000')
  .action((options) => {
    try {
      initComponents(program.opts().database);
      
      console.log('=== 启动复核界面 ===\n');
      console.log(`数据库: ${program.opts().database}`);
      console.log(`端口: ${options.port}`);
      console.log(`\n请在浏览器中访问: http://localhost:${options.port}`);
      console.log('按 Ctrl+C 停止服务器\n');

      // 启动Web服务器
      reviewer.startWebServer(parseInt(options.port));

      // 处理退出信号
      process.on('SIGINT', () => {
        console.log('\n正在停止服务器...');
        reviewer.stopWebServer();
        closeComponents();
        process.exit(0);
      });

    } catch (error) {
      console.error('启动复核界面失败:', error.message);
      process.exit(1);
    }
  });

// 导出命令
program
  .command('export')
  .description('导出数据')
  .option('-m, --markdown <path>', '导出Markdown值班提醒')
  .option('-c, --csv <path>', '导出CSV风险清单')
  .option('-j, --json <path>', '导出JSON审计包')
  .option('-a, --all <dir>', '导出所有格式到指定目录')
  .action((options) => {
    try {
      initComponents(program.opts().database);
      
      console.log('=== 数据导出 ===\n');

      // 导出所有格式
      if (options.all) {
        const absDir = path.resolve(options.all);
        console.log(`导出所有格式到: ${absDir}`);
        const results = exporter.exportAll(absDir);
        
        console.log('\n导出结果:');
        if (results.markdown.success) {
          console.log(`  ✅ Markdown: ${results.markdown.path}`);
        } else {
          console.log(`  ❌ Markdown: ${results.markdown.error}`);
        }
        if (results.csv.success) {
          console.log(`  ✅ CSV: ${results.csv.path} (${results.csv.count} 条)`);
        } else {
          console.log(`  ❌ CSV: ${results.csv.error}`);
        }
        if (results.json.success) {
          console.log(`  ✅ JSON: ${results.json.path}`);
          console.log(`     统计: 用户 ${results.json.stats.users}, 预约 ${results.json.stats.appointments}, 违规 ${results.json.stats.violations}`);
        } else {
          console.log(`  ❌ JSON: ${results.json.error}`);
        }
      }

      // 单独导出Markdown
      if (options.markdown && !options.all) {
        const absPath = path.resolve(options.markdown);
        console.log(`导出Markdown值班提醒: ${absPath}`);
        const result = exporter.exportDutyReminder(absPath);
        if (result.success) {
          console.log(`  ✅ 导出成功`);
        } else {
          console.log(`  ❌ 导出失败`);
        }
      }

      // 单独导出CSV
      if (options.csv && !options.all) {
        const absPath = path.resolve(options.csv);
        console.log(`导出CSV风险清单: ${absPath}`);
        const result = exporter.exportRiskCsv(absPath);
        if (result.success) {
          console.log(`  ✅ 导出成功，共 ${result.count} 条记录`);
        } else {
          console.log(`  ❌ 导出失败`);
        }
      }

      // 单独导出JSON
      if (options.json && !options.all) {
        const absPath = path.resolve(options.json);
        console.log(`导出JSON审计包: ${absPath}`);
        const result = exporter.exportAuditPackage(absPath);
        if (result.success) {
          console.log(`  ✅ 导出成功`);
          console.log(`     统计: 用户 ${result.stats.users}, 预约 ${result.stats.appointments}, 违规 ${result.stats.violations}`);
        } else {
          console.log(`  ❌ 导出失败`);
        }
      }

      console.log('\n导出完成！');
      closeComponents();
    } catch (error) {
      console.error('导出失败:', error.message);
      process.exit(1);
    }
  });

// 统计命令
program
  .command('stats')
  .description('显示数据库统计信息')
  .action(() => {
    try {
      initComponents(program.opts().database);
      
      console.log('=== 数据库统计 ===\n');

      // 各表统计
      const stats = {
        users: db.get(`SELECT COUNT(*) as count FROM users`).count,
        appointments: db.get(`SELECT COUNT(*) as count FROM appointments`).count,
        materials: db.get(`SELECT COUNT(*) as count FROM materials`).count,
        maintenance_slots: db.get(`SELECT COUNT(*) as count FROM maintenance_slots`).count,
        operation_records: db.get(`SELECT COUNT(*) as count FROM operation_records`).count,
        violations: db.get(`SELECT COUNT(*) as count FROM violations`).count,
        reviews: db.get(`SELECT COUNT(*) as count FROM reviews`).count
      };

      // 违规状态统计
      const violationStats = {
        pending: db.get(`SELECT COUNT(*) as count FROM violations WHERE status = 'pending'`).count,
        confirmed: db.get(`SELECT COUNT(*) as count FROM violations WHERE status = 'confirmed'`).count,
        dismissed: db.get(`SELECT COUNT(*) as count FROM violations WHERE status = 'dismissed'`).count,
        high: db.get(`SELECT COUNT(*) as count FROM violations WHERE severity = 'high'`).count,
        medium: db.get(`SELECT COUNT(*) as count FROM violations WHERE severity = 'medium'`).count,
        low: db.get(`SELECT COUNT(*) as count FROM violations WHERE severity = 'low'`).count
      };

      console.log('数据记录:');
      console.log(`  用户: ${stats.users} 人`);
      console.log(`  预约: ${stats.appointments} 条`);
      console.log(`  材料: ${stats.materials} 种`);
      console.log(`  维护时段: ${stats.maintenance_slots} 个`);
      console.log(`  开机记录: ${stats.operation_records} 条`);
      console.log(`  违规记录: ${stats.violations} 条`);
      console.log(`  复核记录: ${stats.reviews} 条`);

      console.log('\n违规状态:');
      console.log(`  待复核: ${violationStats.pending} 条`);
      console.log(`  已确认: ${violationStats.confirmed} 条`);
      console.log(`  已驳回: ${violationStats.dismissed} 条`);

      console.log('\n违规严重程度:');
      console.log(`  🔴 高危: ${violationStats.high} 条`);
      console.log(`  🟡 中危: ${violationStats.medium} 条`);
      console.log(`  🟢 低危: ${violationStats.low} 条`);

      closeComponents();
    } catch (error) {
      console.error('获取统计失败:', error.message);
      process.exit(1);
    }
  });

// 清空命令
program
  .command('clear')
  .description('清空数据库表')
  .option('-a, --all', '清空所有表')
  .option('--violations', '清空违规记录')
  .option('--reviews', '清空复核记录')
  .action((options) => {
    try {
      initComponents(program.opts().database);
      
      console.log('=== 清空数据 ===\n');

      if (options.all) {
        console.log('清空所有表...');
        db.run(`DELETE FROM violations`);
        db.run(`DELETE FROM reviews`);
        db.run(`DELETE FROM operation_records`);
        db.run(`DELETE FROM maintenance_slots`);
        db.run(`DELETE FROM appointments`);
        db.run(`DELETE FROM materials`);
        db.run(`DELETE FROM users`);
        console.log('  ✅ 所有表已清空');
      } else {
        if (options.violations) {
          db.run(`DELETE FROM violations`);
          console.log('  ✅ 违规记录已清空');
        }
        if (options.reviews) {
          db.run(`DELETE FROM reviews`);
          console.log('  ✅ 复核记录已清空');
        }
      }

      closeComponents();
    } catch (error) {
      console.error('清空失败:', error.message);
      process.exit(1);
    }
  });

// 帮助命令
program
  .command('help')
  .description('显示帮助信息')
  .action(() => {
    console.log(`
激光切割机管理工具 - 使用帮助

用法: laser-manager [命令] [选项]

命令:
  import    导入数据到数据库
  check     运行所有安全检查
  review    启动本地复核Web界面
  export    导出数据
  stats     显示数据库统计
  clear     清空数据库表
  help      显示此帮助信息

示例:
  # 导入数据
  laser-manager import -a appointments.csv -m materials.json -s maintenance.json -o operations.json

  # 运行检查
  laser-manager check

  # 启动复核界面
  laser-manager review -p 3000

  # 导出所有格式
  laser-manager export -a ./exports/

  # 查看统计
  laser-manager stats

选项:
  -d, --database <path>  指定数据库文件路径 (默认: ./laser_cutter.db)
    `);
  });

// 解析命令行参数
program.parse(process.argv);

// 如果没有提供命令，显示帮助
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
