# 网页证据包整理员

为法务助理和售后仲裁小组设计的本地命令行工具，用于整理网页证据、生成时间线、校验完整性和脱敏敏感信息。

## 功能特性

- **证据导入**：导入 HTML/MHTML/HAR/PNG/JPG/PDF/TXT 文件，计算 SHA256 哈希，识别重复文件
- **时间线抽取**：从多种来源抽取事件，统一成带来源、时间、可信度和摘要的时间线
- **完整性校验**：检查证据编号缺失、时间倒序、跨时区冲突、哈希重复、HAR 错误、聊天记录缺页、敏感信息未脱敏
- **敏感信息脱敏**：按配置对手机号、邮箱、身份证号、地址和自定义关键词进行脱敏
- **报告导出**：导出 Markdown 证据目录、CSV 时间线和 JSON 审计清单
- **哈希校验**：重新校验哈希并报告文件移动、丢失或内容变化

## 安装

### 环境要求

- Python 3.9 或更高版本

### 安装步骤

1. 克隆或下载项目代码

2. 创建虚拟环境（推荐）：
```bash
python3 -m venv venv
source venv/bin/activate  # macOS/Linux
# 或
venv\Scripts\activate  # Windows
```

3. 安装依赖：
```bash
pip install -r requirements.txt
```

4. 安装项目（开发模式）：
```bash
pip install -e .
```

5. 验证安装：
```bash
evidence --version
evidence --help
```

## 快速开始

使用项目提供的示例证据文件进行测试。

### 1. 初始化案件

在工作目录中创建案件配置：

```bash
evidence init --case-id "REFUND-2024-001" --case-name "订单退款争议案"
```

参数说明：
- `--case-id, -i`：案件唯一标识（必填）
- `--case-name, -n`：案件名称（必填）
- `--timezone, -t`：时区，默认 `Asia/Shanghai`
- `--output-dir, -o`：输出目录，默认 `./output`
- `--evidence-dir, -e`：证据存储目录，默认 `./evidence`
- `--max-size, -s`：附件最大大小(MB)，默认 `100`
- `--force, -f`：覆盖现有配置

### 2. 导入示例证据

导入 `samples` 目录中的示例证据文件：

```bash
evidence import samples/
```

也可以导入多个目录：
```bash
evidence import samples/ another_dir/
```

导入结果会显示：
- 总文件数
- 成功导入的文件数
- 跳过的重复文件
- 文件名冲突情况
- 错误信息

### 3. 抽取时间线

从证据中抽取事件，生成 `timeline.json`：

```bash
evidence extract
```

时间线会包含以下信息：
- 事件 ID
- 来源类型（HTML 页面、HAR 日志、聊天记录等）
- 时间戳和时区
- 时间可信度等级
- 事件摘要
- 详细信息

时间可信度等级：
- `high`：高可信度（HAR 日志中的时间）
- `medium`：中等可信度（HTML meta 时间、聊天记录时间）
- `low`：低可信度（文件修改时间、截图 EXIF 时间）
- `untrusted`：不可信

### 4. 检查证据问题

执行完整性校验：

```bash
evidence check
```

检查项包括：
- 证据编号缺失
- 时间倒序
- 跨时区冲突
- 附件哈希重复
- HAR 中的 4xx/5xx 错误请求
- 聊天记录缺页迹象
- 敏感信息未脱敏

使用 `-q` 选项将问题证据移入隔离区：
```bash
evidence check -q
```

隔离区文件会保存到 `./quarantine/quarantine.json`。

### 5. 脱敏敏感信息

对证据中的敏感信息进行脱敏处理（不修改原始证据）：

```bash
evidence redact
```

默认脱敏规则：
- 手机号 → `[PHONE]`
- 邮箱 → `[EMAIL]`
- 身份证号 → `[ID_CARD]`
- 地址 → `[ADDRESS]`

使用 `-r` 选项添加自定义脱敏关键词：
```bash
evidence redact -r "张三" -r "李四"
```

脱敏后的文件会保存到 `./redacted/` 目录，原始证据保持不变。

### 6. 导出报告

导出证据目录、时间线和审计清单：

```bash
evidence report
```

生成的文件：
- `evidence_catalog.md`：Markdown 格式的证据目录
- `timeline.csv`：CSV 格式的时间线（可选，需要先执行 extract）
- `audit_manifest.json`：JSON 格式的审计清单

指定导出格式：
```bash
evidence report -f markdown
evidence report -f csv -f json
```

