#!/usr/bin/env node

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { KitchenLayout, ReportConfig } from '../types';
import { runSimulation } from '../simulation/engine';
import { compareLayouts } from '../simulation/comparison';
import { generateReport, generateComparisonReport } from '../reporting/generator';
import { generateHeatmapSVG } from '../visualization/heatmap';

const program = new Command();

program
  .name('fume-sim')
  .description('厨房油烟扩散模拟系统')
  .version('1.0.0');

program
  .command('run')
  .description('运行油烟扩散模拟')
  .argument('<inputFile>', '输入JSON文件路径')
  .option('-o, --output <directory>', '输出目录', './output')
  .option('-f, --format <format>', '报告格式: html|markdown|json', 'html')
  .option('--no-heatmap', '不生成热力图')
  .action(async (inputFile: string, options: any) => {
    console.log('🚀 开始运行油烟扩散模拟...');
    
    try {
      const layout = loadLayout(inputFile);
      console.log(`📋 方案名称: ${layout.name}`);
      console.log(`📐 厨房尺寸: ${layout.dimensions.width} × ${layout.dimensions.height} ${layout.dimensions.unit}`);
      console.log(`🍳 灶位数量: ${layout.stoves.filter(s => s.enabled).length}`);
      console.log(`💨 排烟口数量: ${layout.exhaustVents.filter(e => e.enabled).length}`);
      
      const result = runSimulation(layout);
      console.log(`✅ 模拟完成! 耗时: ${result.simulationTime}ms`);
      console.log(`📊 最大浓度: ${result.overallStats.maxConcentration.toFixed(3)} mg/m³`);
      console.log(`📊 平均浓度: ${result.overallStats.avgConcentration.toFixed(3)} mg/m³`);
      console.log(`📊 排风效率: ${(result.overallStats.exhaustEfficiency * 100).toFixed(1)}%`);
      
      if (result.anomalies.length > 0) {
        console.log(`\n⚠️  检测到 ${result.anomalies.length} 个异常:`);
        result.anomalies.slice(0, 5).forEach(a => {
          console.log(`   [${a.severity.toUpperCase()}] [${a.category}] ${a.message}`);
        });
        if (result.anomalies.length > 5) {
          console.log(`   ... 还有 ${result.anomalies.length - 5} 个异常`);
        }
      }
      
      const outputDir = ensureOutputDir(options.output);
      
      const reportConfig: ReportConfig = {
        format: options.format as any,
        includeHeatmap: options.heatmap !== false,
        includeStats: true,
        includeAnomalies: true,
        includeDetectionPoints: true,
      };
      
      const report = generateReport(result, layout, reportConfig);
      const reportExt = options.format === 'html' ? 'html' : options.format === 'markdown' ? 'md' : 'json';
      const reportPath = path.join(outputDir, `${layout.id}-report.${reportExt}`);
      fs.writeFileSync(reportPath, report, 'utf8');
      console.log(`\n📄 报告已生成: ${reportPath}`);
      
      if (options.heatmap !== false) {
        const heatmapSVG = generateHeatmapSVG(result, layout);
        const heatmapPath = path.join(outputDir, `${layout.id}-heatmap.svg`);
        fs.writeFileSync(heatmapPath, heatmapSVG, 'utf8');
        console.log(`🖼️  热力图已生成: ${heatmapPath}`);
      }
      
      const resultPath = path.join(outputDir, `${layout.id}-result.json`);
      fs.writeFileSync(resultPath, JSON.stringify(result, null, 2), 'utf8');
      console.log(`💾 模拟数据已保存: ${resultPath}`);
      
    } catch (error) {
      console.error('❌ 模拟失败:', error);
      process.exit(1);
    }
  });

