# 对象存储生命周期预演 CLI 工具

一个偏工程实用的命令行工具，用于预演对象存储生命周期规则，在规则上线前验证哪些对象会被删除，避免误删重要数据。

## 功能特性

- ✅ **规则解析**: 支持 YAML/JSON 格式的生命周期规则文件
- ✅ **对象清单解析**: 支持单个 CSV 文件或整个目录批量解析
- ✅ **标签匹配**: 支持基于对象标签的规则匹配
- ✅ **时间判断**: 精确计算过期时间，支持指定预演日期
- ✅ **版本支持**: 支持非当前版本的过期规则
- ✅ **坏行处理**: 自动记录解析错误，支持追溯到原文件位置
- ✅ **多种输出**: 终端摘要、CSV 机器可读结果、Markdown 报告
- ✅ **参数校验**: 完善的输入验证和错误提示

## 安装

### 环境要求

- Node.js >= 16.0.0
- npm 或 yarn

### 安装步骤

```bash
# 克隆或下载项目代码
cd lifecycle-simulator

# 安装依赖
npm install

# 编译 TypeScript
npm run build

# （可选）全局安装命令
npm link
```

安装完成后，可以使用 `lifecycle-sim` 命令。

## 使用示例

### 快速开始

使用示例数据运行预演：

```bash
lifecycle-sim -i examples/objects.csv -r examples/rules.yaml -o output
```

### 常用命令

```bash
# 指定预演日期
lifecycle-sim -i examples/objects.csv -r examples/rules.yaml -d 2025-01-01

# 只输出终端摘要
lifecycle-sim -i examples/objects.csv -r examples/rules.yaml -f summary

# 只生成 CSV 结果
lifecycle-sim -i examples/objects.csv -r examples/rules.yaml -f csv

# 批量处理目录中的所有 CSV 文件
lifecycle-sim -i ./data -r ./rules.yaml -o ./result

# 静默模式（只输出错误）
lifecycle-sim -i examples/objects.csv -r examples/rules.yaml -q

# 详细输出模式
lifecycle-sim -i examples/objects.csv -r examples/rules.yaml -v
```

### 命令参数

| 参数 | 缩写 | 必填 | 说明 | 默认值 |
|------|------|------|------|--------|
| `--input` | `-i` | ✅ | 对象清单输入路径（CSV 文件或目录） | - |
| `--rules` | `-r` | ✅ | 生命周期规则文件路径（YAML/JSON） | - |
| `--output` | `-o` | ❌ | 输出目录 | `./output` |
| `--date` | `-d` | ❌ | 预演日期（YYYY-MM-DD 格式） | 今天 |
| `--format` | `-f` | ❌ | 输出格式：all/summary/csv/markdown | `all` |
| `--verbose` | `-v` | ❌ | 显示详细输出 | - |
| `--quiet` | `-q` | ❌ | 静默模式，只输出错误 | - |
| `--help` | `-h` | ❌ | 显示帮助信息 | - |
| `--version` | `-V` | ❌ | 显示版本号 | - |

## 输入文件结构

### 1. 对象清单 CSV 文件

CSV 文件需包含以下列（列名不区分大小写）：

| 列名 | 必填 | 说明 | 示例 |
|------|------|------|------|
| `key` 或 `objectKey` 或 `name` | ✅ | 对象键（路径） | `logs/2024/app.log` |
| `size` 或 `sizeInBytes` | ✅ | 对象大小（字节） | `1048576` |
| `lastModified` 或 `modified` | ✅ | 最后修改时间 | `2024-01-15T10:30:00Z` |
| `isLatest` 或 `is_latest` | ❌ | 是否为当前版本 | `true`/`false` |
| `versionId` | ❌ | 版本 ID | `ver-001` |
| `storageClass` | ❌ | 存储类型 | `STANDARD`/`GLACIER` |
| `tags` | ❌ | 对象标签 | `key1=value1;key2=value2` 或 JSON |

**示例：**

