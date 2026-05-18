# 体检中心体检报告分发 CLI 工具

专为体检中心体检报告分发场景设计的命令行工具，支持批量处理、去重统计、撤回授权识别和错误汇总。

## 功能特性

- ✅ **可复跑（幂等性）**：同一批输入重复运行不会重复追加
- 👥 **同名员工统计**：自动识别并统计同名员工，便于人工核对
- ❌ **撤回授权识别**：自动标记已撤回授权的报告记录
- ⚠️ **格式错误分类**：按错误类型分类统计格式问题
- 📂 **批量处理**：支持整个目录批量处理CSV和JSON文件
- 🔄 **容错处理**：单个文件解析失败不影响其他文件处理

## 安装

```bash
npm install
npm run build
```

## 使用方法

### 处理体检报告数据

```bash
# 处理默认目录 samples，输出到 output
npm run test

# 或使用完整命令
node dist/cli.js process ./samples ./output
```

### 重置处理状态

```bash
# 重置状态，允许重新处理相同文件
node dist/cli.js reset ./output
```

### 查看统计信息

```bash
node dist/cli.js stats ./output
```

## 输入格式

### CSV 文件格式

```csv
employeeId,name,department,examinationDate,reportStatus,phone,email,clinicName,reportType,items
E001,张伟,技术部,2024-01-15,completed,13800138001,zhangwei@company.com,北京协和体检中心,年度体检,血常规、尿常规、肝功能
```

### 字段说明

| 字段 | 必需 | 说明 |
|------|------|------|
| employeeId | ✅ | 员工编号 |
| name | ✅ | 姓名 |
| department | ✅ | 部门 |
| examinationDate | ✅ | 体检日期 |
| reportStatus | - | 报告状态：completed/withdrawn |
| phone | - | 联系电话 |
| email | - | 电子邮箱 |
| clinicName | ✅ | 体检中心名称 |
| reportType | ✅ | 报告类型：年度体检/入职体检/健康证 |
| items | - | 体检项目列表 |

## 输出文件

处理完成后，输出目录将包含以下文件：

| 文件名 | 格式 | 说明 |
|--------|------|------|
| [distribution-list.csv](file:///Users/mac/pro/solo/workspaces/xy11145/output/distribution-list.csv) | CSV | 分发明细清单 |
| [parse-errors.csv](file:///Users/mac/pro/solo/workspaces/xy11145/output/parse-errors.csv) | CSV | 格式错误详情 |
| [duplicate-employees.csv](file:///Users/mac/pro/solo/workspaces/xy11145/output/duplicate-employees.csv) | CSV | 同名员工清单 |
| [withdrawn-records.csv](file:///Users/mac/pro/solo/workspaces/xy11145/output/withdrawn-records.csv) | CSV | 撤回授权记录 |
| [summary-report.md](file:///Users/mac/pro/solo/workspaces/xy11145/output/summary-report.md) | Markdown | 汇总统计报告 |

## 项目结构

```
.
├── src/
│   ├── cli.ts              # CLI入口
│   ├── processor.ts        # 核心处理器
│   ├── parser.ts           # 文件解析器
│   ├── reporter.ts         # 报告生成器
│   ├── idempotency.ts      # 幂等性管理器
│   └── types.ts            # 类型定义
├── samples/                # 样例数据
│   ├── clinic-2024-01.csv
│   ├── clinic-2024-02.csv
│   └── clinic-errors.csv   # 含错误数据的样例
├── output/                 # 输出目录
├── package.json
├── tsconfig.json
└── README.md
```

## 核心模块说明

### [types.ts](file:///Users/mac/pro/solo/workspaces/xy11145/src/types.ts)

定义了所有数据模型，包括：
- `MedicalReport` - 体检报告数据结构
- `DuplicateEmployee` - 同名员工统计
- `WithdrawnRecord` - 撤回授权记录
- `ParseError` - 解析错误信息
- `Statistics` - 汇总统计数据

### [parser.ts](file:///Users/mac/pro/solo/workspaces/xy11145/src/parser.ts)

文件解析器，支持CSV和JSON格式，包含字段验证逻辑。

### [idempotency.ts](file:///Users/mac/pro/solo/workspaces/xy11145/src/idempotency.ts)

幂等性管理器，通过文件哈希和记录ID确保重复运行不会产生重复数据。

### [reporter.ts](file:///Users/mac/pro/solo/workspaces/xy11145/src/reporter.ts)

报告生成器，负责统计分析和多格式输出。

### [processor.ts](file:///Users/mac/pro/solo/workspaces/xy11145/src/processor.ts)

核心处理器，协调解析、去重、统计和输出流程。

## 测试样例说明

samples目录包含三类样例数据：

1. **clinic-2024-01.csv** - 正常数据，包含2条同名"张伟"和2条撤回授权
2. **clinic-2024-02.csv** - 正常数据，新增1条"张伟"和1条同名"杨洋"
3. **clinic-errors.csv** - 包含多种格式错误，用于测试错误处理

## License

MIT
