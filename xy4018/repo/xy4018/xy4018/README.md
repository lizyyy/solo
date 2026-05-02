# 合同改稿巡检器

一个给小法务团队用的本地命令行工具，用于对比两版合同文本的差异并扫描风险条款。

## 功能特性

- **合同对比**: 导入两版合同文本，按章节/条款编号做结构化解析，生成差异摘要
- **风险规则引擎**: 支持用YAML或JSON编写风险规则，扫描关键条款变化
- **历史记录**: 每次巡检任务保存到本地数据目录，支持按客户名、合同名、日期查询
- **报告导出**: 支持导出Markdown报告和CSV风险清单

## 预设风险规则

- 🔴 **金额上浮超过20%**: 检测合同金额是否大幅上涨
- 🔴 **付款周期从30天延长至60天**: 检测付款周期延长
- 🔴 **自动续约无提前通知条款**: 检测自动续约条款风险
- 🔴 **管辖地变更为外地法院**: 检测诉讼管辖地变更
- 🟡 **违约金比例提高**: 检测违约责任加重
- 🟢 **新增不可抗力条款**: 检测免责条款新增

## 安装

```bash
# 进入项目目录
cd xy4018

# 安装依赖
pip install -e .
```

依赖包：
- `click`: 命令行框架
- `pyyaml`: YAML格式解析
- `python-dateutil`: 日期处理
- `deepdiff`: 深度差异计算

## 快速开始

### 运行演示

使用自带样例合同执行一次完整巡检：

```bash
contract-inspector demo
```

### 手动执行巡检

```bash
# 对比两版合同并进行风险扫描
contract-inspector diff \
    demo/contract_v1.md \
    demo/contract_v2.md \
    --client "演示客户" \
    --contract-name "软件开发服务合同" \
    --rules demo/rules.yaml
```

### 查看历史记录

```bash
# 列出所有巡检任务
contract-inspector list

# 按客户筛选
contract-inspector list --client "演示客户"

# 查看任务详情（替换为实际的任务ID）
contract-inspector show <task_id>
```

### 导出报告

```bash
# 导出Markdown报告和CSV风险清单
contract-inspector export <task_id>

# 只导出Markdown
contract-inspector export <task_id> --format markdown

# 只导出CSV
contract-inspector export <task_id> --format csv

# 导出到指定目录
contract-inspector export <task_id> --output ./reports
```

## 命令参考

### diff
对比两版合同并进行风险扫描

```
contract-inspector diff OLD_FILE NEW_FILE \
    --client CLIENT \
    --contract-name CONTRACT_NAME \
    [--rules RULES_FILE]
```

- `OLD_FILE`: 旧版合同文件路径（.txt 或 .md）
- `NEW_FILE`: 新版合同文件路径（.txt 或 .md）
- `--client`, `-c`: 客户名称（必需）
- `--contract-name`, `-n`: 合同名称（必需）
- `--rules`, `-r`: 规则文件路径（YAML/JSON，可选）

### list
列出历史巡检任务

```
contract-inspector list \
    [--client CLIENT] \
    [--contract-name CONTRACT_NAME] \
    [--limit LIMIT]
```

- `--client`, `-c`: 按客户名称筛选
- `--contract-name`, `-n`: 按合同名称筛选
- `--limit`, `-l`: 显示最近N条记录（默认20）

### show
显示巡检任务详情

```
contract-inspector show TASK_ID
```

### export
导出巡检报告

```
contract-inspector export TASK_ID \
    [--format {markdown,csv,both}] \
    [--output OUTPUT_DIR]
```

- `--format`, `-f`: 导出格式（默认both）
- `--output`, `-o`: 输出目录路径

### demo
运行演示任务

```
contract-inspector demo
```

## 项目结构

```
xy4018/
├── contract_inspector/
│   ├── __init__.py
│   ├── cli.py           # CLI入口
│   ├── config.py        # 配置管理
│   ├── parser.py        # 文本解析器
│   ├── diff.py          # 差异计算
│   ├── rules.py         # 规则引擎
│   ├── storage.py       # 本地存储
│   └── exporter.py      # 报告导出
├── demo/
│   ├── contract_v1.md   # 样例合同V1
│   ├── contract_v2.md   # 样例合同V2（含变更）
│   └── rules.yaml       # 预设风险规则
├── pyproject.toml       # 项目配置
└── README.md
```

## 数据目录

首次运行后会在用户目录创建数据目录：

```
~/.contract-inspector/
├── tasks/      # 巡检任务记录
├── rules/      # 自定义规则包
└── exports/    # 导出的报告
```

## 样例合同变更说明

`contract_v1.md` → `contract_v2.md` 的关键变更：

1. **金额上涨**: 50万元 → 65万元（上涨30%，触发规则）
2. **付款周期延长**: 验收后30天内 → 60天内（触发规则）
3. **新增自动续约**: 到期自动顺延一年，无提前通知条款（触发规则）
4. **管辖地变更**: 甲方住所地（北京）→ 上海市浦东新区（触发规则）
5. **违约金提高**: 逾期交付0.1%/天 → 0.2%/天；逾期付款0.05%/天 → 0.1%/天（触发规则）

## 规则编写指南

规则文件使用YAML格式，结构如下：

```yaml
rules:
  - id: unique_rule_id
    name: 规则名称
    description: 规则描述
    enabled: true
    level: high  # high | medium | low
    check_type: amount_increase  # 内置检查类型
    # 规则特定参数...
    suggestion: 建议文案
```

### 内置检查类型

| 检查类型 | 功能 | 参数 |
|---------|------|------|
| `amount_increase` | 检测金额上浮 | `threshold`: 涨幅阈值（如0.2表示20%） |
| `payment_period_change` | 检测付款周期变化 | `from_days`: 原周期列表; `to_days`: 新周期列表 |
| `auto_renewal` | 检测自动续约条款 | `keywords`: 关键词列表; `notice_days_pattern`: 通知天数正则 |
| `jurisdiction_change` | 检测管辖地变更 | `local_patterns`: 本地管辖模式列表 |
| `penalty_change` | 检测违约金变化 | 无额外参数 |
| `keyword_match` | 关键词匹配 | `keywords`: 关键词列表; `must_include`: 是否必须包含 |
| `custom` | 自定义正则 | `patterns`: 正则表达式列表 |

## 开发说明

### 自检命令

安装后可通过以下命令验证功能：

```bash
# 查看版本
contract-inspector --version

# 查看帮助
contract-inspector --help
contract-inspector diff --help

# 运行演示（验证完整流程）
contract-inspector demo
```

### 注意事项

1. 合同文件需使用UTF-8编码
2. 规则文件支持YAML和JSON格式
3. 所有数据存储在本地，不上传云端
4. 支持的合同格式：.txt、.md（Word文档需先转文本）

## 已完成项

- ✅ CLI入口模块（diff、list、show、export、demo命令）
- ✅ 文本解析器（章节/条款结构化解析）
- ✅ 差异计算模块（新增/删除/修改检测）
- ✅ 规则引擎（6种内置检查类型）
- ✅ 本地存储模块（任务保存/查询/删除）
- ✅ 报告导出模块（Markdown报告、CSV风险清单）
- ✅ 样例合同数据（V1/V2两版对比）
- ✅ 预设风险规则（6条常用规则）
- ✅ README文档

## 未完成项

- ⏳ 图形化界面（后续可扩展）
- ⏳ Word文档直接解析（需依赖python-docx）
- ⏳ PDF文档解析（需依赖pdfplumber或类似库）
- ⏳ 规则模板管理（更多预设规则）
- ⏳ 批量巡检任务支持
