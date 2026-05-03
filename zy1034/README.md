# File Archiver - 文件归档工具

一个强大的命令行工具，用于整理杂乱的下载目录。支持预演预览、执行归档、一键撤销，以及生成详细报告。

## 功能特性

- **预演模式**: 默认预览所有操作，不实际移动文件
- **规则驱动**: 通过 YAML/JSON 规则文件定义归档策略
- **灵活匹配**: 支持扩展名、关键词、文件大小、时间范围等多维度匹配
- **冲突处理**: 提供 rename/skip/error 三种冲突处理策略
- **重复检测**: 基于哈希值识别重复文件
- **可撤销操作**: 生成 manifest 文件，支持一键撤销
- **多格式报告**: 支持 JSON、Markdown、HTML 格式报告

## 安装

```bash
# 克隆项目
git clone <repository-url>
cd file-archiver

# 安装依赖
npm install

# 构建项目
npm run build

# 安装为全局命令
npm install -g .
```

## 快速开始

### 1. 查看示例规则

查看 `examples/rules.yaml` 了解规则文件格式：

```yaml
version: "1.0"
defaultConflictStrategy: rename
defaultOperation: move

rules:
  - name: "PDF文档"
    condition:
      extensions:
        - pdf
    destination: "./Documents/PDF"
    priority: 10

  - name: "图片文件"
    condition:
      extensions:
        - png
        - jpg
        - jpeg
    destination: "./Images"
    priority: 5
```

### 2. 使用示例文件测试

```bash
# 扫描示例下载目录（预演模式）
file-archiver scan examples/sample_downloads examples/rules.yaml

# 或者使用 run 命令（默认 dry-run）
file-archiver run examples/sample_downloads examples/rules.yaml
```

### 3. 真正执行归档

```bash
# 使用 --force 参数强制执行
file-archiver run examples/sample_downloads examples/rules.yaml \
  --force \
  --manifest ./manifest.json
```

### 4. 撤销操作

```bash
# 撤销之前的归档
file-archiver undo ./manifest.json
```

### 5. 生成报告

```bash
# 扫描时生成 HTML 报告
file-archiver scan examples/sample_downloads examples/rules.yaml \
  --report html \
  --output ./scan_report.html

# 执行时生成 Markdown 报告
file-archiver run examples/sample_downloads examples/rules.yaml \
  --force \
  --report markdown \
  --report-output ./execution_report.md
```

## 命令详解

### `scan` - 扫描并预览

扫描目录并预览将执行的操作（dry-run 模式）。

```bash
file-archiver scan <directory> <rules> [options]
```

**参数:**
- `directory`: 要扫描的目录路径
- `rules`: 规则文件路径（YAML 或 JSON）

**选项:**
- `--hash, -H`: 计算文件哈希用于检测重复（默认: false）
- `--report, -r`: 生成报告格式 [json, markdown, html]
- `--output, -o`: 报告输出路径
- `--verbose, -v`: 显示详细信息

### `run` - 执行归档

执行文件归档操作（默认 dry-run）。

```bash
file-archiver run <directory> <rules> [options]
```

**参数:**
- `directory`: 要归档的目录路径
- `rules`: 规则文件路径（YAML 或 JSON）

**选项:**
- `--dry-run, -d`: 预览操作而不实际执行（默认: true）
- `--force, -f`: 强制执行（禁用 dry-run）
- `--operation, -o`: 操作类型 [move, copy]（默认: move）
- `--conflict, -c`: 冲突处理策略 [rename, skip, error]（默认: rename）
- `--manifest, -m`: Manifest 输出路径
- `--hash, -H`: 计算文件哈希（默认: true）
- `--report, -r`: 生成报告格式 [json, markdown, html]
- `--report-output, -R`: 报告输出路径
- `--verbose, -v`: 显示详细信息

### `undo` - 撤销归档

撤销之前的归档操作。

```bash
file-archiver undo <manifest> [options]
```

**参数:**
- `manifest`: Manifest 文件路径

**选项:**
- `--dry-run, -d`: 预览操作而不实际执行
- `--report, -r`: 生成报告格式 [json, markdown, html]
- `--output, -o`: 报告输出路径
- `--verbose, -v`: 显示详细信息

### `report` - 生成报告

从 manifest 或扫描结果生成报告。

```bash
file-archiver report <type> <input> [options]
```

**参数:**
- `type`: 报告类型 [manifest, scan]
- `input`: 输入文件路径

**选项:**
- `--format, -f`: 报告格式 [json, markdown, html]（默认: markdown）
- `--output, -o`: 输出路径

## 规则文件格式

### 基础结构

