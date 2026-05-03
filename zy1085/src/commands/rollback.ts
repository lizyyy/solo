import { DataParser } from '../core/data-parser';
import { PlanAnalyzer } from '../core/plan-analyzer';
import { OutputUtils } from '../utils/output-utils';
import { RollbackReadiness } from '../types';

/**
 * 回滚命令
 * 生成回滚核对清单
 */
export async function rollbackCommand(dataDirectory: string): Promise<RollbackReadiness> {
  OutputUtils.title('生成回滚核对清单');
  
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
    
    // 执行分析获取回滚准备状态
    OutputUtils.info('正在分析回滚准备状态...');
    const analyzer = new PlanAnalyzer();
    const releasePlan = analyzer.analyze(commits, issues, deployPlan, migrations);
    
    // 输出回滚核对清单
    OutputUtils.printRollbackChecklist(releasePlan.analysis.rollbackReadiness);
    
    return releasePlan.analysis.rollbackReadiness;
    
  } catch (error) {
    OutputUtils.error(`生成回滚清单失败: ${(error as Error).message}`);
    throw error;
  }
}
