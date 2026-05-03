import { DataParser } from '../core/data-parser';
import { DataValidator } from '../core/data-validator';
import { PlanAnalyzer } from '../core/plan-analyzer';
import { OutputUtils } from '../utils/output-utils';
import { ReleasePlan, ValidationResult } from '../types';

/**
 * 计划命令
 * 汇总版本变更、风险和影响面
 */
export async function planCommand(
  dataDirectory: string,
  options: { skipValidation?: boolean } = {}
): Promise<ReleasePlan> {
  OutputUtils.title('生成发版计划');
  
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
    
    // 执行校验（除非跳过）
    if (!options.skipValidation) {
      OutputUtils.info('正在执行数据校验...');
      const validator = new DataValidator();
      const validationResult = validator.validateAll(commits, issues, deployPlan, migrations);
      
      if (!validationResult.valid) {
        OutputUtils.warning('数据校验发现问题，但仍继续生成计划...');
        OutputUtils.info('');
      } else {
        OutputUtils.success('数据校验通过');
        OutputUtils.info('');
      }
    }
    
    // 执行分析
    OutputUtils.info('正在分析版本变更...');
    const analyzer = new PlanAnalyzer();
    const releasePlan = analyzer.analyze(commits, issues, deployPlan, migrations);
    
    // 输出结果
    OutputUtils.printReleasePlan(releasePlan);
    
    return releasePlan;
    
  } catch (error) {
    OutputUtils.error(`生成计划失败: ${(error as Error).message}`);
    throw error;
  }
}
