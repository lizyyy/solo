# YAML 密钥泄漏检测 CLI 工具

一个本地 CLI 工具，用于扫描 YAML 文件中的密钥泄漏，避免误报占位变量。

## 功能特性

- **密钥模式检测**: 内置 15 种常见密钥模式（AWS、GitHub、Slack、Stripe、JWT、私钥、数据库连接串等）
- **风险分级**: 四个风险等级（low、medium、high、critical）
- **占位符过滤**: 自动识别并忽略 `${VAR}`、`{{VAR}}`、`<VAR>`、`%{VAR}`、`REPLACE_ME`、`CHANGEME` 等占位符
- **白名单机制**: 支持字段路径白名单和值白名单
- **配置文件支持**: YAML 格式配置文件
- **多种报告输出**:
  - 终端彩色摘要输出
  - JSON 格式机器可读结果
  - Markdown 格式适合发给同事的报告
  - 纯文本摘要
- **坏行保留**: 保留解析错误的原始位置和内容

## 安装

```bash
pip install pyyaml click rich
```

## 使用方法

### 基本扫描

```bash
# 扫描单个文件
python -m yaml_secret_scanner.cli scan path/to/file.yaml

# 扫描目录下所有 YAML 文件
python -m yaml_secret_scanner.cli scan path/to/directory/
```

### 选项

```bash
-v, --verbose                    # 详细输出
-c, --config PATH                # 配置文件路径
--whitelist TEXT                 # 白名单字段路径（可多次使用）
--output PATH                    # 报告输出目录
--json-output PATH               # JSON 结果输出路径
--markdown-output PATH           # Markdown 报告输出路径
--min-risk [low|medium|high|critical]  # 最低风险等级
--no-color                       # 禁用彩色输出
```

### 配置文件示例

```yaml
# scanner_config.yaml
whitelist:
  - "database.password"
  - "api.internal_key"
  - "config.*"  # 通配符支持

whitelist_values:
  - "default_password"
  - "test_key_123"

min_risk_level: "medium"

custom_patterns:
  company-api-key:
    regex: "(?i)company[_-]?api[_-]?key\\s*[:=]\\s*['\"]?([A-Z0-9]{20,})['\"]?"
    risk_level: "high"
    description: "公司内部API密钥"
    min_entropy: 3.5

exclude_patterns:
  - "tests/"
  - "node_modules/"
```

### 退出码

- `0`: 未发现问题且无解析错误
- `1`: 发现密钥泄漏问题或存在解析错误

## 报告示例

### 终端输出

```
        扫描概览         
┏━━━━━━━━━━━━━━━━┳━━━━━━┓
┃ 统计项         ┃ 数值 ┃
┡━━━━━━━━━━━━━━━━╇━━━━━━┩
│ 扫描文件总数   │    3 │
│ 发现问题的文件 │    1 │
│ 发现问题总数   │    6 │
│ 解析错误数     │    0 │
└────────────────┴──────┘

     风险等级分布     
┏━━━━━━━━━━━━━┳━━━━━━┓
┃ 风险等级    ┃ 数量 ┃
┡━━━━━━━━━━━━━╇━━━━━━┩
│ 🔴 CRITICAL │    4 │
│ ⚡ HIGH     │    2 │
│ ⚠ MEDIUM    │    0 │
│ ℹ LOW       │    0 │
└─────────────┴──────┘
```

### JSON 结果

```json
{
  "file_path": "secrets.yaml",
  "findings": [
    {
      "field_path": "aws.access_key_id",
      "line": 6,
      "column": 3,
      "value": "AKIAIOSFODNN7EXAMPLE",
      "pattern_name": "aws-access-key",
      "risk_level": "critical",
      "description": "AWS 访问密钥 ID",
      "raw_line": "access_key_id: AKIAIOSFODNN7EXAMPLE"
    }
  ]
}
```

## 项目结构

```
yaml_secret_scanner/
├── __init__.py          # 包初始化
├── cli.py               # CLI 入口
├── config.py            # 配置管理
├── detector.py          # 密钥模式检测器
├── models.py            # 数据模型
├── parser.py            # YAML 解析器（带位置信息）
├── reporter.py          # 报告生成器
└── scanner.py           # 扫描器主逻辑
```

## 内置密钥模式

| 模式名称 | 风险等级 | 描述 |
|---------|---------|------|
| aws-access-key | critical | AWS 访问密钥 ID |
| aws-secret-key | critical | AWS 秘密访问密钥 |
| github-token | critical | GitHub 个人访问令牌 |
| gitlab-token | critical | GitLab 个人访问令牌 |
| slack-token | critical | Slack API 令牌 |
| stripe-api-key | critical | Stripe API 密钥 |
| private-key | critical | RSA/EC/DSA 私钥 |
| jwt-token | high | JWT 令牌 |
| database-url | high | 数据库连接字符串 |
| api-key-generic | high | 通用 API 密钥 |
| bearer-token | high | Bearer 认证令牌 |
| oauth-secret | high | OAuth 客户端密钥 |
| basic-auth | medium | Basic 认证凭证 |
| hex-secret | medium | 十六进制密钥 |
| base64-secret | low | 长 Base64 字符串 |
