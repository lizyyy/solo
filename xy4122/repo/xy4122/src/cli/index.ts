#!/usr/bin/env node

import { Command } from 'commander';
import * as fs from 'fs-extra';
import * as path from 'path';
import { format } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';

import {
  TemperatureParser,
  DoorParser,
  VaccineParser,
} from '../parsers';
import { RuleEngine } from '../rules';
import { SessionStorage, createSession } from '../storage';
import {
  MarkdownExporter,
  CSVExporter,
  JSONExporter,
} from '../exporters';
import {
  generateSampleTemperatureRecords,
  generateSampleDoorRecords,
  generateSampleVaccineBatches,
  generateSampleCSVContent,
} from '../samples';
import {
  ReviewSession,
  SourceFileInfo,
  SessionData,
  SessionAnalysis,
} from '../types';

const program = new Command();

program
  .name('vaccine-review')
  .description('疫苗温度异常复盘台 - 社区卫生服务站冷链数据分析工具')
  .version('1.0.0');

let currentSession: ReviewSession | null = null;
const sessionStorage = new SessionStorage();
const ruleEngine = new RuleEngine();

program
  .command('demo')
  .description('使用示例数据运行演示分析')
  .option('-n, --name <name>', '会话名称', '演示分析-' + format(new Date(), 'yyyyMMdd-HHmmss'))
  .option('-s, --save', '保存会话')
  .action(async (options) => {
    console.log('🧪 开始演示分析...\n');

    const tempRecords = generateSampleTemperatureRecords();
    const doorRecords = generateSampleDoorRecords();
    const vaccineBatches = generateSampleVaccineBatches();

    console.log('📊 数据统计:');
    console.log(`  - 温度记录: ${tempRecords.length} 条`);
    console.log(`  - 开门记录: ${doorRecords.length} 条`);
    console.log(`  - 疫苗批次: ${vaccineBatches.length} 个\n`);

    console.log('🔍 运行规则引擎分析...\n');
    const analysis = ruleEngine.analyze(tempRecords, doorRecords, vaccineBatches);

    printAnalysisSummary(analysis);

    const sessionData: SessionData = {
      temperatureRecords: tempRecords,
      doorRecords,
      vaccineBatches,
    };

    const sourceFiles: SourceFileInfo[] = [];

    currentSession = createSession(
      options.name,
      sourceFiles,
      sessionData,
      analysis
    );

    if (options.save) {
      const sessionId = await sessionStorage.save(currentSession);
      console.log(`\n💾 会话已保存，ID: ${sessionId}`);
    }

    console.log('\n✅ 演示分析完成！');
    console.log('使用 "vaccine-review export" 命令导出报告，或 "vaccine-review generate-samples" 生成示例CSV文件。');
  });

program
  .command('import')
  .description('导入CSV文件并进行分析')
  .requiredOption('-t, --temperature <files...>', '温度记录CSV文件（多个文件用空格分隔）')
  .option('-d, --door <files...>', '开门记录CSV文件')
  .option('-v, --vaccine <files...>', '疫苗批次CSV文件')
  .option('-n, --name <name>', '会话名称', '复盘分析-' + format(new Date(), 'yyyyMMdd-HHmmss'))
  .option('-s, --save', '保存会话')
  .action(async (options) => {
    console.log('📥 开始导入数据...\n');

    const tempParser = new TemperatureParser();
    const doorParser = new DoorParser();
    const vaccineParser = new VaccineParser();

    const sourceFiles: SourceFileInfo[] = [];

    const tempRecords = await tempParser.parseFiles(options.temperature);
    for (const file of options.temperature) {
      const stat = await fs.stat(file);
      const content = await fs.readFile(file, 'utf-8');
      const hash = createHash('md5').update(content).digest('hex');
      
      sourceFiles.push({
        id: uuidv4(),
        filename: path.basename(file),
        filePath: file,
        fileType: 'temperature',
        size: stat.size,
        importedAt: new Date(),
        recordCount: tempRecords.length,
        hash,
      });
    }

    let doorRecords: any[] = [];
    if (options.door) {
      doorRecords = await doorParser.parseFiles(options.door);
      for (const file of options.door) {
        const stat = await fs.stat(file);
        const content = await fs.readFile(file, 'utf-8');
        const hash = createHash('md5').update(content).digest('hex');
        
        sourceFiles.push({
          id: uuidv4(),
          filename: path.basename(file),
          filePath: file,
          fileType: 'door',
          size: stat.size,
          importedAt: new Date(),
          recordCount: doorRecords.length,
          hash,
        });
      }
    }

    let vaccineBatches: any[] = [];
    if (options.vaccine) {
      vaccineBatches = await vaccineParser.parseFiles(options.vaccine);
      for (const file of options.vaccine) {
        const stat = await fs.stat(file);
        const content = await fs.readFile(file, 'utf-8');
        const hash = createHash('md5').update(content).digest('hex');
        
        sourceFiles.push({
          id: uuidv4(),
          filename: path.basename(file),
          filePath: file,
          fileType: 'vaccine',
          size: stat.size,
          importedAt: new Date(),
          recordCount: vaccineBatches.length,
          hash,
        });
      }
    }

    console.log('📊 导入数据统计:');
    console.log(`  - 温度记录: ${tempRecords.length} 条`);
    console.log(`  - 开门记录: ${doorRecords.length} 条`);
    console.log(`  - 疫苗批次: ${vaccineBatches.length} 个\n`);

    console.log('🔍 运行规则引擎分析...\n');
    const analysis = ruleEngine.analyze(tempRecords, doorRecords, vaccineBatches);

    printAnalysisSummary(analysis);

    const sessionData: SessionData = {
      temperatureRecords: tempRecords,
      doorRecords,
      vaccineBatches,
    };

    currentSession = createSession(
      options.name,
      sourceFiles,
      sessionData,
      analysis
    );

    if (options.save) {
      const sessionId = await sessionStorage.save(currentSession);
      console.log(`\n💾 会话已保存，ID: ${sessionId}`);
    }

    console.log('\n✅ 导入和分析完成！');
  });

