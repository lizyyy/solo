import * as path from 'path';
import { ensureDirectory, writeFile, writeJsonFile } from '../utils/file-utils';
import { OutputUtils } from '../utils/output-utils';

/**
 * 初始化命令
 * 创建示例数据目录和文件
 */
export async function initCommand(dataDirectory: string): Promise<void> {
  OutputUtils.title('初始化示例数据');
  OutputUtils.info(`创建数据目录: ${dataDirectory}`);
  
  // 确保目录存在
  ensureDirectory(dataDirectory);
  ensureDirectory(path.join(dataDirectory, 'migrations'));
  
  // 创建示例文件
  createCommitsCsv(dataDirectory);
  createIssuesCsv(dataDirectory);
  createDeployPlanJson(dataDirectory);
  createMigrationFiles(dataDirectory);
  
  OutputUtils.success('示例数据创建成功！');
  OutputUtils.info('');
  OutputUtils.info('请根据实际情况修改以下文件:');
  OutputUtils.info(`  - ${path.join(dataDirectory, 'commits.csv')}`);
  OutputUtils.info(`  - ${path.join(dataDirectory, 'issues.csv')}`);
  OutputUtils.info(`  - ${path.join(dataDirectory, 'deploy-plan.json')}`);
  OutputUtils.info(`  - ${path.join(dataDirectory, 'migrations/')} 目录下的迁移文件`);
}

/**
 * 创建示例 commits.csv
 */
function createCommitsCsv(dataDirectory: string): void {
  const content = `id,hash,message,author,date,module,related_issues,is_breaking,breaking_description
commit-1,a1b2c3d,"feat(auth): 添加用户登录功能 - Fixes #1",张三,2026-05-01,auth,issue-1,false,
commit-2,e4f5g6h,"feat(payment): 新增支付接口 - 关联 issue-2",李四,2026-05-02,payment,issue-2,false,
commit-3,i7j8k9l,"refactor(api): 重构用户API

BREAKING CHANGE: 修改了用户信息接口的响应格式，移除了 deprecated 字段",王五,2026-05-03,api,issue-3,true,"修改了用户信息接口的响应格式，移除了 deprecated 字段"
commit-4,m1n2o3p,"fix(auth): 修复登录超时问题",张三,2026-05-03,auth,issue-1,false,
commit-5,q4r5s6t,"chore: 更新依赖版本",赵六,2026-05-04,unknown,,false,
`;
  
  const filePath = path.join(dataDirectory, 'commits.csv');
  writeFile(filePath, content);
  OutputUtils.success(`✓ 创建 ${filePath}`);
}

/**
 * 创建示例 issues.csv
 */
function createIssuesCsv(dataDirectory: string): void {
  const content = `id,title,description,status,author,assignee,module,priority,affected_customers,related_commits,has_rollback_plan,rollback_plan,labels
issue-1,"用户登录功能需求","实现用户登录认证功能，包括用户名密码登录和第三方登录",in_progress,产品经理,张三,auth,high,"客户A,客户B,客户C","commit-1,commit-4",true,"1. 回滚到上一个稳定版本
2. 验证登录功能是否恢复正常","feature,auth"
issue-2,"支付系统优化","优化支付流程，减少支付失败率",closed,产品经理,李四,payment,high,"客户A,客户D",commit-2,true,"1. 检查支付配置
2. 回滚支付相关代码","feature,payment"
issue-3,"用户API重构","重构用户相关的API接口，统一响应格式",in_progress,技术负责人,王五,api,medium,,commit-3,false,,"refactor,api"
issue-4,"数据库性能优化","优化慢查询，添加索引",open,DBA,赵六,database,low,,,,,"performance,database"
`;
  
  const filePath = path.join(dataDirectory, 'issues.csv');
  writeFile(filePath, content);
  OutputUtils.success(`✓ 创建 ${filePath}`);
}

/**
 * 创建示例 deploy-plan.json
 */
