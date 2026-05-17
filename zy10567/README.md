# Docker Compose 环境变量合并工具

一个用于排查 Docker Compose 环境变量优先级问题的 CLI 工具。

## 功能特性

- ✅ **YAML 解析**：解析 docker-compose.yml，提取 environment 和 env_file 配置
- ✅ **env 文件解析**：支持 `${VAR}` 和 `${VAR:-default}` 变量展开
- ✅ **优先级计算**：Shell 环境变量 > CLI 参数 > .env 文件 > compose 文件
- ✅ **冲突检测**：清晰显示哪个来源覆盖了哪个值
- ✅ **多种输出**：彩色终端摘要、JSON 机器可读、Markdown 报告
- ✅ **错误处理**：保留原始行号和错误原因，无效行不影响其他解析

## 优先级规则

| 优先级 | 来源 | 说明 |
|--------|------|------|
| 40 (最高) | Shell 环境变量 | 当前 shell 的所有环境变量 |
| 30 | CLI 参数 | 通过 `--env-var` 指定的变量 |
| 20 | .env 文件 | compose 文件中 env_file 引用的文件 |
| 10 (最低) | compose 文件 | docker-compose.yml 中的 environment |

## 安装

```bash
npm install
```

## 使用方法

### 基本用法

```bash
cd /path/to/your/project
node /path/to/dc-env-merge/bin/dc-env-merge.js
```

### 常用选项

```bash
# 不显示 shell 环境变量（推荐，避免太多噪声）
node bin/dc-env-merge.js --no-shell

# 只显示有冲突的变量
node bin/dc-env-merge.js --only-conflicts

# 指定 compose 文件
node bin/dc-env-merge.js --file docker-compose.dev.yml

# 指定额外的 .env 文件
node bin/dc-env-merge.js --env .env.local --env .env.override

# 指定 CLI 环境变量（模拟 docker-compose run -e）
node bin/dc-env-merge.js --env-var NODE_ENV=production --env-var DEBUG=false

# 指定输入目录
node bin/dc-env-merge.js --input ./examples

# 指定输出目录
node bin/dc-env-merge.js --output ./my-reports

# 只分析某个服务
node bin/dc-env-merge.js --service web
```

## 输出示例

### 终端输出（彩色）

```
================================================================================
Docker Compose 环境变量合并报告
================================================================================

📊 扫描摘要
   服务数量: 2
   总变量数: 15
   冲突数量: 5
   错误数量: 1
   警告数量: 0

❌ 错误
   ✗ 无效的环境变量语法 (行 18)
     /path/to/.env

🔀 变量冲突 (优先级高的覆盖低的)
   NODE_ENV
     ✅ .env文件: development
     ❌ compose文件: production

🎯 最终环境变量
   NODE_ENV = development
     来源: .env文件 @ .env
   DEBUG = true
     来源: .env文件 @ .env
```

### 生成的报告

每次运行会在输出目录生成两个文件（带时间戳，避免覆盖）：

- `env-merge-report-YYYY-MM-DDTHH-MM-SS-SSSZ.json` - 机器可读的完整数据
- `env-merge-report-YYYY-MM-DDTHH-MM-SS-SSSZ.md` - 适合发给同事的 Markdown 报告

## 项目结构

```
.
├── bin/
│   └── dc-env-merge.js      # CLI 入口
├── src/
│   ├── yaml-parser.js       # YAML 解析
│   ├── env-parser.js        # .env 文件解析
│   ├── merge-engine.js      # 合并和优先级计算
│   ├── reporter.js          # 报告生成
│   └── index.js             # 主逻辑
├── examples/
│   ├── docker-compose.yml   # 测试用 compose 文件
│   └── .env                 # 测试用 env 文件
└── package.json
```

## 常见问题

### Q: 为什么我的 shell 环境变量没有生效？
A: shell 变量优先级最高，但如果在 compose 文件或 env 文件中设置了相同变量，shell 会覆盖它们。工具会明确显示哪个来源最终生效。

### Q: 变量展开是如何工作的？
A: 工具支持 `${VAR}` 和 `${VAR:-default}` 语法，按照 Docker Compose 的规则进行展开。

### Q: 为什么 db.env 文件报错？
A: 工具会检测 compose 文件中 env_file 引用的文件是否存在。如果文件不存在且不是 required: false，会报错。

## License

MIT
