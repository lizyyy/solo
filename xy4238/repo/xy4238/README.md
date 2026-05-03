# 庭审笔录证据锚点核对员

本地命令行工具，用于核对庭审笔录中的证据锚点，帮助书记员避免证据号写错、引用页码缺失、同一段发言被重复锚定等问题。

## 功能特点

- ✅ **证据编号校验**：检查锚定的证据编号是否存在于证据目录
- 📄 **页码引用检查**：检测缺失的页码引用和无效的页码范围
- 🔄 **重复锚定检测**：识别同一发言段落中同一证据的重复锚定
- ⏱️ **时间码对齐**：验证时间码格式和一致性
- 📝 **报告导出**：生成 Markdown 差错报告和 CSV 修订清单

## 安装

### 环境要求

- Python 3.8+
- pip

### 安装步骤

```bash
# 1. 克隆或下载项目到本地
cd /path/to/xy4238

# 2. 安装依赖
pip install -r requirements.txt

# 3. 安装包（可选，用于全局命令）
pip install -e .
```

安装后，可以使用 `evidence-anchor` 命令行工具。

## 快速开始

### 使用命令流程

```
init → import → check → export
```

### 1. 生成示例文件

```bash
# 生成示例文件到 examples 目录
evidence-anchor init --output ./examples

# 或者生成包含错误的异常样例
evidence-anchor init --output ./examples --with-errors
```

### 2. 导入数据建立索引

```bash
cd examples/normal

# 导入三个文件并建立本地索引
evidence-anchor import \
  --timestamp timestamp.csv \
  --markdown transcript.md \
  --evidence evidence.json
```

### 3. 执行核对检查

```bash
# 简要检查
evidence-anchor check

# 显示详细错误信息
evidence-anchor check --detail
```

### 4. 导出检查报告

```bash
# 导出所有格式的报告
evidence-anchor export --output ./reports

# 只导出 Markdown
evidence-anchor export --output ./reports --format md

# 只导出 CSV
evidence-anchor export --output ./reports --format csv
```

## 文件格式说明

### 1. 时间码 CSV 文件

```csv
时间码,发言人,事件类型,描述,持续时间(秒)
00:05:30,审判长,开庭,宣布开庭,30
00:06:00,原告代理人,举证,提交证据1-5,120
00:08:00,被告代理人,质证,对证据1-3发表意见,90
```

**必填字段**：`时间码`, `发言人`, `事件类型`, `描述`

**可选字段**：`持续时间(秒)`

**时间码格式**：`HH:MM:SS`，如 `00:05:30`

### 2. 笔录 Markdown 文件

```markdown
[00:05:30]
【审判长】现在宣布开庭。

[00:06:00]
【原告代理人】现在开始举证。我方提交证1 第1页，证明双方存在合同关系。证2 第2-3页，证明原告已履行合同义务。
```

**格式说明**：
- 时间码：`[HH:MM:SS]` 格式单独一行
- 发言人：`【姓名】` 格式，后跟发言内容
- 证据锚定：`证X 第Y页` 或 `证X 第Y-Z页` 格式

**支持的证据锚定格式**：
| 格式 | 示例 | 说明 |
|------|------|------|
| `证X 第Y页` | `证1 第1页` | 单页引用 |
| `证X 第Y-Z页` | `证2 第2-3页` | 页码范围 |
| `X 第Y页` | `1 第1页` | 省略"证"字 |

### 3. 证据目录 JSON 文件

```json
{
  "证据目录": [
    {
      "证据编号": "证1",
      "证据名称": "合同书",
      "页数": 5,
      "提交方": "原告",
      "证据类型": "书证"
    }
  ]
}
```

**必填字段**：`证据编号`, `证据名称`, `页数`, `提交方`, `证据类型`

**可选字段**：`备注`

## 检查规则说明

### 1. 证据编号规则

- ✅ 有效格式：`证1`、`1`、`1-1`（子证据）
- ❌ 无效格式：`证-1`、`证A`、`12345`（超过4位）
- 检查：锚定的编号必须存在于证据目录中

### 2. 页码引用规则

- ✅ 有效格式：`第1页`、`第1-5页`
- ❌ 无效格式：`第-1页`、`第0页`、`第5-1页`（结束<起始）
- 检查：引用的页码不能超出该证据的总页数

### 3. 重复锚定规则

- 同一发言人同一段落中，同一证据编号只能出现一次
- 检测到重复时会标记为错误

### 4. 时间码规则

- ✅ 有效格式：`HH:MM:SS`
- ❌ 无效格式：`1:30`、`25:00:00`、`00:61:00`
- 检查：锚定的时间码必须存在于时间码CSV中

### 5. 发言人一致性规则

- 检查笔录中的发言人是否与时间码CSV中记录的一致

## 命令参考

### init - 生成示例文件

```bash
evidence-anchor init [OPTIONS]

选项：
  -o, --output PATH    示例文件输出目录 (默认: ./examples)
  -e, --with-errors    同时生成包含错误的异常样例
  --help               显示帮助信息
```

### import - 导入数据建立索引

```bash
evidence-anchor import [OPTIONS]

选项：
  -t, --timestamp PATH   时间码CSV文件路径 [必需]
  -m, --markdown PATH    笔录Markdown文件路径 [必需]
  -e, --evidence PATH    证据目录JSON文件路径 [必需]
  -f, --force            强制重建索引
  --help                 显示帮助信息
```

