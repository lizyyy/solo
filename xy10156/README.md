# 测试覆盖证据映射 CLI (TCM)

一个本地测试覆盖证据映射工具，用于解决需求评审中"需求已经测过，但用例、代码路径和报告对不上"的问题。

## 功能特性

- **需求导入**：从 JSON 文件导入需求数据，支持重复导入和冲突处理
- **用例映射**：将测试用例映射到需求，自动验证关联关系
- **源码路径索引**：扫描源码文件，提取函数信息，关联测试用例
- **覆盖缺口分析**：识别未覆盖的需求、失败的测试用例和未关联的代码路径
- **证据报告生成**：生成 JSON、HTML、Markdown 格式的证据报告
- **失败项留痕**：记录所有操作失败，支持追溯和分析

## 快速开始

### 安装依赖

```bash
npm install
```

### 链接到全局命令（可选）

```bash
npm link
```

## 验收流程

### 1. 查看帮助信息

```bash
node bin/tcm.js --help
```

预期输出：显示所有可用命令和选项

### 2. 导入需求数据

```bash
node bin/tcm.js import:requirements examples/requirements.json -v
```

**预期结果：**
- ✓ 配置文件加载成功
- ✓ 需求导入完成
- 显示导入统计：新增 5，更新 0，重复 0，总计 5
- 显示 5 个需求的详细列表

### 3. 测试重复导入（可选）

```bash
node bin/tcm.js import:requirements examples/requirements.json
```

**预期结果：**
- 显示重复项统计
- 默认跳过重复项，不更新现有数据

### 4. 测试覆盖导入（可选）

```bash
node bin/tcm.js import:requirements examples/requirements.json --overwrite
```

**预期结果：**
- 更新已存在的需求数据

### 5. 映射测试用例

```bash
node bin/tcm.js map:testcases examples/test-cases.json -v
```

**预期结果：**
- ✓ 测试用例映射完成
- 显示映射统计：新增 7，更新 0，重复 0，总计 7
- 显示需求覆盖统计：已覆盖需求 4，未覆盖需求 1，覆盖率 80.00%
- 显示 7 个测试用例的详细列表

### 6. 索引源码路径

```bash
node bin/tcm.js index:code -v
```

**预期结果：**
- ✓ 源码路径索引完成
- 显示索引统计：扫描文件、代码路径、已关联、未关联等

### 7. 分析覆盖缺口

```bash
node bin/tcm.js analyze:gaps
```

**预期结果：**
- ✓ 覆盖缺口分析完成
- 显示分析统计：总缺口数、严重、中等、轻微
- 显示需求覆盖统计
- 显示缺口详情（按严重程度分类）

### 8. 生成证据报告

```bash
node bin/tcm.js report:generate -f all
```

**预期结果：**
- ✓ 证据报告生成完成
- 显示报告统计
- 生成 3 个报告文件：
  - `reports/evidence-report-*.json`
  - `reports/evidence-report-*.html`
  - `reports/evidence-report-*.md`

### 9. 查看失败项记录

```bash
node bin/tcm.js failures:list
```

**预期结果：**
- 如果没有失败：显示"没有失败项记录"
- 如果有失败：显示失败项统计和详情

### 10. 一键运行完整流程

```bash
node bin/tcm.js run:all examples/requirements.json examples/test-cases.json -f all -v
```

**预期结果：**
- 依次执行：导入需求 → 映射用例 → 索引代码 → 分析缺口 → 生成报告
- 显示每个步骤的执行结果
- 最后生成完整的证据报告

## 命令详解

### 需求导入

```bash
node bin/tcm.js import:requirements <file> [options]
```

**参数：**
- `<file>`: 需求数据文件路径（JSON 格式）

**选项：**
- `-o, --overwrite`: 覆盖已存在的需求
- `--no-skip-duplicates`: 不跳过重复项，更新已存在的需求
- `-v, --verbose`: 显示详细信息

**数据格式：**
```json
[
  {
    "id": "REQ-001",
    "title": "需求标题",
    "description": "需求描述",
    "status": "active",
    "tags": ["tag1", "tag2"]
  }
]
```

### 测试用例映射

```bash
node bin/tcm.js map:testcases <file> [options]
```

**参数：**
- `<file>`: 测试用例数据文件路径（JSON 格式）

**选项：**
- `-o, --overwrite`: 覆盖已存在的测试用例
- `--no-skip-duplicates`: 不跳过重复项，更新已存在的测试用例
- `-v, --verbose`: 显示详细信息

**数据格式：**
```json
[
  {
    "id": "TC-001",
    "title": "测试用例标题",
    "description": "测试用例描述",
    "requirements": ["REQ-001"],
    "codePaths": ["authService.js:login"],
    "status": "passed",
    "lastRun": "2026-05-09T10:30:00Z"
  }
]
```

