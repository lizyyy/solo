# 日志脱敏回放盒

安全运营人员的日志脱敏、验证、回放和审计工具。

## 功能特性

- **init**: 初始化配置和工作区，创建默认策略和密钥
- **scan**: 扫描日志文件识别敏感字段（手机号、邮箱、token、设备号等）
- **mask**: 按规则生成一致化假值，确保同一用户在多文件中的关联
- **verify**: 检查残留敏感词、格式破坏、跨文件映射冲突
- **replay**: 用脱敏日志按时间窗口重组问题会话
- **restore**: 只在有密钥时回填指定片段
- **export**: 导出 Markdown/CSV/JSON 审计包

## 支持的敏感字段类型

- **手机号**: 中国大陆手机号码
- **邮箱**: 标准电子邮箱格式
- **Token**: JWT、API Key、Session Token 等
- **设备ID**: IMEI、MAC地址、UUID、Android ID 等
- **地址**: 包含省、市、区、街道等的中文地址
- **身份证号**: 18位或15位中国大陆身份证号
- **银行卡号**: 16-19位银行卡号
- **用户名/真实姓名**: 2-4个中文字符的姓名

## 支持的日志格式

- **TXT**: 纯文本日志
- **JSONL**: 每行一个 JSON 对象的日志
- **CSV**: 逗号分隔值格式的日志

## 安装

### 环境要求

- Python 3.8+
- pip

### 安装步骤

1. 克隆或下载项目到本地
2. 进入项目目录
3. 安装依赖：

```bash
pip install -e .
```

或者使用 pip install 安装所需依赖：

```bash
pip install click python-dotenv pydantic cryptography faker rich
```

## 使用方法

### 1. 初始化 (init)

首先需要初始化配置和工作区：

```bash
log-mask-replay init
```

选项：
- `--workspace, -w`: 工作区目录（默认: ./workspace）
- `--force, -f`: 强制覆盖现有配置

示例：
```bash
# 使用默认配置
log-mask-replay init

# 指定工作区
log-mask-replay init --workspace ./my-workspace

# 强制覆盖现有配置
log-mask-replay init --force
```

初始化后会生成：
- 配置文件: `log-mask-config.json`
- 工作区目录结构:
  - `input/`: 存放原始日志
  - `output/`: 存放脱敏后的日志
  - `mappings/`: 存放映射关系和密钥
  - `reports/`: 存放审计报告

**重要**: 请妥善保存在初始化时生成的密钥，后续的恢复操作需要使用此密钥。

### 2. 扫描敏感字段 (scan)

扫描日志文件识别其中的敏感字段：

```bash
log-mask-replay scan <文件路径>
```

选项：
- `--input-dir, -i`: 输入目录（处理目录下所有文件）
- `--output, -o`: 输出文件路径（保存扫描结果）
- `--show-details, -d`: 显示详细的敏感字段信息

示例：
```bash
# 扫描单个文件
log-mask-replay scan ./test_data/log_sample.txt

# 扫描多个文件
log-mask-replay scan ./test_data/log_sample.txt ./test_data/log_sample.jsonl

# 扫描整个目录
log-mask-replay scan --input-dir ./test_data

# 显示详细信息并保存结果
log-mask-replay scan ./test_data/log_sample.txt --show-details --output ./scan_result.json
```

### 3. 脱敏处理 (mask)

对日志文件进行脱敏处理：

```bash
log-mask-replay mask <文件路径>
```

选项：
- `--input-dir, -i`: 输入目录（处理目录下所有文件）
- `--output-dir, -o`: 输出目录（默认: workspace/output）
- `--preserve-structure, -s`: 保留原目录结构
- `--save-mappings, -m`: 保存映射关系（默认: True）

示例：
```bash
# 脱敏单个文件
log-mask-replay mask ./test_data/log_sample.txt

# 脱敏多个文件
log-mask-replay mask ./test_data/log_sample.txt ./test_data/log_sample.jsonl

# 脱敏整个目录
log-mask-replay mask --input-dir ./test_data

# 指定输出目录
log-mask-replay mask ./test_data/log_sample.txt --output-dir ./my-output
```

脱敏特点：
- **一致性**: 同一原始值在不同文件中会映射到相同的假值
- **可恢复**: 映射关系被保存，有密钥时可以恢复原始值
- **格式保护**: 尽量保持原始日志格式不被破坏

### 4. 验证脱敏结果 (verify)

验证脱敏后的日志文件：

```bash
log-mask-replay verify <文件路径>
```

选项：
- `--input-dir, -i`: 输入目录（检查目录下所有文件）
- `--output, -o`: 验证报告输出路径

验证内容：
1. **敏感词残留检查**: 检查是否还有未脱敏的敏感信息
2. **格式破坏检查**: 检查 JSONL、CSV 等格式是否被破坏
3. **跨文件映射一致性**: 检查映射关系是否一致