function createDeployPlanJson(dataDirectory: string): void {
  const content = {
    version: "1.2.0",
    date: "2026-05-15",
    environment: "production",
    description: "本次发布包含用户登录功能、支付系统优化和API重构",
    moduleOwners: {
      auth: "张三",
      payment: "李四",
      api: "王五",
      database: "赵六",
      frontend: "钱七"
    },
    configChanges: [
      {
        key: "auth.session.timeout",
        oldValue: "3600",
        newValue: "7200",
        environment: "production",
        description: "延长登录会话超时时间",
        isRequired: true,
        rollbackAction: "恢复为 3600"
      },
      {
        key: "payment.max.retry",
        oldValue: "3",
        newValue: "5",
        environment: "production",
        description: "增加支付重试次数",
        isRequired: false,
        rollbackAction: "恢复为 3"
      },
      {
        key: "api.feature.enabled",
        oldValue: "false",
        newValue: "true",
        environment: "production",
        description: "启用新API功能开关",
        isRequired: true,
        rollbackAction: "设置为 false"
      }
    ],
    dependencies: [
      "user-service >= 2.0.0",
      "payment-service >= 1.5.0",
      "database: postgresql 14"
    ],
    preDeploySteps: [
      "备份数据库",
      "检查依赖服务状态",
      "更新配置文件",
      "关闭自动扩缩容"
    ],
    postDeploySteps: [
      "执行数据库迁移",
      "重启相关服务",
      "验证核心功能",
      "开启自动扩缩容",
      "通知相关人员"
    ],
    rollbackStrategy: `1. 停止新服务实例
2. 恢复旧版本代码
3. 回滚数据库迁移（如有）
4. 恢复配置值
5. 验证功能正常`
  };
  
  const filePath = path.join(dataDirectory, 'deploy-plan.json');
  writeJsonFile(filePath, content);
  OutputUtils.success(`✓ 创建 ${filePath}`);
}

/**
 * 创建示例迁移文件
 */
function createMigrationFiles(dataDirectory: string): void {
  const migrationsDir = path.join(dataDirectory, 'migrations');
  
  // 迁移1：添加用户表索引
  const migration1 = `-- Description: 为用户表添加登录时间索引
-- Module: auth
-- Depends On: 

-- 为用户表添加登录时间索引，提升登录日志查询性能
CREATE INDEX IF NOT EXISTS idx_users_last_login ON users(last_login_time);

-- Rollback:
-- DROP INDEX IF EXISTS idx_users_last_login;
`;
  writeFile(path.join(migrationsDir, '001_add_user_login_index.sql'), migration1);
  OutputUtils.success(`✓ 创建 ${path.join(migrationsDir, '001_add_user_login_index.sql')}`);
  
  // 迁移2：修改用户表结构（破坏性变更）
  const migration2 = `-- Description: 修改用户表，移除废弃字段
-- Module: auth
-- Depends On: 001_add_user_login_index.sql
-- ⚠️ 破坏性变更：此迁移会删除数据

-- 移除 deprecated 字段（已废弃）
ALTER TABLE users DROP COLUMN IF EXISTS old_phone_number;
ALTER TABLE users DROP COLUMN IF EXISTS legacy_address;

-- Rollback:
-- ALTER TABLE users ADD COLUMN old_phone_number VARCHAR(20);
-- ALTER TABLE users ADD COLUMN legacy_address TEXT;
-- 注意：数据已丢失，需要从备份恢复
`;
  writeFile(path.join(migrationsDir, '002_remove_deprecated_columns.sql'), migration2);
  OutputUtils.success(`✓ 创建 ${path.join(migrationsDir, '002_remove_deprecated_columns.sql')}`);
  
  // 迁移3：添加支付订单表
  const migration3 = `-- Description: 新增支付订单扩展表
-- Module: payment
-- Depends On: 

-- 为支付系统添加订单扩展信息表
CREATE TABLE IF NOT EXISTS payment_order_extra (
  order_id BIGINT PRIMARY KEY,
  extra_info JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payment_order_extra_order_id ON payment_order_extra(order_id);

-- Rollback:
-- DROP TABLE IF EXISTS payment_order_extra;
`;
  writeFile(path.join(migrationsDir, '003_add_payment_order_extra.sql'), migration3);
  OutputUtils.success(`✓ 创建 ${path.join(migrationsDir, '003_add_payment_order_extra.sql')}`);
}