```yaml
version: "1.0"
defaultConflictStrategy: rename
defaultOperation: move
excludePatterns:
  - "node_modules/**"
  - "*.tmp"

rules:
  - name: "规则名称"
    description: "规则描述"
    condition:
      # 匹配条件
    destination: "./目标目录"
    priority: 10
```

### 规则条件

规则支持以下匹配条件，可以组合使用：

**1. 扩展名匹配**
```yaml
condition:
  extensions:
    - pdf
    - doc
    - docx
```

**2. 关键词匹配**
```yaml
condition:
  keywords:
    - invoice
    - 发票
    - receipt
```

**3. 文件大小匹配**
```yaml
condition:
  minSize: 102400      # 最小 100KB
  maxSize: 104857600    # 最大 100MB
```

**4. 时间范围匹配**
```yaml
condition:
  modifiedAfter: "2024-01-01T00:00:00Z"   # 修改时间在 2024 年之后
  modifiedBefore: "2023-01-01T00:00:00Z"  # 修改时间在 2023 年之前
  createdAfter: "2024-01-01T00:00:00Z"    # 创建时间在 2024 年之后
  createdBefore: "2023-01-01T00:00:00Z"   # 创建时间在 2023 年之前
```

### 多条件组合

条件之间是 AND 关系，所有条件都满足才匹配：

```yaml
- name: "大发票PDF"
  condition:
    extensions:
      - pdf
    keywords:
      - invoice
    minSize: 1048576    # 大于 1MB
  destination: "./LargeInvoices"
  priority: 20
```

### 规则优先级

- 优先级数字越大，规则越先匹配
- 相同优先级按定义顺序匹配
- 文件匹配第一个规则后停止匹配

## 冲突处理策略

当目标目录已存在同名文件时，支持以下策略：

### `rename`（默认）

自动重命名新文件：
- `document.pdf` → `document_1.pdf`
- `document_1.pdf` → `document_2.pdf`

### `skip`

跳过冲突文件，不移动。

### `error`

遇到冲突时报错，终止操作。

## Manifest 文件

每次执行归档时，可以生成 manifest 文件，记录所有操作详情：

```json
{
  "id": "manifest_1714647600000_abc123",
  "timestamp": "2024-05-02T12:00:00.000Z",
  "sourceDirectory": "/path/to/Downloads",
  "operationType": "move",
  "totalFiles": 5,
  "entries": [
    {
      "originalPath": "/path/to/Downloads/invoice.pdf",
      "newPath": "/path/to/Downloads/Documents/PDF/invoice.pdf",
      "operationType": "move",
      "timestamp": "2024-05-02T12:00:00.000Z",
      "fileSize": 102400,
      "hash": "sha256-hash-value",
      "ruleName": "PDF文档",
      "status": "success"
    }
  ]
}
```

## API 使用

除了命令行，也可以作为 Node.js 库使用：

```typescript
import { RuleParser, FileScanner, FileExecutor, ReportGenerator } from 'file-archiver';

// 解析规则文件
const parser = new RuleParser();
const config = await parser.parseFile('./rules.yaml');

// 扫描目录
const scanner = new FileScanner(config);
const scanResult = await scanner.scan('./Downloads', {
  calculateHash: true,
  verbose: false
});

// 执行归档
const executor = new FileExecutor(scanner);
const result = await executor.execute('./Downloads', {
  dryRun: false,
  operation: 'move',
  conflictStrategy: 'rename',
  calculateHash: true,
  verbose: false
});

// 生成报告
const reportGenerator = new ReportGenerator();
await reportGenerator.generate({
  type: 'execution',
  timestamp: new Date().toISOString(),
  executionResult: result
}, 'html', './report.html');
```

## 开发

```bash
# 安装依赖
npm install

# 开发模式运行
npm run dev -- scan ./examples/sample_downloads ./examples/rules.yaml

# 运行测试
npm test

# 持续测试
npm run test:watch

# 构建
npm run build
```

## 项目结构

```
file-archiver/
├── src/
│   ├── types.ts              # TypeScript 类型定义
│   ├── cli.ts                # CLI 入口
│   ├── rules/
│   │   ├── index.ts
│   │   ├── parser.ts         # 规则解析器
│   │   ├── matcher.ts        # 规则匹配器
│   │   ├── parser.test.ts
│   │   └── matcher.test.ts
│   ├── scanner/
│   │   └── index.ts          # 文件扫描器
│   ├── executor/
│   │   └── index.ts          # 操作执行器
│   ├── undo/
│   │   └── index.ts          # 撤销管理器
│   ├── report/
│   │   └── index.ts          # 报告生成器
│   └── integration.test.ts   # 集成测试
├── examples/
│   ├── rules.yaml            # 示例规则文件
│   └── sample_downloads/     # 示例文件
├── dist/                     # 构建输出
├── package.json
├── tsconfig.json
├── jest.config.js
└── README.md
```

## License

MIT
