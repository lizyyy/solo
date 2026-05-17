# Terraform 变量使用分析 CLI

一个用于分析Terraform项目中变量使用情况的命令行工具，能够检测未使用的变量、缺失默认值的变量，以及保留解析错误（脏数据）。

## 功能特性

- ✅ **变量定义解析**: 自动提取所有 `.tf` 和 `.tfvars` 文件中的变量定义
- ✅ **引用追踪**: 检测变量在代码中的使用情况
- ✅ **未使用变量检测**: 识别已定义但从未被引用的变量
- ✅ **默认值校验**: 检查已使用但缺少默认值的变量
- ✅ **未定义引用检测**: 发现被引用但未定义的变量
- ✅ **脏数据保留**: 完整保留解析错误的原始位置和内容
- ✅ **多格式输出**: 终端摘要、JSON、Markdown报告

## 快速开始

```bash
# 分析目录
python tfvars_report.py ./terraform

# 分析指定文件
python tfvars_report.py main.tf variables.tf

# 输出JSON结果
python tfvars_report.py . --json result.json

# 生成Markdown报告
python tfvars_report.py . --report report.md

# 输出所有格式
python tfvars_report.py . --all
```

## 命令行选项

```
python tfvars_report.py [-h] [--json JSON] [--report REPORT] [--all] [--output-dir OUTPUT_DIR] paths [paths ...]

位置参数:
  paths                  Terraform文件或目录路径（支持多个）

可选参数:
  -h, --help             显示帮助信息
  --json JSON            输出JSON结果到指定文件
  --report REPORT        输出Markdown报告到指定文件
  --all                  输出所有格式（终端、JSON、Markdown）
  --output-dir OUTPUT_DIR  输出目录（默认为当前目录）
```

## 退出码

- `0`: 分析完成，没有发现任何问题
- `1`: 存在问题（未使用变量、缺少默认值、解析错误等）

## 输出示例

### 终端输出

```
============================================================
           Terraform Variable Usage Report
============================================================

Summary:
  Total variables:      8
  Used variables:       5
  Unused variables:     3
  With default value:   8
  Without default:      0
  Undefined but used:   0
  Total issues:         3
  Parse errors:         0

Variable issues:
  * unused_var - defined but never used
    Location: test-normal/variables.tf:31

Unused variables:
  - unused_var (test-normal/variables.tf:31)
```

### JSON输出 (`tfvars-result.json`)

```json
{
  "summary": {
    "total_variables": 8,
    "used_variables": 5,
    "unused_variables": 3,
    "total_issues": 3,
    "total_errors": 0
  },
  "variables": { ... },
  "errors": [],
  "issues": [],
  "generated_at": "2026-05-17T11:32:00"
}
```

## 测试目录说明

- `test-normal/`: 包含正常的Terraform配置，用于验证基本功能
- `test-dirty/`: 包含语法错误和脏数据，用于验证错误保留机制

## 验收测试

```bash
# 测试1: 正常输入 - 应该检测到3个未使用变量，退出码应为1
python tfvars_report.py test-normal
echo "退出码: $?"

# 测试2: 带脏数据的输入 - 应该保留错误位置
python tfvars_report.py test-dirty
echo "退出码: $?"

# 测试3: 输出所有格式
python tfvars_report.py test-normal --all
ls tfvars-result.json tfvars-report.md
```

## 核心机制

1. **HCL解析**: 使用正则表达式匹配 `variable` 块和 `var.` 引用模式
2. **引用追踪**: 遍历所有文件收集变量引用，记录精确的行号列号
3. **分析逻辑**:
   - 已定义但未引用 → 未使用变量
   - 已引用但未定义 → 未定义引用
   - 已使用但缺少default → 默认值缺失
4. **错误处理**: 解析过程中的异常会被捕获，保留原始内容和位置
5. **报告生成**: 按严重程度分类展示，包含完整的溯源信息

## 项目文件

```
.
├── tfvars_report.py     # CLI工具主程序
├── test-normal/         # 正常测试用例
│   ├── main.tf
│   └── variables.tf
├── test-dirty/          # 脏数据测试用例
│   ├── main.tf
│   └── variables.tf
└── README.md            # 本文件
```
