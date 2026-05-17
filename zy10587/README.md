# Excel Formula Linter

Excel 公式引用检查 CLI 工具 - 检测跨工作表引用错误，确保多人维护的 Excel 模板公式引用完整有效。

## ✨ 功能特性

- 🔍 **公式解析** - 自动识别和解析 Excel 中的所有公式
- 📊 **引用校验** - 验证单元格引用和范围引用的有效性
- 🔗 **跨表追踪** - 检测跨工作表引用是否存在
- 🎯 **错误定位** - 精确定位错误位置和原因
- 📋 **多格式报告** - 输出终端摘要、JSON、HTML、CSV 格式报告
- 🔄 **结果可重复** - 按时间戳生成独立报告文件，不覆盖旧结果

## 📦 安装

```bash
npm install
```

## 🚀 快速开始

### 1. 生成测试数据（可选）

```bash
node test/generate-test-data.js
```

### 2. 检查 Excel 文件

```bash
# 检查单个文件
node src/cli.js check test/test-data.xlsx

# 检查多个文件
node src/cli.js check file1.xlsx file2.xlsx

# 使用通配符
node src/cli.js check *.xlsx

# 检查整个目录
node src/cli.js check ./data/
```

## 📖 使用说明

### 基本命令

```bash
# 检查公式引用（默认命令）
node src/cli.js check <files...> [options]

# 列出所有公式
node src/cli.js list <file>

# 查看支持的错误类型
node src/cli.js error-types

# 查看帮助
node src/cli.js --help
```

### 选项

| 选项 | 说明 | 默认值 |
|------|------|--------|
| `-o, --output <dir>` | 报告输出目录 | `./reports` |
| `-n, --name <name>` | 报告文件名前缀 | `formula-check` |
| `--no-console` | 不输出终端摘要 | - |
| `--no-json` | 不生成 JSON 报告 | - |
| `--no-html` | 不生成 HTML 报告 | - |
| `--no-csv` | 不生成 CSV 报告 | - |
| `--strict` | 严格模式，发现错误时退出码为 1 | - |

### 示例

```bash
# 指定输出目录
node src/cli.js check test.xlsx -o ./my-reports

# 只生成 HTML 报告
node src/cli.js check test.xlsx --no-json --no-csv

# 严格模式（用于 CI/CD）
node src/cli.js check test.xlsx --strict
```

## ❌ 支持的错误类型

| 错误类型 | 说明 |
|----------|------|
| `SHEET_NOT_FOUND` | 引用的工作表不存在 |
| `CELL_OUT_OF_RANGE` | 单元格引用超出工作表范围 |
| `RANGE_OUT_OF_BOUNDS` | 范围引用超出工作表边界 |
| `INVALID_REFERENCE` | 无效的引用格式 |
| `EMPTY_SHEET_REFERENCE` | 空的工作表引用 |
| `CIRCULAR_REFERENCE` | 循环引用 |

## 📄 输出格式

### 1. 终端摘要

运行后在控制台显示：
- 检查摘要统计
- 错误类型分布
- 错误详情表格
- 处理汇总

### 2. JSON 报告

完整的机器可读 JSON 格式，包含：
- 元数据信息
- 检查摘要
- 各工作表详情
- 所有错误列表
- 公式和引用信息

### 3. HTML 报告

美观的 Web 格式报告，适合发给同事：
- 卡片式摘要展示
- 工作表列表
- 错误详情表格
- 彩色错误标签

### 4. CSV 报告

逗号分隔格式，适合导入 Excel 进一步分析。

## 📁 项目结构

```
.
├── src/
│   ├── cli.js              # CLI 入口文件
│   ├── formula-parser.js   # 公式解析器
│   ├── reference-validator.js  # 引用校验器
│   └── report-generator.js     # 报告生成器
├── test/
│   ├── generate-test-data.js   # 测试数据生成
│   └── test-data.xlsx          # 生成的测试文件
├── reports/                # 报告输出目录
├── package.json
└── README.md
```

## 🔧 核心模块说明

### FormulaParser

公式解析器，负责：
- 解析 Excel 公式中的跨表引用
- 识别单元格引用和范围引用
- 解析单元格地址格式
- 判断范围包含关系

### ReferenceValidator

引用校验器，负责：
- 加载工作簿和工作表
- 遍历所有公式单元格
- 验证引用的工作表是否存在
- 验证引用范围是否越界
- 收集和分类错误

### ReportGenerator

报告生成器，负责：
- 生成终端格式化输出
- 生成 JSON 格式报告
- 生成 HTML 格式报告
- 生成 CSV 格式报告

## 💡 使用场景

1. **模板发布前检查** - 确保新发布的 Excel 模板没有断链
2. **定期审计** - 定期检查多人协作的 Excel 文件
3. **版本更新验证** - 工作表重命名或删除后验证引用完整性
4. **CI/CD 集成** - 集成到自动化流程，严格模式检查

## 📝 注意事项

- 报告文件按时间戳命名，重复运行不会覆盖旧结果
- 支持 `.xlsx`, `.xls`, `.xlsm`, `.xlsb` 格式
- 大文件处理可能需要更长时间
- 仅检查跨表引用，不检查同一工作表内的引用

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License
