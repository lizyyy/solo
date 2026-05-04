#!/usr/bin/env node

const { program } = require('commander');
const path = require('path');
const fs = require('fs');
const config = require('../config');
const Inspector = require('../core/inspector');
const { MarkdownExporter, JSONExporter } = require('../exporters');
const DatabaseManager = require('../db');

program
  .name('inspect-pack')
  .description(`${config.app.name} - 社区合唱团演出资料包巡检器`)
  .version(config.app.version, '-v, --version', '显示版本号');

program
  .command('scan')
  .description('扫描资料包文件夹并执行巡检')
  .argument('<directory>', '资料包文件夹路径')
  .option('--json', '以JSON格式输出结果')
  .option('--no-color', '禁用彩色输出')
  .option('--export-markdown <path>', '导出Markdown交接单到指定路径')
  .option('--export-json <path>', '导出JSON审计包到指定路径')
  .action(async (directory, options) => {
    const useColor = options.color !== false;
    
    try {
      const absPath = path.resolve(directory);
      
      if (!fs.existsSync(absPath)) {
        console.error(`❌ 目录不存在: ${absPath}`);
        process.exit(1);
      }
      
      if (!fs.statSync(absPath).isDirectory()) {
        console.error(`❌ 路径不是目录: ${absPath}`);
        process.exit(1);
      }
      
      const inspector = new Inspector();
      
      console.log(`\n🎵 开始巡检资料包: ${absPath}\n`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      
      const result = await inspector.inspect(absPath);
      
      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
        inspector.close();
        return;
      }
      
      printResultSummary(result, useColor);
      
      if (result.validation.voicePart && result.validation.voicePart.scoreFiles.length > 0) {
        console.log('\n📄 检测到的分声部乐谱:');
        for (const file of result.validation.voicePart.scoreFiles) {
          console.log(`   • ${file.voicePart}: ${file.name}`);
        }
      }
      
      if (result.validation.version && result.validation.version.referenceVersion) {
        console.log(`\n📌 检测到的版本基准: v${result.validation.version.referenceVersion}`);
        
        if (result.validation.version.mismatchedFiles.length > 0) {
          console.log('\n⚠️ 版本不匹配的文件:');
          for (const file of result.validation.version.mismatchedFiles) {
            console.log(`   • ${file.name}: 当前 v${file.currentVersion} (期望 v${file.expectedVersion})`);
          }
        }
      }
      
      if (result.validation.allRisks.length > 0) {
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('⚠️ 风险明细:');
        
        const criticalRisks = result.validation.allRisks.filter(r => r.severity === 'critical');
        const warningRisks = result.validation.allRisks.filter(r => r.severity === 'warning');
        const infoRisks = result.validation.allRisks.filter(r => r.severity === 'info');
        
        if (criticalRisks.length > 0) {
          console.log('\n🔴 严重风险:');
          criticalRisks.forEach((risk, idx) => {
            console.log(`   ${idx + 1}. [${risk.category}] ${risk.message}`);
            if (risk.file_path) {
              console.log(`      关联文件: ${risk.file_path}`);
            }
          });
        }
        
        if (warningRisks.length > 0) {
          console.log('\n🟡 警告风险:');
          warningRisks.forEach((risk, idx) => {
            console.log(`   ${idx + 1}. [${risk.category}] ${risk.message}`);
            if (risk.file_path) {
              console.log(`      关联文件: ${risk.file_path}`);
            }
          });
        }
        
        if (infoRisks.length > 0) {
          console.log('\n🔵 提示信息:');
          infoRisks.forEach((risk, idx) => {
            console.log(`   ${idx + 1}. [${risk.category}] ${risk.message}`);
          });
        }
      }
      
      if (options.exportMarkdown || options.exportJson) {
        const db = new DatabaseManager();
        const inspectionDetails = inspector.getInspectionDetails(result.inspection.id);
        
        if (options.exportMarkdown) {
          const mdExporter = new MarkdownExporter();
          const mdPath = path.resolve(options.exportMarkdown);
          mdExporter.export(inspectionDetails, mdPath);
          console.log(`\n📄 Markdown交接单已导出: ${mdPath}`);
        }
        
        if (options.exportJson) {
          const jsonExporter = new JSONExporter();
          const jsonPath = path.resolve(options.exportJson);
          jsonExporter.export(inspectionDetails, jsonPath, db);
          console.log(`📋 JSON审计包已导出: ${jsonPath}`);
          
          db.createExport(result.inspection.id, 'json', jsonPath);
        }
        
        db.close();
      }
      
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      if (result.summary.status === 'passed') {
        console.log('✅ 巡检完成，资料包检查通过！');
      } else if (result.summary.status === 'warning') {
        console.log('⚠️ 巡检完成，存在警告风险，请查看详情。');
      } else {
        console.log('❌ 巡检完成，存在严重风险，必须修复！');
      }
      
      console.log(`\n📊 巡检记录ID: ${result.inspection.id}`);
      console.log(`📍 建议: 启动服务查看详细报告: inspect-server`);
      
      inspector.close();
      
      if (result.summary.status === 'failed') {
        process.exit(1);
      }
      
    } catch (error) {
      console.error('\n❌ 巡检过程中发生错误:');
      console.error(`   ${error.message}`);
      console.error('\n堆栈信息:');
      console.error(error.stack);
      process.exit(1);
    }
  });

