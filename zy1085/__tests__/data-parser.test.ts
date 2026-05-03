import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { DataParser } from '../src/core/data-parser';
import { Commit, Issue, DeployPlan, Migration } from '../src/types';

describe('DataParser', () => {
  let testDir: string;

  beforeEach(() => {
    // 创建临时测试目录
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'release-plan-test-'));
  });

  afterEach(() => {
    // 清理临时目录
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('parseCommits', () => {
    it('应该正确解析 commits.csv 文件', async () => {
      // 创建测试 CSV 文件
      const csvContent = `id,hash,message,author,date,module,related_issues,is_breaking,breaking_description
commit-1,a1b2c3d,"feat(auth): 添加用户登录功能 - Fixes #1",张三,2026-05-01,auth,issue-1,false,
commit-2,e4f5g6h,"refactor(api): 重构API

BREAKING CHANGE: 修改了响应格式",王五,2026-05-03,api,,true,"修改了响应格式"
`;
      fs.writeFileSync(path.join(testDir, 'commits.csv'), csvContent);

      const parser = new DataParser(testDir);
      const commits = await parser.parseCommits();

      expect(commits.length).toBe(2);
      
      const commit1 = commits.find(c => c.id === 'commit-1');
      expect(commit1).toBeDefined();
      expect(commit1?.hash).toBe('a1b2c3d');
      expect(commit1?.author).toBe('张三');
      expect(commit1?.module).toBe('auth');
      expect(commit1?.isBreaking).toBe(false);
      expect(commit1?.relatedIssues).toContain('issue-1');

      const commit2 = commits.find(c => c.id === 'commit-2');
      expect(commit2).toBeDefined();
      expect(commit2?.isBreaking).toBe(true);
      expect(commit2?.breakingDescription).toBe('修改了响应格式');
    });

    it('应该从 commit message 中自动识别 #数字格式的 Issue 引用', async () => {
      const csvContent = `id,hash,message,author,date
commit-1,a1b2c3d,"feat: Fixes #123 and #456",张三,2026-05-01
`;
      fs.writeFileSync(path.join(testDir, 'commits.csv'), csvContent);

      const parser = new DataParser(testDir);
      const commits = await parser.parseCommits();

      expect(commits[0].relatedIssues).toContain('issue-123');
      expect(commits[0].relatedIssues).toContain('issue-456');
    });

    it('应该从 commit message 中自动检测破坏性变更关键词', async () => {
      const csvContent = `id,hash,message,author,date
commit-1,a1b2c3d,"feat: 新功能

BREAKING CHANGE: 移除了废弃的 API",张三,2026-05-01
commit-2,e4f5g6h,"fix: ⚠️ BREAKING: 修改了配置格式",李四,2026-05-02
`;
      fs.writeFileSync(path.join(testDir, 'commits.csv'), csvContent);

      const parser = new DataParser(testDir);
      const commits = await parser.parseCommits();

      expect(commits[0].isBreaking).toBe(true);
      expect(commits[1].isBreaking).toBe(true);
    });

    it('应该从 commit message 前缀推断模块', async () => {
      const csvContent = `id,hash,message,author,date
commit-1,a1b2c3d,"feat(auth): 登录功能",张三,2026-05-01
commit-2,e4f5g6h,"fix(payment): 支付问题",李四,2026-05-02
commit-3,i7j8k9l,"chore: 更新依赖",王五,2026-05-03
`;
      fs.writeFileSync(path.join(testDir, 'commits.csv'), csvContent);

      const parser = new DataParser(testDir);
      const commits = await parser.parseCommits();

      expect(commits[0].module).toBe('auth');
      expect(commits[1].module).toBe('payment');
      expect(commits[2].module).toBe('unknown');
    });

    it('当文件不存在时应该抛出错误', async () => {
      const parser = new DataParser(testDir);
      await expect(parser.parseCommits()).rejects.toThrow('commits.csv文件不存在');
    });
  });

  describe('parseIssues', () => {
    it('应该正确解析 issues.csv 文件', async () => {
      const csvContent = `id,title,description,status,author,assignee,module,priority,affected_customers,related_commits,has_rollback_plan,rollback_plan,labels
issue-1,"用户登录功能","实现登录认证",in_progress,产品经理,张三,auth,high,"客户A,客户B","commit-1,commit-4",true,"1. 回滚版本
2. 验证功能","feature,auth"
`;
      fs.writeFileSync(path.join(testDir, 'issues.csv'), csvContent);

      const parser = new DataParser(testDir);
      const issues = await parser.parseIssues();

      expect(issues.length).toBe(1);
      const issue = issues[0];
      
      expect(issue.id).toBe('issue-1');
      expect(issue.title).toBe('用户登录功能');
      expect(issue.status).toBe('in_progress');
      expect(issue.assignee).toBe('张三');
      expect(issue.module).toBe('auth');
      expect(issue.priority).toBe('high');
      expect(issue.affectedCustomers).toEqual(['客户A', '客户B']);
      expect(issue.relatedCommits).toEqual(['commit-1', 'commit-4']);
      expect(issue.hasRollbackPlan).toBe(true);
      expect(issue.labels).toEqual(['feature', 'auth']);
    });

    it('应该正确解析优先级', async () => {
      const csvContent = `id,title,priority
issue-1,"高优先级",high
issue-2,"中优先级",medium
issue-3,"低优先级",low
issue-4,"P0",p0
issue-5,"未指定",
`;
      fs.writeFileSync(path.join(testDir, 'issues.csv'), csvContent);

      const parser = new DataParser(testDir);
      const issues = await parser.parseIssues();

      expect(issues[0].priority).toBe('high');
      expect(issues[1].priority).toBe('medium');
      expect(issues[2].priority).toBe('low');
      expect(issues[3].priority).toBe('high');
      expect(issues[4].priority).toBe('medium');
    });

    it('当文件不存在时应该抛出错误', async () => {
      const parser = new DataParser(testDir);
      await expect(parser.parseIssues()).rejects.toThrow('issues.csv文件不存在');
    });
  });

  describe('parseDeployPlan', () => {
    it('应该正确解析 deploy-plan.json 文件', () => {
      const jsonContent = {
        version: "1.2.0",
        date: "2026-05-15",
        environment: "production",
        description: "测试版本",
        moduleOwners: {
          auth: "张三",
          payment: "李四"
        },
        configChanges: [
          {
            key: "test.key",
            oldValue: "old",
            newValue: "new",
            environment: "production",
            description: "测试配置",
            isRequired: true,
            rollbackAction: "恢复旧值"
          }
        ],
        dependencies: ["service-a >= 1.0.0"],
        preDeploySteps: ["备份数据库"],
        postDeploySteps: ["执行迁移"],
        rollbackStrategy: "回滚策略"
      };
      
      fs.writeFileSync(
        path.join(testDir, 'deploy-plan.json'),
        JSON.stringify(jsonContent, null, 2)
      );

      const parser = new DataParser(testDir);
      const plan = parser.parseDeployPlan();

      expect(plan.version).toBe('1.2.0');
      expect(plan.date).toBe('2026-05-15');
      expect(plan.environment).toBe('production');
      expect(plan.moduleOwners.auth).toBe('张三');
      expect(plan.configChanges.length).toBe(1);
      expect(plan.configChanges[0].key).toBe('test.key');
      expect(plan.dependencies).toEqual(['service-a >= 1.0.0']);
    });

    it('当文件不存在时应该抛出错误', () => {
      const parser = new DataParser(testDir);
      expect(() => parser.parseDeployPlan()).toThrow('deploy-plan.json文件不存在');
    });
  });

  describe('parseMigrations', () => {
    it('应该正确解析 SQL 迁移文件', () => {
      const migrationsDir = path.join(testDir, 'migrations');
      fs.mkdirSync(migrationsDir);

      const migrationContent = `-- Description: 为用户表添加索引
-- Module: auth
-- Depends On: 

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Rollback:
-- DROP INDEX IF EXISTS idx_users_email;
`;
      fs.writeFileSync(path.join(migrationsDir, '001_add_index.sql'), migrationContent);

      const parser = new DataParser(testDir);
      const migrations = parser.parseMigrations();

      expect(migrations.length).toBe(1);
      const migration = migrations[0];
      
      expect(migration.description).toBe('为用户表添加索引');
      expect(migration.module).toBe('auth');
      expect(migration.isBreaking).toBe(false);
      expect(migration.rollbackScript).toBeDefined();
      expect(migration.rollbackScript).toContain('DROP INDEX');
    });

    it('应该自动检测破坏性 SQL 操作', () => {
      const migrationsDir = path.join(testDir, 'migrations');
      fs.mkdirSync(migrationsDir);

      const migrationContent = `-- Description: 移除废弃字段
-- Module: auth

ALTER TABLE users DROP COLUMN old_phone;
DROP TABLE IF EXISTS old_logs;
DELETE FROM users WHERE status = 'inactive';
`;
      fs.writeFileSync(path.join(migrationsDir, '001_drop_table.sql'), migrationContent);

      const parser = new DataParser(testDir);
      const migrations = parser.parseMigrations();

      expect(migrations[0].isBreaking).toBe(true);
    });

    it('当 migrations 目录不存在时应该返回空数组', () => {
      const parser = new DataParser(testDir);
      const migrations = parser.parseMigrations();
      expect(migrations).toEqual([]);
    });
  });
});
