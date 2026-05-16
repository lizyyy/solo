# Docker Compose 端口冲突检测 CLI

一个功能完整的命令行工具，用于检测多个 Docker Compose 文件之间的**端口映射冲突**和**服务名冲突**，提供清晰的报告和修复建议。

## ✨ 特性

- 🔍 **智能检测**：自动发现并解析多个 Docker Compose 文件
- 🔌 **端口冲突检测**：检测主机端口绑定冲突，支持不同 IP 绑定区分
- 🏷️ **服务名冲突检测**：检测重复的服务名定义
- 📊 **环境变量展开**：自动解析 Compose 文件中的环境变量
- 🎯 **优先级排序**：根据严重性对冲突进行分级（高/中/低）
- 📁 **多种输出格式**：终端摘要、JSON、Markdown、HTML 报告
- ❌ **错误追溯**：坏行或异常准确定位到原文件和行号
- 🚪 **退出码区分**：0=正常，1=发现冲突，2=解析错误

## 📦 安装

### 前置要求

- Node.js >= 16.0.0
- npm 或 yarn

### 安装步骤

```bash
# 克隆项目
git clone <repository-url>
cd compose-port-conflict-cli

# 安装依赖
npm install

# 构建 TypeScript
npm run build

# 全局链接（可选，方便全局使用）
npm link
```

## 🚀 使用方法

### 基本命令

```bash
# 扫描当前目录
compose-port-check

# 扫描指定目录或文件
compose-port-check ./project-a ./project-b/docker-compose.yml

# 自定义输出目录
compose-port-check ./projects -o ./my-reports

# 指定输出格式
compose-port-check ./projects -f json md

# 详细输出模式
compose-port-check ./projects -v

# 严格模式（任何冲突都返回非零退出码）
compose-port-check ./projects -s
```

### 命令选项

| 选项 | 简写 | 说明 | 默认值 |
|------|------|------|--------|
| `--output <dir>` | `-o` | 报告输出目录 | `./compose-reports` |
| `--format <formats...>` | `-f` | 输出格式: json, md, html, all | `all` |
| `--verbose` | `-v` | 显示详细输出信息 | `false` |
| `--strict` | `-s` | 严格模式 | `false` |
| `--version` | `-V` | 显示版本号 | - |
| `--help` | `-h` | 显示帮助信息 | - |

## 📁 输入目录结构示例

工具支持任意目录结构，会自动递归查找所有 Compose 文件。

```
your-projects/
├── project-a/
│   └── docker-compose.yml
├── project-b/
│   └── compose.yml
├── project-c/
│   └── docker/
│       └── docker-compose.yaml
└── project-d/
    └── docker-compose.yml
```

### 支持的 Compose 文件名

- `docker-compose.yml`
- `docker-compose.yaml`
- `compose.yml`
- `compose.yaml`

## 📊 输出报告位置

所有报告文件默认输出到 `./compose-reports/` 目录：

```
compose-reports/
├── port-conflicts.json          # 机器可读的完整数据
├── port-conflicts-report.md     # Markdown 格式报告
└── port-conflicts-report.html   # HTML 格式报告（可直接打开）
```

## 💻 终端输出示例

