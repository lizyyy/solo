# APIcassette 脱敏排查 CLI

一个用于检测和清除 HTTP 录制文件中敏感数据的命令行工具。

## 功能特性

- 🔍 **智能扫描**: 自动识别 Token、手机号、身份证号、邮箱、密码等敏感数据
- 🔄 **稳定替换**: 相同原始值替换为相同掩码值，保持测试一致性
- ✅ **双重复检**: 脱敏后自动复检，确保无残留
- 📊 **双格式报告**: 机器可读 JSON + 人类可读文本报告
- 📁 **多格式支持**: 支持 YAML 和 JSON 格式的 cassette 文件

## 安装

```bash
pip install -r requirements.txt
```

## 快速开始

### 1. 扫描并脱敏

```bash
python main.py sanitize examples/dirty_cassette.yaml \
  --output output/sanitized.yaml \
  --json-report output/report.json \
  --human-report output/report.txt
```

### 2. 仅扫描（不修改）

```bash
python main.py scan examples/dirty_cassette.yaml
```

### 3. 深度复检

```bash
python main.py recheck output/sanitized.yaml
```

### 4. 查看可用规则

```bash
python main.py list-rules
```

## 内置规则

| 规则名称 | 描述 |
|---------|------|
| bearer_token | Bearer JWT Token |
| jwt_token | JWT Token (eyJ 开头) |
| api_key | API Key (sk_, pk_, api-key 等) |
| phone_number | 中国手机号 (含 +86 前缀) |
| id_card | 中国身份证号 |
| email | 邮箱地址 |
| password | 密码字段 |
| secret | Secret 字段 |

## 自定义规则

创建 JSON 规则文件：

```json
[
  {
    "name": "custom_key",
    "pattern": "custom_[a-z0-9]{16,32}"
  }
]
```

使用自定义规则：

```bash
python main.py sanitize input.yaml --rules custom_rules.json
```

## 示例文件

| 文件 | 描述 |
|-----|------|
| clean_cassette.yaml | 无敏感数据的正常 cassette |
| dirty_cassette.yaml | 包含各类敏感数据 |
| boundary_conflict.yaml | 边界冲突测试用例 |
| empty_cassette.yaml | 空 cassette |
| json_cassette.json | JSON 格式 cassette |

## 项目结构

```
apicassette_sanitizer/
├── __init__.py          # 版本信息
├── rules_engine.py      # 脱敏规则引擎
├── cassette_parser.py   # Cassette 解析器
├── report_exporter.py   # 报告导出器
└── cli.py               # CLI 接口
```

## 退出码

- `0`: 成功，无敏感数据或已完全脱敏
- `1`: 执行错误
- `2`: 发现敏感数据残留

## 许可证

MIT License
