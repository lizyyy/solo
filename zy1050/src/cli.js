#!/usr/bin/env node

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import MigrationChecker from './migration-checker.js';
import logger from './utils/logger.js';

const argv = yargs(hideBin(process.argv))
  .command('check', '运行迁移体检', (yargs) => {
    yargs
      .option('migrations-dir', {
        alias: 'm',
        describe: '迁移文件目录',
        type: 'string',
        demandOption: true
      })
      .option('config', {
        alias: 'c',
        describe: '配置文件路径 (YAML 或 JSON)',
        type: 'string'
      })
      .option('output', {
        alias: 'o',
        describe: '报告输出目录',
        type: 'string',
        default: './report'
      })
      .option('formats', {
        alias: 'f',
        describe: '输出格式 (json, markdown, html)',
        type: 'array',
        default: ['json', 'markdown', 'html'],
        choices: ['json', 'markdown', 'html']
      })
      .option('verbose', {
        alias: 'v',
        describe: '详细输出',
        type: 'boolean',
        default: false
      })
      .option('in-memory', {
        alias: 'mem',
        describe: '使用内存数据库',
        type: 'boolean',
        default: true
      })
      .option('skip-rollback', {
        alias: 'sr',
        describe: '跳过回滚测试',
        type: 'boolean',
        default: false
      });
  })
  .command('list', '列出迁移文件', (yargs) => {
    yargs
      .option('migrations-dir', {
        alias: 'm',
        describe: '迁移文件目录',
        type: 'string',
        demandOption: true
      })
      .option('verbose', {
        alias: 'v',
        describe: '详细输出',
        type: 'boolean',
        default: false
      });
  })
  .command('init', '初始化示例项目', (yargs) => {
    yargs
      .option('dir', {
        alias: 'd',
        describe: '目标目录',
        type: 'string',
        default: '.'
      });
  })
  .example('$0 check --migrations-dir ./migrations --config ./config.yaml', '运行完整的迁移体检')
  .example('$0 check -m ./migrations -o ./report', '使用内存数据库并输出报告')
  .example('$0 list -m ./migrations', '列出所有迁移文件')
  .help()
  .alias('help', 'h')
  .version()
  .alias('version', 'V')
  .epilogue('SQLite 迁移回放和回滚风险体检 CLI 工具')
  .argv;

const command = argv._[0];

async function main() {
  try {
    if (command === 'check') {
      await runCheck();
    } else if (command === 'list') {
      await runList();
    } else if (command === 'init') {
      await runInit();
    } else {
      yargs.showHelp();
    }
  } catch (error) {
    logger.error(error.message);
    process.exit(1);
  }
}

async function runCheck() {
  const checker = new MigrationChecker({
    migrationsDir: argv.migrationsDir,
    configPath: argv.config,
    outputDir: argv.output,
    verbose: argv.verbose,
    inMemory: argv.inMemory,
    formats: argv.formats,
    skipRollback: argv.skipRollback
  });

  const report = await checker.run();
  
  if (argv.output) {
    checker.generateReport(report);
  }

  console.log('\n' + '='.repeat(60));
  console.log('体检结果汇总:');
  console.log('='.repeat(60));
  
  console.log(`\n状态: ${report.status === 'success' ? '✅ 通过' : report.status === 'failed' ? '❌ 失败' : '⚠️ 错误'}`);
  
  console.log(`\n迁移执行:`);
  console.log(`  - 总数: ${report.totalMigrations}`);
  console.log(`  - 成功: ${report.successfulMigrations}`);
  console.log(`  - 失败: ${report.failedMigrations}`);
  console.log(`  - 有回滚脚本: ${report.withRollback}`);

  if (report.riskyChanges && report.riskyChanges.length > 0) {
    console.log(`\n风险变更 (${report.riskyChanges.length} 项):`);
    
    const grouped = {
      high: [],
      medium: [],
      low: [],
      warning: [],
      error: []
    };
    
    for (const change of report.riskyChanges) {
      const severity = change.severity || 'low';
      if (grouped[severity]) {
        grouped[severity].push(change);
      }
    }

    if (grouped.error.length > 0) {
      console.log(`  ❌ 错误: ${grouped.error.length} 项`);
    }
    if (grouped.high.length > 0) {
      console.log(`  🔴 高风险: ${grouped.high.length} 项`);
    }
    if (grouped.medium.length > 0) {
      console.log(`  🟠 中风险: ${grouped.medium.length} 项`);
    }
    if (grouped.low.length > 0) {
      console.log(`  🟡 低风险: ${grouped.low.length} 项`);
    }
    if (grouped.warning.length > 0) {
      console.log(`  ⚠️ 警告: ${grouped.warning.length} 项`);
    }
  }

  if (report.rollbackTest) {
    console.log(`\n回滚测试:`);
    console.log(`  - 状态: ${report.rollbackTest.success ? '✅ 通过' : '❌ 失败'}`);
    if (report.rollbackTest.issues && report.rollbackTest.issues.length > 0) {
      console.log(`  - 问题: ${report.rollbackTest.issues.length} 项`);
    }
  }

  if (report.assertionResults && report.assertionResults.length > 0) {
    const passed = report.assertionResults.filter(r => r.success).length;
    const failed = report.assertionResults.filter(r => !r.success).length;
    console.log(`\n断言:`);
    console.log(`  - 通过: ${passed}`);
    console.log(`  - 失败: ${failed}`);
  }

  console.log('\n' + '='.repeat(60));

  if (report.status === 'success') {
    console.log('🎉 迁移体检通过！可以安全上线。');
    process.exit(0);
  } else {
    console.log('⚠️  迁移体检发现问题，请查看详细报告。');
    process.exit(1);
  }
}