program
  .command('sessions')
  .description('管理已保存的会话')
  .option('-l, --list', '列出现有会话')
  .option('-d, --delete <id>', '删除指定会话')
  .option('-L, --load <id>', '加载指定会话')
  .action(async (options) => {
    if (options.list) {
      console.log('📋 已保存的会话列表:\n');
      const sessions = await sessionStorage.list();
      
      if (sessions.length === 0) {
        console.log('  暂无保存的会话');
        return;
      }

      console.log('  ID                                  名称                              创建时间           记录数  异常数  风险数');
      console.log('  ----------------------------------  --------------------------------  -----------------  ------  ------  ------');
      for (const session of sessions) {
        console.log(`  ${session.id.padEnd(36)}  ${session.name.padEnd(32)}  ${format(session.createdAt, 'yyyy-MM-dd HH:mm').padEnd(17)}  ${String(session.recordCount).padEnd(6)}  ${String(session.anomalyCount).padEnd(6)}  ${String(session.riskFragmentCount).padEnd(6)}`);
      }
      return;
    }

    if (options.delete) {
      const exists = await sessionStorage.exists(options.delete);
      if (!exists) {
        console.log(`❌ 会话不存在: ${options.delete}`);
        return;
      }
      const deleted = await sessionStorage.delete(options.delete);
      if (deleted) {
        console.log(`✅ 会话已删除: ${options.delete}`);
      }
      return;
    }

    if (options.load) {
      const session = await sessionStorage.load(options.load);
      if (!session) {
        console.log(`❌ 会话不存在: ${options.load}`);
        return;
      }
      currentSession = session;
      console.log(`✅ 会话已加载: ${session.name}`);
      printAnalysisSummary(session.analysis);
      return;
    }

    console.log('请使用 --list, --delete 或 --load 选项');
  });

program
  .command('export')
  .description('导出分析报告')
  .option('-f, --format <format>', '导出格式: markdown, csv, json (默认: markdown)', 'markdown')
  .option('-o, --output <path>', '输出路径 (默认: 当前目录)')
  .option('-i, --session-id <id>', '使用指定会话ID (如果不指定，使用当前会话)')
  .action(async (options) => {
    let session = currentSession;

    if (options.sessionId) {
      session = await sessionStorage.load(options.sessionId);
      if (!session) {
        console.log(`❌ 会话不存在: ${options.sessionId}`);
        return;
      }
    }

    if (!session) {
      console.log('❌ 没有可用的会话，请先运行 demo 或 import 命令');
      return;
    }

    const outputDir = options.output || process.cwd();
    await fs.ensureDir(outputDir);

    const timestamp = format(new Date(), 'yyyyMMdd-HHmmss');

    if (options.format === 'markdown' || options.format === 'md') {
      const exporter = new MarkdownExporter();
      const content = exporter.export(session);
      const filePath = path.join(outputDir, `复盘报告-${session.name}-${timestamp}.md`);
      await fs.writeFile(filePath, content, 'utf-8');
      console.log(`📄 Markdown报告已导出: ${filePath}`);
    } else if (options.format === 'csv') {
      const exporter = new CSVExporter();
      const result = exporter.export(session);
      
      const anomaliesPath = path.join(outputDir, `异常事件-${session.name}-${timestamp}.csv`);
      const fragmentsPath = path.join(outputDir, `风险片段-${session.name}-${timestamp}.csv`);
      const batchesPath = path.join(outputDir, `疫苗批次-${session.name}-${timestamp}.csv`);
      
      await fs.writeFile(anomaliesPath, result.anomalies, 'utf-8');
      await fs.writeFile(fragmentsPath, result.riskFragments, 'utf-8');
      await fs.writeFile(batchesPath, result.batches, 'utf-8');
      
      console.log('📊 CSV报告已导出:');
      console.log(`  - 异常事件: ${anomaliesPath}`);
      console.log(`  - 风险片段: ${fragmentsPath}`);
      console.log(`  - 疫苗批次: ${batchesPath}`);
    } else if (options.format === 'json') {
      const exporter = new JSONExporter();
      const content = exporter.export(session);
      const filePath = path.join(outputDir, `复盘报告-${session.name}-${timestamp}.json`);
      await fs.writeFile(filePath, content, 'utf-8');
      console.log(`📋 JSON报告已导出: ${filePath}`);
    } else {
      console.log(`❌ 不支持的导出格式: ${options.format}`);
      console.log('支持的格式: markdown (md), csv, json');
    }
  });

