# 法院电子卷宗校验工具 (case-validator)

一个用于法院电子卷宗刻录/移交前离线校验的 TypeScript CLI 工具。

## 功能特性

- **必备文书检查**：检查案件是否缺少规定的必备文书（起诉状、答辩状、证据清单、庭审笔录、判决书等）
- **哈希值校验**：验证文件完整性，检测文件是否被篡改
- **跨盘重复检测**：检测同一文件是否在不同光盘或不同案件中重复出现
- **密级管理检查**：检查密级文件是否放置在正确的目录中（秘密/机密文件不应放在公开目录）
- **路径大小写检测**：检测路径大小写不一致的问题，避免跨平台兼容性问题
- **批次追加识别**：识别同案号多批次追加的情况，给出清晰提示
- **报告生成**：导出 issues.csv 和 handover_report.md 报告

## 安装

```bash
# 安装依赖
npm install

# 编译 TypeScript
npm run build
```

## 快速开始

使用提供的示例数据一键运行：

```bash
# 方式一：先校验再生成报告
node dist/index.js validate ./sample
node dist/index.js report ./sample

# 方式二：一条命令完成校验并生成报告
node dist/index.js report ./sample --validate
```

## 命令说明

### validate 命令

执行卷宗校验，检查各种问题。

```bash
node dist/index.js validate [目录路径] [选项]
```

**参数：**
- `directory`：卷宗目录路径，默认为当前目录

**选项：**
- `--no-hash`：跳过哈希值校验
- `--no-duplicate`：跳过重复文件检查
- `--no-secret`：跳过敏级目录检查
- `--no-path-case`：跳过路径大小写检查
- `--no-batch`：跳过批次追加检查
- `--no-verify-files`：不实际读取文件计算哈希（仅对比记录）
- `--cases <path>`：指定 cases.csv 路径
- `--manifest <path>`：指定 manifest.jsonl 路径
- `--hashes <path>`：指定 hashes.txt 路径
- `--rules <path>`：指定 rules.yaml 路径

**示例：**
```bash
# 基础校验
node dist/index.js validate ./my-cases

# 跳过哈希校验（加快速度）
node dist/index.js validate ./my-cases --no-hash

# 使用指定配置文件
node dist/index.js validate ./my-cases \
  --cases /path/to/cases.csv \
  --manifest /path/to/manifest.jsonl
```

### report 命令

生成校验报告，导出 issues.csv 和 handover_report.md。

```bash
node dist/index.js report [目录路径] [选项]
```

**参数：**
- `directory`：卷宗目录路径，默认为当前目录

**选项：**
- `-o, --output <path>`：报告输出目录，默认为 `./output`
- `--issues-csv <name>`：问题列表文件名，默认为 `issues.csv`
- `--report-md <name>`：移交报告文件名，默认为 `handover_report.md`
- `--validate`：先执行校验再生成报告
- 所有 `validate` 命令的选项也适用

**示例：**
```bash
# 生成报告（使用上次校验结果）
node dist/index.js report ./my-cases

# 先校验再生成报告
node dist/index.js report ./my-cases --validate

# 指定输出目录
node dist/index.js report ./my-cases -o ./my-reports
```

## 配置文件说明

### cases.csv

案件信息表，包含以下字段：

| 字段名 | 说明 | 示例 |
|--------|------|------|
| 案号 | 案件编号 | (2024)京民初字第001号 |
| 案件类型 | 民事/刑事/行政/执行 | 民事 |
| 当事人 | 案件当事人 | 张三诉李四 |
| 承办法官 | 负责法官 | 王法官 |
| 立案日期 | 立案时间 | 2024-01-15 |
| 密级 | 公开/内部/秘密/机密 | 公开 |
| 必备文书 | 用逗号分隔的文书列表 | 起诉状,答辩状,判决书 |
| 批次号 | 案件所属批次 | B001 |

### manifest.jsonl

文件清单，每行一个 JSON 对象，包含以下字段：

```json
{
  "caseNumber": "(2024)京民初字第001号",
  "filePath": "(2024)京民初字第001号/公开/起诉状.pdf",
  "fileName": "起诉状.pdf",
  "fileSize": 102400,
  "lastModified": "2024-01-16T10:00:00Z",
  "diskLabel": "DISC-001",
  "batchNumber": "B001"
}
```

### hashes.txt

文件哈希值记录，支持多种格式：

