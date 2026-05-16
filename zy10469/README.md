# Proto 兼容性检查 CLI 工具

用于检查 gRPC Proto 文件变更兼容性的命令行工具，重点检测字段编号复用等破坏性变更。

## 功能特性

- **Proto 解析**: 解析 .proto 文件，提取消息、枚举、服务和字段信息
- **快照管理**: 保存和加载历史版本快照，用于对比分析
- **兼容性检查**:
  - 字段编号复用检测 (FIELD_NUMBER_REUSED)
  - 字段编号变更检测 (FIELD_NUMBER_CHANGED)
  - 字段类型变更检测 (FIELD_TYPE_CHANGED)
  - 字段/消息/服务删除检测 (FIELD_REMOVED, MESSAGE_REMOVED 等)
  - 枚举值编号复用检测
  - 服务方法变更检测
- **多格式报告输出**:
  - 终端彩色摘要
  - 机器可读 JSON 报告
  - 人类可读 Markdown 报告
- **源码位置追踪**: 所有问题都能追溯到原文件的具体行号

## 安装

```bash
npm install
```

## 使用方法

### 1. 检查兼容性

首次运行会创建初始快照，后续运行会与上一个快照对比：

```bash
node src/cli.js check your-proto-file.proto
```

指定输出目录：

```bash
node src/cli.js check your-proto-file.proto -o ./output
```

与指定版本快照对比：

```bash
node src/cli.js check your-proto-file.proto -s v1
```

严格模式（警告也视为失败）：

```bash
node src/cli.js check your-proto-file.proto --strict
```

### 2. 快照管理

列出所有快照：

```bash
node src/cli.js snapshot list
```

创建指定版本快照：

```bash
node src/cli.js snapshot create your-proto-file.proto -v v2
```

删除快照：

```bash
node src/cli.js snapshot delete v1
```

### 3. 解析 Proto 文件

查看 Proto 文件结构：

```bash
node src/cli.js parse your-proto-file.proto
```

以 JSON 格式输出：

```bash
node src/cli.js parse your-proto-file.proto --json
```

## 输出目录结构

```
proto-compat-output/
├── snapshots/
│   ├── snapshot-v1.json
│   ├── snapshot-v2.json
│   └── latest.json
├── report.json    # 机器可读的 JSON 报告
└── report.md     # 人类可读的 Markdown 报告
```

## 问题代码说明

### 错误 (ERROR) - 破坏性变更
- `FIELD_NUMBER_REUSED`: 字段编号被复用
- `FIELD_NUMBER_CHANGED`: 字段编号被改变
- `FIELD_TYPE_CHANGED`: 字段类型被改变
- `ENUM_VALUE_NUMBER_REUSED`: 枚举值编号被复用
- `METHOD_INPUT_CHANGED`: 方法输入类型被改变
- `METHOD_OUTPUT_CHANGED`: 方法输出类型被改变

### 警告 (WARNING) - 潜在破坏
- `FIELD_REMOVED`: 字段被删除
- `MESSAGE_REMOVED`: 消息被删除
- `ENUM_REMOVED`: 枚举被删除
- `METHOD_REMOVED`: 方法被删除
- `SERVICE_REMOVED`: 服务被删除
- `FIELD_REPEATED_CHANGED`: repeated 属性被改变

### 信息 (INFO) - 新增内容
- `MESSAGE_ADDED`: 新增消息
- `FIELD_ADDED`: 新增字段
- `ENUM_ADDED`: 新增枚举
- `ENUM_VALUE_ADDED`: 新增枚举值
- `SERVICE_ADDED`: 新增服务
- `METHOD_ADDED`: 新增方法
- `FIRST_SNAPSHOT`: 首次运行创建快照

## API 使用

也可以作为 Node.js 库使用：

```javascript
const { ProtoParser, SnapshotManager, CompatibilityChecker, ReportGenerator } = require('./src');

// 解析 Proto 文件
const parser = new ProtoParser();
const data = parser.parse('your-file.proto');

// 创建快照
const snapshotManager = new SnapshotManager('./output');
const snapshot = snapshotManager.createSnapshot(data, 'v1');

// 检查兼容性
const checker = new CompatibilityChecker();
const oldSnapshot = snapshotManager.loadSnapshot('v1');
const newData = parser.parse('new-file.proto');
const result = checker.check(oldSnapshot, newData);

// 生成报告
const reportGenerator = new ReportGenerator('./output');
reportGenerator.generateConsoleSummary(result);
reportGenerator.generateJsonReport(result, newData, oldSnapshot);
reportGenerator.generateMarkdownReport(result, newData, oldSnapshot);
```

## 示例

```bash
# 首次运行，创建快照
node src/cli.js check test-v1.proto

# 修改 proto 文件后再次检查
node src/cli.js check test-v2.proto

# 查看生成的报告
cat proto-compat-output/report.md
```