program
  .command('list')
  .description('列出所有巡检记录')
  .option('--limit <number>', '限制显示数量', '50')
  .option('--offset <number>', '偏移量', '0')
  .option('--json', '以JSON格式输出')
  .action((options) => {
    const limit = parseInt(options.limit);
    const offset = parseInt(options.offset);
    
    const db = new DatabaseManager();
    const inspections = db.getInspections(limit, offset);
    
    if (options.json) {
      console.log(JSON.stringify(inspections, null, 2));
      db.close();
      return;
    }
    
    if (inspections.length === 0) {
      console.log('暂无巡检记录。使用 "inspect-pack scan <目录>" 开始巡检。');
      db.close();
      return;
    }
    
    console.log('\n📋 巡检记录列表:\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    inspections.forEach((inspection, idx) => {
      const statusIcon = {
        passed: '✅',
        warning: '⚠️',
        failed: '❌',
        pending: '⏳'
      }[inspection.status] || '❓';
      
      const statusText = {
        passed: '通过',
        warning: '警告',
        failed: '未通过',
        pending: '进行中'
      }[inspection.status] || '未知';
      
      console.log(`#${inspection.id} ${statusIcon} ${inspection.package_name}`);
      console.log(`   状态: ${statusText} | 风险: ${inspection.total_risks} (严重:${inspection.critical_risks} 警告:${inspection.warning_risks})`);
      console.log(`   时间: ${inspection.inspected_at}`);
      console.log(`   路径: ${inspection.package_path}`);
      console.log();
    });
    
    db.close();
  });

program
  .command('show')
  .description('显示指定巡检记录的详细信息')
  .argument('<id>', '巡检记录ID')
  .option('--json', '以JSON格式输出')
  .action((id, options) => {
    const inspectionId = parseInt(id);
    
    if (isNaN(inspectionId)) {
      console.error('❌ 无效的ID格式');
      process.exit(1);
    }
    
    const db = new DatabaseManager();
    const inspector = new Inspector();
    const details = inspector.getInspectionDetails(inspectionId);
    
    if (!details) {
      console.error(`❌ 巡检记录不存在: ${id}`);
      db.close();
      inspector.close();
      process.exit(1);
    }
    
    if (options.json) {
      console.log(JSON.stringify(details, null, 2));
      db.close();
      inspector.close();
      return;
    }
    
    const { inspection, risks, notes } = details;
    
    console.log('\n📋 巡检记录详情\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    const statusIcon = {
      passed: '✅',
      warning: '⚠️',
      failed: '❌',
      pending: '⏳'
    }[inspection.status] || '❓';
    
    console.log(`ID: #${inspection.id}`);
    console.log(`资料包: ${inspection.package_name}`);
    console.log(`路径: ${inspection.package_path}`);
    console.log(`巡检时间: ${inspection.inspected_at}`);
    console.log(`状态: ${statusIcon} ${inspection.status}`);
    console.log(`风险统计: 总计 ${inspection.total_risks} | 严重 ${inspection.critical_risks} | 警告 ${inspection.warning_risks}`);
    
    if (risks.length > 0) {
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('⚠️ 风险项:\n');
      
      risks.forEach((risk, idx) => {
        const severityIcon = {
          critical: '🔴',
          warning: '🟡',
          info: '🔵'
        }[risk.severity] || '⚪';
        
        console.log(`${idx + 1}. ${severityIcon} [${risk.category}] ${risk.message}`);
        if (risk.file_path) {
          console.log(`   关联文件: ${risk.file_path}`);
        }
        if (risk.details) {
          try {
            const detailsObj = typeof risk.details === 'string' ? JSON.parse(risk.details) : risk.details;
            console.log(`   详情: ${JSON.stringify(detailsObj)}`);
          } catch (e) {
            console.log(`   详情: ${risk.details}`);
          }
        }
        console.log();
      });
    }
    
    if (notes.length > 0) {
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📝 备注:\n');
      
      notes.forEach((note, idx) => {
        console.log(`${idx + 1}. [${note.created_by}] ${note.created_at}`);
        console.log(`   ${note.content}`);
        console.log();
      });
    }
    
    db.close();
    inspector.close();
  });

