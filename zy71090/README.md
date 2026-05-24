# Route53 TTL 分级分析 CLI 工具

域名迁移前离线分析工具，帮助 SRE 团队识别 TTL 过长记录、环境缺失记录和复杂 CNAME 链路。

## 功能特性

- 🔍 **TTL 分级分析** - 将 DNS 记录按 TTL 分为 5 个级别，快速识别过长 TTL 记录
- 🌍 **环境对比** - 自动检测记录所属环境，对比各环境记录完整性
- 🔗 **CNAME 链路展开** - 递归解析 CNAME 链，检测循环引用和未解析目标
- ⭐ **通配符记录处理** - 智能匹配通配符记录的应用范围
- 📊 **多格式输出** - 终端摘要、机器可读 JSON、团队共享 Markdown
- ⚙️ **高度可配置** - 自定义 TTL 分级规则、环境匹配模式

## 安装

### 环境要求
- Node.js >= 18.0.0

### 安装步骤

```bash
# 克隆项目或解压后进入目录
cd route53-ttl-analyzer

# 安装依赖
npm install

# 构建项目
npm run build

# 链接到全局命令（可选）
npm link
```

### 验证安装

```bash
# 如果已链接到全局
r53-ttl --version

# 或使用 npm
npm run dev -- --version
```

## 快速开始

### 基本用法

```bash
# 分析单个 Zone 文件
r53-ttl analyze -z examples/example.com.zone

# 指定输出目录和格式
r53-ttl analyze -z examples/example.com.zone -o ./reports -f json,markdown,terminal

# 指定要对比的环境
r53-ttl analyze -z examples/example.com.zone -e production,staging,testing
```

### 常用命令

```bash
# 查看帮助
r53-ttl --help

# 查看子命令帮助
r53-ttl analyze --help

# 列出支持的文件格式
r53-ttl list-formats

# 列出默认 TTL 分级配置
r53-ttl list-tiers

# 列出默认环境匹配规则
r53-ttl list-envs

# 生成示例配置文件
r53-ttl init-config -o ./config
```

## 输入目录结构

### 推荐目录布局

```
your-project/
├── zones/                  # Zone 文件目录
│   ├── example.com.zone   # BIND 格式 Zone 文件
│   ├── internal.com.json  # AWS JSON 格式
│   └── dev.zone           # 开发环境 Zone
├── config/                 # 自定义配置（可选）
│   ├── ttl-config.json    # TTL 分级配置
│   └── env-config.json    # 环境匹配配置
└── reports/               # 输出目录（自动创建）
    ├── example.com-2024-01-01T00-00-00.json
    └── example.com-2024-01-01T00-00-00.md
```

### 支持的文件格式

#### 1. BIND Zone 格式 (.zone, .txt)

```zone
$ORIGIN example.com.
$TTL 3600

@       IN  SOA  ns1.example.com. admin.example.com. (
                 2024010101 ; serial
                 3600       ; refresh
                 1800       ; retry
                 604800     ; expire
                 86400      ; minimum TTL
                 )

@       IN  NS   ns1.example.com.
@       IN  NS   ns2.example.com.
@       IN  A    192.168.1.1
www     IN  A    192.168.1.2
api     IN  CNAME www.example.com.
```

#### 2. AWS Route53 JSON 格式 (.json)

```json
{
  "ResourceRecordSets": [
    {
      "Name": "example.com.",
      "Type": "A",
      "TTL": 300,
      "ResourceRecords": [
        { "Value": "192.168.1.1" }
      ]
    },
    {
      "Name": "www.example.com.",
      "Type": "CNAME",
      "TTL": 300,
      "ResourceRecords": [
        { "Value": "example.com." }
      ]
    }
  ]
}
```

#### 3. 简化 JSON 格式 (.json)

```json
[
  { "name": "example.com", "type": "A", "ttl": 300, "value": "192.168.1.1" },
  { "name": "www.example.com", "type": "CNAME", "ttl": 300, "value": "example.com" }
]
```

## 完整示例

### 1. 基础分析

```bash
r53-ttl analyze -z zones/example.com.zone
```

### 2. 迁移准备分析

```bash
# 指定迁移窗口（4小时），输出所有格式
r53-ttl analyze \
  -z zones/example.com.zone \
  -w 4 \
  -o reports/migration \
  -f json,markdown,terminal \
  -e production,staging,testing \
  -v
```

### 3. 使用自定义配置

```bash
# 使用自定义 TTL 分级和环境规则
r53-ttl analyze \
  -z zones/example.com.zone \
  -t config/ttl-config.json \
  -E config/env-config.json
```

### 4. 严格模式

```bash
# 发现任何问题都返回非零退出码（用于 CI/CD）
r53-ttl analyze -z zones/example.com.zone -s
```

## 配置说明

### TTL 分级配置

默认分级规则：

| 级别 | TTL 范围 | 描述 |
|------|----------|------|
| CRITICAL | 0-60s | 关键服务 |
| HIGH | 61-300s | 高优先级 (1-5分钟) |
| MEDIUM | 301-1800s | 中等 (5-30分钟) |
| LOW | 1801-86400s | 低优先级 (30分钟-1天) |
| LEGACY | >86400s | 遗留配置 |

自定义配置示例：