添加文件名前缀：
```bash
evidence report -p "20240515_"
```

### 7. 二次校验

重新校验证据完整性：

```bash
evidence verify
```

会报告以下问题：
- 有效文件（哈希匹配）
- 丢失文件
- 被修改文件（哈希不匹配）

保存验证结果：
```bash
evidence verify -o output/verify_result.json
```

## 目录结构

```
web_evidence_organizer/
├── __init__.py           # 包初始化
├── cli.py                # CLI 入口
├── config.py             # 配置模型
├── hasher.py             # 哈希计算与重复检测
├── importer.py           # 证据导入
├── html_parser.py        # HTML 页面解析
├── har_parser.py         # HAR 日志解析
├── chat_parser.py        # 聊天记录解析
├── timeline.py           # 时间线抽取与合并
├── validator.py          # 校验规则
├── redactor.py           # 敏感信息脱敏
├── quarantine.py         # 隔离区管理
└── reporter.py           # 报告导出

samples/                  # 示例证据文件
├── sample_page.html      # 示例 HTML 页面
├── sample_chat.txt       # 示例聊天记录
└── sample_log.har        # 示例 HAR 日志

tests/                    # 测试文件
├── __init__.py
├── test_config.py        # 配置模块测试
└── test_hasher.py        # 哈希模块测试

setup.py                  # 安装配置
requirements.txt          # 依赖列表
README.md                 # 本文档
```

## 配置说明

案件配置文件 `case_config.json` 包含以下配置项：

### 证据类型映射

```json
{
  "evidence_types": {
    "html": "html_page",
    "htm": "html_page",
    "mhtml": "mhtml_archive",
    "mht": "mhtml_archive",
    "har": "har_log",
    "png": "screenshot",
    "jpg": "screenshot",
    "jpeg": "screenshot",
    "pdf": "pdf_document",
    "txt": "chat_log"
  }
}
```

### 脱敏规则

```json
{
  "redaction_rules": [
    {
      "name": "手机号",
      "pattern": "1[3-9]\\d{9}",
      "replacement": "[PHONE]",
      "enabled": true
    },
    {
      "name": "邮箱",
      "pattern": "[\\w.-]+@[\\w.-]+\\.\\w+",
      "replacement": "[EMAIL]",
      "enabled": true
    }
  ]
}
```

### 时间可信度规则

```json
{
  "time_trust_rules": [
    {
      "source": "har_request_time",
      "trust_level": "high",
      "description": "HAR日志中的请求时间"
    },
    {
      "source": "chat_message_time",
      "trust_level": "medium",
      "description": "聊天记录中的消息时间"
    },
    {
      "source": "file_modified_time",
      "trust_level": "low",
      "description": "文件修改时间"
    }
  ]
}
```

## 运行测试

使用 pytest 运行测试：

```bash
pytest tests/ -v
```

或使用覆盖率报告：

```bash
pytest tests/ --cov=web_evidence_organizer -v
```

## 完整示例流程

以下是一个完整的使用示例，使用临时目录进行测试：

```bash
# 创建临时工作目录
mkdir -p /tmp/evidence_test
cd /tmp/evidence_test

# 1. 初始化案件
evidence init \
  --case-id "TEST-2024-001" \
  --case-name "测试案件" \
  --timezone "Asia/Shanghai"

# 2. 导入示例证据（假设 samples 目录在当前位置）
evidence import /path/to/repo/samples/

# 3. 查看证据索引
ls -la output/

# 4. 抽取时间线
evidence extract

# 5. 检查问题
evidence check

# 6. 脱敏敏感信息
evidence redact

# 7. 导出报告
evidence report

# 8. 二次校验
evidence verify

# 查看生成的文件
echo "=== 生成的文件 ==="
ls -la output/
ls -la redacted/
ls -la evidence/
```

## 注意事项

1. **原始证据保护**：`import` 命令会复制原始证据到证据目录，不会修改源文件；`redact` 命令只会生成脱敏副本，不会修改原始证据。

2. **截图元数据**：导入截图时会检查 EXIF 元数据，如果发现编辑软件痕迹（如 Photoshop、GIMP）会发出警告。

3. **二进制文件脱敏**：图片（PNG/JPG）和 PDF 文件目前不支持自动脱敏，会原样复制到脱敏目录。

4. **SHA256 校验**：所有证据文件在导入时都会计算 SHA256 哈希，`verify` 命令会重新计算并比对。

5. **时区处理**：所有时间戳会统一转换为配置的时区，建议在初始化时设置正确的时区。

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request。
