# 客服回访录音质检工具

一个用于批量处理客服回访录音文字稿的命令行工具，能够自动进行质检分析并生成可复核的报告。

## 功能特性

- **数据校验**: 自动校验输入文件的字段完整性和格式正确性
- **承诺未兑现检测**: 识别坐席作出承诺但后续未兑现的情况
- **情绪升级检测**: 检测客户情绪变化和升级的迹象
- **敏感词检测**: 识别投诉、退款、虚假宣传等敏感词汇
- **超时回复检测**: 检测坐席或客户回复超时的情况
- **多种输出**:
  - 终端摘要（实时显示质检结果）
  - Markdown报告（详细的质检报告）
  - CSV导出（异常样本单独导出）

## 安装

### 环境要求

- Python 3.7+
- pip 包管理器

### 安装步骤

1. 克隆或下载项目到本地

2. 安装依赖包：

```bash
pip install -r requirements.txt
```

3. 验证安装：

```bash
python quality_inspector.py --help
```

## 快速开始

### 1. 生成示例数据

首先，让我们生成一些示例数据来测试工具：

```bash
python quality_inspector.py examples --output-dir ./examples --count 5
```

或者使用我们预先准备好的示例数据（在 `examples/` 目录中）。

### 2. 校验数据

在进行质检分析之前，可以先校验数据格式：

```bash
# 校验单个文件
python quality_inspector.py validate ./examples/normal_conversation.json

# 校验整个目录
python quality_inspector.py validate ./examples/

# 递归校验子目录
python quality_inspector.py validate ./examples/ --recursive

# 严格模式校验（任何字段缺失都会报错）
python quality_inspector.py validate ./examples/ --strict
```

### 3. 执行质检分析

执行完整的质检分析，生成终端摘要、Markdown报告和CSV导出：

```bash
# 分析单个文件
python quality_inspector.py analyze ./examples/sensitive_words.json

# 分析整个目录
python quality_inspector.py analyze ./examples/ --output-dir ./output

# 详细模式（显示更多信息）
python quality_inspector.py analyze ./examples/ --verbose

# 只生成Markdown报告
python quality_inspector.py analyze ./examples/ --no-terminal --no-csv

# 只导出异常样本CSV
python quality_inspector.py analyze ./examples/ --no-terminal --no-markdown
```

### 4. 使用子命令

工具提供了多个子命令，可以按需使用：

```bash
# 只生成报告
python quality_inspector.py report ./examples/ --output ./output/quality_report.md

# 只导出异常样本
python quality_inspector.py export ./examples/ --output ./output/exceptions.csv
```

## 命令参考

### 全局选项

```bash
--config, -c     # 指定配置文件路径
--strict, -s     # 严格模式，任何字段缺失都会报错
--verbose, -v    # 显示详细输出
--help           # 显示帮助信息
```

### validate 子命令

校验输入文件格式。

```bash
python quality_inspector.py validate INPUT_PATH [OPTIONS]
```

**参数：**
- `INPUT_PATH`: 输入文件或目录路径（必需）

**选项：**
- `--recursive, -r`: 递归处理子目录
- `--output, -o`: 输出JSON报告的路径

**示例：**
```bash
# 校验目录并输出报告
python quality_inspector.py validate ./data/ --output ./validation_report.json

# 递归校验
python quality_inspector.py validate ./data/ --recursive --strict
```

### analyze 子命令

执行质检分析。

```bash
python quality_inspector.py analyze INPUT_PATH [OPTIONS]
```

**参数：**
- `INPUT_PATH`: 输入文件或目录路径（必需）

**选项：**
- `--recursive, -r`: 递归处理子目录
- `--output-dir, -o`: 输出目录路径（默认: ./output）
- `--no-terminal`: 不在终端显示摘要
- `--no-markdown`: 不生成Markdown报告
- `--no-csv`: 不导出异常样本CSV

