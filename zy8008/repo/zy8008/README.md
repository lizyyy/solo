# CrashLog Tool

移动端崩溃日志整理工具，帮助移动端研发把用户反馈里的崩溃日志整理成可转交的最小复现包。

## 功能特性

- **多格式日志解析**: 支持 Android Logcat、iOS Crash Report、JSON 格式日志、普通文本日志
- **多行堆栈处理**: 自动识别并解析跨多行的异常堆栈跟踪
- **时间排序**: 处理时间倒序的日志，自动按时间戳重新排序
- **智能脱敏**: 自动识别并脱敏敏感信息（手机号、邮箱、Token、API Key 等）
- **堆栈归并**: 将相似的崩溃堆栈自动归并分组
- **可疑堆栈识别**: 基于规则和出现频率识别最可疑的崩溃
- **生成报告**: 自动生成 Markdown 格式的分析报告
- **打包导出**: 一键生成包含所有处理结果的压缩包

## 安装

```bash
pip install -e .
```

或直接使用 Python 模块运行：

```bash
pip install -r requirements.txt
```

## 快速开始

一条命令跑出完整 out 目录：

```bash
crashlog-tool process sample/logs \
  -s sample/sanitize_rules.json \
  -b sample/build_meta.yaml \
  -o out
```

或者使用 Python 模块运行（如果还没安装）：

```bash
python -m crashlog_tool.cli process sample/logs \
  -s sample/sanitize_rules.json \
  -b sample/build_meta.yaml \
  -o out
```

## 命令行用法

### 主命令: `process`

处理崩溃日志目录，生成完整输出。

```bash
crashlog-tool process LOG_DIR [OPTIONS]
```

**参数:**
- `LOG_DIR`: 日志目录路径（必需）

**选项:**
- `-s, --sanitize-rules PATH`: 脱敏规则 JSON 文件路径
- `-b, --build-meta PATH`: 构建元信息 YAML 文件路径
- `-o, --output PATH`: 输出目录 (默认: `./out`)
- `-f, --force`: 覆盖已存在的输出目录
- `--verbose/--quiet`: 显示/隐藏详细输出

**示例:**

```bash
# 基本用法
crashlog-tool process ./logs -o ./out

# 完整参数
crashlog-tool process ./logs \
  -s ./rules.json \
  -b ./build.yaml \
  -o ./out \
  -f
```

### 子命令: `sanitize`

仅脱敏单个日志文件，不进行崩溃分析。

```bash
crashlog-tool sanitize LOG_FILE [OPTIONS]
```

**参数:**
- `LOG_FILE`: 日志文件路径（必需）

**选项:**
- `-o, --output PATH`: 输出文件路径
- `-s, --sanitize-rules PATH`: 自定义脱敏规则

**示例:**

```bash
# 输出到控制台
crashlog-tool sanitize ./log.txt

# 输出到文件
crashlog-tool sanitize ./log.txt -o ./sanitized.txt
```

### 子命令: `validate`

校验日志目录是否有效。

```bash
crashlog-tool validate LOG_DIR [OPTIONS]
```

**参数:**
- `LOG_DIR`: 日志目录路径（必需）

**选项:**
- `-j, --json`: 以 JSON 格式输出

**示例:**

```bash
crashlog-tool validate ./logs

# JSON 输出
crashlog-tool validate ./logs -j
```

## 模块架构

```
crashlog_tool/
├── __init__.py       # 包初始化
├── cli.py            # CLI 入口
├── log_parser.py     # 日志解析模块
├── stack_merger.py   # 堆栈归并模块
├── sanitizer.py      # 脱敏规则模块
├── validator.py      # 清单校验模块
└── packager.py       # 打包导出模块
```

### 模块说明

1. **log_parser** - 日志解析
   - 支持多种日志格式（Android Logcat、iOS Crash、JSON、纯文本）
   - 处理多行堆栈跟踪
   - 按时间戳排序日志

2. **stack_merger** - 堆栈归并
   - 根据堆栈特征归并相似崩溃
   - 生成崩溃分组
   - 识别可疑堆栈
   - 构建崩溃时间线

