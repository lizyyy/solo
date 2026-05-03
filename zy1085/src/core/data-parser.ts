import * as path from 'path';
import {
  Commit,
  Issue,
  DeployPlan,
  Migration,
  ConfigChange
} from '../types';
import {
  fileExists,
  directoryExists,
  readFile,
  readJsonFile,
  listFiles,
  parseCsv,
  parseMarkdown
} from '../utils/file-utils';

/**
 * 数据解析器
 * 负责解析各种输入数据格式
 */
export class DataParser {
  private dataDirectory: string;

  constructor(dataDirectory: string) {
    this.dataDirectory = dataDirectory;
  }

  /**
   * 解析commits.csv文件
   */
  async parseCommits(): Promise<Commit[]> {
    const filePath = path.join(this.dataDirectory, 'commits.csv');
    
    if (!fileExists(filePath)) {
      throw new Error(`commits.csv文件不存在: ${filePath}`);
    }

    const content = readFile(filePath);
    const records = await parseCsv(content);

    return records.map((record: any, index: number) => {
      // 解析关联的issues（支持逗号分隔或#数字格式）
      const relatedIssues = this.parseRelatedIssues(record.related_issues || record.message || '');
      
      // 检测是否是破坏性变更
      const isBreaking = this.detectBreakingChange(record.message || '', record.is_breaking);
      const breakingDescription = isBreaking 
        ? (record.breaking_description || this.extractBreakingDescription(record.message || ''))
        : undefined;

      return {
        id: record.id || `commit-${index + 1}`,
        hash: record.hash || record.commit_hash || '',
        message: record.message || '',
        author: record.author || record.author_name || '',
        date: record.date || record.commit_date || new Date().toISOString(),
        module: record.module || this.inferModule(record.message || ''),
        relatedIssues,
        isBreaking,
        breakingDescription
      };
    });
  }

  /**
   * 解析issues.csv文件
   */
  async parseIssues(): Promise<Issue[]> {
    const filePath = path.join(this.dataDirectory, 'issues.csv');
    
    if (!fileExists(filePath)) {
      throw new Error(`issues.csv文件不存在: ${filePath}`);
    }

    const content = readFile(filePath);
    const records = await parseCsv(content);

    return records.map((record: any, index: number) => {
      // 解析受影响的客户
      const affectedCustomers = this.parseList(record.affected_customers || '');
      
      // 解析关联的commits
      const relatedCommits = this.parseList(record.related_commits || '');
      
      // 解析标签
      const labels = this.parseList(record.labels || '');
      
      // 检查是否有回滚计划
      const hasRollbackPlan = this.parseBoolean(record.has_rollback_plan) || 
        !!(record.rollback_plan && record.rollback_plan.trim());

      return {
        id: record.id || `issue-${index + 1}`,
        title: record.title || '',
        description: record.description || '',
        status: record.status || 'open',
        author: record.author || record.reporter || '',
        assignee: record.assignee || '',
        module: record.module || this.inferModule(record.title || record.description || ''),
        priority: this.parsePriority(record.priority),
        affectedCustomers,
        relatedCommits,
        hasRollbackPlan,
        rollbackPlan: record.rollback_plan,
        labels
      };
    });
  }

  /**
   * 解析deploy-plan.json文件
   */
  parseDeployPlan(): DeployPlan {
    const filePath = path.join(this.dataDirectory, 'deploy-plan.json');
    
    if (!fileExists(filePath)) {
      throw new Error(`deploy-plan.json文件不存在: ${filePath}`);
    }

    const data = readJsonFile<any>(filePath);

    return {
      version: data.version || '0.0.0',
      date: data.date || new Date().toISOString().split('T')[0],
      environment: data.environment || 'production',
      description: data.description || '',
      moduleOwners: data.module_owners || data.moduleOwners || {},
      configChanges: (data.config_changes || data.configChanges || []).map((change: any) => ({
        key: change.key || '',
        oldValue: change.old_value || change.oldValue || '',
        newValue: change.new_value || change.newValue || '',
        environment: change.environment || 'production',
        description: change.description || '',
        isRequired: this.parseBoolean(change.is_required || change.isRequired),
        rollbackAction: change.rollback_action || change.rollbackAction || ''
      })),
      dependencies: data.dependencies || [],
      preDeploySteps: data.pre_deploy_steps || data.preDeploySteps || [],
      postDeploySteps: data.post_deploy_steps || data.postDeploySteps || [],
      rollbackStrategy: data.rollback_strategy || data.rollbackStrategy || ''
    };
  }