```csv
key,size,lastModified,isLatest,versionId,storageClass,tags
logs/2024/01/app.log,1048576,2024-01-15T10:30:00Z,true,ver-001,STANDARD,
data/archive/2023/records.json,10485760,2023-06-15T10:00:00Z,true,ver-007,GLACIER,"archive=true"
```

### 2. 生命周期规则文件

支持 YAML 和 JSON 格式，规则结构如下：

| 字段 | 说明 |
|------|------|
| `id` | 规则唯一标识 |
| `status` | 状态：`Enabled` 或 `Disabled` |
| `filter.prefix` | 匹配的对象前缀 |
| `filter.tags` | 匹配的标签列表（需全部匹配） |
| `expiration.days` | 当前版本过期天数 |
| `expiration.date` | 指定过期日期（优先级高于 days） |
| `noncurrentVersionExpiration.noncurrentDays` | 非当前版本过期天数 |

**YAML 示例：**

```yaml
Rules:
  - id: delete-old-logs
    status: Enabled
    filter:
      prefix: logs/
    expiration:
      days: 30

  - id: archive-cleanup
    status: Enabled
    filter:
      prefix: archive/
      tags:
        - key: archive
          value: "true"
    expiration:
      days: 365

  - id: noncurrent-cleanup
    status: Enabled
    noncurrentVersionExpiration:
      noncurrentDays: 90
```

## 输出说明

执行成功后，输出目录将包含以下文件：

### 1. `simulation-result.csv`

机器可读的完整预演结果，包含所有对象的详细信息：

- 对象键、大小、最后修改时间
- 匹配的规则列表
- 是否会被删除
- 最早执行日期
- 源文件位置（用于追溯）

### 2. `simulation-report.md`

适合发给同事查看的 Markdown 格式报告，包含：

- 基本信息（预演时间、输入文件）
- 执行摘要（对象数、存储空间、删除比例）
- 生命周期规则列表及匹配统计
- 将被删除的对象列表（前 50 个）
- 注意事项

### 3. `bad-rows.csv`（如有错误）

记录所有解析失败的行，便于数据清洗：

- 源文件路径
- 行号
- 错误信息
- 原始内容

## 坏数据处理

工具具有完善的容错机制：

1. **跳过错误行**：解析失败的行不会中断整个流程，会被记录下来
2. **完整追溯**：每条坏数据记录包含源文件、行号、原始内容和错误信息
3. **统计汇总**：在终端摘要中显示坏行数量，提醒用户检查
4. **不影响结果**：即使部分数据解析失败，其他对象仍会正常处理

**常见解析错误原因：**

- 必填字段缺失（key、size、lastModified）
- 日期格式不正确
- 大小不是有效的数字
- CSV 格式不规范
- 列数不匹配

## 目录结构

```
lifecycle-simulator/
├── src/
│   ├── types.ts           # 类型定义
│   ├── cli.ts             # CLI 入口
│   ├── core/
│   │   ├── simulator.ts   # 预演引擎
│   │   ├── rule-parser.ts # 规则解析器
│   │   └── object-parser.ts # 对象清单解析器
│   └── output/
│       └── generator.ts   # 输出生成器
├── examples/
│   ├── rules.yaml         # 示例规则文件
│   └── objects.csv        # 示例对象清单
├── output/                # 默认输出目录（运行后生成）
├── package.json
├── tsconfig.json
└── README.md
```

## 开发与调试

```bash
# 监听文件变化自动编译
npm run dev

# 运行代码检查
npm run lint

# 使用示例数据测试
npm start -- -i examples/objects.csv -r examples/rules.yaml -v
```

## 注意事项

1. **预演性质**：本工具仅用于预演，实际删除操作请以云服务商控制台为准
2. **数据核对**：请仔细核对将被删除的对象列表，避免误删重要数据
3. **时间精度**：日期计算基于天粒度，小时级别的差异可能影响结果
4. **规则优先级**：多条规则同时匹配时，所有规则都会被记录
5. **禁用规则**：`status: Disabled` 的规则不会参与匹配

## 许可证

MIT
