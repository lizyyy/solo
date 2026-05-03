import * as path from 'path';
import { DataParser } from '../core/data-parser';
import { PlanAnalyzer } from '../core/plan-analyzer';
import { Exporter } from '../core/exporter';
import { OutputUtils } from '../utils/output-utils';

/**
 * 导出命令
 * 导出 Markdown/HTML/JSON 格式
 */
export async function exportCommand(
  dataDirectory: string,
  outputDirectory: string,
  formats: ('json' | 'markdown' | 'html')[] = ['json', 'markdown', 'html']
): Promise<string[]> {
  OutputUtils.title('导出发版计划');
  
  try {
    // 解析数据
    const parser = new DataParser(dataDirectory);
    
    OutputUtils.info('正在解析数据文件...');
    const commits = await parser.parseCommits();
    const issues = await parser.parseIssues();
    const deployPlan = parser.parseDeployPlan();
    const migrations = parser.parseMigrations();
    
    OutputUtils.success('数据解析完成');
    OutputUtils.info('');
    
    // 执行分析
    OutputUtils.info('正在分析版本变更...');
    const analyzer = new PlanAnalyzer();
    const releasePlan = analyzer.analyze(commits, issues, deployPlan, migrations);
    
    OutputUtils.success('分析完成');
    OutputUtils.info('');
    
    // 导出
    OutputUtils.info(`正在导出到: ${outputDirectory}`);
    OutputUtils.info(`导出格式: ${formats.join(', ')}`);
    OutputUtils.info('');
    
    const exporter = new Exporter(outputDirectory);
    
    // 导出发布计划
    const exportedFiles: string[] = [];
    
    const planFiles = exporter.exportReleasePlan(releasePlan, formats);
    exportedFiles.push(...planFiles);
    
    // 导出回滚核对清单
    const rollbackFiles = exporter.exportRollbackChecklist(
      releasePlan.analysis.rollbackReadiness,
      releasePlan.version,
      formats
    );
    exportedFiles.push(...rollbackFiles);
    
    // 输出结果
    OutputUtils.success('导出完成！');
    OutputUtils.info('');
    OutputUtils.info('导出的文件:');
    exportedFiles.forEach(file => {
      OutputUtils.success(`  ✓ ${file}`);
    });
    
    return exportedFiles;
    
  } catch (error) {
    OutputUtils.error(`导出失败: ${(error as Error).message}`);
    throw error;
  }
}
