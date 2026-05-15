#!/usr/bin/env node

import { Command } from 'commander';
import { DuplicateDetector } from './detector';
import { CorrectionManager } from './correctionManager';
import { OutputFormatter } from './outputFormatter';
import { LiveSample, OutputConfig, FilterType } from './types';
import * as fs from 'fs';
import * as path from 'path';

const program = new Command();

program
  .name('dupdetect')
  .description('重复文件定位命令行工具')
  .version('1.0.0');

program
  .command('detect')
  .description('对直播样品表进行重复检测')
  .option('-i, --input <file>', '输入JSON文件路径', './data/live_samples.json')
  .option('-f, --format <format>', '输出格式: json|markdown|both', 'both')
  .option('--no-system-judgment', '不包含系统判断信息')
  .option('--no-corrections', '不包含人工修正记录')
  .option('-o, --operator <name>', '操作人名称', 'system')
  .action(async (options) => {
    try {
      const samples: LiveSample[] = JSON.parse(
        fs.readFileSync(options.input, 'utf-8')
      );

      const detector = new DuplicateDetector();
      const groups = detector.detect(samples);

      console.log(`检测完成: 发现 ${groups.length} 个重复组`);

      const correctionManager = new CorrectionManager();
      const allBatches = [...new Set(samples.map(s => s.batchId))];
      const corrections = allBatches.flatMap(batchId => 
        correctionManager.getCorrectionsByBatch(batchId)
      );

      const formatter = new OutputFormatter();
      
      const config: OutputConfig = {
        format: options.format,
        includeSystemJudgment: options.systemJudgment,
        includeCorrections: options.corrections
      };

      const timestamp = Date.now();

      if (options.format === 'json' || options.format === 'both') {
        const jsonData = formatter.formatToJSON(groups, corrections, config);
        const jsonPath = formatter.saveJSON(jsonData, `detection_report_${timestamp}.json`);
        console.log(`JSON报告已保存: ${jsonPath}`);
      }

      if (options.format === 'markdown' || options.format === 'both') {
        const mdContent = formatter.formatToMarkdown(groups, corrections, config);
        const mdPath = formatter.saveMarkdown(mdContent, `detection_report_${timestamp}.md`);
        console.log(`Markdown报告已保存: ${mdPath}`);
      }

      correctionManager.addHistory({
        batchId: allBatches.join(','),
        operator: options.operator,
        riskType: groups.length > 0 ? 'has_duplicates' : 'clean',
        duplicateGroups: groups,
        corrections: corrections
      });

      formatter.exportAnomalies(groups);

    } catch (error: any) {
      console.error('检测失败:', error.message);
      process.exit(1);
    }
  });

program
  .command('correct')
  .description('添加人工修正记录')
  .requiredOption('-b, --batch <batchId>', '批次ID')
  .requiredOption('-g, --group <groupId>', '重复组ID')
  .requiredOption('-i, --item <itemId>', '样品ID')
  .requiredOption('-o, --operator <name>', '操作人')
  .requiredOption('-r, --remark <text>', '修正备注')
  .requiredOption('-a, --action <action>', '处理方式: keep|merge|mark_non_duplicate|dismiss')
  .requiredOption('-s, --source <source>', '来源')
  .requiredOption('--basis <text>', '处理依据')
  .action((options) => {
    try {
      const correctionManager = new CorrectionManager();
      
      const correction = correctionManager.addCorrection({
        batchId: options.batch,
        groupId: options.group,
        itemId: options.item,
        operator: options.operator,
        remark: options.remark,
        action: options.action,
        source: options.source,
        basis: options.basis
      });

      console.log('人工修正已添加:', correction.correctionId);
    } catch (error: any) {
      console.error('添加修正失败:', error.message);
      process.exit(1);
    }
  });

program
  .command('history')
  .description('查询检测历史')
  .option('-b, --batch <batchId>', '按批次ID过滤')
  .option('-o, --operator <name>', '按操作人过滤')
  .option('-r, --risk <type>', '按风险类型过滤')
  .action((options) => {
    try {
      const correctionManager = new CorrectionManager();
      let histories;

      if (options.batch) {
        histories = correctionManager.filterHistories('batch', options.batch);
      } else if (options.operator) {
        histories = correctionManager.filterHistories('operator', options.operator);
      } else if (options.risk) {
        histories = correctionManager.filterHistories('riskType', options.risk);
      } else {
        histories = correctionManager.getAllHistories();
      }

      console.log(`查询结果: 共 ${histories.length} 条记录`);
      console.log(JSON.stringify(histories, null, 2));
    } catch (error: any) {
      console.error('查询失败:', error.message);
      process.exit(1);
    }
  });

program
  .command('list-corrections')
  .description('列出所有人工修正记录')
  .option('-b, --batch <batchId>', '按批次ID过滤')
  .action((options) => {
    try {
      const correctionManager = new CorrectionManager();
      const corrections = options.batch 
        ? correctionManager.getCorrectionsByBatch(options.batch)
        : correctionManager.getAllCorrections();

      console.log(`人工修正记录: 共 ${corrections.length} 条`);
      console.log(JSON.stringify(corrections, null, 2));
    } catch (error: any) {
      console.error('查询失败:', error.message);
      process.exit(1);
    }
  });

program
  .command('export-anomalies')
  .description('导出异常样本')
  .option('-i, --input <file>', '输入JSON文件路径', './data/live_samples.json')
  .action((options) => {
    try {
      const samples: LiveSample[] = JSON.parse(fs.readFileSync(options.input, 'utf-8'));
      const detector = new DuplicateDetector();
      const groups = detector.detect(samples);
      const formatter = new OutputFormatter();
      formatter.exportAnomalies(groups);
    } catch (error: any) {
      console.error('导出失败:', error.message);
      process.exit(1);
    }
  });

program
  .command('init-demo')
  .description('初始化演示数据（添加一条人工修正记录')
  .action(() => {
    try {
      const correctionManager = new CorrectionManager();
      
      correctionManager.addCorrection({
        batchId: 'BATCH20260502',
        groupId: 'GRP-DEMO001',
        itemId: 'SMP006',
        operator: '张经理',
        remark: '经核查，该记录为系统导入时字段被截断，实际完整商品名称应为"运动跑鞋男款透气减震防滑"，与SMP007为同款商品不同场次重复录入',
        action: 'merge',
        source: '直播样品表人工复核',
        basis: '根据历史直播记录核对，SMP006与SMP007商品ID、SKU、价格、库存等字段完全一致，仅商品名称因导入时截断'
      });

      console.log('演示数据初始化完成');
      console.log('已添加人工修正记录: 针对BATCH20260502批次中SMP006记录');
    } catch (error: any) {
      console.error('初始化失败:', error.message);
      process.exit(1);
    }
  });

program.parse(process.argv);
