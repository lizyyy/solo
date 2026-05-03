import * as path from 'path';
import * as fs from 'fs-extra';
import { ScanResult, ReporterOptions } from '../types';
import { Reporter, generateReport, getLatestScanResult } from '../reporter';
import { formatDate } from '../utils';

export interface ReportCommandOptions {
  input?: string;
  output?: string;
  format?: 'json' | 'markdown' | 'html';
  dataDir?: string;
}

export async function runReportCommand(options: ReportCommandOptions): Promise<void> {
  console.log('📄 报告生成器');
  console.log('═══════════════════════════════════════════');
  console.log(`开始时间: ${formatDate(new Date())}`);
  console.log('');

  const dataDir = options.dataDir || path.join(process.cwd(), '.kas');
  const format = options.format || 'markdown';

  console.log(`📂 数据目录: ${dataDir}`);
  console.log(`📋 输出格式: ${format}`);
  console.log('');

  let scanResult: ScanResult | null = null;

  if (options.input) {
    console.log(`📁 从指定文件加载结果: ${options.input}`);
    
    try {
      const inputPath = path.resolve(options.input);
      if (!(await fs.pathExists(inputPath))) {
        console.error('❌ 指定的输入文件不存在');
        process.exit(1);
      }
      
      const content = await fs.readFile(inputPath, 'utf-8');
      scanResult = JSON.parse(content) as ScanResult;
      
      console.log('   ✅ 加载成功');
    } catch (error) {
      console.error('❌ 加载失败:');
      console.error(`   ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  } else {
    console.log('🔍 查找最新的扫描结果...');
    
    scanResult = await getLatestScanResult(dataDir);
    
    if (!scanResult) {
      console.error('❌ 未找到扫描结果');
      console.log('');
      console.log('💡 提示:');
      console.log('   1. 使用 "kas scan" 执行一次扫描');
      console.log('   2. 或使用 --input 参数指定结果文件');
      process.exit(1);
    }
    
    console.log(`   ✅ 找到扫描结果: ${scanResult.id.slice(0, 8)}...`);
    console.log(`   📅 扫描时间: ${formatDate(new Date(scanResult.timestamp))}`);
  }

  if (!scanResult) {
    console.error('❌ 无法获取扫描结果');
    process.exit(1);
  }

  console.log('');
  console.log('📊 扫描结果概览:');
  console.log(`   总页面数: ${scanResult.summary.totalPages}`);
  console.log(`   问题总数: ${scanResult.summary.totalIssues}`);
  console.log(`   扫描耗时: ${(scanResult.summary.duration / 1000).toFixed(2)} 秒`);
  console.log('');

  const reporterOptions: ReporterOptions = {
    format,
    outputPath: options.output,
  };

  console.log(`📝 生成 ${format.toUpperCase()} 格式报告...`);
  
  try {
    const outputPath = await generateReport(scanResult, reporterOptions);
    
    console.log('');
    console.log('═══════════════════════════════════════════');
    console.log('✅ 报告生成成功！');
    console.log(`   📄 输出文件: ${outputPath}`);
    console.log('');
    
    console.log('📈 报告内容:');
    console.log(`   - 扫描概览（页面数、问题数、耗时）`);
    console.log(`   - 问题按严重程度分布`);
    console.log(`   - 问题按类型分布`);
    console.log(`   - 各页面详情（焦点路径、问题列表）`);
    console.log(`   - 元素选择器和 DOM 片段`);
    console.log(`   - 修复建议`);
    console.log('');
    
    console.log('💡 后续操作:');
    if (format === 'html') {
      console.log(`   在浏览器中打开: ${outputPath}`);
    } else if (format === 'markdown') {
      console.log(`   使用 Markdown 编辑器查看: ${outputPath}`);
    } else {
      console.log(`   使用 JSON 查看器查看: ${outputPath}`);
    }
    console.log('');

  } catch (error) {
    console.error('❌ 报告生成失败:');
    console.error(`   ${error instanceof Error ? error.message : String(error)}`);
    
    if (error instanceof Error && error.stack) {
      console.error('');
      console.error('   堆栈跟踪:');
      console.error(`   ${error.stack.split('\n').join('\n   ')}`);
    }
    
    process.exit(1);
  }
}