async function runList() {
  const MigrationScanner = (await import('./migration-scanner.js')).default;
  
  const scanner = new MigrationScanner(argv.migrationsDir, { 
    verbose: argv.verbose 
  });
  
  const scanResult = scanner.scan();

  console.log('\n' + '='.repeat(60));
  console.log('迁移文件列表:');
  console.log('='.repeat(60));

  console.log(`\n发现 ${scanResult.count} 个迁移文件，${scanResult.rollbackCount} 个回滚脚本`);

  if (scanResult.issues.length > 0) {
    console.log(`\n⚠️  发现 ${scanResult.issues.length} 个问题:`);
    for (const issue of scanResult.issues) {
      const severity = issue.severity === 'error' ? '❌' : '⚠️';
      console.log(`  ${severity} ${issue.message}`);
    }
  }

  console.log('\n迁移明细:');
  for (const migration of scanResult.migrations) {
    const rollbackStatus = migration.hasRollback ? '✅ 有回滚' : '⚠️ 无回滚';
    console.log(`\n  v${migration.version}: ${migration.name}`);
    console.log(`    回滚: ${rollbackStatus}`);
  }

  console.log('\n' + '='.repeat(60) + '\n');
}

async function runInit() {
  const fs = await import('fs');
  const path = await import('path');
  
  const targetDir = argv.dir;
  const migrationsDir = path.join(targetDir, 'migrations');

  console.log(`\n📦 初始化示例项目到: ${targetDir}`);

  if (!fs.existsSync(migrationsDir)) {
    fs.mkdirSync(migrationsDir, { recursive: true });
    logger.success(`创建目录: ${migrationsDir}`);
  }

  const exampleMigrations = [
    {
      name: '001_init.sql',
      content: `-- 初始化用户表
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
`
    },
    {
      name: '001_init_rollback.sql',
      content: `-- 回滚初始化
DROP INDEX IF EXISTS idx_users_email;
DROP TABLE IF EXISTS users;
`
    },
    {
      name: '002_add_profile.sql',
      content: `-- 添加用户资料表
CREATE TABLE user_profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  display_name TEXT,
  bio TEXT,
  avatar_url TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_user_profiles_user_id ON user_profiles(user_id);
`
    },
    {
      name: '002_add_profile_rollback.sql',
      content: `-- 回滚用户资料表
DROP INDEX IF EXISTS idx_user_profiles_user_id;
DROP TABLE IF EXISTS user_profiles;
`
    },
    {
      name: '003_add_status.sql',
      content: `-- 添加用户状态字段
ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'active';

CREATE INDEX idx_users_status ON users(status);
`
    },
    {
      name: '003_add_status_rollback.sql',
      content: `-- 回滚用户状态字段
-- SQLite 不支持 DROP COLUMN，需要重建表
DROP INDEX IF EXISTS idx_users_status;

CREATE TABLE users_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO users_new (id, username, email, password_hash, created_at, updated_at)
SELECT id, username, email, password_hash, created_at, updated_at FROM users;

DROP TABLE users;
ALTER TABLE users_new RENAME TO users;
`
    }
  ];

  for (const migration of exampleMigrations) {
    const filePath = path.join(migrationsDir, migration.name);
    fs.writeFileSync(filePath, migration.content);
    logger.success(`创建: ${migration.name}`);
  }

  const configContent = `# SQLite 迁移体检配置文件

# Seed 数据 (SQL 文件或直接数据)
seed:
  - "seed.sql"  # 执行 SQL 文件
  # 或直接定义数据
  # - type: data
  #   table: users
  #   rows:
  #     - username: "admin"
  #       email: "admin@example.com"
  #       password_hash: "hashed_password"

# 断言规则
assertions:
  # 检查表是否存在
  - type: table_exists
    table: users
    shouldExist: true
  
  # 检查字段是否存在
  - type: column_exists
    table: users
    column: email
  
  # 检查表行数
  - type: row_count
    table: users
    count: 0
    operator: ">="
  
  # 原始 SQL 查询 (返回结果会被记录)
  # - type: raw
  #   sql: "SELECT COUNT(*) as count FROM users"

# 需要监控数据变化的表
watchTables:
  - users
  - user_profiles

# 输出配置
output:
  markdown: true
  json: true
  html: true
`;

  const configPath = path.join(targetDir, 'config.yaml');
  fs.writeFileSync(configPath, configContent);
  logger.success(`创建: config.yaml`);

  const seedContent = `-- 示例 seed 数据
-- 可以在这里插入测试数据用于迁移前后的数据完整性验证

-- 示例:
-- INSERT INTO users (username, email, password_hash)
-- VALUES ('test_user', 'test@example.com', 'test_hash');
`;

  const seedPath = path.join(targetDir, 'seed.sql');
  fs.writeFileSync(seedPath, seedContent);
  logger.success(`创建: seed.sql`);

  console.log(`
✅ 示例项目创建完成！

下一步:
1. 查看示例迁移文件: ${migrationsDir}
2. 修改 config.yaml 配置你的项目
3. 运行体检: 
   sqlite-migration-checker check --migrations-dir ${migrationsDir} --config ${configPath}
`);
}

main();
