# 密码策略边界夹具失败理由排查CLI

用于验证密码策略边界条件的本地命令行工具，支持边界样本生成、失败理由标注、分组报告导出。

## 功能特性

### 核心模块

- **策略解析 (policy_parser)**: 支持JSON/YAML格式的策略配置文件
- **边界生成 (boundary_generator)**: 自动生成长度、字符类别的边界测试样本
- **规则引擎 (rule_engine)**: 多规则验证，详细的失败理由标注
- **报告生成 (reporter)**: 分组导出，支持JSON/CSV格式，结果稳定可重现

### 核心功能

1. **策略配置**
   - 最小/最大密码长度
   - 大写/小写/数字/特殊字符要求
   - 自定义字符类规则
   - 禁用正则表达式模式
   - 连续字符检测

2. **输入方式**
   - 自动生成边界测试样本
   - 从文件加载候选密码 (TSV格式)
   - 命令行直接指定密码

3. **输出来源追踪**
   - 保留原始文件路径和行号
   - 测试分组管理
   - 详细失败原因

4. **报告格式**
   - 控制台文本摘要
   - JSON详细报告
   - CSV表格报告
   - 按测试分组导出报告

5. **退出码**
   - 0: 所有密码全部通过验证
   - 1: 存在验证失败
   - 2-5: 各种异常错误

## 项目结构

```
.
├── password_policy_cli/
│   ├── __init__.py          # 模块导出
│   ├── cli.py               # CLI主入口
│   ├── policy_parser.py     # 策略解析模块
│   ├── boundary_generator.py # 边界样本生成
│   ├── rule_engine.py       # 规则引擎
│   └── reporter.py          # 报告生成
├── password_policy_check.py # 主入口脚本
├── examples/
│   ├── policy.json          # 示例策略配置
│   └── passwords.txt       # 示例密码文件
├── test_output/              # 测试输出目录
├── test_demo.py             # 演示脚本
├── test_complete.py         # 完整功能测试
└── test_source_tracking.py  # 来源追踪测试
```

## 使用方法

### 命令行使用

```bash
# 查看帮助
python3 password_policy_check.py --help

# 使用策略文件验证密码
python3 password_policy_check.py \
  --policy examples/policy.json \
  --password "GoodPass456!" "TestPass123$"

# 自动生成边界测试样本并导出报告
python3 password_policy_check.py \
  --min-length 8 \
  --min-uppercase 1 \
  --min-digits 1 \
  --min-special 1 \
  --generate \
  --output-report report.json \
  --output-csv report.csv

# 从文件加载候选密码并生成分组报告
python3 password_policy_check.py \
  --policy examples/policy.json \
  --candidates examples/passwords.txt \
  --generate-group-reports groups/
```

### Python模块使用

```python
from password_policy_cli import (
    PasswordPolicy,
    BoundaryGenerator,
    RuleEngine,
    Reporter
)

# 配置策略
policy = PasswordPolicy(
    min_length=8,
    min_uppercase=1,
    min_digits=1,
    min_special=1
)

# 生成边界样本
generator = BoundaryGenerator(policy)
samples = generator.generate_all_boundaries()

# 验证密码
engine = RuleEngine(policy)
results = engine.validate_batch(samples)

# 生成报告
reporter = Reporter(results)
reporter.print_summary()
reporter.generate_json_report('report.json')
```

### 候选密码文件格式

使用制表符分隔(TSV):
```
密码\t测试分组\t描述
```

示例:
```
GoodPass456!	valid_group	有效的密码示例
short123	    length_test	长度不足的密码
```

## 核心设计原则

1. **模块分离**: 解析、规则判断、来源追踪、报告生成完全分离
2. **结果稳定**: 相同输入始终产生相同输出，不因排序变化产生差异
3. **来源可追溯**: 坏行始终保留原文件位置信息（文件名 + 行号）
4. **异常友好**: 详细的错误信息和退出码区分

## 已完成验证

- ✓ 策略配置解析 (JSON/YAML)
- ✓ 边界样本生成 (长度、字符类别、特殊字符)
- ✓ 多规则验证引擎
- ✓ 失败原因详细标注
- ✓ 文件来源追踪 (文件名 + 行号)
- ✓ 报告生成 (JSON/CSV/分组)
- ✓ 重复运行结果稳定性
- ✓ 退出码正确区分