program
  .command('compare')
  .description('对比两个方案')
  .argument('<file1>', '第一个方案文件')
  .argument('<file2>', '第二个方案文件')
  .option('-o, --output <directory>', '输出目录', './output')
  .action(async (file1: string, file2: string, options: any) => {
    console.log('🔄 开始方案对比...');
    
    try {
      const layout1 = loadLayout(file1);
      const layout2 = loadLayout(file2);
      
      console.log(`方案1: ${layout1.name} (v${layout1.version.version})`);
      console.log(`方案2: ${layout2.name} (v${layout2.version.version})`);
      
      const comparison = compareLayouts(layout1, layout2);
      
      console.log(`\n📊 参数差异: ${comparison.differences.length} 项`);
      comparison.differences.slice(0, 5).forEach(d => {
        console.log(`   ${d.field}: ${JSON.stringify(d.value1)} → ${JSON.stringify(d.value2)}`);
      });
      
      console.log(`\n📈 性能对比:`);
      comparison.statDifferences.forEach(s => {
        const arrow = s.change > 0 ? '↑' : s.change < 0 ? '↓' : '→';
        const sign = s.changePercent > 0 ? '+' : '';
        console.log(`   ${s.metric}: ${s.value1.toFixed(2)} → ${s.value2.toFixed(2)} (${arrow}${sign}${s.changePercent.toFixed(1)}%)`);
      });
      
      const outputDir = ensureOutputDir(options.output);
      const report = generateComparisonReport(comparison);
      const reportPath = path.join(outputDir, `comparison-${layout1.id}-vs-${layout2.id}.md`);
      fs.writeFileSync(reportPath, report, 'utf8');
      console.log(`\n📄 对比报告已生成: ${reportPath}`);
      
    } catch (error) {
      console.error('❌ 对比失败:', error);
      process.exit(1);
    }
  });

program
  .command('validate')
  .description('验证方案数据')
  .argument('<inputFile>', '输入JSON文件路径')
  .action(async (inputFile: string) => {
    console.log('🔍 开始验证方案...');
    
    try {
      const layout = loadLayout(inputFile);
      const result = runSimulation(layout);
      
      console.log(`✅ 方案加载成功`);
      console.log(`📋 名称: ${layout.name}`);
      console.log(`📐 网格: ${result.gridSize.width} × ${result.gridSize.height}`);
      
      if (result.anomalies.length === 0) {
        console.log('\n🎉 未检测到异常，方案合规!');
      } else {
        console.log(`\n⚠️  检测到 ${result.anomalies.length} 个异常:`);
        result.anomalies.forEach(a => {
          const icon = a.severity === 'error' ? '❌' : a.severity === 'warning' ? '⚠️' : 'ℹ️';
          console.log(`\n${icon} [${a.category.toUpperCase()}] ${a.message}`);
          console.log(`   💡 建议: ${a.suggestion}`);
          if (a.field) console.log(`   📍 字段: ${a.field}`);
        });
      }
      
    } catch (error) {
      console.error('❌ 验证失败:', error);
      process.exit(1);
    }
  });

program
  .command('report')
  .description('仅生成报告')
  .argument('<inputFile>', '输入JSON文件路径')
  .option('-o, --output <directory>', '输出目录', './output')
  .option('-f, --format <format>', '报告格式: html|markdown|json', 'html')
  .action(async (inputFile: string, options: any) => {
    console.log('📄 生成报告...');
    
    try {
      const layout = loadLayout(inputFile);
      const result = runSimulation(layout);
      
      const outputDir = ensureOutputDir(options.output);
      const reportConfig: ReportConfig = {
        format: options.format as any,
        includeHeatmap: true,
        includeStats: true,
        includeAnomalies: true,
        includeDetectionPoints: true,
      };
      
      const report = generateReport(result, layout, reportConfig);
      const reportExt = options.format === 'html' ? 'html' : options.format === 'markdown' ? 'md' : 'json';
      const reportPath = path.join(outputDir, `${layout.id}-report.${reportExt}`);
      fs.writeFileSync(reportPath, report, 'utf8');
      
      console.log(`✅ 报告已生成: ${reportPath}`);
    } catch (error) {
      console.error('❌ 生成报告失败:', error);
      process.exit(1);
    }
  });