```
# 格式1: 哈希值 *文件路径 (sha256sum 格式)
e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 *卷宗/起诉状.pdf

# 格式2: 文件路径 = 哈希值
卷宗/答辩状.pdf = e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855

# 格式3: 文件路径 哈希值
卷宗/证据清单.pdf e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
```

### rules.yaml

校验规则配置：

```yaml
# 必备文书规则
requiredDocuments:
  - caseType: 民事
    documents:
      - 起诉状
      - 答辩状
      - 证据清单
      - 庭审笔录
      - 判决书

# 密级目录规则
secretLevelRules:
  - level: 公开
    allowedDirectories: ["公开", "public", "卷宗"]
    forbiddenDirectories: ["内部", "秘密", "机密"]

# 重复文件检查规则
duplicateCheckRules:
  enabled: true
  ignoreDirectories: ["目录文件", "索引"]

# 其他检查开关
caseSensitivityCheck: true
batchAppendCheck: true
```

## 示例数据说明

`sample/` 目录包含了演示各种问题的测试数据：

| 案号 | 问题类型 | 说明 |
|------|----------|------|
| (2024)京民初字第001号 | 必备文书缺失 | 缺少判决书 |
| (2024)京民初字第001号 | 哈希不一致 | 庭审笔录.pdf 的哈希记录被故意篡改 |
| (2024)京刑初字第002号 | 密级误放 | 秘密级文件放在了公开目录 |
| (2024)京行初字第003号 | 多批次追加 | 涉及 B001 和 B002 两个批次 |
| (2024)京民初/行初字第003号 | 跨盘重复 | 共同证据.pdf 在两个案件中都存在 |
| (2024)京民初字第001号 | 路径大小写 | PUBLIC 目录与其他文件的 公开 目录大小写不一致 |

## 输出文件说明

### issues.csv

问题列表，包含以下字段：

| 字段 | 说明 |
|------|------|
| 问题ID | 唯一标识符 |
| 案号 | 所属案件编号 |
| 规则ID | 触发的规则编号 |
| 规则名称 | 规则的中文名称 |
| 严重程度 | 错误/警告/提示 |
| 分类 | 问题分类 |
| 问题描述 | 简要描述 |
| 详细信息 | 详细说明 |
| 涉及文件 | 相关文件路径 |
| 发现时间 | 检测时间 |

### handover_report.md

移交报告，包含以下章节：

1. **校验概览** - 总体统计数据
2. **问题分类统计** - 按分类汇总问题
3. **特殊情况提示** - 路径大小写、多批次、重复文件等特殊情况
4. **详细问题列表** - 所有问题的详细说明
5. **案件统计详情** - 每个案件的具体情况
6. **校验结论** - 是否通过校验

## 项目结构

```
.
├── src/
│   ├── index.ts              # CLI 入口
│   ├── types/
│   │   └── index.ts          # TypeScript 类型定义
│   ├── parsers/
│   │   ├── index.ts
│   │   ├── cases-parser.ts   # cases.csv 解析器
│   │   ├── manifest-parser.ts # manifest.jsonl 解析器
│   │   ├── hashes-parser.ts  # hashes.txt 解析器
│   │   └── rules-parser.ts   # rules.yaml 解析器
│   ├── validator/
│   │   ├── index.ts
│   │   ├── issue-factory.ts  # 问题生成器
│   │   ├── required-docs-checker.ts # 必备文书检查
│   │   ├── hash-checker.ts   # 哈希校验
│   │   ├── duplicate-checker.ts # 重复文件检查
│   │   ├── secret-level-checker.ts # 密级检查
│   │   ├── path-case-checker.ts # 路径大小写检查
│   │   ├── batch-checker.ts  # 批次检查
│   │   └── validation-engine.ts # 主验证引擎
│   └── report/
│       ├── index.ts
│       └── report-generator.ts # 报告生成器
├── sample/                     # 示例数据
│   ├── cases.csv
│   ├── manifest.jsonl
│   ├── hashes.txt
│   ├── rules.yaml
│   └── (2024)*/              # 模拟卷宗目录
├── output/                     # 报告输出目录
├── dist/                       # 编译输出
├── package.json
├── tsconfig.json
└── README.md
```

## 错误码说明

| 退出码 | 说明 |
|--------|------|
| 0 | 校验通过（无错误，可能有警告/提示） |
| 1 | 校验不通过（存在错误） |

## License

MIT