  /**
   * 解析migrations目录中的迁移文件
   */
  parseMigrations(): Migration[] {
    const migrationsDir = path.join(this.dataDirectory, 'migrations');
    
    if (!directoryExists(migrationsDir)) {
      return [];
    }

    // 查找迁移文件（支持.sql、.js、.ts、.py等格式）
    const migrationFiles = listFiles(migrationsDir, /\.(sql|js|ts|py)$/i);
    
    // 按文件名排序（确保执行顺序）
    migrationFiles.sort();

    const migrations: Migration[] = [];
    
    for (let i = 0; i < migrationFiles.length; i++) {
      const filePath = migrationFiles[i];
      const filename = path.basename(filePath);
      const content = readFile(filePath);
      
      // 解析迁移内容
      const parsed = this.parseMigrationContent(content, filename);
      
      migrations.push({
        id: parsed.id || `migration-${i + 1}`,
        filename,
        content,
        description: parsed.description || filename,
        module: parsed.module || this.inferModule(content),
        isBreaking: parsed.isBreaking,
        rollbackScript: parsed.rollbackScript,
        dependencies: parsed.dependencies
      });
    }

    return migrations;
  }

  /**
   * 解析关联的issues
   * 支持格式: "issue-1, issue-2" 或 "#123 #456" 或 "Fixes #123"
   */
  private parseRelatedIssues(text: string): string[] {
    const issues: string[] = [];
    
    // 尝试从文本中提取#数字格式的issue引用
    const hashPattern = /#(\d+)/g;
    let match;
    while ((match = hashPattern.exec(text)) !== null) {
      issues.push(`issue-${match[1]}`);
    }
    
    // 如果没有找到，尝试解析逗号分隔的列表
    if (issues.length === 0) {
      const items = text.split(/[,;]/).map(item => item.trim()).filter(item => item);
      issues.push(...items);
    }
    
    // 去重
    return [...new Set(issues)];
  }

  /**
   * 检测破坏性变更
   * 检查message中是否包含BREAKING CHANGE、breaking等关键词
   */
  private detectBreakingChange(message: string, explicitFlag?: string): boolean {
    // 优先使用显式标志
    if (explicitFlag !== undefined) {
      return this.parseBoolean(explicitFlag);
    }
    
    // 检查常见的破坏性变更关键词
    const breakingKeywords = [
      /BREAKING[-\s]CHANGE/i,
      /breaking[-\s]change/i,
      /⚠️\s*BREAKING/i,
      /重大变更/i,
      /破坏性变更/i,
      /不兼容变更/i
    ];
    
    return breakingKeywords.some(pattern => pattern.test(message));
  }

  /**
   * 提取破坏性变更描述
   */
  private extractBreakingDescription(message: string): string {
    // 尝试提取BREAKING CHANGE: 后面的内容
    const patterns = [
      /BREAKING[-\s]CHANGE:\s*(.+?)(?:\n\n|\n$|$)/is,
      /breaking[-\s]change:\s*(.+?)(?:\n\n|\n$|$)/is,
      /重大变更[：:]\s*(.+?)(?:\n\n|\n$|$)/is
    ];
    
    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    
    return message;
  }

  /**
   * 从内容推断模块
   */
  private inferModule(content: string): string {
    // 常见模块关键词映射
    const modulePatterns: Record<string, RegExp[]> = {
      'auth': [/auth(entication)?/i, /login/i, /user/i, /权限/i],
      'payment': [/payment/i, /pay/i, /order/i, /支付/i, /订单/i],
      'api': [/api/i, /endpoint/i, /接口/i],
      'database': [/database/i, /db/i, /sql/i, /数据库/i],
      'frontend': [/frontend/i, /ui/i, /react/i, /vue/i, /前端/i],
      'backend': [/backend/i, /server/i, /api/i, /后端/i],
      'notification': [/notification/i, /email/i, /sms/i, /通知/i, /邮件/i],
      'report': [/report/i, /analytics/i, /报表/i, /分析/i]
    };

    for (const [module, patterns] of Object.entries(modulePatterns)) {
      if (patterns.some(pattern => pattern.test(content))) {
        return module;
      }
    }

    return 'unknown';
  }