### 源码路径索引

```bash
node bin/tcm.js index:code [options]
```

**选项：**
- `-v, --verbose`: 显示详细信息

**说明：**
- 根据配置文件中的 `paths.sourceCode` 模式扫描源码文件
- 提取文件中的函数和类定义
- 自动关联测试用例中指定的代码路径

### 覆盖缺口分析

```bash
node bin/tcm.js analyze:gaps [options]
```

**选项：**
- `-l, --limit <number>`: 限制显示的缺口数量（默认 10）

**分析内容：**
- 未覆盖的需求（严重）
- 失败的测试用例（严重）
- 待执行的测试用例（中等）
- 未关联测试用例的代码路径（中等）
- 无效的需求关联（轻微）
- 无效的代码路径关联（轻微）

### 证据报告生成

```bash
node bin/tcm.js report:generate [options]
```

**选项：**
- `-f, --format <format>`: 报告格式，可选：`json`, `html`, `markdown`, `all`（默认 json）

**报告内容：**
- 项目信息和生成时间
- 统计概览（需求覆盖率、测试通过率等）
- 关键发现
- 证据映射详情（需求 → 测试用例 → 代码路径）

### 失败项查看

```bash
node bin/tcm.js failures:list [options]
```

**选项：**
- `-t, --type <type>`: 按失败类型过滤
- `-r, --related-id <id>`: 按相关 ID 过滤
- `-l, --limit <number>`: 限制显示的数量

**失败类型：**
- `import_error`: 导入错误
- `parse_error`: 解析错误
- `format_error`: 格式错误
- `validation_error`: 验证错误
- `index_error`: 索引错误
- `unexpected_error`: 未知错误

### 完整流程

```bash
node bin/tcm.js run:all <requirementsFile> <testCasesFile> [options]
```

**参数：**
- `<requirementsFile>`: 需求数据文件路径
- `<testCasesFile>`: 测试用例数据文件路径

**选项：**
- `-f, --format <format>`: 报告格式（默认 all）
- `-v, --verbose`: 显示详细信息

**执行顺序：**
1. 导入需求数据
2. 映射测试用例
3. 索引源码路径（非关键步骤，失败不中断）
4. 分析覆盖缺口
5. 生成证据报告

## 配置文件

默认配置文件：`config.json`

```json
{
  "project": {
    "name": "项目名称",
    "description": "项目描述"
  },
  "paths": {
    "requirements": "./data/requirements.json",
    "testCases": "./data/test-cases.json",
    "sourceCode": ["./src/**/*.js"],
    "coverage": "./data/coverage.json",
    "output": "./reports"
  },
  "mappings": {
    "autoMatch": true,
    "caseSensitive": false
  }
}
```

**配置项说明：**
- `project`: 项目信息
- `paths.requirements`: 需求数据存储路径
- `paths.testCases`: 测试用例数据存储路径
- `paths.sourceCode`: 源码文件匹配模式数组
- `paths.coverage`: 覆盖数据存储路径
- `paths.output`: 报告输出目录
- `mappings.autoMatch`: 是否自动匹配测试用例和代码路径
- `mappings.caseSensitive`: 匹配时是否区分大小写

## 项目结构

```
.
├── bin/
│   └── tcm.js              # CLI 入口
├── src/
│   ├── commands/           # 命令实现
│   │   ├── importRequirements.js
│   │   ├── mapTestCases.js
│   │   ├── indexCode.js
│   │   ├── analyzeGaps.js
│   │   ├── generateReport.js
│   │   └── listFailures.js
│   ├── dataStore.js        # 数据存储管理
│   └── types.js            # 类型定义
├── examples/
│   ├── requirements.json   # 示例需求数据
│   ├── test-cases.json     # 示例测试用例
│   └── src/                # 示例源码
├── data/                   # 数据存储目录（自动创建）
├── reports/                # 报告输出目录（自动创建）
├── config.json             # 配置文件
├── config.example.json     # 配置示例
├── package.json
└── README.md
```

## 测试场景

### 场景 1：正常流程

1. 准备有效的需求和测试用例数据
2. 依次执行所有命令
3. 验证所有步骤成功完成
4. 检查生成的报告内容

### 场景 2：坏数据处理

1. 创建包含语法错误的 JSON 文件
2. 尝试导入
3. 验证错误提示清晰
4. 检查失败项记录

### 场景 3：重复导入

1. 导入同一数据两次
2. 验证第一次显示新增
3. 验证第二次显示重复
4. 使用 `--overwrite` 验证更新

### 场景 4：配置变化

1. 修改配置文件中的源码路径
2. 重新执行索引
3. 验证扫描范围变化
4. 检查新的覆盖数据

## 许可证

MIT