**示例：**
```bash
# 完整分析
python quality_inspector.py analyze ./data/ --output-dir ./output

# 只生成Markdown报告
python quality_inspector.py analyze ./data/ --no-terminal --no-csv

# 详细模式
python quality_inspector.py analyze ./data/ --verbose
```

### report 子命令

生成完整质检报告（analyze的简化版本，只生成Markdown报告）。

```bash
python quality_inspector.py report INPUT_PATH --output OUTPUT_PATH [OPTIONS]
```

**参数：**
- `INPUT_PATH`: 输入文件或目录路径（必需）

**选项：**
- `--recursive, -r`: 递归处理子目录
- `--output, -o`: 输出Markdown报告的路径（必需）

**示例：**
```bash
python quality_inspector.py report ./data/ --output ./report.md
```

### export 子命令

导出异常样本（analyze的简化版本，只导出CSV）。

```bash
python quality_inspector.py export INPUT_PATH --output OUTPUT_PATH [OPTIONS]
```

**参数：**
- `INPUT_PATH`: 输入文件或目录路径（必需）

**选项：**
- `--recursive, -r`: 递归处理子目录
- `--output, -o`: 输出CSV文件的路径（必需）

**示例：**
```bash
python quality_inspector.py export ./data/ --output ./exceptions.csv
```

### examples 子命令

生成示例数据。

```bash
python quality_inspector.py examples [OPTIONS]
```

**选项：**
- `--output-dir, -o`: 输出目录路径（默认: ./examples）
- `--count, -n`: 生成示例数据的数量（默认: 5）

**示例：**
```bash
# 生成5个示例
python quality_inspector.py examples --output-dir ./test_data

# 生成10个示例
python quality_inspector.py examples --output-dir ./test_data --count 10
```

## 输入数据格式

工具支持两种输入格式：JSON和Markdown。

### JSON格式

```json
{
  "conversation_id": "conv_001",
  "agent_name": "张小明",
  "customer_name": "李女士",
  "conversation_time": "2024-01-15 09:30:00",
  "description": "对话描述",
  "messages": [
    {
      "index": 0,
      "speaker": "agent",
      "content": "您好，这里是客服中心...",
      "timestamp": "2024-01-15 09:30:00"
    },
    {
      "index": 1,
      "speaker": "customer",
      "content": "你好，我想咨询...",
      "timestamp": "2024-01-15 09:30:15"
    }
  ]
}
```

**字段说明：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| conversation_id | string | 否 | 对话唯一标识 |
| agent_name | string | 是（严格模式） | 坐席姓名 |
| customer_name | string | 是（严格模式） | 客户姓名 |
| conversation_time | string | 是（严格模式） | 对话时间 |
| description | string | 否 | 对话描述 |
| messages | array | 是 | 消息列表 |

**消息字段说明：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| index | int | 否 | 消息索引 |
| speaker | string | 是 | 说话者类型（agent/customer/坐席/客户等） |
| content | string | 是 | 消息内容 |
| timestamp | string | 否 | 消息时间戳 |

### Markdown格式

Markdown格式支持YAML front matter和对话文本：

```markdown
---
conversation_id: conv_md_001
agent_name: 林小芳
customer_name: 郑先生
conversation_time: 2024-01-20 10:30:00
description: Markdown格式对话示例
---

# 客服对话记录

**坐席**: 林小芳  
**客户**: 郑先生  
**时间**: 2024-01-20 10:30:00

---

**坐席** (2024-01-20 10:30:00): 您好，这里是客服中心...

**客户** (2024-01-20 10:30:15): 你好，我想咨询...
```

## 质检规则说明

### 1. 敏感词检测

工具会检测对话中的敏感词汇，并按严重程度分级：

- **一级敏感词（严重）**: 投诉、举报、退款、赔偿、起诉、曝光、媒体、维权、欺诈、虚假
- **二级敏感词（高）**: 抱歉、对不起、不好意思、失误、错误、遗漏、延迟、等待、遗憾
- **三级敏感词（中）**: 可能、大概、也许、不确定、考虑、研究、稍后、再看

