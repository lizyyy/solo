# 庭审证据时间线核对器

一个用于诉讼助理的本地命令行工具，帮助在开庭前核对庭审证据时间线。

## 功能特性

- **材料导入**: 支持导入多种格式的材料文件
  - CSV: 证据目录
  - JSON: 聊天记录导出
  - YAML: 关键日期备忘
  - TXT: 庭审笔录草稿

- **规则检查**: 自动检测多种问题
  - **证据缺失**: 检查庭审笔录中引用的证据是否在证据目录中存在
  - **时间冲突**: 检查事件时间是否存在前后矛盾
  - **未脱敏字段**: 检测身份证号、手机号、银行卡号、邮箱、地址等敏感信息
  - **重复引用**: 检查证据是否被重复引用或引用格式不一致

- **时间线生成**: 生成按角色分组的事件时间轴

- **报告导出**: 支持多种格式导出
  - **Markdown**: 完整的摘要报告
  - **CSV**: 问题清单和时间线
  - **JSON**: 完整的审计数据包

## 项目结构

```
evidence-timeline-checker/
├── evidence_timeline/
│   ├── __init__.py
│   ├── cli.py                    # CLI主程序
│   ├── parsers/                  # 解析模块
│   │   ├── __init__.py
│   │   ├── base_parser.py        # 解析器基类
│   │   ├── csv_parser.py         # CSV解析器（证据目录）
│   │   ├── json_parser.py        # JSON解析器（聊天记录）
│   │   ├── yaml_parser.py        # YAML解析器（关键日期）
│   │   └── txt_parser.py         # TXT解析器（庭审笔录）
│   ├── rules/                    # 规则模块
│   │   ├── __init__.py
│   │   ├── base_rule.py          # 规则基类
│   │   ├── evidence_missing_rule.py    # 证据缺失检查
│   │   ├── time_conflict_rule.py       # 时间冲突检查
│   │   ├── unmasked_rule.py            # 未脱敏检查
│   │   └── duplicate_reference_rule.py # 重复引用检查
│   ├── masking/                  # 脱敏模块
│   │   ├── __init__.py
│   │   └── masker.py             # 脱敏处理器
│   ├── storage/                  # 存储模块
│   │   ├── __init__.py
│   │   └── data_store.py         # 数据存储器
│   └── exporters/                # 导出模块
│       ├── __init__.py
│       ├── md_exporter.py        # Markdown导出器
│       ├── csv_exporter.py       # CSV导出器
│       └── json_exporter.py      # JSON导出器
├── examples/                     # 示例数据
│   ├── evidence_directory.csv    # 证据目录示例
│   ├── chat_records.json         # 聊天记录示例
│   ├── key_dates.yaml            # 关键日期示例
│   └── trial_transcript.txt      # 庭审笔录示例
├── requirements.txt
├── setup.py
└── README.md
```

## 安装

1. 克隆或下载项目到本地

2. 安装依赖：

```bash
pip install -r requirements.txt
```

3. 安装项目（可选，用于全局使用）：

```bash
pip install -e .
```

## 使用方法

### 基本命令

查看帮助：

```bash
# 如果安装了项目
evidence-checker --help

# 或者直接运行
python -m evidence_timeline.cli --help
```

### 1. 导入材料

导入一个或多个材料文件：

```bash
evidence-checker import examples/evidence_directory.csv examples/chat_records.json examples/key_dates.yaml examples/trial_transcript.txt
```

支持的文件格式：
- `.csv`: 证据目录
- `.json`: 聊天记录
- `.yaml` / `.yml`: 关键日期备忘
- `.txt`: 庭审笔录

### 2. 执行检查

运行所有检查规则：

```bash
evidence-checker check
```

检查内容包括：
- 证据缺失检查
- 时间冲突检查
- 未脱敏字段检查
- 重复引用检查

### 3. 生成时间线

生成按角色分组的事件时间轴：

```bash
evidence-checker timeline
```

### 4. 导出报告

导出所有格式的报告：

```bash
evidence-checker report output/
```

指定导出格式：

```bash
evidence-checker report output/ -f md -f csv
```

### 5. 查看统计信息

查看当前数据的统计信息：

```bash
evidence-checker stats
```

### 6. 保存和加载状态

保存当前状态：

```bash
evidence-checker save state.json
```

加载状态（使用 --storage 选项）：

```bash
evidence-checker --storage state.json stats
```

### 7. 清空数据

清空所有数据：

```bash
evidence-checker clear
```

## 完整流程示例

使用示例数据验证完整流程：

```bash
# 1. 安装依赖
pip install -r requirements.txt
pip install -e .

# 2. 导入所有示例材料
evidence-checker import \
    examples/evidence_directory.csv \
    examples/chat_records.json \
    examples/key_dates.yaml \
    examples/trial_transcript.txt

# 3. 执行检查（会发现多个问题）
evidence-checker check

# 4. 生成时间线
evidence-checker timeline

# 5. 导出报告
evidence-checker report output/

# 6. 查看统计信息
evidence-checker stats
```

## 示例数据说明

`examples/` 目录包含测试用的示例数据，这些数据特意包含了一些问题，用于测试检查功能：

### evidence_directory.csv（证据目录）
- 包含 5 条证据（E001-E005）

### chat_records.json（聊天记录）
- 包含未脱敏的身份证号、手机号、地址、银行卡号、邮箱
- 按角色（原告、被告、证人）分组

### key_dates.yaml（关键日期备忘）
- 包含 6 个关键事件
- 按角色分组

### trial_transcript.txt（庭审笔录）
- 引用了不存在的证据 E006（测试证据缺失检查）
- 重复引用 E001（测试重复引用检查）
- 包含时间冲突（合同日期不一致）
- 包含多处未脱敏的敏感信息（测试未脱敏检查）

## 数据格式规范

### 证据目录 CSV 格式

```csv
evidence_id,evidence_name,description,date,source,category
E001,证据名称,证据描述,2023-01-15,来源,类别
```

### 聊天记录 JSON 格式

```json
{
  "messages": [
    {
      "id": "msg_001",
      "sender": "发送者",
      "receiver": "接收者",
      "content": "消息内容",
      "timestamp": "2023-01-10 10:30:00",
      "role": "角色"
    }
  ]
}
```

### 关键日期 YAML 格式

```yaml
events:
  - id: event_001
    date: "2023-01-10"
    title: "事件标题"
    description: "事件描述"
    role: "角色"
```

### 庭审笔录 TXT 格式

纯文本格式，程序会自动：
- 按段落分割
- 识别证据引用（如 E001, e002）
- 识别日期格式

## 敏感信息检测规则

当前支持检测以下敏感信息：

- **身份证号**: 18位或15位身份证号
- **手机号码**: 11位手机号（13x-19x开头）
- **银行卡号**: 16-19位银行卡号
- **电子邮箱**: 标准邮箱格式
- **地址信息**: 包含省、市、区、县等关键字的地址
- **姓名信息**: 包含先生、女士、当事人等称谓的姓名

## 依赖项

- `click>=8.0`: 命令行框架
- `pyyaml>=6.0`: YAML解析
- `python-dateutil>=2.8`: 日期解析

## 许可证

本项目仅供学习和工作使用。
