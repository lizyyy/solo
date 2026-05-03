import * as path from 'path';
import * as fs from 'fs-extra';
import { ScanResult, RoutesConfig, ConfigurationError } from '../types';
import { validateConfigFile, loadConfig } from '../config/validation';
import { runScan, ScanOptions } from '../scanner';
import { getTimestampFilename, formatDate } from '../utils';

export interface ScanCommandOptions {
  config?: string;
  output?: string;
  headless?: boolean;
  slowMo?: number;
  timeout?: number;
  viewport?: string;
  groups?: string;
  routes?: string;
  checkers?: string;
}

export async function runScanCommand(options: ScanCommandOptions): Promise<void> {
  const startTime = Date.now();
  
  console.log('🎯 键盘可访问性巡检工具');
  console.log('═══════════════════════════════════════════');
  console.log(`开始时间: ${formatDate(new Date())}`);
  console.log('');

  const configPath = options.config || path.join(process.cwd(), 'routes.json');
  const outputDir = options.output || path.join(process.cwd(), '.kas');

  console.log(`📁 配置文件: ${configPath}`);
  console.log(`📂 输出目录: ${outputDir}`);
  console.log('');

  console.log('🔍 验证配置文件...');
  
  const validationResult = await validateConfigFile(configPath);
  
  if (!validationResult.valid) {
    console.log('');
    console.log('❌ 配置验证失败！');
    console.log('');
    
    for (const error of validationResult.errors) {
      console.error(`   ⚠️ ${error.message}`);
      if (error.details) {
        console.error(`      详情: ${error.details}`);
      }
      if (error.field) {
        console.error(`      字段: ${error.field}`);
      }
      if (error.routeId) {
        console.error(`      路由: ${error.routeId}`);
      }
    }
    
    console.log('');
    console.log('💡 提示: 使用 "kas init" 命令生成示例配置文件');
    process.exit(1);
  }

  console.log('   ✅ 配置验证通过');
  console.log('');

  const config = validationResult.config!;
  console.log(`📋 加载配置: ${config.name || '未命名'}`);
  console.log(`   描述: ${config.description || '无描述'}`);
  console.log(`   页面数量: ${config.routes.length}`);
  console.log('');

  let scanOptions: ScanOptions = {
    configPath,
    outputDir,
    headless: options.headless !== false,
  };

  if (options.slowMo !== undefined) {
    scanOptions.slowMo = options.slowMo;
  }

  if (options.timeout !== undefined) {
    scanOptions.timeout = options.timeout;
  }

  if (options.viewport) {
    const [width, height] = options.viewport.split('x').map(Number);
    if (width && height) {
      scanOptions.viewport = { width, height };
    } else {
      console.log('   ⚠️ 无效的 viewport 格式，使用默认值 (1280x720)');
    }
  }

  if (options.groups) {
    scanOptions.groups = options.groups.split(',').map(g => g.trim());
  }

  if (options.routes) {
    scanOptions.routeIds = options.routes.split(',').map(r => r.trim());
  }

  if (options.checkers) {
    scanOptions.checkers = options.checkers.split(',').map(c => c.trim());
  }

  console.log('⚙️  扫描选项:');
  console.log(`   无头模式: ${scanOptions.headless ? '是' : '否'}`);
  if (scanOptions.slowMo) console.log(`   慢动作: ${scanOptions.slowMo}ms`);
  if (scanOptions.timeout) console.log(`   超时: ${scanOptions.timeout}ms`);
  if (scanOptions.viewport) console.log(`   视口: ${scanOptions.viewport.width}x${scanOptions.viewport.height}`);
  if (scanOptions.groups) console.log(`   分组: ${scanOptions.groups.join(', ')}`);
  if (scanOptions.routeIds) console.log(`   路由: ${scanOptions.routeIds.join(', ')}`);
  if (scanOptions.checkers) console.log(`   检查器: ${scanOptions.checkers.join(', ')}`);
  console.log('');

  console.log('🚀 开始扫描...');
  console.log('');

  let result: ScanResult;
  
  try {
    result = await runScan(config, scanOptions);
  } catch (error) {
    console.log('');
    console.log('❌ 扫描过程中发生错误:');
    console.error(`   ${error instanceof Error ? error.message : String(error)}`);
    
    if (error instanceof Error && error.stack) {
      console.error('');
      console.error('   堆栈跟踪:');
      console.error(`   ${error.stack.split('\n').join('\n   ')}`);
    }
    
    process.exit(1);
  }

  console.log('');
  console.log('═══════════════════════════════════════════');
  console.log('📊 扫描完成！');
  console.log('');
  
  console.log('📈 结果概览:');
  console.log(`   总页面数: ${result.summary.totalPages}`);
  console.log(`   成功扫描: ${result.summary.scannedPages}`);
  console.log(`   扫描失败: ${result.summary.failedPages}`);
  console.log(`   问题总数: ${result.summary.totalIssues}`);
  console.log('');
  
  console.log('   问题按严重程度分布:');
  console.log(`      🔴 严重: ${result.summary.issuesBySeverity.critical}`);
  console.log(`      🟠 高:   ${result.summary.issuesBySeverity.high}`);
  console.log(`      🟡 中:   ${result.summary.issuesBySeverity.medium}`);
  console.log(`      🟢 低:   ${result.summary.issuesBySeverity.low}`);
  console.log('');

  if (Object.keys(result.summary.issuesByType).length > 0) {
    console.log('   问题按类型分布:');
    for (const [type, count] of Object.entries(result.summary.issuesByType)) {
      console.log(`      ${type}: ${count}`);
    }
    console.log('');
  }

  console.log(`   扫描耗时: ${(result.summary.duration / 1000).toFixed(2)} 秒`);
  console.log('');

  if (result.errors.length > 0) {
    console.log('⚠️ 配置/扫描错误:');
    for (const error of result.errors) {
      console.log(`   - ${error.message}`);
    }
    console.log('');
  }

  console.log('💾 保存扫描结果...');
  
  try {
    const resultsDir = path.join(outputDir, 'results');
    await fs.ensureDir(resultsDir);

    const filename = `scan-${getTimestampFilename()}-${result.id.slice(0, 8)}.json`;
    const filepath = path.join(resultsDir, filename);

    await fs.writeJson(filepath, result, { spaces: 2 });
    console.log(`   ✅ 保存到: ${filepath}`);

    const latestPath = path.join(resultsDir, 'latest.json');
    await fs.writeJson(latestPath, result, { spaces: 2 });
    console.log(`   ✅ 保存到: ${latestPath}`);
  } catch (error) {
    console.error('   ❌ 保存失败:');
    console.error(`      ${error instanceof Error ? error.message : String(error)}`);
  }

  const totalTime = Date.now() - startTime;
  console.log('');
  console.log('═══════════════════════════════════════════');
  console.log('✅ 巡检完成！');
  console.log(`   总耗时: ${(totalTime / 1000).toFixed(2)} 秒`);
  console.log('');
  console.log('💡 下一步:');
  console.log('   查看报告: kas report');
  console.log('   导出报告: kas report --format html');
  console.log('');

  if (result.summary.totalIssues > 0) {
    process.exitCode = 1;
  }
}