### 2. 承诺未兑现检测

检测坐席作出承诺但后续未兑现的情况：

- **承诺关键词**: 保证、承诺、一定会、肯定会、确保、一定、将会、会、将等
- **兑现关键词**: 已经、已完成、完成了、处理好了、解决了等
- **未兑现关键词**: 还没、还没有、尚未、未完成、没处理、延迟等

**检测逻辑**:
1. 识别坐席的承诺语句
2. 检查后续是否有兑现或未兑现的表述
3. 如果有未兑现表述，或既没有兑现也没有未兑现（假设未兑现），则标记为违规

### 3. 情绪升级检测

检测客户情绪变化和升级的迹象：

- **负面情绪关键词**: 生气、愤怒、不满、不高兴、郁闷、烦躁、着急、焦虑、失望等
- **情绪升级关键词**: 越来越、更加、更、越来越严重、越来越差等
- **情绪缓和关键词**: 理解、明白、知道了、好的、没问题、谢谢等

**检测逻辑**:
1. 检测客户消息中的负面情绪
2. 检测情绪升级关键词
3. 检测连续负面情绪（3次及以上）

### 4. 超时回复检测

检测坐席或客户回复超时的情况：

- **默认超时**: 300秒（5分钟）
- **坐席回复超时**: 300秒（5分钟）
- **客户回复超时**: 600秒（10分钟）
- **严重超时**: 600秒（10分钟）

**检测逻辑**:
1. 计算相邻消息之间的时间差
2. 根据说话者类型应用不同的超时阈值
3. 超过阈值则标记为超时回复

## 配置文件

工具支持通过配置文件自定义质检规则。配置文件格式为YAML。

### 默认配置位置

工具会按以下顺序查找配置文件：
1. 命令行指定的 `--config` 参数
2. `./quality_inspector/config.yaml`
3. `./config.yaml`
4. `~/.quality_inspector/config.yaml`

### 配置文件示例

```yaml
# 通用配置
general:
  default_timeout_seconds: 300
  strict_mode: false
  output_dir: "./output"

# 敏感词配置
sensitive_words:
  level1:
    - 投诉
    - 举报
    - 退款
    # ... 更多敏感词
  level2:
    - 抱歉
    - 对不起
    # ... 更多敏感词
  level3:
    - 可能
    - 大概
    # ... 更多敏感词

# 承诺检测配置
promise_detection:
  promise_keywords:
    - 保证
    - 承诺
    # ... 更多关键词
  fulfillment_keywords:
    - 已经
    - 已完成
    # ... 更多关键词
  unfulfilled_keywords:
    - 还没
    - 还没有
    # ... 更多关键词

# 情绪检测配置
emotion_detection:
  negative_emotions:
    - 生气
    - 愤怒
    # ... 更多关键词
  escalation_keywords:
    - 越来越
    - 更加
    # ... 更多关键词
  deescalation_keywords:
    - 理解
    - 明白
    # ... 更多关键词

# 超时检测配置
timeout_detection:
  default_timeout: 300
  agent_reply_timeout: 300
  customer_reply_timeout: 600
  severe_timeout: 600
```

## 输出说明

### 终端摘要

执行分析后，终端会显示：
- 基本统计信息（总对话数、有效对话数、违规数）
- 违规类型统计
- 严重程度统计
- 校验错误（如有）
- 详细违规信息（verbose模式）

### Markdown报告

生成的Markdown报告包含：
- 执行摘要
- 对话统计表格
- 违规类型统计
- 严重程度统计
- 按坐席统计
- 校验错误详情（如有）
- 详细违规记录（按类型分组）

### CSV异常样本

导出的CSV文件包含以下字段：