```
============================================================
  Docker Compose 端口冲突检测报告
============================================================

📊 扫描信息
  Compose 文件: 3 个
  服务总数: 8 个
  端口映射: 6 个
  扫描时间: 2024/1/15 14:30:00

⚠️  发现 2 个端口冲突

   高  端口 8080
   ┌──────────────────────┬──────────────┬──────────────────────────────────────────┐
   │ 服务名               │ 容器端口     │ 文件位置                                 │
   ├──────────────────────┼──────────────┼──────────────────────────────────────────┤
   │ web                  │ 80           │ /projects/project-a/docker-compose.yml:5 │
   │ api                  │ 3000         │ /projects/project-b/docker-compose.yml:10│
   └──────────────────────┴──────────────┴──────────────────────────────────────────┘

   中  端口 3306
   ┌──────────────────────┬──────────────┬──────────────────────────────────────────┐
   │ 服务名               │ 容器端口     │ 文件位置                                 │
   ├──────────────────────┼──────────────┼──────────────────────────────────────────┤
   │ mysql                │ 3306         │ /projects/project-a/docker-compose.yml:15│
   │ db                   │ 3306         │ /projects/project-c/compose.yml:8        │
   └──────────────────────┴──────────────┴──────────────────────────────────────────┘

✅ 未发现服务名冲突

💡 修复建议

   🔌 [#1] 端口 8080 被 2 个服务占用: web (.../project-a), api (.../project-b)
      → 建议修改端口映射: api: 8080 → 8090
      涉及文件: /projects/project-a, /projects/project-b

   🔌 [#2] 端口 3306 被 2 个服务占用: mysql (.../project-a), db (.../project-c)
      → 建议修改端口映射: db: 3306 → 3316
      涉及文件: /projects/project-a, /projects/project-c

📁 已生成报告文件:
   - /your-projects/compose-reports/port-conflicts.json
   - /your-projects/compose-reports/port-conflicts-report.md
   - /your-projects/compose-reports/port-conflicts-report.html

⚠️  扫描完成，发现需要修复的问题
```

## ⚠️ 坏数据处理

当遇到无效的 YAML 或配置错误时，工具会：

1. **准确定位**：显示出错的文件路径和行号
2. **错误分类**：区分严重错误和警告
3. **继续执行**：不会因为单个文件错误而终止整个扫描

### 错误输出示例

```
📝 解析问题 (1 个错误, 2 个警告)

  ERROR /projects/bad-compose.yml:23
    can not read an implicit mapping pair; a colon is missed

  WARNING /projects/other-compose.yml
    服务 "app" 的 ports 配置必须是数组

  WARNING /projects/other-compose.yml
    服务 "api" 的端口配置无效: "invalid-port" - 无效的端口格式
```

## 🚪 退出码说明

| 退出码 | 含义 |
|--------|------|
| 0 | 扫描完成，未发现高严重性冲突（或无冲突） |
| 1 | 发现需要修复的冲突（严格模式下任何冲突） |
| 2 | 遇到解析错误或其他致命错误 |

### 在 CI/CD 中使用

```bash
#!/bin/bash

# 运行检测
compose-port-check ./services -s

exit_code=$?

if [ $exit_code -eq 1 ]; then
  echo "❌ 发现端口冲突，请修复后再提交"
  exit 1
elif [ $exit_code -eq 2 ]; then
  echo "⚠️  解析错误，请检查 Compose 文件格式"
  exit 1
fi

echo "✅ 端口检测通过"
```

## 📝 开发说明

### 项目结构

```
src/
├── types.ts          # 类型定义
├── parser.ts         # YAML 解析器和文件发现
├── detector.ts       # 冲突检测核心逻辑
├── reporter.ts       # 报告生成器（终端/JSON/MD/HTML）
└── index.ts          # CLI 入口
```

### 本地开发

```bash
# 使用 ts-node 直接运行
npm run dev -- ./test-projects

# 构建后运行
npm run build && node dist/index.js ./test-projects

# 类型检查
npm run typecheck

# 代码检查
npm run lint
```

## 🎯 常见问题

### Q: 工具会修改我的 Compose 文件吗？

**不会**。这是一个只读工具，只会分析和报告，不会修改任何源文件。

### Q: 如何只检测特定的 Compose 文件？

直接指定文件路径作为参数：
```bash
compose-port-check ./project1/docker-compose.yml ./project2/compose.yml
```

### Q: 两个服务绑定到不同 IP 的相同端口会被检测为冲突吗？

**不会**。例如，`127.0.0.1:8080` 和 `0.0.0.0:8080` 会被视为不同的绑定，不会报告冲突。

### Q: 支持 Compose 文件中的 `extends` 或 `include` 吗？

目前版本仅解析直接定义在文件中的服务和端口配置。

## 📄 许可证

MIT

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！