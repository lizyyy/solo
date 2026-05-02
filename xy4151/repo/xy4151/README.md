# 多语言文本包冻结闸 (Freeze Gate)

一个给游戏本地化负责人使用的命令行工具，用于在发版前进行多语言文本质量检查。

## 功能特性

- **Key 完整性检查**: 确保所有源语言 Key 在目标语言中都有对应翻译
- **占位符规则校验**: 检查 `{variable}`、`[variable]`、`%1$s` 等占位符是否正确传递
- **ICU 复数规则检查**: 验证 ICU MessageFormat 复数形式是否完整
- **UI 长度预算控制**: 根据语言特性和原文长度控制译文长度
- **禁用词检测**: 自动识别粗话、冒犯性用语
- **人工复核机制**: 支持人工放行/拒绝特定问题
- **多格式报告导出**: Markdown 冻结报告、CSV 问题清单、JSON 审计包

## 安装

```bash
# 克隆仓库后，使用 pip 安装：
pip install -e .

# 或者使用 PYTHONPATH 直接运行：
PYTHONPATH=src python3 -m freeze_gate.cli.main --help
```

## 命令说明

### 1. init - 初始化项目

创建项目配置文件和目录结构。

```bash
freeze-gate init --name "我的游戏" --source-lang "zh-CN" -t "en-US" -t "ja-JP" -t "ko-KR"
```

参数：
- `--name/-n`: 项目名称（必需）
- `--source-lang/-s`: 源语言（默认: zh-CN）
- `--target-lang/-t`: 目标语言（可多次指定，默认: en-US, ja-JP, ko-KR）
- `--no-samples`: 不生成示例数据

生成的配置文件 `freeze-gate.yaml` 包含：
- 项目基本信息
- 占位符规则配置
- 各语言长度预算
- 禁用词列表

### 2. import-cmd - 导入多语言资源

支持 JSON 嵌套结构和 CSV 表格格式。

```bash
# 从 CSV 导入
freeze-gate import-cmd translations.csv

# 从 JSON 导入
freeze-gate import-cmd localization.json

# 指定资源名称
freeze-gate import-cmd translations.csv -n "ui_texts"
```

支持的格式：
- **CSV**: 第一列为 Key，后续列为各语言翻译
- **JSON**: 支持嵌套结构，自动展开为点分隔的 Key

### 3. check - 执行质量检查

运行所有质量检查项。

```bash
# 检查所有资源
freeze-gate check

# 详细输出
freeze-gate -v check

# 指定检查类型
freeze-gate check --check-type placeholder_mismatch --check-type length_exceeded

# 指定语言
freeze-gate check --language en-US --language ja-JP

# 保存检查结果
freeze-gate check --save-result
```

检查类型：
- `key_missing`: 缺少的 Key
- `key_extra`: 多余的 Key
- `placeholder_mismatch`: 占位符不匹配
- `placeholder_order`: 占位符顺序错误
- `icu_plural_mismatch`: ICU 复数规则不一致
- `length_exceeded`: 长度超限
- `forbidden_word`: 禁用词
- `empty_translation`: 空翻译

### 4. review - 保存人工复核意见

对检查发现的问题进行人工放行或拒绝。

```bash
# 批准某个问题
freeze-gate review -k "ui.welcome" -l "en-US" --approve -r "LocalizationLead" -c "UI 设计允许稍长"

# 拒绝某个问题
freeze-gate review -k "ui.welcome" -l "en-US" --reject -r "QA" -c "占位符错误必须修复"
```

参数：
- `--key/-k`: 问题的 Key（必需）
- `--language/-l`: 语言代码（必需）
- `--approve/--reject`: 批准/拒绝（默认批准）
- `--reviewer/-r`: 复核人名称（必需）
- `--comment/-c`: 复核意见

### 5. report - 导出质量检查报告

支持导出多种格式的报告。

```bash
# 导出全部格式
freeze-gate report -f all

# 只导出 Markdown
freeze-gate report -f markdown

# 导出多种格式
freeze-gate report -f markdown -f csv

# 指定输出目录
freeze-gate report -f all -o ./reports

# 包含已批准的问题
freeze-gate report -f all --include-approved
```

导出格式：
- `markdown`: Markdown 冻结报告
- `csv`: CSV 问题清单
- `json`: JSON 审计包
- `all`: 全部导出

### 6. samples - 生成示例数据

用于测试和演示工具功能。

```bash
# 在当前目录生成示例
freeze-gate samples

# 指定输出目录
freeze-gate samples -o ./test_data
```

生成的示例文件：
- `source.json`: 源语言 JSON 文件
- `translations.csv`: 翻译 CSV 文件（包含各种问题场景）
- `freeze-gate.yaml`: 示例配置文件
- `test_cases.json`: 测试用例说明

## 临时目录验证全流程

按照以下步骤在临时目录测试完整工作流：

### 步骤 1: 创建临时目录并初始化

