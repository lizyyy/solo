# SQL注入风险扫描工具 (sql-injection-scanner)

一个本地命令行工具，用于小团队上线前扫描项目中的SQL注入风险。

## 功能特性

- 🛡️ **代码扫描**: 检测多种SQL注入模式
  - 字符串拼接SQL (字符串 + 拼接)
  - 模板字面量拼接SQL (\`\${}\` 插值)
  - 用户输入直接嵌入SQL (req.body/query/params)
  - 动态表名/列名无白名单验证
  - 字符串格式化函数 (sprintf, util.format)
  - SQL注释符检测 (--, /* */)
  - UNION注入检测
  - 动态代码执行 (eval, new Function)

- 🔒 **数据库权限检查**
  - 检测数据库文件权限是否过宽 (全局可读/可写)
  - 检测WAL/SHM文件
  - 检测备份文件
  - 检测父目录权限

- 📋 **风险分级系统**
  - 🔴 **Critical (严重)**: 直接可被利用的注入点
  - 🟠 **High (高危)**: 高风险注入模式
  - 🟡 **Medium (中危)**: 潜在风险点
  - 🔵 **Low (低危)**: 需要注意的代码模式

- 📄 **报告导出**
  - Markdown格式报告 (适合人工审查)
  - JSON格式报告 (适合程序处理)

- ⚙️ **Baseline机制**
  - 创建、管理Baseline文件
  - 忽略已知的安全风险
  - 支持增量扫描

- 🌱 **Seed项目**
  - 内置包含各种SQL注入漏洞的示例项目
  - 用于测试扫描器功能
  - 包含坏代码示例和好代码对比

## 安装

```bash
# 克隆或下载项目后
cd sql-injection-scanner

# 安装依赖
npm install

# 链接命令行工具 (可选)
npm link
```

## 快速开始

### 1. 基本扫描

```bash
# 扫描当前目录
sql-scan scan -c .

# 扫描指定目录
sql-scan scan -c /path/to/your/project

# 同时检查数据库权限
sql-scan scan -c /path/to/project -d /path/to/data/app.db
```

### 2. 创建测试项目

```bash
# 创建一个包含SQL注入漏洞的示例项目
sql-scan seed -o ./test-project

# 扫描这个测试项目
sql-scan scan -c ./test-project
```

### 3. 使用风险级别过滤

```bash
# 只显示高危及以上问题
sql-scan scan -c . -l high

# 只显示严重问题
sql-scan scan -c . -l critical
```

### 4. 导出报告

```bash
# 导出Markdown报告 (默认)
sql-scan scan -c . -o markdown

# 导出JSON报告
sql-scan scan -c . -o json

# 同时导出两种格式
sql-scan scan -c . -o both

# 指定输出文件名
sql-scan scan -c . -f security-report
```

### 5. 使用Baseline

```bash
# 基于当前扫描结果创建Baseline
sql-scan baseline --create .sql-scan-baseline.json -s .

# 列出Baseline中的所有条目
sql-scan baseline --list -b .sql-scan-baseline.json

# 使用Baseline进行扫描 (忽略已知风险)
sql-scan scan -c . -b .sql-scan-baseline.json

# 手动添加忽略项
sql-scan baseline --add src/file.js:15 -b .sql-scan-baseline.json

# 移除忽略项
sql-scan baseline --remove src/file.js:15 -b .sql-scan-baseline.json
```

## 命令参考

### scan 命令

| 参数 | 简写 | 说明 | 默认值 |
|------|------|------|--------|
| --code | -c | 待扫描的代码目录路径 | 当前目录 |
| --database | -d | SQLite数据库文件路径 (可选) | 无 |
| --baseline | -b | Baseline文件路径 | 无 |
| --output | -o | 输出格式: markdown, json, both | markdown |
| --output-file | -f | 输出文件名 (不含扩展名) | scan-report |
| --level | -l | 最小风险级别: critical, high, medium, low | low |
| --no-color | | 禁用彩色输出 | 禁用 |

### baseline 命令

| 参数 | 简写 | 说明 |
|------|------|------|
| --create | -c | 基于扫描结果创建新的Baseline |
| --scan-dir | -s | 用于创建Baseline的扫描目录 |
| --add | -a | 添加忽略项 (格式: 文件路径:行号) |
| --remove | -r | 移除忽略项 (格式: 文件路径:行号) |
| --list | -l | 列出Baseline中的所有条目 |
| --baseline | -b | Baseline文件路径 |

### seed 命令

| 参数 | 简写 | 说明 | 默认值 |
|------|------|------|--------|
| --output | -o | Seed项目输出目录 | ./sql-injection-examples |

## 检测的漏洞类型

### 严重 (Critical)

| ID | 名称 | 描述 |
|----|------|------|
| STRING_CONCAT_SQL | 字符串拼接SQL | 使用 `+` 或 `.` 拼接SQL字符串 |
| TEMPLATE_LITERAL_SQL | 模板字面量拼接SQL | 使用 `\`\${}\`` 插值构建SQL |
| USER_INPUT_IN_SQL | 用户输入直接嵌入SQL | `req.body/query/params` 直接用于SQL |
| EXECUTE_DYNAMIC_SQL | 执行动态SQL | 使用 `eval`, `new Function`, `exec` |

### 高危 (High)

| ID | 名称 | 描述 |
|----|------|------|
| DYNAMIC_TABLE_NO_WHITELIST | 动态表名无白名单 | 表名/列名直接来自用户输入，无白名单 |
| STRING_FORMAT_SQL | 字符串格式化函数 | 使用 `sprintf`, `util.format` |
| CONCAT_FUNCTION_SQL | 字符串连接函数 | 使用 `CONCAT()`, `\|\|` |

### 中危 (Medium)

| ID | 名称 | 描述 |
|----|------|------|
| COMMENT_IN_SQL | SQL注释符检测 | SQL中包含 `--` 或 `/* */` |
| UNION_SQL_INJECTION | UNION注入检测 | 动态SQL中包含UNION |

### 低危 (Low)

| ID | 名称 | 描述 |
|----|------|------|
| NO_PARAMETER_BINDING | 疑似缺少参数绑定 | 硬编码的SQL字面量值 |

## 输出示例

### 控制台输出

```
=======================================
  SQL注入风险扫描工具 v1.0.0
=======================================

扫描目录: ./test-project
风险级别阈值: low

开始扫描...

扫描完成!

✓ Markdown报告已保存: scan-report.md

=======================================
  扫描摘要
=======================================

扫描文件数: 8
发现问题数: 15

CRITICAL  : 5 个问题
HIGH      : 3 个问题
MEDIUM    : 2 个问题
LOW       : 5 个问题

⚠ 发现安全风险，请查看报告详情!
```

### Markdown报告结构

1. **扫描元数据** - 扫描时间、目录、数据库等
2. **扫描摘要** - 统计数据、风险分布
3. **问题详情** - 按严重程度分组的详细问题
   - 位置、描述
   - 问题代码片段
   - 上下文代码
   - 修复建议
4. **安全建议** - 通用防护原则和检查清单

## 最佳实践

### 1. 集成到CI/CD流程

```yaml
# .github/workflows/security.yml
name: Security Scan

on: [push, pull_request]

jobs:
  sql-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Install sql-injection-scanner
        run: npm install -g sql-injection-scanner
      - name: Run scan
        run: sql-scan scan -c . -l high
        continue-on-error: true
```

### 2. 使用Baseline管理误报

```bash
# 第一次扫描，创建Baseline
sql-scan scan -c . -o both
sql-scan baseline --create .sql-scan-baseline.json -s .

# 审查Baseline，移除真正的漏洞
# 保留确认的误报或已接受的风险

# 后续扫描使用Baseline
sql-scan scan -c . -b .sql-scan-baseline.json
```

### 3. 定期审计

```bash
# 创建计划任务或cron job
# 每周扫描并生成报告

# 示例: 每周一扫描
# 0 0 * * 1 cd /path/to/project && sql-scan scan -c . -f weekly-report-$(date +\%Y-\%m-\%d)
```

## 限制和注意事项

### 静态分析的局限性

1. **误报**: 静态分析可能会产生误报。请仔细审查每个发现的问题。
2. **漏报**: 无法检测所有可能的SQL注入模式，特别是：
   - 复杂的间接变量传递
   - 运行时动态生成的代码
   - 存储过程中的注入
   - ORM框架的特殊用法

### 数据库权限检查

- 仅支持SQLite数据库文件的权限检查
- 不检查MySQL、PostgreSQL等其他数据库的配置
- 权限检查基于文件系统权限，不检查数据库内部权限

### 支持的文件类型

- JavaScript/TypeScript: `.js`, `.jsx`, `.ts`, `.tsx`
- Python: `.py`
- PHP: `.php`
- Java: `.java`
- Ruby: `.rb`
- Go: `.go`
- C#: `.cs`
- C/C++: `.c`, `.cpp`
- SQL: `.sql`

## 开发

### 运行测试

```bash
# 安装开发依赖
npm install

# 运行所有测试
npm test

# 运行特定测试文件
npm test -- tests/scanner.test.js
```

### 项目结构

```
sql-injection-scanner/
├── bin/
│   └── sql-scan.js          # 命令行入口
├── src/
│   ├── index.js             # 模块导出
│   ├── scanner.js           # 核心扫描器
│   ├── patterns.js          # 检测模式定义
│   ├── database-checker.js  # 数据库权限检查
│   ├── report.js            # 报告生成
│   ├── baseline.js          # Baseline管理
│   └── seed.js              # Seed项目生成
├── tests/
│   ├── scanner.test.js      # 扫描器测试
│   ├── report.test.js       # 报告生成测试
│   └── baseline.test.js     # Baseline测试
├── package.json
└── README.md
```

### 添加自定义检测模式

```javascript
// 在 src/patterns.js 中添加

{
  id: 'CUSTOM_PATTERN',
  name: '自定义模式名称',
  description: '模式描述',
  severity: RISK_LEVELS.HIGH,
  patterns: [
    /your-regex-pattern/g
  ],
  contextPattern: /(SELECT|INSERT|UPDATE|DELETE)\s+/i,
  fixSuggestion: '修复建议',
  examples: ['坏代码示例']
}
```

## 安全免责声明

此工具旨在帮助识别潜在的SQL注入风险，但不能保证发现所有安全问题。

1. **静态分析的局限性**: 静态代码分析无法检测所有可能的漏洞。
2. **误报和漏报**: 工具可能产生误报（错误地标记安全代码）或漏报（遗漏真实漏洞）。
3. **仅供参考**: 此工具的输出仅供参考，不应作为安全决策的唯一依据。
4. **人工审查**: 所有发现的问题都应该由经验丰富的安全专业人员进行人工审查。
5. **持续安全**: 安全审计是一个持续的过程，此工具只是安全开发生命周期的一部分。

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request 来改进这个工具。

---

**提示**: 这是一个用于教育和辅助安全审计的工具。在生产环境部署前，请确保进行全面的安全审查。