### check - 执行核对检查

```bash
evidence-anchor check [OPTIONS]

选项：
  -d, --detail   显示详细错误信息
  --help         显示帮助信息
```

### export - 导出检查报告

```bash
evidence-anchor export [OPTIONS]

选项：
  -o, --output PATH    报告输出目录 (默认: ./reports)
  -f, --format TEXT    输出格式: all/md/csv (默认: all)
  --help               显示帮助信息
```

**导出文件说明**：
| 文件名 | 说明 |
|--------|------|
| `error_report.md` | Markdown 格式的完整差错报告 |
| `revision_list.csv` | CSV 格式的修订清单，可直接使用 |
| `anchor_summary.csv` | CSV 格式的所有锚点汇总表 |

### status - 显示索引状态

```bash
evidence-anchor status
```

显示当前目录下索引的状态，包括证据数量、笔录段落数、锚点数量、上次检查结果等。

### clear - 清除本地索引

```bash
evidence-anchor clear
```

清除当前目录下的 `.evidence_index` 目录，删除所有已导入的数据。

## 使用示例

### 正常样例运行

```bash
# 1. 进入正常样例目录
cd examples/normal

# 2. 查看目录文件
ls
# timestamp.csv  transcript.md  evidence.json

# 3. 导入数据
evidence-anchor import -t timestamp.csv -m transcript.md -e evidence.json

# 4. 执行检查
evidence-anchor check

# 5. 导出报告
evidence-anchor export -o ./reports

# 6. 查看报告
ls reports/
# anchor_summary.csv  error_report.md  revision_list.csv
```

**预期结果**：正常样例应该只有少量警告或没有错误。

### 异常样例运行

```bash
# 1. 进入正常样例目录（使用异常笔录）
cd examples/normal

# 2. 导入时使用异常笔录
evidence-anchor import \
  -t timestamp.csv \
  -m ../abnormal/transcript_error.md \
  -e evidence.json \
  --force

# 3. 执行详细检查
evidence-anchor check --detail

# 4. 导出报告
evidence-anchor export -o ./error_reports
```

**预期检测到的错误**：
- 引用页码缺失（如 `证1` 没有 `第X页`）
- 证据编号不存在（如 `证99`）
- 同一证据重复锚定（同一 `证1` 出现多次）
- 证据编号格式无效（如 `证-1`）
- 页码超出范围（如 `第100页` 超出证据总页数）
- 时间码不存在于时间码列表
- 发言人不在时间码记录中

## 项目结构

```
xy4238/
├── evidence_anchor_checker/      # 主包目录
│   ├── __init__.py
│   ├── cli.py                    # CLI 主程序
│   ├── rules/                    # 规则模块
│   │   ├── __init__.py
│   │   └── validation_rules.py   # 校验规则定义
│   ├── parsers/                  # 解析器模块
│   │   ├── __init__.py
│   │   ├── csv_parser.py         # CSV 时间码解析
│   │   ├── markdown_parser.py    # Markdown 笔录解析
│   │   └── json_parser.py        # JSON 证据目录解析
│   ├── indexer/                  # 索引模块
│   │   ├── __init__.py
│   │   └── local_index.py        # 本地索引管理
│   └── reporter/                 # 报告模块
│       ├── __init__.py
│       ├── check_engine.py       # 核对引擎
│       └── report_generator.py   # 报告生成器
├── examples/                     # 示例文件
│   ├── normal/                   # 正常样例
│   │   ├── timestamp.csv
│   │   ├── transcript.md
│   │   └── evidence.json
│   └── abnormal/                 # 异常样例
│       └── transcript_error.md
├── requirements.txt              # 依赖列表
├── setup.py                      # 安装配置
└── README.md                     # 本文档
```

## 常见问题

### Q: 如何判断证据锚定格式是否正确？

**正确示例**：
```markdown
【原告代理人】提交证1 第3页，证明...
【被告代理人】对证2 第5-8页的真实性有异议...
```

**错误示例**：
```markdown
【原告代理人】提交证1，证明...           ← 缺少页码
【被告代理人】对证据二有异议...            ← 使用中文数字
```

### Q: 索引文件存储在哪里？

索引文件存储在当前工作目录下的 `.evidence_index/` 目录中，包含：
- `metadata.json` - 索引元数据
- `evidence_index.pkl` - 证据目录索引
- `transcript_index.pkl` - 笔录段落索引
- `timestamp_index.pkl` - 时间码索引
- `anchor_index.pkl` - 锚点索引
- `check_result.json` - 上次检查结果

### Q: 如何处理中文数字证据编号？

当前版本仅支持阿拉伯数字格式（如 `证1`），不支持中文数字（如 `证一`）。建议在笔录中统一使用阿拉伯数字。

### Q: 支持哪些证据编号格式？

- `证1` - 标准格式
- `1` - 省略"证"字
- `证1-1` - 子证据格式
- `1-1` - 省略"证"字的子证据

## 更新日志

### v1.0.0 (2026-05-03)

- 初始版本发布
- 实现 `init` 命令生成示例文件
- 实现 `import` 命令导入数据建立索引
- 实现 `check` 命令执行核对检查
- 实现 `export` 命令导出报告
- 实现 `status` 和 `clear` 辅助命令
- 支持证据编号、页码、重复锚定、时间码、发言人等多种校验规则

## 许可证

本工具仅供学习和内部使用。
