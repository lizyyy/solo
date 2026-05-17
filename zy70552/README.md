# SQL Migration Shadow Replay CLI

在带历史数据的影子数据库上验证SQL迁移脚本的命令行工具。

## 关键特性

- **SQL执行编排** - 自动解析迁移脚本的UP和ROLLBACK区块
- **影响行统计** - 精确统计每个脚本影响的行数
- **回滚校验机制** - 执行回滚并验证数据完整性
- **失败保留现场** - 支持保留数据库状态便于排错
- **多格式报告输出**
  - 终端彩色表格摘要
  - JSON机器可读结果
  - Markdown适合同事分享
  - execution.log执行日志
- **坏行追踪** - 记录原始位置、原因和完整数据
- **独立运行目录** - 每次运行生成独立目录，不污染旧结果

## 安装

```bash
npm install
npm run build
```

## 使用方法

```bash
node dist/cli.js run \
  -m example/migrations \
  -d example/shadow-data \
  -s example/schemas \
  -c example/db-config.json \
  -o output
```

## 参数说明

| 参数 | 简写 | 说明 | 必填 |
|------|------|------|------|
| `--migrations` | `-m` | 迁移脚本目录路径 | ✅ |
| `--shadow-data` | `-d` | 影子数据JSON目录路径 | ✅ |
| `--schemas` | `-s` | 表结构JSON目录路径 | ✅ |
| `--db-config` | `-c` | 数据库配置JSON路径 | ✅ |
| `--output` | `-o` | 报告输出目录 | ✅ |

## 项目结构

```
sql-migration-shadow-replay/
├── src/
│   ├── types/            # TypeScript类型定义
│   │   └── index.ts
│   ├── engines/          # 数据库引擎
│   │   ├── database.ts   # 抽象基类
│   │   ├── mysql.ts      # MySQL实现
│   │   └── factory.ts    # 引擎工厂
│   ├── utils/
│   │   └── config.ts     # 配置加载工具
│   ├── replay-executor.ts # 核心执行逻辑
│   ├── report-generator.ts # 报告生成器
│   └── cli.ts           # CLI入口命令
├── example/
│   ├── db-config.json    # 数据库配置示例
│   ├── migrations/       # 迁移脚本示例
│   ├── shadow-data/      # 影子数据示例
│   └── schemas/          # 表结构示例
├── dist/                 # 编译输出
├── package.json
├── tsconfig.json
└── README.md
```

## 迁移脚本格式

迁移SQL文件需要包含`-- UP`和`-- ROLLBACK`标记：

```sql
-- UP
ALTER TABLE users ADD COLUMN phone VARCHAR(20);
UPDATE users SET phone = 'unknown';

-- ROLLBACK
ALTER TABLE users DROP COLUMN phone;
```

## 影子数据格式

JSON文件格式：

```json
{
  "tableName": "users",
  "primaryKey": ["id"],
  "rows": [
    { "id": 1, "name": "Alice", "email": "alice@example.com" },
    { "id": 2, "name": "Bob", "email": "bob@example.com" }
  ]
}
```

## 表结构格式

JSON文件格式：

```json
{
  "tableName": "users",
  "primaryKey": ["id"],
  "columns": [
    { "name": "id", "type": "INT", "nullable": false },
    { "name": "name", "type": "VARCHAR(255)", "nullable": false }
  ],
  "indexes": [
    { "name": "idx_email", "columns": ["email"], "isUnique": true }
  ]
}
```

## 数据库配置

```json
{
  "type": "mysql",
  "host": "localhost",
  "port": 3306,
  "username": "root",
  "password": "password",
  "database": "shadow_test"
}
```

## 报告输出

每次运行会在输出目录创建一个子目录（格式：`replay_{timestamp}_{uuid}`），包含：

1. **report.json** - 完整的机器可读报告
2. **report.md** - Markdown格式报告，适合分享
3. **execution.log** - 详细执行日志

## 开发

```bash
# 编译
npm run build

# 监听编译
npx tsc --watch

# 测试配置
node test-config.js
```

## 验证清单

### 第一轮 ✓
- ✅ 类型定义完整
- ✅ MySQL引擎实现
- ✅ 迁移脚本解析
- ✅ 影子数据加载
- ✅ SQL执行和事务
- ✅ 影响行统计
- ✅ 回滚执行和校验
- ✅ 坏行追踪和记录
- ✅ 终端彩色报告
- ✅ JSON报告输出
- ✅ Markdown报告输出
- ✅ 执行日志保存
- ✅ 独立运行目录
- ✅ CLI参数解析
- ✅ 示例配置文件
- ✅ 项目可编译运行

### 第二轮 ✓
- ✅ 修复配置加载路径问题（fs.readFileSync替代require）
- ✅ 修复示例迁移脚本冲突（ALTER TABLE替代CREATE TABLE）
- ✅ 3个真实迁移示例：添加字段、索引、条件更新
- ✅ 运行前自动清理旧表，确保可反复执行
- ✅ 完整示例数据：5个用户 + 3个订单
- ✅ README命令可直接体验