示例：
```bash
# 验证单个文件
log-mask-replay verify ./workspace/output/log_sample.txt

# 验证整个目录
log-mask-replay verify --input-dir ./workspace/output

# 保存验证报告
log-mask-replay verify ./workspace/output/log_sample.txt --output ./verify_report.json
```

### 5. 回放问题会话 (replay)

按时间窗口或会话ID重组问题会话：

```bash
log-mask-replay replay <文件路径>
```

选项：
- `--input-dir, -i`: 输入目录
- `--start-time, -s`: 开始时间（格式: YYYY-MM-DD HH:MM:SS）
- `--end-time, -e`: 结束时间（格式: YYYY-MM-DD HH:MM:SS）
- `--time-window, -w`: 时间窗口（分钟），用于自动查找相关日志
- `--session-id`: 会话ID，用于重组特定会话
- `--output, -o`: 输出文件路径

示例：
```bash
# 按时间窗口回放
log-mask-replay replay ./workspace/output/ \
    --start-time "2024-01-15 08:30:00" \
    --end-time "2024-01-15 08:31:00"

# 按会话ID回放
log-mask-replay replay ./workspace/output/ --session-id "session_abc123"

# 自动扩展时间窗口
log-mask-replay replay ./workspace/output/log_sample.txt --time-window 10

# 保存回放结果
log-mask-replay replay ./workspace/output/ \
    --start-time "2024-01-15 08:30:00" \
    --end-time "2024-01-15 09:00:00" \
    --output ./replay_result.txt
```

### 6. 恢复敏感字段 (restore)

使用密钥恢复脱敏的敏感字段：

```bash
log-mask-replay restore <文件路径> --key <密钥>
```

选项：
- `--input-dir, -i`: 输入目录
- `--output-dir, -o`: 输出目录（默认: workspace/restored）
- `--field-type, -t`: 指定要恢复的字段类型
- `--field-value, -v`: 指定要恢复的字段值（假值）
- `--all-fields, -a`: 恢复所有敏感字段
- `--key, -k`: 加密密钥
- `--key-file`: 密钥文件路径

示例：
```bash
# 使用密钥恢复所有字段
log-mask-replay restore ./workspace/output/log_sample.txt \
    --key "你的密钥" \
    --all-fields

# 使用密钥文件恢复
log-mask-replay restore ./workspace/output/log_sample.txt \
    --key-file ./workspace/mappings/key.txt \
    --all-fields

# 只恢复特定类型的字段
log-mask-replay restore ./workspace/output/log_sample.txt \
    --key "你的密钥" \
    --field-type phone

# 恢复整个目录
log-mask-replay restore --input-dir ./workspace/output \
    --key-file ./workspace/mappings/key.txt \
    --all-fields
```

### 7. 导出审计报告 (export)

导出脱敏操作的审计报告：

```bash
log-mask-replay export --output <输出路径>
```

选项：
- `--output, -o`: 输出文件路径（必需）
- `--format, -f`: 输出格式（markdown/csv/json，默认: markdown）
- `--include-mappings, -m`: 包含映射关系（谨慎使用，包含敏感信息）
- `--include-audit-log, -a`: 包含审计日志

示例：
```bash
# 导出 Markdown 格式报告
log-mask-replay export --output ./report.md

# 导出 JSON 格式报告
log-mask-replay export --output ./report.json --format json

# 导出 CSV 格式报告
log-mask-replay export --output ./report.csv --format csv

# 导出包含映射关系和审计日志的报告
log-mask-replay export --output ./full_report.md \
    --include-mappings \
    --include-audit-log
```

## 完整验证流程

以下是一个完整的使用流程，使用提供的测试数据进行验证：

### 步骤 1: 初始化

```bash
# 进入项目目录
cd /path/to/xy4072

# 初始化（会生成密钥，请妥善保存）
log-mask-replay init
```

记录下生成的密钥，后续恢复操作需要使用。

### 步骤 2: 扫描测试数据

```bash
# 扫描文本格式的测试数据
log-mask-replay scan ./test_data/log_sample.txt --show-details

# 扫描所有测试数据
log-mask-replay scan --input-dir ./test_data --output ./scan_result.json
```

查看扫描结果，确认工具能正确识别各种敏感字段。

### 步骤 3: 脱敏处理

```bash
# 脱敏所有测试数据
log-mask-replay mask --input-dir ./test_data

# 查看生成的脱敏文件
ls -la ./workspace/output/
```

检查脱敏后的文件，确认：
- 敏感字段已被替换
- 同一用户的信息在不同文件中保持一致（如手机号 13812345678 在所有文件中映射到同一个假值）

### 步骤 4: 验证脱敏结果

```bash
# 验证脱敏后的文件
log-mask-replay verify --input-dir ./workspace/output --output ./verify_report.json
```

确认验证通过，没有敏感信息残留。

### 步骤 5: 回放问题会话

```bash
# 按时间窗口回放
log-mask-replay replay --input-dir ./workspace/output \
    --start-time "2024-01-15 08:30:00" \
    --end-time "2024-01-15 08:31:00" \
    --output ./replay_0830.txt
```