```json
[
  {
    "tier": "CRITICAL",
    "min": 0,
    "max": 60,
    "description": "关键服务",
    "color": "red"
  },
  {
    "tier": "HIGH",
    "min": 61,
    "max": 300,
    "description": "高优先级",
    "color": "orange"
  }
]
```

### 环境匹配配置

默认环境规则：

| 环境 | 匹配模式 |
|------|----------|
| production | prod, production, www, api |
| staging | staging, stage, stg, preprod |
| testing | test, testing, tst, qa |
| development | dev, development, local |
| internal | internal, intranet, corp |
| monitoring | monitor, metrics, logs, alert |

自定义配置示例：

```json
[
  {
    "name": "production",
    "patterns": ["prod", "www", "api"],
    "color": "red"
  },
  {
    "name": "canary",
    "patterns": ["canary", "can"],
    "color": "yellow"
  }
]
```

## 坏数据处理

### 常见问题及解决方案

#### 1. 解析失败

**症状**: `Error: 无法识别的 JSON 格式`

**可能原因**:
- 文件编码问题（需要 UTF-8）
- JSON 语法错误
- Zone 文件格式不规范

**解决方案**:
```bash
# 检查文件编码
file -i your-file.zone

# 验证 JSON
jq . your-file.json

# 使用 verbose 模式查看详细错误
r53-ttl analyze -z your-file.zone -v
```

#### 2. 域名验证警告

**症状**: `Label contains invalid characters`

**可能原因**:
- 域名包含特殊字符（如下划线，虽然技术上不合法但有些系统支持）
- 国际化域名（IDN）未转码

**解决方案**:
- 警告不影响分析流程，仅作提醒
- 如需严格检查，使用 `-s` 选项

#### 3. CNAME 未解析

**症状**: CNAME 链路显示 `UNRESOLVED`

**可能原因**:
- 目标域名不在当前 Zone 文件中
- 目标域名是外部域名

**解决方案**:
- 这是正常现象，工具仅分析当前 Zone 文件内的记录
- 如需完整链路分析，将相关 Zone 文件一并导入

#### 4. 循环引用

**症状**: 检测到 `循环引用` 警告

**可能原因**:
- CNAME 记录形成闭环
- 配置错误

**解决方案**:
- 立即修复 DNS 配置，这会导致 DNS 查询失败

## 退出码说明

| 退出码 | 含义 |
|--------|------|
| 0 | 成功，无严重问题 |
| 1 | 参数错误 |
| 2 | 文件不存在 |
| 3 | 解析失败 |
| 4 | 分析失败 |
| 5 | 输出失败 |
| 100 | 发现问题（严格模式下） |

### 在脚本中使用

```bash
#!/bin/bash

r53-ttl analyze -z zones/example.com.zone -s -f json,markdown

EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
  echo "✅ 分析完成，无问题"
elif [ $EXIT_CODE -eq 100 ]; then
  echo "⚠️  发现需要关注的问题，请查看报告"
else
  echo "❌ 分析失败，退出码: $EXIT_CODE"
  exit $EXIT_CODE
fi
```

## 输出说明

### 终端输出

- 彩色表格展示关键指标
- TTL 分级统计
- 需调整记录列表（前 10 条）
- CNAME 链路摘要
- 环境缺失记录

### JSON 输出

完整的结构化数据，包含：
- 所有记录的详细分析
- TTL 分级信息
- 环境标签
- CNAME 链路详情
- 统计摘要

### Markdown 输出

适合团队共享的文档，包含：
- 完整的分析报告
- 详细的表格
- CNAME 链路树形图
- 配置说明

## 命令参数参考

### analyze 命令

| 参数 | 简写 | 说明 | 默认值 |
|------|------|------|--------|
| --zone-file | -z | Zone 文件路径（必填） | - |
| --output-dir | -o | 报告输出目录 | ./reports |
| --environments | -e | 环境列表，逗号分隔 | 所有默认环境 |
| --migration-window | -w | 迁移窗口（小时） | - |
| --ttl-config | -t | 自定义 TTL 配置文件 | - |
| --env-config | -E | 自定义环境配置文件 | - |
| --format | -f | 输出格式: json,markdown,terminal | terminal |
| --verbose | -v | 详细输出 | false |
| --strict | -s | 严格模式 | false |
| --no-expand-cname | - | 不展开 CNAME 链路 | false |
| --max-chain-depth | - | CNAME 最大深度 | 10 |
| --min-ttl-warn | - | 最小 TTL 警告阈值 | 300 |
| --max-ttl-warn | - | 最大 TTL 警告阈值 | 3600 |

## 项目结构

```
src/
├── cli.ts                 # 命令行入口
├── types/
│   └── index.ts          # TypeScript 类型定义
├── config/
│   └── default.ts        # 默认配置
├── parsers/
│   └── zoneParser.ts     # Zone 文件解析器
├── analyzers/
│   ├── ttlAnalyzer.ts    # TTL 分级分析
│   ├── environmentAnalyzer.ts  # 环境分析
│   └── cnameAnalyzer.ts  # CNAME 链路分析
├── reporting/
│   └── generator.ts      # 报告生成
└── utils/
    ├── validator.ts      # 参数校验
    └── errors.ts         # 错误处理
```

## 开发

```bash
# 开发模式（使用 ts-node）
npm run dev -- analyze -z examples/example.com.zone

# 类型检查
npm run typecheck

# 构建
npm run build
```

## 许可证

MIT
