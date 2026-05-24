# 多语言长度溢出检测报告

生成时间: 2026/5/24 22:18:31
配置哈希: `75cee1ae`

## 摘要

| 指标 | 数值 |
|------|------|
| 总检测数 | 42 |
| 🔴 严重 | 19 |
| ⚠️ 警告 | 0 |
| ℹ️ 提示 | 1 |
| ✅ 安全 | 22 |
| 溢出问题 | 6 |
| 占位符问题 | 14 |

## 🔴 严重问题

| Key | 语言 | 位置 | 原文 | 宽度 | 限制 | 溢出 | 说明 |
|-----|------|------|------|------|------|------|------|
| sms.verificationCode | en | 登录按钮 | Your verification code is: ... | 68 | 30 | 38 | 严重溢出: 超出限制 126.7% (68/30) |
| sms.verificationCode | en | Toast提示 | Your verification code is: ... | 68 | 50 | 18 | 严重溢出: 超出限制 36.0% (68/50) |
| sms.welcome | en | 登录按钮 | Dear {username}, welcome back! | 40 | 30 | 10 | 严重溢出: 超出限制 33.3% (40/30) |
| toast.error | en | 登录按钮 | Operation failed, please tr... | 40 | 30 | 10 | 严重溢出: 超出限制 33.3% (40/30) |
| sms.passwordReset | en | 登录按钮 | Your password reset code is... | 39 | 30 | 9 | 严重溢出: 超出限制 30.0% (39/30) |
| button.login | en | 短信验证码 | Sign In | 7 | 70 | 0 | 缺失 2 个占位符，可能导致运行时错误 |
| button.logout | en | 短信验证码 | Sign Out | 8 | 70 | 0 | 缺失 2 个占位符，可能导致运行时错误 |
| button.submit | en | 短信验证码 | Submit Form | 11 | 70 | 0 | 缺失 2 个占位符，可能导致运行时错误 |
| button.confirm | en | 短信验证码 | Confirm and Continue | 20 | 70 | 0 | 缺失 2 个占位符，可能导致运行时错误 |
| button.cancel | en | 短信验证码 | Cancel Operation | 16 | 70 | 0 | 缺失 2 个占位符，可能导致运行时错误 |
| sms.verificationCode | en | 短信验证码 | Your verification code is: ... | 68 | 70 | 0 | 缺失 1 个占位符，可能导致运行时错误; 字符数超出: 68/35 |
| sms.welcome | en | 短信验证码 | Dear {username}, welcome back! | 40 | 70 | 0 | 缺失 1 个占位符，可能导致运行时错误; 字符数超出: 40/35 |
| sms.passwordReset | en | 短信验证码 | Your password reset code is... | 39 | 70 | 0 | 缺失 1 个占位符，可能导致运行时错误; 字符数超出: 39/35 |
| toast.success | en | 短信验证码 | Operation completed success... | 32 | 70 | 0 | 缺失 2 个占位符，可能导致运行时错误 |
| toast.error | en | 短信验证码 | Operation failed, please tr... | 40 | 70 | 0 | 缺失 2 个占位符，可能导致运行时错误; 字符数超出: 40/35 |
| toast.loading | en | 短信验证码 | Processing, please wait... | 26 | 70 | 0 | 缺失 2 个占位符，可能导致运行时错误 |
| plural.itemCount [zero] | en | 短信验证码 | No items | 8 | 70 | 0 | 缺失 2 个占位符，可能导致运行时错误 |
| plural.itemCount [one] | en | 短信验证码 | 1 item | 6 | 70 | 0 | 缺失 2 个占位符，可能导致运行时错误 |
| plural.itemCount [other] | en | 短信验证码 | {count} items | 16 | 70 | 0 | 缺失 2 个占位符，可能导致运行时错误 |

## ℹ️ 提示信息

| Key | 语言 | 位置 | 原文 | 宽度 | 限制 | 溢出 | 说明 |
|-----|------|------|------|------|------|------|------|
| toast.success | en | 登录按钮 | Operation completed success... | 32 | 30 | 2 | 轻微溢出: 超出限制 6.7% |

## 配置信息

### 输入文件

- `/Users/lzy/pro/solo/workspaces/zy71067/examples/locales/en.json`

### 检测配置

- **登录按钮** (zh-CN):
  - 最大宽度: 20 单位
- **登录按钮** (en):
  - 最大宽度: 30 单位
- **登录按钮** (ja):
  - 最大宽度: 25 单位
- **短信验证码** (*):
  - 最大宽度: 70 单位
  - 最大字符数: 35
  - 预期占位符: {code}, {username}
- **Toast提示** (*):
  - 最大宽度: 50 单位
