# YAML 密钥泄漏扫描报告

## 扫描概览

- **扫描文件总数**: 3
- **发现问题总数**: 6
- **解析错误数**: 2

## 发现的问题

### 文件: `tests/test_files/valid_secrets.yaml`

| 行 | 字段路径 | 风险等级 | 描述 | 原始内容 |
|----|----------|----------|------|----------|
| 2 | `database.url` | **HIGH** | 数据库连接字符串 | `url: postgres://user:mysecretpassword123@localhost:5432/mydb` |
| 6 | `aws.access_key_id` | **CRITICAL** | AWS 访问密钥 ID | `access_key_id: AKIAIOSFODNN7EXAMPLE` |
| 10 | `api.token` | **CRITICAL** | GitHub 个人访问令牌 | `token: github_token_example_abcdefghijklmnopqrstuvwxyz1234567890` |
| 14 | `jwt.token` | **HIGH** | JWT 令牌 | `token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c` |
| 17 | `slack.webhook_url` | **CRITICAL** | Slack API 令牌 | `webhook_url: https://example.invalid/slack-webhook/example-token` |
| 1 | `private_key` | **CRITICAL** | 私钥 | `database:` |

## 解析错误

### 文件: `tests/test_files/broken.yaml`

| 行 | 列 | 错误信息 | 原始内容 |
|----|----|----------|----------|
| 3 | 13 | YAML解析错误: mapping values are not allowed here
  in "<unicode string>", line 3, column 13:
        password: invalid_indentation  # 这里缩进错误
                ^ | `    password: invalid_indentation  # 这里缩进错误` |

### 文件: `tests/test_files/placeholders.yaml`

| 行 | 列 | 错误信息 | 原始内容 |
|----|----|----------|----------|
| 3 | 14 | YAML解析错误: while constructing a mapping
  in "<unicode string>", line 3, column 13:
      password: {{ DB_PASSWORD }}
                ^
found unhashable key
  in "<unicode string>", line 3, column 14:
      password: {{ DB_PASSWORD }}
                 ^ | `  password: {{ DB_PASSWORD }}` |