program
  .command('note')
  .description('为巡检记录添加备注')
  .argument('<id>', '巡检记录ID')
  .argument('<content>', '备注内容')
  .option('--author <name>', '作者名称', 'system')
  .action((id, content, options) => {
    const inspectionId = parseInt(id);
    
    if (isNaN(inspectionId)) {
      console.error('❌ 无效的ID格式');
      process.exit(1);
    }
    
    const db = new DatabaseManager();
    
    const inspection = db.getInspectionById(inspectionId);
    if (!inspection) {
      console.error(`❌ 巡检记录不存在: ${id}`);
      db.close();
      process.exit(1);
    }
    
    const noteId = db.createNote(inspectionId, {
      content,
      createdBy: options.author
    });
    
    console.log(`✅ 备注已添加 (ID: ${noteId})`);
    db.close();
  });

program
  .command('resolve')
  .description('标记风险为已解决')
  .argument('<riskId>', '风险记录ID')
  .action((riskId) => {
    const id = parseInt(riskId);
    
    if (isNaN(id)) {
      console.error('❌ 无效的ID格式');
      process.exit(1);
    }
    
    const db = new DatabaseManager();
    const result = db.resolveRisk(id);
    
    if (result.changes === 0) {
      console.error(`❌ 风险记录不存在: ${riskId}`);
      db.close();
      process.exit(1);
    }
    
    console.log(`✅ 风险已标记为已解决 (ID: ${id})`);
    db.close();
  });

program
  .command('export')
  .description('导出巡检记录')
  .argument('<id>', '巡检记录ID')
  .option('--markdown <path>', '导出Markdown到指定路径')
  .option('--json <path>', '导出JSON到指定路径')
  .action((id, options) => {
    const inspectionId = parseInt(id);
    
    if (isNaN(inspectionId)) {
      console.error('❌ 无效的ID格式');
      process.exit(1);
    }
    
    if (!options.markdown && !options.json) {
      console.error('❌ 请指定导出格式: --markdown 或 --json');
      process.exit(1);
    }
    
    const db = new DatabaseManager();
    const inspection = db.getInspectionById(inspectionId);
    
    if (!inspection) {
      console.error(`❌ 巡检记录不存在: ${id}`);
      db.close();
      process.exit(1);
    }
    
    const risks = db.getRisksByInspection(inspectionId);
    const notes = db.getNotesByInspection(inspectionId);
    const details = { inspection, risks, notes };
    
    if (options.markdown) {
      const mdExporter = new MarkdownExporter();
      const mdPath = path.resolve(options.markdown);
      mdExporter.export(details, mdPath);
      console.log(`📄 Markdown交接单已导出: ${mdPath}`);
    }
    
    if (options.json) {
      const jsonExporter = new JSONExporter();
      const jsonPath = path.resolve(options.json);
      jsonExporter.export(details, jsonPath, db);
      console.log(`📋 JSON审计包已导出: ${jsonPath}`);
    }
    
    db.close();
  });

function printResultSummary(result, useColor) {
  const { summary, inspection } = result;
  
  console.log('📊 巡检结果汇总:');
  console.log();
  console.log(`   资料包: ${inspection.package_name}`);
  console.log(`   文件数: ${result.package.fileCount}`);
  console.log();
  console.log(`   状态: ${getStatusText(summary.status, useColor)}`);
  console.log();
  console.log(`   风险统计:`);
  console.log(`     🔴 严重: ${summary.criticalRisks}`);
  console.log(`     🟡 警告: ${summary.warningRisks}`);
  console.log(`     📊 总计: ${summary.totalRisks}`);
}

function getStatusText(status, useColor) {
  const statusMap = {
    passed: { text: '✅ 通过', color: 'green' },
    warning: { text: '⚠️ 有警告', color: 'yellow' },
    failed: { text: '❌ 未通过', color: 'red' },
    pending: { text: '⏳ 进行中', color: 'blue' }
  };
  
  const info = statusMap[status] || { text: status, color: 'white' };
  return info.text;
}

program.parse(process.argv);

if (!process.argv.slice(2).length) {
  program.outputHelp();
}