  /**
   * 解析列表字符串
   */
  private parseList(text: string): string[] {
    return text
      .split(/[,;|]/)
      .map(item => item.trim())
      .filter(item => item.length > 0);
  }

  /**
   * 解析布尔值
   */
  private parseBoolean(value: string | boolean | undefined): boolean {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      return ['true', 'yes', '1', '是', '对'].includes(value.toLowerCase().trim());
    }
    return false;
  }

  /**
   * 解析优先级
   */
  private parsePriority(value: string | undefined): 'high' | 'medium' | 'low' {
    if (!value) return 'medium';
    const lower = value.toLowerCase();
    if (['high', 'critical', 'p0', 'p1', '高', '紧急'].includes(lower)) {
      return 'high';
    }
    if (['low', 'p3', 'p4', '低', '普通'].includes(lower)) {
      return 'low';
    }
    return 'medium';
  }

  /**
   * 解析迁移文件内容
   */
  private parseMigrationContent(content: string, filename: string): {
    id: string;
    description: string;
    module: string;
    isBreaking: boolean;
    rollbackScript?: string;
    dependencies: string[];
  } {
    // 从文件名提取时间戳作为ID的一部分
    const idMatch = filename.match(/^(\d+)/);
    const id = idMatch ? `migration-${idMatch[1]}` : `migration-${filename}`;

    // 尝试从注释中提取描述
    const descriptionMatch = content.match(/--\s*Description:\s*(.+?)(?:\n|$)/i) ||
                             content.match(/\/\*\*\s*Description:\s*(.+?)(?:\n|\*\/)/is) ||
                             content.match(/#\s*Description:\s*(.+?)(?:\n|$)/i);
    const description = descriptionMatch ? descriptionMatch[1].trim() : filename;

    // 从注释提取模块
    const moduleMatch = content.match(/--\s*Module:\s*(.+?)(?:\n|$)/i) ||
                        content.match(/\/\*\*\s*Module:\s*(.+?)(?:\n|\*\/)/is) ||
                        content.match(/#\s*Module:\s*(.+?)(?:\n|$)/i);
    const module = moduleMatch ? moduleMatch[1].trim() : this.inferModule(content);

    // 检测是否是破坏性迁移
    const isBreaking = this.detectBreakingChange(content) ||
      /DROP\s+TABLE/i.test(content) ||
      /ALTER\s+TABLE.*DROP\s+COLUMN/i.test(content) ||
      /DELETE\s+FROM/i.test(content);

    // 尝试提取回滚脚本
    let rollbackScript: string | undefined;
    // 处理 SQL 注释格式: -- Rollback: 后面的所有注释行，直到空行或非注释行
    const sqlRollbackMatch = content.match(/--\s*Rollback:\s*\n((?:--[^\n]*\n)*)/i);
    if (sqlRollbackMatch) {
      // 提取所有以 -- 开头的行，并移除 -- 前缀
      const lines = sqlRollbackMatch[1]
        .split('\n')
        .filter(line => line.trim().length > 0)
        .map(line => line.replace(/^--\s*/, ''))
        .filter(line => line.trim().length > 0);
      if (lines.length > 0) {
        rollbackScript = lines.join('\n');
      }
    }
    
    // 备用模式：尝试多行块匹配
    if (!rollbackScript) {
      const blockMatch = content.match(/\/\*\*\s*Rollback:\s*([\s\S]*?)(?:\*\/|$)/is);
      if (blockMatch) {
        rollbackScript = blockMatch[1].trim();
      }
    }

    // 解析依赖
    const dependencies: string[] = [];
    const dependsMatch = content.match(/--\s*Depends(?:\s+On)?:\s*(.+?)(?:\n|$)/i) ||
                          content.match(/#\s*Depends(?:\s+On)?:\s*(.+?)(?:\n|$)/i);
    if (dependsMatch) {
      dependencies.push(...this.parseList(dependsMatch[1]));
    }

    return {
      id,
      description,
      module,
      isBreaking,
      rollbackScript,
      dependencies
    };
  }
}