program
  .command('example')
  .description('生成示例配置文件')
  .option('-o, --output <file>', '输出文件路径', './examples/basic-kitchen.json')
  .action(async (options: any) => {
    console.log('📝 生成示例配置...');
    
    const example = generateExampleLayout();
    const outputPath = options.output;
    
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(outputPath, JSON.stringify(example, null, 2), 'utf8');
    console.log(`✅ 示例配置已生成: ${outputPath}`);
    console.log(`\n💡 使用方法:`);
    console.log(`   fume-sim run ${outputPath}`);
    console.log(`   fume-sim validate ${outputPath}`);
    console.log(`   fume-sim report ${outputPath}`);
  });

function loadLayout(filePath: string): KitchenLayout {
  if (!fs.existsSync(filePath)) {
    throw new Error(`文件不存在: ${filePath}`);
  }
  
  const content = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(content);
}

function ensureOutputDir(dir: string): string {
  const outputDir = path.resolve(dir);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  return outputDir;
}

function generateExampleLayout(): KitchenLayout {
  return {
    id: 'kitchen-001',
    name: '示例厨房 - 基础排风方案',
    description: '典型中餐厅厨房布局，包含2个炒锅、1个炸炉和1个蒸箱',
    dimensions: { width: 8, height: 6, unit: 'm' },
    gridResolution: 0.2,
    stoves: [
      {
        id: 'stove-1',
        name: '炒锅1号',
        type: 'wok',
        position: { x: 1, y: 1, unit: 'm' },
        dimensions: { width: 1.2, height: 1, unit: 'm' },
        fumeEmissionRate: 800,
        heatOutput: 25000,
        enabled: true,
      },
      {
        id: 'stove-2',
        name: '炒锅2号',
        type: 'wok',
        position: { x: 2.5, y: 1, unit: 'm' },
        dimensions: { width: 1.2, height: 1, unit: 'm' },
        fumeEmissionRate: 800,
        heatOutput: 25000,
        enabled: true,
      },
      {
        id: 'stove-3',
        name: '炸炉',
        type: 'fryer',
        position: { x: 4, y: 1, unit: 'm' },
        dimensions: { width: 0.8, height: 0.8, unit: 'm' },
        fumeEmissionRate: 500,
        heatOutput: 15000,
        enabled: true,
      },
      {
        id: 'stove-4',
        name: '蒸箱',
        type: 'steamer',
        position: { x: 5.5, y: 1, unit: 'm' },
        dimensions: { width: 1, height: 1, unit: 'm' },
        fumeEmissionRate: 300,
        heatOutput: 10000,
        enabled: true,
      },
    ],
    exhaustVents: [
      {
        id: 'exhaust-1',
        name: '主排烟罩',
        type: 'hood',
        position: { x: 0.5, y: 0.5, unit: 'm' },
        dimensions: { width: 6.5, height: 1.5, unit: 'm' },
        airflowRate: 12000,
        captureEfficiency: 0.85,
        enabled: true,
      },
    ],
    detectionPoints: [
      { id: 'dp-1', name: '厨师呼吸区1', position: { x: 1.6, y: 2.2, unit: 'm' }, threshold: 2.0 },
      { id: 'dp-2', name: '厨师呼吸区2', position: { x: 3.1, y: 2.2, unit: 'm' }, threshold: 2.0 },
      { id: 'dp-3', name: '厨房入口', position: { x: 7, y: 3, unit: 'm' }, threshold: 1.0 },
      { id: 'dp-4', name: '备餐区', position: { x: 3, y: 4.5, unit: 'm' }, threshold: 0.5 },
    ],
    obstacles: [
      {
        id: 'wall-1',
        name: '隔墙',
        position: { x: 0, y: 3.5, unit: 'm' },
        dimensions: { width: 8, height: 0.2, unit: 'm' },
        permeability: 0.1,
      },
    ],
    version: {
      version: '1.0.0',
      createdAt: new Date().toISOString(),
      createdBy: 'system',
      modifiedAt: new Date().toISOString(),
      modifiedBy: 'system',
      status: 'draft',
      comments: ['初始方案', '示例配置'],
    },
    metadata: {
      restaurant: '示例餐厅',
      chef: '张师傅',
    },
  };
}

program.parseAsync(process.argv).catch(console.error);