查看回放结果，确认相关日志已按时间顺序重组。

### 步骤 6: 恢复敏感字段（可选）

```bash
# 使用初始化时生成的密钥恢复
log-mask-replay restore --input-dir ./workspace/output \
    --key-file ./workspace/mappings/key.txt \
    --all-fields

# 查看恢复后的文件
ls -la ./workspace/restored/
```

确认恢复后的文件与原始文件一致。

### 步骤 7: 导出审计报告

```bash
# 导出审计报告
log-mask-replay export --output ./audit_report.md

# 导出包含映射关系的完整报告（谨慎操作）
log-mask-replay export --output ./full_audit_report.json \
    --format json \
    --include-mappings \
    --include-audit-log
```

## 脱敏策略说明

工具默认使用以下脱敏策略：

| 字段类型 | 默认策略 | 说明 |
|---------|---------|------|
| 手机号 | 假值生成 | 生成格式一致的假手机号 |
| 邮箱 | 假值生成 | 生成格式一致的假邮箱 |
| Token | 哈希 | 生成 SHA256 哈希值 |
| 设备ID | 假值生成 | 生成格式一致的假设备ID |
| 地址 | 部分掩码 | 保留前后部分字符，中间用 * 替换 |
| 身份证号 | 部分掩码 | 保留前6位和后4位 |
| 银行卡号 | 部分掩码 | 保留前4位和后4位 |
| 用户名/真实姓名 | 假值生成 | 生成假的中文姓名 |

可以通过修改 `log-mask-config.json` 文件中的策略配置来自定义脱敏规则。

## 安全注意事项

1. **密钥管理**: 
   - 初始化时生成的密钥是恢复敏感数据的唯一凭证，请妥善保管
   - 不要将密钥提交到版本控制系统
   - 建议将密钥备份到安全的位置

2. **映射存储**:
   - 映射关系包含原始敏感信息，请妥善处理
   - 导出报告时使用 `--include-mappings` 选项要谨慎

3. **审计日志**:
   - 审计日志记录了所有操作，建议定期检查
   - 可以通过导出功能保存审计日志

4. **测试数据**:
   - 提供的测试数据仅用于演示和测试
   - 实际使用时请处理真实的敏感数据

## 项目结构

```
log_mask_replay/
├── __init__.py          # 包初始化
├── cli.py               # CLI 主程序
├── config/              # 策略模型模块
│   ├── __init__.py
│   └── models.py        # 配置模型、敏感字段规则
├── parser/              # 解析器模块
│   ├── __init__.py
│   ├── base.py          # 解析器基类
│   ├── txt_parser.py    # 文本解析器
│   ├── jsonl_parser.py  # JSONL 解析器
│   └── csv_parser.py    # CSV 解析器
├── masker/              # 脱敏引擎模块
│   ├── __init__.py
│   ├── engine.py        # 脱敏引擎核心
│   └── fake_generator.py # 假值生成器
├── storage/             # 映射存储模块
│   ├── __init__.py
│   └── mapping.py       # 映射存储、加密存储
├── verifier/            # 校验模块（预留）
│   └── __init__.py
├── replay/              # 回放模块（预留）
│   └── __init__.py
└── reporter/            # 报告模块（预留）
    └── __init__.py

test_data/               # 测试数据
├── log_sample.txt       # 文本格式测试数据
├── log_sample.jsonl     # JSONL 格式测试数据
└── log_sample.csv       # CSV 格式测试数据

pyproject.toml           # 项目配置
README.md                # 本文档
```

## 常见问题

### Q: 为什么同一原始值在不同文件中需要映射到相同的假值？

A: 这是为了保持数据的关联性。例如，同一个用户的手机号在多个日志文件中出现，如果每个文件都映射到不同的假值，就无法追踪该用户在不同系统中的行为。工具确保同一原始值始终映射到相同的假值，保持了数据的关联性。

### Q: 如何自定义脱敏规则？

A: 可以编辑 `log-mask-config.json` 文件中的 `masking_policy.rules` 部分。每个规则可以配置：
- `pattern`: 正则表达式用于匹配敏感字段
- `mask_strategy`: 脱敏策略（fake_value/partial_mask/hash/replace）
- `enabled`: 是否启用该规则
- `priority`: 优先级（数字越大优先级越高）

### Q: 忘记密钥了怎么办？

A: 如果丢失了密钥，将无法恢复脱敏的敏感数据。这是设计上的安全特性，确保没有密钥的人无法访问原始敏感数据。因此，**请务必妥善保管密钥**。

### Q: 工具支持哪些日志格式？

A: 目前支持：
- **TXT**: 纯文本日志，每行一条日志
- **JSONL**: 每行一个 JSON 对象的日志
- **CSV**: 逗号分隔值格式的日志

工具会自动根据文件扩展名检测格式，也可以通过文件内容自动检测。

## 许可证

本项目仅供内部使用，请遵守相关法律法规。

## 贡献

如有问题或建议，请反馈给安全运营团队。