```bash
mkdir -p /tmp/test_freeze_gate
cd /tmp/test_freeze_gate

# 初始化项目（会自动生成示例数据）
PYTHONPATH=/path/to/repo/src python3 -m freeze_gate.cli.main init --name "TestGame" --source-lang "zh-CN" -t "en-US" -t "ja-JP" -t "ko-KR"
```

### 步骤 2: 查看生成的文件

```bash
# 查看配置文件
cat freeze-gate.yaml

# 查看示例翻译文件（包含各种测试场景）
cat translations.csv
```

### 步骤 3: 导入翻译资源

```bash
PYTHONPATH=/path/to/repo/src python3 -m freeze_gate.cli.main import-cmd translations.csv
```

### 步骤 4: 执行质量检查

```bash
# 详细检查
PYTHONPATH=/path/to/repo/src python3 -m freeze_gate.cli.main -v check
```

预期会检测到以下问题：
- **空翻译**: `bad.empty_translation` [en-US]
- **占位符缺失**: `bad.missing_placeholder` [en-US]
- **占位符多余**: `bad.extra_placeholder` [en-US]
- **占位符名称错误**: `bad.wrong_placeholder` [en-US]
- **ICU 复数问题**: `bad.icu_plural_missing`、`bad.icu_plural_extra`
- **禁用词**: `bad.forbidden_word_test` [en-US]（包含 "damn"）
- **超长翻译**: `bad.long_translation` [en-US]
- **方括号占位符错误**: `bad.bracket_placeholder` [en-US]
- **各种长度超限**: 大量 WARNING 级别的长度检查

### 步骤 5: 人工复核特定问题

```bash
# 批准某个问题（例如：空翻译但由于紧急发版放行）
PYTHONPATH=/path/to/repo/src python3 -m freeze_gate.cli.main review -k "bad.empty_translation" -l "en-US" --approve -r "Lead" -c "紧急发版，暂时放行"
```

### 步骤 6: 导出报告

```bash
# 导出全部格式
PYTHONPATH=/path/to/repo/src python3 -m freeze_gate.cli.main report -f all

# 查看生成的报告
ls -la output/

# 查看 Markdown 报告
cat output/freeze_report_*.md

# 查看 CSV 问题清单
cat output/issues_*.csv

# 查看 JSON 审计包
cat output/audit_*.json
```

### 步骤 7: 验证报告内容

生成的报告包含：
1. **检查摘要**: 各严重级别的问题统计
2. **待处理问题**: 按严重程度分类的详细问题列表
3. **已批准问题**: 人工放行的问题列表
4. **配置摘要**: 占位符规则、长度预算、禁用词配置

## 配置文件详解

`freeze-gate.yaml` 配置项说明：

```yaml
name: 项目名称
version: 版本号
source_language: 源语言代码
target_languages:
  - 目标语言1
  - 目标语言2

output_directory: 输出目录

placeholder_rules:
  - pattern: 正则表达式模式
    description: 规则描述
    example: 示例
    allow_any_order: 是否允许顺序不同
    preserve_case: 是否区分大小写

length_budgets:
  语言代码:
    max_length: 最大字符数
    max_characters: 最大字符数（备用）
    ratio_to_source: 相对于原文的长度倍数
    description: 说明

forbidden_words:
  - word: 禁用词
    languages: 适用语言列表（空列表表示所有语言）
    severity: 严重程度（CRITICAL/ERROR/WARNING）
    reason: 原因说明

resource_paths: {}  # 自动管理，无需手动编辑
```

## 项目结构

```
src/freeze_gate/
├── __init__.py          # 版本信息
├── cli/
│   ├── __init__.py
│   └── main.py          # CLI 入口，所有子命令
├── models.py              # 数据模型定义
├── config.py              # 配置管理
├── parsers.py             # 资源解析器（JSON/CSV）
├── rules.py               # 规则引擎
├── review.py             # 复核存储
├── exporters.py          # 报告导出
└── samples.py          # 示例数据生成
```

## 依赖

- Python >= 3.9
- click >= 8.0.0
- rich >= 13.0.0
- pyyaml >= 6.0
- pydantic >= 2.0.0

## 测试场景

示例数据包含以下测试场景：

| 场景 | Key | 预期问题 |
|------|-----|---------|
| 正确翻译 | ui.welcome | 无 |
| 空翻译 | bad.empty_translation | EMPTY_TRANSLATION |
| 占位符缺失 | bad.missing_placeholder | PLACEHOLDER_MISMATCH |
| 占位符多余 | bad.extra_placeholder | PLACEHOLDER_MISMATCH |
| 占位符名称错误 | bad.wrong_placeholder | PLACEHOLDER_MISMATCH |
| ICU 复数缺少形式 | bad.icu_plural_missing | ICU_PLURAL_MISMATCH |
| ICU 复数多余形式 | bad.icu_plural_extra | ICU_PLURAL_MISMATCH |
| 禁用词 | bad.forbidden_word_test | FORBIDDEN_WORD |
| 超长翻译 | bad.long_translation | LENGTH_EXCEEDED |
| 方括号占位符错误 | bad.bracket_placeholder | PLACEHOLDER_MISMATCH |
| printf 顺序 | bad.placeholder_order | (配置决定) |

## License

MIT
