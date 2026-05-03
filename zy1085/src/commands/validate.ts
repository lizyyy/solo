import { DataParser } from '../core/data-parser';
import { DataValidator } from '../core/data-validator';
import { OutputUtils } from '../utils/output-utils';
import { ValidationResult } from '../types';

/**
 * 校验命令
 * 校验输入数据的完整性、格式正确性
 */
export async function validateCommand(dataDirectory: string): Promise<ValidationResult> {
  OutputUtils.title('数据校验');
  
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
    
    // 执行校验
    OutputUtils.info('正在执行数据校验...');
    const validator = new DataValidator();
    const result = validator.validateAll(commits, issues, deployPlan, migrations);
    
    // 输出结果
    OutputUtils.printValidationResult(result);
    
    return result;
    
  } catch (error) {
    OutputUtils.error(`校验失败: ${(error as Error).message}`);
    throw error;
  }
}