program
  .command('generate-samples')
  .description('生成示例CSV文件')
  .option('-o, --output <path>', '输出路径 (默认: 当前目录)')
  .action(async (options) => {
    console.log('📁 生成示例CSV文件...\n');

    const outputDir = options.output || process.cwd();
    await fs.ensureDir(outputDir);

    const content = generateSampleCSVContent();

    const tempPath = path.join(outputDir, 'temperature-sample.csv');
    const doorPath = path.join(outputDir, 'door-sample.csv');
    const vaccinePath = path.join(outputDir, 'vaccine-sample.csv');

    await fs.writeFile(tempPath, content.temperature, 'utf-8');
    await fs.writeFile(doorPath, content.door, 'utf-8');
    await fs.writeFile(vaccinePath, content.vaccine, 'utf-8');

    console.log('✅ 示例文件已生成:');
    console.log(`  - 温度记录: ${tempPath}`);
    console.log(`  - 开门记录: ${doorPath}`);
    console.log(`  - 疫苗批次: ${vaccinePath}`);
    console.log('\n💡 使用以下命令导入并分析:');
    console.log(`  vaccine-review import -t "${tempPath}" -d "${doorPath}" -v "${vaccinePath}" -s`);
  });

function printAnalysisSummary(analysis: SessionAnalysis): void {
  const { summary, anomalies, riskFragments } = analysis;

  console.log('📋 分析概要:');
  console.log(`  时间范围: ${format(summary.timeRange.start, 'yyyy-MM-dd HH:mm')} - ${format(summary.timeRange.end, 'yyyy-MM-dd HH:mm')}`);
  console.log(`  总记录数: ${summary.totalRecords}`);
  console.log(`  异常事件: ${summary.totalAnomalies} 个`);
  console.log(`  风险片段: ${summary.totalRiskFragments} 个`);
  console.log(`  受影响批次: ${summary.affectedBatches.length || '无'} 个\n`);

  if (summary.totalAnomalies > 0) {
    console.log('⚠️  异常类型分布:');
    const typeMap: Record<string, string> = {
      over_temp: '超温',
      under_temp: '低温',
      missing_data: '缺测',
      rapid_change: '温度波动',
      transfer_gap: '转移空档',
      probe_disconnect: '探头断线',
      door_open_long: '长时间开门',
    };
    for (const [type, count] of Object.entries(summary.anomalyByType)) {
      if (count > 0) {
        console.log(`  - ${typeMap[type] || type}: ${count} 个`);
      }
    }
    console.log('');
  }

  if (riskFragments.length > 0) {
    console.log('🎯 风险片段详情:');
    const levelMap: Record<string, string> = {
      high: '🔴 高风险',
      medium: '🟡 中风险',
      low: '🟢 低风险',
      none: '⚪ 无风险',
    };
    
    for (const fragment of riskFragments) {
      console.log(`\n  ${levelMap[fragment.riskLevel]}`);
      console.log(`  疫苗: ${fragment.vaccineName} (批次: ${fragment.batchId})`);
      console.log(`  时间: ${format(fragment.startTime, 'yyyy-MM-dd HH:mm')} - ${format(fragment.endTime, 'yyyy-MM-dd HH:mm')} (${fragment.totalDurationMinutes} 分钟)`);
      console.log(`  温度暴露: 最低 ${fragment.temperatureExposure.min}°C, 最高 ${fragment.temperatureExposure.max}°C, 平均 ${fragment.temperatureExposure.avg}°C`);
      console.log(`  涉及冰箱: ${fragment.fridgeLocations.join(', ')}`);
      console.log(`  建议优先级: ${fragment.recommendedAction.priority === 'immediate' ? '立即' : fragment.recommendedAction.priority === 'urgent' ? '紧急' : fragment.recommendedAction.priority === 'standard' ? '标准' : '监控'}`);
    }
  }
}

program.parse(process.argv);
