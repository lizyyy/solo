import { DataValidator } from '../src/core/data-validator';
import { Commit, Issue, DeployPlan, Migration, ConfigChange } from '../src/types';

describe('DataValidator', () => {
  let validator: DataValidator;

  beforeEach(() => {
    validator = new DataValidator();
  });

  describe('validateCommits', () => {
    it('应该检测重复的 Commit ID', () => {
      const commits: Commit[] = [
        { id: 'commit-1', hash: 'a1b2c3d', message: 'test', author: '张三', date: '2026-05-01', module: 'auth', relatedIssues: [], isBreaking: false },
        { id: 'commit-1', hash: 'e4f5g6h', message: 'test2', author: '李四', date: '2026-05-02', module: 'payment', relatedIssues: [], isBreaking: false }
      ];

      const result = validator.validateCommits(commits);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.type === 'duplicate_id')).toBe(true);
    });

    it('应该警告空的提交记录', () => {
      const commits: Commit[] = [];

      const result = validator.validateCommits(commits);

      expect(result.valid).toBe(true);
      expect(result.warnings.some(w => w.type === 'empty_data')).toBe(true);
    });

    it('应该警告破坏性变更缺少描述', () => {
      const commits: Commit[] = [
        { id: 'commit-1', hash: 'a1b2c3d', message: 'test', author: '张三', date: '2026-05-01', module: 'auth', relatedIssues: [], isBreaking: true }
      ];

      const result = validator.validateCommits(commits);

      expect(result.warnings.some(w => w.type === 'incomplete_breaking_change')).toBe(true);
    });

    it('应该正确验证正常的提交记录', () => {
      const commits: Commit[] = [
        { id: 'commit-1', hash: 'a1b2c3d', message: 'feat: 新功能', author: '张三', date: '2026-05-01', module: 'auth', relatedIssues: ['issue-1'], isBreaking: false },
        { id: 'commit-2', hash: 'e4f5g6h', message: 'fix: 修复问题', author: '李四', date: '2026-05-02', module: 'payment', relatedIssues: [], isBreaking: false }
      ];

      const result = validator.validateCommits(commits);

      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });
  });

  describe('validateIssues', () => {
    it('应该检测重复的 Issue ID', () => {
      const issues: Issue[] = [
        { id: 'issue-1', title: '问题1', description: '', status: 'open', author: '', assignee: '', module: 'auth', priority: 'high', affectedCustomers: [], relatedCommits: [], hasRollbackPlan: true, labels: [] },
        { id: 'issue-1', title: '问题2', description: '', status: 'closed', author: '', assignee: '', module: 'payment', priority: 'medium', affectedCustomers: [], relatedCommits: [], hasRollbackPlan: true, labels: [] }
      ];

      const result = validator.validateIssues(issues);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.type === 'duplicate_id')).toBe(true);
    });

    it('应该警告高优先级 Issue 缺少回滚计划', () => {
      const issues: Issue[] = [
        { id: 'issue-1', title: '高优先级问题', description: '', status: 'open', author: '', assignee: '', module: 'auth', priority: 'high', affectedCustomers: [], relatedCommits: [], hasRollbackPlan: false, labels: [] }
      ];

      const result = validator.validateIssues(issues);

      expect(result.warnings.some(w => w.type === 'missing_rollback_plan')).toBe(true);
    });

    it('应该警告高优先级 Issue 缺少受影响客户', () => {
      const issues: Issue[] = [
        { id: 'issue-1', title: '高优先级问题', description: '', status: 'open', author: '', assignee: '', module: 'auth', priority: 'high', affectedCustomers: [], relatedCommits: [], hasRollbackPlan: true, labels: [] }
      ];

      const result = validator.validateIssues(issues);

      expect(result.warnings.some(w => w.type === 'missing_customer_info')).toBe(true);
    });

    it('应该正确验证正常的 Issue', () => {
      const issues: Issue[] = [
        { 
          id: 'issue-1', 
          title: '正常问题', 
          description: '问题描述', 
          status: 'in_progress', 
          author: '产品经理', 
          assignee: '张三', 
          module: 'auth', 
          priority: 'high', 
          affectedCustomers: ['客户A'], 
          relatedCommits: ['commit-1'], 
          hasRollbackPlan: true, 
          rollbackPlan: '回滚步骤',
          labels: ['feature'] 
        }
      ];

      const result = validator.validateIssues(issues);

      expect(result.valid).toBe(true);
    });
  });

  describe('validateMigrations', () => {
    it('应该检测重复的迁移 ID', () => {
      const migrations: Migration[] = [
        { id: 'migration-1', filename: '001.sql', content: '', description: '迁移1', module: 'auth', isBreaking: false, dependencies: [] },
        { id: 'migration-1', filename: '002.sql', content: '', description: '迁移2', module: 'payment', isBreaking: false, dependencies: [] }
      ];

      const result = validator.validateMigrations(migrations);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.type === 'duplicate_id')).toBe(true);
    });

    it('应该严重警告破坏性迁移缺少回滚脚本', () => {
      const migrations: Migration[] = [
        { id: 'migration-1', filename: '001.sql', content: '', description: '破坏性迁移', module: 'auth', isBreaking: true, dependencies: [] }
      ];

      const result = validator.validateMigrations(migrations);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.severity === 'critical' && e.type === 'missing_rollback_script')).toBe(true);
    });

    it('应该警告迁移依赖不存在', () => {
      const migrations: Migration[] = [
        { id: 'migration-1', filename: '001.sql', content: '', description: '迁移1', module: 'auth', isBreaking: false, dependencies: ['non-existent-migration'] }
      ];

      const result = validator.validateMigrations(migrations);

      expect(result.warnings.some(w => w.type === 'missing_dependency')).toBe(true);
    });
  });

  describe('validateDeployPlan', () => {
    it('应该警告缺少版本号', () => {
      const plan: DeployPlan = {
        version: '0.0.0',
        date: '2026-05-01',
        environment: 'production',
        description: '',
        moduleOwners: {},
        configChanges: [],
        dependencies: [],
        preDeploySteps: [],
        postDeploySteps: [],
        rollbackStrategy: ''
      };

      const result = validator.validateDeployPlan(plan);

      expect(result.warnings.some(w => w.type === 'missing_version')).toBe(true);
    });

    it('应该警告缺少回滚策略', () => {
      const plan: DeployPlan = {
        version: '1.0.0',
        date: '2026-05-01',
        environment: 'production',
        description: '',
        moduleOwners: {},
        configChanges: [],
        dependencies: [],
        preDeploySteps: [],
        postDeploySteps: [],
        rollbackStrategy: ''
      };

      const result = validator.validateDeployPlan(plan);

      expect(result.warnings.some(w => w.type === 'missing_rollback_strategy')).toBe(true);
    });

    it('应该警告必需配置项缺少回滚操作', () => {
      const plan: DeployPlan = {
        version: '1.0.0',
        date: '2026-05-01',
        environment: 'production',
        description: '',
        moduleOwners: {},
        configChanges: [
          { key: 'test.key', oldValue: 'old', newValue: 'new', environment: 'production', description: '', isRequired: true, rollbackAction: '' }
        ],
        dependencies: [],
        preDeploySteps: [],
        postDeploySteps: [],
        rollbackStrategy: '回滚策略'
      };

      const result = validator.validateDeployPlan(plan);

      expect(result.warnings.some(w => w.type === 'missing_rollback_action')).toBe(true);
    });
  });

  describe('validateAll', () => {
    it('应该综合校验所有数据', () => {
      const commits: Commit[] = [
        { id: 'commit-1', hash: 'a1b2c3d', message: 'feat: 新功能', author: '张三', date: '2026-05-01', module: 'auth', relatedIssues: ['issue-1'], isBreaking: false }
      ];

      const issues: Issue[] = [
        { id: 'issue-1', title: '问题1', description: '', status: 'open', author: '', assignee: '张三', module: 'auth', priority: 'medium', affectedCustomers: [], relatedCommits: ['commit-1'], hasRollbackPlan: true, labels: [] }
      ];

      const deployPlan: DeployPlan = {
        version: '1.0.0',
        date: '2026-05-01',
        environment: 'production',
        description: '测试版本',
        moduleOwners: { auth: '张三' },
        configChanges: [],
        dependencies: [],
        preDeploySteps: [],
        postDeploySteps: [],
        rollbackStrategy: '回滚策略'
      };

      const migrations: Migration[] = [
        { id: 'migration-1', filename: '001.sql', content: '', description: '迁移1', module: 'auth', isBreaking: false, dependencies: [], rollbackScript: '回滚脚本' }
      ];

      const result = validator.validateAll(commits, issues, deployPlan, migrations);

      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('应该检测异常数据场景', () => {
      // 异常场景：高优先级 Issue 无回滚计划 + 破坏性迁移无回滚脚本
      const commits: Commit[] = [];

      const issues: Issue[] = [
        { id: 'issue-1', title: '高优先级问题', description: '', status: 'open', author: '', assignee: '', module: 'auth', priority: 'high', affectedCustomers: ['客户A'], relatedCommits: [], hasRollbackPlan: false, labels: [] }
      ];

      const deployPlan: DeployPlan = {
        version: '1.0.0',
        date: '2026-05-01',
        environment: 'production',
        description: '',
        moduleOwners: {},
        configChanges: [],
        dependencies: [],
        preDeploySteps: [],
        postDeploySteps: [],
        rollbackStrategy: ''
      };

      const migrations: Migration[] = [
        { id: 'migration-1', filename: '001.sql', content: 'DROP TABLE users;', description: '删除用户表', module: 'auth', isBreaking: true, dependencies: [] }
      ];

      const result = validator.validateAll(commits, issues, deployPlan, migrations);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });
});