| 字段 | 说明 |
|------|------|
| violation_type | 违规类型（英文标识） |
| violation_type_display | 违规类型（中文显示） |
| severity | 严重程度（英文标识） |
| severity_display | 严重程度（中文显示） |
| description | 违规描述 |
| conversation_id | 对话ID |
| agent_name | 坐席姓名 |
| customer_name | 客户姓名 |
| conversation_time | 对话时间 |
| message_index | 相关消息索引 |
| message_content | 相关消息内容 |
| message_time | 相关消息时间 |
| extra_data | 额外信息（JSON格式字符串） |

## 示例数据说明

`examples/` 目录中包含以下示例数据：

| 文件 | 说明 | 预期违规 |
|------|------|----------|
| normal_conversation.json | 正常对话 | 无 |
| sensitive_words.json | 包含敏感词 | 敏感词（投诉、虚假、退款、赔偿、曝光、媒体） |
| broken_promise.json | 承诺未兑现 | 承诺未兑现 |
| emotion_escalation.json | 情绪升级 | 情绪升级 |
| timeout_response.json | 超时回复 | 超时回复 |
| markdown_example.md | Markdown格式示例 | 可能有轻微敏感词 |

## 错误处理

工具提供了友好的错误提示：

- **文件不存在**: 提示文件路径错误
- **格式错误**: 提示JSON解析错误或Markdown格式错误
- **字段缺失**: 提示缺失的字段名
- **权限错误**: 提示文件权限问题

## 退出码

| 退出码 | 说明 |
|--------|------|
| 0 | 成功执行，无严重违规 |
| 1 | 校验错误（存在无效文件） |
| 2 | 检测到严重违规（CRITICAL级别） |

## 项目结构

```
xy4207/
├── quality_inspector.py          # 主入口文件
├── requirements.txt              # 依赖文件
├── quality_inspector/
│   ├── __init__.py               # 包初始化
│   ├── config.yaml               # 默认配置文件
│   ├── models.py                 # 数据模型定义
│   ├── validators.py             # 数据校验模块
│   ├── rules.py                  # 质检规则引擎
│   ├── cli.py                    # 命令行接口
│   └── exporters.py              # 输出模块
├── examples/                     # 示例数据目录
│   ├── normal_conversation.json
│   ├── sensitive_words.json
│   ├── broken_promise.json
│   ├── emotion_escalation.json
│   ├── timeout_response.json
│   └── markdown_example.md
├── output/                       # 输出目录（运行时生成）
└── README.md                     # 本文档
```

## 常见问题

### Q1: 如何添加自定义敏感词？

答：可以通过修改配置文件 `quality_inspector/config.yaml` 中的 `sensitive_words` 部分来添加自定义敏感词。

### Q2: 如何调整超时阈值？

答：修改配置文件中的 `timeout_detection` 部分，调整 `agent_reply_timeout`、`customer_reply_timeout` 等参数。

### Q3: 工具支持哪些时间格式？

答：工具支持多种时间格式，包括：
- `YYYY-MM-DD HH:MM:SS`
- `YYYY-MM-DDTHH:MM:SS`
- `YYYY/MM/DD HH:MM:SS`
- `YYYY-MM-DD`（仅日期）

如果格式无法识别，会尝试使用 `dateutil` 库进行智能解析。

### Q4: 如何批量处理大量文件？

答：使用 `--recursive` 选项可以递归处理子目录中的所有文件。对于大量文件，建议使用 `--no-terminal` 选项减少终端输出，提高性能。

### Q5: 生成的报告乱码怎么办？

答：确保使用 UTF-8 编码查看文件。如果在 Windows 下使用 Excel 打开 CSV 乱码，可以尝试：
1. 先打开 Excel，然后通过「数据」→「从文本/CSV」导入
2. 或者使用 WPS 打开，通常会自动识别编码

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！

## 版本历史

- v1.0.0 (2024-01-01): 初始版本
  - 支持 JSON 和 Markdown 格式输入
  - 实现 4 种质检规则
  - 支持 3 种输出格式
  - 提供完整的命令行接口
