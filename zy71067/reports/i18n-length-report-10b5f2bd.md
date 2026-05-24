# 多语言长度溢出检测报告

生成时间: 2026/5/24 22:31:02
配置哈希: `10b5f2bd`

## 摘要

| 指标 | 数值 |
|------|------|
| 总检测数 | 33 |
| 🔴 严重 | 9 |
| ⚠️ 警告 | 0 |
| ℹ️ 提示 | 0 |
| ✅ 安全 | 24 |
| 溢出问题 | 0 |
| 占位符问题 | 9 |

## 🔴 严重问题

| Key | 语言 | 位置 | 原文 | 宽度 | 限制 | 溢出 | 说明 |
|-----|------|------|------|------|------|------|------|
| sms.verificationCode | en | 短信验证码 | Your verification code is: ... | 68 | 70 | 0 | 缺失 1 个占位符，可能导致运行时错误; 字符数超出: 68/35 |
| sms.welcome | en | 短信验证码 | Dear {username}, welcome back! | 40 | 70 | 0 | 缺失 1 个占位符，可能导致运行时错误; 字符数超出: 40/35 |
| sms.passwordReset | en | 短信验证码 | Your password reset code is... | 39 | 70 | 0 | 缺失 1 个占位符，可能导致运行时错误; 字符数超出: 39/35 |
| sms.verificationCode | ja | 短信验证码 | 認証コード：{code}、5分以内に入力してください | 49 | 70 | 0 | 缺失 1 个占位符，可能导致运行时错误 |
| sms.welcome | ja | 短信验证码 | {username}様、おかえりなさい！ | 40 | 70 | 0 | 缺失 1 个占位符，可能导致运行时错误 |
| sms.passwordReset | ja | 短信验证码 | パスワードリセットコード：{code} | 36 | 70 | 0 | 缺失 1 个占位符，可能导致运行时错误 |
| sms.verificationCode | zh-CN | 短信验证码 | 您的验证码是：{code}，请在5分钟内输入 | 41 | 70 | 0 | 缺失 1 个占位符，可能导致运行时错误 |
| sms.welcome | zh-CN | 短信验证码 | 尊敬的{username}，欢迎回来！ | 38 | 70 | 0 | 缺失 1 个占位符，可能导致运行时错误 |
| sms.passwordReset | zh-CN | 短信验证码 | 您的密码重置验证码是：{code} | 32 | 70 | 0 | 缺失 1 个占位符，可能导致运行时错误 |

## 配置信息

### 输入文件

- `/Users/lzy/pro/solo/workspaces/zy71067/examples/locales/en.json`
- `/Users/lzy/pro/solo/workspaces/zy71067/examples/locales/ja.json`
- `/Users/lzy/pro/solo/workspaces/zy71067/examples/locales/zh-CN.json`

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