3. **sanitizer** - 脱敏规则
   - 预设规则：手机号、邮箱、身份证、Token、API Key 等
   - 支持自定义正则规则
   - 处理 JSON 嵌套结构中的敏感字段
   - 支持多种脱敏操作：掩码、替换、移除、哈希

4. **validator** - 清单校验
   - 验证日志目录存在性
   - 校验脱敏规则 JSON 格式
   - 校验构建元信息 YAML 格式
   - 检查必要字段

5. **packager** - 打包导出
   - 生成脱敏后的日志文件
   - 生成崩溃时间线 JSON
   - 生成可疑堆栈摘要 JSON
   - 生成 Markdown 报告
   - 创建 ZIP 压缩包

## 输入文件格式

### 脱敏规则 JSON

```json
{
  "rules": [
    {
      "name": "phone_number",
      "pattern": "(?<![\\d])1[3-9]\\d{9}(?![\\d])",
      "action": "mask",
      "mask_char": "*",
      "keep_prefix": 3,
      "keep_suffix": 4,
      "description": "中国手机号"
    }
  ],
  "sensitive_json_keys": [
    "token",
    "password",
    "phone",
    "email"
  ]
}
```

**脱敏操作类型:**
- `mask`: 掩码显示（保留部分字符）
- `replace`: 替换为固定文本
- `remove`: 完全移除
- `hash`: 哈希处理

### 构建元信息 YAML

```yaml
app_name: "MyApp"
version_name: "2.3.1"
version_code: 20301
build_type: "release"
flavor: "production"
platform: "android"

build_time: "2024-01-15T10:30:00Z"
git_commit: "a1b2c3d4e5f6"
git_branch: "release/2.3.1"

sdk_version: 34
min_sdk_version: 24

proguard_mapping: "./mapping.txt"
symbols_file: "./symbols.zip"
```

## 输出文件说明

运行后会在输出目录生成以下文件：

| 文件名 | 说明 |
|--------|------|
| `sanitized_logs.txt` | 脱敏后的完整日志 |
| `crash_timeline.json` | 按时间排序的崩溃事件列表 |
| `suspicious_stacks.json` | 可疑堆栈摘要 |
| `report.md` | 分析报告（Markdown 格式） |
| `build_meta.json` | 构建元信息副本 |
| `package.zip` | 包含上述所有文件的压缩包 |

## 边界情况处理

### 多行堆栈

自动识别异常堆栈的连续行，包括：
- `at com.example.Class.method(Class.java:123)` 格式
- `Caused by:` 嵌套异常
- iOS Crash Report 格式的线程回溯

### 时间倒序

日志解析后会自动按时间戳重新排序，支持：
- ISO 8601 格式 (`2024-01-15T14:30:00Z`)
- 日期时间格式 (`2024-01-15 14:30:00.123`)
- Logcat 格式 (`01-15 14:30:00.123`)
- 仅时间格式 (`14:30:00`)

### JSON 嵌套敏感数据

自动遍历 JSON 嵌套结构，识别敏感字段：
- 顶层字段：`{"token": "xxx"}`
- 嵌套字段：`{"user": {"phone": "138xxxx5678"}}`
- 数组中的对象：`{"users": [{"email": "xxx@example.com"}]}`

## 测试

运行测试：

```bash
pytest -v
```

## 使用示例

### 1. 处理 sample 数据

```bash
# 使用 sample 数据测试
crashlog-tool process sample/logs \
  -s sample/sanitize_rules.json \
  -b sample/build_meta.yaml \
  -o out -f

# 查看生成的报告
cat out/report.md
```

### 2. 仅脱敏敏感信息

```bash
# 查看原始敏感数据
grep -E "1[3-9]\d{9}|token|email" sample/logs/android_logcat.txt

# 脱敏后
crashlog-tool sanitize sample/logs/android_logcat.txt
```

### 3. 校验日志目录

```bash
crashlog-tool validate sample/logs
```

## 依赖

- Python >= 3.8
- click >= 8.0.0
- pyyaml >= 6.0
- python-dateutil >= 2.8.0
- pytest >= 7.0.0 (测试用)

## License

MIT License
